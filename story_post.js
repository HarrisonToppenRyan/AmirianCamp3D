// story_post.js: the Trader Post (the 2D game's Map 53, 25x25), the campsite on the road south where Chapter 2 opens.
// Nothing here is required by the story (the 2D's GAME_PROGRESS never changes at the camp), and in the 2D it lies BEFORE
// the Forest of Lys: the camp's south trail drops straight into the forest.
//   - Camellia Flaire, the travelling apothecary and fortune teller, at her stall by her tent (CE 180: MEETING1, her
//     questions, FORTUNE / GIPSY: she reads Anne's future from the lines of her SOLES for 100 gold, kissing and licking
//     them to "read the wrinkles"; if Anne cannot hold still she tickles them and tries again. The reading of this chapter
//     (CE 135) describes the blue thief, hiding in the capital)
//   - the fire (CE 190): rest until morning. The first night of this chapter is one of Lilith's nightmares (CE 191 ->
//     CE 49 NIGHTMARE; of its six variants the 2D picks one at random: two are not for this game, and of the others this is
//     the one about her feet, variant 2). A key prompt to wake up; missed, she goes on.
//   - things to look at: the signpost, the locked cabin of the fortune teller, the empty stone pool, the dead tree, and
//     the purse somebody left behind the tent (the 2D's 1000 gold: the thief took all of theirs, and the reading costs 100)
// Content rule, as everywhere in this game: Anne stays dressed (the 2D's nightmare pictures do not; here she is in the
// chair of the library again, as she was the first night, only her shoes and hat off); the 2D's other night scenes at this
// camp (the sleeping Camellia, the sleeping Boudicca) are not built. Lines are the 2D's own.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);
const { createLilith } = await import('./lilith.js' + V);
const cast = await import('./cast2.js' + V);
const { footWork } = await import('./footwork.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3 } = S, C = common(S), { sparks, feet, K } = C;
  const capt = createCaptures(S, C, env), stg = capt.stage, kit = capt.kit;
  const bou = createBoudicca(S, C), cam = cast.createCamellia(S, C), lil = createLilith(S, C);
  const PI = Math.PI, post = env.post, tc = (x, y) => S.tileC(x, y), has = (n) => A.hasClip && A.hasClip(n);
  const pick = (L) => L[Math.floor(Math.random() * L.length)];
  const grade = (g) => { if (post && post.setGrade) post.setGrade(...g); };
  const DAY = [1.04, 1.0, 0.95, 0.06, 1.0], DREAM_G = [0.86, 0.8, 1.12, 0.26, 0.95];
  grade(DAY);
  const VIOLET = new THREE.Color(1.3, 0.5, 1.9), GOLD = new THREE.Color(1.7, 1.3, 0.4);
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const add = (m, sh = true) => { m.castShadow = sh; m.receiveShadow = true; scene.add(m); return m; };
  const box = (w, h, d, m, x, y, z, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; return add(b); };
  const wood = M({ color: 0x8a6238, roughness: 0.8 }), dark = M({ color: 0x4a3524, roughness: 0.85 }), stone = M({ color: 0x8a867e, roughness: 0.95 });

  // =====================================================================================================
  //                                                 the camp
  // =====================================================================================================
  const FIRE = S.tileC(...S.level.campfire);
  // Camellia's stall: a trestle table before her tent, with her jars, bottles and bundles; a striped awning over it
  const STALL = V3(tc(16, 5).x, 0, tc(16, 5).z - 0.05), CAM_AT = V3(tc(17, 5).x + 0.25, 0, tc(17, 5).z + 0.45);
  {
    box(1.7, 0.06, 0.66, wood, STALL.x, 0.82, STALL.z); for (const [dx, dz] of [[-0.75, -0.26], [0.75, -0.26], [-0.75, 0.26], [0.75, 0.26]]) box(0.06, 0.8, 0.06, dark, STALL.x + dx, 0.4, STALL.z + dz);
    const cloth = add(new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.02, 0.72), M({ color: 0x6a2a5a, roughness: 0.9 }))); cloth.position.set(STALL.x, 0.86, STALL.z);
    const COLS = [0x4a9a5a, 0xb04a6a, 0x5a7ad0, 0xd0a030, 0x8a5ad0, 0x3a9a9a, 0xd06a3a];
    for (let i = 0; i < 9; i++) { const h = 0.12 + (i % 3) * 0.05, j = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, h, 10), M({ color: COLS[i % 7], roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 }))); j.position.set(STALL.x - 0.7 + i * 0.175, 0.87 + h / 2, STALL.z - 0.14 + (i % 2) * 0.22);
      const cork = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), dark), false); cork.position.set(j.position.x, 0.87 + h + 0.015, j.position.z); }
    const mortar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.055, 0.09, 12), stone)); mortar.position.set(STALL.x + 0.62, 0.915, STALL.z + 0.18);
    const pestle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.16, 6), stone), false); pestle.position.set(STALL.x + 0.64, 0.98, STALL.z + 0.18); pestle.rotation.z = 0.5;
    for (const s of [-1, 1]) box(0.05, 2.1, 0.05, dark, STALL.x + s * 0.88, 1.05, STALL.z + 0.36);
    const aw = add(new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1, 8, 1), M({ roughness: 0.9, side: THREE.DoubleSide, vertexColors: true }))); aw.rotation.x = -PI / 2 + 0.3; aw.position.set(STALL.x, 2.0, STALL.z - 0.1);
    { const P = aw.geometry.attributes.position, colr = [], c1 = new THREE.Color(0xb03a6a), c2 = new THREE.Color(0xf2e6d8); for (let i = 0; i < P.count; i++) { const c = Math.floor((P.getX(i) + 1.0) / 0.25 + 0.01) % 2 ? c1 : c2; colr.push(c.r, c.g, c.b); } aw.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); }
    for (let i = 0; i < 4; i++) { const b = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), M({ color: [0x4a7a3a, 0x7a5a9a, 0x8a7a3a, 0x3a7a6a][i], roughness: 0.9 })), false); b.position.set(STALL.x - 0.6 + i * 0.4, 1.72, STALL.z + 0.34); b.rotation.x = PI; }      // (bundles of herbs hung to dry)
    S.block('stall', STALL.x, STALL.z, 1.0);
  }
  // the chair she reads soles in: cushioned, with arms, beside the stall
  const SEATR = V3(tc(18, 6).x + 0.3, 0, tc(18, 6).z + 0.25), SEAT_YAW = -0.93;
  const chair = (at, yaw, m1, m2, o = {}) => {
    const g = new THREE.Group(); g.position.copy(at); g.rotation.y = yaw; scene.add(g);
    const b = (w, h, d, m, x, y, z) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; g.add(k); return k; };
    b(0.66, 0.07, 0.56, m1, 0, 0.405, -0.06); b(0.58, 0.07, 0.5, m2, 0, 0.455, -0.06);
    for (const [dx, dz] of [[-0.28, 0.18], [0.28, 0.18], [-0.28, -0.3], [0.28, -0.3]]) b(0.06, 0.4, 0.06, m1, dx, 0.2, dz);
    b(0.66, o.back || 1.0, 0.07, m1, 0, 0.42 + (o.back || 1.0) / 2, -0.35); b(0.52, (o.back || 1.0) - 0.2, 0.04, m2, 0, 0.47 + (o.back || 1.0) / 2, -0.305);
    for (const s of [-1, 1]) { b(0.07, 0.05, 0.54, m1, s * 0.31, 0.655, -0.07); b(0.05, 0.24, 0.05, m1, s * 0.31, 0.535, 0.15); }
    return g;
  };
  chair(SEATR, SEAT_YAW, dark, M({ color: 0x6a2a7a, roughness: 0.85 }));
  S.block('rchair', SEATR.x, SEATR.z, 0.62);
  // the signpost, the locked cabin, the empty stone pool, the dead tree
  const SIGN = tc(13, 8); { const sp = K.makeSignpost(3); sp.obj.position.copy(SIGN); sp.obj.rotation.y = 0.4; scene.add(sp.obj); S.block('sign', SIGN.x, SIGN.z, 0.3); }
  const CABIN = V3(tc(4, 7).x, 0, (tc(4, 7).z + tc(4, 8).z) / 2), DOOR = V3(CABIN.x + 0.6, 0, CABIN.z + 1.55);
  {
    const logs = M({ color: 0x6b4a33, roughness: 0.9 }), W = 7.4, D = 2.9, H = 2.5;
    for (let i = 0; i < 9; i++) { for (const [x, z, len, ry] of [[CABIN.x, CABIN.z + D / 2, W, PI / 2], [CABIN.x, CABIN.z - D / 2, W, PI / 2], [CABIN.x - W / 2, CABIN.z, D, 0], [CABIN.x + W / 2, CABIN.z, D, 0]]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len + 0.5, 8), logs)); l.rotation.set(PI / 2, 0, ry === 0 ? 0 : PI / 2); if (ry === 0) l.rotation.set(PI / 2, 0, 0); l.position.set(x, 0.15 + i * 0.28, z); } }
    const rs = new THREE.Shape(); rs.moveTo(-D / 2 - 0.5, 0); rs.lineTo(D / 2 + 0.5, 0); rs.lineTo(0, 1.5); rs.closePath();
    const roof = add(new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: W + 0.8, bevelEnabled: false }), M({ color: 0x5a3a2a, roughness: 0.9 }))); roof.rotation.y = PI / 2; roof.position.set(CABIN.x - W / 2 - 0.4, H + 0.1, CABIN.z);
    box(1.0, 2.0, 0.1, wood, DOOR.x, 1.0, CABIN.z + D / 2 + 0.14); box(1.2, 0.12, 0.14, dark, DOOR.x, 2.06, CABIN.z + D / 2 + 0.14);
    for (const dx of [-2.2, 2.6]) { box(0.9, 0.8, 0.08, M({ color: 0x26323a, roughness: 0.3 }), CABIN.x + dx, 1.45, CABIN.z + D / 2 + 0.13); box(1.0, 0.07, 0.12, dark, CABIN.x + dx, 1.45, CABIN.z + D / 2 + 0.15); box(0.07, 0.86, 0.12, dark, CABIN.x + dx, 1.45, CABIN.z + D / 2 + 0.15); }
    const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M({ color: 0x8a6ad0, roughness: 0.15, metalness: 0.2, emissive: 0x2a1a5a })), false); ball.position.set(DOOR.x + 1.0, 2.3, CABIN.z + D / 2 + 0.3);      // (the fortune teller's sign: a glass ball on a bracket)
    box(0.5, 0.04, 0.04, dark, DOOR.x + 0.8, 2.52, CABIN.z + D / 2 + 0.3); box(0.02, 0.1, 0.02, dark, DOOR.x + 1.0, 2.46, CABIN.z + D / 2 + 0.3);
  }
  const POOL = V3(tc(6, 11).x, 0, (tc(6, 11).z + tc(6, 12).z) / 2);
  { for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2, s = add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + 0.06 * Math.sin(i * 2.7), 0), stone)); s.position.set(POOL.x + Math.cos(a) * 2.0, 0.18, POOL.z + Math.sin(a) * 1.3); s.rotation.set(i, i * 2, 0); s.scale.y = 0.75; }
    const bed = add(new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), M({ color: 0x5a544a, roughness: 1 })), false); bed.rotation.x = -PI / 2; bed.scale.set(1, 0.65, 1); bed.position.set(POOL.x, 0.02, POOL.z); }
  const TREE = tc(16, 12);
  { const bark = M({ color: 0x4a4038, roughness: 1 }), span = (a, b, r0, r1) => { const d = V3().subVectors(b, a), m = add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 8), bark)); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); };
    span(V3(TREE.x, 0, TREE.z), V3(TREE.x + 0.1, 3.4, TREE.z - 0.05), 0.28, 0.12);
    for (const [a, len, y, up] of [[0.4, 1.5, 2.2, 1.0], [2.5, 1.7, 2.6, 0.9], [4.1, 1.3, 3.0, 1.2], [5.4, 1.1, 1.9, 0.6]]) { const p0 = V3(TREE.x + 0.06, y, TREE.z), p1 = V3(TREE.x + Math.cos(a) * len, y + up, TREE.z + Math.sin(a) * len); span(p0, p1, 0.09, 0.03); span(V3().lerpVectors(p0, p1, 0.6), V3().lerpVectors(p0, p1, 0.6).add(V3(Math.cos(a + 1) * 0.5, 0.5, Math.sin(a + 1) * 0.5)), 0.04, 0.012); } }
  // the purse behind the tent
  const PURSE = tc(18, 4);
  const purse = new THREE.Group(); purse.position.set(PURSE.x - 0.2, 0, PURSE.z - 0.25); scene.add(purse);
  { const sack = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), M({ color: 0x7a5530, roughness: 0.95 })); sack.scale.set(1, 0.85, 1); sack.position.y = 0.1; sack.castShadow = true; purse.add(sack);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.07, 10), sack.material); neck.position.y = 0.22; purse.add(neck);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12), M({ color: 0xe0b030, roughness: 0.3, metalness: 0.8 })); c.position.set(0.16 + i * 0.05, 0.006 + i * 0.002, 0.08 - i * 0.06); c.rotation.y = i; purse.add(c); } }
  purse.visible = !S.flag('postPurse');

  // =====================================================================================================
  //                                                 who is here
  // =====================================================================================================
  let STAGED = null, fw = null;                        // the rig at Anne's soles: Camellia's, or Lilith's in the dream
  S.late.push((dt, t) => {
    if (STAGED) { C.readFeet(dt); fw.pre(dt); }
    bou.update(dt, t); cam.update(dt, t); lil.update(dt, t); updBands(t);
    if (STAGED) fw.post(dt);
  });
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 5: 'surprised', 7: 'worried', 9: 'happy', 10: 'smug', 11: 'laugh' };
  const LI = { 0: 'smug', 1: 'laugh', 2: 'smug', 4: 'angry', 6: 'surprised', 8: 'smug', 9: 'laugh', 12: 'smug', 13: 'happy', 14: 'laughHard', 15: 'angry' };
  const WHO = { bo: [bou, BO], ca: [cam, cast.FACES.ca], li: [lil, LI] };
  const say = async (sh, i, text, o = {}) => {
    const w = WHO[sh];
    if (w && w[0].made) { w[0].expr(w[1][i] || 'smile', sh === 'ca' && i >= 16 ? 0.4 : 0); w[0].talk(true); }
    await S.say(sh, i, text, STAGED ? Object.assign({}, o, { noFeet: true, feet: false }) : o);      // (seated, the scene has its own pictures of her feet)
    if (w && w[0].made) w[0].talk(false);
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  cam.show(CAM_AT, yawTo(CAM_AT, tc(14, 8))); cam.expr('smile'); S.block('camellia', CAM_AT.x, CAM_AT.z, 0.45);
  const party = (dx = 1.1, dz = 0.6) => { if (!S.flag('boudicca')) return; bou.show(V3(anne.position.x + dx, 0, anne.position.z + dz), anne.rotation.y); bou.expr('smile'); bou.follow(() => anne.position, 1.4, 1.5); S.party = { boudicca: bou }; };      // (her face too: she slept with her eyes shut)
  const camHome = () => { cam.show(CAM_AT, yawTo(CAM_AT, tc(14, 8))); cam.expr('smile'); };

  // ---------- Anne in a chair, her shoes beside it; somebody on her knees at her soles (footwork.js) ----------
  //   [her clip, her toes, her voice, hands (the two of whoever kneels), mouth: 'kiss' | 'lick' | null, her face, blush]
  const STAGES = {
    calm: ['ChairBare', 0, null, null, null, null, 'worried', 0.2], read: ['ChairBare', 0.12, null, 'read', 'read', null, 'embarrassed', 0.4],
    kiss: ['ChairBare', 0.2, 'giggle', null, 'read0', 'kiss', 'embarrassed', 0.6], lick: ['ChairBare', 0.26, 'giggle', 'toes0', null, 'lick', 'laugh', 0.7],
    lick2: ['ChairTickled', 0.34, 'laughter', 'trail0', null, 'lick', 'laughHard', 0.8],
    tickle: ['ChairTickled', 0.42, 'laughter', 'all', 'toes', null, 'laughHard', 0.8], nails: ['ChairTickled', 0.46, 'cackling', 'all', 'all', null, 'laughHard', 0.9],
    circle: ['ChairBare', 0.2, 'giggle', 'circle', 'circle', null, 'laugh', 0.5],
  };
  function stage(name) {
    const P = STAGES[name]; if (!P || !fw) return;
    S.clip(P[0], 0.25); if (A.clipSpeed) A.clipSpeed('ChairTickled', name === 'lick2' ? 0.6 : 1);
    if (P[1]) S.toes(P[1], 1.6 + P[1] * 3, Infinity); else S.toes(0);
    S.voiceLoop(P[2], P[2] === 'cackling' ? 2.2 : 2.8);
    fw.mouth({ lick: P[5] === 'lick', kiss: P[5] === 'kiss', u: name === 'lick2' ? 0.85 : 0.52 });
    fw.hands(P[3], P[4], P[5] ? 'floor' : null); if (P[3] || P[4]) fw.work(); else fw.lean(0.12);
    S.expr(P[6], P[7]);
  }
  // seat her (under black): `fig` kneels at her left; her shoes stand beside the chair
  async function seat(at, yaw, fig, o = {}) {
    A.setHeelsWorn(false); if (o.hat === false && A.setHat) A.setHat(false);
    S.place(at, yaw); if (o.y) anne.position.y = o.y; S.clip('ChairBare', 0); C.snapSoles();
    stg.begin(at.clone(), yaw, []);
    for (let i = 0; i < 4; i++) await S.frame();
    C.readFeet(0); C.snapSoles(); C.readFeet(0);
    fw = footWork(S, C, fig, feet, { side: 1, kit, tongue: o.tongue, floor: o.y || 0 });
    const P = o.later ? null : fw.kneel(yaw);      // (later: she is not at Anne's feet yet)
    const rt = V3(-Math.cos(yaw), 0, Math.sin(yaw));      // (her right)
    stg.loose.forEach((s, i) => { const p = V3(at.x + rt.x * (0.55 + i * 0.16), (o.y || 0) + 0.035, at.z + rt.z * (0.55 + i * 0.16)).addScaledVector(V3(Math.sin(yaw), 0, Math.cos(yaw)), 0.25); s.g.visible = o.shoes !== false; s.t = -1; s.carry = null; s.rest.set(1.5, i ? 0.7 : -0.5, 0.2); s.to = (out) => out.copy(p); });
    STAGED = fig; stage('calm');
    for (let i = 0; i < 3; i++) await S.frame();
    return P;
  }
  function unseat() { if (fw) fw.done(); STAGED = null; fw = null; S.voiceLoop(null); S.toes(0); stg.end(); anne.position.y = 0; }
  const mid = () => V3().addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5);
  // pictures of whoever sits: relative to the way she faces (f: forward, l: to her left)
  const rel = (p, yaw, f, l, y) => V3(p.x + Math.sin(yaw) * f + Math.cos(yaw) * l, p.y + y, p.z + Math.cos(yaw) * f - Math.sin(yaw) * l);
  const shotsFor = (yaw, fig, wk = 1) => ({
    two() { const h = C.headPos(), b = fig.head(V3()), c = V3().lerpVectors(h, b, 0.5); S.cam.set(rel(c, yaw, 2.3, -1.25, 0.4), c, { fov: 42, cut: true }); post.setCloseUp('off'); },
    face() { const h = C.headPos(); S.cam.set(rel(h, yaw, 1.3, -0.6, 0.1), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    her() { const h = fig.head(V3()); h.y -= 0.1; const y = fig.obj.rotation.y; S.cam.set(V3(h.x + Math.sin(y) * 1.15 + Math.cos(yaw) * -0.3, h.y + 0.06, h.z + Math.cos(y) * 1.15 - Math.sin(yaw) * -0.3), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    soles() { const m = mid(); S.cam.set(rel(m, yaw, 0.88, -0.2, 0.32), rel(m, yaw, 0, 0.06, -0.02), { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
    low() { const m = mid(); S.cam.set(rel(m, yaw, 0.74, -0.72, 0.22), rel(m, yaw, 0.08, 0.14, 0.02), { fov: 36, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
    wide() { const m = mid(); S.cam.set(rel(m, yaw, 3.0 * wk, -2.6 * wk, 1.3 * wk), rel(m, yaw, -0.6, 0.1, 0.5), { fov: 44 + (1 - wk) * 20, cut: true }); post.setCloseUp('off'); },
  });

  // =====================================================================================================
  //                                             Camellia Flaire
  // =====================================================================================================
  const toCam = async () => { await S.turnTo(CAM_AT, 0.2); cam.face(yawTo(CAM_AT, anne.position)); S.cam.two(anne, cam.obj, { dist: 2.0, y: 1.4 }); };
  async function meet() {
    await toCam();
    if (!S.flag('camellia')) {
      await lines([
        ['a1', 0, 'Hi! who are you?'],
        () => S.cam.face(cam.obj, { dist: 1.9, y: 1.45, turn: 0.45 }),
        ['ca', 0, 'Welcome Magician!\nMy name is Camellia Flaire\nand I may be the best apothecary in\nthe whole continent!'],
        ['ca', 0, 'I travel along the continent to find\nnew and exotic ingredients for\nmy collection!'],
        ['ca', 0, "Here.\nTake a look on these ingredients.\nYou can't miss'em!"],
        () => S.cam.two(anne, cam.obj, { dist: 2.0, y: 1.4 }),
        ['a1', 0, "I'm Anne, my pleasure, I'll check it out!"],
      ]);
      S.flag('camellia', true); S.toast('Camellia Flaire, apothecary and fortune teller', 'note', 2.6);
    } else {
      const n = S.state.flags.camN = (S.state.flags.camN || 0) + 1;
      if (n % 3 === 1) { await say('a1', 0, 'Hi Camellia!'); await say('ca', 6, 'Hey! Anne!!\nBack for trading?'); }
      else if (n % 3 === 2) await say('ca', 1, "You're just on time, Anne!\nI've got new stuff for ya!");
      else await say('ca', 17, 'Welcome back Anne!');
    }
    for (let round = 0; round < 8; round++) {
      await say('ca', 3, 'What can I do for you?', { keep: true });
      const pk = await S.choice(['Read my future (100 gold)', 'A bundle of herbs (30 gold)', "I've got some questions", 'Leave']);
      if (pk === 0) { if (await fortune()) return; }
      else if (pk === 1) await shop();
      else if (pk === 2) { if (await questions()) return; }      // (her fortune was told from there: the scene has ended)
      else break;
    }
    S.cam.behind(anne, { dist: 4.6 }); console.log('CH2 camellia done');
  }
  async function shop() {
    const k = S.state.flags.camShop = (S.state.flags.camShop || 0) + 1;
    if (k % 2 === 1) await lines([['ca', 2, "You can't miss these ingredients\nI've got for you here!!"], ['a1', 10, 'And with a good price for me, yes?'], ['ca', 7, 'Yes! the price that such quality deserves!'], ['a1', 8, 'Mmhhhh... I mean ... do you do any sales ...\nsome times? ....'], ['ca', 18, "Oh, no, cute!\nI can't devaluate my goods, they're totally\nperennial items, and they'll never lose\ntheir special attributes!"], ['a1', 21, 'Ohhh ...']]);
    else await lines([['ca', 6, 'The best recipes!\nThe best items!\nThe best quality!'], ['a1', 10, 'The best friendly discounts?'], ['ca', 19, "No way!\nI've got to pay taxes too, darling ;)\nI can't underrate my goods that easy."], ['a2', 36, 'Meh ...']]);
    if (S.state.coins < 30) { await say('a1', 46, "...and I can't afford them anyway.\nThat thief took every coin we had."); return; }
    S.counts(S.state.herbs + 3, S.state.coins - 30); S.se('se_Coin', 0.8); S.toast('3 herbs bought (30 gold)', 'success', 2.2);
  }
  async function questions() {
    for (let n = 0; n < 6; n++) {
      await say('ca', 3, 'What do you need to know?', { keep: true });
      const pk = await S.choice(['Who are you?', 'Apothecary', 'Fortuneteller', 'Do you know these lands?', 'Back']);
      if (pk === 0) await say('ca', 6, "I'm Camellia Flare, the Apothecary.\nI love to explore these lands, harvesting\nnew exotic plants and ingredients for my\nrecipes.");
      else if (pk === 1) await lines([['ca', 6, 'All ingredients are harvested by myself!\nI use to trade with the most important\npharmacist and wizards in the realm, so\nquality is a must!'], ['ca', 0, 'Here you will find high quality ingredients\nand the most efficient potions from the best\nalchemists in this land.']]);
      else if (pk === 2) {
        await lines([['ca', 6, "Ohh!! I've got quite an exotic method to\nread your future, darling."], ['ca', 1, 'I have got an extraordinary eye to read\nthe most slight wrinkless on your soles\nand predict the adventures your feet will\ndrive to!', { feet: true }], ['a1', 44, 'mmmhhhhh ... Interesting ...', { expr: 'worried' }], ['ca', 7, 'Do you want me to read your pretty feet, darling?', { feet: true, keep: true }]]);
        if (await S.choice(['Yes', 'Not now']) === 0) { if (await fortune()) return true; }
      } else if (pk === 3) await lines([['ca', 2, "Of course I do!\nI've been traveling since young with my father\nand learned his business so well!"], ['ca', 1, "I've visited every corner of the whole\ncontinent, even the exotic islands of the\neast."], ['ca', 0, 'The trail south of my tent dives into the\nForest of Lys; keep to the South Road and\nyou will come out before the white walls\nof Valyndra City.']]);
      else return false;
    }
    return false;
  }
  // ---------- she reads Anne's future from her soles ----------
  async function fortune() {
    await say('ca', 4, 'A fortuneteller session costs 100 gold, darling!');
    if (S.state.coins < 100) {
      await say('a1', 46, "Ugh .... Can't you just make a free session for me?");
      await say('ca', 12, "I'm sorry, Magician, but I'm not here for charity...");
      if (!S.flag('postPurse')) await S.say('am', 4, 'Psst, kitty. Somebody left a purse\nbehind her tent. Finders keepers!');
      return false;
    }
    S.counts(S.state.herbs, S.state.coins - 100); S.se('se_Coin', 0.8);
    await say(...pick([['ca', 6, "Get comfy, M'am..."], ['ca', 4, 'Let me do wonders with my hands, darling.'], ['ca', 6, 'Come here, babe...\nI will make those amazingly pretty feet talk!']]));
    await S.fade(1, 0.5); if (env.quiet) env.quiet(true);
    const BW = rel(SEATR, SEAT_YAW, 0.9, -2.3, 0); if (S.flag('boudicca')) { bou.follow(null); bou.show(BW, yawTo(BW, SEATR)); bou.expr('happy'); }
    await seat(SEATR, SEAT_YAW, cam);
    const shots = shotsFor(SEAT_YAW, cam); cam.expr('happy');
    shots.wide(); await S.fade(0, 0.7); await S.mark('reading');
    const L = C.lookLines ? C.lookLines('bo', true) : null;
    await lines([
      () => shots.two(),
      ['a2', 31, "W-wait. My SHOES? You read... feet?!", { expr: 'embarrassed', blush: 0.5 }],
      () => shots.her(),
      ['ca', 1, 'The palm only tells what a hand has done, darling.\nThe sole tells where the feet will carry you!'],
      () => { stage('read'); shots.soles(); }, () => S.wait(2.2), () => S.mark('lines'),
      ['ca', 2, '... now, keep those gorgeous toes spread!'],
      () => { stage('kiss'); shots.low(); }, () => fw.atSole(2.6), () => S.wait(1.4), () => S.mark('kiss'),
      () => shots.face(),
      ['a2', 10, 'Hihihi!! W-what are you doing down there?!', { expr: 'laugh', blush: 0.6 }],
      () => shots.her(),
      ['ca', 5, 'Hush. The fine lines only show\nwhen the skin is... awake.'],
      () => { stage('lick'); shots.low(); }, () => fw.atSole(2.6), () => S.wait(2.4), () => S.mark('lick'),
      () => shots.face(),
      ['a2', 15, "EEP!! Hahaha! T-that's your TONGUE!!", { expr: 'laughHard', blush: 0.8 }],
    ]);
    if (S.flag('boudicca') && L) { S.cam.face(bou.obj, { dist: 1.8, y: 1.45, turn: 0.4 }); await say('bo', 9, "A fortune teller who works on feetsies!\nRookie, I am in the WRONG trade. ♥"); }
    // hold still: three tries
    let read = false;
    for (let n = 0; n < 3 && !read; n++) {
      stage(n ? 'lick2' : 'lick'); shots.soles(); await S.wait(1.0);
      read = await S.gauge({ label: 'Hold still! Press SPACE in the green!', sub: `Keep your toes spread  ·  try ${n + 1} / 3`, width: 0.24 - 0.02 * n, speed: 0.8 + 0.06 * n });
      if (read) break;
      stage('calm'); shots.her();
      await say(...[['ca', 13, "Too bad !!!\nI'll need to try it again ..."], ['ca', 9, 'Mhhhhhh .... Hard to read now ...\nI may need to watch those cute feetsies closer ...'], ['ca', 12, 'Dammit !!\nI may need to do it again ...']][n]);
      stage(n === 2 ? 'nails' : 'tickle'); shots.soles(); await S.wait(1.6); if (n === 0) await S.mark('tickle');
      shots.face(); await say('a2', 18, pick(["AHAHAHA!! T-THAT IS NOT READING!!", "HAHAHA!! I P-PAID FOR THIS?!", "AHAHAHA!! S-STOP!! I'LL HOLD STILL!!"]), { expr: 'laughHard', blush: 0.9 });
      shots.low(); await S.wait(1.4);
    }
    // the reading
    stage('read'); shots.her(); cam.expr('happy');
    await say('ca', 1, read ? "Amazing, now let me see what's written on\nthose gorgeous soles ..." : 'There... they have given up wriggling at last.\nNow let me see what is written on\nthose gorgeous soles ...');
    shots.soles(); await S.mark('fortune');
    // (the 2D's reading for this chapter, CE 135: while the thief is still at large. Once the Grimmoire is back the 2D has
    // other readings, which were not read out of its data: a short one of this game's own, pointing where its story goes)
    if (S.progress < 130) await lines([
      ['ca', 2, 'You are seeking that blue thief, right?'],
      () => shots.her(),
      ['ca', 8, 'Ohh!! I can see her now!'],
      ['ca', 1, 'Beautiful silver hair ...\n   blue and red dyed hair bangs ...'],
      ['ca', 4, 'Ahh ...\nand such greedy blue eyes!!!'],
      () => shots.two(),
      ['ca', 0, "She's hiding somewhere in the capital city.\nHurry!! she plans to escape!"],
      () => { stage('calm'); shots.face(); },
      ['a1', 2, 'The capital... Valyndra City!\n...You got all that from my FEET?', { expr: 'surprised' }],
      () => shots.her(),
      ['ca', 7, 'Every word, darling.\nThey are very talkative feet.'],
    ]);
    else await lines([
      ['ca', 2, 'The blue thief is behind you now, right?'],
      () => shots.her(),
      ['ca', 8, 'Ohh!! But these lines run on... to the sea!'],
      ['ca', 1, 'A harbour at dawn ... a boat ...\n   and an island under a curse.'],
      () => { stage('calm'); shots.face(); },
      ['a1', 2, 'Amirian Island...\n...You got all that from my FEET?', { expr: 'surprised' }],
      () => shots.her(),
      ['ca', 7, 'Every word, darling.\nThey are very talkative feet.'],
    ]);
    S.flag('fortune', true);
    await S.fade(1, 0.5);
    unseat(); camHome(); if (env.quiet) env.quiet(false);
    S.place(V3(CAM_AT.x - 0.9, 0, CAM_AT.z + 1.6), yawTo(V3(CAM_AT.x - 0.9, 0, CAM_AT.z + 1.6), CAM_AT)); S.clip('Idle', 0); S.expr('neutral');
    party(-1.1, 0.5); S.cam.behind(anne, { cut: true, dist: 4.6 });
    await S.fade(0, 0.6);
    if (S.progress < 130) S.toast('The thief is hiding in the capital: Valyndra City.', 'note', 3.0);
    console.log('CH2 reading done');
    return true;
  }
  S.on({ id: 'camellia', at: CAM_AT, r: 1.9, action: 'E — talk to Camellia', run: meet });

  // =====================================================================================================
  //                                       the fire: rest until morning
  // =====================================================================================================
  const BED = V3(FIRE.x - 1.7, 0, FIRE.z + 0.9), BED_YAW = Math.atan2(FIRE.x - BED.x, FIRE.z - BED.z);
  const headDir = V3(-Math.sin(BED_YAW), 0, -Math.cos(BED_YAW)), frontDir = V3(Math.cos(BED_YAW), 0, -Math.sin(BED_YAW));
  const hat = K.makeWitchHat(); scene.add(hat.obj); hat.obj.visible = false;
  hat.obj.position.set(BED.x + headDir.x * 0.85 - frontDir.x * 0.45, 0.03, BED.z + headDir.z * 0.85 - frontDir.z * 0.45); hat.obj.rotation.set(0.12, 1.1, -0.2);
  const bedShoes = [false, true].map((left, i) => { const g = new THREE.Group(); if (A.heelProp) { const sh = A.heelProp.clone(true); sh.scale.set(left ? -1 : 1, 1, 1); sh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.add(sh); }
    g.position.set(BED.x - headDir.x * 0.5 + frontDir.x * (0.66 + i * 0.13), 0, BED.z - headDir.z * 0.5 + frontDir.z * (0.66 + i * 0.13)); g.rotation.y = BED_YAW + 0.5 + i * 0.3; g.visible = false; scene.add(g); return g; });
  const abed = (on) => { A.setHeelsWorn(!on); if (A.setHat) A.setHat(!on); hat.obj.visible = !!on; for (const g of bedShoes) g.visible = !!on; };
  const once = async (name, then, fade = 0.15) => { if (!has(name)) { S.clip(then, 0.6); return; } S.clip(name, fade); await S.wait(Math.max(0.2, A.clipLength(name) - 0.12)); S.clip(then, 0.25); };
  const BOU_BED = V3(FIRE.x + 1.8, 0, FIRE.z + 0.7);
  async function fireMenu() {
    await S.turnTo(FIRE, 0.2); S.cam.at(V3((anne.position.x + FIRE.x) / 2, 0, (anne.position.z + FIRE.z) / 2), anne.rotation.y + 2.3, { y: 0.9, pitch: 0.2, dist: 4.4 });
    await say(...pick([['a1', 0, "Our campfire.\nI've found a nice place to set the camp actually."], ['a1', 0, 'A cozy campfire to rest and relax\nwhile I make up my nails.'], ['a1', 3, 'A campfire will make the area safer tonight.'], ['a1', 0, 'Looks safe,\nand I can come back here to rest whenever I need.']]));
    if (await S.choice(['Sleep until morning', 'Not yet']) === 0) await sleep();
    else S.cam.behind(anne, { dist: 4.6 });
  }
  async function sleep() {
    await S.fade(1, 0.8); if (env.quiet) env.quiet(true);
    S.place(BED, BED_YAW); S.clip(has('CampSleep') ? 'CampSleep' : 'SitIdle', 0); S.expr('sleep'); abed(true);
    if (S.flag('boudicca')) { bou.follow(null); bou.show(BOU_BED, yawTo(BOU_BED, FIRE) + PI, 'CampSleep'); bou.expr('sleep'); }
    cam.hide(); S.unblock('camellia');                 // (she has turned in: her tent's flap is shut)
    S.setNight(1); C.amAt(V3(0, -60, 0)); C.am.hide();
    const WIDE = BED_YAW + 1.0;
    S.cam.at(V3((BED.x + FIRE.x) / 2, 0, (BED.z + FIRE.z) / 2), WIDE, { y: 0.45, pitch: 0.22, dist: 5.0, cut: true });
    await S.wait(0.6); await S.fade(0, 1.6);
    S.toast('Anne falls in a deep sleep...', 'note', 2.6); await S.emote(anne, 'zzz', 1.8, -0.6); await S.mark('asleep');
    const first = !S.flag('postNightmare');
    if (first) { await nightmare(); S.flag('postNightmare', true); }
    else { await S.wait(1.2); await S.fade(1, 1.2); }
    // morning
    S.setNight(0); grade(DAY); if (env.music) env.music(null); if (env.quiet) env.quiet(false);
    S.place(BED, BED_YAW); S.clip(has('CampSleep') ? 'CampSleep' : 'SitIdle', 0); S.expr('sleep'); abed(true); C.amAt(null);
    if (S.flag('boudicca')) { bou.show(BOU_BED, yawTo(BOU_BED, FIRE) + PI, 'CampSleep'); bou.expr('sleep'); }      // (the dream took her out of the picture: she is still asleep across the fire)
    S.cam.at(V3((BED.x + FIRE.x) / 2, 0, (BED.z + FIRE.z) / 2), WIDE, { y: 0.45, pitch: 0.22, dist: 5.0, cut: true });
    await S.wait(0.5); await S.fade(0, 1.4);
    S.expr('tired'); await once('CampWake', has('CampSit') ? 'CampSit' : 'SitIdle'); await S.wait(0.3);
    if (first) {
      S.cam.at(C.headPos(), BED_YAW + 0.55, { y: C.headPos().y - 0.05, pitch: 0.06, dist: 2.3, fov: 38 });
      await say('a1', 17, 'Damn!\n\nIt was her again...', { expr: 'tired' });
      await S.say('am', 4, 'Sweet dreams, kitty? Hehehe.');
      await say('a1', 43, 'Not. One. Word.', { expr: 'angry' });
      S.toast('Next nightmare with Lilith in a few nights ...', 'note', 2.8);
    }
    await S.fade(1, 0.5);
    abed(false); S.place(V3(BED.x + frontDir.x * 0.4, 0, BED.z + frontDir.z * 0.4), BED_YAW); S.clip('Idle', 0); S.expr('neutral');
    camHome(); S.block('camellia', CAM_AT.x, CAM_AT.z, 0.45); party(1.2, 0.5);
    S.cam.behind(anne, { cut: true, dist: 4.8 }); await S.fade(0, 0.7);
    S.toast('A new morning. Game saved.', 'success', 2.2); C.checkpoint(); console.log('CH2 morning done');
  }
  S.on({ id: 'fire', at: FIRE, r: 2.1, action: 'E — rest at the campfire', run: fireMenu });

  // =====================================================================================================
  //                                       the nightmare: Lilith, again
  // =====================================================================================================
  // A place of its own, shut off from the camp: a dome of dark, a floor a hand's breadth over the grass, the high-backed
  // chair of the Secret Library, the violet bands of her magic at Anne's wrists and ankles.
  const DREAM = V3(20.0, 0, 19.0), DY = 0.06, DREAM_YAW = 0, DOME = 4.6;      // (the widest open ground of the camp: nothing of it stands inside the dome)
  const dream = new THREE.Group(); dream.visible = false; scene.add(dream);
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME, 32, 20, 0, PI * 2, 0, PI / 2 + 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.012, 0.07), side: THREE.BackSide, fog: false, toneMapped: false })); dome.position.set(DREAM.x, DY - 0.05, DREAM.z); dream.add(dome);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(DOME, 48), M({ color: 0x150a22, roughness: 0.6, metalness: 0.1 })); fl.rotation.x = -PI / 2; fl.position.set(DREAM.x, DY, DREAM.z); fl.receiveShadow = true; dream.add(fl);
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d'); x.translate(256, 256); x.strokeStyle = '#c05cf0'; x.shadowColor = '#e08aff'; x.shadowBlur = 12; x.lineWidth = 5;
    for (const r of [236, 214, 120]) { x.beginPath(); x.arc(0, 0, r, 0, PI * 2); x.stroke(); }
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * PI * 4 / 6 - PI / 2; x.lineTo(Math.cos(a) * 214, Math.sin(a) * 214); } x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(0, 70); x.bezierCurveTo(-90, 0, -48, -72, 0, -22); x.bezierCurveTo(48, -72, 90, 0, 0, 70); x.stroke();
    const rt = new THREE.CanvasTexture(cv); rt.colorSpace = THREE.SRGBColorSpace;
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: rt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.7 })); rune.rotation.x = -PI / 2; rune.position.set(DREAM.x, DY + 0.01, DREAM.z + 0.5); dream.add(rune); dream.userData.rune = rune;
    const ch = chair(V3(DREAM.x, DY, DREAM.z), DREAM_YAW, M({ color: 0x1c1024, roughness: 0.7 }), M({ color: 0x4a1438, roughness: 0.8 }), { back: 1.5 }); scene.remove(ch); dream.add(ch);
    const l1 = new THREE.PointLight(0xc070ff, 5, 9, 1.5); l1.position.set(DREAM.x + 1.6, 2.4, DREAM.z + 2.4); dream.add(l1);
    const l2 = new THREE.PointLight(0xff7ab0, 3.2, 8, 1.6); l2.position.set(DREAM.x - 1.8, 1.4, DREAM.z + 1.6); dream.add(l2);
    const l3 = new THREE.PointLight(0x8a9aff, 2.2, 8, 1.6); l3.position.set(DREAM.x, 3.0, DREAM.z - 1.5); dream.add(l3);
  }
  S.actors.push({ update(dt, t) { if (dream.visible) { dream.userData.rune.rotation.z = t * 0.12; dream.userData.rune.material.opacity = 0.55 + 0.2 * Math.sin(t * 1.7); } } });
  const dreamFlat = { p: V3(DREAM.x, 0, DREAM.z), r: DOME + 0.4, k: 0.99 };
  // the bands at her wrists and ankles (as in the library)
  const bandM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.4, 1.7), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const BANDS = [['lowerarm02R', 'wristR', 0.036], ['lowerarm02L', 'wristL', 0.036], ['lowerleg02R', 'footR', 0.047], ['lowerleg02L', 'footL', 0.047]].map(([a, b, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 32), bandM); m.visible = false; m.frustumCulled = false; scene.add(m); return { a: anne.getObjectByName(a), b: anne.getObjectByName(b), r, m }; });
  let BOUND = 0; const _a = V3(), _b = V3(), _q = new THREE.Quaternion();
  function updBands(t) {
    for (const B of BANDS) {
      B.m.visible = BOUND > 0.01 && !!B.a && !!B.b; if (!B.m.visible) continue;
      B.a.getWorldPosition(_a); B.b.getWorldPosition(_b); const d = _b.clone().sub(_a).normalize();
      B.m.position.copy(_b).addScaledVector(d, -0.035); B.m.quaternion.copy(_q.setFromUnitVectors(V3(0, 0, 1), d)); B.m.scale.setScalar(B.r * (1 + 0.04 * Math.sin(t * 6 + B.r * 50)));
    }
    bandM.opacity = 0.75 * BOUND * (0.8 + 0.2 * Math.sin(t * 4));
  }
  async function blink(to, yaw, o = {}) {              // a puff of violet and she is somewhere else
    if (lil.obj && lil.obj.visible) sparks.burst(lil.obj.position.clone().setY(lil.obj.position.y + 1.1), VIOLET, 14, 0.9, 0.6);
    lil.show(to, yaw, o.clip || 'ThiefIdle'); lil.hover(o.hover ?? 1, to.y); sparks.burst(to.clone().setY(to.y + 1.1), VIOLET, 18, 1.0, 0.7); await S.wait(0.25);
  }
  async function nightmare() {
    S.toast("A dark shadow takes over Anne's peaceful dreams...", 'warning', 3.0); await S.wait(1.6);
    await S.fade(1, 1.2);
    // the dream: the chair, the dark
    if (S.flag('boudicca')) bou.hide();
    hat.obj.visible = false; for (const g of bedShoes) g.visible = false;
    dream.visible = true; S.grassFlat = () => dreamFlat; grade(DREAM_G); S.setNight(0.35); if (env.music) env.music('theme7.mp3');
    const AT = V3(DREAM.x, 0, DREAM.z);
    const FRONT = V3(DREAM.x + 0.1, DY, DREAM.z + 2.1);
    lil.show(FRONT, PI, 'ThiefIdle'); lil.hover(1, DY); lil.flap(1); lil.obj.visible = false;
    await seat(AT, DREAM_YAW, lil, { y: DY, hat: false, shoes: false, tongue: '#b03a6a', later: true });
    S.grassFlat = () => dreamFlat;
    lil.show(FRONT, PI, 'ThiefIdle'); lil.hover(1, DY); lil.obj.visible = false; BOUND = 1; S.expr('sleep');
    const shots = shotsFor(DREAM_YAW, lil, 0.72);      // (the wide picture from inside the dome)
    S.cam.set(V3(DREAM.x - 2.0, DY + 1.5, DREAM.z + 3.2), V3(DREAM.x, DY + 0.95, DREAM.z + 0.4), { fov: 46, cut: true });
    await S.fade(0, 1.4); await S.mark('dream');
    S.expr('worried', 0.2); await S.wait(0.6);
    await say('a2', 12, 'This chair... the library?!\nNo. No, no, no. Not again!', { expr: 'shocked' });
    lil.obj.visible = true; await blink(FRONT, PI); S.se('se_Blind', 0.6, 0.8); lil.expr('laugh');
    S.cam.set(V3(FRONT.x + 0.9, DY + 1.75, FRONT.z - 1.9), lil.head(V3()), { fov: 36, cut: true });
    await say(...pick([['li', 1, "It's playtime, honey!\nThis waiting was getting endless!!"], ['li', 9, "Did you miss me, sweetie?\nI swear I'll pay at once\nfor all those hours waiting for me!"], ['li', 12, "Guess who's back for more, honey!"]]));
    shots.face();
    if (C.lookRemarks) { const R = C.lookRemarks('li', 1); if (R[0]) { S.cam.set(V3(FRONT.x + 0.9, DY + 1.75, FRONT.z - 1.9), lil.head(V3()), { fov: 36, cut: true }); await say('li', 12, R[0]); } }
    await say('li', 12, "I've got more funny games to play with you,\nhoney");
    shots.face();
    // she is at Anne's feet
    lil.hover(0, DY); lil.flap(0.25); const P = fw.kneel(DREAM_YAW); sparks.burst(P.at.clone().setY(DY + 0.8), VIOLET, 16, 0.9, 0.6);
    stage('circle'); shots.two(); await S.mark('feet');
    await say('a2', 18, 'E-eek!\n N-no!\n Not there!', { expr: 'shocked', blush: 0.4 });
    const tint = C.soleTint ? C.soleTint() : 'pink';
    for (let round = 0; round < 3; round++) {
      if (round === 0) {
        await lines([
          () => { stage('lick'); shots.low(); }, () => fw.atSole(2.6), () => S.wait(1.6), () => S.mark('nlick'),
          () => shots.her(),
          ['li', 9, `You know how pleasant is to softly sink my\ntongue into those tender ${tint} soles?`],
          () => shots.face(),
          ['a2', 15, "HIHIHI!! S-STOP!! G-GET OFF MY FEET!!", { expr: 'laugh', blush: 0.7 }],
          () => { stage('lick2'); shots.soles(); }, () => S.wait(2.0),
          ['li', 9, 'AHHHH!!!!\nI love lickling them all over!!!\nOver and over....'],
          () => { stage('tickle'); shots.soles(); }, () => S.wait(1.6), () => S.mark('ntickle'),
          () => shots.her(),
          ['li', 12, "Look at these cute tootsies wriggle in\nanticipation-\nYou're enjoying this, aren't you~?"],
          () => shots.face(),
          ['a2', 18, "AHAHAHA!! N-NO I'M NOT!! AHAHAHAHA!!", { expr: 'laughHard', blush: 0.9 }],
        ]);
      } else if (round === 1) {
        await lines([
          () => { stage('nails'); shots.soles(); }, () => S.wait(1.6),
          () => shots.her(),
          ['li', 12, 'Your sweet, delicate tootsies being played\nwith - tickled over and over again.\nBeing all helpless... having no where to go~'],
          () => { stage('lick2'); shots.low(); }, () => fw.atSole(2.6), () => S.wait(1.8),
          ['li', 12, "Oh, these succulent toes~ Tender, smooth\nsoles~ I just can't get enough of them~"],
          () => shots.face(),
          ['a2', 16, "HAHAHA!! W-WAKE UP, ANNE!! WAKE UP!!", { expr: 'laughHard', blush: 0.9 }],
        ]);
      } else {
        await lines([
          () => { stage('nails'); shots.two(); }, () => S.wait(1.4),
          () => shots.her(),
          ['li', 9, "OHhhh!!! Worry not, darling!\nI don't mean at all to leave your lovely\nfeetsies alone"],
          ['li', 13, "COME ON honey!!\nDon't be shy and laugh for me!"],
          () => { shots.soles(); }, () => S.wait(1.6),
          ['li', 2, 'I know every single spot you fear to reveal\nme!!!'],
          ['li', 0, "... that's why it's a nonsense trying to\nescape from me!"],
        ]);
      }
      // wake up?
      stage('circle'); shots.wide();
      const woke = await S.gauge({ label: 'Wake up! Press SPACE in the green!', sub: `Try ${round + 1} / 3`, width: 0.22 - 0.02 * round, speed: 0.85 + 0.06 * round });
      if (woke || round === 2) {
        stage('calm'); fw.hands(null, null); lil.clip('ThiefIdle', 0.3); lil.hover(1, DY); lil.flap(1); lil.face(PI);
        S.cam.set(V3(FRONT.x + 0.9, DY + 1.75, FRONT.z - 1.9), V3(FRONT.x, DY + 1.75, FRONT.z), { fov: 36, cut: true }); fw.done(); await blink(FRONT, PI);
        if (woke) { lil.expr('angry'); await say('li', 15, 'OGHHHH!!!\nHell and Damnation!!!'); }
        else { lil.expr('laugh'); await say('li', 12, "Oh, your taste is as sweet as I remember\nit Anne. You're all mine!\nSo tasty! I can do this for all eternity!"); S.toast('The night is nearly over...', 'note', 2.2); }
        await say('li', 0, "Godbye for now, my dolly!\nWe'll meet again real soon!!");
        sparks.burst(lil.obj.position.clone().setY(DY + 1.2), VIOLET, 30, 1.6, 1.0); lil.hide(); await S.wait(0.5);
        break;
      }
      shots.her();
      await say(...[['li', 4, "Oh ???\nAre you tired already, Honey?\nBut we've just getting started!"], ['li', 13, "And where do you think you're going,\nmy love?\nBring those velvet feetsies back to me!!"]][round]);
    }
    await S.mark('ndone');
    await S.fade(1, 1.0);
    BOUND = 0; unseat(); lil.hide(); dream.visible = false; S.grassFlat = null; S.voiceLoop(null);
  }

  // =====================================================================================================
  //                                             things to look at
  // =====================================================================================================
  S.on({ id: 'sign', at: SIGN, r: 1.5, action: 'E — read the signpost', run: async () => {
    const pk = await S.choice(['North', 'East', 'South']);
    if (pk === 0) await S.say('', 0, '- Tower of Wisdom\n- Northern Forest\n- Ice Peaks\n- Lands of the Beast Kin');
    else if (pk === 1) await S.say('', 0, '- Northern Forest\n- Dawn Harbor');
    else await S.say('', 0, '- Forest of Lys\n- Valyndra City');
  } });
  S.on({ id: 'cabin', at: V3(DOOR.x, 0, DOOR.z + 0.5), r: 1.3, action: "E — the fortune teller's door", run: async () => { await S.say('a1', 1, "It's locked"); } });
  S.on({ id: 'pool', at: POOL, r: 2.6, action: 'E — look into the pool', run: async () => { await S.say('a1', 6, 'Empty'); } });
  S.on({ id: 'tree', at: TREE, r: 1.6, action: 'E — the dead tree', solid: 0.4, run: async () => { await S.say('a1', 8, "Here's again the creepy tree..."); } });
  S.on({ id: 'purse', at: PURSE, r: 1.3, action: 'E — a purse in the grass', when: () => !S.flag('postPurse'), run: async () => {
    S.flag('postPurse', true); purse.visible = false; S.counts(S.state.herbs, S.state.coins + 1000); S.se('se_Coin', 0.9); sparks.burst(V3(PURSE.x - 0.2, 0.4, PURSE.z - 0.25), GOLD, 22, 1.2, 0.9);
    S.toast("Wow!! I've found 1000 gold!|Such a lucky day!", 'success', 2.8); S.expr('happy'); await S.wait(1.0);
  } });
  S.hint = async () => { await S.say('am', 0, S.flag('fortune') ? 'The fortune teller says the thief is in the capital.\nThe trail south of the tent goes into the Forest of Lys.' : 'South, after that thief: the trail south of the\ntent goes into the Forest of Lys.\n...or rest first. Or have your fortune told, kitty.'); };
  S.onArrive = () => {
    C.checkpoint(); party();
    if (!S.flag('postSeen')) { S.flag('postSeen', true); S.objective('The Trader Post. Look around, rest at the fire, or take the trail south into the Forest of Lys.'); S.toast('Chapter 2 - Dawn comes Slowly', 'success', 3.0); }
  };
  // (tests: ?cast: everybody of the chapter in a row)
  if (new URLSearchParams(location.search).has('cast')) {
    const figs = [cast.createDryad(S, C), cast.createElora(S, C), cast.createGuard(S, C), cast.createMia(S, C), cast.createAureliaBare(S, C)];
    S.late.push((dt, t) => { for (const f of figs) f.update(dt, t); });
    const p = S.tileC(13, 6); figs.forEach((f, i) => f.show(V3(p.x + (i - 2) * 0.95, 0, p.z), 0, i === 4 ? 'IdleBare' : undefined));
  }
  if (typeof window !== 'undefined') window.__post = { cam, bou, lil, stage, shotsFor, get fw() { return fw; }, feet, dream, meet, fortune, sleep, nightmare };
}
