const API='https://weshah-admin.vercel.app/api/push';
export function mountNotifications({auth,openAccount,toast}){
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const dialog=document.createElement('dialog');dialog.dir='rtl';dialog.id='notificationSettings';dialog.style.cssText='border:1px solid #d9dfd7;border-radius:22px;padding:24px;max-width:min(460px,88vw);font:14px/1.9 system-ui;background:#fffdf8;color:#17251f';
 dialog.innerHTML='<h2 style="margin:0 0 10px">إشعارات وشاح</h2><p id="notificationState" role="status"></p><form id="notificationForm"><label style="display:flex;gap:10px;margin:16px 0"><input id="notifyOrders" type="checkbox"> تأكيد الطلب ومتابعة التوصيل</label><label style="display:flex;gap:10px;margin:16px 0"><input id="notifyMarketing" type="checkbox"> المنتجات والعروض الجديدة</label><p style="font-size:12px;color:#66736b">اختيارك لهذا الجهاز فقط. يمكنك إيقاف الإشعارات أو تغيير الفئات في أي وقت. لن نطلب إذن المتصفح قبل اختيارك وحفظك.</p><button id="saveNotifications" class="btn btn-dark" type="submit" disabled>حفظ الاختيار</button> <button id="notificationLogin" class="btn btn-outline" type="button" hidden>تسجيل الدخول</button> <button id="closeNotifications" class="btn btn-outline" type="button">إغلاق</button></form>';
 document.body.append(dialog);
 const launch=document.createElement('button');launch.type='button';launch.className='iconbtn';launch.id='notificationSettingsButton';launch.title='إعدادات الإشعارات';launch.setAttribute('aria-label','إعدادات الإشعارات');launch.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="actionlabel">الإشعارات</span>';
 (document.querySelector('.actions')||document.querySelector('header'))?.append(launch);
 const state=dialog.querySelector('#notificationState'),save=dialog.querySelector('#saveNotifications'),orders=dialog.querySelector('#notifyOrders'),marketing=dialog.querySelector('#notifyMarketing'),login=dialog.querySelector('#notificationLogin');let config,busy=false;
 async function call(action,body){const user=auth.currentUser;if(!user)throw Error('سجّل الدخول أولًا.');const token=await user.getIdToken();const r=await fetch(API+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok)throw Error(r.status===401?'انتهت جلسة حسابك. سجّل الدخول من جديد.':r.status===409?'هذا الجهاز مرتبط بحساب آخر. أوقف اشتراكه من ذلك الحساب أولًا.':'تعذّر حفظ إعدادات الإشعارات. حاول لاحقًا.');return d;}
 function key(v){const raw=atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
 launch.addEventListener('click',async()=>{
  dialog.showModal();save.disabled=true;orders.checked=false;marketing.checked=false;login.hidden=!!auth.currentUser;
  if(!supported){state.textContent='الإشعارات غير مدعومة هنا. على iPhone افتح وشاح من الشاشة الرئيسية بعد تثبيته، ثم افتح هذه الإعدادات.';return;}
  if(!auth.currentUser){state.textContent='سجّل الدخول لحساب المتجر لربط إشعارات هذا الجهاز بك فقط.';return;}
  if(Notification.permission==='denied'){state.textContent='المتصفح يمنع الإشعارات. غيّر إذن الموقع من إعداداته، ثم أعد فتح هذه النافذة.';return;}
  state.textContent='جارٍ التحقق من إعدادات هذا الجهاز...';
  try{const r=await fetch(API+'?action=config',{cache:'no-store'});config=await r.json();if(!r.ok||!config.enabled||!config.publicKey)throw Error();const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){const p=await call('preferences',{subscription:sub.toJSON()});orders.checked=p.orders;marketing.checked=p.marketing;}state.textContent='اختر فئات الإشعارات التي تريدها، ثم احفظ اختيارك.';save.disabled=false;}catch{state.textContent='خدمة الإشعارات غير متاحة حاليًا. لم نغيّر اختيارك. حاول لاحقًا.';}
 });
 login.onclick=()=>{dialog.close();openAccount();};dialog.querySelector('#closeNotifications').onclick=()=>dialog.close();
 dialog.querySelector('form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!auth.currentUser||!config)return;busy=true;save.disabled=true;
  try{
   const want=orders.checked||marketing.checked;
   // Request permission in the same explicit click gesture, before token/network work.
   const permission=want?(Notification.permission==='granted'?'granted':await Notification.requestPermission()):Notification.permission;
   if(want&&permission!=='granted'){state.textContent='لم يُمنح إذن الإشعارات. لم يتم تفعيل الاشتراك.';return;}
   const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
   if(!want){if(sub){await call('unsubscribe',{subscription:sub.toJSON()});await sub.unsubscribe();}state.textContent='تم إيقاف إشعارات وشاح لهذا الجهاز.';toast('تم إيقاف إشعارات هذا الجهاز');return;}
   let created=false;if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(config.publicKey)});created=true;}
   try{await call('subscribe',{subscription:sub.toJSON(),orders:orders.checked,marketing:marketing.checked});}catch(err){if(created)await sub.unsubscribe();throw err;}
   state.textContent='تم حفظ اختيارك وربط هذا الجهاز بحسابك. وصول الإشعار يعتمد أيضًا على اتصال الجهاز وإعدادات النظام.';toast('✓ تم حفظ إعدادات الإشعارات');
  }catch(err){state.textContent=err.message||'تعذّر تفعيل الإشعارات. حاول لاحقًا.';}finally{busy=false;save.disabled=false;}
 });
 return {async beforeLogout(){if(!supported)return;try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(!sub)return;try{await call('unsubscribe',{subscription:sub.toJSON()});}finally{await sub.unsubscribe();}}catch{}}};
}
