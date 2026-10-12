/* 마이그레이션 테스트용 — 새 프로세스에서 옛 DB 를 열어, 같은 인스턴스에 요청 두 개가 동시에 들어온 상황을
   흉내낸다 (ensureTable 이 두 번 겹쳐 돌면 ALTER 가 두 번 실행돼 한쪽이 "duplicate column" 으로 500).
   첫 응답을 JSON 으로 출력하고, 둘 다 200 이 아니면 비정상 종료. */
const one = (await import('../api/campaigns/[id].mjs')).default;
const mk = () => ({ _s: 200, _b: null, status(c) { this._s = c; return this; }, setHeader() {}, json(b) { this._b = b; return this; }, end() {} });
const a = mk(), b = mk();
await Promise.all([
  one({ method: 'GET', headers: {}, query: { id: 'OLD-1' } }, a),
  one({ method: 'GET', headers: {}, query: { id: 'OLD-1' } }, b),
]);
console.log(JSON.stringify({ ...a._b, second_status: b._s }));
process.exit(a._s === 200 && b._s === 200 ? 0 : 1);
