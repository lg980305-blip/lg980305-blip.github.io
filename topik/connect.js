/* ============================================================
   앱 ↔ 서버 연결기
   시연용으로 만들어 둔 가짜 동작을 가로채서 진짜 서버(Gemini)로 보냅니다.
   원래 코드는 건드리지 않고, 클릭을 먼저 낚아채는 방식입니다.
   ============================================================ */
(function () {
  'use strict';

  var API = '';                 // 서버가 이 페이지를 직접 띄우므로 같은 주소
  var TOKEN = null;

  function lang() {
    try { return (document.querySelector('#lang-menu [aria-current="true"]') || {}).dataset?.l || 'ko'; }
    catch { return 'ko'; }
  }

  async function login() {
    var r = await fetch(API + '/api/auth/dev', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: lang() })
    });
    var d = await r.json();
    TOKEN = d.token;
    return d.user;
  }

  async function post(path, body, isForm) {
    /* 서버가 없으면 앱이 직접 Gemini에 요청합니다 */
    if (MODE === 'direct') return window.__directPost(path, body, isForm);
    if (!TOKEN) await login();
    var opt = { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN } };
    if (isForm) opt.body = body;
    else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    var r = await fetch(API + path, opt);
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw Object.assign(new Error(d.message || '요청 실패'), { code: d.code, data: d });
    return d;
  }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]; }); };
  var $ = function (s) { return document.querySelector(s); };

  function push(sel, html) {
    var c = $(sel); if (!c) return;
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
  }
  function typing(sel, on) {
    if (on) push(sel, '<div class="typing" id="__typing"><i></i><i></i><i></i></div>');
    else { var t = $('#__typing'); if (t) t.remove(); }
  }

  /* ══════════ 1. AI 문법 튜터 ══════════ */
  function tutorHTML(d) {
    var h = '<div class="bubble ai"><span class="who">AI 튜터</span>' + esc(d.answer);
    (d.blocks || []).forEach(function (b) {
      h += '<div class="ansblock"><span class="lbl">' + esc(b.label) + '</span>';
      (b.examples || []).forEach(function (e) {
        var ok = e.kind === 'ok';
        h += '<span class="ex"><span class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '○' : '✗') + '</span> ' + esc(e.text) + '</span>';
      });
      h += '</div>';
    });
    if (d.tip) h += '<div class="tip"><span>◎</span><span>' + esc(d.tip) + '</span></div>';
    return h + '</div>';
  }

  async function askTutor(text) {
    push('#tutor-body', '<div class="bubble me"><span class="who">나</span>' + esc(text) + '</div>');
    typing('#tutor-body', true);
    try {
      var d = await post('/api/ai/tutor', { question: text, lang: lang() });
      typing('#tutor-body', false);
      push('#tutor-body', tutorHTML(d));
      var q = $('#quota');
      if (q && typeof d.quotaLeft === 'number') {
        q.textContent = d.quotaLeft + ' / 5';
        q.classList.toggle('out', d.quotaLeft <= 0);
      }
    } catch (e) {
      typing('#tutor-body', false);
      if (e.code === 'QUOTA_EXCEEDED') {
        push('#tutor-body',
          '<div class="card" style="align-self:stretch;padding:16px;margin-top:4px">' +
          '<div style="font-size:13.5px;font-weight:600">오늘 무료 질문 5회를 모두 쓰셨습니다</div>' +
          '<p style="font-size:12.5px;line-height:1.7;color:var(--ink-2);margin:9px 0 13px">' +
          '프리미엄에서는 질문 횟수 제한이 없습니다.</p>' +
          '<button class="btn btn-primary" style="width:100%" data-go="sub">프리미엄 보기 · 월 ₩30,000</button></div>');
      } else {
        push('#tutor-body', '<div class="fb tip"><span class="fi">!</span><span>' + esc(e.message) + '</span></div>');
      }
    }
  }

  /* ══════════ 2. AI 대화 연습 ══════════ */
  var convo = { scene: '', history: [], busy: false };

  async function convoTurn() {
    if (convo.busy) return;
    var body = $('#chat-body'); if (!body) return;

    /* 화면에 보이는 상황 이름을 그대로 씁니다 */
    convo.scene = ($('#chat-title') || {}).textContent || '한국어 회화';

    var mic = $('#chat-mic');
    convo.busy = true;
    if (mic) mic.classList.add('rec');
    var hint = $('#chat-hint'); if (hint) hint.textContent = '듣고 있습니다…';

    var said;
    try {
      said = await recordAndTranscribe(4000, '');
    } catch (e) {
      if (mic) mic.classList.remove('rec');
      convo.busy = false;
      if (hint) hint.textContent = '마이크를 사용할 수 없습니다: ' + e.message;
      return;
    }
    if (mic) mic.classList.remove('rec');
    if (hint) hint.textContent = '답변을 만들고 있습니다…';

    push('#chat-body', '<div class="bubble me"><span class="who">나</span>' + esc(said) + '</div>');
    typing('#chat-body', true);

    try {
      var d = await post('/api/ai/conversation', {
        scene: convo.scene, history: convo.history, userText: said, lang: lang()
      });
      typing('#chat-body', false);
      push('#chat-body', '<div class="bubble ai"><span class="who">상대</span>' + esc(d.reply) + '</div>');
      if (d.feedback) {
        push('#chat-body', '<div class="fb ' + (d.feedbackKind === 'ok' ? 'ok' : 'tip') + '">' +
          '<span class="fi">' + (d.feedbackKind === 'ok' ? '✓' : '!') + '</span><span>' + esc(d.feedback) +
          (d.better ? '<br><b>' + esc(d.better) + '</b>' : '') + '</span></div>');
      }
      convo.history.push({ who: 'user', text: said }, { who: 'ai', text: d.reply });
      try { window.speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(d.reply), { lang: 'ko-KR', rate: 0.95 })); } catch {}
      if (hint) hint.textContent = '마이크를 누르고 한국어로 답해 보세요';
    } catch (e) {
      typing('#chat-body', false);
      push('#chat-body', '<div class="fb tip"><span class="fi">!</span><span>' + esc(e.message) + '</span></div>');
      if (hint) hint.textContent = '다시 시도해 주세요';
    }
    convo.busy = false;
  }

  /* ══════════ 3. 마이크 녹음 → 받아쓰기 ══════════ */
  async function recordBlob(ms) {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
      .find(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }) || '';
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    var done = new Promise(function (res) { rec.onstop = res; });
    rec.start();
    await new Promise(function (r) { setTimeout(r, ms); });
    rec.stop();
    await done;
    stream.getTracks().forEach(function (t) { t.stop(); });
    return new Blob(chunks, { type: rec.mimeType || 'audio/mp4' });
  }

  async function recordAndTranscribe(ms, target) {
    var blob = await recordBlob(ms);
    var fd = new FormData();
    fd.append('audio', blob, 'a.' + (blob.type.includes('webm') ? 'webm' : 'm4a'));
    fd.append('target', target || '');
    fd.append('lang', lang());
    var d = await post('/api/ai/speech', fd, true);
    return d.transcript || '(들리지 않았습니다)';
  }

  /* ══════════ 4. 말하기 발음 평가 ══════════ */
  var speakBusy = false;
  async function speakEvaluate() {
    if (speakBusy) return;
    var card = $('#speak-body'); if (!card) return;
    var sent = ($('.speakcard .sent') || {}).textContent || '';
    var mic = $('#mic'), label = $('#miclabel'), level = $('#level');

    speakBusy = true;
    if (mic) mic.classList.add('rec');
    if (label) label.textContent = '녹음 중… 문장을 읽어 주세요';
    var iv = level ? setInterval(function () {
      level.querySelectorAll('i').forEach(function (b) { b.style.height = (4 + Math.random() * 28) + 'px'; });
    }, 70) : null;

    try {
      var blob = await recordBlob(3800);
      clearInterval(iv);
      if (mic) mic.classList.remove('rec');
      if (label) label.textContent = '발음 분석 중…';

      var fd = new FormData();
      fd.append('audio', blob, 'a.' + (blob.type.includes('webm') ? 'webm' : 'm4a'));
      fd.append('target', sent);
      fd.append('lang', lang());
      var d = await post('/api/ai/speech', fd, true);

      var items = (d.items || []).map(function (i) {
        var weak = i.score < 75;
        return '<div class="phon"><span class="pl">' + esc(i.label) + '</span>' +
          '<span class="pbar"><i style="width:' + i.score + '%;background:' + (weak ? 'var(--coral)' : 'var(--jade)') + '"></i></span>' +
          '<span class="pv" style="color:' + (weak ? 'var(--coral)' : 'var(--ink)') + '">' + i.score + '</span></div>';
      }).join('');

      card.innerHTML =
        '<div class="result-hero" style="padding:8px 0 18px">' +
        '<div class="lab">발음 평가</div>' +
        '<div class="grade">' + (d.overall == null ? '—' : d.overall) + '<span style="font-size:22px">점</span></div>' +
        '<div class="msg">' + esc(sent) + '</div></div>' +
        '<div class="chartcard"><div class="chart-h"><h4>음소별 평가</h4>' +
        '<div class="legend">들린 대로: ' + esc(d.transcript || '') + '</div></div>' +
        items + '<p class="cardnote">' + esc(d.tip || '') + '</p></div>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button class="btn btn-ghost" style="flex:1" data-sp="retry">다시 녹음</button>' +
        '<button class="btn btn-primary" data-sp="next">다음 문장</button></div>';
    } catch (e) {
      clearInterval(iv);
      if (mic) mic.classList.remove('rec');
      if (label) label.textContent = '마이크를 사용할 수 없습니다: ' + e.message;
    }
    speakBusy = false;
  }

  /* ══════════ 5. 카메라 ══════════ */
  var camStream = null, camBusy = false;

  async function openCamera() {
    var vf = $('#vf'); if (!vf) return false;
    if (camStream) return true;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false
      });
    } catch (e) { return false; }

    var v = document.createElement('video');
    v.id = '__cam'; v.autoplay = true; v.playsInline = true; v.muted = true;
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
    v.srcObject = camStream;
    vf.insertBefore(v, vf.firstChild);
    var ph = vf.querySelector('.vf-photo'); if (ph) ph.style.display = 'none';
    var hint = vf.querySelector('.vf-hint'); if (hint) hint.textContent = '글자가 화면에 들어오게 맞춰 주세요';
    return true;
  }

  async function shoot() {
    if (camBusy) return;
    var vf = $('#vf'), out = $('#scan-result'); if (!vf || !out) return;
    var v = $('#__cam');

    if (!v) {
      var ok = await openCamera();
      if (!ok) {
        out.innerHTML = '<div class="result" style="font-size:12.5px;line-height:1.7;color:var(--ink-2)">' +
          '카메라를 열 수 없습니다. 브라우저가 카메라 권한을 물어보면 <b>허용</b>을 눌러 주세요.</div>';
        return;
      }
      out.innerHTML = '<div class="result" style="text-align:center;color:var(--ink-3);font-size:12.5px;padding:20px">' +
        '카메라가 켜졌습니다. 글자를 비추고 다시 촬영 버튼을 눌러 주세요.</div>';
      return;
    }

    camBusy = true;
    var sl = $('#scanline'); if (sl) sl.classList.add('on');
    out.innerHTML = '<div class="result" style="text-align:center;color:var(--ink-3);font-size:12.5px;padding:22px">한국어를 읽고 있습니다…</div>';

    var c = document.createElement('canvas');
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 960;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.85); });

    var mode = (document.querySelector('.smode[aria-pressed="true"]') || {}).dataset?.mode || 'life';
    try {
      var fd = new FormData();
      fd.append('image', blob, 'p.jpg');
      fd.append('mode', mode);
      fd.append('lang', lang() === 'ko' ? 'vi' : lang());
      var d = await post('/api/ai/vision', fd, true);

      var words = (d.words || []).map(function (w, i) {
        return '<div class="wordrow"><span class="wk">' + esc(w.k) + '<small>' + esc(w.r || '') + '</small></span>' +
          '<span class="wm">' + esc(w.m) + '</span>' +
          '<button class="wsave" data-save="' + i + '" aria-pressed="false" aria-label="저장">' +
          '<svg class="svgi" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M6.4 3.8h11.2v16.4L12 16.2l-5.6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div>';
      }).join('');

      var main = mode === 'quiz'
        ? '<div class="rtrans"><span class="lbl">풀이</span><b>' + esc(d.answer || '') + '</b><br><br>' + esc(d.explain || '') + '</div>'
        : '<div class="rtrans"><span class="lbl">번역</span>' + esc(d.translation || '') + '</div>';

      out.innerHTML =
        '<div class="result"><div class="chart-h" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px">' +
        '<h4 style="font-size:13.5px;font-weight:600;margin:0">인식한 한국어</h4></div>' +
        '<div class="rsrc">' + esc(d.source || '').replace(/\n/g, '<br>') + '</div>' + main + '</div>' +
        (words ? '<div class="sec-label"><h3>단어 풀이</h3><span>' + (d.words || []).length + '개</span></div>' +
          '<div class="result" style="padding:6px 18px">' + words + '</div>' : '') +
        ((d.warning || d.type) ? '<div class="sec-label"><h3>' + (mode === 'quiz' ? '문항 유형' : '주의') + '</h3><span>AI</span></div>' +
          '<div class="coach"><div class="cavatar">AI</div><div class="cmsg">' + esc(d.warning || d.type) + '</div></div>' : '') +
        '<button class="btn btn-primary" style="width:100%;margin-top:16px" id="scan-again">다시 촬영</button>';
    } catch (e) {
      out.innerHTML = '<div class="result" style="font-size:12.5px;color:var(--coral)">' + esc(e.message) + '</div>';
    }
    if (sl) sl.classList.remove('on');
    camBusy = false;
  }

  function closeCamera() {
    if (!camStream) return;
    camStream.getTracks().forEach(function (t) { t.stop(); });
    camStream = null;
    var v = $('#__cam'); if (v) v.remove();
  }

  /* ══════════ 클릭 가로채기 ══════════ */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var chip = t.closest && t.closest('[data-chip]');
    if (chip) { e.stopPropagation(); e.preventDefault(); askTutor(chip.dataset.chip); return; }

    if (t.closest && t.closest('#ask-send')) {
      e.stopPropagation(); e.preventDefault();
      var inp = $('#ask-input'); var v = (inp.value || '').trim();
      if (v) { inp.value = ''; askTutor(v); }
      return;
    }

    if (t.closest && t.closest('#chat-mic')) { e.stopPropagation(); e.preventDefault(); convoTurn(); return; }
    if (t.closest && t.closest('#mic'))      { e.stopPropagation(); e.preventDefault(); speakEvaluate(); return; }
    if (t.closest && t.closest('#shutter'))  { e.stopPropagation(); e.preventDefault(); shoot(); return; }

    if (t.closest && t.closest('.tabbar button, [data-go]')) closeCamera();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (!e.target.closest || !e.target.closest('#ask-input')) return;
    e.stopPropagation(); e.preventDefault();
    var inp = e.target, v = (inp.value || '').trim();
    if (v) { inp.value = ''; askTutor(v); }
  }, true);

  function badge(text, color) {
    var b = document.createElement('div');
    b.textContent = text;
    b.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:99;' +
      'font:600 9px/1 "IBM Plex Mono",monospace;letter-spacing:.14em;color:#fff;' +
      'background:' + color + ';padding:4px 8px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    var s = document.querySelector('.screen'); if (s) s.appendChild(b);
    setTimeout(function () { b.style.transition = 'opacity .6s'; b.style.opacity = '0'; }, 3500);
  }

  /* 시작하자마자 로그인 + 서버 표시 (서버 없는 APK 단독 모드에서는 생략) */
  if (MODE !== 'direct') login().then(function (u) {
    console.log('[topik-asia] 서버 연결됨 ·', u.name);
    var b = document.createElement('div');
    b.textContent = 'LIVE';
    b.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:99;' +
      'font:600 9px/1 "IBM Plex Mono",monospace;letter-spacing:.14em;color:#fff;' +
      'background:#00A377;padding:4px 8px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    var s = document.querySelector('.screen'); if (s) s.appendChild(b);
    setTimeout(function () { b.style.transition = 'opacity .6s'; b.style.opacity = '0'; }, 3500);
  }).catch(function (e) { console.warn('로그인 실패', e); });
})();

/* ============================================================
   실시간 학습방 + 푸시 알림 (서버가 있을 때만 동작)
   ============================================================ */
(function () {
  'use strict';
  if (MODE === 'direct') return;      // 예전 Express 백엔드가 있을 때만 동작

  var TOKEN = null, socket = null, joined = false;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
    return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]; }); };

  async function token() {
    if (TOKEN) return TOKEN;
    var r = await fetch('/api/auth/dev', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    TOKEN = (await r.json()).token;
    return TOKEN;
  }

  function add(html) {
    var c = $('#live-body'); if (!c) return;
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
  }
  function msg(m) {
    var cls = m.is_ai ? 'ai2' : (m.name === '나' ? 'me2' : 'other');
    add('<div class="lmsg ' + cls + '"><span class="who2">' + esc(m.name) + '</span>' + esc(m.body) + '</div>');
  }

  async function enter() {
    if (joined) return;
    joined = true;
    var body = $('#live-body'); if (body) body.innerHTML = '';

    try {
      await token();
      var r = await fetch('/api/live/messages?room=class-b', { headers:{ Authorization:'Bearer '+TOKEN } });
      (await r.json()).forEach(msg);
    } catch (e) {}

    if (!window.io) {
      await new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = '/socket.io/socket.io.js'; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      }).catch(function () {});
    }
    if (!window.io) { add('<div class="lsys">실시간 연결을 사용할 수 없습니다.</div>'); return; }

    socket = window.io();
    socket.on('connect', function () {
      socket.emit('join', { room:'class-b', name:'나' });
      add('<div class="lsys">학습방에 들어왔습니다. 한국어로 질문하면 AI 튜터가 답합니다.</div>');
    });
    socket.on('presence', function (d) { var n = $('#live-n'); if (n) n.textContent = d.count; });
    socket.on('msg', function (m) {
      var t = $('#__ltyping'); if (t) t.remove();
      msg(m);
    });
    socket.on('typing', function (d) {
      if ($('#__ltyping')) return;
      add('<div class="lmsg ai2" id="__ltyping"><span class="who2">' + esc(d.who) + '</span>답변을 만들고 있습니다…</div>');
    });
  }

  function send() {
    var i = $('#live-input'); if (!i) return;
    var v = (i.value || '').trim(); if (!v || !socket) return;
    i.value = '';
    socket.emit('say', { body: v, lang: (document.querySelector('#lang-menu [aria-current="true"]') || {}).dataset?.l || 'ko' });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-go="live"]')) { setTimeout(enter, 120); return; }
    if (e.target.closest && e.target.closest('#live-send')) { e.stopPropagation(); e.preventDefault(); send(); return; }

    var pb = e.target.closest && e.target.closest('#push-btn');
    if (pb) {
      e.stopPropagation(); e.preventDefault();
      enablePush(pb);
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.closest || !e.target.closest('#live-input')) return;
    e.stopPropagation(); e.preventDefault(); send();
  }, true);

  /* ── 푸시 알림 켜기 ── */
  function b64(s) {
    var p = '='.repeat((4 - s.length % 4) % 4);
    var b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...b].map(function (c) { return c.charCodeAt(0); }));
  }
  async function enablePush(btn) {
    var tt = btn.querySelector('.tt'), ts = btn.querySelector('.ts');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window))
        throw new Error('이 브라우저는 알림을 지원하지 않습니다');
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('알림이 차단되어 있습니다');

      var reg = await navigator.serviceWorker.register('/sw.js');
      var key = (await (await fetch('/api/live/vapid')).json()).key;
      var sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });

      await token();
      await fetch('/api/live/subscribe', {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+TOKEN },
        body: JSON.stringify({ sub: sub })
      });
      await fetch('/api/live/test', { method:'POST', headers:{ Authorization:'Bearer '+TOKEN } });

      tt.textContent = '✓ 학습 알림 켜짐';
      ts.textContent = '매일 저녁 8시, 학습을 안 하셨으면 알려드립니다';
      btn.querySelector('.go').textContent = '';
    } catch (err) {
      if (ts) ts.textContent = err.message;
    }
  }
})();
