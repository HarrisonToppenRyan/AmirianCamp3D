// story_library.js: the opening of the game (the 2D's Map 5 "Prologue", CommonEvent 87 GAME_INTRO_SCRIPT: _PRELUDE,
// SKIP_INTRO, _INTRO), a week before the camp: the haunted Secret Library of the Tower of Wisdom, at night, in a storm.
// Anne wakes in a high-backed chair, held there by the magic of the demon she summoned from the Grimoire: Lilith. Lilith
// materialises, asks her name, teases her, slides off her shoes and plays with her feet (kisses, licks, and her nails
// on Anne's soles, "Coochie coochie koo"), then curses her with the Kiss of the Succubus (on her sole: gentle teasing of
// her bare feet now fills her mana, hard tickling spills it). Amaymon's voice from his dark glass ball interrupts; Lilith,
// who cannot stand him, leaves. Black; Anne's memories; then the camp (story_camp.js `nightBefore`).
// Lines are the 2D's own. Content rule, as everywhere in this game: Anne stays dressed (in the 2D she is not: here only
// her hat and shoes come off, on camera), the 2D's sexual stage after "We're just getting started!" is not recreated,
// and the few lines that are not for this game are left out or have harmless stand-ins. No music: the storm.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { createLilith } = await import('./lilith.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3 } = S, C = common(S), { sparks, feet, along } = C;
  const cap = createCaptures(S, C, env), stg = cap.stage, kit = cap.kit;
  const lil = createLilith(S, C);
  const PI = Math.PI, clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp, post = env.post;
  if (env.quiet) env.quiet(true);                      // (no music: the storm)
  S.onSpeak = null;                                    // (Amaymon is only a voice from his ball tonight: no floating companion)
  const grade = (g) => { if (post && post.setGrade) post.setGrade(...g); };
  const COLD = [0.8, 0.86, 1.14, 0.3, 0.95];           // (the 2D's [-24,-24,34,128]: dark, blue, half grey)
  grade(COLD); S.setNight(0.9);
  const VIOLET = new THREE.Color(1.3, 0.5, 1.9), PINK = new THREE.Color(1.8, 0.45, 1.3);

  // =====================================================================================================
  //                                       the room: the haunted Secret Library
  // =====================================================================================================
  const X0 = 0.8, X1 = 13.6, Z0 = 0.8, Z1 = 15.2, HGT = 6.2;
  const CH = V3(7.2, 0, 4.0);                         // the chair (Anne faces south, down the centre aisle)
  const BALL = V3(2.7, 0, 4.0);                       // Amaymon's dark glass ball, on its stand, five tiles to her left (west)
  const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stoneT = tex(512, 512, (x, w, h) => { x.fillStyle = '#4a4e5c'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const o = (r % 2) * 64, l = 60 + rnd() * 30; x.fillStyle = `rgb(${l},${l + 4},${l + 16})`; x.fillRect(c * 128 + o + 3, r * 64 + 3, 122, 58); } });
  stoneT.wrapS = stoneT.wrapT = THREE.RepeatWrapping;
  const woodT = tex(512, 512, (x, w, h) => { for (let i = 0; i < 8; i++) { const l = 52 + rnd() * 26; x.fillStyle = `rgb(${l + 20},${l},${l - 18})`; x.fillRect(0, i * 64, w, 62); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, i * 64 + 62, w, 2); for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(30,18,8,${0.08 + rnd() * 0.1})`; x.fillRect(rnd() * w, i * 64 + rnd() * 60, 40 + rnd() * 120, 1.5); } } });
  woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping;
  const booksT = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#2a1a10'; x.fillRect(0, 0, w, h);
    const COLS = ['#5a1a1a', '#1d3a26', '#1c2950', '#4a2d14', '#3b1d45', '#5c4a1a', '#2c2c2c', '#6a2e1e'];
    for (let r = 0; r < 4; r++) {
      let px = 6; const y1 = r * 128 + 118;
      while (px < w - 8) { const bw = 10 + rnd() * 16, bh = 70 + rnd() * 38, c = COLS[Math.floor(rnd() * COLS.length)]; x.fillStyle = c; x.fillRect(px, y1 - bh, bw - 1.5, bh); x.fillStyle = 'rgba(214,170,80,0.55)'; x.fillRect(px + 1, y1 - bh + 8, bw - 4, 2); x.fillRect(px + 1, y1 - 14, bw - 4, 2); px += bw + (rnd() < 0.08 ? 14 : 0); }
      x.fillStyle = '#3c2616'; x.fillRect(0, y1, w, 10);
    }
  });
  const room = new THREE.Group(); scene.add(room);
  const mat = { stone: new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.92 }), wood: new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.75 }), dark: new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.8 }), books: new THREE.MeshStandardMaterial({ map: booksT, roughness: 0.85 }) };
  const box = (w, h, d, m, x, y, z, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; room.add(b); return b; };
  // floor, ceiling, walls
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat.wood.clone()); f.material.map = woodT.clone(); f.material.map.repeat.set(4, 4); f.material.map.needsUpdate = true; f.rotation.x = -PI / 2; f.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); f.receiveShadow = true; room.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat.dark); c.rotation.x = PI / 2; c.position.set((X0 + X1) / 2, HGT, (Z0 + Z1) / 2); room.add(c);
    for (const z of [3, 6.5, 10, 13.5]) box(X1 - X0, 0.28, 0.32, mat.dark, (X0 + X1) / 2, HGT - 0.14, z).castShadow = false;      // beams
    const wallM = mat.stone.clone(); wallM.map = stoneT.clone(); wallM.map.repeat.set(5, 2.4); wallM.map.needsUpdate = true;
    for (const [w, x, z, ry] of [[X1 - X0, (X0 + X1) / 2, Z0, 0], [X1 - X0, (X0 + X1) / 2, Z1, PI], [Z1 - Z0, X0, (Z0 + Z1) / 2, PI / 2], [Z1 - Z0, X1, (Z0 + Z1) / 2, -PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, HGT), wallM); m.position.set(x, HGT / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m);
    } }
  // the rug under the chair
  { const rug = tex(256, 384, (x, w, h) => { x.fillStyle = '#5a1420'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c8a050'; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28); x.lineWidth = 2; x.strokeRect(28, 28, w - 56, h - 56); x.beginPath(); x.arc(w / 2, h / 2, 60, 0, PI * 2); x.stroke(); });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8), new THREE.MeshStandardMaterial({ map: rug, roughness: 0.95 })); r.rotation.x = -PI / 2; r.position.set(CH.x, 0.006, CH.z + 0.9); r.receiveShadow = true; room.add(r); }
  // bookcases: a frame of dark wood, the front face rows of books
  const bookcase = (w, h, x, z, ry, d = 0.5) => { const m = [mat.dark, mat.dark, mat.dark, mat.dark, mat.books, mat.dark]; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; room.add(b); box(w + 0.12, 0.12, d + 0.1, mat.dark, x, h + 0.06, z, ry); return b; };
  bookcase(2.0, 3.4, 1.95, Z0 + 0.26, 0); bookcase(2.7, 4.0, CH.x, Z0 + 0.26, 0); bookcase(2.0, 3.4, 12.45, Z0 + 0.26, 0);      // north wall (behind the chair)
  for (const z of [2.6, 5.0, 11.2, 13.6]) { bookcase(2.2, 3.4, X0 + 0.26, z, PI / 2); bookcase(2.2, 3.4, X1 - 0.26, z, -PI / 2); }      // side walls
  for (const z of [8.6, 11.0, 13.4]) for (const [xa, xb] of [[1.2, 5.4], [9.0, 13.2]]) { const w = xb - xa; bookcase(w, 2.6, (xa + xb) / 2, z - 0.31, PI, 0.55); bookcase(w, 2.6, (xa + xb) / 2, z + 0.31, 0, 0.55); }      // stacks, both sides
  // tall windows: the storm outside (their panes flash with the lightning)
  const paneM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.13, 0.26), toneMapped: false });
  const window_ = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3.0), paneM); p.position.set(0, 2.9, 0.02); g.add(p);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.625, 20, 0, PI), paneM); top.position.set(0, 4.4, 0.02); g.add(top);
    for (const dx of [-0.66, 0, 0.66]) { const b = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.1 : 0.05, 3.7, 0.1), mat.dark); b.position.set(dx, 2.95, 0.06); g.add(b); }
    for (const y of [1.4, 2.4, 3.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.08), mat.dark); b.position.set(0, y, 0.06); g.add(b); } };
  window_(4.15, Z0 + 0.01, 0); window_(10.25, Z0 + 0.01, 0); window_(X0 + 0.01, 8.0, PI / 2); window_(X1 - 0.01, 8.0, -PI / 2);
  // the chair: high-backed, armrests; a low footstool before it (moved under her heels once she sits)
  { const seatM = new THREE.MeshStandardMaterial({ color: 0x5a1420, roughness: 0.8 });
    box(0.62, 0.08, 0.56, mat.dark, CH.x, 0.41, CH.z - 0.06); box(0.56, 0.06, 0.5, seatM, CH.x, 0.46, CH.z - 0.06);
    for (const [dx, dz] of [[-0.27, 0.18], [0.27, 0.18], [-0.27, -0.3], [0.27, -0.3]]) box(0.06, 0.41, 0.06, mat.dark, CH.x + dx, 0.2, CH.z + dz);
    box(0.64, 1.5, 0.08, mat.dark, CH.x, 1.12, CH.z - 0.34); box(0.5, 1.2, 0.04, seatM, CH.x, 1.12, CH.z - 0.29);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20, 1, false, 0, PI), mat.dark); crest.rotation.set(PI / 2, 0, PI / 2); crest.position.set(CH.x, 1.86, CH.z - 0.34); room.add(crest);
    for (const s of [-1, 1]) { box(0.07, 0.06, 0.52, mat.dark, CH.x + s * 0.31, 0.66, CH.z - 0.08); box(0.05, 0.22, 0.05, mat.dark, CH.x + s * 0.31, 0.55, CH.z + 0.13); } }
  const stool = new THREE.Group(); room.add(stool);
  { const top = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), new THREE.MeshStandardMaterial({ color: 0x5a1420, roughness: 0.8 })); top.position.y = -0.035; top.castShadow = top.receiveShadow = true; stool.add(top);
    for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1, 6), mat.dark); l.position.set(dx, -0.5, dz); l.castShadow = true; stool.add(l); }
    stool.position.set(CH.x, 0.34, CH.z + 0.82); }
  // (10-03) No footstool after all (Lilith's knees went into it, and kneeling further off her hands could not reach):
  // her legs are held out by the same magic as the bands at her ankles, a soft violet glow under her feet.
  stool.visible = false;
  const footGlow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.35, 1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  footGlow.rotation.x = -PI / 2; footGlow.renderOrder = 4; room.add(footGlow);
  const placeStool = () => { const hy = Math.min(feet[0].heel.y, feet[1].heel.y), hz = (feet[0].heel.z + feet[1].heel.z) / 2; stool.position.set(CH.x, Math.max(0.12, hy - 0.035), hz + 0.02); stool.children.slice(1).forEach((l) => { l.scale.y = stool.position.y - 0.07; l.position.y = -0.07 - l.scale.y / 2; }); footGlow.position.set(CH.x, 0.012, hz + 0.04); };
  // the dark glass ball on its stand
  const ball = new THREE.Group(); ball.position.copy(BALL); room.add(ball);
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.2, 0.6), toneMapped: false }), eyeL = new THREE.PointLight(0xff4fb0, 0, 3, 2);
  { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.95, 12), mat.dark); st.position.y = 0.475; st.castShadow = true; ball.add(st);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.08, 12), mat.dark); cup.position.y = 0.98; ball.add(cup);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), new THREE.MeshStandardMaterial({ color: 0x120c26, roughness: 0.06, metalness: 0.3 })); orb.position.y = 1.15; orb.castShadow = true; ball.add(orb);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), eyeM); eye.position.set(0.168, 1.15, 0); eye.rotation.y = PI / 2; ball.add(eye);
    eyeL.position.set(0.3, 1.15, 0); ball.add(eyeL); ball.userData.emoteY = 1.25; }
  // candelabra beside the chair: warm, flickering light
  const candles = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(CH.x + s * 1.35, 0, CH.z - 0.2); room.add(g);
    const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.35, metalness: 0.8 });
    const post_ = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.09, 1.5, 10), brass); post_.position.y = 0.75; g.add(post_);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), brass); arm.position.y = 1.5; g.add(arm);
    for (const dx of [-0.24, 0, 0.24]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xece0c8, roughness: 0.6 })); c.position.set(dx, 1.6 + (dx ? 0 : 0.06), 0); g.add(c);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.45), toneMapped: false })); fl.position.set(dx, 1.71 + (dx ? 0 : 0.06), 0); g.add(fl); candles.push(fl);
    }
    const l = new THREE.PointLight(0xffa860, 2.2, 7.5, 1.6); l.position.set(0, 1.85, 0); l.castShadow = s < 0; if (l.castShadow) { l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.002; } g.add(l); candles.push(l);
  }
  // a cluster of candles on the floor by the footstool: what lights her soles
  { const g = new THREE.Group(); g.position.set(CH.x + 0.95, 0, CH.z + 1.55); room.add(g);
    for (const [dx, dz, h] of [[0, 0, 0.26], [0.1, 0.06, 0.18], [-0.07, 0.09, 0.14]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, h, 10), new THREE.MeshStandardMaterial({ color: 0xece0c8, roughness: 0.6 })); c.position.set(dx, h / 2, dz); g.add(c);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.45), toneMapped: false })); fl.position.set(dx, h + 0.03, dz); g.add(fl); candles.push(fl); }
    const l = new THREE.PointLight(0xffb070, 1.6, 4.0, 1.6); l.position.set(0, 0.45, 0); g.add(l); candles.push(l); }
  const fill = new THREE.AmbientLight(0x5868a8, 0.32); scene.add(fill);
  const moon = new THREE.DirectionalLight(0x8aa0ff, 0.35); moon.position.set(CH.x - 3, 5.5, CH.z - 6); moon.target.position.copy(CH); scene.add(moon, moon.target);
  const bolt = new THREE.DirectionalLight(0xc8d8ff, 0); bolt.position.set(CH.x + 2, 5, CH.z - 5); bolt.target.position.copy(CH); scene.add(bolt, bolt.target);
  const BOLT = { k: 0 };
  S.actors.push({ update(dt, t) {
    for (const c of candles) { if (c.isPointLight) c.intensity = 2.0 + 0.35 * Math.sin(t * 13.1 + c.id) + 0.2 * Math.sin(t * 23.7); else c.scale.y = 1 + 0.18 * Math.sin(t * 17 + c.id * 3); }
    BOLT.k = Math.max(0, BOLT.k - dt * 3.2); bolt.intensity = 6 * BOLT.k * BOLT.k; paneM.color.setRGB(0.10 + 1.4 * BOLT.k, 0.13 + 1.45 * BOLT.k, 0.26 + 1.5 * BOLT.k);
    eyeL.intensity = damp(eyeL.intensity, EYE.on ? 1.6 : 0.15, 6, dt); eyeM.color.setRGB(0.5 + 0.6 * eyeL.intensity, 0.12 + 0.12 * eyeL.intensity, 0.35 + 0.35 * eyeL.intensity);
  } });
  const EYE = { on: false };
  const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0'; document.body.appendChild(flashEl);
  const flash = async (col, sec = 0.5, peak = 0.85) => { flashEl.style.background = col; flashEl.style.transition = 'opacity .05s'; flashEl.style.opacity = peak; await S.wait(0.07); flashEl.style.transition = `opacity ${sec}s`; flashEl.style.opacity = 0; };
  async function lightning() { BOLT.k = 1; flash('#cfe0ff', 0.9, 0.55); await S.wait(0.18); S.se('se_Thunder9', 1.0, 0.7); }
  // the room's light breathes with the 2D's tints: lighter, or much darker
  const dim = (k, sec = 1) => S.night(k, sec);

  // ---------- the magic that holds her: glowing violet bands at her wrists and ankles ----------
  const bandM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.4, 1.7), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const BANDS = [['lowerarm02R', 'wristR', 0.036], ['lowerarm02L', 'wristL', 0.036], ['lowerleg02R', 'footR', 0.047], ['lowerleg02L', 'footL', 0.047]].map(([a, b, r]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 32), bandM); m.visible = false; m.frustumCulled = false; scene.add(m);
    return { a: anne.getObjectByName(a), b: anne.getObjectByName(b), r, m };
  });
  let BOUND = 0; const _a = V3(), _b = V3(), _q = new THREE.Quaternion(), UPY = V3(0, 1, 0);
  function updBands(t) {
    for (const B of BANDS) {
      B.m.visible = BOUND > 0.01 && !!B.a && !!B.b; if (!B.m.visible) { footGlow.material.opacity = 0; continue; }
      B.a.getWorldPosition(_a); B.b.getWorldPosition(_b); const d = _b.clone().sub(_a).normalize();
      B.m.position.copy(_b).addScaledVector(d, -0.035); B.m.quaternion.copy(_q.setFromUnitVectors(V3(0, 0, 1), d)); B.m.scale.setScalar(B.r * (1 + 0.04 * Math.sin(t * 6 + B.r * 50)));
      bandM.opacity = 0.75 * BOUND * (0.8 + 0.2 * Math.sin(t * 4));
      footGlow.material.opacity = 0.35 * BOUND * (0.75 + 0.25 * Math.sin(t * 2.3));
    }
  }

  // ---------- Lilith's lips and tongue (the edge's Boudicca does the same) ----------
  const tongue = kit.makeTongue('#b03a6a');
  const LK = { on: false, kiss: false, k: 0, foot: 1, u: 0.55, home: V3(), lean: 0, base: 0 }, _mo = V3(), _w = V3();      // (base: how far she leans in while her hands work)
  function updMouth(dt) {
    const tw = lil.tw; if (!tw || !tw.mouth) return;
    const near = LK.on || LK.kiss; LK.k = damp(LK.k, LK.on ? 1 : 0, 4, dt);
    if (near) {
      const f = feet[LK.foot]; tw.mouth.getWorldPosition(_mo);
      kit.soleSpot(f, LK.u + (LK.kiss ? 0.22 * Math.sin(S.time() * 0.8) : 0.15 * Math.sin(S.time() * 0.5)), 0, LK.kiss ? 0.03 : 0.055, _w);
      const ey = kit.mouthTo(lil.obj, _mo, _w, dt);
      LK.lean = clamp(LK.lean - ey * 5 * dt, 0, 1.5); lil.lean(LK.lean);
    } else if (Math.abs(LK.lean - LK.base) > 1e-3 || lil.obj.position.distanceToSquared(LK.home) > 1e-6) { LK.lean += Math.max(-dt * 1.2, Math.min(dt * 1.2, LK.base - LK.lean)); lil.lean(LK.lean); lil.obj.position.x += (LK.home.x - lil.obj.position.x) * Math.min(1, dt * 3); lil.obj.position.z += (LK.home.z - lil.obj.position.z) * Math.min(1, dt * 3); }
  }
  function updTongue(dt) {                           // (after her arms and her lean are this frame's)
    const tw = lil.tw; if (!tw || !tw.mouth) return;
    if (LK.on && LK.k > 0.03) { tw.mouth.getWorldPosition(_mo); kit.lick(tongue, _mo, feet[LK.foot], dt, LK.k, 1.2, 0.013, 0.0042); } else tongue.hide();
  }
  let STAGED = false;
  S.late.push((dt, t) => { if (STAGED) updMouth(dt); lil.update(dt, t); updBands(t); if (STAGED) updTongue(dt); });      // (10-03: where she is first, her arms aimed from there, her tongue from this frame's mouth)

  // ---------- her nails on Anne's soles (thief.js arms: points with air under them) ----------
  const _sh = V3(), _tg = V3();
  const approach = (sd, X, n, lift, dir) => { lil.shoulder(sd, _sh); _tg.subVectors(X, _sh); _tg.addScaledVector(n, -_tg.dot(n)); if (_tg.lengthSq() < 1e-6) _tg.set(0, 1, 0); _tg.normalize(); return dir.copy(_tg).multiplyScalar(Math.cos(lift)).addScaledVector(n, -Math.sin(lift)); };
  // (10-03) She kneels beside her feet, at the nearer foot (her left: feet[1]), leaning in; the other foot is beyond her
  // reach. Her two hands share that sole: the right at the arch, the left at the ball and the toes (her heel is beyond her reach).
  // (10-04: bent to it with her mouth, her other sole is within her left hand's reach: see `hands`.)
  const U = (sd, a, b) => (sd === 'R' ? a : b);
  const HANDS = {
    circle: (sd, fi = 1) => (X, dir, palm, t) => { const f = feet[fi], a = t * 1.9 + U(sd, 0, 2); along(f, U(sd, 0.5, 0.95) + 0.07 * Math.cos(a), X).addScaledVector(f.side, 0.018 * Math.sin(a)).addScaledVector(f.n, 0.012); approach(sd, X, f.n, 0.45, dir); palm.copy(f.n).negate(); },      // fingertips circling her heel / the ball of her foot
    trail: (sd, fi = 1) => (X, dir, palm, t) => { const f = feet[fi], w = 0.5 + 0.5 * Math.sin(t * 0.85 + U(sd, 0, 1.6)); along(f, U(sd, 0.4 + 0.35 * w, 0.75 + 0.4 * w), X).addScaledVector(f.n, 0.008); approach(sd, X, f.n, 0.45, dir); palm.copy(f.n).negate(); },      // one slow line along the sole
    all: (sd, fi = 1) => (X, dir, palm, t) => { const f = feet[fi]; along(f, U(sd, 0.6, 0.98) + U(sd, 0.16, 0.16) * Math.sin(t * 2.3 + U(sd, 0, 1.3)), X).addScaledVector(f.side, 0.012 * Math.sin(t * 3.4)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.6, dir); palm.copy(f.n).negate(); },      // all over, fast
    toes: (sd, fi = 1) => (X, dir, palm, t) => { const f = feet[fi]; along(f, U(sd, 0.92, 1.15) + 0.05 * Math.sin(t * 2.1 + U(sd, 0, 1)), X).addScaledVector(f.side, 0.013 * Math.sin(t * 2.9)).addScaledVector(f.n, 0.02); approach(sd, X, f.n, 0.55, dir); palm.copy(f.n).negate(); },      // under the toes and the ball
  };
  // (10-04, as he asked: her arms were awkwardly bent) Her elbows hang down and a little out and back (her own frame), not out
  // to her sides; and where she kneels (STG below) both her shoulders are before the soles she works on, an easy arm's
  // length off. Tests: &lx= &lz= (where she kneels from the middle of the soles), &lyaw= (how far she is turned to them),
  // &llean= (how far she leans in).
  // How STG was chosen: 126 places were tried with the arm solver itself, her hands at their busiest ('all'), and measured:
  // each elbow's bend, each wrist's bend to its forearm, how far each hand's fingertips came out from the point they were
  // sent to, and how far each shoulder is before the sole. Here: elbows 45 to 95 degrees, wrists to 40, fingertips within
  // 2 cm, her right shoulder 8 cm before the sole (it was 3 cm BEHIND it: that arm came in edge on, its wrist folded back
  // 112 degrees), through 'all', 'toes' and 'circle'. Further off (0.52, 0.30) her right hand hung 5 to 13 cm short.
  const TQ = new URLSearchParams(location.search), tq = (k, d) => (TQ.has(k) && isFinite(+TQ.get(k)) ? +TQ.get(k) : d);
  const STG = { x: tq('lx', 0.42), z: tq('lz', 0.44), yaw: -PI / 2 - tq('lyaw', 0.75), lean: tq('llean', 0.4), off1: tq('loff1', 0.5), off2: tq('loff2', 1.0), y0: 0.429, dl: 0 };      // (off1, off2: how far she leans in for the nearer shoe, and for the far one; y0: how high the soles were that this was measured for; dl: see `kneelFor`)
  const POLE = { L: V3(0.45, -1, -0.3), R: V3(-0.45, -1, -0.3) };
  // (10-05) With a body of the player's own length Anne's soles are up to 3.4 cm higher or lower in the chair than the ones
  // STG was measured for (her place across and before them follows them already). Lilith's shoulders go up or down with
  // them by her lean (they turn about her hips, 0.316 m below), and she kneels that much nearer or further so that they
  // stay the same way off: her arms are then as measured. `STG.dl`: what that adds to every lean of hers at Anne's feet.
  // (Without it, at the shortest body her right hand hung 3.9 cm off the sole.)
  const TORSO = 0.316;
  function kneelFor(soleY, at) {
    const dy = clamp(soleY - STG.y0, -0.06, 0.06), lean1 = clamp(Math.acos(clamp(Math.cos(STG.lean) + dy / TORSO, -1, 1)), 0.12, 0.85);
    STG.dl = lean1 - STG.lean; const back = TORSO * (Math.sin(lean1) - Math.sin(STG.lean));
    at.x -= Math.sin(STG.yaw) * back; at.z -= Math.cos(STG.yaw) * back;
  }
  // (a name ending in 0: on her OTHER sole, feet[0]. While her mouth is at the nearer sole her shoulders are a hand's length
  // from it: a hand at that same sole is an arm folded double under her own chin. Her left shoulder is the one towards the
  // other foot, an easy reach off: she licks one sole and her fingers work on the other.)
  const handFn = (n, sd) => (n ? HANDS[n.replace(/0$/, '')](sd, /0$/.test(n) ? 0 : 1) : null);
  // (`rest`: bent right down to a sole (her mouth at it), an arm with nothing to do hung straight to the floor and its
  // fingers went 4 to 6 cm through the boards. That hand is set down on the floor before her shoulder, as anyone bending
  // that far steadies herself.)
  const FLOOR = (sd) => (X, dir, palm) => {
    lil.shoulder(sd, _sh); const yaw = lil.obj.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), o = sd === 'L' ? 0.05 : -0.05;
    X.set(_sh.x + fx * 0.11 + Math.cos(yaw) * o, 0.014, _sh.z + fz * 0.11 - Math.sin(yaw) * o); dir.set(fx, 0, fz); palm.set(0, -1, 0);
  };
  const hands = (L, R, rest = false) => {
    for (const [sd, n] of [['L', L], ['R', R]]) lil.arm(sd).to(n ? handFn(n, sd) : rest ? FLOOR(sd) : null, n ? 'claw' : 'reach', POLE[sd]);
  };

  // =====================================================================================================
  //                                                 who says what
  // =====================================================================================================
  // her portraits -> her face: 0 smug, 1 laughing, 2 smirk, 4 indignant, 5 cold, 7 angry, 8 sultry, 9 laughing,
  // 10 calm, 12 sly, 13 bright grin, 14 wide toothy grin
  const LI = { 0: 'smug', 1: 'laugh', 2: 'smug', 4: 'angry', 5: 'neutral', 7: 'angry', 8: 'smug', 9: 'laugh', 10: 'neutral', 12: 'smug', 13: 'happy', 14: 'laughHard' };
  const say = async (sh, i, text, o = {}) => {
    if (sh === 'li') { lil.expr(LI[i] || 'smug'); lil.talk(true); }
    if (sh === 'am') EYE.on = true;
    await S.say(sh, i, text, o);
    if (sh === 'li') lil.talk(false);
    if (sh === 'am') EYE.on = false;
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  // (10-03) what Anne has on her feet (the player's choice, "Anne's look"), in Lilith's words. The 2D's line is about
  // her high heels; she may be in flip-flops, slides, toe-posts, strappy sandals (the default), T-straps, open or closed
  // heels. (Lilith's pet names: honey, girl, mortal; "darling" and the present-unwrapping are Alraune's.)
  const shoeTalk = () => {
    const L = Object.assign({ style: 'sandal', shoe: '', nail: '' }, (S.look && S.look()) || {});
    const col = L.shoe ? L.shoe + ' ' : '', cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const li = {
      flipflop: [13, `${cap(col + 'flip-flops')}, girl? Really?\nYou summon the Queen of Succubi\npractically BAREFOOT...\nHow very thoughtful of you, honey.`],
      slide: [13, `${cap(col + 'slides')}, honey? One little strap\nand nothing else...\nYou've all but served me those feet\non a silver platter, mortal.`],
      toeloop: [12, `Toe-post sandals, girl? One ${col}loop\nhugging that big toe... and the rest\nof those pretty toes left all alone.\nWe can't have that, can we?`],
      sandal: [12, `Strappy ${col}sandals, honey?\nSo many little straps...\nand so many little gaps in between.\n...and especially, your feet...`],
      tstrap: [8, `${cap(col + 'T-straps')}... all buckled up\nlike a good little student, mortal.\nBut those toes are out on show...\n...and especially, your feet...`],
      heels: [8, `You really like wearing high heels, huh?\nAnd ${col}open-toed ones, too...\nshowing off those little toes...\n...and especially, your feet...`],
      pumps: [12, `You really like wearing high heels, huh?\n${cap(col + 'pumps')}, all closed up tight...\nWhat are you hiding in there, girl?\n...your feet, perhaps?`],
      // (10-03: the five new kinds)
      gladiator: [12, `${cap(col + 'gladiator sandals')}, honey?\nStrapped up to the ankle like a little warrior...\nand every toe left out to fend for itself.\n...and especially, your feet...`],
      cross: [13, `${cap(col + 'crossover slides')}, honey? Two little straps,\ncrossed like fingers...\nYou've all but served me those feet\non a silver platter, mortal.`],
      wedges: [8, `You really like wearing high heels, huh?\n${cap(col + 'wedges')}, with those toes peeking out...\nand those arches so nicely lifted...\n...and especially, your feet...`],
      flats: [12, `${cap(col + 'ballet flats')}, girl? Every little toe\ntucked away where I can't see...\nWhat are you hiding in there?\n...your feet, perhaps?`],
      mules: [12, `${cap(col + 'mules')}, honey? You hide the toes\nand leave those heels bare for me...\nWhat are you hiding in there, girl?\n...your feet, perhaps?`],
      geta: [13, `Wooden sandals, honey? Your feet set up\non two little pedestals...\nserved to me like a delicacy.\n...and especially, your feet...`],
    }[L.style] || [8, `Such pretty ${col}shoes, honey...\n...and especially, your feet...`];
    const anne = /flipflop|slide|toeloop|cross|geta/.test(L.style) ? ['a2', 4, "They're comfy!! I was READING,\nnot dressing up for a demon!!", { expr: 'angry' }]
      : /sandal|tstrap|gladiator/.test(L.style) ? ['a2', 4, "They're SENSIBLE shoes!!\nNow get away from my feet!!", { expr: 'angry' }]
      : /heels|wedges/.test(L.style) ? ['a2', 4, 'A sorceress has to look the part!!\nNow BACK OFF!!', { expr: 'angry' }]
      : ['a2', 31, "Th-they're staying ON!!\nDon't you DARE take them off!!", { expr: 'embarrassed', blush: 0.6 }];
    // once they are off: her toenails (in closed heels, the first anyone has seen of them)
    const after = /pumps|flats|mules/.test(L.style) ? [13, `There they are...\n${L.nail ? 'And ' + L.nail + ' toenails, all this time!' : 'All this time, hidden away!'}\nKeeping secrets from your own demon?\nHow very naughty...`]
      : [9, `${L.nail ? 'And the toenails painted ' + L.nail + '...' : 'And those dainty little toes...'}\njust for me? You shouldn't have, honey.`];
    return { li, anne, after };
  };
  const lilHead = () => lil.head(V3());
  const shots = {
    wide() { S.cam.set(V3(4.6, 4.3, 11.6), V3(CH.x, 0.95, CH.z + 1.0), { fov: 46, cut: true }); post.setCloseUp('off'); },
    face() { const h = C.headPos(); S.cam.set(V3(h.x + 0.6, h.y + 0.1, h.z + 1.3), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    side() { S.cam.set(V3(CH.x + 2.5, 1.25, CH.z + 1.5), V3(CH.x, 0.85, CH.z + 0.45), { fov: 42, cut: true }); post.setCloseUp('off'); },
    lil() { const h = lilHead(); h.y -= 0.1; const yaw = lil.obj.rotation.y; S.cam.set(V3(h.x + Math.sin(yaw) * 1.1 + 0.35, h.y + 0.05, h.z + Math.cos(yaw) * 1.1), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    two() { const h = C.headPos(), l = lilHead(), c = V3().lerpVectors(h, l, 0.5); S.cam.set(V3(c.x - 1.05, c.y + 0.4, c.z + 2.15), c, { fov: 42, cut: true }); post.setCloseUp('off'); },      // (10-03: from the front, to the left of the chair: her face and Lilith, wherever Lilith is)
    soles() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x - 0.18, m.y + 0.32, m.z + 0.88), V3(m.x + 0.06, m.y - 0.02, m.z), { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },      // (from beside Lilith's shoulder, out to the side: both soles, her hands)
    // (low: from the far side, her face at the nearer sole, past the other)
    low() { stg.soleFrame(); const m = stg.mid; S.cam.set(V3(m.x - 0.72, m.y + 0.22, m.z + 0.74), V3(m.x + 0.14, m.y + 0.02, m.z + 0.08), { fov: 36, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
    ball() { S.cam.set(V3(BALL.x + 1.3, 1.35, BALL.z + 1.2), V3(BALL.x, 1.1, BALL.z), { fov: 38, cut: true }); post.setCloseUp('off'); },
  };
  // where Lilith is: before Anne, hovering; looming over the chair's back; kneeling at her feet
  const AT = { front: V3(CH.x, 0, CH.z + 1.75), loom: V3(CH.x, 0, CH.z - 0.85), feet: V3() };
  async function blink(to, yaw, o = {}) {              // a puff of violet and she is somewhere else
    sparks.burst(lil.obj.position.clone().setY(lil.obj.position.y + 1.1), VIOLET, 14, 0.9, 0.6);
    lil.obj.position.copy(to); lil.face(yaw); lil.hover(o.hover ?? 1, o.base ?? 0); if (o.clip) lil.clip(o.clip, 0.15); else lil.clip('ThiefIdle', 0.15);
    LK.home.copy(to); sparks.burst(to.clone().setY(to.y + 1.1 + (o.base || 0)), VIOLET, 14, 0.9, 0.6); await S.wait(0.25);
  }
  async function backOff(to, sec = 1.4) {              // she drifts back, still facing Anne (the 2D: two slow steps backward)
    const from = lil.obj.position.clone(); let t = 0; LK.home.copy(to); lil.face(PI);
    await S.until((dt) => { t += dt; const k = S.sstep(0, 1, Math.min(1, t / sec)); lil.obj.position.x = from.x + (to.x - from.x) * k; lil.obj.position.z = from.z + (to.z - from.z) * k; return t >= sec; });
  }
  async function tickle(stageName) {                   // her clip, toes, voice, Lilith's hands and mouth
    const P = { calm: ['ChairBare', 0, null, null, null], circle: ['ChairBare', 0.2, 'giggle', 'circle', 'circle'], lick: ['ChairBare', 0.25, 'giggle', 'toes0', null], lick2: ['ChairTickled', 0.35, 'laughter', 'trail0', null],
      nails: ['ChairTickled', 0.45, 'cackling', 'all', 'all'], toes: ['ChairTickled', 0.42, 'laughter', 'toes', 'toes'] }[stageName];
    LK.on = stageName === 'lick' || stageName === 'lick2'; LK.kiss = false; LK.foot = 1; LK.u = stageName === 'lick2' ? 0.85 : 0.5;      // (the sole nearer her; lick2: up by the toes)
    S.clip(P[0], 0.25); if (P[1]) S.toes(P[1], 1.6 + P[1] * 3, Infinity); else S.toes(0); S.voiceLoop(P[2], P[2] === 'cackling' ? 2.2 : 2.8); hands(P[3], P[4], LK.on);
    LK.base = P[3] || P[4] ? STG.lean + STG.dl : 0.12;          // (leaning in while her hands work)
  }

  // =====================================================================================================
  //                                                 the prologue
  // =====================================================================================================
  async function prologue() {
    const LW = (S.lookWords && S.lookWords()) || {};      // (10-04: the look the player gave her, for the lines that speak of it)
    // (10-03) Esc twice skips the opening: straight to the start of the game, the camp's morning (as the 2D's "Start game")
    const stopSkip = C.introSkip(() => { S.flag('prologue', true); S.progress = Math.max(S.progress, 5); A.setHeelsWorn(true); if (A.setHat) A.setHat(true); S.go('camp', [11, 6], 'west'); });
    S.setFade(1); S.setNight(0.9); grade(COLD);
    S.place(CH, 0); S.clip('ChairBound', 0); S.expr('sleep');
    stg.begin(CH.clone(), 0, []); STAGED = true;
    for (let i = 0; i < 4; i++) await S.frame();
    placeStool(); BOUND = 1;
    lil.show(AT.front, PI, 'ThiefIdle'); lil.obj.visible = false; lil.hover(1); lil.flap(1); LK.home.copy(AT.front);
    shots.wide();
    await S.card('', 'It all started that night,\nin the Tower of Wisdom ...', 'Press SPACE to continue'); await S.mark('wake');
    await say('a1', 7, '.....Huh....', { expr: 'tired' });
    await S.fade(0, 1.6);
    await say('a1', 8, 'Where...');
    shots.face();
    await say('a1', 4, 'Where am I?\nWhat is happening?\nWha--', { expr: 'worried' });
    await lightning(); S.emote(anne, 'exclaim', 0.9); await S.wait(0.5); await S.mark('lightning');
    await say('a2', 12, "Why can't I move???");      // (the 2D's line here is not for this game: a stand-in)
    shots.two();
    await say('li', 8, 'So... you are finally awake!');
    // she materialises in front of Anne, hovering
    S.se('se_vo_girl_scream3', 0.85); lil.obj.visible = true; lil.expr('smug');
    { const o = lil.obj; let t = 0; sparks.burst(AT.front.clone().setY(1.4), VIOLET, 30, 1.2, 0.9); await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.7); o.scale.setScalar(0.6 + 0.4 * k); return k >= 1; }); o.scale.setScalar(1); }
    await S.mark('lilith');
    await lines([
      ['a2', 42, 'HEEEEEEELPPP!!!!!!'],
      () => shots.lil(),
      ['li', 0, "Oh, come now!\nNo one is going to hear you, girl.\nIt's just you and me."],
      () => shots.face(),
      ['a1', 4, 'Who ...\n\nwho are you?'],
      () => shots.lil(),
      ['li', 0, "You don't know?\nIt was You who summoned me, honey."],
      ['li', 0, 'Manners dictate the conjurer always\nintroduces themselves first.'],
      ['li', 12, 'So then,\n\nwhat is your name?'],
      () => { shots.face(); return S.emote(anne, 'dots', 1.2); },
      ['a1', 20, '... Anne.'],
      () => { S.voice('chuckle', 0.8); shots.lil(); },
      ['li', 9, 'Anne...\n\nsounds... delicious...'],
      () => { shots.two(); S.clip('ChairBound', 0.3); },
      ['a2', 12, 'What ... do you want from me?'],
      ['li', 10, 'What do I want?\n\nHmmmm...'],
      ['li', 8, 'I was summoned in the promise of offerings...\nAnd my oh my do you make a delicious offering....'],
    ]);
    // the close-up: the room dims; she looms over the back of the chair
    dim(0.95, 0.4); await blink(AT.loom, 0, { hover: 1, base: 0.85 }); shots.side(); await S.mark('loom');
    await lines([
      ['li', 0, 'Fear not mortal, for we shall explore your\nevery little weakness...'],
      () => S.emote(anne, 'anger', 1.0),
      ['li', 12, 'I shall explore that gorgeous looking\nwitch, from the ' + (LW.hat === false ? 'top of her head' : 'tip of her hat') + '...'],      // (10-04: a look may have no hat; then none flies off either)
      () => { kit.throwHat((out) => out.set(CH.x + 0.9, 0.02, CH.z + 0.25)); return S.wait(0.8); },
      ['li', 13, '...and discover all of your weaknesses,\nall the way down to her toes.'],
    ]);
    dim(0.88, 1.0); await blink(AT.front, PI, { hover: 0.5 }); shots.two();
    await lines([
      ['li', 0, '... how do you feel about my generosity, mortal?'],
      () => shots.face(),
      ['a2', 4, "Don't you dare touch me!\nIf you hurt me, I swear I-"],
      () => shots.lil(),
      ['li', 8, "Hurt you? hehehehe...\nNo, girl, not yet at least ...\n*mumble*...had that phase\nthough back in my teens though..."],
      ['li', 2, 'Anyways...\nYou mortals got way more interesting to\nplay around with since I last visited this world....\nespecially, beautiful things like you...'],
      () => shots.face(),
      ['a2', 4, 'You filthy demoness!\nkeep your hands off me!\nI summoned you!\nI command you to obey me!!!'],
    ]);
    // at her feet
    // (kneeling at the corner of her feet, turned to her soles: never straight in front of them, that is the camera's place)
    stg.soleFrame(); AT.feet.copy(stg.mid).setY(0); AT.feet.x += STG.x; AT.feet.z += STG.z; kneelFor(stg.mid.y, AT.feet);
    await blink(AT.feet, STG.yaw, { hover: 0, clip: 'KneelSit' }); lil.flap(0.25); shots.two(); await S.mark('feet');
    await lines([
      ['li', 5, 'Oh! You "mighty sorceress", please do not\nsubdue me with your great power of empty words....'],
      ['li', 9, 'Hahahahaha\nForgive the sarcasm dear...\nbut did you really think you could subdue\nthe Queen of Succubi?'],
      ['li', 8, "You've dragged me into this realm.\nAnd like with all summonings, there is a\ntribute to be offered.\nAnd now you shall pay it!"],
      ['li', 0, "But I feel generous today!\nSo, I'll show...\na little mercy...\nheh heh."],
      () => S.emote(anne, 'sweat', 1.0),
      ['li', 12, "I see so many spots to care about...\nAAAHRHRRRR\nI can't decide where to start with you!"],
      () => shots.face(),
      ['a1', 43, 'Stop harassing me!'],
      () => { dim(0.82, 1.0); shots.soles(); },
      () => { const t = shoeTalk(); return say('li', t.li[0], t.li[1]); },
      async () => { if (C.lookRemarks) for (const t of C.lookRemarks('li', 3)) await say('li', 12, t); },      // (batch 22: and what she makes of the rest of her)
      () => say(...shoeTalk().anne),
    ]);
    // she slides off her shoes, one then the other (whichever style the player chose: the loose props take its shape)
    // (10-04: she leans in for each, far enough for her hand to reach its heel: upright, her arm stopped 10 to 15 cm short
    // of both; and the hand lies along its own arm, not along a way fixed for where she used to kneel. The first shoe
    // lands clear of where she kneels now.)
    const offShoe = (sd, fi) => (X, dir, palm) => { const f = feet[fi]; X.copy(f.heel).addScaledVector(f.fwd, -0.03).addScaledVector(f.n, 0.03 + (A.heelStyle && A.heelStyle() ? 0.05 : 0)); lil.shoulder(sd, _sh); dir.subVectors(X, _sh).normalize(); palm.copy(f.n).negate(); };
    LK.base = STG.off1 + STG.dl; await S.wait(0.4);
    lil.arm('R').to(offShoe('R', 1), 'reach', POLE.R); await S.wait(0.8); await S.mark('shoe1');
    A.setShoe('L', false); kit.throwShoe(1, (out) => out.set(CH.x - 0.05, 0.035, CH.z + 1.7), 0.55); lil.arm('R').to(null); await S.wait(0.4);
    // (she leans right across for the far one, her right hand down on the floor; seen from the far side: from beside her
    // shoulder her own head is in the way)
    LK.base = STG.off2 + STG.dl; lil.arm('R').to(FLOOR('R'), 'reach', POLE.R); shots.low(); await S.wait(0.5);
    lil.arm('L').to(offShoe('L', 0), 'reach', POLE.L); await S.wait(0.8); await S.mark('shoe2');
    A.setShoe('R', false); kit.throwShoe(0, (out) => out.set(CH.x - 0.55, 0.035, CH.z + 1.35), 0.55); lil.arm('L').to(null); lil.arm('R').to(null); LK.base = 0.12; await S.wait(0.5);
    shots.soles();
    A.setHeelsWorn(false); S.clip('ChairBare', 0.3); S.toes(0.3, 2, 1.4); await S.wait(0.6); await S.mark('heels');
    { const a = shoeTalk().after; await say('li', a[0], a[1]); }
    // "worship": kisses and licks on her soles
    await tickle('lick'); shots.low(); await S.wait(1.6); await S.mark('lick');
    await lines([
      ['li', 0, "Mmmhhhhh...\ngorgeous symmetry!\nI think I'm falling in love with them!"],
      () => shots.face(),
      ['a2', 42, 'LEAVE MY ....\n... feet alone!'],
    ]);
    await tickle('circle'); shots.soles(); dim(0.88, 1);
    await say('li', 12, 'What was that?');
    await S.emote(anne, 'dots', 1.1); await S.wait(0.4); S.emote(lil.obj, 'heart', 1.0);
    await say('li', 13, 'Oh how cute!\nYou love this, don\'t you?\nReally, I can see "kiss me here"\nwritten in your soles!');
    dim(0.95, 0.3);
    await tickle('lick2'); shots.low(); await S.wait(1.2);
    await say('li', 9, "I could drive you nuts ...\njust by licking them ...\nAll you need to do is ask me to do so...");
    S.emote(anne, 'scribble', 1.0); shots.face();
    await say('a2', 14, 'No please, stop doing that ....');
    S.emote(lil.obj, 'heart', 1.0);
    // (10-04: turned to her soles as she kneels now, the camera beside her shoulder sees the back of her head at this
    // sole: from the far side, as the other two licks)
    await tickle('lick'); shots.low();
    await lines([
      ['li', 13, "Beg for more, I know you want to!\n\nLet's hear your beautiful voice!"],
      // (she straightens first: the shot of her face stands before her face, and with her head still down at Anne's sole
      // that was in Anne's lap, behind her leg)
      async () => { dim(0.85, 0.5); tickle('calm'); shots.two(); await S.wait(1.1); shots.lil(); },
      ['li', 12, "I'm gonna make you cry like a baby.\nI know many ways to make you beg for mercy..."],
      ['li', 8, 'How about I start with some...\nrougher methods?'],
      ['li', 10, 'You seem to be cold, huh?\nYour feet look quite ' + (LW.pale === false ? 'chilly' : 'pale') + '...'],
      ['li', 8, '... Or should we start out with\nsomething more....\ninnocent... more... funny.'],
      ['li', 9, "It would be a shame to waste this chance\nI've been given...\nTo explore the touch of your silky skin..."],
      () => dim(0.95, 0.3),
      ['li', 10, 'And I shall start with those gorgeous and\nsmooth feet of yours...\nI just can\'t hold back my curiosity any longer!\nI simply must know how soft and ticklish your soles are!'],
      () => shots.face(),
      ['a2', 14, 'Nonnononoo not there! not there! not there ...'],
    ]);
    // her nails
    await tickle('nails'); shots.soles(); await S.wait(1.2); await S.mark('coochie');
    await lines([
      ['li', 1, 'Oohohhhhh yeeesssss....\nCoochie coochie Kooooooo...\nCoochie coochie Kooooooo...'],
      () => shots.lil(),
      ['li', 1, 'Oh! Feeding off emotional responses is the\nmost delicious thing I have tasted in ages!'],
      () => shots.face(),
      ['a2', 18, 'Nonononaohah hah hohohoh ohoah oaaha hahahhah\nhahah ho pleeassshsheeee hh hoaohoaahha haha\nhahaha hahahh hoho ono non onono not there\nnot there leave my tooooess aloooonee!!!'],
      () => { tickle('toes'); shots.soles(); },
      ['li', 9, 'Oohohhhhh yeeesssss....\nCoooochie coochie Kooooooo...\nCoooochie coochie Kooooooo...\nhi hi hi hi hi'],
      ['li', 9, 'Such a delicious eternity of\nmischief and fun\nI have plans for you my dearest Anne...'],
      () => shots.lil(),
      ['li', 2, 'Submit to me.'],
      () => shots.face(),
      ['a2', 16, 'DAMMIT LEAVE MY FEET ALONE\nYOU WRETCHED DEMON!'],
      () => shots.lil(),
      ['li', 0, "Let's see...\nHold your breath!\nGet ready for my nails again!"],
      () => { tickle('nails'); shots.soles(); },
      ['li', 1, "COOCHIE COOCHIE KOOOO!!!\n\nIsn't the nerdy girl having fun anymore?"],
      () => shots.face(),
      ['a2', 18, 'NO PLEASE, STTTOPP IIITTTT!!!'],
    ]);
    // she stops; Anne slumps, panting
    await tickle('calm'); S.expr('tired', 0.4); shots.wide(); dim(0.88, 1.0); await S.wait(1.2);
    // ---------- the Kiss of the Succubus: on her sole ----------
    S.voice('gasp', 0.8); await S.wait(1.2);
    LK.kiss = true; LK.foot = 1; hands(null, null, true); shots.low(); await S.wait(1.6); await S.mark('kiss');
    S.se('se_Kiss1', 0.9); await S.wait(1.0);
    S.se('se_Blind', 0.8); await S.wait(0.4);
    { const f = feet[1]; for (let i = 0; i < 4; i++) sparks.burst(along(f, 0.5, V3()).addScaledVector(f.n, 0.03).add(V3(0, i * 0.3, -i * 0.12)), PINK, 16, 0.7, 0.6); }
    S.se('se_Crash', 0.7); flash('#ff44dd', 0.8, 0.6); LK.kiss = false; hands(null, null); await S.mark('curse');
    S.voice('gasp', 0.85); await S.wait(1.6); S.emote(lil.obj, 'heart', 1.0); await S.wait(0.4); S.voice('chuckle', 0.8);
    shots.face();
    await lines([
      ['a2', 42, 'what ...\nWHAT THE HELL HAVE YOU DONE TO ME!'],
      () => shots.lil(),
      ['li', 2, "This, is the Kiss of the Succubus, honey.\n\nYou're my favourite plaything now,\nand that deserves my best gift for you ..."],
      () => S.emote(lil.obj, 'heart', 1.0),
      ['li', 13, "Ahhh!!! Don't you feel it?\nYour magic is free flowing now all over your\nbody, from the bottom of your smooth soles..."],
      ['li', 12, 'Be teased with just few gentle cuddles\nover your sensitive bare feet now,\nas your pool of mana grows larger and plenty ...'],
      ['li', 14, '... Let them be tickled hard and relentlessly,\nto waste and sprout your magic wildly through\nevery inch of your soft skin...'],
      ['li', 1, 'This is the tasty reward for being my first\npet, sweetie!'],
      () => { S.emote(anne, 'scribble', 1.0); shots.face(); },
      ['li', 14, "But I do have more gifts for you, brat... ♥\n\nWe're just getting started!"],
    ]);
    // ---------- Amaymon calls from his ball: Lilith cannot stand him ----------
    shots.ball(); await S.wait(0.4); await S.mark('amaymon');
    await say('am', 0, 'WHEERE ARE YOU MY LOVE????');
    S.emote(lil.obj, 'exclaim', 0.9);
    // (upright again: she is off her knees)
    tickle('calm'); LK.base = 0; lil.clip('ThiefIdle', 0.3); lil.hover(0.6); lil.flap(1);
    await backOff(V3(CH.x + 0.3, 0, AT.feet.z + 1.5));
    shots.wide();
    await lines([
      () => S.emote(lil.obj, 'anger', 1.0),
      ['li', 7, 'OH DAMNATION!!!\nTHERE IS THAT CURSED FIEND AGAIN!'],
      () => { shots.ball(); return S.emote(ball, 'sweat', 1.0); },
      ['am', 4, 'AHHH THERE YOU ARE!!!\nPlease come to me my darling!!!\n♥♥♥♥'],
      ['am', 15, 'IT IS TIME FOR OUR FAVOURITE GAME! I LONG FOR YOU!!!'],
      () => { shots.wide(); return backOff(V3(CH.x + 0.2, 0, AT.feet.z + 2.4), 0.9); },
      ['li', 4, 'Get lost, you damned Creep!!\nI am no longer bound in your realm!\nI shall do as I please from now on!'],
      () => shots.ball(),
      ['am', 18, "I'M SOOOOO SAAAADDD... COME BACK MY LOOVEEE I BEEEG YOUUU"],
      () => { shots.lil(); S.emote(lil.obj, 'anger', 1.0); },
      ['li', 7, 'Frozen Hells, I despise him!\nA thousand years of his whining\nis quite enough for anyone!'],
      () => S.wait(1.4),
      ['li', 0, "Apologies my dearest Anne, I've got to go."],
      ['li', 2, "However...\nYou've set me free of him!\nKnow that you will always be my favorite plaything from now on!"],
      ['li', 12, "Sweet dreams, my little witch...\nI'll come and play with those feet\nevery single night! ♥"],
    ]);
    // she is gone in a swirl of violet; the screen goes black
    shots.wide();
    sparks.burst(lil.obj.position.clone().setY(1.3), VIOLET, 40, 1.4, 1.0); lil.hide(); S.voice('chuckle', 0.7);
    BOUND = 0; await S.wait(0.8); S.expr('worried', 0.2);
    await S.fade(1, 1.0); await S.wait(1.2); await S.mark('gone');
    STAGED = false; S.voiceLoop(null); hands(null, null); stg.end();
    // (10-03) alone again, she sits down on the rug in front of the chair and puts her shoes back on; black again for her memories
    await kit.putShoesOn({ force: true, at: V3(CH.x, 0, CH.z + 1.1), yaw: 0, expr: 'worried' });
    await S.wait(0.5); await S.fade(1, 0.8);
    // ---------- her memories ----------
    await C.memoryCards();
    stopSkip(); S.flag('prologue', true); S.progress = Math.max(S.progress, 1);
    A.setHeelsWorn(true); if (A.setHat) A.setHat(true);
    S.go('camp', [11, 6], 'west');
    await new Promise(() => {});                         // (the page is leaving)
  }

  S.onArrive = () => { S.run(prologue); };
  S.blockExit = () => true;
  if (typeof window !== 'undefined') window.__lib = { lil, LK, stg, shots, tickle, hands, STG, feet, along, HANDS, FLOOR };      // (tests)
}
