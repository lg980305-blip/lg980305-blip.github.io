/* ============================================================
   BLACKHOLEMAN BROS — ENGINE LOG
   등록특허 10-2837572 의 처리 과정을 화면에 그대로 노출하는 실행 화면입니다.

   이 파일은 "보여주기용 껍데기"가 아닙니다.
   아래 파이프라인은 실제로 계산합니다. 로그에 찍히는 숫자는 전부
   그 순간 브라우저에서 계산된 실제 값이며, 미리 적어둔 문자열이 아닙니다.
   단계별 소요 시간도 performance.now() 로 실측합니다.

   ─────────────────────────────────────────────────────────
   ★★★ 여기부터가 대표님이 고쳐야 할 유일한 부분입니다 ★★★

   CLAIM_MAP 의 claim / term 을 특허 등록공보의 청구항 문언 그대로 채우세요.
   비워두면 화면에 "미매핑 — 청구항 확인 필요" 라고 노란색으로 표시됩니다.
   (일부러 그렇게 만들었습니다. 채우지 않은 채로 실사에 들어가지 마십시오.)

     claim : 청구항 번호와 기호      예) '제1항 (b)'
     term  : 청구항에 적힌 구성요소 명칭을 '토씨 하나 안 바꾸고' 그대로
             예) '신호추출부'  '특징벡터 생성모듈'  '가중치 산출부'

   ⚠ 주의 — 실제로 구현되지 않은 청구항 요소를 여기에 적지 마십시오.
      대응표는 심사역이 코드와 대조해 볼 수 있는 자료입니다.
      구현되지 않은 것을 적으면 과장 자료가 되어 오히려 감점됩니다.
      구현이 없는 요소는 비워두고 "미구현"으로 두는 편이 안전합니다.
   ─────────────────────────────────────────────────────────
   ============================================================ */

const CLAIM_MAP = {
  ingest:    { claim: '', term: '', fallback: '데이터 수집부' },
  normalize: { claim: '', term: '', fallback: '전처리·정규화부' },
  denoise:   { claim: '', term: '', fallback: '노이즈 제거부' },
  signal:    { claim: '', term: '', fallback: '신호 추출부' },
  score:     { claim: '', term: '', fallback: '가중치 산출부' },
  infer:     { claim: '', term: '', fallback: '결과 출력부' }
};

/* ---------- 반응 유형별 가중치 ----------
   근거: 행동의 비용이 클수록 선호 신호가 강하다는 가정.
   조회(비용 0) < 완주 < 좋아요 < 댓글 < 저장 < 공유(비용 최대)
   실제 서비스 데이터가 쌓이면 이 값을 회귀로 학습해 교체합니다. */
const WEIGHTS = {
  view:     { w: 1, label: '조회' },
  complete: { w: 3, label: '완주' },
  like:     { w: 4, label: '좋아요' },
  comment:  { w: 7, label: '댓글' },
  save:     { w: 6, label: '저장' },
  share:    { w: 8, label: '공유' }
};

/* ---------- 콘텐츠 카탈로그 ----------
   사이트에 실재하는 캐릭터·콘텐츠입니다. 각 항목이 보유한 속성 태그가
   신호 추출의 대상이 됩니다. */
const CATALOG = [
  { id: 'C01', title: '블랙홀맨 — 탐험 에피소드', img: 'assets/cd33e0ed67201028.webp', tags: ['모험', '미스터리', '유머'] },
  { id: 'C02', title: '홀독 — 우정 에피소드',     img: 'assets/9f36ab4b445c2308.webp', tags: ['우정', '감성', '일상'] },
  { id: 'C03', title: '홀캣 — 도도한 하루',       img: 'assets/f654843e589a50a7.webp', tags: ['일상', '유머'] },
  { id: 'C04', title: 'T-Man — 액션 시퀀스',      img: 'assets/tman.webp',             tags: ['액션', '모험'] },
  { id: 'C05', title: 'T-Bird — 비행 시퀀스',     img: 'assets/tbird.webp',            tags: ['액션', '감성'] },
  { id: 'C06', title: '아케이드 — 룰렛',          img: 'assets/9f096a516526c12f.webp', tags: ['일상', '유머'] },
  { id: 'C07', title: '아케이드 — 사다리타기',    img: 'assets/a14e06770c843a5a.webp', tags: ['일상', '우정'] },
  { id: 'C08', title: '오리지널 사운드트랙',      img: 'assets/8b8da71c5c2d54c7.webp', tags: ['감성', '미스터리'] }
];

/* 신호로 인정할 최소 근거 수. 이보다 적으면 통계적으로 신뢰할 수 없다고 보고 버립니다. */
const MIN_SUPPORT = 2;
/* 같은 대상·같은 유형이 이 간격보다 빠르게 반복되면 연타/봇으로 보고 제거합니다. */
const BURST_MS = 400;

(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  const consoleEl = $('[data-eng-console]');
  const pipeEl    = $('[data-eng-pipe]');
  const feedEl    = $('[data-eng-feed]');
  const outEl     = $('[data-eng-out]');
  const barsEl    = $('[data-eng-bars]');
  const mapEl     = $('[data-eng-map]');
  const countEl   = $('[data-eng-count]');
  const runBtn    = $('[data-eng-run]');
  const seedBtn   = $('[data-eng-seed]');
  const clearBtn  = $('[data-eng-clear]');
  const saveBtn   = $('[data-eng-save]');
  const todoEl    = $('[data-eng-todo]');
  if (!consoleEl) return;

  const STAGES = [
    { key: 'ingest',    name: '반응 수집' },
    { key: 'normalize', name: '정규화' },
    { key: 'denoise',   name: '노이즈 제거' },
    { key: 'signal',    name: '신호 추출' },
    { key: 'score',     name: '가중치 산출' },
    { key: 'infer',     name: '결과 도출' }
  ];

  /** 이벤트 원장. 방문자가 실제로 누른 것만 들어갑니다. */
  let events = [];
  let running = false;
  let runNo = 0;
  let lastLogText = '';

  /* ============ 청구항 표기 ============ */
  function claimOf(key) {
    const m = CLAIM_MAP[key] || {};
    const has = !!(m.claim && m.term);
    return {
      set: has,
      text: has ? (m.claim + ' ' + m.term) : ('미매핑 — ' + (m.fallback || key)),
      short: has ? m.claim : '미매핑'
    };
  }
  const allMapped = () => Object.keys(CLAIM_MAP).every(k => claimOf(k).set);

  /* ============ 로그 ============ */
  const pad = (n, w) => String(n).padStart(w, '0');
  function stamp() {
    const d = new Date();
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' + pad(d.getMilliseconds(), 3);
  }
  const LEVEL = { info: 'INFO', ok: 'OK  ', warn: 'WARN', drop: 'DROP', calc: 'CALC', head: '––––' };

  function log(level, msg) {
    const ts = stamp();
    const lv = LEVEL[level] || 'INFO';
    const el = document.createElement('span');
    el.className = 'eng-line ' + level;
    // 숫자를 눈에 띄게 (표시용일 뿐, 값은 그대로)
    const marked = String(msg).replace(/(-?\d+(?:\.\d+)?)/g, '<span class="num">$1</span>');
    el.innerHTML = '<span class="ts">' + ts + '</span> <span class="lv">' + lv + '</span> <span class="msg">' + marked + '</span>';
    consoleEl.appendChild(el);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    lastLogText += ts + ' ' + lv + ' ' + msg + '\n';
  }
  function rule(title) {
    const el = document.createElement('span');
    el.className = 'eng-line head';
    el.textContent = '── ' + title + ' ' + '─'.repeat(Math.max(0, 52 - title.length));
    consoleEl.appendChild(el);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    lastLogText += '\n── ' + title + '\n';
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ============ 화면 구성 ============ */
  function renderPipe() {
    pipeEl.innerHTML = '';
    STAGES.forEach((s, i) => {
      const c = claimOf(s.key);
      const d = document.createElement('div');
      d.className = 'eng-stage';
      d.dataset.stage = s.key;
      d.innerHTML =
        '<div class="dot"></div>' +
        '<div><div class="nm">' + pad(i + 1, 2) + '. ' + s.name + '</div>' +
        '<div class="cl' + (c.set ? '' : ' unset') + '">' + c.text + '</div></div>' +
        '<div class="ms" data-ms>—</div>';
      pipeEl.appendChild(d);
    });
  }

  function renderMap() {
    const rows = STAGES.map((s, i) => {
      const c = claimOf(s.key);
      return '<tr>' +
        '<td class="c' + (c.set ? '' : ' unset') + '">' + c.short + '</td>' +
        '<td>' + (CLAIM_MAP[s.key].term || '<i style="opacity:.6">청구항 문언 미입력</i>') + '</td>' +
        '<td>' + s.name + ' 단계</td>' +
        '<td class="f">assets/engine.js<br>stage ' + pad(i + 1, 2) + '</td>' +
        '</tr>';
    }).join('');
    mapEl.innerHTML =
      '<thead><tr><th>청구항</th><th>구성요소 (청구항 문언)</th><th>구현 화면</th><th>소스 위치</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>';
  }

  function renderFeed() {
    feedEl.innerHTML = '';
    CATALOG.forEach(item => {
      const acts = Object.keys(WEIGHTS).map(t =>
        '<button class="eng-act" type="button" data-ev="' + t + '" data-id="' + item.id + '">' +
        WEIGHTS[t].label + '<span class="w">×' + WEIGHTS[t].w + '</span></button>'
      ).join('');
      const row = document.createElement('div');
      row.className = 'eng-item';
      row.innerHTML =
        '<img src="' + item.img + '" alt="" aria-hidden="true" loading="lazy" decoding="async" width="46" height="46">' +
        '<div><div class="t">' + item.title + '</div>' +
        '<div class="tags">' + item.id + ' · ' + item.tags.join(' / ') + '</div></div>' +
        '<div class="eng-acts">' + acts + '</div>';
      feedEl.appendChild(row);
    });
  }

  function updateCount() {
    countEl.textContent = events.length + ' events';
    runBtn.disabled = running || events.length === 0;
    saveBtn.disabled = !lastLogText;
  }

  /* ============ 이벤트 수집 ============ */
  function addEvent(id, type, synthetic) {
    events.push({ t: Date.now(), id: id, type: type, syn: !!synthetic });
    updateCount();
  }

  feedEl.addEventListener('click', e => {
    const b = e.target.closest('[data-ev]');
    if (!b) return;
    addEvent(b.dataset.id, b.dataset.ev, false);
    b.animate(
      [{ background: 'rgba(73,167,255,.42)' }, { background: 'transparent' }],
      { duration: 420, easing: 'ease-out' }
    );
  });

  /* 샘플 데이터: 손으로 100번 누르지 않아도 되도록. syn=true 로 표시되어
     로그와 결과에 '샘플'임이 그대로 드러납니다. 실적으로 오인될 여지가 없습니다. */
  seedBtn.addEventListener('click', () => {
    const types = Object.keys(WEIGHTS);
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const item = CATALOG[Math.floor(Math.random() * CATALOG.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      addEvent(item.id, type, true);
      n++;
    }
    // 연타 케이스를 일부러 섞어 노이즈 제거가 실제로 동작함을 보이게 한다
    const dup = CATALOG[0];
    for (let i = 0; i < 3; i++) events.push({ t: Date.now(), id: dup.id, type: 'view', syn: true });
    updateCount();
    log('info', '샘플 이벤트 ' + (n + 3) + '건 주입 (synthetic=true). 총 ' + events.length + '건');
  });

  clearBtn.addEventListener('click', () => {
    events = [];
    lastLogText = '';
    consoleEl.innerHTML = '';
    outEl.hidden = true;
    $$('.eng-stage').forEach(s => {
      s.classList.remove('run', 'done');
      $('[data-ms]', s).textContent = '—';
    });
    updateCount();
  });

  /* ============ 파이프라인 ============ */
  async function stage(key, fn) {
    const el = $('.eng-stage[data-stage="' + key + '"]');
    el.classList.add('run');
    const c = claimOf(key);
    rule(c.set ? c.text : ('[' + c.text + ']'));
    const t0 = performance.now();
    const out = await fn();
    const ms = performance.now() - t0;
    el.classList.remove('run');
    el.classList.add('done');
    $('[data-ms]', el).textContent = ms.toFixed(2) + 'ms';
    log('ok', key + ' 완료 — 실측 ' + ms.toFixed(2) + 'ms');
    await sleep(120);
    return out;
  }

  async function run() {
    if (running || !events.length) return;
    running = true;
    runNo++;
    consoleEl.innerHTML = '';
    lastLogText = '';
    outEl.hidden = true;
    $$('.eng-stage').forEach(s => {
      s.classList.remove('run', 'done');
      $('[data-ms]', s).textContent = '—';
    });
    updateCount();

    const runId = 'RUN-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + pad(runNo, 3);
    log('info', 'engine start — ' + runId);
    log('info', '특허 10-2837572 파이프라인 / 단계 ' + STAGES.length + '개');
    if (!allMapped()) log('warn', '청구항 매핑이 비어 있습니다. CLAIM_MAP 을 채우십시오.');

    const T0 = performance.now();

    /* ---- 01 수집 ---- */
    const raw = await stage('ingest', async () => {
      const real = events.filter(e => !e.syn).length;
      log('info', '원본 이벤트 ' + events.length + '건 로드');
      log('info', '  실제 입력 ' + real + '건 / 샘플 ' + (events.length - real) + '건');
      const byType = {};
      events.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
      Object.keys(byType).forEach(t => log('info', '  ' + WEIGHTS[t].label + '(' + t + ') = ' + byType[t] + '건'));
      return events.slice();
    });

    /* ---- 02 정규화 ---- */
    const norm = await stage('normalize', async () => {
      const idx = {};
      CATALOG.forEach(c => { idx[c.id] = c; });
      const out = [];
      let unknown = 0;
      raw.forEach(e => {
        const item = idx[e.id];
        if (!item) { unknown++; return; }
        out.push({ t: e.t, id: e.id, type: e.type, w: WEIGHTS[e.type].w, tags: item.tags, syn: e.syn });
      });
      log('info', '카탈로그 조인 완료 — ' + out.length + '건 유효, ' + unknown + '건 미상 항목 제외');
      out.sort((a, b) => a.t - b.t);
      log('info', '시간순 정렬 완료 (오름차순)');
      return out;
    });

    /* ---- 03 노이즈 제거 ---- */
    const clean = await stage('denoise', async () => {
      const out = [];
      const last = {};
      let burst = 0;
      norm.forEach(e => {
        const k = e.id + '|' + e.type;
        if (last[k] !== undefined && (e.t - last[k]) < BURST_MS) {
          burst++;
          return;
        }
        last[k] = e.t;
        out.push(e);
      });
      log('drop', '연타·중복 ' + burst + '건 제거 (동일 대상·동일 유형 ' + BURST_MS + 'ms 이내)');
      log('info', '잔존 ' + out.length + '건 / 제거율 ' + (norm.length ? (burst / norm.length * 100).toFixed(1) : '0.0') + '%');
      return out;
    });

    /* ---- 04 신호 추출 (TF-IDF) ---- */
    const signals = await stage('signal', async () => {
      // tf: 태그별 가중 반응 총량
      const tf = {};
      clean.forEach(e => e.tags.forEach(g => { tf[g] = (tf[g] || 0) + e.w; }));

      // df: 그 태그를 가진 콘텐츠 수 / N: 전체 콘텐츠 수
      const N = CATALOG.length;
      const df = {};
      CATALOG.forEach(c => c.tags.forEach(g => { df[g] = (df[g] || 0) + 1; }));

      log('calc', 'TF-IDF  signal(tag) = tf × ln(N / df),  N = ' + N);
      const rows = Object.keys(tf).map(g => {
        const idf = Math.log(N / df[g]);
        const val = tf[g] * idf;
        log('calc', '  ' + g.padEnd(6) + ' tf=' + tf[g] + '  df=' + df[g] +
          '  idf=' + idf.toFixed(4) + '  signal=' + val.toFixed(3));
        return { tag: g, tf: tf[g], df: df[g], idf: idf, raw: val };
      });
      log('info', '태그 ' + rows.length + '종에서 원신호 산출 완료');
      return rows;
    });

    /* ---- 05 가중치 산출 ---- */
    const scored = await stage('score', async () => {
      // 근거 수(support)가 부족한 태그는 통계적으로 신뢰 불가 → 배제
      const support = {};
      clean.forEach(e => e.tags.forEach(g => { support[g] = (support[g] || 0) + 1; }));

      const kept = [];
      signals.forEach(s => {
        s.support = support[s.tag] || 0;
        if (s.support < MIN_SUPPORT) {
          log('drop', '  ' + s.tag + ' 배제 — support=' + s.support + ' < 임계 ' + MIN_SUPPORT);
          return;
        }
        kept.push(s);
      });
      if (!kept.length) {
        log('warn', '임계를 넘는 신호가 없습니다. 반응을 더 입력하십시오.');
        return [];
      }

      const max = Math.max.apply(null, kept.map(s => s.raw));
      kept.forEach(s => {
        s.score = max > 0 ? (s.raw / max) * 100 : 0;
        // 신뢰도: 근거가 쌓일수록 1에 수렴 (포화 곡선)
        s.conf = 1 - Math.exp(-s.support / 6);
      });
      kept.sort((a, b) => b.score - a.score);
      log('calc', '정규화  score = raw / max × 100,  max = ' + max.toFixed(3));
      log('calc', '신뢰도  conf = 1 − e^(−support / 6)');
      kept.forEach((s, i) => log('calc', '  #' + (i + 1) + ' ' + s.tag.padEnd(6) +
        ' score=' + s.score.toFixed(1) + '  support=' + s.support + '  conf=' + s.conf.toFixed(3)));
      return kept;
    });

    /* ---- 06 결과 도출 ---- */
    await stage('infer', async () => {
      if (!scored.length) {
        log('warn', '출력할 결과가 없습니다.');
        return;
      }
      const top = scored[0];
      const second = scored[1];
      const gap = second ? (top.score - second.score) : top.score;

      // 상위 신호를 가장 많이 담고 있는 콘텐츠 = 다음 제작 기준점
      const anchor = CATALOG
        .filter(c => c.tags.indexOf(top.tag) >= 0)
        .map(c => {
          const hit = clean.filter(e => e.id === c.id).reduce((a, e) => a + e.w, 0);
          return { c: c, hit: hit };
        })
        .sort((a, b) => b.hit - a.hit)[0];

      const decisive = gap >= 15 && top.conf >= 0.5;
      log('info', '1순위 신호 = "' + top.tag + '"  score=' + top.score.toFixed(1) + '  conf=' + top.conf.toFixed(3));
      if (second) log('info', '2순위 = "' + second.tag + '"  score=' + second.score.toFixed(1) + '  격차=' + gap.toFixed(1) + 'p');
      log(decisive ? 'ok' : 'warn',
        decisive ? '판정: 유의미 — 격차 15p 이상, 신뢰도 0.5 이상' :
                   '판정: 보류 — 격차 또는 신뢰도 부족. 근거 축적 후 재실행 권장');

      const synCount = clean.filter(e => e.syn).length;
      const action = '다음 제작 축: "' + top.tag + '"' +
        (anchor ? '  ·  기준 콘텐츠 ' + anchor.c.id + ' (' + anchor.c.title + ')' : '');
      const reason = 'tf=' + top.tf + ', df=' + top.df + ', idf=' + top.idf.toFixed(4) +
        ' → signal=' + top.raw.toFixed(3) + '. 근거 ' + top.support + '건, 신뢰도 ' + top.conf.toFixed(3) +
        (second ? ', 2순위 대비 ' + gap.toFixed(1) + 'p 우위' : '');

      $('[data-out-signal]').textContent = top.tag + '  (score ' + top.score.toFixed(1) + ' / conf ' + top.conf.toFixed(3) + ')';
      $('[data-out-action]').textContent = action;
      $('[data-out-reason]').textContent = reason;
      $('[data-out-verdict]').textContent = decisive ? '유의미 — 제작 반영 가능' : '보류 — 근거 부족';
      $('[data-out-basis]').textContent =
        '입력 ' + events.length + '건 → 유효 ' + clean.length + '건' +
        ' (실제 입력 ' + (clean.length - synCount) + ' / 샘플 ' + synCount + ')' +
        ' · 태그 ' + scored.length + '종 · ' + runId;

      barsEl.innerHTML = scored.map(s =>
        '<div class="eng-bar"><span class="k">' + s.tag + '</span>' +
        '<span class="track"><span class="fill" style="width:' + s.score.toFixed(1) + '%"></span></span>' +
        '<span class="v">' + s.score.toFixed(1) + '</span></div>'
      ).join('');

      outEl.hidden = false;
    });

    const total = performance.now() - T0;
    rule('완료');
    log('ok', '전체 파이프라인 ' + total.toFixed(2) + 'ms — ' + runId);
    if (!allMapped()) log('warn', '이 실행 기록은 청구항 매핑이 비어 있는 상태로 생성되었습니다.');

    running = false;
    updateCount();
  }

  runBtn.addEventListener('click', run);

  /* ============ 로그 저장 (실사 자료용) ============ */
  saveBtn.addEventListener('click', () => {
    if (!lastLogText) return;
    const head =
      '주식회사 블랙홀맨브로스 — 엔진 실행 로그\n' +
      '등록특허 10-2837572\n' +
      '생성 ' + new Date().toLocaleString('ko-KR') + '\n' +
      'URL ' + location.href + '\n' +
      (allMapped() ? '' : '\n※ 청구항 매핑이 입력되지 않은 상태의 실행 기록입니다.\n') +
      '\n' + '='.repeat(60) + '\n\n';
    const blob = new Blob([head + lastLogText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bhb-engine-log-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ============ 초기화 ============ */
  renderPipe();
  renderMap();
  renderFeed();
  updateCount();
  if (allMapped()) todoEl.hidden = true;
})();
