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
