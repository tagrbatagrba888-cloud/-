import { registrationFields } from './egypt-address-model.mjs';
export class AccountChanged extends Error { constructor(){super('تغيّر حساب الدخول. لم نعرض أو نتابع بيانات الحساب السابق.');this.code='account-changed';} }
export const PROFILE_API='https://weshah-admin.vercel.app/api/profile';
const clone=value=>structuredClone(value);
const draftFields=input=>({name:input.name,phone:input.phone,username:input.username,email:input.email,address:input.address?Object.fromEntries(['datasetVersion','mode','governorateCode','centerCode','localityCode','customCenter','customLocality','details'].filter(k=>k in input.address).map(k=>[k,input.address[k]])):null});
export function profileInput(input){
 const fields=registrationFields({fullName:input.name,phone:input.phone,username:input.username,email:input.email});
 return {name:fields.fullName,phone:fields.phone,username:fields.username,email:fields.email,address:clone(input.address)};
}
export function createProfileRemote({auth,fetcher=fetch,timeoutMs=20000}){return async(input,{uid,guard,signal})=>{
 const account=auth.currentUser;
 if(!account||account.uid!==uid||!guard())throw new AccountChanged();
 const token=await account.getIdToken();
 if(!guard()||auth.currentUser?.uid!==uid)throw new AccountChanged();
 const response=await fetcher(PROFILE_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]),
  body:JSON.stringify({action:'saveProfile',name:input.name,phone:input.phone,username:input.username,address:input.address})});
 if(!guard()||auth.currentUser?.uid!==uid)throw new AccountChanged();
 const data=await response.json();
 if(!guard()||auth.currentUser?.uid!==uid)throw new AccountChanged();
 if(!response.ok)throw new Error(typeof data?.error==='string'&&data.error.length<=400?data.error:'تعذّر تأكيد حفظ البيانات. أعد المحاولة من نفس الحساب.');
 const p=data?.profile;
 if(data.ok!==true||p?.uid!==uid||typeof p.email!=='string'||p.email.toLowerCase()!==account.email?.toLowerCase()||p.profileSchemaVersion!==1||typeof p.name!=='string'||typeof p.phone!=='string'||typeof p.username!=='string'||typeof p.city!=='string'||typeof p.address!=='string'||!p.addressV1)throw new Error('تعذّر التحقق من نتيجة الحفظ. راجع بياناتك وأعد المحاولة من نفس الحساب.');
 return p;
};}
// Holds only nonpassword inputs, in memory, never in local/session storage.
export function createProfileFlow({auth,createAccount,saveRemote,onState=()=>{},onSaved=()=>{},onIncomplete=()=>{}}){
 let draft=null,currentUid=auth.currentUser?.uid??null,generation=0,revision=0,busy=false,creation=null,recovery=false,controller;
 const state=()=>({draft:draft?clone(draft):null,busy,revision,uid:currentUid,recovery});
 function emit(message,kind='info'){onState({...state(),message,kind});}
 function same(uid,sequence){return generation===sequence&&auth.currentUser?.uid===uid&&currentUid===uid;}
 function observe(){
  const next=auth.currentUser?.uid??null;if(next===currentUid)return;
  const previous=currentUid;currentUid=next;
  if(creation){
   creation.transitions.push(next);
   if(previous!==null||next===null||creation.transitions.length>1){creation.invalid=true;generation++;controller?.abort();draft=null;recovery=false;busy=false;emit('تغيّر الحساب. تم إسقاط مسودة الحساب السابق.','account-changed');}
   return;
  }
  generation++;controller?.abort();draft=null;recovery=false;busy=false;emit('تغيّر حساب الدخول. لا توجد مسودة لحساب آخر.','account-changed');
 }
 function remember(input){
  if(busy)return;
  const uid=auth.currentUser?.uid??null;
  draft={ownerUid:uid,input:clone(draftFields(input))};
 }
 async function persist(sequence){
  const uid=draft?.ownerUid;if(!uid||!same(uid,sequence))throw new AccountChanged();
  const input=clone(draft.input);controller=new AbortController();const signal=controller.signal;busy=true;revision++;emit('جارٍ حفظ بيانات حسابك والتحقق منها…','saving');
  try{
   const profile=await saveRemote(input,{uid,signal,guard:()=>same(uid,sequence)});
   if(!same(uid,sequence))throw new AccountChanged();
   const wasRegistration=recovery;draft=null;recovery=false;busy=false;revision++;
   onSaved(profile,{newAccount:wasRegistration});emit('تم حفظ بياناتك والتحقق منها. اسم المستخدم خاص بحسابك وليس اسم دخول أو حجزًا فريدًا.','success');return {ok:true,profile};
  }catch(error){
   if(!same(uid,sequence))return {ok:false,accountChanged:true};
   busy=false;
   emit(recovery?'تم إنشاء حساب الدخول، لكن لم نتأكد من حفظ البيانات الإضافية. أنت مسجّل بالفعل. راجع النموذج ثم اضغط حفظ البيانات، من غير إنشاء حساب جديد.':(error.code==='account-changed'?'تغيّر حساب الدخول.':error.message||'تعذّر تأكيد حفظ البيانات. أعد المحاولة من نفس الحساب.'),'error');
   return {ok:false,incomplete:recovery};
  }
 }
 async function register(input,password){
  if(busy) return {ok:false,busy:true};
  if(auth.currentUser)throw new Error('أنت مسجّل بالفعل. أكمل بيانات حسابك بدل إنشاء حساب آخر.');
  const normalized=profileInput(input);draft={ownerUid:null,input:normalized};recovery=false;busy=true;
  const sequence=++generation;creation={transitions:[],invalid:false};emit('جارٍ إنشاء حساب الدخول مرة واحدة…','creating');
  let credential;
  try{
   try{credential=await createAccount(normalized.email,password);}finally{password='';}
   observe();
   const account=credential?.user,attempt=creation;
   if(sequence!==generation||attempt?.invalid||!account||auth.currentUser?.uid!==account.uid||account.email?.toLowerCase()!==normalized.email.toLowerCase()||attempt.transitions.some(uid=>uid!==account.uid))throw new AccountChanged();
   draft.ownerUid=account.uid;creation=null;recovery=true;onIncomplete(account.uid);return await persist(sequence);
  }catch(error){
   const attempt=creation;creation=null;password='';
   if(sequence!==generation||error.code==='account-changed'){if(sequence===generation){draft=null;busy=false;}return {ok:false,accountChanged:true};}
   // An SDK rejection can occur after sign-in. Do not offer another creation.
   const signed=auth.currentUser;
   if(signed&&!attempt?.invalid&&signed.email?.toLowerCase()===normalized.email.toLowerCase()&&attempt?.transitions.every(uid=>uid===signed.uid)){
    currentUid=signed.uid;draft={ownerUid:signed.uid,input:normalized};recovery=true;busy=false;onIncomplete(signed.uid);emit('أنت مسجّل بحساب الدخول. لم نؤكد حفظ البيانات الإضافية. أكملها من بياناتي، ولا تنشئ حسابًا جديدًا.','error');return {ok:false,incomplete:true};
   }
   if(signed){draft=null;busy=false;emit('تغيّر حساب الدخول. لم نستخدم مسودة الحساب السابق.','account-changed');return {ok:false,accountChanged:true};}
   busy=false;emit('تعذّر إنشاء حساب الدخول. راجع البريد وكلمة المرور ثم حاول مجددًا. بيانات النموذج غير السرية باقية في هذه الصفحة.','error');return {ok:false};
  }
 }
 async function save(input){
  if(busy)return {ok:false,busy:true};observe();const uid=auth.currentUser?.uid;if(!uid)throw new Error('سجّل الدخول ثم أكمل بياناتك.');
  const normalized=profileInput(input);
  if(normalized.email.toLowerCase()!==auth.currentUser.email?.toLowerCase())throw new AccountChanged();
  draft={ownerUid:uid,input:normalized};const sequence=++generation;return persist(sequence);
 }
 return {get state(){return state();},get revision(){return revision;},observe,remember,register,save,
  destroy(){generation++;controller?.abort();draft=null;creation=null;busy=false;recovery=false;}};
}
