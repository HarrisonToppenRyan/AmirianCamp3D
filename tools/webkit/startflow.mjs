// The start screen the way a player meets it, in WebKit with the real pointer:
//   1. a new game: "Begin" opens the toenail colour chooser; hovering a swatch tries the colour on, leaving it puts the
//      chosen one back, a click keeps it; "Start" begins the game with her sandals back on
//   2. the page loaded again with a saved game: "Continue" starts at once (no chooser), the chosen colour is still on her
//      toes, and the start screen's own button opens the chooser
// usage: node tools/webkit/startflow.mjs [shots=/dir/prefix]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');
const opt = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); let lines = [];
page.on('console', (m) => lines.push(m.text())); page.on('pageerror', (e) => console.log('[exception]', e.message));
const load = async (url) => { lines = []; await page.goto(url, { waitUntil: 'load', timeout: 120000 }); for (let t0 = Date.now(); Date.now() - t0 < 120000 && !lines.some((l) => l.includes('READY'));) await sleep(100); await sleep(300); };
const nail = () => page.evaluate(() => { let c = null; window.__dbg.anne.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.name === 'Anne_Nail') c = '#' + m.color.getHexString(); }); return c; });
const shown = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
const out = {};
await load('http://127.0.0.1:8123/?fresh');
out.buttons = await page.evaluate(() => [...document.querySelectorAll('#start .btn')].map((e) => e.textContent));
await page.click('#go'); await sleep(900);
out.chooserAfterBegin = await shown('nails'); out.first = await nail();
const sw = page.locator('#nl-sw i');
await sw.nth(1).hover(); await sleep(300); out.hover1 = await nail();
await page.mouse.move(700, 500); await sleep(300); out.afterLeave = await nail();
await sw.nth(9).hover(); await sleep(200); await sw.nth(9).click(); await sleep(200); await page.mouse.move(700, 500); await sleep(300); out.chosen = await nail();
out.barefootInChooser = await page.evaluate(() => window.__dbg.A.shoes());
if (opt.shots) await page.screenshot({ path: opt.shots + '_chooser.png' });
await page.click('#nl-go'); await sleep(1200);
out.afterStart = await page.evaluate(() => ({ chooser: getComputedStyle(document.getElementById('nails')).display, start: getComputedStyle(document.getElementById('start')).display, scene: window.__dbg.scene(), fov: window.__dbg.camera.fov }));
// a saved game past the opening (the engine counts a save only once the story has moved on: progress > 0)
await page.evaluate(() => { const k = 'amirian3d.save.v1', s = JSON.parse(localStorage.getItem(k) || '{}'); s.v = 1; s.progress = 10; s.level = 'camp'; localStorage.setItem(k, JSON.stringify(s)); });
out.saved = await page.evaluate(() => Object.keys(localStorage));
await load('http://127.0.0.1:8123/');
out.again = { buttons: await page.evaluate(() => [...document.querySelectorAll('#start .btn')].map((e) => e.textContent)), nail: await nail() };
if (opt.shots) await page.screenshot({ path: opt.shots + '_continue.png' });
if (out.again.buttons.includes('Continue')) {
  await page.click('#go'); await sleep(900);
  out.afterContinue = { chooser: await shown('nails'), start: await shown('start'), shoes: await page.evaluate(() => window.__dbg.A.shoes()) };
  await load('http://127.0.0.1:8123/');
  await page.locator('#start .btn', { hasText: 'toenail' }).click(); await sleep(900);
  out.chooserFromButton = await shown('nails');
  await page.click('#nl-go'); await sleep(900);
  out.afterButtonStart = { chooser: await shown('nails'), start: await shown('start'), shoes: await page.evaluate(() => window.__dbg.A.shoes()), clip: await page.evaluate(() => window.__dbg.A.debug().exclusiveClip) };
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
