# AMF 커머스 인텔리전스 — 거래 로그 API + 시뮬레이터

거래 한 건이 플랫폼을 거치는 다섯 단계(1_brief → 2_match → 3_selection → 4_contract → 5_settle)를
**추가만 가능한(append-only)** 로그로 남긴다. Vercel 서버리스 함수 + Turso(libSQL).

```
amf-total-project/
 ├── package.json
 ├── .env.example          ← 복사해서 .env 로. .env 는 커밋 금지
 ├── .vercelignore         ← 로컬 전용 파일은 배포에서 제외
 ├── dev.mjs               ← 로컬 개발 서버 (npm run dev)
 ├── test/api.test.mjs     ← 핸들러 검증 (npm test) · migrate.child.mjs 는 그 보조
 ├── api/
 │    ├── _db.mjs          DB 연결 · 테이블 보장(마이그레이션 포함) · 해시 · 예측대실측 · CORS · 쓰기 키
 │    ├── events.mjs       POST /api/events            (X-AMF-Key 필수 · X-Idempotency-Key 선택)
 │    ├── gemini.mjs       POST /api/gemini            (Gemini 중계)
 │    ├── campaigns/
 │    │    ├── index.mjs   GET  /api/campaigns         (캠페인별 요약 · chain_head)
 │    │    └── [id].mjs    GET  /api/campaigns/:id     (타임라인 · 체인 검증 · variance · ?raw=1)
 │    └── analytics/
 │         └── drift.mjs   GET  /api/analytics/drift   (정산 캠페인의 예측 대 실측 집계)
 └── public/
      ├── index.html       1~3단계 시뮬레이터
      └── verify.html      감사 검증 페이지 — 브라우저가 해시 체인을 직접 다시 계산
```

## 기록이 어떻게 보호되는가

- **추가만 가능** — 수정·삭제 경로가 없다 (PUT/DELETE 405).
- **해시 체인** — 각 이벤트는 `prev_hash`(앞 이벤트의 해시)를 물고 SHA-256 `event_hash` 를 가진다.
  행 하나라도 바뀌면 그 뒤 검증이 깨진다. 같은 `(campaign_id, prev_hash)` 는 하나뿐이라 동시 기록이 체인을 가르지 못한다.
- **독립 재검증** — `verify.html` 은 서버의 "맞다"를 믿지 않고 받은 데이터로 브라우저에서 다시 계산한다.
- **체인 머리를 바깥에 적어 둔다** — 제출 서류에 `chain_head` 를 쓰면, 제출 이후 변경 여부를 누구나 확인할 수 있다.
  DB 토큰을 가진 사람이 체인을 통째로 다시 쓰는 것은 이 체인만으로는 못 막는다. 바깥에 적힌 머리와 비교해야 드러난다.
- **멱등 키** — 같은 `X-Idempotency-Key` 로 재전송되면 한 번만 기록하고 같은 행을 돌려준다.
- **예측 대 실측** — `3_selection` 의 `projected_roas`/`projected_reach` 와 `5_settle` 의 `actual_*` 를 읽을 때 비교한다.
  별도 지표 테이블에 저장하지 않는다 — 원장과 어긋날 수 없게.

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

## 시뮬레이터가 만드는 기록은 TEST-, 실제 거래는 CAMP-

같은 DB 에 있어도 접두어로 구분한다. 기보 제출 증빙은 CAMP- 기록과 세금계산서·계약서를 함께 낸다.

## 확인용 curl

```bash
curl -X POST https://<프로젝트>.vercel.app/api/events \
  -H "Content-Type: application/json" -H "X-AMF-Key: <EVENTS_WRITE_KEY>" \
  -d '{"campaign_id":"CAMP-2026-1012-01","step":"1_brief","actor":"박채빈","payload":{"brand":"테스트","budget":20000000}}'
curl https://<프로젝트>.vercel.app/api/campaigns/CAMP-2026-1012-01
curl https://<프로젝트>.vercel.app/api/analytics/drift
# 감사 검증 페이지: https://<프로젝트>.vercel.app/verify.html?id=CAMP-2026-1012-01
```

## 저장소 맨 위에서도 돌아간다 (Vercel 프로젝트가 루트를 볼 때)

루트의 `api/events.mjs` · `api/campaigns/*.mjs` · `api/analytics/drift.mjs` 는 이 폴더의 핸들러를 그대로 내보내고,
루트 `package.json` 이 `@libsql/client` 를 제공한다. 페이지는 `/ledger/` 와 `/ledger/verify.html` 에 복사본이 있다.
원본을 고칠 때는 이 폴더를 고치고, `ledger/` 의 두 HTML 은 `public/` 에서 다시 복사한다.
