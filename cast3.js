// cast3.js (10-12): the creatures of the Forest of Lys that are people: the HORNET girls and the SLIME girls (the 2D game's
// "Hornet" and "Slime" events of Map 36, CE 58 SceneHORNET and CE 59 SceneSlime). Like cast2.js's figures each is a second
// figure made from Anne's own model in her own colours (anne_next.js makeTwin), with a few things built on her bones.
//   the Hornet   after faces/hornet.png and her map sprite: a crimson bob over one eye, two black feelers, dark eyes, a
//                grin; a dark violet collar that stands up, a yellow leotard hooped in black, black gloves and leggings
//                (her feet bare: she flies), two pairs of glassy wings, a striped tail with a blunt tip. She hovers.
//                Her sister: the same in honey-blonde twintails.
//   the Slime    after faces/slime.png: a girl of blue jelly (her sister of green): long hair of the same stuff, pale
//                eyes; she is DRESSED, as everybody here is: a short dress of denser jelly. She stands in her own puddle.
// Their arms and hands are thief.js's: aimed at points on Anne's soles, never into them.
const V = new URL(import.meta.url).search;
const { createThief } = await import('./thief.js' + V);

const mul = (r, g, b, rough) => (m) => { m.color.multiply({ r, g, b }); if (rough) m.roughness = rough; };
const rgb = (r, g, b, rough, metal) => (m) => { m.color.setRGB(r, g, b); if (rough !== undefined) m.roughness = rough; if (metal !== undefined) m.metalness = metal; };
const NOHAT = ['Anne_Hat', 'Anne_HatBand', 'Anne_Cuffs', 'Anne_CuffTrim'];
function lips(tw, THREE, head) { tw.mouth = new THREE.Object3D(); tw.mouth.position.set(0, 1.497, 0.152); head.add(tw.mouth); }
const tubeOf = (THREE, pts, r0, r1, mat, seg = 16) => {
  const path = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(path, seg, 1, 8, false), P = geo.attributes.position;
  for (let i = 0; i <= seg; i++) { const u = i / seg, c = path.getPointAt(u), r = r0 + (r1 - r0) * u; for (let k = 0; k <= 8; k++) { const n = i * 9 + k; P.setXYZ(n, c.x + (P.getX(n) - c.x) * r, c.y + (P.getY(n) - c.y) * r, c.z + (P.getZ(n) - c.z) * r); } }
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
};

// ---------- the Hornet ----------
// her leotard's hoops: bands of black across the yellow, by height in the rest pose (so they bend with her)
const hoops = (yellow, black, y0 = 0.86, step = 0.105, share = 0.42) => (m) => {
  m.color.setRGB(1, 1, 1); m.roughness = 0.55; m.metalness = 0;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = 'varying float vHoopY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHoopY = position.y;');
    sh.fragmentShader = 'varying float vHoopY;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float k = fract((vHoopY - ${y0.toFixed(3)}) / ${step.toFixed(3)}), w = fwidth(vHoopY) / ${step.toFixed(3)} * 1.5;
        float band = smoothstep(${(1 - share).toFixed(3)} - w, ${(1 - share).toFixed(3)} + w, k) * (1.0 - smoothstep(1.0 - w, 1.0, k)) + (1.0 - smoothstep(0.0, w, k));
        diffuseColor.rgb = mix(vec3(${yellow.map((v) => v.toFixed(3)).join(', ')}), vec3(${black.map((v) => v.toFixed(3)).join(', ')}), clamp(band, 0.0, 1.0)); }`);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.customProgramCacheKey = () => key + '|hoops' + y0 + step;
};
const YEL = [0.62, 0.40, 0.03], BLK = [0.025, 0.022, 0.03], VIOLET = [0.10, 0.06, 0.20];
export const HORNET_LOOK = {
  name: 'Hornet', hide: [...NOHAT, 'Anne_Choker'], bare: true, hairStyle: 'bob',
  sock: [...BLK, 0.70], sockLow: 0.085, band: BLK,           // black leggings from her ankles to her thighs, black gloves to her elbows
  iris: [[0.16, 0.22, 0.42], [0.02, 0.03, 0.08]],
  hair: { base: [0.40, 0.03, 0.09], right: [0.50, 0.05, 0.13], left: [0.50, 0.05, 0.13] },
  tint: {
    Anne_Skin: mul(1.0, 0.93, 0.86), Anne_SkinShod: mul(1.0, 0.93, 0.86), Anne_GlovePaint: rgb(...BLK, 0.5),
    Anne_Suit: hoops(YEL, BLK), Anne_Trim: rgb(...BLK, 0.5, 0), Anne_Glove: rgb(...BLK, 0.5),
    Anne_Nail: [0.62, 0.40, 0.03], Anne_Brow: [0.26, 0.02, 0.06],
  },
};
export const HORNET2_LOOK = Object.assign({}, HORNET_LOOK, { name: 'Hornet sister', hairStyle: 'twintails',
  hair: { base: [0.62, 0.42, 0.10], right: [0.70, 0.50, 0.14], left: [0.70, 0.50, 0.14] },
  tint: Object.assign({}, HORNET_LOOK.tint, { Anne_Brow: [0.40, 0.26, 0.06] }) });
function dressHornet({ tw, THREE, onBone }) {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const black = new THREE.MeshStandardMaterial({ color: new THREE.Color(...BLK), roughness: 0.45 });
  const head = onBone('head');
  if (head) {
    lips(tw, THREE, head);
    for (const s of [1, -1]) {                           // feelers: up and forward from her crown, a little club at each tip
      head.add(tubeOf(THREE, [V3(s * 0.035, 1.685, 0.045), V3(s * 0.05, 1.76, 0.07), V3(s * 0.075, 1.815, 0.125), V3(s * 0.085, 1.81, 0.175)], 0.0075, 0.0045, black, 14));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), black); tip.position.set(s * 0.086, 1.808, 0.182); tip.castShadow = true; head.add(tip);
    }
  }
  const chest = onBone('spine01');
  if (chest) {
    // her collar: dark violet, standing up round her neck, open at the front with two points
    const cm = new THREE.MeshStandardMaterial({ color: new THREE.Color(...VIOLET), roughness: 0.7, side: THREE.DoubleSide });
    const geo = new THREE.CylinderGeometry(0.098, 0.064, 0.082, 26, 1, true, 0.42, Math.PI * 2 - 0.84), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getX(i), P.getZ(i)), front = Math.max(0, Math.cos(a)); if (P.getY(i) > 0) P.setY(i, P.getY(i) + 0.03 * front * front); }      // (higher towards the front points)
    geo.computeVertexNormals();
    const col = new THREE.Mesh(geo, cm); col.position.set(0, 1.447, 0.006); col.rotation.x = 0.16; col.castShadow = true; chest.add(col);
    // her wings: two pairs, glassy; each hinges at her shoulder blade (the pivots are beaten by tick)
    const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.93, 1.0), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, emissive: new THREE.Color(0.10, 0.12, 0.16) });
    const vein = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.20, 0.20, 0.26), roughness: 0.5 });
    const wing = (len, wid) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(len * 0.25, wid * 0.9, len * 0.8, wid * 0.8, len, wid * 0.12); sh.bezierCurveTo(len * 0.85, -wid * 0.55, len * 0.3, -wid * 0.5, 0, 0); return new THREE.ShapeGeometry(sh, 14); };
    tw.wings = [];
    for (const s of [1, -1]) for (const [k, len, wid, up] of [[0, 0.62, 0.17, 0.55], [1, 0.44, 0.13, -0.05]]) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.05, 1.345 - k * 0.05, -0.105); chest.add(pivot);
      const g = new THREE.Group(); g.rotation.set(0, s > 0 ? -0.5 : Math.PI + 0.5, up * (s > 0 ? 1 : -1)); pivot.add(g);      // (out and back, the upper pair raised)
      const m = new THREE.Mesh(wing(len, wid), glass); m.renderOrder = 3; g.add(m);
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.004, len * 0.96, 5), vein); rib.rotation.z = -Math.PI / 2 + 0.1; rib.position.set(len * 0.48, wid * 0.07, 0); g.add(rib);
      tw.wings.push({ pivot, s, k });
    }
  }
  // her tail: a hornet's, striped, carried behind her hips and tipped up; its tip is blunt
  const hips = onBone('spine05');
  if (hips) {
    const geo = new THREE.SphereGeometry(1, 22, 16), P = geo.attributes.position, col = [];
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), u = (y + 1) / 2, r = Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + 0.94 * u)), 0.62); const k = 0.098 * r / Math.max(1e-3, Math.sqrt(1 - y * y)); P.setXYZ(i, P.getX(i) * k, y * 0.17, P.getZ(i) * k);
      const band = Math.floor(u * 6.2) % 2 === 0; col.push(...(band ? YEL : BLK)); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const tail = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })); tail.castShadow = true;
    const tg = new THREE.Group(); tg.position.set(0, 1.035, -0.115); tg.rotation.x = -1.95; hips.add(tg);      // (its long axis back and a little up)
    tail.position.y = 0.145; tg.add(tail);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), black); tip.scale.set(0.9, 1.5, 0.9); tip.position.y = 0.32; tg.add(tip);
    tw.tail = tg;
  }
}
// hover(h): how high she flies (0: on her feet; she bobs with her wings); buzz(k): how hard her wings beat
function hornet(S, C, look, o = {}) {
  const L = { buzz: 1, hover: 0, base: 0 };
  const fig = createThief(S, C, Object.assign({ look, dress: dressHornet, idle: 'IdleBare', bare: true, wrist: 0.7, twist: 0.6, tick(tw, dt, t) {
    if (tw.wings) for (const w of tw.wings) { const a = t * 38 + w.k * 1.3, k = L.buzz; w.pivot.rotation.set(0, w.s * 0.16 * Math.sin(a * 0.5) * k, w.s * (0.1 + 0.52 * Math.sin(a) * k)); }
    if (tw.tail) tw.tail.rotation.x = -1.95 + 0.07 * Math.sin(t * 2.3);
    if (L.hover) tw.obj.position.y = L.base + L.hover * (0.3 + 0.045 * Math.sin(t * 4.1 + 0.7));
  } }, o));
  fig.hover = (h, base = 0) => { L.hover = h; L.base = base; if (!h && fig.obj) fig.obj.position.y = base; };
  fig.buzz = (k) => { L.buzz = k; };
  return fig;
}
export const createHornet = (S, C, o = {}) => hornet(S, C, o.sister ? HORNET2_LOOK : HORNET_LOOK, o);

// ---------- the Slime ----------
const jelly = (r, g, b, rough = 0.2, glow = 0.16) => (m) => { m.color.setRGB(r, g, b); m.roughness = rough; m.metalness = 0; if (m.emissive) m.emissive.setRGB(r * glow, g * glow, b * glow); m.envMapIntensity = 1.4; };
const slimeLook = (name, hairStyle, skin, deep, hair, iris) => ({
  name, hide: [...NOHAT, 'Anne_Choker'], bare: true, hairStyle, parts: ['Anne_SkirtTube', 'Anne_SkirtTubeTrim'],
  iris, hair: { base: hair, right: hair.map((v) => v * 1.25), left: hair.map((v) => v * 1.25) },
  tint: {
    Anne_Skin: jelly(...skin), Anne_SkinShod: jelly(...skin), Anne_GlovePaint: jelly(...skin), Anne_Glove: jelly(...skin),
    Anne_Suit: jelly(...deep, 0.22, 0.1), Anne_Skirt: jelly(...deep, 0.22, 0.1), Anne_Trim: jelly(...skin, 0.2, 0.3),
    Anne_Nail: deep, Anne_Brow: hair,
    Anne_Hair: (m) => { m.roughness = 0.16; m.envMapIntensity = 1.5; if (m.emissive) m.emissive.setRGB(hair[0] * 0.25, hair[1] * 0.25, hair[2] * 0.25); },
  },
  jelly: { skin, deep },
});
export const SLIME_LOOK = slimeLook('Slime', 'long', [0.24, 0.42, 0.86], [0.06, 0.13, 0.50], [0.07, 0.12, 0.50], [[0.78, 0.74, 0.96], [0.34, 0.30, 0.62]]);
export const SLIME2_LOOK = slimeLook('Slime sister', 'wavy', [0.22, 0.66, 0.50], [0.04, 0.30, 0.22], [0.05, 0.32, 0.24], [[0.80, 0.95, 0.86], [0.30, 0.55, 0.42]]);
const dressSlime = (look) => ({ tw, THREE, onBone }) => {
  const head = onBone('head'); if (head) lips(tw, THREE, head);
  const { skin, deep } = look.jelly;
  const goo = new THREE.MeshStandardMaterial({ color: new THREE.Color(...skin), roughness: 0.12, metalness: 0, transparent: true, opacity: 0.86, emissive: new THREE.Color(skin[0] * 0.16, skin[1] * 0.16, skin[2] * 0.16) });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(...deep), roughness: 0.15, emissive: new THREE.Color(deep[0] * 0.2, deep[1] * 0.2, deep[2] * 0.2) });
  // drops on her shoulders and at her hair's ends (carried by her chest)
  const chest = onBone('spine01');
  if (chest) for (const [x, y, z, r] of [[0.15, 1.40, -0.01, 0.022], [-0.155, 1.395, 0.0, 0.019], [0.085, 1.30, -0.10, 0.017], [-0.07, 1.27, -0.105, 0.02]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), goo); d.scale.set(1, 1.5, 1); d.position.set(x, y, z); chest.add(d); }
  // her puddle: she stands in it wherever she stands (carried by her root, on the ground)
  const root = onBone('root');
  if (root) {
    const geo = new THREE.SphereGeometry(1, 28, 12), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getZ(i), P.getX(i)), k = 1 + 0.16 * Math.sin(a * 3 + 0.6) + 0.09 * Math.sin(a * 7 + 2.0); P.setXYZ(i, P.getX(i) * 0.5 * k, Math.max(0, P.getY(i)) * 0.045, P.getZ(i) * 0.46 * k); }
    geo.computeVertexNormals();
    const pud = new THREE.Mesh(geo, goo); pud.position.y = 0.004; pud.receiveShadow = true; root.add(pud); tw.puddle = pud;
    for (const [x, z, r] of [[0.36, 0.3, 0.07], [-0.42, 0.18, 0.055], [-0.2, -0.4, 0.06], [0.3, -0.34, 0.045]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), dark); b.scale.set(1, 0.45, 1); b.position.set(x, 0.012, z); root.add(b); }
  }
};
function slime(S, C, look, o = {}) {
  const fig = createThief(S, C, Object.assign({ look, dress: dressSlime(look), idle: 'IdleBare', bare: true, wrist: 0.7, twist: 0.6, tick(tw, dt, t) {
    if (tw.puddle) { const k = 1 + 0.05 * Math.sin(t * 2.2); tw.puddle.scale.set(k, 1 + 0.5 * (k - 1), 2 - k); }      // (it breathes)
  } }, o));
  fig.jelly = look.jelly;
  return fig;
}
export const createSlime = (S, C, o = {}) => slime(S, C, o.sister ? SLIME2_LOOK : SLIME_LOOK, o);

// the faces of their portraits (faces/hornet.png, faces/slime.png; by index) -> an expression of the model's
export const FACES3 = {
  ho: { 0: 'smug', 1: 'happy', 2: 'smug', 3: 'happy', 4: 'smug', 5: 'laugh', 6: 'happy', 7: 'laugh' },
  sl: { 0: 'neutral', 1: 'smug', 2: 'happy', 3: 'laugh', 4: 'neutral', 5: 'smug', 6: 'happy', 7: 'laugh' },
};
