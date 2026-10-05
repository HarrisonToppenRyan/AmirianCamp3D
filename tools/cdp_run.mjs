// General headless-Chrome runner over the DevTools protocol (real time, optional real GPU).
// usage: node tools/cdp_run.mjs URL [key=value ...]
//   shot=/path/out.png     screenshot at the end (optional)
//   wait="text"            console text to wait for (default: none, just wait `delay` ms after load)
//   delay=1500             extra ms to wait after `wait` is seen (or after load when no `wait`)
//   timeout=120000         give up waiting after this many ms
//   w=1280 h=800 dpr=1     viewport and device pixel ratio
//   gpu=1                  use the real GPU (ANGLE Metal) instead of the software rasteriser
//   eval="js expression"   evaluated in the page at the end; the JSON result is printed as EVAL: ...
//   quiet=1                do not echo console lines
// Chrome's throwaway profile lives in the OS temp dir and is deleted on exit.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const W = +(opt.w || 1280), H = +(opt.h || 800), DPR = +(opt.dpr || 1), delay = +(opt.delay || 1500), timeout = +(opt.timeout || 120000);
const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'cdpprof_'));
const cleanup = () => { try { rmSync(prof, { recursive: true, force: true }); } catch { /* best effort */ } };
const gl = opt.gpu === '1' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', ...gl, '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bail = (msg, code = 1) => { console.log(msg); try { chrome.kill('SIGKILL'); } catch { /* gone */ } cleanup(); process.exit(code); };
process.on('SIGINT', () => bail('interrupted')); process.on('SIGTERM', () => bail('terminated'));
// (10-05: a page whose renderer hangs never answers a protocol call, and the wait below never got its turn: one run sat for 18 minutes. A hard limit, whatever is awaited.)
setTimeout(() => bail('hard timeout: the browser stopped answering'), timeout + 90000).unref();

let page = null;
for (let i = 0; i < 150 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  if (!page) await sleep(200);
}
if (!page) bail('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0, seen = !opt.wait;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (!opt.quiet && !/GL Driver|GPU stall/.test(text)) console.log(`[${m.params.type}] ${text}`);
    if (opt.wait && text.includes(opt.wait)) seen = true;
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  } else if (m.method === 'Log.entryAdded' && !/GL Driver|GPU stall/.test(m.params.entry.text)) {
    console.log(`[log ${m.params.entry.level}] ${m.params.entry.text}`);
  }
};
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: W < 600 });
const t0 = Date.now();
await send('Page.navigate', { url });
while (!seen && Date.now() - t0 < timeout) await sleep(200);
await sleep(delay);
if (opt.eval) {
  const r = await send('Runtime.evaluate', { expression: opt.eval, returnByValue: true, awaitPromise: true });
  console.log('EVAL:', JSON.stringify(r.result ? r.result.value : r));
}
if (opt.shot) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) writeFileSync(opt.shot, Buffer.from(shot.data, 'base64')); else console.log('screenshot failed', JSON.stringify(shot).slice(0, 200));
}
console.log(`done (seen=${seen}, ${((Date.now() - t0) / 1000).toFixed(1)}s)${opt.shot ? ' shot=' + opt.shot : ''}`);
ws.close(); chrome.kill('SIGKILL');
await sleep(400); cleanup();
process.exit(0);
