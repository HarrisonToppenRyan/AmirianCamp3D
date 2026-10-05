// Hold a page at a console line, then run each variant (a JS snippet evaluated in the page; a promise is awaited), wait
// 700 ms and take a screenshot: for anything that is driven step by step (the foot cam's tools: `__footCam(1)`, then
// `__dbg.footPlay.setTool(..)`, `._seek(seconds)`, `._probe(seconds)`, `.state()`).
// usage: [TDELAY=2500] [TLIMIT=3000] node tools/tune.mjs URL waitText outPrefix variants.json [w h]
//   variants.json: ["js", "js", ...]; shots go to outPrefix_<n>.png; each result is printed (TLIMIT characters, 600 unless set)
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, waitText, outPre, varFile, w = '1100', h = '700'] = process.argv.slice(2);
const variants = JSON.parse(readFileSync(varFile, 'utf8'));
const port = 9300 + Math.floor(Math.random() * 600), prof = mkdtempSync(join(tmpdir(), 'cdpprof_'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bye = (c = 0) => { try { chrome.kill('SIGKILL'); } catch {} setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(c); }, 400); };
// (10-04: a run cut short (its output piped into `head`, a timeout) left its browser running for hours: close it whatever ends this)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGPIPE']) process.on(sig, () => bye(1));
process.stdout.on('error', () => bye(1));
let page = null;
for (let i = 0; i < 150 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} if (!page) await sleep(200); }
if (!page) { console.log('no page'); bye(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
let id = 0, seen = false; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || m.error); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') { const t = m.params.args.map((a) => a.value ?? a.description ?? '').join(' '); if (/HOLD|SHOE|exception|Error/.test(t)) console.log(t.slice(0, 200)); if (t.includes(waitText)) seen = true; }
  else if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
const t0 = Date.now(); await send('Page.navigate', { url });
while (!seen && Date.now() - t0 < 240000) await sleep(200);
if (!seen) { console.log('wait text not seen'); bye(1); }
await sleep(+process.env.TDELAY || 1500);
for (let i = 0; i < variants.length; i++) {
  const r = await send('Runtime.evaluate', { expression: variants[i], returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) console.log('v' + i, 'EXC', (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text).slice(0, 300));
  else if (r && r.result) console.log('v' + i, JSON.stringify(r.result.value).slice(0, +process.env.TLIMIT || 600));
  await sleep(700);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${outPre}_${i}.png`, Buffer.from(shot.data, 'base64'));
}
console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's'); ws.close(); bye(0);
