/* POST /api/events — 거래 단계 기록 (append-only)
   body: { campaign_id, step, actor, payload }   header: X-AMF-Key */
import { getDb, ensureTable, cors, reqWriteKey, STEPS } from './_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!reqWriteKey(req, res)) return;

  const { campaign_id, step, actor, payload } = req.body || {};
  if (typeof campaign_id !== 'string' || !campaign_id.trim() ||
      typeof actor !== 'string' || !actor.trim() ||
      !STEPS.includes(step) ||
      typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return res.status(400).json({ error: 'invalid body' });
  }

  try {
    const db = getDb();
    await ensureTable(db);
    const ins = await db.execute({
      sql: `INSERT INTO events (campaign_id, step, actor, payload) VALUES (?, ?, ?, ?)`,
      args: [campaign_id.trim(), step, actor.trim(), JSON.stringify(payload)],
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
