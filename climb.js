// climb.js (10-12, as he asked: "the possibility of climbing up the vines to a higher area"): a figure climbs a vine up a
// rock face and over its edge, or down again. No clip plays the climb: her hands and feet are PUT on the vine every frame
// (two-bone IK on her own arms and legs, after her clip has posed her), so a hand that has gripped stays where it gripped
// while her body moves up past it, whatever the height of the face. It works on Anne and on any twin of hers (Boudicca
// follows her up): the same bones by the same names.
//
//   createClimber(S) -> { climb(fig, wall, way, o) -> Promise, busy() }
//     fig   { obj }                     the figure's root (Anne: { obj: anne }; a twin: its { obj })
//     wall  { at: Vector3 (the foot of the face, on the lower ground, at the vine's middle),
//             out: Vector3 (unit, level: out of the face, towards whoever stands before it), h: the face's height }
//     way   'up' | 'down'
//     o     { speed (m/s up the face, 0.72), onStep(kind) (a hand or a foot lands: for sounds) }
//   She starts an up-climb standing before the vine (FOOT m out of the face, facing it) and ends it standing on top (TOP m in
//   from the edge, her back to the edge); a down-climb is the same played backwards, from that spot on top.
// Her feet are let under "the ground" while she hangs on the face (A.setFloor is the caller's to set for Anne).
export const CLIMB = { FOOT: 0.40, TOP: 0.62 };

// createLimbs(THREE): the tools the climb is made of, for any scene that wants to put a hand or a foot of hers somewhere:
//   rigOf(root) her limbs; pose(root) -> { begin(), keep(), drop() }: call begin() each frame AFTER her clip has posed her
//   (it puts back what was turned last frame), turn what is wanted, then keep(); drop() when the scene is over.
//   reach(root, limb, target, pole, w): two bones to a target (all in the figure's own space: root.worldToLocal a world point)
//   aim(root, bone, tip, dir, w), hand(root, R, sd, dir, palm, curl, w), lean(root, R, ang), headUp(root, R, ang)
export function createLimbs(THREE) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Q4 = () => new THREE.Quaternion();
  const clamp = THREE.MathUtils.clamp;
  const _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _q = Q4(), _q2 = Q4();

  // ---------- a figure's limbs (found once per figure) ----------
  const rigs = new WeakMap();
  function rigOf(root) {
    let R = rigs.get(root); if (R) return R;
    const bone = (n) => root.getObjectByName(n);
    const limb = (up, lo, end, tip) => ({ up: bone(up), lo: bone(lo), end: bone(end), tip: bone(tip) });
    R = { root, ok: true,
      arm: { L: limb('upperarm01L', 'lowerarm01L', 'wristL', 'finger3-1L'), R: limb('upperarm01R', 'lowerarm01R', 'wristR', 'finger3-1R') },
      leg: { L: limb('upperleg01L', 'lowerleg01L', 'footL', 'toe2-1L'), R: limb('upperleg01R', 'lowerleg01R', 'footR', 'toe2-1R') },
      fingers: { L: [], R: [] }, spine: ['spine05', 'spine04', 'spine03', 'spine02', 'spine01'].map(bone).filter(Boolean), neck: bone('neck01'), head: bone('head') };
    for (const sd of ['L', 'R']) for (let k = 1; k <= 5; k++) for (let j = 1; j <= 3; j++) { const b = bone(`finger${k}-${j}${sd}`); if (b) R.fingers[sd].push({ b, k, j }); }
    for (const g of [R.arm, R.leg]) for (const sd of ['L', 'R']) for (const k of ['up', 'lo', 'end']) if (!g[sd][k]) R.ok = false;
    rigs.set(root, R); return R;
  }
  // a bone's place and turn in the figure's own space (so that the figure's own scale and turn do not matter)
  const posIn = (root, b, out) => root.worldToLocal(b.getWorldPosition(out));
  function quatIn(root, b, out) { out.identity(); for (let o = b; o && o !== root; o = o.parent) out.premultiply(o.quaternion); return out.normalize(); }
  function setQuatIn(root, b, q) { quatIn(root, b.parent, _q2).invert(); b.quaternion.copy(_q2.multiply(q)).normalize(); b.updateMatrixWorld(true); }
  // Her clip does not move every bone every frame (her fingers have no track at all; a still pose is written once): what
  // this module turned last frame is put back to what her clip had given it before it is turned again, or it would add up.
  function clipPose(C) {
    for (const b of C.bones) {
      const mine = C.mine.get(b);
      if (mine && Math.abs(b.quaternion.dot(mine)) > 0.9999995) b.quaternion.copy(C.base.get(b)); else C.base.set(b, (C.base.get(b) || Q4()).copy(b.quaternion));
    }
    C.root.updateMatrixWorld(true);
  }
  function keepPose(C) { for (const b of C.bones) C.mine.set(b, (C.mine.get(b) || Q4()).copy(b.quaternion)); }
  function dropPose(C) { for (const b of C.bones) { const mine = C.mine.get(b); if (mine && Math.abs(b.quaternion.dot(mine)) > 0.9999995) b.quaternion.copy(C.base.get(b)); } C.root.updateMatrixWorld(true); }
  // turn a bone (the least turn) so that the point `tip`, which it carries, lies in the direction `dir` from its own joint
  function aim(root, b, tip, dir, w = 1) {
    posIn(root, b, _a); _b.copy(tip).sub(_a); if (_b.lengthSq() < 1e-10) return; _b.normalize();
    _q.setFromUnitVectors(_b, dir); if (w < 1) _q.slerp(_q2.identity(), 1 - w);
    const cur = quatIn(root, b, Q4()); setQuatIn(root, b, _q.multiply(cur));
  }
  // two bones to a target: the joint between them bends towards `pole` (all in the figure's own space)
  const tA = V3(), tE = V3(), tDir = V3(), tPerp = V3(), tT = V3();
  function reach(root, L, target, pole, w = 1) {
    if (w <= 0.001) return;
    posIn(root, L.up, tA); posIn(root, L.lo, _c); posIn(root, L.end, _d);
    const l1 = _c.distanceTo(tA), l2 = _d.distanceTo(_c);
    tT.copy(target).sub(tA); const dist = clamp(tT.length(), Math.abs(l1 - l2) + 0.004, l1 + l2 - 0.004); tDir.copy(tT).normalize();
    const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    tPerp.copy(pole).addScaledVector(tDir, -pole.dot(tDir)); if (tPerp.lengthSq() < 1e-8) tPerp.set(0, 0, 1).addScaledVector(tDir, -tDir.z); tPerp.normalize();
    tE.copy(tA).addScaledVector(tDir, l1 * cosA).addScaledVector(tPerp, l1 * sinA);
    aim(root, L.up, posIn(root, L.lo, _c), _e.copy(tE).sub(tA).normalize(), w);
    posIn(root, L.lo, _c); tT.copy(tA).addScaledVector(tDir, dist);      // (where the end can be)
    aim(root, L.lo, posIn(root, L.end, _d), _e.copy(tT).sub(_c).normalize(), w);
  }
  // her hand: along `dir`, its palm towards `palm`; her fingers curled by `curl` (0..1)
  const hA = V3(), hB = V3(), hN = V3();
  function hand(root, R, sd, dir, palm, curl, w) {
    const L = R.arm[sd]; if (!L.tip || w <= 0.001) return;
    aim(root, L.end, posIn(root, L.tip, _c), dir, w);
    // the palm's own normal now: across her knuckles x along her hand; turn about `dir` to face it to `palm`
    const f = R.fingers[sd], i1 = f.find((x) => x.k === 2 && x.j === 1), i5 = f.find((x) => x.k === 5 && x.j === 1);
    if (i1 && i5) {
      posIn(root, i1.b, hA); posIn(root, i5.b, hB); hN.copy(hB).sub(hA).cross(dir).normalize(); if (sd === 'R') hN.negate();
      _e.copy(palm).addScaledVector(dir, -palm.dot(dir)); if (_e.lengthSq() > 1e-6) {
        _e.normalize(); let ang = Math.acos(clamp(hN.dot(_e), -1, 1)); if (_c.copy(hN).cross(_e).dot(dir) < 0) ang = -ang;
        _q.setFromAxisAngle(dir, ang * w); const cur = quatIn(root, L.end, Q4()); setQuatIn(root, L.end, _q.multiply(cur));
      }
    }
    for (const x of f) {                               // each finger joint bends about the line across her knuckles
      if (x.k === 1 && x.j === 1) continue;
      posIn(root, i1 ? i1.b : L.tip, hA); posIn(root, i5 ? i5.b : L.end, hB); _e.copy(hB).sub(hA).normalize(); if (sd === 'R') _e.negate();      // (about this line a finger closes towards her palm)
      _q.setFromAxisAngle(_e, (x.k === 1 ? 0.45 : 0.85) * curl * w); const cur = quatIn(root, x.b, Q4()); setQuatIn(root, x.b, _q.multiply(cur));
    }
  }
  // her whole top turned about a level axis of the figure (x: + leans her forward), shared along her spine
  function lean(root, R, ang) {
    if (Math.abs(ang) < 1e-4 || !R.spine.length) return;
    const share = [0.4, 0.2, 0.15, 0.15, 0.1];
    R.spine.forEach((b, i) => { _q.setFromAxisAngle(_e.set(1, 0, 0), ang * (share[i] || 0.1)); const cur = quatIn(root, b, Q4()); setQuatIn(root, b, _q.multiply(cur)); });
  }
  function headUp(root, R, ang) { for (const b of [R.neck, R.head]) if (b) { _q.setFromAxisAngle(_e.set(1, 0, 0), -ang * 0.5); const cur = quatIn(root, b, Q4()); setQuatIn(root, b, _q.multiply(cur)); } }
  // every bone these tools may turn, for one figure
  function bonesOf(R) {
    const out = [];
    for (const g of [R.arm, R.leg]) for (const sd of ['L', 'R']) for (const k of ['up', 'lo', 'end']) out.push(g[sd][k]);
    for (const sd of ['L', 'R']) for (const f of R.fingers[sd]) out.push(f.b);
    out.push(...R.spine); if (R.neck) out.push(R.neck); if (R.head) out.push(R.head);
    return out.filter(Boolean);
  }
  function pose(root) { const C = { root, bones: bonesOf(rigOf(root)), base: new Map(), mine: new Map() }; return { begin: () => clipPose(C), keep: () => keepPose(C), drop: () => dropPose(C) }; }
  return { rigOf, bonesOf, pose, clipPose, keepPose, dropPose, posIn, reach, aim, hand, lean, headUp };
}

export function createClimber(S) {
  const { THREE } = S, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = THREE.MathUtils.clamp, sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const LB = createLimbs(THREE), { rigOf, clipPose, keepPose, dropPose, posIn, reach, aim, hand, lean, headUp } = LB;
  const _c = V3(), _e = V3();

  // ---------- the climb ----------
  // Everything below is in WALL space: x along the face (her left), y up, z out of the face; the figure faces -z.
  const STRIDE = 0.68, HAND_X = 0.19, FOOT_X = 0.115, HAND_Z = 0.075, FOOT_Z = 0.13, BODY_Z = CLIMB.FOOT;
  const active = new Set();
  function climb(fig, wall, way = 'up', o = {}) {
    const root = fig.obj, R = rigOf(root); if (!R.ok) return Promise.resolve(false);
    const H = wall.h, speed = o.speed || 0.72, out = wall.out.clone().setY(0).normalize(), left = V3(-out.z, 0, out.x);      // (her left as she faces the wall)
    const yaw = Math.atan2(-out.x, -out.z);
    // wall space <-> world, and world -> the figure's own space
    const toWorld = (x, y, z, v = V3()) => v.copy(wall.at).addScaledVector(left, x).addScaledVector(out, z).setY(wall.at.y + y);
    const C = { fig, R, root, way, H, t: 0, done: null, yaw, toWorld, o,
      // the legs of the journey, in seconds: mount, the face, over the edge
      T1: 0.55, T2: Math.max(0.2, (H - 1.3)) / speed, T3: 1.55 };
    C.total = C.T1 + C.T2 + C.T3;
    // where each limb holds: rungs every STRIDE up the vine; the pairs (right hand + left foot, left hand + right foot) half a stride apart
    C.rung = { handR: 0.0, footL: 0.0, handL: 0.5, footR: 0.5 };
    C.bones = LB.bonesOf(R); C.base = new Map(); C.mine = new Map();
    active.add(C);
    return new Promise((res) => { C.done = res; });
  }
  // her body's place on the journey at time s (0..total): [z out of the face, y of her feet's level (her root), how far over the edge (0..1)]
  function bodyAt(C, s) {
    const { T1, T2, T3, H } = C;
    if (s <= T1) return [BODY_Z, 0.0, 0];
    if (s <= T1 + T2) return [BODY_Z, (H - 1.3) * (s - T1) / T2, 0];
    const u = (s - T1 - T2) / T3, y0 = H - 1.3;
    const y = y0 + (1.3) * sst(u, 0.0, 0.8), z = BODY_Z + (-(BODY_Z + CLIMB.TOP)) * sst(u, 0.42, 1.0);
    return [z, y, u];
  }
  const WP = V3(), WQ = V3(), tgt = V3(), pole = V3(), dirv = V3(), palm = V3();
  function step(C, dt) {
    const { R, root, H, toWorld } = C;
    C.t = Math.min(C.total, C.t + dt * (C.o.rate || 1));
    const s = C.way === 'up' ? C.t : C.total - C.t;      // (down: the same journey backwards)
    const [bz, by, over] = bodyAt(C, s);
    const sway = Math.sin(s * 5.2) * 0.022 * (over > 0 ? 1 - over : 1);
    toWorld(sway, by, bz, root.position); root.rotation.set(0, C.yaw, 0);
    clipPose(C);
    // how much of her is the climb's (the rest is her clip's: she stands, at both ends)
    const wIn = sst(s, 0.05, C.T1 * 0.8), wOutHands = 1 - sst(over, 0.55, 0.8), wOutLegs = 1 - sst(over, 0.82, 1.0);
    const climbY = by;                                  // her root's height up the face
    // each limb's hold, in wall space
    const hold = (kind, sd) => {
      const isHand = kind === 'hand', key = kind + sd, ph0 = C.rung[key];
      const x = (sd === 'L' ? 1 : -1) * (isHand ? HAND_X : FOOT_X), z = isHand ? HAND_Z : FOOT_Z;
      // the limb's cycle: it holds while her body rises past, then swings up a stride. Its phase runs with her height.
      const base = isHand ? 1.47 : 0.20;               // (a hand takes its hold this far above her root; a foot this far)
      const cyc = (climbY / STRIDE) + ph0, k = Math.floor(cyc), f = cyc - k, SW = 0.34;
      let y = (k - ph0) * STRIDE + base + (isHand ? 0.36 : 0.30), lift = 0;      // (the rung it holds now)
      if (f > 1 - SW) { const u = (f - (1 - SW)) / SW, e = u * u * (3 - 2 * u); y += STRIDE * e; lift = Math.sin(Math.PI * u); }      // (the swing to the next)
      return { x, y, z: z + lift * (isHand ? 0.07 : 0.09), lift };
    };
    const topHand = (sd) => ({ x: (sd === 'L' ? 1 : -1) * 0.2, y: H + 0.015, z: -0.2 });
    const topFoot = (sd) => ({ x: (sd === 'L' ? 1 : -1) * 0.1, y: H + 0.0, z: sd === 'R' ? -0.16 : -CLIMB.TOP });
    const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
    lean(root, R, (0.10 + 0.5 * Math.sin(Math.PI * clamp(over / 0.9, 0, 1))) * wIn * (1 - sst(over, 0.75, 1)));
    headUp(root, R, 0.5 * wIn * (1 - sst(over, 0.3, 0.7)));
    for (const sd of ['L', 'R']) {
      // hands: on the vine; over the edge, flat on the ledge's top
      let h = hold('hand', sd); const hy = Math.min(h.y, H - 0.02);
      const onTop = sst(by + 1.42, H - 0.1, H + 0.12) * (sd === 'L' ? 1 : sst(by + 1.42, H, H + 0.2));      // (her shoulders come level with the edge: first one hand, then the other)
      h = mix({ x: h.x, y: hy, z: h.z + (h.y > H ? 0.02 : 0) }, topHand(sd), onTop);
      toWorld(h.x, h.y, h.z, WP); root.worldToLocal(tgt.copy(WP));
      pole.set(sd === 'L' ? 0.9 : -0.9, -0.5, -0.35);  // (her elbows out and down)
      const wH = wIn * wOutHands;
      reach(root, R.arm[sd], tgt, pole, wH);
      dirv.set(sd === 'L' ? -0.25 : 0.25, 1, 0.25 * (1 - onTop)).lerp(_e.set(0, 0.15, 1), onTop).normalize(); palm.set(0, 0, 1).lerp(_e.set(0, -1, 0.2), onTop).normalize();
      hand(root, R, sd, dirv, palm, 1 - 0.75 * onTop, wH);
      // feet: on the vine; over the edge the right one steps up onto the ledge, then the left follows
      let f = hold('foot', sd);
      const up = sd === 'R' ? sst(over, 0.18, 0.5) : sst(over, 0.6, 0.95);
      if (up > 0) { const a = { x: f.x, y: Math.min(f.y, H - 0.35), z: f.z }, b = topFoot(sd); f = mix(a, b, up); f.y += 0.16 * Math.sin(Math.PI * up); f.z += 0.1 * Math.sin(Math.PI * up); }
      else f.y = Math.min(f.y, H - 0.35);
      toWorld(f.x, f.y + 0.075, f.z, WP); root.worldToLocal(tgt.copy(WP));      // (her ankle is this far above the ball of her foot's hold)
      pole.set(sd === 'L' ? 0.35 : -0.35, 0.2, 1);     // (her knees forward, to the wall, and a little out)
      const wF = wIn * wOutLegs;
      reach(root, R.leg[sd], tgt, pole, wF);
      if (R.leg[sd].tip) aim(root, R.leg[sd].end, posIn(root, R.leg[sd].tip, _c), dirv.set(0, -0.32 * (1 - up), 1).normalize(), wF);
      // a sound as a limb takes a new hold
      if (C.o.onStep) { const k = 'l' + sd, was = C[k] || 0, now = hold('hand', sd).lift > 0.5 ? 1 : 0; if (was && !now) C.o.onStep('hand'); C[k] = now; }
    }
    keepPose(C);
    if (C.t >= C.total) {
      active.delete(C); dropPose(C);
      const end = C.way === 'up' ? toWorld(0, H, -CLIMB.TOP) : toWorld(0, 0, BODY_Z);
      root.position.copy(end); root.rotation.set(0, C.yaw, 0);
      C.done(true);
    }
  }
  S.late.push((dt) => { for (const C of [...active]) step(C, dt); });
  return { climb, busy: () => active.size > 0, limbs: LB, CLIMB };
}

// ---------- the vines of an area with ledges (10-12) ----------
// createClimbs(S, C, env, o) -> { list, byId, climber, up(id), down(id) }   (an empty list in an area without ledges)
// For each of the level's climbs (level.climbs; world/ledges.js gives the rock face's place): a net of vines down the face
// and two events, "E — Climb the vine" at its foot and "E — Climb down the vine" on top. The 2D game's own words (its
// events "ClimbUp" and "BonusVineDown"). She climbs by climb() above; at the top of the face the level she stands on
// changes (S.ledge.setLevel, world/frames.js), so on a ledge the ground is y = 0 again for everything that happens there.
//   o.gate(k, 'up' | 'down') -> Promise<bool>   may she use this vine now? (the area's own story: something sits on it)
//   o.follower() -> a figure of thief.js, or null   who climbs after her (Boudicca)
//   o.refollow(fig)                              the follower takes up following again
//   o.onTop(k), o.onDown(k)                      after she has arrived (the area's remarks)
export function createClimbs(S, C, env, o = {}) {
  const LED = S.ledge; if (!LED) return { list: [], byId: {} };
  const { THREE, scene, anne, A } = S, K = C.K, PI = Math.PI, H = LED.H;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const climber = createClimber(S);

  // a net of climbing vines down a rock face: stems side by side from over the lip to the ground, a cross vine every 0.34 m
  // (where her hands and feet take hold: the holds of climb() above fall on them)
  function vineNet(h, seed) {
    const r = K.rng(seed), parts = [], Wd = 0.46, n = Math.max(8, Math.round(h / 0.28));
    for (let i = 0; i < 5; i++) {
      const x0 = -Wd + i * Wd / 2, pts = [V3(x0 + r.r(-0.06, 0.06), h + 0.02, -0.5), V3(x0, h + 0.055, -0.14)];
      for (let k = 0; k <= n; k++) { const t = k / n; pts.push(V3(x0 + 0.045 * Math.sin(t * 11 + i * 1.7), h * (1 - t) - (k === n ? 0.06 : 0), 0.035 + 0.02 * Math.cos(t * 9 + i))); }
      parts.push(K.tube(pts, (t) => 0.03 - 0.007 * t, (t) => K.mix(K.col(0.24, 0.15, 0.06), K.col(0.36, 0.24, 0.1), 0.5 + 0.5 * Math.sin(t * 13 + i)), 6, n * 3));
    }
    for (let y = 0.16; y < h - 0.08; y += 0.34) {
      parts.push(K.tube([V3(-Wd - 0.04, y + r.r(-0.02, 0.02), 0.03), V3(-Wd / 2, y + 0.02, 0.062), V3(0, y - 0.008, 0.068), V3(Wd / 2, y + 0.018, 0.062), V3(Wd + 0.04, y + r.r(-0.02, 0.02), 0.03)],
        () => 0.019, () => K.col(0.3, 0.2, 0.08), 5, 10));
    }
    for (let i = 0; i < 26; i++) parts.push(K.place(K.leaf(r.r(0.1, 0.17), 0.085, 0.4, 0.25, i % 2 ? K.G.leaf : K.G.leaf2), V3(r.r(-Wd - 0.08, Wd + 0.08), r.r(0.25, h + 0.02), 0.075), V3(r.r(-0.5, 0.5), 0.3, 1)));
    const obj = new THREE.Group(); obj.name = 'VineNet'; obj.add(K.shadowy(new THREE.Mesh(K.merge(parts), K.MAT.plant))); return { obj };
  }

  // the picture while somebody climbs: from before the face and a little to one side, rising with her
  const _p = V3(), _l = V3();
  function camOn(k, obj, baseY) {
    const fn = () => {
      const up = obj.position.y - baseY;
      _p.set(k.at.x + k.out.x * 4.5 + k.left.x * 2.2, baseY + 1.75 + 0.7 * up, k.at.z + k.out.z * 4.5 + k.left.z * 2.2);
      _l.set(k.at.x - k.out.x * 0.1, baseY + 1.15 + 0.92 * up, k.at.z - k.out.z * 0.1);
      S.cam.set(_p, _l, { fov: 46, cut: true, bush: true });
    };
    fn(); S.late.push(fn);
    return () => { const i = S.late.indexOf(fn); if (i >= 0) S.late.splice(i, 1); };
  }
  const grip = () => S.se('se_Twine', 0.22, 1.15 + Math.random() * 0.5);
  const party = () => { const f = o.follower ? o.follower() : null; return f && f.obj && f.obj.visible ? f : null; };

  async function goUp(k) {
    const f = party(); if (f) f.follow(null);
    await S.walk([k.foot], { speed: 1.5 }); await S.turnTo(V3(k.at.x - k.out.x, 0, k.at.z - k.out.z), 0.15);
    S.clip('Idle', 0.15); S.expr('neutral'); if (A.setFloor) A.setFloor(-99);
    let stop = camOn(k, anne, 0);
    await climber.climb({ obj: anne }, { at: k.at, out: k.out, h: H }, 'up', { onStep: grip });
    // On top. From here on the ledge is the ground: the world and everything the cameras keep move down with her at once.
    stop(); LED.setLevel(1); if (f) f.obj.position.y -= H;
    if (A.setFloor) A.setFloor(null);
    S.cam.behind(anne, { dist: 4.4, pitch: 0.36 });
    if (f) {                                         // she steps in from the edge and looks back; her friend comes up after her
      await S.walk([V3(k.topP.x - k.out.x * 1.2 + k.left.x * 0.55, 0, k.topP.z - k.out.z * 1.2 + k.left.z * 0.55)], { speed: 1.4 }); await S.turnTo(k.topP, 0.25);
      f.show(V3(k.foot.x, -H, k.foot.z), k.face); stop = camOn(k, f.obj, -H);
      await climber.climb({ obj: f.obj }, { at: V3(k.at.x, -H, k.at.z), out: k.out, h: H }, 'up', { onStep: grip, rate: 1.3 });
      stop(); f.obj.position.y = 0; f.face(k.face); if (o.refollow) o.refollow(f);
      S.cam.behind(anne, { dist: 4.6, pitch: 0.36 });
    }
    await S.wait(0.3);
    if (o.onTop) await o.onTop(k);
    C.checkpoint(); console.log('CLIMB up ' + k.id + ' done');
  }
  async function goDown(k) {
    const f = party(); if (f) f.follow(null);
    await S.walk([k.topP], { speed: 1.4 }); await S.turnTo(V3(k.topP.x - k.out.x, 0, k.topP.z - k.out.z), 0.2);      // (her back to the edge)
    // From here on the low ground is the ground again: she stands H up on it, and nothing is seen to move.
    LED.setLevel(0); if (f) f.obj.position.y += H;
    S.clip('Idle', 0.15); S.expr('neutral'); if (A.setFloor) A.setFloor(-99);
    let stop = camOn(k, anne, 0);
    await climber.climb({ obj: anne }, { at: k.at, out: k.out, h: H }, 'down', { onStep: grip });
    stop(); if (A.setFloor) A.setFloor(null);
    if (f) {
      await S.walk([V3(k.foot.x + k.out.x * 1.2 - k.left.x * 1.15, 0, k.foot.z + k.out.z * 1.2 - k.left.z * 1.15)], { speed: 1.4 }); await S.turnTo(k.at, 0.25);      // (aside, out of the picture's way)
      f.show(V3(k.topP.x, H, k.topP.z), k.face); stop = camOn(k, f.obj, 0);
      await climber.climb({ obj: f.obj }, { at: k.at, out: k.out, h: H }, 'down', { onStep: grip, rate: 1.3 });
      stop(); f.obj.position.y = 0; f.face(k.face); if (o.refollow) o.refollow(f);
    }
    S.cam.behind(anne, { dist: 4.6, pitch: 0.36 });
    await S.wait(0.3);
    if (o.onDown) await o.onDown(k);
    C.checkpoint(); console.log('CLIMB down ' + k.id + ' done');
  }
  // the two events' scenes (the 2D game's own words)
  async function up(k) {
    if (o.gate && !(await o.gate(k, 'up'))) return;
    await S.turnTo(V3(k.at.x, 0, k.at.z), 0.2); S.cam.at(V3(k.at.x, 0, k.at.z), Math.atan2(k.out.x + k.left.x * 0.5, k.out.z + k.left.z * 0.5), { y: 1.4, dist: 4.2, pitch: 0.12 });
    await S.say('a1', 0, 'Looks strong enough to hold me\nif I climb up!');
    if (await S.choice(['Climb up', 'Leave']) !== 0) return;
    await goUp(k);
  }
  async function down(k) {
    if (o.gate && !(await o.gate(k, 'down'))) return;
    S.cam.behind(anne, { dist: 3.6, pitch: 0.4 });
    await S.say('a1', 0, 'I can climb down using this.');
    if (await S.choice(['Climb down', 'Leave']) !== 0) return;
    await goDown(k);
  }

  const list = (LED.climbs || []).map((c, i) => {
    const out = c.out.clone(), left = V3(-out.z, 0, out.x);
    const k = { id: c.id, i, at: c.at.clone(), out, left, base: c.base, top: c.top, face: Math.atan2(-out.x, -out.z),
      foot: V3(c.at.x + out.x * CLIMB.FOOT, 0, c.at.z + out.z * CLIMB.FOOT), topP: V3(c.at.x - out.x * CLIMB.TOP, 0, c.at.z - out.z * CLIMB.TOP) };
    k.net = vineNet(H + 0.02, 11 + i * 7); k.net.obj.position.copy(k.at); k.net.obj.rotation.y = Math.atan2(out.x, out.z); scene.add(k.net.obj);
    k.upEv = S.on({ id: 'climbUp_' + k.id, at: V3(k.at.x + out.x * 0.62, 0, k.at.z + out.z * 0.62), r: 1.2, lv: 0, action: 'E — Climb the vine', when: () => !o.show || o.show(k, 'up'), run: () => up(k) });
    k.downEv = S.on({ id: 'climbDown_' + k.id, at: V3(k.at.x - out.x * 0.78, 0, k.at.z - out.z * 0.78), r: 1.25, lv: 1, action: 'E — Climb down the vine', when: () => !o.show || o.show(k, 'down'), run: () => down(k) });
    return k;
  });
  const byId = Object.fromEntries(list.map((k) => [k.id, k]));
  if (typeof window !== 'undefined') window.__climbs = { list, byId, goUp: (id) => S.run(() => goUp(byId[id])), goDown: (id) => S.run(() => goDown(byId[id])) };
  return { list, byId, climber, up: (id) => up(byId[id]), down: (id) => down(byId[id]), goUp: (id) => goUp(byId[id]), goDown: (id) => goDown(byId[id]) };
}
