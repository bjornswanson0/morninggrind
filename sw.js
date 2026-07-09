/* Morning Grind service worker — offline app shell */
const CACHE = 'morning-grind-v14';
const ASSETS = [
  './', './index.html',
  './css/styles.css',
  './js/data.js', './js/app.js',
  './manifest.webmanifest', './icons/icon.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if(request.method !== 'GET') return;
  // Page loads: network-first so the newest version always lands when online (fall back to cache offline)
  if(request.mode === 'navigate'){
    e.respondWith(
      fetch(request).then(res => { const c=res.clone(); caches.open(CACHE).then(x=>x.put(request,c)).catch(()=>{}); return res; })
        .catch(()=> caches.match(request).then(h => h || caches.match('./index.html')))
    );
    return;
  }
  // Other assets: cache-first (they're version-stamped with ?v=NN, so new versions fetch fresh)
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(()=>{});
      return res;
    }).catch(()=>caches.match('./index.html')))
  );
});
