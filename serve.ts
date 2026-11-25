// Serve the game locally: `node serve.ts`, then open http://localhost:8080.
// Serves game/ at / (so game/index.html is the front page) and the rest of
// the repository's files as-is. Static files only, no network calls.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = path === '/' ? join(here, 'game', 'index.html') : join(here, 'game', path.replace(/^\//, ''));
  const fallback = join(here, path.replace(/^\//, ''));
  const target = existsSync(file) ? file : fallback;
  if (!existsSync(target)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
  res.end(readFileSync(target));
}).listen(8080, () => console.log('Satay Smoke at http://localhost:8080'));
