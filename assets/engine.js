/* ============================================================
   BLACKHOLEMAN BROS — LAYOUT ENGINE (1단계)
   등록특허 10-2837572 「조건 이미지 디퓨전 기반 의미론적 이미지 생성」
   청구항 1의 입력부 — 레이아웃(클래스별 픽셀 정수) 생성·저장 —— 만을 구현합니다.
   노이즈 부여·예측·생성부(2~4단계)는 미구현이며, 대응표에 그대로 표기합니다.
   ============================================================ */
(function () {
  'use strict';

  // 클래스맵 해상도. 정수 배열 1개 원소 = 1픽셀 = 1클래스 ID.
  var W = 512, H = 288;
  var UNSET = 255;

  var CLASSES = [
    { id: 0, ko: '하늘',   en: 'sky',       rgb: [ 74, 163, 255] },
    { id: 1, ko: '지면',   en: 'ground',    rgb: [138, 110,  74] },
    { id: 2, ko: '건물',   en: 'building',  rgb: [176, 176, 190] },
    { id: 3, ko: '캐릭터', en: 'character', rgb: [255, 106, 138] },
    { id: 4, ko: '소품',   en: 'prop',      rgb: [255, 200,  87] },
    { id: 5, ko: '식생',   en: 'vegetation',rgb: [ 61, 200, 130] }
  ];

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- 상태 ----------
  var cuts = [];
  var cur = 0;
  var curClass = 0;
  var brush = 24;
  var painting = false;
  var strokes = 0;

  function newCut(no) {
    return {
      no: no,
      sec: 3.0,
      memo: '',
      map: new Uint8Array(W * H).fill(UNSET),
      strokes: 0
    };
  }

  // ---------- 로그 ----------
  var consoleEl;
  function log(level, msg) {
    if (!consoleEl) return;
    var t = new Date();
    var ts = String(t.getHours()).padStart(2, '0') + ':' +
             String(t.getMinutes()).padStart(2, '0') + ':' +
             String(t.getSeconds()).padStart(2, '0') + '.' +
             String(t.getMilliseconds()).padStart(3, '0');
    var line = document.createElement('span');
    line.className = 'eng-line ' + level;
    line.innerHTML = '<span class="ts">' + ts + '</span> ' +
                     '<span class="lv">' + level.toUpperCase().padEnd(4) + '</span> ' +
                     '<span class="msg">' + msg + '</span>';
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  function num(v) { return '<span class="num">' + v + '</span>'; }

  // ---------- 캔버스 ----------
  var cv, ctx, img;

  function initCanvas() {
    cv = $('[data-eng-canvas]');
    if (!cv) return;
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d', { willReadFrequently: true });
    img = ctx.createImageData(W, H);

    var down = function (e) { painting = true; strokes = 0; paintAt(e); e.preventDefault(); };
    var move = function (e) { if (painting) { paintAt(e); e.preventDefault(); } };
    var up = function () {
      if (!painting) return;
      painting = false;
      cuts[cur].strokes++;
      var st = stats();
      log('ok', '스트로크 종료 — 지정 픽셀 ' + num(st.filled.toLocaleString()) +
                ' / ' + num((W * H).toLocaleString()) +
                ' (' + num((st.filled / (W * H) * 100).toFixed(1) + '%') + ')');
      refreshStats();
      renderCuts();
    };

    cv.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  }

  function evtXY(e) {
    var r = cv.getBoundingClientRect();
    var p = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: Math.round((p.clientX - r.left) / r.width * W),
      y: Math.round((p.clientY - r.top) / r.height * H)
    };
  }

  // 원형 브러시로 클래스 ID를 정수 배열에 직접 기록합니다.
  function paintAt(e) {
    var p = evtXY(e);
    var m = cuts[cur].map;
    var rad = brush >> 1, r2 = rad * rad;
    var x0 = Math.max(0, p.x - rad), x1 = Math.min(W - 1, p.x + rad);
    var y0 = Math.max(0, p.y - rad), y1 = Math.min(H - 1, p.y + rad);
    for (var y = y0; y <= y1; y++) {
      var dy = y - p.y;
      for (var x = x0; x <= x1; x++) {
        var dx = x - p.x;
        if (dx * dx + dy * dy <= r2) m[y * W + x] = curClass;
      }
    }
    strokes++;
    draw();
  }

  function draw() {
    var m = cuts[cur].map, d = img.data;
    for (var i = 0, n = W * H; i < n; i++) {
      var c = m[i], o = i << 2;
      if (c === UNSET) { d[o] = 12; d[o + 1] = 16; d[o + 2] = 26; d[o + 3] = 255; }
      else {
        var rgb = CLASSES[c].rgb;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- 통계 (실측값) ----------
  function stats() {
    var m = cuts[cur].map;
    var counts = new Array(CLASSES.length).fill(0);
    var filled = 0;
    for (var i = 0, n = W * H; i < n; i++) {
      var c = m[i];
      if (c !== UNSET) { counts[c]++; filled++; }
    }
    return { counts: counts, filled: filled, total: W * H };
  }

  function refreshStats() {
    var st = stats();
    var box = $('[data-eng-stats]');
    if (!box) return;
    box.innerHTML = CLASSES.map(function (c) {
      var v = st.counts[c.id];
      var pct = v / st.total * 100;
      return '<div class="eng-bar">' +
        '<span class="k"><i style="background:rgb(' + c.rgb.join(',') + ')"></i>' + c.ko + '</span>' +
        '<span class="track"><span class="fill" style="width:' + pct.toFixed(2) + '%;background:rgb(' + c.rgb.join(',') + ')"></span></span>' +
        '<span class="v">' + v.toLocaleString() + '</span>' +
        '</div>';
    }).join('');
    var f = $('[data-eng-filled]');
    if (f) f.textContent = (st.filled / st.total * 100).toFixed(1) + '% 지정';
    var ex = $('[data-eng-export]');
    if (ex) ex.disabled = st.filled === 0;
  }

  // ---------- 내보내기 ----------
  // 청구항 1의 "레이아웃" — 클래스별 픽셀 정수 배열 — 을 그대로 직렬화합니다.
  function buildPayload() {
    var c = cuts[cur], st = stats();
    return {
      patent: 'KR 10-2837572',
      stage: '1/4 — layout input only',
      generated_at: new Date().toISOString(),
      cut: { no: c.no, seconds: c.sec, memo: c.memo },
      layout: {
        width: W,
        height: H,
        unset_value: UNSET,
        classes: CLASSES.map(function (k) { return { id: k.id, ko: k.ko, en: k.en }; }),
        pixel_counts: st.counts,
        filled_pixels: st.filled,
        data: Array.prototype.slice.call(c.map)
      }
    };
  }

  function exportJSON() {
    var t0 = performance.now();
    var payload = buildPayload();
    var text = JSON.stringify(payload);
    var ms = (performance.now() - t0).toFixed(1);
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'layout_' + payload.cut.no.replace(/[^\w-]/g, '') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    log('calc', '직렬화 완료 — ' + num(payload.layout.data.length.toLocaleString()) + ' 정수, ' +
                num((blob.size / 1024).toFixed(1) + ' KB') + ', ' + num(ms + ' ms'));
    log('ok', '내보냄 → ' + a.download + '  (2단계 노이즈 부여부의 입력으로 사용)');
  }

  function exportPNG() {
    cv.toBlob(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'layout_' + cuts[cur].no.replace(/[^\w-]/g, '') + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
      log('ok', '클래스맵 PNG 내보냄 → ' + a.download);
    });
  }

  // ---------- 컷 목록 ----------
  function renderCuts() {
    var list = $('[data-eng-cuts]');
    if (!list) return;
    list.innerHTML = cuts.map(function (c, i) {
      var f = 0, m = c.map;
      for (var k = 0, n = W * H; k < n; k++) if (m[k] !== UNSET) f++;
      return '<button type="button" class="eng-cut' + (i === cur ? ' on' : '') + '" data-cut="' + i + '">' +
             '<b>' + c.no + '</b><span>' + c.sec.toFixed(1) + 's · ' + (f / (W * H) * 100).toFixed(0) + '%</span></button>';
    }).join('');
    $$('[data-cut]', list).forEach(function (b) {
      b.addEventListener('click', function () { switchCut(+b.dataset.cut); });
    });
    var meta = $('[data-eng-cutmeta]');
    if (meta) meta.textContent = cuts.length + ' cuts';
  }

  function switchCut(i) {
    cur = i;
    $('[data-eng-no]').value = cuts[i].no;
    $('[data-eng-sec]').value = cuts[i].sec;
    $('[data-eng-memo]').value = cuts[i].memo;
    draw(); refreshStats(); renderCuts();
    log('info', '컷 전환 → ' + cuts[i].no);
  }

  // ---------- 청구항 대응표 ----------
  // 구현되지 않은 구성요소는 반드시 '미구현'으로 표기합니다.
  var CLAIM_ROWS = [
    ['청구항 1 (a)', '레이아웃 입력 — 클래스별 픽셀 정수', 'done', 'engine.js · paintAt() / buildPayload()'],
    ['청구항 1 (a)', '클래스 정의 및 픽셀 집계',            'done', 'engine.js · CLASSES / stats()'],
    ['청구항 1 (b)', '노이즈 부여',                         'todo', '2단계 예정 — 미구현'],
    ['종속항',       'Jump Noising',                        'todo', '2단계 예정 — 미구현'],
    ['종속항',       'Ancestral Noising',                   'todo', '2단계 예정 — 미구현'],
    ['종속항',       'Mean Noising',                        'todo', '2단계 예정 — 미구현'],
    ['종속항',       'DDIM Noising',                        'todo', '2단계 예정 — 미구현'],
    ['청구항 1 (c)', '노이즈 예측',                         'todo', '3단계 예정 — 미구현'],
    ['청구항 1 (d)', '손실함수 · 경사하강법',               'todo', '3단계 예정 — 미구현'],
    ['청구항 1 (e)', '의미론적 이미지 생성',                'todo', '4단계 예정 — 미구현']
  ];

  function renderMap() {
    var t = $('[data-eng-map]');
    if (!t) return;
    t.innerHTML =
      '<thead><tr><th>청구항</th><th>구성요소</th><th>상태</th><th>구현 위치</th></tr></thead><tbody>' +
      CLAIM_ROWS.map(function (r) {
        return '<tr><td class="c">' + r[0] + '</td><td>' + r[1] + '</td>' +
               '<td class="s ' + r[2] + '">' + (r[2] === 'done' ? '✅ 구현' : '⬜ 미구현') + '</td>' +
               '<td class="f">' + r[3] + '</td></tr>';
      }).join('') + '</tbody>';
    var done = CLAIM_ROWS.filter(function (r) { return r[2] === 'done'; }).length;
    var badge = $('[data-eng-claimcount]');
    if (badge) badge.textContent = done + ' / ' + CLAIM_ROWS.length + ' 구현';
  }

  // ---------- 팔레트 ----------
  function renderPalette() {
    var p = $('[data-eng-palette]');
    if (!p) return;
    p.innerHTML = CLASSES.map(function (c) {
      return '<button type="button" class="eng-sw' + (c.id === curClass ? ' on' : '') + '" data-cls="' + c.id + '">' +
             '<i style="background:rgb(' + c.rgb.join(',') + ')"></i>' +
             '<span>' + c.ko + '</span><em>' + c.id + '</em></button>';
    }).join('');
    $$('[data-cls]', p).forEach(function (b) {
      b.addEventListener('click', function () {
        curClass = +b.dataset.cls;
        renderPalette();
        log('info', '클래스 선택 → ID ' + num(curClass) + ' (' + CLASSES[curClass].ko + ')');
      });
    });
  }

  // ---------- 초기화 ----------
  function init() {
    consoleEl = $('[data-eng-console]');
    if (!$('[data-eng-canvas]')) return;

    cuts = [newCut('C-001')];
    initCanvas();
    renderPalette();
    renderMap();
    draw();
    refreshStats();
    renderCuts();

    log('info', '레이아웃 엔진 초기화 — 해상도 ' + num(W + '×' + H) +
                ', 정수 배열 ' + num((W * H).toLocaleString()) + ' 원소, 클래스 ' + num(CLASSES.length) + '종');
    log('warn', '2~4단계(노이즈 부여·예측·생성)는 미구현입니다. 대응표를 확인하십시오.');

    var bs = $('[data-eng-brush]');
    if (bs) bs.addEventListener('input', function () {
      brush = +bs.value;
      $('[data-eng-brushval]').textContent = brush + 'px';
    });

    $('[data-eng-no]').addEventListener('input', function (e) { cuts[cur].no = e.target.value; renderCuts(); });
    $('[data-eng-sec]').addEventListener('input', function (e) { cuts[cur].sec = parseFloat(e.target.value) || 0; renderCuts(); });
    $('[data-eng-memo]').addEventListener('input', function (e) { cuts[cur].memo = e.target.value; });

    $('[data-eng-add]').addEventListener('click', function () {
      cuts.push(newCut('C-' + String(cuts.length + 1).padStart(3, '0')));
      switchCut(cuts.length - 1);
      log('ok', '컷 추가 — 총 ' + num(cuts.length) + '개');
    });
    $('[data-eng-clear]').addEventListener('click', function () {
      cuts[cur].map.fill(UNSET);
      draw(); refreshStats(); renderCuts();
      log('drop', '레이아웃 초기화 — ' + cuts[cur].no);
    });
    $('[data-eng-export]').addEventListener('click', exportJSON);
    $('[data-eng-png]').addEventListener('click', exportPNG);
    $('[data-eng-savelog]').addEventListener('click', function () {
      var txt = $$('.eng-line', consoleEl).map(function (l) { return l.textContent; }).join('\n');
      var b = new Blob([txt], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'engine_log_' + Date.now() + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
