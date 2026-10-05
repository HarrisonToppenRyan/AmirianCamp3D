// story_edge.js: the clearing at the very edge of the North Forest (the 2D game's Map 12 "DemoTransition"), where the
// Chapter 1 epilogue plays (CommonEvent 107 CHAPTER1_EPILOGUE: labels ANNE, BOUDICCA, _RESIST, _BOU1 and the
// "Meanwhile..." cutaway). Lines are the 2D's own; see EPILOGUE_SPEC (scratch notes) for the source of each.
//   ANNE      she comes out of the trees by the lotus pond and talks money with Amaymon; Boudicca, unseen, hops closer
//             through the branches, and pounces on her from behind.
//   BOUDICCA  in a hidden glade at dusk, hogtied on her front (shoes and hat off, nothing else), Boudicca kneeling at
//             her feet questions her: about the demon in the tower and Lilith's mark, which she means to find on Anne's
//             soles with her fingers. The mark flares; the talk; Boudicca decides to come along; one last go at
//             her feet ("I would never forgive myself...").
//   _RESIST   the 3D plays only this answer to "Did you like that?" (the other is not recreated).
//   _BOU1     on a black screen, an unseen thief takes the Grimmoire and all their coin.
//   _BOU2     "Meanwhile... Lilith is recruiting new powerful followers..." (her and Lyra's lines over black), then
//             the road (story_road.js).
// Not recreated (content rule, as everywhere in this game): the 2D's _ENJOY answer, its lust gauges, the Lyra and
// Lucille seductions, and the few innuendo lines, which have harmless stand-ins here. After the chapter is done the
// clearing is open to walk about: the trail north goes back into the forest, the meadow's east end to the road.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3 } = S, C = common(S), { sparks, feet, along } = C;
  const cap = createCaptures(S, C, env), stg = cap.stage, ties = cap.ties, kit = cap.kit;
  const bou = createBoudicca(S, C);
  const PI = Math.PI, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, post = env.post;
  const tc = (x, y) => S.tileC(x, y);
  const GOLD = new THREE.Color(1.7, 1.3, 0.4), PINK = new THREE.Color(1.8, 0.45, 1.3), LEAF = new THREE.Color(1.0, 1.15, 0.35);
  const grade = (g) => { if (post && post.setGrade) post.setGrade(...g); };
  const DAY = [1.08, 0.97, 0.88, 0.12, 1.0], DUSK = [0.86, 0.84, 1.0, 0.2, 0.86];      // (the 2D: (16,-16,-16,32) warm late day; (-68,-68,-68) the glade)
  grade(DAY);
  S.late.push((dt, t) => { if (TIED) updMouth(dt); bou.update(dt, t); if (TIED) { ties.update(); updMark(dt, t); updTongue(dt); } });      // (10-03: where she is first, her arms aimed from there, her tongue from this frame's mouth)

  // =====================================================================================================
  //                                                 the clearing
  // =====================================================================================================
  // the stone fire pit on its spit of grass between the lotus water and the deep water (6,5)
  {
    const P = tc(6, 5), stone = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.92 }), char = new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 1 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + 0.03 * Math.sin(i * 3.1), 0), stone); s.position.set(P.x + Math.cos(a) * 0.4, 0.06, P.z + Math.sin(a) * 0.4); s.rotation.set(i, i * 2, 0); s.scale.y = 0.7; s.castShadow = s.receiveShadow = true; scene.add(s); }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), char); ash.rotation.x = -PI / 2; ash.position.set(P.x, 0.012, P.z); scene.add(ash);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 7), char); l.rotation.set(PI / 2, 0, i * 2.1); l.position.set(P.x, 0.06 + i * 0.02, P.z); l.castShadow = true; scene.add(l); }
  }
  // Boudicca's perches: three boughs reaching out over the trail from the trees at its east side (in the 2D she stands
  // on the canopy itself), the furthest north first
  const PERCH = [V3(22.95, 3.3, 1.25), V3(22.85, 3.05, 2.75), V3(22.75, 2.8, 4.3)];
  {
    // (one old tree at the trail's east side: its trunk, and three low boughs reaching out over the trail)
    const bark = new THREE.MeshStandardMaterial({ color: 0x55402c, roughness: 0.95 });
    const span = (a, b, r0, r1) => { const d = V3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 9), bark); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); m.castShadow = m.receiveShadow = true; scene.add(m); };
    const TR = V3(24.15, 0, 2.75);
    span(TR, V3(TR.x + 0.05, 7.5, TR.z - 0.1), 0.3, 0.17);
    for (const p of PERCH) {
      const at = V3(TR.x - 0.1, p.y + 0.35, TR.z + (p.z - TR.z) * 0.25), under = V3(p.x, p.y - 0.08, p.z), dir = V3().subVectors(under, at).setY(0).normalize();
      span(at, under, 0.12, 0.08); span(under, V3(under.x + dir.x * 0.7, under.y + 0.12, under.z + dir.z * 0.7), 0.08, 0.025);
      span(V3().lerpVectors(at, under, 0.5), V3().lerpVectors(at, under, 0.5).add(V3(-0.2, 0.55, 0.35)), 0.04, 0.012);      // (a twig)
    }
  }
  // the Grimmoire of Conjuration and her coin pouch: lying "just around" at the edge of the glade while they are busy
  const GLADE = tc(8, 23);
  const loot = new THREE.Group(); loot.visible = false; scene.add(loot);
  {
    const book = new THREE.Group(), cover = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.7 }), pages = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.34), cover), c2 = c1.clone(), pg = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.06, 0.325), pages);
    c1.position.y = 0.006; pg.position.set(0.004, 0.042, 0); c2.position.y = 0.078; const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.084, 0.34), cover); sp.position.set(-0.125, 0.042, 0);
    const sig = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 24), new THREE.MeshStandardMaterial({ color: 0xd7a83a, metalness: 0.7, roughness: 0.35, emissive: 0x3a2400 })); sig.rotation.x = PI / 2; sig.position.y = 0.086;
    book.add(c1, c2, pg, sp, sig); book.traverse((o) => { if (o.isMesh) o.castShadow = true; }); book.position.set(GLADE.x - 2.3, 0, GLADE.z - 1.5); book.rotation.y = 0.5; loot.add(book);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.95 })); sack.scale.set(1, 0.8, 1); sack.position.set(GLADE.x - 2.0, 0.07, GLADE.z - 1.25); sack.castShadow = true; loot.add(sack);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.05, 10), sack.material); neck.position.set(sack.position.x, 0.15, sack.position.z); loot.add(neck);
  }

  // =====================================================================================================
  //                                  screen flashes, Lilith's mark, Boudicca's lips
  // =====================================================================================================
  const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity .08s'; document.body.appendChild(flashEl);
  const flash = async (col, sec = 0.5, peak = 0.85) => { flashEl.style.background = col; flashEl.style.transition = 'opacity .06s'; flashEl.style.opacity = peak; await S.wait(0.08); flashEl.style.transition = `opacity ${sec}s`; flashEl.style.opacity = 0; };
  // the mark: a small magenta sigil on the arch of her left sole (the 2D never says where: the 3D's choice), unseen until it flares
  const markTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.translate(64, 64);
    x.strokeStyle = '#ff6ad8'; x.fillStyle = '#ff6ad8'; x.lineWidth = 5; x.lineCap = 'round'; x.shadowColor = '#ff2fb4'; x.shadowBlur = 10;
    x.beginPath(); x.arc(0, 4, 34, 0, PI * 2); x.stroke();                                               // ring
    x.beginPath(); x.moveTo(0, 26); x.bezierCurveTo(-30, 2, -16, -22, 0, -6); x.bezierCurveTo(16, -22, 30, 2, 0, 26); x.stroke();      // heart
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 14, -26); x.quadraticCurveTo(s * 30, -40, s * 22, -56); x.stroke(); }      // horns
    x.beginPath(); x.moveTo(0, 38); x.quadraticCurveTo(10, 50, 0, 58); x.lineTo(-6, 52); x.stroke();      // tail
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.052), new THREE.MeshBasicMaterial({ map: markTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
  mark.renderOrder = 6; mark.visible = false; scene.add(mark);
  const MK = { k: 0, goal: 0, flare: 0 }, _m = V3();
  function updMark(dt, t) {
    MK.k = damp(MK.k, MK.goal, 2.5, dt); MK.flare = Math.max(0, MK.flare - dt * 0.7); mark.visible = MK.k > 0.01 || MK.flare > 0.01; if (!mark.visible) return;
    const f = feet[1]; along(f, 0.52, _m).addScaledVector(f.n, 0.0028); C.orient(mark, _m, f.fwd, f.n);
    mark.material.opacity = Math.min(1, MK.k * (0.7 + 0.3 * Math.sin(t * 3.1)) + MK.flare); mark.scale.setScalar(1 + MK.flare * 0.7);
  }
  // her lips and tongue: she leans down until her mouth is at a sole (a lick of the capture kit's, or a kiss)
  const tongue = kit.makeTongue('#cf4f6c');
  const LK = { on: false, kiss: false, k: 0, foot: 1, u: 0.55, home: V3(), lean: 0, close: false }, _mo = V3(), _w = V3();
  // (tests: &bmr= &bmv= &blp=) how fast her body follows her mouth's place (1/s) and its top speed (m/s); how fast she leans
  // (1/s, rad/s at most); the seconds one lick takes (it was 1.1)
  const EQ = (k, d) => { const q = new URLSearchParams(location.search); return q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : d; };
  const MOUTH = { rate: EQ('bmr', 3.0), vmax: EQ('bmv', 0.28), leanRate: 3.5, leanMax: 0.7, lick: EQ('blp', 2.2) };
  function updMouth(dt) {
    const tw = bou.tw; if (!tw || !tw.mouth) return;
    const near = LK.on || LK.kiss;
    LK.k = damp(LK.k, LK.on && LK.close ? 1 : 0, 4, dt);      // (her tongue comes out once her mouth is at the sole: on her way there it reached for it across 15 cm of air)
    if (near) {
      const f = feet[LK.foot]; tw.mouth.getWorldPosition(_mo);
      kit.soleSpot(f, LK.u + (LK.kiss ? 0.25 * Math.sin(S.time() * 0.9) : 0), 0, LK.kiss ? 0.03 : 0.045, _w);
      // (10-05, as he said: "very fidgety and way too rushed") Her body was put where her mouth is at the sole within a
      // fifth of a second, and then followed every twitch of the foot (kit.mouthTo, 13 a second): she lurched in and
      // jittered. Now she goes to it eased and no faster than MOUTH.vmax, and follows the foot slowly: her head is steady,
      // and her tongue (which is drawn to the sole itself each frame, and reaches 8 cm) takes up what her head does not.
      _w.sub(_mo); LK.close = _w.length() < 0.075; const e = Math.hypot(_w.x, _w.z), step = Math.min(e * (1 - Math.exp(-dt * MOUTH.rate)), MOUTH.vmax * dt);
      if (e > 1e-5) { bou.obj.position.x += _w.x / e * step; bou.obj.position.z += _w.z / e * step; }      // (slides her a little along the ground; the height is her lean)
      LK.lean = clamp(LK.lean + clamp(-_w.y * MOUTH.leanRate, -MOUTH.leanMax, MOUTH.leanMax) * dt, 0, 1.5); bou.lean(LK.lean);
    } else if (LK.lean > 0 || bou.obj.position.distanceToSquared(LK.home) > 1e-6) {
      LK.lean = Math.max(0, LK.lean - dt * 1.2); bou.lean(LK.lean); bou.obj.position.lerp(LK.home, Math.min(1, dt * 3));
    }
  }
  // until her mouth is at the sole (or `sec` have passed: a scene never hangs on it)
  const atSole = (sec = 2.5) => { let t = 0; return S.until((dt) => { t += dt; return LK.close || t > sec; }); };
  function updTongue(dt) {                           // (after her arms and her lean are this frame's)
    const tw = bou.tw; if (!tw || !tw.mouth) return;
    if (LK.on && LK.k > 0.03) { tw.mouth.getWorldPosition(_mo); kit.lick(tongue, _mo, feet[LK.foot], dt, LK.k, MOUTH.lick, 0.014, 0.0045); } else tongue.hide();
  }

  // =====================================================================================================
  //                                                 who says what
  // =====================================================================================================
  // her portraits (faces/boudicca.png) -> her face: 0 calm smile, 1 smug, 2 delighted, 3 sly, 4 thinking, 5 surprised,
  // 6 serious, 7 puzzled, 8 cool, 9 big grin, 10 mischievous, 11 laughing, 12 shouting, 13 stern, 15 unimpressed, 20 sheepish
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 5: 'surprised', 6: 'angry', 7: 'worried', 8: 'smug', 9: 'happy', 10: 'smug', 11: 'laugh', 12: 'angry', 13: 'angry', 14: 'angry', 15: 'tired', 16: 'embarrassed', 17: 'smile', 18: 'happy', 19: 'laughHard', 20: 'embarrassed', 21: 'embarrassed' };
  const say = async (sh, i, text, o = {}) => {
    if (sh === 'bo') { bou.expr(BO[i] || 'smile', i === 20 || i === 21 ? 0.5 : 0); bou.talk(true); }
    await S.say(sh, i, text, o);
    if (sh === 'bo') bou.talk(false);
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  // Boudicca hops along the boughs / leaps: an arc from where she is to `to` over `sec`
  async function leap(to, sec, apex, yaw) {
    const from = bou.obj.position.clone(); let t = 0; if (yaw !== undefined) bou.face(yaw);
    await S.until((dt) => { t += dt; const k = Math.min(1, t / sec); bou.obj.position.lerpVectors(from, to, k); bou.obj.position.y += apex * Math.sin(PI * k); return k >= 1; });
  }

  // =====================================================================================================
  //                                          the interrogation: staging
  // =====================================================================================================
  let TIED = false;
  const E = V3(1, 0, 0);                                // (in the glade she lies along east-west, her head to the west, Boudicca at her feet to the east;
                                                        //  the cameras stand to the south, on her left)
  const bouHead = () => bou.head(V3());
  const shots = {
    wide() { const h = C.headPos(), c = V3().addVectors(h, bou.obj.position).multiplyScalar(0.5); c.y = 0.42; S.cam.set(V3(c.x - 0.35, 1.3, c.z + 3.0), c, { fov: 40, cut: true }); post.setCloseUp('off'); },
    soles() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x + 0.46, m.y + 0.5, m.z + 0.44), V3(m.x - 0.04, m.y - 0.04, m.z), { fov: 33, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },      // (from above, beside Boudicca: down onto her soles)
    solesHigh() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x + 0.18, m.y + 0.72, m.z + 0.5), V3(m.x - 0.05, m.y, m.z), { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
    face() { const h = C.headPos(); S.cam.set(V3(h.x - 0.72, h.y + 0.1, h.z + 0.78), V3(h.x, h.y - 0.02, h.z), { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    over() { const b = bouHead(), h = C.headPos(); S.cam.set(V3(b.x + 0.55, b.y + 0.22, b.z + 0.5), V3().lerpVectors(h, stg.mid, 0.35), { fov: 38, cut: true }); post.setCloseUp('off'); },
    bou() { const b = bouHead(); b.y -= 0.12; S.cam.set(V3(b.x - 0.95, b.y + 0.02, b.z + 0.62), b, { fov: 34, cut: true, focus: b.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    low() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x - 0.28, m.y + 0.24, m.z + 0.86), V3(m.x + 0.1, m.y + 0.02, m.z), { fov: 36, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },      // (from the side, nearer her legs: the soles in front, Boudicca's face at them)
    mark() { const f = feet[1], p = along(f, 0.52, V3()); S.cam.set(p.clone().addScaledVector(f.n, 0.3).add(V3(0, 0.04, 0.12)), p, { fov: 30, cut: true, focus: p.clone(), focusK: 2.4 }); post.setCloseUp('on'); },
  };
  // her hands on Anne's soles (thief.js arms: points with air under them)
  const _sh = V3(), _tg = V3();
  const approach = (sd, X, n, lift, dir) => { bou.shoulder(sd, _sh); _tg.subVectors(X, _sh); _tg.addScaledVector(n, -_tg.dot(n)); if (_tg.lengthSq() < 1e-6) _tg.set(-1, 0, 0); _tg.normalize(); return dir.copy(_tg).multiplyScalar(Math.cos(lift)).addScaledVector(n, -Math.sin(lift)); };
  const FOOT = { R: 0, L: 1 };                          // (kneeling at her feet facing her head: Boudicca's right hand is at Anne's right foot)
  const HANDS = {
    trail: (sd) => (X, dir, palm, t) => { const f = feet[FOOT[sd]], u = 0.12 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.85)); along(f, u, X).addScaledVector(f.side, 0.01 * Math.sin(t * 1.7)).addScaledVector(f.n, 0.006); approach(sd, X, f.n, 0.45, dir); palm.copy(f.n).negate(); },      // one slow line down a sole
    toes: (sd) => (X, dir, palm, t) => { const f = feet[FOOT[sd]]; along(f, 1.16 + 0.06 * Math.sin(t * 1.9 + FOOT[sd]), X).addScaledVector(f.side, 0.014 * Math.sin(t * 3.1)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.55, dir); palm.copy(f.n).negate(); },      // under and between her toes
    all: (sd) => (X, dir, palm, t) => { const f = feet[FOOT[sd]]; along(f, 0.5 + 0.38 * Math.sin(t * 2.0 + FOOT[sd] * 1.3), X).addScaledVector(f.side, 0.012 * Math.sin(t * 4.3)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.6, dir); palm.copy(f.n).negate(); },      // all over, heel to toes, fast
    coo: (sd) => (X, dir, palm, t) => { const f = feet[FOOT[sd]], a = t * 3.2 + FOOT[sd] * 2; along(f, 0.4 + 0.13 * Math.cos(a), X).addScaledVector(f.side, 0.018 * Math.sin(a)).addScaledVector(f.n, 0.018); approach(sd, X, f.n, 0.55, dir); palm.copy(f.n).negate(); },      // nails circling her arches
  };
  // (10-05) Kneeling at her feet, a hand with nothing to do is held up before her, over Anne's toes (READY), not let down into
  // her lap: her lap is UNDER soles that face the sky, and a hand that came up from there to a sole came through the foot,
  // where the clearance threw it 20 cm in one frame. From above it comes down on to the sole. (`rest`: only in the glade.)
  const READY = (sd) => (X, dir, palm) => {
    bou.shoulder(sd, _sh); const yaw = bou.obj.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), o = sd === 'L' ? 0.03 : -0.03;
    X.set(_sh.x + fx * 0.27 + Math.cos(yaw) * o, _sh.y - 0.15, _sh.z + fz * 0.27 - Math.sin(yaw) * o); dir.set(fx, 0.1, fz).normalize(); palm.set(fx * 0.3, -1, fz * 0.3).normalize();
  };
  const hands = (L, R, rest = TIED) => {
    const a = bou.arm('L'), b = bou.arm('R');
    a.to(L ? HANDS[L]('L') : rest ? READY('L') : null, L ? 'claw' : 'reach'); b.to(R ? HANDS[R]('R') : rest ? READY('R') : null, R ? 'claw' : 'reach');
  };
  // a stage: her clip and toes, her voice, Boudicca's hands
  function stage(name) {
    const P = {
      still: ['Hogtie', 0, null, null, null], idle: ['Hogtie', 0, null, null, null],
      scene1: ['Hogtie', 0.22, 'giggle', null, 'trail'], scene2: ['HogtieTickled', 0.34, 'laughter', 'toes', 'toes'], scene3: ['HogtieTickled', 0.45, 'cackling', 'all', 'all'],
      scene4: ['HogtieTickled', 0.38, 'laughter', 'coo', 'coo'], scene5: ['HogtieTickled', 0.3, 'giggle', null, 'trail'], scene6: ['Hogtie', 0.2, 'giggle', null, null],
    }[name];
    // (10-05) how fast she squirms (the clip itself was rebuilt: see tools/anne2/poses.py): a little faster for the hardest
    // tickling, at half speed while her sole is licked (her feet nearly still, one slow hand on the other sole)
    if (A.clipSpeed) A.clipSpeed('HogtieTickled', { scene3: 1.25, scene5: 0.5 }[name] || 1);
    S.clip(P[0], 0.3); if (P[1]) S.toes(P[1], 1.4 + P[1] * 3, Infinity); else S.toes(0);
    // (bent down to her sole, licking or kissing, a hand with nothing to do goes back to her lap: held up it would be before her own face)
    S.voiceLoop(P[2], P[2] === 'cackling' ? 2.2 : P[2] === 'laughter' ? 2.6 : 3.2); hands(P[3], P[4], TIED && name !== 'scene5' && name !== 'scene6');
    LK.on = name === 'scene5'; LK.kiss = name === 'scene6'; LK.foot = 1; LK.u = 0.55;
  }
  // under black: on her front in the glade, tied, her shoes and hat in the grass, Boudicca kneeling at her feet
  async function setGlade() {
    A.setHeelsWorn(false);
    S.place(GLADE, 0); S.clip('Hogtie', 0); C.snapSoles();
    stg.begin(GLADE.clone(), PI / 2, []);              // (st: so the kit reads her soles every frame)
    for (let i = 0; i < 3; i++) await S.frame();
    // turn her so her feet point east, then centre her on the spot
    const h = C.headPos(V3()), m = V3().addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5);
    anne.rotation.y += S.angle(PI / 2 - Math.atan2(m.x - h.x, m.z - h.z));
    for (let i = 0; i < 2; i++) await S.frame();
    C.headPos(h); m.addVectors(feet[0].arch, feet[1].arch).multiplyScalar(0.5);
    anne.position.x += GLADE.x - (h.x + m.x) / 2; anne.position.z += GLADE.z - (h.z + m.z) / 2;
    C.snapSoles(); for (let i = 0; i < 3; i++) await S.frame(); stg.soleFrame();
    const mid = stg.mid.clone();
    const B = V3(mid.x + 0.37, 0, mid.z + 0.02); LK.home.copy(B); LK.lean = 0;      // (10-03: a little nearer: her hands work well inside their reach)
    bou.show(B, -PI / 2, 'KneelSit'); bou.lean(0, true); bou.expr('smug');
    stg.loose.forEach((s, i) => { const p = V3(mid.x - 0.55 - i * 0.35, 0.035, mid.z + (i ? 0.62 : 0.5)); s.g.visible = true; s.t = -1; s.carry = null; s.rest.set(1.5, i ? 0.7 : -0.5, 0.2); s.to = (out) => out.copy(p); });
    kit.throwHat((out) => out.set(mid.x - 1.1, 0.02, mid.z - 0.75)); C.amAt(V3(0, -60, 0)); C.am.hide();      // (her hat on the far side; Amaymon keeps out of it: parked far below, out of every shot)
    ties.look('rope'); ties.set({ on: true, k: 1, knot: 1, toe: 1, peg: 0, taut: 0, wrists: 1, hog: 1 }); TIED = true; hands(null, null);
    loot.visible = true;
  }
  function clearGlade() {
    TIED = false; ties.set({ on: false, wrists: 0, hog: 0 }); ties.update(); hands(null, null); LK.on = LK.kiss = false; tongue.hide(); MK.goal = MK.k = MK.flare = 0; mark.visible = false;
    S.voiceLoop(null); bou.lean(0, true); stg.end();
  }

  // =====================================================================================================
  //                                                 the epilogue
  // =====================================================================================================
  async function epilogue() {
    if (S.progress < 35) S.progress = 35;
    const ARR = tc(13, 2), X = tc(14, 7);
    // ---------- ANNE: out of the trees ----------
    S.setFade(1); S.place(ARR, 0); S.clip('Idle', 0);
    bou.show(PERCH[0], yawTo(PERCH[0], tc(12, 7)), 'KneelSit'); bou.obj.visible = false;
    S.cam.set(V3(19.6, 2.4, 15.6), V3(20.6, 1.0, 5.0), { fov: 50, cut: true }); grade(DAY);      // (from the meadow: the pond and its willows at the left, the trail's mouth ahead)
    await S.fade(0, 1.2); await S.mark('arrive');
    await say('a1', 0, 'Here we are!');
    S.cam.behind(anne, { dist: 5.5, pitch: 0.32, turn: 0.4 });
    await S.walk([[13, 6], [12, 6], [12, 7]], { speed: 1.5 }); await S.turnTo(tc(12, 10)); S.clip('Idle', 0.3);
    S.cam.face(anne, { dist: 2.6, turn: 0.55, y: 1.45 });
    await lines([
      ['a1', 0, "So, it seems we're getting close to leaving\nthe forest! It's time to go to the city."],
      ['am', 0, "What's the plan after that?"],
      ['a1', 0, 'I hire a boat to Amirian Island.'],
      () => S.emote(anne, 'music', 1.0),
      ['am', 0, 'Do you have money?'],
      () => S.emote(anne, 'dots', 1.1),
      ['a1', 22, "I guess ...\nI'll have to find a fast\nway to earn some coin ..."],
      ['am', 4, 'Wanna hear my suggestion?'],
      ['a2', 1, 'NO!'],
    ]);
    // Boudicca shows up in the trees, unseen by them: two hops along the boughs, closer
    bou.obj.visible = true; bou.expr('smug');
    S.cam.set(V3(21.2, 1.55, 7.2), V3().lerpVectors(PERCH[0], PERCH[2], 0.5).setY(2.9), { fov: 42, cut: true }); await S.mark('hop');
    await S.wait(0.5); await leap(PERCH[1], 0.42, 0.42); sparks.burst(PERCH[1].clone().setY(PERCH[1].y + 0.3), LEAF, 10, 0.8, 0.5);
    await S.wait(0.5); await leap(PERCH[2], 0.42, 0.42, yawTo(PERCH[2], X)); sparks.burst(PERCH[2].clone().setY(PERCH[2].y + 0.3), LEAF, 10, 0.8, 0.5);
    await S.wait(0.4);
    S.cam.face(anne, { dist: 2.6, turn: 0.55, y: 1.45, cut: true });
    await lines([
      () => S.emote(anne, 'dots', 1.1),
      ['a2', 26, 'I almost fear to ask this...\n...\nwhat would you suggest I do?'],
      ['am', 4, 'Easy! Charge the townsfolk a copper each\nto tickle those famous feet of yours!\nYou would be rich by sundown!'],      // (the 2D's line is not for this game: a stand-in Anne can yell at)
      () => { S.emote(anne, 'anger', 1.2); },
      ['a2', 4, 'DAMMIT AMAYMON!'],
      () => S.wait(1.6),
      () => S.emote(anne, 'dots', 1.1),
      ['am', 3, 'Are you considering it?'],
      ['a2', 11, "Hmmmmmmmmmmmm...\nI won't discard that option outright...\nI guess we don't have a better one..."],
      ['am', 4, "That's my girl!"],
      () => S.emote(anne, 'sweat', 1.1), () => S.wait(0.8),
    ]);
    // a rustle in the trees to the east, twice
    S.se('se_Wind4', 0.5, 0.6); sparks.burst(PERCH[2].clone().setY(PERCH[2].y + 0.4), LEAF, 8, 0.6, 0.4); await S.wait(0.27); S.se('se_Wind4', 0.5, 0.6);
    await S.walk([[13, 7], [14, 7]], { speed: 1.4 }); await S.wait(0.4); await S.turnTo(tc(14, 10)); S.clip('Idle', 0.3);
    await S.wait(0.4);
    // a low shot from the front: the trees behind her
    S.cam.set(V3(X.x - 0.6, 0.75, X.z + 3.2), V3(X.x, 1.55, X.z - 1.2), { fov: 46, cut: true });
    await S.emote(anne, 'dots', 1.1);
    await say('am', 0, "... what's up?");
    await say('a1', 5, 'Did you hear something?'); await S.mark('pounce');
    // the pounce: five tiles straight down onto her, from behind
    bou.clip('KneelSit', 0.1);
    const land = V3(X.x + 0.05, 0, X.z - 0.55);
    await leap(land, 0.75, 1.4, yawTo(PERCH[2], X));
    S.se('se_vo_girl_aah3', 0.7, 1.1); S.se('se_Blow3', 0.9); flash('#fff', 0.35, 0.9);
    S.clip(A.hasClip('StuckFlat') ? 'StuckFlat' : 'HeldProne', 0.12); A.setHeelsWorn(true);
    await S.wait(0.5);
    // Boudicca kneels beside her, her hands on Anne's back
    const hip = V3(); { const b = anne.getObjectByName('spine04'); if (b) b.getWorldPosition(hip); else hip.copy(anne.position); }
    const kneel = V3(hip.x + 0.45, 0, hip.z - 0.05); bou.obj.position.copy(kneel); bou.face(yawTo(kneel, hip));
    bou.arm('L').to((P, dir, palm) => { P.copy(hip).add(V3(0.02, 0.1, -0.08)); dir.set(-1, -0.6, 0).normalize(); palm.set(0, -1, 0); }, 'reach');
    bou.arm('R').to((P, dir, palm) => { P.copy(hip).add(V3(0.0, 0.1, 0.1)); dir.set(-1, -0.6, 0).normalize(); palm.set(0, -1, 0); }, 'reach');
    { await S.frame(); const H = C.headPos(), look = V3().lerpVectors(H, bou.head(V3()), 0.45); look.y -= 0.1;      // (in front of her face, Boudicca beyond her: never from behind her)
      S.cam.set(V3(H.x - 0.95, H.y + 0.75, H.z + 1.75), look, { fov: 40, cut: true }); }
    S.expr('shocked', 0.3);
    await S.mark('gotcha');
    await say('bo', 3, 'Gotcha!!');
    if (C.lookLines) await say('bo', 1, C.lookLines('bo').shoe);      // (10-03: her shoes are still on: Boudicca has noticed them)
    if (C.lookRemarks) for (const t of C.lookRemarks('bo', 2)) await say('bo', 1, t);      // (batch 22: and the rest of her)
    await say('am', 0, 'UH OH ....');
    await say('bo', 0, 'Now, you and me we will have a private chat at last!');

    // ---------- BOUDICCA: the glade ----------
    await S.fade(1, 0.6); S.progress = 37; env.quiet(true);
    hands(null, null); await S.wait(0.8);
    await setGlade();
    await say('bo', 0, 'Now that we have some time to know\nthe one each the other, I would like\nto ask you some questions, rookie.');
    stage('still');
    await say('a2', 12, 'Hey!\n\nAnd who the hell are you?');
    S.night(0.55, 0); grade(DUSK); shots.wide();
    await S.fade(0, 1.0); await S.mark('tied');
    await lines([
      ['bo', 7, 'I heard you talking with that nasty creature\nthe last night!!'],
      () => shots.face(),
      ['a2', 11, 'Who are you?\n\nWhat do you want with me?'],
      () => shots.over(),
      ['bo', 12, 'So, it was you who summoned that demon in\nthe tower, wasn\'t you?\n\nConfess it, you silly brat!!'],
      ['a2', 5, "I don't know what are you talking about,\n\nyou featherbrain?"],
      () => shots.bou(),
      ['bo', 13, 'Ohh!! you know indeed!\n\nWhy did you free that creature?\nHave you gone crazy?'],
      () => { shots.face(); S.emote(anne, 'question', 1.0); },
      ['a2', 5, '\nHow do you know about that?'],
      ['bo', 4, 'Ohh!! So you recognize it!!\n\nIt was you!'],
      ['a1', 20, "That's not your business!"],
      () => shots.bou(),
      ['bo', 15, 'Oh, yes, it is, missy, I can assure you!'],
      () => { env.music('dungeon8.mp3'); S.emote(bou.obj, 'anger', 1.1); },
      () => shots.wide(),
      ['a2', 6, "You work for the magicians, don't you?\n\nYou're one of their guards in the tower,\nI recognize your attire!"],
      ['bo', 4, "That's not important right now!"],
    ]);
    // ----- scene1: one fingertip down a sole -----
    stage('scene1'); shots.soles(); await S.wait(1.0); await S.mark('scene1');
    await lines([
      ['a2', 40, 'Er- hey now, don\'t he!\nDon\'t hado thhahat!'],
      ['bo', 3, "Don't do what?"],
      () => { S.emote(anne, 'sweat', 0.9); shots.face(); },
      ['a2', 46, 'Ohoho Come Ohon!\nSthahap thahat!'],
      () => shots.soles(),
      ['bo', 3, '... playing with those little cute piggies?\n\n♥'],
      ...(C.lookLines ? [['bo', 9, C.lookLines('bo', true).nail]] : []),      // (10-03: and the colour of her toenails)
      () => S.emote(bou.obj, 'music', 1.0),
      ['bo', 3, 'Ohh! that tickles!\n\nNow you seem a bit more receptive ...\nwanna talk?'],
      () => { S.voice('laughter'); shots.face(); },
      ['a2', 16, 'Ohohoho Chahahme Ohahahahn!\nFrheheehaaking sthohop thhahat!\nSthohoop tihihickling mhehehe!'],
      () => shots.bou(),
      ['bo', 2, "No, I don't think I will...\n\nI need answers, and you're going\nto give them all to me!"],
      () => shots.solesHigh(),
      ['a2', 16, 'Hahahahahahaha Stop!\nHahahahaha Stop it!\nHahahaha!'],
      ['bo', 7, 'Now, have you been marked with her kiss?'],
      () => shots.face(),
      ['a2', 47, "Ihihi hahahah that's stoohhoopp ticki-hihng\nmeee hahahahah..."],
      () => shots.over(),
      ['bo', 6, "Come on, brat!\nI know you've got her mark somewhere on your feet!\n\nShow it off!!"],
      ['a2', 15, 'Mhehehehe! Ihihihihi dhihihihid!\n\nHhhoooowwwi y-yoou know tha-ahahaht!!'],
      () => shots.soles(),
      ['bo', 3, "I'm going to have fun playing with these\ncute feet until you show that mark up!!"],
      ['a2', 10, 'Sthohohop yohhohohurss siiillly gaahahmes\na-ha-ha-already!!!'],
      () => shots.bou(),
      ['bo', 8, "Well, well ...\n\nSeems I'm going to need to go all out!"],
      ['bo', 0, "You know what?\n\nI'll ask your piggies!"],
    ]);
    // ----- scene2: her toes -----
    stage('scene2'); shots.solesHigh(); await S.wait(1.6); await S.mark('scene2');
    await lines([
      ['a2', 16, 'Whohohould yhohou frhehehahaking\nsthohop alrhehehahaady!'],
      () => shots.bou(),
      ['bo', 13, "If you don't show me that mark,\nI'm going to start ramping things up!"],
      () => shots.face(),
      ['a2', 16, "I dhihid! I swhehehehear!!\nI swehahahahar I do-hon't knowh\nwha't yo-houut sayhihing at aha-all\nhahahaha"],
      () => shots.over(),
      ['bo', 3, 'You asked for it, Magician!'],
      () => shots.face(),
      ['a2', 18, 'HAHAHAHAHAHAHAHA'],
      ['a2', 18, 'NOOOOOOOOOOO!'],
    ]);
    // ----- scene3: all out, both hands -----
    stage('scene3'); shots.soles(); await S.wait(1.6); await S.mark('scene3');
    await lines([
      ['a2', 18, 'HAHAHAHAHAHAHA! SHOHOHOHOHOHOP!'],
      () => shots.bou(),
      ['bo', 9, "You've got quite a pair of pretty feet, brat!\nI confess it feels amusing teasing them and\nwatching those cute toes wiggle like wild!! ♥"],
      () => { S.emote(bou.obj, 'heart', 1.0); shots.solesHigh(); },
      ['bo', 11, '♥♥♥♥\nTickle tickle tickle!!'],
      () => shots.face(),
      ['a2', 45, 'P-P... PLEASE! YOU GOHOTTA STOHOP!'],
      () => shots.over(),
      ['bo', 0, "Show me the mark, and I'll stop."],
      ['bo', 4, 'Why in the hell did you summon that demon?\n\nDid she give you some kind of special power?'],
      () => shots.face(),
      ['a2', 47, 'THIS IS TOO MUCH! GYAHAHAHAHAH! HAHAHA!!'],
      ['a2', 16, 'HAHADAHAHAMNYOU! STOHOHOHOOP THIHIS!'],
      () => shots.soles(),
      ['a2', 16, 'WhHAHAHAAT IS IHIHIHIT GOHOHOHOHOING\nTHOHOO TAHAHAHAKE FOR YOHOHOHOU TO\nBELIEHEHEHEHEHEHEVE MHEHEHEHEHEE?!?!?!'],
      () => shots.bou(),
      ['bo', 9, 'I hope my fingers feel well!\n\n♥'],
      () => shots.face(),
      ['a2', 18, 'BAAAA-HHAHAHAHAHAHHAH AHAHADDDDD!!!'],
      () => shots.over(),
      ['bo', 2, 'Do they tickle?'],
      () => shots.face(),
      ['a2', 18, 'A LOT! THEY TICKLE A LOT!\nPLEASE STOP!'],
      () => shots.bou(),
      ['bo', 0, "Not Yet!\nWe've got quite a bit to go!"],
      () => shots.solesHigh(),
      ['a2', 16, "NHOO! PLEHEAHASE BEHEHELIEVE MHEHE!\nI'VEEHEHE GOOT NOTHIN-EELSSEE TO TE-HE HELLL"],
    ]);
    // the mark shows: a pink flash on her sole
    hands(null, 'all'); shots.mark(); await S.wait(0.5); MK.goal = 1;      // (her hand comes off that sole: the mark shows)
    MK.flare = 1.2; S.se('se_Blind', 0.8); flash('#ff4fc0', 0.7, 0.55);
    { const f = feet[1]; sparks.burst(along(f, 0.52, V3()).addScaledVector(f.n, 0.03), PINK, 22, 0.6, 0.7); }
    await S.wait(1.4); await S.mark('mark');
    stage('idle'); shots.bou();
    await say('bo', 4, 'Ohh!! There it is the mark!\n\nSo, I guess this means you have just got\ncursed too, haven\'t you?');
    // ----- the talk (idle) -----
    await lines([
      () => shots.face(),
      ['a2', 4, 'What are you playing to, you jerk!'],
      () => shots.mark(),
      ['bo', 4, 'Well, well ...\nthis looks interesting...\nIt is not the same mark ...'],
      () => shots.face(),
      ['a2', 5, 'ARE YOU GOING TO STOP HARASSING ME?\nWHAT THE HELL DO YOU WANT?'],
      () => { S.emote(bou.obj, 'music', 1.0); shots.over(); },
      ['bo', 9, 'To be honest with you, I always wanted to\ncheck those legs and feetsies closer, darling\n...♥'],
      () => { MK.goal = 0.45; shots.bou(); },
      ['bo', 4, "I've been following you since yesterday."],
      ['bo', 13, "Why did you flee from the Tower of Wisdom?\nDon't you realize all you've done is anger\nthe wizards?"],
      () => shots.face(),
      ['a1', 5, "So I was right!\n\nYou're their thug! one of their guards?"],
      () => shots.bou(),
      ['bo', 15, "Ohh!! Come on!! Of course I am, fool!\n\nDon't you don't remember me, Magician?"],
      () => shots.face(),
      ['a1', 43, 'Why should I?'],
      () => { S.emote(bou.obj, 'anger', 1.1); shots.bou(); },
      ['bo', 15, 'UGGHHH ...\nDisappointing ...\nNever noticed me, huh?'],
      ['bo', 1, 'May be if I tease those pretty\nticklish soles some more you will end up\nremembering me!!'],
      () => { shots.face(); hands('trail', 'trail'); S.toes(0.3, 2.4, 1.2); },
      ['a1', 42, 'NO NO NO NO NO NO NO NO !!!!\nSTOP IT!!!\nI SURRENDER!'],
      () => { hands(null, null); shots.wide(); },
      ['bo', 0, 'Hmmmm? Ok! My name is Boudicca.'],
      ['bo', 0, "I'm a spellblade, keeper of the lower\nMagician Chambers, one of the guards\nof your floor."],
      ['bo', 1, 'I had to care of all the rookies in the tower.\nI was in charge of guarding you all while\nyou trained.'],
      () => shots.face(),
      ['a2', 36, "Ok, nice to meet you too,\nbut I don't think I'm adding you\nto my contact list..."],
      () => shots.bou(),
      ['bo', 3, "Come on! Don't get mad at me.\nI was the one on watch outside your room\nevery single night, after all."],      // (102-105: stand-ins for three lines that are not for this game)
      () => shots.face(),
      ['a1', 46, 'WHAAAT???\nDid you spy me?'],
      () => shots.bou(),
      ['bo', 3, 'I confess I never had the chance...\n\nbut I could hear you reading forbidden\nbooks aloud until dawn!'],
      ['bo', 11, '"On the summoning of lesser demons,\nchapter nine"... very relaxing bedtime\nreading, rookie!'],
      () => shots.face(),
      ['a2', 6, 'How do you know I had this mark on my foot?\n\nYou came straight for it after catching me!\nAm I right?'],
      () => shots.over(),
      ['bo', 4, "Uh, uh, uh!!! ...\nI'm the one who makes the questions here, lady."],
      ['bo', 7, 'You have summoned that demon!!\n\nNow you will answer:\nAre you working for her?'],
      () => shots.face(),
      ['a2', 2, "Of course I'm not!"],
      ['bo', 4, 'Then why did you leave?'],
      ['a2', 2, "Because I'm cursed by that evil creature!"],
      ['a2', 3, "Since I've got the mark,\nnow I feel her harassing me on my dreams every night.\n\nSo, I have got to find a way to cure myself..."],
      () => shots.bou(),
      ['bo', 4, "Why haven't you considered asking for\nhelp to the wizards?"],
      () => shots.face(),
      ['a2', 6, 'The wizards?\n\nHUUMMM!!!'],
      ['a2', 5, "Those arrogant jerks wouldn't ever hear me."],
      ['a2', 2, "I prefer to fix this business on my own\nthan sit and wait for their bureaucracy..."],
      ['a1', 1, 'Besides, I am not going to wait for a\npunishment either!'],
      () => shots.bou(),
      ['bo', 7, 'I see...\nSo, what are you going to do?'],
      () => shots.face(),
      ['a1', 1, "I'm going after the demon of lust.\nI'll find her and force her to remove\nthis mark. That's all I need to do."],
      () => shots.bou(),
      ['bo', 4, 'Not an original plan ...'],
      () => shots.face(),
      ['a1', 1, "I need to find the Succubus.\nDefeating her is the only way\nI'll be able to remove the curse."],
      ['bo', 7, 'How do you know about that?'],
      ['a1', 17, "Mhhhh...\n\nI've been researching on it in the book..."],
      ['bo', 4, 'Which book?'],
      ['a1', 17, 'The Grimmoire of Conjuration...\nI need it to turn her back to her world ...'],
      () => shots.bou(),
      ['bo', 6, 'Come on, missy!\nDo you think the succubi will just follow\nyour orders and leave?\nWhat are you up to?'],
      () => shots.face(),
      ['a2', 2, "Listen, this may be way too complicated for\na featherbrain like you...\nI'm a magician and I've got my own ways!"],
      () => shots.bou(),
      ['bo', 2, "Hahaha!! how cute!\n\nYou're nothing but a snooty noob!!!"],
      () => shots.face(),
      ['a1', 22, 'Come on, girl!\nLeave me alone, this is not your business!'],
      () => S.wait(1.0),
      () => shots.bou(),
      ['bo', 1, "You know what? I think I'll come with you!"],
      () => shots.face(),
      ['a2', 5, 'WHAT? NO WAY!!'],
      () => shots.bou(),
      ['bo', 2, "Yes, we will go together!\nIf these old grumpy men weren't going to\nhelp you, I doubt they'd help me either..."],
      () => shots.face(),
      ['a2', 6, 'Helping you?\nwith what?\nWhat do you mean?'],
      () => shots.bou(),
      ['bo', 0, "I've been cursed by the demoness of lust,\njust like you."],
      () => shots.face(),
      ['a1', 5, 'What? What are you talking about?\nHave you been cursed by the succubus too?'],
      () => shots.bou(),
      ['bo', 20, 'Yes, I have...\nI have a mark quite similar to yours\nover my heart...'],
      ['bo', 7, 'I had to confront her while I was looking\nfor you in the secret halls.\nShe caught me by surprise...'],
      ['bo', 0, "We are both in the same trouble, girl.\nSo we are together in this trip,\nyou like it or not!"],
      () => S.wait(1.0),
      () => shots.face(),
      ['a1', 4, 'Then... are you going to help me\nto defeat the demoness?'],
      () => shots.bou(),
      ['bo', 0, "Aye!!\nAt least until we can find out how to deal\nwith this curse, don't you think?"],
      () => shots.face(),
      ['a1', 8, 'I may consider it...\n\nI would certainly need some help to confront\nthe succubus.'],
      () => shots.bou(),
      ['bo', 3, 'Well, I guess we are both involved in\nthe same adventure after all, rookie!'],
      () => S.wait(1.0),
      () => shots.wide(),
      ['a1', 22, 'So, um ...\nWith that said...\nwhy are you still pinning me down?'],
      () => env.music(null),
      () => shots.bou(),
      ['bo', 20, "Oh! My apologies, darling...\nBut given the situation ... I would never forgive\nmyself if I missed out the chance to do this!"],
    ]);
    // ----- scene5: two slow licks, a slow hand on her other sole; scene6: kisses -----
    // (10-05: it was one quick lick in 2.4 s: she leans in for a second, then two licks of 2.2 s each)
    // (her mouth is there when it is there: the licks are counted from then, two whole ones, so that her tongue is in again as she lifts her head)
    stage('scene5'); shots.low(); await atSole(2.6); tongue.ph = 0; await S.wait(2 * MOUTH.lick); await S.mark('lick');
    stage('idle'); await S.wait(0.6); shots.face();
    await say('a2', 7, 'OOOWWWWW!!!\n\nWhat are you doing?');
    shots.bou(); await say('bo', 1, "I'm just aapologizing for tormenting\nyour pretty and sensitive feet, missy!\n♥♥");
    S.emote(anne, 'scribble', 1.0); shots.face(); await say('a2', 8, 'Mmmhhhh ... hwhwhaat?');
    stage('scene6'); shots.low(); await atSole(2.6);
    for (let i = 0; i < 3; i++) { await S.wait(i ? 1.0 : 0.3); S.se('se_Kiss1', 0.7, 1.2); S.emote(bou.obj, 'heart', 0.8, 0.1); }
    await S.wait(0.8); await S.mark('kiss');
    stage('idle'); await S.wait(0.6); shots.bou();
    await say('bo', 1, 'Did you like that?');
    S.emote(anne, 'scribble', 1.0);
    await S.choice(['No!!', 'NO!!!']);                   // (the 2D's other answer is not part of this game)
    // ----- _RESIST -----
    shots.face();
    await lines([
      ['a2', 8, 'Gnnnnn!!!!!!!!'],
      () => shots.bou(),
      ['bo', 20, "What's wrong? ...\ndon't you like it?"],
      () => shots.face(),
      ['a2', 12, 'It creeps me out!!!'],
      () => { S.se('se_Kiss1', 0.7, 1.2); S.emote(bou.obj, 'heart', 0.8, 0.1); shots.bou(); },
      ['bo', 10, "Oh, I think I didn't make it well enough the\nfirst time then...\nJust let me try again those yummy\nsmooth soles! ♥♥"],
    ]);
    await S.mark('resist');
    stage('scene4'); shots.soles(); await S.wait(1.6);
    await say('bo', 9, 'Cooochie cooochie kooo!!! ♥');
    stage('scene3'); shots.solesHigh(); await S.wait(1.6);
    await say('bo', 9, 'tickle tickle tickle tickle ...');
    shots.wide(); await S.wait(1.0);

    // ---------- _BOU1: on black, an unseen thief ----------
    await S.fade(1, 0.6); clearGlade(); bou.hide(); S.night(0, 0); env.music(null);
    await S.wait(0.6); await S.mark('theft');
    await say('au', 1, 'Morons!!!\nleaving something like this just lying around!!');
    await say('au', 1, "Those two look like they're busy ...\nI bet they won't even notice it's gone!");
    loot.visible = false; S.state.flags.stolenGold = S.state.coins || 0; S.counts(S.state.herbs, 0); S.flag('grimmoireStolen', true);      // (10-05: how much she took: the guard house gives it back, story_barracks.js)
    await S.wait(1.2);
    // ---------- _BOU2: "Meanwhile..." ----------
    env.music('theme7.mp3');
    await S.card('', 'Meanwhile...', 'Press SPACE to continue');
    await S.card('', 'Lilith is recruiting new powerful followers...', 'Press SPACE to continue'); await S.mark('meanwhile');
    await say('ly', 5, 'Your filth has no place in this holy ground!!\n\nBe gone Demoness!!');
    await say('li', 8, 'Holy? My dear priestess of bane,\nyou are merely a bird in a cage of your own making.\nI am here to open the door...');
    await say('li', 12, 'Think of the power...\nNo more prayers to silent gods.');
    await say('li', 8, 'With my "kiss", your word becomes law.\nYour worshippers will not just follow you...\nthey will bleed for you.');
    await say('li', 14, 'ALL OF THEM!!\nNo exception!!\n\nThey all will worship the Queen of Lust!!');
    await S.wait(0.6);
    S.flag('boudicca', true);
    S.go('road', [5, 8], 'east');
    await new Promise(() => {});                         // (the page is leaving)
  }

  // =====================================================================================================
  //                                       when it plays; the clearing afterwards
  // =====================================================================================================
  if (S.progress >= 40 && S.flag('boudicca')) {
    // the chapter is done: she can walk here, and Boudicca comes along a few steps behind her
    const p = anne.position.clone().addScaledVector(V3(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)), -1.3);
    bou.show(p, anne.rotation.y); bou.follow(() => anne.position, 1.5, 1.4); S.party = { boudicca: bou };      // (who walks with her: the foot cam offers Boudicca's feet too)
  }
  S.blockExit = () => S.progress < 40;
  S.hint = async () => {
    if (S.progress >= 100) await say('am', 0, 'South, to Valyndra City, after that thief!\nThe road is east across the meadow.');
    else await say('am', 0, 'The city is not far now.');
  };
  S.onArrive = () => { C.checkpoint(); if (S.progress >= 30 && S.progress < 40) S.run(epilogue); };
  if (typeof window !== 'undefined') window.__edge = { bou, ties, MK, LK, stg, feet, along, stage, shots, hands, tongue };      // (tests)
}
