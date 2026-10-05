// world/props.js: the waterfall plateau, stream and pond, the campfire, the pumpkins, the scarecrow, the butterflies
// and a little dressing (boulders, a stump, mushrooms, reeds, lily pads).
// Contract: export function buildProps(c) -> { update(dt, t) }   (c = world/common.js instance)
//
// Everything that stands still is sculpted from parametric surfaces into a few merged, vertex-coloured meshes with
// smooth normals. Everything that moves (water, flames, smoke, mist, butterflies) is animated inside its shader from
// one shared clock, so update() only advances that clock and flickers the fire light.

const TAU = Math.PI * 2;
const GRAVITY = 9.8;
const WATER_Y = 0.05;             // the pond's surface
const STREAM_FROM = -1.2;         // world z where the stream rises: just beyond the map's north edge
const FALL_THROW = 0.9;           // metres per second at which the stream leaves the lip
const FIRE_LIGHT = 14;            // the campfire light's mean intensity

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (from, to, x) => { const t = clamp01((x - from) / (to - from)); return t * t * (3 - 2 * t); };   // from may be above to
const steps = (n, from = 0, to = 1) => Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n);
const hash = (i, j = 0, k = 0) => {             // whole numbers -> [0, 1)
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 2246822519) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
// a smooth curve through evenly spaced values; w runs from 0 (first value) to 1 (last)
function spline(values, w) {
  const last = values.length - 1, x = clamp01(w) * last, i = Math.min(Math.floor(x), last - 1), t = x - i;
  const a = values[Math.max(i - 1, 0)], b = values[i], d = values[i + 1], e = values[Math.min(i + 2, last)];
  return 0.5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (3 * b - a - 3 * d + e) * t * t * t);
}

export function buildProps(c) {
  const kit = createKit(c);
  const camp = !c.level.glade;                   // glade levels have their own water and rocks (world/pond.js)
  if (camp) pourWater(kit, sculptPlateauAndPond(kit));
  const fireLight = c.level.campfire ? buildCampfire(kit) : null;
  if (camp) { buildPumpkins(kit); buildScarecrow(kit); }
  buildButterflies(kit);
  return {
    update(dt, t) {
      kit.clock.value = t;
      if (fireLight) fireLight.distance = 7 + 6 * c.night.value;      // at night the fire is the light she is seen by
      if (fireLight) fireLight.intensity = FIRE_LIGHT * (1 + 2.2 * c.night.value) * (0.82 + 0.1 * Math.sin(t * 11.3) + 0.06 * Math.sin(t * 27.1 + 1.3) + 0.08 * Math.sin(t * 4.7 + 0.5));
    },
  };
}

// ============================================================ sculpting ============================================================

// Collects parametric surfaces into one smooth-shaded, vertex-coloured geometry.
// Each vertex colour carries a fourth number, the brush: above zero the material's painted rock texture shows that
// strongly there, below zero its painted grass texture does.
function createSculptor(THREE) {
  const positions = [], normals = [], colors = [], indices = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  const tint = new THREE.Color();

  // shape(u, v, point) is sampled at every (us[i], vs[j]); paint(point, normal, u, v, colour) colours each vertex.
  //   wrap   : the first and last column coincide (a tube, a ball), so the shading must run smoothly across that seam
  //   flip   : turn the faces round
  //   matrix : where the shape stands (rotation and translation only)
  //   brush  : -1 (grass) .. 0 (plain colour) .. 1 (rock); a number or brush(point, normal, u, v)
  // A row squeezed into one point (the pole of a ball, the tip of a cone) is fine.
  function add(us, vs, shape, paint, { wrap = false, flip = false, matrix = null, brush = 0 } = {}) {
    const nu = us.length, nv = vs.length, first = positions.length / 3;
    const points = new Float32Array(nu * nv * 3), facing = new Float32Array(nu * nv * 3);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      shape(us[i], vs[j], p);
      if (matrix) p.applyMatrix4(matrix);
      p.toArray(points, (j * nu + i) * 3);
    }
    const isPole = (j) => p.fromArray(points, j * nu * 3).distanceToSquared(q.fromArray(points, (j * nu + (nu >> 1)) * 3)) < 1e-12;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const iBefore = i > 0 ? i - 1 : wrap ? nu - 2 : 0, iAfter = i < nu - 1 ? i + 1 : wrap ? 1 : nu - 1;
      du.fromArray(points, (j * nu + iAfter) * 3).sub(p.fromArray(points, (j * nu + iBefore) * 3));
      dv.fromArray(points, (Math.min(j + 1, nv - 1) * nu + i) * 3).sub(p.fromArray(points, (Math.max(j - 1, 0) * nu + i) * 3));
      n.crossVectors(du, dv).normalize();
      if (flip) n.negate();
      n.toArray(facing, (j * nu + i) * 3);
    }
    for (const j of [0, nv - 1]) {               // a pole faces the way its neighbouring ring does on average
      if (!isPole(j)) continue;
      const ring = j === 0 ? 1 : nv - 2;
      n.set(0, 0, 0);
      for (let i = 0; i < nu - (wrap ? 1 : 0); i++) n.add(p.fromArray(facing, (ring * nu + i) * 3));
      n.normalize();
      for (let i = 0; i < nu; i++) n.toArray(facing, (j * nu + i) * 3);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const o = (j * nu + i) * 3;
      p.fromArray(points, o); n.fromArray(facing, o);
      paint(p, n, us[i], vs[j], tint);
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      colors.push(tint.r, tint.g, tint.b, typeof brush === 'number' ? brush : brush(p, n, us[i], vs[j]));
    }
    for (let j = 0; j < nv - 1; j++) {
      const poleAbove = isPole(j), poleBelow = isPole(j + 1);
      for (let i = 0; i < nu - 1; i++) {
        const a = first + j * nu + i, b = a + 1, d = a + nu, e = d + 1;
        if (!poleAbove) { if (flip) indices.push(a, d, b); else indices.push(a, b, d); }
        if (!poleBelow) { if (flip) indices.push(b, d, e); else indices.push(b, e, d); }
      }
    }
  }
  function geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    g.setIndex(indices);
    return g;
  }
  return { add, geometry };
}

// What every builder below shares: the clock, the random numbers, the palette, the materials and the shape helpers.
function createKit(c) {
  const { THREE, scene, noise2 } = c;
  const { rnd, rr } = c.rng(9001);              // shapes and where they stand
  const painter = c.rng(9002);                   // the painted textures have their own, so repainting one never moves a stone
  const clock = { value: 0 };                    // seconds since start; every animated shader reads this one uniform
  const colours = (table) => Object.fromEntries(Object.entries(table).map(([name, hex]) => [name, new THREE.Color(hex)]));

  // Albedos. The sky's lights show a sunlit surface at about 2.3 x its albedo and a shaded one at 0.7 x, so these are
  // darker than the colours the art direction wants to see on screen.
  const PAL = colours({
    rockLight: '#9c9282', rockDark: '#6a645b', rockWarm: '#a8926c', rockWet: '#4d4b46', joint: '#4a3e32',
    moss: '#4d752c', mossLight: '#679238', grass: '#3f7128', grassSun: '#4f8430', grassDeep: '#2c5720', earth: '#574029',
    sand: '#8f8168', sandWet: '#75684f', damp: '#6b543a', bedDeep: '#2f5f5c', streamBed: '#5d5a4b',
    stone: '#93876f', stoneCool: '#7c786e',
    mushroomCap: '#a8321f', mushroomLight: '#cc5630', mushroomCream: '#cdbf9f', mushroomDot: '#ece6d6',
  });

  // ---------- a tiling brush texture (mid grey = no change) ----------
  // red: rock and wood (soft dabs, chisel strokes, a few cracks).  green: grass (short blades lying every way).
  // Every stroke is painted so that it touches one channel only.
  const brushTex = c.canvasTex(512, 512, (ctx, w, h) => {
    const { rnd, rr } = painter;
    // draws something that reaches `reach` pixels from (x, y), and again wherever it crosses an edge, so the picture tiles
    const tiled = (x, y, reach, draw) => {
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        if (x + dx < -reach || x + dx > w + reach || y + dy < -reach || y + dy > h + reach) continue;
        ctx.save(); ctx.translate(x + dx, y + dy); draw(); ctx.restore();
      }
    };
    const ink = (alpha) => (rnd() < 0.5 ? `rgba(255,128,128,${alpha})` : `rgba(0,128,128,${alpha})`);
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {               // soft dabs
      const r = rr(36, 110), fill = ink(rr(0.07, 0.15));
      tiled(rr(0, w), rr(0, h), r, () => {
        const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        fade.addColorStop(0, fill); fade.addColorStop(1, fill.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = fade; ctx.fillRect(-r, -r, 2 * r, 2 * r);
      });
    }
    for (let i = 0; i < 80; i++) {               // chisel strokes with a clean edge
      const long = rr(26, 120), wide = rr(4, 15), turn = rr(-0.5, 0.5) + (rnd() < 0.3 ? Math.PI / 2 : 0), fill = ink(rr(0.06, 0.14));
      tiled(rr(0, w), rr(0, h), long, () => { ctx.rotate(turn); ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, 0, long, wide, 0, 0, TAU); ctx.fill(); });
    }
    for (let i = 0; i < 9; i++) {                // cracks: a dark line with a light lip beside it
      const path = [[0, 0]];
      let heading = rr(0, TAU);
      for (let k = rr(4, 9); k > 0; k--) {
        heading += rr(-0.7, 0.7);
        const [x, y] = path[path.length - 1], step = rr(14, 34);
        path.push([x + Math.cos(heading) * step, y + Math.sin(heading) * step]);
      }
      const x0 = rr(0, w), y0 = rr(0, h), width = rr(1.6, 2.8);
      const line = (shift, style, lineWidth) => tiled(x0, y0, 320, () => {
        ctx.strokeStyle = style; ctx.lineWidth = lineWidth; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.beginPath();
        path.forEach(([x, y], k) => (k ? ctx.lineTo(x + shift, y + shift) : ctx.moveTo(x + shift, y + shift)));
        ctx.stroke();
      });
      line(1.6, 'rgba(255,128,128,0.2)', 2.2); line(0, 'rgba(0,128,128,0.34)', width);
    }
    for (let i = 0; i < 900; i++) {              // blades of grass: dark ones first, light ones over them
      const long = rr(20, 44), wide = rr(2.5, 5), turn = rr(0, TAU), bend = rr(-8, 8), dark = i < 380;
      tiled(rr(0, w), rr(0, h), long + 8, () => {
        ctx.globalCompositeOperation = dark ? 'multiply' : 'lighter';
        ctx.fillStyle = dark ? 'rgb(255,150,255)' : 'rgb(0,52,0)';
        ctx.rotate(turn);
        ctx.beginPath(); ctx.moveTo(-wide, 0); ctx.quadraticCurveTo(bend - wide * 0.4, -long * 0.6, bend, -long);
        ctx.quadraticCurveTo(bend + wide * 0.8, -long * 0.5, wide, 0); ctx.fill();
      });
    }
  }, { repeat: true, srgb: false, anisotropy: 2 });

  // ---------- materials ----------
  // matte: lit vertex colours, with the rock or grass brush laid on where a vertex asks for it (the fourth colour component)
  const matte = new THREE.MeshLambertMaterial({ vertexColors: true });
  matte.onBeforeCompile = (shader) => {
    shader.uniforms.uBrush = { value: brushTex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrushAt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrushAt = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBrush;\nvarying vec3 vBrushAt;')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        // the brush is laid on from the three axes and blended by the way the surface faces, so it never smears
        vec3 facing = pow(abs(inverseTransformDirection(normalize(vNormal), viewMatrix)), vec3(4.0));
        vec3 at = vBrushAt * 0.42;
        vec2 brush = facing.x * texture2D(uBrush, at.zy).rg + facing.y * texture2D(uBrush, at.xz).rg + facing.z * texture2D(uBrush, at.xy).rg;
        brush *= 2.0 / (facing.x + facing.y + facing.z);
        diffuseColor.rgb *= mix(1.0, brush.r, max(vColor.a, 0.0)) * mix(1.0, brush.g, max(-vColor.a, 0.0));`)
      // a surface that faces away from the sun gets no sunlight anyway: skip the shadow map there (half of the cliff does)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        '( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap',
        '( directLight.visible && receiveShadow && dot( geometryNormal, directLight.direction ) > 0.0 ) ? getShadow( directionalShadowMap'));
  };
  const glossy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });       // small things with a shine: the pumpkins
  function addMesh(name, geometry, material, castShadow = false) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.castShadow = castShadow; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // ---------- noise for the water and the flames: red = broad, green = finer, blue = stretched into long streaks ----------
  const noiseTex = c.canvasTex(128, 128, (ctx, w, h) => {
    const lattice = (nx, ny) => {                // tiling value noise with nx x ny cells across the picture
      const values = new Float32Array(nx * ny).map(painter.rnd), at = (i, j) => values[(j % ny) * nx + (i % nx)];
      return (x, y) => {
        const i = Math.floor(x * nx), j = Math.floor(y * ny), tx = x * nx - i, ty = y * ny - j;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        return lerp(lerp(at(i, j), at(i + 1, j), sx), lerp(at(i, j + 1), at(i + 1, j + 1), sx), sy);
      };
    };
    const channels = [[4, 4], [8, 8], [12, 4]].map(([nx, ny]) => [lattice(nx, ny), lattice(nx * 2, ny * 2), lattice(nx * 4, ny * 4)]);
    const image = ctx.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, x = i / w, y = j / h;
      channels.forEach(([big, mid, small], k) => {
        image.data[o + k] = 255 * clamp01(((big(x, y) * 0.6 + mid(x, y) * 0.28 + small(x, y) * 0.12) - 0.5) * 1.7 + 0.5);
      });
      image.data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, { repeat: true, srgb: false });

  // ---------- shapes ----------
  function randomDirection() {
    const y = rr(-1, 1), a = rr(0, TAU), r = Math.sqrt(1 - y * y);
    return new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  }
  // a boulder: a soft cube with slow lumps and a couple of chiselled faces (u goes round it, v from top to bottom)
  function boulderShape(rx, ry, rz, { square = 3, lump = 0.07, cuts = 2 } = {}) {
    const lumps = [], planes = [];
    for (let i = 0; i < 4; i++) lumps.push({ dir: randomDirection(), turns: rr(1.6, 3.4), size: rr(0.4, 1) * lump, phase: rr(0, TAU) });
    for (let i = 0; i < cuts; i++) planes.push({ dir: randomDirection(), reach: rr(0.66, 0.9) });
    return (u, v, out) => {
      const sinV = Math.sin(v * Math.PI);
      let x = sinV * Math.cos(u * TAU), y = Math.cos(v * Math.PI), z = sinV * Math.sin(u * TAU);
      let r = Math.pow(Math.abs(x) ** square + Math.abs(y) ** square + Math.abs(z) ** square, -1 / square);
      for (const l of lumps) r *= 1 + l.size * Math.sin(l.turns * (x * l.dir.x + y * l.dir.y + z * l.dir.z) + l.phase);
      x *= r; y *= r; z *= r;
      for (const pl of planes) {
        const over = x * pl.dir.x + y * pl.dir.y + z * pl.dir.z - pl.reach;
        if (over > 0) { x -= pl.dir.x * over * 0.8; y -= pl.dir.y * over * 0.8; z -= pl.dir.z * over * 0.8; }
      }
      return out.set(x * rx, y * ry, z * rz);
    };
  }
  // rock colours: lighter where it faces the sky, a cap of moss with a clear edge, dark and wet below `wetBelow`
  const paintRock = ({ light = PAL.rockLight, dark = PAL.rockDark, tone = 0.5, moss = 0.5, wetBelow = -9, warm = 0.3 } = {}) => (p, n, u, v, col) => {
    col.copy(dark).lerp(light, clamp01(tone + 0.3 * n.y)).lerp(PAL.rockWarm, warm * noise2(p.x * 0.8 + 5, p.z * 0.8 + p.y));
    const mossy = smooth(0.62, 0.76, n.y * moss + (noise2(p.x * 1.6, p.z * 1.6 + p.y * 1.6) - 0.5) * 0.5 + 0.12);
    col.lerp(PAL.moss, mossy).lerp(PAL.mossLight, mossy * smooth(0.8, 1, n.y) * 0.5);
    col.lerp(PAL.rockWet, 0.6 * smooth(wetBelow, wetBelow - 0.2, p.y));
  };
  function addBoulder(sculpt, x, y, z, rx, ry, rz, options = {}) {
    const { paint = paintRock(), shape = {}, around = 18, down = 11, turn = rr(0, TAU), tip = 0.15, brush = 1 } = options;
    sculpt.add(steps(around), steps(down), boulderShape(rx, ry, rz, shape), paint,
      { wrap: true, brush, matrix: c.mtx(x, y, z, 1, 1, 1, turn, rr(-tip, tip), rr(-tip, tip)) });
  }
  function sideways(axis) {                       // two directions square to `axis` and to each other
    const side = new THREE.Vector3(1, 0, 0).cross(axis);
    if (side.lengthSq() < 0.01) side.set(0, 0, 1).cross(axis);
    side.normalize();
    return [side, new THREE.Vector3().crossVectors(axis, side)];
  }
  // a straight limb from one point to another with chamfered ends: logs, posts, stalks
  //   paint(point, normal, around, along, colour);  capPaint(point, normal, around, outwards, colour) for the two flat ends
  function addLimb(sculpt, from, to, radius, paint, options = {}) {
    const { around = 10, along = 4, capPaint = paint, taper = 1, bumps = 0, matrix = null, brush = 0 } = options;
    const axis = new THREE.Vector3().subVectors(to, from), length = axis.length(), [side, other] = sideways(axis.normalize()), seed = rr(0, 50);
    const thick = (u, v) => radius * lerp(1, taper, v) * (1 + bumps * (noise2(u * 3 + seed, v * length * 6) - 0.5))
      * (v < 0.001 || v > 0.999 ? 0.86 : 1);
    const ring = (u, v, r, out) => out.copy(from).addScaledVector(axis, v * length)
      .addScaledVector(side, Math.cos(u * TAU) * r).addScaledVector(other, Math.sin(u * TAU) * r);
    const edge = 0.012 / length;
    sculpt.add(steps(around), [0, edge, ...steps(along).slice(1, -1), 1 - edge, 1], (u, v, out) => ring(u, v, thick(u, v), out), paint,
      { wrap: true, matrix, brush });
    for (const v of [0, 1]) {
      sculpt.add(steps(around), [0, 0.5, 1], (u, w, out) => ring(u, v, thick(u, v) * w, out), capPaint, { wrap: true, flip: v === 1, matrix });
    }
  }
  // a straw: a thin cone from `from` to its tip at `to`
  function addSpike(sculpt, from, to, radius, paint, matrix) {
    const axis = new THREE.Vector3().subVectors(to, from), length = axis.length(), [side, other] = sideways(axis.normalize());
    sculpt.add(steps(5), [0, 1], (u, v, out) => out.copy(from).addScaledVector(axis, v * length)
      .addScaledVector(side, Math.cos(u * TAU) * radius * (1 - v)).addScaledVector(other, Math.sin(u * TAU) * radius * (1 - v)), paint,
      { wrap: true, matrix });
  }
  // a tube along a smooth curve through `points` (closed = a ring); thick(along, around) is its radius. Rows must be steps(segments).
  function tubeShape(points, segments, thick, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points, closed), centres = curve.getSpacedPoints(segments);
    const frames = curve.computeFrenetFrames(segments, closed);
    return (u, v, out) => {
      const k = Math.round(v * segments), r = thick(v, u);
      return out.copy(centres[k]).addScaledVector(frames.normals[k], Math.cos(u * TAU) * r).addScaledVector(frames.binormals[k], Math.sin(u * TAU) * r);
    };
  }
  // a petal or a blade: a pointed oval that leaves `root` towards `heading`, `reach` metres out and `rise` metres up, both faces drawn
  //   upright: it climbs first and bends over at the top (a reed's leaf) instead of spreading first and curling up (a petal)
  function addPetal(sculpt, root, heading, reach, rise, width, cup, paint, { upright = false, along = 4, across = 4 } = {}) {
    const ax = Math.cos(heading), az = Math.sin(heading);
    const shape = (u, v, out) => {
      const half = width * Math.sin(Math.PI * Math.pow(v, 0.7)) * u;
      const forward = reach * (upright ? v * v : v), up = rise * (upright ? Math.sin(v * Math.PI / 2) : v * v);
      return out.set(root.x + ax * forward - az * half, root.y + up + cup * Math.abs(half) * Math.abs(u), root.z + az * forward + ax * half);
    };
    for (const flip of [false, true]) sculpt.add(steps(across, -1, 1), steps(along), shape, paint, { flip });
  }
  // a toadstool: a pale stalk and a red cap with pale dots, `size` metres tall
  function addMushroom(sculpt, x, y, z, size, leanX = 0, leanZ = 0) {
    const foot = new THREE.Vector3(x, y - 0.01, z), crown = new THREE.Vector3(x + leanX, y + size, z + leanZ), R = size * 0.62;
    addLimb(sculpt, foot, crown, size * 0.19, (p, n, u, v, col) => col.copy(PAL.mushroomCream), { around: 7, along: 1, taper: 0.75 });
    // the cap: v runs from the crown down over the rim (v = 1) and back in underneath
    const capPoint = (u, v, out, puff = 1) => {
      const over = Math.min(v, 1) * 1.45, under = Math.max(v - 1, 0) / 0.35, r = R * Math.sin(over) * lerp(1, 0.3, under) * puff;
      return out.set(crown.x + Math.cos(u * TAU) * r, crown.y + (R * 0.78 * Math.cos(over) - 0.12 * R) * puff + 0.1 * R * under, crown.z + Math.sin(u * TAU) * r);
    };
    const capPaint = (p, n, u, v, col) => col.copy(PAL.mushroomLight).lerp(PAL.mushroomCap, smooth(0.1, 0.9, v)).lerp(PAL.mushroomCream, smooth(1.02, 1.12, v));
    sculpt.add(steps(10), [0, 0.2, 0.4, 0.6, 0.8, 1, 1.12, 1.35], capPoint, capPaint, { wrap: true });
    for (let i = 0; i < 5; i++) {
      const u0 = (i + rr(-0.25, 0.25)) / 5, v0 = i ? rr(0.4, 0.75) : 0.12, du = 0.035 / Math.sin(v0 * 1.45), dv = 0.1;
      const dotShape = (a, w, out) => capPoint(u0 + Math.cos(a * TAU) * w * du, v0 + Math.sin(a * TAU) * w * dv, out, 1.05 - 0.02 * w);
      sculpt.add(steps(6), [0, 1], dotShape, (p, n, a, w, col) => col.copy(PAL.mushroomDot), { wrap: true, flip: true });
    }
  }

  // ---------- particles: soft discs that loop for ever along paths worked out in the vertex shader ----------
  // Colours are premultiplied, so one material draws both glowing sparks (added to the picture) and smoke or mist (laid over it).
  const particleLook = new THREE.ShaderMaterial({
    name: 'props particles', transparent: true, depthWrite: false, premultipliedAlpha: true, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock },
    vertexShader: /* glsl */`
      uniform float uTime;
      attribute vec3 aStart;        // where it is born
      attribute vec3 aDrift;        // metres per second
      attribute vec4 aLife;         // seconds per loop, offset into the loop (0..1), gravity, sideways wander (metres)
      attribute vec4 aSize;         // size at birth, size at the end, softness (0 = a crisp dot, 1 = a puff), glow (1 = added light)
      attribute vec4 aTint;         // colour, strongest opacity
      varying vec2 vDisc; varying vec4 vTint; varying vec2 vLook;
      #include <fog_pars_vertex>
      void main() {
        float age = fract(uTime / aLife.x + aLife.y), seconds = age * aLife.x;
        vec3 at = aStart + aDrift * seconds;
        at.y -= 0.5 * aLife.z * seconds * seconds;
        at.xz += aLife.w * age * vec2(sin(seconds * 2.3 + aLife.y * 40.0), cos(seconds * 1.7 + aLife.y * 23.0));
        vec4 mvPosition = modelViewMatrix * vec4(at, 1.0);
        mvPosition.xy += position.xy * mix(aSize.x, aSize.y, age);
        gl_Position = projectionMatrix * mvPosition;
        vDisc = position.xy * 2.0;
        vTint = vec4(aTint.rgb, aTint.a * smoothstep(0.0, 0.15, age) * smoothstep(1.0, 0.5, age));
        vLook = aSize.zw;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vDisc; varying vec4 vTint; varying vec2 vLook;
      #include <fog_pars_fragment>
      void main() {
        float alpha = vTint.a * (1.0 - smoothstep(mix(0.6, 0.0, vLook.x), 1.0, length(vDisc)));
        gl_FragColor = vec4(vTint.rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * (1.0 - vLook.y), fogFactor);
        #endif
        gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha * (1.0 - vLook.y));
      }`,
  });
  // list: [{ start, drift, seconds, gravity, wander, size: [birth, end], soft, glow, tint: [r, g, b, opacity] }]
  function addParticles(name, list, centre, radius) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const perParticle = (attribute, size, values) =>
      geo.setAttribute(attribute, new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(values)), size));
    perParticle('aStart', 3, (q) => q.start);
    perParticle('aDrift', 3, (q) => q.drift);
    perParticle('aLife', 4, (q) => [q.seconds, rnd(), q.gravity || 0, q.wander || 0]);
    perParticle('aSize', 4, (q) => [...q.size, q.soft, q.glow || 0]);
    perParticle('aTint', 4, (q) => q.tint);
    geo.boundingSphere = new THREE.Sphere(centre, radius);
    const mesh = new THREE.Mesh(geo, particleLook);
    mesh.name = name; mesh.renderOrder = 1;      // after the water it floats over
    scene.add(mesh);
  }

  return { c, THREE, scene, clock, rnd, rr, colours, PAL, noiseTex, matte, glossy, addMesh, addParticles,
    boulderShape, paintRock, addBoulder, addLimb, addSpike, tubeShape, addPetal, addMushroom };
}

// ============================================================ the plateau and the pond ============================================================

// Sculpts everything of rock, earth and leaf around the waterfall into one mesh. Returns what the water needs to know.
function sculptPlateauAndPond(kit) {
  const { c, THREE, rnd, rr, colours, PAL, matte, addMesh, paintRock, addBoulder, addLimb, addPetal, addMushroom } = kit;
  const { S, M, CLIFF_H, noise2, fbm2 } = c;
  const rocks = createSculptor(THREE);
  const WATER_X = 2.5 * S;                       // the stream and the waterfall follow tile column 2
  const STREAM_Y = CLIFF_H - 0.1;                // the stream's surface

  // ---------- the wall ----------
  // Its base line runs west to east along the south face, round a soft corner, then north along the east face.
  // It sits a little inside the plateau's edge so the rock can bulge without leaning far over the neighbouring tiles.
  const SOUTH_Z = 5 * S - 0.05, EAST_X = 4 * S - 0.05, CORNER = 0.8, WEST_END = -M * S, NORTH_END = -M * S;
  const SOUTH_LEN = EAST_X - CORNER - WEST_END, ARC_LEN = CORNER * Math.PI / 2, WALL_LEN = SOUTH_LEN + ARC_LEN + SOUTH_Z - CORNER - NORTH_END;
  const FALL_S = WATER_X - WEST_END;             // where along the base line the waterfall is
  const base = { x: 0, z: 0, nx: 0, nz: 0 };     // wallBase() result: a point on the base line and the outward direction there
  function wallBase(s) {
    if (s <= SOUTH_LEN) { base.x = WEST_END + s; base.z = SOUTH_Z; base.nx = 0; base.nz = 1; }
    else if (s <= SOUTH_LEN + ARC_LEN) {
      const a = (s - SOUTH_LEN) / CORNER;
      base.nx = Math.sin(a); base.nz = Math.cos(a);
      base.x = EAST_X - CORNER + base.nx * CORNER; base.z = SOUTH_Z - CORNER + base.nz * CORNER;
    } else { base.x = EAST_X; base.z = SOUTH_Z - CORNER - (s - SOUTH_LEN - ARC_LEN); base.nx = 1; base.nz = 0; }
    return base;
  }
  const nearFall = (x, halfWidth) => smooth(halfWidth, halfWidth * 0.45, Math.abs(x - WATER_X));     // 1 at the waterfall, 0 from halfWidth outwards

  // The rock is laid in wavy strata; each stratum is cut into blocks of uneven width with rounded edges.
  const STRATA = [-0.7, 1.45, 2.5, 3.25, 4.7];
  const block = { out: 0, face: 0, tone: 0, warm: 0 };   // wallBlocks() result: bulge (m), 0 in a joint .. 1 on a block's face, the block's own shades
  function wallBlocks(s, y) {
    const level = y + (noise2(s * 0.22, 3.7) - 0.5) * 0.5;
    let row = 0;
    while (row < STRATA.length - 2 && level > STRATA[row + 1]) row++;
    const rowHeight = STRATA[row + 1] - STRATA[row], fy = (level - STRATA[row]) / rowHeight;
    const width = 1.4 + 0.9 * hash(row, 11);
    const along = s / width + hash(row, 5) * 7 + (fy - 0.5) * (row % 2 ? 0.14 : -0.14);          // the joints lean a little
    const cell = Math.floor(along);
    let nearest = 9, second = 9, id = 0;
    for (let i = cell - 1; i <= cell + 1; i++) {
      const d = Math.abs(along - (i + 0.5 + (hash(row, i) - 0.5) * 0.6));
      if (d < nearest) { second = nearest; nearest = d; id = i; } else if (d < second) second = d;
    }
    const round = 0.2 + 0.16 * hash(row, id, 3);
    const toSide = (second - nearest) * 0.5 * width, toLevel = Math.min(fy, 1 - fy) * rowHeight;
    const inset = Math.hypot(Math.max(round - toSide, 0), Math.max(round - toLevel, 0));          // rounded corners
    block.face = Math.sin(Math.max(1 - inset / round, 0) * Math.PI / 2);
    block.tone = hash(row, id, 1); block.warm = hash(row, id, 6);
    const tilt = (hash(row, id, 4) - 0.5) * 0.3 * (along - id - 0.5) * width + (hash(row, id, 7) - 0.5) * 0.24 * (fy - 0.5) * rowHeight;
    block.out = block.face * (round * 0.7 + 0.34 * hash(row, id, 2) + tilt + 0.05 * (noise2(s * 1.7, y * 1.7) - 0.5));
    return block;
  }
  // how far the rock stands out from the base line at height y
  function wallReach(s, y, hem) {
    const b = wallBase(s), chute = b.nz > 0.99 ? nearFall(b.x, 1.05) : 0;                         // the water has worn a smooth chute
    const inPond = b.nz > 0.5 ? smooth(1.5, 2.3, b.x) : 0;                                         // only there may the foot spread out
    const bulk = 0.36 * inPond * (1 - chute) * Math.exp(-Math.max(y, 0) / 0.5) - 0.06 * y - 0.2 * chute
      + (noise2(s * 0.17, 9.1) - 0.5) * 0.45 * (1 - 0.12 * y);
    const reach = bulk + wallBlocks(s, y).out * smooth(hem, hem - 0.45, y) * (1 - 0.55 * chute);
    const soft = lerp(0.25, 1.15, inPond);                                                         // beside walkable tiles the rock stays close
    return reach < soft ? reach : soft + 0.15 * Math.tanh((reach - soft) / 0.15);
  }
  // the turf that hangs over the top of the wall
  const turf = { top: 0, hem: 0, overhang: 0, lip: 0 };
  function turfEdge(s) {
    const b = wallBase(s);
    turf.lip = b.nz > 0.99 ? nearFall(b.x, 0.78) : 0;                                              // 1 where the stream pours over bare rock
    turf.top = CLIFF_H + 0.03 - 0.2 * turf.lip;
    turf.overhang = lerp(0.1 + 0.1 * noise2(s * 0.6, 8.8), 0.07, turf.lip);
    turf.hem = turf.top - lerp(0.3 + 0.24 * noise2(s * 0.8, 5.5) + 0.08 * noise2(s * 3.1, 1.2), 0.3, turf.lip);
    return turf;
  }
  const paintGrass = (x, z, col) => col.copy(PAL.grass).lerp(PAL.grassSun, noise2(x * 0.35 + 11, z * 0.35))
    .lerp(PAL.grassDeep, 0.5 * smooth(0.5, 0.85, noise2(x * 0.9, z * 0.9 + 7)));
  {
    // columns: close together where the camera gets near (the waterfall, the corner), wide along the stretches the forest hides
    const fineFrom = -1.2 - WEST_END, fineTo = SOUTH_LEN + ARC_LEN + 2.8, columns = [];
    const atCorner = (s) => s > SOUTH_LEN - 1.6 && s < SOUTH_LEN + ARC_LEN + 1.6;
    for (let s = fineFrom, step = 0.11; s > 0.6; s -= step, step = Math.min(step * 1.45, 2.2)) columns.unshift(s);
    columns.unshift(0);
    for (let s = fineFrom + 0.11; s < fineTo; s += atCorner(s) ? 0.08 : 0.11) columns.push(s);
    for (let s = fineTo, step = 0.11; s < WALL_LEN - 0.6; s += step, step = Math.min(step * 1.45, 2.2)) columns.push(s);
    columns.push(WALL_LEN);
    // rows: v 0..1 climbs the rock from under the ground to the turf's hem (closer together up to head height, where
    // the camera can come near), v 1..2 follows the turf over the edge and inwards
    const rows = [...steps(24, 0, 0.66), ...steps(8, 0.66, 1).slice(1), ...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.72, 0.86, 1].map((w) => 1 + w)];

    const wallShape = (s, v, out) => {
      const t = turfEdge(s);
      let y, reach;
      if (v <= 1) { y = lerp(-0.15, t.hem, v); reach = wallReach(s, y, t.hem); }
      else {
        reach = wallReach(s, t.hem, t.hem) + spline([0.01, t.overhang, 0.8 * t.overhang, -0.03, -0.36, -0.85], v - 1);
        y = spline([t.hem, lerp(t.hem, t.top, 0.42), t.top - 0.06, t.top, t.top - 0.004, t.top - 0.075], v - 1);
      }
      const b = wallBase(s);
      out.set(b.x + b.nx * reach, y, b.z + b.nz * reach);
    };
    const paintWall = (p, n, s, v, col) => {
      const t = turfEdge(s), south = wallBase(s).nz > 0.5 ? 1 : 0;
      if (v > 1) {                                // turf: darker down the hanging edge, bare earth at the hem, wet rock at the lip
        paintGrass(p.x, p.z, col);
        col.lerp(PAL.grassDeep, 0.8 * smooth(0.45, 0.12, v - 1)).lerp(PAL.earth, 0.7 * smooth(0.12, 0, v - 1)).lerp(PAL.rockWet, t.lip);
        return;
      }
      const b = wallBlocks(s, p.y);
      col.copy(PAL.rockDark).lerp(PAL.rockLight, clamp01(0.25 + 0.6 * b.tone + 0.3 * n.y)).lerp(PAL.rockWarm, 0.5 * b.warm);
      col.lerp(PAL.joint, 0.7 * (1 - b.face));
      // moss: hanging down from the turf, in the spray beside the waterfall, and in patches on the ledges
      const patch = fbm2(s * 0.45 + 2, p.y * 0.7 + 4, 2);
      const mossy = smooth(0.56, 0.68, patch + 0.3 * smooth(t.hem - 0.9, t.hem, p.y) + 0.16 * south * nearFall(p.x, 2.6) + 0.26 * (n.y - 0.5));
      col.lerp(PAL.moss, mossy * 0.9).lerp(PAL.mossLight, mossy * smooth(0.5, 1, n.y) * 0.5);
      col.lerp(PAL.rockWet, Math.max(0.6 * smooth(0.45, 0.05, p.y), 0.55 * south * nearFall(p.x, 1.0)));
    };
    rocks.add(columns, rows, wallShape, paintWall, { brush: (p, n, s, v) => (v > 1 ? lerp(-1, 1, turfEdge(s).lip) : 1) });
  }

  // ---------- the top: grass, with the stream's bed cut through it ----------
  const streamX = (z) => WATER_X + 0.12 * Math.sin(z * 0.9) * smooth(7.2, 5.2, z);
  const streamRuns = (z) => smooth(STREAM_FROM - 0.6, STREAM_FROM + 0.4, z);
  const streamBed = (x, z) => 0.2 * smooth(0.74, 0.44, Math.abs(x - streamX(z))) * streamRuns(z);    // how deep the bed is cut
  {
    const xs = [WEST_END, -9, -5, -2, -0.4, 0.6, 1.4, 2, 2.5, ...steps(16, 2.96, 5.04), 5.3, 5.58, EAST_X - 0.5];
    const zs = [NORTH_END, -9, -5, -2.9, ...steps(19, -2.2, 6.75), 7.1, SOUTH_Z - 0.5];
    const cornerX = EAST_X - CORNER, cornerZ = SOUTH_Z - CORNER, cornerR = CORNER - 0.5;           // the turf of the wall covers this grid's rim
    const topShape = (x, z, out) => {
      const dx = x - cornerX, dz = z - cornerZ;
      if (dx > 0 && dz > 0) { const k = Math.min(1, cornerR / Math.hypot(dx, dz)); x = cornerX + dx * k; z = cornerZ + dz * k; }
      out.set(x, CLIFF_H - streamBed(x, z), z);
    };
    const rockTile = (tx, ty) => (c.tileAt(tx, ty) === 'r' ? 1 : 0);
    const rockiness = (x, z) => {                // 1 on the map's rock tiles, fading smoothly between tiles
      const fx = x / S - 0.5, fz = z / S - 0.5, tx = Math.floor(fx), ty = Math.floor(fz), ax = fx - tx, az = fz - ty;
      return lerp(lerp(rockTile(tx, ty), rockTile(tx + 1, ty), ax), lerp(rockTile(tx, ty + 1), rockTile(tx + 1, ty + 1), ax), az);
    };
    const bare = (p) => smooth(0.35, 0.6, rockiness(p.x, p.z) * (0.6 + 0.8 * noise2(p.x * 1.1, p.z * 1.1)));          // slabs of rock showing through
    const bank = (p) => streamRuns(p.z) * smooth(1.0, 0.72, Math.abs(p.x - streamX(p.z)));
    const paintTop = (p, n, x, z, col) => {
      paintGrass(p.x, p.z, col);
      col.lerp(PAL.rockLight, 0.8 * bare(p)).lerp(PAL.sand, 0.9 * bank(p));
      col.lerp(PAL.streamBed, streamRuns(p.z) * smooth(0.64, 0.46, Math.abs(p.x - streamX(p.z))));
    };
    rocks.add(xs, zs, topShape, paintTop, { flip: true, brush: (p) => lerp(-1, 0.9, Math.max(bare(p), bank(p))) });
  }

  // A plain wall inside the rock casts the plateau's shadow, so the detailed wall is not drawn a second time for it.
  // It is never seen: it writes neither colour nor depth.
  {
    const corners = [0, SOUTH_LEN, SOUTH_LEN + ARC_LEN / 3, SOUTH_LEN + ARC_LEN * 2 / 3, SOUTH_LEN + ARC_LEN, WALL_LEN]
      .map((s) => { const b = wallBase(s); return [b.x - b.nx * 0.3, b.z - b.nz * 0.3]; });
    corners.push([WEST_END, NORTH_END], corners[0]);
    const block = createSculptor(THREE);
    block.add(steps(corners.length - 1, 0, corners.length - 1), [0, CLIFF_H - 0.05],
      (i, y, out) => out.set(corners[i][0], y, corners[i][1]), (p, n, u, v, col) => col.set(0), { wrap: true });
    const unseen = matte.clone();
    unseen.onBeforeCompile = matte.onBeforeCompile; unseen.colorWrite = false; unseen.depthWrite = false;
    addMesh('plateau shadow', block.geometry(), unseen, true).receiveShadow = false;
  }

  // boulders on the top: either side of the lip, where the map has rock, and a heap where the stream rises
  for (const [x, y, z, rx, ry, rz] of [
    [WATER_X - 0.95, 0.1, 7.35, 0.44, 0.34, 0.4], [WATER_X + 1.0, 0.12, 7.3, 0.52, 0.38, 0.44],
    [2.35, 0.16, 6.9, 0.56, 0.44, 0.5], [1.95, 0.08, 6.1, 0.3, 0.26, 0.3],
    [WATER_X - 0.45, 0.1, STREAM_FROM - 0.2, 0.5, 0.42, 0.46], [WATER_X + 0.45, 0.14, STREAM_FROM - 0.4, 0.56, 0.46, 0.5],
    [WATER_X + 0.05, 0.3, STREAM_FROM - 0.9, 0.62, 0.5, 0.55],
  ]) addBoulder(rocks, x, CLIFF_H + y, z, rx, ry, rz, { paint: paintRock({ moss: 1, tone: 0.45 }) });
  // rounded stones along the stream's banks
  for (let z = STREAM_FROM + 0.3; z < SOUTH_Z - 1.2; z += rr(0.35, 0.8)) for (const side of [-1, 1]) {
    if (rnd() < 0.3) continue;
    const r = rr(0.09, 0.19);
    addBoulder(rocks, streamX(z) + side * rr(0.66, 0.8), CLIFF_H - 0.02 + r * 0.2, z + rr(-0.15, 0.15), r, r * rr(0.6, 0.8), r * rr(0.8, 1.2), {
      paint: paintRock({ light: PAL.stone, dark: PAL.stoneCool, moss: 0.6, tone: rr(0.4, 0.8) }),
      shape: { square: 2.3, lump: 0.05, cuts: 0 }, around: 8, down: 5,
    });
  }
  // tufts of grass along the rim (they soften its outline against the trees) and beside the stream
  {
    const INK = colours({ blade: '#3f8334', tip: '#86c54c' }), bladePaint = (p, n, u, v, col) => col.copy(INK.blade).lerp(INK.tip, v);
    const tuft = (x, z) => {
      const root = new THREE.Vector3(x, CLIFF_H - 0.02, z), spin = rr(0, TAU);
      for (let i = 0; i < 4; i++) {
        addPetal(rocks, root, spin + i * 1.7 + rr(-0.4, 0.4), rr(0.06, 0.16), rr(0.2, 0.36), rr(0.03, 0.045), 0, bladePaint,
          { upright: true, along: 2, across: 2 });
      }
    };
    for (let s = FALL_S - 5; s < SOUTH_LEN + ARC_LEN + 3; s += rr(0.12, 0.3)) {
      const b = wallBase(s), inward = rr(0.25, 0.95);
      if (turfEdge(s).lip < 0.05) tuft(b.x - b.nx * inward, b.z - b.nz * inward);
    }
    for (let i = 0; i < 24; i++) {
      const z = rr(STREAM_FROM + 0.5, SOUTH_Z - 1.2), x = streamX(z) + (rnd() < 0.5 ? -1 : 1) * rr(1.0, 2.2);
      if (x < EAST_X - 0.7) tuft(x, z);
    }
  }

  // ---------- the pond's shoreline ----------
  // The foot of the wall on the north side, a soft blob inside the pond's own tiles everywhere else.
  // Clockwise seen from above; (nx, nz) points away from the water.
  const shore = [];
  for (let s = 1.95 - WEST_END; s < SOUTH_LEN + CORNER * 0.62; s += 0.12) {
    const b = wallBase(s), reach = wallReach(s, WATER_Y, turfEdge(s).hem);
    shore.push({ x: b.x + b.nx * reach, z: b.z + b.nz * reach, open: false });
  }
  {
    const OPEN_SHORE = [
      [6.05, 8.6], [5.9, 9.05], [5.35, 9.28], [4.7, 9.3], [4.45, 9.75], [4.42, 10.6], [4.35, 11.5],
      [4.0, 12.2], [3.3, 12.45], [2.55, 12.3], [2.05, 11.7], [1.95, 10.6], [2.0, 9.4], [1.95, 8.6],
    ];
    const through = [shore[shore.length - 1], ...OPEN_SHORE.map(([x, z]) => ({ x, z })), shore[0]].map((q) => new THREE.Vector3(q.x, 0, q.z));
    const curve = new THREE.CatmullRomCurve3(through, false, 'centripetal');
    const pts = curve.getSpacedPoints(Math.round(curve.getLength() / 0.12));
    for (let i = 1; i < pts.length - 1; i++) shore.push({ x: pts[i].x, z: pts[i].z, open: true });
  }
  shore.forEach((q, i) => {
    const before = shore[(i + shore.length - 1) % shore.length], after = shore[(i + 1) % shore.length];
    const len = Math.hypot(after.x - before.x, after.z - before.z);
    q.nx = (after.z - before.z) / len; q.nz = -(after.x - before.x) / len;
  });
  function shoreDistance(x, z) {                 // metres to the shoreline, positive in the water
    let best = Infinity, inside = false;
    for (let i = 0, j = shore.length - 1; i < shore.length; j = i++) {
      const a = shore[j], b = shore[i], ex = b.x - a.x, ez = b.z - a.z;
      const t = clamp01(((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez));
      best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t));
      if ((a.z > z) !== (b.z > z) && x < a.x + (z - a.z) / ez * ex) inside = !inside;
    }
    return inside ? best : -best;
  }

  // the waterfall leaves the lip and falls freely; this is where it lands
  const FALL_TIME = Math.sqrt(2 * (STREAM_Y - WATER_Y) / GRAVITY);
  const lipEdge = turfEdge(FALL_S), LIP_Z = SOUTH_Z + wallReach(FALL_S, lipEdge.hem, lipEdge.hem) + 0.04;
  const IMPACT_Z = LIP_Z + FALL_THROW * FALL_TIME;

  // ---------- stones in and around the pond ----------
  const waterRocks = [];                         // the pond's shader draws foam around each of these
  // sink: how much of the stone's height is under water
  function addPondRock(x, z, rx, ry, rz, sink, options) {
    const y = WATER_Y + ry * (1 - 2 * sink), cut = Math.sqrt(Math.max(0, 1 - ((WATER_Y - y) / ry) ** 2));
    addBoulder(rocks, x, y, z, rx, ry, rz, options);
    if (cut > 0) waterRocks.push({ x, z, r: Math.max(rx, rz) * cut * 1.05 });
  }
  for (const [x, z, rx, ry, rz] of [
    [WATER_X - 1.1, 8.5, 0.6, 0.5, 0.5], [WATER_X + 1.12, 8.55, 0.68, 0.56, 0.54], [2.25, 8.35, 0.42, 0.4, 0.36], [5.85, 8.45, 0.44, 0.36, 0.4],
    [WATER_X + 0.72, IMPACT_Z + 0.55, 0.27, 0.2, 0.23], [WATER_X - 0.75, IMPACT_Z + 0.5, 0.2, 0.16, 0.18],
  ]) addPondRock(x, z, rx, ry, rz, 0.3, { paint: paintRock({ moss: 0.95, tone: 0.5, wetBelow: WATER_Y + 0.22 }) });
  // smooth stones along the open shore, in clusters with gaps between them
  {
    let walked = 0, next = 0.2;
    shore.forEach((q, i) => {
      if (!q.open) return;
      const before = shore[i - 1];
      walked += Math.hypot(q.x - before.x, q.z - before.z);
      if (walked < next) return;
      const r = lerp(0.1, 0.25, noise2(walked * 0.8, 2.2)) * rr(0.8, 1.2), away = Math.min(0.1, 0.28 - r);
      next = walked + r * rr(1.5, 2.4);
      if (noise2(walked * 0.5, 9.9) < 0.32) return;                                               // a gap
      addPondRock(q.x + q.nx * away + rr(-0.03, 0.03), q.z + q.nz * away + rr(-0.03, 0.03), r, r * rr(0.55, 0.75), r * rr(0.75, 1.1), 0.22, {
        paint: paintRock({ light: rnd() < 0.3 ? PAL.rockLight : PAL.stone, dark: PAL.stoneCool, moss: 0.45, tone: rr(0.3, 0.9), warm: 0.5,
          wetBelow: WATER_Y + 0.12 }),
        shape: { square: 2.3, lump: 0.05, cuts: 1 }, around: r > 0.17 ? 16 : 12, down: r > 0.17 ? 9 : 7,
      });
    });
  }
  // the bed: a low rim of sand holds the water, and the floor darkens towards the middle
  {
    const RIM = [[0.3, -0.03], [0.2, 0.05], [0.09, 0.08], [0, 0.055], [-0.14, 0.02], [-0.45, 0.012]];   // [metres outside the shoreline, height]
    const bedShape = (i, ring, out) => {
      if (ring === RIM.length) return out.set(3.3, 0.012, 9.3);                                    // the middle; every part of the shore can be seen from here
      const q = shore[i % shore.length], [away, height] = RIM[ring];
      return out.set(q.x + q.nx * away, q.open ? height : Math.min(height, 0.012), q.z + q.nz * away);
    };
    const paintBed = (p, n, i, ring, col) => {
      const d = shoreDistance(p.x, p.z);
      col.copy(PAL.damp).lerp(PAL.sand, smooth(-0.26, -0.06, d)).lerp(PAL.sandWet, smooth(-0.05, 0.05, d)).lerp(PAL.bedDeep, smooth(0.05, 0.6, d));
    };
    rocks.add(steps(shore.length, 0, shore.length), steps(RIM.length, 0, RIM.length), bedShape, paintBed, { wrap: true, flip: true, brush: 0.6 });
  }

  // ---------- what grows there ----------
  // lily pads on the calm end, two of them in flower
  {
    const INK = colours({ pad: '#3f7d2e', padLight: '#6fa53a', petal: '#d98aa8', petalLight: '#f0ccd6', heart: '#d9a51e' });
    const NOTCH = 0.08;                          // the slit, as a part of the full circle
    const PADS = [[3.1, 11.35, 0.27, true], [3.8, 10.95, 0.2, false], [2.6, 10.6, 0.23, true], [3.45, 10.3, 0.16, false], [2.95, 11.95, 0.18, false],
      [3.95, 10.1, 0.14, false]];               // [x, z, radius, in flower]
    for (const [x, z, radius, inFlower] of PADS) {
      const turn = rr(0, TAU);
      rocks.add(steps(18, NOTCH / 2, 1 - NOTCH / 2), steps(3), (u, v, out) => {
        const a = u * TAU + turn, r = radius * v * (1 + 0.04 * Math.sin(u * TAU * 5));
        return out.set(x + Math.cos(a) * r, WATER_Y + 0.012 + 0.02 * v * v * v, z + Math.sin(a) * r);   // the rim curls up a little
      }, (p, n, u, v, col) => col.copy(INK.pad).lerp(INK.padLight, 0.8 * (1 - v * v)));
      if (!inFlower) continue;
      const heart = new THREE.Vector3(x + radius * 0.25, WATER_Y + 0.03, z + radius * 0.2), spin = rr(0, TAU);
      const outer = (p, n, u, v, col) => col.copy(INK.petal).lerp(INK.petalLight, v);
      const inner = (p, n, u, v, col) => col.copy(INK.petalLight).lerp(INK.petal, 0.3 * (1 - v));
      for (let i = 0; i < 7; i++) addPetal(rocks, heart, spin + i / 7 * TAU, 0.12, 0.06, 0.04, 0.5, outer);
      for (let i = 0; i < 5; i++) addPetal(rocks, heart, spin + (i + 0.5) / 5 * TAU, 0.065, 0.1, 0.032, 0.6, inner);
      addBoulder(rocks, heart.x, heart.y + 0.02, heart.z, 0.024, 0.02, 0.024,
        { paint: (p, n, u, v, col) => col.copy(INK.heart), shape: { square: 2, lump: 0, cuts: 0 }, around: 8, down: 5, brush: 0 });
    }
  }
  // reeds standing in the shallows on the west side
  {
    const INK = colours({ stalk: '#5c8a34', stalkDark: '#3b6a2a', head: '#5a3a22' });
    const green = (p, n, u, v, col) => col.copy(INK.stalkDark).lerp(INK.stalk, v);
    for (const [x, z, count] of [[2.22, 11.35, 4], [2.2, 9.9, 3]]) for (let i = 0; i < count; i++) {
      const foot = new THREE.Vector3(x + rr(-0.14, 0.14), WATER_Y - 0.04, z + rr(-0.22, 0.22)), height = rr(0.75, 1.25);
      const top = new THREE.Vector3(foot.x + rr(-0.08, 0.08), foot.y + height, foot.z + rr(-0.08, 0.08));
      addLimb(rocks, foot, top, 0.011, green, { around: 5, along: 1, taper: 0.6 });
      addLimb(rocks, foot.clone().lerp(top, 0.74), foot.clone().lerp(top, 0.92), 0.03, (p, n, u, v, col) => col.copy(INK.head), { around: 7, along: 2 });
      for (let k = 0; k < 2; k++) {
        addPetal(rocks, foot, rr(0, TAU), rr(0.18, 0.34), height * rr(0.6, 0.85), 0.022, 0, green, { upright: true, along: 5, across: 2 });
      }
    }
  }
  // an old stump on the corner of the plateau, with mushrooms at its foot
  {
    const INK = colours({ bark: '#6b4a33', barkDark: '#4a3323', wood: '#b2915f', ring: '#8f6d42' });
    const x = EAST_X - 0.75, z = SOUTH_Z - 0.65, radius = 0.3, height = 0.46;
    const girth = (u, v) => radius * (v < 0.01 ? 0.92 : 1)                                         // roots spread at the foot
      * (1 + 0.06 * Math.sin(u * TAU * 3 + 1) + 0.55 * v * v * v * (0.45 + 0.55 * Math.cos(u * TAU * 5 + 0.5) ** 2));
    const barkShape = (u, v, out) => out.set(x + Math.cos(u * TAU) * girth(u, v), CLIFF_H + height * (1 - v) - (v < 0.01 ? 0 : 0.015),
      z + Math.sin(u * TAU) * girth(u, v));
    const barkPaint = (p, n, u, v, col) => col.copy(INK.barkDark).lerp(INK.bark, noise2(u * 14, v * 2))
      .lerp(PAL.moss, 0.85 * smooth(0.5, 0.75, noise2(u * 3 + 2, v * 2 + 5) + 0.25 * (1 - v)));
    rocks.add(steps(20), [0, 0.06, 0.3, 0.55, 0.75, 0.9, 1], barkShape, barkPaint, { wrap: true, brush: 0.8 });
    rocks.add(steps(20), steps(5), (u, w, out) => out.set(x + Math.cos(u * TAU) * girth(u, 0) * w, CLIFF_H + height, z + Math.sin(u * TAU) * girth(u, 0) * w),
      (p, n, u, w, col) => col.copy(Math.round(w * 5) % 2 ? INK.ring : INK.wood).lerp(INK.bark, smooth(0.85, 1, w)), { wrap: true });
    addMushroom(rocks, x + 0.42, CLIFF_H, z + 0.22, 0.2, 0.03, 0.02);
    addMushroom(rocks, x + 0.3, CLIFF_H, z + 0.42, 0.13, -0.02, 0.03);
    addMushroom(rocks, x - 0.08, CLIFF_H + height, z + 0.05, 0.08);
  }

  addMesh('waterfall rocks', rocks.geometry(), matte);
  return { WATER_X, STREAM_Y, SOUTH_Z, LIP_Z, IMPACT_Z, FALL_TIME, streamX, shore, shoreDistance, waterRocks };
}

// ============================================================ the water ============================================================

function pourWater(kit, site) {
  const { c, THREE, scene, clock, rr, noiseTex, addMesh, addParticles } = kit;
  const { WATER_X, STREAM_Y, SOUTH_Z, LIP_Z, IMPACT_Z, FALL_TIME, streamX, shore, shoreDistance, waterRocks } = site;

  // where the pond's shore and stones are, painted into a map: 0 = 0.25 m outside the water .. 1 = 2 m out from any shore
  const POND = { x: 1.3, z: 7.3, w: 5.4, h: 5.7 };
  const shoreMap = c.canvasTex(128, 128, (ctx, w, h) => {
    const image = ctx.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = POND.x + (i + 0.5) / w * POND.w, z = POND.z + (j + 0.5) / h * POND.h;
      let d = shoreDistance(x, z);
      for (const rock of waterRocks) d = Math.min(d, Math.hypot(x - rock.x, z - rock.z) - rock.r);
      image.data[(j * w + i) * 4] = 255 * clamp01((d + 0.25) / 2.25);
      image.data[(j * w + i) * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, { srgb: false, anisotropy: 1 });
  shoreMap.flipY = false;

  // ---------- the pond and the stream ----------
  // They share one lit material. It paints the depth gradient, foam along shores and stones, ripple rings from the
  // waterfall and slow glints, and adds the sky's reflection at grazing angles.
  const skyGlow = scene.fog ? scene.fog.color.clone().multiplyScalar(0.14) : new THREE.Color(0.22, 0.32, 0.36);
  const waterLook = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false });
  waterLook.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: clock, uNoise: { value: noiseTex }, uShoreMap: { value: shoreMap },
      uPond: { value: new THREE.Vector4(POND.x, POND.z, 1 / POND.w, 1 / POND.h) }, uImpact: { value: new THREE.Vector2(WATER_X, IMPACT_Z) },
      uShallow: { value: new THREE.Color('#2f7c7b') }, uDeep: { value: new THREE.Color('#0d4450') }, uSky: { value: skyGlow },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWater;\nvarying vec3 vWater;\nvarying vec2 vWaterAt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWater = aWater;\nvWaterAt = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uShoreMap; uniform vec4 uPond; uniform vec2 uImpact;
        uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky;
        varying vec3 vWater; varying vec2 vWaterAt;`)
      .replace('#include <color_fragment>', /* glsl */`
        // metres to the nearest shore or stone: the stream carries it in its vertices, the pond reads its painted map
        float still = step(50.0, vWater.x);
        float shore = mix(vWater.x, texture2D(uShoreMap, (vWaterAt - uPond.xy) * uPond.zw).r * 2.25 - 0.25, still);
        vec2 at = vWaterAt - vWater.yz * uTime;                                  // the surface pattern travels with the flow
        float n1 = texture2D(uNoise, at * 0.19 + vec2(uTime * 0.013, 0.0)).r;
        float n2 = texture2D(uNoise, at.yx * 0.27 - vec2(0.0, uTime * 0.017)).g;
        float depth = smoothstep(0.0, 0.5, shore);
        // ripple rings run outwards from where the waterfall lands, and the water churns white right under it
        float reach = distance(vWaterAt, uImpact);
        float ring = smoothstep(0.6, 1.0, sin(reach * 8.0 - uTime * 3.4 + n1 * 2.0)) * smoothstep(3.0, 0.7, reach) * still;
        float churn = smoothstep(0.62, 0.3, reach + (n2 - 0.5) * 0.7) * still;
        // a thin wobbling foam line along every shore and stone, and a fainter one lapping behind it
        float line = shore + (n2 - 0.5) * 0.07;
        float foam = 1.0 - smoothstep(0.03, 0.07, line);
        foam += 0.5 * smoothstep(0.04, 0.0, abs(line - 0.17 - 0.04 * sin(uTime * 0.9 + n1 * 6.0)));
        foam = clamp(foam + churn + ring * 0.45, 0.0, 1.0);
        // soft glinting lines where the two drifting noise fields cross, in patches
        float glint = (1.0 - smoothstep(0.0, 0.045, abs(n1 - n2))) * smoothstep(0.35, 0.6, n1) * smoothstep(0.12, 0.4, shore) * (1.0 - foam);
        diffuseColor.rgb = mix(mix(uShallow, uDeep, depth), vec3(0.9), foam);
        diffuseColor.a = smoothstep(-0.03, 0.03, shore) * max(mix(0.55, 0.95, depth), foam);`)
      .replace('#include <lights_fragment_end>', /* glsl */`#include <lights_fragment_end>
        float sunlit = dot(reflectedLight.directDiffuse, vec3(1.0)) / max(dot(diffuseColor.rgb, vec3(1.0)), 0.01);   // how much direct light lands here
        float graze = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
        totalEmissiveRadiance += uSky * graze * (1.0 - foam) + vec3(1.0, 0.97, 0.9) * glint * (0.05 + 0.3 * sunlit);`);
  };
  {
    const position = [], water = [], index = [];   // water = [metres to the bank (99 = read the shore map), flow x, flow z]
    // the stream: a ribbon lying in its bed, flowing south
    const ACROSS = [-0.66, -0.33, 0, 0.33, 0.66];
    steps(18, STREAM_FROM - 0.4, SOUTH_Z - 0.45).forEach((z, j) => ACROSS.forEach((away, i) => {
      position.push(streamX(z) + away, STREAM_Y, z);
      water.push(lerp(-0.1, 0.59 - Math.abs(away), smooth(STREAM_FROM - 0.4, STREAM_FROM + 0.6, z)), 0, 1.1);
      if (i && j) { const a = (j - 1) * ACROSS.length + i - 1, b = a + ACROSS.length; index.push(a, b, a + 1, a + 1, b, b + 1); }
    }));
    // the pond: its outline, taken a little beyond the shore so the edge can fade
    const first = position.length / 3;
    const rim = shore.map((q) => new THREE.Vector2(q.x + q.nx * (q.open ? 0.08 : 0.3), q.z + q.nz * (q.open ? 0.08 : 0.3)));
    for (const q of rim) { position.push(q.x, WATER_Y, q.y); water.push(99, 0, 0); }
    for (const [a, b, d] of THREE.ShapeUtils.triangulateShape(rim, [])) {
      const facesUp = (rim[b].y - rim[a].y) * (rim[d].x - rim[a].x) - (rim[b].x - rim[a].x) * (rim[d].y - rim[a].y) > 0;
      index.push(first + a, first + (facesUp ? b : d), first + (facesUp ? d : b));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(position.map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('aWater', new THREE.Float32BufferAttribute(water, 3));
    geo.setIndex(index);
    addMesh('water', geo, waterLook);
  }

  // ---------- the waterfall: two sheets, one behind the other, with streaks sliding down them ----------
  {
    const position = [], uv = [], layer = [], index = [];
    // rows: a short run-in along the stream, then the free fall (z moves out steadily while y drops ever faster)
    const RUN_IN = 0.6;
    const path = [[-RUN_IN, 0], [-0.3, 0], [-0.1, 0], ...steps(12, 0, FALL_TIME).map((t) => [FALL_THROW * t, 0.5 * GRAVITY * t * t])];   // [out, down]
    const lengths = path.map((q, j) => (j ? Math.hypot(q[0] - path[j - 1][0], q[1] - path[j - 1][1]) : 0));
    const SWEEP = steps(8, -1.45, 1.45);          // the sheet is curved like a half pipe: its edges sweep back towards the rock
    for (const front of [0, 1]) {
      const first = position.length / 3;
      let dropped = -RUN_IN;
      path.forEach(([out, down], j) => {
        dropped += lengths[j];
        const fallen = down / (STREAM_Y - WATER_Y), width = lerp(1.12, 1.4, fallen) * (front ? 0.84 : 1), depth = 0.3 * smooth(0, 0.25, fallen);
        for (const angle of SWEEP) {
          position.push(WATER_X + Math.sin(angle) * width / 2, STREAM_Y - down + (out < 0 ? 0 : front * 0.02),
            LIP_Z + out - depth * (1 - Math.cos(angle)) + front * 0.06);
          uv.push(0.5 + 0.5 * Math.sin(angle), dropped); layer.push(front);
        }
        if (j) for (let i = 0; i < SWEEP.length - 1; i++) {
          const a = first + (j - 1) * SWEEP.length + i, b = a + SWEEP.length;
          index.push(a, b, b + 1, a, b + 1, a + 1);
        }
      });
    }
    const fallLength = lengths.reduce((sum, length) => sum + length, -RUN_IN);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 1));
    geo.setIndex(index);
    const fallLook = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    fallLook.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uTime: clock, uNoise: { value: noiseTex }, uLength: { value: fallLength } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying vec3 vFall;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFall = vec3(uv, aLayer);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uLength; uniform sampler2D uNoise;\nvarying vec3 vFall;')
        .replace('#include <color_fragment>', /* glsl */`
          float across = vFall.x, drop = vFall.y, front = vFall.z;
          float slide = uTime * mix(0.5, 0.72, front);
          float streak = texture2D(uNoise, vec2(across * mix(0.9, 1.6, front) + front * 0.37, drop * 0.11 - slide)).b;
          float fine = texture2D(uNoise, vec2(across * 2.6 + 0.2, drop * 0.21 - slide * 1.7)).b;
          float wobble = texture2D(uNoise, vec2(across * 0.5 + 0.6, drop * 0.25 - uTime * 0.3)).g;
          float clump = texture2D(uNoise, vec2(across * 0.33 + front * 0.5, drop * 0.045 - slide * 0.55)).r;
          float white = smoothstep(0.47, 0.72, streak * 0.45 + fine * 0.25 + clump * 0.3);
          // foam where the water breaks over the lip and where it lands
          white += smoothstep(0.5, 0.0, abs(drop - 0.1) + (wobble - 0.5) * 0.3);
          white += smoothstep(uLength - 1.0, uLength - 0.15, drop + (wobble - 0.5) * 0.6);
          white = min(white, 1.0);
          float side = min(across, 1.0 - across);
          float body = smoothstep(0.0, 0.08, side + (wobble - 0.5) * 0.06) * smoothstep(-0.55, -0.15, drop);  // ragged soft edges, a soft start
          diffuseColor.rgb = mix(vec3(0.16, 0.5, 0.56), vec3(1.05, 1.12, 1.15), white);
          diffuseColor.a = body * mix(mix(0.8, 1.0, white), white * 0.75, front);`);
    };
    addMesh('waterfall', geo, fallLook).receiveShadow = false;
  }

  // ---------- spray at the foot of the fall ----------
  const spray = [];
  for (let i = 0; i < 6; i++) spray.push({         // mist drifting up and away
    start: [WATER_X + rr(-0.5, 0.5), rr(0.1, 0.4), IMPACT_Z + rr(-0.1, 0.3)], drift: [rr(-0.12, 0.12), rr(0.16, 0.36), rr(0.04, 0.22)],
    seconds: rr(3, 4.6), wander: 0.1, size: [rr(0.45, 0.7), rr(0.95, 1.25)], soft: 1, tint: [0.72, 0.84, 0.92, rr(0.25, 0.36)],
  });
  for (let i = 0; i < 14; i++) spray.push({        // drops thrown up where the water lands
    start: [WATER_X + rr(-0.5, 0.5), 0.1, IMPACT_Z + rr(-0.05, 0.15)], drift: [rr(-0.5, 0.5), rr(1.3, 2.3), rr(0, 0.7)],
    seconds: rr(0.55, 0.95), gravity: 6.5, size: [rr(0.05, 0.09), 0.03], soft: 0.3, tint: [0.95, 1.0, 1.05, 0.9],
  });
  addParticles('waterfall spray', spray, new THREE.Vector3(WATER_X, 1, IMPACT_Z), 3);
}

// ============================================================ the campfire ============================================================

// Returns the fire's light: the only light this module adds. It casts no shadow.
function buildCampfire(kit) {
  const { c, THREE, scene, clock, rnd, rr, colours, PAL, noiseTex, matte, addMesh, addParticles, paintRock, addBoulder, addLimb } = kit;
  const { noise2 } = c;
  const fire = c.tc(...c.level.campfire);
  const sculpt = createSculptor(THREE);
  const INK = colours({ bark: '#6b4a33', barkDark: '#4a3323', cut: '#b99668', char: '#231c18', soot: '#3d3833' });
  const EMBER = new THREE.Color(3.2, 0.8, 0.12);                                                  // brighter than any lit surface: it glows
  const fromFire = (p) => Math.hypot(p.x - fire.x, p.z - fire.z);

  // a ring of stones, sooty on the side that faces the fire
  const STONES = 9, RING = 0.57;
  for (let i = 0; i < STONES; i++) {
    const a = (i + rr(-0.2, 0.2)) / STONES * TAU, r = i % 3 ? rr(0.13, 0.18) : rr(0.1, 0.12);
    const stone = paintRock({ light: PAL.stone, dark: PAL.stoneCool, moss: 0, tone: rr(0.4, 0.9), warm: 0.4 });
    addBoulder(sculpt, fire.x + Math.cos(a) * RING, r * 0.42, fire.z + Math.sin(a) * RING, r * rr(1.05, 1.3), r * rr(0.72, 0.9), r * rr(0.85, 1), {
      paint: (p, n, u, v, col) => { stone(p, n, u, v, col); col.lerp(INK.soot, 0.75 * smooth(RING + 0.04, RING - 0.14, fromFire(p))); },
      shape: { square: 2.6, lump: 0.06, cuts: 1 }, around: 14, down: 9, turn: -a + Math.PI / 2, tip: 0.1,
    });
  }
  // a bed of charcoal with a few live embers
  const bedShape = (u, v, out) => {
    const heap = 0.07 * (1 - v * v) * (0.7 + 0.6 * noise2(u * 9, v * 4)) + 0.005;
    return out.set(fire.x + Math.cos(u * TAU) * v * 0.42, heap, fire.z + Math.sin(u * TAU) * v * 0.42);
  };
  const bedPaint = (p, n, u, v, col) => col.copy(INK.char).lerp(INK.soot, noise2(p.x * 9, p.z * 9))
    .lerp(EMBER, smooth(0.5, 0.75, noise2(p.x * 9 + 3, p.z * 9)) * smooth(0.8, 0.3, v));
  sculpt.add(steps(24), steps(7), bedShape, bedPaint, { wrap: true });
  // logs leaning together over the bed, charred where the flames lick them
  const LOGS = 5;
  for (let i = 0; i < LOGS; i++) {
    const a = (i + rr(-0.15, 0.15)) / LOGS * TAU + 0.4, foot = new THREE.Vector3(fire.x + Math.cos(a) * 0.4, 0.05, fire.z + Math.sin(a) * 0.4);
    const head = new THREE.Vector3(fire.x - Math.cos(a) * 0.1 + rr(-0.03, 0.03), rr(0.4, 0.5), fire.z - Math.sin(a) * 0.1 + rr(-0.03, 0.03));
    const tone = rr(0, 1);
    const barkPaint = (p, n, u, v, col) => col.copy(INK.barkDark).lerp(INK.bark, tone * 0.6 + 0.5 * noise2(u * 7, v * 2 + i))
      .lerp(INK.char, 0.9 * smooth(0.3, 0.75, v + (noise2(u * 5 + i, v * 3) - 0.5) * 0.3));
    const endPaint = (p, n, u, w, col) => { col.copy(INK.cut).lerp(INK.barkDark, smooth(0.6, 1, w)); if (p.y > 0.2) col.lerp(INK.char, 0.85); };
    addLimb(sculpt, foot, head, rr(0.055, 0.07), barkPaint, { capPaint: endPaint, taper: 0.88, bumps: 0.12, along: 5, brush: 0.8 });
  }
  addMesh('campfire', sculpt.geometry(), matte, true);

  // ---------- flames: a few upright sheets that always face the camera; the shader shapes each into a wavering tongue ----------
  // [x, y, z, width, height]
  const TONGUES = [[0, 0.08, -0.04, 0.6, 0.95], [-0.13, 0.08, 0.02, 0.42, 0.68], [0.14, 0.08, 0, 0.4, 0.64], [0.02, 0.06, 0.08, 0.3, 0.5]];
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(TONGUES.flatMap((q) => q.slice(0, 3))), 3));
  geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(TONGUES.flatMap((q) => [q[3], q[4], rnd()])), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(fire.x, 0.5, fire.z), 1.2);
  const flameLook = new THREE.ShaderMaterial({
    name: 'props flames', transparent: true, depthWrite: false, premultipliedAlpha: true, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock, uNoise: { value: noiseTex }, uFire: { value: fire } },
    vertexShader: /* glsl */`
      uniform vec3 uFire;
      attribute vec3 aRoot;         // where the tongue stands, measured from the middle of the fire
      attribute vec3 aShape;        // width, height, a number of its own
      varying vec3 vFlame;
      #include <fog_pars_vertex>
      void main() {
        vec3 root = uFire + aRoot, toCamera = cameraPosition - root;
        vec3 ahead = normalize(vec3(toCamera.x, 0.0, toCamera.z)), side = vec3(ahead.z, 0.0, -ahead.x);
        // lean back under a high camera, so the flame keeps its height
        vec3 up = normalize(vec3(0.0, 1.0, 0.0) - ahead * 0.7 * clamp(toCamera.y / length(toCamera), 0.0, 1.0));
        vec4 mvPosition = viewMatrix * vec4(root + side * position.x * aShape.x + up * position.y * aShape.y, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vFlame = vec3(position.x * 2.0, position.y, aShape.z);
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uNoise;
      varying vec3 vFlame;
      #include <fog_pars_fragment>
      void main() {
        float y = vFlame.y, own = vFlame.z, t = uTime + own * 7.0;
        float slow = texture2D(uNoise, vec2(vFlame.x * 0.22 + own, y * 0.35 - t * 0.45)).r;
        float quick = texture2D(uNoise, vec2(vFlame.x * 0.5 - own * 2.0, y * 0.8 - t * 0.8)).g;
        float x = vFlame.x + ((slow - 0.5) * 0.9 + sin(t * 2.3) * 0.12) * y;                    // the tip sways
        float width = 1.9 * pow(y + 0.03, 0.45) * pow(1.0 - y, 1.1);                             // a teardrop: round belly, pointed tip
        float inside = 1.0 - abs(x) / max(width, 0.001) + (quick - 0.5) * 0.8 * (0.25 + y);
        float alpha = smoothstep(0.0, 0.12, inside) * smoothstep(0.0, 0.05, y);
        // three bands of colour, brighter than any lit surface so that they glow: orange, yellow, a pale core
        vec3 colour = mix(vec3(2.6, 0.55, 0.08), vec3(3.6, 1.6, 0.25), smoothstep(0.2, 0.36, inside - y * 0.15));
        colour = mix(colour, vec3(4.5, 3.4, 1.3), smoothstep(0.56, 0.74, inside - y * 0.6));
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
        gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha * 0.7);
      }`,
  });
  const flames = new THREE.Mesh(geo, flameLook);
  flames.name = 'flames'; flames.renderOrder = 1;
  scene.add(flames);

  // ---------- what rises from the fire ----------
  const above = [];
  for (let i = 0; i < 22; i++) above.push({        // sparks
    start: [fire.x + rr(-0.12, 0.12), rr(0.3, 0.6), fire.z + rr(-0.12, 0.12)], drift: [rr(-0.08, 0.08), rr(0.5, 0.95), rr(-0.08, 0.08)],
    seconds: rr(1.6, 3), wander: 0.3, size: [rr(0.025, 0.04), 0.01], soft: 0.4, glow: 1, tint: [4, 1.5, 0.35, 1],
  });
  for (let i = 0; i < 10; i++) above.push({        // a wisp of smoke
    start: [fire.x + rr(-0.04, 0.04), rr(0.8, 0.95), fire.z + rr(-0.04, 0.04)], drift: [rr(0.1, 0.15), rr(0.42, 0.5), rr(-0.08, -0.04)],
    seconds: 5.2, wander: 0.16, size: [0.14, rr(0.45, 0.62)], soft: 0.8, tint: [0.62, 0.6, 0.6, 0.09],
  });
  for (const seconds of [0.9, 1.4]) above.push({   // a warm halo that breathes
    start: [fire.x, 0.42, fire.z], drift: [0, 0, 0], seconds, size: [1.1, 1.25], soft: 1, glow: 1, tint: [1.0, 0.42, 0.1, 0.36],
  });
  addParticles('campfire sparks and smoke', above, new THREE.Vector3(fire.x, 1.8, fire.z), 2.6);

  const light = new THREE.PointLight(new THREE.Color(1, 0.5, 0.18), FIRE_LIGHT, 7, 1.8);
  light.position.set(fire.x, 0.55, fire.z);
  scene.add(light);
  return light;
}

// ============================================================ pumpkins ============================================================

function buildPumpkins(kit) {
  const { c, THREE, rnd, rr, colours, glossy, addMesh, tubeShape, addMushroom } = kit;
  const INK = colours({ rind: '#c8650f', groove: '#8f3d08', rindLight: '#e08a1c', rindPale: '#c99a3a', stem: '#6a7a2c', stemDry: '#8a7a42' });
  const stemPaint = (p, n, u, v, col) => col.copy(INK.stem).lerp(INK.stemDry, v);

  function addPumpkin(sculpt, x, z, radius, ribs, squash, turn) {
    const place = c.mtx(x, radius * squash * 0.94, z, 1, 1, 1, turn, rr(-0.12, 0.12), rr(-0.12, 0.12));
    const groove = (u) => Math.abs(Math.cos(u * Math.PI * ribs)) ** 4;                          // 1 along each groove between two ribs
    sculpt.add(steps(ribs * 4), steps(9), (u, v, out) => {
      const down = v * Math.PI, sin = Math.sin(down);
      const r = radius * Math.pow(sin, 0.75) * (1 - 0.13 * groove(u) * Math.pow(sin, 0.3)) * (1 + 0.07 * (v - 0.5));
      // dimples at the stalk and underneath
      const y = Math.cos(down) - 0.32 * Math.exp(-((down / 0.5) ** 2)) + 0.12 * Math.exp(-(((Math.PI - down) / 0.45) ** 2));
      return out.set(Math.cos(u * TAU) * r * 1.03, y * radius * squash, Math.sin(u * TAU) * r * 0.97);
    }, (p, n, u, v, col) => {
      col.copy(INK.rind).lerp(INK.rindLight, 0.6 * smooth(0.1, 0.9, n.y)).lerp(INK.groove, 0.8 * groove(u) * smooth(0, 0.15, v))
        .lerp(INK.rindPale, 0.5 * smooth(0.72, 1, v)).lerp(INK.groove, 0.6 * smooth(0.09, 0, v));
    }, { wrap: true, matrix: place });
    // a curly stalk with four ridges, thick where it grows out of the fruit
    const top = radius * squash * 0.66;
    const curl = [[0, 0, 0], [0.01, 0.12, 0], [0.07, 0.22, 0.01], [0.17, 0.26, 0.04], [0.26, 0.2, 0.07], [0.27, 0.11, 0.1], [0.2, 0.08, 0.12]];
    const stalk = tubeShape(curl.map(([a, b, d]) => new THREE.Vector3(a * radius, top + b * radius, d * radius)), 10,
      (v, u) => radius * (0.07 * (1 - 0.55 * v) + 0.07 * Math.exp(-v / 0.07)) * (1 + 0.16 * Math.cos(u * TAU * 4)) * smooth(1, 0.9, v));
    sculpt.add(steps(8), steps(10), stalk, stemPaint, { wrap: true, matrix: place });
  }

  for (const [tx, ty] of c.level.pumpkins_event) {
    // the group sits on the side of its tile that is nearest to walkable ground, so it can be seen from the clearing
    const centre = c.tc(tx, ty), toward = new THREE.Vector2(0, 1);
    let nearest = Infinity;
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
      const d = Math.hypot(x - tx, y - ty);
      if (c.walkAt(x, y) && d < nearest) { nearest = d; toward.set(x - tx, y - ty).normalize(); }
    }
    const sculpt = createSculptor(THREE), ax = centre.x + toward.x * 0.3, az = centre.z + toward.y * 0.3, side = rnd() < 0.5 ? 1 : -1;
    const big = rr(0.3, 0.35), mid = rr(0.21, 0.25), small = rr(0.13, 0.16);
    const beside = (along, across) => [ax + toward.x * along + toward.y * side * across, az + toward.y * along - toward.x * side * across];
    addPumpkin(sculpt, ...beside(-0.12, 0), big, 9, rr(0.7, 0.78), rr(0, TAU));
    addPumpkin(sculpt, ...beside(0.1, -(big + mid * 0.75)), mid, 8, rr(0.78, 0.9), rr(0, TAU));
    addPumpkin(sculpt, ...beside(0.2, big + small * 0.5), small, 7, rr(0.66, 0.76), rr(0, TAU));
    const [x1, z1] = beside(0.36, 0.1), [x2, z2] = beside(0.3, -0.08);
    addMushroom(sculpt, x1, 0, z1, 0.11, 0.02, 0.01);
    addMushroom(sculpt, x2, 0, z2, 0.07);
    addMesh('pumpkins', sculpt.geometry(), glossy, true);
  }
}

// ============================================================ the scarecrow ============================================================

function buildScarecrow(kit) {
  const { c, THREE, rnd, rr, colours, matte, addMesh, boulderShape, addLimb, addSpike, tubeShape } = kit;
  const sculpt = createSculptor(THREE), spot = c.tc(...c.level.scarecrow), start = c.tc(...c.level.start);
  const place = c.mtx(spot.x, 0, spot.z, 1, 1, 1, Math.atan2(start.x - spot.x, start.z - spot.z));   // it faces the place where the player starts
  const at = (x, y, z) => new THREE.Vector3(x, y, z), flat = (colour) => (p, n, u, v, col) => col.copy(colour);
  const INK = colours({
    wood: '#7d5f43', woodDark: '#5a4330', coat: '#74452f', coatDark: '#48291d', lining: '#2e1d14', straw: '#c9a94f', strawDark: '#9c7d33',
    burlap: '#b38f55', burlapDark: '#8a6a3a', burlapLight: '#c9a970', thread: '#3b2519', button: '#2c1f18', cheek: '#b85a40', nose: '#c8650f',
    rope: '#a8925c', ropeDark: '#7a6840', hat: '#473b75', hatDark: '#2d2550', hatLight: '#5d4f92', gold: '#c99a2a', goldLight: '#e6c35a',
    ochre: '#c08f2f', teal: '#3f857c', maroon: '#8e3a30',
  });
  INK.glint = new THREE.Color(1.5, 1.5, 1.5);    // brighter than white paint: the sparkle in the button eyes

  // ---------- the frame: a post and a crossbar ----------
  const woodPaint = (p, n, u, v, col) => col.copy(INK.woodDark).lerp(INK.wood, c.noise2(u * 6 + p.y * 3, p.x * 3));
  addLimb(sculpt, at(0, 0, 0), at(0, 2, 0), 0.045, woodPaint, { bumps: 0.1, matrix: place, brush: 0.8 });
  addLimb(sculpt, at(-0.74, 1.49, 0), at(0.74, 1.55, 0), 0.034, woodPaint, { along: 3, bumps: 0.1, matrix: place, brush: 0.8 });

  // ---------- small things sewn or pinned onto a surface ----------
  // surface(u, v, out, puff) gives a point on the surface, pushed outwards by `puff`; (u0, v0) is where the thing sits,
  // du x dv its size, all in the surface's own parameters
  const patch = (surface, u0, v0, du, dv, puff, paint, cells = 3) => sculpt.add(
    steps(cells, u0 - du / 2, u0 + du / 2), steps(cells, v0 - dv / 2, v0 + dv / 2), (u, v, out) => surface(u, v, out, puff), paint, { matrix: place });
  const dot = (surface, u0, v0, du, dv, puff, paint, sides = 10, spin = 0) => sculpt.add(steps(sides), [0, 0.65, 1],
    (a, w, out) => surface(u0 + Math.cos(a * TAU + spin) * w * du, v0 + Math.sin(a * TAU + spin) * w * dv, out, puff + 0.02 * (1 - w * w)),
    paint, { wrap: true, flip: true, matrix: place });
  const stitches = (surface, u0, v0, du, dv, puff, tick) => {                                    // three ticks of thread across each side of a patch
    for (const k of [-0.3, 0, 0.3]) for (const side of [-0.5, 0.5]) {
      patch(surface, u0 + side * du, v0 + k * dv, tick * 2.4 * du / dv, tick * 0.5, puff, flat(INK.thread), 1);
      patch(surface, u0 + k * du, v0 + side * dv, tick * 0.5 * du / dv, tick * 2.4, puff, flat(INK.thread), 1);
    }
  };

  // ---------- the coat: v runs from the neck down to a ragged hem that the wind pushes to one side ----------
  const COAT_Y = [1.67, 1.58, 1.44, 1.2, 0.98, 0.76], COAT_X = [0.07, 0.27, 0.31, 0.29, 0.38, 0.46], COAT_Z = [0.07, 0.12, 0.15, 0.16, 0.22, 0.29];
  const coatPoint = (u, v, out, puff = 1) => {
    const a = u * TAU, folds = 1 + 0.07 * Math.sin(a * 7 + 1) * smooth(0.5, 1, v), ragged = 0.06 * Math.abs(Math.sin(a * 5.5 + 2)) * smooth(0.9, 1, v);
    return out.set(Math.cos(a) * spline(COAT_X, v) * folds * puff + 0.07 * v * v, spline(COAT_Y, v) + ragged, Math.sin(a) * spline(COAT_Z, v) * folds * puff);
  };
  const coatPaint = (p, n, u, v, col) => col.copy(INK.coat)
    .lerp(INK.coatDark, 0.45 * smooth(0.55, 1, v) + 0.4 * (0.5 - 0.5 * Math.sin(u * TAU * 7 + 1)) * smooth(0.5, 1, v));
  sculpt.add(steps(30), steps(12), coatPoint, coatPaint, { wrap: true, matrix: place });
  sculpt.add(steps(30), [0.7, 0.85, 1], (u, v, out) => coatPoint(u, v, out, 0.97), flat(INK.lining), { wrap: true, flip: true, matrix: place });
  patch(coatPoint, 0.165, 0.36, 0.075, 0.11, 1.035, flat(INK.ochre)); stitches(coatPoint, 0.165, 0.36, 0.075, 0.11, 1.05, 0.022);
  patch(coatPoint, 0.345, 0.74, 0.07, 0.13, 1.03, flat(INK.teal)); stitches(coatPoint, 0.345, 0.74, 0.07, 0.13, 1.045, 0.022);
  patch(coatPoint, 0.72, 0.55, 0.075, 0.12, 1.03, flat(INK.maroon)); stitches(coatPoint, 0.72, 0.55, 0.075, 0.12, 1.045, 0.022);
  for (const v of [0.3, 0.47]) dot(coatPoint, 0.25, v, 0.02, 0.032, 1.06, flat(INK.button));
  // a rope belt
  const ropePaint = (p, n, u, v, col) => col.copy(INK.rope).lerp(INK.ropeDark, 0.5 + 0.5 * Math.sin(v * TAU * 12));
  const loop = (surface, v, puff) => steps(11).slice(0, -1).map((u) => surface(u, v, at(0, 0, 0), puff));
  sculpt.add(steps(6), steps(24), tubeShape(loop(coatPoint, 0.5, 1.04), 24, () => 0.016, true), ropePaint, { wrap: true, matrix: place });

  // ---------- sleeves hanging from the crossbar, straw hands sticking out of them ----------
  const strawPaint = () => { const tone = rnd(); return (p, n, u, v, col) => col.copy(INK.strawDark).lerp(INK.straw, tone); };
  const sleevePaint = (p, n, u, v, col) => col.copy(INK.coat).lerp(INK.coatDark, 0.4 * smooth(0.6, 1, v));
  for (const side of [-1, 1]) {
    const sleeve = tubeShape([at(side * 0.18, 1.54, 0), at(side * 0.32, 1.5, 0), at(side * 0.48, 1.48, 0), at(side * 0.64, 1.5 + side * 0.02, 0)], 8,
      (v, u) => lerp(0.12, 0.085, Math.sqrt(v)) + 0.014 * Math.abs(Math.sin(u * TAU * 3)) * smooth(0.7, 1, v));
    sculpt.add(steps(14), steps(8), sleeve, sleevePaint, { wrap: true, matrix: place });
    sculpt.add(steps(14), [0.75, 0.875, 1], sleeve, flat(INK.lining), { wrap: true, flip: true, matrix: place });
    for (let i = 0; i < 11; i++) {
      const wrist = at(side * 0.6, 1.5 + rr(-0.03, 0.03), rr(-0.03, 0.03));
      const reach = at(side, rr(-0.55, 0.35), rr(-0.45, 0.45)).normalize().multiplyScalar(rr(0.16, 0.28));
      addSpike(sculpt, wrist, reach.add(wrist), rr(0.012, 0.018), strawPaint(), place);
    }
  }
  for (let i = 0; i < 12; i++) {                  // a straw collar
    const a = (i + rr(-0.3, 0.3)) / 12 * TAU;
    addSpike(sculpt, at(Math.cos(a) * 0.06, 1.67, Math.sin(a) * 0.06), at(Math.cos(a) * 0.21, 1.6 - rr(0, 0.06), Math.sin(a) * 0.17),
      rr(0.014, 0.02), strawPaint(), place);
  }
  for (let i = 0; i < 14; i++) {                  // straw hanging out under the hem
    const a = (i + rr(-0.3, 0.3)) / 14 * TAU;
    addSpike(sculpt, at(Math.cos(a) * 0.1, 0.92, Math.sin(a) * 0.08), at(Math.cos(a) * 0.18 + 0.05, rr(0.42, 0.58), Math.sin(a) * 0.15),
      rr(0.016, 0.022), strawPaint(), place);
  }

  // ---------- the head: a stuffed burlap sack tied at the neck, with a sewn-on face ----------
  const HEAD = at(0, 1.88, 0.01), sack = boulderShape(0.215, 0.24, 0.205, { square: 2.25, lump: 0.045, cuts: 0 });
  const headPoint = (u, v, out, puff = 1) => sack(u, v, out).multiplyScalar(puff).add(HEAD);
  const burlapPaint = (p, n, u, v, col) => col.copy(INK.burlapDark).lerp(INK.burlap, 0.4 + 0.6 * c.noise2(u * 8, v * 5))
    .lerp(INK.burlapDark, 0.5 * smooth(0.75, 1, v));
  sculpt.add(steps(24), steps(13), headPoint, burlapPaint, { wrap: true, matrix: place });
  const gatherShape = (u, v, out) => {            // the gathered end of the sack under the rope
    const frill = 1 + 0.1 * v * Math.sin(u * TAU * 6);
    return out.set(Math.cos(u * TAU) * lerp(0.085, 0.135, v) * frill, 1.675 - 0.075 * v, Math.sin(u * TAU) * lerp(0.085, 0.125, v) * frill);
  };
  sculpt.add(steps(16), steps(2), gatherShape, flat(INK.burlapDark), { wrap: true, matrix: place });
  const neck = steps(8).slice(0, -1).map((u) => at(Math.cos(u * TAU) * 0.09, 1.672, Math.sin(u * TAU) * 0.088));
  sculpt.add(steps(6), steps(14), tubeShape(neck, 14, () => 0.014, true), ropePaint, { wrap: true, matrix: place });
  const FRONT = 0.25;                             // the face looks along +z; one unit of u is about 1.3 m round the head, one unit of v 0.75 m
  dot(headPoint, FRONT - 0.058, 0.43, 0.031, 0.053, 1.03, flat(INK.button));                     // button eyes, one a little bigger than the other
  dot(headPoint, FRONT + 0.058, 0.44, 0.025, 0.043, 1.03, flat(INK.button));
  dot(headPoint, FRONT - 0.064, 0.415, 0.007, 0.012, 1.075, flat(INK.glint), 6);
  dot(headPoint, FRONT + 0.053, 0.428, 0.006, 0.01, 1.07, flat(INK.glint), 6);
  dot(headPoint, FRONT, 0.535, 0.024, 0.042, 1.035, flat(INK.nose), 3, Math.PI / 2);              // a felt triangle for a nose
  for (const side of [-1, 1]) dot(headPoint, FRONT + side * 0.105, 0.58, 0.026, 0.044, 1.012, flat(INK.cheek));
  const smileU = (t) => FRONT + 0.095 * t, smileV = (t) => 0.67 - 0.055 * t * t;
  sculpt.add(steps(12, -1, 1), [-1, 0, 1], (t, b, out) => headPoint(smileU(t), smileV(t) + b * 0.011, out, 1.03 + 0.012 * (1 - b * b)),
    flat(INK.thread), { matrix: place });
  for (const t of [-0.84, -0.42, 0, 0.42, 0.84]) patch(headPoint, smileU(t), smileV(t), 0.007, 0.062, 1.05, flat(INK.thread), 1);
  patch(headPoint, FRONT + 0.1, 0.27, 0.055, 0.085, 1.025, flat(INK.burlapLight)); stitches(headPoint, FRONT + 0.1, 0.27, 0.055, 0.085, 1.04, 0.018);

  // ---------- the witch hat: a floppy brim, a crooked crown, a gold band with a buckle ----------
  const hatPlace = place.clone().multiply(c.mtx(0, 2.01, 0, 1, 1, 1, 0.3, -0.1, 0.12));
  const BRIM_R = [0.19, 0.33, 0.46, 0.478, 0.46, 0.33, 0.19], BRIM_Y = [0.012, 0.008, 0, -0.008, -0.016, -0.008, -0.004];
  sculpt.add(steps(26), steps(6), (u, v, out) => {
    const r = spline(BRIM_R, v), far = Math.pow(clamp01((r - 0.19) / 0.28), 1.5);
    return out.set(Math.cos(u * TAU) * r, spline(BRIM_Y, v) + far * (0.05 * Math.sin(u * TAU * 3 + 0.6) - 0.045), Math.sin(u * TAU) * r);
  }, (p, n, u, v, col) => col.copy(v > 0.55 ? INK.hatDark : INK.hat).lerp(INK.hatLight, 0.5 * smooth(0.3, 0.5, v) * (v < 0.55 ? 1 : 0)),
  { wrap: true, matrix: hatPlace });
  const crown = tubeShape([at(0, 0, 0), at(0, 0.17, 0), at(0.035, 0.33, -0.02), at(0.12, 0.44, -0.05), at(0.23, 0.46, -0.08), at(0.3, 0.39, -0.1)], 12,
    (v) => 0.2 * Math.pow(1 - v, 0.85) * (1 + 0.06 * Math.sin(v * 30) * smooth(0.3, 0.6, v)));
  sculpt.add(steps(18), steps(12), crown, (p, n, u, v, col) => col.copy(INK.hat).lerp(INK.hatLight, 0.5 * smooth(0.2, 1, n.y)), { wrap: true, matrix: hatPlace });
  const band = steps(10).slice(0, -1).map((u) => at(Math.cos(u * TAU) * 0.197, 0.04, Math.sin(u * TAU) * 0.197));
  sculpt.add(steps(6), steps(18), tubeShape(band, 18, () => 0.022, true), flat(INK.gold), { wrap: true, matrix: hatPlace });
  sculpt.add(steps(10), steps(6), boulderShape(0.04, 0.034, 0.012, { square: 5, lump: 0, cuts: 0 }), flat(INK.goldLight),
    { wrap: true, matrix: hatPlace.clone().multiply(c.mtx(0, 0.04, 0.218)) });

  addMesh('scarecrow', sculpt.geometry(), matte, true);
}

// ============================================================ butterflies ============================================================

function buildButterflies(kit) {
  const { c, THREE, scene, clock, rr } = kit;
  // four wing patterns side by side; each picture is one pair of wings (front of the insect at the top) with half the body along its left edge
  const KINDS = [                                 // [wing, glow near the body, edge and veins, spots]
    ['#f39a2c', '#ffd27a', '#2a1a12', '#fff3d6'], ['#3f86e0', '#9fd0ff', '#141c38', '#d8ecff'],
    ['#f2d43a', '#fff3a0', '#3a2a12', '#fff8d0'], ['#f6f2ec', '#ffffff', '#7a5a70', '#f2a8c8'],
  ];
  const CELL = 128;
  const wings = c.canvasTex(CELL * KINDS.length, CELL, (ctx) => {
    const FORE = [[4, 60], [20, 10, 80, 0, 122, 14], [128, 40, 96, 66, 62, 70], [40, 72, 16, 68, 4, 66]];          // a start point, then bezier curves
    const HIND = [[4, 64], [30, 62, 70, 66, 92, 84], [100, 108, 70, 124, 46, 120], [22, 114, 8, 92, 4, 72]];
    const SPOTS = [[112, 22, 3.2], [104, 36, 2.6], [92, 48, 2.6], [78, 57, 2.2], [86, 90, 2.6], [80, 104, 2.6], [64, 113, 2.4], [48, 113, 2.2]];
    const trace = ([start, ...curves]) => { ctx.beginPath(); ctx.moveTo(...start); for (const q of curves) ctx.bezierCurveTo(...q); ctx.closePath(); };
    KINDS.forEach(([wing, glow, edge, spots], k) => {
      ctx.save(); ctx.translate(k * CELL, 0);
      for (const outline of [HIND, FORE]) {
        const fill = ctx.createRadialGradient(4, 64, 6, 4, 64, 110);
        fill.addColorStop(0, glow); fill.addColorStop(0.6, wing); fill.addColorStop(1, wing);
        trace(outline); ctx.fillStyle = fill; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = edge; ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {             // veins fanning out from the body
          const a = (outline === FORE ? -1.05 : 0.1) + i * 0.2;
          ctx.beginPath(); ctx.moveTo(4, 64); ctx.lineTo(4 + Math.cos(a) * 140, 64 + Math.sin(a) * 140); ctx.stroke();
        }
        ctx.lineWidth = 11; trace(outline); ctx.stroke();                                         // a dark margin, kept inside the wing by the clip
        ctx.restore();
      }
      ctx.fillStyle = spots;
      for (const [x, y, r] of SPOTS) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = edge; ctx.beginPath(); ctx.ellipse(0, 66, 5, 40, 0, 0, TAU); ctx.fill();    // body
      ctx.restore();
    });
  });

  // each butterfly loops round a home of its own, well away from the hollow log: [x, y, z, how far it wanders in x, in z]
  const HOMES = [[3.3, 0.75, 11.0, 0.9, 1.0], [8.8, 0.9, 13.6, 1.6, 1.3], [5.6, 0.8, 15.2, 1.2, 1.0], [18.4, 1.0, 13.6, 1.4, 1.2],
    [18.4, 1.1, 7.2, 1.8, 1.0], [7.6, 1.0, 8.6, 0.8, 1.2], [13.6, 0.9, 18.2, 1.0, 1.4]];
  const position = [], uv = [], home = [], flight = [], index = [];
  HOMES.forEach(([x, y, z, rx, rz], i) => {
    const kind = i % KINDS.length, pace = rr(0.35, 0.6), offset = rr(0, 40), size = rr(0.075, 0.095);
    for (const side of [-1, 1]) {
      const first = position.length / 3;
      for (const [across, along] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        position.push(side * across * size, 0, (0.5 - along) * size);
        uv.push((kind + across * 0.985) / KINDS.length, 1 - along);
        home.push(x, y, z); flight.push(rx, rz, pace, offset);
      }
      index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aHome', new THREE.Float32BufferAttribute(home, 3));
  geo.setAttribute('aFlight', new THREE.Float32BufferAttribute(flight, 4));
  geo.setIndex(index);
  const look = new THREE.MeshBasicMaterial({ map: wings, color: new THREE.Color(1.5, 1.5, 1.5), alphaTest: 0.5, side: THREE.DoubleSide });
  look.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = clock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec3 aHome;\nattribute vec4 aFlight;')
      .replace('#include <begin_vertex>', /* glsl */`
        // each butterfly wanders round its home on a loop; the wings beat about the body's line and the body bobs with them
        float along = uTime * aFlight.z + aFlight.w;
        vec3 centre = aHome + vec3(sin(along) * aFlight.x, 0.25 * sin(along * 2.3 + aFlight.w) + 0.05 * sin(along * 9.0), cos(along * 0.8) * aFlight.y);
        vec2 heading = normalize(vec2(cos(along) * aFlight.x, -0.8 * sin(along * 0.8) * aFlight.y) + 1e-4);
        float beat = sin(uTime * 16.0 + aFlight.w * 5.0), lift = 0.5 + 0.8 * beat;
        vec3 wing = vec3(position.x * cos(lift), abs(position.x) * sin(lift) - 0.015 * beat, position.z);
        vec3 transformed = centre + vec3(wing.x * heading.y + wing.z * heading.x, wing.y, wing.z * heading.y - wing.x * heading.x);`);
  };
  const mesh = new THREE.Mesh(geo, look);
  mesh.name = 'butterflies'; mesh.frustumCulled = false;       // they roam the whole clearing
  scene.add(mesh);
}
