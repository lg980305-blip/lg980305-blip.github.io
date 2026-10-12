import fs from 'node:fs'; try{ fs.unlinkSync(new URL('./test.db', import.meta.url)); }catch{}
/* 배포 전 검증 — 실제 핸들러를 로컬 libSQL 파일 DB 로 호출한다 (Turso 와 같은 클라이언트) */
process.env.TURSO_DATABASE_URL = 'file:./test/test.db';
process.env.TURSO_AUTH_TOKEN   = '';
process.env.EVENTS_WRITE_KEY   = 'test-key-123';

const events    = (await import('../api/events.mjs')).default;
const list      = (await import('../api/campaigns/index.mjs')).default;
const one       = (await import('../api/campaigns/[id].mjs')).default;

function mock(method, { body, query, headers } = {}) {
  const res = { _s: 200, _h: {}, _b: null,
    status(c){ this._s=c; return this; }, setHeader(k,v){ this._h[k]=v; },
    json(b){ this._b=b; return this; }, end(){ return this; } };
  const req = { method, body, query: query||{}, headers: headers||{} };
  return { req, res };
}
const KEY = { 'content-type':'application/json', 'x-amf-key':'test-key-123' };
let fail = 0; const ok = (c,m) => { console.log((c?'  ✅ ':'  ❌ ')+m); if(!c) fail++; };
const CID = 'CAMP-2026-1012-01';

console.log('── 쓰기 보호 ──');
{ const {req,res}=mock('POST',{body:{campaign_id:CID,step:'1_brief',actor:'x',payload:{}}}); await events(req,res); ok(res._s===401,'키 없으면 401'); }
{ const {req,res}=mock('POST',{headers:{...KEY,'x-amf-key':'wrong'},body:{campaign_id:CID,step:'1_brief',actor:'x',payload:{}}}); await events(req,res); ok(res._s===401,'키 틀리면 401'); }
{ const {req,res}=mock('PUT',{headers:KEY}); await events(req,res); ok(res._s===405,'PUT 은 405 (append-only)'); }
{ const {req,res}=mock('DELETE',{headers:KEY}); await events(req,res); ok(res._s===405,'DELETE 는 405'); }

console.log('── 검증 ──');
{ const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID,step:'6_bogus',actor:'x',payload:{}}}); await events(req,res); ok(res._s===400,'잘못된 step 은 400'); }
{ const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID,step:'1_brief',actor:'',payload:{}}}); await events(req,res); ok(res._s===400,'actor 비면 400'); }
{ const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID,step:'1_brief',actor:'x',payload:[1]}}); await events(req,res); ok(res._s===400,'payload 배열이면 400'); }
{ const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID,step:'1_brief',actor:'x',payload:{blob:'x'.repeat(70*1024)}}}); await events(req,res); ok(res._s===413,'payload 64KB 넘으면 413'); }

console.log('── 시나리오 1·2·3 ──');
const steps = [
 ['1_brief','박채빈',{brand:'테스트브랜드',category:'beauty_skin',budget:20000000,target_country:'UZ'}],
 ['2_match','engine',{recommended:[{id:'AMF-CR-0001',score:92},{id:'AMF-CR-0002',score:85}]}],
 ['3_selection','박채빈',{selected:['AMF-CR-0001','AMF-CR-0002'],projected_roas:4.2,projected_reach:1800000}],
];
for (const [step,actor,payload] of steps){
  const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID,step,actor,payload}});
  await events(req,res);
  ok(res._s===201 && res._b.step===step && typeof res._b.id==='number' && res._b.created_at, `${step} → 201 · id=${res._b?.id} · ${res._b?.created_at}`);
}

console.log('── 조회 ──');
{ const {req,res}=mock('GET',{query:{id:CID}}); await one(req,res);
  ok(res._s===200,'단일 캠페인 200');
  ok(res._b.timeline.length===3,'timeline 3개');
  ok(res._b.timeline.map(t=>t.step).join(',')==='1_brief,2_match,3_selection','순서 1→2→3');
  ok(res._b.status==='3_selection','status = 마지막 step');
  ok(res._b.timeline[2].payload.projected_roas===4.2,'payload 가 객체로 복원됨');
  console.log('\n'+JSON.stringify(res._b,null,2).split('\n').map(l=>'     '+l).join('\n')+'\n'); }
{ const {req,res}=mock('GET',{query:{id:'NOPE'}}); await one(req,res); ok(res._s===404,'없는 캠페인 404'); }
{ const {req,res}=mock('GET'); await list(req,res);
  ok(res._s===200 && res._b.length===1 && res._b[0].steps===3 && res._b[0].status==='3_selection','목록: 1건 · 3단계 · status 맞음'); }

console.log('── 영속성 (재기동 흉내) ──');
{ const fresh = (await import('../api/campaigns/[id].mjs?fresh='+Date.now())).default;
  const {req,res}=mock('GET',{query:{id:CID}}); await fresh(req,res);
  ok(res._b.timeline.length===3,'새 인스턴스에서도 3개 그대로 (파일 DB 유지)'); }

console.log('\n'+(fail?`❌ 실패 ${fail}건`:'✅ 전체 통과'));
process.exit(fail?1:0);
