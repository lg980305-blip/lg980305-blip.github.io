/* POST /api/gemini — Gemini 중계 (브라우저는 키를 보지 못한다)
   body: { prompt, model? }   env: GEMINI_API_KEY */
import { cors } from './_db.mjs';

const MODEL_RE = /^gemini-[a-z0-9.-]{1,40}$/;   /* URL 에 들어가므로 형식 검사 */

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { prompt, model = process.env.GEMINI_MODEL || 'gemini-flash-latest' } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 200000) {
    return res.status(400).json({ error: 'prompt required' });
  }
  if (!MODEL_RE.test(model)) {
    return res.status(400).json({ error: 'invalid model' });
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) return res.status(apiRes.status).json(data);

    return res.status(200).json(data);
  } catch (err) {
    console.error('[gemini proxy]', err);
    return res.status(500).json({ error: 'AI proxy error' });
  }
}
