# Gemini 중계 서버 배포 가이드

> **왜 서버가 필요한가요?**
> 이 사이트는 GitHub Pages에서 도는 정적 사이트라 서버가 없습니다.
> Gemini API 키를 HTML이나 JavaScript에 넣으면 **방문자 누구나 "페이지 소스 보기"로 키를 볼 수 있고**,
> 도용되면 요금이 그대로 청구됩니다.
> 그래서 키를 대신 보관해 줄 아주 작은 중계 서버가 하나 필요합니다. 무료로 만들 수 있습니다.

```
브라우저(사이트)  ──요청──▶  중계 서버(여기에만 키 보관)  ──▶  Google Gemini
                 ◀──답변──                             ◀──
```

---

## 0단계. Gemini API 키 발급 (공통, 3분)

1. <https://aistudio.google.com/apikey> 접속 → 구글 계정 로그인
2. **Create API key** 클릭
3. 나온 키(`AIza...`로 시작)를 복사해 둡니다. **이 키는 아무에게도 보여주지 마세요.**

무료 등급에서 `gemini-2.0-flash` 모델은 분당 15회 / 하루 1,500회까지 쓸 수 있습니다.
소개용 사이트에는 충분한 양입니다.

---

## 방법 A. Cloudflare Workers (권장)

**무료 · 신용카드 불필요 · 하루 10만 요청 · 상업적 사용 제한 없음**

### A-1. 대시보드에서 만들기 (터미널 없이)

1. <https://dash.cloudflare.com> 가입 후 로그인
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Create Worker**
3. 이름을 `bhb-gemini` 로 짓고 **Deploy** 클릭
4. **Edit code** 를 눌러 편집기를 연 다음, 기존 내용을 모두 지우고
   이 폴더의 **`cloudflare-worker.js` 전체 내용을 붙여넣기** → **Deploy**
5. 워커 페이지에서 **Settings → Variables and Secrets** 로 이동해 두 개를 추가합니다.

   | 이름 | 종류 | 값 |
   |---|---|---|
   | `GEMINI_API_KEY` | **Secret** | 0단계에서 받은 키 |
   | `ALLOWED_ORIGIN` | Text | `https://lg980305-blip.github.io` |

   > 나중에 도메인을 붙이거나 Vercel에도 올리면 쉼표로 이어 붙이세요.
   > 예: `https://lg980305-blip.github.io,https://blackholemanbros.com`
   > **끝에 슬래시(`/`)를 넣으면 안 됩니다.**

6. 화면 위에 표시된 주소를 복사합니다. 예: `https://bhb-gemini.내계정.workers.dev`

### A-2. 터미널에서 만들기 (선택)

```bash
npm install -g wrangler
wrangler login

mkdir bhb-gemini && cd bhb-gemini
cp /경로/server/cloudflare-worker.js ./index.js

cat > wrangler.toml <<'EOF'
name = "bhb-gemini"
main = "index.js"
compatibility_date = "2026-01-01"

[vars]
ALLOWED_ORIGIN = "https://lg980305-blip.github.io"
EOF

wrangler secret put GEMINI_API_KEY   # 물어보면 키를 붙여넣기
wrangler deploy
```

---

## 방법 B. Vercel Functions

**무료 Hobby 플랜은 약관상 비상업적 개인 프로젝트용입니다.**
법인 사이트로 운영하실 계획이면 Pro($20/월)를 쓰거나 방법 A를 권합니다.

이 저장소에는 이미 `api/gemini.mjs` 가 들어 있어서, 저장소를 그대로 Vercel에 연결하면 됩니다.

1. <https://vercel.com> 가입 → **Add New → Project**
2. 이 GitHub 저장소를 선택 → **Import**
3. Framework Preset은 **Other**, Root Directory는 그대로 두고 **Deploy**
4. 배포 후 **Settings → Environment Variables** 에서 추가:

   | Key | Value |
   |---|---|
   | `GEMINI_API_KEY` | 0단계에서 받은 키 |
   | `ALLOWED_ORIGIN` | `https://lg980305-blip.github.io,https://<프로젝트>.vercel.app` |

5. **Deployments → 맨 위 항목 → Redeploy** (환경변수는 재배포해야 반영됩니다)
6. 주소는 `https://<프로젝트>.vercel.app/api/gemini` 입니다.

---

## 마지막 단계. 사이트에 주소 연결하기

`assets/ai.js` 파일 맨 위를 열어 `ENDPOINT` 에 방금 만든 주소를 붙여넣습니다.

```js
window.BHB_AI_CONFIG = window.BHB_AI_CONFIG || {
  ENDPOINT: 'https://bhb-gemini.내계정.workers.dev'      // ← Cloudflare 인 경우
  // ENDPOINT: 'https://내프로젝트.vercel.app/api/gemini'  // ← Vercel 인 경우
};
```

저장하고 커밋·푸시하면 끝입니다.
`ai.html` 상단 배지가 주황색 **DEMO MODE** 에서 초록색 **GEMINI CONNECTED** 로 바뀌면 성공입니다.

---

## 잘 안 될 때

| 증상 | 원인과 해결 |
|---|---|
| 배지가 계속 DEMO MODE | `ENDPOINT` 가 비어 있습니다. 저장·푸시가 됐는지, 브라우저 캐시를 지웠는지 확인하세요. |
| `origin not allowed` | `ALLOWED_ORIGIN` 값이 실제 사이트 주소와 다릅니다. 끝의 슬래시를 빼고, `https://` 를 포함해 정확히 적으세요. |
| `AI 응답 실패 (400)` | API 키가 잘못됐거나 만료됐습니다. 0단계부터 다시 발급받으세요. |
| `AI 응답 실패 (429)` | 무료 등급 한도(분당 15회)를 넘었습니다. 잠시 후 다시 시도하세요. |
| CORS 오류 | `ALLOWED_ORIGIN` 에 현재 접속 중인 주소가 들어 있는지 확인하세요. 로컬 테스트 중이라면 `http://localhost:8000` 도 추가해야 합니다. |

---

## 비용 관리

- Gemini 무료 등급만 쓰면 **요금이 청구되지 않습니다**. 한도를 넘으면 결제가 되는 게 아니라 요청이 거부됩니다.
- 유료로 전환하실 경우, Google Cloud 콘솔에서 **예산 알림(Budget alert)** 을 꼭 설정해 두세요.
- 중계 서버가 `ALLOWED_ORIGIN` 을 검사하므로, 다른 사이트에서 이 서버를 가져다 쓰는 것은 막혀 있습니다.

---

## AMF 커머스 인텔리전스(`/amf/`) 대화형 어시스턴트 연결

`/amf/` 앱에는 화면 상태(브리프·매칭 결과·캐스팅 보드·쇼 일정·세이프티 알림)를 읽고 답하는
대화형 어시스턴트(`amf/assistant.js`)가 들어 있습니다. 같은 중계 서버를 그대로 씁니다.

| 배포 방식 | 설정 |
|---|---|
| **Vercel** | 아무것도 안 해도 됩니다. 같은 도메인의 `/api/gemini` 가 자동으로 붙습니다. |
| **GitHub Pages** (서버 없음) | 방법 A로 워커를 만든 뒤 `amf/index.html` 상단의 `window.AMF_AI_CONFIG.ENDPOINT` 에 워커 주소를 적습니다. |

```html
<!-- amf/index.html 상단 -->
window.AMF_AI_CONFIG = window.AMF_AI_CONFIG || { ENDPOINT:'https://bhb-gemini.<계정>.workers.dev', MODEL:'gemini-flash-latest' };
```

- `ALLOWED_ORIGIN` 에는 `/amf/` 가 열리는 도메인이 들어 있어야 합니다 (`https://lg980305-blip.github.io`).
- 서버가 없거나 키가 없으면 앱은 "미연결" 상태가 되고, 상단 ✦ 버튼에서 사용자가 자기 브라우저에만 키를 넣어 쓸 수 있습니다.
  (공개 사이트라면 이 방식은 시연용으로만 쓰고, 운영은 반드시 서버 프록시로 하세요.)
- 기본 모델은 `gemini-flash-latest` 별칭입니다. 서버 환경변수 `GEMINI_MODEL` 로 바꿀 수 있습니다.
  `gemini-2.0-flash` / `gemini-2.5-flash` 는 2026년 중 종료 예정이므로 고정하지 마세요.

**어시스턴트가 하는 일 / 하지 않는 일**

- 순위·점수·예산 편성은 브라우저 안의 결정론 엔진이 계산합니다. AI 는 엔진이 넘겨준 수치만 근거로 설명·제안합니다.
- "예산을 3천만 원으로 줄이면?" 같은 가정 질문은 AI 가 추정하지 않습니다. AI 가 조건만 요청하면 엔진이 실제로 다시 계산해
  수치를 돌려주고, AI 는 그 수치로 답합니다.
- 자연어 조건("우즈벡 20대 여성 스킨케어, 인스타 5명, 예산 5천만")은 폼에 채워 주고, 매칭 실행은 사용자가 누릅니다(크레딧 차감).
- 로스터 인물의 신체 정보·연락처는 AI 에 보내지 않습니다.

**중계 서버 프로토콜(`/amf/` 전용)**

```
GET  /api/gemini                              → { "serverKey": true, "defaultModel": "gemini-flash-latest" }
POST { "action": "models" }                   → Gemini ListModels 응답 그대로
POST { "action": "generate", "model": "gemini-flash-latest",
       "payload": { "contents": [...], "systemInstruction": {...}, "generationConfig": {...} } }
                                              → Gemini generateContent 응답 그대로
```

서버는 `contents` · `systemInstruction` · `generationConfig`(온도 · 최대 토큰 · JSON 스키마)만 통과시키고,
대화 40턴 · 본문 200KB · 출력 4,096토큰 상한과 안전 설정을 강제합니다.

---

## TOPIK ASIA 안드로이드 앱(`apk/`) 연결

앱은 시작할 때 `https://lg980305-blip.github.io/apk/config.json` 의 `endpoint` 를 읽어
그 중계 서버로 AI 요청을 보냅니다. 사용자는 키를 몰라도 되고, 키는 서버 환경변수에만 있습니다.

| 할 일 | 방법 |
|---|---|
| 서버 만들기 | 위 **방법 B(Vercel)** 그대로. 환경변수는 `GEMINI_API_KEY` 하나면 앱은 동작합니다. |
| 주소 연결 | Vercel 주소가 `https://lg980305-blip-github-io.vercel.app` 이면 할 일 없음. 다르면 `apk/config.json` 의 `endpoint` 만 고쳐 커밋 (APK 재빌드 불필요). |
| 확인 | 브라우저에서 `<endpoint>` 를 열어 `{"serverKey":true,...}` 가 보이면 됨. |

- 앱(WebView)의 요청은 `Origin: null` 로 오며, `X-Topik-App: kr.topikasia.app` 헤더가 있을 때만 통과합니다.
  이 값은 비밀이 아니므로(APK 를 풀면 보임) 실제 보호는 Google AI Studio 의 **할당량·예산 알림** 설정입니다.
- 앱의 발음 평가·사진 인식을 위해 서버는 `audio/*`·`image/*` 첨부(inlineData, 4MB 이하)를 통과시킵니다.
- `endpoint` 가 빈 문자열이면 앱은 사용자 본인 키를 물어보는 개발자 테스트 모드로 동작합니다.
