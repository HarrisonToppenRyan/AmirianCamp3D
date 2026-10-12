// traps.js: two more traps of the 2D game's camp, played through the story engine (story.js).
//
//   The hole trap (CommonEvent 77 SceneTrapHole): a pit under a pile of leaves. She falls in to her waist, her arms
//   pinned inside it; her legs hang in the hollow underneath, where something is waiting for her feet. The 2D game's
//   five variants are all here, picked from its sandbox menu: vines, fairies, the thief, Ivy Maidens, ghosts.
//   As in 2D the picture goes back and forth between her above the ground (`top`) and her legs below (`front`, then
//   `back`), with a close-up of her feet now and then, and a gauge to kick free after each bout: four in all. Four
//   misses and she slips through.
//
//   The pumpkin (CommonEvent 62 ScenePUMPKIN): she reaches for its seeds; a miss and the vine it grows on has her:
//   sitting back with her feet held out to the pumpkin head (`lickle1`), then lifted (`lickle2`). Seen from her side.
//
// Comedy only: she stays dressed, only her shoes come off. Nothing goes INTO her: ticklers, tongues, hands, coils
// and cuffs ride on her skin's own frame with a little air (the sole frames of story_common.js, her leg bones here).
const V = new URL(import.meta.url).search;      // this file's own ?v=..., passed on so that no stale copy of what it imports is used
const { createCaptures } = await import('./captures.js' + V);
const { createThief } = await import('./thief.js' + V);

// opts (10-02): the same hole trap elsewhere (the caves, the Ivy Maidens' nest): { holeAt: V3, faceTo: V3 (the way she is
// walking: she faces it in the hole and jumps out that way), kind ('vines' | 'ivy' | ...), id }. Such a trap is hidden
// (no pile of leaves): she steps on it, falls in, and once it has gone off it stays an open pit she jumps across.
// Without holeAt: the camp's own (the pile of leaves, the choice of who lives down there, the pumpkins, the thief).
// (10-12, the Forest of Lys: the 2D's "trap A:B [random]") kinds: a list instead of one kind, the first of it unless
// `random` (then one of them, picked as she falls; tests: ?trapkind=<key>); open: the hole shows before it goes off (the 2D's
// "GnomeHole"); look: async, what she says of it once it has gone off (E), instead of hopping over it; onFall / onOut: for
// whoever travels with her (they are stood aside, and come back).
export function createTraps(S, C, env, opts = {}) {
  const CAMP = !opts.holeAt;
  const { THREE, scene, anne, A, V3 } = S, { K, sparks, feet, along } = C;
  const PI = Math.PI, TAU = PI * 2, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
  const has = (n) => A.hasClip && A.hasClip(n);
  const post = env.post && env.post.setCloseUp ? env.post : { setCloseUp() {} };
  const cap = opts.cap || createCaptures(S, C, env), kit = cap.kit;
  const thief = CAMP ? createThief(S, C) : { hide() {}, update() {}, show() {}, walk: async () => {}, arm: () => ({ to() {}, hold() {}, feather() {} }), expr() {}, shoulder() {} };
  const col = K.col, mix = K.mix, IV = K.IVY;
  const sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const UP = V3(0, 1, 0), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3();
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // her legs, the coils wound round them and the tongues are the capture kit's (captures.js)
  const { bone, LEGS_OK, hipW, kneeW, ankW, readLegs, legAt, makeSpiral, makeTongue, lick, soleSpot, mouthTo } = kit, { legC, legU, legA, legV } = kit.legFrame;
  // a point of a sole with air under it: u along (0 heel .. 1 ball .. 1.3 toes), v across, c metres off the skin
  const soleAt = (j, u, v, c, out) => along(feet[j], u, out).addScaledVector(feet[j].side, v).addScaledVector(feet[j].n, c);

  // =====================================================================================================
  //                                                 the hole trap
  // =====================================================================================================
  const TILE = S.TILE, LOGB = CAMP ? S.tileC(...(S.level.log || [14, 7])) : V3(), fire = CAMP ? S.tileC(...S.level.campfire) : (opts.faceTo || V3());
  const H = CAMP ? V3(LOGB.x + 3.3, 0, LOGB.z - 0.4) : opts.holeAt.clone();
  if (CAMP) {                                          // the first of these spots with open ground all round it
    // (10-02: in the middle of the camp, a few steps from the fire on the side she comes from, where nobody can miss it;
    //  then, if the ground there is not open, the spots by the log it used to have)
    const ok = (x, z) => !env.walkAt || [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9]].every(([a, b]) => env.walkAt(Math.floor((x + a) / TILE), Math.floor((z + b) / TILE)));
    const spots = [[fire, 2.8, 2.6], [fire, 3.2, -1.2], [fire, -0.6, 3.4], [fire, 3.4, 1.0], [LOGB, 3.3, -0.4], [LOGB, 3.2, 1.2], [LOGB, 0.3, -3.3], [LOGB, -2.6, -1.6], [LOGB, 2.4, -2.6]];
    for (const [o, dx, dz] of spots) if (ok(o.x + dx, o.z + dz)) { H.set(o.x + dx, 0, o.z + dz); break; }
  }
  const YAW = Math.atan2(fire.x - H.x, fire.z - H.z);  // she ends up facing the fire
  const F = V3(Math.sin(YAW), 0, Math.cos(YAW)), Rt = V3(-F.z, 0, F.x);       // her front, and her right-hand side
  // (the floor lies 1.1 m under her hanging feet, as the 2D sheets have it: someone standing on it has them at her chest. LV: the level the
  //  small ones keep to, 0.8 m under her feet)
  const FLOOR = -2.05, LV = -1.75, CEIL = -0.17, RW = 2.9, SHAFT = 0.28;

  // ---------- above the ground: the pile of leaves, and the rim once it has given way ----------
  const LEAFC = [col(0.36, 0.2, 0.06), col(0.5, 0.26, 0.05), col(0.3, 0.27, 0.08), col(0.42, 0.14, 0.05), col(0.24, 0.2, 0.08)];
  const pile = new THREE.Group(), rim = new THREE.Group(); pile.position.copy(H); rim.position.copy(H); rim.visible = false; scene.add(pile, rim);
  {
    const r = K.rng(771), parts = [];
    for (let i = 0; i < 110; i++) {                  // (a real heap of them, that catches the eye from across the camp)
      const a = r() * TAU, d = 0.78 * Math.sqrt(r()), h = 0.015 + 0.17 * Math.pow(1 - d / 0.78, 1.4) * (0.55 + 0.45 * r());
      parts.push(K.place(K.leaf(r.r(0.13, 0.2), r.r(0.06, 0.09), r.r(-0.2, 0.4), 0.25, LEAFC[i % LEAFC.length], 0.7), V3(Math.cos(a) * d, h, Math.sin(a) * d), V3(Math.cos(a * 3.1 + i), r.r(-0.12, 0.25), Math.sin(a * 3.1 + i))));
    }
    for (let i = 0; i < 5; i++) { const a = r() * TAU, d = r.r(0.1, 0.4), b = a + r.r(1, 2); parts.push(K.tube([V3(Math.cos(a) * d, 0.05, Math.sin(a) * d), V3(Math.cos(b) * 0.1, 0.09, Math.sin(b) * 0.1), V3(Math.cos(b) * d * 1.2, 0.05, Math.sin(b) * d * 1.2)], () => 0.008, () => col(0.17, 0.11, 0.06), 5, 8)); }
    pile.add(shadowy(new THREE.Mesh(K.merge(parts), K.MAT.plant)));
    const rp = [], er = K.rng(55);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + er.r(-0.1, 0.1), d = SHAFT + er.r(0.1, 0.18); rp.push(K.place(K.ball(er.r(0.075, 0.12), mix(col(0.13, 0.085, 0.05), col(0.2, 0.13, 0.07), er()), 1.25, 0.5, 1, 8), V3(Math.cos(a) * d, 0.012, Math.sin(a) * d))); }
    for (let i = 0; i < 14; i++) { const a = er() * TAU, d = SHAFT + er.r(0.25, 0.6); rp.push(K.place(K.leaf(er.r(0.12, 0.18), er.r(0.06, 0.08), 0.3, 0.25, LEAFC[i % LEAFC.length], 0.7), V3(Math.cos(a) * d, 0.02, Math.sin(a) * d), V3(Math.cos(a + 1), er.r(0, 0.3), Math.sin(a + 1)))); }
    rim.add(shadowy(new THREE.Mesh(K.merge(rp), K.MAT.plant)));
    const dark = new THREE.Mesh(new THREE.CircleGeometry(SHAFT + 0.1, 28), new THREE.MeshBasicMaterial({ color: 0x0b0806 })); dark.rotation.x = -PI / 2; dark.position.y = 0.006; rim.add(dark);
  }
  const flatH = { p: H.clone(), r: 1.5, k: 0.985 };

  // ---------- under the ground: the hollow ----------
  const room = new THREE.Group(), low = new THREE.Group(); room.position.copy(H); room.visible = false; room.name = 'HoleRoom'; scene.add(room);      // low: the floor and what lies on it
  {
    const tint = (geo, fn) => { const P = geo.attributes.position, c = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { const v = fn(P.getX(i), P.getY(i), P.getZ(i)); c[i * 3] = v.r; c[i * 3 + 1] = v.g; c[i * 3 + 2] = v.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
    const n2 = (x, z) => 0.5 + 0.25 * Math.sin(x * 2.7 + z * 1.3) + 0.25 * Math.sin(z * 3.9 - x * 1.7);
    const E0 = col(0.026, 0.018, 0.024), E1 = col(0.066, 0.044, 0.046), E2 = col(0.1, 0.07, 0.062);
    const WB = FLOOR - 0.5;                              // (the wall runs on below the floor: the floor can be let down, see `low`)
    const wall = new THREE.CylinderGeometry(RW, RW * 0.94, CEIL - WB, 48, 10, true); wall.translate(0, (CEIL + WB) / 2, 0);
    { const P = wall.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + 0.035 * Math.sin(a * 7 + y * 3) + 0.03 * Math.sin(a * 13 - y * 5); P.setXYZ(i, x * k, y, z * k); } wall.computeVertexNormals(); }
    tint(wall, (x, y, z) => mix(E1, E0, sst(y, WB, CEIL) * 0.8).multiplyScalar(0.7 + 0.6 * n2(Math.atan2(z, x) * 3, y * 2)));
    const inside = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.BackSide }), upSide = new THREE.MeshLambertMaterial({ vertexColors: true });
    room.add(new THREE.Mesh(wall, inside));
    const fl = new THREE.CircleGeometry(RW, 48, 0, TAU); fl.rotateX(-PI / 2); fl.translate(0, FLOOR, 0); tint(fl, (x, y, z) => mix(E1, E2, n2(x * 1.4, z * 1.4)).multiplyScalar(0.8 + 0.3 * n2(x * 4, z * 4)));
    const flm = new THREE.Mesh(fl, upSide); flm.receiveShadow = true; low.add(flm); room.add(low);
    const ce = new THREE.RingGeometry(SHAFT, RW + 0.5, 48, 3); ce.rotateX(PI / 2); ce.translate(0, CEIL, 0); tint(ce, (x, y, z) => mix(E0, E1, n2(x * 2, z * 2) * 0.6));
    room.add(new THREE.Mesh(ce, upSide));
    const sh = new THREE.CylinderGeometry(SHAFT, SHAFT, -CEIL, 24, 1, true); sh.translate(0, CEIL / 2, 0); tint(sh, () => E0);
    room.add(new THREE.Mesh(sh, inside));
    // roots that hang from the ceiling, stones, and the pale mushrooms that light the place
    const r = K.rng(912), bits = [], stones = [], glow = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = r.r(0.55, RW - 0.25), x = Math.cos(a) * d, z = Math.sin(a) * d, L = r.r(0.18, 0.75), sw = r.r(-0.15, 0.15);
      bits.push(K.tube([V3(x, CEIL + 0.02, z), V3(x + sw, CEIL - L * 0.5, z + sw * 0.6), V3(x + sw * 1.6, CEIL - L, z - sw)], (t) => 0.022 * (1 - 0.85 * t) + 0.004, () => col(0.12, 0.085, 0.05), 5, 8));
    }
    for (let i = 0; i < 18; i++) { const a = r() * TAU, d = r.r(0.9, RW - 0.2); stones.push(K.place(K.ball(r.r(0.05, 0.16), mix(col(0.1, 0.1, 0.1), col(0.17, 0.16, 0.15), r()), 1.3, 0.55, 1, 7), V3(Math.cos(a) * d, FLOOR + 0.01, Math.sin(a) * d))); }
    room.add(new THREE.Mesh(K.merge(bits), K.MAT.plant)); low.add(new THREE.Mesh(K.merge(stones), K.MAT.plant));
    for (let i = 0; i < 22; i++) {
      const a = r() * TAU, d = r.r(1.0, RW - 0.15), x = Math.cos(a) * d, z = Math.sin(a) * d, h = r.r(0.05, 0.13), c = col(0.5, 0.95, 0.8);
      glow.push(K.tube([V3(x, FLOOR, z), V3(x, FLOOR + h, z)], () => 0.008, () => c, 5, 2), K.place(K.ball(h * 0.42, c, 1, 0.6, 1, 8), V3(x, FLOOR + h, z)));
    }
    low.add(new THREE.Mesh(K.merge(glow), new THREE.MeshBasicMaterial({ vertexColors: true })));
    // a lid just under the turf that only casts a shadow: the hollow lies in the dark
    const lid = new THREE.Mesh(new THREE.CircleGeometry(RW + 3.2, 32), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    lid.rotation.x = -PI / 2; lid.position.y = -0.03; lid.castShadow = true; room.add(lid);
  }
  const floorPt = (side, fwd, out = V3()) => out.copy(H).addScaledVector(Rt, side).addScaledVector(F, fwd).setY(FLOOR);
  // (10-03) where her shoes come to lie on the floor (in front of her, side-on to the front camera), and where the vines that tickle inside them grow
  const SHOE_AT = [floorPt(-0.3, 0.62), floorPt(0.32, 0.7)], SHOE_ROOT = [floorPt(-0.9, 1.05), floorPt(0.95, 1.12)];

  // ---------- the pictures ----------
  const cp = V3(), cl = V3(), fmid = V3();
  const feetMid = (out = fmid) => out.addVectors(feet[0].sArch, feet[1].sArch).multiplyScalar(0.5);
  const shot = {
    // (10-03: every view of the hole a little closer, as he asked: top 2.25 -> 1.85 m, below 2.35 -> 1.8 m and fov 46 -> 42, feet 0.8 -> 0.62 m)
    top(o = {}) { cp.copy(H).addScaledVector(F, 1.85).addScaledVector(Rt, o.side === undefined ? 0.5 : o.side); cp.y = 0.6; cl.copy(H); cl.y = 0.38; S.cam.set(cp, cl, { fov: 34, cut: true, focus: cl.clone(), focusK: 1.1 }); post.setCloseUp('off'); },
    wide() { cp.copy(H).addScaledVector(F, 3.6).addScaledVector(Rt, 1.6); cp.y = 1.7; cl.copy(H); cl.y = 0.4; S.cam.set(cp, cl, { fov: 44, cut: true }); post.setCloseUp('off'); },
    // below, as on the 2D sheets: her shorts at the top of the picture, her feet in the middle, the floor under the dialogue box
    below(back, o = {}) { const g = back ? -1 : 1; cp.copy(H).addScaledVector(F, g * 1.8).addScaledVector(Rt, g * (o.side === undefined ? 0.26 : o.side)); cp.y = -1.08; cl.copy(H); cl.y = -1.08; S.cam.set(cp, cl, { fov: 42, cut: true }); post.setCloseUp('off'); },
    // (10-03) her shoes on the floor of the hollow, and whatever is busy in them
    shoes(o = {}) { cl.addVectors(kit.loose[0].g.position, kit.loose[1].g.position).multiplyScalar(0.5); cl.y += 0.03; cp.copy(cl).addScaledVector(F, o.dist || 1.15).addScaledVector(Rt, o.side === undefined ? 0.12 : o.side); cp.y = cl.y + 0.5; S.cam.set(cp, cl, { fov: 40, cut: true, focus: cl.clone(), focusK: 1.0 }); post.setCloseUp('on'); },
    // close on her feet: from behind and below her soles face the camera; from the front it sees her toes
    feet(back, o = {}) {
      feetMid(); const g = back ? -1 : 1;
      cp.copy(fmid).addScaledVector(F, g * (o.dist || 0.62)).addScaledVector(Rt, g * (o.side === undefined ? 0.18 : o.side)); cp.y = fmid.y - (back ? 0.22 : 0.05);
      cl.copy(fmid); cl.y += 0.04; S.cam.set(cp, cl, { fov: 30, cut: true, focus: fmid.clone(), focusK: 0.9 }); post.setCloseUp('on');      // (a deep focus: both feet stay sharp while they squirm)
    },
  };

  // ---------- what lives down there ----------
  // (1) vines: they are the ticklers of captures.js, rooted in the floor; two more just sway
  const vines = [0, 1, 2, 3].map((i) => ({ v: kit.makeVine(IV.v0, IV.v2, 18, 7), root: floorPt([-0.75, 0.8, -0.35, 0.45][i], [0.45, 0.35, -0.6, -0.7][i]), k: 0, goal: 0, ph: i * 1.9, h: [0.8, 0.72, 0.86, 0.76][i] }));
  function updVines(dt, t) {
    for (const v of vines) {
      v.k = damp(v.k, v.goal, 3, dt);
      if (v.k < 0.02) { v.v.hide(); continue; }
      const sw = 0.1 * Math.sin(t * 1.3 + v.ph), h = v.h * v.k;
      _a.copy(v.root).addScaledVector(UP, h * 0.45).addScaledVector(Rt, sw * 0.5); _b.copy(v.root).addScaledVector(UP, h * 0.85).addScaledVector(Rt, -sw).addScaledVector(F, 0.08 * Math.cos(t * 0.9 + v.ph));
      _c.copy(v.root).addScaledVector(UP, h).addScaledVector(Rt, sw * 1.4).addScaledVector(F, 0.16 * Math.cos(t * 1.1 + v.ph));
      v.v.draw(v.root, _a, _b, _c, Rt, 0.04, 0.008);
    }
  }
  const spiralVine = makeSpiral(6.5, IV.v0, IV.v2, 0.0125);
  // (2) the pit's own tentacles (10-03, as he asked: not the Ivy Maidens' models down here, creatures of the pit's own):
  // six fleshy tentacles rooted in the floor, dark violet to pink, a row of pale suckers down each; four work her soles
  // (their tips slither along them, a little off the skin: CLEAR), two go into her shoes on the floor
  const TC0 = col(0.2, 0.07, 0.3), TC1 = col(0.6, 0.22, 0.52), spiralTent = makeSpiral(6.5, TC0, TC1, 0.0155);
  const suckGeo = new THREE.SphereGeometry(1, 8, 6), suckMat = new THREE.MeshLambertMaterial({ color: col(0.95, 0.66, 0.78) });
  const tents = [0, 1, 2, 3, 4, 5].map((i) => {
    const v = kit.makeVine(TC0, TC1, 24, 9), suck = new THREE.InstancedMesh(suckGeo, suckMat, 10); suck.frustumCulled = false; suck.visible = false; scene.add(suck);
    return { v, suck, root: floorPt([-0.62, 0.66, -0.3, 0.36, -0.95, 1.0][i], [0.36, 0.3, -0.5, -0.56, 0.05, -0.05][i]), k: 0, goal: 0, ph: i * 1.7, h: [0.84, 0.78, 0.9, 0.82, 0.5, 0.55][i], job: null, tip: V3(), was: false };
  });
  // what a tentacle is at: its tip on a sole (foot j, where along it, how fast), or in a shoe on the floor
  const TJOB = {
    sole: (j, u0, amp, rate, v = 0) => (T, t, tip, p2, face) => { const f = feet[j], u = u0 + amp * Math.sin(t * rate + T.ph); along(f, u, tip).addScaledVector(f.side, v + 0.006 * Math.sin(t * rate * 0.6 + T.ph)).addScaledVector(f.n, 0.016); p2.copy(tip).addScaledVector(f.fwd, 0.075).addScaledVector(f.n, 0.03); face.copy(f.n).negate(); },
    shoe: (k) => (T, t, tip, p2, face) => { const f = kit.shoeFrame(k), u = 0.45 + 0.22 * Math.sin(t * 1.9 + T.ph); along(f, u, tip).addScaledVector(f.n, 0.014); p2.copy(tip).addScaledVector(f.n, 0.07).addScaledVector(f.side, 0.03); face.copy(f.n).negate(); },
  };
  const _tn1 = V3(), _tn2 = V3(), _tn3 = V3(), _tnf = V3(), _tnp = V3(), _tng = V3(), _tnw = V3(), _tnm = new THREE.Matrix4(), _tnu = V3();
  function updTents(dt, t) {
    for (const T of tents) {
      T.k = damp(T.k, T.goal, 2.6, dt);
      if (T.k < 0.02) { T.v.hide(); T.suck.visible = false; continue; }
      const sw = 0.1 * Math.sin(t * 1.1 + T.ph), h = T.h * T.k;
      // idle: it sways over its root, its tip curled; at work: its tip is where its job puts it
      _tn3.copy(T.root).addScaledVector(UP, h).addScaledVector(Rt, sw * 1.3).addScaledVector(F, 0.14 * Math.cos(t * 0.9 + T.ph));
      _tn2.copy(T.root).addScaledVector(UP, h * 0.8).addScaledVector(Rt, -sw).addScaledVector(F, 0.07 * Math.cos(t * 0.8 + T.ph));
      _tnf.subVectors(H, T.root).setY(0).normalize();
      if (T.job && T.k > 0.6) {
        T.job(T, t, _tnp, _tng, _tnw); const w = Math.min(1, (T.k - 0.6) / 0.35);
        if (!T.was) { T.tip.copy(_tn3); T.was = true; }
        T.tip.lerp(_tnp, Math.min(1, dt * 7)); _tn3.lerp(T.tip, w); _tn2.lerp(_tng.add(_tnu.subVectors(T.tip, _tnp)), w); _tnf.lerp(_tnw, w).normalize();
      } else T.was = false;
      _tn1.copy(T.root).addScaledVector(UP, h * 0.42).addScaledVector(Rt, sw * 0.5);
      T.v.draw(T.root, _tn1, _tn2, _tn3, Rt, 0.052 * (0.5 + 0.5 * T.k), 0.0115);
      // its suckers: along the side that faces what it works on (or the middle of the pit)
      T.suck.visible = true;
      for (let i = 0; i < 10; i++) {
        const q = 0.4 + 0.058 * i, m = 1 - q, a = m * m * m, b = 3 * m * m * q, c = 3 * m * q * q, d = q * q * q;
        _tnp.set(a * T.root.x + b * _tn1.x + c * _tn2.x + d * _tn3.x, a * T.root.y + b * _tn1.y + c * _tn2.y + d * _tn3.y, a * T.root.z + b * _tn1.z + c * _tn2.z + d * _tn3.z);
        _tng.set(3 * m * m * (_tn1.x - T.root.x) + 6 * m * q * (_tn2.x - _tn1.x) + 3 * q * q * (_tn3.x - _tn2.x), 3 * m * m * (_tn1.y - T.root.y) + 6 * m * q * (_tn2.y - _tn1.y) + 3 * q * q * (_tn3.y - _tn2.y), 3 * m * m * (_tn1.z - T.root.z) + 6 * m * q * (_tn2.z - _tn1.z) + 3 * q * q * (_tn3.z - _tn2.z)).normalize();
        _tnw.copy(_tnf).addScaledVector(_tng, -_tnf.dot(_tng)); if (_tnw.lengthSq() < 1e-6) _tnw.copy(UP).addScaledVector(_tng, -_tng.y); _tnw.normalize(); _tnu.crossVectors(_tng, _tnw);
        const r = (0.052 * (0.5 + 0.5 * T.k)) + (0.0115 - 0.052 * (0.5 + 0.5 * T.k)) * q * (2 - q), rr = r * 0.42;
        _tnm.makeBasis(_tng, _tnw, _tnu).scale(_tnu.set(rr, rr * 0.5, rr)).setPosition(_tnp.addScaledVector(_tnw, r * 0.93));
        T.suck.setMatrixAt(i, _tnm);
      }
      T.suck.instanceMatrix.needsUpdate = true;
    }
  }
  const mouthOf = (m, out) => { m.headPos(out); m.head.getWorldQuaternion(_q0); return out.addScaledVector(_e.set(0, -0.045, 0.1).applyQuaternion(_q0), 1); };
  const _q0 = new THREE.Quaternion();
  // (3) ghosts: three pale blobs that bob in the dark, two gloved hands of their own, and cuffs for her ankles
  const ghostMat = new THREE.MeshLambertMaterial({ color: col(0.82, 0.86, 0.9), emissive: col(0.34, 0.38, 0.46), transparent: true, opacity: 0.94 });
  const ghostDark = new THREE.MeshBasicMaterial({ color: 0x1a1426 }), ghostTongue = '#8a4fc0';
  function makeGhost(i) {
    const g = new THREE.Group(), s = 0.115 + 0.012 * i;
    const body = new THREE.SphereGeometry(1, 20, 14), P = body.attributes.position;
    for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k); if (y < 0) { const a = Math.atan2(z, x), w = 1 - 0.3 * y * y, wave = 0.14 * Math.sin(a * 5) * -y; P.setXYZ(k, x * w * (1 + wave), y * 1.35 + 0.1 * Math.sin(a * 5) * y * y, z * w * (1 + wave) - 0.55 * y * y); } }      // a skirt with a wavy hem, trailing behind
    body.computeVertexNormals();
    const b = new THREE.Mesh(body, ghostMat); b.scale.setScalar(s); g.add(b);
    const eyes = [-1, 1].map((sx) => { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ghostDark); e.scale.set(0.13 * s, 0.2 * s, 0.06 * s); e.position.set(sx * 0.33 * s, 0.22 * s, 0.9 * s); g.add(e); return e; });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ghostDark); mouth.scale.set(0.2 * s, 0.12 * s, 0.06 * s); mouth.position.set(0, -0.14 * s, 0.94 * s); g.add(mouth);
    g.visible = false; scene.add(g);
    return { g, s, eyes, mouth, at: V3(), goal: V3(), k: 0, on: 0, ph: i * 2.1, face: V3(0, 0, 1), tongue: makeTongue(ghostTongue), tk: 0, lickFoot: -1, lickShoe: -1 };
  }
  const ghosts = [0, 1, 2].map(makeGhost);
  function makeHand(left) {                            // a white glove with four fingers and a thumb; +Y = the fingers' way, +Z = its back
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: col(0.86, 0.88, 0.92), emissive: col(0.3, 0.32, 0.38) });
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), m); palm.scale.set(0.02, 0.022, 0.009); g.add(palm);
    const fingers = [-1.5, -0.5, 0.5, 1.5].map((k) => { const f = new THREE.Group(); f.position.set(k * 0.0095, 0.017, 0); const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.0048, 0.022, 4, 8), m); c.position.y = 0.014; f.add(c); g.add(f); return f; });
    const th = new THREE.Group(); th.position.set((left ? 1 : -1) * 0.02, 0.0, 0); th.rotation.z = (left ? -1 : 1) * 0.9; const tc = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.016, 4, 8), m); tc.position.y = 0.012; th.add(tc); g.add(th);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.006, 6, 14), m); cuff.rotation.x = PI / 2; cuff.position.y = -0.022; g.add(cuff);
    g.visible = false; scene.add(g);
    return { g, fingers, k: 0, on: 0, foot: left ? 1 : 0, ph: left ? 1.3 : 0, at: V3() };
  }
  const hands = [makeHand(false), makeHand(true)];
  const cuffMat = new THREE.MeshLambertMaterial({ color: col(0.8, 0.84, 0.9), emissive: col(0.25, 0.28, 0.36) });
  const cuffs = [0, 1].map((j) => {                    // round her shins just above the ankles (bone space: +Y down the shin, the ankle at y = 0.2384; her shin is 3.4 by 4.8 cm there)
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 28), cuffMat); m.rotation.x = PI / 2; m.scale.set(0.029, 0.036, 0.022); m.position.set(j ? 0.004 : -0.004, 0.2384 - 0.05, -0.002); m.visible = false;
    const sb = bone(j ? 'lowerleg02L' : 'lowerleg02R'); if (sb) sb.add(m); return m;
  });
  const chain = (() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), cuffMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; })();
  // (4) fairies: four, as tall as her foot is long, green frocks, pink hair, two pairs of wings
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  function makeFairy(i) {
    const g = new THREE.Group(), hairC = [col(0.86, 0.1, 0.42), col(0.9, 0.4, 0.1), col(0.2, 0.42, 0.9), col(0.85, 0.7, 0.2)][i % 4], frock = [col(0.12, 0.5, 0.2), col(0.75, 0.3, 0.45), col(0.4, 0.3, 0.7), col(0.15, 0.5, 0.6)][i % 4], skin = col(0.95, 0.74, 0.64);
    const parts = [
      K.place(K.ball(0.02, skin, 1, 1.05, 1, 10), V3(0, 0.118, 0)),                                           // head
      K.place(K.ball(0.0225, hairC, 1.02, 1, 1.05, 10), V3(0, 0.122, -0.004)),                                 // hair: a cap...
      K.tube([V3(0, 0.125, -0.016), V3(0, 0.1, -0.03), V3(0.004, 0.07, -0.026)], (t) => 0.014 * (1 - 0.6 * t), () => hairC, 6, 6),   // ...and a tail down her back
      K.tube([V3(0, 0.1, 0), V3(0, 0.07, 0.002), V3(0, 0.045, 0)], (t) => 0.011 + 0.012 * t, () => frock, 8, 6),   // frock
      K.tube([V3(-0.008, 0.047, 0), V3(-0.01, 0.022, 0.004), V3(-0.01, 0.0, -0.004)], (t) => 0.0055 * (1 - 0.4 * t), () => skin, 5, 5),
      K.tube([V3(0.008, 0.047, 0), V3(0.011, 0.024, 0.006), V3(0.012, 0.004, 0.0)], (t) => 0.0055 * (1 - 0.4 * t), () => skin, 5, 5),
    ];
    const face = K.place(K.ball(0.0035, col(0.05, 0.03, 0.05), 1, 1.3, 0.5, 6), V3(-0.007, 0.12, 0.0185)), face2 = K.place(K.ball(0.0035, col(0.05, 0.03, 0.05), 1, 1.3, 0.5, 6), V3(0.007, 0.12, 0.0185));
    g.add(new THREE.Mesh(K.merge(parts.concat([face, face2])), K.MAT.plant));
    const arms = [-1, 1].map((sx) => { const a = new THREE.Group(); a.position.set(sx * 0.012, 0.096, 0); a.add(new THREE.Mesh(K.merge([K.tube([V3(0, 0, 0), V3(sx * 0.006, -0.004, 0.02), V3(sx * 0.004, 0.0, 0.04)], (t) => 0.0045 * (1 - 0.3 * t), () => skin, 5, 5), K.place(K.ball(0.0055, skin, 1, 1, 1, 6), V3(sx * 0.004, 0, 0.042))]), K.MAT.plant)); g.add(a); return a; });
    const wsh = new THREE.Shape(); wsh.moveTo(0, 0); wsh.bezierCurveTo(0.012, 0.022, 0.05, 0.03, 0.068, 0.012); wsh.bezierCurveTo(0.06, -0.006, 0.02, -0.012, 0, 0);
    const wg = new THREE.ShapeGeometry(wsh, 8);
    const wings = [[1, 0.5], [1, -0.35], [-1, 0.5], [-1, -0.35]].map(([sx, tilt]) => { const w = new THREE.Group(); w.position.set(sx * 0.006, 0.092, -0.01); const m = new THREE.Mesh(wg, wingMat); m.rotation.z = tilt; m.scale.x = sx; m.scale.y = tilt > 0 ? 1 : 0.8; w.add(m); g.add(w); return { w, sx }; });
    g.visible = false; scene.add(g);
    return { g, arms, wings, at: V3(), goal: V3(), face: V3(0, 0, 1), k: 0, on: 0, ph: i * 1.7, job: null };
  }
  const fairies = [0, 1, 2, 3].map(makeFairy);
  const threadMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const spiralThread = makeSpiral(7.5, col(0.75, 0.95, 1.2), col(1.1, 1.1, 1.3), 0.0045, threadMat, 0.03, 0.62);
  // (5) the thief (thief.js): she stands beside her legs, at the left of the picture in both views, and works on the
  // foot nearer to her with her left hand: fingers first, then a feather; her right hand is on her hip, or joins in
  const ropeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const spiralRope = makeSpiral(4.6, col(0.46, 0.33, 0.17), col(0.34, 0.24, 0.12), 0.0058, ropeMat, 0.025, 0.15, 0.74);
  // For her the floor lies DEEP lower: Anne's feet are then level with her shoulders, as on the sheet. She stands NEAR to use her fingers, FAR to use the feather.
  const DEEP = 0.4, tAt = (side, fwd) => { const p = floorPt(side, fwd); p.y -= DEEP; return p; };
  const NEAR = 0.4, FAR = 0.7, thf = { j: 0, t: 0, cycle: false, both: false };
  // the way she faces from a spot: at her legs, turned a little to the camera
  const thiefYaw = (at, back, turn = 0.32) => { const d = Math.atan2(H.x - at.x, H.z - at.z); _a.copy(H).addScaledVector(F, back ? -2.35 : 2.35); let dc = Math.atan2(_a.x - at.x, _a.z - at.z) - d; dc = Math.atan2(Math.sin(dc), Math.cos(dc)); return d + clamp(dc, -turn, turn); };
  // the way a hand points at X on her skin: along the skin from the shoulder's side, tipped `lift` radians towards it
  const _sh = V3(), _tg = V3();
  const approach = (sd, X, n, lift, dir) => { thief.shoulder(sd, _sh); _tg.subVectors(X, _sh); _tg.y *= 0.6; _tg.addScaledVector(n, -_tg.dot(n)); if (_tg.lengthSq() < 1e-6) _tg.copy(Rt); _tg.normalize(); return dir.copy(_tg).multiplyScalar(Math.cos(lift)).addScaledVector(n, -Math.sin(lift)); };
  // the feather's tip strokes a sole from heel to ball and back, 4 mm off it, its flat side to the skin
  const featherOn = (sd, j) => (X, dir, palm, t) => { const f = feet[j]; along(f, 0.22 + 0.68 * (0.5 + 0.5 * Math.sin(t * 2.7)), X).addScaledVector(f.side, 0.012 * Math.sin(t * 1.9)).addScaledVector(f.n, 0.004); approach(sd, X, f.n, 0.3, dir); palm.copy(f.n).negate(); };
  // her fingertips at a place of a sole (u along it, c metres off it), the palm over it
  const clawOn = (sd, j, u, c = 0.02) => (X, dir, palm, t) => { const f = feet[j]; along(f, u + 0.04 * Math.sin(t * 1.3), X).addScaledVector(f.side, 0.01 * Math.sin(t * 2.1)).addScaledVector(f.n, c); approach(sd, X, f.n, 0.6, dir); palm.copy(f.n).negate(); };

  // ---------- the scene's state ----------
  const HT = { on: false, kind: null, t: 0, bound: 0, boundGoal: 0, maidLick: 0, hush: false, drop: 0, vt: 0 };
  // jobs for the little ones: each is a place on (well, just off) one of her soles, or a place to hover
  const JOB = {
    sole: (j, u, v, c = 0.03) => (out, face) => { soleAt(j, u, v, c, out); if (face) face.copy(feet[j].n).negate(); },
    toes: (j, v, c = 0.035) => (out, face) => { along(feet[j], 1.22, out).addScaledVector(feet[j].side, v).addScaledVector(feet[j].n, c * 0.6).addScaledVector(feet[j].fwd, c); if (face) face.copy(feet[j].fwd).negate(); },
    hover: (side, fwd, y) => (out, face) => { out.copy(H).addScaledVector(Rt, side).addScaledVector(F, fwd); out.y = y; if (face) face.subVectors(feetMid(_d), out).setY(0).normalize(); },
    shoe: (k, u = 0.45, c = 0.032) => (out, face) => { const f = kit.shoeFrame(k); along(f, u, out).addScaledVector(f.n, c); if (face) face.copy(F); },      // (10-03) over her shoe's footbed, turned to the front camera
  };
  function updFairies(dt, t) {
    fairies.forEach((f, i) => {
      f.k = damp(f.k, f.on, 4, dt); f.g.visible = f.k > 0.02;
      if (!f.g.visible) return;
      if (f.job) f.job(f.goal, f.face);
      f.goal.y += 0.008 * Math.sin(t * 5.3 + f.ph); f.goal.addScaledVector(Rt, 0.006 * Math.sin(t * 3.7 + f.ph));
      f.at.lerp(f.goal, 1 - Math.exp(-dt * 6));
      // she hangs upright, turned to what she is busy with; her feet trail a little behind the way she moves
      f.g.position.copy(f.at); f.g.position.y -= 0.09; f.g.rotation.set(0.25, Math.atan2(f.face.x, f.face.z), 0, 'YXZ'); f.g.scale.setScalar(1.25 * f.k);
      const flap = Math.sin(t * 46 + f.ph);
      for (const w of f.wings) w.w.rotation.y = w.sx * (0.5 + 0.55 * flap);
      const busy = f.busy ? 1 : 0; f.arms[0].rotation.set(-0.5 * busy + 0.5 * busy * Math.sin(t * 17 + f.ph), 0, 0); f.arms[1].rotation.set(-0.5 * busy + 0.5 * busy * Math.sin(t * 19 + f.ph + 2), 0, 0);
      if (f.busy && Math.sin(t * 9 + f.ph) > 0.95) sparks.burst(_a.copy(f.at).addScaledVector(f.face, 0.03), SPARK, 1, 0.25, 0.3);
    });
  }
  const SPARK = new THREE.Color(1.5, 1.5, 0.9);
  function updGhosts(dt, t) {
    ghosts.forEach((gh, i) => {
      gh.k = damp(gh.k, gh.on, 3, dt); gh.g.visible = gh.k > 0.02;
      if (!gh.g.visible) { gh.tongue.hide(); return; }
      const sF = gh.lickFoot < 0 && gh.lickShoe >= 0 ? kit.shoeFrame(gh.lickShoe) : null;      // (10-03: or it licks inside one of her shoes on the floor)
      if (gh.job && !sF) gh.job(gh.goal, gh.face);
      if (gh.lickFoot >= 0) {                          // a ghost that licks floats with its mouth at her sole: 5 cm off it, no further
        gh.g.updateMatrixWorld(true); gh.mouth.getWorldPosition(_b); gh.goal.copy(gh.at).add(_c.subVectors(soleSpot(feet[gh.lickFoot], 0.55, 0, 0.05, _c), _b));
        gh.face.copy(feet[gh.lickFoot].n).negate().setY(0); if (gh.face.lengthSq() < 0.05) gh.face.set(0, 0, 1);
      } else if (sF) {                                 // just behind the shoe (from the front camera), turned to it: its tongue comes over the rim onto the footbed
        gh.g.updateMatrixWorld(true); gh.mouth.getWorldPosition(_b);
        along(sF, 0.45 + 0.18 * Math.sin(t * 0.7 + gh.ph), _c).addScaledVector(sF.n, 0.065).addScaledVector(F, -0.075); gh.goal.copy(gh.at).add(_c.sub(_b)); gh.face.copy(F);
      } else gh.goal.y += 0.02 * Math.sin(t * 1.7 + gh.ph);
      const licks = gh.lickFoot >= 0 || !!sF;
      gh.at.lerp(gh.goal, 1 - Math.exp(-dt * (licks && gh.tk > 0.5 ? 16 : 3.5)));      // (once at her sole it keeps up with her kicking)
      gh.g.position.copy(gh.at); gh.g.rotation.set(0.1 * Math.sin(t * 1.3 + gh.ph), Math.atan2(gh.face.x, gh.face.z), 0.12 * Math.sin(t * 1.1 + gh.ph), 'YXZ'); gh.g.scale.setScalar(gh.k);
      ghostMat.opacity = 0.94;
      const open = licks ? 1 : 0.4 + 0.3 * Math.sin(t * 2 + gh.ph); gh.mouth.scale.set(0.2 * gh.s, (0.07 + 0.11 * open) * gh.s, 0.06 * gh.s);
      gh.tk = damp(gh.tk, licks ? 1 : 0, 4, dt);
      if (gh.tk > 0.03 && licks) { gh.g.updateMatrixWorld(true); gh.mouth.getWorldPosition(_b); }
      if (gh.tk > 0.03 && licks) lick(gh.tongue, _b, sF || feet[gh.lickFoot], dt, gh.tk, 1.25 + 0.2 * i, 0.011, 0.0038, 0.1); else gh.tongue.hide();
    });
    hands.forEach((h, i) => {
      h.k = damp(h.k, h.on, 5, dt); h.g.visible = h.k > 0.02;
      if (!h.g.visible) return;
      const f = feet[h.foot], u = 1.16 + 0.05 * Math.sin(t * 2.3 + h.ph), v = 0.02 * Math.sin(t * 3.1 + h.ph);
      along(f, u, _a).addScaledVector(f.side, v).addScaledVector(f.n, 0.03);        // the palm hovers; only the fingertips come near her toes
      h.at.lerp(_a, 1 - Math.exp(-dt * 9)); C.orient(h.g, h.at, _b.copy(f.fwd).negate().addScaledVector(f.n, -0.55).normalize(), f.n);
      h.g.scale.setScalar(1.35 * h.k);
      h.fingers.forEach((fg, k) => { fg.rotation.x = -0.25 - 0.4 * (0.5 + 0.5 * Math.sin(t * 15 + k * 1.6 + h.ph)); });
    });
    const on = cuffs[0].visible;
    if (on && LEGS_OK) { _a.copy(ankW[0]).lerp(kneeW[0], 0.1); _b.copy(ankW[1]).lerp(kneeW[1], 0.1); _c.subVectors(_b, _a); const len = _c.length(); chain.visible = len > 0.075;
      if (chain.visible) { _c.divideScalar(len); chain.position.lerpVectors(_a, _b, 0.5); chain.quaternion.setFromUnitVectors(UP, _c); chain.scale.set(0.004, Math.max(0.001, len - 0.07), 0.004); } } else chain.visible = false;
  }
  S.late.push((dt, t) => {
    if (!HT.on) return;
    HT.t += dt; readLegs();
    HT.bound = damp(HT.bound, HT.boundGoal, HT.boundGoal ? 0.9 : 6, dt);
    if (A.anklesTogether) A.anklesTogether(Math.max(Math.min(1, HT.bound * 1.5), cuffs[0].visible ? 1 : 0));      // (10-03, as he asked: bound or cuffed, her ankles are clamped right next to each other)
    updVines(dt, t); updTents(dt, t); updGhosts(dt, t); updFairies(dt, t);
    if (HT.kind === 'thief') {
      spiralRope.draw(HT.bound);
      thief.update(dt, t);
    } else spiralRope.hide();
    if (HT.kind === 'vines') spiralVine.draw(HT.bound); else spiralVine.hide();
    if (HT.kind === 'ivy') spiralTent.draw(HT.bound); else spiralTent.hide();
    if (HT.kind === 'fairies') spiralThread.draw(HT.bound); else spiralThread.hide();
  });

  // the two ghosts that lick: one at each side of her feet, level with her soles, never between her and the camera
  function ghostLick() {
    [0, 1].forEach((j) => { ghosts[j].job = (out, face) => { soleAt(j, 0.5, 0, 0.07, out).addScaledVector(Rt, j ? -0.24 : 0.24); out.y -= 0.03 + 0.05 * j; face.subVectors(feet[j].arch, out).normalize(); }; });
  }
  // ---------- the five ----------
  const say = (sheet, i, text, o) => S.say(sheet, i, text, o);
  // (10-03, as he asked: everyone who talks has a word for the colour of her toenails, by its name: "Anne's look")
  const nailW = () => ((S.look && S.look()) || {}).nail || 'painted', NailW = () => { const n = nailW(); return n.charAt(0).toUpperCase() + n.slice(1); };
  const toastA = (text, sec = 2.2) => S.toast(text, 'dialog', sec);
  const rootOf = (v) => (out) => out.copy(v);
  // (10-03) her shoes go down to the floor of the hollow (s.baseY) and stand on their soles there, so that what lives down
  // there can lick and tickle inside them as well as her soles (he asked); the vines' tips ride the footbeds (kit.shoeFrame)
  const shoesTo = (to, carry, dur = 0.7) => { A.setHeelsWorn(false); kit.loose.forEach((s, i) => { s.baseY = FLOOR - (HT.kind === 'thief' ? DEEP : 0); s.lie = 'up'; kit.throwShoe(i, (o) => o.copy(to[i]), dur, null); s.rest.set(0, YAW + PI / 2 + (i ? 0.2 : -0.15), 0); }); };
  const shoeTick = () => { kit.tick(4, () => kit.shoeFrame(0), 'stroke', 'side', rootOf(SHOE_ROOT[0]), 'catkin', { rate: 0.85 }); kit.tick(5, () => kit.shoeFrame(1), 'arch', 'side', rootOf(SHOE_ROOT[1]), 'frond', { rate: 0.95, ph: 1.3 }); };
  const KINDS = {
    vines: {
      label: 'Vines',
      async arrive() { for (const v of vines) v.goal = 1; await S.wait(1.4); },
      async unshoe() {
        shoesTo(SHOE_AT, null); await S.wait(1.0);
      },
      tease() { kit.tick(0, 1, 'toes', 'toes', rootOf(vines[2].root), 'catkin', { rate: 0.6 }); kit.tick(1, 0, 'arch', 'heel', rootOf(vines[3].root), 'catkin', { rate: 0.6, ph: 1.4 }); },
      tickle() { kit.tick(2, 1, 'stroke', 'heel', rootOf(floorPt(-0.3, -0.5)), 'catkin', { rate: 1.1 }); kit.tick(3, 0, 'toes', 'toes', rootOf(floorPt(0.35, 0.55)), 'catkin', { rate: 1.2, ph: 2.2 }); },
      async bind() { HT.boundGoal = 1; await S.wait(1.6); },
      bound() { kit.tick(0, 1, 'stroke', 'heel', rootOf(vines[2].root), 'catkin', { rate: 1.2 }); kit.tick(1, 0, 'stroke', 'heel', rootOf(vines[3].root), 'catkin', { rate: 1.25, ph: 1.9 }); kit.tick(2, 1, 'toes', 'toes', rootOf(floorPt(-0.3, 0.5)), 'frond', { rate: 1.1 }); kit.tick(3, 0, 'toes', 'toes', rootOf(floorPt(0.35, 0.55)), 'catkin', { rate: 1.3, ph: 0.7 }); },
      leave() { for (const v of vines) v.goal = 0; },
      shoes: shoeTick, work: ['tick', 'vines'],
      who: null, hello: null, tease1: "Vines?! There are VINES down there?! G-get off my toes!!",
    },
    ivy: {                                         // (10-03: the pit's tentacles; the key is still 'ivy': the nest's pits and the tests name it)
      label: 'Tentacles',
      async arrive() { for (let i = 0; i < 4; i++) tents[i].goal = 1; await S.wait(1.5); },
      async unshoe() {
        tents[0].job = TJOB.sole(1, 0.2, 0.06, 2.0); tents[1].job = TJOB.sole(0, 0.2, 0.06, 2.0); await S.wait(0.9);      // a tip at each heel: off they come
        shoesTo(SHOE_AT, null); await S.wait(1.0);
      },
      tease() { tents[0].job = TJOB.sole(1, 0.9, 0.12, 1.5); tents[1].job = TJOB.sole(0, 0.5, 0.2, 1.3); tents[2].job = tents[3].job = null; },
      tickle() { tents[0].job = TJOB.sole(1, 0.52, 0.34, 2.6, -0.012); tents[1].job = TJOB.sole(0, 0.52, 0.34, 2.9, 0.012); tents[2].job = TJOB.sole(1, 1.05, 0.1, 5.5, 0.014); tents[3].job = TJOB.sole(0, 1.05, 0.1, 5.1, -0.014); },
      async bind() { HT.boundGoal = 1; await S.wait(1.6); },
      bound() { tents[0].job = TJOB.sole(1, 0.5, 0.38, 3.6, -0.012); tents[1].job = TJOB.sole(0, 0.5, 0.38, 3.9, 0.012); tents[2].job = TJOB.sole(1, 1.05, 0.12, 7, 0.014); tents[3].job = TJOB.sole(0, 1.05, 0.12, 6.6, -0.014); },
      leave() { for (const T of tents) { T.goal = 0; T.job = null; } },
      shoes() { tents[4].goal = tents[5].goal = 1; tents[4].job = TJOB.shoe(0); tents[5].job = TJOB.shoe(1); }, work: ['tick', 'vines'],      // (two more, inside her shoes on the floor)
      who: null, hello: null, tease1: 'T-TENTACLES?! There are TENTACLES down there?!\nG-get those slimy things off my toes!!',
    },
    ghosts: {
      label: 'Ghosts',
      async arrive() { ghosts.forEach((g, i) => { g.on = 1; g.job = JOB.hover([-0.5, 0.55, 0.05][i], [0.45, 0.4, -0.55][i], LV + [0.75, 0.9, 0.7][i]); g.job(g.at, g.face); g.lickFoot = -1; }); await S.wait(1.4); },
      async unshoe() {
        shoesTo(SHOE_AT, null, 0.9);             // (10-03: down to the floor, where a ghost licks inside each)
        ghosts[0].job = JOB.hover(-0.85, 0.2, LV + 0.6); ghosts[2].job = JOB.hover(0.9, -0.1, LV + 0.55); await S.wait(1.1);
        await say(null, 0, `Ooooh... ${nailW()} toesies...\nso waaarm... so wiiiggly...`, { name: 'Ghost' });
      },
      tease() { for (const h of hands) h.on = 1; },
      tickle() { ghosts[0].lickFoot = 0; ghosts[1].lickFoot = 1; ghosts[2].job = JOB.hover(0.05, -0.6, LV + 0.75); ghostLick(); },
      async bind() { for (const c of cuffs) c.visible = true; sparks.burst(_a.addVectors(ankW[0], ankW[1]).multiplyScalar(0.5), new THREE.Color(1.2, 1.3, 1.6), 14, 0.9, 0.5); await S.wait(1.0); },
      bound() { for (const h of hands) h.on = 1; ghosts[0].lickFoot = 0; ghosts[1].lickFoot = 1; ghostLick(); ghosts[2].job = JOB.hover(0.0, 0.7, LV + 0.8); },
      leave() { for (const g of ghosts) { g.on = 0; g.lickFoot = -1; g.lickShoe = -1; } for (const h of hands) h.on = 0; },
      shoes() { ghosts[2].lickShoe = 0; ghosts[1].lickShoe = 1; }, work: ['lick', 'ghosts'],      // (a ghost licking a sole keeps to it: lickFoot comes first)
      who: [null, 0, 'Ghost'], hello: 'Boo... hoo hoo hoo~', tease1: "G-g-ghosts?! Those are GLOVES! Whose HANDS are those?!",
    },
    fairies: {
      label: 'Fairies',
      async arrive() { fairies.forEach((f, i) => { f.on = 1; f.busy = false; f.job = JOB.hover([-0.4, 0.42, -0.2, 0.25][i], [0.35, 0.3, -0.4, -0.45][i], LV + [0.95, 1.05, 0.85, 0.9][i]); f.job(f.at, f.face); f.at.addScaledVector(Rt, i % 2 ? 1.5 : -1.5); }); await S.wait(1.4); },
      async unshoe() {
        const to = [floorPt(-0.5, 0.35).setY(FLOOR + 0.05), floorPt(0.55, 0.3).setY(FLOOR + 0.05)];
        fairies[0].job = (out, face) => { out.copy(kit.loose[0].g.position); out.y += 0.1; face.copy(F); }; fairies[1].job = (out, face) => { out.copy(kit.loose[1].g.position); out.y += 0.1; face.copy(F); };
        shoesTo(to, null, 1.3); await S.wait(1.5);
        await say(null, 0, `Ooh! ${NailW()} toes! Pretty, pretty!\nLet's make them wiggle!`, { name: 'Fairy' });
      },
      tease() { fairies.forEach((f, i) => { f.busy = i < 2; f.job = i < 2 ? JOB.toes(i, i ? 0.012 : -0.012) : JOB.hover(i === 2 ? -0.3 : 0.3, -0.35, LV + 0.8); }); },
      tickle() { fairies.forEach((f, i) => { f.busy = true; f.job = i < 2 ? JOB.toes(i, i ? 0.014 : -0.014) : JOB.sole(i - 2, 0.45, 0, 0.032); }); },
      async bind() { HT.boundGoal = 1; fairies.forEach((f, i) => { f.busy = false; f.job = i < 2 ? ((out, face) => { out.copy(spiralThread.tip).addScaledVector(legV, i ? 0.05 : -0.05); face.copy(legU); }) : JOB.hover(i === 2 ? -0.35 : 0.35, -0.4, LV + 0.85); }); await S.wait(1.7); },
      bound() { fairies.forEach((f, i) => { f.busy = true; f.job = i < 2 ? JOB.sole(i, 0.3 + 0.35 * i, 0, 0.032) : JOB.toes(i - 2, 0); }); },
      leave() { for (const f of fairies) { f.on = 0; f.busy = false; } },
      shoes(stage) { if (stage === 'tease' || stage === 'bind') [2, 3].forEach((i) => { fairies[i].busy = true; fairies[i].job = JOB.shoe(i - 2, 0.38 + 0.12 * (i - 2)); }); }, work: ['tick', 'fairies'],      // (the two not at her feet tickle inside her shoes)
      who: [null, 0, 'Fairy'], hello: 'Tee hee hee! Look what the pit caught!', tease1: 'F-fairies?! Shoo!! Those are MY toes!!',
    },
    thief: {
      label: 'The thief',
      // (the 2D sheet's four sets in turn: upper3 one hand's fingers, upper1 the feather, then the rope, upper4 both hands)
      async arrive() { low.position.y = -DEEP; thf.j = 0; const to = tAt(NEAR, -0.22); await thief.walk(tAt(2.1, -1.5), to, thiefYaw(to, false)); await S.wait(0.35); },
      async unshoe() {
        const L = thief.arm('L'); L.hold('grip'); L.to(clawOn('L', 0, 0.08, 0.085), 'reach'); await S.wait(0.75);      // her hand to the heel of the nearer shoe: one tug each
        shoesTo([tAt(1.15, -0.5).setY(FLOOR - DEEP + 0.05), tAt(1.35, -0.1).setY(FLOOR - DEEP + 0.05)], null, 0.8); L.to(null); L.hold('easy'); thief.expr('happy'); await S.wait(1.0);
        await say('au', 2, `And ${nailW()} toenails? My, my...\nthe little witch has taste.`, { name: 'Aurelia' });
      },
      tease() { thief.expr('smug'); thief.arm('L').to(clawOn('L', 0, 0.84), 'claw'); },
      tickle() { const L = thief.arm('L'), at = tAt(FAR, -0.25); thief.show(at, thiefYaw(at, false)); thief.expr('happy'); L.feather(true); L.to(featherOn('L', 0), 'feather'); },
      async bind() {                                     // she has come round to the other side; a rope round both ankles
        const L = thief.arm('L'), R = thief.arm('R'), at = tAt(-NEAR, -0.13); thf.j = 1; thief.show(at, thiefYaw(at, true, 0.1)); thief.expr('smug');      // (square to her feet: both hands are to reach them)
        L.feather(false); L.hold('grip'); HT.boundGoal = 1;
        L.to((X, dir, palm) => { _d.subVectors(spiralRope.tip, legC); _d.addScaledVector(legA, -_d.dot(legA)).normalize(); X.copy(spiralRope.tip).addScaledVector(_d, 0.035); thief.shoulder('L', _sh); dir.subVectors(X, _sh).normalize(); palm.copy(_d).negate(); }, 'reach');
        await S.wait(1.7); L.to(null); L.hold('easy'); R.to(null);
      },
      bound() { thief.expr('happy'); thief.arm('L').to(clawOn('L', 1, 0.36), 'claw'); thief.arm('R').to(clawOn('R', 1, 0.86), 'claw'); },
      leave() { thief.arm('L').to(null); thief.arm('R').to(null); thief.arm('L').feather(false); thief.arm('L').hold('easy'); },
      // (10-03: the thief's greeting follows whatever she has on her feet)
      who: ['au', 2, 'Aurelia'], get hello() { const st = ((S.look && S.look()) || {}).style; const R = C.lookSay ? C.lookSay('au') : null, A_ = { witch: 'A witch', school: 'A schoolgirl', office: 'An office lady', sporty: 'An athlete', beach: 'A beach girl', sleep: 'A sleepyhead', goth: 'A goth girl', bunny: 'A bunny girl', royal: 'A queen', warrior: 'A warrior', villain: 'A villain', maid: 'A maid', kimono: 'A fine lady', dancer: 'A dancer', casual: 'A girl', towel: 'A girl in a towel', tribal: 'A wild girl', cute: 'A doll', idol: 'A pop star', elegant: 'A lady', goddess: 'A goddess', fairy: 'A fairy' }; return 'Well, well. ' + ((R && A_[R.theme]) || 'A witch') + ', planted like a turnip.\n' + ({ sandal: 'And in such PRETTY little sandals.', tstrap: 'And in such PRIM little T-straps.', flipflop: 'And in flip-flops? Hardly worth stealing.', slide: 'And in slides? Hardly worth stealing.', toeloop: 'And in toe-posts? Hardly worth stealing.', cross: 'And in slides? Hardly worth stealing.', gladiator: 'And in gladiator sandals. Off to war, were we?', flats: 'And in such DAINTY little flats.', mules: 'And in mules. Half a shoe each... still worth a coin.', geta: 'And on little wooden stilts. How quaint.' }[st] || 'And in such EXPENSIVE shoes.'); }, tease1: 'Y-you! The thief from the road!! D-don\'t you dare!!',
    },
  };

  // ---------- the scene ----------
  const sprung = () => { pile.visible = false; rim.visible = true; if (!CAMP) S.state.flags[ID + 'Sprung'] = true; };
  function reset() {
    HT.on = false; HT.kind = null; HT.bound = HT.boundGoal = 0; if (A.setFloor) A.setFloor(null); if (A.anklesTogether) A.anklesTogether(0);
    kit.use(false); spiralVine.hide(); spiralTent.hide(); spiralThread.hide(); spiralRope.hide(); thief.hide(); low.position.y = 0;
    for (const v of vines) { v.goal = v.k = 0; v.v.hide(); }
    for (const T of tents) { T.goal = T.k = 0; T.job = null; T.was = false; T.v.hide(); T.suck.visible = false; }
    for (const g of ghosts) { g.on = g.k = 0; g.g.visible = false; g.tongue.hide(); g.lickFoot = -1; g.lickShoe = -1; }
    for (const h of hands) { h.on = h.k = 0; h.g.visible = false; }
    for (const f of fairies) { f.on = f.k = 0; f.g.visible = false; }
    for (const c of cuffs) c.visible = false; chain.visible = false;
    room.visible = false; rim.visible = !CAMP && (!!opts.open || !!S.state.flags[ID + 'Sprung']); pile.visible = CAMP;
    post.setCloseUp('off'); S.grassFlat = null; A.setHeelsWorn(true); if (A.setHat) A.setHat(true); S.toes(0);
  }
  const prevEnd = S.onSceneEnd; S.onSceneEnd = () => { if (HT.on) reset(); if (prevEnd) prevEnd(); };

  // (10-03) The hole trap has no tied-up variant (he asked to keep its own animations); its monsters work on her shoes'
  // footbeds as well as her soles (shoeJobs below).

  async function holeTrap() {
    let key;
    if (CAMP) {
      S.cam.two(anne, H, { y: 1.2, y2: 0.1, dist: 2.6, pitch: 0.3 });
      await S.turnTo(H);
      await say('a1', 7, 'A pile of leaves... right in the middle of the clearing.');
      await say('am', 0, 'Looks soft. Go on, kitty, step on it.', { keep: true });
      const names = ['vines', 'fairies', 'thief', 'ivy', 'ghosts'].filter((k) => KINDS[k]);
      const pickI = await S.choice(names.map((k) => 'Step on it: ' + KINDS[k].label).concat(['Leave it']));
      if (pickI >= names.length) { await say('a1', 6, "...I don't trust anything you call soft."); return; }
      key = names[pickI];
    } else {
      const list = (opts.kinds || [opts.kind || 'vines']).filter((k) => KINDS[k] && k !== 'thief'), want = new URLSearchParams(location.search).get('trapkind');
      key = (want && list.includes(want) ? want : opts.random ? list[Math.floor(Math.random() * list.length)] : list[0]) || 'vines';
      if (opts.onFall) opts.onFall(key);
    }
    const kd = KINDS[key];
    const shoesDo = (stage) => { if (!kd.shoes) return; kd.shoes(stage); if (kd.work && kit.noteShoe) kit.noteShoe(kd.work[0], kd.work[1]); };      // (10-03: noted, for when she puts them back on)
    // ----- the fall
    HT.on = true; HT.kind = key; HT.t = 0; kit.use(true); S.grassFlat = () => flatH;
    if (A.setFloor) A.setFloor(FLOOR - (key === 'thief' ? DEEP : 0));      // (10-03: her legs hang in the hollow: its floor is the ground her feet must not go into)
    await S.walk([H.clone()], { speed: 1.5 });
    sprung(); room.visible = true; S.place(H, YAW); S.clip(has('HoleIdle') ? 'HoleIdle' : 'Idle', 0); C.snapSoles();
    sparks.burst(V3(H.x, 0.25, H.z), new THREE.Color(0.9, 0.6, 0.25), 30, 2.4, 1.0);
    S.expr('shocked', 0.2); S.emote(anne, 'exclaim', 0.8); S.toast('Dammit!!|GOSH!!!|W-WHAT THE--?!', 'warning', 1.8);
    shot.top(); await S.wait(0.5); await S.mark('hfall');
    if (CAMP) {
      await say('a2', 12, "A PIT?!\nWho digs a pit in the middle of a camp?!", { expr: 'shocked' });
      await say('am', 4, 'Somebody who wanted your feet\nwhere they could be reached, kitty.');
    } else {
      S.toast('Dammit!!|GOSH!!!|W-WHAT THE--?!|NOO, MY SHOES!!', 'warning', 2.0); await S.wait(0.6);
      await say('a2', 12, key === 'ivy' ? 'A PIT?! Under the moss?!\nThis whole place is one big trap!!' : "A HOLE?! In the middle of the path?!", { expr: 'shocked' });
    }
    S.clip('HoleKick', 0.15); S.expr('strain');
    await say('a2', 5, "I'm stuck!! My arms are stuck!!\nA-and something is MOVING down there!!");
    // ----- below: who it is, and off with her shoes
    shot.below(false); await kd.arrive();
    if (kd.hello) await say(kd.who[0], kd.who[1], kd.hello, { name: kd.who[2] });
    if (C.lookSay && kd.who && /Ghost|Fairy|Aurelia/.test(kd.who[2])) {      // (batch 22: what the ones that talk make of her: her feet in her shoes, and what she is or wears)
      const R = C.lookSay(kd.who[2] === 'Ghost' ? 'ghost' : kd.who[2] === 'Fairy' ? 'fairy' : 'au');
      await say(kd.who[0], kd.who[1], R.feet, { name: kd.who[2] }); await say(kd.who[0], kd.who[1], R.outfit, { name: kd.who[2] }); if (R.species) await say(kd.who[0], kd.who[1], R.species, { name: kd.who[2] });      // (batch 23: her outfit always)
    }
    await kd.unshoe(); S.clip('HoleTease', 0.25); await S.mark('hshoes');
    shot.top(); S.expr('shocked', 0.4);
    await say('a2', 12, 'NOO, MY SHOES!!', { expr: 'shocked', blush: 0.4 });
    let free = false, n = 0;
    const bout = async (label) => { n++; return S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: `${label}  ·  try ${n} / 4`, width: [0.25, 0.22, 0.19, 0.16][n - 1], speed: [0.75, 0.85, 0.95, 1.05][n - 1] }); };
    try {
      // ----- 1: the tease (front)
      shot.below(false); kd.tease(); shoesDo('tease'); S.toes(0.25, 1.4, Infinity); await S.wait(1.2); await S.mark('htease');
      toastA(kd.tease1, 2.6); await S.wait(1.4);
      shot.feet(false); await S.wait(1.1); await S.mark('hfeet1'); await S.wait(1.1);
      if (kd.shoes) { shot.shoes(); await S.wait(1.6); await S.mark('hshoe1'); await S.wait(0.4); }      // (10-03: and inside her shoes, down on the floor)
      shot.below(false);
      free = await bout('they are only teasing');
      if (!free) {
        // ----- 2: the tickling (front), her laughing above
        shot.top(); S.clip('HoleTickled', 0.2); S.expr('laughHard', 0.8);
        await say('a2', 14, "AHAHAHA!! S-STOP!!\nI CAN'T EVEN SEE WHAT YOU'RE DOING!!", { expr: 'laughHard', blush: 0.8 });
        shot.below(false); kd.tickle(); shoesDo('tickle'); S.toes(0.32, 1.7, Infinity); await S.wait(1.6); await S.mark('htickle');
        shot.feet(true); await S.wait(1.3); await S.mark('hfeet2'); await S.wait(1.3); shot.below(false); await S.wait(0.8);
        free = await bout('her feet are all theirs');
      }
      if (!free) {
        // ----- 3: bound (back)
        shot.top({ side: -0.6 });
        await say('am', 2, 'You should see it from down there.\nActually, no. You should not.');
        shot.below(true); kit.clearTicklers(); S.clip('HoleBound', 0.35); { const b = kd.bind(); shoesDo('bind'); await b; } await S.mark('hbind');
        toastA('M-MY LEGS!! I CAN\'T KICK!!', 2.2); await S.wait(1.2);
        if (kd.shoes) { shot.shoes({ side: -0.3 }); await S.wait(1.5); await S.mark('hshoe2'); shot.below(true); await S.wait(0.3); }
        free = await bout('her legs are held');
      }
      if (!free) {
        // ----- 4: and tickled like that (back)
        shot.top(); S.expr('laughHard', 0.95);
        await say('a2', 18, 'HAHAHAHA!! N-NO MORE!! PLEASE!!\nAHAHAHAHAHA!!', { expr: 'laughHard', blush: 0.95 });
        shot.below(true); kd.bound(); shoesDo('bound'); S.toes(0.34, 1.8, Infinity); await S.wait(1.4); await S.mark('hbound');
        shot.feet(true); await S.wait(1.4); await S.mark('hfeet3'); await S.wait(1.4); shot.below(true); await S.wait(0.6);
        free = await bout('last chance');
      }
      if (free) {
        // ----- the kick that frees her
        shot.below(true); HT.boundGoal = 0; for (const c of cuffs) c.visible = false; kit.clearTicklers(); kd.leave();
        S.clip(has('HoleKickout') ? 'HoleKickout' : 'HoleKick', 0.08); S.expr('angry', 0.4);
        sparks.burst(feetMid(V3()), new THREE.Color(1.7, 1.3, 0.4), 26, 2.2, 0.9); await S.wait(0.9); await S.mark('hkick');
        await S.fade(1, 0.35);
        reset(); S.place(V3().copy(H).addScaledVector(F, 1.25), CAMP ? YAW + PI : YAW); S.clip('Idle', 0); S.cam.face(anne, { y: 1.35, dist: 2.6, turn: 0.5, cut: true });
        await kit.putShoesOn(); await S.fade(0, 0.5);
        await say('a2', 4, 'Okk!!!! That... that was unexpected!!', { expr: 'angry', blush: 0.4 });
        await say('am', 4, CAMP ? 'And you kept your shoes. Mostly.' : 'Mind the next mossy patch, kitty.');
      } else {
        // ----- four misses: she slips through (the 2D sheet's last frames: only her hat is left)
        shot.top(); S.expr('shocked', 0.6); S.clip('HoleTickled', 0.2); kd.leave(); kit.clearTicklers();
        toastA('I-I\'M SLIPPING!!', 1.6); await S.wait(0.5);
        kit.throwHat((o) => o.set(H.x + F.x * 0.1, 0.05, H.z + F.z * 0.1)); kit.hat.obj.visible = true;
        if (A.setFloor) A.setFloor(-99);                 // (she slips down through it: no floor to stand on)
        let k = 0; await S.until((dt) => { k = Math.min(1, k + dt / 0.75); anne.position.y = -1.25 * k * k; return k >= 1; });
        await S.mark('hend'); await S.wait(0.9);
        await S.fade(1, 0.6);
        if (!CAMP && opts.below) {                       // (10-02: the cave pit: below it is Scylla's grotto, scylla.js)
          reset(); anne.position.y = 0; S.clip('Idle', 0);
          if (await opts.below() === 'free') {           // she blasted the tentacles off and climbed out
            S.place(V3().copy(H).addScaledVector(F, 1.25), YAW); anne.position.y = 0; S.clip('Idle', 0); S.cam.face(anne, { y: 1.35, dist: 2.6, turn: 0.5, cut: true });
            await kit.putShoesOn(); await S.fade(0, 0.6);
            await say('a2', 4, "Ugh... slimy, wiggly, SUSHI-FACED...\nI'm never stepping on moss again!!", { expr: 'angry', blush: 0.4 });
            return;
          }
          if (opts.wake) { await opts.wake(false); return; }
        }
        if (!CAMP && opts.wake && key !== 'fairies') { reset(); anne.position.y = 0; S.clip('Idle', 0); await opts.wake(false); return; }      // (a room's pit: she comes round where she last rested; 10-12: not the fairies' pit: they let her go, as the 2D's do)
        reset(); anne.position.y = 0; S.place(V3().copy(H).addScaledVector(F, 1.25), CAMP ? YAW + PI : YAW); S.clip('Idle', 0); S.cam.face(anne, { y: 1.35, dist: 2.6, turn: 0.5, cut: true });
        await S.wait(0.4); await kit.putShoesOn(); await S.fade(0, 0.8);
        await say('am', 2, 'They let you go when you ran out of breath.\nIt took a while. I counted.');
        await say('a2', 34, '...Not. One. Word.', { expr: 'pout', blush: 0.5 });
      }
    } finally { anne.position.y = 0; if (HT.on) reset(); }
  }
  const ID = CAMP ? 'hole' : (opts.id || 'trap');
  if (CAMP) { S.on({ id: 'hole', at: H, r: 1.9, action: 'E — Look at the pile of leaves', run: holeTrap }); S.avoid(H, 0.4, 0.3); }
  else {
    // a hidden trap: she steps on it. Once it has gone off it is an open pit, and stepping up to it she jumps over it (the 2D's SKIP)
    pile.visible = false; rim.visible = !!opts.open || !!S.state.flags[ID + 'Sprung'];      // (nothing shows until it has gone off, unless it is an open hole from the start)
    // (10-12) a hole with something to say of it (opts.look: the 2D's "GnomeHole") is not hopped over once it has gone off: it stands in the way and is looked at
    const solidNow = () => { if (opts.look && S.state.flags[ID + 'Sprung']) { S.unblock(ID + 'B'); S.block(ID + 'B', H.x, H.z, 0.55); } };
    if (opts.look) { S.on({ id: ID + 'Look', at: H, r: 1.7, action: 'E — Look at the hole', when: () => !!S.state.flags[ID + 'Sprung'], run: opts.look }); solidNow(); }
    S.on({ id: ID, at: H, r: 1.0, touch: true, when: () => !opts.look || !S.state.flags[ID + 'Sprung'], run: async () => {      // (r: these pits sit in passages a tile wide: there is no way round them)
      if (!S.state.flags[ID + 'Sprung']) { try { return await holeTrap(); } finally { solidNow(); if (opts.onOut) opts.onOut(); } }
      const d = V3(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)), from = anne.position.clone(), to = V3().copy(H).addScaledVector(d, 1.2);
      S.toast('Hop!', 'note', 0.8); let k = 0;
      await S.until((dt) => { k = Math.min(1, k + dt / 0.5); anne.position.lerpVectors(from, to, k); anne.position.y = 0.45 * Math.sin(Math.PI * k); return k >= 1; });
      anne.position.y = 0;
    } });
  }


  if (!CAMP) return { hole: { at: H, kinds: opts.kinds || [opts.kind || 'vines'] }, thief, pumpkins: [], kit };

  // =====================================================================================================
  //                                             the pumpkin fiend
  // =====================================================================================================
  // CommonEvent 62 ScenePUMPKIN, sheet anne-pumpkin-fiend-1. One of the pumpkins by the hedge is carved, and awake.
  // She reaches in for its seeds (a gauge); a miss and its roots come up under her. Then, as the sheet has it and
  // seen from her side as the sheet draws it (she faces the left of the picture, its head at her feet):
  //   tease1    she sits on the mound of roots, a tendril round her ankle, her shoes off beside her; it grins at her
  //   lickle1   her legs held out level in a coil of vine: the head, on its long vine, licks her soles; a gauge
  //   lickle2   tipped back, her legs wound and held up high: it licks from above; a gauge
  // with a close-up of her soles in each bout. Kicking free "unlocks" Mr. Pumpkin: he can then be woken on purpose.
  const SEAT = 0.30;                                     // the mound's top above the ground (poses.py PUMPKIN_SEAT)
  const DK = [col(0.045, 0.075, 0.055), col(0.07, 0.105, 0.065), col(0.105, 0.135, 0.075)];
  const hexC = (h) => new THREE.Color(h);
  // ---------- his head: a ribbed pumpkin with a carved face that glows when he is awake ----------
  function makePumpkinHead(R = 0.21) {
    const g = new THREE.Group(), RIBS = 9, NU = RIBS * 8, NV = 20, SQ = 0.82;
    const groove = (u) => Math.abs(Math.cos((u + 0.5 / RIBS) * PI * RIBS)) ** 4;      // (a rib, not a groove, runs down the middle of his face)
    // the rind: u round it (0 = his face, +Z), v from the stalk (0) to underneath (1); k: how far off it
    const surf = (u, v, out, k = 1) => {
      const down = v * PI, sn = Math.sin(down), r = R * Math.pow(Math.max(0, sn), 0.75) * (1 - 0.13 * groove(u) * Math.pow(Math.max(0, sn), 0.3)) * (1 + 0.07 * (v - 0.5));
      const y = Math.cos(down) - 0.32 * Math.exp(-((down / 0.5) ** 2)) + 0.12 * Math.exp(-(((PI - down) / 0.45) ** 2));
      return out.set(Math.sin(u * TAU) * r * k, y * R * SQ * k, Math.cos(u * TAU) * r * k);
    };
    {
      const pos = [], colr = [], idx = [], P = V3(), c = new THREE.Color();
      const RIND = hexC('#c8650f'), LIGHT = hexC('#e08a1c'), GROOVE = hexC('#8f3d08'), PALE = hexC('#c99a3a');
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const u = i / NU, v = j / NV; surf(u, v, P); pos.push(P.x, P.y, P.z);
        c.copy(RIND).lerp(LIGHT, 0.55 * sst(v, 0.55, 0.1)).lerp(GROOVE, 0.8 * groove(u) * sst(v, 0, 0.15)).lerp(PALE, 0.45 * sst(v, 0.72, 1)).lerp(GROOVE, 0.6 * sst(v, 0.09, 0));
        colr.push(c.r, c.g, c.b);
        if (i < NU && j < NV) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(shadowy(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }))));
    }
    // the face: each cut is drawn twice on the rind, a dark rim and, a little smaller and further out, the light inside.
    // A cut is a list of triangles in face co-ordinates [a, v]: a = the angle round from the middle of his face, v as above.
    const rim = new THREE.MeshBasicMaterial({ color: 0x241003 }), glowMat = new THREE.MeshBasicMaterial({ color: 0x241003 });
    const cuts = [];
    const eye = (sx) => [[[sx * 0.24, 0.445], [sx * 0.66, 0.385], [sx * 0.42, 0.285]]];
    cuts.push(eye(1), eye(-1), [[[-0.075, 0.535], [0.075, 0.535], [0, 0.455]]]);
    { const N = 28, top = (a) => 0.665 - 0.105 * (a / 0.82) ** 2, bot = (a) => 0.80 - 0.19 * (a / 0.82) ** 2, saw = (x) => Math.abs(((x % 1) + 1) % 1 - 0.5) * 2, m = [];      // a wide grin with teeth
      const T = (a) => top(a) + 0.034 * saw(a * 4.2 + 0.25) * (1 - (a / 0.82) ** 2), B = (a) => bot(a) - 0.034 * saw(a * 4.2 + 0.75) * (1 - (a / 0.82) ** 2);
      for (let i = 0; i < N; i++) { const a0 = -0.82 + 1.64 * i / N, a1 = -0.82 + 1.64 * (i + 1) / N; m.push([[a0, T(a0)], [a0, B(a0)], [a1, B(a1)]], [[a0, T(a0)], [a1, B(a1)], [a1, T(a1)]]); }
      cuts.push(m); }
    const build = (shrink, k, mat) => {
      const pos = [], P = V3();
      const put = (q) => { surf(q[0] / TAU, q[1], P, k); pos.push(P.x, P.y, P.z); };
      const tri = (p0, p1, p2, lv) => {
        if (lv === 0) { put(p0); put(p1); put(p2); return; }
        const m01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], m20 = [(p2[0] + p0[0]) / 2, (p2[1] + p0[1]) / 2];
        tri(p0, m01, m20, lv - 1); tri(m01, p1, m12, lv - 1); tri(m20, m12, p2, lv - 1); tri(m01, m12, m20, lv - 1);
      };
      for (const cut of cuts) {
        let ca = 0, cv = 0, n = 0; for (const t of cut) for (const q of t) { ca += q[0]; cv += q[1]; n++; } ca /= n; cv /= n;
        const sh = (q) => [ca + (q[0] - ca) * shrink, cv + (q[1] - cv) * shrink];
        for (const t of cut) tri(sh(t[0]), sh(t[1]), sh(t[2]), cut.length > 4 ? 1 : 2);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; g.add(m); return m;
    };
    build(1, 1.012, rim); build(0.8, 1.02, glowMat);
    // the stalk he hangs by
    g.add(new THREE.Mesh(K.tube([V3(0, R * SQ * 0.62, 0), V3(0, R * SQ * 0.95, -0.01), V3(0.01, R * SQ * 1.2, -0.05)], (t) => 0.03 * (1 - 0.45 * t), () => DK[1], 7, 6), K.MAT.plant));
    scene.add(g);
    const ON = new THREE.Color(1.7, 0.95, 0.22), OFF = new THREE.Color(0x241003);
    return { g, R, SQ, glowMat, glow: 0, glowTo: 0, gp: V3(), gq: new THREE.Quaternion(), snap: true, tongue: makeTongue('#7436a8'), tk: 0, foot: 0, ON, OFF,
      mouth: (out) => g.localToWorld(out.set(0, -0.105, 0.165)), top: (out) => g.localToWorld(out.set(0.01, R * SQ * 1.2, -0.05)) };
  }
  // ---------- the mound of roots she is sat on ----------
  const mound = new THREE.Group(); mound.visible = false; scene.add(mound);
  {
    const r = K.rng(4410), parts = [];
    const dome = new THREE.SphereGeometry(1, 30, 16), P = dome.attributes.position, cc = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i) * 0.56, y = P.getY(i) * 0.43, z = P.getZ(i) * 0.50; const a = Math.atan2(z, x);
      const k = 1 + 0.07 * Math.sin(a * 6 + y * 9) + 0.05 * Math.sin(a * 11 - y * 14); x *= k; z *= k;
      y = Math.min(y, SEAT - 0.004 + 0.004 * Math.sin(x * 23) * Math.sin(z * 19));      // a flat top: her seat and her hands rest on it
      P.setXYZ(i, x, Math.max(y, -0.03), z);
      const c = mix(DK[0], DK[2], 0.5 + 0.5 * Math.sin(a * 9 + y * 20)); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b;
    }
    dome.setAttribute('color', new THREE.BufferAttribute(cc, 3)); dome.computeVertexNormals(); parts.push(dome);
    for (let i = 0; i < 11; i++) {                       // roots down its sides and out over the ground
      const a = i / 11 * TAU + r.r(-0.15, 0.15), ca = Math.cos(a), sa = Math.sin(a), L = r.r(0.75, 1.05), tw = r.r(-0.3, 0.3);
      parts.push(K.tube([V3(ca * 0.3, SEAT - 0.03, sa * 0.27), V3(ca * 0.5, SEAT * 0.72, sa * 0.45), V3(ca * 0.62 - sa * tw * 0.2, 0.07, sa * 0.56 + ca * tw * 0.2), V3(ca * L - sa * tw, 0.012, sa * L * 0.9 + ca * tw)],
        (t) => 0.05 * (1 - 0.78 * t) + 0.006, (t) => mix(DK[1], DK[0], t), 7, 12));
    }
    mound.add(shadowy(new THREE.Mesh(K.merge(parts), K.MAT.plant)));
  }
  const MOUND_BACK = 0.24;                               // the mound's middle lies this far behind her seat
  // ---------- the tendril round her left ankle (tease1), the coil round both legs, the vine his head rides on ----------
  const anklet = new THREE.Group(); anklet.visible = false;
  { const sb = bone('lowerleg02L'), m = new THREE.MeshLambertMaterial({ color: DK[2] });
    if (sb) { for (const dy of [0.036, 0.062, 0.088]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 28), m); t.rotation.x = PI / 2; t.scale.set(0.029, 0.036, 0.026); t.position.set(0.004, 0.2384 - dy, -0.002); t.castShadow = true; t.receiveShadow = true; anklet.add(t); } sb.add(anklet); } }
  const leash = kit.makeVine(DK[1], DK[2], 14, 6), bodyVine = kit.makeVine(DK[0], DK[2], 30, 8), feed = kit.makeVine(DK[1], DK[2], 12, 6);
  const coilPk = makeSpiral(6, DK[1], DK[2], 0.0135, null, 0.06, 0.92);

  // ---------- where it plays ----------
  const PK = { on: false, st: null, mode: 'home', wound: 0, woundTo: 0, t: 0, near: 0.3 };
  const stages = [];
  for (const [tx, ty] of (S.level.pumpkins_event || [])) {
    const c = S.tileC(tx, ty);
    const wk = (x, z) => !env.walkAt || env.walkAt(Math.floor(x / TILE), Math.floor(z / TILE));
    if (!wk(c.x, c.z - TILE)) continue;                  // (only the groups she can walk up to: the clearing is to their north)
    const home = V3(c.x, 0, c.z - 1.05);
    let seat = null;
    for (const dx of [-0.5, 0.1, 0.7, -1.1, 1.3]) { const x = c.x + dx, z = c.z - 2.9; if ([-0.85, -0.3, 0.4, 1.1, 1.9].every((e) => wk(x + e, z) && wk(x + e, z - 0.9))) { seat = V3(x, 0, z); break; } }
    if (!seat) continue;
    const head = makePumpkinHead(); head.g.position.set(home.x, head.R * head.SQ * 0.9, home.z); head.g.rotation.y = 0;      // asleep, his face to the hedge
    const st = { home, seat, yaw: PI / 2, E: V3(1, 0, 0), N: V3(0, 0, -1), head, flat: { p: V3(seat.x + 0.6, 0, seat.z), r: 2.5, k: 0.985 } };
    stages.push(st);
    S.avoid(home, 0.34, 0.4);
    S.on({ id: stages.length === 1 ? 'pumpkin' : 'pumpkin' + stages.length, at: home, r: 1.75, action: 'E — Look at the pumpkins', run: () => pumpkin(st) });
  }
  // ---------- the pictures ----------
  const pshot = {
    // the sheet's view: from her left, level with her
    side(o = {}) { const st = PK.st; cl.copy(st.seat).addScaledVector(st.E, o.x === undefined ? 0.62 : o.x); cl.y = o.y || 0.66; cp.copy(cl).addScaledVector(st.N, o.dist || 3.7); cp.y = cl.y + 0.22; S.cam.set(cp, cl, { fov: o.fov || 36, cut: true }); post.setCloseUp('off'); },
    // close on her soles, from beside his head
    // close on her soles and his tongue, from the picture's side of his head
    feet() { const st = PK.st; feetMid(); _c.addVectors(feet[0].sn, feet[1].sn).normalize();
      _c.addScaledVector(st.N, -_c.dot(st.N)).normalize();      // (from beside his head, well out to the picture's side: her soles in front of him, not behind)
      cp.copy(fmid).addScaledVector(_c, 0.42).addScaledVector(st.N, 0.92); cp.y += 0.1; cl.copy(fmid).addScaledVector(_c, 0.08); S.cam.set(cp, cl, { fov: 34, cut: true }); post.setCloseUp('off'); },      // (no depth of field here: his head is close to the lens, and its blurred edge would tear)
  };
  // ---------- every frame ----------
  const hx = V3(), hy = V3(), hz = V3(), hm = new THREE.Matrix4(), hq = new THREE.Quaternion(), hp = V3();
  const facing = (z, out) => { hz.copy(z).normalize(); hx.crossVectors(UP, hz); if (hx.lengthSq() < 1e-4) hx.copy(PK.st.N); hx.normalize(); hy.crossVectors(hz, hx); return out.setFromRotationMatrix(hm.makeBasis(hx, hy, hz)); };
  S.late.push((dt, t) => {
    for (const st of stages) { const h = st.head; h.glow = damp(h.glow, h.glowTo, 5, dt); h.glowMat.color.copy(h.OFF).lerp(h.ON, h.glow * (0.86 + 0.14 * Math.sin(t * 7.3))); }
    if (!PK.on) return;
    const st = PK.st, h = st.head; PK.t += dt; readLegs();
    PK.wound = damp(PK.wound, PK.woundTo, PK.woundTo ? 1.6 : 7, dt);
    if (A.anklesTogether && PK.mode !== 'tied') A.anklesTogether(Math.min(1, PK.wound * 2));      // (10-03: his vine round her legs holds her ankles together)
    if (PK.mode === 'wake') {                            // he turns round to look at her
      h.gp.set(st.home.x, h.R * h.SQ * 0.9 + 0.03 * Math.abs(Math.sin(t * 9)), st.home.z); facing(_a.subVectors(anne.position, st.home).setY(0.25), h.gq);
    } else if (PK.mode === 'tease') {                    // on the ground behind her, at the camera's side of the mound, grinning up at her
      h.gp.copy(st.seat).addScaledVector(st.E, -0.95).addScaledVector(st.N, 0.42); h.gp.y = h.R * h.SQ * 0.9 + 0.025 * Math.abs(Math.sin(t * 5));
      facing(_a.copy(st.seat).addScaledVector(st.E, 0.5).addScaledVector(st.N, 2.2).setY(1.05).sub(h.gp), h.gq);      // (his face to the picture, turned her way)
      const sb = feet[1].shin; if (sb) { sb.getWorldPosition(_a); feet[1].foot.getWorldPosition(_b); _a.lerp(_b, 0.86);      // the tendril: from the mound's foot to the coil round her ankle
        _b.copy(st.seat).addScaledVector(st.E, 0.2).addScaledVector(st.N, 0.3).setY(0.03); _c.lerpVectors(_b, _a, 0.5).addScaledVector(st.N, 0.12); _c.y = 0.04; _d.copy(_a).addScaledVector(st.N, 0.06); _d.y -= 0.05;
        leash.draw(_b, _c, _d, _a.addScaledVector(st.N, 0.03), UP, 0.016, 0.009); }
      // his own vine: out of the back of the mound to his stalk
      _a.copy(st.seat).addScaledVector(st.E, -MOUND_BACK - 0.5).setY(0.05); h.top(_d); _b.copy(_a).addScaledVector(st.E, -0.5).setY(0.1); _c.copy(_d).addScaledVector(st.E, -0.25).setY(_d.y + 0.3);
      bodyVine.draw(_a, _b, _c, _d, st.N, 0.04, 0.024);
    } else if (PK.mode === 'lick' || PK.mode === 'reel') {
      feetMid(); _c.addVectors(feet[0].sn, feet[1].sn); _c.addScaledVector(PK.st.N, -_c.dot(PK.st.N)).normalize();      // (10-02: never towards the camera: "the pumpkin hides her feet")
      if (PK.mode === 'lick') {                          // his face before her soles, a little way off; he bobs as he licks
        h.gp.copy(fmid).addScaledVector(_c, PK.near + 0.006 * Math.sin(t * 5.2)).addScaledVector(st.N, -0.07 + 0.008 * Math.sin(t * 2.3)); h.gp.y += 0.006 * Math.sin(t * 3.4);      // (near: set below from where his mouth is, so that it stays 6 cm off her soles)
        facing(_a.copy(_c).negate().addScaledVector(st.N, 0.1 * Math.sin(t * 1.7)), h.gq);
      } else {                                           // kicked: he reels away, his light out
        h.gp.copy(st.seat).addScaledVector(st.E, 2.2); h.gp.y = 0.7 + 0.25 * Math.sin(t * 9); facing(_a.copy(st.E).setY(0.6 * Math.sin(t * 13)), h.gq);
      }
      // his vine: from the foot of the mound out along the ground, then up and back over to his stalk
      _a.copy(st.seat).addScaledVector(st.E, 0.42).addScaledVector(st.N, -0.2).setY(0.04); h.top(_d);
      _b.copy(st.seat).addScaledVector(st.E, 2.75).addScaledVector(st.N, -0.3).setY(0.02);
      _e.copy(_d).sub(h.g.position).normalize(); _c.copy(_d).addScaledVector(_e, 0.55).addScaledVector(st.E, 0.5); _c.y += 0.3;
      bodyVine.draw(_a, _b, _c, _d, st.N, 0.045, 0.024);
    }
    const k = h.snap ? 1 : 1 - Math.exp(-dt * 6); h.snap = false;
    h.g.position.lerp(h.gp, k); h.g.quaternion.slerp(h.gq, k); h.g.updateMatrixWorld(true);
    // his tongue: one sole, then the other
    h.tk = damp(h.tk, PK.mode === 'lick' ? 1 : 0, 5, dt);
    if (PK.mode === 'lick') { h.mouth(_b); feetMid(); _c.addVectors(feet[0].sn, feet[1].sn).normalize(); PK.near = clamp(PK.near - (_a.subVectors(_b, fmid).dot(_c) - 0.065) * Math.min(1, dt * 3), 0.2, 0.5); }
    if (h.tk > 0.03 && PK.mode === 'lick') { const before = h.tongue.ph; lick(h.tongue, h.mouth(_b), feet[h.foot], dt, h.tk, 1.25, 0.017, 0.006, 0.12); if (h.tongue.ph < before) h.foot = 1 - h.foot; } else if (PK.mode !== 'tied') h.tongue.hide();      // ('tied': captures.js bound licks with his tongue)
    // the coil round her legs, and the vine that feeds it from the mound
    coilPk.draw(PK.wound);
    if (PK.wound > 0.03) { _a.copy(st.seat).addScaledVector(st.E, 0.36).addScaledVector(st.N, 0.16).setY(0.06); _d.copy(coilPk.tip); _b.copy(_a).addScaledVector(st.E, 0.25).setY(0.12); _c.copy(_d).addScaledVector(UP, -0.14).addScaledVector(st.N, 0.05); feed.draw(_a, _b, _c, _d, st.N, 0.02, 0.0135); } else feed.hide();
    if (PK.mode !== 'tease') leash.hide();
  });

  function resetPk() {
    const st = PK.st; PK.on = false; PK.mode = 'home'; PK.wound = PK.woundTo = 0; if (A.anklesTogether) A.anklesTogether(0);
    kit.use(false); mound.visible = false; anklet.visible = false; leash.hide(); bodyVine.hide(); feed.hide(); coilPk.hide();
    if (st) { const h = st.head; h.tongue.hide(); h.tk = 0; h.glowTo = 0; h.g.position.set(st.home.x, h.R * h.SQ * 0.9, st.home.z); h.g.rotation.set(0, 0, 0); }
    anne.position.y = 0; post.setCloseUp('off'); S.grassFlat = null; A.setHeelsWorn(true); if (A.setHat) A.setHat(true); S.toes(0);
  }
  const prevEnd2 = S.onSceneEnd; S.onSceneEnd = () => { if (PK.on) resetPk(); if (prevEnd2) prevEnd2(); };

  // (10-02) tied up: his vines trip her onto her front and tie her ankles and her big toes; his tendrils tickle her soles,
  // then his head comes down on his vine to lick them (captures.js bound drives the tongue; this, where his head is)
  async function pumpkinTied(st, chained = false) {
    const h = st.head, pkSay = (text) => S.say(null, 0, text, { name: 'Mr. Pumpkin' }), _dd = V3(), _fm = V3();
    let fr = null;
    const at = (side, fwd, y, out = V3()) => out.copy(fr.mid).addScaledVector(fr.side, side).addScaledVector(fr.out, fwd).setY(y);
    const R = (side, fwd) => (out) => at(side, fwd, 0.03, out);
    PK.mode = 'tied'; h.glowTo = 1; h.tongue.hide();      // (10-03: chained after his 2D rounds, his last-drawn tongue must not hang there; bound() takes it up in round 2)
    const lines = { open: chained ? ['Hee hee! Not done with you yet, seed thief!\nNow hold still while I tie those wiggly toes!'] : ['Hee hee hee! Such pretty shoes.\nYou will not be needing those.'], tickle: ['Hold still, little seed thief!'], lick: ['Mmm! Sweeter than pumpkin pie!'], fast: ['Tickle tickle tickle!! Hee hee hee!!'], lost: ['Come back when you have more seeds, little witch!'] };
    let res = null;
    try {
      res = await cap.bound({ kind: 'pumpkin', list: [], keep: true, chained, seat: st.seat.clone(), yaw: st.yaw, theme: 'vine',
        setup: (f) => { fr = f; at(0.25, 0.75, 0.45, h.gp); h.snap = true; },
        tools: [[R(-0.4, 0.45), 0, 'stroke', 'toes', 'catkin', { rate: 1.1 }], [R(0.4, 0.45), 1, 'stroke', 'toes', 'catkin', { rate: 1.2, ph: 2.0 }], [R(-0.35, 0.05), 0, 'arch', 'side', 'frond', { rate: 1.3 }]],
        lick: [{ mouth: (out) => h.mouth(out), tongue: h.tongue, spot: [0.55, 'far', 0.035],
          toward: (mouth, P, dt) => { h.gp.addScaledVector(_dd.subVectors(P, mouth), Math.min(1, dt * 7)); } }],
        onFrame: (dt, t) => {                          // his head faces her soles; his vine runs from the ground beyond her feet up to it
          if (!fr) return; C.feet && _fm.addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5); facing(_dd.subVectors(_fm, h.g.position).setY(_dd.y * 0.3), h.gq);
          at(0.0, 1.3, 0.04, _a); h.top(_d); _b.copy(_a).addScaledVector(fr.out, -0.3).setY(0.1); _c.copy(_d).addScaledVector(fr.out, 0.3); _c.y += 0.3; bodyVine.draw(_a, _b, _c, _d, fr.side, 0.045, 0.024);
        },
        say: async (stage) => { for (const text of lines[stage] || []) await pkSay(text); },
      });
    } finally { resetPk(); }
    // (10-03) back on her feet beside the patch, and the screen back (bound ends on black); kicking free unlocks him too
    const met = S.flag('mrPumpkin');
    S.place(V3().copy(st.seat).addScaledVector(st.N, 0.4), Math.atan2(st.home.x - st.seat.x, st.home.z - st.seat.z - 0.4)); S.clip('Idle', 0); S.cam.face(anne, { y: 1.35, dist: 2.7, turn: 0.5, cut: true });
    await S.wait(0.3); await kit.putShoesOn(); await S.fade(0, 0.6);
    if (res && res.free) {
      if (!met) { S.flag('mrPumpkin', true); S.toast('Mr. Pumpkin unlocked!', 'success', 2.8); }
      await say('a2', 4, 'Seeds. I only wanted the SEEDS!!', { expr: 'angry', blush: 0.4 });
    } else {
      await say('am', 2, 'He dozed off in the middle of a lick.\nLucky kitty.');
      await say('a2', 34, '...Not. One. Word.', { expr: 'pout', blush: 0.5 });
    }
  }

  async function pumpkin(st) {
    const h = st.head, pkSay = (text) => S.say(null, 0, text, { name: 'Mr. Pumpkin' });
    S.cam.two(anne, h.g, { y: 1.2, y2: 0.2, dist: 2.7, pitch: 0.3 });
    await S.turnTo(st.home);
    const met = S.flag('mrPumpkin');
    if (!met) {
      await say('a1', 9, 'Pumpkins! Fat ones, too.\nTheir seeds fetch a good price in town.');
      await say('am', 0, 'That one has been carved, kitty.\nWho carves a pumpkin and leaves it under a hedge?', { keep: true });
    } else await say('am', 0, 'Mr. Pumpkin is asleep again.\nYou could leave him that way.', { keep: true });
    const opts = met ? ['Reach in for the seeds', 'Wake Mr. Pumpkin', 'Leave him be'] : ['Reach in for the seeds', 'Leave them'];
    const pick = await S.choice(opts);
    if (pick === opts.length - 1) { await say('a1', 6, 'On second thought... no.'); return; }
    if (!(met && pick === 1)) {
      const got = await S.gauge({ label: 'Snatch the seeds! Press SPACE in the green!', sub: 'quick fingers', width: 0.22, speed: 0.9 });
      if (got) {
        S.counts(S.state.herbs, S.state.coins + 3); S.toast('Pumpkin seeds!  +3 coins', 'success', 2.4); sparks.burst(V3(st.home.x, 0.4, st.home.z), new THREE.Color(1.6, 1.1, 0.3), 14, 1.2, 0.6);
        await say('a1', 7, 'Got them! And he never felt a thing.', { expr: 'smug' }); return;
      }
    }
    // ----- he wakes
    PK.on = true; PK.st = st; PK.t = 0; kit.use(true); PK.mode = 'wake'; h.glowTo = 1; h.gp.copy(h.g.position); h.gq.copy(h.g.quaternion);
    S.clip('Startle', 0.1); S.expr('shocked', 0.2); S.emote(anne, 'exclaim', 0.8); toastA('Hee hee hee hee!!', 2.0); await S.wait(1.0); await S.mark('pwake');
    await say('a2', 12, "I-IT'S ALIVE?!", { expr: 'shocked' });
    const way = S.capStyle && cap.bound ? S.capStyle() : '2d';      // (10-03: 'both', the default: his 2D rounds, then tied up as the last round)
    if (way === 'tied') { await pumpkinTied(st); return; }
    try {
      // ----- tease1: sat on his roots, her shoes off, a tendril round her ankle
      await S.fade(1, 0.3);
      mound.position.copy(st.seat).addScaledVector(st.E, -MOUND_BACK); mound.rotation.y = 0; mound.visible = true; S.grassFlat = () => st.flat;
      S.place(st.seat, st.yaw); anne.position.y = SEAT; S.clip('PumpkinSeat', 0); A.setHeelsWorn(false); C.snapSoles();
      const lie = [V3().copy(st.seat).addScaledVector(st.E, 0.95).addScaledVector(st.N, 0.5), V3().copy(st.seat).addScaledVector(st.E, 0.25).addScaledVector(st.N, 0.75)];
      kit.loose.forEach((sh, i) => { kit.throwShoe(i, (o) => o.copy(lie[i]).setY(0.05), 0.02, null); sh.rest.set(2.0, i ? 0.9 : -0.7, 0); });
      anklet.visible = true; PK.mode = 'tease'; h.snap = true; S.expr('worried', 0.3);
      pshot.side({ x: 0.0, dist: 3.5 }); await S.wait(0.3); await S.fade(0, 0.4); await S.wait(0.8); await S.mark('ptease');
      await say('a2', 4, "L-let go of my ankle,\nyou overgrown SQUASH!!", { expr: 'angry', blush: 0.3 });
      await pkSay('Hee hee hee! Such pretty shoes.\nYou will not be needing those.');
      if (C.lookSay) { const R = C.lookSay('pumpkin'); await pkSay(R.feet); await pkSay(R.outfit); if (R.species) await pkSay(R.species); }      // (batch 22: what he makes of her)
      // ----- lickle1: her legs held out, his head at her soles
      await S.fade(1, 0.3);
      anklet.visible = false; S.clip('PumpkinHeld', 0); C.snapSoles(); PK.mode = 'lick'; PK.woundTo = 0.5; PK.wound = 0.5; h.snap = true; h.foot = 0; h.tongue.ph = 0;
      S.expr('laughHard', 0.8); pshot.side(); await S.wait(0.3); await S.fade(0, 0.4);
      await pkSay(`Hee hee! ${NailW()} toenails!\nLike ten little painted seeds!`);
      await S.wait(1.5); await S.mark('plick1'); toastA('AHAHAHA!! N-NOT MY SOLES!!', 2.4); await S.wait(1.6);
      pshot.feet(); await S.wait(1.3); await S.mark('pfeet1'); await S.wait(1.5); pshot.side(); await S.wait(0.9);
      S.toast('Attempt to escape!', 'warning', 1.5);
      let free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: 'he has her feet  ·  try 1 / 2', width: 0.22, speed: 0.85 });
      if (!free) {
        // ----- lickle2: tipped back, her legs wound and held up high
        await S.fade(1, 0.3);
        S.clip('PumpkinHigh', 0); C.snapSoles(); PK.woundTo = 1; PK.wound = 1; h.snap = true; S.expr('laughHard', 0.95);
        pshot.side({ x: 0.3, y: 0.86, fov: 40, dist: 3.9 }); await S.wait(0.3); await S.fade(0, 0.4);
        await S.wait(1.5); await S.mark('plick2'); toastA('HAHAHAHA!! P-PUT ME DOWN!!', 2.4); await S.wait(1.6);
        pshot.feet(); await S.wait(1.3); await S.mark('pfeet2'); await S.wait(1.5); pshot.side({ x: 0.3, y: 0.86, fov: 40, dist: 3.9 }); await S.wait(0.9);
        S.toast('Attempt to escape!', 'warning', 1.5);
        free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: 'wound to the knees  ·  try 2 / 2', width: 0.18, speed: 0.95 });
      }
      if (!free && way === 'both') {                   // (10-03) still his: his vines pull her down onto her front and tie her (pumpkinTied ends the scene)
        toastA("I C-CAN'T... HAHAHA... BREATHE!!", 2.0); await S.wait(1.4);
        await S.fade(1, 0.4); mound.visible = false; anklet.visible = false; PK.woundTo = 0; PK.wound = 0; anne.position.y = 0;
        await pumpkinTied(st, true); return;
      }
      const stand = () => { resetPk(); S.place(V3().copy(st.seat).addScaledVector(st.N, 0.4), Math.atan2(st.home.x - st.seat.x, st.home.z - st.seat.z - 0.4)); S.clip('Idle', 0); S.cam.face(anne, { y: 1.35, dist: 2.7, turn: 0.5, cut: true }); };
      if (free) {
        PK.woundTo = 0; PK.mode = 'reel'; h.glowTo = 0.15; S.expr('angry', 0.4);
        sparks.burst(feetMid(V3()), new THREE.Color(1.7, 1.2, 0.3), 26, 2.2, 0.9); toastA('OWW!! My rind!!', 1.6); await S.wait(0.9); await S.mark('pfree');
        await S.fade(1, 0.35); stand(); await kit.putShoesOn(); await S.fade(0, 0.5);
        if (!met) { S.flag('mrPumpkin', true); S.toast('Mr. Pumpkin unlocked!', 'success', 2.8); }
        await say('a2', 4, 'Seeds. I only wanted the SEEDS!!', { expr: 'angry', blush: 0.4 });
        await say('am', 4, 'And he only wanted your soles.\nFair trade, kitty?');
      } else {
        toastA("I C-CAN'T... HAHAHA... BREATHE!!", 2.2); await S.wait(2.2); await S.mark('pend');
        await S.fade(1, 0.6); stand(); await kit.putShoesOn(); await S.wait(0.4); await S.fade(0, 0.8);
        await say('am', 2, 'He dozed off in the middle of a lick.\nLucky kitty.');
        await say('a2', 34, '...Not. One. Word.', { expr: 'pout', blush: 0.5 });
      }
    } finally { anne.position.y = 0; if (PK.on) resetPk(); }
  }

  if (typeof window !== 'undefined') window.__traps = { thief, HT, feet, PK, stages };      // (tests)
  return { hole: { at: H, kinds: Object.keys(KINDS) }, thief, pumpkins: stages.map((st) => st.home), kit };
}
