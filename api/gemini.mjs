/* ============================================================
   BLACKHOLEMAN BROS — Gemini 중계 서버 (Vercel Functions)

   이 파일을 프로젝트 루트의  api/gemini.js  로 두면
   https://<프로젝트>.vercel.app/api/gemini 주소로 동작합니다.
   (이 저장소에는 api/gemini.js 로 이미 복사해 두었습니다.)

   브라우저 → (이 함수) → Google Gemini API
   브라우저는 API 키를 절대 보지 못하고, 키는 Vercel 환경변수에만 있습니다.

   필요한 환경변수 (Vercel 대시보드 > Settings > Environment Variables):
     GEMINI_API_KEY  — Google AI Studio 에서 발급받은 키
     ALLOWED_ORIGIN  — 허용할 사이트 주소. 쉼표로 여러 개 가능

   ※ 참고: Vercel 무료(Hobby) 플랜은 약관상 비상업적 개인 프로젝트용입니다.
      법인 사이트로 운영하실 경우 Pro 플랜 또는 Cloudflare Workers 를 검토하세요.
   ============================================================ */

/* 기본 모델 — 환경변수 GEMINI_MODEL 로 바꿀 수 있다.
   gemini-2.0/2.5 계열은 2026년 순차 종료 예정이라 'latest' 별칭을 기본값으로 둔다. */
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const HOST = 'https://generativelanguage.googleapis.com/v1beta';
const API = `${HOST}/models/${MODEL}:generateContent`;

const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

/* ============================================================
   AMF CIE (/amf/) 용 "직접 호출" 프로토콜
   ------------------------------------------------------------
   /amf/ 앱은 시스템 프롬프트·JSON 스키마를 화면 상태에 맞춰 브라우저에서 만들고,
   서버는 키만 붙여 Gemini 에 그대로 전달한다. 응답도 Gemini 원형 그대로 돌려준다.

     GET  /api/gemini                      → { serverKey:true|false, defaultModel }
     POST { action:'models' }              → Gemini ListModels 응답 그대로
     POST { action:'generate', model, payload:{ contents, systemInstruction?, generationConfig? } }
                                           → Gemini generateContent 응답 그대로

   payload 는 아래 sanitizePayload 로 허용 필드만 남기고 크기·토큰 상한을 건다.
   ============================================================ */
const MODEL_RE = /^gemini-[a-z0-9.-]{1,40}$/;
const MAX_BODY = 200_000;      // 문자 수 — 텍스트만 있을 때. 컨텍스트 JSON + 대화 12턴이면 넉넉하다
const MAX_BODY_MEDIA = 4_000_000; // 음성·사진(inlineData)이 있을 때. Vercel 요청 상한(4.5MB) 안쪽
const MAX_TURNS = 40;
const MAX_OUT = 4096;

/* TOPIK 앱의 발음 평가(음성)·사진 인식에 필요한 첨부 형식만 허용한다 */
const INLINE_MIME = new Set(['audio/wav', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
                             'image/jpeg', 'image/png', 'image/webp']);
const B64_RE = /^[A-Za-z0-9+/=]+$/;

function sanitizePart(x) {
  if (!x || typeof x !== 'object') return null;
  if (typeof x.text === 'string') return { text: x.text };
  const d = x.inlineData;
  if (d && typeof d.data === 'string' && INLINE_MIME.has(String(d.mimeType).toLowerCase().split(';')[0])
      && d.data.length <= MAX_BODY_MEDIA && B64_RE.test(d.data)) {
    return { inlineData: { mimeType: String(d.mimeType).toLowerCase().split(';')[0], data: d.data } };
  }
  return null;
}

function sanitizePayload(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.contents) || !p.contents.length) return null;
  if (p.contents.length > MAX_TURNS) return null;
  const contents = p.contents.map((c) => ({
    role: c && c.role === 'model' ? 'model' : 'user',
    parts: (Array.isArray(c && c.parts) ? c.parts : []).map(sanitizePart).filter(Boolean)
  })).filter((c) => c.parts.length);
  if (!contents.length) return null;

  const g = (p.generationConfig && typeof p.generationConfig === 'object') ? p.generationConfig : {};
  const generationConfig = {
    temperature: Math.min(2, Math.max(0, Number(g.temperature ?? 0.3) || 0)),
    maxOutputTokens: Math.min(MAX_OUT, Math.max(16, Number(g.maxOutputTokens ?? 1024) || 1024)),
    topP: 0.95
  };
  if (g.responseMimeType === 'application/json') {
    generationConfig.responseMimeType = 'application/json';
    if (g.responseSchema && typeof g.responseSchema === 'object') generationConfig.responseSchema = g.responseSchema;
  }
  const out = { contents, generationConfig, safetySettings: SAFETY };
  const si = p.systemInstruction;
  if (si && Array.isArray(si.parts)) {
    const parts = si.parts.filter((x) => x && typeof x.text === 'string').map((x) => ({ text: x.text }));
    if (parts.length) out.systemInstruction = { parts };
  }
  return out;
}

async function proxyDirect(body, apiKey) {
  if (body.action === 'models') {
    const r = await fetch(`${HOST}/models?pageSize=100`, { headers: { 'x-goog-api-key': apiKey } });
    return { status: r.status, json: await r.json().catch(() => ({ error: { message: 'bad upstream json' } })) };
  }
  if (body.action === 'generate') {
    const model = MODEL_RE.test(String(body.model || '')) ? body.model : MODEL;
    const payload = sanitizePayload(body.payload);
    if (!payload) return { status: 400, json: { error: { message: 'invalid payload' } } };
    const hasMedia = payload.contents.some((c) => c.parts.some((x) => x.inlineData));
    if (JSON.stringify(payload).length > (hasMedia ? MAX_BODY_MEDIA : MAX_BODY)) {
      return { status: 413, json: { error: { message: 'payload too large' } } };
    }
    const r = await fetch(`${HOST}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload)
    });
    /* Gemini 오류 JSON({error:{code,message,status}})에는 키가 들어 있지 않으므로 그대로 전달한다 */
    return { status: r.status, json: await r.json().catch(() => ({ error: { message: 'bad upstream json' } })) };
  }
  return null;
}

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


/* 안드로이드 앱(WebView 안의 file:// 페이지)은 Origin 이 "null" 로 온다.
   앱이 붙이는 X-Topik-App 헤더(또는 WebView 가 자동으로 붙이는 X-Requested-With)가
   앱 패키지명과 같을 때만 허용한다. 비밀은 아니므로 실제 보호는 Google 쪽 할당량 설정에 달려 있다. */
const APP_PACKAGE = process.env.APP_PACKAGE || 'kr.topikasia.app';
function isAppRequest(req) {
  if ((req.headers.origin || '') !== 'null') return false;
  const tag = req.headers['x-topik-app'] || req.headers['x-requested-with'] || '';
  return tag === APP_PACKAGE;
}

export default async function handler(req, res) {
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  const fromApp = isAppRequest(req);
  /* ALLOWED_ORIGIN 을 지정하지 않으면 아래 403 검사도 통과시키므로, CORS 헤더도 요청 출처를 그대로 돌려준다.
     (헤더를 비우면 브라우저가 무조건 막아서 다른 주소의 페이지가 이 서버를 못 쓴다) */
  const allowOrigin = fromApp ? 'null'
    : allowed.length ? (allowed.includes(origin) ? origin : allowed[0])
    : (origin || '*');

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Topik-App');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');

  // 프런트엔드가 서버 존재와 키 설정 여부를 확인하는 용도
  res.setHeader('X-BHB-Ready', process.env.GEMINI_API_KEY ? '1' : '0');
  res.setHeader('Access-Control-Expose-Headers', 'X-BHB-Ready');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // /amf/ 앱의 상태 확인: 서버에 키가 있는지, 기본 모델은 무엇인지 (비밀이 아니므로 Origin 검사 없음.
  // 같은 도메인 GET 에는 브라우저가 Origin 헤더를 붙이지 않는다)
  if (req.method === 'GET') {
    return res.status(200).json({ serverKey: !!process.env.GEMINI_API_KEY, defaultModel: MODEL });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // 허용하지 않은 사이트에서의 호출은 차단 (키 도용 방지). 안드로이드 앱은 위 isAppRequest 로 통과
  if (allowed.length && !allowed.includes(origin) && !fromApp) {
    return res.status(403).json({ error: 'origin not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (body.action === 'generate' || body.action === 'models') {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(501).json({ error: { message: 'GEMINI_API_KEY 가 설정되지 않았습니다' } });
    }
    let out;
    try { out = await proxyDirect(body, process.env.GEMINI_API_KEY); }
    catch { return res.status(502).json({ error: { message: 'upstream unreachable' } }); }
    return res.status(out.status).json(out.json);
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 가 설정되지 않았습니다' });
  }
  const spec = buildPrompt(body);
  if (!spec) return res.status(400).json({ error: 'unknown mode' });

  const payload = {
    systemInstruction: { parts: [{ text: spec.system }] },
    contents: spec.contents.length ? spec.contents : [{ role: 'user', parts: [{ text: '안녕' }] }],
    generationConfig: { temperature: spec.temperature, maxOutputTokens: spec.maxTokens, topP: 0.95 },
    safetySettings: SAFETY
  };

  let upstream;
  try {
    upstream = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(payload)
    });
  } catch {
    return res.status(502).json({ error: 'upstream unreachable' });
  }

  if (!upstream.ok) {
    console.log('gemini error', upstream.status, await upstream.text());
    return res.status(502).json({ error: 'AI 응답 실패 (' + upstream.status + ')' });
  }

  const data = await upstream.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
            || '지금은 대답을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  return res.status(200).json({ text: text.trim() });
}
