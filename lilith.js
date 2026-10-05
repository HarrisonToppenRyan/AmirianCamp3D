// lilith.js: Lilith, the Queen of Succubi (the 2D game's prologue, the haunted Secret Library). Like the thief
// (thief.js) and Boudicca (boudicca.js) she is a second figure made from Anne's own model, in her own colours, after
// her portraits (faces/lilith.png) and her walking sprite: long periwinkle-blue hair, two short violet horns, pointed
// ears, red eyes, pale skin; a purple bodysuit with a dark high collar, long purple gloves and thigh-high purple
// boots; big crimson bat wings; she hovers, flapping. Her arms and hands are thief.js's: aimed at points on Anne's
// soles, never into them.
const V = new URL(import.meta.url).search;
const { createThief } = await import('./thief.js' + V);

const PURPLE = [0.30, 0.10, 0.42];
export const LILITH_LOOK = {
  name: 'Lilith',
  hide: ['Anne_Hat', 'Anne_HatBand'],
  sock: [0.24, 0.08, 0.34, 0.70],                    // thigh-high boots
  band: [0.30, 0.10, 0.40],                           // her gloves, elbow to wrist (the hands: GlovePaint below)
  iris: [[1.0, 0.28, 0.25], [0.5, 0.02, 0.06]],
  hair: { base: [0.27, 0.33, 0.68], right: [0.36, 0.31, 0.70], left: [0.36, 0.31, 0.70] },      // (periwinkle, lilac at the front)
  tint: {
    Anne_Skin: (m) => { m.color.multiply({ r: 1.0, g: 0.93, b: 0.97 }); }, Anne_SkinShod: (m) => { m.color.multiply({ r: 1.0, g: 0.93, b: 0.97 }); },
    Anne_GlovePaint: (m) => { m.color.setRGB(0.42, 0.15, 0.58); m.roughness = 0.45; },
    Anne_Glove: (m) => { m.color.setRGB(...PURPLE); }, Anne_Trim: (m) => { m.color.setRGB(0.12, 0.04, 0.16); m.metalness = 0.3; m.roughness = 0.4; },
    Anne_Suit: (m) => { m.color.setRGB(...PURPLE); m.roughness = 0.4; m.metalness = 0.08; },
    Anne_Choker: (m) => { m.color.setRGB(0.04, 0.02, 0.05); },
    Anne_HeelPurple: (m) => { m.color.setRGB(0.24, 0.08, 0.34); m.roughness = 0.35; }, Anne_HeelSole: [0.05, 0.02, 0.06],
    Anne_Nail: [0.24, 0.08, 0.34], Anne_Brow: [0.36, 0.36, 0.58],
  },
};

// horns, ears and wings, built in model space (rest pose) and carried by her bones
function dress({ tw, THREE, onBone }) {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const tube = (pts, r0, r1, mat, seg = 20) => {
    const path = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(path, seg, 1, 10, false), P = geo.attributes.position;
    for (let i = 0; i <= seg; i++) { const u = i / seg, c = path.getPointAt(u), r = r0 + (r1 - r0) * Math.pow(u, 0.8); for (let k = 0; k <= 10; k++) { const n = i * 11 + k; P.setXYZ(n, c.x + (P.getX(n) - c.x) * r, c.y + (P.getY(n) - c.y) * r, c.z + (P.getZ(n) - c.z) * r); } }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
  };
  const head = onBone('head');
  if (head) {
    // horns: short, curving up and back from above her temples; violet, lighter at the tips (vertex colours)
    const hornMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 });
    for (const s of [1, -1]) {
      const m = tube([V3(s * 0.045, 1.672, 0.045), V3(s * 0.062, 1.735, 0.03), V3(s * 0.078, 1.785, -0.012), V3(s * 0.074, 1.812, -0.062)], 0.024, 0.002, hornMat);
      const P = m.geometry.attributes.position, col = []; for (let i = 0; i < P.count; i++) { const k = Math.min(1, Math.max(0, (P.getY(i) - 1.69) / 0.12)); col.push(0.28 + 0.4 * k, 0.12 + 0.3 * k, 0.45 + 0.35 * k); }
      m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); head.add(m);
    }
    // pointed ears: tips out through her hair, up and back
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.93, 0.78, 0.76), roughness: 0.6 });
    for (const s of [1, -1]) { const e = tube([V3(s * 0.078, 1.552, 0.03), V3(s * 0.1, 1.575, 0.012), V3(s * 0.128, 1.605, -0.012)], 0.014, 0.0015, skin, 10); e.scale.set(1, 1, 0.55); e.position.z = 0.012; head.add(e); }
    tw.mouth = new THREE.Object3D(); tw.mouth.position.set(0, 1.497, 0.152); head.add(tw.mouth);
  }
  const back = onBone('spine01');
  if (back) {
    // bat wings: an arm out to a wrist, four fingers fanned from it, the membrane between them scalloped in; each wing
    // hinges at her shoulder blade (the pivot is animated by tick: up and down, a little sweep)
    const memb = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.04, 0.08), roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color(0.06, 0.0, 0.01) });
    const boneMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.16, 0.03, 0.05), roughness: 0.5 });
    tw.wings = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.06, 1.33, -0.1); back.add(pivot);
      const R = V3(0, 0, 0), W = V3(s * 0.42, 0.22, -0.14), tips = [V3(s * 0.95, 0.42, -0.22), V3(s * 1.02, 0.02, -0.24), V3(s * 0.82, -0.36, -0.22), V3(s * 0.46, -0.48, -0.17)];
      const pos = [], idx = [];
      const add = (v) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
      const iR = add(R), iW = add(W), it = tips.map(add);
      idx.push(iR, iW, it[0]);
      for (let k = 0; k < tips.length - 1; k++) {
        const a = tips[k], b = tips[k + 1], m = V3().lerpVectors(a, b, 0.5).lerp(W, 0.28), im = add(m);      // (the edge between two fingers curves in)
        idx.push(iW, it[k], im, iW, im, it[k + 1]);
      }
      { const a = tips[tips.length - 1], m = V3().lerpVectors(a, R, 0.5).lerp(W, 0.2), im = add(m); idx.push(iW, it[tips.length - 1], im, iW, im, iR); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, memb); mesh.castShadow = true; pivot.add(mesh);
      const rod = (a, b, r) => { const d = V3().subVectors(b, a), c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r, d.length(), 6), boneMat); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); c.castShadow = true; pivot.add(c); };
      rod(R, W, 0.018); for (const t of tips) rod(W, t, 0.009);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 6), boneMat); claw.position.copy(W).add(V3(0, 0.03, 0)); pivot.add(claw);
      tw.wings.push({ pivot, s });
    }
  }
}

export function createLilith(S, C) {
  const L = { flap: 1, hover: 0, base: 0 };
  // (10-04: wrist, twist: her hands are angled to her forearms, never folded back on them: thief.js solve)
  // (tests: &lwrist= &ltwist= : how far her wrist may bend to its forearm, and how much of the hand's turn the forearm takes)
  const LQ = (k, d) => { const q = new URLSearchParams(location.search); return q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : d; };
  const lil = createThief(S, C, { look: LILITH_LOOK, dress, idle: 'ThiefIdle', wrist: LQ('lwrist', 0.7), twist: LQ('ltwist', 0.6), tick(tw, dt, t) {
    if (tw.wings) for (const w of tw.wings) {
      const a = t * 5.2, k = L.flap;
      w.pivot.rotation.set(0.12 * Math.cos(a) * k, w.s * (0.35 + 0.25 * Math.cos(a) * k), w.s * (0.05 + 0.42 * Math.sin(a) * k));      // (up and down, and a little sweep back and forth)
    }
    if (L.hover) tw.obj.position.y = L.base + L.hover * (0.32 + 0.05 * Math.sin(t * 5.2 + 1.2));
  } });
  // hover(h): how high she floats (0: her feet on the floor; she bobs with each beat of her wings); flap(k): how hard
  lil.hover = (h, base = 0) => { L.hover = h; L.base = base; if (!h && lil.obj) lil.obj.position.y = base; };
  lil.flap = (k) => { L.flap = k; };
  return lil;
}
