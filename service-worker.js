const CACHE='al-blend-pwa-v1.5.4';
const UI_PATCH='./js/ui-v1.5.js?v=1.5.0';
const PRESET_PATCH='./js/preset-categories-v1.6.js?v=1.6.0';
const ASSETS=[
  './','./index.html','./css/app.css?v=1.4.0','./css/ui-v1.5.css?v=1.5.0','./css/billet-flow.css?v=20260909','./js/vendor/decimal-lite.js?v=1.4.0','./js/calc-engine.js?v=1.4.0','./js/storage.js?v=1.4.0','./js/export.js?v=1.4.0','./js/tutorial.js?v=1.4.0','./js/app.js?v=1.4.0',UI_PATCH,PRESET_PATCH,'./js/billet-flow.js?v=20260909','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'
];

async function loadPatchText(path){
  try{
    const response=await fetch(path,{cache:'no-store'});
    if(response.ok)return await response.text();
  }catch(_){}
  const cached=await caches.match(path);
  return cached?cached.text():'';
}

async function withUiPatch(response){
  if(!response)return response;
  const base=await response.text();
  const [uiPatch,presetPatch]=await Promise.all([loadPatchText(UI_PATCH),loadPatchText(PRESET_PATCH)]);
  const patch=[uiPatch,presetPatch].filter(Boolean).join('\n;\n');
  const headers=new Headers(response.headers);
  headers.set('content-type','text/javascript; charset=utf-8');
  headers.delete('content-length');
  return new Response(`${base}\n;\n${patch}`,{status:response.status,statusText:response.statusText,headers});
}

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
  const isAppJs=url.pathname.endsWith('/js/app.js');
  event.respondWith(fetch(event.request).then(async res=>{
    if(res&&res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}
    return isAppJs?withUiPatch(res):res;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    return isAppJs&&cached?withUiPatch(cached):cached;
  }));
});
