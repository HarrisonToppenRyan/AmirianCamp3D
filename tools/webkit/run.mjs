// Run a page in WebKit (the engine Safari uses), via Playwright's WebKit build.
// usage: node tools/webkit/run.mjs URL [key=value ...]
//   shot=/path/out.png   screenshot at the end (optional)
//   wait="text"          console text to wait for
//   delay=1500           extra ms after `wait` is seen (or after load)
//   timeout=120000       give up waiting after this many ms
//   w=1280 h=800 dpr=1   viewport and device pixel ratio
//   headed=1             show a real window (default: headless)
//   eval="js"            evaluated in the page at the end; printed as EVAL: ...
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');

const [url, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const W = +(opt.w || 1280), H = +(opt.h || 800), DPR = +(opt.dpr || 1), delay = +(opt.delay || 1500), timeout = +(opt.timeout || 120000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await webkit.launch({ headless: opt.headed !== '1' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
let seen = !opt.wait;
page.on('console', (m) => { const t = m.text(); if (!/GL Driver|GPU stall/.test(t)) console.log(`[${m.type()}] ${t}`); if (opt.wait && t.includes(opt.wait)) seen = true; });
page.on('pageerror', (e) => console.log('[exception]', e.message));
page.on('requestfailed', (r) => console.log('[request failed]', r.url(), r.failure() && r.failure().errorText));
const t0 = Date.now();
try { await page.goto(url, { waitUntil: 'load', timeout }); } catch (e) { console.log('[goto]', e.message); }
while (!seen && Date.now() - t0 < timeout) await sleep(200);
await sleep(delay);
if (opt.eval) { try { console.log('EVAL:', JSON.stringify(await page.evaluate(opt.eval))); } catch (e) { console.log('EVAL failed:', e.message); } }
if (opt.shot) { try { await page.screenshot({ path: opt.shot }); } catch (e) { console.log('screenshot failed:', e.message); } }
console.log(`done (seen=${seen}, ${((Date.now() - t0) / 1000).toFixed(1)}s)${opt.shot ? ' shot=' + opt.shot : ''}`);
await browser.close();
process.exit(0);
