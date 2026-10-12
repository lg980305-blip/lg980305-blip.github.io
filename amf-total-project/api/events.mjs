/* POST /api/events — 거래 단계 기록 (append-only · 해시 체인)
   body: { campaign_id, step, actor, payload }
   header: X-AMF-Key (필수) · X-Idempotency-Key (선택, 재전송 시 같은 키면 한 번만 기록) */
import { getDb, ensureTable, cors, reqWriteKey, eventHash, STEPS, GENESIS } from './_db.mjs';

const MAX_PAYLOAD = 64 * 1024;   /* 한 단계 기록 상한. 증거 로그에 파일을 넣는 용도가 아니다 */
const RETRIES = 3;               /* 같은 순간 다른 기록이 먼저 들어왔을 때 다시 잇는 횟수 */
const SELECT_ROW = `SELECT id, campaign_id, step, actor, prev_hash, event_hash, created_at FROM events`;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!reqWriteKey(req, res)) return;

  /* Vercel 은 Content-Type 이 application/json 일 때만 본문을 객체로 준다.
     헤더가 빠진 호출(문자열·Buffer)도 받아 준다. */
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'malformed json body' }); }
  }
  const { campaign_id, step, actor, payload } = body || {};
  if (typeof campaign_id !== 'string' || !campaign_id.trim() ||
      typeof actor !== 'string' || !actor.trim() ||
      !STEPS.includes(step) ||
      typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return res.status(400).json({ error: 'invalid body', expect: { campaign_id: 'string', step: STEPS, actor: 'string', payload: 'object' } });
  }
  const json = JSON.stringify(payload);
  if (json.length > MAX_PAYLOAD) {
    return res.status(413).json({ error: `payload too large (max ${MAX_PAYLOAD} chars)` });
  }
  const idem = String(req.headers['x-idempotency-key'] || '').trim().slice(0, 128) || null;

  try {
    const db = getDb();
    await ensureTable(db);
    const cid = campaign_id.trim(), who = actor.trim();

    /* 같은 키로 이미 기록됐으면 그 행을 돌려주고 끝 (재전송 = 중복 기록 아님) */
    if (idem) {
      const dup = await db.execute({ sql: `${SELECT_ROW} WHERE idempotency_key = ?`, args: [idem] });
      if (dup.rows.length) return res.status(200).json({ ...dup.rows[0], idempotent: true });
    }

    for (let attempt = 0; attempt < RETRIES; attempt++) {
      /* 1. 이 캠페인의 마지막 이벤트 해시를 읽어 */
      const last = await db.execute({
        sql: `SELECT event_hash FROM events WHERE campaign_id = ? ORDER BY id DESC LIMIT 1`,
        args: [cid],
      });
      const e = {
        prev_hash: last.rows.length ? String(last.rows[0].event_hash) : GENESIS,
        campaign_id: cid, step, actor: who, payload: json,
        created_at: new Date().toISOString(),
      };
      /* 2. 그 해시를 물고 이번 이벤트의 해시를 만든 뒤 */
      const hash = eventHash(e);
      try {
        /* 3. 저장. prev_hash 가 이미 쓰였으면 UNIQUE 로 거부되고 다시 읽는다 */
        const ins = await db.execute({
          sql: `INSERT INTO events (campaign_id, step, actor, payload, prev_hash, event_hash, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [cid, step, who, json, e.prev_hash, hash, idem, e.created_at],
        });
        const id = Number(ins.lastInsertRowid);
        const row = await db.execute({ sql: `${SELECT_ROW} WHERE id = ?`, args: [id] });
        return res.status(201).json(row.rows[0]);
      } catch (err) {
        const msg = String(err.message);
        /* 같은 키의 요청이 동시에 두 번 들어온 경우 — 먼저 들어간 행을 돌려준다 */
        if (idem && /UNIQUE constraint failed: events\.idempotency_key/.test(msg)) {
          const dup = await db.execute({ sql: `${SELECT_ROW} WHERE idempotency_key = ?`, args: [idem] });
          if (dup.rows.length) return res.status(200).json({ ...dup.rows[0], idempotent: true });
        }
        if (!/UNIQUE constraint failed: events\.campaign_id, events\.prev_hash/.test(msg)) throw err;
      }
    }
    return res.status(409).json({ error: 'concurrent write, retry' });
  } catch (err) {
    console.error('[events] insert', err);
    return res.status(500).json({ error: 'db error' });
  }
}
