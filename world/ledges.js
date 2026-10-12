// world/ledges.js (10-12): raised ground. The ledges that are climbed to by a vine (the 2D game's "ClimbUp" vines in the
// North Forest and the "Weeds" of the Forest of Lys): level.levels says which tiles stand LEDGE_H higher
// (world/common.js; tools/ledges.py writes it). This module builds what is seen of them:
//   - the top: the same painted ground as everywhere (the ground mesh's own material, laid out by the same map), so
//     turf, forest floor and paths carry on up there;
//   - the rock face all round, where raised ground meets low ground: an outline traced along the tile edges, its
//     corners rounded and its line made uneven, strata that jut a little, a lip of turf, darker at its foot;
//   - small rocks at its foot and strands of ivy from its lip, where it faces open ground.
// The ground mesh itself stays flat underneath (as it does under the camp's plateau). Everything that grows or stands on
// a raised tile is put up there by its own builder (c.buildHeightAt).
//
// c.ledges = { climbs: [{ id, base, top, at, out, h }], FACE }: for each of level.climbs, the foot of the face at the
// middle of the vine (`at`, on the low ground, FACE metres out of the tile edge: where the rock is flat for the climb),
// the level direction out of the face (`out`) and its height. climb.js and the area scripts stand the vine there.
export function buildLedges(c) {
  const { THREE, scene, level, S, M, W, H } = c, LH = c.LEDGE_H;
  c.ledges = { climbs: [], FACE: 0.12 };
  if (!LH) return {};
  const up = (x, y) => c.levelAt(x, y) === 1, FACE = c.ledges.FACE;
  const { rnd, rr } = c.rng(4242), clamp = THREE.MathUtils.clamp, sst = THREE.MathUtils.smoothstep;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---------- the climbs: where the face must be flat, and exactly where it is ----------
  for (const k of level.climbs || []) {
    const [bx, by] = k.base, [tx, ty] = k.top, ox = Math.sign(bx - tx), oz = Math.sign(by - ty);
    // the edge of the raised ground that she crosses: the side of the base tile that faces the top
    const at = V3(ox ? (ox > 0 ? bx : bx + 1) * S + ox * FACE : (bx + 0.5) * S, 0, oz ? (oz > 0 ? by : by + 1) * S + oz * FACE : (by + 0.5) * S);
    c.ledges.climbs.push({ id: k.id, base: k.base, top: k.top, at, out: V3(ox, 0, oz), h: LH });
  }
  // how much a point of the outline belongs to a climb's flat face (0..1), and that face's line
  function flatAt(x, z) {
    let best = 0, face = null;
    for (const k of c.ledges.climbs) {
      const dx = x - k.at.x, dz = z - k.at.z, across = dx * k.out.x + dz * k.out.z, along = Math.abs(dx * k.out.z - dz * k.out.x);
      if (Math.abs(across) > 0.7) continue;
      const w = 1 - sst(along, 0.8, 1.35); if (w > best) { best = w; face = k; }
    }
    return [best, face];
  }

  // ---------- the outline: loops of tile edges with raised ground on one side ----------
  // Each edge runs with the raised ground on its right (in x, z), so its outward side is (-d.z, d.x).
  const edges = new Map(), key = (x, z) => x + ',' + z, add = (x0, z0, x1, z1, lx, lz) => { const k = key(x0, z0); if (!edges.has(k)) edges.set(k, []); edges.get(k).push({ x0, z0, x1, z1, lx, lz, used: false }); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!up(x, y)) continue;
    if (!up(x, y - 1)) add(x + 1, y, x, y, x, y - 1);
    if (!up(x, y + 1)) add(x, y + 1, x + 1, y + 1, x, y + 1);
    if (!up(x - 1, y)) add(x, y, x, y + 1, x - 1, y);
    if (!up(x + 1, y)) add(x + 1, y + 1, x + 1, y, x + 1, y);
  }
  const loops = [];
  for (const list of edges.values()) for (const first of list) {
    if (first.used) continue;
    const loop = []; let e = first;
    while (e && !e.used) {
      e.used = true; loop.push(e);
      const dx = e.x1 - e.x0, dz = e.z1 - e.z0, next = (edges.get(key(e.x1, e.z1)) || []).filter((n) => !n.used);
      // where two raised tiles touch by a corner the loop turns towards its own ground (the two stay two outlines)
      const want = [[dz, -dx], [dx, dz], [-dz, dx]];
      e = null; for (const [wx, wz] of want) { e = next.find((n) => n.x1 - n.x0 === wx && n.z1 - n.z0 === wz); if (e) break; }
    }
    if (loop.length >= 4) loops.push(loop);
  }

  // ---------- each loop as a line of points, 0.4 m apart: corners rounded, pushed out unevenly ----------
  const SUB = 4, ROWS = [-0.45, 0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.9, 0.96, 1].map((v) => (v <= 0 ? v : v * LH));
  const lowKind = (x, y) => (!c.inMap(x, y) || '#|'.includes(c.tileAt(x, y)) ? 'forest' : c.tileAt(x, y) === '~' ? 'water' : c.walkAt(x, y) ? 'walk' : 'open');
  const outlines = loops.map((loop, li) => {
    const raw = [];
    for (const e of loop) for (let j = 0; j < SUB; j++) raw.push({ x: (e.x0 + (e.x1 - e.x0) * j / SUB) * S, z: (e.z0 + (e.z1 - e.z0) * j / SUB) * S, kind: lowKind(e.lx, e.lz) });
    const n = raw.length, at = (i) => raw[((i % n) + n) % n], pts = [];
    let area = 0; for (let i = 0; i < n; i++) area += at(i).x * at(i + 1).z - at(i + 1).x * at(i).z;
    for (let i = 0; i < n; i++) {
      // rounded: a weighted mean of the neighbours (straight runs stay where they are)
      const wts = [1, 4, 6, 4, 1]; let x = 0, z = 0; for (let k = -2; k <= 2; k++) { x += at(i + k).x * wts[k + 2] / 16; z += at(i + k).z * wts[k + 2] / 16; }
      pts.push({ x, z, kind: raw[i].kind });
    }
    let arc = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], p = pts[i], tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
      p.nx = -tz / tl; p.nz = tx / tl; p.arc = arc; arc += Math.hypot(b.x - p.x, b.z - p.z);
    }
    for (const p of pts) {
      const [w, face] = flatAt(p.x, p.z);
      p.push = 0.03 + 0.09 * c.fbm2(p.arc * 0.85 + li * 13.7, li * 5.3 + 2.1, 3); p.flat = w;
      if (face && w > 0) {                       // onto the climb's own line, and straight out of it
        const d = (p.x - face.at.x) * face.out.x + (p.z - face.at.z) * face.out.z;      // (how far this point is out of the flat face)
        p.fx = p.x - face.out.x * d; p.fz = p.z - face.out.z * d;
      }
    }
    return { pts, len: arc, hole: area > 0, li };
  });
  // where a point of the outline is at height y (the rock's profile): its uneven push, a foot that spreads, strata that jut
  // by turns, a lip of turf at the top; on a climb's face: flat
  function wallPoint(o, p, y, out) {
    const band = Math.floor((y + 0.45) / 0.42), strata = 0.06 * (c.noise2(p.arc * 1.15 + o.li * 9.1, band * 7.3 + o.li) - 0.5);
    const foot = 0.05 * (1 - clamp(y / 1.2, 0, 1)) ** 2, lip = 0.05 * sst(y, LH - 0.3, LH - 0.1);      // (at most 0.20 m out of the tile's edge where she walks past: index.html KEEP)
    const off = p.push + foot + strata + lip, x = p.x + p.nx * off, z = p.z + p.nz * off;
    if (p.flat > 0) return out.set(x + (p.fx - x) * p.flat, y, z + (p.fz - z) * p.flat);
    return out.set(x, y, z);
  }

  // ---------- the rock face ----------
  const rock = c.canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8b8376'; g.fillRect(0, 0, w, h);
    const R = c.rng(77), r = R.rr;
    for (let i = 0; i < 900; i++) { const x = r(0, w), y = r(0, h), s = r(6, 40); g.fillStyle = `rgba(${R.rnd() < 0.5 ? '60,54,46' : '176,168,150'},${r(0.03, 0.09)})`; g.beginPath(); g.ellipse(x, y, s, s * r(0.25, 0.6), r(-0.2, 0.2), 0, 6.3); g.fill(); }
    // strata: beds of rock, each a little lighter or darker, a dark seam between them
    let y = 0; while (y < h) {
      const t = r(26, 70); g.fillStyle = `rgba(${R.rnd() < 0.5 ? '40,36,30' : '200,192,172'},${r(0.04, 0.13)})`; g.fillRect(0, y, w, t);
      g.strokeStyle = `rgba(38,33,28,${r(0.35, 0.6)})`; g.lineWidth = r(1.2, 3); g.beginPath();
      const ph = r(0, 6.3), amp = r(1.5, 5); for (let x = 0; x <= w; x += 8) { const yy = y + amp * Math.sin(x / w * 6.2832 * 2 + ph) + amp * 0.5 * Math.sin(x / w * 6.2832 * 5 + ph * 2); if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke();
      g.strokeStyle = 'rgba(214,206,186,0.22)'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x <= w; x += 8) { const yy = y + 3 + amp * Math.sin(x / w * 6.2832 * 2 + ph); if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke();
      y += t;
    }
    // cracks down the beds
    for (let i = 0; i < 46; i++) { let x = r(0, w), yy = r(0, h); g.strokeStyle = `rgba(34,30,26,${r(0.25, 0.55)})`; g.lineWidth = r(0.8, 2); g.beginPath(); g.moveTo(x, yy); for (let k = 0, m = 2 + Math.floor(r(0, 5)); k < m; k++) { x += r(-7, 7); yy += r(8, 22); g.lineTo(x, yy); } g.stroke(); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R.rnd() < 0.5 ? '30,27,24' : '220,214,198'},${r(0.05, 0.2)})`; g.fillRect(r(0, w), r(0, h), r(1, 2.6), r(1, 2.2)); }
  }, { repeat: true, anisotropy: 8 });
  const TEX_M = 2.6;                                     // metres of rock that one copy of the picture covers
  const pos = [], uv = [], col = [], idx = [], _p = V3();
  const GREY = [1.0, 0.98, 0.94], MOSSY = [0.42, 0.62, 0.3];
  for (const o of outlines) {
    const n = o.pts.length, base = pos.length / 3, turns = Math.max(1, Math.round(o.len / TEX_M)) / o.len;      // (a whole number of pictures round the outline: no seam where it closes)
    for (let i = 0; i <= n; i++) {
      const p = o.pts[i % n], arcU = (i === n ? o.len : p.arc) * turns;
      for (let j = 0; j < ROWS.length; j++) {
        const y = ROWS[j]; wallPoint(o, p, y, _p); pos.push(_p.x, _p.y, _p.z); uv.push(arcU, (y + 0.45) / TEX_M);
        // darker at its foot and under the lip, moss and turf from the top down, damp where it stands in water
        const tone = 0.86 + 0.24 * c.noise2(p.arc * 0.9 + o.li * 3.3, y * 1.9 + 4), shade = 0.62 + 0.38 * sst(y, -0.1, 1.1);
        const green = sst(y, LH - 0.95, LH - 0.05) * (0.35 + 0.65 * c.noise2(p.arc * 1.7 + 11, y * 2.3)), wet = p.kind === 'water' ? 1 - sst(y, 0.1, 0.9) : 0;
        for (let k = 0; k < 3; k++) col.push((GREY[k] * (1 - green) + MOSSY[k] * green) * tone * shade * (1 - 0.35 * wet));
      }
    }
    const R2 = ROWS.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < R2 - 1; j++) {
      const a = base + i * R2 + j, b = a + R2, c2 = a + 1, d = b + 1;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); wallGeo.setIndex(idx); wallGeo.computeVertexNormals();
  // (faces that came out wound the wrong way would be dark: the normals must point out of the rock)
  {
    const nrm = wallGeo.attributes.normal; let good = 0, bad = 0, vi = 0;
    for (const o of outlines) { const n = o.pts.length; for (let i = 0; i <= n; i++) { const p = o.pts[i % n]; for (let j = 0; j < ROWS.length; j++, vi++) { if (nrm.getX(vi) * p.nx + nrm.getZ(vi) * p.nz > 0) good++; else bad++; } } }
    if (bad > good) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } wallGeo.setIndex(idx); wallGeo.computeVertexNormals(); }
  }
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: rock, vertexColors: true }));
  wall.name = 'ledge rock'; wall.castShadow = wall.receiveShadow = true; scene.add(wall);

  // ---------- the top: the painted ground, as far as the rock's own edge ----------
  const groundMesh = scene.getObjectByName('ground'), sizeX = (W + 2 * M) * S, sizeZ = (H + 2 * M) * S;
  const tPos = [], tUv = [], tIdx = [], inside = (o, p) => { let c2 = false; const q = o.pts; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) c2 = !c2; return c2; };
  const rim = (o) => o.pts.map((p) => { wallPoint(o, p, LH, _p); return new THREE.Vector2(_p.x, _p.z); });
  for (const o of outlines) {
    if (o.hole) continue;
    const contour = rim(o), holes = outlines.filter((h) => h.hole && inside(o, h.pts[0])).map(rim);
    const tris = THREE.ShapeUtils.triangulateShape(contour, holes), all = contour.concat(...holes), base = tPos.length / 3;
    for (const v of all) { tPos.push(v.x, LH, v.y); tUv.push((v.x + M * S) / sizeX, (v.y + M * S) / sizeZ); }
    for (const [a, b, d] of tris) {
      const A = all[a], B = all[b], D = all[d], upward = (B.y - A.y) * (D.x - A.x) - (B.x - A.x) * (D.y - A.y);      // (the normal's y)
      if (upward >= 0) tIdx.push(base + a, base + b, base + d); else tIdx.push(base + a, base + d, base + b);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3)); topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
  topGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(tPos.length).fill(0).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3)); topGeo.setIndex(tIdx);
  const top = new THREE.Mesh(topGeo, groundMesh ? groundMesh.material : new THREE.MeshLambertMaterial({ color: 0x5c8a3c }));
  top.name = 'ledge top'; top.receiveShadow = true; top.castShadow = true; scene.add(top);

  // ---------- at its foot: small rocks; from its lip: strands of ivy (where it faces open ground or water) ----------
  const xPos = [], xCol = [], xIdx = [], ico = new THREE.IcosahedronGeometry(1, 1), ip = ico.attributes.position, ii = ico.index;
  const tri = (a, b, d, rgb) => { const k = xPos.length / 3; xPos.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]); for (let q = 0; q < 3; q++) xCol.push(rgb[0], rgb[1], rgb[2]); xIdx.push(k, k + 1, k + 2); };
  const icoIdx = ii ? Array.from(ii.array) : Array.from({ length: ip.count }, (v, i) => i);
  function stone(x, y, z, sx, sy, sz, yaw, tone) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), P = [];
    for (let i = 0; i < ip.count; i++) {
      _p.fromBufferAttribute(ip, i); const bump = 0.78 + 0.4 * c.fbm2(_p.x * 1.9 + x * 2.3 + 7, _p.y * 1.9 + _p.z * 1.4 + z * 1.9 + 3, 2);
      _p.multiplyScalar(bump); if (_p.y > 0.5) _p.y = 0.5 + (_p.y - 0.5) * 0.4;
      const lx = _p.x * sx, lz = _p.z * sz; P.push([x + lx * cs - lz * sn, y + _p.y * sy, z + lx * sn + lz * cs, Math.max(0, _p.y)]);
    }
    for (let i = 0; i < icoIdx.length; i += 3) {
      const a = P[icoIdx[i]], b = P[icoIdx[i + 1]], d = P[icoIdx[i + 2]], m = Math.min(1, (a[3] + b[3] + d[3]) / 3 * 1.5) * 0.55;
      tri(a, b, d, [(0.5 * (1 - m) + 0.2 * m) * tone, (0.48 * (1 - m) + 0.34 * m) * tone, (0.44 * (1 - m) + 0.14 * m) * tone]);
    }
  }
  const leafCol = () => { const t = rr(0.75, 1.15), g = rnd(); return [(0.1 + 0.08 * g) * t, (0.3 + 0.14 * g) * t, (0.07 + 0.04 * g) * t]; };
  function ivy(o, p, len) {                              // a strand down the face: a thin stem, leaves to both sides
    const a = V3(), b = V3(), side = V3(-p.nz, 0, p.nx); let prev = null; const segs = Math.max(3, Math.round(len / 0.16)), sw = rr(0, 6.3), dr = rr(-0.25, 0.25);
    for (let k = 0; k <= segs; k++) {
      const y = LH + 0.02 - len * k / segs; wallPoint(o, p, clamp(y, 0, LH), a); a.y = y;
      a.addScaledVector(side, dr * (k / segs) + 0.035 * Math.sin(k * 1.3 + sw)); a.x += p.nx * 0.025; a.z += p.nz * 0.025;
      if (prev) {
        b.copy(side).multiplyScalar(0.008); const stem = [0.2, 0.22, 0.1];
        tri([prev.x - b.x, prev.y, prev.z - b.z], [prev.x + b.x, prev.y, prev.z + b.z], [a.x, a.y, a.z], stem);
        for (const sgn of [-1, 1]) {
          if (rnd() < 0.25) continue;
          const s = rr(0.05, 0.085) * (1 - 0.35 * k / segs), ox = side.x * sgn, oz = side.z * sgn, lift = rr(0.01, 0.045), rgb = leafCol();
          const tip = [a.x + ox * s * 1.5 + p.nx * lift, a.y - s * rr(0.5, 1.1), a.z + oz * s * 1.5 + p.nz * lift];
          tri([a.x, a.y, a.z], [a.x + ox * s * 0.75 + p.nx * lift, a.y + s * 0.5, a.z + oz * s * 0.75 + p.nz * lift], tip, rgb);
          tri([a.x, a.y, a.z], tip, [a.x + ox * s * 0.6 + p.nx * lift * 0.5, a.y - s * 0.75, a.z + oz * s * 0.6 + p.nz * lift * 0.5], rgb);
        }
      }
      prev = a.clone();
    }
  }
  for (const o of outlines) {
    let nextStone = rr(0.3, 1.2), nextIvy = rr(0.2, 0.9);
    for (const p of o.pts) {
      if (p.kind === 'forest' || p.flat > 0.02) continue;
      if (p.arc >= nextStone) {
        nextStone = p.arc + rr(0.7, 2.1);
        // (rocks only where she does not walk: she is kept 0.42 m off the tile's edge, and a rock would reach further)
        if (p.kind === 'open') {
          const r = rr(0.14, 0.34); wallPoint(o, p, 0, _p); const sx = _p.x + p.nx * r * rr(0.2, 0.9), sz = _p.z + p.nz * r * rr(0.2, 0.9);
          // (at a corner the rock may face a tile she walks on after all: not there either, nor reaching on to one)
          const walks = (k) => c.walkAt(Math.floor((sx + p.nx * k) / S), Math.floor((sz + p.nz * k) / S));
          if (!walks(0) && !walks(r * 1.5)) stone(sx, r * rr(0.1, 0.3), sz, r * rr(0.9, 1.4), r * rr(0.7, 1.0), r * rr(0.8, 1.2), rr(0, 6.3), rr(0.8, 1.1));
        }
      }
      if (p.arc >= nextIvy) { nextIvy = p.arc + rr(0.35, 1.5); ivy(o, p, rr(0.35, 1.5) * (rnd() < 0.2 ? 1.5 : 1)); }
    }
  }
  if (xPos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(xPos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(xCol, 3)); g.setIndex(xIdx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.name = 'ledge dressing'; m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  return {};
}
