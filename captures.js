// captures.js: what happens in the North Forest when Anne misses the space bar. The 2D game's capture scenes, kept as
// comedy: she stays dressed, only her shoes (and once her hat) come off, and what tickles her are plants.
//
//   Ivy Maidens (three rounds, as in the 2D game's CAPTURE1..3; each ends in one "kick free" gauge)
//     1  "Shoes off, pretty butterfly"   vines coil round her ankles and lift her feet; her shoes are pulled off on
//                                         camera (or were knocked off, with her hat, by the lash that caught her);
//                                         fuzzy vine tips stroke her soles
//     2  "Meet the sisters"              on her back, feet held high; more maidens sprout, each with its own tickler
//                                         (catkins, a fern frond between her toes, a dandelion clock that makes her sneeze)
//     3  "A lesson"                      her kick lands on a maiden's nose; turned on her front, shins up, they dust
//                                         her soles with tufts of their own leaf hair; a miss here ends it
//   Myconids (three rounds too)
//     1  "Leave my shoes alone"          the children run off with her shoes and rub their caps on her toes
//     2  giggle spores                   she is doubled up laughing on her knees while they bounce on her soles
//     3  the fairy ring                  on her front; the lady herself dusts her soles with two puffballs
//
// Nothing here goes into her skin: every tickler rides on the sole's own frame (story_common.js readFeet), a set
// distance out from it, arriving along the sole and never through it; the coils round her ankles are children of her
// shin bones. All of it is drawn in S.late, after her clip is applied, so it follows this frame's pose.

const V = new URL(import.meta.url).search;
const { createTies } = await import('./ties.js' + V);

export function createCaptures(S, C, env) {
  const { THREE, scene, anne, A, V3 } = S, { K, sparks, feet, readFeet, along, orient } = C;
  const has = (n) => A.hasClip && A.hasClip(n), PI = Math.PI, TAU = PI * 2;
  const post = env.post && env.post.setCloseUp ? env.post : { setCloseUp() {} };
  const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;
  const col = K.col, mix = K.mix, IV = K.IVY, MY = K.MYC;
  const GOLD = new THREE.Color(1.7, 1.3, 0.4), GREEN = new THREE.Color(0.5, 1.6, 0.5), WHITE = new THREE.Color(1.5, 1.5, 1.3), SPORE = new THREE.Color(1.2, 1.3, 0.3);
  const CLEAR = 0.016;                               // how far a tickler's centre line rides off the sole

  // =====================================================================================================
  //                                                the props
  // =====================================================================================================
  // a vine drawn afresh every frame: a tapering tube along a cubic curve, its rings squared to `ref` (so it never twists)
  function makeVine(c0, c1, rings = 20, sides = 7) {
    const n = rings * sides, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), idx = [];
    for (let i = 0; i < rings - 1; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides; idx.push(a, a + sides, b, b, a + sides, b + sides); }
    for (let i = 0; i < rings; i++) { const c = mix(c0, c1, i / (rings - 1)); for (let k = 0; k < sides; k++) { const o = (i * sides + k) * 3; colr[o] = c.r; colr[o + 1] = c.g; colr[o + 2] = c.b; } }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, K.MAT.plant); mesh.frustumCulled = false; mesh.castShadow = true; mesh.visible = false; scene.add(mesh);
    const p = V3(), tan = V3(), nx = V3(), ny = V3();
    return {
      mesh,
      draw(p0, p1, p2, p3, ref, r0, r1) {
        for (let i = 0; i < rings; i++) {
          const s = i / (rings - 1), m = 1 - s, a = m * m * m, b = 3 * m * m * s, c = 3 * m * s * s, d = s * s * s;
          p.set(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y, a * p0.z + b * p1.z + c * p2.z + d * p3.z);
          const ta = 3 * m * m, tb = 6 * m * s, tc = 3 * s * s;
          tan.set(ta * (p1.x - p0.x) + tb * (p2.x - p1.x) + tc * (p3.x - p2.x), ta * (p1.y - p0.y) + tb * (p2.y - p1.y) + tc * (p3.y - p2.y), ta * (p1.z - p0.z) + tb * (p2.z - p1.z) + tc * (p3.z - p2.z));
          if (tan.lengthSq() < 1e-10) tan.subVectors(p3, p0); tan.normalize();
          nx.copy(ref).addScaledVector(tan, -ref.dot(tan)); if (nx.lengthSq() < 1e-6) nx.set(1, 0, 0).addScaledVector(tan, -tan.x); nx.normalize(); ny.crossVectors(tan, nx);
          const r = r0 + (r1 - r0) * s * (2 - s);
          for (let k = 0; k < sides; k++) { const an = k / sides * TAU, cs = Math.cos(an) * r, sn = Math.sin(an) * r, o = (i * sides + k) * 3; pos[o] = p.x + nx.x * cs + ny.x * sn; pos[o + 1] = p.y + nx.y * cs + ny.y * sn; pos[o + 2] = p.z + nx.z * cs + ny.z * sn; }
        }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); mesh.visible = true;
      },
      hide() { mesh.visible = false; },
    };
  }

  // The ticklers' tips. Each lies along its own +Y (the way it travels) with +Z turned away from the sole, and has no
  // vertex below z = -(CLEAR - 0.003): placed CLEAR off the sole it brushes the skin and cannot enter it.
  const FLOOR = -(CLEAR - 0.004);
  function catkin(c0, c1, seed) {                    // a fuzzy vine tip: a soft bud covered in fine hairs
    const r = K.rng(seed), parts = [K.ball(0.0105, mix(c0, c1, 0.3), 1, 2.7, 1, 10)];
    for (let i = 0; i < 90; i++) {
      const a = r() * TAU, y = r.r(-0.027, 0.027), k = Math.sqrt(Math.max(0, 1 - (y / 0.0285) ** 2)), nx = Math.cos(a), nz = Math.sin(a);
      const at = V3(nx * 0.0105 * k, y, nz * 0.0105 * k), d = V3(nx, r.r(-0.35, 0.35), nz).normalize(), len = r.r(0.008, 0.017);
      if (at.z + d.z * len < FLOOR) continue;
      parts.push(K.place(K.cone(0.0021, len, mix(c0, c1, r()), 3), at, d));
    }
    const m = new THREE.Mesh(K.merge(parts), K.MAT.plant); m.castShadow = true; m.visible = false; scene.add(m); return m;
  }
  function frond() {                                 // a young fern frond: a rib with leaflets, flat on the sole
    const parts = [K.leaf(0.105, 0.016, -0.22, 0.1, K.G.leaf, 0.6, 6)];
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
      const y = 0.012 + i * 0.015, L = 0.034 * (1 - i * 0.11);
      parts.push(K.place(K.leaf(L, L * 0.42, -0.2, 0.1, i % 2 ? K.G.leaf2 : K.G.leaf, 0.6, 4), V3(0, y, 0.0005 + 0.0105 * y), V3(sx * 0.8, 0.55, 0.1)));
    }
    const m = new THREE.Mesh(K.merge(parts), K.MAT.plant); m.castShadow = true; m.visible = false; scene.add(m); return m;
  }
  function puff(c, seed, R = 0.03) {                 // a dandelion clock (or a puffball): a ball of fine rays
    const r = K.rng(seed), parts = [K.place(K.ball(0.006, mix(c, col(0.2, 0.3, 0.1), 0.5), 1, 1, 1, 8), V3(0, 0, 0.016))];
    for (let i = 0; i < 70; i++) {
      const d = V3(r.r(-1, 1), r.r(-1, 1), r.r(-0.45, 1)).normalize(), len = R * r.r(0.75, 1.0);
      if (0.016 + d.z * len < FLOOR) continue;
      parts.push(K.place(K.cone(0.0016, len, c, 3), V3(0, 0, 0.016), d));
    }
    const m = new THREE.Mesh(K.merge(parts), K.MAT.plant); m.visible = false; scene.add(m); return m;
  }
  function duster(c0, c1, seed) {                    // a tuft of leaf hair (or of soft locks) fanned out like a feather duster
    const r = K.rng(seed), parts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.16 + r.r(-0.05, 0.05), L = r.r(0.085, 0.12);
      parts.push(K.place(K.leaf(L, 0.026, -0.28, 0.12, mix(c0, c1, r()), 0.7, 5), V3(0, 0, 0.001 + 0.0012 * Math.abs(i - 4)), V3(Math.sin(a), Math.cos(a), 0.04 + 0.03 * r())));
    }
    const m = new THREE.Mesh(K.merge(parts), K.MAT.plant); m.castShadow = true; m.visible = false; scene.add(m); return m;
  }
  const FUZZ0 = col(0.36, 0.38, 0.2), FUZZ1 = col(0.72, 0.7, 0.46);
  const TOOLS = {
    catkin: [0, 1, 2, 3, 4, 5].map((i) => catkin(FUZZ0, FUZZ1, 31 + i * 7)), frond: [frond(), frond()], puff: [puff(col(0.8, 0.8, 0.72), 5)],      // (10-03: six catkins, two fronds: the hole trap's shoe ticklers have their own)
    duster: [duster(IV.hair1, IV.hair2, 3), duster(IV.hair1, IV.hair2, 9)],
    spore: [puff(col(0.86, 0.72, 0.5), 11, 0.036), puff(col(0.86, 0.72, 0.5), 17, 0.036)],
  };

  // a tickler: a vine from a root (a maiden's reach) to a tip that rides on one of her soles
  //   mode   stroke (heel to ball and back) | toes (to and fro under the toes) | heel | arch (small circles)
  //   from   where the vine comes along the sole from: side (the foot's outer side) | heel | toes
  const ticklers = [0, 1, 2, 3, 4, 5].map(() => ({ vine: makeVine(IV.v0, IV.v2), tool: null, on: false, k: 0, foot: 0, mode: 'stroke', from: 'side', root: null, ph: 0, tau: 0, rate: 1, clear: CLEAR, pos: V3() }));
  const Q = V3(), D = V3(), R0 = V3(), P1 = V3(), P2 = V3(), TR = V3();
  function updTicklers(dt) {
    for (const T of ticklers) {
      T.k = damp(T.k, T.on ? 1 : 0, T.on ? 4 : 7, dt);
      if (!T.tool || (!T.on && T.k < 0.02)) { T.vine.hide(); if (T.tool) T.tool.visible = false; continue; }
      T.tau += dt * T.rate;
      const f = typeof T.foot === 'function' ? T.foot() : feet[T.foot]; let u, v;      // (10-03: or any sole-like frame, e.g. a shoe's footbed: kit.shoeFrame)
      if (T.mode === 'stroke') { u = 0.08 + 0.84 * (0.5 - 0.5 * Math.cos(TAU * 0.8 * T.tau + T.ph)); v = 0.012 * Math.sin(1.3 * T.tau + T.ph); }
      else if (T.mode === 'toes') { u = 1.2 + 0.07 * Math.sin(TAU * 0.5 * T.tau + T.ph); v = 0.026 * Math.sin(TAU * 1.3 * T.tau + T.ph); }
      else if (T.mode === 'heel') { u = 0.1 + 0.06 * Math.cos(TAU * 1.1 * T.tau + T.ph); v = 0.012 * Math.sin(TAU * 1.1 * T.tau + T.ph); }
      else { u = 0.5 + 0.14 * Math.cos(TAU * 0.9 * T.tau + T.ph); v = 0.016 * Math.sin(TAU * 1.4 * T.tau + T.ph); }
      along(f, u, Q).addScaledVector(f.side, v).addScaledVector(f.n, T.clear);
      if (T.from === 'heel') D.copy(f.fwd).negate(); else if (T.from === 'toes') D.copy(f.fwd);
      else { D.copy(f.lat).addScaledVector(f.n, -f.lat.dot(f.n)); if (D.lengthSq() < 1e-6) D.copy(f.side); D.normalize(); }
      Q.addScaledVector(f.n, (1 - T.k) * 0.22).addScaledVector(D, (1 - T.k) * 0.12);      // it hovers in before it touches
      T.root(R0);
      P2.copy(Q).addScaledVector(f.n, 0.012).addScaledVector(D, 0.07);                    // the last stretch runs along the sole
      P1.lerpVectors(R0, Q, 0.5).addScaledVector(f.n, 0.10); P1.y += 0.10;
      T.vine.draw(R0, P1, P2, Q, f.n, 0.013, 0.0052);
      orient(T.tool, Q, TR.subVectors(Q, P2).normalize(), f.n); T.tool.visible = true; T.pos.copy(Q);
    }
  }
  let toolN = {};
  function tick(i, foot, mode, from, root, kind, o = {}) {
    const T = ticklers[i], list = TOOLS[kind]; toolN[kind] = (toolN[kind] || 0);
    if (T.tool) T.tool.visible = false;
    T.tool = list[toolN[kind]++ % list.length]; T.foot = foot; T.mode = mode; T.from = from; T.root = root; T.on = true; T.k = 0;
    T.ph = o.ph !== undefined ? o.ph : i * 1.7; T.rate = o.rate || 1; T.clear = o.clear || CLEAR; T.tau = 0;
    return T;
  }
  const untick = (i) => { ticklers[i].on = false; };
  function clearTicklers(now) { for (const T of ticklers) { T.on = false; if (now) { T.k = 0; T.vine.hide(); if (T.tool) T.tool.visible = false; T.tool = null; } } toolN = {}; }

  // the coils round her ankles: children of her shin bones (bone space: +Y runs down the shin, the ankle joint at y = 0.2383)
  function makeWraps(c0, c1) {
    return feet.map((f) => {
      const sg = f.s === 'L' ? 1 : -1, pts = [];
      for (let k = 0; k <= 60; k++) { const t = k / 60, a = t * 2.6 * TAU; pts.push(V3(sg * 0.0035 + 0.0235 * Math.cos(a), 0.2383 - 0.085 + 0.045 * t, 0.002 + 0.0352 * Math.sin(a))); }      // (10-02: wound tight, 0.6-2.7 mm of air; her ankles were then made a little thicker: tools/anne2/measure.py)
      const m = new THREE.Mesh(K.tube(pts, (t) => 0.0058 * Math.min(1, 0.35 + 9 * t) * Math.min(1, 0.35 + 9 * (1 - t)), (t) => mix(c0, c1, 0.4 + 0.6 * t), 6, 96), K.MAT.plant);
      m.castShadow = true; m.visible = false; if (f.shin) f.shin.add(m);
      return { m, f, end: pts[0].clone(), w: V3() };
    });
  }
  const wraps = makeWraps(IV.v0, IV.v2), hyphae = makeWraps(col(0.5, 0.5, 0.42), col(0.7, 0.7, 0.6));
  const leashes = [makeVine(IV.v0, IV.v1, 16, 6), makeVine(IV.v0, IV.v1, 16, 6)];
  let holdBy = null, held = null;                    // who holds the leashes (a function giving the point), and which coils are on
  const L1 = V3(), L2 = V3(), UP = V3(0, 1, 0);
  function updLeashes(t) {
    held && held.forEach((w, i) => {
      if (!w.m.visible || !holdBy || !w.f.shin) { leashes[i].hide(); return; }
      w.f.shin.localToWorld(w.w.copy(w.end)); holdBy(R0, i);
      L1.lerpVectors(R0, w.w, 0.35); L1.y -= 0.16 + 0.03 * Math.sin(t * 2.3 + i); L2.lerpVectors(R0, w.w, 0.8); L2.y += 0.05;
      leashes[i].draw(R0, L1, L2, w.w, UP, 0.02, 0.0062);
    });
    if (!held) for (const l of leashes) l.hide();
  }
  function coils(set, on, by = null) { for (const w of wraps) w.m.visible = false; for (const w of hyphae) w.m.visible = false; held = on ? set : null; holdBy = by; if (on) for (const w of set) w.m.visible = true; }

  // Her shoes, loose: they fly off her feet and LIE on the ground (10-03: never floating or half sunk, no wobble):
  // upright or on their side. One that is licked stands on its sole, side-on to whatever licks INSIDE it (a sister, a
  // Myconid child: the footbed, where her foot was). ('sole', upside down, is not used: they stood on their straps like a
  // little table.) s.lie: 'up' | 'side' | 'sole' (by default the right one upright, the left on its side); s.rest.y:
  // which way it points; s.lick: whoever licks it; s.putK (0..1): on its way back onto her foot (putShoesOn).
  const loose = [false, true].map((left) => {
    const g = new THREE.Group(); g.visible = false;
    if (A.heelProp) { const s = A.heelProp.clone(true); s.scale.set(left ? -1 : 1, 1, 1); s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); g.add(s); }
    scene.add(g);
    return { g, t: -1, dur: 0.5, from: V3(), to: V3(), carry: null, vine: makeVine(IV.v0, IV.v1, 12, 6), spin: 0, rest: new THREE.Euler(2.0, left ? 0.6 : -0.6, 0), lie: null, lick: null, putK: 0, ground: V3(), beds: {}, bedK: 0 };
  });
  if (!A._bareHook) {                                 // (when her shoes last came off: A.lastBare; a capture clears it as it starts)
    A._bareHook = true; A.lastBare = -1; const shw = A.setHeelsWorn, ss = A.setShoe;
    A.setHeelsWorn = (on) => { if (!on) A.lastBare = 1; return shw(on); };
    if (ss) A.setShoe = (sd, on) => { if (!on) A.lastBare = 1; return ss(sd, on); };
  }
  const bareNow = () => !!(A.shoes && (() => { const w = A.shoes(); return !(w.L && w.R); })());      // (10-03: a shoe of hers is off right now)
  const SH = V3(), _sbx = new THREE.Box3(), SHOEBOX = {}, _rq = new THREE.Quaternion(), _fq = new THREE.Quaternion(), _re = new THREE.Euler(), _sm = new THREE.Matrix4();
  function shoeBox() {                               // the size of the pair she has on (each style its own), measured once
    const id = (A.shoeStyle && A.shoeStyle()) || 'sandal';
    if (SHOEBOX[id]) return SHOEBOX[id];
    let b = { hw: 0.042, h: 0.065, z0: -0.11, z1: 0.11, cx: 0, fb: null };
    if (A.heelProp) {
      A.heelProp.updateMatrixWorld(true); _sbx.setFromObject(A.heelProp, true);
      b = { hw: Math.max(-_sbx.min.x, _sbx.max.x), h: _sbx.max.y, z0: _sbx.min.z, z1: _sbx.max.z, cx: (_sbx.min.x + _sbx.max.x) / 2, fb: new Array(24).fill(Infinity) };
      // (10-03) the FOOTBED's height along the shoe (24 steps, back to toe), near its centre line: where a licker's tongue
      // lies (inside the shoe, where her foot was). It is the lowest surface facing up: straps are above it, the outsole faces down.
      const v = V3(), nv = V3(), nm = new THREE.Matrix3(), N = 24, half = (_sbx.max.x - _sbx.min.x) / 2;
      A.heelProp.traverse((o) => {
        if (!o.isMesh || !o.geometry.attributes.normal) return; const P = o.geometry.attributes.position, Nn = o.geometry.attributes.normal; nm.getNormalMatrix(o.matrixWorld);
        for (let k = 0; k < P.count; k++) {
          v.fromBufferAttribute(P, k).applyMatrix4(o.matrixWorld); if (Math.abs(v.x - b.cx) > 0.35 * half) continue;
          if (nv.fromBufferAttribute(Nn, k).applyMatrix3(nm).normalize().y < 0.8) continue;
          const j = clamp(Math.floor((v.z - b.z0) / (b.z1 - b.z0) * N), 0, N - 1); if (v.y < b.fb[j]) b.fb[j] = v.y;
        }
      });
      for (let j = 0; j < N; j++) if (!isFinite(b.fb[j])) b.fb[j] = j ? b.fb[j - 1] : 0.015;
    }
    return (SHOEBOX[id] = b);
  }
  function restOf(s, i, q) {                         // how it lies: its orientation (q) and the height its origin rests at
    const b = shoeBox(), lie = s.lie || (i ? 'side' : 'up');
    const k = s.g.scale.y || 1;                         // (its own size: her body's length)
    if (lie === 'sole') { _re.set(PI, s.rest.y, 0); q.setFromEuler(_re); return b.h * k + 0.004; }
    if (lie === 'up') { _re.set(0, s.rest.y, 0); q.setFromEuler(_re); return 0.002; }
    _re.set(0, s.rest.y, (i ? -1 : 1) * PI / 2); q.setFromEuler(_re); return b.hw * k + 0.003;      // (rolled onto its outer side)
  }
  function throwShoe(i, to, dur = 0.5, carry = null) {
    { const B = A.body ? A.body() : null; if (B) for (const sh of loose) sh.g.scale.setScalar(B.h); }      // (batch 23: a loose shoe is the size of the foot it came off)          // from her foot to a point (function giving it), and there it lies
    const s = loose[i], f = feet[i]; s.from.copy(f.arch).addScaledVector(f.fwd, -0.04); s.to = to; s.t = 0; s.dur = dur; s.carry = null; s.g.visible = true; s.spin = (i ? 1 : -1) * 9;
  }
  // (10-03, as he asked: they lick the INSIDE of her shoe, where her foot was) The footbed of a shoe standing on its
  // sole, as a foot's frame for lick(): the line along it as measured (shoeBox().fb), its normal up out of it. The
  // stretch licked keeps clear of a toe post (flats), and of a closed toe (the pumps: the open heel half).
  const shoeSoles = [0, 1].map(() => ({ heel: V3(), arch: V3(), ball: V3(), n: V3(0, 1, 0), fwd: V3(), side: V3(), lat: V3() }));
  const _sx = V3(), _sy = V3();
  function shoeSole(s, i) {
    const b = shoeBox(), F = shoeSoles[i], sh = s.g.children[0], N = b.fb ? b.fb.length : 0;
    if (!b.U) { const id = A.shoeStyle && A.shoeStyle(), st = A.shoeStyles ? A.shoeStyles().find((x) => x.id === id) : null; b.U = st && st.closed ? [0.25, 0.43, 0.6] : st && st.heel ? [0.2, 0.5, 0.8] : [0.14, 0.42, 0.7]; }      // (once per style: no allocation per frame)
    const U = b.U;
    const at = (u, out) => { const j = clamp(u * N - 0.5, 0, N - 1), j0 = Math.floor(j), j1 = Math.min(N - 1, j0 + 1); return out.set(b.cx, b.fb[j0] + (b.fb[j1] - b.fb[j0]) * (j - j0) + 0.001, b.z0 + u * (b.z1 - b.z0)); };
    const o = sh && N ? sh : s.g;
    s.g.updateMatrixWorld(true);
    if (o === sh) { o.localToWorld(at(U[0], F.heel)); o.localToWorld(at(U[1], F.arch)); o.localToWorld(at(U[2], F.ball)); }
    else for (const [k, u] of [['heel', U[0]], ['arch', U[1]], ['ball', U[2]]]) o.localToWorld(F[k].set(0, 0.015, b.z0 + u * (b.z1 - b.z0)));
    F.fwd.subVectors(F.ball, F.heel).normalize();
    _sx.set(1, 0, 0).transformDirection(o.matrixWorld); F.n.set(0, 1, 0).transformDirection(o.matrixWorld);
    _sy.copy(F.n); F.n.crossVectors(F.fwd, _sx).normalize(); if (F.n.dot(_sy) < 0) F.n.negate();      // (square to the footbed's slope: a high heel's climbs)
    F.side.crossVectors(F.n, F.fwd).normalize(); F.lat.copy(F.side);
    return F;
  }
  const _sl1 = V3(), _sl2 = V3();
  function shoeLick(s, i, dt, t) {                   // whoever licks this shoe: its mouth over the rim on its side, the tongue down on the footbed
    const Lk = s.lick, F = shoeSole(s, i);
    noteShoe('lick', Lk.who);                        // (10-03: she will feel it when she puts them back on)
    Lk.mouth(_sl1); const sd = _sl2.subVectors(_sl1, F.arch).dot(F.side) < 0 ? -1 : 1;
    soleSpot(F, 0.5 + 0.18 * Math.sin(t * 0.7 + i), sd * 0.062, 0.03, _sl2);
    Lk.toward(_sl1, _sl2, dt, F.arch);
    lick(Lk.tongue, Lk.mouth(_sl1), F, dt, 1, 1.35 + 0.2 * i, 0.012, 0.0042);
  }
  // a Myconid child at a shoe (10-03: an Ivy Maiden was tried too, but her head is bigger than the shoe: bowed to it in
  // the grass, her leaf hair buried it; in the Ivy rounds her shoes just lie there)
  function kidLicker(g) {
    const T = g.userData.shoeTongue || (g.userData.shoeTongue = makeTongue('#c06a4a')), sc = () => (g.scale.x || 0.9) / 0.9;
    g.rotation.order = 'YXZ';                        // (it turns to the shoe, then bows over it)
    return { tongue: T, kid: g, who: 'kids',
      mouth: (out) => out.set(0, 0.25 * sc(), 0.1 * sc()).applyQuaternion(g.quaternion).add(g.position),
      toward: (mouth, P, dt, look) => { const k = Math.min(1, dt * 10); if (look) g.rotation.y = Math.atan2(look.x - g.position.x, look.z - g.position.z); g.rotation.x = 0.45; g.position.x += (P.x - mouth.x) * k; g.position.z += (P.z - mouth.z) * k; g.position.y = Math.max(0, g.position.y + (P.y - mouth.y) * k); g.userData.held = true; } };
  }
  function updShoes(dt, t) {
    const bh = A.body ? A.body().h : 1;                  // (batch 23: a loose shoe is the size of the foot it came off, however it got there)
    loose.forEach((s, i) => {
      if (s.g.scale.x !== bh) s.g.scale.setScalar(bh);
      s.vine.hide();
      if (!s.g.visible) { if (s.lick) s.lick.tongue.hide(); return; }
      if (s.lick && s.lickYaw === undefined) {      // (standing on its sole, turned once side-on to whoever licks inside it)
        s.lick.mouth(_sl1); s.to(SH, i); _sl1.sub(SH);
        s.lickYaw = _sl1.x * _sl1.x + _sl1.z * _sl1.z > 1e-6 ? Math.atan2(_sl1.x, _sl1.z) + (i ? -PI / 2 : PI / 2) : s.rest.y; s.rest.y = s.lickYaw;
      }
      s.to(SH, i); SH.y = (s.baseY || 0) + restOf(s, i, _rq); s.ground.copy(SH);      // (baseY: the floor it lies on, e.g. the hole trap's hollow)
      if (s.putK > 0) {                              // on its way back onto her foot
        const f = feet[i], b = shoeBox(), k = s.putK;
        _sl1.copy(f.n).negate(); _sl2.crossVectors(_sl1, f.fwd).normalize();
        _sm.makeBasis(_sl2, _sl1, f.fwd); _fq.setFromRotationMatrix(_sm);
        along(f, 0.5, _sl2).addScaledVector(f.n, 0.012).addScaledVector(f.fwd, -(b.z0 + b.z1) / 2);
        s.g.position.lerpVectors(SH, _sl2, k); s.g.position.y += 0.12 * Math.sin(PI * k);
        s.g.quaternion.slerpQuaternions(_rq, _fq, k);
      } else if (s.t >= 0 && s.t < s.dur) {          // in the air: it tumbles, and settles the way it will lie
        s.t += dt; const k = Math.min(1, s.t / s.dur);
        s.g.position.lerpVectors(s.from, SH, k); s.g.position.y += 0.45 * Math.sin(PI * k);
        _re.set(s.spin * k, s.spin * 0.4 * k, 0); _fq.setFromEuler(_re); s.g.quaternion.slerpQuaternions(_fq, _rq, sst(k, 0.6, 1));
      } else { s.g.position.copy(SH); s.g.quaternion.copy(_rq); }
      if (s.lick && !(s.putK > 0)) shoeLick(s, i, dt, t); else if (s.lick) s.lick.tongue.hide();
      shoeBed(s, i, dt);
    });
  }
  // (10-03, as he asked) what is done inside a shoe shows on its footbed: saliva or green tickle specks, more as it goes on
  // (A.propMarks, a set per style: the loose shoes take the shape of whichever pair she has on)
  function shoeBed(s, i, dt) {
    const wk = A.shoeWork, kind = wk && (wk.lick || wk.tick) ? (wk.lick && wk.tick ? 'both' : wk.lick ? 'wet' : 'specks') : null, id = (A.shoeStyle && A.shoeStyle()) || '-';
    if (kind && s.g.visible && !(s.t >= 0 && s.t < s.dur)) s.bedK = Math.min(1, s.bedK + dt * 0.35);
    if (kind && !s.beds[id] && A.propMarks && A.heelProp) {
      const b = shoeBox(); if (!b.fb) return;
      s.beds[id] = A.propMarks({ y: b.fb, z0: b.z0, z1: b.z1, cx: b.cx, hw: b.hw }, { seed: 977 + i * 31 }); (s.g.children[0] || s.g).add(s.beds[id].group);
    }
    for (const k in s.beds) s.beds[k].show(k === id ? kind : null, k === id ? s.bedK : 0);
  }
  const shoesQuiet = () => { for (const s of loose) { if (s.lick) { s.lick.tongue.hide(); if (s.lick.kid) { s.lick.kid.rotation.x = 0; s.lick.kid.userData.held = false; } } s.lick = null; s.lie = null; s.putK = 0; s.lickYaw = undefined; s.baseY = 0; } };

  // (10-03) After a capture: she sits down by her shoes and slips them back on (SitPutOn: the right foot over 0.08-0.28
  // of the clip, the left over 0.5-0.7), close on her feet; then she is up. o: { at, yaw, fadeIn }
  const putFlat = { p: V3(), r: 1.3, k: 0.88 };      // (under 0.9: the grass lies down, the flowers' stiff heads are not crushed into flat white sheets)
  async function putShoesOn(o = {}) {
    if (!o.force && !(A.lastBare > 0)) return;        // (her shoes stayed on: nothing to put back)
    A.lastBare = -1;
    if (!has('SitPutOn') || !A.heelProp) { A.setHeelsWorn(true); return; }
    const at = (o.at || anne.position).clone().setY(0), yaw = o.yaw !== undefined ? o.yaw : anne.rotation.y, was = ext; ext = true;
    shoesQuiet(); A.setHeelsWorn(false);
    const grass0 = S.grassFlat; putFlat.p.copy(at).addScaledVector(V3(Math.sin(yaw), 0, Math.cos(yaw)), 0.4); S.grassFlat = () => putFlat;      // (the grass lies down round her feet)
    S.place(at, yaw); S.clip('SitPutOn', 0); C.snapSoles();
    for (let k = 0; k < 3; k++) await S.frame();
    const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), left = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const spots = [0, 1].map((i) => V3().copy(feet[i].ball).addScaledVector(left, i ? 0.13 : -0.13).addScaledVector(fwd, 0.06).setY(0));
    loose.forEach((s, i) => { s.g.visible = true; s.t = -1; s.lie = 'up'; s.rest.y = yaw + (i ? 0.45 : -0.45); s.to = (out) => out.copy(spots[i]); s.putK = 0; });
    const mid = V3().addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5);
    S.cam.at(mid, yaw + 0.6, { y: mid.y + 0.05, dist: 1.3, pitch: 0.34, fov: 40, cut: true, minY: 0.12, near: 0.3, see: [mid.clone(), C.headPos()] });
    S.expr(o.expr || 'pout', 0.2);
    if (o.fadeIn !== false) await S.fade(0, 0.45);
    await S.mark('shoeson'); console.log('SHOES going on');
    const wk = A.shoeWork, talk = wk && (wk.lick || wk.tick) ? wk : null;      // (10-03: what was done inside them; cleared once they are on)
    const len = (A.clipSec && A.clipSec('SitPutOn')) || 3.1, done = [false, false]; let tt = 0;
    const step = (dt) => {
      tt += dt; const q = tt / len;
      [[0, 0.08], [1, 0.5]].forEach(([i, a0]) => {   // (feet[0] is her right foot: that shoe first)
        const k = sst(q, a0, a0 + 0.2), s = loose[i]; s.putK = Math.max(1e-4, k);
        if (k >= 1 && !done[i]) { done[i] = true; s.g.visible = false; A.setShoe(i ? 'L' : 'R', true); }
      });
    };
    if (talk) {                                       // the right foot in: she feels it (the clip held while she says so)
      await S.until((dt) => { step(dt); return tt >= len * 0.31; });
      if (A.holdClip) A.holdClip(true);
      await shoeLine(talk, 'in');
      if (A.holdClip) A.holdClip(false);
    }
    await S.until((dt) => { step(dt); return tt >= len; });
    S.clip('Idle', 0.5); S.expr('neutral'); await S.wait(0.55);
    for (const s of loose) { s.g.visible = false; s.putK = 0; s.bedK = 0; } A.setHeelsWorn(true); A.lastBare = -1; A.shoeWork = null;
    if (talk) await shoeFlash(talk, yaw);
    ext = was; S.grassFlat = grass0;
    S.cam.face(anne, { y: 1.35, dist: 2.6, turn: 0.5 });      // (back up to her face for whatever is said next)
  }
  // (10-03, as he asked) After something licked or tickled INSIDE her shoes (A.shoeWork: { lick, tick }: who, noted as it
  // happens), putting them back on: a word as the first one goes on (wet inside / it still tickles in there), then up on
  // her feet the sole flash (IdleTiptoe, or the right foot's) shows a little saliva on her soles or green tickle specks
  // (A.soleMarks), with a word on that, and one more once her heel is back down. Every line is picked at random.
  const shoeWork = () => A.shoeWork || (A.shoeWork = { lick: null, tick: null });
  function noteShoe(kind, who) { if (kind === 'lick' || kind === 'tick') shoeWork()[kind] = who || 'them'; }
  const WHO = { kids: 'those mushroom kids', ghosts: 'those ghosts', vines: 'those vines and tentacles', ivy: "the Ivy Maidens' vines", fairies: 'those fairies', them: 'those things' };
  const SHOE_LINES = {      // [portrait (faceset a2), expression, blush, text]
    in: {
      lick: [[19, 'embarrassed', 0.45, "*squish*\n...Eww. EWW!! It's all WET in there!!"],
        [7, 'shocked', 0.3, 'W-why is it warm?! And WET?!\nDid {who} LICK the inside of my shoes?!'],
        [8, 'pout', 0.35, "Ugh... it's like stepping into a puddle of slobber.\nThanks a lot, {who}."],
        [5, 'shocked', 0.4, "Nooo... they're soaking wet inside!!\nMy poor shoes!!"]],
      tick: [[13, 'laugh', 0.5, 'Hehe... hehehe! S-stop that! It still tickles in there!\n{Who} were rubbing the whole inside!'],
        [9, 'laugh', 0.55, 'Pfff-- hehe! My feet can still feel {who}\nrubbing all over the inside of my shoes!'],
        [14, 'happy', 0.5, "Mmmh-hehe! The inside's all fuzzy and tingly now...\nmy toes won't stop wiggling!"]],
    },
    sole: {
      lick: [[8, 'embarrassed', 0.4, 'Look at that... my soles are all shiny with drool.\nGROSS!!'],
        [19, 'angry', 0.35, "Ugh, it's on my SOLES now too!\nEvery step goes *squelch*..."],
        [3, 'worried', 0.3, "It's sticky... it's between my toes...\nI need a bath. And new shoes."]],
      tick: [[13, 'laugh', 0.5, "Hehe... there's green tickle dust all over my soles!\nNo wonder my feet won't stop tingling!"],
        [14, 'embarrassed', 0.5, 'Green specks?! On my SOLES?!\nIs THAT why they still tickle?!'],
        [9, 'laugh', 0.45, 'Little green bits everywhere... hehe...\n{who} rubbed it right into my feet!']],
      both: [[19, 'embarrassed', 0.45, 'Drool AND green tickle dust?!\nMy poor, poor soles!!']],
    },
    clean: {
      lick: [[9, 'smile', 0.35, 'Ahh... MUCH better. No more squish!\n...That brush tickled more than the licking, though.'],
        [13, 'laugh', 0.4, "Clean soles! Hehe...\nDon't you dare tell Amaymon I giggled."],
        [34, 'pout', 0.3, 'There. Clean. ...The SHOES are still soggy, though.']],
      tick: [[9, 'smile', 0.35, 'Phew... no more green stuff!\n...My feet are still giggling, though.'],
        [13, 'laugh', 0.4, 'All clean! Hehe...\nthat brush was worse than the vines!'],
        [14, 'happy', 0.4, 'Squeaky clean! ...Okay, that was kind of fun.']],
    },
    out: {
      lick: [[34, 'pout', 0.3, 'Note to self: wash these in the pond.\nTwice. No... three times.'],
        [8, 'pout', 0.3, "...I'm walking funny now, aren't I.\n*squish* *squish* *squish*"],
        [4, 'angry', 0.3, 'If I catch {who} near my shoes again...!!']],
      tick: [[9, 'smile', 0.35, "Hehe... okay. Okay! I'm fine.\nMy feet just haven't gotten the message yet."],
        [34, 'pout', 0.35, 'Hmph. Walking it off.\n...Hehe. Still tickles.'],
        [13, 'laugh', 0.4, 'Every step tickles a little...\nThis is going to be a long walk!']],
    },
  };
  async function shoeLine(w, when) {
    const kind = w.lick && w.tick && when === 'sole' ? 'both' : w.lick ? 'lick' : 'tick', pool = SHOE_LINES[when][kind];
    const L = pool[(Math.random() * pool.length) | 0], who = WHO[(kind === 'tick' ? w.tick : w.lick)] || WHO.them;
    const text = L[3].replace(/\{who\}/g, who).replace(/\{Who\}/g, who.charAt(0).toUpperCase() + who.slice(1));
    console.log('SHOE LINE ' + when + ': ' + text.split('\n')[0]);      // (tests)
    S.expr(L[1], L[2]); await S.say('a2', L[0], text, { expr: L[1], blush: L[2] });
  }
  async function shoeFlash(w, yaw) {
    const fs = typeof location !== 'undefined' ? (location.search.match(/[?&]flash=([LR])/) || [])[1] : null;      // (tests: ?flash=L | R)
    const R = fs ? fs === 'R' : Math.random() < 0.5, name = R ? 'IdleTiptoeR' : 'IdleTiptoe', f = feet[R ? 0 : 1];      // (the foot that comes up: its sole to the camera)
    const sg = R ? -1 : 1;
    if (A.soleMarks) A.soleMarks(w.lick && w.tick ? 'both' : w.lick ? 'wet' : 'specks', 45);
    if (!has(name) || !A.clipTime) { await shoeLine(w, 'sole'); await shoeLine(w, 'out'); return; }
    S.clip(name, 0.35); console.log('SHOE FLASH ' + name + ' ' + (w.lick ? 'wet' : '') + (w.tick ? 'specks' : ''));
    S.cam.face(anne, { y: 1.3, dist: 2.2, turn: 0.5 * sg });
    const clipAt = (sec, max = 12) => { let w8 = 0; return S.until((dt) => (w8 += dt) > max || A.clipTime(name) >= sec); };
    await clipAt(2.2);                                // (the heel is up: the right foot's goes up a little later)
    // low, facing the sole (its normal, level; edge-on, nothing showed), turned 30 degrees to the foot's outer side: a sandal's
    // back strap rises from its sole to her ankle right down the middle of the view
    const back = V3(-Math.sin(yaw), 0, -Math.cos(yaw)), out = V3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(sg), tgt = V3().lerpVectors(f.heel, f.arch, 0.4), nh = V3(f.n.x, 0, f.n.z);
    if (nh.lengthSq() < 1e-4) nh.copy(back); nh.normalize();
    out.addScaledVector(nh, -out.dot(nh)).normalize(); nh.multiplyScalar(Math.cos(0.52)).addScaledVector(out, Math.sin(0.52));
    const pos = V3().copy(tgt).addScaledVector(nh, 0.5); pos.y = Math.max(0.07, tgt.y - 0.035);
    S.cam.set(pos, V3().copy(tgt).setY(tgt.y - 0.05), { fov: 38, cut: true, focus: tgt.clone() });      // (looking a little under it: the dialogue box covers the bottom of the picture)
    await clipAt(R ? 3.7 : 3.3);                      // (she has looked back down at it)
    if (A.holdClip) A.holdClip(true);
    await S.mark('shoeflash');
    await shoeLine(w, 'sole');
    // (10-03, as he asked) the option to scrub them clean with the fuzzy brush (footplay.js): the mouse over this sole, then
    // over the other, until both are clean; she giggles all the while. (Story tests: the brush goes by itself.)
    if (S.footPlay && A.scrubMarks && (await S.choice(['Scrub her soles clean with the fuzzy brush', 'Leave them be'])) === 0) {
      console.log('SHOE BRUSH'); let fin = false;
      if (A.soleMarks) A.soleMarks(w.lick && w.tick ? 'both' : w.lick ? 'wet' : 'specks', 45);      // (however long the line and the choice took: they are there to be scrubbed)
      S.footPlay.clean({ first: R ? 'R' : 'L', held: true, auto: /[?&]sa=/.test(location.search) ? 2.2 : 0 }).then(() => { fin = true; });
      await S.until(() => { const g = S.footPlay.camGoal(); if (g) S.cam.set(g.p, g.l, { fov: g.fov, rate: 7, still: true }); return fin; });      // (still: the brush is aimed with the mouse)
      S.clip('Idle', 0.3); S.cam.face(anne, { y: 1.35, dist: 2.4, turn: 0.55 * sg });
      await shoeLine(w, 'clean');
      return;
    }
    if (A.holdClip) A.holdClip(false);
    await clipAt(5.4);
    S.cam.face(anne, { y: 1.35, dist: 2.4, turn: 0.55 * sg });
    await clipAt(7.6);
    S.clip('Idle', 0.4);
    await shoeLine(w, 'out');
  }
  // her hat, loose: knocked off, it ends up on somebody else's head
  const hat = K.makeWitchHat(); scene.add(hat.obj);
  const hatS = { t: -1, from: V3(), on: null };
  function throwHat(on) { C.headPos(hatS.from); hatS.from.y += 0.12; hatS.t = 0; hatS.on = on; hat.obj.visible = true; if (A.setHat) A.setHat(false); }
  function updHat(dt, t) {
    if (!hat.obj.visible || !hatS.on) return;
    hatS.on(SH);
    if (hatS.t >= 0 && hatS.t < 0.7) { hatS.t += dt; const k = Math.min(1, hatS.t / 0.7); hat.obj.position.lerpVectors(hatS.from, SH, k); hat.obj.position.y += 0.7 * Math.sin(PI * k); hat.obj.rotation.set(0.5 * Math.sin(k * 9), k * 11, 0.4 * Math.sin(k * 7)); }
    else { hat.obj.position.copy(SH); hat.obj.rotation.set(0.1 * Math.sin(t * 1.3), 0.6, -0.16 + 0.06 * Math.sin(t * 1.7)); }
  }

  // ---------- her legs (where the bones run, how thick they are), coils wound round them, tongues ----------
  // (shared with traps.js through the kit)
  const sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const _la = V3();
  const bone = (n) => anne.getObjectByName(n);
  const LEGB = { hip: [bone('upperleg01R'), bone('upperleg01L')], knee: [bone('lowerleg01R'), bone('lowerleg01L')], ankle: [bone('footR'), bone('footL')] };
  const LEGS_OK = Object.values(LEGB).every((a) => a.every(Boolean));
  const hipW = [V3(), V3()], kneeW = [V3(), V3()], ankW = [V3(), V3()];
  function readLegs() { if (!LEGS_OK) return; for (let j = 0; j < 2; j++) { LEGB.hip[j].getWorldPosition(hipW[j]); LEGB.knee[j].getWorldPosition(kneeW[j]); LEGB.ankle[j].getWorldPosition(ankW[j]); } }
  // How thick a leg is (the furthest its skin stands from the bone's line), ankle to knee and knee to hip, measured
  // on the model (tools: measure_leg.py): [how far along, metres]
  // (tools/anne2/measure.py, on the export meshes; measured again after her body was made a little fuller)
  const SHIN_R = [[0, 0.031], [0.05, 0.0329], [0.15, 0.0336], [0.3, 0.036], [0.45, 0.059], [0.6, 0.0651], [0.75, 0.0653], [0.9, 0.0603], [1, 0.0626]];
  const THIGH_R = [[0, 0.0626], [0.05, 0.068], [0.15, 0.0762], [0.3, 0.085], [0.45, 0.0938], [0.6, 0.1009]];      // (re-measured 10-02 after her thighs were made fuller: tools/anne2/measure.py)
  const tab = (T, x, k = 1) => { for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[k] + (b[k] - a[k]) * (x - a[0]) / (b[0] - a[0]); } return T[T.length - 1][k]; };
  // How far her skin reaches from the bone's line in each direction: [along, her outer side, inner side, back, front]
  // (tools/anne2/measure.py, SHIN_E / THIGH_E). A coil follows these (10-02: wound to the furthest point all round, the
  // coils stood well off her legs at the sides).
  const SHIN_E = [[0, 0.0191, 0.0127, 0.028, 0.0329], [0.05, 0.0191, 0.0127, 0.028, 0.0329], [0.15, 0.0247, 0.0106, 0.0321, 0.0176], [0.3, 0.0321, 0.0169, 0.0053, 0.0184],      // (10-02: her ankles a little thicker)
    [0.45, 0.0437, 0.0219, 0.0561, 0.0215],
    [0.6, 0.041, 0.0347, 0.0631, 0.0271], [0.75, 0.0524, 0.041, 0.0648, 0.0297], [0.9, 0.0518, 0.0503, 0.0579, 0.0364], [1, 0.0511, 0.0624, 0.0517, 0.0531]];
  const THIGH_E = [[0, 0.0509, 0.0621, 0.0527, 0.0538], [0.05, 0.0504, 0.0645, 0.0493, 0.0611], [0.15, 0.0519, 0.0681, 0.0548, 0.0731], [0.3, 0.0538, 0.0729, 0.0567, 0.0812], [0.45, 0.0595, 0.0777, 0.06, 0.0899], [0.6, 0.0672, 0.0818, 0.0614, 0.0992]];
  const legEx = [0, 0, 0, 0];                       // (legAt fills it: outer, inner, back, front at the place asked for; never under 0.62 of the furthest)
  // A point on the line between her two legs (or on one leg's own line: only = 0 her right, 1 her left), and how thick
  // a leg is there. s: 0 at her ankles, 0.6 at her knees, 1 at mid thigh.
  const legC = V3(), legU = V3(), legA = V3(), legV = V3(), lg0 = V3(), lg1 = V3();
  const BK = { shin: 1, thigh: 1 };                  // (batch 23: her legs are as thick as the player made her: her body's width and length)
  function legAt(s, only = -1) {
    { const B = A.body ? A.body() : null; if (B) { BK.shin = B.h * (1 + (B.w - 1) * 0.65); BK.thigh = B.h * B.w; } }
    const a = only < 0 ? 0 : only, b = only < 0 ? 1 : only; let r;
    if (s <= 0.6) { const t = s / 0.6; lg0.lerpVectors(ankW[a], kneeW[a], t); lg1.lerpVectors(ankW[b], kneeW[b], t); r = tab(SHIN_R, t) * BK.shin; for (let k = 0; k < 4; k++) legEx[k] = Math.max(tab(SHIN_E, t, k + 1) * BK.shin, 0.62 * r); legA.subVectors(kneeW[a], ankW[a]).add(_la.subVectors(kneeW[b], ankW[b])); }
    else { const t = (s - 0.6) / 0.4 * 0.6; lg0.lerpVectors(kneeW[a], hipW[a], t); lg1.lerpVectors(kneeW[b], hipW[b], t); r = tab(THIGH_R, t) * BK.thigh; for (let k = 0; k < 4; k++) legEx[k] = Math.max(tab(THIGH_E, t, k + 1) * BK.thigh, 0.62 * r); legA.subVectors(hipW[a], kneeW[a]).add(_la.subVectors(hipW[b], kneeW[b])); }
    legA.normalize(); legC.addVectors(lg0, lg1).multiplyScalar(0.5);
    legU.subVectors(lg1, lg0); const d = legU.length();
    if (d < 1e-5) { legU.subVectors(hipW[1], hipW[0]); if (legU.lengthSq() < 1e-8) legU.set(1, 0, 0); }      // one leg: across it = the way from hip to hip
    legU.addScaledVector(legA, -legU.dot(legA)).normalize(); legV.crossVectors(legA, legU);
    return [d, r];
  }
  // A coil wound round BOTH her legs (only while they are held together). Its centre line stands off her skin by its
  // own thickness and 3 mm of air.
  // ku: how wide it lies across her legs (an ankle is narrower across than deep). only: 0 / 1 = round that one leg alone.
  function makeSpiral(turns, c0, c1, R, mat, s0 = 0.03, s1 = 0.98, ku = 1, only = -1) {
    const SEG = 18, SIDES = 6, N = Math.round(turns * SEG) + 1, pos = new Float32Array(N * SIDES * 3), nor = new Float32Array(N * SIDES * 3), colr = new Float32Array(N * SIDES * 3), idx = [];
    for (let i = 0; i < N; i++) { const c = mix(c0, c1, 0.5 + 0.5 * Math.sin(i * 0.9)); for (let k = 0; k < SIDES; k++) { const o = (i * SIDES + k) * 3; colr[o] = c.r; colr[o + 1] = c.g; colr[o + 2] = c.b; if (i < N - 1) { const a = i * SIDES + k, b = i * SIDES + (k + 1) % SIDES; idx.push(a, a + SIDES, b, b, a + SIDES, b + SIDES); } } }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat || K.MAT.plant); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false; scene.add(mesh);
    const P = V3(), Q = V3(), T = V3(), Nn = V3(), Bn = V3(), tip = V3(), base = V3();
    // (snug: round each side of the leg as far as its skin reaches there, plus the coil's own thickness and 1.5 mm; a little
    //  boxier than an ellipse, so that it clears the leg between those four points too)
    const pw = (c) => Math.sign(c) * Math.pow(Math.abs(c), 0.8);
    const at = (q, out) => { const s = s0 + (s1 - s0) * q, [d] = legAt(s, only), a = q * turns * TAU, ca = Math.cos(a), sa = Math.sin(a), gap = R + 0.0015;
      // across: round both legs, each leg's OUTER side; round one leg (U runs from her right leg to her left): her left leg's outer side is +U, her right leg's is -U
      const eu = only < 0 ? legEx[0] : ((ca > 0) === (only === 1) ? legEx[0] : legEx[1]), ev = sa > 0 ? legEx[2] : legEx[3];
      return out.copy(legC).addScaledVector(legU, d * 0.5 * Math.tanh(3.2 * ca) + (eu * ku + gap) * pw(ca)).addScaledVector(legV, (ev + gap) * pw(sa)); };
    return {
      mesh, tip, base,                                 // tip: where the winding has got to; base: where it starts, at her ankle
      draw(k) {                                        // k: how much of it is wound (0..1), from her ankles up
        if (!LEGS_OK || k < 0.01) { mesh.visible = false; return; }
        const n = Math.max(2, Math.round(1 + k * (N - 1)));
        for (let i = 0; i < n; i++) {
          const q = i / (N - 1); at(q, P); at(Math.min(1, q + 0.003), Q); at(Math.max(0, q - 0.003), T); Q.sub(T).normalize();
          legAt(s0 + (s1 - s0) * q, only); Nn.copy(legA).addScaledVector(Q, -legA.dot(Q)).normalize(); Bn.crossVectors(Q, Nn);
          const r = R * Math.min(1, 0.4 + (n - 1 - i) * 0.3, 0.4 + i * 0.3);
          for (let j = 0; j < SIDES; j++) { const an = j / SIDES * TAU, cx = Math.cos(an), sx = Math.sin(an), o = (i * SIDES + j) * 3, nx = Nn.x * cx + Bn.x * sx, ny = Nn.y * cx + Bn.y * sx, nz = Nn.z * cx + Bn.z * sx;
            pos[o] = P.x + nx * r; pos[o + 1] = P.y + ny * r; pos[o + 2] = P.z + nz * r; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; }
          if (i === n - 1) tip.copy(P); if (i === 0) base.copy(P);
        }
        geo.setDrawRange(0, (n - 1) * SIDES * 6); geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; mesh.visible = true;
      },
      hide() { mesh.visible = false; },
    };
  }
  // A tongue: a broad flat tube along a cubic curve from a mouth to its tip; `wide` is the direction its width lies in.
  const TN = 16, TS = 8;
  function makeTongue(hex) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(TN * TS * 3), idx = [];
    for (let i = 0; i < TN - 1; i++) for (let k = 0; k < TS; k++) { const a = i * TS + k, b = i * TS + (k + 1) % TS; idx.push(a, a + TS, b, b, a + TS, b + TS); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).multiplyScalar(0.9), side: THREE.DoubleSide })); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = true; scene.add(mesh);
    const A0 = V3(), B0 = V3(), X = V3(), Y = V3(), T0 = V3();
    const bez = (s, a, b, c, d, o) => { const r = 1 - s, w0 = r * r * r, w1 = 3 * r * r * s, w2 = 3 * r * s * s, w3 = s * s * s; return o.set(w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y, w0 * a.z + w1 * b.z + w2 * c.z + w3 * d.z); };
    return {
      mesh, ph: 0,
      draw(p0, p1, p2, p3, wide, w, th, fix) {
        for (let i = 0; i < TN; i++) {
          const s = i / (TN - 1); bez(Math.min(1, s + 0.02), p0, p1, p2, p3, B0).sub(bez(Math.max(0, s - 0.02), p0, p1, p2, p3, T0)); if (B0.lengthSq() < 1e-12) B0.subVectors(p3, p0); B0.normalize();
          bez(s, p0, p1, p2, p3, A0); if (fix) fix(A0, s);
          X.copy(wide).addScaledVector(B0, -wide.dot(B0)); if (X.lengthSq() < 1e-8) X.set(1, 0, 0); X.normalize(); Y.crossVectors(X, B0);
          const wd = w * (0.72 + 0.5 * Math.sin(PI * Math.min(1, s * 0.8 + 0.2))) * (s > 0.84 ? Math.sqrt(Math.max(0, 1 - (s - 0.84) / 0.16)) * 0.85 + 0.15 : 1) * (s < 0.1 ? 0.6 + s * 4 : 1);
          for (let k = 0; k < TS; k++) { const an = k / TS * TAU, o = (i * TS + k) * 3, cx = Math.cos(an) * wd, cy = Math.sin(an) * th; pos[o] = A0.x + X.x * cx + Y.x * cy; pos[o + 1] = A0.y + X.y * cx + Y.y * cy; pos[o + 2] = A0.z + X.z * cx + Y.z * cy; }
        }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); mesh.visible = true;
      },
      hide() { mesh.visible = false; },
    };
  }
  // One lick of a sole. The tongue is SHORT: it reaches LICK_MAX from the mouth and no further, so whoever licks must
  // have the mouth close to the sole (a scene that stands them further off gets a tongue that does not arrive: lickStat.far
  // says by how much). It laps a short stretch of the sole under the mouth, not the whole sole. And it lies ON her
  // skin: its end runs along the sole a hair above it, and every ring of the tube that would come nearer the sole than
  // its own half thickness is pushed out along the sole's normal (lickStat.push: the most any ring needed).
  // k: how far out it may come (0 = stays in).
  const LICK_MAX = 0.085, LICK_AIR = 0.0022;
  const lickStat = { len: 0, far: 0, push: 0, n: 0 };
  if (typeof window !== 'undefined') window.__lick = lickStat;
  if (typeof window !== 'undefined' && /[?&](hold|holdtext)=/.test(location.search)) {      // (tests) her loose shoes as drawn; a look at one of them
    const bx = new THREE.Box3();
    window.__capShoes = () => loose.map((s) => { s.g.updateMatrixWorld(true); bx.setFromObject(s.g, true); return { vis: s.g.visible, lie: s.lie, lick: !!s.lick, minY: +bx.min.y.toFixed(4), maxY: +bx.max.y.toFixed(4), p: s.g.position.toArray().map((v) => +v.toFixed(2)) }; });
    window.__capLook = (i, d = 1.1, h = 0.55, a = 0.6) => { const p = loose[i].g.position; S.cam.set(V3(p.x + Math.sin(a) * d, h, p.z + Math.cos(a) * d), V3(p.x, 0.08, p.z), { fov: 42, cut: true }); };
  }
  const lkQ = V3(), lkA = V3(), lkC = V3(), lkF = V3(), lkS = V3(), lkD = V3(), lkU = V3(), lkP = V3();
  // how far a point stands off the sole (along its normal), or 9 when it is not over the foot at all
  function soleAir(f, P) {
    const L = Math.max(0.05, lkU.subVectors(f.ball, f.heel).dot(f.fwd)), u = lkP.subVectors(P, f.heel).dot(f.fwd) / L;
    if (u < -0.14 || u > 1.42) return 9;
    along(f, clamp(u, 0, 1.35), lkU); lkP.subVectors(P, lkU);
    const lat = Math.abs(lkP.dot(f.side)); if (lat > 0.066) return 9;
    return lkP.dot(f.n) + Math.max(0, lat - 0.028) * 0.6;      // (the sole falls away towards its edges)
  }
  // Whoever licks has the mouth AT her sole. A spot beside the sole's centre line and a little off the skin...
  const soleSpot = (f, u, across, off, out) => along(f, u, out).addScaledVector(f.side, across).addScaledVector(f.n, off);
  // ...and the creature slid along the ground (and up or down, where yLo..yHi allow it) until its mouth is there.
  // Returns the height its mouth still lacks (an Ivy Maiden makes that up by leaning).
  const _mt = V3();
  function mouthTo(obj, mouth, W, dt, yLo = 0, yHi = 0) {
    _mt.subVectors(W, mouth); const k = Math.min(1, dt * 13);
    obj.position.x += _mt.x * k; obj.position.z += _mt.z * k;
    if (yLo !== yHi) obj.position.y = clamp(obj.position.y + _mt.y * k, yLo, yHi);
    return _mt.y;
  }
  function lick(T, mouth, f, dt, k, period = 1.4, w = 0.012, th = 0.004, reach = LICK_MAX) {
    T.ph = (T.ph + dt / period) % 1;
    const p = T.ph, ext = sst(p, 0.04, 0.24) * (1 - sst(p, 0.86, 1)) * k, press = sst(p, 0.24, 0.4) * (1 - sst(p, 0.82, 0.94));
    if (ext < 0.02) { T.hide(); return; }
    const need = th + LICK_AIR, L = Math.max(0.05, lkU.subVectors(f.ball, f.heel).dot(f.fwd));
    // the stretch it laps: 5 cm of the sole under the mouth, between her heel pad and the ball of her foot
    const um = clamp(lkP.subVectors(mouth, f.heel).dot(f.fwd) / L, 0.2, 0.9), u = clamp(um + 0.3 * (sst(p, 0.2, 0.86) - 0.5), 0.1, 1.0);
    along(f, u, lkQ).addScaledVector(f.n, need).addScaledVector(f.side, 0.007 * Math.sin(4 * PI * p));
    lkD.subVectors(lkQ, mouth); let D = lkD.length();
    lickStat.n++;
    if (D > reach) { lickStat.far = Math.max(lickStat.far, D - reach); lkQ.copy(mouth).addScaledVector(lkD, reach / D); D = reach; }
    lickStat.len = Math.max(lickStat.len, D * ext);
    lkQ.lerpVectors(mouth, lkQ, ext); lkD.subVectors(lkQ, mouth);
    lkF.copy(lkD).addScaledVector(f.n, -lkD.dot(f.n)); if (lkF.lengthSq() < 1e-8) lkF.copy(f.fwd); lkF.normalize();      // the way it arrives, along her skin
    lkS.crossVectors(f.n, lkF);                                                                                           // its width lies across that
    lkA.copy(mouth).addScaledVector(lkD, 0.34).addScaledVector(f.n, 0.010 * ext);
    lkC.copy(lkQ).addScaledVector(lkF, -(0.010 + 0.016 * press) * ext).addScaledVector(f.n, (0.012 - 0.011 * press) * ext);      // its end lies flat on her sole
    T.draw(mouth, lkA, lkC, lkQ, lkS, w, th, (P, s) => {
      const air = soleAir(f, P); if (air >= need || air < -0.03) return;      // (deeper than that it is not over her sole but behind her foot)
      const up = (need - air) * Math.min(1, s * 5); P.addScaledVector(f.n, up); if (s > 0.2) lickStat.push = Math.max(lickStat.push, up);
    });
  }

  // =====================================================================================================
  //                                       staging: where things stand, where the camera sits
  // =====================================================================================================
  let st = null;                                     // the capture in progress
  const mid = V3(), nH = V3(), sideH = V3();
  function soleFrame() {                             // the middle of her soles, the way they face (level) and across
    mid.copy(feet[0].sArch).add(feet[1].sArch).multiplyScalar(0.5);
    nH.copy(feet[0].sn).add(feet[1].sn); nH.y = 0;
    if (nH.lengthSq() < 0.3) nH.set(st ? st.out.x : 0, 0, st ? st.out.z : 1);          // (soles facing the sky: use the way her feet point from her seat)
    nH.normalize(); sideH.set(nH.z, 0, -nH.x);
  }
  const bearing = (v) => Math.atan2(v.x, v.z);
  // Stand a group beside her feet (never in front of her soles: that corridor is the camera's): [across, out]
  const SLOTS_A = [[-1.05, 0.15], [1.05, 0.15], [-1.5, -0.75], [1.5, -0.75], [1.1, 1.7], [-1.1, 1.7]];
  const SLOTS3 = [[-1.2, 0.5], [1.2, 0.5], [-1.65, -0.35], [1.65, -0.35], [0.0, 1.9]];      // round 3 (she lies on her front): a little further off
  function arrange(list, SLOTS = SLOTS_A) {
    soleFrame();
    // (they face a point nearer her knees than her soles, so their own tendrils do not cross in front of her feet)
    list.forEach((m, i) => { const [a, b] = SLOTS[i % SLOTS.length]; m.obj.position.set(mid.x + sideH.x * a + nH.x * b, 0, mid.z + sideH.z * a + nH.z * b); m.faceTo(mid.x - nH.x * 0.45, mid.z - nH.z * 0.45); });
  }
  const reach = (m, h = 0.95, k = 0.25) => (out) => out.copy(m.obj.position).setY(h).lerp(mid, k).setY(h + (mid.y - h) * k * 0.5);      // where a maiden's vines start from
  // A shot from `off` to one side of a bearing; if trees or the others push the camera far from that side, the same
  // from the other side when that is nearer the mark.
  const bearingNow = () => Math.atan2(S.cam.gPos.x - S.cam.gLook.x, S.cam.gPos.z - S.cam.gLook.z);
  function sideOn(c, yaw, off, o) {
    const put = (y) => { S.cam.at(c, y, o); const d = bearingNow() - y; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
    const d1 = put(yaw + off);
    if (d1 > 0.35 && put(yaw - off) >= d1) put(yaw + off);
  }
  // The 2D sheets see her from her left (her head at the right of the picture). Where trees or bushes stand in that
  // view, the same from her right. `far` is then set to the side AWAY from the camera: what stands "a little to the far
  // side" and the close-ups taken "from the picture's side" follow it.
  const far = V3(1, 0, 0), _sv = V3();
  function side2d(c, o = {}) {
    far.set(-st.out.z, 0, st.out.x);
    sideOn(c, st.yaw, PI / 2, Object.assign({ y: c.y, pitch: 0.03, dist: 3.9, cut: true, through: true }, o));
    if (_sv.subVectors(S.cam.gPos, c).dot(far) > 0) far.negate();
    post.setCloseUp('off');
  }
  const shot = {
    soles(o = {}) { soleFrame(); S.cam.at(mid, bearing(nH) + (o.turn === undefined ? 0.28 : o.turn), Object.assign({ y: mid.y - 0.03, pitch: 0.2, dist: 1.25, fov: 30, focus: mid.clone(), focusK: 2.2, cut: true, through: true, minY: 0.08, near: 0.3 }, o)); },
    side(o = {}) { soleFrame(); S.cam.at(mid, bearing(nH) + (o.sgn || 1) * 1.45, Object.assign({ y: mid.y + 0.02, pitch: 0.07, dist: 1.05, fov: 34, focus: mid.clone(), focusK: 2.0, cut: true, through: true, minY: 0.08, near: 0.3 }, o)); },
    wide(o = {}) { const c = V3().lerpVectors(st.seat, mid, 0.55); sideOn(c, st.yaw + (o.flip ? PI : 0), (o.sgn || 1) * PI * 0.6, Object.assign({ y: 0.55, pitch: 0.18, dist: 3.6, cut: true, see: [C.headPos(), mid.clone()] }, o)); },      // (her face and her feet both in view, nobody's stalk in front of them)
    face(o = {}) { const h = C.headPos(), f = C.headFwd().setY(0); if (f.length() < 0.4) f.subVectors(mid, h).setY(0);      // from in front of her face (lying flat she looks up: then from her feet's side)
      S.cam.at(h, bearing(f) + (o.turn !== undefined ? o.turn : (o.sgn || 1) * 0.6),      // (turn: how far round to her left of straight ahead)
        Object.assign({ y: h.y, pitch: 0.08, dist: 1.5, fov: 34, focus: h.clone(), focusK: 1.5, cut: true, through: true, minY: 0.2, near: 0.3 }, o)); },
  };
  // (10-02) on her front: from above her calves, looking down along her feet at her soles; whoever is at work beyond
  // her toes is in the back of the picture, never in front of what it does
  shot.calves = (o = {}) => { soleFrame(); const c = V3().copy(mid).addScaledVector(nH, -(o.back || 0.62)).addScaledVector(sideH, o.side || 0.12); c.y = mid.y + (o.up || 0.74);
    S.cam.set(c, V3().copy(mid).addScaledVector(nH, o.ahead || 0.06), { fov: o.fov || 38, cut: true, focus: mid.clone(), focusK: 2.0 }); };
  const flat = { p: V3(), r: 1.7, k: 0.975 };

  async function pose(name, yaw) {                   // put her in a clip at the seat, at once, and let her soles be read
    S.place(st.seat, yaw === undefined ? st.yaw : yaw); S.clip(has(name) ? name : 'SitBoth', 0);
    C.snapSoles(); await S.frame(); await S.frame(); C.snapSoles(); await S.frame(); soleFrame();
    flat.p.lerpVectors(st.seat, mid, 0.5).setY(0);
  }
  function begin(seat, yaw, list, chained = false) {
    A.lastBare = bareNow() ? 1 : -1;                 // (a capture starts: whether it takes her shoes is noted from here; already off, they go back on at the end)
    if (!chained) { A.shoeWork = null; for (const s of loose) s.bedK = 0; }      // (10-03: what is done inside her shoes, from here; the tied part after the 2D rounds keeps it)
    if (A.soleMarks) A.soleMarks(null);
    st = { seat: seat.clone(), yaw, list, out: V3(Math.sin(yaw), 0, Math.cos(yaw)), speaker: null };
    S.grassFlat = () => flat; flat.p.copy(seat);
    return st;
  }
  const chainNext = () => !!(S.capStyle && S.capStyle() === 'both');      // (10-03: the tied part follows the 2D rounds)
  let hatWasOff = false;                             // (10-03: whether the stage that just ended had her hat off: a chained bound() keeps it so)
  function end() {
    hatWasOff = hat.obj.visible;
    clearTicklers(true); coils(wraps, false); for (const l of leashes) l.hide(); endLegUp(); if (typeof endAlraune === 'function') endAlraune();
    for (const s of loose) { s.g.visible = false; s.vine.hide(); s.carry = null; }
    shoesQuiet();
    hat.obj.visible = false; hatS.on = null;
    post.setCloseUp('off'); S.grassFlat = null; S.toes(0);
    A.setHeelsWorn(true); if (A.setHat) A.setHat(true);
    if (st) for (const m of st.list) { if (m.laugh) m.laugh(false); if (m.talk) m.talk(false); if (m.setFace) m.setFace('calm'); }
    st = null;
  }
  // (round 1 of the Ivy Maidens, as the 2D sheet has it: one leg held up in a coil of vine, a head at each side of that foot)
  const legCoil = makeSpiral(6.5, IV.v0, IV.v2, 0.0125, null, 0.05, 0.95, 1, 0), hoist = makeVine(IV.v0, IV.v2, 22, 7);
  const UP1 = { on: false, k: 0, goal: 0, lick: null, by: null };
  const _hq = new THREE.Quaternion(), _hm = V3(), _h1 = V3(), _h2 = V3();
  const mouthOf = (m, out) => { m.headPos(out); m.head.getWorldQuaternion(_hq); return out.add(_hm.set(0, -0.045, 0.1).applyQuaternion(_hq)); };
  function updLegUp(dt, t) {
    if (!UP1.on) { legCoil.hide(); hoist.hide(); return; }
    readLegs(); UP1.k = damp(UP1.k, UP1.goal, 2.2, dt); if (UP1.coil) { UP1.coil.draw(UP1.k); legCoil.hide(); } else legCoil.draw(UP1.k);
    if (UP1.by && UP1.k > 0.03) {                      // the vine that holds the leg up: from the coil's start at her ankle, up and over to a maiden's stalk
      UP1.by(_h1); _h2.copy(legCoil.base); P1.lerpVectors(_h1, _h2, 0.4).addScaledVector(far, 0.25); P1.y += 0.4; P2.copy(_h2).addScaledVector(far, 0.3); P2.y += 0.06;      // (it leaves her ankle on the far side: never across her sole)
      hoist.draw(_h1, P1, P2, _h2, UP, 0.02, 0.0125);
    } else hoist.hide();
    if (UP1.lick) UP1.lick.forEach((m, i) => {
      m.tk = damp(m.tk || 0, UP1.licking ? 1 : 0, 4, dt);
      const f = feet[UP1.feet ? UP1.feet[i] : 0];
      if (UP1.licking && m.obj.visible) {
        // Her mouth comes to the sole (the maiden slides, and leans as much as it takes): just beyond the toes and above them
        // if she stands at that end, else to the side of the sole that is away from the picture. Never over it, and never
        // on the picture's side: a maiden's head is a great bell of leaves and hides what it licks.
        mouthOf(m, _h1);
        if (!m._spot) { _h2.subVectors(_h1, f.arch); const du = _h2.dot(f.fwd), ds = _h2.dot(f.side); const sf = far.dot(f.side) >= 0 ? 0.115 : -0.115;      // (the side of the sole that is away from the picture)
          m._spot = Math.abs(du) > Math.abs(ds) && du > 0 ? [1.45, 0, 0.045] : UP1.feet ? [0.6, ds > 0 ? 0.095 : -0.095, 0.03] : [0.42, sf * 0.83, 0.03]; }
        const ey = mouthTo(m.obj, _h1, soleSpot(f, m._spot[0], m._spot[1], m._spot[2], _h2), dt);
        m._lean = clamp((m._lean === undefined ? 1.2 : m._lean) - ey * 6 * dt, 0, 3.6); m.lean(m._lean);
      }
      if (m.tk > 0.03 && m.obj.visible) lick(m.tongue, mouthOf(m, _h1), f, dt, m.tk, (UP1.period || 1.3) + 0.25 * i, 0.014, 0.0045, 0.14); else m.tongue.hide();
    });
  }
  function endLegUp() { UP1.on = false; UP1.k = UP1.goal = 0; UP1.licking = false; legCoil.hide(); hoist.hide(); if (UP1.coil) UP1.coil.hide(); UP1.coil = null; UP1.feet = null; UP1.period = 0; UP1.by = null; if (UP1.lick) for (const m of UP1.lick) { m.tk = 0; m._spot = null; m._lean = undefined; if (m.tongue) m.tongue.hide(); } UP1.lick = null; }
  // Stand a maiden so that, leaning over, her head hangs `gap` short of the point P, on the side `away` (a level direction)
  function headTo(m, P, away, gap = 0.36) {
    const hy = m.head.position.y, hz = m.head.position.z; let th = 0;
    for (let i = 0; i < 70; i++) { th = i * 0.02; if (hy * Math.cos(th) - hz * Math.sin(th) <= P.y) break; }
    const reach = hy * Math.sin(th) + hz * Math.cos(th);
    m.obj.position.set(P.x + away.x * (reach + gap), 0, P.z + away.z * (reach + gap)); m.faceTo(P.x, P.z); m.lean(th / 0.45); m._lean = th / 0.45; m._spot = null;
  }
  let ext = false;                                   // another scene (traps.js) is using the ticklers, coils and loose shoes
  S.late.push((dt, t) => { if (!st && !ext) return; readFeet(dt); updLeashes(t); updTicklers(dt); updShoes(dt, t); updHat(dt, t); if (st) updLegUp(dt, t); });
  const prevSpeak = S.onSpeak;
  S.onSpeak = (sheet, on) => { if (prevSpeak) prevSpeak(sheet, on); if (st && st.speaker && (sheet === 'ivy' || sheet === 'myc') && st.speaker.talk) st.speaker.talk(on); };
  const prevEnd = S.onSceneEnd;
  S.onSceneEnd = () => { if (st) end(); if (prevEnd) prevEnd(); };

  // a maiden speaks: her portrait (the pale kind 0..3, the yellow-green kind 4..7) and her face in the world
  const EX = { calm: 0, grin: 1, open: 2 };
  async function ivySay(m, e, text) { st.speaker = m; if (m.setFace) m.setFace(e); await S.say('ivy', (m.kind === 'yellow' ? 4 : 0) + EX[e], text); st.speaker = null; }
  const laughAll = (on) => { for (const m of st.list) if (m.laugh) m.laugh(on); };

  // =====================================================================================================
  //                                                the Ivy Maidens
  // =====================================================================================================
  const sisters = [0, 1, 2].map((i) => { const m = K.makeIvyMaiden({ seed: 60 + i * 5, hidden: true, gazer: i === 1, height: 1.32 + 0.1 * i }); scene.add(m.obj); S.actors.push(m); S.avoid(m.obj, 0.5, 2.2, () => m.up); return m; });
  const ANGRY = "Put your filthy vines away from me!|Not today, you tangled weed!|I've seen you coming this time!|YOU'LL REGRET IT, YOU NASTY WEED!";

  // The lash that catches her in the open: her shoes fly off left and right and her hat spins away (the 2D game's
  // in-battle capture attempt). Played before the screen goes dark; round 1 then starts with her already barefoot.
  async function snatch(m) {
    m.lean(1.3); m.shake(1.2); S.toast('The Ivy Maiden lashes out!!', 'warning', 1.6);
    if (has('Startle')) S.clip('Startle', 0.08);
    await S.wait(0.16);
    C.snapSoles(); readFeet(0);
    const hp = C.headPos(), side = V3(Math.cos(anne.rotation.y), 0, -Math.sin(anne.rotation.y));
    sparks.burst(V3(anne.position.x, 0.25, anne.position.z), GOLD, 26, 2.4, 1.2);
    const land = [V3(anne.position.x - side.x * 1.5, 0.05, anne.position.z - side.z * 1.5), V3(anne.position.x + side.x * 1.6, 0.05, anne.position.z + side.z * 1.6)];
    A.setHeelsWorn(false);
    loose.forEach((s, i) => { throwShoe(i, (o) => o.copy(land[i]), 0.55); s.rest.set(1.45, i ? 0.8 : -0.5, i ? 0.3 : -0.2); });
    throwHat((o) => { (m.headPos ? m.headPos(o) : o.copy(m.obj.position).setY(1.4)); o.y += 0.2; });
    st = st || { seat: anne.position.clone(), yaw: anne.rotation.y, list: [m], out: V3(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)), speaker: null, temp: true };
    S.expr('shocked', 0.3); S.emote(anne, 'exclaim', 0.8);
    S.toast('NOO, MY SHOES!!|Dammit!!|GOSH!!!', 'dialog', 1.8);
    await S.wait(0.3); await S.mark('lash'); await S.wait(0.55);
  }

  // Round 1 is the 2D game's CAPTURE1, pose for pose (sheet anne-ivymaidens-1: idle2, shoeoff, tickle1, tickle2): she is
  // on her back, propped on her elbows, her right leg held straight up in a coil of vine; two maidens lean over, a head
  // at each side of that foot; the sandal comes off it, then the other one; then they lick her sole. Seen from her left,
  // her head at the right of the picture, as the sheet draws it; a close-up of the foot now and then.
  const awayA = V3(), awayB = V3(), fp = V3(), cc = V3(), cq = V3();
  const shot2d = (o = {}) => { cc.copy(st.seat).addScaledVector(st.out, -0.12); cc.y = 0.72; side2d(cc, { dist: o.dist || 3.9, fov: o.fov || 38, see: [C.headPos(), feet[0].arch.clone()] }); };      // the sheet's view
  const shotFoot = (sgn = 1) => {                      // close on the raised foot, the two heads in the picture
    const f = feet[0]; fp.copy(f.sArch); cq.copy(fp).addScaledVector(f.sn, 0.4).addScaledVector(far, -0.66).addScaledVector(st.out, 0.1 * sgn);      // from over her sole (it faces the sky), a little to the picture's side
    S.cam.set(cq, fp, { fov: 34, cut: true, focus: fp.clone(), focusK: 1.2 }); post.setCloseUp('on');
  };
  async function round1(o) {
    const bare = !!o.bare;
    if (st.list.length < 2) st.list = st.list.concat(sisters.filter((m) => !st.list.includes(m)).slice(0, 2 - st.list.length));      // (the sheet has two heads: a sister has come up beside the one that caught her)
    const [hA, hB] = st.list;
    A.setHeelsWorn(!bare); await pose(has('IvyLegUp') ? 'IvyLegUp' : 'HeldBack');
    shot2d();                                          // (this settles which side the picture is taken from: `far`)
    // a head at each side of her raised foot: one stands beyond her feet, one beyond her head, both a little to the far side
    const f = feet[0]; fp.copy(f.arch); fp.y += 0.03;
    awayA.copy(st.out).multiplyScalar(0.9).addScaledVector(far, 0.42).normalize(); awayB.copy(st.out).multiplyScalar(-0.9).addScaledVector(far, 0.42).normalize();
    headTo(hA, fp, awayA); headTo(hB, fp, awayB);
    for (const m of [hA, hB]) { m.showNow(); m.tongue = m.tongue || makeTongue(m.kind === 'yellow' ? '#c05a9a' : '#e0567a'); m.tk = 0; }
    for (const m of st.list.slice(2)) { m.obj.position.set(st.seat.x + far.x * 2.2 - st.out.x * 0.6, 0, st.seat.z + far.z * 2.2 - st.out.z * 0.6); m.faceTo(st.seat.x, st.seat.z); m.showNow(); m.lean(0.3); }
    UP1.on = true; UP1.k = UP1.goal = 1; UP1.lick = [hA, hB]; UP1.licking = false; UP1.by = (out) => { hB.headPos(out); out.y += 0.42; };
    coils(wraps, true, (out, i) => (i ? out.copy(hA.obj.position).setY(0.5) : (hB.headPos(out), out.setY(out.y + 0.4))));
    if (bare) loose.forEach((s, i) => { s.rest.set(2.0, i ? 0.6 : -0.6, 0); const at = V3().copy(st.seat).addScaledVector(st.out, 1.5 + 0.3 * i).addScaledVector(far, -0.7 + 0.5 * i).setY(0.05); s.to = (out) => out.copy(at); s.carry = null; s.t = -1; s.g.visible = true; });
    S.expr('shocked', 0.3);
    await S.wait(0.25); await S.fade(0, 0.4);
    await S.mark('captured');
    S.emote(anne, 'exclaim', 0.8, -0.75);
    await ivySay(hA, 'grin', "Don't miss out on this, sisters!!");
    S.expr('worried', 0.3);
    if (!bare) {
      // the toe count: a fuzzy tip taps along the toes of the foot they hold, still in its shoe
      shotFoot();
      tick(0, 0, 'toes', 'toes', (out) => { hA.headPos(out); out.y -= 0.12; }, 'catkin', { clear: 0.03, rate: 0.8 }); S.toes(0.13, 1.4, Infinity);
      await ivySay(hA, 'calm', C.lookLines ? C.lookLines('ivy').shoe : 'Do these pretty piggies deserve our attention?');      // (10-03: what they make of the shoes she has on: story_common.js lookLines)
      if (C.lookRemarks) for (const t of C.lookRemarks('ivy', 2)) await ivySay(hA, 'grin', t);      // (batch 22: and of her: her feet, what she is or what she wears)
      await S.say('a2', 31, "H-hey!! Keep your vines off my shoes!!", { expr: 'embarrassed', blush: 0.6 });
      untick(0); S.toes(0); shot2d();
      // shoes off: the sandal on the foot they hold is plucked off between the two heads; a tendril takes the other
      await S.wait(0.35); hA.shake(0.7); hB.shake(0.7);
      const land = [V3().copy(st.seat).addScaledVector(st.out, 1.75).addScaledVector(far, -0.55).setY(0.05), V3().copy(st.seat).addScaledVector(st.out, 0.95).addScaledVector(far, -0.95).setY(0.05)];
      if (A.setShoe) A.setShoe('R', false); else A.setHeelsWorn(false);
      loose[0].rest.set(2.0, -0.6, 0); throwShoe(0, (out) => out.copy(land[0]), 0.6); sparks.burst(fp.clone(), GREEN, 14, 1.2, 0.8);
      S.expr('shocked', 0.5); S.emote(anne, 'exclaim', 0.7, -0.75);
      await ivySay(hB, 'open', 'They do!! They do!! Shoes off, shoes off, pretty butterfly!!');
      A.setHeelsWorn(false); loose[1].rest.set(2.0, 0.6, 0); throwShoe(1, (out) => out.copy(land[1]), 0.55); sparks.burst(feet[1].arch.clone(), GREEN, 10, 1.0, 0.6);
      await S.wait(0.7);
      if (C.lookLines) { shotFoot(); await ivySay(hA, 'grin', C.lookLines('ivy', true).nail); }      // (10-03: and her toenails, now they can see them)
    } else {
      await ivySay(hA, 'calm', 'Do these pretty piggies deserve our attention?');
      await ivySay(hB, 'open', 'They do!! They do!! And look, no shoes in our way, pretty butterfly!!');
      if (C.lookLines) { shotFoot(); await ivySay(hA, 'grin', C.lookLines('ivy', true).nail); }
    }
    // their tongues on her sole (the sheet's tickle1 and tickle2)
    if (has('IvyLegUpTickled')) S.clip('IvyLegUpTickled', 0.2);
    UP1.licking = true; S.expr('laughHard', 0.85); laughAll(true);
    shotFoot(); await S.wait(0.6); await S.mark('tickle');
    await S.say('a2', 14, 'AHAHAHA!! N-NOT MY FEET!! HAHAHAHA!!', { expr: 'laughHard', blush: 0.9 });
    await S.wait(1.2); shot2d(); await S.wait(2.0); shot.face({ turn: 0.85 }); await S.mark('face1'); await S.wait(1.3); shotFoot(-1); await S.wait(1.6);
    shot2d();
    const free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: 'Try 1 / 3', width: 0.2, speed: 0.8 });
    if (free) return true;
    for (const m of st.list) m.shake(0.8);
    await ivySay(hA, 'grin', 'You cannot leave us behind that easily, little pixy.');
    return false;
  }

  async function round2() {
    const [h0] = st.list;
    await ivySay(h0, 'open', 'Oh!! Are you leaving us already, little pixy?');
    await S.fade(1, 0.3); clearTicklers(true); laughAll(false); S.toes(0); endLegUp(); for (const m of st.list) m.lean(0.4);
    // hauled back by the ankles: on her back now, propped on her elbows, her feet held high; her hat has come off
    A.setHeelsWorn(false); await pose('HeldBack');
    const newcomers = sisters.slice(0, Math.max(1, 3 - st.list.length + 1));
    for (const m of newcomers) m.hideNow();
    st.list = st.list.concat(newcomers); arrange(st.list);
    coils(wraps, true, (out, i) => reach(st.list[i % 2], 1.25, 0.2)(out));
    if (!hat.obj.visible) { hat.obj.visible = true; if (A.setHat) A.setHat(false); hatS.t = -1; }
    hatS.on = (o) => { (h0.headPos ? h0.headPos(o) : o.copy(h0.obj.position).setY(1.4)); o.y += 0.2; };
    { const spots = [0, 1].map((i) => V3().copy(st.seat).addScaledVector(st.out, 1.5 + 0.3 * i).addScaledVector(sideH, i ? 0.8 : -0.8).setY(0));      // (10-03: her shoes lie in the grass beyond the sisters)
      loose.forEach((s, i) => { s.to = (out) => out.copy(spots[i]); s.carry = null; s.t = -1; s.g.visible = true; s.lie = i ? 'side' : 'up'; s.rest.y = st.yaw + (i ? 0.7 : -0.4); s.lickYaw = undefined; }); }
    shot.wide(); S.expr('worried', 0.4);
    await S.wait(0.25); await S.fade(0, 0.4);
    await S.mark('captured2');
    await ivySay(h0, 'grin', 'But we cannot let you go without meeting our sisters!');
    for (const m of newcomers) { m.emerge(); sparks.burst(V3(m.obj.position.x, 0.3, m.obj.position.z), GREEN, 16, 1.2, 1.4); await S.wait(0.3); }
    S.expr('shocked', 0.4); S.emote(anne, 'exclaim', 0.8, -1.0);
    await S.wait(0.6); for (const m of newcomers) m.lean(0.35);
    const gz = st.list.find((m) => m.kind === 'yellow') || st.list[st.list.length - 1];
    await ivySay(gz, 'grin', 'True! True! The party is just about to get started!!');
    // phase 1, from a little way off: a catkin on one sole, a fern frond working between the toes of the other
    const [a, b, c2, d2] = [st.list[0], st.list[1] || st.list[0], st.list[2] || st.list[0], st.list[3] || st.list[1] || st.list[0]];
    tick(0, 0, 'stroke', 'side', reach(a, 1.2), 'catkin'); tick(1, 1, 'toes', 'toes', reach(b, 1.35, 0.3), 'frond', { rate: 1.3 });
    S.toes(0.3, 1.5, Infinity); S.expr('laughHard', 0.85); laughAll(true);
    await S.wait(2.2);
    // the dandelion clock: dabbed under her toes it bursts into seeds, and she sneezes in the middle of a laugh
    const P = tick(2, 0, 'toes', 'toes', reach(c2, 1.3, 0.3), 'puff', { clear: 0.02, rate: 0.7 });
    shot.side({ sgn: -1 }); post.setCloseUp('on'); await S.wait(1.5);
    sparks.burst(P.pos.clone(), WHITE, 34, 0.9, 0.5); untick(2); S.expr('strain', 0.7);
    await S.say('a2', 19, 'Ah-- ah-- AH-CHOO!!', { expr: 'strain', blush: 0.7 });
    // a moment of black, as in the 2D game; then close on her soles with everybody at work
    await S.fade(1, 0.35); clearTicklers(true);
    tick(0, 0, 'stroke', 'side', reach(a, 1.2), 'catkin'); tick(1, 1, 'stroke', 'side', reach(b, 1.2), 'catkin', { ph: 2.2 });
    tick(2, 0, 'toes', 'toes', reach(c2, 1.4, 0.3), 'frond', { rate: 1.3 }); tick(3, 1, 'toes', 'toes', reach(d2, 1.4, 0.3), 'duster', { rate: 1.1, ph: 1.0 });
    S.expr('laughHard', 0.9); shot.soles({ pitch: 0.12 });
    await S.wait(0.5); await S.fade(0, 0.35);
    await S.mark('tickle2');
    await S.say('a2', 18, 'HAHAHA!! S-STOP IT, YOU OVERGROWN WEEDS!!', { expr: 'laughHard', blush: 0.9 });
    await S.wait(1.4); shot.side(); await S.wait(1.6); shot.face(); await S.mark('face2'); await S.wait(1.3); shot.soles({ turn: -0.3, pitch: 0.12 }); await S.wait(1.4);
    post.setCloseUp('off'); shot.wide();
    const free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: 'Try 2 / 3', width: 0.23, speed: 0.8 });
    if (free) return true;
    await ivySay(gz, 'calm', 'And our Mistress awaits you...');
    return false;
  }

  async function round3(o) {
    const [h0] = st.list;
    if (!o.gameOver) {                               // her kick lands on a maiden's nose
      h0.shake(1.5); h0.lean(-0.8); if (h0.headPos) sparks.burst(h0.headPos(V3()), GOLD, 18, 1.6, 0.8);
      await ivySay(h0, 'open', 'Such a meany little footsie!');
    }
    await S.fade(1, 0.3); clearTicklers(true); laughAll(false); S.toes(0);
    // turned over: on her front, propped on her elbows, her shins held up
    A.setHeelsWorn(false);
    await pose('HeldProne', st.yaw + PI);
    if (st.list.length < 3) { const more = sisters.filter((m) => !st.list.includes(m)).slice(0, 3 - st.list.length); for (const m of more) m.showNow(); st.list = st.list.concat(more); }
    arrange(st.list, SLOTS3); for (const m of st.list) { m.showNow(); m.lean(0.2); }
    coils(wraps, true, (out, i) => reach(st.list[i % 2], 1.45, 0.3)(out));
    if (!loose[0].g.visible) { const spots = [0, 1].map((i) => V3().copy(st.seat).addScaledVector(st.out, 1.5 + 0.3 * i).addScaledVector(sideH, i ? 0.8 : -0.8).setY(0));      // (10-03: her shoes lie in the grass beyond the sisters)
      loose.forEach((s, i) => { s.to = (out) => out.copy(spots[i]); s.carry = null; s.t = -1; s.g.visible = true; s.lie = i ? 'side' : 'up'; s.rest.y = st.yaw + (i ? 0.7 : -0.4); s.lickYaw = undefined; }); }
    shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 }); S.expr('worried', 0.5);
    await S.wait(0.25); await S.fade(0, 0.4);
    await S.mark('captured3');
    if (o.gameOver && o.intro) await o.intro();
    await ivySay(h0, 'grin', 'Those blossom soles are an endless source of happiness indeed!');
    await ivySay(st.list[1] || h0, 'calm', 'Of course...');
    // they dust her soles with tufts of their own leaf hair
    const [a, b] = [st.list[0], st.list[1] || st.list[0]];
    tick(0, 0, 'stroke', 'toes', reach(a, 1.5, 0.35), 'duster', { rate: 1.1 }); tick(1, 1, 'stroke', 'toes', reach(b, 1.5, 0.35), 'duster', { rate: 1.2, ph: 2.0 });
    tick(2, 0, 'arch', 'side', reach(a, 1.1, 0.3), 'catkin', { rate: 1.3 }); tick(3, 1, 'arch', 'side', reach(b, 1.1, 0.3), 'catkin', { rate: 1.2, ph: 1.1 });
    S.toes(0.32, 1.6, Infinity); S.expr('laughHard', 0.9); laughAll(true);
    shot.soles({ pitch: 0.5, dist: 1.2, fov: 32, turn: 1.05 }); post.setCloseUp('on');      // (from beside her feet)
    await S.wait(0.6); await S.mark('tickle3');
    await S.say('a2', 18, 'PUT YOUR NASTY LEAVES AWAY FROM ME, YOU CREEPS!!\nAHAHAHAHA!!', { expr: 'laughHard', blush: 0.9 });
    await S.wait(1.4); shot.side({ pitch: 0.2 }); await S.wait(1.6); shot.face({ dist: 1.3 }); await S.mark('face3'); await S.wait(1.4); shot.soles({ pitch: 0.5, turn: -1.05, dist: 1.2, fov: 32 }); await S.mark('soles3'); await S.wait(1.4);
    post.setCloseUp('off'); shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 });
    const free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: o.gameOver ? (chainNext() ? 'before they tie you up' : 'Last chance') : 'Try 3 / 3', width: o.gameOver ? 0.17 : 0.26, speed: 0.8 });
    if (free) return true;
    await ivySay(h0, 'grin', 'True! True!! We shall teach your pretty ticklish feet a lesson!');
    await ivySay(st.list[1] || h0, 'open', 'WE ARE JUST ABOUT TO BEGIN!!!');
    // the camera pulls back and up, on the bearing it already has (a clear one), while they all close in
    { const g = S.cam.gPos, l = S.cam.gLook; S.cam.at(V3().lerpVectors(st.seat, mid, 0.55), Math.atan2(g.x - l.x, g.z - l.z), { y: 0.55, pitch: 0.46, dist: 6.2, rate: 0.9, near: 1.2, see: [C.headPos(), mid.clone()] }); }
    for (const m of st.list) m.lean(1.2);
    await S.say('a2', 18, 'N-NO MORE!! AHAHAHAHAHAHA!!', { expr: 'laughHard', blush: 1.0 });
    await S.mark('away');
    await S.wait(0.8);
    return false;
  }

  // captured by Ivy Maidens. rec.group: who caught her; o.seat: where she stood; o.lashed: the lash has already taken
  // her shoes and hat; o.gameOver: the lost fight at the lane (round 3 only, and a miss is final)
  async function ivy(rec, o = {}) {
    const seat = (o.seat || anne.position).clone(), c = V3(); for (const m of rec.group) c.add(m.obj.position); c.multiplyScalar(1 / rec.group.length);
    const yaw = Math.atan2(c.x - seat.x, c.z - seat.z), temp = st && st.temp;
    await S.fade(1, 0.35);
    if (temp) st = null;
    begin(seat, yaw, rec.group.slice());
    let free = false;
    const rounds = o.gameOver ? [round3] : [round1, round2, round3];
    for (const r of rounds) { free = await r({ bare: !!o.lashed, gameOver: !!o.gameOver, intro: o.intro }); if (free) break; }
    if (free) {                                      // the hit that frees her
      sparks.burst(mid.clone(), GOLD, 30, 2.2, 1.0); for (const m of st.list) { m.shake(1.2); m.lean(-0.6); }
      S.expr('angry'); S.toast(ANGRY, 'dialog', 2.4); await S.wait(0.5);
    }
    await S.fade(1, 0.3);
    const list = st.list; end();
    for (const m of sisters) m.hideNow();
    return { free, list };
  }

  // =====================================================================================================
  //                                                  Myconids
  // =====================================================================================================
  // (the lady's children: makeMyconid's three, plus two more for the crowd)
  async function mycSay(lady, idx, text) { st.speaker = null; await S.say('myc', idx, text, { name: idx ? 'Myconid child' : 'Myconid' }); }
  const kidSpot = V3(), kn = V3();
  // a child rubbing its cap on her toes: it stands on the ground in front of a sole and bobs against it
  function kidAtSole(g, f, k, t, u = 1.15, off = 0) {
    along(f, u, kidSpot).addScaledVector(f.side, off);
    kn.copy(f.n).setY(0); if (kn.lengthSq() < 0.05) kn.set(st.out.x, 0, st.out.z); kn.normalize();
    const reachOut = 0.165 + 0.02 * Math.sin(t * 9 + k);
    g.position.set(kidSpot.x + kn.x * reachOut, Math.max(0, kidSpot.y - 0.27) + 0.02 * Math.abs(Math.sin(t * 9 + k)), kidSpot.z + kn.z * reachOut);
    g.rotation.set(0, Math.atan2(-kn.x, -kn.z), 0); g.rotation.x = 0.3 + 0.12 * Math.sin(t * 9 + k); g.userData.held = true;
  }
  // a child bouncing on a sole that faces the sky
  function kidOnSole(g, f, k, t, u = 0.5) {
    along(f, u, kidSpot); const b = Math.abs(Math.sin(t * 5.5 + k * 1.7));
    g.position.copy(kidSpot).addScaledVector(f.n, 0.012 + 0.16 * b); g.rotation.set(0, t * 1.5 + k, 0); g.userData.held = true;
  }
  let kidsDo = null;                                 // what the children are doing this frame
  S.late.push((dt, t) => { if (st && kidsDo) kidsDo(dt, t); });

  // Round 1 is the 2D game's CAPTURE1 (sheet anne-myconid-1, its first two rows): the lady stands behind her and has her
  // round the waist and under one thigh; a second lady comes up in front, takes the leg held out to her by the ankle and
  // licks its sole. A lady's own arms are short and still, so while she holds Anne they are hidden and these are drawn:
  // a tube from each shoulder to a hand that lies ON Anne (a set distance off her, on the outside of what it holds).
  const lady2 = K.makeMyconid(977, 'red'); lady2.patch.visible = false; lady2.obj.visible = false; scene.add(lady2.obj); S.actors.push(lady2);
  const handGeo = K.ball(0.031, MY.skin, 0.85, 1.1, 0.75, 10);
  const armsFor = (who) => who.cArms || (who.cArms = [-1, 1].map((sx) => { const hand = new THREE.Mesh(handGeo, K.MAT.plant); hand.castShadow = true; hand.visible = false; scene.add(hand); return { sx, tube: makeVine(MY.skin, MY.skin2, 16, 8), hand, sh: V3(), to: V3(), p1: V3(), p2: V3() }; }));
  const HOLD = { on: false, lady: null, lady2: null, lick: 0 };
  const spineB = bone('spine03') || bone('spine04'), aF = V3(), aR = V3(), waist = V3(), thigh = V3(), _m1 = V3(), _m2 = V3();
  const ownArms = (who, show) => { if (who.arms) for (const a of who.arms) a.visible = show; };
  function drawArm(who, a, s) {                        // s: how thick (her own scale)
    who.body.localToWorld(a.sh.set(a.sx * 0.15, 0.83, 0));
    a.tube.draw(a.sh, a.p1, a.p2, a.to, UP, 0.04 * s, 0.027 * s); a.hand.position.copy(a.to); a.hand.scale.setScalar(s); a.hand.visible = true;
  }
  function updHold(dt, t) {
    if (!HOLD.on) return;
    readLegs();
    aF.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)); aR.set(-aF.z, 0, aF.x);
    if (spineB) spineB.getWorldPosition(waist); else waist.copy(anne.position).setY(1.08);
    const L = HOLD.lady, A1 = armsFor(L), s = L.body.scale.x;
    // her right hand on the front of Anne's waist (round her right side); her left hand under Anne's raised left thigh
    A1[0].to.copy(waist).addScaledVector(aR, 0.085).addScaledVector(aF, 0.128); A1[0].to.y -= 0.02;
    L.body.localToWorld(_m1.set(-0.15, 0.83, 0)); A1[0].p1.copy(_m1).addScaledVector(aR, 0.2).addScaledVector(aF, 0.16); A1[0].p2.copy(A1[0].to).addScaledVector(aR, 0.16).addScaledVector(aF, -0.03);
    thigh.lerpVectors(hipW[1], kneeW[1], 0.56); A1[1].to.copy(thigh); A1[1].to.y -= 0.115;
    L.body.localToWorld(_m1.set(0.15, 0.83, 0)); A1[1].p1.copy(_m1).addScaledVector(aR, -0.24).addScaledVector(aF, 0.12); A1[1].p1.y -= 0.12; A1[1].p2.copy(A1[1].to).addScaledVector(aR, -0.16); A1[1].p2.y -= 0.06;
    for (const a of A1) drawArm(L, a, s);
    const M = HOLD.lady2;
    if (M && M.obj.visible) {
      const A2 = armsFor(M), s2 = M.body.scale.x;
      // her hands at each side of the ankle held out to her (the shin is 26 mm across there: the hands' middles stand 58 mm off its line)
      _m1.lerpVectors(ankW[1], kneeW[1], 0.1);
      A2.forEach((a) => { a.to.copy(_m1).addScaledVector(aR, a.sx * -0.058); a.to.y -= 0.012; M.body.localToWorld(_m2.set(a.sx * 0.15, 0.83, 0)); a.p1.lerpVectors(_m2, a.to, 0.4).addScaledVector(aR, a.sx * -0.1); a.p1.y -= 0.1; a.p2.copy(a.to).addScaledVector(aF, 0.12).addScaledVector(aR, a.sx * -0.05); a.p2.y -= 0.03; drawArm(M, a, s2); });
      HOLD.lick = damp(HOLD.lick, HOLD.licking ? 1 : 0, 4, dt);
      M.tongue = M.tongue || makeTongue('#8a4fa8');
      M.head.getWorldPosition(_m1); M.head.getWorldQuaternion(_hq); _m1.add(_hm.set(0, -0.05, 0.125).applyQuaternion(_hq));      // her mouth
      if (HOLD.licking) {                              // ...comes right up to the sole held out to her: she slides, sinks into the ground or draws herself up as it takes
        const ey = mouthTo(M.obj, _m1, soleSpot(feet[1], 0.55, 0, 0.05, _m2), dt, -0.7, 0);
        if (ey > 0.004 && M.obj.position.y >= 0) { M._size = Math.min(1.4, (M._size || 1) + ey * 4 * dt); M.size(M._size); }
      }
      if (HOLD.lick > 0.03) lick(M.tongue, _m1, feet[1], dt, HOLD.lick, 1.3, 0.017, 0.0055); else M.tongue.hide();
    }
  }
  S.late.push((dt, t) => { if (st) updHold(dt, t); });
  function endHold() {
    for (const who of [HOLD.lady, HOLD.lady2, lady2]) { if (!who) continue; if (who.cArms) for (const a of who.cArms) { a.tube.hide(); a.hand.visible = false; } ownArms(who, true); if (who.tongue) who.tongue.hide(); }
    HOLD.on = false; HOLD.lady2 = null; HOLD.licking = false; HOLD.lick = 0; lady2._size = 1; lady2.size(1); lady2.upNow(0); lady2.obj.visible = false;
  }
  // the sheet's view: from her left, level with her waist; and close on one foot from that side
  const shotM = (o = {}) => { cc.copy(st.seat).addScaledVector(st.out, o.x === undefined ? 0.4 : o.x); cc.y = 0.95; side2d(cc, { dist: o.dist || 4.0, fov: o.fov || 38, see: [C.headPos(), feet[1].arch.clone(), V3().copy(st.seat).addScaledVector(st.out, 1.15).setY(1.1), V3().copy(st.seat).addScaledVector(st.out, -0.4).setY(1.2)] }); };      // (both ladies in the picture)
  // her face, from the side the scene is seen from and from above the two caps (one lady stands before her, the other holds her from behind)
  const shotMFace = () => { const h = C.headPos(), f = C.headFwd().setY(0).normalize(); cq.copy(h).addScaledVector(far, -1.05).addScaledVector(f, 0.5); cq.y += 0.4; cc.copy(h); cc.y -= 0.03; S.cam.set(cq, cc, { fov: 34, cut: true, focus: h.clone(), focusK: 1.5 }); };
  const shotMFoot = (j, o = {}) => { const f = feet[j]; fp.copy(f.sArch); cq.copy(fp).addScaledVector(f.sn, o.n === undefined ? 0.32 : o.n).addScaledVector(far, -0.72); cq.y += 0.1; cc.copy(fp).addScaledVector(f.sn, 0.1); S.cam.set(cq, cc, { fov: 32, cut: true }); post.setCloseUp('off'); };

  async function myconid(rec, o = {}) {
    const lady = rec.m, kids = lady.minis, seat = (o.seat || anne.position).clone();
    const yaw = Math.atan2(lady.obj.position.x - seat.x, lady.obj.position.z - seat.z);
    await S.fade(1, 0.35);
    begin(seat, yaw, [lady]); st.speaker = null;
    const world = (g) => { if (g.parent !== scene) { scene.add(g); g.userData.home = lady.obj; } g.visible = true; g.scale.setScalar(g.userData.s0 || 0.9); };
    const home = () => { for (const g of kids) { if (g.userData.home) { lady.obj.add(g); g.userData.home = null; } g.userData.held = false; g.rotation.x = 0; g.visible = false; } lady.kids(false); kidsDo = null; endHold(); lady.size(1); lady.patch.visible = true; };
    let free = false;
    try {
      // ---------- 1: the 2D game's CAPTURE1. Tease (the sheet's first row): the lady has her from behind, on the toes of
      // one foot, her other leg drawn up; a child jumps at that foot while two more make off with her sandals.
      A.setHeelsWorn(false); await pose(has('MycHeld') ? 'MycHeld' : 'SitFlat');
      shotM();                                         // (settles the picture's side)
      // (the lady: a head taller than Anne and a step behind her, a little to the far side (her hair must not hang before Anne),
      //  so that her cap stands over Anne's head, as in the sheet; at her own size Anne's head sank into the cap)
      lady.patch.visible = false; lady.size(1.3); lady.obj.position.copy(st.seat).addScaledVector(st.out, -0.52).addScaledVector(far, 0.1); lady.obj.rotation.y = st.yaw; lady.upNow(1); ownArms(lady, false);
      // her hat is off (as in the sheet): it lies in the grass beyond her
      hat.obj.visible = true; if (A.setHat) A.setHat(false); hatS.t = -1; hatS.on = (out) => out.copy(st.seat).addScaledVector(far, 1.0).addScaledVector(st.out, 0.55).setY(0.0);
      HOLD.on = true; HOLD.lady = lady; HOLD.lady2 = null; HOLD.licking = false;
      for (const g of kids) world(g);
      if (lady.kids) lady.kids(true);                  // (10-03: out of her patch and visible, as bound() has them)
      loose.forEach((s, i) => { s.g.visible = true; s.t = -1; s.carry = null; s.lie = 'up'; s.lickYaw = undefined; s.rest.y = st.yaw + (i ? 2.4 : -2.0); const p = V3().copy(st.seat).addScaledVector(st.out, 1.05 + 0.25 * i).addScaledVector(far, i ? 0.95 : -0.55).setY(0); s.to = (out) => out.copy(p); if (kids[i + 1]) kids[i + 1].position.copy(p).addScaledVector(far, i ? 0.14 : -0.14); s.lick = kidLicker(kids[i + 1]); });      // (10-03: two of her children lick the soles of her shoes, instead of riding off with them)
      kidsDo = (dt, t) => {
        kidAtSole(kids[0], feet[HOLD.lady2 ? 0 : 1], 0, t, 1.12, 0.01 * Math.sin(t * 3));      // at the foot that hangs free
        // (kids 1 and 2 are at her shoes: kidLicker)
      };
      S.expr('shocked', 0.4);
      await S.wait(0.25); await S.fade(0, 0.4);
      await S.mark('myc1');
      await S.say('a2', 5, 'No, no no nononono!!\n\n    Leave my shoes alone!!', { expr: 'shocked', blush: 0.3 });
      await mycSay(lady, 1, 'Pie uo Tick!');
      if (C.lookSay) await mycSay(lady, 2, C.lookSay('myc').feet);      // (batch 22: even they have a word for her feet)
      S.expr('laughHard', 0.6); shotMFoot(1, { n: 0.5 });
      await mycSay(lady, 2, 'Tick Tick Tick!');
      // Tickle (the second row): another lady comes up before her, takes the leg by its ankle and licks the sole
      shotM(); lady2.obj.position.copy(st.seat).addScaledVector(st.out, 1.14); lady2.faceTo(st.seat.x, st.seat.z); lady2.upNow(0); lady2.obj.visible = true; lady2.rise(0.82); ownArms(lady2, false);
      sparks.burst(V3(lady2.obj.position.x, 0.3, lady2.obj.position.z), SPORE, 18, 1.2, 0.8);
      await S.wait(0.8);
      if (has('MycHeldOut')) S.clip('MycHeldOut', 0.35);
      await S.wait(0.5); HOLD.lady2 = lady2; HOLD.licking = true; S.expr('laughHard', 0.85);
      await S.mark('myc1b');
      await S.say('a2', 14, 'AHAHA!! T-that tickles!! STAY AWAY FROM ME I SAID!!', { expr: 'laughHard', blush: 0.85 });
      await S.wait(0.6); shotMFoot(1); await S.wait(2.2); shotM(); await S.wait(1.4); shotMFace(); await S.mark('mface'); await S.wait(1.2); shotMFoot(0, { n: 0.45 }); await S.wait(1.5);
      shotM();
      free = await S.gauge({ label: 'Shake them off! Press SPACE in the green!', sub: 'Try 1 / 3', width: 0.22, speed: 0.8 });
      endHold(); lady.size(1); lady.patch.visible = false;
      if (!free) {
        // ---------- 2: giggle spores: doubled up on her knees while they bounce on her soles
        S.emote(anne, 'sweat', 0.8, -0.7);
        await S.say('a2', 5, 'OH NO!!', { expr: 'shocked' });
        lady.hop(); sparks.burst(V3(lady.obj.position.x, 1.2, lady.obj.position.z), SPORE, 40, 1.6, 0.6); sparks.burst(C.headPos(), SPORE, 30, 0.8, 0.4);
        await S.fade(1, 0.3); S.toes(0);
        await pose('LaughFit');
        for (const s of loose) { if (s.lick) { s.lick.tongue.hide(); if (s.lick.kid) { s.lick.kid.rotation.x = 0; s.lick.kid.userData.held = false; } } s.lick = null; s.lickYaw = undefined; }      // (10-03: the children leave her shoes for her soles)
        lady.obj.position.set(st.seat.x + st.out.x * 2.2, 0, st.seat.z + st.out.z * 2.2); lady.faceTo(st.seat.x, st.seat.z);
        kidsDo = (dt, t) => { kidOnSole(kids[0], feet[0], 0, t, 0.45); kidOnSole(kids[1], feet[1], 1, t, 0.45); const a = t * 1.3; kids[2].position.set(st.seat.x + Math.cos(a) * 0.95, 0.07 * Math.abs(Math.sin(t * 9)), st.seat.z + Math.sin(a) * 0.95); kids[2].rotation.set(0, -a, 0); kids[2].userData.held = true; };
        loose.forEach((s, i) => { s.to = (out) => out.set(lady.obj.position.x + (i ? 0.45 : -0.45), 0.05, lady.obj.position.z + 0.2); s.rest.set(1.45, i ? 0.8 : -0.5, 0.2); });
        sideOn(st.seat, st.yaw, -PI * 0.5, { y: 0.6, pitch: 0.16, dist: 3.3, cut: true, through: true }); S.expr('laughHard', 0.9);
        await S.wait(0.25); await S.fade(0, 0.4);
        await S.mark('myc2');
        await S.say('a2', 14, 'Ahahaha-- w-what is in those spores?!\nHahahaha!!', { expr: 'laughHard', blush: 0.6 });
        await S.say('am', 4, 'Giggle spores. A classic.'); C.am.hide();
        S.toes(0.3, 1.6, Infinity); shot.soles({ pitch: 0.5, dist: 1.15, fov: 32 }); post.setCloseUp('on');
        await mycSay(lady, 2, 'Tick Tick Tick!');
        await S.say('a2', 18, 'G-GET OFF MY FEET, YOU LITTLE TOADSTOOLS!! HAHAHA!!', { expr: 'laughHard', blush: 0.9 });
        await S.wait(1.6); shot.side({ pitch: 0.2 }); await S.wait(1.5);
        post.setCloseUp('off'); sideOn(st.seat, st.yaw, -PI * 0.5, { y: 0.6, pitch: 0.16, dist: 3.3, cut: true, through: true });
        free = await S.gauge({ label: 'Shake them off! Press SPACE in the green!', sub: 'Try 2 / 3', width: 0.24, speed: 0.8 });
      }
      if (!free) {
        // ---------- 3: the fairy ring: on her front, her ankles tied with soft white threads; the lady dusts her soles herself
        await S.say('a2', 5, 'OH NO, NOT AGAIN!!', { expr: 'shocked' });
        await S.fade(1, 0.3); S.toes(0);
        await pose('HeldProne', st.yaw + PI);
        lady.obj.position.set(mid.x + nH.x * 0.25 + sideH.x * 0.85, 0, mid.z + nH.z * 0.25 + sideH.z * 0.85); lady.faceTo(mid.x, mid.z);
        coils(hyphae, true, null);
        kidsDo = (dt, t) => { for (let i = 0; i < 3; i++) { const a = t * 1.2 + i * TAU / 3, R = 1.25; kids[i].position.set(mid.x + Math.cos(a) * R, 0.09 * Math.abs(Math.sin(t * 8 + i)), mid.z + Math.sin(a) * R); kids[i].rotation.set(0, -a, 0); kids[i].userData.held = true; } };
        const hand = (h, k) => (out) => out.copy(lady.obj.position).setY(h).lerp(mid, k);
        tick(0, 0, 'stroke', 'toes', hand(1.05, 0.35), 'spore', { clear: 0.022, rate: 1.1 }); tick(1, 1, 'stroke', 'toes', hand(1.1, 0.3), 'spore', { clear: 0.022, rate: 1.2, ph: 2.1 });
        for (const T of [ticklers[0], ticklers[1]]) T.vine.mesh.visible = false;
        shot.wide({ sgn: -1 }); S.expr('laughHard', 0.9); S.toes(0.32, 1.6, Infinity);
        await S.wait(0.25); await S.fade(0, 0.4);
        await S.mark('myc3');
        shot.soles({ pitch: 0.62, dist: 1.2, fov: 32 }); post.setCloseUp('on');
        await S.say('a2', 18, 'HAHAHAHAHAHAHAHAHAHAHAHAAAAA!!', { expr: 'laughHard', blush: 0.95 });
        await mycSay(lady, 2, 'Pause?');
        await S.say('a2', 4, 'ENOUGH OF THIS!!!', { expr: 'angry', blush: 0.6 });
        await S.wait(0.8); shot.side({ pitch: 0.2 }); await S.wait(1.3);
        post.setCloseUp('off'); shot.wide();
        free = await S.gauge({ label: 'Break the ring! Press SPACE in the green!', sub: 'Try 3 / 3', width: 0.26, speed: 0.8 });
      }
      if (free) { sparks.burst(mid.clone(), GOLD, 30, 2.2, 1.0); lady.hop(); S.expr('angry'); S.toast("You'll regret it, you overgrown toadstool!|Oh, thank the gods...|STAY AWAY FROM ME, I SAID!!", 'dialog', 2.4); await S.wait(0.5); }
      await S.fade(1, 0.3);
    } finally { home(); }
    end();
    return { free };
  }


  // =====================================================================================================
  //                                                  Alraune
  // =====================================================================================================
  // The 2D game's CAPTURE1 of SceneAlraune (sheet alraune-capture-11: intro, idle, tease1..3, tease8, tease6, tickle1):
  // her vines lift Anne off the ground and hold her level in the air before the great flower, her feet towards
  // Alraune; her hat and her sandals fall. Alraune looks her feet over, tickles them with her fingers, kisses and licks
  // them, then tickles in earnest. One gauge ("KICK HER OFF!!!"). Seen from Anne's left, as the sheet draws it: Alraune
  // in her flower at the left of the picture, Anne's head at the right. Her lines are the 2D game's (its insults toned down).
  //   o: { fig (alraune.js), al (expr / clip of story_forest.js), bloom, at (where the flower stands), yaw (the way it faces), maidens }
  const AL = { on: false, o: null, k: 0, tongue: null, licking: false, lk: 0, foot: 0, hands: false, hold: V3(), holdTo: V3(), vines: null, coil: null };
  const _al1 = V3(), _al2 = V3(), _al3 = V3(), _al4 = V3();
  const alFinger = (j, ph) => (p, d, n) => {             // fingertips on a sole: they wander over the arch and the ball, 3 mm of air under them
    const f = feet[j], t = S.time();
    along(f, 0.5 + 0.34 * Math.sin(t * 2.3 + ph), p).addScaledVector(f.side, 0.014 * Math.sin(t * 3.7 + ph * 2)).addScaledVector(f.n, 0.008 + 0.004 * (0.5 + 0.5 * Math.sin(t * 13 + ph)));
    d.copy(f.n).multiplyScalar(-0.78).addScaledVector(f.fwd, 0.5).normalize(); n.copy(f.fwd).negate();
  };
  const alHeel = (j) => (p, d, n) => { const f = feet[j]; along(f, 0.1, p).addScaledVector(f.side, (j ? -1 : 1) * 0.02).addScaledVector(f.n, 0.009); d.copy(f.n).multiplyScalar(-0.7).addScaledVector(f.fwd, 0.6).normalize(); n.copy(f.fwd).negate(); };      // fingertips resting under a heel
  function updAlraune(dt, t) {
    if (!AL.on) return;
    const o = AL.o; readLegs();
    anne.position.lerp(AL.holdTo, 1 - Math.exp(-dt * 2.5));
    if (AL.coil) AL.coil.draw(1);
    // the vines that carry her: up from the ground round the flower to her shoulders, her waist and her legs
    if (AL.vines) {
      const pts = [[bone('spine01'), 0.075], [bone('spine04') || bone('spine03'), 0.085], [null, 0.09], [null, 0.06]];
      AL.vines.forEach((v, i) => {
        if (i < 2 && pts[i][0]) pts[i][0].getWorldPosition(_al1); else if (i === 2) _al1.lerpVectors(hipW[0], kneeW[0], 0.5).lerp(_al2.lerpVectors(hipW[1], kneeW[1], 0.5), 0.5); else _al1.lerpVectors(kneeW[0], ankW[0], 0.45).lerp(_al2.lerpVectors(kneeW[1], ankW[1], 0.45), 0.5);
        _al1.y -= pts[i][1] + 0.03;                    // just under her (she lies on them: they stop short of her)
        _al2.copy(v.root); _al3.copy(v.root); _al3.y = _al1.y * 0.55; _al3.lerp(_al1, 0.15); _al4.copy(_al1); _al4.y -= 0.22; _al4.lerp(v.root, 0.12);
        v.vine.draw(_al2, _al3, _al4, _al1, UP, 0.05, 0.03);
      });
    }
    // her tongue: one sole, then the other
    AL.lk = damp(AL.lk, AL.licking ? 1 : 0, 4, dt);
    if (AL.licking) {                                  // her vines bring Anne's soles up to her mouth (a short tongue: the feet come to it)
      o.fig.mouthPos(_al1); soleSpot(feet[0], 0.55, 0, 0.09, _al2).add(soleSpot(feet[1], 0.55, 0, 0.09, _al3)).multiplyScalar(0.5);
      AL.holdTo.addScaledVector(_al2.subVectors(_al1, _al2), Math.min(1, dt * 1.6));
    }
    if (AL.lk > 0.03 && AL.tongue) { const before = AL.tongue.ph; lick(AL.tongue, o.fig.mouthPos(_al1), feet[AL.foot], dt, AL.lk, 1.5, 0.017, 0.0055, 0.125); if (AL.tongue.ph < before) AL.foot = 1 - AL.foot; } else if (AL.tongue) AL.tongue.hide();
  }
  S.late.push((dt, t) => { if (st) updAlraune(dt, t); });
  function endAlraune() {
    if (!AL.on) return; const o = AL.o;
    AL.on = false; AL.licking = false; if (AL.tongue) AL.tongue.hide(); if (AL.coil) AL.coil.hide(); if (AL.vines) for (const v of AL.vines) v.vine.hide();
    if (o && o.fig && o.fig.reach) { o.fig.reach('L', null); o.fig.reach('R', null); }
    anne.position.y = 0;
  }
  async function alraune(o) {
    const { fig, al, bloom } = o, alSay = (i, text) => S.say('al', i, text);
    await S.fade(1, 0.35);
    // the stage: the flower before her, Anne on her back in the air, her feet at Alraune's hands
    bloom.obj.position.copy(o.at); bloom.obj.rotation.y = o.yaw; bloom.showNow();
    const dir = V3(Math.sin(o.yaw), 0, Math.cos(o.yaw)), seat = V3().copy(o.at).addScaledVector(dir, 1.52);
    begin(seat, o.yaw + PI, []); st.speaker = null; flat.r = 2.6;
    AL.on = true; AL.o = o; AL.licking = false; AL.lk = 0; AL.foot = 0;
    AL.tongue = AL.tongue || makeTongue('#c2456d'); AL.coil = AL.coil || makeSpiral(5.5, IV.v0, IV.v2, 0.014, null, 0.1, 0.9);
    AL.vines = AL.vines || [0, 1, 2, 3].map(() => ({ vine: makeVine(IV.v0, IV.v2, 20, 8), root: V3() }));
    A.setHeelsWorn(false); if (A.setHat) A.setHat(false);
    S.place(seat, o.yaw + PI); S.clip(has('AlrHeld') ? 'AlrHeld' : 'HeldBack', 0);
    fig.shoulderPos('L', _al1); const H = _al1.y - 0.36;         // her soles come level with Alraune's chest
    AL.hold.copy(seat).setY(H); AL.holdTo.copy(AL.hold); anne.position.copy(AL.hold);
    C.snapSoles(); await S.frame(); await S.frame(); C.snapSoles(); await S.frame(); soleFrame(); flat.p.lerpVectors(seat, o.at, 0.5).setY(0);
    far.set(-st.out.z, 0, st.out.x);
    AL.vines.forEach((v, i) => { v.root.copy(o.at).addScaledVector(dir, 0.75 + 0.1 * i).addScaledVector(far, (i % 2 ? 1 : -1) * (0.55 + 0.1 * i)).setY(0.02); });
    // her hat and her sandals lie where they fell
    hat.obj.visible = true; hatS.t = -1; const hatAt = V3().copy(seat).addScaledVector(dir, -0.9).addScaledVector(far, -0.55).setY(0.02); hatS.on = (out) => out.copy(hatAt);
    loose.forEach((s, i) => { const p = V3().copy(seat).addScaledVector(dir, 0.35 + 0.3 * i).addScaledVector(far, -0.75 + 0.25 * i).setY(0.05); s.rest.set(2.0, i ? 0.6 : -0.6, 0); s.to = (out) => out.copy(p); s.carry = null; s.t = -1; s.g.visible = true; });
    for (const m of (o.maidens || [])) { m.hideNow(); }
    const mid2 = V3().lerpVectors(o.at, seat, 0.5);
    const wide = (q = {}) => { cc.copy(mid2).setY(H + 0.05); side2d(cc, Object.assign({ dist: 4.3, fov: 38, see: [C.headPos(), fig.headPos(V3()), feet[0].arch.clone()] }, q)); };
    // close on her soles: from the picture's side, a little towards Alraune (her soles face her) and above her reaching arm
    const closeFeet = (q = {}) => { soleFrame(); cq.copy(mid).addScaledVector(nH, q.n ?? -0.22).addScaledVector(far, q.d ?? -0.66); cq.y = mid.y + (q.up ?? 0.12);      // (beside her ankles, looking past her soles to Alraune: her mane stays out of the way)
      cc.copy(mid).addScaledVector(nH, 0.05); S.cam.set(cq, cc, { fov: q.fov || 36, cut: true }); post.setCloseUp('off'); };
    const herFace = () => { fig.headPos(cc); cq.copy(cc).addScaledVector(dir, 1.5).addScaledVector(far, -0.9); cq.y = cc.y + 0.05; S.cam.set(cq, cc, { fov: 34, cut: true }); post.setCloseUp('off'); };
    let free = false;
    try {
      if (al) { al.expr('smile'); al.clip('Idle', 0); }
      wide(); S.expr('shocked', 0.3);
      await S.wait(0.3); await S.fade(0, 0.5);
      await S.mark('alcap');
      await alSay(1, "Lovely!\nI never miss a chance to play\nwith my catch for a while...");
      herFace(); if (al) al.expr('happy');
      await alSay(1, 'How cute!!');
      if (C.lookRemarks) for (const t of C.lookRemarks('al', 2)) await alSay(1, t);      // (batch 22: what she makes of her: her feet in her shoes, what she is or wears)
      await alSay(0, "Now I definitely see why you are one of\nLilith's favourites!");
      wide(); if (al) { al.expr('smug'); al.clip('Lean', 0); }
      await alSay(3, 'Let me see those feet closer...');
      closeFeet(); S.toes(0.1, 1.2); S.expr('worried', 0.5);
      await alSay(2, 'Such a little cutie! Look at those ' + (C.soleTint ? C.soleTint() : 'pink') + ' soles!!!\nThey look so smooth...\n ... so sensitive...');      // (batch 22: by her skin's tone)
      await alSay(8, 'I love watching your feetsies wiggle!');
      S.toes(0);
      await alSay(2, 'I wonder if you mind I play a little with them...');
      shot.face(); await S.say('a2', 11, "DON'T YOU DARE!!!!", { expr: 'angry', blush: 0.4 });
      // tease1, tease2: her fingers on both soles
      fig.reach('L', alFinger(0, 0)); fig.reach('R', alFinger(1, 1.9)); AL.hands = true;
      if (has('AlrHeldTickled')) S.clip('AlrHeldTickled', 0.3); S.expr('laugh', 0.6);
      wide(); await S.wait(0.8); await S.mark('altease');
      await alSay(2, "Don't be so shy!\nI bet you love a little attention\nfor your delicate bare feet!!!");
      closeFeet(); await S.say('a2', 11, "Don't you dare, you overgrown weed!!!\nGet your nasty claws away from me!", { expr: 'laugh', blush: 0.6 });
      await S.mark('alfeet');
      await S.say('a2', 13, "HEY!! What's happening down there?", { expr: 'laugh', blush: 0.7 });
      herFace(); if (al) al.expr('happy');
      await alSay(8, "OHHHH... does it tickle?\nYou'll see... I've got lots of surprises\nfor you down here...");
      shot.face(); await S.say('a2', 43, "I don't like surprises, ma'am!!", { expr: 'worried', blush: 0.5 });
      // tease3, tease8: she draws the feet up to her face; kisses, and her tongue
      wide(); await alSay(2, "You'll like these, honey!\nWe've got all day to get to know\neach other.");
      // (she bends to them; her hands keep hold of the heels; her vines bring the soles up to her mouth, see updAlraune)
      fig.reach('L', alHeel(0)); fig.reach('R', alHeel(1));
      await alSay(3, "Now... let's get your tasty pair of\nslender feet ready...");
      AL.licking = true; S.expr('laughHard', 0.8);
      await S.wait(1.5); closeFeet({ d: -0.78, up: 0.1, n: 0.02 });      // (once her feet are at Alraune's mouth: seen from the side, the tongue on the sole)
      await S.wait(0.6); await S.mark('alkiss');
      await S.say('a2', 42, "Who...\nwho's kissing my foot down there??!!", { expr: 'shocked', blush: 0.7 });
      await S.say('a2', 15, 'OH-MY-GOSH!!!\nNO!!! STOPP!!!', { expr: 'laughHard', blush: 0.85 });
      wide(); if (al) al.expr('happy');
      await alSay(3, "Are you in a hurry, darling?\nI hope not!\nI could stay forever cuddling those exquisite\nsoles of yours!");
      closeFeet({ d: -0.62, up: 0.24, n: -0.12 }); await alSay(2, 'And those irresistible toes...');
      if (C.lookLines) { const L = C.lookLines('alNest'); if (L.lv > 0) await alSay(10, L.nail.replace(/ I've thought of nothing else\nsince the forest!/, '\nI could look at them all day!')); }      // (10-03: and their colour)
      await alSay(0, 'Fleshy, fleshy heels...');
      // tease6, tickle1: in earnest
      wide(); if (al) al.expr('laugh');
      await alSay(8, "OOPS!!\nSomeone's got ticklish feet here!");
      AL.licking = false; AL.holdTo.copy(AL.hold); fig.reach('L', alFinger(0, 0.4)); fig.reach('R', alFinger(1, 2.6)); S.expr('laughHard', 0.95);
      await alSay(9, 'hi hi hi hi hi hi...\nShall we get started?');
      closeFeet(); await S.wait(0.5); await S.mark('altickle');
      await alSay(3, 'COOOOCHIE COOOCHIE KOOOOOO!!\nKEEP THOSE LOVELY FEET DANCING FOR ME,\nHONEY!!!');
      await S.say('a2', 18, 'HAHAHAHAHA!! S-STOP IT!! AHAHAHAHA!!', { expr: 'laughHard', blush: 0.95 });
      wide(); await S.wait(1.6); shot.face(); await S.wait(1.3); closeFeet({ d: -0.8, up: 0.2, n: -0.3 }); await S.wait(1.6); wide();
      await alSay(0, "I could spend days like this!!!!!\nI hope you're having as much fun as I am,\ndarling!!!");
      S.toast('KICK HER OFF!!!', 'warning', 1.6);
      free = await S.gauge({ label: 'Kick her off! Press SPACE in the green!', sub: chainNext() ? 'before she ties you up' : 'Last chance', width: 0.17, speed: 0.85 });
      if (free) {
        fig.reach('L', null); fig.reach('R', null); if (al) { al.expr('surprised'); al.clip('Rise', 0); }
        sparks.burst(mid.clone(), GOLD, 30, 2.2, 1.0); S.expr('angry', 0.4);
        await S.say('a2', 4, 'LET ME ALONE, YOU WEED!!!', { expr: 'angry', blush: 0.5 });
        herFace(); await alSay(7, 'OOOOOWWWW!!!!\nHOW RUDE!!! HOW DARE YOU???');
        await alSay(5, "Come back here!!\nWe've not finished, you little pest!");
      } else {
        if (al) al.expr('laugh');
        await alSay(2, 'I want you all for me...');
        await S.say('a2', 18, 'N-NO MORE!! AHAHAHAHAHAHA!!', { expr: 'laughHard', blush: 1.0 });
        await S.mark('alaway'); await S.wait(0.8);
      }
      await S.fade(1, 0.35);
    } finally { endAlraune(); }
    end();
    return { free };
  }


  // =====================================================================================================
  //                         when she has WON: the 2D game's "worship" sets (pampering)
  // =====================================================================================================
  // Sheet anne-ivymaidens-1, worship1..6 (and dominate-myconid-1, worship1..5): she sits back on her hands at her ease,
  // her legs up, and those she has beaten see to her feet with their tongues until she has had enough. The 2D menu:
  // "Keep going..." / "You can do it better!" / "Enough!!". Dressed, as everywhere here; her sandals stand beside her.
  //   o: { kind: 'ivy', group }  or  { kind: 'myc', lady }
  const pamperCoil = makeSpiral(3.5, IV.v0, IV.v2, 0.011, null, 0.12, 0.7);
  const stool = new THREE.Group(); stool.visible = false; scene.add(stool);
  const STOOL_H = 0.44;
  {                                                    // a broad mushroom to sit on (the Myconids' pampering)
    const cap = new THREE.SphereGeometry(1, 28, 14), P = cap.attributes.position, cc2 = new Float32Array(P.count * 3), r = K.rng(31);
    const dots = Array.from({ length: 9 }, () => [r.r(0, TAU), r.r(0.2, 0.85)]);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) * 0.56, z = P.getZ(i) * 0.56; let y = P.getY(i) * 0.2 + 0.3; y = Math.min(y, STOOL_H - 0.003); if (P.getY(i) < 0) y = 0.3 - 0.04 * -P.getY(i);
      P.setXYZ(i, x, y, z);
      const a = Math.atan2(z, x), d = Math.hypot(x, z) / 0.56; let dot = 0; for (const [da, dd] of dots) dot = Math.max(dot, 1 - Math.hypot(Math.cos(a) * d - Math.cos(da) * dd, Math.sin(a) * d - Math.sin(da) * dd) / 0.11);
      const col2 = mix(P.getY(i) < 0 ? col(0.42, 0.36, 0.28) : col(0.62, 0.16, 0.05), col(0.8, 0.74, 0.6), clamp(dot * 3, 0, 1) * (P.getY(i) < 0 ? 0 : 1)); cc2[i * 3] = col2.r; cc2[i * 3 + 1] = col2.g; cc2[i * 3 + 2] = col2.b;
    }
    cap.setAttribute('color', new THREE.BufferAttribute(cc2, 3)); cap.computeVertexNormals();
    const stem = K.lathe([[0.001, 0], [0.2, 0], [0.17, 0.08], [0.13, 0.2], [0.14, 0.31]], () => MY.skin, 18);
    const m = new THREE.Mesh(K.merge([cap, stem]), K.MAT.plant); m.castShadow = true; m.receiveShadow = true; stool.add(m);
  }
  const PM = { on: false, lady: null, lk: 0, foot: 0, fast: false };
  function updPamper(dt, t) {
    if (!PM.on || !PM.lady) return;
    readLegs(); aF.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)); aR.set(-aF.z, 0, aF.x);
    const L = PM.lady, AR = armsFor(L), s = L.body.scale.x;
    // she holds both ankles from underneath, a hand to each, and licks one sole, then the other
    AR.forEach((a) => { const j = a.sx < 0 ? 1 : 0; _m1.lerpVectors(ankW[j], kneeW[j], 0.1); a.to.copy(_m1).addScaledVector(aR, (j ? -1 : 1) * 0.03); a.to.y -= 0.062;
      L.body.localToWorld(_m2.set(a.sx * 0.15, 0.83, 0)); a.p1.lerpVectors(_m2, a.to, 0.4); a.p1.y -= 0.14; a.p2.copy(a.to).addScaledVector(aF, 0.1); a.p2.y -= 0.08; drawArm(L, a, s); });
    PM.lk = damp(PM.lk, 1, 4, dt); L.tongue = L.tongue || makeTongue('#8a4fa8');
    L.head.getWorldPosition(_m1); L.head.getWorldQuaternion(_hq); _m1.add(_hm.set(0, -0.05, 0.125).applyQuaternion(_hq));
    soleSpot(feet[0], 0.55, 0, 0.055, _m2).add(soleSpot(feet[1], 0.55, 0, 0.055, _hm)).multiplyScalar(0.5); mouthTo(L.obj, _m1, _m2, dt, -0.7, 0.06);      // her mouth between the two soles, close
    const before = L.tongue.ph; lick(L.tongue, _m1, feet[PM.foot], dt, PM.lk, PM.fast ? 0.85 : 1.5, 0.017, 0.0055, 0.115); if (L.tongue.ph < before) PM.foot = 1 - PM.foot;
  }
  S.late.push((dt, t) => { if (st) updPamper(dt, t); });
  async function pamper(o) {
    const myc = o.kind === 'myc', seat = anne.position.clone().setY(0);
    let list = myc ? [o.lady] : o.group.slice();
    const c0 = V3(); for (const m of list) c0.add(m.obj.position); c0.multiplyScalar(1 / list.length);
    const yaw = Math.atan2(c0.x - seat.x, c0.z - seat.z);
    await S.fade(1, 0.35);
    begin(seat, yaw, list); st.speaker = null;
    A.setHeelsWorn(false);
    S.place(seat, yaw); S.clip(has('IvyWorship') ? 'IvyWorship' : 'SitFlat', 0);
    if (myc) { stool.position.copy(seat).addScaledVector(st.out, -0.2); stool.visible = true; anne.position.y = STOOL_H; }
    C.snapSoles(); await S.frame(); await S.frame(); C.snapSoles(); await S.frame(); soleFrame(); flat.p.lerpVectors(st.seat, mid, 0.5).setY(0);
    cc.copy(st.seat).addScaledVector(st.out, 0.35); cc.y = 0.7 + (myc ? 0.35 : 0); side2d(cc, { dist: 3.8, fov: 38, see: [C.headPos(), mid.clone()] });
    // her sandals stand beside her
    loose.forEach((s, i) => { const p = V3().copy(st.seat).addScaledVector(st.out, -0.25 - 0.14 * i).addScaledVector(far, -0.55).setY(0.0); s.rest.set(0, yaw + 0.3 * (i ? 1 : -1), 0); s.to = (out) => out.copy(p); s.carry = null; s.t = -1; s.g.visible = true; });
    try {
      if (myc) {
        const L = o.lady; L.patch.visible = false; L.obj.position.copy(mid).setY(0).addScaledVector(nH, 0.42); L.faceTo(st.seat.x, st.seat.z); L.upNow(0.92); ownArms(L, false);
        PM.on = true; PM.lady = L; PM.lk = 0; PM.foot = 0; PM.fast = false;
      } else {
        if (list.length < 2) { list = list.concat(sisters.filter((m) => !list.includes(m)).slice(0, 2 - list.length)); st.list = list; }
        const [hA, hB] = list; fp.copy(mid); fp.y += 0.02;
        awayA.copy(st.out).multiplyScalar(0.85).addScaledVector(far, 0.5).normalize(); awayB.copy(st.out).multiplyScalar(-0.1).addScaledVector(far, 1).normalize();
        headTo(hA, fp, awayA, 0.34); headTo(hB, fp, awayB, 0.34);
        for (const m of [hA, hB]) { m.showNow(); m.setFace('calm'); m.tongue = m.tongue || makeTongue(m.kind === 'yellow' ? '#c05a9a' : '#e0567a'); m.tk = 0; }
        UP1.on = true; UP1.coil = pamperCoil; UP1.k = UP1.goal = 1; UP1.lick = [hA, hB]; UP1.feet = [0, 1]; UP1.period = 1.6; UP1.licking = true; UP1.by = null;
      }
      // close: from over her soles (the maidens' heads at each side); with the Myconid lady from the side and low, under the brim of her cap
      const close = (sgn = 1) => { soleFrame(); if (myc) { cq.copy(mid).addScaledVector(far, -0.8).addScaledVector(st.out, -0.12 + 0.1 * sgn); cq.y = mid.y - 0.06; } else cq.copy(mid).addScaledVector(feet[0].sn, 0.5).addScaledVector(far, -0.55).addScaledVector(st.out, 0.12 * sgn); S.cam.set(cq, mid, { fov: 34, cut: true }); post.setCloseUp('off'); };
      const wide = () => { cc.copy(st.seat).addScaledVector(st.out, 0.35); cc.y = 0.7 + (myc ? 0.35 : 0); side2d(cc, { dist: 3.8, fov: 38, see: [C.headPos(), mid.clone()] }); };
      S.expr('smug', 0.1);
      await S.wait(0.3); await S.fade(0, 0.45);
      await S.mark('pamper');
      S.toast("You'd better be gentle with these " + (((S.lookWords && S.lookWords()) || {}).soleWord || 'porcelain') + " soles...|Pay respects to your new Mistress!!", 'dialog', 2.6);
      await S.wait(1.6); close(); await S.wait(2.2); await S.mark('pamper2'); wide();
      if (!myc && C.lookLines) { await ivySay(list[0], 'grin', C.lookLines('ivy').tamed); }      // (10-03: tamed, they admire her toenails)
      for (let n = 0; n < 6; n++) {
        const pick = await S.choice(["Keep going...", 'You can do it better!', 'Enough!!']);
        if (pick === 2) break;
        const fast = pick === 1; UP1.period = fast ? 0.9 : 1.6; PM.fast = fast;
        S.expr(fast ? 'laugh' : 'happy', fast ? 0.5 : 0.25); if (fast) S.toast('Hee hee-- THAT is more like it!|Ahaha!! B-better!!', 'dialog', 2.2);
        await S.wait(1.2); close(fast ? -1 : 1); await S.wait(2.4); wide(); await S.wait(0.8); S.expr('smug', 0.15);
      }
      S.toast('Playtime is over! GET LOST!|Enough!! Now get!!', 'dialog', 2.0); await S.wait(0.9);
      await S.fade(1, 0.35);
    } finally {
      PM.on = false; if (PM.lady) { const L = PM.lady; if (L.cArms) for (const a of L.cArms) { a.tube.hide(); a.hand.visible = false; } ownArms(L, true); if (L.tongue) L.tongue.hide(); L.patch.visible = true; L.obj.position.y = 0; PM.lady = null; }
      stool.visible = false; anne.position.y = 0; endLegUp();
    }
    for (const m of sisters) m.hideNow();
    end();
  }

  // what other scenes may borrow (traps.js): call kit.use(true) first and kit.use(false) when done
  // =====================================================================================================
  //   (10-02) TIED UP: the other way any creature can have her (the player's choice: "When caught", key T), after the
  //   log scene. On her front (the log's StuckFlat: legs out, her feet resting on their toes, soles to the sky), her
  //   shoes in the grass beside her, her ankles tied together and her big toes tied together and pegged down (ties.js);
  //   her captors tickle her soles, then lick them as well, then both at once and faster. After each, a "wriggle free"
  //   gauge; three misses and they have had their fun. Framed on her soles and her face (never on her behind).
  //   o: { kind ('ivy' | 'myconid' | 'alraune' | 'vines' | 'fairies' | 'ghosts' | 'thief' | 'pumpkin' | ...), list (who is
  //        there; stood round her feet unless o.keep), seat, yaw, theme (the ties: 'rope' | 'vine' | 'hyphae' | 'silk' | 'mist'),
  //        tools: [[who (index in list, or a root function), foot, mode, from, tool, opts]] (the ticklers),
  //        lick: [creatures that lick, or { mouth(out), toward(mouth, P, dt), tongue }], kids (a Myconid lady whose children
  //        bounce on her soles), say(stage) (their lines: 'open' | 'tickle' | 'lick' | 'fast' | 'won' | 'lost'), onFrame(dt, t) }
  // =====================================================================================================
  const ties = createTies({ THREE, scene, anne, A });
  const BD = { on: false, lick: [], licking: false, period: 1.4, kids: null, o: null };
  const _b1 = V3(), _b2 = V3();
  const mouthAny = (m, out) => { if (m.headPos) return mouthOf(m, out); m.head.getWorldPosition(out); m.head.getWorldQuaternion(_hq); return out.add(_hm.set(0, -0.05, 0.125).applyQuaternion(_hq)); };
  function updBound(dt, t) {
    ties.update();
    BD.lick.forEach((L, i) => {
      L.tk = damp(L.tk, BD.licking ? 1 : 0, 4, dt);
      if (L.farFoot) { const cp = S.cam.gPos || S.camera.position; L.foot = cp.distanceToSquared(feet[0].arch) > cp.distanceToSquared(feet[1].arch) ? 0 : 1; }      // (the foot further from the camera: the head never comes between the camera and her soles)
      const f = feet[L.foot];
      if (BD.licking) { const across = L.spot[1] === 'out' ? Math.sign(f.side.dot(f.lat) || 1) * 0.115 : L.spot[1] === 'far' ? -Math.sign(f.side.dot(_b2.subVectors(S.cam.gPos || S.camera.position, f.arch)) || 1) * 0.11 : L.spot[1];      // ('out': beside the foot's outer edge; 'far': on the side away from the camera, so the foot is before the head, never behind it)
        L.mouth(_b1); L.toward(_b1, soleSpot(f, L.spot[0], across, L.spot[2], _b2), L.snap ? 1 : dt); L.snap = false; }      // (snap: the first frame, behind a cut, it is simply there)
      if (L.tk > 0.03) { const before = L.tongue.ph; lick(L.tongue, L.mouth(_b1), f, dt, L.tk, BD.period + 0.22 * i, 0.016, 0.005, 0.13); if (L.swap && L.tongue.ph < before) L.foot = 1 - L.foot; }
      else L.tongue.hide();
    });
    if (BD.kids) BD.kids(dt, t);
    if (BD.o && BD.o.onFrame) BD.o.onFrame(dt, t);
  }
  S.late.push((dt, t) => { if (BD.on) updBound(dt, t); });
  // who licks: an Ivy Maiden (she leans over, her head brought to the sole), a Myconid lady (sunk to her shoulders in the
  // ground, so her head is down at the soles), or whatever the caller drives itself
  function licker(m, i) {
    if (m.mouth && m.toward) return Object.assign({ tk: 0, foot: i % 2, spot: m.spot || [1.42, 0, 0.045], swap: true }, m);
    const L = { m, tk: 0, foot: i % 2, spot: [0.55, 'far', 0.03], swap: false, farFoot: true };
    L.tongue = m.tongue = m.tongue || makeTongue(m.headPos ? (m.kind === 'yellow' ? '#c05a9a' : '#e0567a') : '#8a4fa8');
    L.mouth = (out) => mouthAny(m, out);
    if (m.headPos) L.toward = (mouth, P, dt) => { const ey = mouthTo(m.obj, mouth, P, dt); m._lean = clamp((m._lean === undefined ? 1.2 : m._lean) - ey * 6 * dt, 0, 3.6); m.lean(m._lean); };
    else { if (m.upNow) m.upNow(0.42); L.toward = (mouth, P, dt) => mouthTo(m.obj, mouth, P, dt, -0.9, 0.05); }
    return L;
  }
  const BOUND_SAY = {
    ivy: { open: [['grin', "Don't miss out on this, sisters!!"], ['open', 'Do these beautiful piggies deserve our attention?']], tickle: () => [['grin', 'They do!! They do!!\nTied up all nice and neat for us!']].concat(C.lookLines ? [['open', C.lookLines('ivy', true).nail]] : []),      // (10-03: and her toenails)
     
      lick: [['open', 'Such a sweet little meal...\nlet us have a taste!']], fast: [['grin', 'Faster, sisters! Make her squeal!']], lost: [['calm', 'You cannot leave us behind that easily, little pixie...']] },
    myconid: { open: [[1, 'Pie uo Tick!'], [2, 'Tick Tick Tick!']], tickle: [[2, 'Tick tick! Tick tick tick!']], lick: [[0, 'Mmm... yum yum...']], fast: [[1, 'TICK TICK TICK TICK!!']], lost: [[0, 'Hihihi... Tick.']] },
  };
  const ANNE_BOUND = {
    open: ['a2', 42, "H-HEY!! What are you doing back there?!\nUNTIE ME!!", 'shocked'],
    tickle: ['a2', 18, "AHAHAHA!! N-NOT MY FEET!!\nAHAHAHAHA!! S-STOP IT!!", 'laughHard'],
    lick: ['a2', 15, "EEEEK!! D-DON'T LICK THEM!!\nAHAHAHAHA!! THAT'S GROSS!!", 'laughHard'],
    fast: ['a2', 18, "AHAHAHAHAHA!! P-PLEASE!!\nI CAN'T-- AHAHAHA!!", 'laughHard'],
  };
  // (10-03) chained: the tied scene comes straight after the 2D game's rounds (S.capStyle 'both'), so it opens and closes
  // with its own lines instead of repeating the ones just heard
  const BOUND_SAY_CH = {
    ivy: { open: [['grin', "She's still squirming, sisters!\nTie those pretty feet down for us!"], ['open', 'Ankles AND big toes...\nnow she cannot hide a single wiggle from us!']],
      lost: [['calm', "Shhh... there, there.\nWe'll let you go once we've had our fill, little pixie..."]] },
    myconid: { open: [[1, 'Tie tie! Tick!'], [2, 'No run! Tick tick tick!']], lost: [[0, 'Hihihi... tick... tick...']] },
  };
  async function boundSay(o, stage) {
    if (o.say) { await o.say(stage); return; }
    const pick = (d) => { const v = d && d[stage]; return typeof v === 'function' ? v() : v; };
    const lines = (o.chained && pick(BOUND_SAY_CH[o.kind])) || pick(BOUND_SAY[o.kind]) || [], who = st.list[0];
    for (const [e, text] of lines) {
      if (o.kind === 'ivy' && who && who.setFace) { const m = st.list[lines.indexOf(lines.find((l) => l[1] === text)) % st.list.length] || who; await ivySay(m, e, text); }
      else if (o.kind === 'myconid') await mycSay(who, e, text);
      else S.toast(text, 'dialog', 2.4);
    }
  }
  async function bound(o) {
    const list = (o.list || []).filter(Boolean), seat = (o.seat || anne.position).clone();
    let yaw = o.yaw;
    if (yaw === undefined) { const c = V3(); for (const m of list) c.add(m.obj.position); if (list.length) { c.multiplyScalar(1 / list.length); yaw = Math.atan2(c.x - seat.x, c.z - seat.z); } else yaw = anne.rotation.y + PI; }
    await S.fade(1, 0.35);
    if (st && st.temp) st = null;
    begin(seat, yaw, list, !!o.chained); st.speaker = null; BD.o = o; if (o.chained) console.log('BOUND chained ' + o.kind);      // (tests: the tied part after the 2D rounds)
    let free = false;
    const voice = async (k) => { const [sh, i, text, ex] = ANNE_BOUND[k]; await S.say(sh, i, text, { expr: ex, blush: 0.7 }); };
    const kids = o.kids ? o.kids.minis || [] : [];
    try {
      A.setHeelsWorn(false);
      await pose(has('StuckFlat') ? 'StuckFlat' : 'HeldProne', st.yaw + PI);      // (her feet towards them)
      if (!o.keep) arrange(list, SLOTS3);
      for (const m of list) { if (m.showNow) m.showNow(); if (m.lean) m.lean(0.25); }
      soleFrame();
      if (o.setup) o.setup({ mid: mid.clone(), out: nH.clone(), side: sideH.clone() });      // (the caller stands its own figures: Alraune's flower beyond her feet)
      loose.forEach((s, i) => { const p = V3().copy(mid).addScaledVector(sideH, i ? 0.45 : -0.42).addScaledVector(nH, 0.16).setY(0.035); s.g.visible = true; s.t = -1; s.carry = null; s.rest.set(1.5, i ? 0.7 : -0.5, 0.2); s.to = (out) => out.copy(p); });
      if (o.chained && hatWasOff) {                    // (10-03: straight after the 2D rounds her hat stays off, if they had it off: it lies in the grass by her head)
        if (A.setHat) A.setHat(false);
        const hp = V3().copy(mid).addScaledVector(nH, -1.75).addScaledVector(sideH, 0.62).setY(0.02);
        hat.obj.visible = true; hatS.t = 1; hatS.on = (out) => out.copy(hp);
      }
      ties.look(o.theme || 'rope'); ties.set({ on: true, k: 0, knot: 0, toe: 0, peg: 0, taut: 0 }); BD.lick = []; BD.licking = false; BD.period = 1.4; BD.on = true;
      await S.frame(); ties.placePeg();
      if (kids.length) {                               // (a Myconid lady's children: out of her patch and onto Anne's soles)
        for (const g of kids) { if (g.parent !== scene) { scene.add(g); g.userData.home = o.kids.obj; } g.visible = true; g.scale.setScalar((g.userData.s0 || 0.9) * 0.62); }      // (small: they stand on her soles in the close-ups)
        o.kids.kids(true);
        BD.kids = (dt, t) => { kidOnSole(kids[0], feet[0], 0, t, 0.42); kidOnSole(kids[1], feet[1], 1, t, 0.5); if (kids[2]) { const a = t * 1.3; kids[2].position.set(mid.x + Math.cos(a) * 0.6, 0.07 * Math.abs(Math.sin(t * 9)), mid.z + Math.sin(a) * 0.6); kids[2].rotation.set(0, -a, 0); } };
      }
      shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 }); S.expr('shocked', 0.4);
      await S.wait(0.25); await S.fade(0, 0.4);
      await S.mark('bound');
      // the tying, close on her feet: the cord round her ankles, the knot, the string round her big toes, the peg
      shot.soles({ pitch: 0.55, dist: 1.15, fov: 32, turn: 1.0 }); post.setCloseUp('on'); if (has('StuckFlatStrain')) S.clip('StuckFlatStrain', 0.2);
      { let t = 0; await S.until((dt) => { t += dt; ties.set({ k: clamp(t / 1.3, 0, 1), knot: clamp((t - 1.3) / 0.3, 0, 1), toe: clamp((t - 1.7) / 0.6, 0, 1), peg: clamp((t - 2.4) / 0.4, 0, 1), taut: clamp((t - 2.85) / 0.3, 0, 1) }); return t >= 3.2; }); }
      await S.mark('tied');
      shot.face({ dist: 1.3 }); await voice('open');
      await boundSay(o, 'open');
      // ---------- 1: tickling ----------
      (o.tools || []).forEach(([who, foot, mode, from, tool, op], i) => tick(i, foot, mode, from, typeof who === 'function' ? who : reach(list[who % Math.max(1, list.length)] || { obj: { position: mid } }, 1.2, 0.3), tool, op || {}));
      S.toes(0.32, 1.6, Infinity); S.expr('laughHard', 0.9); if (has('StuckFlatTickled')) S.clip('StuckFlatTickled', 0.25); for (const m of list) if (m.laugh) m.laugh(true);
      shot.soles({ pitch: 0.5, dist: 1.2, fov: 32, turn: 1.05 }); post.setCloseUp('on');
      await S.wait(0.6); await S.mark('btickle');
      await voice('tickle'); await boundSay(o, 'tickle');
      await S.wait(1.2); shot.side({ pitch: 0.25 }); await S.wait(1.5); shot.face({ dist: 1.3 }); await S.wait(1.3); shot.soles({ pitch: 0.75, turn: -1.0, dist: 1.0, fov: 32 }); await S.mark('bsoles'); await S.wait(1.4);
      post.setCloseUp('off'); shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 });
      free = await S.gauge({ label: 'Wriggle free! Press SPACE in the green!', sub: o.chained ? 'tied up  ·  try 1 / 3' : 'Try 1 / 3', width: 0.24, speed: 0.8 });
      if (!free) {
        // ---------- 2: they lick her soles as well ----------
        BD.lick = (o.lick || []).map(licker); for (const L of BD.lick) L.snap = true; BD.licking = BD.lick.length > 0;
        shot.soles({ pitch: 0.45, dist: 1.25, fov: 32, turn: 1.1 }); post.setCloseUp('on');
        await S.wait(1.4); await S.mark('blick');
        if (BD.licking) { await voice('lick'); await boundSay(o, 'lick'); }
        else if (o.say) await boundSay(o, 'lick');      // (10-03: no licker, but the round still has its own stage: fairies at her soles, ghosts' tongues, the thief's other hand)
        await S.wait(1.4); shot.face({ dist: 1.25 }); await S.wait(1.2); shot.soles({ pitch: 0.72, dist: 1.05, fov: 32, turn: 1.45 }); await S.mark('blick2'); await S.wait(1.6);      // (the same side: whoever licks keeps beyond her feet from here)
        post.setCloseUp('off'); shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 });
        free = await S.gauge({ label: 'Wriggle free! Press SPACE in the green!', sub: o.chained ? 'tied up  ·  try 2 / 3' : 'Try 2 / 3', width: 0.22, speed: 0.85 });
      }
      if (!free) {
        // ---------- 3: all at once, faster ----------
        for (const T of ticklers) T.rate *= 1.7; BD.period = 0.85; for (const m of list) if (m.lean) m.lean(0.9);
        shot.soles({ pitch: 0.5, dist: 1.3, fov: 34, turn: 1.0 }); post.setCloseUp('on'); S.toes(0.4, 2.2, Infinity);
        await voice('fast'); await boundSay(o, 'fast'); await S.mark('bfast');
        await S.wait(1.2); shot.face({ dist: 1.2 }); await S.wait(1.2); shot.side({ pitch: 0.3, sgn: -1 }); await S.wait(1.4);
        post.setCloseUp('off'); shot.wide({ flip: true, sgn: 0.75, dist: 3.2, pitch: 0.2 });
        free = await S.gauge({ label: 'Wriggle free! Press SPACE in the green!', sub: o.chained ? 'tied up  ·  last chance' : 'Last chance', width: 0.18, speed: 0.9 });
      }
      if (free) {                                      // the ties burst
        ties.burst((p) => sparks.burst(p, GOLD, 16, 1.4, 0.8)); clearTicklers(); BD.licking = false;
        for (const m of list) { if (m.shake) m.shake(1.3); if (m.lean) m.lean(-0.6); if (m.hop) m.hop(); }
        S.expr('angry', 0.3); S.toast(/ivy|vines|alraune|pumpkin/.test(o.kind) ? ANGRY : 'Ha! Got loose!|Nice try, you creeps!|Not today!!', 'dialog', 2.4); await S.wait(0.8);
      } else {
        await boundSay(o, 'lost'); await S.say('a2', 18, 'N-NO MORE!! AHAHAHAHAHAHA!!', { expr: 'laughHard', blush: 1.0 });
        await S.mark('baway'); await S.wait(0.8);
      }
      await S.fade(1, 0.35);
    } finally {
      BD.on = false; BD.licking = false; for (const L of BD.lick) { if (L.tongue) L.tongue.hide(); if (L.m) { L.m._lean = undefined; if (L.m.upNow) L.m.upNow(1); } } BD.lick = []; BD.kids = null; BD.o = null;
      ties.set({ on: false }); ties.update();
      for (const g of kids) { if (g.userData.home) { g.userData.home.add(g); g.userData.home = null; } g.userData.held = false; g.rotation.x = 0; g.visible = false; }
      if (o.kids && o.kids.kids) o.kids.kids(false);
      end();
    }
    return { free };
  }

  const kit = { soleSpot, mouthTo, lickStat, makeVine, TOOLS, ticklers, tick, untick, clearTicklers, wraps, hyphae, coils, loose, throwShoe, hat, throwHat, sisters, CLEAR, putShoesOn, shoesQuiet, kidLicker, noteShoe, shoeFrame: (i) => shoeSole(loose[i], i),
    bone, LEGS_OK, hipW, kneeW, ankW, readLegs, legAt, legFrame: { legC, legU, legA, legV }, makeSpiral, makeTongue, lick,
    use(on) { ext = !!on; if (on) { A.lastBare = bareNow() ? 1 : -1; A.shoeWork = null; for (const s of loose) s.bedK = 0; if (A.soleMarks) A.soleMarks(null); } if (!on) { clearTicklers(true); coils(wraps, false); for (const l of leashes) l.hide(); shoesQuiet(); for (const s of loose) { s.g.visible = false; s.vine.hide(); s.carry = null; } hat.obj.visible = false; hatS.on = null; } } };
  // (10-02) the staging, for scenes of the story's own (story_edge.js: Boudicca's interrogation): begin(seat, yaw, list)
  // and end(), pose(clip, yaw), the soles' frame (mid, nH, sideH after soleFrame()), the shots, her loose shoes
  const stage = { begin, end, pose, soleFrame, mid, nH, sideH, shot, loose, side2d, get st() { return st; } };
  return { ivy, snatch, myconid, alraune, pamper, bound, ties, isOn: () => !!st, kit, stage };
}
