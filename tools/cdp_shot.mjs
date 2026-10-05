// usage: node cdp_shot.mjs URL out.png [width] [height] [waitForText] [extraDelayMs] [timeoutMs]
// e.g.   node tools/cdp_shot.mjs "http://127.0.0.1:8123/index.html?auto&ls=tickle" /tmp/tickle.png 1280 800 "HOLD reached"
//         states: intro choice blush stuck grab laugh tickle minigame escape fail complete end leave repeat;  faces: ?auto&face=laugh:0.8 (wait for "FACE ready")
// Real-time headless Chrome via the DevTools protocol: device-metrics emulation, console capture, screenshot on demand.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, out, W = '390', H = '844', waitFor = 'HOLD reached', extra = '2500', timeout = '150000'] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdpprof_'));      // throwaway browser profile, removed on exit
const cleanup = () => { try { rmSync(prof, { recursive: true, force: true }); } catch { /* best effort */ } };
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page = null;
for (let i = 0; i < 150 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  if (!page) await sleep(200);
}
if (!page) { console.log('no page target'); chrome.kill('SIGKILL'); cleanup(); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0, seen = false;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[${m.params.type}] ${text}`);
    if (text.includes(waitFor)) seen = true;
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  } else if (m.method === 'Log.entryAdded' && !/GL Driver|GPU stall/.test(m.params.entry.text)) {
    console.log(`[log ${m.params.entry.level}] ${m.params.entry.text}`);
  }
};
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 600 });
const t0 = Date.now();
await send('Page.navigate', { url });
while (!seen && Date.now() - t0 < +timeout) await sleep(250);
await sleep(+extra);
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`saved ${out} (seen=${seen}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
ws.close(); chrome.kill('SIGKILL');
await sleep(400); cleanup();
process.exit(0);
