import {mountAddress} from './egypt-address-ui.mjs';
import {createProfileFlow,createProfileRemote,profileInput} from './profile-flow.mjs';
const element=(tag,text='',attrs={})=>{const n=document.createElement(tag);n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
export function mountProfileEditor({auth,subscribeAuth,createAccount,getProfile,onSaved,onIncomplete,onAccountChange=()=>{},fetcher=fetch}){
 const mounted=new Map();let lastState={message:'',kind:'info'},disposed=false;
 const sameOwner=d=>d&&((d.ownerUid===null&&!auth.currentUser)||d.ownerUid===auth.currentUser?.uid);
 function paint(){for(const [form,e]of mounted){if(!form.isConnected)continue;const message=lastState.message||'اسم المستخدم خاص بحسابك، وليس اسم دخول أو اسمًا محجوزًا فريدًا.';if(e.status.textContent!==message)e.status.textContent=message;for(const n of form.querySelectorAll('input,select,textarea,button[type=submit]')){
  if(flow.state.busy){if(!n.disabled)n.dataset.profileBusy='1';n.disabled=true;}else if(n.dataset.profileBusy){delete n.dataset.profileBusy;n.disabled=false;}
 }}}
 const flow=createProfileFlow({auth,createAccount,saveRemote:createProfileRemote({auth,fetcher}),
  onState(state){lastState=state;if(state.kind==='creating'||state.kind==='saving')document.getElementById('toast')?.classList.remove('show');if(state.kind==='account-changed')onAccountChange();paint();},
  onIncomplete(uid){if(auth.currentUser?.uid!==uid)return;onIncomplete(uid);refresh(true);},
  onSaved(profile,meta){if(auth.currentUser?.uid!==profile.uid)return;onSaved(profile,meta);refresh(true);}
 });
 function entryInput(form,e,validate=false){
  const registration=form.id==='authForm';
  const address=validate?e.address.collectInput():e.address.snapshot();
  return {name:form.querySelector(registration?'#auName':'#prName').value,phone:form.querySelector(registration?'#auPhone':'#prPhone').value,
   username:e.username.value,email:registration?form.querySelector('#auEmail').value:auth.currentUser?.email||'',address};
 }
 function hydrate(form,e){
  const registration=form.id==='authForm',d=flow.state.draft,p=registration?{}:getProfile()||{};
  const input=sameOwner(d)?d.input:null;
  const name=form.querySelector(registration?'#auName':'#prName'),phone=form.querySelector(registration?'#auPhone':'#prPhone');
  if(input){name.value=input.name||'';phone.value=input.phone||'';e.username.value=input.username||'';if(registration)form.querySelector('#auEmail').value=input.email||'';if(input.address)e.address.setValue(input.address).catch(()=>{});}
  else if(!registration){name.value=p.name||auth.currentUser?.displayName||'';phone.value=p.phone||'';e.username.value=p.username||'';if(p.addressV1)e.address.setValue(p.addressV1).catch(()=>{});}
 }
 function refresh(force=false){
  if(disposed)return;
  for(const[form,e]of mounted)if(!form.isConnected){e.address.destroy();mounted.delete(form);}
  for(const id of ['authForm','profForm']){
   const form=document.getElementById(id);if(!form||(id==='authForm'&&!form.querySelector('#auName')))continue;
   if(mounted.has(form)){if(force)hydrate(form,mounted.get(form));continue;}
   const host=element('section','',{'data-profile-editor':'',class:'eg-address',dir:'rtl'});
   const note=element('p',id==='authForm'?'الدخول بالبريد الإلكتروني وكلمة المرور كما هو. اسم المستخدم خاص بحسابك، وليس اسم دخول أو حجزًا لاسم فريد.':'يمكنك إكمال بيانات هذا الحساب هنا حتى بعد إعادة تحميل الصفحة. العنوان القديم معروض كما هو، ولن نخمن رموزًا له. اختر عنوانك أدناه للحفظ. اسم المستخدم ليس اسم دخول أو حجزًا فريدًا.',{class:'eg-note'});
   host.append(note);const label=element('label','اسم المستخدم الخاص *',{class:'eg-field'}),username=element('input','',{maxlength:'40',autocomplete:'nickname','data-profile':'username'});label.append(username);host.append(label);
   const addressHost=element('div');host.append(addressHost);const status=element('p','',{class:'eg-status','data-profile-status':'',role:'status','aria-live':'polite'});host.append(status);
   let anchor=form.querySelector('button[type=submit]');while(anchor&&anchor.parentElement!==form)anchor=anchor.parentElement;form.insertBefore(host,anchor||null);
   if(id==='profForm'){for(const key of ['prCity','prAddr']){const field=form.querySelector('#'+key);if(field){field.readOnly=true;field.setAttribute('aria-label','العنوان النصي السابق للعرض فقط');}}}
   const e={host,username,status,address:mountAddress(addressHost),ownerUid:auth.currentUser?.uid??null};mounted.set(form,e);hydrate(form,e);
   const remember=()=>{if(form.isConnected&&!flow.state.busy&&e.ownerUid===(auth.currentUser?.uid??null))flow.remember(entryInput(form,e));};
   form.addEventListener('input',remember);
   form.addEventListener('change',remember);
  }
  paint();
 }
 const observer=new MutationObserver(()=>refresh());observer.observe(document.body,{childList:true,subtree:true});
 const unsubscribe=subscribeAuth(()=>{flow.observe();refresh();});
 refresh();
 async function submit(form,registration){
  refresh();const e=mounted.get(form);if(!e||!form.isConnected||flow.state.busy||e.ownerUid!==(auth.currentUser?.uid??null))return;
  try{
   const input=profileInput(entryInput(form,e,true));
   if(registration){let password=form.querySelector('#auPass').value;if(password.length<6)throw Error('كلمة المرور: ٦ أحرف على الأقل.');const request=flow.register(input,password);password='';form.querySelector('#auPass').value='';return await request;}
   return await flow.save(input);
  }catch(error){lastState={message:error.message||'راجع بيانات النموذج.',kind:'error'};paint();}
 }
 return {get revision(){return flow.revision;},submitRegistration:form=>submit(form,true),saveProfileForm:form=>submit(form,false),refresh,
  destroy(){disposed=true;observer.disconnect();unsubscribe?.();flow.destroy();for(const e of mounted.values())e.address.destroy();mounted.clear();}};
}
