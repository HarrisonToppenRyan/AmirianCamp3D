// story.js: the story engine shared by every area. Area scripts (story_camp.js, story_forest.js) are written as async
// functions on top of it:
//     await S.say('am', 0, 'Good morning, sleeping beauty!');
//     if (await S.gauge({ label: 'Dodge!' })) ...
//
//   state    saved in localStorage: progress (the 2D game's GAME_PROGRESS numbers), flags, removed events, herbs, coins
//   events   S.on({ id, at, r, touch | action, when, run }): `run` fires when Anne walks in (touch) or presses E (action)
//   scenes   S.run(fn): the game hands control to the story until fn's promise settles (index.html stops moving her)
//   UI       dialogue box with portraits, choices, the space-bar gauge, notes, emotes, objective, fades, text cards
//   camera   S.cam: a small cinematic camera (two-shot, face, behind), eased or cut; it never sits in a wall or a tree
//   tests    ?sa=hit|miss|hmh.. plays scenes by itself; &hold=<mark> freezes at S.mark(name) or line n (L12);
//            &pick=0,1 chooses; &ts=4 speeds the story clock up; &prog=n sets the progress; &fresh ignores the save;
//            &ev=<event id> stands her next to an event and starts it

// (10-03, as he asked: his Motion Reel Kit in the game's scenes) lib/motion.js is the kit's spring library; the story's
// camera follows two of the kit's rules with it (see "the cinematic camera" below)
const VQ = new URL(import.meta.url).search;
await import('./lib/motion.js' + VQ);
const Motion = globalThis.Motion;

export function createStory(ctx) {
  const { THREE, scene, camera, anne, A, level, LV, S: TILE, qp } = ctx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = THREE.MathUtils.clamp, PI = Math.PI;
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- saved state ----------
  const SAVE = 'amirian3d.save.v1';
  const fresh = () => ({ v: 1, progress: 0, flags: {}, gone: {}, herbs: 0, coins: 60, level: 'camp', at: null });
  let state = fresh(), hadSave = false;
  try {
    const raw = !qp.has('fresh') && localStorage.getItem(SAVE);
    if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) { state = Object.assign(fresh(), s); hadSave = state.progress > 0; } }
  } catch (e) { /* no storage: the game still plays, it just forgets */ }
  if (qp.has('prog')) state.progress = +qp.get('prog');
  if (qp.has('coins')) state.coins = +qp.get('coins');      // (tests: her purse)
  for (const f of (qp.get('flags') || '').split(',')) if (f) state.flags[f] = true;
  // (where she is goes into the save, so that Continue brings her back to the same area and spot. `at` is in tiles
  //  and fractional: the tile centre of `at` is the very spot she stood on)
  const here = () => { state.level = LV; state.at = [+(anne.position.x / TILE - 0.5).toFixed(2), +(anne.position.z / TILE - 0.5).toFixed(2)]; };
  const save = (place = false) => { if (place === true) here(); try { localStorage.setItem(SAVE, JSON.stringify(state)); } catch (e) { /* see above */ } };
  const gone = () => (state.gone[LV] || (state.gone[LV] = []));

  // ---------- UI ----------
  const CSS = `
.st-fade { position: fixed; inset: 0; opacity: 0; pointer-events: none; z-index: 2; background: #000; }
.st-night { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0; background: radial-gradient(ellipse at 50% 60%, rgba(8,12,40,0) 30%, rgba(4,6,24,.55) 100%); }
.st-dlg { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(900px, 94vw); box-sizing: border-box; display: none; gap: 16px;
  align-items: flex-start; padding: 12px 18px 14px 12px; z-index: 4; color: #f4ecd8; font-family: Georgia, serif; cursor: pointer; user-select: none;
  background: linear-gradient(180deg, rgba(52,36,112,.93), rgba(20,13,52,.95)); border: 2px solid #c9a24a; border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,236,190,.08); }
.st-dlg.st-on { display: flex; }
.st-dlg.st-plain .st-face { display: none; }
.st-face { flex: 0 0 144px; width: 144px; height: 144px; border-radius: 4px; background-color: rgba(0,0,0,.25); box-shadow: inset 0 0 0 1px rgba(201,162,74,.55); }
.st-face canvas { display: block; width: 100%; height: 100%; border-radius: inherit; }
.st-body { flex: 1 1 auto; min-width: 0; padding-top: 2px; }
.st-name { display: inline-block; margin-bottom: 8px; padding: 0 10px 1px 2px; color: #c9a24a; font-size: 17px; letter-spacing: .06em; border-bottom: 1px solid rgba(201,162,74,.6); }
.st-name:empty { display: none; }
.st-text { font-size: 20px; line-height: 1.45; overflow-wrap: anywhere; white-space: pre-line; text-shadow: 0 1px 2px rgba(0,0,0,.6); min-height: 2.9em; }
.st-text .st-rest { visibility: hidden; }
.st-next { position: absolute; right: 14px; bottom: 8px; color: #c9a24a; font-size: 14px; visibility: hidden; }
.st-dlg.st-done .st-next { visibility: visible; animation: st-blink 1s steps(1) infinite; }
@keyframes st-blink { 50% { opacity: 0; } }
.st-choice { position: fixed; z-index: 4; display: none; min-width: 190px; max-width: 80vw; box-sizing: border-box; padding: 6px; font: 18px/1.3 Georgia, serif;
  color: #f4ecd8; background: linear-gradient(180deg, rgba(52,36,112,.95), rgba(20,13,52,.96)); border: 2px solid #c9a24a; border-radius: 6px;
  box-shadow: 0 6px 22px rgba(0,0,0,.5); user-select: none; }
.st-choice.st-on { display: block; }
.st-opt { position: relative; padding: 6px 14px 6px 30px; border-radius: 4px; cursor: pointer; }
.st-opt.st-sel { background: rgba(201,162,74,.18); color: #fff3cf; }
.st-opt.st-sel::before { content: '\\25B6'; position: absolute; left: 9px; top: 9px; color: #c9a24a; font-size: 12px; }
.st-gauge { position: fixed; left: 50%; top: 16%; transform: translateX(-50%); width: min(60vw, 520px); box-sizing: border-box; z-index: 4; display: none;
  padding: 12px 16px 12px; text-align: center; font-family: Georgia, serif; color: #f4ecd8; pointer-events: none;
  background: linear-gradient(180deg, rgba(52,36,112,.9), rgba(20,13,52,.92)); border: 2px solid #c9a24a; border-radius: 6px; }
.st-gauge.st-on { display: block; }
.st-glabel { font-size: 17px; margin-bottom: 10px; text-shadow: 0 1px 2px #000; }
.st-gbar { position: relative; height: 24px; border-radius: 12px; background: #1b1330; overflow: hidden;
  box-shadow: inset 0 0 0 2px rgba(201,162,74,.75), inset 0 3px 8px rgba(0,0,0,.6); }
.st-gzone { position: absolute; top: 3px; bottom: 3px; border-radius: 3px; background: linear-gradient(180deg, #7ef08a, #2fae4a); box-shadow: 0 0 10px rgba(110,255,140,.6); }
.st-gmark { position: absolute; top: 0; bottom: 0; width: 6px; margin-left: -3px; border-radius: 3px; background: #fff7dc; box-shadow: 0 0 8px #fff3b0; }
.st-gsub { margin-top: 8px; font-size: 13px; letter-spacing: .08em; color: #c9a24a; min-height: 1em; }
.st-gauge.st-miss .st-gbar { box-shadow: inset 0 0 0 2px #ff5a4a, 0 0 16px #ff3a2a; }
.st-gauge.st-hit .st-gbar { box-shadow: inset 0 0 0 2px #7ef08a, 0 0 16px #5aff7a; }
.st-toasts { position: fixed; left: 50%; top: 58px; transform: translateX(-50%); z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; width: min(92vw, 640px); }
.st-toast { padding: 7px 16px; border-radius: 5px; font: 17px/1.35 Georgia, serif; color: #f4ecd8; text-align: center; text-shadow: 0 1px 2px #000;
  background: rgba(28,18,60,.88); border: 1px solid #c9a24a; box-shadow: 0 4px 14px rgba(0,0,0,.45); opacity: 0; transform: translateY(-6px); transition: opacity .25s, transform .25s; }
.st-toast.st-on { opacity: 1; transform: none; }
.st-toast.st-warning { border-color: #ff7a5e; background: rgba(86,18,18,.9); color: #ffe1d6; font-size: 19px; letter-spacing: .03em; }
.st-toast.st-success { border-color: #7ef08a; background: rgba(16,62,34,.9); }
.st-toast.st-info { border-color: #7fb6ff; background: rgba(18,36,78,.9); }
.st-toast.st-dialog { font-style: italic; border-radius: 14px; background: rgba(250,244,226,.94); color: #2b1d47; text-shadow: none; border-color: #6b4fb0; }
.st-goal { position: fixed; left: 16px; top: 56px; z-index: 3; max-width: min(46vw, 520px); font: 14px/1.4 Georgia, serif; color: #f4ecd8; text-shadow: 0 1px 3px #000; pointer-events: none; }
.st-goal b { color: #c9a24a; font-weight: normal; }
.st-goal:empty { display: none; }
.st-hud { position: fixed; top: 12px; right: 16px; z-index: 3; padding: 6px 12px; font: 14px/1.5 Georgia, serif; color: #f4ecd8; text-align: right;
  background: linear-gradient(180deg, rgba(44,30,96,.78), rgba(20,13,50,.82)); border: 1px solid #c9a24a; border-radius: 6px; text-shadow: 0 1px 2px #000; pointer-events: none; }
.st-hud b { color: #c9a24a; font-weight: normal; }
.st-card { position: fixed; inset: 0; z-index: 5; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 18px; padding: 24px;
  background: radial-gradient(ellipse at center, rgba(30,16,52,.93), rgba(4,6,8,.97)); color: #f4ecd8; font-family: Georgia, serif; text-align: center; cursor: pointer; user-select: none; }
.st-card.st-on { display: flex; }
.st-card h2 { margin: 0; font-weight: normal; font-size: clamp(24px, 4.4vw, 40px); letter-spacing: .08em; color: #c9a24a; }
.st-card p { margin: 0; max-width: 640px; font-size: 18px; line-height: 1.6; opacity: .92; white-space: pre-line; }
.st-card small { opacity: .6; font-size: 13px; letter-spacing: .08em; }
@media (max-width: 600px) {
  .st-dlg { gap: 10px; padding: 8px 12px 12px 8px; bottom: 10px; }
  .st-face { flex-basis: 84px; width: 84px; height: 84px; }
  .st-name { font-size: 15px; margin-bottom: 4px; }
  .st-text { font-size: 16px; }
  .st-choice { font-size: 16px; }
  .st-gauge { width: 88vw; top: 12%; }
  .st-toast { font-size: 15px; }
}`;
  const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  const el = (cls, parent = document.body, text = '') => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; parent.appendChild(e); return e; };
  const nightEl = el('st-night'), fadeEl = el('st-fade');
  const dlg = el('st-dlg'), faceEl = el('st-face', dlg), bodyEl = el('st-body', dlg), nameEl = el('st-name', bodyEl), textEl = el('st-text', bodyEl);
  const shownEl = document.createElement('span'), restEl = document.createElement('span'); restEl.className = 'st-rest'; textEl.append(shownEl, restEl);
  const faceCv = document.createElement('canvas'); faceCv.width = faceCv.height = 288; faceEl.appendChild(faceCv); const faceCx = faceCv.getContext('2d');
  el('st-next', dlg, '▼');
  const choiceEl = el('st-choice');
  const gaugeEl = el('st-gauge'), gLabel = el('st-glabel', gaugeEl), gBar = el('st-gbar', gaugeEl), gZone = el('st-gzone', gBar), gMark = el('st-gmark', gBar), gSub = el('st-gsub', gaugeEl);
  const toastsEl = el('st-toasts'), goalEl = el('st-goal');
  const cardEl = el('st-card'), cardH = document.createElement('h2'), cardP = document.createElement('p'), cardS = document.createElement('small'); cardEl.append(cardH, cardP, cardS);
  let hudEl = null;
  if (!ctx.ownHud) { hudEl = el('st-hud'); }
  const setHud = () => { if (hudEl) hudEl.innerHTML = `Herbs: <b>${state.herbs}</b><br>Coins: <b>${state.coins}</b>`; };
  setHud();
  if (qp.has('noui')) for (const e of [nightEl, fadeEl, dlg, choiceEl, gaugeEl, toastsEl, goalEl, cardEl, hudEl]) if (e) e.style.display = 'none';      // (test: what do the story's page elements cost?)

  // portraits: [file, columns, rows, speaker's name]
  const SHEETS = {
    a1: ['faces/anne-faceset-01.png', 4, 12, 'Anne'], a2: ['faces/anne-faceset-02.png', 4, 12, 'Anne'], am: ['faces/amaymon-faceset.png', 4, 9, 'Amaymon'],
    al: ['faces/alraune.png', 4, 4, 'Alraune'], ivy: ['faces/ivy-maiden.png', 4, 2, 'Ivy Maiden'], myc: ['faces/myconids-faceset.png', 4, 2, 'Myconid'],
    au: ['faces/aurelia.png', 4, 4, 'Aurelia'],      // (the thief: only her first three rows are used)
    bo: ['faces/boudicca.png', 4, 6, 'Boudicca'], li: ['faces/lilith.png', 4, 6, 'Lilith'], ly: ['faces/lyra.png', 4, 4, 'Lyra'],      // (10-02: the epilogue and the opening)
    // (10-05: Chapter 2) Camellia the apothecary, the dryad of the Forest of Lys, Vice-Captain Elora, Lieutenant Mia, the gate guard
    ca: ['faces/camellia.png', 4, 6, 'Camellia'], dr: ['faces/dryad.png', 4, 4, 'Dryad'], el: ['faces/elora.png', 4, 4, 'Elora'], mi: ['faces/mia.png', 4, 2, 'Mia'], gu: ['faces/valyndra-guards.png', 4, 2, 'Gate Guard'],
  };
  const BITMAPS = {};
  // (10-04, as he asked) her name is the player's (looks.js): wherever the story says "Anne", it says that name; and once
  // her look has been changed, her portrait is one made of her as she is (S.facePortrait), not the drawn one
  const hero = () => (S.heroName && S.heroName()) || 'Anne';
  const tx = (t) => (typeof t === 'string' && t.indexOf('Anne') >= 0 ? t.replace(/\bAnne\b/g, hero()) : t);
  const ready = Promise.all(Object.entries(SHEETS).map(([k, s]) => new Promise((res) => {
    const im = new Image(); im.onload = () => { BITMAPS[k] = im; res(); }; im.onerror = () => res(); im.src = s[0] + '?v=' + (ctx.ver || 1);
  })));
  // what Anne's face does for a portrait of hers (sheet a1 / a2, by index): [expression, blush]
  const A1 = { 0: ['smile', 0], 1: ['worried', 0], 2: ['surprised', 0], 3: ['neutral', 0], 4: ['neutral', 0], 5: ['angry', 0], 6: ['pout', 0], 7: ['smug', 0], 8: ['tired', 0], 9: ['smile', 0], 10: ['happy', 0],
    12: ['smug', 0], 13: ['laugh', 0], 15: ['smug', 0], 17: ['worried', 0], 20: ['tired', 0], 22: ['worried', 0.2], 42: ['shocked', 0.3], 43: ['angry', 0.2], 45: ['angry', 0], 46: ['worried', 0], 47: ['neutral', 0] };
  const A2 = { 0: ['tired', 0], 1: ['tired', 0], 3: ['worried', 0], 4: ['angry', 0.4], 5: ['shocked', 0], 6: ['surprised', 0], 7: ['shocked', 0], 14: ['laughHard', 0.8], 18: ['laughHard', 0.9], 19: ['strain', 0.6],
    21: ['tired', 0.2], 24: ['tired', 0.5], 31: ['embarrassed', 0.6], 34: ['angry', 0], 35: ['tired', 0], 36: ['pout', 0],
    2: ['angry', 0], 8: ['strain', 0.4], 10: ['laugh', 0.5], 11: ['worried', 0], 12: ['shocked', 0.2], 15: ['laugh', 0.6], 16: ['laughHard', 0.7], 26: ['worried', 0.2], 40: ['laugh', 0.5], 45: ['laughHard', 0.9], 46: ['laugh', 0.6], 47: ['laughHard', 0.8] };

  // ---------- sounds (10-02): the 2D game's own sound effects (audio/se_*.mp3) and Anne's voice (audio/vo_*.mp3) ----------
  // se(name, volume, rate): one shot (rate is the 2D's pitch: 1.2 = pitch 120). voice(bank): one clip of her giggles,
  // laughter or cackling, cutting off the last one, as the 2D's scenes do at each turn of a tickling loop.
  const MUTE = qp.has('mute');
  function se(name, vol = 1, rate = 1) {
    if (MUTE) return null;
    try { const a = new Audio('audio/' + name + '.mp3?v=' + (ctx.ver || 1)); a.volume = Math.max(0, Math.min(1, vol)); a.preservesPitch = false; a.webkitPreservesPitch = false; a.playbackRate = rate; a.play().catch(() => {}); return a; } catch (e) { return null; }
  }
  const VOICES = { giggle: ['md_female5_giggle_13', 'edm_female1_giggle_1', 'edm_female1_giggle_2', 'edm_female1_giggle_3'], laughter: ['edm_female1_laughter_1', 'md_female5_laughter_10', 'md_female5_laughter_11', 'md_female5_laughter_12', 'md_female5_laughter_13'],
    cackling: ['md_female5_cackling_6', 'md_female5_cackling_7', 'md_female5_cackling_8', 'md_female5_cackling_9'],
    gasp: ['edm_female1_gasp_1', 'edm_female1_gasp_2'], chuckle: ['md_female3_chuckle_3', 'md_female3_chuckle_4', 'md_female3_chuckle_5'] };      // (chuckle: Lilith's)
  let voiceA = null, voiceLast = '';
  function voice(bank, vol = 0.75) {
    const L = VOICES[bank]; if (!L) return;
    let n = L[Math.floor(Math.random() * L.length)]; if (n === voiceLast && L.length > 1) n = L[(L.indexOf(n) + 1) % L.length]; voiceLast = n;
    if (voiceA) voiceA.pause(); voiceA = se('vo_' + n, vol, (1.08 + Math.random() * 0.08) * (S.voicePitch || 1));      // (10-05: S.voicePitch: somebody else's laughter, a little lower or higher than Anne's)
  }
  // a tickling stage's voice: one clip of `bank` every `every` seconds until voiceLoop(null)
  let vLoop = null;
  function voiceLoop(bank, every = 2.6) { vLoop = bank ? { bank, every, t: 0.2 } : null; if (!bank && voiceA) { const a = voiceA; let v = a.volume; const iv = setInterval(() => { v -= 0.08; if (v <= 0) { a.pause(); clearInterval(iv); } else a.volume = v; }, 40); } }

  // ---------- input ----------
  let active = false, presses = 0, moves = 0, armed = false;
  const OK = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE']);
  addEventListener('keydown', (e) => {
    if (!active || e.repeat) return;
    if (OK.has(e.code) || e.key === 'Enter' || e.key === ' ') { if (armed) presses++; e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') moves--;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moves++;
  });
  addEventListener('pointerdown', (e) => { if (active && armed && e.button === 0) presses++; });

  // ---------- the story clock and awaitables ----------
  // Everything a scene awaits is settled from update(), so scenes advance in step with the game's frames.
  const waiters = new Set();
  const until = (fn) => new Promise((res) => waiters.add({ fn, res }));
  const TS = +(qp.get('ts') || 1);                 // (tests) how fast the story clock runs
  let now = 0;                                     // story time, seconds
  const wait = (sec) => { let t = 0; return until((dt) => (t += dt) >= sec); };
  const frame = () => until(() => true);

  // ---------- test driver ----------
  const AUTO = qp.get('sa');                       // 'hit' | 'miss' | a pattern such as 'hmh' (repeats)
  const HOLD = qp.get('hold'), HOLDT = qp.get('holdtext'), PICK = (qp.get('pick') || '').split(',').filter(Boolean).map(Number);      // hold=<mark> | hold=L<n> (the n-th line) | holdtext=<part of a line>
  let autoT = 0, gaugeN = 0, pickN = 0, lineN = 0, held = false;
  const never = new Promise(() => {});
  function mark(name) {                            // scenes call S.mark('name'); with &hold=name the scene stops there for a screenshot
    if (HOLD !== name || held) return Promise.resolve();
    held = true; setTimeout(() => console.log('HOLD reached: ' + name), 900);
    return never;
  }

  // ---------- fades, night, cards ----------
  let fadeV = 0;
  const setFade = (v) => { fadeV = v; fadeEl.style.opacity = v; };
  async function fade(to, sec = 0.5) {
    const from = fadeV; let t = 0;
    if (sec <= 0) { setFade(to); return; }
    await until((dt) => { t += dt; setFade(from + (to - from) * Math.min(1, t / sec)); return t >= sec; });
  }
  let nightV = 0;
  function setNight(k) { nightV = k; nightEl.style.opacity = k; if (ctx.setNight) ctx.setNight(k); }
  async function night(to, sec = 1.5) {
    const from = nightV; let t = 0;
    if (sec <= 0) { setNight(to); return; }
    await until((dt) => { t += dt; setNight(from + (to - from) * sstep(0, 1, t / sec)); return t >= sec; });
  }
  async function card(title, text, foot = 'Press SPACE to continue') {
    cardH.textContent = tx(title) || ''; cardH.style.display = title ? '' : 'none'; cardP.textContent = tx(text) || ''; cardS.textContent = foot;
    cardEl.classList.add('st-on'); presses = 0; let t = 0;
    await mark('card');
    await until((dt) => { t += dt; if (AUTO && t > 0.6) return true; if (presses > 0 && t > 0.4) { presses = 0; return true; } presses = 0; return false; });
    cardEl.classList.remove('st-on');
  }

  // ---------- dialogue ----------
  let talkT = 0;                                   // > 0 while Anne's line is being typed: her mouth moves
  function drawFace(sheet, idx, o = {}) {
    const s = SHEETS[sheet], bm = BITMAPS[sheet];
    faceCx.clearRect(0, 0, 288, 288);
    if ((sheet === 'a1' || sheet === 'a2') && S.facePortrait) {
      const m = o.expr ? [o.expr, o.blush || 0] : (sheet === 'a1' ? A1 : A2)[idx], own = S.facePortrait(m ? m[0] : 'neutral', o.blush !== undefined ? o.blush : (m ? m[1] : 0));
      if (own) { faceCx.drawImage(own, 0, 0, 288, 288); return true; }
    }
    if (!s || !bm) return false;
    const cw = bm.width / s[1], ch = bm.height / s[2];
    faceCx.drawImage(bm, (idx % s[1]) * cw, Math.floor(idx / s[1]) * ch, cw, ch, 0, 0, 288, 288);
    return true;
  }
  const hideDlg = () => { dlg.classList.remove('st-on', 'st-done'); };
  // say(sheet, face index, text, { name, expr, blush, keep })  sheet '' = a plain line with no portrait (narration, signs)
  // A line that speaks of her feet is shown over a close-up of them in her sandals, with ONE small wiggle of her toes
  // (a second and a half, then they are still); afterwards the picture is what it was. Only while she simply stands
  // there with her shoes on: a scene that has posed her, or has them off, has pictures of its own. o.noFeet: not this line.
  // (10-05, as he asked: "no need to have foot shots on Anne during cutscenes unless a character is talking about Anne's
  // feet specifically") A line speaks of her feet when the scene says so (o.feet: what she has on them, her toenails), or
  // when it names feet, toes or soles and is not somebody else speaking of their own (herFeet). A line about her SHOES
  // alone does not, and the picture no longer goes to her feet at random while she talks (10-02's one line in four: gone).
  const FEET_WORDS = /\b(feet|foot|footsies?|feetsies|tootsies|toes?|toenails?|soles?|piggies)\b/i;
  const OWN_FEET = /\b(my|our|his|its|their)\s+(?:own\s+)?(?:[\w'-]+\s+){0,2}(feet|foot|footsies?|feetsies|tootsies|toes?|toenails?|soles?|piggies)\b/i;
  const NOT_FEET = /\b(on foot|by foot|foot of|sole (reason|purpose|aim|heir|owner|survivor)|toe the line|tip-toe|a foot (tall|long|deep|high|away|wide))\b/i;
  const isAnneSheet = (sheet) => sheet === 'a1' || sheet === 'a2';
  const herFeet = (sheet, text) => FEET_WORDS.test(text) && !NOT_FEET.test(text) && (isAnneSheet(sheet) || !OWN_FEET.test(text));
  const SAYLOG = qp.has('saylog') && typeof window !== 'undefined' ? (window.__sayLog = []) : null;      // (tests: every line, and whether it was shown over her feet)
  const FEET_ANGLES = [[0.62, 0.16, 0.82, 0.06], [-0.62, 0.16, 0.82, 0.06], [2.5, 0.1, 0.72, 0.07], [Math.PI, 0.09, 0.7, 0.07], [-2.5, 0.1, 0.72, 0.07]];      // [bearing from her front, pitch, distance, height]
  function feetCut(view = 0) {
    const d = A.debug ? A.debug() : null;
    if (!d || !d.heelsWorn || S.noFeetCut || (curClip && curClip !== 'Idle' && curClip !== 'Point') || Math.abs(anne.position.y) > 0.02 || !ctx.camFree) return null;
    const keep = { pos: cam.gPos.clone(), look: cam.gLook.clone(), fov: cam.gFov, focus: cam.focus ? cam.focus.clone() : null, fK: cam.fK, on: cam.on, follow: cam.follow };
    const yaw = anne.rotation.y, p = V3(anne.position.x + Math.sin(yaw) * 0.06, 0, anne.position.z + Math.cos(yaw) * 0.06);
    const [ab, pp, dd, yy] = FEET_ANGLES[view] || FEET_ANGLES[0];
    S.cam.at(p, yaw + ab, { y: yy, pitch: pp, dist: dd, fov: 30, focus: p.clone().setY(0.05), focusK: 2.0, cut: true, through: true, minY: 0.06, near: 0.25 });
    if (ctx.setCloseUp) ctx.setCloseUp('on');
    S.toes(0.1, 1.3, 1.5);
    return () => {
      if (ctx.setCloseUp) ctx.setCloseUp('off');
      if (keep.on) S.cam.set(keep.pos, keep.look, { fov: keep.fov, cut: true, focus: keep.focus, focusK: keep.fK, bush: true }); else { cam.on = false; if (Math.abs(camera.fov - cam.baseFov) > 0.01) { camera.fov = cam.baseFov; camera.updateProjectionMatrix(); } if (ctx.setFocus) ctx.setFocus(null); }
      cam.follow = keep.follow;
    };
  }
  async function say(sheet, idx, text, o = {}) {
    lineN++; text = tx(text);
    const feetBack = o.feet || (!o.noFeet && herFeet(sheet, text)) ? feetCut(o.feetView || 0) : null;      // (o.feet: this line is about them, whatever its words)
    if (SAYLOG) SAYLOG.push([sheet, feetBack ? (o.feet ? 'flag' : 'word') : '', text]);
    const s = SHEETS[sheet];
    dlg.classList.toggle('st-plain', !s || !drawFace(sheet, idx, o));
    nameEl.textContent = o.name !== undefined ? o.name : (s ? (sheet === 'a1' || sheet === 'a2' ? hero() : s[3]) : '');
    shownEl.textContent = ''; restEl.textContent = text;
    dlg.classList.remove('st-done'); dlg.classList.add('st-on');
    const isAnne = sheet === 'a1' || sheet === 'a2';
    if (isAnne) {
      const m = o.expr ? [o.expr, o.blush || 0] : (sheet === 'a1' ? A1 : A2)[idx];
      if (m) A.setExpression(m[0], o.blush !== undefined ? o.blush : m[1]);
    }
    if (S.onSpeak) S.onSpeak(sheet, true);
    let n = 0, t = 0, done = false; presses = 0;
    await until((dt) => {
      t += dt;
      if (!done) {
        n = Math.min(text.length, n + dt * 48);
        if (isAnne && A.setTalking) A.setTalking(true);
        if ((presses > 0 && t > 0.12) || n >= text.length || AUTO) { n = text.length; done = true; t = 0; presses = 0; dlg.classList.add('st-done'); if (isAnne && A.setTalking) A.setTalking(false); if (S.onSpeak) S.onSpeak(sheet, false); }
        shownEl.textContent = text.slice(0, Math.floor(n)); restEl.textContent = text.slice(Math.floor(n));
        return false;
      }
      if ((HOLD === 'L' + lineN || (HOLDT && text.includes(HOLDT))) && !held) { held = true; setTimeout(() => console.log('HOLD reached: line ' + lineN), 700); }
      if (held) return false;
      if (AUTO ? t > 0.14 : presses > 0) { presses = 0; return true; }
      return false;
    });
    if (!o.keep) hideDlg();
    if (feetBack) feetBack();
  }
  // the short remarks the 2D game shows as notifications: "a|b|c" picks one
  const pickOne = (text) => { const v = text.split('|'); return v[Math.floor(Math.random() * v.length)]; };
  function toast(text, kind = 'note', sec = 2.6) {
    const e = el('st-toast st-' + kind, toastsEl, tx(pickOne(text)));
    requestAnimationFrame(() => e.classList.add('st-on'));
    setTimeout(() => { e.classList.remove('st-on'); setTimeout(() => e.remove(), 300); }, sec * 1000 / TS);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
  }
  async function note(text, kind = 'note', sec = 1.6) { toast(text, kind, sec + 0.6); await wait(sec); }

  // ---------- choices ----------
  const optEls = []; let chSel = 0, chN = 0;
  const markChoice = () => { for (let i = 0; i < optEls.length; i++) optEls[i].classList.toggle('st-sel', i === chSel); };
  function placeChoice() {
    const r = dlg.getBoundingClientRect();
    choiceEl.style.right = (r.height ? Math.max(8, innerWidth - r.right) : Math.max(16, innerWidth / 2 - 130)) + 'px';
    choiceEl.style.bottom = (r.height ? innerHeight - r.top + 8 : innerHeight * 0.3) + 'px';
  }
  async function choice(labels) {
    chN = labels.length; chSel = 0;
    for (let i = 0; i < Math.max(chN, optEls.length); i++) {
      if (!optEls[i]) { const k = i; optEls[i] = el('st-opt', choiceEl); optEls[i].addEventListener('pointerdown', (e) => { chSel = k; markChoice(); presses++; e.stopPropagation(); }); }
      optEls[i].style.display = i < chN ? '' : 'none'; if (i < chN) optEls[i].textContent = tx(labels[i]);
    }
    markChoice(); choiceEl.classList.add('st-on'); placeChoice(); presses = 0; moves = 0;
    let t = 0;
    await mark('choice');
    await until((dt) => {
      t += dt;
      if (AUTO) { if (t > 0.3) { chSel = Math.min(chN - 1, PICK[pickN] || 0); pickN++; return true; } return false; }
      if (moves) { chSel = (chSel + moves + chN * 8) % chN; moves = 0; markChoice(); }
      if (presses > 0 && t > 0.25) { presses = 0; return true; }
      presses = 0; return false;
    });
    choiceEl.classList.remove('st-on'); hideDlg();
    return chSel;
  }

  // ---------- the space-bar gauge (every fight is one of these for now) ----------
  // gauge({ label, sub, width (share of the bar that is green), speed (bar lengths per second) }) -> true on a hit
  async function gauge(o = {}) {
    const width = o.width || 0.2, speed = o.speed || 0.8;
    const z0 = 0.08 + Math.random() * (0.84 - width);
    gLabel.textContent = o.label || 'Press SPACE when the marker is in the green!'; gSub.textContent = o.sub || '';
    gZone.style.left = z0 * 100 + '%'; gZone.style.width = width * 100 + '%'; gMark.style.left = '0%';
    gaugeEl.classList.remove('st-hit', 'st-miss'); gaugeEl.classList.add('st-on'); hideDlg();
    let p = 0, dir = 1, t = 0, res = null; presses = 0;
    const want = AUTO ? ((AUTO === 'hit' || AUTO === 'miss') ? AUTO === 'hit' : AUTO[gaugeN % AUTO.length] === 'h') : null; gaugeN++;
    await mark('gauge');
    await until((dt) => {
      t += dt;
      p += dir * speed * dt; if (p > 1) { p = 2 - p; dir = -1; } else if (p < 0) { p = -p; dir = 1; }
      gMark.style.left = p * 100 + '%';
      const inside = p >= z0 && p <= z0 + width;
      if (AUTO) { if (t > 0.5 && (want ? p > z0 + 0.02 && p < z0 + width - 0.02 : p < z0 - 0.1 || p > z0 + width + 0.1)) { res = inside; return true; } return false; }
      if (presses > 0 && t > 0.25) { presses = 0; res = inside; return true; }
      presses = 0; return false;
    });
    gaugeEl.classList.add(res ? 'st-hit' : 'st-miss');
    await wait(0.45);
    gaugeEl.classList.remove('st-on');
    return res;
  }

  // ---------- emotes: a small bubble that pops over a head ----------
  const EMOTES = ['exclaim', 'question', 'dots', 'anger', 'sweat', 'music', 'zzz', 'idea', 'heart', 'scribble'];
  const emoTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 128 * EMOTES.length; cv.height = 128; const x = cv.getContext('2d');
    EMOTES.forEach((name, i) => {
      x.save(); x.translate(i * 128 + 64, 60);
      x.fillStyle = '#fffaf0'; x.strokeStyle = '#2b1d47'; x.lineWidth = 5;
      x.beginPath(); x.ellipse(0, 0, 50, 44, 0, 0, PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(-12, 40); x.lineTo(0, 62); x.lineTo(14, 38); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#fffaf0'; x.fillRect(-14, 30, 30, 12);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 64px Georgia, serif';
      const put = (ch, col, dy = 2, font) => { if (font) x.font = font; x.fillStyle = col; x.fillText(ch, 0, dy); };
      if (name === 'exclaim') put('!', '#d6302a');
      else if (name === 'question') put('?', '#3058c8');
      else if (name === 'dots') put('...', '#2b1d47', -8, 'bold 52px Georgia, serif');
      else if (name === 'music') put('♪', '#c0409a');
      else if (name === 'zzz') put('z Z', '#3058c8', 0, 'bold 40px Georgia, serif');
      else if (name === 'idea') put('✦', '#e0a010');
      else if (name === 'anger') { x.strokeStyle = '#d6302a'; x.lineWidth = 9; x.lineCap = 'round'; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.arc(a * 22, b * 20, 14, Math.atan2(-b, -a) - 0.9, Math.atan2(-b, -a) + 0.9); x.stroke(); } }
      else if (name === 'sweat') { x.fillStyle = '#58a8f0'; x.beginPath(); x.moveTo(0, -30); x.bezierCurveTo(22, 2, 20, 26, 0, 26); x.bezierCurveTo(-20, 26, -22, 2, 0, -30); x.fill(); }
      else if (name === 'heart') { x.fillStyle = '#e8407a'; x.beginPath(); x.moveTo(0, 26); x.bezierCurveTo(-46, -6, -24, -40, 0, -16); x.bezierCurveTo(24, -40, 46, -6, 0, 26); x.fill(); }
      else if (name === 'scribble') { x.strokeStyle = '#2b1d47'; x.lineWidth = 5; x.beginPath(); for (let k = 0; k <= 40; k++) { const a = k * 0.62, r = 8 + k * 0.5; x.lineTo(Math.cos(a) * r * 1.3 - 4, Math.sin(a) * r * 0.75); } x.stroke(); }
      x.restore();
    });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const emotes = [];
  function emote(target, name = 'exclaim', sec = 1.1, lift = 0.32) {
    const tex = emoTex.clone(); tex.needsUpdate = true; tex.repeat.set(1 / EMOTES.length, 1); tex.offset.set(Math.max(0, EMOTES.indexOf(name)) / EMOTES.length, 0);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false, fog: false }));
    sp.renderOrder = 20; scene.add(sp);
    emotes.push({ sp, target, t: 0, sec, lift });
    return wait(sec);
  }
  const headOf = (o, out) => {                     // where the bubble goes: the top of whatever it is
    if (o.isVector3) return out.copy(o);
    if (o === anne) return out.set(anne.position.x, anne.position.y + (o.userData.emoteY || (A.metrics.height || 1.7) * (A.body ? A.body().h : 1) + 0.28), anne.position.z);
    return out.set(o.position.x, o.position.y + (o.userData.emoteY || 1.4), o.position.z);
  };
  const _e = V3();
  function updEmotes(dt) {
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i]; e.t += dt;
      const k = e.t / e.sec, pop = k < 0.15 ? sstep(0, 0.15, k) * 1.15 : k < 0.25 ? 1.15 - 0.15 * sstep(0.15, 0.25, k) : 1;
      headOf(e.target, _e); e.sp.position.set(_e.x, _e.y + e.lift + 0.05 * Math.sin(e.t * 9) * (k < 0.3 ? 1 : 0.3), _e.z);
      const d = camera.position.distanceTo(e.sp.position), sc = 0.085 * Math.max(2.2, d) * pop;      // about the same size on screen at any distance
      e.sp.scale.set(sc, sc, 1); e.sp.material.opacity = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      if (k >= 1) { scene.remove(e.sp); e.sp.material.map.dispose(); e.sp.material.dispose(); emotes.splice(i, 1); }
    }
  }

  // ---------- Anne under the story's control ----------
  let scriptV = 0, curClip = '';
  const tileC = (tx, ty, out = V3()) => out.set((tx + 0.5) * TILE, 0, (ty + 0.5) * TILE);
  const toPoint = (p, out = V3()) => (Array.isArray(p) ? tileC(p[0], p[1], out) : out.copy(p));
  function clip(name, fadeSec = 0.3) { if (name !== curClip) { curClip = name; A.playClip(name, fadeSec); } }
  function release() { curClip = ''; A.releaseClips(); }
  function place(p, yaw) { toPoint(p, anne.position); anne.position.y = 0; if (yaw !== undefined) anne.rotation.set(0, yaw, 0); }
  async function turnTo(target, sec = 0.25) {
    const p = target.isObject3D ? target.position : toPoint(target, _e);
    const y0 = anne.rotation.y, y1 = y0 + angle(Math.atan2(p.x - anne.position.x, p.z - anne.position.z) - y0); let t = 0;
    await until((dt) => { t += dt; anne.rotation.y = y0 + (y1 - y0) * sstep(0, 1, t / sec); return t >= sec; });
  }
  // walk([[tx, ty], Vector3, ...], { speed }): she walks the points in turn (scripted: no collision)
  async function walk(points, o = {}) {
    const speed = o.speed || 1.9; release();
    for (const raw of points) {
      const to = toPoint(raw, V3());
      await until((dt) => {
        const dx = to.x - anne.position.x, dz = to.z - anne.position.z, d = Math.hypot(dx, dz), step = speed * dt;
        if (d <= step || d < 0.02) { anne.position.x = to.x; anne.position.z = to.z; return true; }
        anne.rotation.y += angle(Math.atan2(dx, dz) - anne.rotation.y) * Math.min(1, dt * 10);
        anne.position.x += dx / d * step; anne.position.z += dz / d * step; scriptV = speed;
        return false;
      });
    }
    scriptV = 0;
  }
  // a small hop back (startled), in the direction away from `from`
  async function hop(from, dist = 0.5, sec = 0.28) {
    const p = from.isObject3D ? from.position : toPoint(from, V3());
    const dx = anne.position.x - p.x, dz = anne.position.z - p.z, d = Math.hypot(dx, dz) || 1, x0 = anne.position.x, z0 = anne.position.z; let t = 0;
    await until((dt) => { t += dt; const k = Math.min(1, t / sec); anne.position.x = x0 + dx / d * dist * k; anne.position.z = z0 + dz / d * dist * k; anne.position.y = 0.16 * Math.sin(PI * k); return k >= 1; });
    anne.position.y = 0;
  }

  // ---------- the cinematic camera ----------
  // A shot is a goal (where the camera is, what it looks at, the lens); the camera eases to it or cuts. Goals are
  // placed through camera.js, so a shot never ends up in the forest wall or inside a tree.
  // (10-03) Two of the Motion Reel Kit's rules, for every scene the story plays (`?camkit=0`: as it was before):
  //  - a move that is not a cut is a closed-form spring (critically damped, the kit's camera spring), not a blend that
  //    starts at full speed: the goal's change is one spring, and a new goal in mid-move adds another without restarting
  //    the first (`segs`: the camera is the goal less what is left of each move), so the camera eases off AND on;
  //  - every held shot keeps moving: it is pushed in 4.5 % over its first nine seconds and drifts a few millimetres
  //    (seeded noise). A cut is still a cut (and cuts the lens too). `still: true` on a shot keeps it dead still (the
  //    brush clean-up, which is played with the mouse).
  const cam = { on: false, pos: V3(), look: V3(), gPos: V3(), gLook: V3(), fov: 50, gFov: 50, rate: 3.2, baseFov: camera.fov, focus: null, fK: 1, follow: null, clock: 0, shotT: 0, cutNow: true, still: false };
  const CAMKIT = !/[?&]camkit=0/.test(location.search), segs = [], lastGoal = { p: V3(), l: V3(), f: 50 };
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const noise1 = (seed) => { const r = mulberry32(seed), v = Array.from({ length: 256 }, () => r() * 2 - 1); return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 255] + (v[(i + 1) & 255] - v[i & 255]) * u; }; };
  const camN1 = noise1(4111), camN2 = noise1(5227), camN3 = noise1(6359);
  const _p = V3(), _q = V3(), _r = V3();
  // The wanted bearing first; if a tree or the forest wall is in the way of the camera or of its view of the
  // subjects (`see`), the nearest bearing, height and distance from which they can all be seen.
  const TRY = [];
  for (const dp of [0, 0.2, 0.42, 0.7]) for (const dy of [0, 0.3, -0.3, 0.6, -0.6, 0.95, -0.95, 1.35, -1.35, 1.9, -1.9, 2.5, -2.5, PI]) for (const k of [1, 0.8, 1.25, 0.6])
    TRY.push([dy, dp, k, Math.abs(dy) + dp * 1.3 + Math.abs(k - 1) * 0.9]);
  TRY.sort((a, b) => a[3] - b[3]);
  const _c = V3();
  // things the area's story puts in the world that a shot must not sit in or look through (vine walls, Ivy Maidens,
  // the great flower): upright cylinders { p (a Vector3, read live), r, h, on() }
  const avoid = [];
  function inAvoid(p, pad) { for (const a of avoid) { if (p.y > a.h || (a.on && !a.on())) continue; const dx = p.x - a.p.x, dz = p.z - a.p.z, r = a.r + pad; if (dx * dx + dz * dz < r * r) return true; } return false; }
  const _s = V3();
  function sees(from, to, stop) {                  // nothing of the story's stands on the line (the last `stop` metres excepted: the subject itself)
    if (!avoid.length) return true;
    const len = from.distanceTo(to), n = Math.max(2, Math.ceil(len / 0.25));
    for (let i = 1; i < n; i++) { if (len * (1 - i / n) < stop) break; if (inAvoid(_s.lerpVectors(from, to, i / n), 0.05)) return false; }
    return true;
  }
  // ---------- (10-05, as he said: "there's a flower and bush blocking the view") ----------
  // The bushes that line every clearing are not solid for the camera (camera.js knows walls, crowns and conifers), and a
  // shot placed by hand (cam.set) was tested against nothing: the low shot before Boudicca's pounce sat inside a blooming
  // bush. Now no shot is cut to from inside a bush, nor with one on the first metres of its line of sight: a placed shot
  // (shotGoal) passes over such a bearing, a shot given by hand is moved the least way that clears it (clearOfBush).
  // `o.bush: true` on a shot leaves it where it was put.
  const BUSH = /[?&]bushfix=0/.test(location.search) ? [] : (ctx.bushes || []), BPAD = 0.28;       // (a bush's sprigs and blossoms stand that far out of its dome; tests: &bushfix=0 leaves every shot where it was put)
  function inBush(p, pad = BPAD) {
    for (const b of BUSH) { const dx = p.x - b.x, dz = p.z - b.z, R = b.r + pad, q = (dx * dx + dz * dz) / (R * R); if (q >= 1) continue; const dy = (p.y - b.y) / (b.h + pad); if (q + dy * dy < 1) return true; }
    return false;
  }
  function bushBefore(from, to, reach = 2.5) {      // on the first `reach` metres of the line, and not at its far end (what stands far off is scenery)
    if (!BUSH.length) return false;
    const len = from.distanceTo(to), far = Math.min(reach, len - 0.7); if (far <= 0) return false;
    for (let d = 0; d <= far; d += 0.12) if (inBush(_s.lerpVectors(from, to, d / len), 0.08)) return true;
    return false;
  }
  const BMOVE = [];                                 // the moves tried, the least first: towards what it looks at, sideways, up, and mixes of them
  for (const d of [0.35, 0.7, 1.05, 1.4, 1.8, 2.3]) for (const [f, r, u, w] of [[1, 0, 0, 1], [0, 1, 0, 1.1], [0, -1, 0, 1.1], [0, 0, 0.6, 1.25], [0.7, 0.7, 0, 1.15], [0.7, -0.7, 0, 1.15], [0.7, 0, 0.45, 1.2], [0, 0.7, 0.45, 1.3], [0, -0.7, 0.45, 1.3], [-1, 0, 0.3, 1.5]]) BMOVE.push([f * d, r * d, u * d, d * w]);
  BMOVE.sort((a, b) => a[3] - b[3]);
  const camFix = typeof window !== 'undefined' ? (window.__camFix = []) : [];      // (tests: every shot that was moved, from where to where)
  function clearOfBush(p, look) {
    _q.subVectors(look, p).setY(0); const L = _q.length(); if (L < 1e-3) return false; _q.divideScalar(L);
    for (const strict of [true, false]) for (const [f, r, u] of BMOVE) {
      if (f > 0 && f > L - 0.9) continue;           // (never forward up to what it looks at; a close-up may still step aside or up)
      _c.set(p.x + _q.x * f + _q.z * r, p.y + u, p.z + _q.z * f - _q.x * r);
      if (inBush(_c) || bushBefore(_c, look) || inAvoid(_c, 0.4)) continue;
      // (first only to a place that is free and sees what the shot looks at: not a bush before the lens traded for a trunk before the subject)
      if (strict && ((ctx.camFree && !ctx.camFree(_c, 0.3)) || (ctx.camSight && !ctx.camSight(_c, look, 0.1, 0.8)) || !sees(_c, look, 0.9))) continue;
      if (camFix.length < 200) { camFix.push([p.toArray().map((x) => +x.toFixed(2)), _c.toArray().map((x) => +x.toFixed(2))]); console.log('CAMFIX ' + camFix[camFix.length - 1].map((v) => v.join(',')).join(' > ')); }
      p.copy(_c); return true;
    }
    return false;
  }
  function shotGoal(look, yaw, pitch, dist, o = {}) {
    cam.gLook.copy(look);
    let found = false;
    if (ctx.camFree && ctx.camSight) {
      const see = o.see || [look];
      for (const [dy, dp, k] of TRY) {
        const y = yaw + dy, p = Math.min(1.35, pitch + dp), d = dist * k;
        _c.set(look.x + Math.sin(y) * Math.cos(p) * d, look.y + Math.sin(p) * d, look.z + Math.cos(y) * Math.cos(p) * d);
        if (_c.y < (o.minY || 0.25) || !ctx.camFree(_c, 0.45) || inAvoid(_c, o.near || 0.5) || (!o.bush && inBush(_c))) continue;      // (minY: a shot of her feet may sit lower; near: how close to the story's things)
        let ok = true; for (const sp of see) if (!ctx.camSight(_c, sp, 0.1, 0.8) || (!o.through && !sees(_c, sp, 0.9)) || (!o.bush && bushBefore(_c, sp))) { ok = false; break; }      // (through: the story's own things may stand in the view)
        if (ok) { cam.gPos.copy(_c); found = true; break; }
      }
    }
    if (!found) {
      const got = ctx.camPlace ? ctx.camPlace(look, yaw, pitch, dist, cam.gPos) : -1;
      if (got < 0) cam.gPos.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    }
    cam.gFov = o.fov || cam.baseFov; cam.rate = o.rate || 3.2; cam.follow = null; cam.still = !!o.still;
    if (o.cut || !cam.on) { cam.pos.copy(cam.gPos); cam.look.copy(cam.gLook); cam.fov = cam.gFov; cam.cutNow = true; }
    cam.on = true;
    cam.focus = o.focus === undefined ? null : o.focus; cam.fK = o.focusK || 1.5;
  }
  const pointOf = (a, y, out) => { if (a === anne) return out.set(anne.position.x, y, anne.position.z); if (a.isObject3D) return out.set(a.position.x, a.position.y + y, a.position.z); return toPoint(a, out).setY(y); };
  Object.assign(cam, {
    // both in frame, seen from the side of the line between them. side: 1 | -1 | 0 (whichever has more room)
    two(a, b, o = {}) {
      pointOf(a, o.y || 1.15, _p); pointOf(b, o.y2 || o.y || 1.15, _q);
      if (ctx.camSight && !ctx.camSight(_p, _q, 0, 0.8)) {      // a tree stands between them: over a's shoulder, towards b
        const to = Math.atan2(_q.x - _p.x, _q.z - _p.z);
        return shotGoal(_p.clone().setY(1.3), to + PI + 0.3, 0.3, Math.min(5.5, (o.dist || 2.2) + 2), Object.assign({}, o, { see: [_p.clone()], fov: 0 }));
      }
      const look = _r.copy(_p).add(_q).multiplyScalar(0.5), sep = _p.distanceTo(_q), along = Math.atan2(_q.x - _p.x, _q.z - _p.z);
      const dist = (o.dist || 2.2) + sep * (o.k || 0.85), pitch = o.pitch === undefined ? 0.22 : o.pitch, off = o.off === undefined ? PI / 2 : o.off;
      let side = o.side || 0;
      if (!side && ctx.camRoom) side = ctx.camRoom(look, along + off, pitch, dist) >= ctx.camRoom(look, along - off, pitch, dist) ? 1 : -1;
      shotGoal(look, along + (side || 1) * off, pitch, dist, Object.assign({ see: [_p.clone(), _q.clone()] }, o));
    },
    // a close-up: the camera in front of `a` (which faces `yaw`), a little to one side
    face(a, o = {}) {
      const yaw = (o.yaw !== undefined ? o.yaw : (a.isObject3D ? a.rotation.y : 0)) + (o.turn === undefined ? 0.45 : o.turn);
      pointOf(a, o.y || 1.5, _p);
      shotGoal(_p, yaw, o.pitch === undefined ? 0.04 : o.pitch, o.dist || 1.5, Object.assign({ fov: 34, focus: _p.clone(), focusK: 1.6 }, o));
    },
    // over her shoulder, the way the game's own camera sits: looking where she looks
    behind(a = anne, o = {}) {
      const yaw = (a.isObject3D ? a.rotation.y : 0) + PI + (o.turn || 0);
      pointOf(a, o.y || 1.3, _p);
      shotGoal(_p, yaw, o.pitch === undefined ? 0.36 : o.pitch, o.dist || 5.2, o);
    },
    // any point, seen from a bearing
    at(p, yaw, o = {}) { pointOf(p, o.y || 1.0, _p); shotGoal(_p, yaw, o.pitch === undefined ? 0.3 : o.pitch, o.dist || 5, o); },
    // keep looking at a moving thing from the current bearing
    track(a, y = 1.2) { cam.follow = { a, y }; },
    // exactly this camera, no search (for places the search does not know: the hollow under the hole trap)
    set(pos, look, o = {}) {
      cam.gPos.copy(pos); cam.gLook.copy(look);
      if ((o.cut || !cam.on) && !o.bush && BUSH.length && (inBush(cam.gPos) || bushBefore(cam.gPos, look))) clearOfBush(cam.gPos, look);
      cam.gFov = o.fov || cam.baseFov; cam.rate = o.rate || 3.2; cam.follow = null; cam.still = !!o.still;
      if (o.cut || !cam.on) { cam.pos.copy(cam.gPos); cam.look.copy(cam.gLook); camera.fov = cam.gFov; camera.updateProjectionMatrix(); cam.cutNow = true; }
      cam.on = true; cam.focus = o.focus === undefined ? null : o.focus; cam.fK = o.focusK || 1.5;
    },
  });
  function updCam(dt) {
    if (!cam.on) return;
    if (cam.follow) { pointOf(cam.follow.a, cam.follow.y, _p); cam.gLook.copy(_p); }
    if (!CAMKIT) {                                   // (as it was: a blend that starts at full speed, a held shot dead still)
      const k = 1 - Math.exp(-dt * cam.rate);
      cam.pos.lerp(cam.gPos, k); cam.look.lerp(cam.gLook, 1 - Math.exp(-dt * cam.rate * 1.3));
      camera.position.copy(cam.pos); camera.lookAt(cam.look);
      if (Math.abs(camera.fov - cam.gFov) > 0.01) { camera.fov += (cam.gFov - camera.fov) * k; camera.updateProjectionMatrix(); }
      if (ctx.setFocus) ctx.setFocus(cam.focus, cam.fK);
      return;
    }
    cam.clock += dt; const T = cam.clock;
    if (cam.cutNow) { segs.length = 0; cam.cutNow = false; cam.shotT = T; }
    else {
      const dp = _q.subVectors(cam.gPos, lastGoal.p), dl = _r.subVectors(cam.gLook, lastGoal.l), df = cam.gFov - lastGoal.f;
      if (dp.lengthSq() > 1e-10 || dl.lengthSq() > 1e-10 || Math.abs(df) > 1e-4) {      // the goal has changed: one more spring (a rate of 3.2 settles in about a second, as the blend did)
        const resp = 4 / Math.max(0.5, cam.rate);
        segs.push({ t0: T, dp: dp.clone(), dl: dl.clone(), df, sp: { response: resp, damping: 1 }, sl: { response: resp / 1.3, damping: 1 } });
        if (dp.lengthSq() > 0.0625 || dl.lengthSq() > 0.0625) cam.shotT = T;      // (another shot, eased into: its push starts afresh)
      }
    }
    lastGoal.p.copy(cam.gPos); lastGoal.l.copy(cam.gLook); lastGoal.f = cam.gFov;
    cam.pos.copy(cam.gPos); cam.look.copy(cam.gLook); let fov = cam.gFov;
    for (let i = segs.length - 1; i >= 0; i--) {
      const g = segs[i], rp = 1 - Motion.step(T - g.t0, g.sp), rl = 1 - Motion.step(T - g.t0, g.sl);
      if (rp < 1e-4 && rl < 1e-4) { segs.splice(i, 1); continue; }
      cam.pos.addScaledVector(g.dp, -rp); cam.look.addScaledVector(g.dl, -rl); fov -= g.df * rp;
    }
    cam.fov = fov;
    if (cam.still) camera.position.copy(cam.pos);
    else {                                           // a held shot keeps moving: pushed in a little, drifting a little
      const d = cam.pos.distanceTo(cam.look), k = 1 / (1 + 0.045 * Math.min(1, (T - cam.shotT) / 9)), a = Math.min(0.012, 0.0035 * d);
      camera.position.set(cam.look.x + (cam.pos.x - cam.look.x) * k + a * camN1(T * 0.17 + 3.1),
        Math.max(cam.pos.y - 0.02, cam.look.y + (cam.pos.y - cam.look.y) * k + 0.6 * a * camN2(T * 0.15 + 7.7)),
        cam.look.z + (cam.pos.z - cam.look.z) * k + a * camN3(T * 0.19 + 1.3));
    }
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (ctx.setFocus) ctx.setFocus(cam.focus, cam.fK);
  }

  // ---------- events ----------
  const events = [], blockers = [];
  // on({ id, at: [tx, ty] | Vector3, r (metres), touch: true | action: 'E — ...', when(), once, run(ev), solid (metres) })
  function on(ev) {
    ev.p = toPoint(ev.at, V3()); ev.r = ev.r || (ev.touch ? 0.75 : 1.5); ev.armed = true;
    if (gone().includes(ev.id)) return null;
    events.push(ev);
    if (ev.solid) block(ev.id, ev.p.x, ev.p.z, ev.solid);
    return ev;
  }
  function block(id, x, z, r) { blockers.push({ id, x, z, r }); }
  function moveBlock(id, x, z) { for (const b of blockers) if (b.id === id) { b.x = x; b.z = z; } }      // (a blocker that walks about: a wandering creature)
  function unblock(id) { for (let i = blockers.length - 1; i >= 0; i--) if (blockers[i].id === id) blockers.splice(i, 1); }
  function remove(ev, forever = true) {
    const id = typeof ev === 'string' || typeof ev === 'number' ? ev : ev.id;
    for (let i = events.length - 1; i >= 0; i--) if (events[i].id === id) events.splice(i, 1);
    unblock(id);
    if (forever && !gone().includes(id)) { gone().push(id); save(); }
  }
  const near = (ev, r = ev.r) => Math.hypot(anne.position.x - ev.p.x, anne.position.z - ev.p.z) <= r;
  const usable = (ev) => !ev.when || ev.when();
  function actionEvent() { let best = null, bd = 1e9; for (const ev of events) { if (!ev.action || !usable(ev)) continue; const d = Math.hypot(anne.position.x - ev.p.x, anne.position.z - ev.p.z); if (d <= ev.r && d < bd) { bd = d; best = ev; } } return best; }

  // ---------- scenes ----------
  let running = null, autoQueue = [];
  const actors = [];                               // things with update(dt, t) that live in this area
  function begin() { if (active) return; active = true; armed = false; presses = 0; moves = 0; cam.on = false; cam.baseFov = camera.fov; cam.pos.copy(camera.position); camera.getWorldDirection(_p); cam.look.copy(camera.position).addScaledVector(_p, 5); scriptV = 0; if (ctx.onBegin) ctx.onBegin(); }
  function finish() {
    hideDlg(); choiceEl.classList.remove('st-on'); gaugeEl.classList.remove('st-on');
    if (Math.abs(camera.fov - cam.baseFov) > 0.01) { camera.fov = cam.baseFov; camera.updateProjectionMatrix(); }
    if (ctx.setFocus) ctx.setFocus(null);
    cam.on = false; scriptV = 0; curClip = ''; active = false; running = null; if (vLoop) voiceLoop(null);
    A.setExpression('neutral'); if (A.setTalking) A.setTalking(false); if (A.setToeWiggle) A.setToeWiggle(0); if (A.setHat) A.setHat(true);
    if (S.onSceneEnd) S.onSceneEnd();
    // (10-05: not once she has left for another area, S.go: `leaveFor` has saved where Continue must take her, and this
    // wrote the area she is leaving over it. Found by review in the dungeon's last scene; the forest's edge had it too.)
    if (!closed) save(true);
    if (ctx.onEnd) ctx.onEnd();
  }
  // run(fn): play a scene. Scenes do not nest: a scene started from inside a scene simply runs as part of it.
  function run(fn, ev) {
    if (running) return fn(ev);
    begin();
    running = Promise.resolve().then(() => fn(ev)).catch((e) => { console.error('story scene failed', e); if (ctx.showErr) ctx.showErr(e); }).then(() => { if (!held) finish(); });
    return running;
  }
  function objective(text) { state.flags.goal = text || ''; goalEl.innerHTML = text ? '<b>◆</b> ' + tx(text) : ''; }
  objective(state.flags.goal);

  // ---------- frame ----------
  const S = {
    THREE, scene, camera, state, save, on, remove, block, unblock, moveBlock, near, run, mark, wait, frame, until,
    say, choice, gauge, toast, note, fade, night, setNight, card, emote, objective,
    clip, release, place, turnTo, walk, hop, cam, tileC, toPoint, actors, events,
    anne, A, level, LV, TILE, V3, sstep, angle, pickOne,
    get progress() { return state.progress; }, set progress(v) { state.progress = v; save(); },
    flag: (k, v) => { if (v === undefined) return !!state.flags[k]; state.flags[k] = v; save(); return v; },
    addHerbs(n) { state.herbs += n; setHud(); if (ctx.onCounts) ctx.onCounts(state.herbs, state.coins); save(); },
    counts(h, c) { state.herbs = h; state.coins = c; setHud(); save(); },
    setFade, hadSave: () => hadSave, expr: (n, b) => A.setExpression(n, b),
    go: (lv, at, dir) => ctx.go(lv, at, dir),
    isAuto: !!AUTO, isActive: () => active,
    onSpeak: null, onArrive: null, onSceneEnd: null, blockExit: null, hint: null, grassFlat: null,
    avoid: (p, r, h = 2.4, on = null) => { avoid.push({ p: p.isObject3D ? p.position : p, r, h, on }); },
    late: [],                                        // functions (dt, t) run every frame AFTER her clips are applied: whatever touches her (vines on her soles) reads this frame's pose
    // her toes wiggle on top of whatever clip plays: never for long. One wiggle of `sec` seconds, then they are still.
    // her toes move: ONE short wiggle (sec seconds, then they are still) for a look at her feet in a line of dialogue;
    // sec = Infinity while something is tickling them (the scene ends it with toes(0))
    toes: (amp, rate, sec = 1.6) => { if (A.setToeWiggle) A.setToeWiggle(amp, rate); toeT = amp > 0 ? sec : 0; },
    time: () => now,
    se, voice, voiceLoop,
  };
  // Where she stands is saved when a scene ends, when she arrives, every few seconds of walking about and when the page
  // is closed. Never in the middle of a scene (the save made before it stands), and not once she has left for another
  // area or the game has been reset (`closed`): the save already says what Continue must do.
  let live = false, closed = false, sinceSave = 0, toeT = 0;
  const savePlace = () => { if (live && !closed && !active && state.progress > 0 && !(ctx.busy && ctx.busy())) save(true); };
  addEventListener('pagehide', savePlace);
  const api = {
    S, ready,
    update(dt, t) {
      dt *= TS; now += dt;
      if (toeT > 0) { toeT -= dt; if (toeT <= 0 && A.setToeWiggle) A.setToeWiggle(0); }
      if (vLoop && (vLoop.t -= dt) <= 0) { vLoop.t = vLoop.every * (0.8 + Math.random() * 0.4); voice(vLoop.bank); }
      for (const a of actors) a.update(dt, now);
      updEmotes(dt);
      if (active) {
        if (waiters.size) for (const w of [...waiters]) if (w.fn(dt)) { waiters.delete(w); w.res(); }
        armed = true;
        return;
      }
      if (waiters.size) for (const w of [...waiters]) if (w.fn(dt)) { waiters.delete(w); w.res(); }      // (toasts and fades may run outside scenes)
      // touch events: fire on walking in, re-arm on walking out (not while a scene of the area's own is playing: the hollow log)
      if (!(ctx.busy && ctx.busy())) for (const ev of events) {
        if (!ev.touch) continue;
        const inside = near(ev);
        if (!inside) { ev.armed = true; continue; }
        if (ev.armed && usable(ev)) { ev.armed = false; run(ev.run, ev); break; }
      }
      if (!active && autoQueue.length) { const fn = autoQueue.shift(); run(fn); }
      if ((sinceSave += dt) > 8) { sinceSave = 0; savePlace(); }
    },
    lateUpdate(dt) { for (const f of S.late) f(dt * TS, now); if (active) updCam(dt * TS); },
    isActive: () => active,
    anneSpeed: () => scriptV,
    promptText() { if (active) return null; const ev = actionEvent(); return ev ? ev.action : null; },
    interact() { if (active) return; const ev = actionEvent(); if (ev) run(ev.run, ev); },
    obstacles: () => blockers,
    blockExit: (ex) => (S.blockExit ? S.blockExit(ex) : false),
    arrive: (how) => { live = true; if (S.onArrive) S.onArrive(how); if (how !== 'wrap') savePlace(); },
    auto: (fn) => autoQueue.push(fn),              // a scene to start by itself as soon as the game is running
    hasSave: () => hadSave,
    reset() { closed = true; try { localStorage.removeItem(SAVE); } catch (e) { /* no storage */ } },
    leaveFor(level, at) { state.level = level; state.at = at || null; save(); closed = true; },      // (she is on her way to another area: that is where Continue must take her)
    grassFlat: () => (S.grassFlat ? S.grassFlat() : null),
    // (tests, ?ev=<event id>) stand her next to an event, facing it, and start it
    runEvent(id, walkable) {
      const ev = events.find((e) => String(e.id) === String(id)); if (!ev) return false;
      if (walkable) {
        let best = null;
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * PI * 2, d = ev.touch ? ev.r + 0.25 : Math.min(ev.r - 0.1, 1.3), x = ev.p.x + Math.sin(a) * d, z = ev.p.z + Math.cos(a) * d;
          if (!walkable(x, z)) continue;
          let room = 0; for (let k = 1; k <= 6; k++) { if (!walkable(ev.p.x + Math.sin(a) * (d + k * 0.5), ev.p.z + Math.cos(a) * (d + k * 0.5))) break; room = k; }
          if (!best || room > best.room) best = { x, z, room, a };
        }
        if (best) { anne.position.set(best.x, 0, best.z); anne.rotation.set(0, best.a + PI, 0); }
      }
      run(ev.run, ev); return true;
    },
  };
  return api;
}
