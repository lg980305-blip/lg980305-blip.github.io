/* GET /api/campaigns — 캠페인별 요약 (최근 활동 순) */
import { getDb, ensureTable, cors } from '../_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const db = getDb();
    await ensureTable(db);
    const r = await db.execute(`
      SELECT campaign_id,
             MAX(step)        AS status,
             MIN(created_at)  AS first_at,
             MAX(created_at)  AS last_at,
             COUNT(*)         AS steps
      FROM events
      GROUP BY campaign_id
      ORDER BY MAX(id) DESC`);
    return res.status(200).json(r.rows);
  } catch (err) {
    console.error('[campaigns] list', err);
    return res.status(500).json({ error: 'db error' });
  }
}
