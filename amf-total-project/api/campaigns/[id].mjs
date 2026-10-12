/* GET /api/campaigns/:id — 한 캠페인의 전체 흐름 (id 오름차순) + 해시 체인 검증 + 예측 대 실측
   ?raw=1 이면 저장된 payload 문자열(payload_json)도 함께 — 감사자가 브라우저에서 해시를 직접 재계산할 때 */
import { getDb, ensureTable, cors, eventHash, variance, GENESIS, errDetail } from '../_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'campaign id required' });
  const raw = String(req.query.raw || '') === '1';

  try {
    const db = await getDb();
    await ensureTable(db);
    const r = await db.execute({
      sql: `SELECT id, step, actor, payload, prev_hash, event_hash, created_at
            FROM events WHERE campaign_id = ? ORDER BY id ASC`,
      args: [id],
    });
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' });

    /* 첫 행부터 순서대로 다시 계산한다. 저장된 값과 하나라도 다르면 그 행에서 깨진 것 */
    let prev = GENESIS, broken = null;
    const timeline = r.rows.map(row => {
      const e = { prev_hash: String(row.prev_hash), campaign_id: id, step: String(row.step),
                  actor: String(row.actor), payload: String(row.payload), created_at: String(row.created_at) };
      if (broken === null && (e.prev_hash !== prev || eventHash(e) !== String(row.event_hash))) broken = Number(row.id);
      prev = String(row.event_hash);
      const item = {
        id: row.id,
        step: row.step,
        actor: row.actor,
        payload: safeParse(row.payload),
        prev_hash: row.prev_hash,
        event_hash: row.event_hash,
        created_at: row.created_at,
      };
      if (raw) item.payload_json = String(row.payload);
      return item;
    });
    const lastOf = step => { const x = timeline.filter(t => t.step === step).pop(); return x ? x.payload : null; };
    return res.status(200).json({
      campaign_id: id,
      status: timeline[timeline.length - 1].step,
      audit: { verified: broken === null, blocks: timeline.length, chain_head: prev, broken_at: broken },
      variance: variance(lastOf('3_selection'), lastOf('5_settle')),
      timeline,
    });
  } catch (err) {
    console.error('[campaigns] get', err);
    return res.status(500).json({ error: 'db error', detail: errDetail(err) });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return { _raw: s }; } }
