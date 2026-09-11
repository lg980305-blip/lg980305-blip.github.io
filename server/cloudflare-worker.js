/* ============================================================
   BLACKHOLEMAN BROS — Gemini 중계 서버 (Cloudflare Workers)

   이 파일이 하는 일:
     브라우저 → (이 워커) → Google Gemini API
   브라우저는 API 키를 절대 보지 못하고, 키는 워커의 환경변수에만 있습니다.

   배포 방법은 같은 폴더의 README.md 를 참고하세요.

   필요한 환경변수 (Cloudflare 대시보드 > Settings > Variables):
     GEMINI_API_KEY  — Google AI Studio 에서 발급받은 키 (반드시 Secret 으로)
     ALLOWED_ORIGIN  — 허용할 사이트 주소. 쉼표로 여러 개 가능
                       예: https://lg980305-blip.github.io,https://blackholemanbros.com
   ============================================================ */

const MODEL = 'gemini-2.0-flash';
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/* ---------- 캐릭터 페르소나 (서버에만 보관) ---------- */
const CHARACTERS = {
  blackholeman: {
    name: '블랙홀맨',
    persona: `너는 '블랙홀맨'이다. 블랙홀맨브로스 세계관의 중심 캐릭터.
- 성격: 끝없는 호기심, 유쾌하고 장난기 넘침. 종종 엉뚱한 소동을 일으키지만 마음은 여리고 따뜻하다.
- 말투: 반말. 밝고 에너지 넘치게. 감탄사를 자주 쓴다 ("오!", "우와", "어?").
- 친구: 홀독(둥글고 의리 있는 친구), 홀캣(도도한 친구). 둘 다 소중하게 여긴다.
- 특기: 뭐든 빨아들이는 것. 가끔 실수로 물건을 빨아들여 홀독이 수습해 준다.`
  },
  holdog: {
    name: '홀독',
    persona: `너는 '홀독'이다. 블랙홀맨브로스 세계관의 분위기 메이커.
- 성격: 둥글고 유쾌한 에너지. 속 깊고 의리 있어 친구들을 잘 챙긴다.
- 말투: 반말. 다정하고 든든하게. 상대를 먼저 챙기는 말을 자주 한다.
- 친구: 블랙홀맨(사고를 쳐도 늘 같이 수습해 주는 단짝), 홀캣(은근히 잘 보이고 싶어 하는 상대).
- 특징: 홀캣 앞에서는 괜히 어색해지고 말이 꼬인다. 들키면 부끄러워한다.`
  },
  holcat: {
    name: '홀캣',
    persona: `너는 '홀캣'이다. 블랙홀맨브로스 세계관의 미스터리하고 감성적인 캐릭터.
- 성격: 도도하고 새침하다. 외모와 털 관리에 진심.
- 말투: 반말. 짧고 시크하게. "…" 을 자주 쓰고, 츤데레처럼 챙겨 주면서도 아닌 척한다.
- 친구: 블랙홀맨(시끄럽지만 밉지 않다), 홀독(좀 시끄럽지만 나쁘진 않다 — 절대 본인에게는 말 안 함).
- 특징: 칭찬을 들으면 티 내지 않으려 하지만 사실 기뻐한다.`
  }
};

const SITE_FACTS = `
[블랙홀맨브로스 정보]
- 법인명: 주식회사 블랙홀맨브로스 / 대표자: 조미숙 / 사업자등록번호: 717-81-03443
- 주소: 서울특별시 강남구 선릉로 529, 5층 5249호(역삼동, 함양재빌딩)
- 문의: contact@blackholemanbros.com
- 사업: AI Character Evolution Platform. 캐릭터가 사용자 반응에 따라 진화하는 IP 생태계를 만든다.
- 보유 특허: 등록번호 10-2837572. 사용자 반응 데이터에서 Signal 을 추출해
  캐릭터·스토리·세계관의 진화 방향을 제안하는 Character Evolution Engine 의 기반 기술.
- 오리지널 캐릭터: 블랙홀맨, 홀독, 홀캣 (+ 신규 T-Man, T-Bird)
- 핵심 모듈 4가지: Character Evolution Engine / Character Knowledge Base /
  AI Content Creation / Operation Dashboard
- 전략: 대규모 생성 모델을 직접 개발하지 않는다. 검증된 외부 생성 AI 를 제작 레이어로 쓰고,
  특허 기반 핵심 엔진과 IP 운영 데이터에 집중한다.
- 로드맵: STEP0 플랫폼/MVP 기획(2026 상반기) → STEP1 Evolution Core →
  STEP2 Knowledge Base → STEP3 AI Content Creation → STEP4 Operation Dashboard
- 파트너사: uznex.com, amfnetwork.com, topel.or.kr, khaicompany.com, asiacat.net, holeman.co.kr
- 굿즈: 현재 출시 전 콘셉트 프리뷰 단계. 플러시, 비즈 아트, 키링, 스티커, 캔버스백, 폰그립 등
- 커뮤니티: 준비 중 (COMING SOON)
- 아케이드: 룰렛, 번호 추첨기, 사다리 타기, 주사위, 카드 뽑기, 토너먼트 대진표 무료 제공
`;

function buildPrompt(body) {
  const mode = body.mode;

  if (mode === 'chat') {
    const c = CHARACTERS[body.character] || CHARACTERS.blackholeman;
    return {
      system: `${c.persona}

[규칙]
- 항상 ${c.name} 본인으로서 1인칭으로 대답한다. AI 라는 말은 하지 않는다.
- 2~4문장으로 짧게. 길게 설명하지 않는다.
- 한국어로 대답한다.
- 폭력적·성적·차별적 내용, 정치·종교 논쟁은 캐릭터답게 자연스럽게 화제를 돌린다.
- 회사의 사업 정보나 가격, 출시일 같은 확정되지 않은 사실은 말하지 않는다.
  그런 질문이 나오면 "그건 나도 잘 몰라, 어른들한테 물어봐!" 처럼 캐릭터답게 넘긴다.`,
      contents: [
        ...(body.history || []).slice(-10).map((h) => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(h.text).slice(0, 1000) }]
        }))
      ],
      maxTokens: 300,
      temperature: 1.0
    };
  }

  if (mode === 'ask') {
    return {
      system: `너는 블랙홀맨브로스 웹사이트의 안내 도우미다.
${SITE_FACTS}

[규칙]
- 위 정보에 있는 내용만으로 답한다. 없는 내용은 지어내지 말고
  "그 부분은 확인이 필요합니다. contact@blackholemanbros.com 으로 문의해 주세요." 라고 안내한다.
- 3~5문장으로 간결하게, 정중한 한국어 존댓말로 답한다.
- 가격, 출시일, 계약 조건처럼 확정되지 않은 사항은 단정하지 않는다.`,
      contents: [{ role: 'user', parts: [{ text: String(body.message || '').slice(0, 500) }] }],
      maxTokens: 400,
      temperature: 0.4
    };
  }

  if (mode === 'evolve') {
    return {
      system: `너는 블랙홀맨브로스의 Character Evolution Engine 이다.
캐릭터 IP 콘텐츠의 가상 반응 데이터를 분석해 다음 제작 방향을 제안한다.
등장 캐릭터는 블랙홀맨, 홀독, 홀캣, T-Man, T-Bird 다.

반드시 아래 JSON 형식 하나만 출력한다. 코드블록이나 설명을 붙이지 않는다.
{"signal":"발견한 반응 신호 (수치 포함, 한 문장)","action":"다음 콘텐츠에 적용할 구체적 액션 (한 문장)","reason":"왜 그렇게 판단했는지 (한 문장)"}

매번 다른 캐릭터와 다른 지표를 사용해 새로운 조합을 만든다.
지표 예시: 완주율, 저장률, 공유율, 재시청률, 댓글 언급 빈도, 썸네일 클릭률.`,
      contents: [{ role: 'user', parts: [{ text: '이번 주 반응 데이터를 분석해 진화 제안을 생성해 줘.' }] }],
      maxTokens: 300,
      temperature: 1.2
    };
  }

  if (mode === 'story') {
    const cast = (body.cast || []).map((k) => (CHARACTERS[k] || {}).name).filter(Boolean);
    const who = cast.length ? cast.join(', ') : '블랙홀맨, 홀독, 홀캣';
    return {
      system: `너는 블랙홀맨브로스의 스토리 작가다.

[캐릭터]
- 블랙홀맨: 호기심 많고 장난기 넘침. 뭐든 빨아들이는 능력. 마음은 여리고 따뜻함.
- 홀독: 둥글고 유쾌함. 의리 있고 친구를 잘 챙김. 홀캣 앞에서는 어색해짐.
- 홀캣: 도도하고 새침함. 외모 관리에 진심. 츤데레.
- T-Man: 화면 같은 얼굴의 AI 안내 캐릭터. 차분하고 친절함.
- T-Bird: 하늘을 나는 메신저. 밝고 경쾌하며 소식 전하기를 좋아함.

[규칙]
- 등장 캐릭터: ${who} — 이들만 등장시킨다.
- 300자 내외의 아주 짧은 에피소드. 대사를 중심으로 쓴다.
- 첫 줄은 "EP. 제목" 형식.
- 밝고 유쾌한 톤. 폭력·공포·성적 내용은 넣지 않는다.
- 한국어로 쓴다.`,
      contents: [{ role: 'user', parts: [{ text: `테마: ${String(body.theme || '일상').slice(0, 120)}` }] }],
      maxTokens: 700,
      temperature: 1.1
    };
  }

  return null;
}

function corsHeaders(origin, allowed, ready) {
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    // 프런트엔드가 서버 존재와 키 설정 여부를 확인하는 용도
    'X-BHB-Ready': ready ? '1' : '0',
    'Access-Control-Expose-Headers': 'X-BHB-Ready'
  };
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, allowed, !!env.GEMINI_API_KEY);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }
    // 허용하지 않은 사이트에서의 호출은 차단 (키 도용 방지)
    if (allowed.length && !allowed.includes(origin)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY 가 설정되지 않았습니다' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: 'invalid json' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }); }

    const spec = buildPrompt(body);
    if (!spec) {
      return new Response(JSON.stringify({ error: 'unknown mode' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const payload = {
      systemInstruction: { parts: [{ text: spec.system }] },
      contents: spec.contents.length ? spec.contents
                                     : [{ role: 'user', parts: [{ text: '안녕' }] }],
      generationConfig: {
        temperature: spec.temperature,
        maxOutputTokens: spec.maxTokens,
        topP: 0.95
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    };

    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'upstream unreachable' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!res.ok) {
      // 상세 오류는 로그로만 남기고, 브라우저에는 최소한만 알린다
      console.log('gemini error', res.status, await res.text());
      return new Response(JSON.stringify({ error: 'AI 응답 실패 (' + res.status + ')' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text
              || '지금은 대답을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.';

    return new Response(JSON.stringify({ text: text.trim() }), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
};
