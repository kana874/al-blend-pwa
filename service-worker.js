const CACHE='al-blend-pwa-v1.0.2';
const ASSETS=[
  './','./index.html','./css/app.css','./js/vendor/decimal-lite.js','./js/calc-engine.js','./js/storage.js','./js/export.js','./js/tutorial.js','./js/app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));return res;}).catch(()=>caches.match('./index.html'))));
});
