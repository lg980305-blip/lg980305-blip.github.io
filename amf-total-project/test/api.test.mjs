import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@libsql/client'; try{ fs.unlinkSync(new URL('./test.db', import.meta.url)); }catch{}
/* 배포 전 검증 — 실제 핸들러를 로컬 libSQL 파일 DB 로 호출한다 (Turso 와 같은 클라이언트) */
process.env.TURSO_DATABASE_URL = 'file:./test/test.db';
process.env.TURSO_AUTH_TOKEN   = '';
process.env.EVENTS_WRITE_KEY   = 'test-key-123';

const events    = (await import('../api/events.mjs')).default;
const list      = (await import('../api/campaigns/index.mjs')).default;
const one       = (await import('../api/campaigns/[id].mjs')).default;
const drift     = (await import('../api/analytics/drift.mjs')).default;

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

console.log('── 재매칭 시 status — 목록과 단일 조회가 같은 뜻이어야 한다 ──');
const CID2 = 'CAMP-2026-1012-02';
for (const [step,actor,payload] of [['1_brief','박채빈',{}],['3_selection','박채빈',{projected_roas:3.1}],['2_match','engine',{recommended:[]}]]){
  const {req,res}=mock('POST',{headers:KEY,body:{campaign_id:CID2,step,actor,payload}}); await events(req,res); ok(res._s===201,`${step} → 201`);
}
{ const {req,res}=mock('GET'); await list(req,res);
  ok(res._b.length===2 && res._b[0].campaign_id===CID2,'목록: 2건 · 최근 활동 캠페인이 먼저');
  ok(res._b[0].status==='2_match' && res._b[0].steps===3,'목록 status = 가장 최근 이벤트 단계 (2_match)'); }
{ const {req,res}=mock('GET',{query:{id:CID2}}); await one(req,res); ok(res._b.status==='2_match','단일 조회 status 도 2_match — 목록과 일치'); }

console.log('── 본문이 문자열로 올 때 (Content-Type 누락) ──');
{ const {req,res}=mock('POST',{headers:KEY,body:JSON.stringify({campaign_id:CID2,step:'4_contract',actor:'박채빈',payload:{amount:1}})}); await events(req,res); ok(res._s===201,'문자열 JSON 본문도 201'); }
{ const {req,res}=mock('POST',{headers:KEY,body:'{not json'}); await events(req,res); ok(res._s===400,'깨진 문자열 본문은 400'); }

console.log('── 멱등 키 (같은 요청 재전송) ──');
{ const H={...KEY,'x-idempotency-key':'idem-abc-1'};
  const a=mock('POST',{headers:H,body:{campaign_id:CID2,step:'5_settle',actor:'박채빈',payload:{actual_roas:2.5,actual_reach:1500000,tax_invoice_no:'T-1'}}}); await events(a.req,a.res);
  const b=mock('POST',{headers:H,body:{campaign_id:CID2,step:'5_settle',actor:'박채빈',payload:{actual_roas:2.5,actual_reach:1500000,tax_invoice_no:'T-1'}}}); await events(b.req,b.res);
  ok(a.res._s===201 && b.res._s===200 && b.res._b.id===a.res._b.id && b.res._b.idempotent===true,'첫 요청 201, 같은 키 재전송 200 + 같은 id + idempotent');
  const {req,res}=mock('GET',{query:{id:CID2}}); await one(req,res);
  ok(res._b.timeline.filter(t=>t.step==='5_settle').length===1,'5_settle 은 한 번만 기록됨'); }

console.log('── 예측 대 실측 (3_selection ↔ 5_settle) ──');
{ const {req,res}=mock('GET',{query:{id:CID2}}); await one(req,res); const v=res._b.variance;
  ok(v && v.projected_roas===3.1 && v.actual_roas===2.5 && v.roas_delta===-0.6 && v.roas_error_pct===19.35 && v.bias==='over_predicted','variance: 3.1 → 2.5, delta -0.6, 오차 19.35%, 과대 예측');
  ok(v.reach_error_pct==null,'도달 예측이 없으면 reach 항목 없음');
  ok(res._b.timeline[0].payload_json===undefined,'raw 없이 호출하면 payload_json 없음'); }
{ const {req,res}=mock('GET',{query:{id:CID}}); await one(req,res); ok(res._b.variance===null,'5_settle 없는 캠페인은 variance null'); }
{ const {req,res}=mock('GET',{query:{id:CID2,raw:'1'}}); await one(req,res); const t=res._b.timeline[1];
  const { createHash } = await import('node:crypto');
  const recomputed = createHash('sha256').update(JSON.stringify([t.prev_hash,CID2,t.step,t.actor,t.payload_json,t.created_at])).digest('hex');
  ok(typeof t.payload_json==='string' && recomputed===t.event_hash,'?raw=1 의 payload_json 으로 바깥에서 해시를 다시 계산하면 저장값과 같음 (감사 페이지가 하는 일)'); }
{ const {req,res}=mock('GET'); await drift(req,res);
  ok(res._s===200 && res._b.settled===1 && res._b.by_model.length===1 && res._b.by_model[0].settled_campaigns===1 && res._b.by_model[0].mean_roas_error_pct===19.35 && res._b.by_model[0].over_predicted===1,'drift 집계: 정산 1건 · MAPE 19.35% · 과대 1'); }

console.log('── 해시 체인 ──');
{ const {req,res}=mock('GET',{query:{id:CID}}); await one(req,res); const t=res._b.timeline, a=res._b.audit;
  ok(a && a.verified===true && a.blocks===3 && a.broken_at===null,'검증 verified · blocks=3 · broken_at=null');
  ok(t[0].prev_hash==='0'.repeat(64) && t[1].prev_hash===t[0].event_hash && t[2].prev_hash===t[1].event_hash,'prev_hash 가 앞 이벤트의 event_hash 를 가리킴');
  ok(a.chain_head===t[2].event_hash && /^[0-9a-f]{64}$/.test(a.chain_head),'chain_head = 마지막 event_hash (SHA-256 hex)'); }
{ const {req,res}=mock('GET'); await list(req,res); ok(res._b.every(r=>/^[0-9a-f]{64}$/.test(r.chain_head)),'목록 각 행에 chain_head'); }
const raw = createClient({ url: process.env.TURSO_DATABASE_URL });
{ await raw.execute({ sql:`UPDATE events SET payload = ? WHERE campaign_id = ? AND step = '3_selection'`, args:[JSON.stringify({selected:['AMF-CR-0001'],projected_roas:9.9}), CID] });
  const {req,res}=mock('GET',{query:{id:CID}}); await one(req,res);
  ok(res._b.audit.verified===false && res._b.audit.broken_at===3,'DB 에서 payload 를 직접 고치면 verified=false · broken_at=3'); }
{ let blocked=false;
  try { await raw.execute({ sql:`INSERT INTO events (campaign_id,step,actor,payload,prev_hash,event_hash,created_at) VALUES (?,?,?,?,?,?,?)`, args:[CID,'2_match','x','{}','0'.repeat(64),'f'.repeat(64),'2026-01-01T00:00:00.000Z'] }); }
  catch(e){ blocked=/UNIQUE constraint failed/.test(String(e.message)); }
  ok(blocked,'이미 쓰인 prev_hash 로 끼워 넣기는 UNIQUE 로 차단 (동시 기록 갈라짐 방지)'); }

console.log('── 옛 스키마(해시 열 없음) 마이그레이션 ──');
{ const OLD=new URL('./test_old.db', import.meta.url); try{ fs.unlinkSync(OLD); }catch{}
  const old = createClient({ url: 'file:'+OLD.pathname });
  await old.execute(`CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id TEXT NOT NULL, step TEXT NOT NULL, actor TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  for (const s of ['1_brief','2_match']) await old.execute({ sql:`INSERT INTO events (campaign_id,step,actor,payload) VALUES (?,?,?,?)`, args:['OLD-1',s,'x','{}'] });
  old.close();
  const r = spawnSync(process.execPath, [new URL('./migrate.child.mjs', import.meta.url).pathname], { env:{...process.env, TURSO_DATABASE_URL:'file:'+OLD.pathname}, encoding:'utf8' });
  let out=null; try{ out=JSON.parse(r.stdout); }catch{}
  ok(r.status===0 && out && out.audit.verified===true && out.audit.blocks===2 && out.timeline[0].prev_hash==='0'.repeat(64) && out.second_status===200,'열 추가 + 기존 2행 체인 채움 → verified · 동시 요청 2개 모두 200 (새 프로세스)');
  if(!out) console.log(r.stdout, r.stderr); }

console.log('── 영속성 (재기동 흉내) ──');
{ const fresh = (await import('../api/campaigns/[id].mjs?fresh='+Date.now())).default;
  const {req,res}=mock('GET',{query:{id:CID}}); await fresh(req,res);
  ok(res._b.timeline.length===3,'새 인스턴스에서도 3개 그대로 (파일 DB 유지)'); }

console.log('\n'+(fail?`❌ 실패 ${fail}건`:'✅ 전체 통과'));
process.exit(fail?1:0);
