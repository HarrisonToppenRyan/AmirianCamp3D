// A tiny static file server for the game that also accepts test reports from the page.
// usage: node tools/serve.mjs [port=8124] [reportFile=/tmp/forestcamp_reports.jsonl]
//   GET  /...        files from the project folder
//   POST /report     the page (index.html?report=1) posts its PERF lines here; each is appended to reportFile
// The everyday server is still `python3 -m http.server 8123`; this one exists so a real Safari tab can report
// its own frame timings without any browser automation.
import { createServer } from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const port = +(process.argv[2] || 8124), reportFile = process.argv[3] || '/tmp/forestcamp_reports.jsonl';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.css': 'text/css', '.md': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url.startsWith('/report')) {
      let body = ''; for await (const chunk of req) body += chunk;
      await appendFile(reportFile, JSON.stringify({ at: new Date().toISOString(), ua: req.headers['user-agent'], body }) + '\n');
      res.writeHead(204).end(); return;
    }
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    const data = await readFile(path.endsWith('/') ? join(path, 'index.html') : path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(data);
  } catch (e) { res.writeHead(404).end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}  (reports -> ${reportFile})`));
