/* ============================================================
   BLACKHOLEMAN BROS — 서비스 워커
   앱처럼 설치되고, 재방문·오프라인에서도 빠르게 열리도록 캐시합니다.
   캐시 내용을 바꾸려면 CACHE 버전 문자열만 올리면 됩니다.
   ============================================================ */
const CACHE = 'bhb-v1';

/* 설치 즉시 담아둘 핵심 파일 (용량이 작은 것만) */
const PRECACHE = [
  './',
  './index.html',
  './about.html',
  './characters.html',
  './technology.html',
  './contents.html',
  './community.html',
  './goods.html',
  './games/index.html',
  './assets/site.css',
  './assets/site.js',
  './favicon.svg',
  './site.webmanifest',
  './offline.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 일부 파일이 실패해도 설치가 통째로 실패하지 않도록 개별 처리
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // GET 이외, 그리고 외부 도메인(CDN·API)은 그대로 통과시킨다
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML 문서: 네트워크 우선 (최신 내용을 먼저 보여주고, 실패하면 캐시)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./offline.html')))
    );
    return;
  }

  // 이미지·CSS·JS 등 정적 자원: 캐시 우선 (한 번 받으면 즉시 표시)
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
