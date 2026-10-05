// story_nest.js: the Ivy Maidens' Nest, Alraune's lair under the flower glade of the North Forest (the 2D game's Map 20
// "IvyMaidenNest", GAME_PROGRESS 20 to 35). She jumps down the hole at tile (36,12) of the forest and lands in a pool of
// light under it; the vines on the hedge there take her back up. A hedge-maze garden that loops like the 2D map (west
// to east at row 9, north to south at column 21): Ivy Maidens stand in its openings, two pits wait under the moss, and
// in the east meadow, on a spit between two arms of the pond, Alraune waits in her flower. Beating her ends the forest's
// part of Chapter 1 (progress 30, and 35 a moment later): every vine and maiden here and in the forest is gone.
// Positions are the 2D map's own tiles. (Spec: STORY_SPEC.md, "The nest".)
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { creatureKit } = await import('./creatures.js' + V);
const { createTraps } = await import('./traps.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3, TILE } = S, C = common(S), { K, sparks } = C;
  const cap = createCaptures(S, C, env), kit = creatureKit(S, C, env, cap), { spot, add, back, fight, encounter, wakeUp } = kit, { GOLD, GREEN, PINK } = kit.col;
  const has = (n) => A.hasClip && A.hasClip(n), walkAt = env.walkAt, objs = S.level.objects || {};
  const WON = () => S.progress >= 30;
  // (the 2D gives the nest a faint green cast, R -16, B -16; it is lit from the hole above)
  S.night(0.45, 0); {                                                    // (a little more light while a scene plays: the dark is for exploring)
    const G = { k: -1 }, post = env.post;
    if (post && post.setGrade) S.actors.push({ update(dt) { const goal = S.isActive() ? 1 : 0, k0 = G.k; G.k = G.k < 0 ? goal : G.k + (goal - G.k) * Math.min(1, dt * 2.5); if (Math.abs(G.k - k0) > 1e-4) post.setGrade(0.93, 1.0, 0.93, 0.03, 0.9 + 0.1 * G.k); } });
  }

  // the nearest open ground to a hedge tile (within two tiles): the edge of that open tile, towards the hedge
  function edge(tx, ty) {
    if (walkAt(tx, ty)) return S.tileC(tx, ty);
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = dx * dx + dy * dy; if (d && d < bd && walkAt(tx + dx, ty + dy)) { bd = d; best = [dx, dy]; } }
    const p = S.tileC(tx, ty); if (!best) return p;
    const o = S.tileC(tx + best[0], ty + best[1]), d = V3().subVectors(p, o).normalize();
    return o.addScaledVector(d, TILE * 0.56);
  }

  // =====================================================================================================
  //                                                 the room
  // =====================================================================================================
  // the pool of light under the hole she came down, and the twisted vines up the hedge beside it: the way back up
  const LAND = S.tileC(5, 3), LADDER = S.tileC(5, 2);
  const shaft = add(K.makeLightShaft(8, 0.95)); shaft.obj.position.set(LAND.x + 0.35, 0, LAND.z + 0.45);
  const ladder = add(K.makeVineLadder(3.2, 5)); ladder.obj.position.set(LADDER.x, 0, LADDER.z + TILE * 0.5 - 0.06);
  // the crystal plants (the 2D draws them on the tile above their roots) and the scrap wood by the south chest
  (objs.crystal || []).forEach(([x, y], i) => { const c = add(K.makeCrystalPlant(i * 5 + 21, i === 1 ? new THREE.Color(0.3, 0.45, 1.0) : new THREE.Color(1.0, 0.85, 0.2))); c.obj.position.copy(S.tileC(x, y + 1)); c.obj.rotation.y = i * 1.9; });
  for (const [x, y] of objs.planks || []) {
    const p = S.tileC(x, y), g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x5a3f22 });
    [[0, 0.05, 0, 0.3, 1.1], [0.25, 0.1, 0.12, -0.5, 0.9], [-0.2, 0.08, -0.2, 1.1, 0.8]].forEach(([dx, y0, dz, a, L]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.2), wood); b.position.set(dx, y0, dz); b.rotation.set(0.12 * a, a, 0.1); b.castShadow = true; g.add(b); });
    g.position.copy(p); scene.add(g); S.block('planks' + x, p.x, p.z, 0.5);
  }

  // ---------- the vines on the hedges: decoration that wilts once Alraune is beaten ----------
  // (vine walls with a pink bud; and Ivy Maidens peeping out of the hedge, the 2D's "IvyMaidenWall")
  const deco = [];
  if (!WON()) {
    [[8, 1], [3, 6], [4, 9], [18, 6], [19, 5], [17, 5], [15, 5]].forEach(([x, y], i) => { const p = edge(x, y); deco.push(add(K.makeVineWall(p.x, p.z, 60 + i))); });
    [[1, 1], [2, 0], [14, 0], [7, 8], [11, 4]].forEach(([x, y], i) => {
      const p = edge(x, y), m = add(K.makeIvyMaiden({ seed: 70 + i, height: 1.25 })); m.obj.position.copy(p); m.faceTo(p.x + Math.sin(i * 2.3), p.z + 2); m.lean(0.25); deco.push(m);
    });
  }
  const wiltAll = () => { for (const d of deco) { if (d.wilt) d.wilt(); else if (d.sink) d.sink(); } };

  // ---------- finding the way (10-02: "very difficult to figure out where to go") ----------
  // The nest loops like its 2D map, and the way to Alraune uses both of its loops: up the stair cut in the north-east hedge
  // (it comes out on the south path), and west off the end of the west column (out on the east meadow). Her blossoms glow
  // along that way, the two places where the path runs on round to the other side stand under vine arches with lanterns
  // (A and B on the map, N), and the map shows where she is.
  const LOOPS = [[[21, 0], [21, 17]], [[0, 9], [23, 9]]];
  const route = (() => {                              // the shortest way from where she lands to Alraune, through the loops
    const key = (x, y) => x + ',' + y, from = [5, 3], to = [18, 10], prev = new Map([[key(...from), null]]), q = [from];
    while (q.length) {
      const [x, y] = q.shift(); if (x === to[0] && y === to[1]) break;
      const next = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [a, b] of LOOPS) { if (a[0] === x && a[1] === y) next.push(b); if (b[0] === x && b[1] === y) next.push(a); }
      for (const [nx, ny] of next) if (walkAt(nx, ny) && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); }
    }
    const out = []; for (let c = to; c; c = prev.get(key(...c))) out.unshift(c);
    return out[0] && out[0][0] === from[0] && out[0][1] === from[1] ? out : [];
  })();
  const trail = new THREE.Group(); scene.add(trail);
  {
    const parts = [], glowG = [], r = K.rng(515);
    route.forEach(([x, y], i) => {
      if (i < 2 || i > route.length - 2 || i % 2) return;
      const c = S.tileC(x, y), a = r() * 6.28, d = TILE * 0.33, p = V3(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d);
      parts.push(K.place(K.flower(0.09, 6, K.G.pink, K.G.pink2), V3(p.x, 0.06, p.z), V3(0, 1, 0)));
      for (let k = 0; k < 3; k++) parts.push(K.place(K.leaf(0.16, 0.08, 0.4, 0.25, k % 2 ? K.G.leaf : K.G.leaf2), V3(p.x, 0.02, p.z), V3(Math.cos(a + k * 2.1), 0.3, Math.sin(a + k * 2.1))));
      glowG.push(new THREE.SphereGeometry(0.035, 8, 6).translate(p.x, 0.085, p.z));
    });
    if (parts.length) {
      trail.add(new THREE.Mesh(K.merge(parts), K.MAT.plant));
      trail.add(new THREE.Mesh(K.merge(glowG), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 1.4), toneMapped: false })));
    }
  }
  // the vine arches over the four ends of the two loops, with lanterns of her flowers
  const lanternM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.85, 1.5), toneMapped: false });
  function arch([x, y], edge) {
    const c = S.tileC(x, y), across = edge === 'north' || edge === 'south' ? V3(1, 0, 0) : V3(0, 0, 1);
    const at = c.clone().add(V3(edge === 'west' ? -TILE * 0.46 : edge === 'east' ? TILE * 0.46 : 0, 0, edge === 'north' ? -TILE * 0.46 : edge === 'south' ? TILE * 0.46 : 0));
    const half = TILE * 0.5, H2 = 2.7;
    const legs = [-1, 1].map((sd) => K.tube([at.clone().addScaledVector(across, sd * half).setY(0), at.clone().addScaledVector(across, sd * (half - 0.05)).setY(H2 * 0.5), at.clone().addScaledVector(across, sd * half).setY(H2 - 0.9)], () => 0.07, (t) => K.mix(K.G.stem0, K.G.stem1, t), 7, 10));
    const top = K.tube([at.clone().addScaledVector(across, -half).setY(H2 - 0.9), at.clone().addScaledVector(across, -half * 0.7).setY(H2 - 0.2), at.clone().setY(H2), at.clone().addScaledVector(across, half * 0.7).setY(H2 - 0.2), at.clone().addScaledVector(across, half).setY(H2 - 0.9)], () => 0.06, () => K.G.stem1, 7, 20);
    const leaves = []; const r = K.rng(x * 31 + y);
    for (let k = 0; k < 16; k++) { const t = r(), sd = r() < 0.5 ? -1 : 1, hh = t * H2; leaves.push(K.place(K.leaf(r.r(0.16, 0.26), 0.12, 0.4, 0.25, k % 2 ? K.G.leaf : K.G.leaf2), at.clone().addScaledVector(across, sd * (half - 0.03)).setY(hh), V3(r.r(-0.6, 0.6), 0.4, r.r(-0.6, 0.6)))); }
    for (let k = 0; k < 5; k++) leaves.push(K.place(K.flower(0.1, 6, K.G.pink, K.G.pink2), at.clone().addScaledVector(across, (k - 2) * half * 0.42).setY(H2 - 0.1 - Math.abs(k - 2) * 0.28), V3(0, -0.3, 1)));
    const g = new THREE.Group(); g.add(new THREE.Mesh(K.merge([...legs, top, ...leaves]), K.MAT.plant));
    for (const k of [-0.55, 0, 0.55]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), lanternM); l.position.copy(at).addScaledVector(across, k * half).setY(H2 - 0.42 - Math.abs(k) * 0.3); g.add(l); }
    scene.add(g); return g;
  }
  trail.visible = !WON();
  arch(LOOPS[0][0], 'north'); arch(LOOPS[0][1], 'south'); arch(LOOPS[1][0], 'west'); arch(LOOPS[1][1], 'east');
  S.mapMarks = [
    { x: 18, y: 9, col: '#e0304a', label: 'Alraune', when: () => !WON() },
    { x: 5, y: 2, col: '#7ccf6a', label: 'up' },
    { x: 21, y: 0, col: '#ffd36b', label: 'A' }, { x: 21, y: 17, col: '#ffd36b', label: 'A' },
    { x: 0, y: 9, col: '#ffd36b', label: 'B' }, { x: 23, y: 9, col: '#ffd36b', label: 'B' },
  ];

  // ---------- pickings: the aloe in the west pocket, three chests ----------
  const ALOE = S.tileC(6, 10), aloe = add(K.makeAloe(4)); aloe.obj.position.copy(ALOE); S.block('aloe', ALOE.x, ALOE.z, 0.35);
  let aloePicked = false;                          // (it grows back by the next visit)
  S.on({ id: 'aloe', at: ALOE, r: 1.5, action: 'E — Look at the aloe', run: async () => {
    await S.turnTo(ALOE);
    if (aloePicked) { S.emote(anne, 'dots', 0.9); S.toast('Still growing...|Let it grow...', 'note', 2.0); return; }
    aloePicked = true; S.emote(anne, 'exclaim', 0.7); aloe.picked(true);
    sparks.burst(V3(ALOE.x, 0.5, ALOE.z), GREEN, 16, 0.9, 1.2);
    const n = 1 + Math.floor(Math.random() * 2); S.addHerbs(n); S.toast('Aloe x' + n, 'success', 2.0);
  } });
  kit.chest('chestN1', 18, 8, { blue: true, kind: 'treasure' });                       // behind Alraune: only once she has gone
  kit.chest('chestN2', 20, 14, { kind: Math.random() < 0.5 ? 'potions' : 'ingredients', r: 1.7 });      // (on the pond's edge, opened from the path)
  kit.chest('chestN3', 6, 14, { kind: 'ingredients', r: 1.7 });

  // ---------- two pits under the moss (the 2D's Ivy Maiden trap: traps.js, kind 'ivy') ----------
  createTraps(S, C, env, { holeAt: S.tileC(4, 4), faceTo: S.tileC(1, 4), kind: 'ivy', id: 'ntrap1', cap, wake: kit.wakeUp });
  createTraps(S, C, env, { holeAt: S.tileC(11, 15), faceTo: S.tileC(5, 15), kind: 'ivy', id: 'ntrap2', cap, wake: kit.wakeUp });

  // =====================================================================================================
  //                                               the Ivy Maidens
  // =====================================================================================================
  // Three pairs (the 2D's troop 9), each standing in an opening: (13,4) the only way north out of the lane, (10,10) the
  // way into the west pocket, (14,8) a nook by the pond. Beaten, they are gone; caught, she comes round under the hole.
  const pairs = [];
  [[13, 4, 0], [10, 10, 1], [14, 8, 2]].forEach(([x, y, i]) => {
    const id = 'nivy' + i, at = spot(x, y), group = [0, 1].map((k) => { const m = add(K.makeIvyMaiden({ seed: 40 + i * 3 + k, height: 1.45 })); S.avoid(m.obj, 0.5, 2.2, () => m.up); return m; });
    const home = () => group.forEach((m, k) => { m.obj.position.set(at.p.x + (k ? 0.38 : -0.38), 0, at.p.z + (k ? 0.18 : -0.18)); m.faceTo(at.p.x, at.p.z + 4); m.lean(0.2); });
    home();
    const rec = { id, at, group, out: true, home };
    const ev = S.on({ id, at: at.p, r: 1.5, touch: true, when: () => !WON(), run: () => encounter(rec) });
    if (!ev || WON()) { for (const m of group) m.hideNow(); return; }
    S.block(id, at.p.x, at.p.z, 0.5); pairs.push(rec);
    S.mapMarks.push({ x, y, col: '#3e8f3a', r: 3, when: () => !WON() && S.events.some((e) => e.id === id) });
  });

  // =====================================================================================================
  //                                                  Alraune
  // =====================================================================================================
  const ALR = S.tileC(18, 9), bloom = add(K.makeBloom()); bloom.obj.position.copy(ALR); bloom.obj.rotation.y = 0;      // (she faces south, the way Anne comes)
  let fig = null;
  try { const mod = await import('./alraune.js?v=' + (env.VER || 1)); fig = await mod.createAlraune({ THREE, K, scene, seat: bloom.seat, qp: null, ver: env.VER }); if (fig.update) S.actors.push(fig); }
  catch (e) { console.warn('alraune.js not loaded', e); }
  const al = { expr: (n) => { if (fig && fig.setExpression) fig.setExpression(n); }, clip: (n) => { if (fig && fig.playClip) fig.playClip(n); }, talk: (on) => { if (fig && fig.setTalking) fig.setTalking(on); } };
  const prevSpeak = S.onSpeak;
  S.onSpeak = (sheet, on) => { if (prevSpeak) prevSpeak(sheet, on); if (sheet === 'al') al.talk(on); };
  const alHead = (out = V3()) => (fig && fig.headPos ? fig.headPos(out) : out.set(ALR.x, 2.0, ALR.z));
  const guards = [-1, 1].map((sx, i) => { const m = add(K.makeIvyMaiden({ seed: 95 + i, hidden: true, height: 1.5 })); m.obj.position.set(ALR.x + sx * 1.05, 0, ALR.z + 0.55); S.avoid(m.obj, 0.5, 2.2, () => m.up); return m; });
  if (!WON()) { bloom.showNow(); al.clip('Idle'); al.expr('smile'); S.block('alraune', ALR.x, ALR.z, 0.95); S.avoid(bloom.obj, 1.0, 3.2, () => bloom.up); }
  else bloom.hideNow();
  // camera set-ups: on her, on Anne, both
  const shots = {
    her: (o = {}) => { const h = alHead(); S.cam.set(V3(h.x - 0.55, h.y + 0.02, h.z + 2.1), h, Object.assign({ fov: 36 }, o)); },
    anne: (o = {}) => { const h = C.headPos(); S.cam.set(V3(h.x + 0.6, h.y + 0.05, h.z - 1.9), h, Object.assign({ fov: 36 }, o)); },
    both: (o = {}) => S.cam.set(V3(ALR.x + 2.3 * (o.k || 1), 1.75, ALR.z + 3.3 * (o.k || 1)), V3(ALR.x + 0.25, 1.25, ALR.z + 0.85), Object.assign({ fov: 44 }, o)),      // (from the meadow, south-east: her face and Anne's)
  };
  S.on({ id: 'alraune', at: ALR, r: 1.9, touch: true, when: () => S.progress >= 20 && !WON(), run: boss });

  async function boss() {
    back.copy(anne.position);                       // (lost, she comes round under the hole she came down: the 2D's game over is a reload)
    await S.turnTo(ALR, 0.2); shots.both();
    al.expr('smile'); al.clip('Idle');
    await S.say('al', 0, 'Hi, luv.');
    shots.anne(); await S.say('a1', 1, 'Time to prune the bad herbs.', { expr: 'angry' });
    shots.her(); al.expr('smug');
    await S.say('al', 1, "Ohhh, no, my precious little morsel. Time\nis up and I'm hungry. I'd die for a taste of\nthose long legs of yours...");
    await S.mark('alnest');
    { // (10-03) and what she has on her feet today, and her toenails (story_common.js lookLines 'alNest')
      const L = C.lookLines('alNest');
      al.expr(L.lv === 0 ? 'pout' : 'happy'); al.clip(L.lv === 3 ? 'Delight' : 'Idle', 0.3); await S.say('al', L.lv === 0 ? 4 : 3, L.shoe, { feet: true });
      al.expr(L.lv === 0 ? 'smug' : 'laugh'); await S.say('al', L.lv === 0 ? 2 : 10, L.nail, { feet: true, toes: true });
      if (C.lookSay) { const R = C.lookSay('al'); al.expr('smug'); await S.say('al', 2, R.outfit); if (R.species) await S.say('al', 2, R.species); }      // (batch 22: and what she is, or what she has come in)
      shots.anne(); await S.say('a2', L.lv >= 2 ? 31 : 34, L.lv >= 2 ? 'Would you STOP staring at my feet?!' : 'Keep your vines off my shoes!', { expr: L.lv >= 2 ? 'embarrassed' : 'angry', blush: L.lv >= 2 ? 0.6 : 0.3 });
      shots.her(); S.flag('alLook', ((S.look && S.look()) || {}).key || '');
    }
    al.expr('laugh'); al.clip('Command'); shots.both({ k: 1.3 });
    await S.say('al', 2, 'COME HERE, MY CHILDREN!\nGET THIS FLESHY MEAL FOR ME!');
    for (const m of guards) { m.faceTo(anne.position.x, anne.position.z); m.emerge(); }
    S.expr('angry'); if (env.music) env.music('battle5.mp3');
    await S.wait(0.9); for (const m of guards) m.lean(0.5);
    al.clip('Idle');
    const herProxy = { obj: bloom.obj, zapY: 1.9, shake() { al.expr('pout'); }, lean() {} };
    const won = await fight({ id: 'alrFight', at: { p: ALR }, group: [guards[0], herProxy, guards[1]] }, { keep: true, noCapture: true, width: 0.2, speed: 0.88, names: ['Ivy Maiden', 'Alraune', 'Ivy Maiden'] });
    if (env.music) env.music(null);
    if (won) await beaten(); else await lost();
  }

  // ---------- lost: her vines lift Anne up before the flower (captures.js: the 2D's SceneAlraune, CAPTURE1) ----------
  async function lost() {
    al.expr('laugh');
    await S.say('al', 0, 'My my... such a lively meal!\nHold her still, my dears.');
    let free = false;
    if (fig && fig.reach && cap.alraune) ({ free } = await kit.alrauneCapture({ fig, al, bloom, at: ALR, yaw: 0, maidens: guards }));      // (the 2D's scene, or tied up)
    S.clip('Idle', 0); bloom.obj.position.copy(ALR); bloom.obj.rotation.y = 0; bloom.showNow(); al.clip('Idle'); al.expr('smile');
    for (const m of guards) m.hideNow();
    await wakeUp(free);
  }

  // ---------- won: the 2D's "PLAY WITH HER A LITTLE" ----------
  // The 2D then has Anne tickle the beaten Alraune (its picture draws her undressed and is not recreated). Here her own
  // vines hold her arms up over her head and Anne's tickle spell, a conjured feather, goes to work: the 2D's menu
  // "Tickle her!" / "Random Spot!" / "Spare her", three stages to fill, and at the third she gives up.
  const feather = (() => {
    const g = new THREE.Group(), quill = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })); quill.position.y = 0.15; g.add(quill);
    const vane = new THREE.Shape(); vane.moveTo(0, 0.05); vane.bezierCurveTo(0.05, 0.1, 0.055, 0.22, 0.004, 0.33); vane.bezierCurveTo(-0.045, 0.24, -0.05, 0.1, 0, 0.05);
    const vm = new THREE.Mesh(new THREE.ShapeGeometry(vane, 10), new THREE.MeshLambertMaterial({ color: 0xfff4f8, emissive: 0x6a3550, side: THREE.DoubleSide })); g.add(vm);
    g.visible = false; scene.add(g); return g;
  })();
  const FE = { on: false, spot: 'sides', t: 0, k: 0 };
  const _h = V3(), _f = V3(), _r = V3(), _tip = V3();
  const SPOTS = { 'her sides': [0.17, -0.42, 0.07], 'her ribs': [0.15, -0.33, 0.09], 'under her arms': [0.19, -0.22, 0.03], 'her neck': [0.07, -0.13, 0.07] };
  S.actors.push({ update(dt, t) {
    if (!FE.on) { feather.visible = false; return; }
    FE.t += dt; alHead(_h); _f.set(Math.sin(bloom.obj.rotation.y), 0, Math.cos(bloom.obj.rotation.y)); _r.set(_f.z, 0, -_f.x);
    const [sx, dy, fw] = SPOTS[FE.spot] || SPOTS['her sides'], side = Math.sin(FE.t * 1.3) > 0 ? 1 : -1;
    _tip.copy(_h).addScaledVector(_r, side * sx).addScaledVector(_f, fw); _tip.y += dy;
    _tip.y += 0.035 * Math.sin(FE.t * 23); _tip.addScaledVector(_f, 0.02 * Math.sin(FE.t * 17));       // (the flick)
    feather.visible = true; feather.position.copy(_tip).addScaledVector(_r, side * 0.06).addScaledVector(_f, 0.12);
    feather.lookAt(_tip.x + _f.x, _tip.y + 0.4, _tip.z + _f.z); feather.rotateX(Math.PI / 2 + 0.6 * Math.sin(FE.t * 19));
    if (Math.random() < dt * 8) sparks.burst(_tip.clone(), PINK, 2, 0.4, 0.5);
    bloom.obj.rotation.z = 0.035 * Math.sin(FE.t * 13) * FE.k; FE.k = Math.min(1, FE.k + dt * 2);
  } });
  const armsUp = (on) => {
    if (!fig || !fig.reach) return;
    const _s = V3();
    for (const sd of ['L', 'R']) fig.reach(sd, on ? (p, d, n) => { fig.shoulderPos(sd, _s); alHead(_h); p.set(_s.x + (_s.x - _h.x) * 0.35, _s.y + 0.5, _s.z - 0.04); d.set((_s.x - _h.x) * 0.6, 1, -0.1); n.set(Math.sin(bloom.obj.rotation.y), 0, Math.cos(bloom.obj.rotation.y)); } : null);
  };
  async function beaten() {
    for (const m of guards) m.sink();
    shots.her(); al.expr('pout'); al.clip('Idle');
    await S.say('al', 14, 'Dammit!!!');
    shots.both();
    await S.say('am', 15, "QUICKLY!!!!\nSHE'S YOURS!!!! TRAP HER AND PUNISH HER!!!");
    // her own vines take her arms
    sparks.burst(V3(ALR.x, 1.0, ALR.z), GREEN, 34, 1.6, 1.2); armsUp(true); al.expr('surprised');
    S.toast('Gotcha!!|MINE!!!!|Now you know what comes next!', 'dialog', 2.4); S.expr('smug');
    await S.wait(1.0); await S.mark('alwon');
    let stage = 0, pts = 0;
    for (let round = 0; round < 12; round++) {
      const pick = await S.choice(stage < 3 ? ['Tickle her!', 'Random Spot!', 'Spare her'] : ['Tickle her!', 'Random Spot!', 'Let her go']);
      if (pick === 2) break;
      FE.spot = pick === 1 ? kit.pick(Object.keys(SPOTS)) : ['her sides', 'her ribs', 'under her arms'][Math.min(2, stage)];
      S.toast('Tickle her!!!|Tame her!!', 'note', 1.4);
      if (has('Cast')) S.clip('Cast', 0.15); FE.on = true; FE.t = 0;
      al.expr('laugh'); al.clip('Delight');
      shots.her({ cut: false }); if (round === 0) await S.mark('albout');
      S.toast(kit.pick(['AHAHAHA!! N-NOT THERE!!', 'HIHIHI!! S-STOP IT, YOU LITTLE--!!', 'OHOHOHO!! NO FAIR!! NO FAIR!!', 'HAHAHA!! MY VINES!! LET GO OF ME!!']), 'dialog', 2.2);
      for (let i = 0; i < 2; i++) {
        const hit = await S.gauge({ label: `Tickle ${FE.spot}! SPACE in the green!`, sub: stage < 3 ? `Stage ${stage + 1} / 3` : 'She gave up long ago...', width: pick === 1 ? 0.26 : 0.22, speed: 0.9 + 0.08 * stage });
        if (hit) { pts++; sparks.burst(_tip.clone(), PINK, 14, 0.9, 0.7); al.expr(i ? 'laugh' : 'happy'); }
        else S.toast('She squirms out of reach!', 'note', 1.2);
      }
      FE.on = false; S.clip('Idle', 0.2); al.clip('Idle'); al.expr('pout'); bloom.obj.rotation.z = 0;
      shots.anne(); S.toast(kit.pick(['How do YOU like it, huh?!', "Who's ticklish now?!", 'Not so fun from that side, is it?!']), 'dialog', 2.0); S.expr('smug');
      if (stage < 3 && pts >= 2) {
        stage++; pts = 0;
        if (stage === 3) { shots.her(); al.expr('laugh'); S.toast("HAHAHA HOHO HAHAH!!! STOOP I GIVE UP!!|STOOP ALREADY!!!|OK OK OK!!! Let's deal!!|YOU WIN -- YOU WIN PLEASE STOOOOP!!!!!", 'success', 3.2); await S.wait(1.4); }
      }
      await S.wait(0.6);
    }
    FE.on = false; armsUp(false);
    if (stage >= 3 && !S.flag('alrauneUnlocked')) { S.flag('alrauneUnlocked', true); S.toast('ALRAUNE UNLOCKED!!', 'success', 2.6); await S.wait(1.0); }
    // she lashes out and slips away
    shots.both(); al.expr('smug'); al.clip('Command');
    await S.wait(0.4); sparks.burst(C.headPos().add(V3(0, -0.2, 0)), GREEN, 26, 1.6, 0.9); S.expr('shocked'); if (has('Startle')) S.clip('Startle', 0.1);
    await S.fade(1, 0.5);
    S.progress = 30; wiltAll(); trail.visible = false; for (const r of pairs) { for (const m of r.group) m.hideNow(); S.unblock(r.id); }
    await S.say('a1', 30, 'OUCH!!', { expr: 'angry' });
    await S.say('am', 14, 'Dammit!!\nFuntime is over...');
    bloom.hideNow(); S.unblock('alraune'); S.clip('Idle', 0);
    await S.mark('algone');
    shots.anne({ cut: true }); await S.fade(0, 0.6);
    await S.say('a1', 1, 'What?\nWhere did she go?', { expr: 'surprised' });
    await S.say('am', 0, "She's gone.");
    await S.say('a1', 1, "It's over then?");
    await S.say('am', 0, "The frenzied Ivy Maidens are gone too.\nI guess it's safe, for now.");
    await S.say('a1', 1, 'I hope the path is clear now...');
    await S.say('am', 8, 'Alraune is gone, and the Ivy Maidens are not\nhere anymore.\nLooks like the forest is cleansed.\nThe path should be clear now.');
    S.toast('Quest: Defeat Alraune - done!', 'success', 2.6);
    S.objective('Leave the forest: the lane to the Main Road should be clear now.');
    C.checkpoint();
    const leave = await S.choice(['Leave', 'Stay and explore']) === 0;
    S.progress = 35;
    S.cam.behind(anne, { dist: 4.5 });
    if (leave) { S.flag('ohYes', true); await S.fade(1, 0.6); S.go('forest', [46, 6], 'east'); }
  }

  // =====================================================================================================
  //                                       arriving, and the way back up
  // =====================================================================================================
  // ----- the first time down: the nest, and what Amaymon has been drawing (the 2D's "GameProgress", 21 -> 25)
  const doodle = K.makeDoodle();
  let sheet = null;
  function showDoodle(on) {
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.style.cssText = 'position:fixed;left:50%;top:44%;z-index:3;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;transform:translate(-50%,-50%) rotate(-4deg) scale(.92);box-shadow:0 10px 40px rgba(0,0,0,.6);';
      const cv = doodle.obj.material.map.image; cv.style.cssText = 'display:block;height:min(62vh,560px);width:auto;'; sheet.appendChild(cv); document.body.appendChild(sheet);
    }
    sheet.style.opacity = on ? 1 : 0; sheet.style.transform = `translate(-50%,-50%) rotate(-4deg) scale(${on ? 1 : 0.92})`;
  }
  S.on({ id: 'arrival', at: LAND, r: 2.8, touch: true, when: () => S.progress >= 20 && S.progress < 25, run: async () => {
    if (S.progress < 21) S.progress = 21;
    S.cam.behind(anne, { cut: true, dist: 4.4, pitch: 0.3 });
    S.emote(anne, 'dots', 1.0); await S.wait(1.3);
    await S.say('a1', 5, "So... this is the Ivy Maidens' nest...\n\nAlraune must be around...");
    await S.say('a1', 1, "I've got a bad feeling about this place...", { expr: 'worried' });
    S.emote(anne, 'dots', 1.0); await S.wait(1.2);
    await S.say('a1', 4, 'You look...\nso quiet...');
    await S.say('a1', 8, 'What are you doing?');
    await S.say('am', 3, "I'm busy!");
    await S.say('a2', 6, "Busy... doing what?\n\nWhat's that paper and that...", { expr: 'surprised' });
    showDoodle(true); await S.wait(2.0); await S.mark('doodle');
    await S.say('am', 4, 'U like it?');
    showDoodle(false);
    // she smacks him
    const amP = am().position.clone();
    if (has('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.35); }
    sparks.burst(amP, GOLD, 18, 1.4, 0.8); await S.wait(0.4); S.clip('Idle', 0.2);
    S.emote(anne, 'anger', 1.0);
    await S.say('a2', 4, 'WHATAFAAAAAAAAKKK!!!!!\nU ASSHOLEEE!!', { expr: 'angry', blush: 0.5 });
    await S.say('a2', 26, 'Who needs enemies with friends like these?');
    await S.say('am', 11, '...indeed...');
    S.progress = 25; C.checkpoint();
    S.objective('Find Alraune: her glowing blossoms show the way (map: N).');
  } });
  const am = () => C.am.obj;

  // ----- the vines up the hedge: walk into them from the pool of light
  // (the zone is clear of the spot she lands on)
  S.on({ id: 'ladder', at: V3(LADDER.x, 0, LADDER.z + TILE * 0.45), r: 0.6, touch: true, when: () => Math.cos(anne.rotation.y) < -0.55, run: async () => {
    if (!S.flag('nestClimbed')) {
      await S.turnTo(LADDER); S.cam.two(anne, LADDER, { y: 1.4, y2: 1.8, dist: 3.0, pitch: 0.1 });
      await S.say('a1', 0, 'Looks strong enough to hold me\nif I climb up!');
      if (await S.choice(['Climb up', 'Leave']) !== 0) { S.cam.behind(anne, { dist: 4.5 }); return; }
      S.flag('nestClimbed', true);
    }
    const from = anne.position.clone(); let k = 0;
    const fade = S.fade(1, 0.6);
    await S.until((dt) => { k = Math.min(1, k + dt / 0.6); anne.position.set(from.x, 1.1 * k, from.z - 0.25 * k); return k >= 1; });
    await fade; anne.position.y = 0; S.go('forest', [36, 13], 'south');
  } });

  S.hint = async () => {
    if (WON()) { await S.say('am', 8, 'Alraune is gone, and the Ivy Maidens are not\nhere anymore.\nLooks like the forest is cleansed.\nThe path should be clear now.'); return; }
    await S.say('am', 0, "Her blossoms glow along the way to her.\nThis garden winds round on itself, like the forest\nup there: a path that leaves one side comes in\nat the other. Look for the arches of vines (map: N).");
    await S.say('am', 8, 'North up the lane, then east to the stair cut:\nit comes out on the south path. Follow that west,\nthen north, and on through the arch in the west.\nShe is in the meadow beyond.');
    await S.say('am', 0, 'The vines by the light take us back up.');
  };
  S.onArrive = (how) => {
    C.checkpoint();
    if (how !== 'wrap') S.objective(WON() ? 'Leave the forest: the lane to the Main Road should be clear now.' : 'Find Alraune: her glowing blossoms show the way (map: N).');
  };
  S.blockExit = () => false;
}
