/* GET /api/campaigns/:id — 한 캠페인의 전체 흐름 (id 오름차순) */
import { getDb, ensureTable, cors } from '../_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'campaign id required' });

  try {
    const db = getDb();
    await ensureTable(db);
    const r = await db.execute({
      sql: `SELECT id, step, actor, payload, created_at FROM events WHERE campaign_id = ? ORDER BY id ASC`,
      args: [id],
    });
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' });

    const timeline = r.rows.map(row => ({
      id: row.id,
      step: row.step,
      actor: row.actor,
      payload: safeParse(row.payload),
      created_at: row.created_at,
    }));
    return res.status(200).json({
      campaign_id: id,
      status: timeline[timeline.length - 1].step,
      timeline,
    });
  } catch (err) {
    console.error('[campaigns] get', err);
    return res.status(500).json({ error: 'db error' });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return { _raw: s }; } }
