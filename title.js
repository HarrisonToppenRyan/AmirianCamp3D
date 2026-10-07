// title.js (10-07, as he asked): the title screen, after the 2D game's (KunMainThemes: one of its sea-and-tower backdrops
// behind, its logo on a dark band down the middle with the menu under it, Anne to the left of the band and one of the
// others to the right, picked at random each time).
//  - Here it is a place in the 3D world, far outside the area's map: a rock ledge above the sea, the 2D's own backdrop
//    (title/bg-*.png, the winter ones in December as the 2D has them) standing 40 m behind it, the area's own sun on it.
//  - Anne stands on the left in a look made up at random (looks.js random(): heritage, skin, species, face, eyes, hair,
//    build, one of the outfits; a pair of shoes, their colour and her toenails from index.html's lists) and does her
//    standing foot poses in turn: a heel up out of her shoe with the shoe hanging from her toes, her ankles crossed, her
//    toes wiggling. NOTHING of it is kept: the player's own heroine is put back the moment the title ends.
//  - One of the others stands on the right (Lilith hovering on her wings, Boudicca, Aurelia, Camellia, the Dryad, Elora,
//    Mia: the twins of thief.js / cast2.js). Every PERIOD seconds the picture fades, and both, and the backdrop, change.
// Host (index.html): createTitle(env) -> { on, start(), update(dt, t), leave(), go(fn), next(), state() }.
// Tests: ?tcast=<id> ?tbg=<n> ?tseed=<n> (the same rolls every time) ?thold (never changes by itself) ?tpose=<clip> ?twinter
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);

export async function createTitle(env) {
  const { THREE, scene, camera, A, anne, post, story, looks, sun, shoes, qp } = env;
  const S = story.S, K = common(S), PI = Math.PI;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = (id) => document.getElementById(id);
  const [{ createLilith }, { createBoudicca }, { createThief }, cast2] = await Promise.all([import('./lilith.js' + V), import('./boudicca.js' + V), import('./thief.js' + V), import('./cast2.js' + V)]);

  // ---------- chance (?tseed: the same every time) ----------
  let seed = qp.has('tseed') ? (+qp.get('tseed') | 0) || 1 : 0;
  const rnd = seed ? () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; } : Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)], pickNot = (a, not) => { const b = a.filter((x) => x !== not); return pick(b.length ? b : a); };
  const fixed = (n) => { let s = n; return () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

  // ---------- the place: far outside the map, turned so that the sun stands to the picture's upper left ----------
  const FOV = 30, VIEW_H = 3.15, BACK_Z = -40, PERIOD = 26, CAM_Y = 1.1, AIM_Y = 1.0;
  const sd = sun ? V3().subVectors(sun.position, sun.target.position) : V3(0.4, 1, 0.5), sunAz = Math.atan2(sd.x, sd.z);
  const stage = new THREE.Group(); stage.name = 'TitleStage'; stage.position.set(-400, 0, -400); stage.rotation.y = sunAz + 0.75; stage.visible = false; scene.add(stage);
  const world = (x, y, z, out = V3()) => stage.localToWorld(out.set(x, y, z));
  const FAZ = stage.rotation.y;                      // (a figure turned to this faces the camera)

  // (December, as the 2D has it: its winter backdrops, which are night pictures; here the ledge lies under snow and the light is dusk's)
  const WINTER = qp.has('twinter') || (() => { const d = new Date(); return d.getMonth() === 11 && d.getDate() <= 28; })();
  // the ledge: flat where they stand, a broken edge behind them, boulders and tufts along it
  {
    const r0 = fixed(7), cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#9c6a48'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1500; i++) { const x = r0() * 512, y = r0() * 512, r = 4 + r0() * 26, k = r0(); g.fillStyle = k < 0.45 ? `rgba(70,40,26,${0.05 + r0() * 0.09})` : k < 0.85 ? `rgba(214,164,118,${0.05 + r0() * 0.09})` : `rgba(92,112,58,${0.04 + r0() * 0.08})`;
      for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * (0.4 + r0() * 0.6), r0() * PI, 0, PI * 2); g.fill(); } }
    g.strokeStyle = 'rgba(48,26,18,.4)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { let x = r0() * 512, y = r0() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r0() - 0.5) * 60; y += (r0() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(5, 5); map.anisotropy = 8;
    const mat = WINTER ? new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, color: new THREE.Color(0.50, 0.54, 0.62) }) : new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, color: new THREE.Color(0.52, 0.52, 0.52) });
    const geo = new THREE.PlaneGeometry(22, 16, 88, 32); geo.rotateX(-PI / 2); geo.translate(0, 0, 5.4);      // (z from -2.6, behind them, to 13.4, behind the camera)
    const P = geo.attributes.position, nz = (x) => Math.sin(x * 1.7 + 1.3) * 0.5 + Math.sin(x * 4.1 + 0.4) * 0.28 + Math.sin(x * 9.3 + 2.2) * 0.14;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); if (z < -1.5) { const e = Math.min(1, (-1.5 - z) / 1.1); P.setZ(i, z + nz(x) * 0.55 * e); P.setY(i, -0.5 * e * e * e); } }
    geo.computeVertexNormals();
    const ledge = new THREE.Mesh(geo, mat); ledge.receiveShadow = true; stage.add(ledge);
    const rockMat = new THREE.MeshStandardMaterial({ map, roughness: 1, color: WINTER ? new THREE.Color(0.30, 0.34, 0.44) : new THREE.Color(0.40, 0.37, 0.36) });
    const tuftMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.09, 0.17, 0.045), roughness: 1, side: THREE.DoubleSide });
    const boulder = (sx, sy, sz, k) => {               // a lump: a sphere pushed in and out along its own directions, a few ways at once
      const geo = new THREE.IcosahedronGeometry(1, 3), Q = geo.attributes.position, f = [r0() * 6, r0() * 6, r0() * 6];
      for (let i = 0; i < Q.count; i++) { const x = Q.getX(i), y = Q.getY(i), z = Q.getZ(i), n = 1 + k * (0.5 * Math.sin(x * 2.3 + f[0]) * Math.sin(y * 2.1 + f[1]) + 0.32 * Math.sin(z * 3.7 + f[2]) * Math.sin(x * 3.1 + f[1]) + 0.18 * Math.sin(y * 6.3 + f[0]));
        Q.setXYZ(i, x * n * sx, Math.max(-0.3, y * n) * sy, z * n * sz); }
      geo.computeVertexNormals(); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.3);
      const m = new THREE.Mesh(geo, rockMat); m.castShadow = m.receiveShadow = true; return m;
    };
    for (let i = 0; i < 13; i++) {
      const x = -8.6 + i * 1.42 + (r0() - 0.5) * 0.9, clear = Math.abs(Math.abs(x) - 1.7) > 1.1, s = i % 3 === 1 && clear ? 0.3 + r0() * 0.22 : 0.11 + r0() * 0.14;      // (the big ones not right behind where the two stand)
      const m = boulder(s * (1.1 + r0() * 0.7), s * (0.7 + r0() * 0.35), s * (0.9 + r0() * 0.4), 0.42); m.position.set(x, s * 0.1, -2.0 - r0() * 0.4); m.rotation.y = r0() * 6; stage.add(m);
      for (let q = 0; q < 2; q++) { const t = new THREE.Group(); t.position.set(x + (r0() - 0.5) * 1.3, 0, -1.5 - r0() * 0.55);
        for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.1 + r0() * 0.14, 4), tuftMat); b.position.set((r0() - 0.5) * 0.16, 0.05, (r0() - 0.5) * 0.16); b.rotation.set((r0() - 0.5) * 0.8, 0, (r0() - 0.5) * 0.8); t.add(b); } stage.add(t); }
    }
  }
  // the backdrop: one of the 2D's, far behind; laid out to fill the picture whatever its shape (layout)
  const BGS = WINTER ? ['winter-1', 'winter-2', 'winter-3', 'winter-4', 'winter-5'] : ['2', '3', '4', '5', '6', '7', '8'];
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), fog: false })); back.frustumCulled = false; stage.add(back);
  const texLoader = new THREE.TextureLoader();
  const loadTex = (id) => new Promise((res) => texLoader.load('title/bg-' + id + '.png' + V, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));

  // ---------- who stands on the right ----------
  const CAST = [
    { id: 'lilith', name: 'Lilith', sub: 'Queen of the Succubi', make: () => createLilith(S, K), expr: 'smug', hover: 1.5 },
    { id: 'boudicca', name: 'Boudicca', sub: "Silverthorn, the tower's spellblade", make: () => createBoudicca(S, K), expr: 'smile' },
    { id: 'aurelia', name: 'Aurelia Blue', sub: 'the thief', make: () => createThief(S, K), expr: 'smug' },
    { id: 'camellia', name: 'Camellia Flaire', sub: 'the fortune teller of the Trader Post', make: () => cast2.createCamellia(S, K), expr: 'happy' },
    { id: 'dryad', name: 'The Dryad', sub: 'of the Forest of Lys', make: () => cast2.createDryad(S, K), expr: 'smug' },
    { id: 'elora', name: 'Elora', sub: 'Vice-Captain of the Valyndra guard', make: () => cast2.createElora(S, K), expr: 'smile' },
    { id: 'mia', name: 'Lieutenant Mia', sub: 'of the Valyndra guard', make: () => cast2.createMia(S, K), expr: 'smile' },
  ];

  // ---------- what is written over the picture ----------
  const css = document.createElement('style');
  css.textContent = `
  #tveil { position: fixed; inset: 0; z-index: 4; background: #070b16; opacity: 0; pointer-events: none; transition: opacity .45s ease; }
  .tcap { position: fixed; bottom: 4.5vh; z-index: 5; width: 30vw; text-align: center; pointer-events: none; display: none; color: #f4ecd8; text-shadow: 0 2px 6px #000, 0 0 2px #000; transition: opacity .45s ease; }
  html.title-on .tcap { display: block; }
  .tcap b { display: block; font: 400 clamp(22px, 2.5vw, 34px)/1.1 Amarante, Georgia, serif; color: #f0cf6a; letter-spacing: .03em; }
  .tcap i { display: block; font: italic clamp(12px, 1.1vw, 15px)/1.35 Georgia, serif; opacity: .92; margin-top: 2px; }
  .tcap i span + span::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #f0cf6a; margin: 0 .55em .2em; }
  #tcapL { left: 3vw; } #tcapR { right: 3vw; }
  @media (max-width: 760px) { .tcap { width: 34vw; bottom: 2vh; } .tcap b { font-size: 18px; } .tcap i { font-size: 11px; } }
  @media (max-aspect-ratio: 9/10) { .tcap { width: 46vw; bottom: 31vh; } #tcapL { left: 2vw; } #tcapR { right: 2vw; } }`;
  document.head.appendChild(css);
  const mk = (id, cls) => { const e = document.createElement('div'); e.id = id; if (cls) e.className = cls; document.body.appendChild(e); return e; };
  const veil = mk('tveil'), capL = mk('tcapL', 'tcap'), capR = mk('tcapR', 'tcap');
  // (a caption: a name, and under it one or more things about her, a small drawn dot between them: no font's own dot is relied on)
  const cap = (el, name, subs) => { el.textContent = ''; const b = document.createElement('b'), i = document.createElement('i'); b.textContent = name; for (const t of [].concat(subs)) { const sp = document.createElement('span'); sp.textContent = t; i.appendChild(sp); } el.append(b, i); };
  const veilNow = (v) => { veil.style.transition = 'none'; veil.style.opacity = v; void veil.offsetWidth; veil.style.transition = ''; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

  // ---------- the picture's lay-out, for the window's shape ----------
  const L = { xs: 1.6, dist: 6.5, viewH: VIEW_H };
  function layout() {
    const asp = innerWidth / Math.max(1, innerHeight), tan = Math.tan(FOV * PI / 360);
    L.viewH = Math.max(VIEW_H, 3.5 / asp);              // (a tall window: at least 3.5 m across, so that both stand in it)
    const viewW = L.viewH * asp; L.dist = L.viewH / 2 / tan;
    L.xs = Math.max(0.95, Math.min(2.1, viewW * 0.275));
    // the backdrop covers the picture with a margin (the camera sways), its lower edge a little above the picture's (the ledge hides the gap)
    const d = L.dist - BACK_Z, bh = 2 * d * tan, bw = bh * asp, img = back.material.map && back.material.map.image, ia = img && img.width ? img.width / img.height : 816 / 624;
    const w = Math.max(bw, bh * 0.9 * ia) * 1.13, h = w / ia, bottom = AIM_Y - bh / 2 + bh * 0.05 + (CAM_Y - AIM_Y) * (d / L.dist);
    back.scale.set(w, h, 1); back.position.set(0, bottom + h / 2, BACK_Z);
    place();
  }
  addEventListener('resize', () => { if (api.on) layout(); });

  // ---------- her: where she stands, and her foot poses in turn ----------
  const POSES = ['IdleTiptoe', 'IdleCrossR', 'IdleTiptoeR', 'IdleCross'].filter((n) => A.hasClip(n));
  const WIGGLE_AT = { IdleTiptoe: [3.3, 1.2], IdleTiptoeR: [3.6, 1.2], IdleCross: [3.4, 1.2], IdleCrossR: [3.7, 1.2] };
  // (which way she is turned in each, from facing the picture: side-on, the foot that comes up nearest the picture (seen from
  // the front her heel is hidden behind her other leg); between two poses she faces the picture, FRONT)
  const FRONT = 0.45, POSE_YAW = { IdleTiptoe: -1.05, IdleTiptoeR: 1.25, IdleCross: 1.25, IdleCrossR: -1.05 };
  const P = { i: 0, name: null, t: 0, gap: 2.2, wig: -1, yaw: FRONT, now: FRONT, done: 0, lift: 0 };
  function poseReset() { A.releaseClips(); if (A.setToeWiggle) A.setToeWiggle(0); P.name = null; P.t = 0; P.gap = 2.2; P.wig = -1; P.yaw = P.now = FRONT; P.done = 0; P.lift = 0; if (A.setSkirtLift) A.setSkirtLift(0); }
  function pose(dt) {
    P.now += (P.yaw - P.now) * (1 - Math.exp(-dt * 3.2)); anne.rotation.set(0, FAZ + P.now, 0);
    // (a gown is gathered up to her knees while she shows a foot, as wherever the picture is about her feet)
    if (A.setSkirtLift) { P.lift += ((P.name ? 0.5 : 0) - P.lift) * (1 - Math.exp(-dt * 4)); A.setSkirtLift(P.lift < 0.01 ? 0 : P.lift); }
    if (P.wig > 0) { P.wig -= dt; if (P.wig <= 0 && A.setToeWiggle) A.setToeWiggle(0); }
    if (!POSES.length) return;
    if (!P.name) {
      P.gap -= dt; if (P.gap > 0) return;
      P.name = qp.get('tpose') && A.hasClip(qp.get('tpose')) ? qp.get('tpose') : POSES[P.i++ % POSES.length]; P.t = 0; P.yaw = POSE_YAW[P.name] === undefined ? FRONT : POSE_YAW[P.name]; A.playClip(P.name, 0.4); return;
    }
    P.t += dt;
    const wg = WIGGLE_AT[P.name]; if (wg && P.t >= wg[0] && P.t - dt < wg[0] && A.setToeWiggle) { A.setToeWiggle(0.11, 1.25); P.wig = wg[1]; }
    if (P.t > A.clipSec(P.name) - 0.1) { A.releaseClips(); P.name = null; P.gap = 2.4 + rnd() * 0.8; P.yaw = FRONT; P.done++; }
  }
  const _p = V3();
  function place() {
    if (!api.on) return;
    anne.position.copy(world(-L.xs, 0, 0, _p)); anne.rotation.set(0, FAZ + P.now, 0); anne.visible = true;
    if (cur.cast && cur.cast.fig && cur.cast.fig.obj) { const f = cur.cast.fig; f.obj.position.copy(world(L.xs, 0, 0, _p)); if (f.hover) f.hover(cur.cast.hover || 0, 0); }
  }

  // ---------- one picture: a look for her, someone beside her, a backdrop ----------
  const cur = { cast: null, bg: null, look: null, shoe: null };
  async function roll(first) {
    const bg = first && qp.get('tbg') && BGS.includes(qp.get('tbg')) ? qp.get('tbg') : pickNot(BGS, cur.bg), tex = await loadTex(bg);
    if (!api.on) { if (tex) tex.dispose(); return; }
    if (tex) { const old = back.material.map; back.material.map = tex; back.material.needsUpdate = true; if (old) old.dispose(); cur.bg = bg; }
    // her look, her shoes
    const look = looks.random(rnd); looks.apply(look); cur.look = look;
    const st = shoes.styles.length ? pick(shoes.styles) : null, col = pick(shoes.cols), sole = rnd() < 0.6 ? '' : pick(shoes.soles.slice(1))[1], nail = pick(shoes.nails);
    shoes.tryOn(st ? st.id : '', col[1], sole, nail[1]); cur.shoe = st ? st.id : '';
    if (A.setHeelsWorn) A.setHeelsWorn(true);
    poseReset(); A.setExpression(pick(['smile', 'happy', 'smile', 'smug']));
    // (her caption: with a skin no heritage has, her species says it all)
    const d = looks.describe(look), what = [look.species === 'human' ? d.heritage : d.fantasy ? d.species : d.heritage + ' ' + d.species.toLowerCase(), d.outfit, st ? st.label : ''].filter(Boolean);
    cap(capL, env.heroName ? env.heroName() : 'Anne', what);
    // who is beside her
    if (cur.cast && cur.cast.fig) cur.cast.fig.hide();
    const want = first && qp.get('tcast') ? CAST.find((c) => c.id === qp.get('tcast')) : null, c = want || pickNot(CAST, cur.cast);
    cur.cast = c;
    try {
      if (!c.fig) c.fig = c.make();
      if (c.fig.show(world(L.xs, 0, 0), FAZ - 0.5)) { c.fig.face(FAZ - 0.5); c.fig.expr(c.expr || 'smile'); if (c.fig.hover) { c.fig.hover(c.hover || 0, 0); c.fig.flap(1); } }
    } catch (e) { console.warn('title: ' + c.id + ' could not be made', e); }
    cap(capR, c.name, c.sub);
    layout();
    console.log('TITLE roll ' + JSON.stringify({ bg: cur.bg, cast: c.id, heritage: look.heritage, species: look.species, skin: look.skin, outfit: look.outfit, shoe: cur.shoe }));
  }

  // ---------- the title's own music (the 2D's Theme4), if the player has the music on ----------
  const music = new Audio('theme4.mp3' + V); music.loop = true; music.volume = 0.45; music.preload = 'none';
  const musicSync = () => { if (api.on && env.musicOn && env.musicOn()) music.play().catch(() => {}); else music.pause(); };
  const onGesture = () => { if (api.on && music.paused) musicSync(); };

  // ---------- the menu: up and down, Enter ----------
  const items = () => [...document.querySelectorAll('#start .btn')].filter((e) => e.offsetParent !== null);
  let sel = 0;
  const mark = () => { const it = items(); sel = Math.max(0, Math.min(it.length - 1, sel)); it.forEach((e, i) => e.classList.toggle('tsel', i === sel)); };
  const onKey = (e) => {
    if (!api.on || gone) return;
    if (e.code === 'KeyM') { setTimeout(musicSync, 0); return; }
    const it = items(); if (!it.length) return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % it.length; mark(); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel + it.length - 1) % it.length; mark(); e.preventDefault(); }
    else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !e.repeat) { e.preventDefault(); it[Math.min(sel, it.length - 1)].click(); }
  };
  const onOver = (e) => { const it = items(), i = it.indexOf(e.target); if (i >= 0) { sel = i; mark(); } };

  // ---------- on, every frame, off ----------
  let was = null, busy = false, gone = false, T = 0, rollT = PERIOD;
  const HOLD = qp.has('thold'), focus = V3(), _c = V3(), _a = V3();
  const api = {
    on: false,
    async start() {
      if (api.on) return;
      was = { p: anne.position.clone(), ry: anne.rotation.y, night: env.night ? env.night.value : 0, grade: post.grade ? post.grade() : null, fov: camera.fov, vis: anne.visible };
      api.on = true; window.__titleOn = true;
      if (env.night) env.night.value = WINTER ? 0.5 : 0;
      if (post.setGrade) post.setGrade(1, 1, 1, 0, 1); post.setFocus(null);
      stage.visible = true; stage.updateMatrixWorld(true);
      veilNow(1);
      await roll(true);
      if (!api.on) return;
      document.documentElement.classList.remove('title-load'); document.documentElement.classList.add('title-on');
      addEventListener('keydown', onKey); addEventListener('pointerdown', onGesture); addEventListener('keydown', onGesture); $('start').addEventListener('pointerover', onOver);
      mark(); musicSync();
      frames(3).then(() => { if (api.on) veil.style.opacity = 0; });
      console.log('TITLE ready');
    },
    update(dt, t) {
      if (!api.on) return;
      T += dt;
      pose(dt);
      A.updateClips(dt, 0);
      if (cur.cast && cur.cast.fig && cur.cast.fig.obj && cur.cast.fig.obj.visible) cur.cast.fig.update(dt, t);
      A.updateFace(dt, t);
      looks.update(dt, t);
      // the camera: level with their middles, swaying a little, so that the ledge and the far backdrop move against each other
      world(0.2 * Math.sin(T * 0.21), CAM_Y + 0.03 * Math.sin(T * 0.17), L.dist, _c); world(0, AIM_Y, 0, _a);
      if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); }
      camera.position.copy(_c); camera.lookAt(_a);
      env.world(dt, t, world(0, 0, 0, focus));
      if (!busy && !HOLD && !gone) { rollT -= dt; if ((P.done >= 2 && !P.name && P.gap < 1.2) || rollT <= 0) api.next(); }      // (after two of her poses, as she faces the picture again; PERIOD at the latest)
    },
    // the picture fades, changes, and comes back
    async next() {
      if (busy || !api.on || gone) return; busy = true;
      veil.style.opacity = 1; capL.style.opacity = capR.style.opacity = 0; await sleep(480);
      if (api.on && !gone) { await roll(false); await frames(3); }
      if (api.on && !gone) { veil.style.opacity = 0; capL.style.opacity = capR.style.opacity = 1; }
      busy = false; rollT = PERIOD;
    },
    // the title ends: her own look, her own place, the area's light, as they were
    leave() {
      if (!api.on) return;
      api.on = false; window.__titleOn = false;
      removeEventListener('keydown', onKey); removeEventListener('pointerdown', onGesture); removeEventListener('keydown', onGesture); $('start').removeEventListener('pointerover', onOver);
      for (const e of document.querySelectorAll('#start .btn.tsel')) e.classList.remove('tsel');
      music.pause();
      for (const c of CAST) if (c.fig) c.fig.hide();
      stage.visible = false;
      poseReset(); A.setExpression('neutral'); looks.apply(); shoes.restore();
      anne.position.copy(was.p); anne.rotation.set(0, was.ry, 0); anne.visible = was.vis;
      if (env.night) env.night.value = was.night;
      if (was.grade && post.setGrade) post.setGrade(...was.grade);
      camera.fov = was.fov; camera.updateProjectionMatrix();
      document.documentElement.classList.remove('title-on', 'title-load');
      if (env.onLeave) env.onLeave();
      try { if (looks.customized()) looks.portrait('neutral', 0); } catch (e) { /* made when a line first needs it */ }      // (her own portraits were dropped with each look tried on: the first is made now, not in the middle of a line)
      console.log('TITLE left');
    },
    // a menu choice: the picture goes dark at once, the title ends, `fn` runs (in the click itself: sound may start), the game fades in
    go(fn) {
      if (!api.on) return fn();
      if (gone) return; gone = true;
      veilNow(1); api.leave(); fn();
      frames(3).then(() => { veil.style.opacity = 0; });
    },
    state: () => ({ on: api.on, busy, bg: cur.bg, cast: cur.cast && cur.cast.id, look: cur.look, shoe: cur.shoe, pose: P.name, poseT: +P.t.toFixed(2), xs: +L.xs.toFixed(2), dist: +L.dist.toFixed(2), music: !music.paused }),
    cast: CAST, stage, back, L, P, poseNow: (n, yaw) => { A.releaseClips(); if (yaw !== undefined) P.yaw = P.now = yaw; P.name = n; P.t = 0; A.playClip(n, 0.2); },
  };
  return api;
}
