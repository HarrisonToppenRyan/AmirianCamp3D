// story_valyndra.js: Valyndra City, the square inside the south gate (the 2D game's Map 1 "ValyndraCity", 90x60: only the
// part Chapter 2 plays in is built). A set (level.interior): the city wall with its gate and two towers, the guard house
// door in the wall east of the gate, house fronts round a cobbled square, a well, two market stalls.
//   - the walls ("Oh wow, those walls are quite impressive!": the 2D says it on the world map, here it is said in the gate)
//   - the gate guard (Map001 event 1 "GateGuard" page 1): she sends them to Vice-Captain Elora in the guard house
//   - after the interrogation (page 3): what next; the Velvet Rug; the chapter's end
// Lines are the 2D's own. The rest of the city (the market, the Velvet Rug, the castle) is not built: the street north
// says so.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);
const { createGuard, FACES } = await import('./cast2.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, V3 } = S, C = common(S);
  const PI = Math.PI, post = env.post, T = 1.6, tc = (x, y) => S.tileC(x, y);
  if (post && post.setGrade) post.setGrade(1.06, 1.0, 0.94, 0.06, 1.02);

  // =====================================================================================================
  //                                                 the square
  // =====================================================================================================
  // (each picture is drawn once, by `key`; every use of it is a clone with its own repeat: one upload, however many walls)
  const DRAWN = {};
  const tex = (w, h, draw, rx = 1, ry = 1, key = null) => {
    let base = key && DRAWN[key];
    if (!base) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); base = new THREE.CanvasTexture(cv); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8; base.wrapS = base.wrapT = THREE.RepeatWrapping; if (key) DRAWN[key] = base; }
    const t = key ? base.clone() : base; t.repeat.set(rx, ry); t.needsUpdate = true; return t;
  };
  let seed = 23; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cobble = (rx, ry) => tex(512, 512, (x, w, h) => { x.fillStyle = '#6b655c'; x.fillRect(0, 0, w, h); for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) { const l = 128 + rnd() * 50, ox = (r % 2) * 25; x.fillStyle = `rgb(${l + 8},${l + 3},${l - 8})`; x.beginPath(); x.ellipse(c * 51.2 + ox + 24, r * 51.2 + 25, 21 + rnd() * 3, 20 + rnd() * 3, 0, 0, PI * 2); x.fill(); } }, rx, ry, 'cobble');
  const ashlar = (rx, ry) => tex(512, 512, (x, w, h) => { x.fillStyle = '#8f8c86'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const o = (r % 2) * 64, l = 186 + rnd() * 34; x.fillStyle = `rgb(${l},${l - 2},${l - 10})`; x.fillRect(c * 128 + o - 64 + 3, r * 64 + 3, 122, 58); x.fillRect(c * 128 + o - 64 + 512 + 3, r * 64 + 3, 122, 58); } }, rx, ry, 'ashlar');
  const plaster = (col, rx = 1, ry = 1) => tex(256, 256, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + rnd() * 0.035})`; x.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 22, 2 + rnd() * 5); } }, rx, ry, 'plaster' + col);
  const roofT = (col) => tex(256, 256, (x, w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.16})`; x.beginPath(); x.arc(c * 32 + (r % 2) * 16 + 16, r * 32 + 4, 15, 0, PI); x.fill(); } }, 4, 2, 'roof' + col);
  const town = new THREE.Group(); scene.add(town);
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mat = { stone: M({ map: ashlar(1, 1), roughness: 0.9 }), dark: M({ color: 0x3a2a1c, roughness: 0.85 }), beam: M({ color: 0x4a3524, roughness: 0.85 }), iron: M({ color: 0x33353a, roughness: 0.5, metalness: 0.7 }),
    glass: M({ color: 0x5a7a96, roughness: 0.25, metalness: 0.3, emissive: 0x16222c }), blue: M({ color: 0x1c3f9a, roughness: 0.7, side: THREE.DoubleSide }), gold: M({ color: 0xc99a2e, roughness: 0.4, metalness: 0.6 }), wood: M({ color: 0x8a6238, roughness: 0.8 }) };
  const box = (w, h, d, m, x, y, z, ry = 0, sh = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = sh; b.receiveShadow = true; town.add(b); return b; };
  const stoneM = (w, h) => { const m = mat.stone.clone(); m.map = ashlar(w / 3.2, h / 3.2); return m; };
  // the ground: cobbles everywhere (the street north, the gate's passage, a strip of road outside the gate)
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), M({ map: cobble(26, 20), roughness: 0.95 })); f.rotation.x = -PI / 2; f.position.set(20.8, 0, 12.8); f.receiveShadow = true; town.add(f);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 26), M({ color: 0x8a7a62, roughness: 1 })); road.rotation.x = -PI / 2; road.position.set(20.0, 0.004, 37); town.add(road);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), M({ color: 0x5c8a3a, roughness: 1 })); grass.rotation.x = -PI / 2; grass.position.set(20.8, 0.002, 41.5); town.add(grass); }
  // ---------- the south wall: 8 m high, 4.8 m thick, the gate's arch in it, crenels, two round towers, banners ----------
  const WZ = 20.8, WH = 8.2, WT = 4.8, GX0 = 17.6, GX1 = 22.4, GH = 4.6;
  const wallSeg = (x0, x1) => { box(x1 - x0, WH, WT, stoneM(x1 - x0, WH), (x0 + x1) / 2, WH / 2, WZ + WT / 2);
    for (let x = x0 + 0.6; x < x1 - 0.5; x += 1.6) { box(0.9, 0.8, 0.5, mat.stone, x, WH + 0.4, WZ + 0.25, 0, false); box(0.9, 0.8, 0.5, mat.stone, x, WH + 0.4, WZ + WT - 0.25, 0, false); } };
  // (the east part has the guard house's doorway in it: tile 18,13)
  const DX0 = 28.8, DX1 = 30.4, DH = 2.7;
  wallSeg(-8, GX0); wallSeg(GX1, DX0); wallSeg(DX1, 50);
  box(DX1 - DX0, WH - DH, WT, stoneM(1.6, WH - DH), (DX0 + DX1) / 2, DH + (WH - DH) / 2, WZ + WT / 2); box(DX1 - DX0, DH, WT - 1.7, mat.dark, (DX0 + DX1) / 2, DH / 2, WZ + 1.7 + (WT - 1.7) / 2, 0, false);
  // over the gate: the lintel block and a round arch under it
  box(GX1 - GX0, WH - GH, WT, stoneM(4.8, WH - GH), (GX0 + GX1) / 2, GH + (WH - GH) / 2, WZ + WT / 2);
  { const sh = new THREE.Shape(); sh.moveTo(-2.4, 0); sh.lineTo(2.4, 0); sh.lineTo(2.4, 0.01); sh.absarc(0, 0, 2.4, 0, PI, false); sh.lineTo(-2.4, 0);
    const hole = new THREE.Path(); hole.absarc(0, 0, 2.0, 0, PI, false); hole.lineTo(-2.0, 0); sh.holes.push(hole);
    for (const z of [WZ - 0.12, WZ + WT - 0.1]) { const a = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 20 }), M({ color: 0xbdb8ae, roughness: 0.9 })); a.position.set(20.0, GH - 2.0, z); a.castShadow = true; town.add(a); }
    for (const z of [WZ - 0.02, WZ + WT + 0.02]) for (const sx of [-1, 1]) { const g = new THREE.Shape(); g.moveTo(sx * 2.4, 0); g.lineTo(sx * 2.4, 2.4); g.absarc(0, 0, 2.4, sx > 0 ? 0 : PI, PI / 2, sx > 0 ? false : true); g.lineTo(0, 2.4); g.lineTo(sx * 2.4, 2.4);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(g, 12), mat.stone); m.position.set(20.0, GH - 2.4, z); if (z > WZ + 1) m.rotation.y = PI; town.add(m); } }
  for (const tx of [GX0 - 1.5, GX1 + 1.5]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, WH + 2.6, 20), stoneM(13, WH + 2.6)); t.position.set(tx, (WH + 2.6) / 2, WZ + 1.0); t.castShadow = t.receiveShadow = true; town.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 20), M({ map: roofT('#2c4a9a'), roughness: 0.8 })); cap.position.set(tx, WH + 2.6 + 1.7, WZ + 1.0); cap.castShadow = true; town.add(cap);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.5, 20), mat.stone); ring.position.set(tx, WH + 2.4, WZ + 1.0); town.add(ring);
    for (const y of [3.6, 6.6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.1), M({ color: 0x14161c, roughness: 1 })); w.position.set(tx, y, WZ + 1.0 - 2.22); w.rotation.y = PI; town.add(w); }
    S.block('tower' + tx, tx, WZ + 1.0, 2.35); }      // (the towers stand a little way into the square and into the gate's passage)
  const banners = [];
  for (const bx of [GX0 + 0.55, GX1 - 0.55, 11.5, 34.5]) { const g = new THREE.Group(); g.position.set(bx, 6.6, WZ - 0.16); town.add(g);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat.gold); rod.rotation.z = PI / 2; g.add(rod);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.6, 4, 8), mat.blue); cl.position.y = -1.34; cl.castShadow = true; g.add(cl); banners.push(cl);
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.26, 5), M({ color: 0xf2efe6, roughness: 0.8 })); em.position.set(0, -1.1, 0.012); em.rotation.z = PI / 2 * 0.2; g.add(em); }
  // the portcullis, drawn up into the arch
  for (let i = 0; i <= 8; i++) box(0.07, 1.2, 0.07, mat.iron, GX0 + 0.4 + i * 0.5, GH - 0.3, WZ + 0.6, 0, false);
  box(GX1 - GX0 - 0.6, 0.08, 0.08, mat.iron, 20.0, GH - 0.85, WZ + 0.6, 0, false);
  // the guard house door (open), its lantern and its sign: crossed swords on a blue shield
  box(0.14, DH + 0.1, 0.24, mat.beam, DX0 - 0.02, DH / 2, WZ - 0.02); box(0.14, DH + 0.1, 0.24, mat.beam, DX1 + 0.02, DH / 2, WZ - 0.02); box(DX1 - DX0 + 0.3, 0.18, 0.26, mat.beam, (DX0 + DX1) / 2, DH + 0.09, WZ - 0.02);
  box(1.45, 2.5, 0.07, mat.wood, DX1 + 0.02 + Math.cos(1.29) * 0.725, 1.25, WZ - 0.04 - Math.sin(1.29) * 0.725, 1.29, false);      // (hinged on the east post, open into the square)
  { const g = new THREE.Group(); g.position.set((DX0 + DX1) / 2, 3.55, WZ - 0.1); town.add(g);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 6), M({ color: 0x1c3f9a, roughness: 0.6 })); sh.rotation.x = PI / 2; g.add(sh);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.02), M({ color: 0xd8dce4, roughness: 0.3, metalness: 0.8 })); b.rotation.z = s * 0.7; b.position.z = -0.04; g.add(b); } }
  const lamps = [];
  const lamp = (x, y, z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.15, 0.6), toneMapped: false })); l.position.set(x, y, z); town.add(l); box(0.26, 0.05, 0.26, mat.iron, x, y + 0.18, z, 0, false); lamps.push(l); };
  lamp(DX0 - 0.45, 2.5, WZ - 0.25); lamp(GX0 - 0.1, 3.1, WZ - 2.2); lamp(GX1 + 0.1, 3.1, WZ - 2.2);
  // the infirmary's door further east (shut), with its sign: a white cross
  { const x = 36.0; box(1.5, 2.5, 0.1, mat.wood, x, 1.25, WZ - 0.03, 0, false); box(1.8, 0.18, 0.2, mat.beam, x, 2.6, WZ - 0.02); for (const s of [-1, 1]) box(0.14, 2.6, 0.2, mat.beam, x + s * 0.83, 1.3, WZ - 0.02);
    const g = new THREE.Group(); g.position.set(x, 3.3, WZ - 0.08); town.add(g); const d = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), M({ color: 0xa02a2a, roughness: 0.7 })); d.rotation.y = PI; g.add(d);
    for (const r of [0, PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.02), M({ color: 0xf2efe6 })); b.rotation.z = r; b.position.z = -0.02; g.add(b); } }
  // ---------- houses: a plastered front with dark beams, windows, a door, a tiled roof ----------
  const PLAST = ['#e9dfc8', '#e4d2b0', '#d8cdb8', '#ecd9c0', '#dccfae'], ROOF = ['#9a3c2a', '#8a4a30', '#7a3a3a', '#a04a2c'];
  function house(x0, x1, zFront, depth, h, o = {}) {
    // (its front faces +Z unless o.face: 'e' = faces +X, 'w' = faces -X)
    const g = new THREE.Group(); town.add(g);
    const w = x1 - x0, pm = M({ map: plaster(PLAST[Math.floor(rnd() * PLAST.length)], w / 3, h / 3), roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), pm); body.position.set(0, h / 2, -depth / 2); body.castShadow = body.receiveShadow = true; g.add(body);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.9, depth + 0.06), stoneM(w, 0.9)); base.position.set(0, 0.45, -depth / 2); g.add(base);
    const bm = (bw, bh, x, y, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), mat.beam); b.position.set(x, y, 0.03); b.rotation.z = rz; g.add(b); };
    const floors = Math.max(1, Math.round((h - 0.9) / 2.7));
    for (let f = 0; f <= floors; f++) bm(w, 0.16, 0, 0.9 + (h - 0.9) * f / floors);
    const bays = Math.max(2, Math.round(w / 2.6));
    for (let b = 0; b <= bays; b++) bm(0.16, h - 0.9, -w / 2 + w * b / bays, 0.9 + (h - 0.9) / 2);
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
      const cx = -w / 2 + w * (b + 0.5) / bays, cy = 0.9 + (h - 0.9) * (f + 0.5) / floors, isDoor = f === 0 && b === (o.door === undefined ? Math.floor(bays / 2) : o.door);
      if (isDoor) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), mat.wood); d.position.set(cx, 1.05, 0.05); g.add(d); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat.gold); kn.position.set(cx + 0.36, 1.05, 0.11); g.add(kn); continue; }
      if (rnd() < 0.2 && f > 0) { bm(0.12, (h - 0.9) / floors * 1.25, cx, cy, 0.6); continue; }      // (a brace instead of a window)
      const wn = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.06), mat.glass); wn.position.set(cx, cy + 0.05, 0.03); g.add(wn);
      bm(1.1, 0.08, cx, cy + 0.05 + 0.6); bm(1.1, 0.1, cx, cy + 0.05 - 0.6); bm(0.06, 1.15, cx, cy + 0.05); bm(0.08, 1.2, cx - 0.5, cy + 0.05); bm(0.08, 1.2, cx + 0.5, cy + 0.05);
      if (f > 0 && rnd() < 0.55) { const fb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.2), mat.beam); fb.position.set(cx, cy - 0.66, 0.12); g.add(fb);
        for (let k = 0; k < 5; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), M({ color: [0xd84a6a, 0xe8b030, 0xf0f0f0, 0x9a5ad0][Math.floor(rnd() * 4)], roughness: 0.8 })); fl.position.set(cx - 0.4 + k * 0.2, cy - 0.53, 0.14); g.add(fl); } }
    }
    // the roof: a prism with its ridge along the front
    const rh = 1.5 + w * 0.06, rs = new THREE.Shape(); rs.moveTo(-depth / 2 - 0.4, 0); rs.lineTo(depth / 2 + 0.4, 0); rs.lineTo(0, rh); rs.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: w + 0.6, bevelEnabled: false }), M({ map: roofT(ROOF[Math.floor(rnd() * ROOF.length)]), roughness: 0.85 })); roof.rotation.y = PI / 2; roof.position.set(-w / 2 - 0.3, h, -depth / 2); roof.castShadow = true; g.add(roof);
    if (rnd() < 0.7) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), mat.stone); ch.position.set(w * (rnd() - 0.5) * 0.6, h + rh * 0.6, -depth / 2 - 0.5); ch.castShadow = true; g.add(ch); }
    g.position.set((x0 + x1) / 2, 0, zFront); if (o.face === 'e') { g.rotation.y = PI / 2; g.position.set(zFront, 0, (x0 + x1) / 2); } if (o.face === 'w') { g.rotation.y = -PI / 2; g.position.set(zFront, 0, (x0 + x1) / 2); }
    return g;
  }
  // north side (their fronts on the square's north edge, z = 8), either side of the street; the square's ends; the street's sides
  house(3.2, 9.2, 8.0, 6.5, 6.3); house(9.2, 13.4, 8.0, 6.5, 8.6); house(13.4, 17.6, 8.0, 6.5, 6.0);
  house(22.4, 27.6, 8.0, 6.5, 8.8); house(27.6, 33.0, 8.0, 6.5, 6.2); house(33.0, 38.4, 8.0, 6.5, 7.6);
  house(8.0, 14.4, 3.2, 6, 7.0, { face: 'e' }); house(14.4, 20.8, 3.2, 6, 6.2, { face: 'e' });       // the west end
  house(8.0, 14.4, 38.4, 6, 6.6, { face: 'w' }); house(14.4, 20.8, 38.4, 6, 7.8, { face: 'w' });     // the east end
  house(-6, 1.6, 17.6, 5, 6.4, { face: 'e', door: 9 }); house(-6, 1.6, 22.4, 5, 7.2, { face: 'w', door: 9 });      // the street north, its two sides (seen end on)
  // far down the street: more roofs, and WhiteHall Castle over them
  { const far = M({ color: 0xcfd6e2, roughness: 1 });
    for (const [x, z, w, h] of [[12, -14, 9, 9], [28, -15, 10, 10], [20, -22, 14, 8]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), M({ map: plaster('#ddd3bd', 3, 3), roughness: 1 })); b.position.set(x, h / 2, z); town.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, 3.2, 4), M({ map: roofT('#8a4030'), roughness: 0.9 })); r.rotation.y = PI / 4; r.position.set(x, h + 1.6, z); town.add(r); }
    const keep = new THREE.Mesh(new THREE.BoxGeometry(16, 26, 10), far); keep.position.set(20, 13, -48); town.add(keep);
    for (const [x, hh] of [[11, 34], [29, 34], [20, 42]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, hh, 14), far); t.position.set(x, hh / 2, -46); town.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(3.3, 7, 14), M({ color: 0x3c5aa8, roughness: 0.8 })); c.position.set(x, hh + 3.5, -46); town.add(c); } }
  // ---------- in the square: a well, two market stalls, barrels and crates, a cart across the street north ----------
  const WELL = V3(10.4, 0, 14.6);
  { const g = new THREE.Group(); g.position.copy(WELL); town.add(g);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.85, 20, 1, true), M({ map: ashlar(3, 0.5), roughness: 0.9, side: THREE.DoubleSide })); ring.position.y = 0.425; ring.castShadow = true; g.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.09, 8, 24), mat.stone); rim.rotation.x = PI / 2; rim.position.y = 0.86; g.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), M({ color: 0x1c3a4a, roughness: 0.15, metalness: 0.4 })); water.rotation.x = -PI / 2; water.position.y = 0.5; g.add(water);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), mat.beam); p.position.set(s * 0.95, 1.15, 0); p.castShadow = true; g.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), mat.beam); bar.rotation.z = PI / 2; bar.position.y = 2.0; g.add(bar);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), M({ map: roofT('#8a4030'), roughness: 0.85 })); rf.rotation.y = PI / 4; rf.position.y = 2.75; rf.castShadow = true; g.add(rf);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 10), mat.wood); bucket.position.set(0.2, 1.2, 0); g.add(bucket); const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), M({ color: 0xc9a868 })); rope.position.set(0.2, 1.67, 0); g.add(rope); }
  S.block('well', WELL.x, WELL.z, 1.3);
  const stall = (x, z, ry, cloth, goods) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; town.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.0), mat.wood); top.position.y = 0.9; top.castShadow = top.receiveShadow = true; g.add(top);
    for (const [dx, dz] of [[-1.1, -0.42], [1.1, -0.42], [-1.1, 0.42], [1.1, 0.42]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, dz < 0 ? 2.4 : 2.1, 0.08), mat.beam); l.position.set(dx, dz < 0 ? 1.2 : 1.05, dz); l.castShadow = true; g.add(l); }
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5, 9, 1), M({ color: cloth, roughness: 0.9, side: THREE.DoubleSide })); aw.rotation.x = -PI / 2 + 0.28; aw.position.set(0, 2.27, 0.0); aw.castShadow = true; g.add(aw);
    { const P = aw.geometry.attributes.position, colr = []; const c1 = new THREE.Color(cloth), c2 = new THREE.Color(0xf2ead8); for (let i = 0; i < P.count; i++) { const k = Math.floor((P.getX(i) + 1.35) / 0.3 + 0.01) % 2; const c = k ? c1 : c2; colr.push(c.r, c.g, c.b); } aw.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); aw.material.vertexColors = true; aw.material.color.set(0xffffff); }
    for (let i = 0; i < 9; i++) { const it = new THREE.Mesh(goods === 'fruit' ? new THREE.SphereGeometry(0.09, 8, 6) : new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8), M({ color: goods === 'fruit' ? [0xd03a2a, 0xe8a020, 0x7ab030][i % 3] : [0x6a8ad0, 0xb05a9a, 0x5aa07a][i % 3], roughness: 0.6 })); it.position.set(-0.95 + (i % 5) * 0.46 + (i > 4 ? 0.2 : 0), goods === 'fruit' ? 1.03 : 1.04, i > 4 ? 0.2 : -0.15); it.castShadow = true; g.add(it); } };
  stall(31.0, 11.0, 0, 0xb03a3a, 'fruit'); stall(35.2, 14.2, -PI / 2, 0x2f5fa8, 'jars');
  S.block('stall1', 31.0, 11.0, 1.35); S.block('stall2', 35.2, 14.2, 1.35);
  const barrel = (x, z, s = 1) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * s, 0.3 * s, 0.9 * s, 12), mat.wood); b.position.set(x, 0.45 * s, z); b.castShadow = b.receiveShadow = true; town.add(b); for (const y of [0.2, 0.7]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.335 * s, 0.018, 5, 16), mat.iron); h.rotation.x = PI / 2; h.position.set(x, y * s, z); town.add(h); } S.block('brl' + x + z, x, z, 0.45); };
  barrel(24.0, 19.6); barrel(24.8, 19.9, 0.85); barrel(15.6, 19.8); barrel(5.0, 9.2); barrel(5.8, 9.0, 0.8);
  for (const [x, z, s] of [[27.2, 19.9, 0.8], [26.3, 20.0, 0.6], [26.6, 20.0, 0.5], [6.0, 19.4, 0.9]]) { const c = box(s, s, s, mat.wood, x, s / 2, z, rnd()); if (z > 19.95 && s < 0.6) c.position.y = 0.6 + s / 2; else S.block('crate' + x, x, z, s * 0.75); }
  // the cart across the street north: the way into the rest of the city is not built
  const CART = V3(20.0, 0, 5.6);
  { const g = new THREE.Group(); g.position.copy(CART); g.rotation.y = 0.12; town.add(g);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.5), mat.wood); bed.position.y = 0.85; bed.castShadow = true; g.add(bed);
    for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.08), mat.wood); sd.position.set(0, 1.15, s * 0.72); g.add(sd);
      for (const x of [-1.1, 1.1]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 18), mat.beam); wh.position.set(x, 0.56, s * 0.85); g.add(wh); for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.05, 0.04), mat.beam); sp.rotation.z = k * PI / 4; sp.position.set(x, 0.56, s * 0.85); g.add(sp); } } }
    for (let i = 0; i < 5; i++) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), M({ color: 0xb9a070, roughness: 1 })); sk.scale.set(1.25, 0.8, 0.95); sk.position.set(-1.15 + i * 0.58, 1.2 + (i % 2) * 0.28, (i % 2) * 0.2 - 0.1); sk.castShadow = true; g.add(sk); } }
  S.block('cart', CART.x, CART.z, 2.3);
  S.actors.push({ update(dt, t) { banners.forEach((b, i) => { const P = b.geometry.attributes.position; for (let k = 0; k < P.count; k++) { const y = P.getY(k); P.setZ(k, 0.07 * Math.sin(t * 2.2 + y * 2.4 + i) * (1.3 - y) / 2.6); } P.needsUpdate = true; }); for (const l of lamps) l.scale.setScalar(1 + 0.04 * Math.sin(t * 9 + l.position.x)); } });

  // =====================================================================================================
  //                                                 who is here
  // =====================================================================================================
  const bou = createBoudicca(S, C), guard = createGuard(S, C);
  S.late.push((dt, t) => { bou.update(dt, t); guard.update(dt, t); });
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 9: 'happy', 13: 'surprised', 17: 'happy' };
  const say = async (sh, i, text, o = {}) => {
    const f = sh === 'bo' ? bou : sh === 'gu' ? guard : null;
    if (f && f.made) { f.expr(sh === 'bo' ? BO[i] || 'smile' : FACES.gu[i] || 'smile'); f.talk(true); }
    await S.say(sh, i, text, o);
    if (f && f.made) f.talk(false);
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const GUARD_AT = V3(18.6, 0, 15.0), IN_GATE = tc(12, 12);
  guard.show(GUARD_AT, 0.25); guard.expr('smile');
  S.block('guard', GUARD_AT.x, GUARD_AT.z, 0.5);
  const party = (dx = 1.2, dz = 0.5) => { if (!S.flag('boudicca')) return; bou.show(V3(anne.position.x + dx, 0, anne.position.z + dz), anne.rotation.y); bou.follow(() => anne.position, 1.4, 1.5); S.party = { boudicca: bou }; };

  // ---------- the walls, and the gate guard ----------
  async function arrival() {
    S.setFade(1); S.place(V3(IN_GATE.x - 0.5, 0, IN_GATE.z + 0.3), PI); S.clip('Idle', 0);
    bou.show(V3(IN_GATE.x + 0.75, 0, IN_GATE.z + 0.6), PI); bou.follow(null); bou.expr('smile');
    // from inside the square, low: the two of them small under the arch, the towers over them
    S.cam.set(V3(IN_GATE.x - 4.6, 1.0, IN_GATE.z - 9.5), V3(IN_GATE.x - 0.2, 5.4, IN_GATE.z + 2.0), { fov: 58, cut: true });
    await S.fade(0, 1.2); await S.mark('walls');
    await say('a1', 2, 'Oh wow, those walls are quite impressive!');
    S.cam.two(anne, bou.obj, { dist: 2.0, y: 1.4, side: -1, off: PI / 2 + 0.9 });
    await lines([
      ['bo', 0, 'Ah, is this your first time at Valyndra City,\nAnne?'],
      ['a1', 0, "Aye,\nI've never been this far south before."],
      ['bo', 0, 'It is the most powerful city on the mainland.\nThey say you can see all the way to Merril\nfrom the top of WhiteHall Castle.'],
    ]);
    S.progress = 115;
    // up into the square, to the guard
    S.cam.set(V3(GUARD_AT.x + 5.2, 2.3, GUARD_AT.z - 3.4), V3(GUARD_AT.x + 0.6, 1.1, GUARD_AT.z + 1.6), { fov: 46, rate: 1.6 });
    const A1 = V3(GUARD_AT.x + 0.9, 0, GUARD_AT.z + 1.9), B1 = V3(GUARD_AT.x + 2.1, 0, GUARD_AT.z + 2.4);
    const w = S.walk([A1], { speed: 1.4 }); bou.walk(null, B1, yawTo(B1, GUARD_AT), 1.4); await w; S.clip('Idle', 0.25); await S.turnTo(bou.obj.position, 0.2);
    await lines([
      () => S.cam.two(anne, bou.obj, { dist: 1.9, y: 1.4, side: 1 }),
      ['a1', 0, 'You seem to know a lot about this city,\nbeen here before I take it?'],
      ['bo', 1, 'Yes, I trained at the military academy for\na few years, before I came to the Tower.\nMan... I really missed this place!'],
      () => { S.turnTo(GUARD_AT, 0.25); bou.face(yawTo(B1, GUARD_AT)); guard.face(yawTo(GUARD_AT, A1)); S.cam.face(guard.obj, { dist: 1.9, y: 1.45, turn: 0.5, yaw: yawTo(GUARD_AT, A1) }); },
      () => S.mark('guard'),
      ['gu', 0, 'Hello, can you please state your business here?'],
      () => S.cam.face(bou.obj, { dist: 1.8, y: 1.45, turn: -0.5, yaw: yawTo(B1, GUARD_AT) }),
      ['bo', 0, "Of course, I'm a spellsword from the\nTower of Wisdom, here to assist\nAnne."],
      ['bo', 1, "We're tracking down a thief who stole\na dangerous artifact a few days ago."],
      () => S.cam.face(guard.obj, { dist: 1.9, y: 1.45, turn: 0.5, yaw: yawTo(GUARD_AT, A1) }),
      ['gu', 0, 'I see ...\nWell, welcome to Valyndra City, you two,\nand good luck with your search!'],
      () => S.cam.face(anne, { dist: 1.8, y: 1.45, turn: 0.5 }),
      ['a1', 0, "Thank you, we'll be sure to-"],
      () => { S.cam.face(guard.obj, { dist: 1.9, y: 1.45, turn: 0.5, yaw: yawTo(GUARD_AT, A1) }); S.emote(guard.obj, 'idea', 0.9); },
      ['gu', 0, "Hey, wait a second,\nI think we may have who you're looking for."],
      () => { S.cam.face(bou.obj, { dist: 1.8, y: 1.45, turn: -0.5, yaw: yawTo(B1, GUARD_AT) }); S.emote(bou.obj, 'exclaim', 0.9); },
      ['bo', 13, 'You do?'],
      () => S.cam.face(guard.obj, { dist: 1.9, y: 1.45, turn: 0.5, yaw: yawTo(GUARD_AT, A1) }),
      ['gu', 0, 'Yeah, my superiors are in the\nguard house barracks right now.\nWe grabbed a troublesome lady this\nmorning, threatening the people of this city'],
      ['gu', 0, 'You should meet my superior,\nVice-Captain Elora.\nShe may have all the info you need.'],
      () => S.cam.face(anne, { dist: 1.8, y: 1.45, turn: 0.5 }),
      ['a1', 0, 'Really appreciated!'],
      () => { guard.face(yawTo(GUARD_AT, V3(29.6, 0, 20.8))); S.cam.set(V3(GUARD_AT.x - 2.4, 2.0, GUARD_AT.z - 2.6), V3(27.5, 1.6, 20.6), { fov: 42, cut: true }); },
      ['gu', 0, 'Take the right street:\nthe guard house door, in the wall east of the gate.'],
      ['bo', 9, 'Excellent, thank you.'],
    ]);
    S.progress = 120; guard.face(0.25);
    S.toast('Quest: reach Valyndra City - done!', 'success', 2.4);
    S.objective('Meet Vice-Captain Elora: the guard house door is in the city wall, east of the gate.');
    party(); S.cam.behind(anne, { dist: 5 }); C.checkpoint(); console.log('CH2 guard done');
  }

  // ---------- back in the street: what next (the chapter's last scene) ----------
  async function whatNext() {
    S.setFade(1); const P0 = tc(19, 11), P1 = V3(P0.x + 4.6, 0, P0.z - 1.2);
    S.place(P0, PI / 2); S.clip('Idle', 0); bou.show(V3(P0.x - 1.1, 0, P0.z + 0.5), PI / 2); bou.follow(null); bou.expr('happy');
    S.cam.set(V3(P1.x + 2.2, 1.8, P1.z - 4.6), V3(P1.x - 1.4, 1.1, P1.z + 0.4), { fov: 44, cut: true });
    await S.fade(0, 0.9);
    const B1 = V3(P1.x - 1.25, 0, P1.z + 0.35);
    const w = S.walk([P1], { speed: 1.4 }); bou.walk(null, B1, yawTo(B1, P1), 1.4); await w; S.clip('Idle', 0.25); await S.turnTo(V3(P1.x - 0.2, 0, P1.z - 3), 0.25);
    await S.mark('street');
    const two = () => S.cam.two(anne, bou.obj, { dist: 2.0, y: 1.4, side: -1, off: PI / 2 - 0.3 });      // (from the square's side, a little past Boudicca's shoulder: Anne's face, not her back)
    await lines([
      two,
      ['bo', 17, 'Yeah!\nI really missed this city so much!'],
      ['a1', 22, 'That vice-captain gives me chills...'],
      ['bo', 1, 'I like her, though...'],
      () => S.turnTo(bou.obj.position, 0.2),
      ['a2', 6, "You're a bit of a tickle freak, ain't you?"],
      ['bo', 17, 'Ha ha!! What gave me away?'],
      ['a2', 36, "You're scaring me, M'am..."],
      ['bo', 3, "You're not from here, so you don't\nknow this but..."],
      () => S.emote(bou.obj, 'music', 1.0),
      ['bo', 2, "There's a pub close by where I used to go\nand play tickling games!\nThe Velvet Rug"],
      ['am', 5, "We definitely CAN'T leave THIS CITY\nWITHOUT PAYING A VISIT TO SUCH A PLACE!"],
      ['bo', 3, "Yeah!! pretty girls,\nticklish waitresses,\ngood wine... It's great!"],
      () => S.cam.face(anne, { dist: 1.8, y: 1.45, turn: 0.5 }),
      ['a1', 11, 'That sounds... interesting...'],
      ['a1', 9, "You know, now that we've arrived here,\nwe could attempt to find goods and new weapons."],
      ['am', 4, "Let's go to the Velvet Rug first!"],
      ['a1', 0, 'What if we go shopping?'],
      ['am', 4, 'Velvet Rug, Velvet Rug!!'],
      two,
      ['bo', 1, 'We could look for information too,\nI keep thinking we may need some more\npotential allies.\nMaybe a hireling to help us.'],
      ['am', 4, "YEAH!!\nLet's go to the Velvet Rug!"],
    ]);
    // (the next aim first, then the chapter's end: a game closed while the card is up has both)
    S.objective('Chapter 3 (not built yet): the Velvet Rug, and a boat to Amirian Island.'); S.progress = 140;
    S.toast('Quest complete: Recover the Grimmoire', 'success', 2.6); await S.wait(0.8);
    await S.fade(1, 1.0);
    await S.card('Chapter 2 - Dawn comes Slowly: complete', 'The thief is banned from the city,\nand the Grimmoire of Conjuration is ours again.\n\nNext: allies, a boat from Dawn Harbor to Amirian Island...\nand, if Amaymon and Boudicca have their way,\nthe Velvet Rug.\n\n(To be continued: Chapter 3 is not built yet.)', 'Press SPACE to keep walking');
    party(-1.2, 0.4); S.cam.behind(anne, { cut: true, dist: 5 });
    await S.fade(0, 0.8); C.checkpoint(); console.log('CH2 chapter done');
  }

  // ---------- what there is to look at ----------
  S.on({ id: 'guardTalk', at: GUARD_AT, r: 1.7, action: 'E — talk to the guard', when: () => S.progress >= 120, run: async () => {
    S.cam.face(guard.obj, { dist: 1.9, y: 1.45, turn: 0.5 });
    if (S.progress < 130) await say('gu', 0, 'Vice-Captain Elora is in the guard house:\nthe door in the wall, east of the gate.');
    else await say('gu', 0, 'Welcome to Valyndra City, magicians,\nand good luck with your search!');
  } });
  S.on({ id: 'cart', at: V3(CART.x, 0, CART.z + 1.2), r: 2.4, touch: true, run: async () => {
    await S.card('Valyndra City', 'A cart of grain sacks blocks the street north.\nThe market, the Velvet Rug and WhiteHall Castle\nare the next part of the story: not built yet.', 'Press SPACE');
    await S.turnTo(V3(CART.x, 0, CART.z + 6)); await S.walk([V3(CART.x, 0, CART.z + 4.2)], { speed: 2 });
  } });
  S.on({ id: 'infirmary', at: V3(36.0, 0, 19.9), r: 1.3, action: 'E — the infirmary door', run: async () => { await S.say('a1', 1, "The infirmary. It's locked."); } });
  S.on({ id: 'well', at: WELL, r: 1.9, action: 'E — look into the well', run: async () => { await S.say('a1', 0, 'Clear, cold water.\nA whole city, and nobody tickling anybody\nin plain sight. I could get used to this.'); await S.say('am', 4, 'Give it a day, kitty.'); } });
  S.blockExit = (ex) => {
    if (ex.to === 'barracks' && S.progress < 120) { S.toast('The gate guard wants a word first.', 'note', 2); return true; }
    return false;
  };
  S.hint = async () => { await S.say('am', 0, S.progress < 130 ? 'The guard told us the thief is being\nheld in the city barracks...\nThe door in the wall, east of the gate.' : "The Velvet Rug, kitty!\n...It is not built yet. A scandal."); };
  S.onArrive = () => {
    C.checkpoint();
    if (S.progress < 120) S.run(arrival);
    else if (S.progress >= 130 && S.progress < 140) S.run(whatNext);
    else party();
  };
  if (typeof window !== 'undefined') window.__val = { bou, guard };
}
