// story_lys.js: the Forest of Lys (the 2D game's Map 36 "ForestOfLys", 60x130: two near-identical halves; one half is
// built, compact), the middle of Chapter 2: the South Road through thick forest, a stream and a river.
//   - coming in (CE 130 LYSFOREST): stick to the South Road; magical creatures
//   - the DRYAD on the second bridge, the only crossing (Map036 event 58 "DryadChapter2", CE 70 SceneDryad):
//       first touch: her branches have Anne. Stage 1 of the 2D's capture is tickling: Anne's shoes come off and the
//       branches tickle her feet, a key prompt to break free. (Its later stages are not for this game and are not built.)
//       "Ok then we'll have to do the hard way!": the fight (the 2D's troop 25: one Dryad, no escape). Lost: her branches
//       again. Won: the 2D's DOMINATION, the party tickles HER in three stages (CE 46): here her own roots seat her on a
//       stump, Boudicca kneels at one bare sole with her fingers and Anne's tickle spell, a conjured feather, has the other
//   - a wild Ivy Maiden or two off the road (the 2D's wandering "WildVine"), as the North Forest has them
//   - the south gate: "That's the main road!", and the talk about teleporting (the 2D plays it on its world map)
// Lines are the 2D's own. The dryad is dressed (a dress of leaves); only shoes and a hat ever come off.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { creatureKit } = await import('./creatures.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);
const { createDryad, FACES } = await import('./cast2.js' + V);
const { solesOf, footWork } = await import('./footwork.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3, TILE } = S, C = common(S), { sparks, K, along } = C;
  const capt = createCaptures(S, C, env), ck = creatureKit(S, C, env, capt);
  const bou = createBoudicca(S, C), dry = createDryad(S, C);
  const PI = Math.PI, post = env.post, tc = (x, y) => S.tileC(x, y), has = (n) => A.hasClip && A.hasClip(n);
  const pick = (L) => L[Math.floor(Math.random() * L.length)];
  const GREEN = new THREE.Color(0.5, 1.6, 0.5), GOLD = new THREE.Color(1.7, 1.3, 0.4), PINK = new THREE.Color(1.8, 0.45, 1.3), LEAF = new THREE.Color(0.7, 1.2, 0.3);
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const DONE = () => S.flag('dryadDone');

  // =====================================================================================================
  //                                                 who is here
  // =====================================================================================================
  let dFeet = null, fw = null, STAGED = false;
  S.late.push((dt, t) => {
    dry.update(dt, t);
    if (dFeet && STAGED) { dFeet.read(dt); fw.pre(dt); }
    bou.update(dt, t);
    if (STAGED) { fw.post(dt); updFeather(dt, t); }
    updBands(t);
  });
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 5: 'surprised', 7: 'worried', 9: 'happy', 10: 'smug', 11: 'laugh' };
  const WHO = { bo: [bou, BO], dr: [dry, FACES.dr] };
  const DR = { face: null, blush: 0 };
  const say = async (sh, i, text, o = {}) => {
    const w = WHO[sh];
    if (w && w[0].made) { w[0].expr(w[1][i] || 'smile', sh === 'dr' && DR.face ? DR.blush : 0); w[0].talk(true); }
    await S.say(sh, i, text, STAGED || sh === 'dr' ? Object.assign({}, o, { noFeet: !o.feet }) : o);
    if (w && w[0].made) { w[0].talk(false); if (sh === 'dr' && DR.face) dry.expr(DR.face, DR.blush); }
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  const party = (dx = 0.9, dz = -1.0) => { if (!S.flag('boudicca')) return; bou.show(V3(anne.position.x + dx, 0, anne.position.z + dz), anne.rotation.y); bou.follow(() => anne.position, 1.4, 1.5); S.party = { boudicca: bou }; };

  // =====================================================================================================
  //                                               the road's furniture
  // =====================================================================================================
  const SIGNS = [
    [9.6, 4.2, ['North', 'NorthWest', 'South'], ['North\n- Tower of Wisdom\n- North Forest\n- Ice Peaks', 'North-West\n- Dawn Harbor', 'South\n- Valyndra City\n- Main Land']],
    [12.4, 16.2, ['North', 'South'], ['North\n- Tower of Wisdom\n- North Forest', 'South\n- Valyndra City\n- Main Land']],
    [23.3, 33.4, ['North', 'South'], ['North\n- Tower of Wisdom\n- North Forest', 'South\n- Valyndra City\n- Main Land']],
  ];
  SIGNS.forEach(([x, y, opts, texts], i) => {
    const p = V3(x * TILE, 0, y * TILE), sp = K.makeSignpost(opts.length); sp.obj.position.copy(p); sp.obj.rotation.y = i * 1.1 + 0.3; scene.add(sp.obj); S.block('lsign' + i, p.x, p.z, 0.3);
    S.on({ id: 'lsign' + i, at: p, r: 1.5, action: 'E — read the signpost', run: async () => { const pk = await S.choice(opts); await S.say('', 0, texts[pk], { name: 'Signpost' }); } });
  });

  // =====================================================================================================
  //                                          the dryad on the bridge
  // =====================================================================================================
  const BRIDGE = V3(17 * TILE, 0, 19.5 * TILE), BANK = V3(BRIDGE.x - 3.4, 0, BRIDGE.z), SEAT = V3(BRIDGE.x - 3.9, 0, BRIDGE.z + 0.1);
  const DRY_AT = V3(BRIDGE.x - 0.2, 0.08, BRIDGE.z);      // (on the planks)
  const dryHome = () => { dry.show(DRY_AT, -PI / 2, 'IdleBare'); dry.expr('smile'); DR.face = null; };
  // her roots: thick stems that rise out of the bank where Anne stands (the capture), and a stump with a back of roots
  // that they seat HER on when she has lost (the domination)
  const bark = M({ color: 0x4a3524, roughness: 0.95 }), moss = M({ color: 0x3f6a2a, roughness: 0.95 });
  const THRONE = V3(13.3 * TILE, 0, 18.25 * TILE), TH_YAW = 0.35;
  const throne = new THREE.Group(); throne.position.copy(THRONE); throne.rotation.y = TH_YAW; throne.visible = false; scene.add(throne);
  {
    const b = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.set(rx, ry, rz); k.castShadow = k.receiveShadow = true; throne.add(k); return k; };
    b(new THREE.CylinderGeometry(0.4, 0.46, 0.44, 14), bark, 0, 0.22, -0.06); b(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 14), M({ color: 0xb99668, roughness: 0.9 }), 0, 0.445, -0.06);
    b(new THREE.CylinderGeometry(0.34, 0.42, 1.35, 12, 1, false, PI * 0.5, PI), bark, 0, 1.0, -0.2);      // (a half trunk: the back)
    for (const s of [-1, 1]) { b(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 7), bark, s * 0.31, 0.655, -0.05, PI / 2); b(new THREE.CylinderGeometry(0.045, 0.06, 0.66, 7), bark, s * 0.33, 0.33, 0.2, 0.0, 0, s * 0.1);
      b(new THREE.CylinderGeometry(0.04, 0.09, 0.9, 7), bark, s * 0.62, 0.12, 0.1, PI / 2 - 0.25, s * 0.9, 0); }
    for (let i = 0; i < 7; i++) { const a = i * 0.9; b(new THREE.SphereGeometry(0.12, 8, 6), moss, Math.cos(a) * 0.42, 0.05 + 0.4 * ((i * 37) % 10) / 10, -0.06 + Math.sin(a) * 0.42).scale.set(1, 0.5, 1); }
  }
  // the vines that hold her there: green bands at her wrists and ankles
  const bandM = M({ color: 0x3f7a2a, roughness: 0.8 });
  let BANDS = null, BOUND = 0; const _a = V3(), _b = V3(), _q = new THREE.Quaternion();
  const makeBands = () => [['lowerarm02R', 'wristR', 0.036], ['lowerarm02L', 'wristL', 0.036], ['lowerleg02R', 'footR', 0.047], ['lowerleg02L', 'footL', 0.047]].map(([a, b, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 28), bandM); m.visible = false; m.frustumCulled = false; m.castShadow = true; scene.add(m); return { a: dry.tw.bone(a), b: dry.tw.bone(b), r, m }; });
  function updBands() {
    if (!BANDS) return;
    for (const B of BANDS) { B.m.visible = BOUND > 0.01 && !!B.a && !!B.b; if (!B.m.visible) continue; B.a.getWorldPosition(_a); B.b.getWorldPosition(_b); const d = _b.clone().sub(_a).normalize(); B.m.position.copy(_b).addScaledVector(d, -0.04); B.m.quaternion.copy(_q.setFromUnitVectors(V3(0, 0, 1), d)); B.m.scale.setScalar(B.r * BOUND); }
  }
  // Anne's tickle spell: a conjured feather that flicks over one of the dryad's soles
  const feather = (() => {
    const g = new THREE.Group(), quill = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.26, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })); quill.position.y = 0.13; g.add(quill);
    const vane = new THREE.Shape(); vane.moveTo(0, 0.04); vane.bezierCurveTo(0.045, 0.09, 0.05, 0.2, 0.004, 0.29); vane.bezierCurveTo(-0.04, 0.21, -0.045, 0.09, 0, 0.04);
    g.add(new THREE.Mesh(new THREE.ShapeGeometry(vane, 10), new THREE.MeshLambertMaterial({ color: 0xfff4f8, emissive: 0x6a3550, side: THREE.DoubleSide })));
    g.visible = false; scene.add(g); return g;
  })();
  const FE = { on: false, t: 0, foot: 1, mode: 0 }, _tip = V3(), _up = V3();
  function updFeather(dt, t) {
    if (!FE.on || !dFeet) { feather.visible = false; return; }
    FE.t += dt; const f = dFeet[FE.foot];
    const u = FE.mode === 2 ? 1.12 + 0.08 * Math.sin(FE.t * 5.1) : FE.mode === 1 ? 0.5 + 0.14 * Math.cos(FE.t * 4.3) : 0.2 + 0.7 * (0.5 + 0.5 * Math.sin(FE.t * 2.6));
    along(f, u, _tip).addScaledVector(f.side, 0.014 * Math.sin(FE.t * 7.3)).addScaledVector(f.n, 0.004 + 0.004 * (0.5 + 0.5 * Math.sin(FE.t * 19)));
    // the quill stands off the sole, out and up; the vane's tip is at the skin
    _up.copy(f.n).multiplyScalar(0.75).addScaledVector(f.fwd, 0.3 * Math.sin(FE.t * 2.6)).addScaledVector(f.side, 0.5 * (FE.foot ? 1 : -1)).normalize();
    feather.position.copy(_tip).addScaledVector(_up, 0.29); feather.quaternion.setFromUnitVectors(V3(0, 1, 0), _up.clone().negate()); feather.rotateY(FE.t * 2.1);
    feather.visible = true; if (Math.random() < dt * 7) sparks.burst(_tip.clone(), PINK, 2, 0.3, 0.4);
  }
  if (!DONE()) { dryHome(); S.block('dryad', BRIDGE.x, BRIDGE.z, 1.0); S.avoid(V3(DRY_AT.x, 0, DRY_AT.z), 0.5, 2.2, () => dry.obj.visible && !STAGED); }

  // ---------- her branches have Anne (captures.js `bound`: tied on her front, her captor's vines at her soles) ----------
  const proxy = { get obj() { return dry.obj; }, lean() {}, laugh(on) { dry.expr(on ? 'laugh' : 'smug'); }, shake() { dry.expr('shocked'); }, hop() {} };
  const DRY_SAY = {
    open: [[0, 'Why you humans are so shy?'], [3, 'Such tight little shoes look so weary!\nOff they come, my little butterfly.']],
    tickle: [[5, 'Darling, I love those gorgeous piggies!!'], [0, 'You look stressed!\nFear not, my little butterfly!\nYou are in good hands now']],
    lick: [[1, "Ahhh such melody!\nHuman girl's giggles are my weakeness!"]],
    fast: [[6, 'More!!!\nI wanna play more with you!']],
    lost: [[5, "Hihiihi ...\nDon't get mad! We're just playing!"]],
  };
  async function capture(again) {
    const back0 = BANK.clone();
    if (S.flag('boudicca')) { bou.follow(null); }
    dry.face(yawTo(DRY_AT, SEAT)); dry.expr('smug');
    // roots burst out of the bank round her ankles
    sparks.burst(V3(anne.position.x, 0.2, anne.position.z), GREEN, 26, 1.4, 1.0); S.expr('shocked'); if (has('Startle')) S.clip('Startle', 0.1); S.se('se_Wind4', 0.6, 0.7);
    await S.wait(0.5);
    if (S.flag('boudicca')) { sparks.burst(bou.obj.position.clone().setY(0.6), GREEN, 22, 1.4, 1.0); await S.wait(0.2); }
    const r = await capt.bound({ kind: 'dryad', list: [proxy], keep: true, seat: SEAT, yaw: yawTo(SEAT, DRY_AT), theme: 'vine',
      setup: () => { if (S.flag('boudicca')) bou.hide(); },      // (her roots have Boudicca by the ankles, out of the picture)
      tools: [[0, 0, 'stroke', 'toes', 'frond', { rate: 1.0 }], [0, 1, 'stroke', 'toes', 'frond', { rate: 1.1, ph: 2.0 }], [0, 0, 'arch', 'side', 'catkin', { rate: 1.3 }], [0, 1, 'toes', 'side', 'catkin', { rate: 1.2, ph: 1.1 }]],
      say: async (stage) => { for (const [i, text] of DRY_SAY[stage] || []) await say('dr', i, text); } });
    // (dark) back on the bank, her shoes on again
    S.clip('Idle', 0); S.place(back0, PI / 2); dryHome(); dry.face(-PI / 2);
    await capt.kit.putShoesOn({ at: back0, yaw: PI / 2 });
    party(-1.1, 0.7); S.cam.behind(anne, { cut: true, dist: 4.6 });
    await S.fade(0, 0.5);
    S.toast(r.free ? 'Hands OFF!!|STAY AWAY FROM ME, YOU CREEP!!' : 'She has had her fun... for now.', 'dialog', 2.4); S.expr('angry');
    if (has('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.9); S.clip('Idle', 0.2); }
    if (!again) {
      S.cam.two(anne, V3(DRY_AT.x, 0, DRY_AT.z), { dist: 2.6, y: 1.3 });
      await say('a1', 8, 'This thing is dangerous');
      if (S.flag('boudicca')) await say('bo', 4, "I don't think she's gonna move though...");
      else await S.say('am', 4, 'May you find a clever way to make her move aside?');
      await say('a1', 43, "Ok then we'll have to do the hard way!", { expr: 'angry' });
      S.objective('The dryad will not move: fight her (walk up to the bridge again).');
    }
    S.flag('dryadMet', true); C.checkpoint(); console.log('CH2 capture done');
  }
  async function meetDryad() {
    await S.turnTo(V3(DRY_AT.x, 0, DRY_AT.z), 0.2);
    if (!S.flag('dryadMet')) {
      S.cam.two(anne, V3(DRY_AT.x, 0, DRY_AT.z), { dist: 2.4, y: 1.3 });
      await say('a1', 8, 'mmmhhhh ...\nHello?');
      dry.face(yawTo(DRY_AT, anne.position)); dry.expr('smug'); S.cam.face(dry.obj, { dist: 1.9, y: 1.5, turn: 0.4, yaw: -PI / 2 }); await S.mark('dryad');
      S.cam.face(anne, { dist: 1.8, y: 1.45, turn: 0.4 });
      await say('a1', 5, 'Heeads Up!', { expr: 'shocked' });
      S.cam.face(dry.obj, { dist: 1.9, y: 1.5, turn: 0.4, yaw: -PI / 2 });
      await say('dr', 3, 'Come here, little butterfly');
      await capture(false);
      return;
    }
    // the hard way
    S.cam.two(anne, V3(DRY_AT.x, 0, DRY_AT.z), { dist: 2.6, y: 1.3 }); dry.face(yawTo(DRY_AT, anne.position)); dry.expr('smug');
    await say('dr', 1, pick(['Back for more play, little butterfly?', 'You came back! I knew you liked it.']));
    if (env.music) env.music('battle3.mp3');
    let won = true;
    for (let i = 0; i < 3; i++) {
      const hit = await S.gauge({ label: 'Strike! Press SPACE in the green!', sub: `Dryad  (${i + 1} / 3)`, width: 0.21 - 0.02 * i, speed: 0.85 + 0.09 * i });
      if (!hit) { won = false; break; }
      if (has('Cast')) S.clip('Cast', 0.1);
      const p = V3(DRY_AT.x, 1.2, DRY_AT.z);
      await S.wait(0.18); sparks.burst(C.headPos().add(V3(0, -0.3, 0)), GOLD, 10, 1.0, 0.6);
      await S.wait(0.12); sparks.burst(p, GOLD, 30, 2.2, 1.0); sparks.burst(p, LEAF, 18, 1.4, 1.4); dry.expr('shocked'); S.se('se_Blow3', 0.7);
      if (S.flag('boudicca') && i > 0) { await S.wait(0.15); sparks.burst(p.clone().add(V3(0, -0.3, 0)), new THREE.Color(1.2, 0.6, 1.8), 16, 1.6, 0.8); }
      await S.wait(0.45); S.clip('Idle', 0.2); dry.expr(i < 2 ? 'angry' : 'worried');
    }
    if (env.music) env.music(null);
    if (!won) { S.toast('Her branches are quicker!', 'warning', 2.0); await capture(true); return; }
    await domination();
  }
  S.on({ id: 'dryad', at: V3(BRIDGE.x - 1.9, 0, BRIDGE.z), r: 1.25, touch: true, when: () => !DONE(), run: meetDryad });

  // ---------- she has lost: the party tickles HER (the 2D's DOMINATION: three stages) ----------
  //   [her clip, how fast, her face, blush, voice, Boudicca's hands [L, R], the feather's way: 0 strokes, 1 circles, 2 toes]
  const DSTAGE = {
    still: ['ChairBare', 1, 'worried', 0.2, null, null, -1], s0: ['ChairTickled', 0.8, 'laugh', 0.5, 'giggle', ['trail', 'trail'], 0],
    s1: ['ChairTickled', 1, 'laughHard', 0.7, 'laughter', ['all', 'toes'], 1], s2: ['ChairTickled', 1.2, 'laughHard', 0.9, 'cackling', ['all', 'all'], 2],
    rand: ['ChairTickled', 1, 'laughHard', 0.8, 'laughter', ['toes', 'circle'], 2],
  };
  function dstage(name) {
    const P = DSTAGE[name]; dry.clip(P[0], 0.3); const act = dry.tw.action(P[0]); if (act) act.timeScale = P[1];
    DR.face = P[2]; DR.blush = P[3]; dry.expr(P[2], P[3]); S.voiceLoop(P[4], P[4] === 'cackling' ? 2.2 : 2.8);
    if (S.flag('boudicca')) { fw.hands(...(P[5] || [null, null]), P[5] ? null : 'ready'); if (P[5]) fw.work(); else fw.lean(0.12); }
    FE.on = P[6] >= 0; FE.mode = Math.max(0, P[6]);
  }
  async function domination() {
    S.toast('Time to remove the weeds!|GOTCHAA!!', 'dialog', 2.2); S.expr('smug');
    sparks.burst(V3(DRY_AT.x, 1.0, DRY_AT.z), GREEN, 40, 2.0, 1.2); await S.wait(0.5);
    await S.fade(1, 0.4);
    // her own roots have her: seated on the stump by the road, her wrists and ankles wound with vine
    S.unblock('dryad'); throne.visible = true; S.block('throne', THRONE.x, THRONE.z, 0.7);
    dry.show(THRONE, TH_YAW, 'ChairBare'); dry.expr('worried', 0.2);
    for (let i = 0; i < 3; i++) await S.frame();
    if (!dFeet) dFeet = solesOf(S, dry.obj); dFeet.read(0); dFeet.snap();
    if (!BANDS) BANDS = makeBands(); BOUND = 1;
    fw = footWork(S, C, bou, dFeet, { side: -1 }); STAGED = true;
    if (S.flag('boudicca')) { bou.follow(null); fw.kneel(TH_YAW); bou.expr('happy'); }
    // Anne stands at the dryad's left, before her feet, her hand out over the feather
    const fwd = V3(Math.sin(TH_YAW), 0, Math.cos(TH_YAW)), lft = V3(Math.cos(TH_YAW), 0, -Math.sin(TH_YAW)), m0 = fw.soleMid(V3());
    const AP = V3(m0.x + lft.x * 0.95 + fwd.x * 0.75, 0, m0.z + lft.z * 0.95 + fwd.z * 0.75);
    S.place(AP, yawTo(AP, V3(m0.x, 0, m0.z))); S.clip('Idle', 0); dstage('still'); S.voicePitch = 1.1;
    const rel = (p, f, l, y) => V3(p.x + fwd.x * f + lft.x * l, p.y + y, p.z + fwd.z * f + lft.z * l);
    const shots = {
      wide() { const m = fw.soleMid(V3()); S.cam.set(rel(m, 3.0, -2.2, 1.2), rel(m, -0.5, 0.2, 0.45), { fov: 44, cut: true }); post.setCloseUp('off'); },
      her() { const h = dry.head(V3()); h.y -= 0.08; S.cam.set(rel(h, 1.7, -0.5, 0.1), h, { fov: 30, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
      soles() { const m = fw.soleMid(V3()); S.cam.set(rel(m, 1.0, 0.05, 0.4), m, { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
      anne() { const h = C.headPos(); const y = anne.rotation.y; S.cam.set(V3(h.x + Math.sin(y) * 1.5 + Math.cos(y) * 0.5, h.y + 0.06, h.z + Math.cos(y) * 1.5 - Math.sin(y) * 0.5), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    };
    for (let i = 0; i < 3; i++) await S.frame();
    shots.wide(); await S.fade(0, 0.5); await S.mark('dwon');
    shots.her(); await say('dr', 10, 'M-my own roots?! Let go of me!\nBad roots! BAD!');
    shots.anne(); S.toast('Ready or not, here I go!|Coochie Cooochie Kooo!!|Smile, tree-lover! you are about to be tickled!!', 'dialog', 2.6); S.expr('smug'); await S.wait(1.2);
    if (S.flag('boudicca')) await say('bo', 9, 'Bare feetsies, all tied up for us?\nRookie, this is the best forest EVER. ♥');
    let stage = 0, pts = 0;
    for (let round = 0; round < 12; round++) {
      shots.wide();
      const pk = await S.choice(stage < 3 ? ['Tickle her!', 'Random Spot!', 'Spare her'] : ['Tickle her further!', 'Random Spot!', 'Let her go']);
      if (pk === 2) break;
      S.toast('Tickle her!!!|Tame her!!!|Submit her!!!|Rule her!!!', 'note', 1.4);
      if (has('Cast')) S.clip('Cast', 0.15);
      dstage(pk === 1 ? 'rand' : ['s0', 's1', 's2'][Math.min(2, stage)]); FE.t = 0; FE.foot = 1;
      shots.soles(); if (round === 0) await S.mark('dtickle');
      await S.wait(1.4);
      shots.her(); S.toast(pick(['AHAHAHA!! N-NOT MY ROOTS-- MY FEET!!', 'HIHIHI!! S-STOP IT, LITTLE BUTTERFLY!!', 'OHOHOHO!! NO FAIR!! NO FAIR!!', 'HAHAHA!! B-BAREFOOT WAS A MISTAKE!!']), 'dialog', 2.2); await S.wait(1.0);
      shots.soles();
      for (let i = 0; i < 2; i++) {
        const hit = await S.gauge({ label: 'Tickle her soles! SPACE in the green!', sub: stage < 3 ? `Stage ${stage + 1} / 3` : 'She gave up long ago...', width: pk === 1 ? 0.26 : 0.22, speed: 0.9 + 0.08 * stage });
        if (hit) { pts++; sparks.burst(_tip.clone(), PINK, 14, 0.9, 0.7); }
        else S.toast('She squirms out of reach!', 'note', 1.2);
      }
      dstage('still'); S.clip('Idle', 0.2);
      shots.anne(); S.toast(pick(['How do YOU like it, huh?!', "Who's ticklish now?!", 'Not so fun from that side, is it?!']), 'dialog', 2.0); S.expr('smug');
      if (stage < 3 && pts >= 2) {
        stage++; pts = 0;
        if (stage === 3) { shots.her(); DR.face = 'laughHard'; dry.expr('laughHard', 0.9); S.toast('TOO MUCH TOO MUCH!!  YOU WIN!!|I SURRENDER I SURRENDER  HAHAHAHAH!!!|NO MORE NO MORE PLEASEEE!!!', 'success', 3.2); await S.wait(1.6); }
      }
      await S.wait(0.5);
    }
    dstage('still'); S.voiceLoop(null); FE.on = false;
    shots.her(); DR.face = null; await say('dr', 6, 'AGGGHHH!!! Too much! too much for today!');
    shots.anne(); await say('a1', 3, 'Now get!', { expr: 'smug' });
    if (stage >= 3 && !S.flag('dryadUnlocked')) { S.flag('dryadUnlocked', true); S.toast('DRYAD UNLOCKED!', 'success', 2.4); await S.wait(0.9); S.toast('Another exotic piece in your gallery!', 'note', 2.2); await S.wait(0.6); }
    // her roots let go: she is gone in a whirl of leaves, and the bridge is free
    shots.wide(); await S.wait(0.3);
    sparks.burst(V3(THRONE.x, 1.0, THRONE.z), LEAF, 46, 2.2, 1.4); sparks.burst(V3(THRONE.x, 0.5, THRONE.z), GREEN, 30, 1.6, 1.2); S.se('se_Wind4', 0.7, 0.8);
    BOUND = 0; fw.done(); STAGED = false; dry.hide(); feather.visible = false; S.voicePitch = 1;
    if (S.flag('boudicca')) { bou.clip('ThiefIdle', 0.4); }
    await S.wait(1.0);
    S.flag('dryadDone', true); S.remove('dryad');
    S.toast('The bridge is free!', 'success', 2.4); S.objective('Cross the bridge and follow the South Road to its gate.');
    await S.fade(1, 0.4); throne.visible = false; S.unblock('throne');
    S.place(BANK, PI / 2); S.clip('Idle', 0); party(-1.1, 0.7); S.cam.behind(anne, { cut: true, dist: 4.6 }); await S.fade(0, 0.5); C.checkpoint(); console.log('CH2 dryad done');
  }

  // =====================================================================================================
  //                                  wild Ivy Maidens off the road (creatures.js)
  // =====================================================================================================
  for (const [i, x, y] of [[0, 21, 26], [1, 12, 15]]) {
    const id = 'lysivy' + i, at = ck.spot(x, y), m = ck.add(K.makeIvyMaiden({ seed: 61 + i * 5 }));
    m.obj.position.copy(at.p); m.obj.rotation.y = i * 2.1; S.avoid(m.obj, 0.5, 2.2, () => m.up);
    const rec = { id, at, group: [m], trap: false, out: true };
    const ev = S.on({ id, at: at.p, r: 1.5, touch: true, run: () => ck.encounter(rec) });
    if (!ev) { m.hideNow(); continue; }
    S.block(id, at.p.x, at.p.z, 0.45); ck.roam(rec, { ev, style: 'tiles', radius: 2.2, speed: 1.3, notice: 0 });
  }

  // =====================================================================================================
  //                                             coming in, going out
  // =====================================================================================================
  async function intro() {
    S.cam.behind(anne, { cut: true, dist: 5.2, pitch: 0.34 }); await S.wait(0.5);
    S.cam.face(anne, { dist: 2.4, turn: 0.5, y: 1.45 });
    await say('a1', 4, 'Damn! This forest is thick!');
    await S.say('am', 0, 'It would be wise to stick to the\nSouth Road, that way we do not\nbecome lost.');
    if (S.flag('boudicca')) {
      S.cam.two(anne, bou.obj, { dist: 2.0, y: 1.4 });
      await lines([
        ['bo', 0, "This forest is also full of critters\nand magical creatures created\nfrom the Magicians' School trainings."],
        ['bo', 4, "That's why most merchants transport their\ngoods along the coast."],
        ['bo', 7, 'These roads may become treacherous.\nStay aware.'],
        ['a1', 1, 'Yay...\nmore trouble!'],
      ]);
    }
    S.progress = 105; S.objective('Follow the South Road through the Forest of Lys.'); S.cam.behind(anne, { dist: 5 }); C.checkpoint(); console.log('CH2 lysintro done');
  }
  const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;background:#fff'; document.body.appendChild(flashEl);
  async function bonk() {
    S.se('se_Hammer', 1.0, 0.6); flashEl.style.transition = 'opacity .05s'; flashEl.style.opacity = 0.7; S.emote(anne, 'anger', 1.0);
    const o = C.am.obj; let t = 0; setTimeout(() => { flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = 0; }, 70);
    await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.7), sq = Math.sin(PI * k) * (1 - k * 0.3); o.scale.set(1 + 0.45 * sq, 1 - 0.55 * sq, 1 + 0.45 * sq); return k >= 1; });
    o.scale.set(1, 1, 1);
  }
  // (r 4.2: the whole width of the glade before the gate, five tiles: nobody walks round it)
  S.on({ id: 'mainRoad', at: tc(22, 34), r: 4.2, touch: true, when: () => S.progress < 110, run: async () => {
    if (S.progress < 105) S.progress = 105;
    S.cam.face(anne, { dist: 2.4, turn: 0.5, y: 1.45 });
    await say('a1', 10, "That's the main road!", { expr: 'happy' });
    S.progress = 110; S.toast('Quest: through the Forest of Lys - done!', 'success', 2.4);
    const two = () => { if (S.flag('boudicca')) S.cam.two(anne, bou.obj, { dist: 2.0, y: 1.4 }); }, me = () => S.cam.face(anne, { dist: 2.2, turn: 0.5, y: 1.45 });
    const B = S.flag('boudicca');
    await lines([
      two,
      B ? ['bo', 0, "We're close from Valyndra City,\nwe getting warmer, Amaymon?"] : ['a1', 4, "We're close from Valyndra City.\nAmaymon, can you track the Grimmoire?"],
      ['am', 14, "Yes, we're approaching..."],
      me,
      ['a1', 8, 'Hey, mister "Powerful Arch-Demon", don\'t you\nhave any useful powers?\nFor example ... Being able to teleport...'],
      ['am', 1, 'Of course I do!'],
      ['am', 15, 'I CAN DO EVERYTHING!!!\nHA HA HA!'],
      ['a2', 6, "OH!!!\nWhy didn't you say something sooner???"],
      ['am', 1, "Well u didn't ask!"],
      ['a2', 36, "So... I didn't ask ... I'll ask you then...\ncould you teleport us to the Tower of Lust\nbefore Lilith then?"],
      ['am', 1, 'no.'],
      ['a2', 36, 'To ... Valyndra City?'],
      ['am', 1, 'no.'],
      ['a2', 0, "Didn't say you were able to teleport us?\nGrim Demon God?"],
      ...(B ? [two, ['bo', 0, 'Ohhh ... YES!! TELEPORTING\nI like the sound of that!\nIs the tiny little noddle ball finally\ngiving us a hand?']] : []),
      ['am', 4, 'I could teleport you to my realm if\nyou like!'],
      me,
      ['a2', 6, "I ... don't think I'm interested anymore..."],
      ...(B ? [two, ['bo', 0, "Hey pocket God, what's your realm like?\nIs it a place we could use to relax?\nJust curious ^^"], ['a2', 5, 'Boudicca ...'], ['bo', 0, "Hey, I'm pretty tired from walking all the day!"], ['a2', 41, "Just trust me, that wouldn't ...", { expr: 'worried' }], ['am', 15, 'JUST GIVE ME THE ORDER ANND ...'], () => bonk()]
        : [['am', 4, 'You could learn how to appreciate my\nlimbs hehehe..'], ['a2', 34, "I don't think so..."], ['am', 15, "I'm sure you feel tired and need a massage!!!\nblez ... blez ... blezz ... blezz..."], () => bonk()]),
      me,
      ['a2', 26, 'Shall we continue?'],
      ...(B ? [['am', 11, 'aye']] : []),
    ]);
    S.objective('South, out of the forest: Valyndra City.'); S.cam.behind(anne, { dist: 5 }); C.checkpoint(); console.log('CH2 mainroad done');
  } });
  S.blockExit = (ex) => false;
  S.hint = async () => { await S.say('am', 0, !S.flag('dryadDone') ? 'Stick to the South Road. There is a bridge\nover the river... and somebody standing on it.' : 'The road is clear, kitty.\nSouth, to Valyndra City!'); };
  S.onArrive = () => { C.checkpoint(); party(); if (S.progress < 105) S.run(intro); };
  if (typeof window !== 'undefined') window.__lys = { dry, bou, get fw() { return fw; }, get dFeet() { return dFeet; }, FE, throne };
}
