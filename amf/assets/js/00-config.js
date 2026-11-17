/* Gemini 중계 서버 주소.
   · Vercel 배포: 같은 도메인의 /api/gemini 가 자동으로 붙는다 (기본값).
   · GitHub Pages: 서버가 없으므로 Cloudflare Worker 주소를 적는다.
     예) ENDPOINT:'https://bhb-gemini.<계정>.workers.dev'
   API 키는 절대 여기에 넣지 않는다 — 서버 환경변수에만 둔다. */
window.AMF_AI_CONFIG = window.AMF_AI_CONFIG || { ENDPOINT:'https://amf-gemini.amf-gemini.workers.dev', MODEL:'gemini-flash-lite-latest' };
