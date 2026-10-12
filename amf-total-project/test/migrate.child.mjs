/* 마이그레이션 테스트용 — 새 프로세스에서 옛 DB 를 열어 한 캠페인을 조회해 JSON 으로 출력 */
const one = (await import('../api/campaigns/[id].mjs')).default;
const res = { _s:200, status(c){ this._s=c; return this; }, setHeader(){}, json(b){ console.log(JSON.stringify(b)); return this; }, end(){} };
await one({ method:'GET', headers:{}, query:{ id:'OLD-1' }, body:undefined }, res);
process.exit(res._s===200?0:1);
