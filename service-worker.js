const CACHE='al-blend-pwa-v1.1.0';
const ASSETS=[
  './','./index.html','./css/app.css?v=1.1.0','./js/vendor/decimal-lite.js?v=1.1.0','./js/calc-engine.js?v=1.1.0','./js/storage.js?v=1.1.0','./js/export.js?v=1.1.0','./js/tutorial.js?v=1.1.0','./js/app.js?v=1.1.0','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(res=>{
      const clone=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',clone));return res;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request).then(res=>{
    if(res&&res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}
    return res;
  }).catch(()=>caches.match(event.request)));
});
