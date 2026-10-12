// thief.js: the thief of the hole trap (the 2D game's Aurelia Blue, sheet aurelia-tickler-1).
//
// She is a second figure made from Anne's own model (A.makeTwin of anne_next.js) in her own colours: pale hair with a
// pink lock and a blue one, a crimson scarf, a periwinkle dress and stockings, grey bracers and boots. She plays
// Anne's clips (Walk to come in, ThiefIdle to stand with a hand on her hip); what her arms and fingers do on top of
// that is posed here:
//   - an arm can be aimed: the scene names, every frame, a point for the tip of the feather she holds (or for her
//     fingertips), the way the hand points and the way its palm faces; her shoulder, elbow and wrist follow
//     (two-bone IK), and her wrist is put where the tip then lands exactly on that point;
//   - her fingers: relaxed, pinched round the quill, or clawed and wiggling.
// Nothing of hers goes INTO Anne: the scene names points with air under them, an arm that cannot reach falls short
// of its point, and `gap` keeps the least air seen under the feather's tip and under her fingertips (tests read it).
const SU = await import('three/addons/utils/SkeletonUtils.js');

// what she wears (colours as the surfaces' own, about 0.42 of how they show under the sun; see anne_next.js)
const LOOK = {
  name: 'Thief',
  hide: ['Anne_Hat', 'Anne_HatBand', 'Anne_Cuffs', 'Anne_CuffTrim', 'Anne_Choker'],
  sock: [0.165, 0.150, 0.315, 0.515],                 // stockings to the knee
  band: [0.19, 0.235, 0.275],                         // bracers
  iris: [[0.30, 0.70, 1.0], [0.03, 0.22, 0.78]],
  hair: { base: [0.56, 0.545, 0.54], right: [0.60, 0.27, 0.37], left: [0.27, 0.36, 0.64] },
  tint: {
    Anne_Suit: (m) => { m.color.setRGB(0.245, 0.225, 0.345); m.roughness = 0.62; },
    Anne_Trim: (m) => { m.color.setRGB(0.36, 0.37, 0.40); m.roughness = 0.35; m.metalness = 0.55; },
    Anne_HeelPurple: (m) => { m.color.setRGB(0.19, 0.235, 0.275); m.roughness = 0.3; m.metalness = 0.25; },
    Anne_HeelSole: [0.06, 0.07, 0.085],
    Anne_Nail: [0.165, 0.150, 0.315],                 // (her toes are in her stockings)
    Anne_Brow: [0.30, 0.30, 0.32],
  },
};
const FEATHER = 0.30, GRIP = 0.078, PALM = 0.019, BEND = 0.016;     // the feather's length past her grip; where the grip is: along her hand, and off her palm; how far its tip curls to the palm's side
const PAD = 0.007, TOUCH = 0.0025;                    // a fingertip's skin stands this far from its bone's end; the air her fingertips keep
// finger curls, degrees: thumb, index, middle, ring, little
const HAND = { easy: [18, 16, 18, 20, 22], hip: [12, 14, 16, 18, 20], pinch: [34, 44, 58, 66, 70], claw: [16, 22, 26, 24, 20], grip: [30, 62, 66, 68, 70] };

// (10-02) o.look / o.dress / o.idle: another figure on the same footing (boudicca.js): her own LOOK, what she wears on
// top of the model (dress({ tw, THREE, onBone }) hangs it on her bones), and the clip she stands in.
export function createThief(S, C, o = {}) {
  const { THREE, scene, A, V3 } = S, { along } = C;
  // (10-05, Chapter 2) whose soles her hands keep their air over: Anne's, unless the scene names another figure's (`target`:
  // the thief in the stocks, the dryad); o.bare: she goes barefoot (the Bare gaits)
  let feet = o.feet || C.feet; const BARE = o.bare ? 'Bare' : '';
  const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp, PI = Math.PI;
  const Q4 = () => new THREE.Quaternion(), M4 = () => new THREE.Matrix4();
  const UP = V3(0, 1, 0), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _e = V3(), _x = V3(), _q = Q4(), _q2 = Q4(), _q3 = Q4(), _m = M4();
  const sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let T = null, on = false;
  // (10-04) how far a wrist may be bent before the hand is turned to its forearm instead (radians; 0: never), and the share of
  // a hand's turn about the forearm's line that the forearm takes
  const WRIST = o.wrist || 0, TWIST = o.twist === undefined ? 0 : o.twist, YAX = V3(0, 1, 0);
  const IDLE = o.idle || 'ThiefIdle';
  const gap = { tip: 9, fingers: 9 };

  function make() {
    if (T || !A.makeTwin) return T;
    // (10-05: o.patch: her own look with a few things changed: the thief barefoot in the stocks, cast2.js)
    const tw = A.makeTwin(SU.clone, o.look || (o.patch ? Object.assign({}, LOOK, o.patch, { tint: Object.assign({}, LOOK.tint, o.patch.tint || {}) }) : LOOK)), sk = tw.skeleton;
    const bi = new Map(sk.bones.map((b, i) => [b, i]));
    const restM = (b) => _m.copy(sk.boneInverses[bi.get(b)]).invert();                    // a bone in the rest pose, model space
    const restP = (b, out = V3()) => out.setFromMatrixPosition(restM(b));
    const restQ = (b, out = Q4()) => { restM(b).decompose(_a, out, _b); return out; };
    const bone = (n) => tw.bone(n);
    const over = [];                                   // bones posed here on top of the clip: [bone, what the clip last gave it]
    const take = (b) => { const o = { b, base: b.quaternion.clone() }; over.push(o); return o; };

    // what is hung on a bone is built in model space, rest pose (the group undoes the bone's rest transform)
    const onBone = (n) => { const b = bone(n); if (!b) return null; const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(sk.boneInverses[bi.get(b)]); b.add(g); return g; };
    if (o.dress) o.dress({ tw, THREE, onBone });
    // ----- scarf: a cowl on her shoulders and a short end down her front, carried by her chest
    const chest = o.look ? null : bone('spine01');
    if (chest) {
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.30, 0.075, 0.115), roughness: 0.85, metalness: 0 });
      const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(sk.boneInverses[bi.get(chest)]); chest.add(g);      // (what is under it is in model space, rest pose)
      const ring = (R, r, y, z, tilt, sx, sz, turn = 0) => {
        const geo = new THREE.TorusGeometry(R, r, 12, 30), P = geo.attributes.position;
        for (let i = 0; i < P.count; i++) { const x = P.getX(i), yy = P.getY(i), a = Math.atan2(yy, x), k = 1 + 0.07 * Math.sin(a * 5 + turn * 3) + 0.05 * Math.sin(a * 9 + turn); P.setZ(i, P.getZ(i) * k); }      // folds
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat); m.rotation.set(PI / 2 + tilt, 0, turn); m.scale.set(sx, sz, 1); m.position.set(0, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
      };
      ring(0.064, 0.031, 1.438, 0.020, 0.26, 1.0, 0.98);
      ring(0.056, 0.026, 1.468, 0.014, 0.12, 1.0, 0.96, 1.3);
      const end = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.085, 6, 12), mat); end.position.set(0.05, 1.375, 0.092); end.rotation.set(0.28, 0, -0.16); end.scale.set(1, 1, 0.5); end.castShadow = true; end.receiveShadow = true; g.add(end);
    }

    // ----- arms and hands
    const arms = {};
    for (const sd of ['L', 'R']) {
      const U = bone('upperarm01' + sd), Lo = bone('lowerarm01' + sd), W = bone('wrist' + sd);
      if (!U || !Lo || !W) continue;
      const f = [1, 2, 3, 4, 5].map((k) => [1, 2, 3].map((j) => bone(`finger${k}-${j}${sd}`)).filter(Boolean));
      if (f.some((c) => c.length < 3)) continue;
      const pU = restP(U), pE = restP(Lo), pW = restP(W);
      // her hand in the rest pose: along it, out of its palm, across it
      const alongH = restP(f[2][0]).sub(pW).normalize(), across = restP(f[4][0]).sub(restP(f[1][0])).normalize();
      const palm = V3().crossVectors(alongH, across).normalize();
      if (palm.dot(restP(f[0][2]).sub(restP(f[1][0]))) < 0) palm.negate();                 // (the thumb is on the palm's side)
      palm.addScaledVector(alongH, -palm.dot(alongH)).normalize();
      const q0 = Q4().setFromRotationMatrix(M4().makeBasis(V3().crossVectors(alongH, palm), alongH, palm));
      const rqW = restQ(W), rqWi = rqW.clone().invert();
      // (10-04) her forearm's lower bone, if her wrist hangs on one that runs along its own Y (the twist is shared with it)
      const Lo2b = W.parent && W.parent.isBone && W.parent !== Lo ? W.parent : null;
      const lo2ok = !!Lo2b && (() => { const v = restP(W).applyMatrix4(sk.boneInverses[bi.get(Lo2b)]); return Math.abs(v.y) > 0.02 && Math.hypot(v.x, v.z) < 0.25 * Math.abs(v.y); })();
      const arm = {
        sd, U: take(U), Lo: take(Lo), W: take(W), Ub: U, Lob: Lo, Wb: W, L1: pU.distanceTo(pE), L2: pE.distanceTo(pW),
        Lo2: lo2ok ? take(Lo2b) : null, wRestInv: lo2ok ? restQ(Lo2b).invert().multiply(rqW).invert() : null, bend: 0,
        K: q0.clone().invert().multiply(rqW),            // her wrist's turn for a hand that points along +Y, palm to +Z
        tipL: V3().copy(alongH).multiplyScalar(GRIP + FEATHER).addScaledVector(palm, PALM + BEND).applyQuaternion(rqWi),      // the feather's tip, in the wrist's own frame
        padL: V3(), padOk: false, tipsL: [V3(), V3(), V3(), V3(), V3()],      // her fingertips in the wrist's own frame, and their middle (measured each frame, after her fingers are posed)
        w: 0, fn: null, fn0: null, sw: 1, mode: 'easy', hold: 'easy', feather: null,
        X: V3(), dir: V3(0, -1, 0), palm: V3(0, 0, 1), X0: V3(), dir0: V3(), palm0: V3(), pole: V3(sd === 'L' ? 1 : -1, -0.6, -0.5),
        curl: HAND.easy.slice(), fingers: [], ph: sd === 'L' ? 0 : 1.7, env: Array.from({ length: 45 }, () => V3()), envN: 0, clawNow: false, wr: 0, wk: 0, extra: 0,
      };
      f.forEach((chain, k) => chain.forEach((b, j) => {
        const rq = restQ(b), rl = restQ(b.parent).invert().multiply(rq);
        const nl = _a.copy(palm).applyQuaternion(_q.copy(rq).invert()), ax = V3(0, 1, 0).cross(nl);
        if (ax.lengthSq() < 1e-8) ax.set(1, 0, 0); ax.normalize();
        arm.fingers.push({ b, k, j, rl, ax, share: (k === 0 ? 0.35 : 0.8 + 0.1 * k) * [1.0, 1.15, 0.8][j] });
      }));
      arm.tips = f.map((c) => [c[1], c[2]]);                                             // every finger's last two joints
      // (10-03) a marker at each fingertip, carried by the finger's LAST bone, so that its bend counts (the tip was taken
      // along the middle bone before: a curled fingertip could sit a few millimetres nearer the sole than measured)
      arm.tipObj = f.map((c) => { const p2 = restP(c[1]), p3 = restP(c[2]), tip = V3().subVectors(p3, p2).normalize().multiplyScalar(0.026).add(p3); const o = new THREE.Object3D(); o.position.copy(tip.applyMatrix4(sk.boneInverses[bi.get(c[2])])); c[2].add(o); return o; });
      // the feather: quill and vane, built along +Y from the grip, its flat side to +Z; carried by her wrist
      {
        const g = new THREE.Group(); g.matrixAutoUpdate = false;
        const at = V3().copy(pW).addScaledVector(alongH, GRIP).addScaledVector(palm, PALM);
        g.matrix.copy(sk.boneInverses[bi.get(W)]).multiply(M4().makeBasis(V3().crossVectors(alongH, palm), alongH, palm).setPosition(at)); W.add(g);
        const N = 22, pos = [], colr = [], idx = [];
        const w = (s) => 0.031 * Math.pow(Math.sin(PI * Math.min(1, 0.06 + 0.94 * s)), 0.55) * (0.72 + 0.28 * (1 - s));      // the vane's half width
        for (let i = 0; i <= N; i++) {
          const s = i / N, y = 0.055 + (FEATHER - 0.055) * s, bend = BEND * s * s, hw = w(s) * (1 + 0.1 * Math.sin(i * 2.4));
          for (const [sx, e] of [[-1, 1], [-0.5, 0.5], [0, 0], [0.5, 0.5], [1, 1]]) {
            pos.push(sx * hw, y - 0.016 * e * e * (0.4 + s), bend + 0.006 * e * e);                                         // barbs swept back, the vane a shallow trough
            const c = 0.80 - 0.16 * e + 0.05 * Math.sin(i * 1.9 + sx * 3); colr.push(c, c, c * 1.04);
          }
          if (i < N) for (let k = 0; k < 4; k++) { const a = i * 5 + k; idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
        }
        const vane = new THREE.BufferGeometry(); vane.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vane.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); vane.setIndex(idx); vane.computeVertexNormals();
        const vm = new THREE.Mesh(vane, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color(0.07, 0.07, 0.08) })); vm.castShadow = true; vm.receiveShadow = true; g.add(vm);
        const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0024, FEATHER + 0.05, 6), new THREE.MeshLambertMaterial({ color: 0xcfc8b8, emissive: 0x2a2824 }));
        quill.position.set(0, (FEATHER - 0.05) / 2, 0.004); quill.rotation.x = 0.05; quill.receiveShadow = true; g.add(quill);
        g.visible = false; arm.feather = g;
      }
      arms[sd] = arm;
    }
    T = { tw, arms, over, yaw: 0, walk: null, turn: null, lean: 0, leanGoal: 0, spine: ['spine05', 'spine04', 'spine03', 'spine02'].map(bone).filter(Boolean), neck: bone('neck01') };
    for (const b of [...T.spine, T.neck]) if (b) take(b);      // (10-03: back to the clip before each mixer update, as the arms: the lean is laid on top of the clip, never on top of itself)
    tw.face.setExpression('smug');
    return T;
  }

  // ---------- one arm, this frame ----------
  const pS = V3(), pE = V3(), pW = V3(), qW = Q4(), qWant = Q4(), qHand = Q4(), q1 = Q4(), wT = V3(), wc = V3(), dn = V3(), pl = V3(), el = V3(), off = V3(), bx = V3(), bz = V3(), bm = M4();
  const setWorldQuat = (b, q) => { b.parent.getWorldQuaternion(_q3); b.quaternion.copy(_q3.invert().multiply(q)); b.updateWorldMatrix(false, true); };
  const turnTo = (b, tip, want) => {                   // turn bone b (least turn) so that the point `tip` it carries lies the way `want` points
    b.getWorldPosition(_a); _b.subVectors(tip, _a).normalize(); _c.copy(want).normalize();
    b.getWorldQuaternion(_q); _q2.setFromUnitVectors(_b, _c).multiply(_q); setWorldQuat(b, _q2);
  };
  function aim(a, dt, t) {
    a.wr = clamp(a.wr + (a.fn ? dt : -dt) / 0.45, 0, 1); a.w = sst(a.wr, 0, 1);      // (10-03: eased in and out over 0.45 s: the hand never leaps)
    if (a.fn) {
      a.fn(a.X, a.dir, a.palm, t);
      if (a.fn0 && a.sw < 1) {                         // from the last thing this arm did to the new one
        a.sw = Math.min(1, a.sw + dt / 0.4); const k = sst(a.sw, 0, 1);
        a.fn0(a.X0, a.dir0, a.palm0, t); a.X.lerpVectors(a.X0, a.X, k); a.dir.lerpVectors(a.dir0, a.dir, k).normalize(); a.palm.lerpVectors(a.palm0, a.palm, k).normalize();
        if (a.sw >= 1) a.fn0 = null;
      }
    }
    if (a.w < 0.003) return;
    a.extra = 0; let m = solve(a);
    // What the bones then really give is measured, not trusted: if a fingertip, or the feather's tip, has come out with
    // too little air, the arm is solved again THIS frame from the clip's pose asking for that much more air. (10-03:
    // nothing is carried to the next frame any more, so nothing switches on and off, or wears off, from frame to frame.)
    for (let n = 0; n < 2 && m < 1 && m < a.need - 0.0003; n++) {
      a.extra += a.need - m + 0.0003; a.U.b.quaternion.copy(a.U.base); a.Lo.b.quaternion.copy(a.Lo.base); a.W.b.quaternion.copy(a.W.base); if (a.Lo2) a.Lo2.b.quaternion.copy(a.Lo2.base); a.Ub.updateWorldMatrix(false, true); m = solve(a);
    }
  }
  // the air really left: under the feather's tip, or under the fingertip nearest a sole
  function airNow(a, feather) {
    if (feather) return air(a.Wb.localToWorld(_x.copy(a.tipL)));
    let m = 9; for (const tl of tipsFor(a)) m = Math.min(m, air(a.Wb.localToWorld(_x.copy(tl))) - PAD); return m;
  }
  // (10-04, as he asked: "the arms are very awkwardly bent: make it to where the hands are angled so it's not like that")
  // A scene names the way a hand points; her forearm comes from wherever her elbow has to be. Where the two disagree by
  // more than a wrist can give (her right hand at a sole her right shoulder is behind folded back 112 degrees on its own
  // forearm), the HAND is turned towards the line of her forearm until the bend is one a wrist has (`wrist`, radians, per
  // figure: createThief's option; 0 = as the scene says, whatever it costs). Her fingertips still go to the point named.
  const dU = V3(), fo = V3(), fa = V3();
  const OLDREACH = typeof location !== 'undefined' && new URLSearchParams(location.search).has('oldreach');      // (tests: the reach as it was before 10-04, to compare)
  function solve(a) {
    a.Ub.getWorldPosition(pS); a.Lob.getWorldPosition(pE); a.Wb.getWorldPosition(pW); a.Wb.getWorldQuaternion(qW);
    const L1 = pS.distanceTo(pE), L2 = pE.distanceTo(pW);      // (10-03: this frame's own lengths: what the turns below really swing)
    // (10-04) An arm sent from a sole straight on to something else ('reach': the floor, a shoe) is still a hand at a sole
    // while it moves off: its fingers still wiggle there. It keeps its air, and its pull, until it is away (`fromClaw`).
    const fromClaw = !!a.fn0 && a.sw < 1 && a.mode0 === 'claw' && a.mode === 'reach' && a.padOk;
    const feather = a.mode === 'feather' || !a.padOk, claw = (a.mode === 'claw' || fromClaw) && a.padOk;
    let fT = feet[0]; if (feet[1].arch.distanceToSquared(a.X) < fT.arch.distanceToSquared(a.X)) fT = feet[1];      // the sole she is at
    // Keep clear of her skin. Where will the wrist really be (an arm has its reach)? What air is then left under the
    // feather's tip, or under the nearest fingertip (over the whole swing of her wiggling fingers)? Too little: the
    // wrist goes back out along the sole's own way, in full. And a hand that tickles comes down to TOUCH of air, eased
    // in with the arm itself (one rule, every frame: no switching between two heights). (10-03)
    const lo = Math.abs(L1 - L2) + 0.01, R = (L1 + L2) * 0.995, s0 = (L1 + L2) * 0.85;
    const soft = (x) => (x <= s0 ? x : s0 + (R - s0) * (1 - Math.exp((s0 - x) / (R - s0))));      // (as asked up to 85% of her reach, then easing towards it: the elbow never snaps straight)
    let far = 0, d = 0;
    // (10-04) `eased`: the easing towards her full reach is for the point the scene asks for, once. The clearance steps below
    // start again from where her wrist came out; eased again each time (thirteen times a frame), a wrist asked past 85% of
    // her reach crept back to 85% and her hand hung 4 to 8 cm off the sole it was sent to.
    const reach = (eased = true) => { dn.subVectors(wT, pS); far = dn.length(); d = Math.max(lo, eased || OLDREACH ? soft(far) : Math.min(far, R)); dn.divideScalar(far || 1); return wc.copy(pS).addScaledVector(dn, d); };
    // everything up to her elbow, for a hand that points along `dir`: the hand's turn, where her wrist goes, where her elbow is
    const plan = (dir) => {
      let moved = false;                                 // (her wrist's point is no longer the scene's: see `reach`)
      // the hand: +Y along dir, +Z out of the palm
      bz.copy(a.palm).addScaledVector(dir, -a.palm.dot(dir)); if (bz.lengthSq() < 1e-8) bz.set(0, 1, 0).addScaledVector(dir, -dir.y); bz.normalize();
      bx.crossVectors(dir, bz); q1.setFromRotationMatrix(bm.makeBasis(bx, dir, bz));
      qWant.copy(q1).multiply(a.K); qHand.slerpQuaternions(qW, qWant, a.w);      // (not into qWant itself: slerpQuaternions copies its first argument over `this` first)
      off.copy(feather ? a.tipL : a.padL).applyQuaternion(qWant);       // (the feather's tip, or the middle of her fingertips)
      wT.copy(a.X).sub(off); wT.lerpVectors(pW, wT, a.w);
      if (a.mode !== 'reach' || fromClaw) {
        const f = fT;                                    // (the wrist backs out along that sole's own way; the air is taken over both soles)
        const least = () => { let m = 9; if (feather) m = air(_x.copy(a.tipL).applyQuaternion(qHand).add(wc)); else for (const tl of tipsFor(a)) m = Math.min(m, air(_x.copy(tl).applyQuaternion(qHand).add(wc)) - PAD); return m; };
        const need0 = feather ? 0.003 : TOUCH + (a.envN ? 0.001 : 0), need = need0 + a.extra; a.need = need0;      // (wiggling: a millimetre more, for the arc between the measured poses)
        reach(); let m = least();
        const pull = claw ? sst(a.w, 0.8, 1) * a.wk : 0;      // in: once, scaled by how far the arm and the wiggle are in
        if (m <= 1 && m > need && pull > 0) { wT.copy(wc).addScaledVector(f.n, (need - m) * pull); reach(false); m = least(); moved = true; }
        for (let it = 0; it < 6 && m <= 1 && m < need - 5e-5; it++) { wT.copy(wc).addScaledVector(f.n, need - m); reach(false); m = least(); moved = true; }      // out: in full
        for (let it = 0; it < 4 && m <= 1 && m < need - 5e-5; it++) { wT.copy(wc).addScaledVector(dir, -(need - m) / Math.max(0.3, -dir.dot(f.n))); reach(false); m = least(); moved = true; }      // out of reach and still too near: back along the hand's own line
      }
      reach(!moved);
      // shoulder, elbow, wrist
      const ax = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - ax * ax));
      pl.subVectors(pE, pS).lerp(_d.copy(a.pole).applyAxisAngle(UP, T.tw.obj.rotation.y), a.w); pl.addScaledVector(dn, -pl.dot(dn)); if (pl.lengthSq() < 1e-8) pl.set(0, -1, 0).addScaledVector(dn, dn.y); pl.normalize();
      el.copy(dn).multiplyScalar(ax).addScaledVector(pl, h);                              // elbow, from the shoulder
    };
    dU.copy(a.dir); plan(dU);
    a.bend = 0;
    if (WRIST > 0 && a.w > 0.02) {
      for (let it = 0; it < 5; it++) {
        fo.copy(wc).sub(pS).sub(el); if (fo.lengthSq() < 1e-10) break; fo.normalize();      // her forearm as planned: elbow to wrist
        const ang = fo.angleTo(dU); a.bend = ang;
        if (ang <= WRIST + 0.004) break;
        // (never more than 80 degrees from the way the scene named: past a quarter turn the palm it named would come out on the
        // hand's other side; an arm folded harder than that keeps what is left in its wrist)
        const room = 1.4 - a.dir.angleTo(dU); if (room <= 0.002) break;
        fa.crossVectors(dU, fo); if (fa.lengthSq() < 1e-12) break;
        _q2.setFromAxisAngle(fa.normalize(), Math.min(room, (ang - WRIST) * sst(a.w, 0, 0.6)));      // (eased in with the arm)
        dU.applyQuaternion(_q2).normalize(); plan(dU);
      }
    }
    a.far = far; (a.pred || (a.pred = V3())).copy(wc);
    turnTo(a.Ub, pE, el);
    a.Lob.getWorldPosition(pE); a.Wb.getWorldPosition(pW);
    _e.copy(pS).addScaledVector(dn, d).sub(pE); turnTo(a.Lob, pW, _e);
    setWorldQuat(a.Wb, qHand);
    // (10-04) What her hand is turned about her forearm's own line is shared with the forearm (its lower bone), as a forearm
    // does: the turn was all in the wrist joint, wrung like a cloth.
    if (a.Lo2 && TWIST > 0 && a.w > 0.02) {
      a.Lo2.b.getWorldQuaternion(_q); _q2.copy(_q).invert().multiply(qHand).multiply(a.wRestInv);      // her wrist's turn from its rest, in the forearm's frame
      let ty = _q2.y, tw_ = _q2.w; if (tw_ < 0) { ty = -ty; tw_ = -tw_; }
      // (towards half a turn its share fades to nothing: there the angle jumps from +180 to -180 degrees between two frames,
      // and her forearm would spin with it)
      const tw0 = 2 * Math.atan2(ty, tw_), ang = tw0 * (1 - sst(Math.abs(tw0), 2.0, 3.0)) * TWIST * a.w;
      if (Math.abs(ang) > 1e-4) { a.Lo2.b.quaternion.multiply(_q3.setFromAxisAngle(YAX, ang)); a.Lo2.b.updateWorldMatrix(false, true); setWorldQuat(a.Wb, qHand); }
    }
    return a.mode === 'reach' && !fromClaw ? 9 : airNow(a, feather);
  }
  // (10-03) Smooth hands. Her fingers wiggle as they tickle (a swing of WIG degrees a joint); measuring the air under
  // the wiggling fingertips each frame made the whole hand bob with the wiggle ("glitchy"). Now the fingers are posed
  // at nine points of the swing (from fully curled to fully open), the fingertips of all of them are measured in
  // the wrist's own frame (steady while the curls are), the arm is aimed so that every one of them keeps its air, and
  // only then is the real wiggle shown (showFingers): it cannot reach nearer the sole than the measured poses.
  const WIG = (k) => (k === 0 ? 6 : 12);
  const poseFingers = (a, s) => { for (const f of a.fingers) f.b.quaternion.copy(f.rl).multiply(_q.setFromAxisAngle(f.ax, (a.curl[f.k] + s * a.wk * WIG(f.k)) * f.share * PI / 180)); };
  const wigOf = (a, f, t) => Math.sin(t * (8 + f.k * 0.9) + f.k * 1.9 + a.ph);
  function fingers(a, dt, t) {
    const want = HAND[a.mode === 'claw' ? 'claw' : a.hold] || HAND.easy, claw = a.mode === 'claw' && a.w > 0.5;
    for (let k = 0; k < 5; k++) a.curl[k] = damp(a.curl[k], want[k], 9, dt);
    a.wk = damp(a.wk, a.mode === 'claw' && a.fn ? 1 : 0, 5, dt);      // (the wiggle fades in and out, never switched on in one frame)
    a.clawNow = claw || a.wk > 0.01; a.envN = 0;
    if (a.clawNow) { for (const s of [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 0]) { poseFingers(a, s); pads(a, s === 0); for (let k = 0; k < 5; k++) a.env[a.envN++].copy(a.tipsL[k]); } }      // (nine points of the swing: a curling fingertip runs on an arc)
    else { poseFingers(a, 0); pads(a, true); }
  }
  function showFingers(a, t) { if (!a.clawNow) return; for (const f of a.fingers) f.b.quaternion.copy(f.rl).multiply(_q.setFromAxisAngle(f.ax, (a.curl[f.k] + wigOf(a, f, t) * a.wk * WIG(f.k)) * f.share * PI / 180)); }
  // where her fingertips are, in her wrist's own frame (so that an aimed hand can be put where they touch the point named):
  // each finger's end, and the middle of index, middle and ring. Called once her fingers are posed, before the arm is aimed.
  function pads(a, keepPad = true) {
    a.Wb.updateWorldMatrix(false, true); _c.set(0, 0, 0);
    a.tipObj.forEach((o, k) => { a.Wb.worldToLocal(o.getWorldPosition(a.tipsL[k])); if (k >= 1 && k <= 3) _c.addScaledVector(a.tipsL[k], 1 / 3); });
    if (!keepPad) return;
    if (a.padOk) a.padL.lerp(_c, 0.25); else { a.padL.copy(_c); a.padOk = true; }
  }
  const tipsFor = (a) => (a.envN ? a.env.slice(0, a.envN) : a.tipsL);      // (the wiggle's envelope while clawing)
  // How much air is under a point near a sole: its height over the nearest point of the sole's middle line, along the
  // way the sole faces (the heel and the ball stand proud of the arch: the line knows). A sole is not a plank: towards
  // its edge the skin rounds away (EDGE), so a fingertip beside the foot may sit lower than the middle of the sole;
  // past the edge it is beside the foot, not under it. Past the ball her toes may scrunch: 18 mm are kept for them.
  // 9 = not over a sole.
  const _y = V3(), EDGE = 0.012;
  const halfW = (u) => u < 0.5 ? 0.028 + 0.004 * u : u < 1 ? 0.03 + 0.026 * (u - 0.5) : 0.043 - 0.012 * (u - 1);      // heel, arch, ball, toes
  const _y2 = V3(), _sg = V3();
  const airOn = (f, p) => {
    let bi = 99, bd = 0.0144;
    for (let i = -2; i <= 54; i++) { along(f, i * 0.025, _y); const d = _y.distanceToSquared(p); if (d < bd) { bd = d; bi = i; } }
    if (bi === 99) return 9;
    let u = bi * 0.025, best = bd;                       // (10-03: the nearest point of the line between the samples on either side: no steps as a fingertip slides)
    for (const j of [bi - 1, bi + 1]) {
      if (j < -2 || j > 54) continue;
      along(f, bi * 0.025, _y); along(f, j * 0.025, _y2); _sg.subVectors(_y2, _y);
      const s = clamp(_e.subVectors(p, _y).dot(_sg) / _sg.lengthSq(), 0, 1), d = _y.addScaledVector(_sg, s).distanceToSquared(p);
      if (d < best) { best = d; u = (bi + (j - bi) * s) * 0.025; }
    }
    along(f, u, _y); _e.subVectors(p, _y);
    if ((bi === -2 || bi === 54) && Math.abs(_e.dot(f.fwd)) > 0.02) return 9;      // (past the back of the heel or the tips of the toes)
    const sd = Math.abs(_e.dot(f.side)), hw = halfW(u);
    if (sd > hw + 0.03) return 9;                        // (well beside the foot)
    const over = Math.max(0, sd - (hw - EDGE));
    return _e.dot(f.n) + over * over / (2 * EDGE) - 0.018 * sst(u, 1.075, 1.225);
  };
  const air = (p) => Math.min(airOn(feet[0], p), airOn(feet[1], p));

  function update(dt, t) {
    if (!T || !on) return;
    const { tw, arms } = T;
    // walking in, turning on the spot
    if (T.walk) {
      const wk = T.walk; _a.subVectors(wk.to, tw.obj.position).setY(0); const left = _a.length(), step = wk.v * dt;
      if (left <= step) { tw.obj.position.copy(wk.to); T.walk = null; tw.play(wk.idle || IDLE, 0.35); if (wk.then !== undefined) T.turn = wk.then; if (wk.done) wk.done(); }
      else { tw.obj.position.addScaledVector(_a, step / left); T.yaw = Math.atan2(_a.x, _a.z); }
    }
    if (T.follow && !T.walk) {
      // (10-05, as he said: "Boudicca doesn't stop walking... walks in place a lot") She stopped walking only once she was NOT
      // further off than her gap, and her last step put her exactly on it: whether she then stood or walked on the spot for
      // good was the last bit of a rounding error. She stops within 3 cm of it now.
      const fo = T.follow, goal = fo.fn(); _a.subVectors(goal, tw.obj.position).setY(0); const d = _a.length();
      // (only once whoever she follows stands still: behind someone who walks slower than she does she keeps step, as she did)
      const lead = fo.gx === undefined ? 0 : Math.hypot(goal.x - fo.gx, goal.z - fo.gz) / Math.max(dt, 1e-4); fo.gx = goal.x; fo.gz = goal.z;
      // (10-12, ledges: left at the foot or on the top of a rock face that Anne has climbed, she waits there; and she
      // takes no step that would leave the level they are both on)
      const LED = S.ledge, apart = LED && Math.abs(tw.obj.position.y) > 0.5;
      const go = !apart && d > fo.gap + (fo.moving ? (lead < 0.05 ? 0.03 : 0) : 0.35);
      const run = go && d > fo.gap + (fo.gait === 'Run' ? 1.2 : 2.6), gait = go ? (run ? 'Run' : 'Walk') : IDLE;      // (she runs to catch up when Anne gets ahead)
      if (gait !== fo.gait) { fo.gait = gait; fo.moving = go; const a = tw.play(go ? gait + BARE : gait, 0.3); if (a && go) a.timeScale = run ? 1 : a.getClip().duration / (1.52 / fo.v); }
      if (go) { const st = Math.min(d - fo.gap, (run ? 4.4 : fo.v) * dt) / d, p = tw.obj.position; if (!LED || LED.levelAt(p.x + _a.x * st, p.z + _a.z * st) === LED.level()) p.addScaledVector(_a, st); }
      if (d > 0.2) T.yaw = Math.atan2(_a.x, _a.z);
    }
    if (T.turn !== null && !T.walk) T.yaw = T.turn;
    if (o.tick) o.tick(tw, dt, t);                       // (what the figure wears that moves, and her hover: before her arms are aimed, so they aim from where she is)
    let dy = T.yaw - tw.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); tw.obj.rotation.y += dy * (1 - Math.exp(-dt * 7));
    for (const o of T.over) o.b.quaternion.copy(o.base);
    tw.mixer.update(dt);
    for (const o of T.over) o.base.copy(o.b.quaternion);
    tw.obj.updateMatrixWorld(true);
    // (10-02) leaning forward from the hips, on top of the clip (to bring her face down to a sole): her lower back takes
    // most of it, and her neck lifts her face back up to look where she leans
    T.lean = damp(T.lean, T.leanGoal, 8, dt);      // (10-03: 3.5 -> 8: steadier while she leans in to lick)
    if (T.lean > 0.004) {
      _d.set(1, 0, 0).applyQuaternion(tw.obj.quaternion);                  // (about her own left: + tips her top forward)
      [0.3, 0.32, 0.24, 0.14].forEach((w, i) => { const b = T.spine[i]; if (!b) return; b.getWorldQuaternion(_q); _q2.setFromAxisAngle(_d, T.lean * w).multiply(_q); setWorldQuat(b, _q2); });
      if (T.neck) { T.neck.getWorldQuaternion(_q); _q2.setFromAxisAngle(_d, -T.lean * 0.35).multiply(_q); setWorldQuat(T.neck, _q2); }
    }
    for (const sd in arms) { const a = arms[sd]; fingers(a, dt, t); aim(a, dt, t); showFingers(a, t); }
    tw.face.update(dt, t);
    // the least air seen (tests)
    for (const sd in arms) {
      const a = arms[sd]; if (a.w < 0.9) continue;
      if (a.feather.visible) { a.Wb.localToWorld(_c.copy(a.tipL)); gap.tip = Math.min(gap.tip, air(_c)); }
      if (a.mode === 'claw') { pads(a, false); }      // (the fingertips as they are shown, wiggle and all)
      if (a.mode === 'claw') a.tipsL.forEach((tl, k) => { const g = air(a.Wb.localToWorld(_c.copy(tl))) - PAD; if (g < gap.fingers) { gap.fingers = g; gap.ctx = [sd, k, +a.w.toFixed(3), +a.far.toFixed(3), +t.toFixed(2)]; } });
    }
  }

  return {
    gap,
    get made() { return !!T; },
    // show(at, yaw) puts her there at once; walk(from, to, yawThen) brings her in on foot
    show(at, yaw, clip) { if (!make()) return false; on = true; T.tw.obj.visible = true; T.tw.obj.position.copy(at); T.tw.obj.rotation.set(0, yaw, 0); T.yaw = yaw; T.turn = null; T.walk = null; T.tw.play(clip || IDLE, 0); gap.tip = gap.fingers = 9; return true; },
    // walk(from, to, yawThen, speed, idle): from = null walks on from where she stands; idle = the clip she stops in
    walk(from, to, yawThen, speed = 1.15, idle) {
      if (!make()) return Promise.resolve(false);
      on = true; const tw = T.tw; tw.obj.visible = true; if (from) tw.obj.position.copy(from); else from = tw.obj.position.clone(); T.yaw = Math.atan2(to.x - from.x, to.z - from.z); if (!T.walk) tw.obj.rotation.set(0, T.yaw, 0); T.turn = null;
      const a = tw.play('Walk' + BARE, 0.2); if (a) a.timeScale = a.getClip().duration / (1.52 / speed);
      return new Promise((res) => { T.walk = { to: to.clone(), v: speed, then: yawThen, idle, done: () => res(true) }; });
    },
    // follow(fn): each frame she walks towards fn() (null: stop), stopping `gap` metres short of it
    follow(fn, gapM = 1.1, speed = 1.3) { if (!make()) return; on = true; T.tw.obj.visible = true; T.turn = null; T.follow = fn ? { fn, gap: gapM, v: speed, moving: false } : null; if (!fn) T.tw.play(IDLE, 0.3); },
    face(yaw) { if (T) T.turn = T.yaw = yaw; },
    target(f) { feet = f || C.feet; },
    lean(a, now) { if (!T) return; T.leanGoal = Math.max(0, a); if (now) T.lean = T.leanGoal; },      // (radians, hips to shoulders)
    get leaning() { return T ? T.lean : 0; },
    get tw() { return T && T.tw; },
    clip(name, fade = 0.25) { if (T) T.tw.play(name, fade); },      // (10-02) any of Anne's clips: she sits by her feet when Anne is tied up
    hide() { on = false; if (!T) return; T.tw.obj.visible = false; T.walk = null; T.follow = null; for (const sd in T.arms) { const a = T.arms[sd]; a.fn = a.fn0 = null; a.w = 0; a.wr = 0; a.wk = 0; a.mode = 'easy'; a.hold = 'easy'; a.feather.visible = false; } },
    // arm(side).to(fn, mode): fn(point, dir, palm, t) names, each frame, where the feather's tip ('feather') or her fingertips ('claw', 'reach')
    // go, the way her hand points and the way its palm faces. to(null) gives the arm back to her clip.
    arm(sd) {
      const a = T && T.arms[sd]; if (!a) return { to() {}, hold() {}, feather() {} };
      return {
        to(fn, mode = 'reach', pole) { if (a.fn && fn) { a.fn0 = a.fn; a.sw = 0; a.mode0 = a.mode; } else { a.fn0 = null; a.sw = 1; } a.fn = fn; if (fn) a.mode = mode; if (pole) a.pole.copy(pole); },
        hold(name) { a.hold = name; },
        feather(show) { a.feather.visible = !!show; if (show) a.hold = 'pinch'; },
      };
    },
    expr(name, blush = 0) { if (T) T.tw.face.setExpression(name, blush); },
    talk(yes) { if (T) T.tw.face.setTalking(yes); },
    look(g) { if (T) T.tw.face.setGaze(g); },
    shoulder(sd, out = V3()) { const a = T && T.arms[sd]; return a ? a.Ub.getWorldPosition(out) : out; },
    head(out = V3()) { if (T) { const h = T.tw.bone('head'); if (h) h.getWorldPosition(out); out.y += 0.1; } return out; },
    get obj() { return T && T.tw.obj; },
    // (tests) where each aimed arm is: the point named, where the tip or the fingertips are, and how far the wrist was asked to go from the shoulder
    dbg() {
      const r = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)], out = { gap: { tip: +gap.tip.toFixed(4), fingers: +gap.fingers.toFixed(4) }, follow: T && T.follow ? { gait: T.follow.gait, moving: !!T.follow.moving } : null };
      if (T) for (const sd in T.arms) { const a = T.arms[sd]; a.Wb.updateWorldMatrix(true, false); const tip = a.Wb.localToWorld(V3().copy(a.mode === 'feather' ? a.tipL : a.padL));
        out[sd] = { w: +a.w.toFixed(2), mode: a.mode, off: a.pred ? +a.pred.distanceTo(a.Wb.getWorldPosition(V3())).toFixed(4) : -1, air: a.tipsL.map((tl) => +(air(a.Wb.localToWorld(V3().copy(tl))) - PAD).toFixed(4)), X: r(a.X), end: r(tip), miss: +tip.distanceTo(a.X).toFixed(3), far: +(a.far || 0).toFixed(3), reach: +(a.L1 + a.L2).toFixed(3), wrist: r(a.Wb.getWorldPosition(V3())), shoulder: r(a.Ub.getWorldPosition(V3())) }; }
      return out;
    },
    update,
  };
}
