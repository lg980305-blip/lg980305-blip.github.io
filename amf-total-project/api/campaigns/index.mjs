/* GET /api/campaigns — 캠페인별 요약 (최근 활동 순) */
import { getDb, ensureTable, cors, errDetail } from '../_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const db = await getDb();
    await ensureTable(db);
    /* status 는 "가장 최근 이벤트의 단계" — /api/campaigns/:id 의 status 와 같은 뜻.
       (MAX(step) 은 재매칭처럼 뒤로 돌아간 경우를 숨긴다) */
    const r = await db.execute(`
      SELECT e.campaign_id,
             e.step           AS status,
             e.event_hash     AS chain_head,
             agg.first_at,
             agg.last_at,
             agg.steps
      FROM events e
      JOIN (
        SELECT campaign_id,
               MAX(id)         AS last_id,
               MIN(created_at) AS first_at,
               MAX(created_at) AS last_at,
               COUNT(*)        AS steps
        FROM events
        GROUP BY campaign_id
      ) agg ON e.id = agg.last_id
      ORDER BY e.id DESC`);
    return res.status(200).json(r.rows);
  } catch (err) {
    console.error('[campaigns] list', err);
    return res.status(500).json({ error: 'db error', detail: errDetail(err) });
  }
}
