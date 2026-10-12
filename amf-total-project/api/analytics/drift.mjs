/* GET /api/analytics/drift — 정산까지 간 캠페인의 예측 대 실측 집계
   장부(events)를 읽어 그 자리에서 계산한다. 별도 지표 테이블은 두지 않는다 — 원장과 어긋날 수 없게. */
import { getDb, ensureTable, cors, variance, errDetail } from '../_db.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const db = await getDb();
    await ensureTable(db);
    const r = await db.execute(`
      SELECT campaign_id, step, payload FROM events
      WHERE step IN ('3_selection','5_settle') ORDER BY campaign_id, id`);
    const per = new Map();                       /* campaign_id → { sel, set } (각 단계의 마지막 기록) */
    for (const row of r.rows) {
      const c = per.get(row.campaign_id) || {};
      let p = null; try { p = JSON.parse(String(row.payload)); } catch { p = null; }
      if (row.step === '3_selection') c.sel = p; else c.set = p;
      per.set(row.campaign_id, c);
    }
    const campaigns = [];
    for (const [campaign_id, c] of per) {
      const v = variance(c.sel, c.set);
      if (v) campaigns.push({ campaign_id, ...v });
    }
    const by = new Map();
    for (const v of campaigns) {
      const k = v.model_version || 'unversioned';
      const g = by.get(k) || { model_version: k, n: 0, roas_err: 0, roas_delta: 0, reach_err: 0, reach_n: 0, over: 0, under: 0, exact: 0 };
      g.n++; g.roas_err += v.roas_error_pct; g.roas_delta += v.roas_delta;
      if (v.reach_error_pct != null) { g.reach_err += v.reach_error_pct; g.reach_n++; }
      g[v.bias === 'over_predicted' ? 'over' : v.bias === 'under_predicted' ? 'under' : 'exact']++;
      by.set(k, g);
    }
    const by_model = [...by.values()].map(g => ({
      model_version: g.model_version,
      settled_campaigns: g.n,
      mean_roas_error_pct: Number((g.roas_err / g.n).toFixed(2)),       /* MAPE */
      mean_roas_delta: Number((g.roas_delta / g.n).toFixed(4)),         /* 편향: 음수면 과대 예측 */
      mean_reach_error_pct: g.reach_n ? Number((g.reach_err / g.reach_n).toFixed(2)) : null,
      over_predicted: g.over, under_predicted: g.under, exact: g.exact,
    })).sort((a, b) => b.settled_campaigns - a.settled_campaigns);
    return res.status(200).json({ settled: campaigns.length, by_model, campaigns });
  } catch (err) {
    console.error('[analytics] drift', err);
    return res.status(500).json({ error: 'db error', detail: errDetail(err) });
  }
}
