// ties.js: what binds her when a creature has her lying on her front (captures.js `bound`), after the log scene's ties
// (logscene.js, which keeps its own copy): a cord wound round BOTH ankles with a knot on top, a string looped round each
// big toe with a twist between them, and its end pegged down taut a hand's breadth beyond her toes. All of it follows her
// bones every frame and lies on her skin with a little air: nothing cuts into her.
//
//   createTies({ THREE, scene, anne }) -> { look(theme), set({ on, k, knot, toe, peg, taut, wrists, hog }), placePeg(), update(), burst(fn), ok }
// (10-02) wrists: a cord round both wrists crossed behind her back (0..1 as it is wound); hog: the short line from that
// knot to the one at her ankles (Boudicca's hogtie in the epilogue).
//   themes: 'rope' (twine), 'vine' (green stems), 'hyphae' (pale fungal threads), 'silk' (a fairy's pink ribbon), 'mist' (a ghost's), 'tentacle' (Scylla's)
export function createTies({ THREE, scene, anne, A }) {      // (A: her own interface, anne_next.js: for A.anklesTogether)
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), PI = Math.PI;
  const BN = { shin: ['lowerleg02R', 'lowerleg02L'], foot: ['footR', 'footL'], toe: ['toe1-1R', 'toe1-1L'] };
  for (const k in BN) BN[k] = BN[k].map((n) => anne.getObjectByName(n) || null);
  const ok = Object.values(BN).every((a) => a.every(Boolean));
  const BW = { arm: ['lowerarm02R', 'lowerarm02L'], wrist: ['wristR', 'wristL'] };
  for (const k in BW) BW[k] = BW[k].map((n) => anne.getObjectByName(n) || null);
  const okW = Object.values(BW).every((a) => a.every(Boolean));
  const root = new THREE.Group(); root.name = 'Ties'; scene.add(root);
  const THEMES = {
    rope: ['#d9b574', '#9a7440', '#7d5126'], vine: ['#4f8a36', '#24481c', '#2f5a22'], hyphae: ['#efe8d4', '#b9b09a', '#d8d0bc'],
    silk: ['#ffb3d6', '#d1578f', '#e47aaa'], mist: ['#cfe8ff', '#7fa6d6', '#a9c8ec'],
    tentacle: ['#a06ad0', '#4a2068', '#8a4cb8'],                   // (10-02: Scylla's)
  };
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const ropeMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), stringMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const woodMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#8a6238').multiplyScalar(0.8) });
  const cordMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // The cord: a helix of CT turns round both shins, 3 to 8 cm above the ankle joints (as in the log scene)
  const CT = 4.5, CSEG = 22, CS = 7, CN = Math.round(CT * CSEG) + 1, C_R = 0.0044, RU = 0.0235, RV = 0.0305;
  const cgeo = new THREE.BufferGeometry(), cpos = new Float32Array(CN * CS * 3), cnor = new Float32Array(CN * CS * 3), ccol = new Float32Array(CN * CS * 3), cidx = [];
  for (let i = 0; i < CN - 1; i++) for (let k = 0; k < CS; k++) { const a = i * CS + k, b = i * CS + (k + 1) % CS; cidx.push(a, a + CS, b, b, a + CS, b + CS); }
  cgeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3).setUsage(THREE.DynamicDrawUsage)); cgeo.setAttribute('normal', new THREE.BufferAttribute(cnor, 3).setUsage(THREE.DynamicDrawUsage));
  cgeo.setAttribute('color', new THREE.BufferAttribute(ccol, 3)); cgeo.setIndex(cidx);
  const cord = new THREE.Mesh(cgeo, cordMat); cord.frustumCulled = false; cord.castShadow = true; cord.visible = false; root.add(cord);
  const knot = new THREE.Group(); knot.visible = false; root.add(knot);
  {
    const tor = new THREE.TorusGeometry(1, 0.118, 7, 28);
    for (const dz of [-0.0045, 0.0045]) { const m = new THREE.Mesh(tor, ropeMat); m.scale.set(RV + C_R + 0.0035, 0.031, 0.037); m.position.z = dz; m.castShadow = true; knot.add(m); }
    const lump = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), ropeMat); lump.scale.set(0.0075, 0.0085, 0.0105); lump.position.set(RV + C_R + 0.0075, 0, 0); knot.add(lump);
    for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0038, 0.04, 6), ropeMat); e.position.set(RV + C_R + 0.012, 0.004, sz * 0.02); e.rotation.set(0.5, 0, sz * 1.15); knot.add(e); }
  }
  // the loops round her big toes (bone space: the pad of the toe lies on the bone's +Z side)
  const TOE_OFF = [V3(-0.0036, 0.013, 0.0056), V3(0.0036, 0.013, 0.0056)], TOE_RX = 0.0146, TOE_RZ = 0.0116;
  const toeLoopGeo = (() => {
    const a = new THREE.TorusGeometry(1, 0.15, 6, 26), b = a.clone(); a.translate(0, 0, -0.17); b.translate(0, 0, 0.17);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array, na = a.attributes.normal.array, nb = b.attributes.normal.array, n = pa.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([...na, ...nb], 3));
    g.setIndex([...a.index.array, ...Array.from(b.index.array, (i) => i + n)]); return g;
  })();
  const toeLoops = [0, 1].map(() => { const m = new THREE.Mesh(toeLoopGeo, stringMat); m.visible = false; m.frustumCulled = false; root.add(m); return m; });
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); unitCyl.translate(0, 0.5, 0);
  const line = (mat) => { const m = new THREE.Mesh(unitCyl, mat); m.visible = false; m.frustumCulled = false; root.add(m); return m; };
  const toeTwist = line(stringMat), toeTail = line(stringMat);
  const peg = new THREE.Group(); peg.visible = false; root.add(peg);
  {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.006, 0.1, 9), woodMat); st.position.y = 0.05; st.castShadow = true; peg.add(st);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0105, 0.012, 9), woodMat); cap.position.y = 0.1; peg.add(cap);
  }
  const PEG_UP = 0.058, pegAt = V3(), pegTop = V3();
  // the wrists' cord: three turns round both crossed wrists (ellipses about the forearms' line) and a knot on top
  const wrap = new THREE.Group(); wrap.visible = false; root.add(wrap);
  const wrapRings = [-0.013, 0, 0.013].map((dz) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 6, 30), ropeMat); m.userData.dz = dz; m.castShadow = true; m.frustumCulled = false; root.add(m); m.visible = false; return m; });
  const wrapKnot = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), ropeMat); wrapKnot.visible = false; wrapKnot.castShadow = true; root.add(wrapKnot);
  const hogLine = line(ropeMat);
  const T = { on: false, k: 0, knot: 0, toe: 0, peg: 0, taut: 0, wrists: 0, hog: 0 };
  const wA = V3(), wB = V3(), wAx = V3(), wU = V3(), wV = V3(), wC = V3(), wTop = V3();
  const tC = V3(), tU = V3(), tV = V3(), tAx = V3(), tS = V3(), tF0 = V3(), tF1 = V3(), tP = V3(), tQ = V3(), tT = V3(), tN = V3(), tB2 = V3(), tW = V3(), tToe = V3();
  const _a = V3(), _b = V3(), _c = V3(), _q = new THREE.Quaternion(), _tq = new THREE.Quaternion(), _tm = new THREE.Matrix4(), _tx = V3(), _ty = V3(), _tz = V3();
  let tieD = 0.08;
  function frame() {
    BN.foot[0].getWorldPosition(tF0); BN.foot[1].getWorldPosition(tF1);
    BN.shin[0].getWorldPosition(_a); BN.shin[1].getWorldPosition(_b);
    tAx.subVectors(tF0, _a).add(_c.subVectors(tF1, _b)).normalize();
    tU.subVectors(tF1, tF0); tieD = tU.length(); tU.addScaledVector(tAx, -tU.dot(tAx)).normalize();
    tV.crossVectors(tAx, tU).normalize(); if (tV.y < 0) tV.negate();
    tC.addVectors(tF0, tF1).multiplyScalar(0.5);
    tS.set(tAx.x, 0, tAx.z); if (tS.lengthSq() < 1e-6) tS.set(0, 0, 1); tS.normalize();
    tW.copy(tC).addScaledVector(tAx, -0.055);
    BN.toe[0].getWorldPosition(_a); BN.toe[1].getWorldPosition(_b); tToe.addVectors(_a, _b).multiplyScalar(0.5);
  }
  // (batch 23: her ankles are as thick as the player made her: her body's length, and a third of its width)
  const bodyK = () => { const B = A.body ? A.body() : null; return B ? B.h * (1 + (B.w - 1) * 0.35) : 1; };
  const cordAt = (q, out) => { const a = q * CT * PI * 2, ca = Math.cos(a), bk = bodyK(); return out.copy(tC).addScaledVector(tAx, -(0.032 + 0.046 * q)).addScaledVector(tU, tieD * 0.5 * Math.tanh(3.2 * ca) + RU * bk * ca).addScaledVector(tV, RV * bk * Math.sin(a)); };
  function span(m, A0, A1, r) {
    _ty.subVectors(A1, A0); const len = _ty.length(); if (len < 1e-5) { m.visible = false; return; }
    _ty.divideScalar(len); _tx.set(1, 0, 0); if (Math.abs(_ty.x) > 0.9) _tx.set(0, 0, 1);
    _tz.crossVectors(_tx, _ty).normalize(); _tx.crossVectors(_ty, _tz);
    _tm.makeBasis(_tx, _ty, _tz); m.quaternion.setFromRotationMatrix(_tm); m.position.copy(A0); m.scale.set(r, len, r); m.visible = true;
  }
  function look(theme = 'rope') {
    const [A, B, S] = (THEMES[theme] || THEMES.rope).map(lin), glow = theme === 'silk' || theme === 'mist';
    for (let i = 0; i < CN; i++) for (let k = 0; k < CS; k++) { const c = mixc(B, A, 0.5 + 0.5 * Math.sin(k / CS * PI * 4 + i * 1.3)), o = (i * CS + k) * 3; ccol[o] = c[0] * 0.85; ccol[o + 1] = c[1] * 0.85; ccol[o + 2] = c[2] * 0.85; }
    cgeo.attributes.color.needsUpdate = true;
    ropeMat.color.setRGB(...mixc(A, B, 0.4)).multiplyScalar(0.85); stringMat.color.setRGB(...S).multiplyScalar(0.9);
    for (const m of [ropeMat, stringMat, cordMat]) { m.emissive = m.emissive || new THREE.Color(); m.emissive.setRGB(...(glow ? mixc(A, [0, 0, 0], 0.55) : [0, 0, 0])); }
    peg.visible = false;
  }
  function placePeg() {                              // a hand's breadth beyond her toes; it leans away from the pull
    if (!ok) return;
    frame(); pegAt.set(tToe.x + tS.x * 0.17, 0, tToe.z + tS.z * 0.17);
    peg.quaternion.setFromAxisAngle(_tx.set(tS.z, 0, -tS.x), 0.3);
    pegTop.copy(pegAt).addScaledVector(tS, 0.012); pegTop.y = PEG_UP - 0.016;
  }
  function updWrists(on) {
    const show = on && okW && T.wrists > 0;
    for (const m of wrapRings) m.visible = show; wrapKnot.visible = show && T.wrists > 0.8; hogLine.visible = show && ok && T.hog > 0;
    if (!show) return;
    BW.wrist[0].getWorldPosition(wA); BW.wrist[1].getWorldPosition(wB);
    BW.arm[0].getWorldPosition(_a); BW.arm[1].getWorldPosition(_b);
    wAx.subVectors(wA, _a).add(_c.subVectors(wB, _b)).normalize();
    wU.subVectors(wB, wA); const d = wU.length(); wU.addScaledVector(wAx, -wU.dot(wAx)); if (wU.lengthSq() < 1e-8) wU.set(1, 0, 0); wU.normalize();
    wV.crossVectors(wAx, wU).normalize(); if (wV.y < 0) { wV.negate(); wU.negate(); }
    wC.addVectors(wA, wB).multiplyScalar(0.5).addScaledVector(wAx, -0.032);
    const R = 0.0275, a = (d * 0.5 + R) * (1 + 0.6 * (1 - T.wrists)), b = (R + 0.003) * (1 + 0.6 * (1 - T.wrists));
    _tm.makeBasis(wU, wV, wAx);
    wrapRings.forEach((m, i) => { m.visible = T.wrists > i / 3; m.quaternion.setFromRotationMatrix(_tm); m.position.copy(wC).addScaledVector(wAx, m.userData.dz); m.scale.set(a, b, 0.04); });
    wTop.copy(wC).addScaledVector(wV, b + 0.004); wrapKnot.position.copy(wTop); wrapKnot.scale.set(0.009, 0.008, 0.011);
    if (hogLine.visible) { frame(); _a.lerpVectors(wTop, tW, Math.min(1, T.hog)); span(hogLine, wTop, _a, 0.0042); }
  }
  function update() {
    // (10-03, as he asked) tied ankles are clamped right next to each other: as the cord goes on, her ankles are drawn together
    if (A && A.anklesTogether) A.anklesTogether(T.on && ok ? Math.min(1, T.k * 2) : 0);
    updWrists(T.on);
    const on = T.on && ok;
    cord.visible = on && T.k > 0.01; knot.visible = on && T.knot > 0; peg.visible = on && T.peg > 0;
    toeLoops[0].visible = toeLoops[1].visible = on && T.toe > 0; toeTwist.visible = on && T.toe > 0.5; toeTail.visible = on && T.taut > 0;
    if (!on) return;
    frame();
    if (cord.visible) {
      const P = cgeo.attributes.position, N = cgeo.attributes.normal, pa = P.array, na = N.array, n = Math.max(2, Math.round(1 + T.k * (CN - 1)));
      for (let i = 0; i < n; i++) {
        const q = i / (CN - 1); cordAt(q, tP); cordAt(Math.min(1, q + 0.004), tQ).sub(cordAt(Math.max(0, q - 0.004), tT)); tQ.normalize();
        tN.copy(tAx).addScaledVector(tQ, -tAx.dot(tQ)).normalize(); tB2.crossVectors(tQ, tN);
        const r = C_R * Math.min(1, 0.45 + (n - 1 - i) * 0.4, 0.45 + i * 0.4);
        for (let k = 0; k < CS; k++) {
          const an = k / CS * PI * 2, cx = Math.cos(an), sx = Math.sin(an), o = (i * CS + k) * 3, nx = tN.x * cx + tB2.x * sx, ny = tN.y * cx + tB2.y * sx, nz = tN.z * cx + tB2.z * sx;
          pa[o] = tP.x + nx * r; pa[o + 1] = tP.y + ny * r; pa[o + 2] = tP.z + nz * r; na[o] = nx; na[o + 1] = ny; na[o + 2] = nz;
        }
      }
      cgeo.setDrawRange(0, (n - 1) * CS * 6); P.needsUpdate = true; N.needsUpdate = true;
    }
    if (knot.visible) { _tz.crossVectors(tV, tAx).normalize(); _tm.makeBasis(tV, tAx, _tz); knot.quaternion.setFromRotationMatrix(_tm); knot.position.copy(tW); knot.scale.setScalar(1 + 0.25 * (1 - T.knot)); }
    if (toeLoops[0].visible) {
      for (let j = 0; j < 2; j++) {
        const b = BN.toe[j], m = toeLoops[j], k = 1 + 0.8 * (1 - T.toe);
        b.getWorldQuaternion(_tq); m.quaternion.copy(_tq).multiply(_q.setFromAxisAngle(_tx.set(1, 0, 0), PI / 2));
        b.localToWorld(m.position.copy(TOE_OFF[j])); m.scale.set(TOE_RX * k, TOE_RZ * k, 0.0125);
      }
      if (toeTwist.visible) span(toeTwist, toeLoops[0].position, toeLoops[1].position, 0.0024);
      if (toeTail.visible) { tP.addVectors(toeLoops[0].position, toeLoops[1].position).multiplyScalar(0.5); span(toeTail, tP, pegTop, 0.002); }
    }
    if (peg.visible) { peg.position.copy(pegAt); peg.position.y = PEG_UP - 0.1 + 0.06 * (1 - T.peg); }
  }
  // she tears herself free: everything goes (fn(point) is given the band's and the toes' places for a burst of something)
  function burst(fn) { if (T.on && ok) { frame(); if (fn) { fn(tW.clone()); fn(tToe.clone()); } } T.on = false; update(); }
  look('rope');
  return { ok, okW, look, set(s) { Object.assign(T, s); }, get state() { return T; }, placePeg, update, burst, band: () => (frame(), tW.clone()), toes: () => (frame(), tToe.clone()) };
}
