import { createClient as createWebClient } from '@libsql/client/web';
import { createHash } from 'node:crypto';

export const STEPS = ['1_brief', '2_match', '3_selection', '4_contract', '5_settle'];
export const GENESIS = '0'.repeat(64);   /* 캠페인 첫 이벤트의 prev_hash */

let client = null;
/* Turso(libsql://)는 fetch 만 쓰는 web 클라이언트로 — 서버리스에서 네이티브 모듈이 필요 없다.
   로컬 파일 DB(file:)는 테스트·개발 전용이라 그때만 node 클라이언트를 불러온다. */
export async function getDb() {
  if (!client) {
    const url = (process.env.TURSO_DATABASE_URL || '').trim();
    const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim();
    if (!url) throw new Error('TURSO_DATABASE_URL not configured');
    if (url.startsWith('file:')) {
      const { createClient } = await import('@libsql/client');
      client = createClient({ url });
    } else {
      if (!authToken) throw new Error('TURSO_AUTH_TOKEN not configured');
      client = createWebClient({ url, authToken });
    }
  }
  return client;
}

/* 500 응답에 넣는 짧은 원인 — 토큰처럼 보이는 문자열은 지운다 */
export function errDetail(err) {
  return String(err && err.message || err).replace(/eyJ[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_.-]*/g, '<token>').slice(0, 160);
}

/* 이벤트 해시 — 저장된 문자열을 그대로 JSON 배열로 직렬화해 SHA-256.
   구분자 충돌이 없고, 나중에 같은 행을 읽어 다시 계산하면 같은 값이 나온다.
   prev_hash 가 앞 이벤트의 event_hash 를 가리키므로, 한 행이라도 바뀌면
   그 뒤 체인 전체의 검증이 깨진다. (DB 토큰을 가진 사람이 체인을 통째로
   다시 쓰는 것까지 막지는 못한다 — 그래서 chain_head 를 바깥에 적어 둔다) */
export function eventHash(e) {
  return createHash('sha256')
    .update(JSON.stringify([e.prev_hash, e.campaign_id, e.step, e.actor, e.payload, e.created_at]))
    .digest('hex');
}

let ready = false, initPromise = null;
/* 한 인스턴스에 요청이 동시에 들어와도 초기화(DDL · 마이그레이션)는 한 번만 돈다.
   실패하면 다음 요청이 다시 시도할 수 있게 잠금을 푼다. */
export function ensureTable(db) {
  if (ready) return Promise.resolve();
  if (!initPromise) {
    initPromise = initTable(db).catch(err => { initPromise = null; throw err; });
  }
  return initPromise;
}
async function initTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      step        TEXT NOT NULL CHECK (step IN ('1_brief','2_match','3_selection','4_contract','5_settle')),
      actor       TEXT NOT NULL,
      payload     TEXT NOT NULL,
      prev_hash   TEXT NOT NULL DEFAULT '',
      event_hash  TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
  await migrateChain(db);
  /* 같은 요청이 재전송돼도 한 번만 기록 — 키는 호출자가 만든다 (X-Idempotency-Key) */
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS ux_events_idem ON events(idempotency_key)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS ix_events_campaign ON events(campaign_id, id)`);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS ux_events_hash ON events(event_hash)`);
  /* 같은 캠페인에서 같은 prev_hash 를 가진 이벤트는 하나뿐 —
     동시에 들어온 두 기록이 체인을 갈라놓지 못한다 (events.mjs 가 재시도) */
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS ux_events_chain ON events(campaign_id, prev_hash)`);
  ready = true;
}

/* 해시 열이 없는 옛 테이블이면 열을 붙이고, 비어 있는 행을 캠페인별 id 순서로 체인에 넣는다 */
async function migrateChain(db) {
  const cols = (await db.execute(`PRAGMA table_info(events)`)).rows.map(r => String(r.name));
  if (!cols.includes('prev_hash'))  await db.execute(`ALTER TABLE events ADD COLUMN prev_hash TEXT NOT NULL DEFAULT ''`);
  if (!cols.includes('event_hash')) await db.execute(`ALTER TABLE events ADD COLUMN event_hash TEXT NOT NULL DEFAULT ''`);
  if (!cols.includes('idempotency_key')) await db.execute(`ALTER TABLE events ADD COLUMN idempotency_key TEXT`);
  const empty = await db.execute(`SELECT COUNT(*) AS n FROM events WHERE event_hash = ''`);
  if (Number(empty.rows[0].n) === 0) return;
  const rows = (await db.execute(`SELECT id, campaign_id, step, actor, payload, created_at FROM events ORDER BY campaign_id, id`)).rows;
  const heads = new Map(), stmts = [];
  for (const r of rows) {
    const e = { prev_hash: heads.get(String(r.campaign_id)) || GENESIS, campaign_id: String(r.campaign_id),
                step: String(r.step), actor: String(r.actor), payload: String(r.payload), created_at: String(r.created_at) };
    const h = eventHash(e);
    heads.set(e.campaign_id, h);
    stmts.push({ sql: `UPDATE events SET prev_hash = ?, event_hash = ? WHERE id = ?`, args: [e.prev_hash, h, Number(r.id)] });
  }
  await db.batch(stmts, 'write');
}

/* 3_selection 의 예측치와 5_settle 의 실측치를 나란히 — "엔진이 맞았나"의 숫자.
   장부에서 읽을 때 계산한다. 따로 저장하면 원장과 어긋날 수 있다. */
export function variance(sel, set) {
  if (!sel || !set) return null;
  const pr = Number(sel.projected_roas), ar = Number(set.actual_roas);
  if (!(pr > 0) || !Number.isFinite(ar)) return null;
  const d = ar - pr;
  const out = {
    model_version: String(sel.model_version || set.model_version || '') || null,
    projected_roas: pr, actual_roas: ar,
    roas_delta: Number(d.toFixed(4)),
    roas_error_pct: Number((Math.abs(d) / pr * 100).toFixed(2)),
    bias: d < 0 ? 'over_predicted' : d > 0 ? 'under_predicted' : 'exact',
  };
  const prr = Number(sel.projected_reach), arr = Number(set.actual_reach);
  if (prr > 0 && Number.isFinite(arr)) {
    out.projected_reach = prr; out.actual_reach = arr;
    out.reach_error_pct = Number((Math.abs(arr - prr) / prr * 100).toFixed(2));
  }
  return out;
}

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMF-Key, X-Idempotency-Key');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function reqWriteKey(req, res) {
  const key = process.env.EVENTS_WRITE_KEY;
  if (!key) { res.status(500).json({ error: 'EVENTS_WRITE_KEY not configured' }); return false; }
  if (req.headers['x-amf-key'] !== key) { res.status(401).json({ error: 'unauthorized' }); return false; }
  return true;
}
