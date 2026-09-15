/* ============================================================
   BLACKHOLEMAN BROS — 전 페이지 공통 스크립트
   1) 모바일 메뉴 열기/닫기 (접근성 포함)
   2) 서비스 워커 등록 (PWA / 오프라인)
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 모바일 메뉴 ---------- */
  var toggle = document.getElementById('navtoggle');
  var menu = document.getElementById('sitemenu');

  if (toggle && menu) {
    var lastFocused = null;

    function openMenu() {
      lastFocused = document.activeElement;
      menu.hidden = false;
      // hidden 해제 직후 한 프레임 뒤에 트랜지션 시작
      requestAnimationFrame(function () { menu.classList.add('open'); });
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', '메뉴 닫기');
      document.body.classList.add('menu-open');
      var first = menu.querySelector('a');
      if (first) first.focus();
    }

    function closeMenu() {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '메뉴 열기');
      document.body.classList.remove('menu-open');
      var done = function () { menu.hidden = true; };
      // 트랜지션이 없는 환경(prefers-reduced-motion 등)에서도 반드시 닫히도록
      var t = setTimeout(done, 260);
      menu.addEventListener('transitionend', function h() {
        clearTimeout(t); done(); menu.removeEventListener('transitionend', h);
      });
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') closeMenu();
      else openMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
    });

    // 데스크톱 폭으로 넓어지면 열린 메뉴를 정리
    var mq = window.matchMedia('(min-width: 1101px)');
    var onChange = function (e) {
      if (e.matches && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- 2. 서비스 워커 (PWA) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      // 하위 폴더(/en/, /games/)에서도 루트 스코프를 잡도록 경로를 계산
      var root = location.pathname.replace(/\/(en|games)\/.*$/, '/').replace(/[^/]*$/, '');
      navigator.serviceWorker.register(root + 'sw.js', { scope: root })['catch'](function () {
        /* 등록 실패는 사이트 동작에 영향을 주지 않으므로 무시 */
      });
    });
  }
})();
