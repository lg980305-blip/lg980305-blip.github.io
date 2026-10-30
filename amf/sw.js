/* ============================================================
   AMF CIE — 서비스 워커
   홈 화면에 설치된 앱이 재방문·오프라인에서도 열리도록 캐시한다.
   · 문서(HTML): 네트워크 우선, 실패하면 캐시
   · 같은 도메인 스크립트(.js): 네트워크 우선, 실패하면 캐시 · 그 밖의 정적 자원: 캐시 우선
   · /api/ 와 외부 도메인(Gemini 중계 등)은 건드리지 않는다
   캐시 내용을 갈아야 하면 CACHE 버전만 올린다.
   ============================================================ */
const CACHE='amf-cie-v4';
const PRECACHE=['./','./index.html','./?app=1','./manifest.json','./shows-data.js?v=20261030a',
  './plans.js?v=20261030a','./home.js?v=20261030a','./install.js?v=20261030a','./assistant.js?v=20261030a','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE)
    .then(c=>Promise.allSettled(PRECACHE.map(u=>c.add(u))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('amf-cie-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.includes('/api/')) return;
  const isDoc=req.mode==='navigate'||(req.headers.get('accept')||'').includes('text/html');
  if(isDoc){
    e.respondWith(fetch(req).then(res=>{
      if(res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); }
      return res;
    }).catch(()=>caches.match(req).then(hit=>hit||caches.match('./?app=1')||caches.match('./index.html'))));
    return;
  }
  const isJs=/\.js(\?|$)/.test(url.pathname+url.search);
  if(isJs){   /* 스크립트는 문서처럼 네트워크 우선 — 메뉴 파일이 옛 캐시로 남는 일을 막는다 */
    e.respondWith(fetch(req).then(res=>{
      if(res.ok&&res.type==='basic'){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); }
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok&&res.type==='basic'){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); }
    return res;
  })));
});
