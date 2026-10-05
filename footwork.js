// footwork.js (Chapter 2): one figure kneeling at the bare soles of another who sits with her legs out before her.
//
// The opening (story_library.js) worked this staging out for Lilith at Anne's chair: where to kneel so that both her
// shoulders are before the soles she works on (126 places tried with the arm solver itself: STG), her elbows down, her
// hands' paths over a sole. Chapter 2 has the same picture four times with other people in it: Camellia reads Anne's
// soles; Lilith in Anne's nightmare; Boudicca at the dryad's feet; Elora and Boudicca at a foot each of the thief in the
// stocks. So here it is once, for ANY sitter (Anne, or a second figure: `solesOf`) and any kneeling figure of thief.js's
// kind, on either side of the sitter's feet.
//
//   solesOf(S, root)            the soles of a second figure, as story_common.js reads Anne's (C.feet): [right, left],
//                               with .read(dt) to call each frame after her clip is applied, and .snap()
//   footWork(S, C, fig, feet, { side, kit, tongue })
//       side   +1: she kneels at the sitter's LEFT and works on her left sole (feet[1]); -1: at her right, on feet[0]
//       kit    the capture kit (captures.js), for a tongue; without it she can kiss a sole but not lick it
//     -> place(yaw)             where she kneels and which way she faces, for a sitter who faces `yaw`: { at, yaw }
//        hands(L, R, rest)      what each hand does: 'circle' | 'trail' | 'all' | 'toes' (a name ending in 0: on the sitter's
//                               OTHER sole) | 'brush' (the hand holds the scrub brush: one hand at a time) | null
//                               (rest: 'floor' = a hand set down on the floor before her, 'ready' = held up before her)
//        mouth({ lick, kiss, foot, u })   her lips to a sole; atSole(sec) resolves when they are there
//        lean(base)             how far she leans in while her hands work
//        pre(dt), post(dt)      call from S.late: pre, then fig.update, then post (her tongue from this frame's mouth)
// Nothing of hers goes into the sitter: the arms are thief.js's (fig.target(feet) tells them whose soles to keep their
// air over), the brush's bristles end at the skin.
export function solesOf(S, root) {
  const { V3 } = S;
  const feet = ['R', 'L'].map((sd) => {
    const f = { s: sd, mk: ['Heel', 'Arch', 'Ball', 'Out'].map((p) => root.getObjectByName(`Marker_Sole_${sd}_${p}`)),
      heel: V3(), arch: V3(), ball: V3(), out: V3(), n: V3(0, 0, 1), fwd: V3(0, 1, 0), side: V3(1, 0, 0), lat: V3(1, 0, 0),
      m1: [V3(), V3(), V3(), V3()], sHeel: V3(), sArch: V3(), sBall: V3(), sOutM: V3(), sn: V3(0, 0, 1), toe: root.getObjectByName('toe1-1' + sd) };
    f.real = [f.heel, f.arch, f.ball, f.out]; f.sm = [f.sHeel, f.sArch, f.sBall, f.sOutM];
    return f;
  });
  let snap = true; const _fa = V3();
  feet.ok = feet.every((f) => f.mk.every(Boolean));
  feet.read = (dt) => {
    root.updateMatrixWorld(true);
    const k = snap ? 1 : 1 - Math.exp(-3 * dt); snap = false;
    for (const f of feet) {
      for (let i = 0; i < 4; i++) { if (f.mk[i]) f.mk[i].getWorldPosition(f.real[i]); f.m1[i].lerp(f.real[i], k); f.sm[i].lerp(f.m1[i], k); }
      f.n.subVectors(f.out, f.arch); if (f.n.lengthSq() < 1e-10) f.n.set(0, 0, 1); f.n.normalize();
      f.fwd.subVectors(f.ball, f.heel); f.fwd.addScaledVector(f.n, -f.fwd.dot(f.n)).normalize();
      f.side.crossVectors(f.n, f.fwd);
      f.sn.subVectors(f.sOutM, f.sArch); if (f.sn.lengthSq() < 1e-10) f.sn.set(0, 0, 1); f.sn.normalize();
    }
    _fa.subVectors(feet[0].arch, feet[1].arch); if (_fa.lengthSq() < 1e-8) _fa.set(1, 0, 0); _fa.normalize();
    feet[0].lat.copy(_fa); feet[1].lat.copy(_fa).negate();
  };
  feet.snap = () => { snap = true; };
  return feet;
}

export function footWork(S, C, fig, feet, o = {}) {
  const { THREE, scene, V3 } = S, { along } = C, PI = Math.PI, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
  const side = o.side === -1 ? -1 : 1, FI = side > 0 ? 1 : 0, kit = o.kit || null, FLOOR_Y = o.floor || 0;      // (floor: how high the two of them are, if not on the ground)
  // where she kneels, from the middle of the two soles, for a sitter who faces +Z: STG.x to the sitter's left (times
  // `side`), STG.z beyond her toes; turned STG.yaw past square-on towards her; her lean while her hands work
  // (y0: the height of the soles these were measured for; a sitter of another length: `kneelFor`)
  const STG = Object.assign({ x: 0.42, z: 0.44, yaw: 0.75, lean: 0.4, y0: 0.429, dl: 0 }, o.stg || {}), TORSO = 0.316;
  const POLE = { L: V3(0.45, -1, -0.3), R: V3(-0.45, -1, -0.3) };
  const mid = V3(), _sh = V3(), _tg = V3(), _mo = V3(), _w = V3(), _p = V3();
  const soleMid = (out = mid) => out.addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5);
  function place(yaw) {
    soleMid();
    const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const at = V3(mid.x + lx * side * STG.x + fx * STG.z, FLOOR_Y, mid.z + lz * side * STG.x + fz * STG.z), ty = yaw + side * (-PI / 2 - STG.yaw);
    const dy = clamp(mid.y - FLOOR_Y - STG.y0, -0.06, 0.06), lean1 = clamp(Math.acos(clamp(Math.cos(STG.lean) + dy / TORSO, -1, 1)), 0.12, 0.85);
    STG.dl = lean1 - STG.lean; const back = TORSO * (Math.sin(lean1) - Math.sin(STG.lean));
    at.x -= Math.sin(ty) * back; at.z -= Math.cos(ty) * back;
    LK.home.copy(at);
    return { at, yaw: ty };
  }
  // the way a hand comes at a point of a sole: from her shoulder, along the sole's own plane, lifted off it by `lift`
  const approach = (sd, X, n, lift, dir) => { fig.shoulder(sd, _sh); _tg.subVectors(X, _sh); _tg.addScaledVector(n, -_tg.dot(n)); if (_tg.lengthSq() < 1e-6) _tg.set(0, 1, 0); _tg.normalize(); return dir.copy(_tg).multiplyScalar(Math.cos(lift)).addScaledVector(n, -Math.sin(lift)); };
  // (at the sitter's left her right hand is the one at the arch and her left at the ball and the toes; at the sitter's
  // right it is the other way round)
  // (10-05, review) which of her hands works nearer the heel ('a') and which at the ball and the toes ('b'): set by `hands`
  const ROLE = { L: side > 0 ? 'b' : 'a', R: side > 0 ? 'a' : 'b' };
  const U = (sd, a, b) => (ROLE[sd] === 'a' ? a : b);
  const HANDS = {
    circle: (sd, fi) => (X, dir, palm, t) => { const f = feet[fi], a = t * 1.9 + U(sd, 0, 2); along(f, U(sd, 0.5, 0.95) + 0.07 * Math.cos(a), X).addScaledVector(f.side, 0.018 * Math.sin(a)).addScaledVector(f.n, 0.012); approach(sd, X, f.n, 0.45, dir); palm.copy(f.n).negate(); },
    trail: (sd, fi) => (X, dir, palm, t) => { const f = feet[fi], w = 0.5 + 0.5 * Math.sin(t * 0.85 + U(sd, 0, 1.6)); along(f, U(sd, 0.4 + 0.35 * w, 0.75 + 0.4 * w), X).addScaledVector(f.n, 0.008); approach(sd, X, f.n, 0.45, dir); palm.copy(f.n).negate(); },
    all: (sd, fi) => (X, dir, palm, t) => { const f = feet[fi]; along(f, U(sd, 0.58, 1.0) + 0.14 * Math.sin(t * 2.3 + U(sd, 0, 1.3)), X).addScaledVector(f.side, 0.012 * Math.sin(t * 3.4)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.6, dir); palm.copy(f.n).negate(); },
    toes: (sd, fi) => (X, dir, palm, t) => { const f = feet[fi]; along(f, U(sd, 0.92, 1.15) + 0.05 * Math.sin(t * 2.1 + U(sd, 0, 1)), X).addScaledVector(f.side, 0.013 * Math.sin(t * 2.9)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.55, dir); palm.copy(f.n).negate(); },
    // one fingertip that follows a line of the sole and stops, as someone reading it would
    read: (sd, fi) => (X, dir, palm, t) => { const f = feet[fi], w = 0.5 + 0.5 * Math.sin(t * 0.5 + U(sd, 0, 2.2)); along(f, U(sd, 0.38 + 0.3 * w, 0.72 + 0.34 * w), X).addScaledVector(f.side, 0.012 * Math.sin(t * 0.37 + U(sd, 0, 1))).addScaledVector(f.n, 0.006); approach(sd, X, f.n, 0.4, dir); palm.copy(f.n).negate(); },
  };
  // the scrub brush: a wooden back with a handle and a bed of bristles. It is put where its bristles' ends meet the sole,
  // scrubbing up and down it, and the hand that holds it is sent to its handle.
  let brush = null; const BR = { sd: null, fi: FI, k: 0 }, _bx = V3(), _by = V3(), _bz = V3(), _bm = new THREE.Matrix4(), BRISTLE = 0.022;
  function makeBrush() {
    const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 }), hair = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.095, 0.014), wood); back.position.set(0, 0, BRISTLE + 0.007); back.castShadow = true; g.add(back);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.11, 10), wood); handle.position.set(0, -0.098, BRISTLE + 0.008); handle.castShadow = true; g.add(handle);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 9; j++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0034, BRISTLE, 5), hair); b.rotation.x = PI / 2; b.position.set((i - 2) * 0.0095, (j - 4) * 0.0098, BRISTLE / 2); g.add(b); }
    g.visible = false; scene.add(g); return g;      // (its own frame: +Z from the bristles' ends to its back, +Y along it, the handle at -Y)
  }
  const brushFn = (sd, fi) => (X, dir, palm, t) => {
    const f = feet[fi], u = 0.42 + 0.22 * Math.sin(t * 5.2), ac = 0.008 * Math.sin(t * 3.1);      // (heel to ball: its bed of bristles is 9 cm long, and the toes are the other hand's)
    along(f, u, _p).addScaledVector(f.side, ac).addScaledVector(f.n, 0.0015);       // where the bristles' ends are
    fig.shoulder(sd, _sh); _by.subVectors(_p, _sh); _by.addScaledVector(f.n, -_by.dot(f.n)).normalize();      // the brush lies along the line from her shoulder, flat on the sole
    _bz.copy(f.n); _bx.crossVectors(_by, _bz).normalize();
    if (brush) { brush.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz)); brush.position.copy(_p); }
    X.copy(_p).addScaledVector(_by, -0.105).addScaledVector(f.n, BRISTLE + 0.03);      // her fingertips at the handle, a little over it
    dir.copy(_by).multiplyScalar(0.92).addScaledVector(f.n, -0.38).normalize(); palm.copy(f.n).negate();
  };
  // a hand with nothing to do: set down on the floor before her shoulder, or held up before her
  const FLOOR = (sd) => (X, dir, palm) => { fig.shoulder(sd, _sh); const yaw = fig.obj.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), q = sd === 'L' ? 0.05 : -0.05; X.set(_sh.x + fx * 0.11 + Math.cos(yaw) * q, fig.obj.position.y + 0.014, _sh.z + fz * 0.11 - Math.sin(yaw) * q); dir.set(fx, 0, fz); palm.set(0, -1, 0); };
  const READY = (sd) => (X, dir, palm) => { fig.shoulder(sd, _sh); const yaw = fig.obj.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), q = sd === 'L' ? 0.03 : -0.03; X.set(_sh.x + fx * 0.27 + Math.cos(yaw) * q, _sh.y - 0.15, _sh.z + fz * 0.27 - Math.sin(yaw) * q); dir.set(fx, 0.1, fz).normalize(); palm.set(fx * 0.3, -1, fz * 0.3).normalize(); };
  function hands(L, R, rest = null) {
    BR.sd = null;
    // Two hands on ONE sole keep to their own halves of it (nothing keeps a hand out of the other hand). The a hand's 'toes'
    // reaches up into the b hand's ground: sent there alone, the two change jobs. Beside the brush, which scrubs heel to
    // ball, the other hand keeps to the toes.
    ROLE.L = side > 0 ? 'b' : 'a'; ROLE.R = side > 0 ? 'a' : 'b';
    const aSd = side > 0 ? 'R' : 'L', bSd = aSd === 'R' ? 'L' : 'R', N = { L, R }, other = (n) => /0$/.test(n), isBrush = (n) => /^brush/.test(n);
    if (N.L && N.R && other(N.L) === other(N.R)) {
      if (isBrush(N.L) !== isBrush(N.R)) { const q = isBrush(N.L) ? 'R' : 'L'; N[q] = 'toes' + (other(N[q]) ? '0' : ''); ROLE[q] = 'b'; }
      else if (!isBrush(N.L) && /^toes/.test(N[aSd]) && !/^toes/.test(N[bSd])) { const t = N[aSd]; N[aSd] = N[bSd]; N[bSd] = t; }
    }
    for (const [sd, n] of [['L', N.L], ['R', N.R]]) {
      const arm = fig.arm(sd);
      if (n === 'brush' || n === 'brush0') { if (!brush) brush = makeBrush(); BR.sd = sd; BR.fi = n === 'brush0' ? 1 - FI : FI; arm.hold('grip'); arm.to(brushFn(sd, BR.fi), 'reach', POLE[sd]); continue; }
      arm.hold('easy');
      const other = n && /0$/.test(n), name = n ? n.replace(/0$/, '') : null;
      arm.to(name ? HANDS[name](sd, other ? 1 - FI : FI) : rest === 'floor' ? FLOOR(sd) : rest === 'ready' ? READY(sd) : null, name ? 'claw' : 'reach', POLE[sd]);
    }
  }
  // ---------- her lips at a sole: a kiss, or (with the kit's tongue) a lick ----------
  const tongue = kit && kit.makeTongue ? kit.makeTongue(o.tongue || '#cf4f6c') : null;
  const LK = { on: false, kiss: false, k: 0, foot: FI, u: 0.55, home: V3(), lean: 0, base: 0, close: false };
  const MOUTH = { rate: 3.0, vmax: 0.28, leanRate: 3.5, leanMax: 0.7, lick: 2.0 };
  function pre(dt) {
    BR.k = damp(BR.k, BR.sd ? 1 : 0, 6, dt); if (brush) brush.visible = BR.k > 0.5 && !!fig.obj && fig.obj.visible;
    const tw = fig.tw; if (!tw || !fig.obj) return;
    const near = (LK.on || LK.kiss) && !!tw.mouth;
    LK.k = damp(LK.k, LK.on && LK.close ? 1 : 0, 4, dt);
    if (near) {
      const f = feet[LK.foot]; tw.mouth.getWorldPosition(_mo);
      along(f, LK.u + (LK.kiss ? 0.2 * Math.sin(S.time() * 0.8) : 0.12 * Math.sin(S.time() * 0.5)), _w).addScaledVector(f.n, LK.kiss ? 0.03 : 0.05);
      _w.sub(_mo); LK.close = _w.length() < 0.075;
      const e = Math.hypot(_w.x, _w.z), step = Math.min(e * (1 - Math.exp(-dt * MOUTH.rate)), MOUTH.vmax * dt);
      if (e > 1e-5) { fig.obj.position.x += _w.x / e * step; fig.obj.position.z += _w.z / e * step; }
      LK.lean = clamp(LK.lean + clamp(-_w.y * MOUTH.leanRate, -MOUTH.leanMax, MOUTH.leanMax) * dt, 0, 1.5); fig.lean(LK.lean);
    } else {
      LK.close = false;
      if (!LK.held) return;                          // (not on her knees here yet, or no longer: her lean and her place are her own)
      if (Math.abs(LK.lean - LK.base) > 1e-3) { LK.lean += clamp(LK.base - LK.lean, -dt * 1.2, dt * 1.2); fig.lean(LK.lean); }
      if (fig.obj.position.distanceToSquared(LK.home) > 1e-6) { fig.obj.position.x += (LK.home.x - fig.obj.position.x) * Math.min(1, dt * 3); fig.obj.position.z += (LK.home.z - fig.obj.position.z) * Math.min(1, dt * 3); }
    }
  }
  function post(dt) {
    if (!tongue) return;
    const tw = fig.tw;
    if (tw && tw.mouth && LK.on && LK.k > 0.03) { tw.mouth.getWorldPosition(_mo); kit.lick(tongue, _mo, feet[LK.foot], dt, LK.k, MOUTH.lick, 0.014, 0.0045); } else tongue.hide();
  }
  const atSole = (sec = 2.6) => { let t = 0; return S.until((dt) => { t += dt; return LK.close || t > sec; }); };
  return {
    STG, LK, HANDS, feet, side, place, hands, pre, post, atSole, soleMid,
    // put her on her knees at the sitter's feet, at once (behind a cut)
    kneel(yaw, clip = 'KneelSit') { const P = place(yaw); fig.show(P.at, P.yaw, clip); fig.target(feet); LK.held = true; LK.base = 0.12; LK.lean = 0.12; fig.lean(0.12, true); return P; },
    lean(base, now) { LK.base = base === undefined ? STG.lean + STG.dl : base; if (now) { LK.lean = LK.base; fig.lean(LK.base, true); } },
    work() { LK.base = STG.lean + STG.dl; },
    mouth(m = {}) { LK.on = !!m.lick && !!tongue; LK.kiss = !!m.kiss || (!!m.lick && !tongue); if (m.foot !== undefined) LK.foot = m.foot; else LK.foot = FI; if (m.u !== undefined) LK.u = m.u; },
    done() { hands(null, null); LK.on = LK.kiss = false; LK.held = false; LK.base = 0; if (tongue) tongue.hide(); if (brush) brush.visible = false; BR.sd = null; BR.k = 0; fig.target(null); fig.lean(0); },
    get brush() { return brush; },
  };
}
