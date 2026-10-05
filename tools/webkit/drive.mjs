// Play a story scene in WebKit (Safari's engine) the way a player does: real key presses, decided by what is on the
// screen. Space for every line and card; at each gauge a deliberate hit or miss, following a pattern.
// usage: node tools/webkit/drive.mjs URL [w=900 h=600 dpr=1] [pattern=mmmm] [yaw=0] [walk=KeyW,1500] [key=KeyE] [pick=0,1] [shots=/dir/prefix] [every=6] [max=300] [pace=380] [nail=3]
//   nail      a new game opens the toenail colour chooser: hover and choose swatch <i> (default: keep the colour), then Start
//   key       a key tapped after the walk (KeyE: interact with what she stands at)
//   pick      which option to take at each choice box, in order (0 = the first; default 0)
//   pace      milliseconds between presses on lines of dialogue
// Works with the story's UI (.st-*) and with the log, mimic and trap scenes' UI (.ls-*).
//   pattern   one letter per gauge: h = press inside the green, m = press well outside it (the last letter repeats)
//   yaw/walk  turn the camera, then hold a key for so many ms (to walk her into an event)
//   shots     save <prefix>_g<n>.png when gauge n appears and <prefix>_t<n>.png every `every` seconds of the scene
//   max       give up after this many seconds
// Prints each line of dialogue once, each gauge's outcome, and the state the scene left behind.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright-core');

const [url, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const W = +(opt.w || 900), H = +(opt.h || 600), DPR = +(opt.dpr || 1), PATTERN = opt.pattern || 'm', MAX = +(opt.max || 300), EVERY = +(opt.every || 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await webkit.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const lines = [];
page.on('console', (m) => lines.push(m.text()));
page.on('pageerror', (e) => console.log('[exception]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
for (let t0 = Date.now(); Date.now() - t0 < 120000 && !lines.some((l) => l.includes('READY'));) await sleep(100);
await page.click('#start'); await sleep(800);
if (await page.evaluate(() => { const e = document.getElementById('nails'); return !!e && getComputedStyle(e).display !== 'none'; })) {      // a new game: the toenail colour chooser comes first
  if (opt.nail !== undefined) {               // nail=<i>: point at swatch i (the colour is tried on her toes), picture it, then choose it
    const sw = page.locator('#nl-sw i').nth(+opt.nail); await sw.hover(); await sleep(500);
    if (opt.shots) await page.screenshot({ path: opt.shots + '_nails.png' });
    console.log('NAILS hover ' + await page.evaluate(() => document.getElementById('nl-name').textContent)); await sw.click(); await sleep(200);
  }
  await page.click('#nl-go'); await sleep(800); console.log('NAILS chosen ' + await page.evaluate(() => window.__nails.color));
}
if (opt.yaw !== undefined) { await page.evaluate(`window.__setCam(${+opt.yaw})`); await sleep(200); }
if (opt.walk) { const [k, ms] = opt.walk.split(','); await page.keyboard.down(k); await sleep(+ms); await page.keyboard.up(k); }
if (opt.key) { await sleep(500); await page.keyboard.down(opt.key); await sleep(80); await page.keyboard.up(opt.key); }
const PICKS = (opt.pick || '').split(',').filter(Boolean).map(Number), PACE = +(opt.pace || 380);

const look = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s), ls = !!q('.ls-dlg.ls-on, .ls-gauge.ls-on, .ls-choice.ls-on'), P = ls ? '.ls-' : '.st-', on = ls ? '.ls-on' : '.st-on';
  const g = q(P + 'gauge' + on), d = q(P + 'dlg' + on), txt = (s) => { const e = q(s); return e ? e.textContent : ''; };
  return { active: window.__dbg.scene ? window.__dbg.scene() : window.__dbg.story.isActive(), card: !!q('.st-card.st-on'), choice: !!q(P + 'choice' + on),
    line: d ? (txt(P + 'name') + ': ' + txt(P + 'text').replace(/\s+/g, ' ')).slice(0, 110) : null,
    gauge: g ? { p: parseFloat(q(P + 'gmark').style.left) / 100, z0: parseFloat(q(P + 'gzone').style.left) / 100, w: parseFloat(q(P + 'gzone').style.width) / 100,
      res: g.classList.contains(P.slice(1) + 'hit') ? 'hit' : g.classList.contains(P.slice(1) + 'miss') ? 'miss' : null, label: txt(P + 'glabel') || txt('.ls-gauge .ls-glabel') || 'gauge' } : null,
    err: document.getElementById('err').textContent };
});
const space = async () => { await page.keyboard.down('Space'); await sleep(60); await page.keyboard.up('Space'); };

let gaugeN = 0, inGauge = false, gaugeAt = 0, lastLine = null, lastPress = 0, began = 0, idle = 0, shotN = 0, lastShot = 0, choiceN = 0, inChoice = false;
const t0 = Date.now();
while (Date.now() - t0 < MAX * 1000) {
  const s = await look(), t = Date.now();
  if (s.err) { console.log('PAGE ERROR: ' + s.err); break; }
  if (s.active && !began) { began = t; lastShot = t; }
  if (began && !s.active) { if (!idle) idle = t; if (t - idle > 1500) break; } else idle = 0;
  if (opt.shots && began && s.active && t - lastShot > EVERY * 1000) { lastShot = t; await page.screenshot({ path: `${opt.shots}_t${String(shotN++).padStart(2, '0')}.png` }); }
  if (s.gauge) {
    if (!inGauge) { inGauge = true; gaugeAt = Date.now(); if (opt.shots) { await sleep(700); await page.screenshot({ path: `${opt.shots}_g${gaugeN}.png` }); } continue; }      // (a moment later: the picture the player presses in)
    if (inGauge === 'pressed' && Date.now() - lastPress > 600) inGauge = true;      // (the press was not taken: try again)
    if (s.gauge.res) { if (inGauge !== 'done') { inGauge = 'done'; console.log(`  GAUGE ${gaugeN} "${s.gauge.label}" wanted ${PATTERN[Math.min(gaugeN, PATTERN.length - 1)]} -> ${s.gauge.res}`); gaugeN++; } }
    else if (inGauge !== 'pressed' && Date.now() - gaugeAt > 450) {      // (the game ignores presses in a gauge's first quarter second)
      const want = PATTERN[Math.min(gaugeN, PATTERN.length - 1)], { p, z0, w } = s.gauge;
      const mg = Math.min(0.06, w * 0.3);                    // (a narrow zone: press nearer its edges)
      if (want === 'h' ? (p > z0 + mg && p < z0 + w - mg) : (p < z0 - 0.14 || p > z0 + w + 0.14)) { await space(); inGauge = 'pressed'; lastPress = Date.now(); }
    }
    await sleep(8); continue;
  }
  inGauge = false;
  if (s.choice) {                                  // a choice box: step down to the wanted option, then take it
    if (!inChoice) { inChoice = true; const n = PICKS[choiceN] || 0; console.log(`  CHOICE ${choiceN}: option ${n}`); choiceN++; await sleep(350);
      for (let i = 0; i < n; i++) { await page.keyboard.down('ArrowDown'); await sleep(60); await page.keyboard.up('ArrowDown'); await sleep(120); }
      await space(); lastPress = Date.now(); }
    await sleep(120); continue;
  }
  inChoice = false;
  if (s.line && s.line !== lastLine) { lastLine = s.line; console.log('  ' + s.line); }
  if ((s.line || s.card) && t - lastPress > PACE) { lastPress = t; await space(); }
  await sleep(60);
}
const end = await page.evaluate(() => { const s = window.__dbg.story; return JSON.stringify({ active: window.__dbg.scene ? window.__dbg.scene() : s.isActive(), dbg: window.__dbg.A.debug(), tile: window.__cam().tile, progress: s.S.progress, gone: s.S.state.gone, flags: s.S.state.flags, err: document.getElementById('err').textContent }); });
console.log(`END after ${((Date.now() - t0) / 1000).toFixed(0)} s, ${gaugeN} gauges: ${end}`);
if (opt.shots) await page.screenshot({ path: `${opt.shots}_end.png` });
await browser.close();
process.exit(0);
