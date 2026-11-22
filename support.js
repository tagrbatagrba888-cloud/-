const API='https://weshah-admin.vercel.app/api/support';
const TOPICS=[['catalog_details','سعر المنتج والمخزون'],['shipping_policy','الشحن والتوصيل'],['returns_policy','الاسترجاع'],['payment_help','المساعدة في الدفع'],['contact_human','التواصل مع شخص']];
export function mountSupport({auth,openAccount,getProducts}){
 const dialog=document.createElement('dialog');dialog.dir='rtl';dialog.id='supportDialog';dialog.setAttribute('aria-labelledby','supportHeading');
 dialog.style.cssText='box-sizing:border-box;border:1px solid #d9dfd7;border-radius:22px;padding:22px;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;font:14px/1.9 system-ui;background:#fffdf8;color:#17251f';
 dialog.innerHTML='<h2 id="supportHeading" style="margin:0 0 8px">مساعد وشاح</h2><p style="font-size:12px;color:#58695f">تجربة محدودة للموضوعات العامة، وليست دردشة مفتوحة. مزوّد الذكاء الاصطناعي يستقبل الموضوع والأرقام العامة فقط، من غير أسماء المنتجات أو بيانات حسابك. لا ينفذ طلبات أو مدفوعات أو رسائل.</p><p id="supportState" role="status"></p><form id="supportForm"><label for="supportTopic">الموضوع</label><select id="supportTopic" style="display:block;box-sizing:border-box;width:100%;padding:12px;margin:6px 0 14px;border:1px solid #d9dfd7;border-radius:10px;font:inherit;background:white;color:inherit"></select><div id="supportProductField"><label for="supportProduct">المنتج المنشور</label><select id="supportProduct" style="display:block;box-sizing:border-box;width:100%;padding:12px;margin:6px 0 14px;border:1px solid #d9dfd7;border-radius:10px;font:inherit;background:white;color:inherit"></select></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="supportAsk" class="btn btn-dark" type="submit" disabled>اطلب الرد</button><button id="supportLogin" class="btn btn-outline" type="button" hidden>تسجيل الدخول</button><button id="supportClose" class="btn btn-outline" type="button">إغلاق</button></div></form><section id="supportResult" hidden style="margin-top:18px;padding:14px;border:1px solid #d9dfd7;border-radius:12px"><h3 style="font-size:14px;margin:0 0 8px">رد المساعد المقيّد</h3><p id="supportAnswer" style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0"></p><p id="supportAsOf" style="font-size:11px;color:#58695f"></p><p id="supportHandoff" hidden style="font-size:12px">قد تحتاج لمراجعة إدارة المتجر. لم يتم إرسال أي رسالة دعم من هنا.</p><button id="supportAccount" type="button" class="btn btn-outline">فتح حسابي</button></section>';
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#'+id),topic=q('supportTopic'),product=q('supportProduct'),ask=q('supportAsk'),state=q('supportState'),login=q('supportLogin');let ready=false,busy=false,view=0;
 for(const [value,text]of TOPICS){const o=document.createElement('option');o.value=value;o.textContent=text;topic.append(o);}
 const launch=document.createElement('button');launch.type='button';launch.className='iconbtn';launch.id='supportButton';launch.setAttribute('aria-label','مساعد وشاح');launch.title='مساعد وشاح';launch.style.cssText='position:fixed;left:16px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:65;width:52px;height:52px;padding:12px;border-radius:50%;background:#073b29;color:white;box-shadow:0 4px 18px #0003';launch.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M9 10a3 3 0 0 1 5.8 1c0 2-3 2-3 4m0 2h.01"/></svg><span class="actionlabel" style="display:none">المساعد</span>';
 document.body.append(launch);
 function refresh(){topic.disabled=busy;product.disabled=busy;q('supportProductField').hidden=topic.value!=='catalog_details';ask.disabled=busy||!ready||!auth.currentUser||(topic.value==='catalog_details'&&!product.value);login.hidden=!!auth.currentUser;}
 topic.onchange=product.onchange=()=>{q('supportResult').hidden=true;refresh();};
 dialog.addEventListener('close',()=>{view++;q('supportResult').hidden=true;});
 q('supportClose').onclick=()=>dialog.close();login.onclick=q('supportAccount').onclick=()=>{dialog.close();openAccount();};
 launch.onclick=async()=>{
  const activeView=++view;dialog.showModal();q('supportResult').hidden=true;ready=false;product.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent='اختر منتجًا';product.append(first);
  for(const p of getProducts().slice(0,200)){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;product.append(o);}
  refresh();
  if(!navigator.onLine){state.textContent='اتصل بالإنترنت لاستخدام المساعد. لا نعيد إرسال الطلبات تلقائيًا عند عودة الاتصال.';return;}
  if(!auth.currentUser){state.textContent='سجّل الدخول لحساب المتجر أولًا. لا ترسل بيانات شخصية إلى المساعد.';return;}
  state.textContent='جارٍ التحقق من توفر المساعد...';
  try{const r=await fetch(API,{cache:'no-store',signal:AbortSignal.timeout(8000)}),d=await r.json();if(activeView!==view)return;ready=r.ok&&d.enabled===true&&d.mode==='public-topics-only';state.textContent=ready?'اختر الموضوع. الطلبات محدودة للحفاظ على التجربة المجانية.':'المساعد غير متاح حاليًا. لم يتم إرسال أي طلب دعم.';}catch{if(activeView!==view)return;state.textContent='تعذّر الاتصال بالمساعد. لم نرسل طلبًا إلى الذكاء الاصطناعي.';}
  refresh();
 };
 q('supportForm').onsubmit=async e=>{
  e.preventDefault();if(busy||!ready||!auth.currentUser||!navigator.onLine)return;
  if(topic.value==='catalog_details'&&!product.value)return;
  const activeView=view,account=auth.currentUser;
  const body={topic:topic.value,productIds:topic.value==='catalog_details'?[product.value]:[]};
  busy=true;refresh();q('supportResult').hidden=true;state.textContent='جارٍ طلب رد واحد. لا توجد إعادة محاولة تلقائية...';
  try{
   const token=await account.getIdToken();
   if(activeView!==view||auth.currentUser!==account)return;
   // Only the fixed topic and optional product ID captured before the request are sent.
   const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw Object.assign(new Error(),{status:r.status});
   const d=await r.json();
   if(activeView!==view||!dialog.open||auth.currentUser!==account)return;
   if(!d||Object.keys(d).sort().join(',')!=='answer,asOf,handoff,mode'||typeof d.answer!=='string'||!d.answer.length||d.answer.length>1200||typeof d.handoff!=='boolean'||!Number.isFinite(d.asOf)||d.mode!=='public-topics-only')throw Error('schema');
   q('supportAnswer').textContent=d.answer;q('supportHandoff').hidden=!d.handoff;
   q('supportAsOf').textContent='حسب البيانات المقروءة وقت السؤال. السعر النهائي والتوفر يُراجعان قبل تأكيد الطلب.';
   q('supportResult').hidden=false;state.textContent='وصل رد مقيّد بمعلومات المتجر. لم يتم تنفيذ أي إجراء.';
  }catch(err){if(activeView!==view||auth.currentUser!==account)return;state.textContent=err.status===401?'انتهت جلسة الحساب. سجّل الدخول من جديد.':err.status===429?'بلغت التجربة حد الاستخدام المتاح حاليًا. جرّب لاحقًا.':err.status===404?'المنتج غير متاح للمساعد. راجع صفحته أو اختر منتجًا آخر.':'المساعد غير متاح حاليًا. لم يتم تنفيذ أي إجراء أو إرسال رسالة دعم.';
  }finally{busy=false;refresh();}
 };
 return {dialog,launch};
}
