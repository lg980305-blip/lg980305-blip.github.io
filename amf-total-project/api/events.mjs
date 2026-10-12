/* POST /api/events — 거래 단계 기록 (append-only)
   body: { campaign_id, step, actor, payload }   header: X-AMF-Key */
import { getDb, ensureTable, cors, reqWriteKey, STEPS } from './_db.mjs';

const MAX_PAYLOAD = 64 * 1024;   /* 한 단계 기록 상한. 증거 로그에 파일을 넣는 용도가 아니다 */

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

  try {
    const db = getDb();
    await ensureTable(db);
    const ins = await db.execute({
      sql: `INSERT INTO events (campaign_id, step, actor, payload) VALUES (?, ?, ?, ?)`,
      args: [campaign_id.trim(), step, actor.trim(), json],
    });
    const id = Number(ins.lastInsertRowid);
    const row = await db.execute({
      sql: `SELECT id, campaign_id, step, actor, created_at FROM events WHERE id = ?`,
      args: [id],
    });
    return res.status(201).json(row.rows[0]);
  } catch (err) {
    console.error('[events] insert', err);
    return res.status(500).json({ error: 'db error' });
  }
}
