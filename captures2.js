// captures2.js (10-12): what happens when one of the Forest of Lys's girls has her: the HORNETS and the SLIMES (the 2D
// game's CE 58 SceneHORNET and CE 59 SceneSlime). Built on captures.js's stage and kit (her soles read every frame, her
// loose shoes, the shots) and on thief.js's hands, which keep their air over her soles.
//   - What is played is the 2D's FIRST capture stage, the one that is tickling: her shoes come off and her feet are
//     tickled, with a key prompt to break free. The 2D's later stages are not for this game and are not built: here a
//     SISTER joins for a second round instead, and whoever is still caught after that is tied up (captures.js `bound`,
//     the caller's to chain) as with every other creature.
//   - Everybody stays dressed; only her shoes come off. Lines are the 2D's own where they are about tickling.
//   hornet(rec, o)  she lies on her front (HeldProne); the hornet kneels at her feet; round 2: her sister hovers over the
//                   small of her back and holds her shins while the first has both soles
//   slime(rec, o)   she is sat in a mound of the slime's own jelly, lifted, her ankles and her wrists held up by tendrils
//                   of it (her arms are raised by climb.js's limb tools: no clip of hers has them overhead); the slime
//                   girl stands at her feet; two more tendrils find her underarms; round 2: the green sister, both soles
//   Both return { free } under a black screen with the stage ended, as captures.js's rounds do.
//   rec: { fig (cast3.js figure, already shown once) }; o: { seat, sister (a second figure, or null), setup() (called in the dark before the stage is set) }
const V = new URL(import.meta.url).search;
const { createLimbs } = await import('./climb.js' + V);
const { FACES3 } = await import('./cast3.js' + V);

export function createCaptures2(S, C, env, cap) {
  const { THREE, scene, anne, A, V3 } = S, { sparks, feet, along } = C, { kit, stage } = cap;
  const { begin, end, pose, soleFrame, mid, nH, sideH, shot, side2d, loose } = stage, { throwShoe, makeVine } = kit;
  const has = (n) => A.hasClip && A.hasClip(n), PI = Math.PI, damp = THREE.MathUtils.damp;
  const post = env.post && env.post.setCloseUp ? env.post : { setCloseUp() {} };
  const GOLD = new THREE.Color(1.7, 1.3, 0.4), HONEY = new THREE.Color(1.9, 1.3, 0.25), AQUA = new THREE.Color(0.5, 1.1, 1.9);
  const LB = createLimbs(THREE), UPV = V3(0, 1, 0);
  const chainNext = () => !!(S.capStyle && S.capStyle() === 'both');
  const pick = (L) => L[Math.floor(Math.random() * L.length)];
  const bearing = (v) => Math.atan2(v.x, v.z);

  // ---------- a second figure's hands on her soles (thief.js arms: points with air under them) ----------
  const _fs = V3(), _ft = V3();
  // fingertips at a point `u` along sole j (0 heel .. 1 ball, beyond 1 under her toes), `air` off the skin, the hand lifted `lift` off the sole's plane
  const handAt = (fig, sd, j, uOf, air = 0.02, lift = 0.55) => (X, dir, palm, t) => {
    const f = feet[j]; along(f, uOf(t), X).addScaledVector(f.side, 0.012 * Math.sin(t * 3.1 + j)).addScaledVector(f.n, air);
    fig.shoulder(sd, _fs); _ft.subVectors(X, _fs); _ft.addScaledVector(f.n, -_ft.dot(f.n)); if (_ft.lengthSq() < 1e-6) _ft.copy(f.fwd); _ft.normalize();
    dir.copy(_ft).multiplyScalar(Math.cos(lift)).addScaledVector(f.n, -Math.sin(lift)); palm.copy(f.n).negate();
  };
  // a hand to the heel of the shoe she still has on (no sole under it: 'reach')
  const heelOf = (fig, sd, j) => (X, dir, palm) => { const f = feet[j]; X.copy(f.heel).addScaledVector(f.fwd, -0.03).addScaledVector(f.n, 0.03); fig.shoulder(sd, _fs); dir.subVectors(X, _fs).normalize(); palm.copy(f.n).negate(); };
  // a hand held ready before her, over the toes (so that it comes DOWN on to a sole, never up through a foot)
  const ready = (fig, sd) => (X, dir, palm) => {
    fig.shoulder(sd, _fs); const yaw = fig.obj.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), o = sd === 'L' ? 0.03 : -0.03;
    X.set(_fs.x + fx * 0.27 + Math.cos(yaw) * o, _fs.y - 0.15, _fs.z + fz * 0.27 - Math.sin(yaw) * o); dir.set(fx, 0.1, fz).normalize(); palm.set(fx * 0.3, -1, fz * 0.3).normalize();
  };
  const WAY = {
    trail: (j) => (t) => 0.12 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.85 + j)), toes: (j) => (t) => 1.16 + 0.06 * Math.sin(t * 1.9 + j),
    all: (j) => (t) => 0.5 + 0.38 * Math.sin(t * 2.0 + j * 1.3), coo: (j) => (t) => 0.4 + 0.13 * Math.cos(t * 3.2 + j * 2),
  };
  // facing her soles: the figure's right hand is at her right foot (0) when the two face each other head to feet (kneeling
  // beyond her soles as she lies on her front), and at her LEFT foot (1) when they face each other face to face
  const hands = (fig, L, R, o = {}) => {
    const fl = o.cross ? 0 : 1, fr = o.cross ? 1 : 0;
    fig.arm('L').to(L ? handAt(fig, 'L', fl, WAY[L](fl), o.air, o.lift) : o.rest === false ? null : ready(fig, 'L'), L ? 'claw' : 'reach');
    fig.arm('R').to(R ? handAt(fig, 'R', fr, WAY[R](fr), o.air, o.lift) : o.rest === false ? null : ready(fig, 'R'), R ? 'claw' : 'reach');
  };
  const sayAs = (sheet, fig, shift = 0) => async (i, text, o = {}) => {
    fig.expr(FACES3[sheet][i] || 'smug'); fig.talk(true);
    await S.say(sheet, i + shift, text, Object.assign({ noFeet: !o.feet }, o));
    fig.talk(false);
  };
  const tickled = (toes, bank, face = 'laughHard', blush = 0.85) => { S.toes(toes, 1.4 + toes * 3, Infinity); S.voiceLoop(bank, bank === 'cackling' ? 2.2 : bank === 'laughter' ? 2.6 : 3.2); S.expr(face, blush); };
  const calm = () => { S.toes(0); S.voiceLoop(null); };
  const shoesAside = () => loose.forEach((s, i) => { const p = V3().copy(mid).addScaledVector(sideH, i ? 0.7 : -0.7).setY(0.035); s.g.visible = true; s.t = -1; s.carry = null; s.rest.set(1.5, i ? 0.7 : -0.5, 0.2); s.to = (out) => out.copy(p); });
  // a hand of the figure's pulls one of her shoes off by its heel and it flies aside
  async function pullShoe(fig, sd, i) {
    const a = fig.arm(sd); a.hold('grip'); a.to(heelOf(fig, sd, i), 'reach'); await S.wait(0.75);
    A.setShoe(i ? 'L' : 'R', false); throwShoe(i, (out) => out.copy(mid).addScaledVector(sideH, i ? 0.75 : -0.75).setY(0.05), 0.55); S.se('se_Jump1', 0.5, 1.3);
    a.hold('easy'); a.to(ready(fig, sd), 'reach'); await S.wait(0.35);
  }

  // =====================================================================================================
  //                                               the hornets
  // =====================================================================================================
  const _hb = V3(), _hs = V3();
  async function hornet(rec, o = {}) {
    const fig = rec.fig, sis = o.sister || null, seat = (o.seat || anne.position).clone();
    const yaw = Math.atan2(fig.obj.position.x - seat.x, fig.obj.position.z - seat.z);
    const say = sayAs('ho', fig), say2 = sis ? sayAs('ho', sis, 4) : say;
    await S.fade(1, 0.35);
    if (o.setup) o.setup();                          // (the dark: whoever travels with her is taken out of the picture)
    begin(seat, yaw, []);
    let free = false;
    try {
      // ---------- 1: on her front, stung and dizzy; the hornet kneels at her feet ----------
      A.setHeelsWorn(true); await pose('HeldProne', yaw + PI);                       // (her feet towards the hornet)
      const fy = Math.atan2(-nH.x, -nH.z), at = V3().copy(mid).addScaledVector(nH, 0.43).setY(0);
      fig.follow(null); fig.target(null); fig.hover(0, 0); fig.buzz(0.3); fig.show(at, fy, 'KneelSit'); fig.face(fy); fig.lean(0, true); fig.expr('smug'); hands(fig, null, null);
      if (sis) sis.hide();
      const wide = (o2 = {}) => { post.setCloseUp('off'); shot.wide(Object.assign({ flip: true, sgn: 0.75, dist: 3.3, pitch: 0.2 }, o2)); };
      const soles = (turn = 1.0) => { shot.soles({ pitch: 0.5, dist: 1.25, fov: 32, turn }); post.setCloseUp('on'); };
      wide(); S.expr('worried', 0.3); await S.wait(0.3); await S.fade(0, 0.4); await S.mark('hornet1');
      await S.say('a2', 24, 'UUhhhhhhhh .......\n ---- this feels weird ...', { expr: 'worried', noFeet: true });
      await say(0, "You don't need footwear anymore, prezziousss!!\n .... BZZZTTT!!", { feet: true });
      soles(0.9); await pullShoe(fig, 'R', 0); await pullShoe(fig, 'L', 1); await S.mark('hornet1s');
      wide(); await S.say('a2', 15, "Ahhhhhhhh ...... care-ful ... there ...\nI'm kinda ticklish ...", { expr: 'embarrassed', blush: 0.5, noFeet: true });
      // a slow line down one sole
      hands(fig, null, 'trail'); tickled(0.22, 'giggle', 'strain', 0.5); soles(1.05); await S.wait(0.5);
      await say(0, "What's wrong, my little butterfly?");
      await S.say('a2', 24, 'GGnnnnn .... sstop doing thaaaAAAHTTT!!!\nIt feels ....', { expr: 'strain', blush: 0.6, noFeet: true });
      await say(0, 'Feeling dizzy?');
      await S.say('a1', 23, '...weirddd ....', { expr: 'worried', blush: 0.6, noFeet: true });
      // under her toes, both hands
      hands(fig, 'toes', 'toes'); tickled(0.34, 'laughter'); await S.mark('hornet1t');
      await say(0, "You can trust me, lil flower ...\nyou're at the best hands ♥!!");
      shot.face({ dist: 1.3 }); post.setCloseUp('off');
      await S.say('a1', 38, 'stoop it stooooppppp-iiiitttt .....\n\nleave me aloonnneeeeeeeeee ...', { expr: 'laughHard', blush: 0.8, noFeet: true });
      soles(-0.9);
      await say(0, 'Oh LOOK AT THESE BEAUTIFUL SMOOTH SOLESSS!!!', { feet: true });
      hands(fig, 'all', 'all'); tickled(0.4, 'laughter');
      await S.say('a1', 35, 'ooohhhhaha hheheheh .... hohohohoh\nhahahahah .....', { expr: 'laughHard', blush: 0.85, noFeet: true });
      await say(0, 'So delicate and wiggly!!\nLike the wings of a butterfly, little lily...', { feet: true });
      wide();
      await say(1, 'Your cheerful laugh is our pollen, lily ♥\nYour giggles, our NECTAR!!!');
      free = await S.gauge({ label: 'Buck her off! Press SPACE in the green!', sub: 'Try 1 / 2', width: 0.22, speed: 0.85 });
      if (!free) {
        // ---------- 2: her sister hovers over the small of her back and holds her shins; both soles are the first one's ----------
        await say(4, 'Too bad, sweetie.');
        if (sis) {
          await say(0, "HERE!! ASSIST ME, SISTERSSSSS!!!\nWe've found the QUEEN of the hive!!");
          const b = kit.bone('spine04') || anne; b.getWorldPosition(_hb);
          const from = V3(_hb.x - nH.x * 1.2 + sideH.x * 2.2, 2.4, _hb.z - nH.z * 1.2 + sideH.z * 2.2), yawS = bearing(nH);
          sis.follow(null); sis.target(null); sis.show(from, yawS, 'KneelSit'); sis.face(yawS); sis.buzz(1); sis.hover(1, from.y - 0.3); sis.expr('happy');
          wide({ dist: 3.9 }); S.se('se_Wind4', 0.5, 1.6);
          let k = 0; const to = V3(_hb.x - nH.x * 0.05, _hb.y + 0.16, _hb.z - nH.z * 0.05);
          await S.until((dt) => { k = Math.min(1, k + dt / 0.9); const e = k * k * (3 - 2 * k); sis.obj.position.x = from.x + (to.x - from.x) * e; sis.obj.position.z = from.z + (to.z - from.z) * e; sis.hover(1, from.y - 0.3 + (to.y - from.y) * e); return k >= 1; });
          sis.lean(0.55); sis.buzz(0.6);
          // her hands hold a shin each (no sole under them: 'reach')
          for (const [sd, j] of [['L', 1], ['R', 0]]) { const a = sis.arm(sd); a.hold('grip'); a.to((X, dir, palm) => { const f = feet[j]; f.shin.getWorldPosition(X); f.foot.getWorldPosition(_hs); X.lerp(_hs, 0.35); sis.shoulder(sd, _fs); dir.subVectors(X, _fs).normalize(); palm.copy(dir); X.addScaledVector(dir, -0.045); }, 'reach'); }
          await S.wait(0.5); await S.mark('hornet2');
          await say2(0, 'Prezzzious legs!!\nPrezzious feetzzzzzzzzzZZZZ ....');
        }
        hands(fig, 'all', 'coo'); tickled(0.45, 'cackling', 'laughHard', 0.95); soles(1.0);
        await S.say('a2', 28, 'nononono sttopp!!! haAahhahahah!!!', { expr: 'laughHard', blush: 0.95, noFeet: true });
        await say(0, "Let'zzzzzeeeeeee now the other one!!!!\n\nlovely and perfect symmetry!", { feet: true });
        hands(fig, 'coo', 'all'); await S.wait(1.0); shot.face({ dist: 1.3 }); post.setCloseUp('off'); await S.wait(1.0);
        soles(-1.0);
        await say(1, "But we're just getting started, lily!\nI bet we can get more from these\nbeautiful perfect feet!!", { feet: true });
        hands(fig, 'toes', 'toes');
        await S.say('a1', 27, 'plleeeeaasssshhheee-stoooppittttttt...\neeeeeeeeeehhhhhh', { expr: 'laughHard', blush: 1.0, noFeet: true });
        wide({ dist: sis ? 3.9 : 3.3 });
        free = await S.gauge({ label: 'Kick free! Press SPACE in the green!', sub: chainNext() ? 'before they tie you up' : 'Last chance', width: 0.18, speed: 0.9 });
      }
      calm();
      if (free) { sparks.burst(mid.clone(), GOLD, 30, 2.2, 1.0); fig.expr('shocked'); if (sis) sis.expr('shocked'); S.expr('angry'); S.toast(pick(['STAP IT ALREADY, YOU CREEPY THING!!!', 'HANDS OFF!!']), 'dialog', 2.4); await S.wait(0.6); }
      else { await S.say('a2', 18, 'N-NO MORE!! AHAHAHAHAHAHA!!', { expr: 'laughHard', blush: 1.0, noFeet: true }); await S.mark('hornetaway'); await S.wait(0.6); }
      await S.fade(1, 0.3);
    } finally {
      calm();
      for (const f of [fig, sis]) if (f && f.obj) { f.arm('L').to(null); f.arm('R').to(null); f.arm('L').hold('easy'); f.arm('R').hold('easy'); f.lean(0, true); f.hover(0, 0); f.buzz(1); }
    }
    end();
    return { free };
  }

  // =====================================================================================================
  //                                                the slimes
  // =====================================================================================================
  // her jelly: the mound Anne is sat in, four tendrils that hold her (ankles, wrists), two that find her underarms
  const SL = { on: false, arms: 0, armsGoal: 0, up: 0, upGoal: 0, rate: 1, tau: 0, root: V3(), hold: null, tips: null, mound: null, pose: null, lift: 0 };
  const _s1 = V3(), _s2 = V3(), _s3 = V3(), _s4 = V3(), _wl = V3(), _pl = V3(), _hd = V3(), _hf = V3(), _hl = V3();
  function slimeProps(fig) {
    if (SL.hold) return;
    const J = fig.jelly || { skin: [0.24, 0.42, 0.86], deep: [0.06, 0.13, 0.5] }, c0 = new THREE.Color(...J.deep), c1 = new THREE.Color(...J.skin);
    SL.hold = [0, 1, 2, 3].map(() => makeVine(c0, c1, 18, 8)); SL.tips = [0, 1].map(() => makeVine(c0, c1, 22, 8));
    const geo = new THREE.SphereGeometry(1, 30, 16), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getZ(i), P.getX(i)), y = Math.max(-0.1, P.getY(i)), k = 1 + 0.1 * Math.sin(a * 3 + 0.5) + 0.06 * Math.sin(a * 5 + 1.7); P.setXYZ(i, P.getX(i) * 0.62 * k * (1.15 - 0.3 * y), y * 0.46, P.getZ(i) * 0.6 * k * (1.15 - 0.3 * y)); }
    geo.computeVertexNormals();
    SL.mound = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c1, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82, emissive: new THREE.Color(J.skin[0] * 0.16, J.skin[1] * 0.16, J.skin[2] * 0.16) }));
    SL.mound.visible = false; SL.mound.receiveShadow = true; SL.mound.renderOrder = 2; scene.add(SL.mound);
    SL.pose = LB.pose(anne); SL.R = LB.rigOf(anne);
  }
  function updSlime(dt) {
    if (!SL.hold) return;
    if (!SL.on) { for (const v of [...SL.hold, ...SL.tips]) v.hide(); if (SL.mound) SL.mound.visible = false; return; }
    SL.tau += dt * SL.rate; SL.arms = damp(SL.arms, SL.armsGoal, 3, dt); SL.up = damp(SL.up, SL.upGoal, 4, dt);
    SL.mound.visible = true; { const k = 1 + 0.03 * Math.sin(SL.tau * 2.1); SL.mound.scale.set(k, 1 + 0.06 * Math.sin(SL.tau * 2.1 + 1), 2 - k); }
    // her arms: wrists held up over her head, a little apart (her clip has them behind her; the limb tools raise them)
    SL.pose.begin();
    if (SL.up > 0.01) {
      const R = SL.R; C.headPos(_hd); _hf.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)); _hl.set(_hf.z, 0, -_hf.x);
      for (const sd of ['L', 'R']) {
        const s = sd === 'L' ? 1 : -1, sway = 0.02 * Math.sin(SL.tau * 3.1 + s);
        _wl.copy(_hd).addScaledVector(_hl, s * 0.26 + sway).addScaledVector(_hf, -0.16); _wl.y += 0.3 + 0.02 * Math.sin(SL.tau * 2.3 + s);
        anne.worldToLocal(_wl); _pl.set(s * 0.9, -0.2, 0.5);
        LB.reach(anne, R.arm[sd], _wl, _pl, SL.up);
        LB.hand(anne, R, sd, _s4.set(s * 0.15, 1, -0.15).normalize(), _s3.set(0, 0, 1), 0.35, SL.up);
      }
    }
    SL.pose.keep();
    // the holders: 0, 1 her ankles; 2, 3 her wrists
    SL.hold.forEach((v, i) => {
      if (i < 2) { feet[i].shin.getWorldPosition(_s1); feet[i].foot.getWorldPosition(_s2); _s1.lerp(_s2, 0.82); }
      else { if (SL.up < 0.3) { v.hide(); return; } SL.R.arm[i === 2 ? 'R' : 'L'].end.getWorldPosition(_s1); }
      _s2.copy(SL.root); _s2.x += (i % 2 ? 0.18 : -0.18) * (i < 2 ? 1 : 1.6); _s3.lerpVectors(_s2, _s1, 0.5); _s3.y += i < 2 ? 0.1 : 0.55; _s4.lerpVectors(_s2, _s1, 0.86); _s4.y += i < 2 ? -0.08 : 0.16;
      v.draw(_s2, _s3, _s4, _s1, UPV, 0.05, 0.022);
    });
    // the two that tickle under her arms: tips set a little below and before each shoulder joint, wiggling
    SL.tips.forEach((v, j) => {
      if (SL.arms < 0.03 || SL.up < 0.6) { v.hide(); return; }
      const up = SL.R.arm[j ? 'L' : 'R'].up; up.getWorldPosition(_s1);
      _hf.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y));
      _s1.y -= 0.075 - 0.012 * Math.sin(SL.tau * 6.3 + j); _s1.addScaledVector(_hf, 0.075 + 0.012 * Math.sin(SL.tau * 9 + j * 2));
      _s2.copy(SL.root); _s2.x += j ? 0.5 : -0.5; _s3.lerpVectors(_s2, _s1, 0.5); _s3.y += 0.25; _s3.addScaledVector(_hf, 0.35); _s4.copy(_s1).addScaledVector(_hf, 0.12); _s4.y -= 0.03;
      v.draw(_s2, _s3, _s4, _s1, UPV, 0.032 * SL.arms, 0.006);
    });
  }
  S.late.push((dt) => { if (stage.st || SL.on) updSlime(dt); });

  async function slime(rec, o = {}) {
    const fig = rec.fig, sis = o.sister || null, seat = (o.seat || anne.position).clone();
    const yaw = Math.atan2(fig.obj.position.x - seat.x, fig.obj.position.z - seat.z);
    const say = sayAs('sl', fig), say2 = sis ? sayAs('sl', sis, 4) : say;
    slimeProps(fig);
    await S.fade(1, 0.35);
    if (o.setup) o.setup();
    begin(seat, yaw, []);
    let free = false;
    const LIFT = 0.36;
    try {
      // ---------- 1: sat in the slime's jelly, lifted, her ankles held out; the slime girl at her feet ----------
      A.setHeelsWorn(true); await pose(has('VineHeldShod') ? 'VineHeldShod' : 'SitBoth');      // (her feet towards the slime)
      anne.position.y = LIFT; C.snapSoles(); await S.frame(); await S.frame(); C.snapSoles(); await S.frame(); soleFrame();
      SL.root.copy(seat).setY(0.03); SL.mound.position.copy(seat).setY(0); SL.mound.rotation.y = yaw; SL.on = true; SL.arms = SL.armsGoal = 0; SL.up = SL.upGoal = 0; SL.rate = 1; SL.tau = 0;
      const fy = Math.atan2(-nH.x, -nH.z), at = V3().copy(mid).addScaledVector(nH, 0.5).setY(0);
      fig.follow(null); fig.target(null); fig.show(at, fy, 'IdleBare'); fig.face(fy); fig.lean(0.3, true); fig.expr('smug'); hands(fig, null, null, { cross: true });
      if (sis) sis.hide();
      const cc = V3();
      const wide = (o2 = {}) => { cc.lerpVectors(seat, at, 0.5).setY(0.85); side2d(cc, Object.assign({ dist: 4.0, fov: 38, see: [C.headPos(), fig.head(V3()), mid.clone()] }, o2)); };
      const soles = (turn = 0.3) => { shot.soles({ turn }); post.setCloseUp('on'); };
      wide(); S.expr('shocked', 0.3); await S.wait(0.3); await S.fade(0, 0.45); await S.mark('slime1');
      await S.say('a2', 19, 'EEEEEKK ! ! !', { expr: 'shocked', noFeet: true });
      await say(2, 'Shoes off! no footwear is allowed here.♥...', { feet: true });
      soles(0.35); await pullShoe(fig, 'L', 0); await pullShoe(fig, 'R', 1); if (has('VineHeld')) S.clip('VineHeld', 0.3); await S.mark('slime1s');
      // her wrists are taken too, and up they go
      SL.upGoal = 1; wide(); S.se('se_Liquid', 0.6, 1.1); await S.wait(0.7);
      hands(fig, 'trail', null, { cross: true }); tickled(0.22, 'giggle', 'strain', 0.5); soles(0.3);
      await say(2, 'Ohh!!\nthose are quite a sensitive pair of feet,\ngirl.', { feet: true });
      hands(fig, 'toes', 'toes', { cross: true }); tickled(0.32, 'laughter');
      shot.face({ dist: 1.5 }); post.setCloseUp('off');
      await S.say('a2', 16, 'HANDS OFF!!\n \n    LET MY FEET ALONE!!', { expr: 'laughHard', blush: 0.7, noFeet: true });
      wide();
      await say(1, 'I wonder what else makes you giggle like this!'); await S.mark('slime1t');
      // two more tendrils, under her arms
      SL.armsGoal = 1; S.se('se_Liquid', 0.5, 1.4); shot.face({ dist: 1.9, turn: 0.35 }); post.setCloseUp('off');
      await say(1, "Aren't those armpits way too exposed, sweetie?");
      tickled(0.36, 'laughter', 'laughHard', 0.9); await S.wait(1.2); await S.mark('slime1a');
      await say(3, "You'll learn to praise your new mistress!");
      hands(fig, 'all', 'all', { cross: true }); soles(-0.3);
      await say(0, "Or ... maybe you're willing me to play\na bit more with you?", { feet: true });
      await say(1, "Let's see how ticklish those toes are!", { feet: true });
      hands(fig, 'toes', 'coo', { cross: true });
      wide();
      await S.say('a2', 4, 'KEEP YOUR SLIMY HANDS OFF ME!!', { expr: 'angry', blush: 0.6, noFeet: true });
      free = await S.gauge({ label: 'Slip free! Press SPACE in the green!', sub: 'Try 1 / 2', width: 0.22, speed: 0.85 });
      if (free) { await S.say('a1', 5, 'Time to teach you a lesson,\nyou nasty jelly!', { expr: 'angry', noFeet: true }); }
      else {
        // ---------- 2: her sister rises at her other side; a sole each, and her underarms ----------
        await say(1, 'TOO BAD!! you failed, darling!');
        if (sis) {
          const at2 = V3().copy(mid).addScaledVector(nH, 0.42).addScaledVector(sideH, 0.62).setY(0), a1 = V3().copy(mid).addScaledVector(nH, 0.42).addScaledVector(sideH, -0.62).setY(0);
          await S.fade(1, 0.25);
          fig.show(a1, Math.atan2(mid.x - a1.x, mid.z - a1.z), 'IdleBare'); fig.lean(0.3, true);
          sis.follow(null); sis.target(null); sis.show(at2, Math.atan2(mid.x - at2.x, mid.z - at2.z), 'IdleBare'); sis.lean(0.3, true); sis.expr('happy');
          // (each has the sole on her own side with both hands)
          fig.arm('L').to(handAt(fig, 'L', 0, WAY.all(0)), 'claw'); fig.arm('R').to(handAt(fig, 'R', 0, WAY.toes(0)), 'claw');
          sis.arm('L').to(handAt(sis, 'L', 1, WAY.toes(1)), 'claw'); sis.arm('R').to(handAt(sis, 'R', 1, WAY.all(1)), 'claw');
          SL.rate = 1.5; tickled(0.44, 'cackling', 'laughHard', 0.95); wide({ dist: 4.3 }); await S.wait(0.25); await S.fade(0, 0.3); await S.mark('slime2');
        } else { SL.rate = 1.5; hands(fig, 'all', 'all', { cross: true }); tickled(0.44, 'cackling', 'laughHard', 0.95); }
        await S.say('a2', 18, 'HOHOHO HOHOHOHO HAHAHAHAHAHAHA!!!\nHO HOHOHOHOHOHOHOHOOOOOO!!!\nNOOOOOOOOOOOOOOOO STOP IT ALREADY!', { expr: 'laughHard', blush: 0.95, noFeet: true });
        soles(0.0);
        await say(2, "Ohhh yees.... can you feel it?\nMana flows wild when you laugh!\nDon't wanna share some with me, darling?", { feet: true });
        await say2(1, "you'll see ...\nIt's a win-win deal ...");
        await say(1, 'I feed from your sweet magic ...');
        shot.face({ dist: 1.7, turn: 0.3 }); post.setCloseUp('off');
        await say2(3, '\n\n    ....  And you get a good laugh!!!');
        await say(3, "I can't get enough of your tasty mana, honey!");
        soles(-0.25);
        await say(1, 'Come on!\nLaugh it out! and share your tasty Magic with me ♥', { feet: true });
        await say2(0, 'We can do it the easy way ... or...');
        wide({ dist: sis ? 4.3 : 4.0 });
        await S.say('a2', 24, 'GGGGNNNNNNNNNNNNN!!!!!\n... nNNNNNOOO NNnnnnnEEEVEER!!!', { expr: 'strain', blush: 0.9, noFeet: true });
        free = await S.gauge({ label: 'Slip free! Press SPACE in the green!', sub: chainNext() ? 'before they tie you up' : 'Last chance', width: 0.18, speed: 0.9 });
        if (free) { await S.say('a2', 4, 'PLAYTIME IS OVER!', { expr: 'angry', noFeet: true }); await say(0, "OHhhhh ...\n\n    Where do you think you're going?\n    We're not done here, darling!"); }
        else { await say(3, "YOU CAN'T ESCAPE, HONEY!!\nI see we'll have to do this the hard way!"); await say2(1, 'Ready or not ...\n\n    here we come!'); }
      }
      calm();
      if (free) { sparks.burst(mid.clone(), AQUA, 30, 2.2, 1.0); fig.expr('shocked'); if (sis) sis.expr('shocked'); S.expr('angry'); S.toast('Stay away!!', 'dialog', 2.2); await S.wait(0.6); }
      else { await S.mark('slimeaway'); await S.wait(0.5); }
      await S.fade(1, 0.3);
    } finally {
      calm(); SL.on = false; SL.arms = SL.armsGoal = SL.up = SL.upGoal = 0; if (SL.pose) SL.pose.drop(); updSlime(0); anne.position.y = 0;
      for (const f of [fig, sis]) if (f && f.obj) { f.arm('L').to(null); f.arm('R').to(null); f.arm('L').hold('easy'); f.arm('R').hold('easy'); f.lean(0, true); }
    }
    end();
    return { free };
  }

  return { hornet, slime, hands, handAt, ready, sayAs, WAY, limbs: LB };
}
