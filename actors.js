// actors.js: the creatures and props of the story, modelled in code (no files): Amaymon in his glass ball, the vine
// walls and the Ivy Maidens, Myconids, Alraune's flower, herbs, signposts, the hole and the shrine.
// Everything is made of smooth tubes, lathes, leaves and balls with vertex colours, lit by the scene's own lights.
// Colours are linear and already dimmed for the game's sun (a surface shows about 2.5 x its albedo in full sun).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createActors(THREE) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const PI = Math.PI, TAU = PI * 2, UP = V3(0, 1, 0);
  const col = (r, g, b) => new THREE.Color().setRGB(r, g, b);
  const mix = (a, b, k) => a.clone().lerp(b, k);
  const clamp = THREE.MathUtils.clamp;
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  function rng(seed) { let s = seed | 0; const r = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; r.r = (a, b) => a + (b - a) * r(); return r; }

  // ---------- geometry kit ----------
  const paint = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const strip = (geo) => { for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k); return geo.index ? geo.toNonIndexed() : geo; };
  const merge = (list) => mergeGeometries(list.map(strip), false);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V3(), _a = V3(), _b = V3(), _c = V3();
  const place = (geo, pos, quatOrDir, scale = 1) => {             // move a part into place; a direction means "its +Y points this way"
    const q = quatOrDir && quatOrDir.isQuaternion ? quatOrDir : quatOrDir ? _q.setFromUnitVectors(UP, _a.copy(quatOrDir).normalize()) : _q.identity();
    return geo.applyMatrix4(_m.compose(pos, q, typeof scale === 'number' ? _s.setScalar(scale) : scale));
  };
  // a smooth tube through the points; rad(t) and colour(t) along it (t = 0..1); closed off to a point where rad is 0
  function tube(pts, rad, colour, sides = 8, rings = 0) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), N = rings || Math.max(6, pts.length * 4);
    const P = [], C = [], I = [], tan = V3(), nrm = V3(), bin = V3(), p = V3(), prevN = V3();
    for (let i = 0; i <= N; i++) {
      const t = i / N; curve.getPoint(t, p); curve.getTangent(t, tan).normalize();
      if (i === 0) { nrm.set(1, 0, 0); if (Math.abs(tan.x) > 0.9) nrm.set(0, 0, 1); nrm.addScaledVector(tan, -nrm.dot(tan)).normalize(); }
      else { nrm.copy(prevN).addScaledVector(tan, -prevN.dot(tan)).normalize(); }
      prevN.copy(nrm); bin.crossVectors(tan, nrm);
      const r = rad(t), c = colour(t);
      for (let k = 0; k < sides; k++) { const a = k / sides * TAU, cs = Math.cos(a) * r, sn = Math.sin(a) * r; P.push(p.x + nrm.x * cs + bin.x * sn, p.y + nrm.y * cs + bin.y * sn, p.z + nrm.z * cs + bin.z * sn); C.push(c.r, c.g, c.b); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides; I.push(a, b, a + sides, b, b + sides, a + sides); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  // a leaf (or petal) lying along +Y from the origin, its face to +Z: bent back along its length and cupped across
  function leaf(L, W, bend = 0.3, cup = 0.2, colour = null, tip = 0.5, segs = 6) {
    const P = [], C = [], I = [], c0 = colour || col(0.1, 0.3, 0.08);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = W * Math.pow(Math.sin(PI * Math.pow(t, tip)), 0.8) * 0.5, y = L * t, z = -bend * L * t * t;
      for (const sx of [-1, 0, 1]) { P.push(sx * w, y, z + (sx ? cup * w : 0)); const c = sx ? c0 : mix(c0, col(0, 0, 0), 0.25); C.push(c.r * (0.8 + 0.3 * t), c.g * (0.8 + 0.3 * t), c.b * (0.8 + 0.3 * t)); }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 3; I.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  const ball = (r, c, sx = 1, sy = 1, sz = 1, seg = 14) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)); g.scale(sx, sy, sz); return paint(g, c); };
  const cone = (r, h, c, seg = 7) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return paint(g, c); };
  const lathe = (prof, c, seg = 18) => { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg); return typeof c === 'function' ? shade(g, c) : paint(g, c); };
  const shade = (geo, f) => { const P = geo.attributes.position, a = new Float32Array(P.count * 3), p = V3(); for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i); const c = f(p); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const quatY = (a) => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const quat = (ax, ay, az, order = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, ay, az, order));

  // ---------- materials ----------
  // plants sway: the higher a vertex, the more (uSway scales it; each object gets its own phase from where it stands)
  const time = { value: 0 };
  function swaying(mat, amount = 1) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time; sh.uniforms.uSway = { value: amount };
      sh.vertexShader = 'uniform float uTime, uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayAt = instanceMatrix[3].xyz;
        #else
          vec3 swayAt = modelMatrix[3].xyz;
        #endif
        float swayH = max(position.y, 0.0), swayP = uTime * 1.5 + swayAt.x * 1.7 + swayAt.z * 1.3;
        transformed.x += sin(swayP + position.y * 2.3) * 0.055 * swayH * swayH * uSway;
        transformed.z += cos(swayP * 0.83 + position.y * 1.9) * 0.045 * swayH * swayH * uSway;`);
    };
    mat.customProgramCacheKey = () => 'sway' + amount;
    return mat;
  }
  const MAT = {
    plant: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    vine: swaying(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })),
    skin: new THREE.MeshLambertMaterial({ vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    dark: new THREE.MeshBasicMaterial({ color: 0x030405 }),
  };
  const shadowy = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  const G = { stem0: col(0.022, 0.07, 0.04), stem1: col(0.07, 0.2, 0.08), leaf: col(0.1, 0.3, 0.07), leaf2: col(0.16, 0.38, 0.09), thorn: col(0.2, 0.17, 0.1),
    pink: col(0.62, 0.12, 0.36), pink2: col(0.85, 0.36, 0.6), yellow: col(0.8, 0.6, 0.1), wood: col(0.2, 0.12, 0.06), wood2: col(0.3, 0.2, 0.1), stone: col(0.22, 0.22, 0.21) };

  // a flower: `n` petals round a yellow heart, facing +Y
  function flower(r, n, c1, c2, cupped = 0.5) {
    const parts = [place(ball(r * 0.22, G.yellow, 1, 0.6, 1, 8), V3(0, r * 0.06, 0))];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, g = leaf(r, r * 0.62, 0.35, 0.3, i % 2 ? c1 : c2, 0.7, 5);
      parts.push(place(g, V3(Math.cos(a) * r * 0.1, 0, Math.sin(a) * r * 0.1), quat(0, -a + PI / 2, 0).multiply(quat(PI / 2 - cupped, 0, 0))));
    }
    return merge(parts);
  }

  // ---------- the vine wall: thick thorny tendrils with leaves and a pink flower, as high as she is ----------
  function vineWallGeo(seed, big = 1) {
    const r = rng(seed), parts = [], n = 6 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + r.r(-0.3, 0.3), b = r.r(0.22, 0.5) * big, h = r.r(1.15, 1.95) * big, lean = r.r(0.05, 0.3), dx = Math.cos(a), dz = Math.sin(a), tw = r.r(-0.6, 0.6);
      const pts = [V3(dx * b, -0.1, dz * b), V3(dx * b * 1.25, h * 0.22, dz * b * 1.25), V3(dx * b * (1.1 - lean), h * 0.55, dz * b * (1.1 - lean) + tw * 0.12),
        V3(dx * b * 0.5 + tw * 0.1, h * 0.85, dz * b * 0.5), V3(dx * (b * 0.5 + 0.16), h, dz * (b * 0.5 + 0.16)), V3(dx * (b * 0.5 + 0.3), h * 0.93, dz * (b * 0.5 + 0.3)), V3(dx * (b * 0.5 + 0.27), h * 0.83, dz * (b * 0.5 + 0.27))];
      const r0 = r.r(0.055, 0.085) * big;
      parts.push(tube(pts, (t) => r0 * (1 - 0.82 * t) * (t > 0.97 ? 0.3 : 1), (t) => mix(G.stem0, G.stem1, t), 7, 22));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      for (let k = 0, nl = 2 + (r() * 3 | 0); k < nl; k++) {                 // leaves along it, turned outwards
        const t = r.r(0.25, 0.85), p = curve.getPoint(t), out = V3(dx, r.r(0.2, 0.8), dz).applyAxisAngle(UP, r.r(-0.9, 0.9));
        parts.push(place(leaf(r.r(0.16, 0.26) * big, r.r(0.1, 0.15) * big, 0.4, 0.25, r() < 0.5 ? G.leaf : G.leaf2), p, out));
      }
      for (let k = 0; k < 3; k++) { const t = r.r(0.15, 0.75), p = curve.getPoint(t); parts.push(place(cone(0.014 * big, 0.06 * big, G.thorn, 5), p, V3(dx, 0.3, dz).applyAxisAngle(UP, r.r(-2, 2)))); }
    }
    parts.push(place(flower(0.17 * big, 6, G.pink, G.pink2), V3(r.r(-0.08, 0.08), 1.02 * big, r.r(-0.08, 0.08)), V3(r.r(-0.3, 0.3), 1, r.r(-0.3, 0.3))));
    parts.push(place(flower(0.11 * big, 5, G.pink2, G.pink), V3(r.r(-0.3, 0.3), 0.6 * big, r.r(0.2, 0.34)), V3(r.r(-0.3, 0.3), 0.6, 1)));
    return merge(parts);
  }
  const WALL_GEOS = [11, 23, 37].map((s) => vineWallGeo(s));
  // one vine wall standing at (x, z); `grow` 0..1 for sprouting and wilting
  function makeVineWall(x, z, seed = 0) {
    const m = shadowy(new THREE.Mesh(WALL_GEOS[Math.abs(seed) % WALL_GEOS.length], MAT.vine));
    m.position.set(x, 0, z); m.rotation.y = (seed * 2.399) % TAU; m.userData.emoteY = 1.9;
    let grow = 1, goal = 1;
    return { obj: m, update(dt) { if (grow !== goal) { grow += clamp(goal - grow, -dt * 1.6, dt * 1.6); const k = sstep(0, 1, grow); m.scale.set(0.6 + 0.4 * k, k, 0.6 + 0.4 * k); m.visible = grow > 0.01; } },
      wilt() { goal = 0; }, sprout(now) { goal = 1; if (now) { grow = 1; m.scale.setScalar(1); m.visible = true; } else if (grow >= 1) grow = 0; }, hide() { grow = goal = 0; m.visible = false; },
      get up() { return goal > 0; } };
  }

  // ---------- the Ivy Maiden: a woman's pale face in leaf hair on a long green neck, with two reaching tendrils ----------
  function faceTex(skin, eye, lip, glow) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = skin; x.fillRect(0, 0, 256, 256);
    const g = x.createRadialGradient(128, 150, 20, 128, 140, 130); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(40,20,60,0.22)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    for (const sx of [-1, 1]) {                    // eyes: slanted almonds with a bright iris, heavy upper lid
      x.save(); x.translate(128 + sx * 46, 118); x.scale(sx, 1); x.rotate(-0.16);
      x.beginPath(); x.moveTo(-27, 2); x.quadraticCurveTo(-4, -20, 28, -8); x.quadraticCurveTo(6, 16, -27, 2); x.closePath();
      x.fillStyle = '#16081c'; x.fill();
      x.save(); x.clip(); const eg = x.createRadialGradient(2, -1, 1, 2, -1, 15); eg.addColorStop(0, glow); eg.addColorStop(0.55, eye); eg.addColorStop(1, '#2a0630'); x.fillStyle = eg; x.beginPath(); x.arc(2, -1, 14, 0, TAU); x.fill();
      x.fillStyle = '#12051a'; x.beginPath(); x.ellipse(2, -1, 2.6, 7, 0, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(-3, -5, 2.6, 0, TAU); x.fill(); x.restore();
      x.lineWidth = 5; x.strokeStyle = '#12061a'; x.lineCap = 'round'; x.beginPath(); x.moveTo(-28, 2); x.quadraticCurveTo(-4, -22, 31, -10); x.stroke();
      x.lineWidth = 3; x.beginPath(); x.moveTo(-30, -24); x.quadraticCurveTo(0, -40, 30, -26); x.stroke();      // brow
      x.restore();
    }
    x.strokeStyle = 'rgba(60,30,80,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(124, 150); x.quadraticCurveTo(128, 158, 134, 151); x.stroke();      // nose
    x.fillStyle = lip; x.beginPath(); x.moveTo(104, 186); x.quadraticCurveTo(118, 178, 128, 183); x.quadraticCurveTo(138, 178, 152, 186); x.quadraticCurveTo(128, 204, 104, 186); x.fill();
    x.strokeStyle = 'rgba(20,6,30,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(104, 186); x.quadraticCurveTo(128, 191, 152, 186); x.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const FACES = { maiden: () => faceTex('#d9d2e6', '#d028c8', '#5a1c6a', '#ff9af4'), gazer: () => faceTex('#cfc64a', '#7a3ac8', '#4a2a70', '#d6a8ff'), cache: {} };
  // a head: an egg with the face painted on its front (+Z), and a mane of leaves
  function headGeo(r, hair0, hair1, seed) {
    const g = new THREE.SphereGeometry(r, 22, 16); g.scale(0.88, 1.08, 0.94);
    const P = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {            // the face texture is projected from the front; the back takes the skin colour of its corner
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (z > -r * 0.1) uv.setXY(i, 0.5 + x / (r * 0.88) * 0.47, 0.5 + y / (r * 1.08) * 0.47); else uv.setXY(i, 0.02, 0.02);
    }
    const rr = rng(seed), locks = [];
    for (let i = 0; i < 15; i++) {                 // hair: long pointed leaves from the crown, sweeping down and back, a few across the brow
      const a = PI * 0.12 + (i / 14) * PI * 1.76 + rr.r(-0.1, 0.1), top = rr.r(0.45, 0.95), L = r * rr.r(1.5, 2.3);
      const from = V3(Math.sin(a) * r * 0.55 * (1 - top * 0.5), r * (0.55 + 0.45 * top), -Math.cos(a) * r * 0.5 * (1 - top * 0.5) - r * 0.05);
      const dir = V3(Math.sin(a) * rr.r(0.7, 1.1), -rr.r(0.5, 1.0), -Math.cos(a) * rr.r(0.4, 0.9) - 0.15);
      locks.push(place(leaf(L, r * rr.r(0.55, 0.8), 0.3, 0.3, mix(hair0, hair1, rr()), 0.6, 5), from, dir));
    }
    for (const sx of [-1, 1]) locks.push(place(leaf(r * 1.2, r * 0.5, 0.2, 0.3, hair1, 0.6, 5), V3(sx * r * 0.2, r * 0.98, r * 0.35), V3(sx * 0.9, -0.55, 0.5)));
    return { face: g, hair: merge(locks) };
  }
  // ---------- the Ivy Maiden, after the 2D game (faces/ivy-maiden.png and the "monsters" sprites) ----------
  // Slate-green vines. The head hangs from its stalk like a bud: a porcelain mask of a face with magenta eyes that have
  // no pupils and magenta lips (the other kind: a yellow-green face, violet eyes), in hair of long slate leaves that
  // fall from the crown, part over the brow and flick out at the jaw.
  const IVY = { v0: col(0.028, 0.052, 0.045), v1: col(0.062, 0.112, 0.094), v2: col(0.125, 0.2, 0.19), hair0: col(0.024, 0.045, 0.04), hair1: col(0.058, 0.105, 0.09), hair2: col(0.13, 0.2, 0.2) };
  const IVY_FACE = {
    pale: { skin: '#f0e8f0', shade: '#d8c8d0', deep: '#a088a0', eye: '#c840b8', eyeLight: '#f29ae6', eyeDark: '#800080', line: '#400040', lip: '#c020c0', lipDark: '#800080', tongue: '#c058b0', hair: '#283830' },
    yellow: { skin: '#c8c850', shade: '#a8a830', deep: '#808000', eye: '#7878d0', eyeLight: '#b8b8f0', eyeDark: '#585898', line: '#383870', lip: '#7878d0', lipDark: '#383870', tongue: '#9850a8', hair: '#283830' },
  };
  // the face, painted as it is seen from the front; expr: 'calm' | 'grin' | 'open'
  function ivyFace(P, expr) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = P.skin; x.fillRect(0, 0, 256, 256);
    let g = x.createRadialGradient(128, 150, 30, 128, 135, 135); g.addColorStop(0, P.shade + '00'); g.addColorStop(0.62, P.shade + '66'); g.addColorStop(1, P.deep + 'dd'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    g = x.createLinearGradient(0, 24, 0, 104); g.addColorStop(0, P.deep + 'cc'); g.addColorStop(1, P.deep + '00'); x.fillStyle = g; x.fillRect(0, 0, 256, 110);      // the hair's shadow on the brow
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const sx of [-1, 1]) {
      x.save(); x.translate(128 + sx * 50, 114); x.scale(sx, 1); x.rotate(-0.2);
      g = x.createRadialGradient(0, -2, 6, 0, -2, 44); g.addColorStop(0, P.deep + 'aa'); g.addColorStop(1, P.deep + '00'); x.fillStyle = g; x.beginPath(); x.ellipse(2, -3, 44, 30, 0, 0, TAU); x.fill();      // the hollow of the eye
      const eye = () => { x.beginPath(); x.moveTo(-27, 5); x.bezierCurveTo(-14, -15, 14, -19, 30, -8); x.bezierCurveTo(18, 10, -8, 15, -27, 5); x.closePath(); };
      eye(); x.fillStyle = P.eyeDark; x.fill();
      x.save(); eye(); x.clip();
      g = x.createLinearGradient(0, -16, 0, 12); g.addColorStop(0, P.eyeLight); g.addColorStop(0.45, P.eye); g.addColorStop(1, P.eyeDark); x.fillStyle = g; x.fillRect(-32, -20, 66, 36);
      x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.ellipse(-6, -7, 9, 3, -0.2, 0, TAU); x.fill();
      x.restore();
      x.strokeStyle = P.line; x.lineWidth = 4.5; x.beginPath(); x.moveTo(-28, 5); x.bezierCurveTo(-14, -16, 14, -20, 32, -9); x.stroke();      // upper lid
      x.lineWidth = 1.6; x.beginPath(); x.moveTo(-27, 5); x.bezierCurveTo(-8, 15, 18, 10, 30, -8); x.stroke();
      x.lineWidth = 2.6; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(-30, -19); x.quadraticCurveTo(0, -35, 34, -27); x.stroke(); x.globalAlpha = 1;      // brow
      x.restore();
    }
    x.strokeStyle = P.deep; x.lineWidth = 2.5; x.beginPath(); x.moveTo(133, 126); x.quadraticCurveTo(137, 142, 131, 151); x.quadraticCurveTo(127, 154, 122, 151); x.stroke();      // nose
    x.lineWidth = 1.6; x.beginPath(); x.moveTo(72, 150); x.lineTo(83, 146); x.moveTo(75, 158); x.lineTo(88, 153); x.stroke();      // two fine cracks on the cheek
    if (expr === 'grin') {
      x.fillStyle = P.lipDark; x.beginPath(); x.moveTo(98, 180); x.quadraticCurveTo(128, 175, 158, 180); x.quadraticCurveTo(128, 212, 98, 180); x.fill();
      x.fillStyle = '#f6f2f6'; x.beginPath(); x.moveTo(104, 182); x.quadraticCurveTo(128, 179, 152, 182); x.quadraticCurveTo(128, 198, 104, 182); x.fill();
      x.strokeStyle = P.lip; x.lineWidth = 3; x.beginPath(); x.moveTo(98, 180); x.quadraticCurveTo(128, 175, 158, 180); x.stroke(); x.beginPath(); x.moveTo(106, 192); x.quadraticCurveTo(128, 208, 150, 192); x.stroke();
    } else if (expr === 'open') {
      x.fillStyle = P.line; x.beginPath(); x.ellipse(128, 191, 15, 19, 0, 0, TAU); x.fill();
      x.fillStyle = P.tongue; x.beginPath(); x.ellipse(128, 201, 9, 7, 0, 0, TAU); x.fill();
      x.fillStyle = '#f6f2f6'; x.beginPath(); x.ellipse(128, 176, 10, 3.5, 0, 0, TAU); x.fill();
      x.strokeStyle = P.lip; x.lineWidth = 4.5; x.beginPath(); x.ellipse(128, 191, 15, 19, 0, 0, TAU); x.stroke();
    } else {
      x.fillStyle = P.lipDark; x.beginPath(); x.moveTo(100, 183); x.quadraticCurveTo(116, 176, 128, 181); x.quadraticCurveTo(140, 176, 156, 183); x.quadraticCurveTo(128, 190, 100, 183); x.fill();
      x.fillStyle = P.lip; x.beginPath(); x.moveTo(103, 186); x.quadraticCurveTo(128, 205, 153, 186); x.quadraticCurveTo(128, 191, 103, 186); x.fill();
      x.strokeStyle = P.line; x.lineWidth = 1.6; x.beginPath(); x.moveTo(98, 182); x.quadraticCurveTo(128, 190, 158, 182); x.stroke();
    }
    x.fillStyle = P.hair; x.fillRect(0, 0, 18, 18);          // (the back of the head takes this corner's colour)
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const ivyFaces = {};                               // kind -> { calm, grin, open }
  const ivyFaceSet = (kind) => ivyFaces[kind] || (ivyFaces[kind] = { calm: ivyFace(IVY_FACE[kind], 'calm'), grin: ivyFace(IVY_FACE[kind], 'grin'), open: ivyFace(IVY_FACE[kind], 'open') });
  // the mask: a heart of a face, full at the brow and the cheekbones, a small pointed chin; the texture is laid on from the front
  function maskGeo(r) {
    const g = new THREE.SphereGeometry(r, 26, 20), P = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const v = y / r, front = z > -r * 0.2;
      uv.setXY(i, front ? 0.5 + x / r * 0.5 : 0.03, front ? 0.5 + v * 0.5 : 0.97);
      x *= v > 0 ? 0.9 : 0.9 - 0.5 * Math.pow(-v, 1.5);
      z *= (z > 0 ? 0.8 : 0.9) * (v < 0 ? 1 - 0.22 * v * v : 1);
      if (v < -0.3 && z > 0) z += r * 0.12 * (-v - 0.3);
      P.setXYZ(i, x, y * 1.12, z);
    }
    g.computeVertexNormals(); return g;
  }
  // a lock of leaf-hair laid along a curve: three vertices across, the middle one raised into a ridge, away from `centre`
  function lock(pts, width, colour, centre, ridge = 0.3, segs = 10) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), P = [], C = [], I = [], p = V3(), tan = V3(), out = V3(), side = V3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; curve.getPoint(t, p); curve.getTangent(t, tan).normalize();
      out.subVectors(p, centre); out.addScaledVector(tan, -out.dot(tan)); if (out.lengthSq() < 1e-8) out.set(0, 1, 0); out.normalize(); side.crossVectors(tan, out).normalize();
      const w = width(t) * 0.5, c = colour(t);
      for (const sx of [-1, 0, 1]) {
        const o = sx ? -ridge * w * 0.4 : ridge * w;
        P.push(p.x + side.x * sx * w + out.x * o, p.y + side.y * sx * w + out.y * o, p.z + side.z * sx * w + out.z * o);
        const k = sx ? 0.78 : 1.05; C.push(c.r * k, c.g * k, c.b * k);
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 3; I.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  // her hair, about a head of radius r centred on the origin (face to +Z); the crown, where the stalk comes in, is `K`
  function ivyHair(r, seed) {
    const rr = rng(seed), O = V3(0, 0, 0), K = V3(0, 1.1 * r, -0.2 * r), locks = [];
    const tone = (i) => (t) => mix(mix(IVY.hair0, IVY.hair1, 0.35 + 0.65 * ((i * 0.37) % 1)), IVY.hair2, 0.55 * Math.pow(t, 2.2));
    const wide = (W) => (t) => W * Math.pow(Math.sin(PI * Math.pow(Math.min(1, t * 1.02), 0.62)), 0.75) + 0.004;
    // round the sides and the back: over the skull, down past the jaw, the tip flicking out and up
    [48, 75, 104, 132, 158, 180, -158, -132, -104, -75, -48].forEach((deg, i) => {
      const a = deg * PI / 180 + rr.r(-0.05, 0.05), dx = Math.sin(a), dz = Math.cos(a), L = rr.r(0.92, 1.12), fl = rr.r(0.8, 1.2);
      locks.push(lock([K, V3(dx * 0.6 * r, 1.0 * r, dz * 0.6 * r - 0.1 * r), V3(dx * 0.96 * r, 0.4 * r, dz * 0.95 * r - 0.04 * r), V3(dx * 1.0 * r, -0.4 * r * L, dz * 0.93 * r),
        V3(dx * 1.22 * r, -1.0 * r * L, dz * 1.1 * r), V3(dx * (1.5 + 0.25 * fl) * r, -1.22 * r * L, dz * (1.3 + 0.2 * fl) * r), V3(dx * (1.78 + 0.3 * fl) * r, -1.02 * r * L, dz * (1.5 + 0.25 * fl) * r)],
        wide(r * rr.r(0.82, 1.0)), tone(i), O, 0.3, 12));
    });
    // the parting: two heavy locks from the crown over the brow, sweeping aside to frame the face
    for (const sx of [-1, 1]) {
      locks.push(lock([K, V3(sx * 0.16 * r, 1.13 * r, 0.42 * r), V3(sx * 0.5 * r, 0.82 * r, 0.76 * r), V3(sx * 0.86 * r, 0.25 * r, 0.62 * r), V3(sx * 0.96 * r, -0.45 * r, 0.42 * r),
        V3(sx * 1.2 * r, -1.02 * r, 0.5 * r), V3(sx * 1.55 * r, -1.2 * r, 0.62 * r), V3(sx * 1.8 * r, -0.98 * r, 0.7 * r)], wide(r * 0.92), tone(sx > 0 ? 3 : 5), O, 0.3, 14));
      locks.push(lock([K, V3(sx * 0.3 * r, 1.12 * r, 0.3 * r), V3(sx * 0.72 * r, 0.8 * r, 0.52 * r), V3(sx * 1.0 * r, 0.2 * r, 0.3 * r), V3(sx * 1.05 * r, -0.5 * r, 0.14 * r), V3(sx * 1.28 * r, -0.92 * r, 0.16 * r)],
        wide(r * 0.8), tone(sx > 0 ? 7 : 2), O, 0.3, 10));
    }
    return { geo: merge(locks), K };
  }
  function makeIvyMaiden(opts = {}) {
    const seed = opts.seed || 1, r = rng(seed * 7 + 3), gazer = !!opts.gazer, kind = gazer ? 'yellow' : 'pale';
    const faces = ivyFaceSet(kind), R = 0.15;
    const obj = new THREE.Group(); obj.name = 'IvyMaiden'; obj.userData.emoteY = 1.95;
    const vine = (t) => mix(IVY.v0, IVY.v1, t), curl = (a, reach, h, turn) => {      // a tendril that rises from the base and ends in a fiddlehead
      const dx = Math.cos(a), dz = Math.sin(a), tip = V3(dx * reach, h, dz * reach), pts = [V3(dx * 0.06, 0, dz * 0.06), V3(dx * reach * 0.75, h * 0.22, dz * reach * 0.75), V3(dx * reach * 1.08, h * 0.62, dz * reach * 1.08)];
      for (let k = 0; k <= 5; k++) { const b = -0.4 + k * 1.15, rad = 0.1 * (1 - k * 0.13); pts.push(V3(tip.x - dx * Math.sin(b) * rad * turn, tip.y + Math.cos(b) * rad - 0.02 * k, tip.z - dz * Math.sin(b) * rad * turn)); }
      return tube(pts, (t) => 0.05 * (1 - 0.86 * t) + 0.004, (t) => mix(IVY.v0, IVY.v2, t * t * 0.7), 6, 26);
    };
    // the base: a few dark leaves, roots, and tendrils that curl up round her
    const base = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + r.r(-0.3, 0.3); base.push(place(leaf(r.r(0.36, 0.52), r.r(0.16, 0.22), 0.4, 0.25, i % 2 ? IVY.v1 : IVY.v2, 0.7), V3(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08), V3(Math.cos(a), 0.36, Math.sin(a)))); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.5; base.push(tube([V3(0, 0.08, 0), V3(Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25), V3(Math.cos(a) * 0.5, -0.04, Math.sin(a) * 0.5)], (t) => 0.055 * (1 - 0.7 * t), () => IVY.v0, 6, 8)); }
    [[2.0, 0.44, 0.62, 1], [3.5, 0.5, 0.86, -1], [5.0, 0.42, 0.5, 1], [0.5, 0.36, 0.4, -1]].forEach(([a, reach, h, turn]) => base.push(curl(a + r.r(-0.25, 0.25), reach * r.r(0.85, 1.15), h * r.r(0.85, 1.2), turn)));
    obj.add(shadowy(new THREE.Mesh(merge(base), MAT.plant)));
    // the stalk: it rises in an S, hooks over, and comes down into the crown of the head; the whole of it rocks about its foot
    const neck = new THREE.Group(); obj.add(neck);
    const H = opts.height || r.r(1.28, 1.5);         // the height of her face
    const hang = V3(0, H + 1.1 * R, 0.14), pts = [V3(0, 0, 0), V3(0.1, H * 0.3, -0.2), V3(-0.07, H * 0.62, -0.24), V3(0, H * 0.93, -0.2), V3(0, H + 0.33, -0.1), V3(0, H + 0.36, 0.06), hang];
    const parts = [tube(pts, (t) => 0.088 * (1 - 0.62 * t), vine, 9, 30)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    for (let k = 0; k < 4; k++) { const p = curve.getPoint(0.14 + k * 0.15), a = k * 2.4 + 2; parts.push(place(leaf(r.r(0.17, 0.25), r.r(0.08, 0.11), 0.4, 0.25, k % 2 ? IVY.v1 : IVY.v2, 0.7), p, V3(Math.cos(a), 0.5, -Math.abs(Math.sin(a))))); }
    for (let k = 0; k < 6; k++) { const p = curve.getPoint(0.08 + k * 0.12), a = k * 1.9 + 1; parts.push(place(cone(0.015, 0.065, IVY.v2, 5), p, V3(Math.cos(a), 0.3, Math.sin(a)))); }
    parts.push(place(flower(0.085, 5, G.pink, G.pink2), curve.getPoint(0.46).add(V3(0, 0, 0.07)), V3(0, 0.25, 1)));      // the blossom on her stalk (the 2D sprite's pink heart)
    neck.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant)));
    // the head swings from the end of the stalk
    const head = new THREE.Group(); head.position.copy(hang); neck.add(head);
    const hair = ivyHair(R, seed), off = V3(-hair.K.x, -hair.K.y, -hair.K.z);
    const faceMat = new THREE.MeshLambertMaterial({ map: faces.calm, color: col(0.42, 0.42, 0.42), emissive: col(0.17, 0.17, 0.17), emissiveMap: faces.calm });
    const mask = shadowy(new THREE.Mesh(maskGeo(R), faceMat)); mask.position.copy(off);
    const mane = shadowy(new THREE.Mesh(hair.geo, MAT.plant)); mane.position.copy(off);
    head.add(mask, mane);
    // two tendrils that reach forward from the stalk (their groups turn where they leave it)
    const arms = [-1, 1].map((sx) => {
      const g = new THREE.Group(); g.position.set(sx * 0.07, H * 0.6, -0.16); neck.add(g);
      const ap = [V3(0, 0, 0), V3(sx * 0.3, 0.1, 0.14), V3(sx * 0.42, -0.02, 0.5), V3(sx * 0.3, 0.06, 0.8), V3(sx * 0.2, 0.2, 0.92), V3(sx * 0.24, 0.31, 0.86), V3(sx * 0.3, 0.3, 0.78)];
      g.add(shadowy(new THREE.Mesh(merge([tube(ap, (t) => 0.043 * (1 - 0.84 * t) + 0.003, (t) => mix(IVY.v0, IVY.v2, t * 0.8), 7, 20), place(leaf(0.13, 0.07, 0.3, 0.3, IVY.v2, 0.7), ap[3], V3(sx, 0.6, 0.2))]), MAT.plant)));
      return g;
    });
    // state: how far she is out of the ground (0..1), where she leans, how she shakes, what her face does
    const st = { grow: opts.hidden ? 0 : 1, goal: opts.hidden ? 0 : 1, lean: 0, leanGoal: 0, shake: 0, ph: r() * 10, face: 'calm', shown: 'calm', talk: false, laugh: false };
    const apply = () => { const k = sstep(0, 1, st.grow); obj.scale.set(0.5 + 0.5 * k, Math.max(0.001, k * (1 + 0.12 * Math.sin(PI * st.grow))), 0.5 + 0.5 * k); obj.visible = st.grow > 0.01; };
    const show = (e) => { if (e !== st.shown && faces[e]) { st.shown = e; faceMat.map = faces[e]; faceMat.emissiveMap = faces[e]; } };
    apply();
    const _hp = V3();
    return {
      obj, head, gazer, kind,
      update(dt, t) {
        if (st.grow !== st.goal) { st.grow += clamp(st.goal - st.grow, -dt * 2.2, dt * 2.6); apply(); }
        if (!obj.visible) return;
        st.lean += (st.leanGoal - st.lean) * Math.min(1, dt * 5); st.shake = Math.max(0, st.shake - dt * 1.4);
        const p = t * 1.3 + st.ph, sh = st.shake * Math.sin(t * 34);
        neck.rotation.set(0.07 * Math.sin(p * 0.9) + st.lean * 0.45, 0.1 * Math.sin(p * 0.6), 0.08 * Math.sin(p) + sh * 0.12);
        head.rotation.set(0.12 * Math.sin(p * 1.2 + 1) - st.lean * 0.3 + 0.06, 0.2 * Math.sin(p * 0.7 + 2) + sh * 0.2, 0.1 * Math.sin(p * 1.1) + (st.laugh ? 0.08 * Math.sin(t * 15) : 0));
        arms[0].rotation.set(0.14 * Math.sin(p * 1.4) - st.lean * 0.6, 0.2 * Math.sin(p * 0.8 + 1), 0.12 * Math.sin(p * 1.1));
        arms[1].rotation.set(0.14 * Math.sin(p * 1.3 + 2) - st.lean * 0.6, 0.2 * Math.sin(p * 0.9 + 3), 0.12 * Math.sin(p * 1.2 + 1));
        show(st.talk ? (Math.sin(t * 19 + st.ph) > 0 ? 'open' : 'grin') : st.laugh ? (Math.sin(t * 9 + st.ph) > -0.2 ? 'open' : 'grin') : st.face);
      },
      emerge() { st.goal = 1; }, sink() { st.goal = 0; }, hideNow() { st.grow = st.goal = 0; apply(); }, showNow() { st.grow = st.goal = 1; apply(); },
      lean(k) { st.leanGoal = k; }, shake(k = 1) { st.shake = k; },
      setFace(e) { st.face = e; }, talk(on) { st.talk = !!on; }, laugh(on) { st.laugh = !!on; },
      faceTo(x, z) { obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z); },
      headPos(out) { obj.updateWorldMatrix(true, true); return mask.getWorldPosition(out || _hp); },
      get out() { return st.grow > 0.9; }, get up() { return st.goal > 0 || st.grow > 0.3; },
    };
  }

  // ---------- Myconids, after the 2D game (faces/myconids-faceset.png, the "myconid-fungus" sprites) ----------
  // On the map: a patch of spotted mushrooms. When she is disturbed the big one turns out to be a lady: a pale stem of
  // a body with a frilled collar, long purple hair, purple lips in a smirk, and a great glossy cap pulled down over her
  // eyes like a hat. Her children are small pale stalks with a little cap and a wide mouth.
  const MYC = { skin: col(0.62, 0.62, 0.52), skin2: col(0.42, 0.4, 0.36), hair0: col(0.035, 0.006, 0.035), hair1: col(0.13, 0.014, 0.11), hair2: col(0.4, 0.045, 0.33), gill: col(0.05, 0.006, 0.006),
    cap: { red: [col(0.52, 0.045, 0.045), col(0.8, 0.2, 0.2), col(0.14, 0.012, 0.012)], orange: [col(0.62, 0.2, 0.03), col(0.86, 0.42, 0.12), col(0.2, 0.05, 0.008)],
      blue: [col(0.2, 0.08, 0.5), col(0.42, 0.26, 0.8), col(0.05, 0.02, 0.14)], pink: [col(0.58, 0.18, 0.44), col(0.86, 0.48, 0.7), col(0.16, 0.04, 0.12)] } };      // (blue-violet and lilac-pink: the caves' Myconids)
  // a mushroom cap: a low dome with a rolled rim, glossy on top (a highlight towards the light), gills underneath
  function mycCap(R, h, tones, dots = null) {
    const [c0, c1, c2] = tones, prof = [[0.001, h], [R * 0.3, h * 0.97], [R * 0.6, h * 0.8], [R * 0.86, h * 0.5], [R, h * 0.2], [R * 1.02, h * 0.06], [R * 0.96, -h * 0.03], [R * 0.84, 0.0], [R * 0.5, h * 0.12], [0.001, h * 0.2]];
    const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    return shade(g, (p) => {
      const rad = Math.hypot(p.x, p.z) / R, top = p.y > h * 0.17 || rad > 0.9;
      if (!top) return mix(MYC.gill, c2, 0.25 + 0.5 * rad);                                          // the gills
      const a = Math.atan2(p.z, p.x), hi = Math.exp(-(((rad - 0.42) / 0.26) ** 2)) * Math.exp(-((Math.atan2(Math.sin(a - 2.2), Math.cos(a - 2.2)) / 0.75) ** 2));      // a soft sheen on one shoulder of the cap
      let c = mix(c0, c2, sstep(0.72, 1.02, rad) * 0.75); c = mix(c, c1, hi * 0.8);
      if (dots && Math.sin(a * 5 + rad * 9) * Math.sin(rad * 14 + a * 2) > 0.8 && rad < 0.9) c = dots;
      return c;
    });
  }
  // her face, seen from the front: the cap's shadow lies across the eyes; purple lips, one corner up
  function mycFace() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = '#e0e0d0'; x.fillRect(0, 0, 256, 256);
    let g = x.createRadialGradient(128, 160, 30, 128, 140, 140); g.addColorStop(0, 'rgba(192,184,176,0)'); g.addColorStop(0.7, 'rgba(192,184,176,0.5)'); g.addColorStop(1, 'rgba(136,136,128,0.95)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    g = x.createLinearGradient(0, 70, 0, 150); g.addColorStop(0, 'rgba(48,8,48,0.96)'); g.addColorStop(0.55, 'rgba(70,40,70,0.75)'); g.addColorStop(1, 'rgba(96,80,96,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 150);      // the shadow of the cap
    x.fillStyle = 'rgba(48,8,48,0.96)'; x.fillRect(0, 0, 256, 72);
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(20,4,24,0.55)'; x.lineWidth = 3; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(128 + sx * 30, 116); x.quadraticCurveTo(128 + sx * 48, 108, 128 + sx * 66, 117); x.stroke(); }      // closed, amused eyes in the shadow
    x.strokeStyle = '#888880'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(134, 132); x.quadraticCurveTo(138, 150, 131, 158); x.quadraticCurveTo(126, 161, 121, 157); x.stroke();      // nose
    x.fillStyle = '#601858'; x.beginPath(); x.moveTo(100, 190); x.quadraticCurveTo(116, 183, 128, 187); x.quadraticCurveTo(142, 181, 160, 181); x.quadraticCurveTo(132, 196, 100, 190); x.fill();      // upper lip, the right corner pulled up
    x.fillStyle = '#a83098'; x.beginPath(); x.moveTo(104, 192); x.quadraticCurveTo(130, 210, 156, 185); x.quadraticCurveTo(130, 198, 104, 192); x.fill();
    x.strokeStyle = '#300830'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(99, 190); x.quadraticCurveTo(130, 197, 161, 180); x.stroke();
    x.fillStyle = '#300830'; x.fillRect(0, 0, 18, 18);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  let mycFaceTex = null;
  // one of her children: [group, cap group] (they hop about; the story's capture scenes move them)
  function makeMini(r, tones, s = 1) {
    const g = new THREE.Group(), bits = [];
    bits.push(lathe([[0.001, 0], [0.085, 0], [0.1, 0.05], [0.085, 0.14], [0.07, 0.22], [0.075, 0.27], [0.001, 0.3]], (p) => mix(MYC.skin2, MYC.skin, clamp(p.y * 5 + 0.2, 0, 1)), 14));
    for (const sx of [-1, 1]) { bits.push(place(ball(0.017, col(0.012, 0.008, 0.016), 1, 1.25, 0.6, 8), V3(sx * 0.03, 0.205, 0.066))); bits.push(place(ball(0.03, MYC.skin, 1.5, 0.75, 0.8, 8), V3(sx * 0.1, 0.12, 0.02))); bits.push(place(ball(0.035, MYC.skin2, 1, 0.6, 1.3, 8), V3(sx * 0.045, 0.012, 0.05))); }
    bits.push(place(ball(0.022, col(0.09, 0.012, 0.075), 1.5, 0.9, 0.5, 8), V3(0, 0.155, 0.072)));      // a wide little mouth
    bits.push(place(mycCap(0.15, 0.12, tones), V3(0.012, 0.25, -0.01), quat(-0.22, 0, 0.14)));
    const m = shadowy(new THREE.Mesh(merge(bits), MAT.plant)); g.add(m); g.scale.setScalar(s);
    return g;
  }
  function makeMyconid(seed = 1, tint = 'orange') {
    const r = rng(seed), obj = new THREE.Group(); obj.name = 'Myconid'; obj.userData.emoteY = 1.5;
    const tones = MYC.cap[tint] || MYC.cap.orange, dots = col(0.78, 0.74, 0.6);
    // the patch: spotted mushrooms round about (the map sprite)
    const patch = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + r.r(-0.3, 0.3), d = r.r(0.42, 0.7), s = r.r(0.1, 0.19), x = Math.cos(a) * d, z = Math.sin(a) * d;
      patch.push(place(lathe([[0.001, 0], [s * 0.38, 0], [s * 0.3, s * 0.9], [0.001, s]], MYC.skin, 10), V3(x, 0, z)));
      patch.push(place(mycCap(s * 1.05, s * 0.75, tones, dots), V3(x, s * 0.8, z), quat(r.r(-0.2, 0.2), 0, r.r(-0.2, 0.2))));
    }
    const patchMesh = shadowy(new THREE.Mesh(merge(patch), MAT.plant)); obj.add(patchMesh);
    // her children, hidden among the patch until they are wanted
    const minis = [0, 1, 2].map((i) => { const g = makeMini(r, tones, r.r(0.8, 1.05)); const a = 0.6 + i * 2.1; g.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); g.rotation.y = -a + PI / 2; g.visible = false; obj.add(g); return g; });
    // the lady: she rises out of the ground under her cap
    const lady = new THREE.Group(); obj.add(lady);
    const body = [];
    body.push(lathe([[0.001, 0], [0.24, 0], [0.26, 0.06], [0.2, 0.2], [0.135, 0.42], [0.125, 0.56], [0.15, 0.7], [0.165, 0.78], [0.15, 0.86], [0.075, 0.93], [0.052, 0.97], [0.05, 1.06]],
      (p) => mix(MYC.skin2, MYC.skin, clamp(0.25 + p.y * 0.9, 0, 1)), 22));
    { const n = 40, P = [], C = [], I = [];              // the collar: a frilled ring like the veil of a mushroom, off the shoulders
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, w = 0.5 + 0.5 * Math.sin(a * 9); for (const [rad, y, k] of [[0.15, 0.845, 1], [0.215 + 0.018 * w, 0.8 - 0.012 * w, 0.92], [0.25 + 0.03 * w, 0.72 - 0.03 * w, 0.8]]) { P.push(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.88); const c = mix(MYC.skin2, MYC.skin, k); C.push(c.r, c.g, c.b); } }
      for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 3; I.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); body.push(g); }
    lady.add(shadowy(new THREE.Mesh(merge(body), MAT.plant)));
    const arms = [-1, 1].map((sx) => {
      const g = new THREE.Group(); g.position.set(sx * 0.15, 0.83, 0); lady.add(g);
      const ap = [V3(0, 0, 0), V3(sx * 0.07, -0.15, 0.03), V3(sx * 0.09, -0.3, 0.07), V3(sx * 0.05, -0.4, 0.17), V3(sx * 0.0, -0.44, 0.25)];
      g.add(shadowy(new THREE.Mesh(merge([tube(ap, (t) => 0.036 * (1 - 0.3 * t), (t) => mix(MYC.skin, MYC.skin2, t * 0.4), 8, 14), place(ball(0.034, MYC.skin, 0.8, 1.15, 0.7, 8), ap[4])]), MAT.plant)));
      return g;
    });
    const head = new THREE.Group(); head.position.set(0, 1.16, 0.01); lady.add(head);
    const R = 0.118; mycFaceTex = mycFaceTex || mycFace();
    head.add(shadowy(new THREE.Mesh(maskGeo(R), new THREE.MeshLambertMaterial({ map: mycFaceTex, color: col(0.44, 0.44, 0.44), emissive: col(0.1, 0.1, 0.1), emissiveMap: mycFaceTex }))));
    { const O = V3(0, 0, 0), K = V3(0, 1.0 * R, -0.1 * R), locks = [];      // long waves of purple hair from under the cap, over the shoulders and down her back
      const tone = (i) => (t) => mix(mix(MYC.hair0, MYC.hair1, 0.3 + 0.7 * ((i * 0.41) % 1)), MYC.hair2, 0.75 * Math.pow(Math.sin(PI * Math.min(1, t * 1.1)), 2) * ((i % 3) ? 0.6 : 1));
      const wide = (W) => (t) => W * Math.pow(Math.sin(PI * Math.pow(Math.min(1, t * 1.02), 0.55)), 0.7) + 0.004;
      [60, 82, 106, 130, 155, 180, -155, -130, -106, -82, -60].forEach((deg, i) => {
        const a = deg * PI / 180 + r.r(-0.04, 0.04), dx = Math.sin(a), dz = Math.cos(a), L = r.r(0.9, 1.15), front = Math.abs(deg) < 70, wv = r.r(0.6, 1.2) * (i % 2 ? 1 : -1);
        locks.push(lock([K, V3(dx * 0.7 * R, 0.85 * R, dz * 0.7 * R), V3(dx * 1.02 * R, 0.2 * R, dz * 0.98 * R), V3(dx * (1.08 + 0.1 * wv) * R, -0.7 * R, dz * (front ? 0.85 : 1.1) * R),
          V3(dx * (1.3 - 0.12 * wv) * R, -1.7 * R, dz * (front ? 0.7 : 1.35) * R + (front ? 0.5 * R : 0)), V3(dx * (1.45 + 0.14 * wv) * R, -2.7 * R * L, dz * (front ? 0.6 : 1.5) * R + (front ? 0.75 * R : 0)),
          V3(dx * (1.3 - 0.1 * wv) * R, -3.6 * R * L, dz * (front ? 0.5 : 1.45) * R + (front ? 0.8 * R : 0)), V3(dx * (1.5 + 0.2 * wv) * R, -4.2 * R * L, dz * (front ? 0.45 : 1.5) * R + (front ? 0.9 * R : 0))],
          wide(R * r.r(0.8, 1.0)), tone(i), O, 0.3, 16));
      });
      head.add(shadowy(new THREE.Mesh(merge(locks), MAT.plant)));
    }
    // the cap, worn low: its rim hides her eyes
    const cap = shadowy(new THREE.Mesh(mycCap(0.33, 0.2, tones), MAT.plant)); cap.position.set(0, R * 0.62, -0.03); cap.rotation.set(-0.3, 0, -0.07); head.add(cap);      // (pushed back: her mouth must show from where the camera usually is)
    const st = { up: 0, goal: 0, hop: 0, ph: r() * 9, kids: 0, kidGoal: 0, size: 1 };
    const apply = () => {
      const k = sstep(0, 1, st.up);                    // asleep, only her cap shows: one more mushroom in the patch
      lady.position.y = -1.32 * (1 - k); lady.scale.setScalar((0.9 + 0.28 * k) * st.size);
    };
    apply();
    return {
      obj, body: lady, head, minis, arms, patch: patchMesh,      // (arms, patch: a scene that has her hold somebody hides her own arms and draws its own; and may hide the mushrooms round her)
      update(dt, t) {
        if (st.up !== st.goal) { st.up += clamp(st.goal - st.up, -dt * 2.2, dt * 2.6); apply(); }
        st.hop = Math.max(0, st.hop - dt * 2);
        const k = sstep(0, 1, st.up), p = t * 1.2 + st.ph;
        lady.position.y += 0;                           // (set by apply)
        lady.rotation.set(0.03 * Math.sin(p * 0.9) * k, 0.12 * Math.sin(p * 0.6) * k, 0.045 * Math.sin(p) * k + st.hop * 0.1 * Math.sin(t * 22));
        head.rotation.set(0.05 * Math.sin(p * 1.3) * k + 0.04, 0.14 * Math.sin(p * 0.8) * k, 0.07 * Math.sin(p * 1.1) * k);
        arms[0].rotation.set(-0.1 * Math.sin(p * 1.1) - 0.25 * st.hop, 0, -0.12 - 0.05 * Math.sin(p));
        arms[1].rotation.set(-0.1 * Math.sin(p * 1.2 + 1) - 0.25 * st.hop, 0, 0.12 + 0.05 * Math.sin(p + 2));
        if (st.kids !== st.kidGoal) st.kids += clamp(st.kidGoal - st.kids, -dt * 3, dt * 3);
        minis.forEach((g, i) => {
          g.visible = st.kids > 0.02; if (!g.visible) return;
          if (!g.userData.held) g.position.y = Math.abs(Math.sin(t * 7 + i * 2.1)) * 0.07 * st.kids;
          const s0 = g.userData.s0 || (g.userData.s0 = g.scale.x); g.scale.set(s0 * st.kids, s0 * st.kids * (1 + 0.08 * Math.sin(t * 14 + i)), s0 * st.kids);
        });
      },
      wake() { st.goal = 1; }, sleep() { st.goal = 0; st.kidGoal = 0; }, hop() { st.hop = 1; },
      rise(k) { st.goal = k; }, upNow(k = 1) { st.up = st.goal = k; apply(); },      // (how far out of the ground: 1 = all of her)
      size(m = 1) { st.size = m; apply(); },             // (drawn up to her full height: the one who holds Anne stands a head taller than her, as in the 2D sheet)
      kids(on) { st.kidGoal = on ? 1 : 0; },
      faceTo(x, z) { obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z); },
    };
  }

  // ---------- Amaymon: a dark glass ball with one big eye and a ruff of lazy tentacles ----------
  function makeAmaymon() {
    const obj = new THREE.Group(); obj.name = 'Amaymon'; obj.userData.emoteY = 0.22;
    const glass = new THREE.MeshStandardMaterial({ color: col(0.02, 0.02, 0.09), roughness: 0.12, metalness: 0.1, emissive: col(0.03, 0.02, 0.12), envMapIntensity: 1.4 });
    obj.add(shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), glass)));
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 60); g.addColorStop(0, '#ffd6fb'); g.addColorStop(0.45, '#f05ad8'); g.addColorStop(0.8, '#7a2ab8'); g.addColorStop(1, 'rgba(40,10,90,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(60, 60, 13, 22, 0.5, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(84, 44, 6, 0, TAU); x.fill();
    const et = new THREE.CanvasTexture(cv); et.colorSpace = THREE.SRGBColorSpace;
    const eyeMat = new THREE.MeshBasicMaterial({ map: et, transparent: true, toneMapped: false, depthWrite: false });
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), eyeMat); eye.position.z = 0.092; obj.add(eye);
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.066, 20, 0, PI), new THREE.MeshBasicMaterial({ color: 0x06061a })); lid.position.z = 0.094; lid.scale.y = 0.001; obj.add(lid);
    const tm = new THREE.MeshLambertMaterial({ vertexColors: true }), dark = col(0.03, 0.025, 0.07), dark2 = col(0.07, 0.05, 0.14);
    const tents = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + 0.2, grp = new THREE.Group(), L = 0.2 + (i % 3) * 0.04;
      grp.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, -0.03); grp.rotation.z = a - PI / 2;
      grp.add(new THREE.Mesh(tube([V3(0, 0, 0), V3(0.02, L * 0.4, -0.03), V3(-0.02, L * 0.75, -0.06), V3(0.03, L, -0.03)], (t) => 0.022 * (1 - 0.85 * t), (t) => mix(dark, dark2, t), 6, 10), tm));
      obj.add(grp); tents.push(grp);
    }
    const st = { talk: 0, blink: 2, ph: 0, home: V3(), has: false, shown: 0, goal: 0 };
    obj.visible = false;
    return {
      obj,
      update(dt, t) {
        st.shown += clamp(st.goal - st.shown, -dt * 4, dt * 4); obj.visible = st.shown > 0.01;
        if (!obj.visible) return;
        const k = sstep(0, 1, st.shown); obj.scale.setScalar(k * (1 + 0.06 * st.talk * Math.sin(t * 20)));
        st.talk = Math.max(0, st.talk - dt * 3);
        if (st.has) obj.position.set(st.home.x, st.home.y + 0.035 * Math.sin(t * 1.7) + 0.02 * st.talk * Math.sin(t * 13), st.home.z);
        tents.forEach((g, i) => { g.rotation.x = 0.35 * Math.sin(t * 2.1 + i * 1.3) + 0.3; g.rotation.y = 0.3 * Math.sin(t * 1.6 + i * 2.1); });
        st.blink -= dt; lid.scale.y = st.blink < 0.1 ? 1 : 0.001; if (st.blink < 0) st.blink = 2 + Math.random() * 3;
        eye.scale.setScalar(1 + 0.12 * st.talk * Math.sin(t * 24));
      },
      // float at a point, looking at something
      hover(p, lookAt) { st.home.copy(p); st.has = true; st.goal = 1; if (lookAt) obj.lookAt(lookAt.x, p.y, lookAt.z); if (st.shown < 0.02) obj.position.copy(p); },
      look(p) { obj.lookAt(p.x, obj.position.y + (p.y - obj.position.y) * 0.3, p.z); },
      hide() { st.goal = 0; }, talk() { st.talk = 1; },
    };
  }

  // ---------- small props ----------
  // a herb to pick: a tuft of bright leaves with a pale bud
  function makeHerb(seed = 1) {
    const r = rng(seed), parts = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r.r(-0.2, 0.2); parts.push(place(leaf(r.r(0.2, 0.32), r.r(0.07, 0.1), 0.5, 0.3, i % 2 ? col(0.16, 0.42, 0.14) : col(0.1, 0.34, 0.16), 0.6, 5), V3(0, 0.01, 0), V3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6))); }
    parts.push(tube([V3(0, 0, 0), V3(0.01, 0.2, 0), V3(0, 0.36, 0.02)], (t) => 0.012 * (1 - 0.4 * t), () => col(0.1, 0.3, 0.1), 5, 6));
    parts.push(place(flower(0.07, 5, col(0.75, 0.72, 0.5), col(0.8, 0.8, 0.7), 0.3), V3(0, 0.36, 0.02), V3(0.1, 1, 0.2)));
    const m = shadowy(new THREE.Mesh(merge(parts), MAT.vine), false); m.name = 'Herb';
    return { obj: m };
  }
  function makeSignpost(arms = 2) {
    const parts = [place(paint(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 8), G.wood), V3(0, 0.75, 0))];
    for (let i = 0; i < arms; i++) {
      const g = paint(new THREE.BoxGeometry(0.62, 0.17, 0.035), i ? G.wood2 : mix(G.wood2, G.wood, 0.3));
      const P = g.attributes.position; for (let k = 0; k < P.count; k++) if (P.getX(k) * (i ? -1 : 1) > 0.3) P.setY(k, P.getY(k) * 0.1);      // a pointed end
      parts.push(place(g, V3((i ? -1 : 1) * 0.2, 1.3 - i * 0.24, 0.05), quat(0, 0, (i ? 1 : -1) * 0.05)));
    }
    const m = shadowy(new THREE.Mesh(merge(parts), MAT.plant)); m.name = 'Signpost'; m.userData.emoteY = 1.5;
    return { obj: m };
  }
  // Anne's hat, loose (beside her while she sleeps; knocked off her head by a vine): brim, crooked crown, gold band
  function makeWitchHat() {
    const purple = col(0.21, 0.075, 0.44), under = col(0.1, 0.035, 0.24), gold = col(0.5, 0.3, 0.04), parts = [];
    const brim = new THREE.LatheGeometry([[0.085, 0.0], [0.2, -0.012], [0.3, -0.03], [0.325, -0.026], [0.3, -0.018], [0.2, 0.0], [0.11, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    parts.push(shade(brim, (p) => (p.y > -0.005 && Math.hypot(p.x, p.z) < 0.31 ? purple : under)));
    const N = 14, P = [], C = [], I = [], sides = 20;                       // the crown: a cone that leans and hooks over at the tip
    for (let i = 0; i <= N; i++) {
      const t = i / N, r = 0.108 * Math.pow(1 - t, 0.85) + 0.004, y = 0.01 + 0.46 * t - 0.05 * t * t, off = 0.13 * t * t * t + 0.02 * t;
      for (let k = 0; k < sides; k++) { const a = k / sides * TAU; P.push(Math.cos(a) * r, y, Math.sin(a) * r - off); const c = t < 0.13 ? gold : mix(purple, under, 0.25 * t); C.push(c.r, c.g, c.b); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides; I.push(a, a + sides, b, b, a + sides, b + sides); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); parts.push(g);
    const m = shadowy(new THREE.Mesh(merge(parts), MAT.plant)); m.name = 'WitchHat'; m.visible = false;
    // (10-04) It is the hat of the look the player gave her: in its colours; and with a look that has no hat, none ever
    // flies off or lies about (window.__hatLook = { worn, hat, band, n }, kept by index.html from looks.js).
    const CA = m.geometry.attributes.color, base = CA.array.slice(), sum0 = purple.r + purple.g + purple.b, _h = new THREE.Color(), _b = new THREE.Color();
    function tint(hatCss, bandCss) {
      const a = CA.array; if (hatCss) _h.set(hatCss); if (bandCss) _b.set(bandCss);
      for (let i = 0; i < a.length; i += 3) {
        const r = base[i], g = base[i + 1], b = base[i + 2], isBand = r > b * 2;
        if (isBand) { if (bandCss) { a[i] = _b.r * 0.62; a[i + 1] = _b.g * 0.62; a[i + 2] = _b.b * 0.62; } else { a[i] = r; a[i + 1] = g; a[i + 2] = b; } }
        else if (hatCss) { const k = 1.3 * (r + g + b) / sum0; a[i] = _h.r * k + 0.004; a[i + 1] = _h.g * k + 0.003; a[i + 2] = _h.b * k + 0.004; } else { a[i] = r; a[i + 1] = g; a[i + 2] = b; }
      }
      CA.needsUpdate = true;
    }
    let want = false, seen = -1;
    Object.defineProperty(m, 'visible', { configurable: true, enumerable: true, set: (v) => { want = !!v; },
      get: () => { const L = typeof window !== 'undefined' ? window.__hatLook : null; if (L && L.n !== seen) { seen = L.n; tint(L.hat, L.band); } return want && !(L && L.worn === false); } });
    return { obj: m, tint };
  }
  // the hole in the glade: a dark shaft ringed with roots and flowers
  function makeHole() {
    const obj = new THREE.Group(); obj.name = 'Hole';
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), MAT.dark); disc.rotation.x = -PI / 2; disc.position.y = 0.035; obj.add(disc);
    const parts = [], r = rng(77);
    const rim = new THREE.TorusGeometry(0.66, 0.11, 8, 28); rim.rotateX(PI / 2); parts.push(place(shade(rim, (p) => mix(col(0.07, 0.045, 0.025), col(0.12, 0.08, 0.04), clamp(p.y * 6 + 0.5, 0, 1))), V3(0, 0.02, 0)));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + r.r(-0.2, 0.2);
      parts.push(tube([V3(Math.cos(a) * 0.5, -0.25, Math.sin(a) * 0.5), V3(Math.cos(a) * 0.68, 0.14, Math.sin(a) * 0.68), V3(Math.cos(a + 0.4) * 0.95, 0.06, Math.sin(a + 0.4) * 0.95), V3(Math.cos(a + 0.7) * 1.2, -0.05, Math.sin(a + 0.7) * 1.2)], (t) => 0.05 * (1 - 0.7 * t), (t) => mix(G.stem0, G.stem1, t * 0.6), 6, 12));
      if (i % 2) parts.push(place(flower(0.11, 6, G.pink, G.pink2), V3(Math.cos(a + 0.2) * r.r(0.85, 1.15), 0.1, Math.sin(a + 0.2) * r.r(0.85, 1.15)), V3(r.r(-0.3, 0.3), 1, r.r(-0.3, 0.3))));
      parts.push(place(leaf(0.3, 0.17, 0.4, 0.25, i % 2 ? G.leaf : G.leaf2), V3(Math.cos(a) * 0.8, 0.04, Math.sin(a) * 0.8), V3(Math.cos(a), 0.5, Math.sin(a))));
    }
    obj.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant)));
    return { obj };
  }
  // the goddess shrine: a small weathered statue on a plinth
  function makeShrine() {
    const parts = [place(paint(new THREE.BoxGeometry(0.8, 0.22, 0.8), G.stone), V3(0, 0.11, 0)), place(paint(new THREE.BoxGeometry(0.56, 0.2, 0.56), mix(G.stone, col(0.3, 0.3, 0.28), 0.4)), V3(0, 0.32, 0))];
    parts.push(place(lathe([[0.17, 0], [0.2, 0.12], [0.12, 0.5], [0.15, 0.78], [0.1, 0.92], [0.001, 0.95]], (p) => mix(G.stone, col(0.1, 0.2, 0.08), clamp(0.35 - p.y * 0.3, 0, 1)), 14), V3(0, 0.42, 0)));
    parts.push(place(ball(0.11, mix(G.stone, col(0.3, 0.3, 0.28), 0.5), 1, 1.12, 1), V3(0, 1.48, 0)));
    for (const sx of [-1, 1]) parts.push(tube([V3(sx * 0.13, 1.18, 0), V3(sx * 0.22, 1.02, 0.1), V3(sx * 0.07, 0.98, 0.2)], (t) => 0.04 * (1 - 0.3 * t), () => G.stone, 6, 8));
    parts.push(place(lathe([[0.001, 0], [0.09, 0.02], [0.12, 0.08]], col(0.26, 0.25, 0.22), 12), V3(0, 0.98, 0.2)));
    const m = shadowy(new THREE.Mesh(merge(parts), MAT.plant)); m.name = 'Shrine'; m.userData.emoteY = 1.8;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: col(1.6, 1.5, 0.9), toneMapped: false })); light.position.set(0, 1.09, 0.2);
    const obj = new THREE.Group(); obj.add(m, light); obj.userData.emoteY = 1.8;
    return { obj, update(dt, t) { light.scale.setScalar(0.85 + 0.2 * Math.sin(t * 2.2)); } };
  }

  // ---------- Alraune's flower: a great rose-pink bloom on a bed of leaves and coiling vines ----------
  // Her body is a separate object (the Blender-built figure, or the stand-in below) standing in `seat`.
  function makeBloom() {
    const obj = new THREE.Group(); obj.name = 'AlrauneBloom'; obj.userData.emoteY = 2.5;
    const r = rng(404), parts = [];
    for (let ring = 0; ring < 3; ring++) {
      const n = [9, 8, 6][ring], L = [1.05, 0.85, 0.6][ring], tilt = [0.35, 0.75, 1.1][ring];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + ring * 0.4 + r.r(-0.06, 0.06);
        parts.push(place(leaf(L, L * 0.72, 0.42, 0.22, mix(G.pink, G.pink2, ring * 0.35 + r() * 0.2), 0.8, 7), V3(Math.cos(a) * 0.16, 0.34 + ring * 0.06, Math.sin(a) * 0.16), V3(Math.cos(a), tilt, Math.sin(a))));
      }
    }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; parts.push(place(leaf(1.25, 0.6, 0.3, 0.2, i % 2 ? G.leaf : G.leaf2, 0.6, 7), V3(Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2), V3(Math.cos(a), 0.22, Math.sin(a)))); }
    parts.push(place(lathe([[0.001, 0], [0.5, 0], [0.56, 0.16], [0.46, 0.4], [0.33, 0.52], [0.001, 0.55]], (p) => mix(col(0.05, 0.16, 0.06), col(0.16, 0.34, 0.1), clamp(p.y * 2, 0, 1)), 20), V3(0, 0, 0)));
    for (let i = 0; i < 7; i++) {                  // the vines that coil out over the ground
      const a = i / 7 * TAU + r.r(-0.2, 0.2), L = r.r(1.5, 2.3), pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, b = a + 0.9 * t * (i % 2 ? 1 : -1); pts.push(V3(Math.cos(b) * (0.4 + L * t), 0.12 * Math.sin(PI * t) + 0.04 + (k === 6 ? 0.22 : 0), Math.sin(b) * (0.4 + L * t))); }
      parts.push(tube(pts, (t) => 0.085 * (1 - 0.8 * t), (t) => mix(G.stem0, G.stem1, t), 7, 20));
      const cv = new THREE.CatmullRomCurve3(pts);
      for (let k = 0; k < 3; k++) parts.push(place(leaf(r.r(0.2, 0.3), 0.14, 0.4, 0.25, k % 2 ? G.leaf : G.leaf2), cv.getPoint(0.25 + k * 0.25), V3(r.r(-0.5, 0.5), 1, r.r(-0.5, 0.5))));
    }
    const bloom = shadowy(new THREE.Mesh(merge(parts), MAT.vine)); obj.add(bloom);
    const seat = new THREE.Group(); seat.position.y = 0.72; obj.add(seat);      // (her hips; high enough for her gown to show over the petals)
    const st = { grow: 0, goal: 0 };
    const apply = () => { const k = sstep(0, 1, st.grow); obj.scale.set(0.3 + 0.7 * k, Math.max(0.001, k * (1 + 0.1 * Math.sin(PI * st.grow))), 0.3 + 0.7 * k); obj.visible = st.grow > 0.01; };
    apply();
    return { obj, seat, update(dt) { if (st.grow !== st.goal) { st.grow += clamp(st.goal - st.grow, -dt * 0.9, dt * 0.9); apply(); } },
      emerge() { st.goal = 1; }, sink() { st.goal = 0; }, showNow() { st.grow = st.goal = 1; apply(); }, hideNow() { st.grow = st.goal = 0; apply(); }, get out() { return st.grow > 0.95; }, get up() { return st.goal > 0 || st.grow > 0.3; } };
  }

  // ---------- the caves and the nest (10-02) ----------
  // a chest: wooden (iron bands) or blue-and-gold; open(k) lifts the lid (0 shut .. 1 open)
  function makeChest(blue = false) {
    const obj = new THREE.Group(); obj.name = 'Chest'; obj.userData.emoteY = 0.9;
    const body = blue ? col(0.06, 0.12, 0.42) : G.wood2, band = blue ? col(0.8, 0.6, 0.16) : col(0.14, 0.12, 0.1);
    const box = [place(paint(new THREE.BoxGeometry(0.62, 0.34, 0.42), body), V3(0, 0.17, 0))];
    for (const x of [-0.24, 0.24]) box.push(place(paint(new THREE.BoxGeometry(0.05, 0.35, 0.43), band), V3(x, 0.17, 0)));
    box.push(place(paint(new THREE.BoxGeometry(0.1, 0.12, 0.04), band), V3(0, 0.3, 0.22)));
    obj.add(shadowy(new THREE.Mesh(merge(box), MAT.plant)));
    const lidG = new THREE.CylinderGeometry(0.21, 0.21, 0.62, 16, 1, false, 0, PI); lidG.rotateZ(PI / 2); lidG.translate(0, 0, 0.21);
    const lid = [paint(lidG, body)]; for (const x of [-0.24, 0.24]) { const b = new THREE.CylinderGeometry(0.215, 0.215, 0.05, 16, 1, false, 0, PI); b.rotateZ(PI / 2); b.translate(x, 0, 0.21); lid.push(paint(b, band)); }
    const hinge = new THREE.Group(); hinge.position.set(0, 0.34, -0.21); obj.add(hinge);
    const lm = shadowy(new THREE.Mesh(merge(lid), MAT.plant)); lm.rotation.x = -PI / 2; hinge.add(lm);
    const glow = new THREE.PointLight(blue ? 0x8fb8ff : 0xffd27a, 0, 1.6); glow.position.set(0, 0.45, 0); obj.add(glow);
    let k = 0;
    return { obj, open(v = 1) { k = v; hinge.rotation.x = -1.9 * k; glow.intensity = 0; }, burst() { glow.intensity = 2.2; }, update(dt) { if (glow.intensity > 0) glow.intensity = Math.max(0, glow.intensity - dt * 2.2); } };
  }
  // a crystal plant: pale green crystal spikes with glowing blue orbs, over ferns with small flowers (the 2D's D tiles 560/561)
  function makeCrystalPlant(seed = 1, flowerCol = null) {
    const obj = new THREE.Group(); obj.name = 'CrystalPlant'; const r = rng(seed), parts = [], glowP = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r.r(-0.3, 0.3); parts.push(place(leaf(r.r(0.5, 0.75), 0.22, 0.4, 0.2, i % 2 ? G.leaf : G.leaf2, 0.6, 6), V3(Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08), V3(Math.cos(a), 0.45, Math.sin(a)))); }
    const fc = flowerCol || (r() < 0.5 ? col(0.3, 0.45, 1.0) : G.yellow);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = r.r(0.2, 0.45); parts.push(place(flower(0.06, 5, fc, mix(fc, col(1, 1, 1), 0.4)), V3(Math.cos(a) * d, 0.12, Math.sin(a) * d), V3(0, 1, 0))); }
    const crystal = new THREE.MeshPhongMaterial({ color: col(0.55, 0.95, 0.75), emissive: col(0.08, 0.2, 0.15), specular: col(0.9, 1, 0.95), shininess: 90, transparent: true, opacity: 0.82, flatShading: true });
    const cg = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + r.r(-0.2, 0.2), tilt = r.r(0.15, 0.55), L = r.r(0.45, 0.95), g = new THREE.ConeGeometry(r.r(0.05, 0.09), L, 5); g.translate(0, L / 2, 0);
      const q = quat(tilt * Math.sin(a), 0, -tilt * Math.cos(a)); g.applyQuaternion(q); g.translate(Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12); cg.push(g);
      if (i % 2 === 0) glowP.push(V3(Math.cos(a) * (0.16 + L * 0.5 * Math.sin(tilt)), 0.25 + L * 0.85, Math.sin(a) * (0.16 + L * 0.5 * Math.sin(tilt))));
    }
    obj.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant)));
    const cm = new THREE.Mesh(merge(cg), crystal); cm.castShadow = true; obj.add(cm);
    const orbM = new THREE.MeshBasicMaterial({ color: col(0.6, 1.3, 2.4), toneMapped: false }), orbs = [];
    for (const p of glowP) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), orbM); o.position.copy(p); obj.add(o); orbs.push(o); }
    const light = new THREE.PointLight(0x7fc4ff, 1.4, 3.2, 1.6); light.position.set(0, 0.9, 0); obj.add(light);
    return { obj, update(dt, t) { const k = 0.85 + 0.15 * Math.sin(t * 1.7 + seed); orbs.forEach((o, i) => o.scale.setScalar(k + 0.08 * Math.sin(t * 2.3 + i))); light.intensity = 1.2 * k; } };
  }
  // a skeleton lying on its side in the grass (the 2D's B tile 250)
  function makeSkeleton() {
    const bone = col(0.78, 0.74, 0.62), parts = [place(ball(0.11, bone, 1, 0.9, 1.15, 10), V3(-0.55, 0.1, 0))];
    parts.push(place(paint(new THREE.SphereGeometry(0.025, 6, 5), col(0.05, 0.04, 0.03)), V3(-0.62, 0.13, 0.06)), place(paint(new THREE.SphereGeometry(0.025, 6, 5), col(0.05, 0.04, 0.03)), V3(-0.62, 0.13, -0.05)));
    parts.push(tube([V3(-0.44, 0.06, 0), V3(-0.1, 0.07, 0.02), V3(0.18, 0.06, 0)], () => 0.02, () => bone, 6, 10));       // the spine
    for (let i = 0; i < 5; i++) { const x = -0.38 + i * 0.07; parts.push(tube([V3(x, 0.06, 0.0), V3(x + 0.02, 0.15, 0.08), V3(x + 0.03, 0.14, 0.17)], () => 0.012, () => bone, 5, 6)); parts.push(tube([V3(x, 0.06, 0), V3(x + 0.02, 0.15, -0.08), V3(x + 0.03, 0.14, -0.17)], () => 0.012, () => bone, 5, 6)); }
    for (const sz of [-1, 1]) { parts.push(tube([V3(0.18, 0.05, 0.05 * sz), V3(0.55, 0.04, 0.12 * sz), V3(0.9, 0.04, 0.08 * sz)], () => 0.018, () => bone, 6, 10)); parts.push(tube([V3(-0.4, 0.06, 0.08 * sz), V3(-0.25, 0.05, 0.3 * sz), V3(0.0, 0.04, 0.36 * sz)], () => 0.014, () => bone, 6, 10)); }
    const obj = new THREE.Group(); obj.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant))); obj.userData.emoteY = 0.6;
    const scroll = new THREE.Group(); scroll.add(new THREE.Mesh(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10).rotateZ(PI / 2), col(0.86, 0.8, 0.6)), MAT.plant)); scroll.position.set(-0.2, 0.05, 0.3); obj.add(scroll);
    return { obj, scroll };
  }
  // a shaft of daylight through the roof (the caves' way in and out; the nest's hole)
  function makeLightShaft(h = 6, r = 0.75) {
    const obj = new THREE.Group(); obj.name = 'LightShaft';
    const g = new THREE.CylinderGeometry(r * 0.75, r, h, 24, 6, true); g.translate(0, h / 2, 0);
    const pos = g.attributes.position, cl = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = 1 - pos.getY(i) / h, a = (0.15 * Math.pow(k, 0.6) + 0.025) * Math.min(1, k * 5); cl[i * 3] = a; cl[i * 3 + 1] = a * 0.98; cl[i * 3 + 2] = a * 0.9; }
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, toneMapped: false }));      // (one-sided: from inside it, as the camera may be, it is not there)
    m.renderOrder = 4; obj.add(m);      // (10-04: these two statements had been swallowed by the comment above when it was added: the shaft itself was never in the scene)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 1.15, 32), new THREE.MeshBasicMaterial({ color: col(0.35, 0.34, 0.3), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    disc.rotation.x = -PI / 2; disc.position.y = 0.03; disc.renderOrder = 3; obj.add(disc);
    const light = new THREE.PointLight(0xfff2d8, 6, 7, 1.3); light.position.set(0, 2.2, 0); obj.add(light);
    return { obj, light, update(dt, t) { m.material.opacity = 1; disc.material.opacity = 0.5 + 0.08 * Math.sin(t * 0.7); } };
  }
  // twisted climbing vines hanging down a hedge face (the nest's way back up)
  function makeVineLadder(h = 2.6, seed = 5) {
    const r = rng(seed), parts = [];
    for (let i = 0; i < 4; i++) {
      const x0 = -0.3 + i * 0.2, pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(V3(x0 + 0.08 * Math.sin(t * 9 + i * 1.7), h * (1 - t), 0.05 * Math.cos(t * 7 + i))); }
      parts.push(tube(pts, () => 0.035, (t) => mix(col(0.24, 0.15, 0.06), col(0.36, 0.24, 0.1), 0.5 + 0.5 * Math.sin(t * 13 + i)), 6, 24));
    }
    for (let k = 1; k < 6; k++) parts.push(tube([V3(-0.33, h * k / 6, 0.03), V3(0, h * k / 6 + 0.04, 0.07), V3(0.33, h * k / 6, 0.03)], () => 0.025, () => col(0.3, 0.2, 0.08), 5, 8));
    for (let i = 0; i < 14; i++) parts.push(place(leaf(r.r(0.12, 0.2), 0.1, 0.4, 0.25, i % 2 ? G.leaf : G.leaf2), V3(r.r(-0.35, 0.35), r.r(0.2, h), 0.08), V3(r.r(-0.5, 0.5), 0.3, 1)));
    const obj = new THREE.Group(); obj.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant))); return { obj };
  }
  // an aloe: a rosette of thick spiky leaves; ripe: two flower stalks (red-orange bells)
  function makeAloe(seed = 3) {
    const r = rng(seed), parts = [];
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + r.r(-0.2, 0.2), tilt = r.r(0.35, 0.8), L = r.r(0.32, 0.5), g = new THREE.ConeGeometry(0.045, L, 5); g.translate(0, L / 2, 0); g.scale(1, 1, 0.45);
      g.applyQuaternion(quat(tilt * Math.sin(a), -a, -tilt * Math.cos(a))); parts.push(paint(g, mix(col(0.22, 0.42, 0.24), col(0.36, 0.55, 0.32), r()))); }
    const stalks = [];
    for (let i = 0; i < 2; i++) { const s = []; const x = (i ? 0.06 : -0.05); s.push(tube([V3(x, 0.1, 0), V3(x * 1.4, 0.45, 0.02), V3(x * 1.8, 0.75, 0.04)], () => 0.012, () => col(0.25, 0.4, 0.18), 5, 8));
      for (let k = 0; k < 6; k++) s.push(place(cone(0.025, 0.07, col(0.9, 0.35, 0.12), 6), V3(x * 1.8 + 0.02 * Math.sin(k), 0.58 + k * 0.035, 0.04), V3(0, -1, 0))); stalks.push(new THREE.Mesh(merge(s), MAT.plant)); }
    const obj = new THREE.Group(); obj.add(shadowy(new THREE.Mesh(merge(parts), MAT.plant))); for (const m of stalks) obj.add(m);
    return { obj, picked(v) { for (const m of stalks) m.visible = !v; } };
  }
  // a crumpled sheet of paper with a doodle (Amaymon's drawing in the nest: clothed here: her feet, "TICKLE HERE")
  function makeDoodle() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 640; const x = cv.getContext('2d');
    x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 512, 640); x.strokeStyle = 'rgba(120,100,70,0.35)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(Math.random() * 512, 0); x.lineTo(Math.random() * 512, 640); x.stroke(); }
    x.strokeStyle = '#2b2440'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(200, 70); x.lineTo(256, 10); x.lineTo(312, 70); x.closePath(); x.stroke(); x.beginPath(); x.ellipse(256, 75, 110, 18, 0, 0, Math.PI * 2); x.stroke();      // her hat
    x.beginPath(); x.arc(256, 135, 48, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(238, 128, 5, 0, Math.PI * 2); x.arc(274, 128, 5, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(256, 150, 18, 0.2, Math.PI - 0.2); x.stroke();
    x.beginPath(); x.moveTo(205, 190); x.lineTo(307, 190); x.lineTo(320, 360); x.lineTo(192, 360); x.closePath(); x.stroke();      // her suit
    x.beginPath(); x.moveTo(215, 360); x.lineTo(205, 520); x.moveTo(297, 360); x.lineTo(307, 520); x.stroke();
    for (const [cx, s] of [[185, -1], [327, 1]]) { x.beginPath(); x.ellipse(cx, 545, 42, 26, 0, 0, Math.PI * 2); x.stroke(); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + s * (-24 + k * 12), 512, 6, 0, Math.PI * 2); x.stroke(); } }
    x.fillStyle = '#c4122f'; x.font = 'bold 44px Georgia'; x.fillText('TICKLE HERE', 120, 620); x.strokeStyle = '#c4122f'; x.lineWidth = 5;
    for (const [ax, ay] of [[130, 590], [400, 590]]) { x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax < 256 ? 170 : 345, 565); x.stroke(); }
    x.fillStyle = '#e8457f'; x.font = '40px Georgia'; for (const [hx, hy] of [[60, 120], [440, 200], [70, 420], [450, 470]]) x.fillText('♥', hx, hy);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.PlaneGeometry(0.8, 1.0, 8, 10), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.03 * Math.sin(p.getX(i) * 9) * Math.cos(p.getY(i) * 7));
    g.computeVertexNormals(); const obj = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })); obj.visible = false;
    return { obj };
  }

  // sparkles: a burst of small glowing quads (spell hits, pickups); one pooled Points object
  function makeSparks(n = 160) {
    const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; let next = 0;
    for (let i = 0; i < n; i++) pos[i * 3 + 1] = -99;
    return {
      obj: pts,
      burst(p, c, count = 24, speed = 1.6, up = 1.2) {
        for (let k = 0; k < count; k++) {
          const i = next; next = (next + 1) % n; const a = Math.random() * TAU, e = Math.random() * 1.2 - 0.2, s = speed * (0.4 + Math.random() * 0.8);
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; vel[i * 3] = Math.cos(a) * Math.cos(e) * s; vel[i * 3 + 1] = Math.sin(e) * s + up; vel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s;
          const b = 0.7 + Math.random() * 0.8; colr[i * 3] = c.r * b; colr[i * 3 + 1] = c.g * b; colr[i * 3 + 2] = c.b * b; life[i] = 0.6 + Math.random() * 0.6;
        }
      },
      update(dt) {
        let any = false;
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue; any = true; life[i] -= dt;
          vel[i * 3 + 1] -= 3.2 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (life[i] <= 0) pos[i * 3 + 1] = -99; else if (life[i] < 0.3) { colr[i * 3] *= 0.9; colr[i * 3 + 1] *= 0.9; colr[i * 3 + 2] *= 0.9; }
        }
        if (any) { geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; }
      },
    };
  }

  return { time, tube, leaf, ball, cone, flower, merge, place, lathe, shade, paint, col, mix, rng, MAT, G, IVY, MYC, quat, quatY, shadowy, faceTex, headGeo, V3, makeMini,
    makeVineWall, makeIvyMaiden, makeMyconid, makeAmaymon, makeHerb, makeSignpost, makeHole, makeShrine, makeBloom, makeSparks, makeWitchHat, lock, maskGeo,
    makeChest, makeCrystalPlant, makeSkeleton, makeLightShaft, makeVineLadder, makeAloe, makeDoodle };
}
