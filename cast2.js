// cast2.js: the people of Chapter 2 ("Dawn comes Slowly"). Like the thief (thief.js), Boudicca and Lilith, each is a second
// figure made from Anne's own model in her own colours, after her 2D portraits (faces/*.png) and walking sprite, with one of
// the model's own hairstyles and skirts (anne_next.js makeTwin: look.hairStyle, look.parts, look.bare) and a few things
// built on her bones (`dress`). Her arms and hands are thief.js's.
//   Camellia Flaire   the travelling apothecary and fortune teller of the Trader Post: long wavy red hair under a pink
//                     kerchief with a white flower, green eyes, a gold hoop earring, a pink top, a long purple skirt, barefoot
//   the Dryad         of the Forest of Lys: leaf-green hair, antlers of bare branch, pink blossoms at her temples, golden
//                     eyes, skin with a green cast, a dress of leaves (the 2D's wears next to nothing: here she is dressed)
//   Elora             Vice-Captain of the Valyndra guard: a white bob, green eyes, the guard's white uniform with its blue cape
//   the gate guard    the same uniform; dark blue hair in a bun, grey eyes
//   Mia               Lieutenant Mia: a black ponytail with violet locks at her face, blue eyes, a lilac scarf, a white tunic
//   Aurelia           the thief (thief.js's own look), as she sits in the stocks: her boots off
const V = new URL(import.meta.url).search;
const { createThief } = await import('./thief.js' + V);

const mul = (r, g, b, rough) => (m) => { m.color.multiply({ r, g, b }); if (rough) m.roughness = rough; };
const rgb = (r, g, b, rough, metal) => (m) => { m.color.setRGB(r, g, b); if (rough !== undefined) m.roughness = rough; if (metal !== undefined) m.metalness = metal; };
const GOLD = rgb(0.62, 0.42, 0.10, 0.35, 0.7);
const NOHAT = ['Anne_Hat', 'Anne_HatBand', 'Anne_Cuffs', 'Anne_CuffTrim'];

// ---------- what is built on a head: the place of her lips (for kisses), petals, a kerchief, antlers ----------
function lips(tw, THREE, head) { tw.mouth = new THREE.Object3D(); tw.mouth.position.set(0, 1.497, 0.152); head.add(tw.mouth); }
function blossom(THREE, r, petal, heart, n = 5) {
  const g = new THREE.Group(), pm = new THREE.MeshStandardMaterial({ color: petal, roughness: 0.7, side: THREE.DoubleSide }), hm = new THREE.MeshStandardMaterial({ color: heart, roughness: 0.6 });
  for (let i = 0; i < n; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), pm); p.scale.set(0.62, 1, 0.22); const a = i / n * Math.PI * 2; p.position.set(Math.sin(a) * r * 0.95, Math.cos(a) * r * 0.95, 0); p.rotation.z = -a; p.castShadow = true; g.add(p); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 10, 8), hm); c.position.z = r * 0.16; g.add(c);
  return g;
}
const tubeOf = (THREE, pts, r0, r1, mat, seg = 16) => {
  const path = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(path, seg, 1, 8, false), P = geo.attributes.position;
  for (let i = 0; i <= seg; i++) { const u = i / seg, c = path.getPointAt(u), r = r0 + (r1 - r0) * u; for (let k = 0; k <= 8; k++) { const n = i * 9 + k; P.setXYZ(n, c.x + (P.getX(n) - c.x) * r, c.y + (P.getY(n) - c.y) * r, c.z + (P.getZ(n) - c.z) * r); } }
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
};

// ---------- Camellia ----------
export const CAMELLIA_LOOK = {
  name: 'Camellia', hide: [...NOHAT, 'Anne_Choker'], bare: true, hairStyle: 'wavy', parts: ['Anne_SkirtMaxi', 'Anne_SkirtMaxiTrim', 'Anne_Belt'],
  iris: [[0.30, 0.92, 0.68], [0.02, 0.40, 0.28]],
  hair: { base: [0.34, 0.035, 0.03], right: [0.42, 0.06, 0.045], left: [0.42, 0.06, 0.045] },
  tint: {
    Anne_Skin: mul(1.0, 0.95, 0.90), Anne_SkinShod: mul(1.0, 0.95, 0.90), Anne_GlovePaint: mul(1.0, 0.95, 0.90, 0.55),
    Anne_Suit: rgb(0.52, 0.13, 0.25, 0.6), Anne_Trim: GOLD, Anne_Skirt: rgb(0.20, 0.07, 0.30, 0.7), Anne_Belt: GOLD, Anne_Buckle: GOLD,
    Anne_Nail: [0.55, 0.10, 0.22], Anne_Brow: [0.24, 0.04, 0.03],
  },
};
function dressCamellia({ tw, THREE, onBone }) {
  const head = onBone('head'); if (!head) return;
  lips(tw, THREE, head);
  // the kerchief: over the top and back of her head, tied behind; its front edge above her brow
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.62, 0.20, 0.32), roughness: 0.8, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 28, 16, 0, Math.PI * 2, 0, 1.25), cloth); cap.position.set(0, 1.60, -0.01); cap.rotation.x = -0.35; cap.scale.set(0.98, 1.0, 1.06); cap.castShadow = true; head.add(cap);
  for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.006), cloth); t.position.set(s * 0.022, 1.515, -0.150); t.rotation.set(0.22, 0, s * 0.3); t.castShadow = true; head.add(t); }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), cloth); knot.position.set(0, 1.572, -0.142); head.add(knot);
  // the white flower at her left temple, the gold hoop at her left ear
  const fl = blossom(THREE, 0.021, new THREE.Color(0.92, 0.92, 0.95), new THREE.Color(0.9, 0.7, 0.15)); fl.position.set(0.092, 1.652, 0.062); fl.rotation.set(-0.2, 0.95, 0); head.add(fl);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0028, 6, 22), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.66, 0.18), roughness: 0.3, metalness: 0.85 })); hoop.position.set(0.085, 1.522, 0.012); hoop.rotation.y = 0.5; head.add(hoop);
}
export const createCamellia = (S, C, o = {}) => createThief(S, C, Object.assign({ look: CAMELLIA_LOOK, dress: dressCamellia, idle: 'IdleBare', bare: true, wrist: 0.7, twist: 0.6 }, o));

// ---------- the Dryad ----------
export const DRYAD_LOOK = {
  name: 'Dryad', hide: [...NOHAT, 'Anne_Choker'], bare: true, hairStyle: 'wavy', parts: ['Anne_Tutu', 'Anne_TutuTrim', 'Anne_Panels', 'Anne_PanelsTrim'],
  iris: [[0.95, 0.72, 0.22], [0.45, 0.24, 0.04]],
  hair: { base: [0.12, 0.30, 0.07], right: [0.20, 0.40, 0.10], left: [0.20, 0.40, 0.10] },
  band: [0.10, 0.20, 0.06],                            // (vine bracers)
  tint: {
    Anne_Skin: mul(0.90, 0.93, 0.70), Anne_SkinShod: mul(0.90, 0.93, 0.70), Anne_GlovePaint: mul(0.90, 0.93, 0.70, 0.55),
    Anne_Suit: rgb(0.10, 0.25, 0.07, 0.75), Anne_Trim: rgb(0.24, 0.14, 0.06, 0.8, 0), Anne_Skirt: rgb(0.14, 0.32, 0.08, 0.8),
    Anne_Nail: [0.50, 0.16, 0.30], Anne_Brow: [0.10, 0.20, 0.05],
  },
};
function dressDryad({ tw, THREE, onBone }) {
  const head = onBone('head'); if (!head) return;
  lips(tw, THREE, head);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const bark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.24, 0.14, 0.07), roughness: 0.9 });
  for (const s of [1, -1]) {                           // antlers: a main beam up and out, two tines
    head.add(tubeOf(THREE, [V3(s * 0.05, 1.668, 0.02), V3(s * 0.085, 1.74, 0.005), V3(s * 0.135, 1.80, -0.02), V3(s * 0.155, 1.875, -0.03)], 0.014, 0.004, bark));
    head.add(tubeOf(THREE, [V3(s * 0.09, 1.745, 0.003), V3(s * 0.075, 1.80, 0.03), V3(s * 0.082, 1.845, 0.045)], 0.008, 0.003, bark, 8));
    head.add(tubeOf(THREE, [V3(s * 0.13, 1.795, -0.018), V3(s * 0.175, 1.815, -0.005), V3(s * 0.21, 1.845, 0.0)], 0.007, 0.0025, bark, 8));
    const fl = blossom(THREE, 0.026, new THREE.Color(0.86, 0.42, 0.52), new THREE.Color(0.95, 0.75, 0.3)); fl.position.set(s * 0.098, 1.628, 0.058); fl.rotation.set(-0.15, s * 0.95, 0); head.add(fl);
  }
  // a garland of leaves at her collar (carried by her chest)
  const chest = onBone('spine01');
  if (chest) {
    const lm = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.16, 0.36, 0.09), roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), lm); l.scale.set(0.5, 1, 0.16); l.position.set(Math.sin(a) * 0.075, 1.418 + 0.012 * Math.cos(a * 3), 0.012 + Math.cos(a) * 0.068); l.rotation.set(0.9 * Math.cos(a), a, 0.9 * Math.sin(a)); l.castShadow = true; chest.add(l); }
  }
}
export const createDryad = (S, C, o = {}) => createThief(S, C, Object.assign({ look: DRYAD_LOOK, dress: dressDryad, idle: 'IdleBare', bare: true, wrist: 0.7, twist: 0.6 }, o));

// ---------- the guard of Valyndra: Elora, the gate guard ----------
const WHITE = [0.60, 0.60, 0.65], BLUE = [0.05, 0.13, 0.42];
const guardLook = (name, hairStyle, hair, iris, extra = {}) => ({
  name, hide: NOHAT, hairStyle, parts: ['Anne_Cape', 'Anne_CapeTrim', 'Anne_Belt', 'Anne_SkirtPencil', 'Anne_SkirtPencilTrim'],
  sock: [0.56, 0.56, 0.62, 0.50], band: WHITE, sleeve: [...WHITE, 0.95], iris, hair,
  tint: Object.assign({
    Anne_Suit: rgb(...WHITE, 0.55), Anne_Trim: GOLD, Anne_Skirt: rgb(...WHITE, 0.6), Anne_Cape: rgb(...BLUE, 0.6), Anne_Belt: GOLD, Anne_Buckle: GOLD,
    Anne_Choker: rgb(...BLUE, 0.6), Anne_GlovePaint: rgb(...WHITE, 0.55),
    Anne_HeelPurple: rgb(0.50, 0.50, 0.56, 0.4, 0.1), Anne_HeelSole: [0.10, 0.10, 0.14], Anne_Nail: [0.56, 0.56, 0.62],
  }, extra),
});
export const ELORA_LOOK = guardLook('Elora', 'bob', { base: [0.66, 0.66, 0.70], right: [0.70, 0.70, 0.74], left: [0.70, 0.70, 0.74] }, [[0.35, 0.80, 0.50], [0.04, 0.34, 0.20]], { Anne_Brow: [0.46, 0.46, 0.50] });
export const GUARD_LOOK = guardLook('Guard', 'bun', { base: [0.045, 0.085, 0.26], right: [0.06, 0.11, 0.32], left: [0.06, 0.11, 0.32] }, [[0.55, 0.56, 0.60], [0.20, 0.21, 0.25]], { Anne_Brow: [0.04, 0.07, 0.2] });
function dressGuard({ tw, THREE, onBone }) { const head = onBone('head'); if (head) lips(tw, THREE, head); }
export const createElora = (S, C, o = {}) => createThief(S, C, Object.assign({ look: ELORA_LOOK, dress: dressGuard, idle: 'Idle', wrist: 0.7, twist: 0.6 }, o));
export const createGuard = (S, C, o = {}) => createThief(S, C, Object.assign({ look: GUARD_LOOK, dress: dressGuard, idle: 'Idle' }, o));

// ---------- Lieutenant Mia ----------
export const MIA_LOOK = {
  name: 'Mia', hide: [...NOHAT, 'Anne_Choker'], hairStyle: 'ponytail', parts: ['Anne_SkirtTube', 'Anne_SkirtTubeTrim', 'Anne_Belt'],
  sock: [0.07, 0.06, 0.11, 0.46], band: [0.16, 0.10, 0.26],
  iris: [[0.40, 0.72, 1.0], [0.05, 0.26, 0.72]],
  hair: { base: [0.03, 0.032, 0.04], right: [0.36, 0.09, 0.60], left: [0.36, 0.09, 0.60] },
  tint: {
    Anne_Suit: rgb(0.58, 0.57, 0.63, 0.6), Anne_Trim: rgb(0.16, 0.10, 0.26, 0.6, 0), Anne_Skirt: rgb(0.58, 0.57, 0.63, 0.65), Anne_Belt: rgb(0.16, 0.10, 0.26, 0.6, 0), Anne_Buckle: GOLD,
    Anne_HeelPurple: rgb(0.07, 0.06, 0.11, 0.4, 0.1), Anne_HeelSole: [0.03, 0.03, 0.05], Anne_Nail: [0.07, 0.06, 0.11], Anne_Brow: [0.03, 0.03, 0.04],
  },
};
function dressMia({ tw, THREE, onBone }) {
  const head = onBone('head'); if (head) lips(tw, THREE, head);
  const chest = onBone('spine01'); if (!chest) return;
  // her scarf: a loose cowl on her shoulders (as the thief's, in lilac)
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.50, 0.44, 0.66), roughness: 0.85 });
  const ring = (R, r, y, z, tilt, sx, sz, turn = 0) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, 30), mat); m.rotation.set(Math.PI / 2 + tilt, 0, turn); m.scale.set(sx, sz, 1); m.position.set(0, y, z); m.castShadow = m.receiveShadow = true; chest.add(m); };
  ring(0.068, 0.033, 1.436, 0.018, 0.26, 1.0, 0.98); ring(0.058, 0.027, 1.468, 0.012, 0.12, 1.0, 0.96, 1.3);
}
export const createMia = (S, C, o = {}) => createThief(S, C, Object.assign({ look: MIA_LOOK, dress: dressMia, idle: 'ThiefIdle' }, o));

// ---------- Aurelia in the stocks: the thief as she is, her boots and stockings' feet off ----------
export const createAureliaBare = (S, C, o = {}) => createThief(S, C, Object.assign({ patch: { name: 'Aurelia', bare: true, sockLow: 0.085, tint: { Anne_Nail: [0.55, 0.2, 0.32] } }, bare: true, idle: 'ChairBare' }, o));

// the faces of their portraits (faces/*.png, by index) -> an expression of the model's
export const FACES = {
  ca: { 0: 'smile', 1: 'happy', 2: 'happy', 3: 'happy', 4: 'smug', 5: 'smug', 6: 'happy', 7: 'happy', 8: 'surprised', 9: 'neutral', 10: 'worried', 11: 'shocked', 12: 'embarrassed', 13: 'tired', 14: 'happy', 15: 'laugh', 16: 'worried', 17: 'smile', 18: 'happy', 19: 'happy', 20: 'laugh', 21: 'embarrassed', 22: 'happy', 23: 'laugh' },
  dr: { 0: 'smile', 1: 'happy', 2: 'surprised', 3: 'smug', 4: 'smile', 5: 'laugh', 6: 'laugh', 7: 'laughHard', 8: 'surprised', 9: 'worried', 10: 'shocked', 11: 'shocked', 12: 'worried', 13: 'angry', 14: 'neutral', 15: 'angry' },
  el: { 0: 'neutral', 1: 'smile', 2: 'smug', 3: 'happy', 4: 'angry', 5: 'angry', 6: 'angry', 7: 'neutral', 8: 'embarrassed', 9: 'embarrassed', 10: 'embarrassed', 11: 'happy', 12: 'happy', 13: 'smug', 14: 'laugh', 15: 'laugh' },
  mi: { 0: 'smile', 1: 'neutral', 2: 'smug', 3: 'happy', 4: 'happy', 5: 'worried', 6: 'embarrassed', 7: 'laugh' },
  gu: { 0: 'smile' },
  au: { 1: 'smug', 4: 'angry', 6: 'angry', 7: 'shocked', 10: 'laughHard', 11: 'laughHard' },
};
