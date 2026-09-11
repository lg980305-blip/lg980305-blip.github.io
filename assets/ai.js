/* ============================================================
   BLACKHOLEMAN BROS — AI LAB (Gemini 연동 프론트엔드)

   ★ 중요 ★
   API 키는 이 파일에 절대 넣지 마세요. 이 파일은 방문자 누구나 볼 수 있습니다.
   키는 아래 ENDPOINT 가 가리키는 서버(중계 서버)의 환경변수에만 보관합니다.
   중계 서버 코드는 server/ 폴더에 있습니다.
     - server/cloudflare-worker.js  (Cloudflare Workers 용)
     - server/vercel-api-gemini.js  (Vercel Functions 용)

   ENDPOINT 가 비어 있으면 '데모 모드'로 동작합니다.
   미리 준비된 예시 답변이 타이핑 효과와 함께 나오므로,
   서버 없이도 화면과 흐름을 그대로 확인할 수 있습니다.
   ============================================================ */

window.BHB_AI_CONFIG = window.BHB_AI_CONFIG || {
  // 예) 'https://bhb-gemini.<계정명>.workers.dev/api/gemini'
  // 예) 'https://blackholemanbros.vercel.app/api/gemini'
  ENDPOINT: ''
};

(function () {
  'use strict';

  const CFG = window.BHB_AI_CONFIG;
  const LIVE = !!CFG.ENDPOINT;

  /* ---------- 캐릭터 페르소나 ----------
     서버로 mode 와 character 만 보내고, 실제 시스템 프롬프트는 서버가 갖습니다.
     여기 적힌 설명은 화면 표시용입니다. */
  const CHARACTERS = {
    blackholeman: {
      name: '블랙홀맨', en: 'Blackholeman',
      img: 'assets/cd33e0ed67201028.webp',
      color: '#3b9dff',
      tag: '세계관의 중심 / 탐험가',
      desc: '끝없는 호기심. 유쾌하고 장난기 넘치지만 마음은 여리고 따뜻합니다.',
      greeting: '오! 새로운 친구다. 나는 블랙홀맨! 뭐든 빨아들이는 게 특기지만… 오늘은 네 이야기를 빨아들여 볼까?',
      demo: [
        '좋은 질문이야! 블랙홀 안쪽은 아무도 본 적이 없어서, 나도 매번 들어갈 때마다 두근거려. 근데 솔직히 말하면… 가끔 길을 잃어서 홀독이 찾으러 와.',
        '오늘? 홀캣 털 관리하는 거 구경하다가 혼났어. 그래도 재밌었어! 너는 오늘 뭐 했어?',
        '음… 그건 나도 좀 무서운 얘긴데. 그래도 친구가 물어보면 대답해 줘야지! 우주에서 제일 무서운 건 혼자 있는 거야. 진짜로.'
      ]
    },
    holdog: {
      name: '홀독', en: 'Holdog',
      img: 'assets/9f36ab4b445c2308.webp',
      color: '#9de342',
      tag: '분위기 메이커 / 동료',
      desc: '둥글고 유쾌한 에너지. 속 깊고 의리 있어 친구들을 잘 챙깁니다.',
      greeting: '왔구나! 반가워, 나는 홀독이야. 배고프면 말해, 내가 뭐라도 챙겨줄게!',
      demo: [
        '당연하지! 친구 일이면 내가 제일 먼저 달려가. 블랙홀맨이 또 사고 쳐도… 뭐, 어쩌겠어. 같이 수습해야지.',
        '홀캣? 아, 아니 그냥… 오늘 털이 좀 반짝이더라고. 그런 말 하면 또 새침하게 굴 거야. 비밀로 해줘!',
        '좋아! 그럼 같이 가자. 어디로 갈지는 네가 정해. 나는 따라가는 거 잘해.'
      ]
    },
    holcat: {
      name: '홀캣', en: 'Holcat',
      img: 'assets/f654843e589a50a7.webp',
      color: '#ed57ae',
      tag: '미스터리 / 감성 캐릭터',
      desc: '도도하고 새침한 성격. 외모와 스타일 관리에 진심입니다.',
      greeting: '…왔어? 뭐, 앉든지. 대신 내 털에 손대면 안 돼.',
      demo: [
        '흥. 별로 안 궁금했는데, 그래도 물어봤으니까 대답은 해줄게. 딱 이번만이야.',
        '홀독? 걔는 좀… 시끄러워. 그래도 뭐, 나쁘진 않아. 이 말 걔한테 하면 진짜 곤란해져.',
        '오늘 컨디션은 나쁘지 않아. 털도 잘 정리됐고. …왜 그렇게 봐? 칭찬은 안 해도 돼.'
      ]
    }
  };

  const CHAR_KEYS = Object.keys(CHARACTERS);

  /* 사이트 문의 봇 데모 답변 */
  const ASK_DEMO = {
    default: '블랙홀맨브로스는 특허 기반 Character Evolution Engine으로 캐릭터가 사용자 반응에 따라 진화하는 IP 플랫폼을 만듭니다. 더 자세한 내용은 TECHNOLOGY 페이지를 참고해 주세요. (데모 응답입니다)',
    특허: '보유 특허는 등록번호 10-2837572 입니다. 사용자 반응 데이터에서 의미 있는 Signal을 추출해 캐릭터·스토리·세계관의 진화 방향을 제안하는 Character Evolution Engine의 기반 기술입니다.',
    제휴: 'IP 라이선싱, 공동 사업, 콘텐츠 제작·유통 제휴 모두 환영합니다. contact@blackholemanbros.com 으로 소속·연락처·문의 유형을 적어 보내주시면 영업일 기준 2~3일 내에 회신드립니다.',
    캐릭터: '오리지널 캐릭터는 블랙홀맨, 홀독, 홀캣 세 명이 중심이고, 최근 T-Man과 T-Bird가 합류했습니다. 각 캐릭터의 설정과 관계는 CHARACTERS 페이지에서 볼 수 있습니다.',
    투자: 'AI Character Evolution Platform 관련 투자 및 IR 자료 요청은 contact@blackholemanbros.com 으로 문의해 주세요.',
    굿즈: '현재 굿즈는 출시 전 콘셉트 프리뷰 단계입니다. SHOP 페이지에서 라인업을 미리 보실 수 있고, 출시 알림을 신청하시면 가장 먼저 안내드립니다.'
  };

  const EVOLVE_DEMO = {
    signal: ['홀캣 단독 등장 컷의 완주율이 평균 대비 +34%', '15–30초 숏폼의 저장(save) 비율이 롱폼의 2.1배',
             '“여행” 테마 댓글 언급이 4주 연속 1위', '홀독–홀캣 상호작용 장면의 공유율 +47%'],
    action: ['다음 에피소드에서 홀캣 분량 20% 확대', '숏폼을 주 2회 → 주 3회로 상향, 길이는 20초 고정',
             '여행 시즌 아크 3부작 기획 착수', '홀독–홀캣 투샷을 썸네일 기본 구도로 채택'],
    reason: ['완주율은 단순 조회수보다 캐릭터 선호를 잘 반영하는 지표입니다.',
             '저장은 재시청 의도를 뜻하며 장기 팬 전환율과 상관관계가 높습니다.',
             '4주 연속 상위 언급은 일시적 유행이 아닌 지속 수요로 판단됩니다.',
             '공유는 신규 유입을 만드는 유일한 반응 지표입니다.']
  };

  const STORY_DEMO = `EP. 우연히 열린 문

새벽 세 시. 홀독이 냉장고 문을 열자, 안쪽에서 바람이 불어왔다.
"…냉장고에서 바람이 왜 나와?"
블랙홀맨이 하품하며 다가왔다. "아, 그거? 어제 내가 좀 빨아들였거든."
"뭘!"
"몰라. 근데 뭔가 반짝였어."

문 너머에는 별이 가득한 복도가 있었다. 홀캣이 뒤늦게 나타나 한 번 들여다보더니, 조용히 앞머리를 정리했다.
"…들어갈 거면 빨리 가. 나 아침에 털 손질해야 해."
셋은 그렇게, 냉장고 안으로 걸어 들어갔다.

(데모 응답입니다. 실제 연동 시 Gemini가 매번 새로운 에피소드를 생성합니다.)`;

  /* ---------- 유틸 ---------- */
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* 타이핑 효과 (모션 최소화 설정이면 즉시 출력) */
  async function typeInto(node, text) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = text; return; }
    node.textContent = '';
    for (let i = 0; i < text.length; i++) {
      node.textContent += text[i];
      if (i % 2 === 0) await wait(12);
    }
  }

  /* ---------- 서버 호출 ---------- */
  async function callAI(payload) {
    if (!LIVE) throw new Error('DEMO');
    const res = await fetch(CFG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('서버 오류 (' + res.status + ')');
    const data = await res.json();
    if (!data || typeof data.text !== 'string') throw new Error('응답 형식 오류');
    return data.text;
  }

  /* ============================================================
     1. 캐릭터 대화
     ============================================================ */
  function initChat(root) {
    let current = CHAR_KEYS[0];
    let history = [];
    let busy = false;

    const picker = root.querySelector('[data-chat-picker]');
    const log = root.querySelector('[data-chat-log]');
    const form = root.querySelector('[data-chat-form]');
    const input = root.querySelector('[data-chat-input]');
    const send = root.querySelector('[data-chat-send]');
    const chips = root.querySelector('[data-chat-chips]');
    if (!picker || !log || !form) return;

    CHAR_KEYS.forEach((k) => {
      const c = CHARACTERS[k];
      const b = el('button', 'ai-avatar');
      b.type = 'button';
      b.dataset.k = k;
      b.style.setProperty('--c', c.color);
      b.setAttribute('aria-pressed', String(k === current));
      b.innerHTML = `<img src="${c.img}" alt="" aria-hidden="true" loading="lazy" decoding="async">
                     <span class="ai-avatar-name">${c.name}</span>`;
      b.addEventListener('click', () => selectChar(k));
      picker.appendChild(b);
    });

    function addMsg(who, text, charKey) {
      const c = CHARACTERS[charKey || current];
      const row = el('div', 'ai-msg ai-msg-' + who);
      if (who === 'bot') {
        row.innerHTML = `<img class="ai-msg-face" src="${c.img}" alt="${esc(c.name)}" loading="lazy" decoding="async">`;
      }
      const bub = el('div', 'ai-bubble');
      if (who === 'bot') bub.style.setProperty('--c', c.color);
      bub.textContent = text;
      row.appendChild(bub);
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
      return bub;
    }

    function selectChar(k) {
      if (busy) return;
      current = k;
      history = [];
      [...picker.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      log.innerHTML = '';
      const c = CHARACTERS[k];
      root.querySelector('[data-chat-tag]').textContent = c.tag;
      root.querySelector('[data-chat-desc]').textContent = c.desc;
      addMsg('bot', c.greeting, k);
      renderChips();
    }

    const SUGGEST = ['오늘 뭐 했어?', '블랙홀 안은 어때?', '친구들 얘기 해줘', '나 요즘 좀 힘들어'];
    function renderChips() {
      if (!chips) return;
      chips.innerHTML = '';
      SUGGEST.forEach((q) => {
        const b = el('button', 'ai-chip', esc(q));
        b.type = 'button';
        b.addEventListener('click', () => { input.value = q; form.requestSubmit(); });
        chips.appendChild(b);
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q || busy) return;
      busy = true; send.disabled = true; input.value = '';
      addMsg('me', q);
      history.push({ role: 'user', text: q });

      const bub = addMsg('bot', '');
      bub.classList.add('ai-typing');
      bub.innerHTML = '<span></span><span></span><span></span>';

      let answer;
      try {
        answer = await callAI({ mode: 'chat', character: current, message: q, history: history.slice(-10) });
      } catch (err) {
        if (err.message === 'DEMO') {
          await wait(650);
          const d = CHARACTERS[current].demo;
          answer = d[history.filter((h) => h.role === 'user').length % d.length];
        } else {
          answer = '지금은 대답하기 어려워… 잠시 뒤에 다시 말 걸어줄래? (' + err.message + ')';
        }
      }
      bub.classList.remove('ai-typing');
      bub.innerHTML = '';
      await typeInto(bub, answer);
      history.push({ role: 'model', text: answer });
      log.scrollTop = log.scrollHeight;
      busy = false; send.disabled = false; input.focus();
    });

    selectChar(current);
  }

  /* ============================================================
     2. 사이트 문의 봇
     ============================================================ */
  function initAsk(root) {
    const form = root.querySelector('[data-ask-form]');
    const input = root.querySelector('[data-ask-input]');
    const out = root.querySelector('[data-ask-out]');
    const chips = root.querySelectorAll('[data-ask-q]');
    if (!form) return;

    chips.forEach((c) => c.addEventListener('click', () => {
      input.value = c.dataset.askQ; form.requestSubmit();
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      out.hidden = false;
      out.textContent = '답변을 찾는 중…';
      let answer;
      try {
        answer = await callAI({ mode: 'ask', message: q });
      } catch (err) {
        if (err.message === 'DEMO') {
          await wait(500);
          const hit = Object.keys(ASK_DEMO).find((k) => k !== 'default' && q.includes(k));
          answer = ASK_DEMO[hit || 'default'];
        } else {
          answer = '지금은 답변을 불러올 수 없습니다. (' + err.message + ')\n직접 문의는 contact@blackholemanbros.com 으로 보내주세요.';
        }
      }
      out.textContent = '';
      await typeInto(out, answer);
    });
  }

  /* ============================================================
     3. 캐릭터 진화 데모 (Character Evolution Engine 시각화)
     ============================================================ */
  function initEvolve(root) {
    const btn = root.querySelector('[data-evolve-run]');
    const steps = root.querySelectorAll('[data-evolve-step]');
    const outSignal = root.querySelector('[data-evolve-signal]');
    const outAction = root.querySelector('[data-evolve-action]');
    const outReason = root.querySelector('[data-evolve-reason]');
    const result = root.querySelector('[data-evolve-result]');
    if (!btn) return;

    let n = 0;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      result.hidden = true;
      steps.forEach((s) => s.classList.remove('on'));
      for (const s of steps) { s.classList.add('on'); await wait(520); }

      let sig, act, why;
      try {
        const raw = await callAI({ mode: 'evolve' });
        const j = JSON.parse(raw);
        sig = j.signal; act = j.action; why = j.reason;
      } catch (err) {
        const i = n++ % EVOLVE_DEMO.signal.length;
        sig = EVOLVE_DEMO.signal[i]; act = EVOLVE_DEMO.action[i]; why = EVOLVE_DEMO.reason[i];
      }
      result.hidden = false;
      outSignal.textContent = ''; outAction.textContent = ''; outReason.textContent = '';
      await typeInto(outSignal, sig);
      await typeInto(outAction, act);
      await typeInto(outReason, why);
      btn.disabled = false;
    });
  }

  /* ============================================================
     4. 스토리 생성
     ============================================================ */
  function initStory(root) {
    const form = root.querySelector('[data-story-form]');
    const input = root.querySelector('[data-story-input]');
    const out = root.querySelector('[data-story-out]');
    const btn = root.querySelector('[data-story-btn]');
    const picks = root.querySelectorAll('[data-story-cast]');
    if (!form) return;

    picks.forEach((p) => p.addEventListener('click', () => {
      p.classList.toggle('on');
      p.setAttribute('aria-pressed', p.classList.contains('on') ? 'true' : 'false');
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cast = [...picks].filter((p) => p.classList.contains('on')).map((p) => p.dataset.storyCast);
      const theme = input.value.trim() || '일상';
      btn.disabled = true;
      out.hidden = false;
      out.textContent = '이야기를 짓는 중…';
      let text;
      try {
        text = await callAI({ mode: 'story', theme, cast });
      } catch (err) {
        if (err.message === 'DEMO') { await wait(800); text = STORY_DEMO; }
        else { text = '지금은 생성할 수 없습니다. (' + err.message + ')'; }
      }
      out.textContent = '';
      await typeInto(out, text);
      btn.disabled = false;
    });
  }

  /* ---------- 부팅 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.querySelector('[data-ai-mode]');
    if (badge) {
      badge.textContent = LIVE ? 'GEMINI CONNECTED' : 'DEMO MODE';
      badge.classList.toggle('live', LIVE);
    }
    document.querySelectorAll('[data-ai-chat]').forEach(initChat);
    document.querySelectorAll('[data-ai-ask]').forEach(initAsk);
    document.querySelectorAll('[data-ai-evolve]').forEach(initEvolve);
    document.querySelectorAll('[data-ai-story]').forEach(initStory);
  });
})();
