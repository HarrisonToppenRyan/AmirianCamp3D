// story_barracks.js: the guard house dungeon of Valyndra City (the 2D game's Map 48 "Barraks", shown as "Capital City
// Dungeons"), where Chapter 2's thief is questioned (Map048 event 6 "Chief" page 1: the whole scene; lines are the 2D's own).
//   The heroes never catch her: the city guard arrested Aurelia Blue that morning, and she is already in the foot stocks,
//   laughing, when Anne and Boudicca walk in. Vice-Captain Elora will not hand over the confiscated bag; Boudicca, who
//   cannot see a pair of bare soles without wanting a go, talks her into a contest: one foot each, the first to make the
//   thief give in wins. Fingers, then the brush, then the toe ties, until "ENOUGH! I'LL NEVER COME BACK!". Anne takes the
//   bag from the table: the Grimmoire of Conjuration and all their gold. Then the street again (story_valyndra.js).
// A set (level.interior): one stone room, the stocks at the middle of the back wall, torches, a table with the evidence,
// Lieutenant Mia by the door. Everybody is dressed and stays so; only the thief's boots are off (they stand by the wall).
// The hands on her soles are thief.js's arms aimed at points with air under them (footwork.js): nothing goes into her.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);
const { createElora, createMia, createAureliaBare, FACES } = await import('./cast2.js' + V);
const { solesOf, footWork } = await import('./footwork.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3 } = S, C = common(S), { sparks } = C;
  const PI = Math.PI, post = env.post, tc = (x, y) => S.tileC(x, y);
  const grade = (g) => { if (post && post.setGrade) post.setGrade(...g); };
  grade([1.05, 0.98, 0.9, 0.1, 0.98]); S.setNight(0.55);
  S.noFeetCut = true;                                  // (every word about feet in this room is about the thief's, not Anne's)
  const GOLD = new THREE.Color(1.7, 1.3, 0.4);

  // =====================================================================================================
  //                                                 the room
  // =====================================================================================================
  const X0 = 1.6, X1 = 16.0, Z0 = 1.6, Z1 = 12.8, HGT = 4.4, CX = (X0 + X1) / 2;
  const SEAT = V3(CX, 0, 3.55);                        // where the thief sits, her back to the post, facing the door (south)
  const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stoneT = tex(512, 512, (x, w, h) => { x.fillStyle = '#3c3a38'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { const o = (r % 2) * 51, l = 78 + rnd() * 34; x.fillStyle = `rgb(${l + 6},${l + 2},${l - 6})`; x.fillRect(c * 102.4 + o - 51 + 3, r * 64 + 3, 96, 58); } });
  const flagT = tex(512, 512, (x, w, h) => { x.fillStyle = '#2e2c2a'; x.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const l = 62 + rnd() * 26; x.fillStyle = `rgb(${l + 4},${l + 2},${l - 2})`; x.fillRect(c * 128 + 3, r * 128 + 3, 122, 122); for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`; x.fillRect(c * 128 + rnd() * 120, r * 128 + rnd() * 120, 20 + rnd() * 50, 2); } } });
  const woodT = tex(256, 256, (x, w, h) => { for (let i = 0; i < 4; i++) { const l = 70 + rnd() * 24; x.fillStyle = `rgb(${l + 26},${l},${l - 26})`; x.fillRect(0, i * 64, w, 62); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, i * 64 + 62, w, 2); for (let k = 0; k < 22; k++) { x.fillStyle = `rgba(40,22,8,${0.1 + rnd() * 0.12})`; x.fillRect(rnd() * w, i * 64 + rnd() * 60, 30 + rnd() * 90, 1.5); } } });
  const room = new THREE.Group(); scene.add(room);
  const mat = { stone: new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.95 }), wood: new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.8 }), dark: new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x33353a, roughness: 0.5, metalness: 0.7 }), cloth: new THREE.MeshStandardMaterial({ color: 0x6a5236, roughness: 0.95 }) };
  const box = (w, h, d, m, x, y, z, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; room.add(b); return b; };
  { // floor, ceiling, walls (the south wall has the door's opening)
    const fm = new THREE.MeshStandardMaterial({ map: flagT, roughness: 0.92 }); fm.map.repeat.set(5, 4);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 4, Z1 - Z0 + 6), fm); f.rotation.x = -PI / 2; f.position.set(CX, 0, (Z0 + Z1) / 2 + 1); f.receiveShadow = true; room.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat.dark); c.rotation.x = PI / 2; c.position.set(CX, HGT, (Z0 + Z1) / 2); room.add(c);
    for (const z of [3.4, 6.4, 9.4, 12.0]) box(X1 - X0, 0.26, 0.3, mat.dark, CX, HGT - 0.13, z).castShadow = false;
    const wm = (rx) => { const m = mat.stone.clone(); m.map = stoneT.clone(); m.map.repeat.set(rx, 2); m.map.needsUpdate = true; return m; };
    const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, HGT), wm(w / 3)); m.position.set(x, HGT / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m); };
    wall(X1 - X0, CX, Z0, 0); wall(Z1 - Z0, X0, (Z0 + Z1) / 2, PI / 2); wall(Z1 - Z0, X1, (Z0 + Z1) / 2, -PI / 2);
    const DW = 1.5;                                    // the door: an opening in the south wall, an iron-bound door standing open
    wall(CX - DW / 2 - X0, (X0 + CX - DW / 2) / 2, Z1, PI); wall(X1 - CX - DW / 2, (X1 + CX + DW / 2) / 2, Z1, PI);
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(DW, HGT - 2.5), wm(0.5)); m.position.set(CX, 2.5 + (HGT - 2.5) / 2, Z1); m.rotation.y = PI; room.add(m); }
    box(0.14, 2.5, 0.2, mat.dark, CX - DW / 2, 1.25, Z1); box(0.14, 2.5, 0.2, mat.dark, CX + DW / 2, 1.25, Z1); box(DW + 0.28, 0.16, 0.2, mat.dark, CX, 2.58, Z1);
    // (hinged on the east post, swung into the room: a box's own X runs along (cos ry, -sin ry))
    const door = box(DW - 0.08, 2.4, 0.07, mat.wood, CX + DW / 2 + Math.cos(1.29) * (DW - 0.08) / 2, 1.2, Z1 - 0.04 - Math.sin(1.29) * (DW - 0.08) / 2, 1.29); door.castShadow = false;
    { const g = new THREE.Mesh(new THREE.PlaneGeometry(DW + 2, 3.2), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); g.position.set(CX, 1.4, Z1 + 1.5); g.rotation.y = PI; room.add(g); }
  }
  // two barred cells in the side walls (dark behind the bars), and the passage's grating high in the back wall
  const bars = (x, z, ry, w = 2.4, h = 2.3) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x070605 })); hole.position.set(0, h / 2 + 0.05, 0.012); g.add(hole);
    for (let i = 0; i <= 10; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 6), mat.iron); b.position.set(-w / 2 + i * w / 10, h / 2 + 0.05, 0.06); g.add(b); }
    for (const y of [0.1, h / 2, h]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, 0.05), mat.iron); b.position.set(0, y + 0.05, 0.06); g.add(b); } };
  bars(X0 + 0.01, 5.2, PI / 2); bars(X0 + 0.01, 9.6, PI / 2); bars(X1 - 0.01, 5.2, -PI / 2); bars(X1 - 0.01, 9.6, -PI / 2);
  bars(4.6, Z0 + 0.01, 0, 1.6, 0.8); room.children[room.children.length - 1].position.y = 2.6; bars(13.0, Z0 + 0.01, 0, 1.6, 0.8); room.children[room.children.length - 1].position.y = 2.6;
  // torches: an iron cup on the wall, a flame, a warm flickering light (the two by the stocks cast shadows)
  const flames = [];
  const torch = (x, z, ry, shadow) => { const g = new THREE.Group(); g.position.set(x, 2.1, z); g.rotation.y = ry; room.add(g);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6), mat.iron); arm.rotation.x = PI / 2 - 0.5; arm.position.set(0, -0.08, 0.14); g.add(arm);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.12, 10), mat.iron); cup.position.set(0, 0.02, 0.28); g.add(cup);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.05, 0.35), toneMapped: false })); fl.position.set(0, 0.2, 0.28); g.add(fl);
    const l = new THREE.PointLight(0xffa050, 5.5, 11, 1.5); l.position.set(0, 0.3, 0.45); g.add(l);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.003; l.shadow.radius = 3; }
    flames.push({ fl, l, ph: flames.length * 1.7 }); };
  torch(5.4, Z0 + 0.02, 0, true); torch(12.2, Z0 + 0.02, 0, false); torch(X0 + 0.02, 7.4, PI / 2, false); torch(X1 - 0.02, 7.4, -PI / 2, false);
  const fill = new THREE.AmbientLight(0xb09888, 0.85); scene.add(fill);
  const key = new THREE.PointLight(0xffd0a0, 4.2, 10, 1.5); key.position.set(CX + 0.6, 2.6, 6.4); scene.add(key);      // (a lantern hung from a beam: what lights the faces and the soles)
  { const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.5), toneMapped: false })); lan.position.copy(key.position).add(V3(0, 0.25, 0)); room.add(lan);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, HGT - 3.0, 4), mat.iron); ch.position.set(key.position.x, (HGT + 3.0) / 2 + 0.1, key.position.z); room.add(ch); }
  S.actors.push({ update(dt, t) { for (const f of flames) { const k = 1 + 0.12 * Math.sin(t * 11.3 + f.ph) + 0.07 * Math.sin(t * 23.1 + f.ph * 2); f.l.intensity = 5.5 * k; f.fl.scale.set(1, 0.9 + 0.25 * Math.sin(t * 15 + f.ph), 1); } } });
  // the seat and the post behind it (she is tied to the post round her waist; her hands are behind it)
  box(0.18, 2.5, 0.18, mat.wood, SEAT.x, 1.25, SEAT.z - 0.36);
  box(0.74, 0.07, 0.52, mat.wood, SEAT.x, 0.415, SEAT.z - 0.06);
  // (its arms: her forearms lie on them, an iron cuff over each wrist: `cuffs` below)
  for (const s of [-1, 1]) { box(0.08, 0.05, 0.56, mat.wood, SEAT.x + s * 0.31, 0.655, SEAT.z - 0.06); box(0.06, 0.24, 0.06, mat.dark, SEAT.x + s * 0.31, 0.535, SEAT.z + 0.17); box(0.06, 0.24, 0.06, mat.dark, SEAT.x + s * 0.31, 0.535, SEAT.z - 0.3); }
  for (const [dx, dz] of [[-0.32, 0.16], [0.32, 0.16], [-0.32, -0.28], [0.32, -0.28]]) box(0.07, 0.38, 0.07, mat.dark, SEAT.x + dx, 0.19, SEAT.z + dz);
  S.block('stocks', SEAT.x, SEAT.z + 0.5, 1.15);
  // the evidence table: her bag (the Grimmoire inside, and the gold), her boots beside it
  const TABLE = V3(5.0, 0, 7.3);
  box(1.3, 0.07, 0.7, mat.wood, TABLE.x, 0.78, TABLE.z); for (const [dx, dz] of [[-0.56, -0.27], [0.56, -0.27], [-0.56, 0.27], [0.56, 0.27]]) box(0.07, 0.76, 0.07, mat.dark, TABLE.x + dx, 0.38, TABLE.z + dz);
  S.block('table', TABLE.x, TABLE.z, 0.75);
  const bag = new THREE.Group(); bag.position.set(TABLE.x - 0.2, 0.815, TABLE.z); room.add(bag);
  { const sack = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), mat.cloth); sack.scale.set(1.15, 0.72, 0.9); sack.position.y = 0.13; sack.castShadow = true; bag.add(sack);
    const flap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: 0x52402a, roughness: 0.9 })); flap.scale.set(1.12, 0.5, 0.9); flap.position.y = 0.17; bag.add(flap);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, PI), mat.dark); strap.position.set(0, 0.2, 0); strap.rotation.y = PI / 2; bag.add(strap); }
  const book = new THREE.Group(); book.position.set(TABLE.x + 0.28, 0.815, TABLE.z + 0.04); book.rotation.y = 0.4; book.visible = false; room.add(book);
  { const cover = new THREE.MeshStandardMaterial({ color: 0x3a1420, roughness: 0.7 }), pages = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.34), cover), c2 = c1.clone(), pg = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.06, 0.325), pages);
    c1.position.y = 0.006; pg.position.set(0.004, 0.042, 0); c2.position.y = 0.078; const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.084, 0.34), cover); sp.position.set(-0.125, 0.042, 0);
    const sig = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 24), new THREE.MeshStandardMaterial({ color: 0xd7a83a, metalness: 0.7, roughness: 0.35, emissive: 0x3a2400 })); sig.rotation.x = PI / 2; sig.position.y = 0.086;
    book.add(c1, c2, pg, sp, sig); book.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  // her boots, stood against the wall beside the stocks (grey, as she wears them)
  for (const s of [0, 1]) { const g = new THREE.Group(); g.position.set(SEAT.x - 1.55 - s * 0.2, 0, SEAT.z - 0.1 + s * 0.06); g.rotation.y = 0.5 + s * 0.3; room.add(g);
    const bm = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.45, metalness: 0.2 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.3, 12), bm); shaft.position.y = 0.2; shaft.castShadow = true; g.add(shaft);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.2), bm); foot.position.set(0, 0.04, 0.06); foot.castShadow = true; g.add(foot); }
  // a rack of the questioner's tools on the back wall: feathers, brushes, a coil of cord
  { const g = new THREE.Group(); g.position.set(SEAT.x + 2.3, 1.45, Z0 + 0.03); room.add(g);
    const brd = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.04), mat.wood); g.add(brd);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 6), new THREE.MeshStandardMaterial({ color: [0xe8e4f0, 0xd04a5a, 0x4a7ad0, 0xe8c040][i], roughness: 0.8 })); f.scale.z = 0.25; f.position.set(-0.5 + i * 0.2, 0.02, 0.04); g.add(f); }
    for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.04), mat.dark); b.position.set(0.32 + i * 0.16, 0.0, 0.05); g.add(b); }
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 18), new THREE.MeshStandardMaterial({ color: 0xc9a868, roughness: 0.9 })); coil.position.set(0.02, -0.08, 0.05); g.add(coil); }

  // =====================================================================================================
  //                                                 who is here
  // =====================================================================================================
  const bou = createBoudicca(S, C), elora = createElora(S, C), mia = createMia(S, C), aur = createAureliaBare(S, C);
  let aFeet = null, fwE = null, fwB = null, STOCKS = null, TIES = null, STAGED = false;
  S.late.push((dt, t) => {
    aur.update(dt, t);
    if (aFeet) aFeet.read(dt);
    if (STAGED) { fwE.pre(dt); fwB.pre(dt); }
    elora.update(dt, t); bou.update(dt, t); mia.update(dt, t);
    if (STAGED) { fwE.post(dt); fwB.post(dt); }
    if (TIES) TIES.update();
    if (CUFFS) CUFFS.update();
  });
  // their portraits -> their faces
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 5: 'surprised', 6: 'surprised', 7: 'worried', 8: 'smug', 9: 'happy', 10: 'smug', 11: 'laugh', 12: 'worried', 13: 'surprised', 16: 'surprised', 17: 'happy', 18: 'happy' };
  const WHO = { bo: [bou, BO], el: [elora, FACES.el], au: [aur, FACES.au], mi: [mia, FACES.mi] };
  const AUR = { face: null, blush: 0 };                // (while she is tickled her face goes back to this after each of her lines)
  const say = async (sh, i, text, o = {}) => {
    const w = WHO[sh];
    if (w && w[0].made) { w[0].expr(w[1][i] || 'smile', sh === 'au' && AUR.face ? AUR.blush : 0); w[0].talk(true); }
    await S.say(sh, i, text, o);
    if (w && w[0].made) { w[0].talk(false); if (sh === 'au' && AUR.face) aur.expr(AUR.face, AUR.blush); }
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };

  // ---------- the stocks: built round her ankles as she sits (a board with two holes, on two feet; hinges, a padlock) ----------
  function buildStocks() {
    const aR = aur.tw.bone('footR').getWorldPosition(V3()), aL = aur.tw.bone('footL').getWorldPosition(V3());
    const y = (aR.y + aL.y) / 2, z = (aR.z + aL.z) / 2 - 0.035, W = 1.16, HH = 0.2, R = 0.052;
    const sh = new THREE.Shape(); sh.moveTo(-W / 2, -HH); sh.lineTo(W / 2, -HH); sh.lineTo(W / 2, HH); sh.lineTo(-W / 2, HH); sh.closePath();
    // (the holes are ovals: tickled, her ankles go 1.3 cm to either side, 2 cm down and 3 cm up; measured)
    for (const a of [aR, aL]) { const h = new THREE.Path(); h.absellipse(a.x - SEAT.x, a.y - y + 0.006, R + 0.006, R + 0.017, 0, PI * 2, true, 0); sh.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 20 });
    const m = new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.75 }); const b = new THREE.Mesh(geo, m); b.position.set(SEAT.x, y, z - 0.035); b.castShadow = b.receiveShadow = true; room.add(b);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.006, 0.084), mat.dark); seam.position.set(SEAT.x, y, z); room.add(seam);
    for (const s of [-1, 1]) { box(0.1, y - HH + 0.02, 0.2, mat.wood, SEAT.x + s * (W / 2 - 0.07), (y - HH) / 2, z); box(0.24, 0.05, 0.42, mat.dark, SEAT.x + s * (W / 2 - 0.07), 0.025, z);
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.012), mat.iron); hinge.position.set(SEAT.x + s * (W / 2 - 0.09), y, z + 0.047); room.add(hinge); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.03), mat.iron); lock.position.set(SEAT.x, y - 0.02, z + 0.055); room.add(lock);
    const hasp = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14, PI), mat.iron); hasp.position.set(SEAT.x, y + 0.015, z + 0.055); room.add(hasp);
    // the rope round her waist and the post
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 28), new THREE.MeshStandardMaterial({ color: 0xc9a868, roughness: 0.9 })); rope.rotation.x = PI / 2; rope.scale.set(0.8, 1.5, 1); rope.position.set(SEAT.x, 0.73, SEAT.z - 0.19); room.add(rope);
    return { y, z, top: y + HH, W, holes: [aR.clone(), aL.clone()] };
  }
  // the toe ties: a loop round each big toe, drawn back to a peg on top of the board (they follow her toes every frame)
  function makeToeTies() {
    const sm = new THREE.MeshLambertMaterial({ color: 0xe6d3a0 }), g = new THREE.Group(); g.visible = false; scene.add(g);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); cyl.translate(0, 0.5, 0);
    const T = [0, 1].map((i) => { const f = aFeet[i], loop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 6, 22), sm), line = new THREE.Mesh(cyl, sm), peg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), mat.iron);
      loop.frustumCulled = line.frustumCulled = false; g.add(loop, line, peg); return { f, loop, line, peg, at: V3() }; });
    const _a = V3(), _b = V3(), _d = V3(), _q = new THREE.Quaternion(), UP = V3(0, 1, 0);
    let k = 0, goal = 0;
    return { set(on) { goal = on ? 1 : 0; if (on) g.visible = true; },
      update() {
        k += Math.max(-0.03, Math.min(0.03, goal - k)); if (k <= 0.001 && !goal) { g.visible = false; return; }
        for (const t of T) {
          const toe = t.f.toe; if (!toe) continue;
          toe.getWorldPosition(_a); toe.getWorldQuaternion(_q);
          _b.set(0, 0.013, 0.004).applyQuaternion(_q).add(_a);                       // the middle of the toe's first joint
          t.loop.position.copy(_b); t.loop.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), PI / 2)); t.loop.scale.set(0.0118, 0.0105, 0.0105);
          t.at.set(_b.x + (_b.x > SEAT.x ? 0.03 : -0.03), STOCKS.top + 0.02, STOCKS.z + 0.0); t.peg.position.copy(t.at).setY(STOCKS.top + 0.02);
          _a.copy(_b).addScaledVector(V3(0, 1, 0).applyQuaternion(_q), 0.0); _d.subVectors(t.at, _a).multiplyScalar(k);
          const len = _d.length(); t.line.position.copy(_a); t.line.scale.set(0.0016, Math.max(0.001, len), 0.0016); if (len > 1e-4) t.line.quaternion.setFromUnitVectors(UP, _d.normalize());
        }
      } };
  }
  // the cuffs at her wrists: an iron ring round each, following her arm
  function makeCuffs() {
    const B = [['lowerarm02R', 'wristR'], ['lowerarm02L', 'wristL']].map(([a, b]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 24), mat.iron); m.frustumCulled = false; m.castShadow = true; scene.add(m); return { a: aur.tw.bone(a), b: aur.tw.bone(b), m }; });
    const _a = V3(), _b = V3(), _d = V3(), Z = V3(0, 0, 1);
    return { update() { for (const c of B) { if (!c.a || !c.b) { c.m.visible = false; continue; } c.a.getWorldPosition(_a); c.b.getWorldPosition(_b); _d.subVectors(_b, _a).normalize(); c.m.position.copy(_b).addScaledVector(_d, -0.04); c.m.quaternion.setFromUnitVectors(Z, _d); c.m.scale.setScalar(0.036); } } };
  }
  let CUFFS = null;
  // under black: the thief in the stocks, Elora on her knees at her left foot
  async function seatHer() {
    if (!aur.show(SEAT, 0, 'ChairBare')) return false;
    aur.expr('angry');
    for (let i = 0; i < 3; i++) await S.frame();
    aFeet = solesOf(S, aur.obj); aFeet.read(0);
    if (!STOCKS) STOCKS = buildStocks();
    if (!TIES) TIES = makeToeTies();
    if (!CUFFS) CUFFS = makeCuffs();
    fwE = footWork(S, C, elora, aFeet, { side: 1 }); fwB = footWork(S, C, bou, aFeet, { side: -1 });
    return true;
  }
  // a stage of the tickling: her clip, her face, the voice, what each of the two does
  //   [her clip, how fast, her face, blush, voice, Elora [L, R], Boudicca [L, R], toe ties]
  const STAGES = {
    still: ['ChairBare', 1, 'angry', 0, null, null, null, 0], dread: ['ChairBare', 1, 'shocked', 0.2, null, null, null, 0],
    elora: ['ChairTickled', 0.8, 'laugh', 0.5, 'laughter', ['all', 'all'], null, 0],
    both: ['ChairTickled', 1, 'laughHard', 0.7, 'laughter', ['all', 'toes'], ['all', 'toes'], 0],
    hard: ['ChairTickled', 1.2, 'laughHard', 0.9, 'cackling', ['toes', 'all'], ['all', 'all'], 0],
    brush: ['ChairTickled', 1.25, 'laughHard', 0.95, 'cackling', ['toes', 'brush'], ['brush', 'circle'], 0],
    ties: ['ChairTickled', 1.1, 'laughHard', 1.0, 'cackling', ['toes', 'brush'], ['brush', 'toes'], 1],
    spent: ['ChairBare', 1, 'tired', 0.6, null, null, null, 1],
  };
  function stage(name) {
    const P = STAGES[name]; if (!P || !aur.made) return;
    aur.clip(P[0], 0.3); const act = aur.tw.action(P[0]); if (act) act.timeScale = P[1];
    AUR.face = P[2]; AUR.blush = P[3]; aur.expr(P[2], P[3]);
    S.voiceLoop(P[4], P[4] === 'cackling' ? 2.2 : 2.8);
    if (fwE && elora.made && ELORA_DOWN) { fwE.hands(...(P[5] || [null, null]), P[5] ? null : 'ready'); if (P[5]) fwE.work(); else fwE.lean(0.12); }
    if (fwB && bou.made && BOU_DOWN) { fwB.hands(...(P[6] || [null, null]), P[6] ? null : 'ready'); if (P[6]) fwB.work(); else fwB.lean(0.12); }
    if (TIES) TIES.set(!!P[7]);
  }
  let ELORA_DOWN = false, BOU_DOWN = false;
  const kneelE = () => { fwE.kneel(0); ELORA_DOWN = true; elora.expr('neutral'); };
  const kneelB = () => { fwB.kneel(0); BOU_DOWN = true; bou.expr('happy'); };

  // ---------- the pictures ----------
  const aHead = () => aur.head(V3()), sm = () => fwE.soleMid(V3());
  const shots = {
    wide() { S.cam.set(V3(CX - 3.3, 1.7, 8.9), V3(CX + 0.25, 0.9, 4.9), { fov: 44, cut: true }); post.setCloseUp('off'); },
    room() { S.cam.set(V3(CX + 0.4, 2.3, 12.2), V3(CX, 0.9, 5.4), { fov: 50, cut: true }); post.setCloseUp('off'); },
    thief() { const h = aHead(); h.y -= 0.08; S.cam.set(V3(h.x + 0.5, h.y + 0.12, h.z + 1.75), h, { fov: 30, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    soles() { const m = sm(); S.cam.set(V3(m.x + 0.05, m.y + 0.42, m.z + 1.0), V3(m.x, m.y + 0.0, m.z), { fov: 34, cut: true, focus: m.clone(), focusK: 2.0 }); post.setCloseUp('on'); },
    // (one foot, close: from before it, between the two who kneel)
    solesL() { const f = aFeet[1], m = f.arch; S.cam.set(V3(m.x - 0.07, m.y + 0.16, m.z + 0.52), V3(m.x + 0.01, m.y + 0.02, m.z), { fov: 30, cut: true, focus: m.clone(), focusK: 2.2 }); post.setCloseUp('on'); },
    solesR() { const f = aFeet[0], m = f.arch; S.cam.set(V3(m.x + 0.07, m.y + 0.16, m.z + 0.52), V3(m.x - 0.01, m.y + 0.02, m.z), { fov: 30, cut: true, focus: m.clone(), focusK: 2.2 }); post.setCloseUp('on'); },
    over() { const h = aHead(), m = sm(); S.cam.set(V3(h.x + 0.7, h.y + 0.55, h.z - 0.05), V3(m.x, m.y - 0.05, m.z + 0.3), { fov: 44, cut: true }); post.setCloseUp('off'); },      // (over her shoulder: her soles, and the two at them)
    elora() { const h = elora.head(V3()); h.y -= 0.1; const y = elora.obj.rotation.y; S.cam.set(V3(h.x + Math.sin(y) * 1.2 - 0.3, h.y + 0.08, h.z + Math.cos(y) * 1.2 + 0.25), h, { fov: 32, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    bou() { const h = bou.head(V3()); h.y -= 0.1; const y = bou.obj.rotation.y; S.cam.set(V3(h.x + Math.sin(y) * 1.2 + 0.3, h.y + 0.08, h.z + Math.cos(y) * 1.2 + 0.25), h, { fov: 32, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    anne() { const h = C.headPos(); S.cam.set(V3(h.x + 0.55, h.y + 0.06, h.z - 1.5), h, { fov: 34, cut: true, focus: h.clone(), focusK: 1.6 }); post.setCloseUp('off'); },
    door() { const h = C.headPos(), m = mia.head(V3()), c = V3().lerpVectors(h, m, 0.5); c.y -= 0.1; const y = anne.rotation.y; S.cam.set(V3(c.x + Math.sin(y) * 2.4 + Math.cos(y) * 0.3, c.y + 0.22, c.z + Math.cos(y) * 2.4 - Math.sin(y) * 0.3), c, { fov: 40, cut: true }); post.setCloseUp('off'); },      // (the two by the door, from before them)
    pair() { const a = elora.head(V3()), b = bou.head(V3()), c = V3().lerpVectors(a, b, 0.5); c.y -= 0.15; S.cam.set(V3(c.x + 0.1, c.y + 0.45, c.z + 2.3), c, { fov: 40, cut: true }); post.setCloseUp('off'); },
    table() { S.cam.set(V3(TABLE.x + 1.6, 1.5, TABLE.z + 1.7), V3(TABLE.x, 0.95, TABLE.z), { fov: 38, cut: true }); post.setCloseUp('off'); },
  };
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

  // =====================================================================================================
  //                                             the interrogation
  // =====================================================================================================
  const ENTRY = tc(5, 6), UP2 = V3(CX + 0.15, 0, 7.6), MIA_AT = V3(CX - 2.3, 0, 10.6), BOU_ENTRY = V3(CX + 1.25, 0, 10.9);
  async function interrogation() {
    S.setFade(1); S.place(ENTRY, PI); S.clip('Idle', 0); C.amAt(null);
    mia.show(MIA_AT, yawTo(MIA_AT, V3(CX, 0, 4.6))); mia.expr('smile');
    bou.show(BOU_ENTRY, PI); bou.follow(null); bou.expr('surprised');
    if (!await seatHer()) { S.setFade(0); return; }
    kneelE(); STAGED = true; stage('elora');
    for (let i = 0; i < 6; i++) await S.frame();
    shots.room(); if (env.quiet) env.quiet(true);
    await S.fade(0, 1.0); await S.mark('arrive');
    await lines([
      ['au', 11, "Gaahahahahahahahahahahahahahaha!\nD-Dohohohon't d-doohoohoohoohoohoo\nthahahahahahahat!"],
      () => shots.soles(), () => S.wait(1.6), () => S.mark('first'),
      () => shots.door(),
      ['a1', 8, "Uhhh ...\nSomeone's having fun"],
      () => { bou.expr('happy'); S.emote(bou.obj, 'heart', 1.0); },
      ['bo', 6, "ohhh!!!\nI feel like I'm always late to the party!"],
    ]);
    // Elora stops and stands up
    stage('still'); fwE.done(); ELORA_DOWN = false; elora.clip('Idle', 0.45); elora.face(yawTo(elora.obj.position, anne.position)); elora.expr('angry');
    shots.wide(); await S.wait(0.7);
    await lines([
      () => shots.elora(),
      ['el', 4, "Not now!! I'm busy!\nWho's it?"],
      () => shots.anne(),
      ['a1', 31, 'Hello ...\nmmmhhhh ...', { expr: 'worried' }],
      ['a1', 8, 'Captain ... vice ...'],
      ['a1', 9, '... commander\n... Elirka??', { expr: 'worried' }],
      () => { shots.elora(); S.emote(elora.obj, 'anger', 1.0); },
      ['el', 6, 'VICE CAPTAIN ELORA!!!!!'],
      ['el', 4, "I'M BUSY!!\nWho are you, and what do you want?"],
      () => shots.anne(),
      ['a1', 6, "Oh... Sorry ...\nI hope I'm not causing much trouble to you,\nVice Captain...\nYour subordinate told me to meet you here.", { expr: 'worried' }],
    ]);
    S.cam.set(V3(CX + 3.0, 1.9, 10.2), V3(CX, 1.0, 6.2), { fov: 46, cut: true });
    const w = S.walk([UP2], { speed: 1.3 }); bou.walk(null, V3(UP2.x + 1.15, 0, UP2.z + 0.55), PI, 1.3); await w; S.clip('Idle', 0.25); await S.turnTo(elora.obj.position, 0.2);
    elora.face(yawTo(elora.obj.position, anne.position));
    await lines([
      () => S.cam.two(anne, elora.obj, { dist: 1.9, y: 1.4, side: 1 }),
      ['a1', 0, "Let me introduce myself!\nI'm an assistant from the Council of Magic."],
      ['el', 5, "What's the business of the Council of Magic\nin the south lands?"],
      ['a1', 0, "A thief stole something from the council,\nand I've been tasked with tracking it down.\nI was told the person you're interrogating\nmay be the individual I'm looking for."],
      () => shots.elora(),
      ['el', 5, "Well, even if she is, I still have my job to do.\nAll of her equipment has been confiscated and will\nneed to be processed, so you're going to need\nto wait."],
      () => shots.anne(),
      ['a1', 0, "I know, but I just need that document back,\ncaptain ... it's an emergency"],
      ['a1', 3, 'May I get that book back?'],
      ['a1', 41, '... Pretty please ...', { expr: 'smile', blush: 0.3 }],
      () => shots.elora(),
      ['el', 7, "We've got no time now, Anne!"],
      () => shots.bou(),
      ['bo', 10, 'We totally understand you\'re busy, Vice Captain.\nAlthough you look like you could use a hand'],
      () => shots.anne(),
      ['a1', 7, 'what? .....', { expr: 'surprised' }],
    ]);
    // ---------- Boudicca has seen the soles ----------
    await S.mark('soles');
    const BESIDE = V3(SEAT.x - 1.25, 0, SEAT.z + 2.35); let BW = null;
    await lines([
      () => { stage('still'); shots.thief(); },
      ['au', 4, 'YOU!!!\nWHAT ARE YOU LOOKING AT?'],
      () => { shots.soles(); BW = bou.walk(null, BESIDE, yawTo(BESIDE, V3(SEAT.x, 0, SEAT.z + 1.0)), 1.2); },
      ['bo', 10, 'Wow.. watch how soft and slender they look...'],
      () => shots.thief(),
      ['au', 6, 'GET LOST!'],
      () => BW,                                        // (she is beside the stocks before the picture goes to her)
      () => shots.bou(),
      ['bo', 9, "Just look at those huge smooth footsies!!\nYou'll need some help to care of them both at once!"],
      () => shots.elora(),
      ['el', 4, "Ask to the officials after I'm done here\nwith this suspect, I'm busy now, outsider!"],
      () => { shots.pair(); elora.face(yawTo(elora.obj.position, bou.obj.position)); bou.face(yawTo(bou.obj.position, elora.obj.position)); },
      ['bo', 10, "Please, Vice Captain.\nI've got skill with this!\nWe may work together!"],
      ['el', 5, "No, I don't need help!"],
      () => shots.anne(),
      ['a2', 3, 'what are you doing, Boudicca!!!', { expr: 'shocked' }],
      () => shots.pair(),
      ['bo', 9, 'come on!!\nyou may take a break and just look and enjoy!\nyou look tired after a though day of work, captain!'],
      () => S.emote(elora.obj, 'anger', 0.9),
      ['el', 6, "NO, I'M NOT!!\nAND I LOVE MY WORK!!!"],
      ['bo', 9, 'but...\njust a while!!'],
      ['el', 4, 'no!!'],
      ['bo', 9, 'come on!!'],
      ['el', 6, 'NO!!'],
      () => shots.anne(),
      ['a2', 3, 'what the ...', { expr: 'tired' }],
      () => shots.pair(),
      ['bo', 9, 'COME ON!!!'],
      ['el', 4, 'NO WAY!!'],
      () => { shots.bou(); S.emote(bou.obj, 'idea', 1.0); },
      ['bo', 8, 'May I challenge you, Vice Captain Elora,\nto drive this girl crazy by tickling!'],
      ['am', 4, 'yeahh!! good girl!!'],
      ['bo', 8, 'The first one who submits her WINS!!'],
      () => { shots.elora(); S.emote(elora.obj, 'dots', 1.1); },
      ['el', 7, 'hmmmm ....'],
      () => shots.pair(),
      ['bo', 8, 'JUST ONE FOOT EACH!!'],
      ['el', 5, 'DEAL!'],
      () => S.emote(bou.obj, 'music', 1.0),
      ['bo', 11, 'YAY!!!'],
      ['am', 4, 'YOHOO!!!'],
      () => shots.anne(),
      ['a2', 36, 'here we go again ....', { expr: 'tired' }],
      () => { stage('dread'); shots.thief(); S.emote(aur.obj, 'exclaim', 0.9); },
      ['au', 7, 'WHAT?????!!!'],
    ]);
    // ---------- one foot each ----------
    await S.fade(1, 0.35);
    kneelE(); kneelB(); stage('still'); if (env.music) env.music('town3.mp3');
    S.place(V3(CX + 2.5, 0, 7.3), yawTo(V3(CX + 2.5, 0, 7.3), V3(SEAT.x, 0, SEAT.z + 1.0))); S.clip('Idle', 0);      // (the two who watch stand to the east, out of the pictures of the stocks)
    mia.show(V3(CX + 3.5, 0, 7.9), yawTo(V3(CX + 3.5, 0, 7.9), V3(SEAT.x, 0, SEAT.z + 1.0))); mia.expr('smile');
    for (let i = 0; i < 4; i++) await S.frame();
    shots.wide(); await S.fade(0, 0.5); await S.mark('each');
    await lines([
      () => shots.elora(),
      ['el', 4, 'The rules are clear:\n"show no mercy to those that break our laws\nand endanger our people".'],
      () => { stage('both'); shots.soles(); },
      () => S.wait(1.8), () => S.mark('fingers'),
      () => shots.bou(),
      ['bo', 18, "Yeah, I've got it!\nTICKLE HER TO TEARS!!"],
      () => shots.thief(), () => S.wait(1.6),
      () => shots.door(),
      ['mi', 0, "I bet she does...\nI guess just be happy the captain didn't\nmake me use the toe ties and brushes like\nlast time."],
      ['a1', 8, 'Whait ... is the interrogation about ...', { expr: 'surprised' }],
      ['mi', 2, "Yeah.\nShe's so good at tickling it's scary,\nso don't let her quiet and gentle demeanor\nfool you."],
      ['mi', 3, "She may act like she doesn't like it,\nbut most guards that have been tickled by\nher think she secretly has a sadistic side."],
      () => { stage('hard'); shots.solesL(); }, () => S.wait(1.6),
      () => shots.bou(),
      ['bo', 18, 'Here I go again with my golden fingers!!'],
      () => shots.elora(),
      ['el', 0, "I wanted to let you know that we're\nonly about 1/3 of the way through\ntoday's session."],
      () => { shots.thief(); },
      ['au', 10, "HAHAHAHH HAHAHAH HOHOHOH!!!\nYOU FO-HOHOOL!!! YOU'RE WASTING YOUR TIME!!!!!!"],
      () => shots.over(), () => S.wait(1.4), () => S.mark('over'),
      () => shots.bou(),
      ['bo', 17, "ohh great!!\na tough one!! let's make her last!!"],
      () => shots.elora(),
      ['el', 1, "You know?\nIt's time to get the brush!"],
      ['bo', 18, 'Dreams come true!'],
    ]);
    // ---------- the brush ----------
    await S.fade(1, 0.3); stage('brush'); await S.wait(0.5); shots.soles(); await S.fade(0, 0.35); await S.mark('brush');
    await S.wait(1.6); shots.solesR(); await S.wait(1.6); shots.thief(); await S.wait(1.3);
    await lines([
      () => shots.elora(),
      ['el', 4, "Hey! Aren't you going to keep your toes quiet?"],
      ['el', 7, 'You will force me to use the ties!!'],
      () => { shots.bou(); S.emote(bou.obj, 'exclaim', 0.9); },
      ['bo', 16, 'OHHHH!!!  ... Toe ties ???'],
      ['bo', 17, 'YES, PLEASE ...'],
    ]);
    // ---------- the toe ties ----------
    await S.fade(1, 0.3); stage('ties'); await S.wait(0.8); shots.soles(); await S.fade(0, 0.35); await S.mark('ties');
    await S.wait(1.8); shots.solesL(); await S.wait(1.5);
    await lines([
      () => shots.bou(),
      ['bo', 9, "How's our prisoner going?\nhave you got enough, thief?"],
      () => shots.elora(),
      ['el', 3, 'JUST SURRENDER!!'],
      () => shots.thief(),
      ['au', 11, 'NEEVER NEEEVEEER HHAHAHAH\nOHW -- WHAHAHAHAHAHA'],
      () => shots.soles(), () => S.wait(1.8),
      () => shots.elora(),
      ['el', 2, 'Wiggly toes, huh??\nNot any more!'],
      ['bo', 0, 'YEAHH!!'],
      () => shots.over(), () => S.wait(1.6),
      () => shots.elora(),
      ['el', 1, 'Is the brush enough for you, thief?'],
      () => shots.thief(),
      ['au', 11, "YES PLEEEASSSHEHE SSTOP STTOP SSTTOOPPPP!!\nENOUGH -ENOUG HHAHHAHAHAAHAHAHAHAH!!\nI'LL NEVER COME BACK AHAHHAHAH!!!"],
      () => S.mark('confess'), () => S.wait(1.0),
    ]);
    // ---------- the confession ----------
    await S.fade(1, 0.5); S.voiceLoop(null); stage('spent'); TIES.set(false);
    fwE.done(); fwB.done(); ELORA_DOWN = BOU_DOWN = false; STAGED = false;
    const EL2 = V3(SEAT.x + 1.15, 0, SEAT.z + 2.0), BO2 = V3(SEAT.x - 1.2, 0, SEAT.z + 2.2);
    elora.show(EL2, yawTo(EL2, V3(SEAT.x, 0, SEAT.z))); bou.show(BO2, yawTo(BO2, EL2)); bou.follow(null);
    if (env.music) env.music(null);
    S.place(UP2, PI); S.clip('Idle', 0); mia.show(MIA_AT, yawTo(MIA_AT, V3(CX, 0, 4.6)));
    for (let i = 0; i < 3; i++) await S.frame();
    shots.wide(); await S.fade(0, 0.6);
    await lines([
      () => shots.elora(),
      ['el', 3, "This is it!\nwe've got your confession, outsider!"],
      () => shots.bou(),
      ['bo', 12, 'oh pity... is the fun over then?'],
      () => { elora.face(yawTo(EL2, V3(SEAT.x, 0, SEAT.z))); shots.thief(); },
      ['el', 2, "Know you'll be under arrest and come back\nhere if you ever step a foot again in our city,\nmugger!"],
      () => { elora.face(yawTo(EL2, anne.position)); shots.anne(); },
      ['a1', 10, 'GREAT!! so, we may get the Grimmoire back,\nthen, vice-captain?'],
      () => shots.elora(),
      ['el', 0, 'Yes, check out her bag on the table.'],
    ]);
    shots.table();
    await S.walk([V3(TABLE.x + 1.05, 0, TABLE.z + 0.25)], { speed: 1.4 }); await S.turnTo(TABLE, 0.2); S.clip('Idle', 0.2);
    book.visible = true; sparks.burst(V3(book.position.x, 1.0, book.position.z), GOLD, 22, 1.2, 0.9); S.se('se_Item1', 0.9);
    await say('a1', 3, 'Lovely!', { expr: 'happy' });
    // (all of it in one go, so that a game closed here is not paid twice: the book, the chapter's progress, the gold)
    const gold = S.state.flags.stolenGold ?? 60;      // (a game saved before the amount was kept: what she set out with)
    S.state.flags.stolenGold = 0; S.flag('grimmoireStolen', false); S.flag('grimmoire', true); S.objective('The Grimmoire is back. Step outside.'); S.progress = 130;
    if (gold > 0) S.counts(S.state.herbs, S.state.coins + gold);
    S.toast('Grimmoire of Conjuration: recovered!', 'success', 2.8); await S.wait(0.9);
    if (gold > 0) { S.se('se_Coin', 0.9); S.toast(`Anne has recovered ${gold} stolen gold`, 'success', 2.6); await S.wait(0.8); }
    await S.wait(0.6); await S.fade(1, 0.7);
    S.go('valyndra', [19, 11], 'east');
  }

  // =====================================================================================================
  //                                        afterwards: the room as it is left
  // =====================================================================================================
  async function after() {
    S.setFade(1); S.clip('Idle', 0);
    if (await seatHer()) { stage('spent'); TIES.set(false); AUR.face = null; aur.expr('tired', 0.3); }
    const EL2 = V3(SEAT.x + 1.15, 0, SEAT.z + 2.0); elora.show(EL2, PI * 0.9); elora.expr('neutral'); mia.show(MIA_AT, 0.3);
    S.block('eloraA', EL2.x, EL2.z, 0.45); S.block('miaA', MIA_AT.x, MIA_AT.z, 0.45);
    if (S.flag('boudicca')) { bou.show(V3(anne.position.x + 1.1, 0, anne.position.z + 0.4), PI); bou.follow(() => anne.position, 1.4, 1.4); S.party = { boudicca: bou }; }
    S.cam.behind(anne, { cut: true, dist: 4.2 }); await S.fade(0, 0.6);
  }
  S.on({ id: 'eloraAfter', at: V3(SEAT.x + 1.15, 0, SEAT.z + 2.0), r: 1.5, action: 'E — talk to Elora', when: () => S.progress >= 130, run: async () => {
    shots.elora(); await say('el', 4, "You've got what you need, outsider.\nNow leave, this is a restricted area."); } });
  S.on({ id: 'aureliaAfter', at: V3(SEAT.x, 0, SEAT.z + 1.6), r: 1.2, action: 'E — look at the prisoner', when: () => S.progress >= 130, run: async () => {
    shots.soles(); await say('a1', 3, 'I feel tempted ...', { expr: 'smug' }); shots.elora(); await say('el', 5, 'Leave the prisoner alone, outsider!'); shots.anne(); await say('a2', 36, 'Dammit', { expr: 'pout' }); } });
  S.on({ id: 'miaAfter', at: MIA_AT, r: 1.4, action: 'E — talk to Mia', when: () => S.progress >= 130, run: async () => {
    shots.door(); await say('mi', 1, 'What are you doing here, outsider?\nThis is a restricted area, don\'t you know?'); await say('a2', 21, "Okay okay ... I'm leaving...", { expr: 'tired' }); } });
  S.hint = async () => { await S.say('am', 0, S.progress < 130 ? 'The guard told us the thief is being\nheld in the city barracks...' : 'We have the book. Out, before the\nVice-Captain finds a pair of stocks for US.'); };
  S.onArrive = () => { C.checkpoint(); if (S.progress < 130) S.run(interrogation); else S.run(after); };
  if (typeof window !== 'undefined') window.__bar = { aur, elora, bou, mia, shots, stage, get fwE() { return fwE; }, get fwB() { return fwB; }, get aFeet() { return aFeet; }, get ties() { return TIES; }, get stocks() { return STOCKS; } };
}
