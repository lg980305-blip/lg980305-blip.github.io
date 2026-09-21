/* ============================================================
   AI 연결기 (APK 전용)

   1순위: 중계 서버(Vercel, 키는 서버 환경변수에만). 주소는 GitHub Pages 의
          apk/config.json 에서 읽는다 → 주소가 바뀌어도 APK 를 다시 만들 필요가 없다.
          사용자는 키를 몰라도 된다.
   2순위: 중계 서버 주소가 아직 설정되지 않았을 때만, 사용자 본인 키를 한 번 입력받아
          폰에만 저장하고 Gemini 에 직접 요청한다 (개발자 테스트용).
   ============================================================ */
(function () {
  'use strict';

  /* API 키는 APK 안에 넣지 않습니다 (설치 파일을 풀면 누구나 볼 수 있으므로).
     처음 AI 기능을 쓸 때 한 번 입력받아 이 폰의 저장소에만 보관합니다. */
  var KEY_STORE = 'ta_gemini_key';
  function getKey() {
    var k = '';
    try { k = localStorage.getItem(KEY_STORE) || ''; } catch {}
    if (k) return k;
    k = (window.prompt('Gemini API 키를 입력하세요 (aistudio.google.com/apikey 에서 발급)\n이 폰에만 저장됩니다.') || '').trim();
    if (!k) throw new Error('API 키가 없어 AI 기능을 쓸 수 없습니다.');
    try { localStorage.setItem(KEY_STORE, k); } catch {}
    return k;
  }
  function forgetKey() { try { localStorage.removeItem(KEY_STORE); } catch {} }
  var GEMINI_MODEL = 'gemini-flash-lite-latest';
  var EP = 'https://generativelanguage.googleapis.com/v1beta/models/';
  /* 무료 등급은 특정 모델이 자주 혼잡(503)하다. 같은 모델을 한 번 더, 그다음 예비 모델로 차례로 넘어간다. */
  var FALLBACKS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

  /* ── 중계 서버 ── */
  var CONFIG_URL = 'https://lg980305-blip.github.io/apk/config.json';
  var APP_TAG = 'kr.topikasia.app';
  var PROXY = '';          // 중계 서버 주소 (config.json 의 endpoint)
  var PROXY_OK = false;    // 서버가 살아 있고 키가 설정되어 있는가
  var PROXY_ERR = '';      // 서버를 못 쓰는 이유 (사용자에게 보여 줄 문구)

  async function fetchJson(url, ms) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 8000) : null;
    try {
      var r = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { if (t) clearTimeout(t); }
  }

  /* 시작할 때 한 번: config.json → 서버 주소 → 서버 상태(GET) 확인.
     인터넷이 잠깐 안 되면 마지막으로 성공했던 주소를 폰 저장소에서 꺼내 쓴다. */
  var ready = (async function () {
    try { PROXY = localStorage.getItem('ta_proxy') || ''; } catch {}
    try {
      var cfg = await fetchJson(CONFIG_URL + '?t=' + Date.now());
      if (cfg && typeof cfg.endpoint === 'string' && /^https:\/\//.test(cfg.endpoint)) {
        PROXY = cfg.endpoint.replace(/\/+$/, '');
        try { localStorage.setItem('ta_proxy', PROXY); } catch {}
      } else if (cfg && cfg.endpoint === '') {
        PROXY = '';
        try { localStorage.removeItem('ta_proxy'); } catch {}
      }
    } catch (e) { /* config 를 못 읽으면 저장된 주소로 계속 */ }
    if (!PROXY) return;
    try {
      var st = await fetchJson(PROXY);
      if (st && st.serverKey) { PROXY_OK = true; if (st.defaultModel) GEMINI_MODEL = st.defaultModel; }
      else PROXY_ERR = '서버에 AI 키가 아직 설정되지 않았습니다. 관리자에게 알려 주세요.';
    } catch (e) {
      PROXY_ERR = '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.';
    }
  })();

  /* 하루 사용 한도 — 서버가 없으니 앱에서 셉니다 */
  var LIMITS = { tutor: 5, conversation: 5, speech: 5, vision: 6 };

  function today() { return new Date().toISOString().slice(0, 10); }
  function used(kind) {
    try {
      var d = JSON.parse(localStorage.getItem('ta_quota') || '{}');
      return (d.day === today() ? (d[kind] || 0) : 0);
    } catch { return 0; }
  }
  function bump(kind) {
    try {
      var d = JSON.parse(localStorage.getItem('ta_quota') || '{}');
      if (d.day !== today()) d = { day: today() };
      d[kind] = (d[kind] || 0) + 1;
      localStorage.setItem('ta_quota', JSON.stringify(d));
      return LIMITS[kind] - d[kind];
    } catch { return 99; }
  }

  function langName(l) {
    return { ko: '한국어', en: '영어', zh: '중국어', vi: '베트남어' }[l] || '한국어';
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* 한 번의 요청. 결과: { ok:true, json } 또는 { ok:false, status, msg } */
  async function callOnce(model, body) {
    var url, headers, payload;
    if (PROXY_OK) {
      url = PROXY;
      headers = { 'Content-Type': 'application/json', 'X-Topik-App': APP_TAG };
      payload = { action: 'generate', model: model, payload: body };
    } else {
      url = EP + model + ':generateContent';
      headers = { 'Content-Type': 'application/json', 'x-goog-api-key': getKey() };
      payload = body;
    }
    /* 통신이 멈추면 무한 대기하지 않도록 30초 제한 (음성·사진은 조금 더 걸린다) */
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 30000) : null;
    var r;
    try {
      r = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload),
                             signal: ctrl ? ctrl.signal : undefined });
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, status: 0, msg: '응답이 30초 안에 오지 않았습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.' };
      return { ok: false, status: 0, msg: '인터넷에 연결할 수 없습니다.' };
    } finally { if (timer) clearTimeout(timer); }
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var msg = (j.error && j.error.message) || 'AI 요청 실패';
      if (!PROXY_OK && (r.status === 401 || r.status === 403 || /api key/i.test(msg))) forgetKey();
      if (PROXY_OK && r.status === 403) msg = '이 앱에서의 요청이 서버에서 거부되었습니다. 관리자에게 알려 주세요.';
      if (PROXY_OK && r.status === 501) msg = '서버에 AI 키가 설정되지 않았습니다. 관리자에게 알려 주세요.';
      return { ok: false, status: r.status, msg: msg };
    }
    return { ok: true, json: j };
  }

  async function gemini(prompt, parts) {
    var body = { contents: [{ parts: [{ text: prompt }].concat(parts || []) }],
                 generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } };
    await ready;
    if (!PROXY_OK && PROXY) {
      /* 서버 주소는 있는데 지금 못 쓰는 상태 → 키를 묻지 않고 이유를 알려 준다 */
      throw new Error(PROXY_ERR || '서버에 연결할 수 없습니다.');
    }

    /* 혼잡(503) · 한도(429) · 일시 오류(500) 는 같은 모델을 한 번 더, 그다음 예비 모델로.
       모델 없음(404) 은 바로 다음 모델로. 그 외 오류는 즉시 중단. 전체 45초를 넘기지 않는다. */
    var chain = [GEMINI_MODEL].concat(FALLBACKS.filter(function (m) { return m !== GEMINI_MODEL; }));
    var started = Date.now(), last = null, j = null;
    outer:
    for (var i = 0; i < chain.length; i++) {
      for (var attempt = 0; attempt < 2; attempt++) {
        if (Date.now() - started > 45000) break outer;
        var res = await callOnce(chain[i], body);
        if (res.ok) { j = res.json; break outer; }
        last = res;
        if (res.status === 404) break;                       // 이 모델은 없음 → 다음 모델
        if (res.status === 503 || res.status === 429 || res.status === 500) {
          /* 지수 백오프 + 무작위 지터: 모든 기기가 같은 순간에 몰려 다시 실패하는 것을 막는다 */
          await sleep((attempt === 0 ? 800 : 1600) + Math.random() * 600);
          continue;                                          // 같은 모델 한 번 더, 그다음 다음 모델
        }
        throw new Error(res.msg);                            // 키·형식 오류 등은 재시도 의미 없음
      }
    }
    if (!j) {
      var m = last ? last.msg : 'AI 요청 실패';
      if (last && (last.status === 503 || last.status === 429))
        m = 'AI 서버가 지금 혼잡합니다. 잠시 후 다시 시도해 주세요.';
      throw new Error(m);
    }

    var cand = j.candidates && j.candidates[0];
    var reason = (cand && cand.finishReason) || (j.promptFeedback && j.promptFeedback.blockReason) || '';
    var txt = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
    if (!txt) {
      if (/SAFETY|BLOCK|PROHIBITED|RECITATION/i.test(reason)) throw new Error('이 내용은 AI가 답할 수 없는 주제로 분류되었습니다. 질문을 바꿔 보세요.');
      throw new Error('AI가 답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    try { return JSON.parse(txt); } catch { return { answer: txt }; }
  }

  var P = {
    tutor: function (q, lang) { return `
당신은 외국인에게 한국어를 가르치는 전문 교사입니다. TOPIK 시험 대비를 돕습니다.
학습자 질문: "${q}"
규칙:
- 설명은 ${langName(lang)}로 씁니다. 한국어 예문과 문법 형태는 한국어 그대로 둡니다.
- 올바른 예문(ok)과 틀린 예문(no)을 함께 보여 줍니다.
- TOPIK에서 어떻게 출제되는지 한 줄 덧붙입니다.
- 확실하지 않으면 추측하지 말고 모른다고 답합니다.
JSON: {"answer":"한 문장 요약","blocks":[{"label":"소제목","examples":[{"kind":"ok|no","text":"예문"}]}],"tip":"출제 조언"}`.trim(); },

    conversation: function (scene, history, userText, lang) { return `
당신은 한국어 회화 상대이자 교정 교사입니다.
상황: ${scene}
지금까지 대화: ${JSON.stringify(history)}
학습자가 방금 한 말: "${userText}"
할 일: 1) 상황에 맞게 한국어로 자연스럽게 응답(1~2문장) 2) 어색한 부분 교정 3) 피드백 설명은 ${langName(lang)}로.
JSON: {"reply":"한국어 응답","feedbackKind":"ok|tip","feedback":"교정 설명","better":"더 자연스러운 표현"}`.trim(); },

    speech: function (target, lang) { return `
학습자가 다음 한국어 문장을 소리 내어 읽었습니다.
목표 문장: "${target}"
1) 들린 대로 받아쓰기 2) 항목별 0~100점 평가 3) 조언은 ${langName(lang)}로 4) 알아들을 수 없으면 overall을 null로.
JSON: {"transcript":"들린 대로","overall":0,"items":[{"label":"항목","score":0}],"tip":"조언"}`.trim(); },

    vision: function (mode, lang) {
      var base = '사진 속 한국어를 정확히 읽어 주세요. 글자가 흐리면 추측하지 말고 읽을 수 없다고 하세요.';
      return mode === 'quiz' ? `${base}
사진은 한국어 시험 문제입니다. 문제와 선택지를 옮기고, 정답과 근거를 ${langName(lang)}로 설명하고, 핵심 단어를 뽑습니다.
JSON: {"source":"원문","answer":"정답","explain":"풀이","words":[{"k":"단어","r":"로마자","m":"뜻"}],"type":"유형"}`
        : `${base}
사진은 간판·안내문·서류입니다. 원문을 옮기고 ${langName(lang)}로 번역하고, 핵심 단어 3~6개와, 외국인이 오해하기 쉬운 점을 경고합니다.
JSON: {"source":"원문","translation":"번역","words":[{"k":"단어","r":"로마자","m":"뜻"}],"warning":"주의사항"}`;
    }
  };

  /* 폰 녹음은 webm/opus 로 나오는데 Gemini 는 wav·mp3·aac·ogg·flac 만 받는다.
     브라우저 안에서 16kHz 모노 WAV 로 바꿔 보낸다. 변환이 안 되면 원본을 그대로 보낸다. */
  async function toWav(blob) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC();
    try {
      var buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      var rate = 16000, ratio = buf.sampleRate / rate, n = Math.floor(buf.length / ratio);
      var src = buf.getChannelData(0), pcm = new Int16Array(n);
      for (var i = 0; i < n; i++) {
        var s = src[Math.floor(i * ratio)];
        pcm[i] = s < 0 ? Math.max(-1, s) * 0x8000 : Math.min(1, s) * 0x7FFF;
      }
      var out = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(out);
      var w = function (o, str) { for (var k = 0; k < str.length; k++) v.setUint8(o + k, str.charCodeAt(k)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
      new Int16Array(out, 44).set(pcm);
      return new Blob([out], { type: 'audio/wav' });
    } catch (e) { return null; }
    finally { try { ctx.close(); } catch (e) {} }
  }

  async function blobToB64(b) {
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1]); };
      fr.readAsDataURL(b);
    });
  }

  /* connect.js 가 부르는 post() 를 서버 없이 처리합니다 */
  window.__directPost = async function (path, body, isForm) {
    var kind = path.split('/').pop();
    if (used(kind) >= (LIMITS[kind] || 5)) {
      var e = new Error('오늘 무료 사용 횟수를 모두 쓰셨습니다.');
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }

    var out;
    if (kind === 'tutor') {
      out = await gemini(P.tutor(body.question, body.lang));
    } else if (kind === 'conversation') {
      out = await gemini(P.conversation(body.scene, body.history, body.userText, body.lang));
    } else if (kind === 'speech') {
      var au = body.get('audio'), tg = body.get('target'), lg = body.get('lang');
      var wav = await toWav(au);
      var snd = wav || au;
      out = await gemini(P.speech(tg, lg),
        [{ inlineData: { data: await blobToB64(snd), mimeType: snd.type || 'audio/mp4' } }]);
    } else if (kind === 'vision') {
      var im = body.get('image'), md = body.get('mode'), lv = body.get('lang');
      out = await gemini(P.vision(md, lv),
        [{ inlineData: { data: await blobToB64(im), mimeType: im.type || 'image/jpeg' } }]);
    } else {
      throw new Error('지원하지 않는 요청입니다.');
    }

    out.quotaLeft = bump(kind);
    return out;
  };

  window.__directReady = true;
  window.__directForgetKey = forgetKey;

  /* 서버가 있어야 하는 기능(실시간 학습방·학습 알림)은 단독 모드에서 숨긴다 */
  if (location.protocol === 'file:') {
    ['[data-go="live"]', '#push-btn'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.hidden = true; });
    });
  }
})();
