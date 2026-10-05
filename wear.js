// wear.js (2026-10-04, batch 22): what a species or an outfit adds to her that is not cloth of the model: a halo, horns,
// wings, a tail, cat or bunny ears, a crown, glasses, a tie, pearls... Each is built here from simple shapes, in the
// MODEL'S REST SPACE (metres; +x her left, +y up, +z her front; her eyes at about y 1.58, the top of her head 1.70), and
// then either
//   - hung rigidly on the bone that carries the skin nearest to it (`rigidAt`: a halo on her head, a tail on her hips), or
//   - skinned like the skin nearest to each of its points (`skinned`: a tie that lies on her chest, a band round her arm).
// Nothing here is part of the model's own nodes, so a twin made from her (Lilith, the thief) never gets any of it.
// All of it is on layers 1 and 2 as she is (the foot cam's corner picture, her portraits).
//
//   const wear = createWear({ THREE, A, anne });
//   wear.set([['halo'], ['tie', { color: '#c4122f' }], ...]);   // exactly these are shown; made when first asked for
//   wear.update(dt, t);                                          // wings beat, a tail sways, a halo bobs
//   wear.top();                                                  // whether something is on the top of her head (no hat then)
export function createWear(env) {
  const { THREE, anne } = env, PI = Math.PI;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let src = null; anne.traverse((o) => { if (!src && o.isSkinnedMesh && o.skeleton) src = o; });
  if (!src) return { set() {}, update() {}, top: () => false, names: [] };
  const sk = src.skeleton, bones = sk.bones;
  const eyes = (env.A.metrics && env.A.metrics.eyes) || null;
  const EYE = eyes ? V3(eyes.left.centre[0], eyes.left.centre[2], -eyes.left.centre[1]) : V3(0.033, 1.578, 0.105);      // her left eye (Blender to glTF axes)

  // ---------- her skin and suit in the rest pose: for "the skin nearest to this point" and for rays ----------
  const pool = { p: [], si: [], sw: [] }, grid = new Map(), CELL = 0.035, rayMeshes = [];
  const key = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
  anne.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry.attributes.skinIndex) return;
    const mn = [].concat(o.material)[0].name || '';
    if (!/^Anne_(Suit|Skin|GlovePaint)$/.test(mn) || /Bare|Shod/.test(o.name)) return;
    const P = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight, step = P.count > 30000 ? 2 : 1;
    for (let i = 0; i < P.count; i += step) {
      const n = pool.p.length / 3; pool.p.push(P.getX(i), P.getY(i), P.getZ(i));
      pool.si.push(SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)); pool.sw.push(SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i));
      const k = key(P.getX(i), P.getY(i), P.getZ(i)); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(n);
    }
    if (/^Anne_Suit$/.test(mn) || !o.geometry.morphAttributes.position) rayMeshes.push(new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  });
  function nearest(x, y, z) {
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 4 && best < 0; r++) {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const c = grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!c) continue;
        for (const n of c) { const dx = pool.p[n * 3] - x, dy = pool.p[n * 3 + 1] - y, dz = pool.p[n * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = n; } }
      }
    }
    return best;
  }
  const caster = new THREE.Raycaster();
  // where a ray from `o` along `d` first meets her suit or skin (rest pose): { point, normal } or null
  function ray(o, d, far = 0.6) {
    caster.set(o, d.clone().normalize()); caster.far = far; caster.near = 0;
    const h = caster.intersectObjects(rayMeshes, false)[0];
    return h ? { point: h.point, normal: h.face.normal.clone() } : null;
  }
  const front = (x, y, fb = 0.1) => { const h = ray(V3(x, y, 0.5), V3(0, 0, -1), 0.7); return h ? h.point.z : fb; };      // her front at (x, y)
  const back = (x, y, fb = -0.1) => { const h = ray(V3(x, y, -0.5), V3(0, 0, 1), 0.7); return h ? h.point.z : fb; };
  // her outline at a height, seen from her own axis: K points a little off her
  function ring(y, off, K = 40, x0 = 0, z0 = -0.01) {
    const out = [];
    // (from her own axis outwards: a ray from outside would meet her forearms first, in the pose she was built in)
    for (let k = 0; k < K; k++) { const a = k / K * 2 * PI, d = V3(Math.sin(a), 0, Math.cos(a)), o = V3(x0, y, z0), h = ray(o, d, 0.4); const r = h ? h.point.distanceTo(o) : 0.1; out.push(V3(x0, y, z0).addScaledVector(d, r + off)); }
    return out;
  }

  // ---------- hanging and skinning ----------
  const root = src.parent;
  const mark = (o) => { o.traverse((c) => { c.name = c.name || 'Wear'; if (!/^Wear/.test(c.name)) c.name = 'Wear_' + c.name; c.layers.enable(1); c.layers.enable(2); if (c.isMesh) { c.castShadow = true; c.frustumCulled = false; } }); return o; };
  const rigs = [];                                     // (batch 23: when her body's width changes, each takes its bone's inverse bind matrix anew: refit)
  // a group on the bone that carries the skin nearest to `p`; what is put in it is given in the rest space
  function rigidAt(p, boneName = null) {
    let bi = boneName ? bones.findIndex((b) => b.name === boneName) : -1;
    if (bi < 0) { const n = nearest(p.x, p.y, p.z); let w = -1; for (let k = 0; k < 4; k++) if (pool.sw[n * 4 + k] > w) { w = pool.sw[n * 4 + k]; bi = pool.si[n * 4 + k]; } }
    const g = new THREE.Group(); g.name = 'Wear_rig'; g.matrixAutoUpdate = false; g.matrix.copy(sk.boneInverses[bi]); g.userData.bi = bi; bones[bi].add(g); rigs.push(g); return g;
  }
  // a mesh that moves as the skin nearest to each of its points does (or, per part, as the skin nearest to that part's anchor)
  function skinned(parts, mats) {
    const geos = [];
    parts.forEach((pt, gi) => {
      const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo, P = g.attributes.position, si = new Uint16Array(P.count * 4), sw = new Float32Array(P.count * 4);
      const an = pt.anchor ? nearest(pt.anchor.x, pt.anchor.y, pt.anchor.z) : -1;
      for (let i = 0; i < P.count; i++) { const n = an >= 0 ? an : nearest(P.getX(i), P.getY(i), P.getZ(i)); for (let k = 0; k < 4; k++) { si[i * 4 + k] = pool.si[n * 4 + k]; sw[i * 4 + k] = pool.sw[n * 4 + k]; } }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      g.userData.mat = pt.mat || 0; geos.push(g);
    });
    const obj = new THREE.Group(); obj.name = 'Wear_skinned';
    mats.forEach((m, mi) => {
      const mine = geos.filter((g) => g.userData.mat === mi); if (!mine.length) return;
      const n = mine.reduce((a, g) => a + g.attributes.position.count, 0), merged = new THREE.BufferGeometry();
      for (const [name, size, T] of [['position', 3, Float32Array], ['normal', 3, Float32Array], ['skinIndex', 4, Uint16Array], ['skinWeight', 4, Float32Array]]) {
        const a = new T(n * size); let o = 0; for (const g of mine) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
        merged.setAttribute(name, new THREE.BufferAttribute(a, size));
      }
      const mesh = new THREE.SkinnedMesh(merged, m); mesh.bind(sk, src.bindMatrix); obj.add(mesh);
    });
    root.add(obj); return obj;
  }

  // ---------- materials and shapes ----------
  const col = (css, gain = 0.6) => new THREE.Color(css).multiplyScalar(gain);
  const cloth = (css, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: col(css, o.gain || 0.55), roughness: 0.6, metalness: 0, side: THREE.DoubleSide }, o.p || {}));
  const metal = (css, rough = 0.3) => new THREE.MeshStandardMaterial({ color: col(css, 0.8), roughness: rough, metalness: 0.7, side: THREE.DoubleSide });
  const glowM = (css, k = 1.6) => new THREE.MeshStandardMaterial({ color: col(css, 0.5), emissive: new THREE.Color(css).multiplyScalar(k), roughness: 0.4 });
  // a tube along points, its radius from r0 to r1
  function tube(pts, r0, r1, mat, seg = 18, sides = 8, squash = 1) {
    const path = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(path, seg, 1, sides, false), P = geo.attributes.position;
    for (let i = 0; i <= seg; i++) { const u = i / seg, c = path.getPointAt(u), r = r0 + (r1 - r0) * Math.pow(u, 0.8); for (let k = 0; k <= sides; k++) { const n = i * (sides + 1) + k; P.setXYZ(n, c.x + (P.getX(n) - c.x) * r, c.y + (P.getY(n) - c.y) * r, c.z + (P.getZ(n) - c.z) * r * squash); } }
    geo.computeVertexNormals(); return mat ? new THREE.Mesh(geo, mat) : geo;
  }
  const ball = (r, mat, p, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.copy(p); m.scale.set(sx, sy, sz); return m; };
  const at = (geo, p, q = null, s = null) => { const m = new THREE.Matrix4().compose(p, q || new THREE.Quaternion(), s || V3(1, 1, 1)); geo.applyMatrix4(m); return geo; };
  const quat = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  // a flat shape given by its outline (x, y pairs) in a plane at depth z, two-sided
  function flat(outline, z = 0) { const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), g = new THREE.ShapeGeometry(sh, 6); g.translate(0, 0, z); return g; }

  // ---------- what there is ----------
  // each: (o) => ({ obj, tick?(dt, t), top? }) with o = { color, color2, hair }
  const HEAD = V3(0, 1.62, 0.0);
  const MAKE = {
    halo: () => {
      const g = rigidAt(HEAD, 'head'), m = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.0075, 10, 44), glowM('#ffd76a', 2.2));
      m.rotation.x = PI / 2 - 0.14; m.position.set(0, 1.815, -0.012); g.add(m);
      return { obj: g, top: true, tick: (dt, t) => { m.position.y = 1.815 + 0.006 * Math.sin(t * 1.7); } };
    },
    horns: (o) => {
      const g = rigidAt(HEAD, 'head'), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 }), c0 = col(o.color || '#5a1420', 0.7), c1 = col(o.color2 || '#e8c9a0', 0.8);
      for (const s of [1, -1]) {
        const m = tube([V3(s * 0.05, 1.672, 0.04), V3(s * 0.074, 1.735, 0.028), V3(s * 0.092, 1.785, -0.012), V3(s * 0.084, 1.815, -0.06)], 0.023, 0.002, mat);
        const P = m.geometry.attributes.position, cs = []; for (let i = 0; i < P.count; i++) { const k = Math.min(1, Math.max(0, (P.getY(i) - 1.69) / 0.12)); cs.push(c0.r + (c1.r - c0.r) * k, c0.g + (c1.g - c0.g) * k, c0.b + (c1.b - c0.b) * k); }
        m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.add(m);
      }
      return { obj: g, top: true };
    },
    antennae: (o) => {
      const g = rigidAt(HEAD, 'head'), stalk = cloth(o.color || '#3f8f4f'), bulb = glowM(o.color2 || '#9dff7a', 1.8), tips = [];
      for (const s of [1, -1]) { g.add(tube([V3(s * 0.035, 1.688, 0.035), V3(s * 0.058, 1.775, 0.055), V3(s * 0.082, 1.845, 0.045)], 0.0045, 0.0035, stalk, 10, 6)); const b = ball(0.015, bulb, V3(s * 0.082, 1.852, 0.045)); g.add(b); tips.push(b); }
      return { obj: g, top: true, tick: (dt, t) => { tips.forEach((b, i) => { const k = 1 + 0.12 * Math.sin(t * 3 + i * 2); b.scale.setScalar(k); }); } };
    },
    robotears: (o) => {
      const g = rigidAt(HEAD, 'head'), m = metal(o.color || '#aab2bd'), lamp = glowM(o.color2 || '#ff4a4a', 2.2);
      for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 18), m); c.rotation.z = PI / 2; c.position.set(s * 0.094, 1.572, -0.005); g.add(c); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 12), lamp); d.rotation.z = PI / 2; d.position.copy(c.position); g.add(d); }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 6), m); rod.position.set(0.1, 1.655, -0.005); g.add(rod);
      const tip = ball(0.011, lamp, V3(0.1, 1.725, -0.005)); g.add(tip);
      return { obj: g, tick: (dt, t) => { tip.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 4); } };
    },
    catears: (o) => {
      const g = rigidAt(HEAD, 'head'), fur = cloth(o.hair || '#a9571f', { gain: 0.5 }), pink = cloth('#f2a0b8');
      for (const s of [1, -1]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.082, 14), fur); e.scale.set(1, 1, 0.5); e.position.set(s * 0.06, 1.722, 0.0); e.rotation.z = -s * 0.32; g.add(e);
        const i = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.058, 12), pink); i.scale.set(1, 1, 0.3); i.position.set(s * 0.06, 1.716, 0.012); i.rotation.z = -s * 0.32; g.add(i);
      }
      return { obj: g, top: true };
    },
    bunnyears: (o) => {
      const g = rigidAt(HEAD, 'head'), fur = cloth(o.color || '#f4f1ea'), pink = cloth('#f2a0b8'), ears = [];
      g.add(tube(Array.from({ length: 9 }, (_, i) => { const a = (-100 + 25 * i) * PI / 180; return V3(Math.sin(a) * 0.108, 1.60 + Math.cos(a) * 0.118, 0.012); }), 0.0055, 0.0055, fur, 24, 6));
      for (const s of [1, -1]) {
        const pv = new THREE.Group(); pv.position.set(s * 0.036, 1.712, 0.012); g.add(pv);
        pv.add(tube([V3(0, 0, 0), V3(s * 0.012, 0.1, -0.008), V3(s * 0.022, 0.19, 0), V3(s * 0.03, 0.245, 0.018)], 0.021, 0.013, fur, 16, 10, 0.45));
        pv.add(tube([V3(0, 0.03, 0.0085), V3(s * 0.012, 0.1, 0.002), V3(s * 0.02, 0.18, 0.01), V3(s * 0.026, 0.225, 0.024)], 0.011, 0.006, pink, 14, 8, 0.25));
        ears.push({ pv, s });
      }
      return { obj: g, top: true, tick: (dt, t) => { for (const e of ears) e.pv.rotation.z = -e.s * (0.1 + 0.035 * Math.sin(t * 1.3 + e.s)); } };
    },
    crown: (o) => {
      const g = rigidAt(HEAD, 'head'), m = metal(o.color || '#e2b532'), gem = glowM(o.color2 || '#c4122f', 0.5), y0 = 1.705;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.064, 0.03, 28, 1, true), m); band.position.set(0, y0 + 0.015, -0.005); g.add(band);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI, p = V3(Math.sin(a) * 0.07, y0 + 0.048, Math.cos(a) * 0.07 - 0.005); const c = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 4), m); c.position.copy(p); c.rotation.y = a; g.add(c); if (i % 2 === 0) g.add(ball(0.007, gem, V3(Math.sin(a) * 0.071, y0 + 0.016, Math.cos(a) * 0.071 - 0.005))); }
      return { obj: g, top: true };
    },
    spikycrown: (o) => {
      const g = rigidAt(HEAD, 'head'), m = metal(o.color || '#2a2a33', 0.35), gem = glowM(o.color2 || '#a020f0', 0.9), y0 = 1.705;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.071, 0.064, 0.026, 28, 1, true), m); band.position.set(0, y0 + 0.013, -0.005); g.add(band);
      for (let i = 0; i < 7; i++) { const a = (i - 3) / 3 * 1.7, h = 0.11 - 0.022 * Math.abs(i - 3), c = new THREE.Mesh(new THREE.ConeGeometry(0.011, h, 4), m); c.position.set(Math.sin(a) * 0.072, y0 + 0.024 + h / 2, Math.cos(a) * 0.072 - 0.005); c.rotation.y = a; c.rotation.order = 'YXZ'; c.rotation.x = 0.16; g.add(c); }
      g.add(ball(0.01, gem, V3(0, y0 + 0.014, 0.068)));
      return { obj: g, top: true };
    },
    tiara: (o) => {
      const g = rigidAt(HEAD, 'head'), m = metal(o.color || '#dfe6f0', 0.2), gem = glowM(o.color2 || '#6fd0ff', 0.9);
      g.add(tube([V3(-0.096, 1.655, 0.02), V3(-0.07, 1.682, 0.085), V3(0, 1.708, 0.118), V3(0.07, 1.682, 0.085), V3(0.096, 1.655, 0.02)], 0.0042, 0.0042, m, 26, 6));
      for (const [x, h] of [[0, 0.03], [0.03, 0.02], [-0.03, 0.02]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.008, h, 4), m); c.position.set(x, 1.708 + h / 2 - Math.abs(x) * 0.3, 0.118 - Math.abs(x) * 0.25); g.add(c); }
      g.add(ball(0.0075, gem, V3(0, 1.712, 0.123)));
      return { obj: g };
    },
    headband: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#f4f1ea');
      const pts = Array.from({ length: 9 }, (_, i) => { const a = (-100 + 25 * i) * PI / 180; return V3(Math.sin(a) * 0.108, 1.60 + Math.cos(a) * 0.118, 0.02); });
      g.add(tube(pts, 0.007, 0.007, m, 28, 6));
      if (o.frill) for (let i = 0; i < 13; i++) { const a = (-66 + 11 * i) * PI / 180; g.add(ball(0.015, m, V3(Math.sin(a) * 0.112, 1.60 + Math.cos(a) * 0.124, 0.03), 1, 1, 0.45)); }
      return { obj: g };
    },
    sweatband: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#f4f1ea');
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 32, 1, true), m); t.position.set(0, 1.665, 0.0); t.scale.set(1, 1, 1.12); t.rotation.x = -0.12; g.add(t);
      return { obj: g };
    },
    hairbow: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#c4122f'), c = V3(0, 1.715, -0.045);
      for (const s of [1, -1]) g.add(ball(0.04, m, V3(c.x + s * 0.045, c.y + 0.008, c.z), 1.15, 0.72, 0.36));
      g.add(ball(0.015, m, c));
      for (const s of [1, -1]) g.add(tube([c.clone(), V3(s * 0.025, c.y - 0.05, c.z - 0.012), V3(s * 0.04, c.y - 0.095, c.z - 0.02)], 0.011, 0.007, m, 8, 6, 0.3));
      return { obj: g, top: true };
    },
    laurel: (o) => {
      const g = rigidAt(HEAD, 'head'), m = metal(o.color || '#e2b532', 0.35);
      for (let i = 0; i < 26; i++) { const a = (24 + i * (312 / 25)) * PI / 180, p = V3(Math.sin(a) * 0.104, 1.672 + 0.012 * Math.cos(a), Math.cos(a) * 0.112 - 0.004); const l = ball(0.017, m, p, 1, 0.42, 0.5); l.rotation.y = a; l.rotation.z = (i % 2 ? 1 : -1) * 0.5; g.add(l); }      // (each leaf along the band, tilted up and down in turn)
      return { obj: g };
    },
    flower: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#ff5fa8', { gain: 0.7 }), mid = cloth('#f2cf2b', { gain: 0.8 }), c = V3(0.098, 1.662, 0.05), f = new THREE.Group();
      f.position.copy(c); f.rotation.set(0, 0.95, 0); g.add(f);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; f.add(ball(0.017, m, V3(Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0), 1, 0.72, 0.3)); }
      f.add(ball(0.009, mid, V3(0, 0, 0.004)));
      return { obj: g };
    },
    flowercrown: (o) => {
      const g = rigidAt(HEAD, 'head'), cols = o.colors || ['#ff5fa8', '#f4f1ea', '#f2cf2b', '#b79cf2'], leaf = cloth('#2e9e4f'), mid = cloth('#f2cf2b', { gain: 0.8 });
      g.add(tube(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * 2 * PI; return V3(Math.sin(a) * 0.1, 1.682, Math.cos(a) * 0.108 - 0.004); }), 0.004, 0.004, leaf, 36, 5));
      for (let i = 0; i < 11; i++) { const a = i / 11 * 2 * PI, c = V3(Math.sin(a) * 0.104, 1.69, Math.cos(a) * 0.112 - 0.004), m = cloth(cols[i % cols.length], { gain: 0.7 }), f = new THREE.Group(); f.position.copy(c); f.rotation.y = a; g.add(f);
        for (let k = 0; k < 5; k++) { const b = k / 5 * 2 * PI; f.add(ball(0.011, m, V3(Math.cos(b) * 0.012, Math.sin(b) * 0.012, 0), 1, 0.75, 0.35)); } f.add(ball(0.006, mid, V3(0, 0, 0.003))); }
      return { obj: g, top: true };
    },
    glasses: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#16141a', { p: { roughness: 0.35 } }), z = EYE.z + 0.03, r = 0.026;
      for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0024, 6, 28), m); t.position.set(s * EYE.x * 1.02, EYE.y - 0.003, z); g.add(t);
        const a = V3(s * (EYE.x * 1.02 + r), EYE.y, z), b = V3(s * 0.097, EYE.y + 0.004, -0.005); g.add(tube([a, V3(s * 0.085, EYE.y + 0.002, z - 0.04), b], 0.002, 0.002, m, 8, 5)); }
      g.add(tube([V3(-(EYE.x * 1.02 - r), EYE.y + 0.004, z), V3(0, EYE.y + 0.009, z + 0.004), V3(EYE.x * 1.02 - r, EYE.y + 0.004, z)], 0.002, 0.002, m, 6, 5));
      return { obj: g };
    },
    cap: (o) => {
      const g = rigidAt(HEAD, 'head'), m = cloth(o.color || '#1f2a52'), b = metal(o.color2 || '#e2b532'), pv = new THREE.Group(); pv.position.set(0.022, 1.722, 0.02); pv.rotation.set(0.1, 0, -0.14); g.add(pv);
      pv.add(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.04, 22), m));
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.004, 12), b); d.rotation.x = PI / 2; d.position.set(0, 0.002, 0.059); pv.add(d);
      return { obj: g, top: true };
    },
    // ----- on her neck and chest
    tie: (o) => {
      const m = cloth(o.color || '#c4122f'), parts = [], ys = [1.428, 1.40, 1.37, 1.34, 1.31, 1.28, 1.255, 1.235], ws = [0.011, 0.012, 0.015, 0.018, 0.021, 0.023, 0.02, 0.001], P = [];
      ys.forEach((y, i) => { const z = front(0, y, 0.1) + 0.007; P.push([-ws[i], y, z], [ws[i], y, z]); });
      const pos = []; for (let i = 0; i < ys.length - 1; i++) { const a = P[i * 2], b = P[i * 2 + 1], c = P[i * 2 + 2], d = P[i * 2 + 3]; pos.push(...a, ...c, ...b, ...b, ...c, ...d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); parts.push({ geo });
      const knot = at(new THREE.BoxGeometry(0.026, 0.02, 0.012), V3(0, 1.434, front(0, 1.434, 0.09) + 0.009)); parts.push({ geo: knot, anchor: V3(0, 1.43, 0.09) });
      return { obj: skinned(parts, [m]) };
    },
    bowtie: (o) => {
      const m = cloth(o.color || '#16141a'), z = front(0, 1.438, 0.09) + 0.012, parts = [], an = V3(0, 1.438, z);
      for (const s of [1, -1]) { const c = new THREE.ConeGeometry(0.02, 0.04, 4); c.rotateZ(s * PI / 2); c.scale(1, 1, 0.4); parts.push({ geo: at(c, V3(s * 0.022, 1.438, z)), anchor: an }); }
      parts.push({ geo: at(new THREE.SphereGeometry(0.008, 8, 6), an), anchor: an });
      return { obj: skinned(parts, [m]) };
    },
    collar: (o) => {
      const m = cloth(o.color || '#f4f1ea'), parts = [], an = V3(0, 1.43, 0.09);
      for (const s of [1, -1]) {
        const p = [[0.003 * s, 1.447], [0.05 * s, 1.44], [0.047 * s, 1.405], [0.014 * s, 1.418]].map(([x, y]) => [x, y, front(x, y - 0.012, 0.09) + 0.006]);
        const pos = [...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); parts.push({ geo, anchor: an });
      }
      return { obj: skinned(parts, [m]) };
    },
    scarf: (o) => {
      const m = cloth(o.color || '#c4122f'), parts = [], z = front(0.03, 1.432, 0.09) + 0.011, an = V3(0.03, 1.432, z);
      parts.push({ geo: at(new THREE.SphereGeometry(0.013, 10, 8), an), anchor: an });
      for (const [dx, dy] of [[0.045, -0.035], [0.012, -0.06]]) { const tg = tube([an.clone(), V3(an.x + dx * 0.5, an.y + dy * 0.5, z + 0.004), V3(an.x + dx, an.y + dy, z - 0.002)], 0.012, 0.008, null, 6, 6, 0.3); parts.push({ geo: tg, anchor: an }); }
      return { obj: skinned(parts, [m]) };
    },
    pearls: (o) => {
      const m = o.teeth ? cloth(o.color || '#efe6d2') : new THREE.MeshStandardMaterial({ color: col(o.color || '#f6f1ea', 0.85), roughness: 0.25, metalness: 0.1 }), parts = [], n = o.teeth ? 15 : 30;
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * 2 * PI, d = V3(Math.sin(a), -0.55 - 0.35 * Math.cos(a), Math.cos(a)).normalize(), h = ray(V3(0, 1.47, -0.012), d, 0.3); if (!h) continue;
        const p = h.point.clone().addScaledVector(d, 0.0045);
        const g = o.teeth && i % 2 === 0 && Math.cos(a) > 0.1 ? at(new THREE.ConeGeometry(0.006, 0.026, 6), p.clone().add(V3(0, -0.012, 0.004)), quat(PI, 0, 0)) : at(new THREE.SphereGeometry(o.teeth ? 0.0045 : 0.0058, 8, 6), p);
        parts.push({ geo: g, anchor: p });
      }
      return { obj: skinned(parts, [m]) };
    },
    highcollar: (o) => {
      const g = rigidAt(V3(0, 1.4, -0.08)), m = cloth(o.color || '#16141a'), inner = cloth(o.color2 || '#7a0e1d'), pos = [], K = 14, R = 5;
      const pt = (k, r) => { const a = (-78 + 156 * k / K) * PI / 180, t = r / R, rad = 0.082 + 0.1 * t, y = 1.405 + 0.24 * t - 0.05 * t * Math.pow(Math.abs(a) / 1.36, 2); return [Math.sin(a) * rad, y, -Math.cos(a) * rad * 0.85 - 0.012]; };
      for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) { const a = pt(k, r), b = pt(k + 1, r), c = pt(k, r + 1), d = pt(k + 1, r + 1); pos.push(...a, ...b, ...c, ...b, ...d, ...c); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      m.side = THREE.BackSide; inner.side = THREE.FrontSide; g.add(new THREE.Mesh(geo, m)); g.add(new THREE.Mesh(geo, inner));
      return { obj: g };
    },
    pauldrons: (o) => {
      const m = metal(o.color || '#c9a23a', 0.3), parts = [];
      for (const s of [1, -1]) { const c = V3(s * 0.185, 1.385, -0.012), geo = new THREE.SphereGeometry(0.062, 16, 8, 0, 2 * PI, 0, PI / 2); geo.scale(1.12, 0.72, 1.1); geo.rotateZ(-s * 0.5); parts.push({ geo: at(geo, c), anchor: c.clone().add(V3(s * 0.02, -0.03, 0)) }); }
      return { obj: skinned(parts, [m]) };
    },
    armbands: (o) => {
      const m = metal(o.color || '#e2b532', 0.3), parts = [];
      for (const s of [1, -1]) { const a = V3(s * 0.19, 1.345, -0.015), b = V3(s * 0.2818, 1.1829, 0.0233), c = a.clone().lerp(b, 0.42), dir = b.clone().sub(a).normalize();
        for (const k of [-0.011, 0, 0.011]) { const geo = new THREE.TorusGeometry(0.043, 0.0042, 6, 22); parts.push({ geo: at(geo, c.clone().addScaledVector(dir, k), new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), dir)) }); } }
      return { obj: skinned(parts, [m]) };
    },
    obi: (o) => {
      const m = cloth(o.color || '#c4122f'), m2 = cloth(o.color2 || '#e2b532'), parts = [], ys = [1.175, 1.14, 1.105, 1.07, 1.05], rings = ys.map((y) => ring(y, 0.0125, 36));
      const pos = []; for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < 36; k++) { const a = rings[r][k], b = rings[r][(k + 1) % 36], c = rings[r + 1][k], d = rings[r + 1][(k + 1) % 36]; pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); parts.push({ geo, mat: 0 });
      const cord = ring(1.11, 0.016, 36); parts.push({ geo: tube(cord.concat([cord[0]]), 0.004, 0.004, null, 40, 5), mat: 1 });
      const zb = back(0, 1.11, -0.1) - 0.03, an = V3(0, 1.11, zb + 0.03);
      for (const s of [1, -1]) parts.push({ geo: at(new THREE.SphereGeometry(0.06, 12, 8), V3(s * 0.062, 1.118, zb), null, V3(1.1, 0.8, 0.3)), anchor: an, mat: 0 });
      parts.push({ geo: at(new THREE.SphereGeometry(0.022, 8, 6), V3(0, 1.115, zb - 0.004)), anchor: an, mat: 1 });
      return { obj: skinned(parts, [m, m2]) };
    },
    sash: (o) => {
      const m = cloth(o.color || '#e2b532'), parts = [], K = 36, top = ring(0.985, 0.012, K), bot = ring(0.925, 0.016, K), pos = [];
      for (let k = 0; k < K; k++) { const tilt = 0.022 * Math.sin(k / K * 2 * PI); for (const r of [top, bot]) r[k].y += tilt; }
      for (let k = 0; k < K; k++) { const a = top[k], b = top[(k + 1) % K], c = bot[k], d = bot[(k + 1) % K]; pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); parts.push({ geo });
      if (o.coins) for (let k = 0; k < K; k += 2) { const p = bot[k].clone(); p.y -= 0.012; parts.push({ geo: at(new THREE.SphereGeometry(0.008, 8, 6), p, null, V3(1, 1, 0.4)), anchor: bot[k], mat: 1 }); }
      return { obj: skinned(parts, [m, metal('#e2b532', 0.25)]) };
    },
    leaves: (o) => {
      const m = cloth(o.color || '#2e9e4f'), parts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i + 0.5) / 10 * 2 * PI, d = V3(Math.sin(a), -0.5, Math.cos(a)).normalize(), h = ray(V3(0, 1.47, -0.012), d, 0.3); if (!h) continue;
        const p = h.point.clone().addScaledVector(d, 0.02), geo = new THREE.SphereGeometry(0.03, 8, 6); geo.scale(0.55, 1, 0.16);
        parts.push({ geo: at(geo, p, new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), V3(Math.sin(a) * 0.7, -0.7, Math.cos(a) * 0.7).normalize())), anchor: h.point });
      }
      return { obj: skinned(parts, [m]) };
    },
    // ----- on her back and hips
    wings_angel: (o) => {
      const g = rigidAt(V3(0, 1.33, -0.1), 'spine01'), wings = [], mats = [cloth(o.color || '#f6f6f8', { gain: 0.85 }), cloth(o.color2 || '#dfe4ee', { gain: 0.8 })];
      // a feather: a long flat oval from `root` along the angle `deg` in the wing's own plane (0 = straight out, -90 = straight down)
      const feather = (pv, s, root, deg, L, wd, mat, z) => { const a = deg * PI / 180, dir = V3(s * Math.cos(a), Math.sin(a), 0), f = ball(L / 2, mat, root.clone().addScaledVector(dir, L / 2).add(V3(0, 0, z)), wd / L, 1, 0.05); f.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); pv.add(f); };
      for (const s of [1, -1]) {
        const pv = new THREE.Group(); pv.position.set(s * 0.05, 1.335, -0.11); g.add(pv);
        const wrist = V3(s * 0.2, 0.2, -0.02), tip = V3(s * 0.37, 0.13, -0.03), R = V3(0, 0, 0);
        for (let i = 0; i < 8; i++) { const u = i / 7, root = wrist.clone().lerp(tip, u); feather(pv, s, root, -82 + 50 * u, 0.33 - 0.07 * u, 0.062, mats[0], -0.004 * i); }                  // primaries: the long ones at the wing's end
        for (let i = 0; i < 8; i++) { const u = i / 7, root = R.clone().lerp(wrist, u); feather(pv, s, root, -104 + 20 * u, 0.15 + 0.15 * u, 0.066, mats[0], 0.004 - 0.003 * i); }        // secondaries: along the arm
        for (let i = 0; i < 9; i++) { const u = i / 8, root = u < 0.55 ? R.clone().lerp(wrist, u / 0.55) : wrist.clone().lerp(tip, (u - 0.55) / 0.45); feather(pv, s, root, -98 + 55 * u * u, 0.12, 0.058, mats[1], 0.014); }      // coverts: a row of short ones over their roots
        pv.add(tube([R, wrist.clone().multiplyScalar(0.55).add(V3(0, 0.03, 0.006)), wrist.clone().add(V3(0, 0, 0.008)), tip.clone().add(V3(0, 0, 0.008))], 0.022, 0.011, mats[1], 14, 7));
        wings.push({ pv, s });
      }
      return { obj: g, tick: (dt, t) => { for (const w of wings) { w.pv.rotation.y = w.s * (-0.42 + 0.09 * Math.sin(t * 1.4)); w.pv.rotation.z = w.s * 0.04 * Math.sin(t * 1.4 + 0.6); } } };
    },
    wings_bat: (o) => {
      const g = rigidAt(V3(0, 1.33, -0.1), 'spine01'), wings = [];
      const memb = new THREE.MeshStandardMaterial({ color: col(o.color || '#6b0a14', 0.7), roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color(0.05, 0, 0.01) }), boneM = cloth(o.color2 || '#2a0a10');
      for (const s of [1, -1]) {
        const pv = new THREE.Group(); pv.position.set(s * 0.055, 1.33, -0.105); g.add(pv);
        const k = 0.52, R = V3(0, 0, 0), W = V3(s * 0.42 * k, 0.22 * k, -0.14 * k), tips = [V3(s * 0.95, 0.42, -0.22), V3(s * 1.02, 0.02, -0.24), V3(s * 0.82, -0.36, -0.22), V3(s * 0.46, -0.48, -0.17)].map((v) => v.multiplyScalar(k));
        const pos = [], idx = [], add = (v) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; }, iR = add(R), iW = add(W), it = tips.map(add);
        idx.push(iR, iW, it[0]);
        for (let j = 0; j < tips.length - 1; j++) { const mm = V3().lerpVectors(tips[j], tips[j + 1], 0.5).lerp(W, 0.28), im = add(mm); idx.push(iW, it[j], im, iW, im, it[j + 1]); }
        { const mm = V3().lerpVectors(tips[tips.length - 1], R, 0.5).lerp(W, 0.2), im = add(mm); idx.push(iW, it[tips.length - 1], im, iW, im, iR); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); pv.add(new THREE.Mesh(geo, memb));
        const rod = (a, b, r) => { const d = V3().subVectors(b, a), c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r, d.length(), 6), boneM); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); pv.add(c); };
        rod(R, W, 0.012); for (const tp of tips) rod(W, tp, 0.006);
        wings.push({ pv, s });
      }
      return { obj: g, tick: (dt, t) => { for (const w of wings) { w.pv.rotation.y = w.s * (-0.45 + 0.16 * Math.sin(t * 2.1)); w.pv.rotation.z = w.s * 0.08 * Math.sin(t * 2.1 + 0.5); } } };
    },
    wings_fairy: (o) => {
      const g = rigidAt(V3(0, 1.33, -0.1), 'spine01'), wings = [];
      const m = new THREE.MeshStandardMaterial({ color: col(o.color || '#bfe9ff', 0.8), emissive: new THREE.Color(o.color2 || '#9fd8ff').multiplyScalar(0.35), roughness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      for (const s of [1, -1]) for (const [ax, ay, L, wdt, up] of [[0.32, 0.26, 0.42, 0.13, 1], [0.24, -0.2, 0.3, 0.1, 0]]) {
        const pv = new THREE.Group(); pv.position.set(s * 0.03, 1.33, -0.1); g.add(pv);
        const geo = new THREE.CircleGeometry(1, 20); geo.scale(L / 2, wdt / 2, 1); geo.translate(L / 2, 0, 0); const w = new THREE.Mesh(geo, m); w.rotation.z = Math.atan2(ay, ax); if (s < 0) w.rotation.y = PI; pv.add(w);      // (turned about y, the same angle about z points it up on her other side too)
        wings.push({ pv, s, up });
      }
      return { obj: g, tick: (dt, t) => { for (const w of wings) w.pv.rotation.y = w.s * (-0.5 + 0.32 * Math.sin(t * 9 + (w.up ? 0 : 0.7))); } };
    },
    tail_demon: (o) => {
      const base = V3(0, 0.975, back(0, 0.975, -0.11) + 0.012), g = rigidAt(base), m = cloth(o.color || '#6b0a14', { gain: 0.7 }), pv = new THREE.Group(); pv.position.copy(base); g.add(pv);
      pv.add(tube([V3(0, 0, 0), V3(0.02, -0.14, -0.13), V3(0.06, -0.24, -0.25), V3(0.11, -0.18, -0.34), V3(0.13, -0.05, -0.36)], 0.012, 0.006, m, 22, 7));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 4), m); tip.scale.set(1, 1, 0.3); tip.position.set(0.134, -0.012, -0.362); tip.rotation.z = -0.1; pv.add(tip);
      return { obj: g, tick: (dt, t) => { pv.rotation.y = 0.28 * Math.sin(t * 1.5); pv.rotation.x = 0.07 * Math.sin(t * 2.3); } };
    },
    tail_cat: (o) => {
      const base = V3(0, 0.985, back(0, 0.985, -0.11) + 0.012), g = rigidAt(base), m = cloth(o.hair || '#a9571f', { gain: 0.5 }), pv = new THREE.Group(); pv.position.copy(base); g.add(pv);
      pv.add(tube([V3(0, 0, 0), V3(0, -0.05, -0.13), V3(0.03, 0.0, -0.25), V3(0.05, 0.11, -0.3), V3(0.04, 0.22, -0.27)], 0.017, 0.015, m, 22, 8));
      pv.add(ball(0.015, m, V3(0.04, 0.222, -0.269)));
      return { obj: g, tick: (dt, t) => { pv.rotation.y = 0.35 * Math.sin(t * 1.2); pv.rotation.x = 0.06 * Math.sin(t * 1.9); } };
    },
    tail_bunny: (o) => {
      const base = V3(0, 0.99, back(0, 0.99, -0.11) - 0.02), g = rigidAt(base), m = cloth(o.color || '#f4f1ea', { gain: 0.75 });
      g.add(ball(0.042, m, base));
      return { obj: g };
    },
  };

  // ---------- what she has on ----------
  const made = new Map(); let now = [];
  const sig = (id, o) => id + '|' + JSON.stringify(o || {});
  function set(list = []) {
    const want = new Set(list.map(([id, o]) => sig(id, o)));
    for (const [k, w] of made) w.obj.visible = want.has(k);
    now = [];
    for (const [id, o] of list) {
      // (a builder that fails logs "WEAR Error": worded so that the test drivers print it; a failure here was silent for a whole batch)
      const k = sig(id, o); let w = made.get(k);
      if (!w && MAKE[id]) { try { w = MAKE[id](o || {}); mark(w.obj); made.set(k, w); } catch (e) { console.log('WEAR Error: ' + id + ' could not be made: ' + e.message); continue; } }
      if (w) { w.obj.visible = true; now.push(w); }
    }
    if (made.size > 70) for (const [k, w] of made) if (!w.obj.visible) { w.obj.removeFromParent(); w.obj.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); made.delete(k); }      // (colours tried on and left again)
  }
  function update(dt, t) { for (const w of now) if (w.tick) w.tick(dt, t); }
  function refit() { for (const g of rigs) if (g.parent) g.matrix.copy(sk.boneInverses[g.userData.bi]); }
  return { set, update, refit, top: () => now.some((w) => w.top), names: Object.keys(MAKE), has: (id) => !!MAKE[id] };
}
