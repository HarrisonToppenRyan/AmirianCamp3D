// scylla.js: Scylla, the owner of the caves (the 2D game's CE 80 "SceneSCYLLA", stage CAPTURE3, the only one a
// Chapter 1 player sees: by missing all four bouts of the cave pit). Rebuilt clothed, as everything in this game: the pit's
// floor gives way to her grotto; Anne lands on a rock by a black pool, her shoes already gone; Scylla rises in the water,
// a woman above and a skirt of purple tentacles below, coils two of them round Anne's ankles (and her big toes) to hold
// her legs out over the water, and tickles her bare soles with the tips of the others: laughter, then helpless cackling.
// Up to four "Kick free!" gauges, further apart each time; a hit = Anne's burst of light, "LIMBS OFF!!", and she climbs
// out; four misses = she passes out laughing and comes round at the cave's statue.
// Scylla is a second figure made from Anne's model (as the thief, Boudicca and Lilith are): lavender-grey skin, long
// messy charcoal hair, violet eyes, a wrap of dark kelp for a top. (Her 2D portrait is not used: it draws her topless.)
const V = new URL(import.meta.url).search;
const { createThief } = await import('./thief.js' + V);

export const SCYLLA_LOOK = {
  name: 'Scylla',
  hide: ['Anne_Hat', 'Anne_HatBand', 'Anne_Cuffs', 'Anne_CuffTrim'],
  iris: [[0.85, 0.45, 1.0], [0.35, 0.05, 0.6]],
  hair: { base: [0.075, 0.072, 0.085], right: [0.16, 0.16, 0.18], left: [0.16, 0.16, 0.18] },
  tint: {
    Anne_Skin: (m) => { m.color.multiply({ r: 0.84, g: 0.78, b: 0.96 }); }, Anne_SkinShod: (m) => { m.color.multiply({ r: 0.84, g: 0.78, b: 0.96 }); },
    Anne_GlovePaint: (m) => { m.color.multiply({ r: 0.84, g: 0.78, b: 0.96 }); },
    Anne_Suit: (m) => { m.color.setRGB(0.05, 0.13, 0.10); m.roughness = 0.5; m.metalness = 0.1; },      // (dark kelp)
    Anne_Trim: (m) => { m.color.setRGB(0.55, 0.47, 0.38); m.roughness = 0.3; },                        // (shell)
    Anne_Choker: (m) => { m.color.setRGB(0.55, 0.47, 0.38); }, Anne_Brow: [0.12, 0.12, 0.14],
  },
};

export function createScylla(S, C, cap, env) {
  const { THREE, scene, anne, A, V3 } = S, { sparks, feet, along } = C, stg = cap.stage, kit = cap.kit, ties = cap.ties;
  const PI = Math.PI, damp = THREE.MathUtils.damp;
  const PURP0 = new THREE.Color(0.32, 0.12, 0.42), PURP1 = new THREE.Color(0.62, 0.36, 0.78);
  const scy = createThief(S, C, { look: SCYLLA_LOOK, idle: 'ThiefIdle' });
  if (typeof window !== 'undefined') window.__scy = { scy };      // (tests)

  // ---------- the grotto: a hollow of rock under the pit, out of the way of the cave itself ----------
  const G0 = V3(-38, 0, -38), SEAT = 0.30, WATER = 0.04;
  const set = new THREE.Group(); set.visible = false; scene.add(set);
  const rockT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#2a2833'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) { const l = 30 + Math.random() * 40; x.fillStyle = `rgba(${l},${l},${l + 12},0.5)`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 14, 0, PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3); return t; })();
  let rockMesh = null;
  { const dome = new THREE.Mesh(new THREE.SphereGeometry(7.6, 48, 28, 0, PI * 2, 0, PI * 0.62), new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95, side: THREE.BackSide }));
    dome.position.copy(G0).add(V3(1.0, -0.6, 0)); dome.scale.set(1, 0.58, 0.9); set.add(dome);      // (10-03: roomy enough for the tied scene's cameras too)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7.4, 48), new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95 })); floor.rotation.x = -PI / 2; floor.position.copy(G0).add(V3(1.0, 0.0, 0)); floor.receiveShadow = true; set.add(floor);
    // the black pool before her rock
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshStandardMaterial({ color: 0x0a1c22, roughness: 0.08, metalness: 0.4, emissive: 0x03100f })); pool.rotation.x = -PI / 2; pool.position.copy(G0).add(V3(2.55, WATER, 0)); pool.receiveShadow = true; set.add(pool);
    // her rock (a flat top at SEAT)
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, SEAT, 9), new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.9 })); rock.position.copy(G0).add(V3(-0.12, SEAT / 2, 0)); rock.castShadow = rock.receiveShadow = true; set.add(rock); rockMesh = rock;
    // crystals glowing in the walls, a teal light from the water, and the light falling from the pit above
    for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36, c = C.K.makeCrystalPlant(i * 5 + 2, i % 3 === 0 ? new THREE.Color(0.7, 0.4, 1.0) : null); c.obj.position.copy(G0).add(V3(1.5 + Math.cos(a) * 3.9, 0, Math.sin(a) * 3.4)); c.obj.rotation.y = a; set.add(c.obj); }
    const l1 = new THREE.PointLight(0x58d8c8, 2.2, 6, 1.5); l1.position.copy(G0).add(V3(2.5, 0.4, 0)); set.add(l1);
    const l2 = new THREE.PointLight(0xb08cff, 1.4, 7, 1.5); l2.position.copy(G0).add(V3(0.6, 2.6, -1.2)); set.add(l2);
    const shaft = C.K.makeLightShaft(5, 0.55); shaft.obj.position.copy(G0).add(V3(-0.1, 0, 0)); set.add(shaft.obj); }

  // ---------- her tentacles: a skirt at the waterline, two holding Anne's ankles, four at her soles ----------
  const skirt = [0, 1, 2, 3, 4, 5].map(() => kit.makeVine(PURP0, PURP1, 18, 8));
  const holders = [0, 1].map(() => kit.makeVine(PURP0, PURP1, 18, 8));
  const tips = [0, 1, 2, 3].map(() => kit.makeVine(PURP0, PURP1, 22, 8));
  const T = { on: false, tick: 0, rate: 1, mode: ['stroke', 'toes', 'arch', 'stroke'], holders: true, lickTip: null };
  const _w = V3(), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _q = V3(), UPV = V3(0, 1, 0);
  function waist(out) { const b = scy.tw && scy.tw.bone('spine05'); if (b) b.getWorldPosition(out); else out.copy(scy.obj.position).setY(WATER + 0.1); out.y = Math.max(out.y, WATER + 0.05); return out; }
  function update(dt, t) {
    if (!T.on || !scy.obj || !scy.obj.visible) { for (const v of [...skirt, ...holders, ...tips, lickVine]) v.hide(); return; }      // (not before she is there)
    waist(_w);
    skirt.forEach((v, i) => {                            // out over the water and curling up at the tips
      const a = i / 6 * PI * 2 + 0.3 * Math.sin(t * 0.7 + i), sw = 0.12 * Math.sin(t * 1.6 + i * 1.3);
      const dx = Math.cos(a), dz = Math.sin(a);
      _a.set(_w.x + dx * 0.12, WATER + 0.06, _w.z + dz * 0.12); _b.set(_w.x + dx * 0.45, WATER + 0.02, _w.z + dz * 0.45);
      _c.set(_w.x + dx * 0.8 - dz * sw, WATER + 0.05, _w.z + dz * 0.8 + dx * sw); _d.set(_w.x + dx * 0.95 - dz * sw * 1.6, WATER + 0.22 + 0.06 * Math.sin(t * 2 + i), _w.z + dz * 0.92 + dx * sw * 1.6);
      v.draw(_a, _b, _c, _d, UPV, 0.055, 0.012);
    });
    // two up out of the water to her ankles (the coil itself is ties.js's, in purple)
    holders.forEach((v, j) => {
      const f = feet[j]; if (!f.shin || !T.holders) { v.hide(); return; } f.shin.getWorldPosition(_a); f.foot.getWorldPosition(_b); _a.lerp(_b, 0.82);
      _c.set(_w.x + (j ? 0.15 : -0.15), WATER, _w.z - 0.2); _d.lerpVectors(_c, _a, 0.5); _d.y = WATER - 0.05; _q.lerpVectors(_c, _a, 0.85); _q.y -= 0.12;
      v.draw(_c, _d, _q, _a, UPV, 0.045, 0.02);
    });
    // four at her soles: their tips ride the soles (heel to ball, under the toes, circles at the arch), a hair above the skin
    T.tick += dt * T.rate;
    tips.forEach((v, i) => {
      const f = feet[i % 2], ph = i * 1.7 + T.tick, mode = T.mode[i]; let u, s;
      if (mode === 'stroke') { u = 0.1 + 0.8 * (0.5 - 0.5 * Math.cos(PI * 2 * 0.7 * ph)); s = 0.012 * Math.sin(1.3 * ph); }
      else if (mode === 'toes') { u = 1.18 + 0.07 * Math.sin(PI * 2 * 0.6 * ph); s = 0.024 * Math.sin(PI * 2 * 1.2 * ph); }
      else { u = 0.5 + 0.13 * Math.cos(PI * 2 * 0.9 * ph); s = 0.016 * Math.sin(PI * 2 * 1.4 * ph); }
      along(f, u, _q).addScaledVector(f.side, s).addScaledVector(f.n, 0.007);
      _a.set(_w.x + (i % 2 ? 0.1 : -0.1), WATER + 0.06, _w.z + (i < 2 ? -0.08 : 0.08));
      _d.copy(_q).addScaledVector(f.n, 0.04).addScaledVector(f.fwd, -0.05);
      _b.lerpVectors(_a, _q, 0.45); _b.y += 0.28;
      v.draw(_a, _b, _d, _q, f.n, 0.03, 0.0045);
    });
    // (tied) the tentacle whose tip licks: up out of the water to the point the capture kit moves to her sole
    if (T.lickTip) { _a.set(_w.x, WATER + 0.06, _w.z); _b.lerpVectors(_a, T.lickTip, 0.5); _b.y += 0.3; _d.lerpVectors(_a, T.lickTip, 0.85); _d.y += 0.08; lickVine.draw(_a, _b, _d, T.lickTip, UPV, 0.035, 0.012); } else lickVine.hide();
  }
  const lickVine = kit.makeVine(PURP0, PURP1, 22, 8);
  S.late.push((dt, t) => { if (set.visible) { scy.update(dt, t); update(dt, t); ties.update(); } });

  // ---------- the scene ----------
  const shots = {
    wide() { S.cam.set(G0.clone().add(V3(2.6, 1.8, -2.6)), G0.clone().add(V3(0.9, 0.5, 0.2)), { fov: 46, cut: true }); env.post.setCloseUp('off'); },
    soles() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x + 0.8, m.y + 0.46, m.z - 0.72), V3(m.x, m.y - 0.02, m.z + 0.04), { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); env.post.setCloseUp('on'); },
    face() { const h = C.headPos(); S.cam.set(V3(h.x + 0.95, h.y + 0.12, h.z - 0.75), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); env.post.setCloseUp('off'); },
    her() { const h = scy.head(V3()); h.y -= 0.12; S.cam.set(V3(h.x - 0.4, h.y + 0.05, h.z - 1.2), h, { fov: 36, cut: true }); env.post.setCloseUp('off'); },
  };
  const say = async (text, o = {}) => { scy.talk(true); await S.say('', 0, text, Object.assign({ name: 'Scylla' }, o)); scy.talk(false); };
  // (10-03) tied up instead (the player's choice, T): on her front at the pool's edge, purple cords of tentacle round her
  // ankles and big toes (ties.js 'tentacle'), the tips at her soles and one that licks (captures.js bound)
  let scyTongue = null;
  async function grottoTied(chained = false) {
    set.visible = true; C.amAt(V3(0, -60, 0)); C.am.hide(); if (rockMesh) rockMesh.visible = false;
    T.on = true; T.holders = false; T.rate = 1; T.mode = ['stroke', 'toes', 'arch', 'stroke'];
    const tip = V3(), tongue = scyTongue || (scyTongue = kit.makeTongue('#c48ae8')), scyLine = (text) => say(text);      // (one tongue for every visit: not a new mesh each time)
    let res = null;
    try {
      res = await cap.bound({ kind: 'scylla', list: [], keep: true, chained, seat: G0.clone().add(V3(-0.65, 0, 0)), yaw: PI / 2, theme: 'tentacle', tools: [],
        setup: ({ mid, out, side }) => { const at = V3().copy(mid).addScaledVector(out, 0.95).addScaledVector(side, 0.6).setY(-0.92); scy.show(at, Math.atan2(mid.x - at.x, mid.z - at.z)); scy.expr('smug'); tip.copy(mid).addScaledVector(out, 0.4).setY(0.3); },
        lick: [{ tongue, spot: [0.55, 0, 0.05], mouth: (o) => o.copy(tip), toward: (mouth, P, dt) => { tip.lerp(P, Math.min(1, dt * 8)); T.lickTip = tip; } }],
        say: async (stage) => {
          if (stage === 'open') await scyLine(chained ? 'Not so fast, morsel...\nScylla is not finished with those feet!' : 'What are you doing here, unwary ' + ((C.lookSay && C.lookSay('scylla').kind) || 'human') + '?\nTHIS IS THE HOME OF SCYLLA ! ! !');
          if (stage === 'tickle') await scyLine('Such soft little feet, washed down my drain...\nHow kind of the forest to feed me!');
          if (stage === 'lick') await scyLine('Hold still, morsel...\nlet me taste the forest on you!');
          if (stage === 'fast') { T.rate = 1.9; await scyLine('Wiggle all you like, little witch...\nmy limbs never tire!'); }
          if (stage === 'lost') await scyLine('Sleep, little morsel... come back and play\nwhenever you like. Scylla will be waiting.');
        },
      });
    } finally {
      T.on = false; T.holders = true; T.lickTip = null; tongue.hide(); scy.hide(); set.visible = false; if (rockMesh) rockMesh.visible = true; anne.position.y = 0;
    }
    return res && res.free ? 'free' : 'lost';
  }
  async function grotto() {
    const way = S.capStyle && cap.bound ? S.capStyle() : '2d';      // (10-03: 'both', the default: the 2D grotto, then tied up as the last round)
    if (way === 'tied') return grottoTied();
    set.visible = true; C.amAt(V3(0, -60, 0)); C.am.hide();      // (Amaymon keeps out of it: parked far below, out of every shot)
    // Anne on her rock, facing the pool; her shoes are already gone (the pit took them)
    S.place(G0, PI / 2); anne.position.y = SEAT; S.clip(A.hasClip('PumpkinHeld') ? 'PumpkinHeld' : 'SitFlat', 0); A.setHeelsWorn(false); C.snapSoles();
    stg.begin(G0.clone(), PI / 2, []);
    for (let i = 0; i < 3; i++) await S.frame();
    stg.soleFrame();
    const m = stg.mid.clone(), at = V3(m.x + 0.62, -0.92, m.z + 0.7);      // (in the water, beside her feet: her waist at the waterline)
    scy.show(at, Math.atan2(m.x - at.x, m.z - at.z)); scy.expr('smug');
    ties.look('tentacle'); ties.set({ on: true, k: 0, knot: 0, toe: 0, peg: 0, taut: 0, wrists: 0, hog: 0 }); T.on = true; T.rate = 1;
    shots.wide(); S.expr('shocked', 0.4);
    await S.fade(0, 0.8); await S.mark('scylla');
    S.toast('SPLASH!!', 'warning', 1.2); await S.wait(0.8);
    await say('What are you doing here, unwary ' + ((C.lookSay && C.lookSay('scylla').kind) || 'human') + '?\nTHIS IS THE HOME OF SCYLLA ! ! !');
    await S.say('a2', 12, 'A-AN OCTOPUS LADY?!\nG-get those wiggly things AWAY from me!!', { expr: 'shocked' });
    // the coil round her ankles and her big toes, close on her feet
    shots.soles();
    { let t = 0; await S.until((dt) => { t += dt; ties.set({ k: Math.min(1, t / 1.2), knot: Math.min(1, Math.max(0, (t - 1.2) / 0.3)), toe: Math.min(1, Math.max(0, (t - 1.6) / 0.6)) }); return t >= 2.3; }); }
    await say('Such soft little feet, washed down my drain...\nHow kind of the forest to feed me!');
    if (C.lookSay) { const R = C.lookSay('scylla'); await say(R.feet); await say(R.outfit); if (R.species) await say(R.species); }      // (batch 22: what she makes of her)
    await say(`And those ${((S.look && S.look()) || {}).nail || 'painted'} little toes...\nlike sweets in a shell!`);      // (10-03: the colour of her toenails, by its name)
    // laughter, then cackling; gauges further apart each time
    let free = false;
    const stages = [['laughter', 0.3, 1.0, 'stroke'], ['laughter', 0.36, 1.3, 'toes'], ['cackling', 0.44, 1.7, 'arch'], ['cackling', 0.5, 2.1, 'toes']];
    for (let n = 0; n < 4 && !free; n++) {
      const [bank, toes, rate] = stages[n];
      T.rate = rate; T.mode = n % 2 ? ['toes', 'arch', 'toes', 'stroke'] : ['stroke', 'toes', 'arch', 'stroke'];
      S.voiceLoop(bank, bank === 'cackling' ? 2.2 : 2.7); S.toes(toes, 1.6 + toes * 3, Infinity); S.expr('laughHard', 0.7 + 0.08 * n);
      shots.soles(); await S.wait(1.6 + n * 0.5); if (n === 0) await S.mark('stickle');
      shots.face(); await S.wait(1.2 + n * 0.4);
      if (n === 1) await say('Wiggle all you like, little witch...\nmy limbs never tire!');
      if (n === 2) await S.say('a2', 18, 'AHAHAHAHA!! N-NOT BETWEEN MY TOES!!\nAHAHAHAHAHA!!', { expr: 'laughHard', blush: 0.9 });
      shots.her(); await S.wait(0.8);
      free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: `the tentacles  ·  try ${n + 1} / 4`, width: [0.24, 0.21, 0.18, 0.15][n], speed: [0.8, 0.9, 1.0, 1.1][n] });
    }
    S.voiceLoop(null); S.toes(0);
    if (free) {
      // her burst of light: the tentacles let go, Scylla recoils into the pool, Anne climbs out
      S.toast('Limbs off, sushi Face!!|LIMBS OFF!!', 'dialog', 2.0);
      shots.wide(); S.expr('angry', 0.4);
      sparks.burst(stg.mid.clone(), new THREE.Color(1.7, 1.5, 0.9), 40, 2.4, 1.0); ties.burst((p) => sparks.burst(p, new THREE.Color(1.6, 1.3, 0.5), 14, 1.4, 0.7)); T.on = false;
      { const o = scy.obj, y0 = o.position.y; let t = 0; await S.until((dt) => { t += dt; o.position.y = y0 - 1.4 * Math.min(1, t / 0.8); return t >= 0.8; }); }
      await S.mark('sfree'); await S.wait(0.6);
    } else {
      await S.say('a2', 18, 'HAHAHAHAHA!! I C-CAN\'T... BREATHE...!!\nAHAHAHA...', { expr: 'laughHard', blush: 1.0 });
      if (way !== 'both') await say('Sleep, little morsel... come back and play\nwhenever you like. Scylla will be waiting.');      // (10-03: with the tied part still to come, she says it there)
      await S.mark('slost');
    }
    await S.fade(1, 0.6);
    T.on = false; ties.set({ on: false, k: 0, knot: 0, toe: 0 }); ties.update(); scy.hide(); set.visible = false; stg.end(); anne.position.y = 0;
    if (!free && way === 'both') return grottoTied(true);      // (on black: she is pulled down onto her front at the pool's edge)
    return free ? 'free' : 'lost';
  }
  return { grotto, scy };
}
