import { createClient } from '@libsql/client';

export const STEPS = ['1_brief', '2_match', '3_selection', '4_contract', '5_settle'];

let client = null;
export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url || (!url.startsWith('file:') && !process.env.TURSO_AUTH_TOKEN)) {
      throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not configured');
    }
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

let ready = false;
export async function ensureTable(db) {
  if (ready) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      step        TEXT NOT NULL CHECK (step IN ('1_brief','2_match','3_selection','4_contract','5_settle')),
      actor       TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS ix_events_campaign ON events(campaign_id, id)`);
  ready = true;
}

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AMF-Key');
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
