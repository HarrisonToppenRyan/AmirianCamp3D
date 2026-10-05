// Play a page in WebKit (Safari's engine) with real key, mouse and wheel events, step by step.
// usage: node tools/webkit/play.mjs URL [w=1280 h=800 dpr=1 headed=1 quiet=1] -- step step ...
//   wait:TEXT            wait until a console line containing TEXT appears (counted from this step on; up to 120 s)
//   sleep:MS
//   down:KeyW  up:KeyW   hold / release a key (KeyboardEvent.code names; ShiftLeft, ArrowUp, Space ... work too)
//   tap:KeyE[,MS]        press for MS milliseconds (default 80)
//   click:x,y | click:#css
//   drag:x1,y1,x2,y2[,MS]  press the mouse at (x1,y1), move to (x2,y2) over MS ms (default 400), release
//   wheel:DY
//   shot:/path.png
//   eval:JS              evaluated in the page; printed as EVAL: ...
// The steps survive page navigations (the same tab is followed).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');

const args = process.argv.slice(2), cut = args.indexOf('--');
const [url, ...rest] = cut < 0 ? args : args.slice(0, cut), steps = cut < 0 ? [] : args.slice(cut + 1);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const W = +(opt.w || 1280), H = +(opt.h || 800), DPR = +(opt.dpr || 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await webkit.launch({ headless: opt.headed !== '1' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const lines = [];
page.on('console', (m) => { const t = m.text(); if (/GL Driver|GPU stall/.test(t)) return; lines.push(t); if (!opt.quiet) console.log(`[${m.type()}] ${t.slice(0, 400)}`); });
page.on('pageerror', (e) => { lines.push('EXC ' + e.message); console.log('[exception]', e.message); });
try { await page.goto(url, { waitUntil: 'load', timeout: 120000 }); } catch (e) { console.log('[goto]', e.message); }

for (const step of steps) {
  const i = step.indexOf(':'), op = i < 0 ? step : step.slice(0, i), arg = i < 0 ? '' : step.slice(i + 1);
  try {
    if (op === 'wait') { const from = lines.length, t0 = Date.now(); let ok = false; while (Date.now() - t0 < 120000 && !(ok = lines.slice(from).some((l) => l.includes(arg)))) await sleep(100); if (!ok) console.log(`wait:${arg} TIMED OUT`); }
    else if (op === 'sleep') await sleep(+arg);
    else if (op === 'down') await page.keyboard.down(arg);
    else if (op === 'up') await page.keyboard.up(arg);
    else if (op === 'tap') { const [k, ms] = arg.split(','); await page.keyboard.down(k); await sleep(+(ms || 80)); await page.keyboard.up(k); }
    else if (op === 'click') { if (/^[\d.]+,[\d.]+$/.test(arg)) { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); } else await page.click(arg, { timeout: 10000 }); }
    else if (op === 'drag') { const [x1, y1, x2, y2, ms] = arg.split(',').map(Number), n = 20; await page.mouse.move(x1, y1); await page.mouse.down(); for (let k = 1; k <= n; k++) { await page.mouse.move(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n); await sleep((ms || 400) / n); } await page.mouse.up(); }
    else if (op === 'wheel') await page.mouse.wheel(0, +arg);
    else if (op === 'shot') { await page.screenshot({ path: arg }); console.log('shot ' + arg); }
    else if (op === 'eval') console.log('EVAL:', JSON.stringify(await page.evaluate(arg)));
    else console.log('unknown step ' + step);
  } catch (e) { console.log(`step ${step} failed: ${e.message.split('\n')[0]}`); }
}
await browser.close();
process.exit(0);
