/* ============================================================
   서버 없이 동작하는 AI 연결기 (APK 전용)

   맥 서버에 못 붙으면 앱이 구글 Gemini에 직접 요청합니다.
   서버가 켜져 있으면 그쪽을 먼저 씁니다.
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

  async function gemini(prompt, parts) {
    var body = { contents: [{ parts: [{ text: prompt }].concat(parts || []) }],
                 generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } };
    var key = getKey();
    /* 통신이 멈추면 무한 대기하지 않도록 20초 제한 */
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    var r;
    try {
      r = await fetch(EP + GEMINI_MODEL + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('응답이 20초 안에 오지 않았습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
      throw new Error('인터넷에 연결할 수 없습니다.');
    } finally { if (timer) clearTimeout(timer); }
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var msg = (j.error && j.error.message) || 'AI 요청 실패';
      /* 키 자체가 거부된 경우에만 지워서 다음에 다시 물어봅니다.
         (400 은 요청 형식 오류에도 쓰이므로 메시지로 구분합니다) */
      if (r.status === 401 || r.status === 403 || /api key/i.test(msg)) forgetKey();
      throw new Error(msg);
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
