const CACHE='weshah-store-shell-v2';
const ASSETS=['/offline.html','/1-icon-192.png','/2-icon-512.png','/3-icon-maskable.png','/4-favicon.png','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('weshah-store-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 // No API interception, private data cache, write replay or offline checkout.
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));return;}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(hit=>hit||fetch(req)));
});
self.addEventListener('push',event=>{
 let data;try{data=event.data?.json()}catch{return}
 if(!data||typeof data.title!=='string'||typeof data.body!=='string')return;
 let url;try{url=new URL(data.url,self.location.origin);if(url.origin!==self.location.origin)url=new URL('/',self.location.origin)}catch{url=new URL('/',self.location.origin)}
 event.waitUntil(self.registration.showNotification(data.title.slice(0,80),{body:data.body.slice(0,240),icon:'/1-icon-192.png',badge:'/1-icon-192.png',tag:String(data.tag||'weshah').slice(0,100),data:{url:url.href},dir:'rtl',lang:'ar',renotify:false}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const url=event.notification.data?.url||self.location.origin+'/';event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);})());});
