/* 옛 주소의 설치형 앱(PWA) 정리: 남아 있는 캐시를 지우고 서비스워커를 해제한 뒤 새로고침한다. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.filter(function(k){ return k.indexOf('amf-cie-')===0; }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.registration.unregister(); })
      .then(function(){ return self.clients.matchAll({type:'window'}); })
      .then(function(cs){ cs.forEach(function(c){ c.navigate(c.url); }); })
  );
});
