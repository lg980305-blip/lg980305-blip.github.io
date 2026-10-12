# AMF 커머스 인텔리전스 — 거래 로그 API + 시뮬레이터

거래 한 건이 플랫폼을 거치는 다섯 단계(1_brief → 2_match → 3_selection → 4_contract → 5_settle)를
**추가만 가능한(append-only)** 로그로 남긴다. Vercel 서버리스 함수 + Turso(libSQL).

```
amf-total-project/
 ├── package.json
 ├── .env.example          ← 복사해서 .env 로. .env 는 커밋 금지
 ├── dev.mjs               ← 로컬 개발 서버 (npm run dev)
 ├── test/api.test.mjs     ← 핸들러 검증 (npm test)
 ├── api/
 │    ├── _db.mjs          DB 연결 · 테이블 보장 · CORS · 쓰기 키 검사
 │    ├── events.mjs       POST /api/events            (X-AMF-Key 필수)
 │    ├── gemini.mjs       POST /api/gemini            (Gemini 중계)
 │    └── campaigns/
 │         ├── index.mjs   GET  /api/campaigns         (캠페인별 요약)
 │         └── [id].mjs    GET  /api/campaigns/:id     (타임라인)
 └── public/
      └── index.html       1~3단계 시뮬레이터
```

## 로컬에서 돌리기

```bash
npm install
npm test                                   # 핸들러 검증 (파일 DB)
TURSO_DATABASE_URL=file:./dev.db EVENTS_WRITE_KEY=dev-key npm run dev
# → http://localhost:3000  버튼 클릭 → 쓰기 키 물으면 dev-key 입력
```

## Vercel 배포

1. Turso 가입 → DB 생성 → URL · 토큰 복사
2. Vercel 프로젝트 → Settings → Environment Variables
   `TURSO_DATABASE_URL` · `TURSO_AUTH_TOKEN` · `EVENTS_WRITE_KEY`(긴 난수) · `GEMINI_API_KEY`(선택)
   `ALLOWED_ORIGIN` 은 프론트가 다른 도메인일 때만. 이 폴더의 public/ 을 같이 서빙하면 비워 둔다.
3. 이 폴더를 Vercel 프로젝트 루트(Root Directory)로 지정하고 배포

## 쓰기 키를 어디에 두는가

- 서버: 환경변수 `EVENTS_WRITE_KEY` 하나.
- 브라우저: **페이지 소스에 적지 않는다.** 처음 실행할 때 한 번 묻고 `sessionStorage` 에만 둔다(탭 닫으면 사라짐).
- 키 없이 또는 틀린 키로 POST 하면 401. 읽기(GET)는 열려 있다.
- 브라우저 호출 없이 서버 간 호출만 할 거면 curl 로 헤더에 넣어 보내면 된다.

## 확인용 curl

```bash
curl -X POST https://<프로젝트>.vercel.app/api/events \
  -H "Content-Type: application/json" -H "X-AMF-Key: <EVENTS_WRITE_KEY>" \
  -d '{"campaign_id":"CAMP-2026-1012-01","step":"1_brief","actor":"박채빈","payload":{"brand":"테스트","budget":20000000}}'
curl https://<프로젝트>.vercel.app/api/campaigns/CAMP-2026-1012-01
```
