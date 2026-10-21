// Kearglaze Factory service worker – cache-first, versioned
const CACHE='kg-v1-202610212025';
const ASSETS=[
  "./",
  "css/app.css",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "index.html",
  "js/app.js",
  "js/cutting.js",
  "js/data.js",
  "js/demojobs.js",
  "js/optimise.js",
  "js/pwa.js",
  "js/qrcode.js",
  "js/scansheet.js",
  "js/storage.js",
  "js/vendor/pdf.min.js",
  "js/vendor/pdf.worker.min.js",
  "manifest.json",
  "tests.html",
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}return res}).catch(()=>caches.match('./index.html'))))});
