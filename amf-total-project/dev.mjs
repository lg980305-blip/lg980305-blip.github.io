/* 로컬 개발 서버 — Vercel 없이 public/ 과 api/ 를 같은 출처에서 띄운다.
   사용:  TURSO_DATABASE_URL=file:./dev.db EVENTS_WRITE_KEY=dev-key node dev.mjs
   (Vercel 함수 규격 req.query / res.status().json() 만 흉내낸다) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const routes = [
  [/^\/api\/events$/,            () => import('./api/events.mjs'),            () => ({})],
  [/^\/api\/campaigns$/,         () => import('./api/campaigns/index.mjs'),   () => ({})],
  [/^\/api\/campaigns\/([^/]+)$/, () => import('./api/campaigns/[id].mjs'),   m => ({ id: decodeURIComponent(m[1]) })],
  [/^\/api\/gemini$/,            () => import('./api/gemini.mjs'),            () => ({})],
];

function wrap(res) {
  return {
    status(c) { res.statusCode = c; return this; },
    setHeader(k, v) { res.setHeader(k, v); },
    json(b) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(b)); return this; },
    end(b) { res.end(b); return this; },
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  for (const [re, load, q] of routes) {
    const m = url.pathname.match(re);
    if (!m) continue;
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed = {};
    if (body) { try { parsed = JSON.parse(body); } catch { res.statusCode = 400; return res.end('{"error":"bad json"}'); } }
    const query = { ...Object.fromEntries(url.searchParams), ...q(m) };
    const handler = (await load()).default;
    try { await handler({ method: req.method, headers: req.headers, body: parsed, query }, wrap(res)); }
    catch (e) { console.error(e); res.statusCode = 500; res.end('{"error":"handler crashed"}'); }
    return;
  }
  let file = path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.statusCode = 403; return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
