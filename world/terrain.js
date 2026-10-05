// world/terrain.js: the ground and everything that grows low on it (grass, flowers, clover, ferns, fallen leaves, pebbles).
// Contract: export function buildTerrain(c) -> { update(dt, t) }   (c = world/common.js instance)
//   update() also takes the point index.html passes third (where Anne stands) and parts the grass around it; without it nothing parts.
//
//   ground  One mesh. Two colour maps are painted at load from the tile map (meadow and forest floor; bare earth for the
//           paths, the pond shore and the patch under the log) and blended in the shader along a ragged edge. Two tiling
//           "brush" textures add the close-up detail: painted blades on the meadow, mottling on the earth.
//   grass   Instanced clumps (c.addInst). Every blade is a ribbon that turns its face to the camera, so the meadow looks
//           full from any angle. The vertex shader bends the blades in the wind and parts them around Anne's feet.
//   cover   One merged mesh: flowers, clover, broad-leaved plants, ferns, fallen leaves, pebbles. Same material as the grass.
// Ground cover never casts shadows; all of it receives them.

const FIELD_RES = 4;              // samples per tile of the blurred map fields
const MAP_RES = 16;               // pixels per tile of the two colour maps
const BRUSH_PX = 1024;            // size of a tiling brush texture
const NOISE_PX = 256;             // size of the noise kept in a brush's alpha channel
const GRASS_BRUSH_M = 3.2;        // metres covered by one repeat of the grass brush
const EARTH_BRUSH_M = 4.8;
const EDGE_GRASS = 0.3;           // how far each brush's noise pushes the edge between turf and bare earth
const EDGE_EARTH = 0.12;
const UP = [0, 1, 0];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };   // GLSL smoothstep; a > b gives a falling edge
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const srgbToLinear = (byte) => { const v = byte / 255; return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const linearToSrgb = (v) => 255 * (v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

// Colours in this file are written as the scene colour in full sun (post.js then adds a little contrast and saturation).
// world/sky.js lights an upward-facing surface to about 2.5 times its albedo there (0.7 times, and cooler, in shade),
// so the albedo is the written colour divided by that.
const SUN_GAIN = 2.5;
const lit = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16)) / SUN_GAIN);      // albedo, linear rgb
const litBytes = (hex) => lit(hex).map(linearToSrgb);                                                        // the same as sRGB bytes, for painting
const ink = (hex) => litBytes(hex).map(Math.round).join(',');

export function buildTerrain(c) {
  ANISO_ULTRA = c.ultra ? c.ANISO : 0;
  const map = readMap(c);
  const limit = heightLimit(c, map);
  const brushRng = c.rng(1337);
  const brushes = {
    grass: makeBrush(c, map, brushRng, paintGrassBrush, 5, 4, GRASS_BRUSH_M, 4),       // the painted blades must stay crisp at a low angle
    earth: makeBrush(c, map, brushRng, paintEarthBrush, 7, 3, EARTH_BRUSH_M, 2),
  };
  const ferns = fernSpots(c, map, limit), stones = stoneSpots(c, map);
  const ground = paintGround(c, map, brushes, ferns, stones);
  c.scene.add(groundMesh(c, map, ground, brushes));

  const time = { value: 0 }, feet = { value: new c.THREE.Vector3(0, 0, -1000) };      // far away until update() is given Anne's position
  const press = { value: new c.THREE.Vector2(0.45, 0.55) };                            // x: radius pressed down (m), y: how flat
  const material = coverMaterial(c, time, feet, press);
  plantGrass(c, map, ground, material, limit);
  c.scene.add(coverMesh(c, map, ground, material, limit, ferns, stones));

  // `flat` (optional): { p, r, k } flattens a wider patch instead (someone sitting in the grass)
  let grass = null;                                // the grass chunks (made by c.flushInst after every module has built)
  return { update(dt, t, focus, flat) {
    time.value = t; if (flat) { feet.value.copy(flat.p); press.value.set(flat.r, flat.k); } else { if (focus) feet.value.copy(focus); press.value.set(0.45, 0.55); }
    if (!c.camera) return;
    if (!grass) grass = c.scene.children.filter((o) => o.isInstancedMesh && o.name.startsWith('inst:grass'));
    const e = c.camera.position;
    for (const m of grass) { const b = m.boundingSphere; m.visible = Math.hypot(b.center.x - e.x, b.center.z - e.z) - b.radius < GRASS_FAR; }
  } };
}

// ---------- the map: tile tests and smooth fields derived from the tiles ----------

function readMap(c) {
  const { S, M, W, H, tileAt, walkAt, tallAt, inCliff, LOG_TILE } = c;
  const outs = c.level.pathsOut || [[6, 'north'], [8, 'south']];
  // the paths that leave the map carry on through the forest margin: [column, 'north' | 'south'] or [row, 'west' | 'east']
  const isPath = (x, y) => tileAt(x, y) === 'd' || outs.some(([n, side]) => (side === 'north' ? x === n && y < 0 : side === 'south' ? x === n && y >= H : side === 'west' ? y === n && x < 0 : y === n && x >= W));
  const isPond = (x, y) => (tileAt(x, y) === '~' || tileAt(x, y) === 'W') && !inCliff(x, y);
  const isOpen = (x, y) => !inCliff(x, y) && (walkAt(x, y) || isPath(x, y) || isPond(x, y));
  const tilesX = W + 2 * M, tilesZ = H + 2 * M;
  const dirt = blurredField(c, (x, y) => (isPath(x, y) && !tallAt(x, y) ? 1 : 0), 1);
  return {
    x0: -M * S, z0: -M * S, tilesX, tilesZ, sizeX: tilesX * S, sizeZ: tilesZ * S,
    isPath, isPond,
    // each field is 1 on its tiles and fades smoothly to 0 around them
    open: blurredField(c, (x, y) => (isOpen(x, y) ? 1 : tileAt(x, y) === 'g' && !inCliff(x, y) ? 0.7 : 0), 2),
    walk: blurredField(c, (x, y) => (walkAt(x, y) ? 1 : 0), 1),
    pond: blurredField(c, (x, y) => (isPond(x, y) ? 1 : 0), 1),
    tall: blurredField(c, (x, y) => (tallAt(x, y) ? 1 : 0), 1),
    cliff: blurredField(c, (x, y) => (inCliff(x, y) ? 1 : 0), 1),
    // the dirt field, read at a wandering position so the path edges ignore the tile grid
    dirtAt: (wx, wz) => dirt(wx + (c.fbm2(wx * 0.3 + 11, wz * 0.3 + 3, 2) - 0.5) * 1.2, wz + (c.fbm2(wx * 0.3 + 57, wz * 0.3 + 41, 2) - 0.5) * 1.2),
    // metres from a point to the nearest dirt-path tile (looks one tile around; Infinity if none is that close)
    pathDistance(wx, wz) {
      const tx = Math.floor(wx / S), ty = Math.floor(wz / S);
      let best = Infinity;
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
        if (!isPath(x, y)) continue;
        best = Math.min(best, Math.hypot(Math.max(x * S - wx, 0, wx - (x + 1) * S), Math.max(y * S - wz, 0, wz - (y + 1) * S)));
      }
      return best;
    },
    // the log's tile stays bare (logscene.js stands the log there and lays Anne in it)
    onLogTile: (wx, wz, margin) => Math.abs(wx - (LOG_TILE[0] + 0.5) * S) < S / 2 + margin && Math.abs(wz - (LOG_TILE[1] + 0.5) * S) < S / 2 + margin,
  };
}

function blurredField(c, value, radius) {
  const { S, M, W, H } = c, w = (W + 2 * M) * FIELD_RES, h = (H + 2 * M) * FIELD_RES;
  const data = new Float32Array(w * h), row = new Float32Array(w * h), k = 1 / (2 * radius + 1);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = value(Math.floor(i / FIELD_RES) - M, Math.floor(j / FIELD_RES) - M);
  for (let pass = 0; pass < 3; pass++) {            // three box blurs make a smooth bell
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let sum = 0; for (let d = -radius; d <= radius; d++) sum += data[j * w + Math.min(w - 1, Math.max(0, i + d))];
      row[j * w + i] = sum * k;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let sum = 0; for (let d = -radius; d <= radius; d++) sum += row[Math.min(h - 1, Math.max(0, j + d)) * w + i];
      data[j * w + i] = sum * k;
    }
  }
  return (wx, wz) => bilinear(data, w, h, (wx / S + M) * FIELD_RES - 0.5, (wz / S + M) * FIELD_RES - 0.5);
}

// value at (fx, fy) in a w x h grid; `stride` and `offset` pick one channel of interleaved data
function bilinear(data, w, h, fx, fy, stride = 1, offset = 0) {
  fx = Math.min(w - 1.001, Math.max(0, fx)); fy = Math.min(h - 1.001, Math.max(0, fy));
  const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y, i = (y * w + x) * stride + offset, down = w * stride;
  return (data[i] * (1 - tx) + data[i + stride] * tx) * (1 - ty) + (data[i + down] * (1 - tx) + data[i + down + stride] * tx) * ty;
}

// How tall ground cover may be at a point (gameplay rules 2 and 3, with a margin for blades that lean):
// 0.35 m anywhere, 0.1 m on dirt-path tiles, 0.2 m within 2.6 m of the log.
function heightLimit(c, map) {
  const log = c.tc(...c.LOG_TILE);
  return (wx, wz) => {
    const path = map.pathDistance(wx, wz), toLog = Math.hypot(wx - log.x, wz - log.z);
    return Math.min(0.34, path < 0.2 ? 0.09 : 0.09 + (path - 0.2) * 0.8, toLog < 2.8 ? 0.18 : 0.18 + (toLog - 2.8) * 0.4);
  };
}

// ---------- textures ----------

function paintPixels(w, h, draw) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  draw(ctx, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

// Built from raw pixels rather than from a canvas so the alpha channel can carry data
// (a canvas would premultiply the colours by it).
let ANISO_ULTRA = 0;                                   // (set by buildTerrain from the quality: Ultra filters every terrain texture at the GPU's best)
function dataTexture(THREE, pixels, w, h, { srgb = false, repeat = false, anisotropy = 1 } = {}) {
  anisotropy = Math.max(anisotropy, ANISO_ULTRA);
  const t = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = anisotropy; t.needsUpdate = true;
  return t;
}

// smooth noise in [0, 1] that repeats exactly; `cells` lattice cells across in the first octave
function tilingNoise(size, cells, octaves, rnd) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++, cells *= 2, amp *= 0.5) {
    const lattice = Float32Array.from({ length: cells * cells }, rnd);
    for (let y = 0; y < size; y++) {
      const fy = y / size * cells, y0 = Math.floor(fy), ty = fy - y0, v = ty * ty * (3 - 2 * ty), ra = (y0 % cells) * cells, rb = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const fx = x / size * cells, x0 = Math.floor(fx), tx = fx - x0, u = tx * tx * (3 - 2 * tx), ca = x0 % cells, cb = (x0 + 1) % cells;
        const p = lattice[ra + ca], q = lattice[ra + cb], r = lattice[rb + ca], s = lattice[rb + cb];
        out[y * size + x] += (p + (q - p) * u + (r - p) * v + (p - q - r + s) * u * v) * amp;
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] = clamp01((out[i] / total - 0.5) * 2.2 + 0.5);      // stretched: summed octaves bunch up around 0.5
  return out;
}

// value of tiling noise at (u, v), measured in repeats
function tiledSample(data, size, u, v) {
  const fx = (u - Math.floor(u)) * size, fy = (v - Math.floor(v)) * size;
  const x = Math.floor(fx) % size, y = Math.floor(fy) % size, tx = fx - Math.floor(fx), ty = fy - Math.floor(fy), x1 = (x + 1) % size, y1 = (y + 1) % size;
  return (data[y * size + x] * (1 - tx) + data[y * size + x1] * tx) * (1 - ty) + (data[y1 * size + x] * (1 - tx) + data[y1 * size + x1] * tx) * ty;
}

// A tiling detail texture. rgb: a painted pattern around mid grey that multiplies the ground colour (grey = no change).
// alpha: noise that makes the edge between turf and earth ragged. noiseAt() returns that noise at a world position.
function makeBrush(c, map, rng, paint, cells, octaves, metres, anisotropy) {
  const pixels = paintPixels(BRUSH_PX, BRUSH_PX, (ctx, size) => paint(ctx, size, rng));
  const noise = tilingNoise(NOISE_PX, cells, octaves, rng.rnd);
  for (let y = 0, o = 3; y < BRUSH_PX; y++) for (let x = 0; x < BRUSH_PX; x++, o += 4) {
    pixels[o] = 255 * tiledSample(noise, NOISE_PX, (x + 0.5) / BRUSH_PX, (y + 0.5) / BRUSH_PX);
  }
  return {
    texture: dataTexture(c.THREE, pixels, BRUSH_PX, BRUSH_PX, { repeat: true, anisotropy }),
    noiseAt: (wx, wz) => tiledSample(noise, NOISE_PX, (wx - map.x0) / metres, (wz - map.z0) / metres),
  };
}

// offsets that make a stroke near the border reappear on the far side, so the brush tiles
const wraps = (v, reach, size) => (v < reach ? [0, size] : v > size - reach ? [0, -size] : [0]);

// a soft round touch of the brush; `core` is the part of the radius that keeps the full strength
function dab(ctx, x, y, radius, ink, alpha, core = 0) {
  const g = ctx.createRadialGradient(x, y, radius * core, x, y, radius);
  g.addColorStop(0, `rgba(${ink},${alpha})`); g.addColorStop(0.5, `rgba(${ink},${alpha * 0.55})`); g.addColorStop(1, `rgba(${ink},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// blades painted as seen from above: shadowed ones first, sunlit ones over them, then a few bright tips
function paintGrassBrush(ctx, size, { rnd, rr }) {
  ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, size, size);
  const cells = 44, step = size / cells;
  for (const [ink, share] of [['94,106,112', 1], ['158,156,118', 1], ['182,178,122', 0.4]]) {
    for (let gy = 0; gy < cells; gy++) for (let gx = 0; gx < cells; gx++) {
      const x = (gx + rnd()) * step, y = (gy + rnd()) * step, len = rr(24, 50), wide = rr(5, 9), dir = rnd() * Math.PI * 2, bend = rr(-0.3, 0.3);
      if (rnd() > share) continue;
      ctx.fillStyle = `rgba(${ink},${rr(0.35, 0.7)})`;
      const dx = Math.cos(dir), dy = Math.sin(dir);
      for (const ox of wraps(x, len, size)) for (const oy of wraps(y, len, size)) {
        const bx = x + ox, by = y + oy, tipX = bx + (dx - dy * bend) * len, tipY = by + (dy + dx * bend) * len;
        const midX = bx + dx * len * 0.5, midY = by + dy * len * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx + dy * wide / 2, by - dx * wide / 2);
        ctx.quadraticCurveTo(midX + dy * wide * 0.45, midY - dx * wide * 0.45, tipX, tipY);
        ctx.quadraticCurveTo(midX - dy * wide * 0.45, midY + dx * wide * 0.45, bx - dy * wide / 2, by + dx * wide / 2);
        ctx.fill();
      }
    }
  }
}

// trodden earth: broad dry and damp patches under smaller, firmer touches of the brush
function paintEarthBrush(ctx, size, { rnd, rr }) {
  ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, size, size);
  const touches = (count, radius, alpha, core) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * size, y = rnd() * size, r = rr(...radius), ink = rnd() < 0.5 ? '156,151,142' : '100,98,97', a = rr(...alpha);
      for (const ox of wraps(x, r, size)) for (const oy of wraps(y, r, size)) dab(ctx, x + ox, y + oy, r, ink, a, core);
    }
  };
  touches(260, [40, 110], [0.12, 0.26], 0);
  touches(520, [9, 30], [0.1, 0.24], 0.55);
}

// The two colour maps of the ground, and what the planting code needs to know about them.
//   meadowMap  rgb: turf fading into the dark forest floor.  alpha: how strongly bare earth shows through.
//   earthMap   rgb: bare earth (paths, damp pond shore and bed, the worn patch under the log, the fire place).
function paintGround(c, map, brushes, ferns, stones) {
  const { THREE, S, W, H, level } = c, { rnd, rr } = c.rng(4099);
  const w = map.tilesX * MAP_RES, h = map.tilesZ * MAP_RES, perMetre = MAP_RES / S;
  const toPixel = (wx, wz) => [(wx - map.x0) * perMetre, (wz - map.z0) * perMetre];
  const log = c.tc(...c.LOG_TILE), fire = c.tc(...(level.campfire || [-60, -60]));

  // broad, hand-laid colour: many big soft dabs over a flat wash
  const wash = (colour, inks, count, radius, alpha) => paintPixels(w, h, (ctx) => {
    ctx.fillStyle = `rgb(${ink(colour)})`; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const [x, y] = toPixel(rr(-2 * S, (W + 2) * S), rr(-2 * S, (H + 2) * S));
      dab(ctx, x, y, rr(...radius) * perMetre, ink(inks[Math.floor(rnd() * inks.length)]), rr(...alpha));
    }
  });
  const turfPaint = wash('#5f9643', ['#7fb850', '#6ca64a', '#59903f', '#487e3a', '#427a43', '#8dc055'], 560, [0.8, 3.0], [0.16, 0.42]);
  const earthPaint = wash('#b4946f', ['#c0a47b', '#aa885f', '#9e7a54', '#bb9b71', '#ae9a80'], 420, [0.4, 1.6], [0.14, 0.36]);
  // soft contact shadows under things that stand on the ground
  const shade = paintPixels(w, h, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    const under = (x, z, radius, alpha) => dab(ctx, ...toPixel(x, z), radius * perMetre, '0,0,0', alpha);
    under(log.x, log.z, 1.0, 0.4);
    for (const f of ferns) under(f.x, f.z, f.reach * 1.1, 0.34);
    for (const s of stones) if (s.radius > 0.04) under(s.x - s.radius * 0.4, s.z + s.radius * 0.4, s.radius * 2.2, 0.5);      // towards the south-west, away from the sun
    for (const [x, y] of level.objects.flowers) { const p = c.tc(x, y); under(p.x, p.z, 0.9, 0.12); }
  });

  const FLOOR = litBytes('#45543e'), LITTER = litBytes('#59513f'), TALL_TINT = [0.76, 0.88, 0.8];
  const DAMP = litBytes('#78644f'), POND_BED = litBytes('#405051'), HUMUS = litBytes('#866e54'), ASH = litBytes('#9d9a98'), CHAR = litBytes('#423c3b');
  const meadowPixels = new Uint8ClampedArray(w * h * 4), earthPixels = new Uint8ClampedArray(w * h * 4), meadowMask = new Float32Array(w * h);
  for (let j = 0, o = 0; j < h; j++) for (let i = 0; i < w; i++, o += 4) {
    const wx = map.x0 + (i + 0.5) / perMetre, wz = map.z0 + (j + 0.5) / perMetre;
    const open = map.open(wx, wz), pond = map.pond(wx, wz), tall = map.tall(wx, wz), dirt = map.dirtAt(wx, wz);
    const mottle = c.fbm2(wx * 0.55 + 31, wz * 0.55 + 7, 3), broad = c.fbm2(wx * 0.16 + 5, wz * 0.16 + 90, 2);
    const underLog = clamp01(1.15 - 0.65 * Math.hypot((wx - log.x) / 0.62, (wz - log.z) / 0.76));
    const toFire = Math.hypot(wx - fire.x, wz - fire.z);
    const beyondMap = Math.hypot(Math.max(-wx, wx - W * S, 0), Math.max(-wz, wz - H * S, 0));
    const meadow = smooth(0.14, 0.44, open + (mottle - 0.5) * 0.16);
    const light = (shade[o] / 255) * (1 - 0.4 * smooth(0.03, 0.5, map.cliff(wx, wz))) * (1 - 0.5 * smooth(1, 10, beyondMap));
    for (let k = 0; k < 3; k++) {
      const floor = mix(FLOOR[k], LITTER[k], smooth(0.35, 0.7, mottle)) * (0.85 + 0.3 * broad);
      const turf = turfPaint[o + k] * (0.9 + 0.2 * mottle) * mix(1, TALL_TINT[k], smooth(0.3, 0.7, tall)) * mix(0.8, 1, smooth(0.45, 0.9, open));
      meadowPixels[o + k] = mix(floor, turf, meadow) * light;
      let soil = earthPaint[o + k] * mix(0.84, 1.08, smooth(0.5, 0.95, dirt)) * mix(0.55, 1, smooth(0.25, 0.7, open));
      soil = mix(soil, DAMP[k], smooth(0.1, 0.45, pond));
      soil = mix(soil, POND_BED[k], smooth(0.45, 0.75, pond));
      soil = mix(soil, HUMUS[k], clamp01(underLog * 1.3));
      soil = mix(soil, ASH[k], 0.35 * smooth(1.3, 0.7, toFire));
      soil = mix(soil, CHAR[k], 0.7 * smooth(0.75, 0.2, toFire));
      earthPixels[o + k] = soil * light;
    }
    meadowPixels[o + 3] = 255 * Math.max(dirt, smooth(0.08, 0.5, pond), underLog);
    earthPixels[o + 3] = 255;
    meadowMask[j * w + i] = meadow;
  }

  const at = (data, wx, wz, stride, offset) => bilinear(data, w, h, (wx - map.x0) * perMetre - 0.5, (wz - map.z0) * perMetre - 0.5, stride, offset);
  return {
    meadowMap: dataTexture(THREE, meadowPixels, w, h, { srgb: true }),
    earthMap: dataTexture(THREE, earthPixels, w, h, { srgb: true }),
    // above 0.5 the ground's shader shows bare earth here, below it turf (same sum as in GROUND_COLOUR)
    earthEdge: (wx, wz) => at(meadowPixels, wx, wz, 4, 3) / 255 + (brushes.grass.noiseAt(wx, wz) - 0.5) * EDGE_GRASS + (brushes.earth.noiseAt(wx, wz) - 0.5) * EDGE_EARTH,
    meadowAt: (wx, wz) => at(meadowMask, wx, wz, 1, 0),                                             // 1 in the meadow, 0 on the forest floor
    turfColour: (wx, wz) => [0, 1, 2].map((k) => srgbToLinear(at(meadowPixels, wx, wz, 4, k))),     // linear rgb of the turf map
  };
}

// ---------- the ground ----------

const GROUND_PARS = /* glsl */ `
uniform sampler2D uEarthMap;
uniform sampler2D uGrassBrush;
uniform sampler2D uEarthBrush;
uniform vec4 uBrushScale;`;

const GROUND_COLOUR = /* glsl */ `
vec4 turf = texture2D( map, vMapUv );
vec3 soil = texture2D( uEarthMap, vMapUv ).rgb;
vec4 grassBrush = texture2D( uGrassBrush, vMapUv * uBrushScale.xy );
vec4 earthBrush = texture2D( uEarthBrush, vMapUv * uBrushScale.zw );
float edge = turf.a + ( grassBrush.a - 0.5 ) * ${EDGE_GRASS.toFixed(2)} + ( earthBrush.a - 0.5 ) * ${EDGE_EARTH.toFixed(2)};
float soft = max( fwidth( edge ), 0.015 );
float bare = smoothstep( 0.5 - soft, 0.5 + soft, edge );
float thatch = smoothstep( 0.32, 0.5, edge ) * ( 1.0 - bare );          // the turf's darker rim
float damp = ( 1.0 - smoothstep( 0.5, 0.66, edge ) ) * bare;             // darker soil right beside it
diffuseColor.rgb *= mix( turf.rgb * grassBrush.rgb * ( 2.0 - 0.5 * thatch ), soil * earthBrush.rgb * ( 2.0 - 0.4 * damp ), bare );`;

function groundMesh(c, map, ground, brushes) {
  const { THREE, S, M, W, H, walkAt, inCliff } = c, nx = map.tilesX + 1, nz = map.tilesZ + 1;
  const touches = (x, y, test) => test(x - 1, y - 1) || test(x, y - 1) || test(x - 1, y) || test(x, y);      // the four tiles around a tile corner
  // Height at a tile corner: flat wherever anyone walks and everywhere inside the map (other modules stand things on it),
  // a dip for the pond bed, and a forest floor that swells gently beyond the map's edge.
  const heightAt = (x, y) => {
    if (touches(x, y, (tx, ty) => walkAt(tx, ty) || map.isPath(tx, ty) || inCliff(tx, ty))) return 0;
    if (touches(x, y, map.isPond)) return -0.35;
    const beyondMap = Math.hypot(Math.max(-x, x - W, 0), Math.max(-y, y - H, 0));
    return (smooth(1, M, beyondMap) + 0.5 * c.fbm2(x * 0.45 + 3, y * 0.45 + 8, 2)) * smooth(0, 2.5, beyondMap);
  };
  const position = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), index = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const v = j * nx + i;
    position.set([(i - M) * S, heightAt(i - M, j - M), (j - M) * S], v * 3);
    uv.set([i / map.tilesX, j / map.tilesZ], v * 2);
    if (i < map.tilesX && j < map.tilesZ) index.push(v, v + nx, v + 1, v + 1, v + nx, v + nx + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ map: ground.meadowMap });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEarthMap = { value: ground.earthMap };
    shader.uniforms.uGrassBrush = { value: brushes.grass.texture };
    shader.uniforms.uEarthBrush = { value: brushes.earth.texture };
    shader.uniforms.uBrushScale = { value: new THREE.Vector4(map.sizeX / GRASS_BRUSH_M, map.sizeZ / GRASS_BRUSH_M, map.sizeX / EARTH_BRUSH_M, map.sizeZ / EARTH_BRUSH_M) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>' + GROUND_PARS)
      .replace('#include <map_fragment>', GROUND_COLOUR);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true; mesh.name = 'ground';
  return mesh;
}

// ---------- geometry of everything that grows ----------

// Collects triangles. Every vertex carries, besides position, normal and colour:
//   sway   how far (m) the wind moves it        phase  per-plant random number, so neighbours do not move in step
//   glow   how much it lights up against the sun
//   dir, side   ribbons only: the direction of the ribbon's centre line and the vertex's signed distance from it
function meshBuilder() {
  const position = [], normal = [], color = [], spine = [], blade = [], index = [];
  const b = {
    vert(p, n, rgb, sway = 0, phase = 0, glow = 0, dir = UP, side = 0) {
      position.push(p[0], p[1], p[2]); normal.push(n[0], n[1], n[2]); color.push(rgb[0], rgb[1], rgb[2]);
      spine.push(dir[0], dir[1], dir[2]); blade.push(side, sway, phase, glow);
      return position.length / 3 - 1;
    },
    tri(i, j, k) { index.push(i, j, k); },
    fan(i) { for (let k = 1; k < i.length - 1; k++) index.push(i[0], i[k], i[k + 1]); },
    // triangles between two rows of vertices of equal length
    band(lower, upper) { for (let k = 0; k < lower.length - 1; k++) index.push(lower[k], lower[k + 1], upper[k + 1], lower[k], upper[k + 1], upper[k]); },
    // A strip along `points` that the shader turns to face the camera. A half width of 0 makes a pointed end.
    ribbon(points, halfWidths, colours, sways, glows, phase) {
      let last = null;
      points.forEach((p, i) => {
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
        const dir = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
        const sides = halfWidths[i] > 0 ? [-halfWidths[i], halfWidths[i]] : [0];
        const row = sides.map((side) => b.vert(p, UP, colours[i], sways[i], phase, glows[i], dir, side));
        if (last && last.length === 2 && row.length === 2) b.band(last, row);
        else if (last) b.fan(last.length === 2 ? [row[0], last[0], last[1]] : [last[0], row[1], row[0]]);
        last = row;
      });
    },
    geometry(THREE) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      g.setAttribute('aSpine', new THREE.Float32BufferAttribute(spine, 3));
      g.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 4));
      g.setIndex(index);
      return g;
    },
  };
  return b;
}

// Blades of one clump: segments along the blade, height (the clump is 1 tall), lean from upright at root and tip (radians), half width.
const SHORT_CLUMP = [
  { segs: 2, height: 1.0, lean: [0.08, 0.8], width: 0.14 },
  { segs: 2, height: 0.82, lean: [0.2, 1.0], width: 0.14 },
  { segs: 2, height: 0.64, lean: [0.3, 1.1], width: 0.13 },
  { segs: 2, height: 0.46, lean: [0.45, 1.2], width: 0.13 },
];
const TALL_CLUMP = [
  { segs: 4, height: 1.0, lean: [0.06, 1.05], width: 0.11 },
  { segs: 4, height: 0.88, lean: [0.1, 1.25], width: 0.11 },
  { segs: 3, height: 0.72, lean: [0.18, 1.1], width: 0.11 },
  { segs: 3, height: 0.58, lean: [0.26, 1.2], width: 0.11 },
  { segs: 2, height: 0.44, lean: [0.4, 1.0], width: 0.12 },
  { segs: 2, height: 0.34, lean: [0.5, 1.1], width: 0.12 },
];
// A blade's colour is the turf colour under it times this: darker at the root, sunlit at the tip.
const BLADE_ROOT = [0.67, 0.79, 0.82], BLADE_TIP = [2.44, 1.84, 1.97];

// One clump of blades fanning out from its centre, 1 unit tall; the instance matrix gives it its height and girth.
function clumpGeometry(THREE, { rnd, rr }, blades) {
  const b = meshBuilder();
  blades.forEach((blade, n) => {
    const turn = (n / blades.length + rr(-0.12, 0.12)) * Math.PI * 2, dx = Math.cos(turn), dz = Math.sin(turn), root = rr(0.1, 0.4);
    const tone = rr(0.9, 1.1), phase = rnd();
    const leanAt = (i) => mix(blade.lean[0], blade.lean[1], (i + 0.5) / blade.segs);       // lean of segment i
    let rise = 0; for (let i = 0; i < blade.segs; i++) rise += Math.cos(leanAt(i));
    const step = blade.height / rise;                                                       // length of one segment
    const points = [[dx * root, 0, dz * root]], halfWidths = [], colours = [], sways = [], glows = [];
    for (let i = 0; i <= blade.segs; i++) {
      const t = i / blade.segs, p = points[i], shade = smooth(0, 1, 0.5 * (t + p[1]));
      if (i < blade.segs) points.push([p[0] + dx * Math.sin(leanAt(i)) * step, p[1] + Math.cos(leanAt(i)) * step, p[2] + dz * Math.sin(leanAt(i)) * step]);
      halfWidths.push(i < blade.segs ? blade.width * Math.pow(1 - Math.pow(t, 1.7), 0.8) : 0);
      colours.push(BLADE_ROOT.map((v, k) => mix(v, BLADE_TIP[k], shade) * tone));
      sways.push(0.22 * p[1] * p[1]); glows.push(t * t);
    }
    b.ribbon(points, halfWidths, colours, sways, glows, phase);
  });
  return b.geometry(THREE);
}

function addFlower(b, { rnd, rr }, x, z, height, kind) {
  const size = rr(...kind.size), phase = rnd(), sway = 0.22 * height, turn = rnd() * Math.PI * 2, tilt = rr(0.1, 0.55);
  const st = Math.sin(tilt), ct = Math.cos(tilt), cu = Math.cos(turn), su = Math.sin(turn);
  const axis = [st * cu, ct, st * su], u = [ct * cu, -st, ct * su], v = [-su, 0, cu];      // the way the flower faces, and two directions across its face
  const lean = height * 0.3, top = [x + axis[0] * lean, height, z + axis[2] * lean];
  const at = (du, dv, da) => top.map((t, k) => t + u[k] * du + v[k] * dv + axis[k] * da);
  b.ribbon([[x, 0, z], [x + axis[0] * lean * 0.35, height * 0.55, z + axis[2] * lean * 0.35], top],
    [0.005, 0.0045, 0.004], [kind.stemLow, kind.stem, kind.stem], [0, sway * 0.3, sway], [0, 0, 0], phase);
  const half = size * Math.sin(Math.PI / kind.petals) * 0.66;
  for (let k = 0; k < kind.petals; k++) {
    const a = (k + phase) / kind.petals * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const n = unit(...axis.map((t, m) => t + (u[m] * ca + v[m] * sa) * 0.3));
    const point = (out, side, lift, rgb) => b.vert(at(ca * out * size - sa * side, sa * out * size + ca * side, lift * size), n, rgb, sway, phase, 0.3);
    b.fan([point(0.14, 0, 0.02, kind.throat), point(0.62, -half, 0.1, kind.petal), point(0.97, -half * 0.5, 0.21, kind.petal),
      point(0.97, half * 0.5, 0.21, kind.petal), point(0.62, half, 0.1, kind.petal)]);
  }
  const heart = [b.vert(at(0, 0, size * 0.2), axis, kind.heart, sway, phase)];
  for (let k = 0; k <= 5; k++) {
    const a = k / 5 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    heart.push(b.vert(at(ca * size * 0.27, sa * size * 0.27, size * 0.06), unit(...axis.map((t, m) => t * 0.6 + u[m] * ca + v[m] * sa)), kind.heartRim, sway, phase));
  }
  b.fan(heart);
}

// a low plant of broad leaves that arch up from the centre, each folded a little along its pale midrib
function addBroadleaf(b, { rnd, rr }, x, z, radius, tones) {
  const leaves = 5 + Math.floor(rnd() * 3), turn = rnd() * Math.PI * 2;
  for (let k = 0; k < leaves; k++) {
    const a = turn + (k + rr(-0.25, 0.25)) / leaves * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), len = radius * rr(0.75, 1.1), wide = len * 0.3, rise = rr(0.3, 0.55);
    // a point of the leaf: `along` its length (0..1) and `side` across it (-1..1); the edges stand higher than the midrib
    const point = (along, side, rgb) => {
      const lift = rise * (2.4 * along - 1.9 * along * along) + 0.12 * side * side, slope = rise * (2.4 - 3.8 * along);
      return b.vert([x + (dx * along * len) - dz * side * wide, 0.004 + lift * len, z + (dz * along * len) + dx * side * wide],
        unit(-dx * slope * 0.5 + dz * side * 0.2, 1, -dz * slope * 0.5 - dx * side * 0.2), rgb, 0.006 * along, 0, 0.3);
    };
    const base = point(0.06, 0, tones.dark), tip = point(1, 0, tones.mid);
    const inner = [point(0.42, -0.9, tones.mid), point(0.42, 0, tones.light), point(0.42, 0.9, tones.mid)];
    const outer = [point(0.76, -0.75, tones.mid), point(0.76, 0, tones.light), point(0.76, 0.75, tones.mid)];
    b.fan([base, ...inner]); b.band(inner, outer); b.fan([tip, outer[2], outer[1], outer[0]]);
  }
}

// a little patch of three-leaved clover
function addClover(b, { rnd, rr }, x, z, tones) {
  const leaves = 7 + Math.floor(rnd() * 5);
  for (let n = 0; n < leaves; n++) {
    const a = rnd() * Math.PI * 2, r = 0.17 * Math.sqrt(rnd()), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const y = rr(0.035, 0.075), size = rr(0.03, 0.04), turn = rnd() * Math.PI * 2, phase = rnd(), sway = 0.012;
    b.ribbon([[px, 0, pz], [px, y, pz]], [0.003, 0], [tones.dark, tones.dark], [0, sway], [0, 0], phase);
    const centre = b.vert([px, y, pz], UP, tones.dark, sway, phase, 0.2);
    for (let k = 0; k < 3; k++) {
      const t = turn + k * Math.PI * 2 / 3, dx = Math.cos(t), dz = Math.sin(t);
      const point = (along, side) => b.vert([px + (dx * along - dz * side) * size, y + along * size * 0.18, pz + (dz * along + dx * side) * size], UP, tones.light, sway, phase, 0.3);
      b.fan([centre, point(0.55, -0.5), point(0.95, -0.28), point(0.95, 0.28), point(0.55, 0.5)]);
    }
  }
}

// Arching fronds: a row of leaflets on both sides of a curved stalk. `reach`: length of a frond; `top`: the highest it may arch.
function addFern(b, { rnd, rr }, x, z, reach, top, tones) {
  const fronds = 7 + Math.floor(rnd() * 2), SEGS = 9, phase = rnd();
  for (let f = 0; f < fronds; f++) {
    const turn = (f + rr(-0.3, 0.3)) / fronds * Math.PI * 2, dx = Math.cos(turn), dz = Math.sin(turn), young = f % 4 === 3;
    const len = reach * (young ? rr(0.55, 0.7) : rr(0.8, 1.05));
    const pitch0 = young ? rr(1.15, 1.35) : rr(0.75, 1.05), pitch1 = young ? rr(0.1, 0.4) : rr(-0.7, -0.3);      // angle above the horizon at root and tip
    const stalk = [[x, 0, z]];
    for (let i = 0; i < SEGS; i++) {
      const pitch = mix(pitch0, pitch1, Math.pow((i + 0.5) / SEGS, 1.2)), p = stalk[i], run = Math.cos(pitch) * len / SEGS;
      stalk.push([p[0] + dx * run, p[1] + Math.sin(pitch) * len / SEGS, p[2] + dz * run]);
    }
    const squash = Math.min(1, top / Math.max(...stalk.map((p) => p[1])));
    for (const p of stalk) p[1] *= squash;
    const tone = (rgb, s) => rgb.map((v) => v * (young ? 1.2 : 1) * (0.85 + 0.35 * s));
    // stalk vertices sit between the leaflets, so neighbouring leaflets share them
    const joints = [];
    for (let i = 0; i < SEGS; i++) {
      const s = i / SEGS, p = i === 0 ? stalk[0] : stalk[i].map((v, k) => (v + stalk[i + 1][k]) / 2), from = stalk[Math.max(0, i - 1)], to = stalk[i + 1];
      const along = unit(to[0] - from[0], to[1] - from[1], to[2] - from[2]), n = unit(-dx * along[1], Math.hypot(along[0], along[2]), -dz * along[1]);
      joints.push({ p, along, n, i: b.vert(p, n, tone(tones.dark, s), 0.04 * s * s, phase, 0.3) });
    }
    for (let i = 1; i < SEGS; i++) {
      const s = i / SEGS, at = stalk[i], j = joints[i], wide = len * 0.21 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.6)), 0.6);
      for (const side of [-1, 1]) {
        const tip = [at[0] - dz * side * wide + j.along[0] * wide * 0.6, at[1] - wide * 0.3 + j.along[1] * wide * 0.6, at[2] + dx * side * wide + j.along[2] * wide * 0.6];
        b.tri(joints[i - 1].i, j.i, b.vert(tip, unit(j.n[0] - dz * side * 0.4, j.n[1], j.n[2] + dx * side * 0.4), tone(tones.light, s), 0.04 * s * s, phase, 0.5));
      }
    }
    const end = joints[SEGS - 1], beside = end.p.map((v, k) => v + [-dz, 0, dx][k] * len * 0.03);
    b.tri(end.i, b.vert(stalk[SEGS], end.n, tone(tones.light, 1), 0.04, phase, 0.5), b.vert(beside, end.n, tone(tones.dark, 1), 0.04, phase, 0.3));
  }
}

// a fallen leaf lying on the ground, slightly curled
function addLeaf(b, { rnd, rr }, x, z, rgb) {
  const a = rnd() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), len = rr(0.05, 0.085), wide = len * rr(0.3, 0.42), curl = rr(0.06, 0.2);
  const n = unit(rr(-0.2, 0.2), 1, rr(-0.2, 0.2)), vein = rgb.map((v) => v * 0.7);
  const point = (along, side, lift, tone) => b.vert([x + dx * along * len - dz * side * wide, 0.006 + lift * len, z + dz * along * len + dx * side * wide], n, tone);
  b.fan([point(-0.5, 0, 0.02, vein), point(-0.12, -1, curl, rgb), point(0.25, -0.8, curl, rgb), point(0.5, 0, curl * 0.6, vein), point(0.25, 0.8, curl, rgb), point(-0.12, 1, curl, rgb)]);
}

// a rounded stone, its lower part sunk in the ground
function addPebble(b, { rnd, rr }, x, z, radius, rgb) {
  const sx = radius * rr(0.8, 1.25), sy = radius * rr(0.5, 0.75), sz = radius * rr(0.8, 1.25), turn = rnd() * Math.PI * 2, ct = Math.cos(turn), st = Math.sin(turn);
  const big = radius > 0.048, around = big ? 10 : 7;
  const vert = (sinUp, a) => {
    const cosUp = Math.sqrt(1 - sinUp * sinUp), lx = cosUp * Math.cos(a), lz = cosUp * Math.sin(a), shade = sinUp < 0 ? 0.5 : 0.78 + 0.34 * sinUp;
    const turned = (px, pz) => [px * ct - pz * st, px * st + pz * ct];
    const [px, pz] = turned(lx * sx, lz * sz), [nx, nz] = turned(lx / sx, lz / sz);
    return b.vert([x + px, sinUp * sy, z + pz], unit(nx, sinUp / sy, nz), rgb.map((v) => v * shade));
  };
  let below = null;
  for (const sinUp of big ? [-0.3, 0.25, 0.62, 0.9] : [-0.3, 0.55]) {          // rings from just under the ground upwards
    const ring = []; for (let k = 0; k <= around; k++) ring.push(vert(sinUp, k / around * Math.PI * 2));
    if (below) b.band(below, ring);
    below = ring;
  }
  b.fan([vert(1, 0), ...below]);
}

// ---------- the material shared by the grass and the rest of the ground cover ----------

// How far grass is drawn. In the North Forest a long view down a trail held 480,000 triangles of grass, most of it
// smaller than a pixel: clumps shrink into the turf over the last 10 m, and chunks beyond are skipped.
const GRASS_FAR = 42;

const COVER_PARS = /* glsl */ `
attribute vec3 aSpine;      // ribbons: direction of the centre line at this vertex
attribute vec4 aBlade;      // x: signed half width of a ribbon (0 = ordinary vertex)  y: sway  z: phase  w: glow against the sun
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uFeet;
uniform vec2 uPress;
uniform float uFar;
varying float vAcross;`;

const COVER_PROJECT = /* glsl */ `
#ifdef USE_INSTANCING
	mat4 coverMatrix = modelMatrix * instanceMatrix;
#else
	mat4 coverMatrix = modelMatrix;
#endif
vec3 coverWorld = ( coverMatrix * vec4( transformed, 1.0 ) ).xyz;
// wind: slow gusts roll across the clearing, every plant adds its own small flutter
float gust = 0.6 + 0.4 * sin( dot( coverWorld.xz, vec2( 0.19, 0.11 ) ) - uTime * 0.6 );
float wave = sin( dot( coverWorld.xz, vec2( 1.1, 0.7 ) ) - uTime * 1.7 + aBlade.z * 6.2832 );
float flutter = sin( dot( coverWorld.xz, vec2( -2.3, 3.1 ) ) - uTime * 3.3 + aBlade.z * 17.0 );
coverWorld.xz += ( vec2( 0.82, 0.57 ) * ( 0.35 + 0.65 * wave ) * gust + vec2( -0.57, 0.82 ) * flutter * 0.18 ) * aBlade.y * length( coverMatrix[ 1 ].xyz );
// whatever bends in the wind also leans away from Anne's feet and is pressed down where she stands
vec2 fromFeet = coverWorld.xz - uFeet.xz;
float pressed = ( 1.0 - smoothstep( max( 0.1, uPress.x - 0.5 ), uPress.x, length( fromFeet ) ) ) * ( uPress.y > 0.9 ? 1.0 : min( aBlade.y * 8.0, 1.0 ) );     // a flattened patch takes the stiff plants down too
coverWorld.xz += normalize( fromFeet + 1e-4 ) * 0.1 * pressed;
coverWorld.y -= max( coverWorld.y - uFeet.y, 0.0 ) * uPress.y * pressed;
// ribbons turn their face to the camera, and widen a little with distance so far grass stays full
vec3 toEye = cameraPosition - coverWorld;
float eyeDistance = length( toEye );
vec3 across = cross( mat3( coverMatrix ) * aSpine, toEye );
across *= inversesqrt( max( dot( across, across ), 1e-12 ) );
coverWorld += across * aBlade.x * length( coverMatrix[ 0 ].xyz ) * ( 1.0 + 0.06 * eyeDistance );
#ifdef USE_INSTANCING
	// far clumps sink into the turf, whose colour they share; past uFar a whole chunk of them is not drawn (see GRASS_FAR)
	coverWorld = mix( coverWorld, coverMatrix[ 3 ].xyz, smoothstep( uFar - 10.0, uFar, eyeDistance ) );
#endif
// tips light up when seen against the sun
float against = max( dot( - toEye / eyeDistance, uSunDir ), 0.0 );
vColor *= 1.0 + vec3( 0.6, 0.5, 0.15 ) * ( aBlade.w * against * against );
vAcross = sign( aBlade.x );
vec4 mvPosition = viewMatrix * vec4( coverWorld, 1.0 );
gl_Position = projectionMatrix * mvPosition;`;

function coverMaterial(c, time, feet, press) {
  const { THREE } = c;
  // towards the sun: read from the light world/sky.js put in the scene
  const toSun = new THREE.Vector3(14, 26, -18);
  c.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) toSun.copy(o.position).sub(o.target.position); });
  toSun.normalize();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uFeet = feet; shader.uniforms.uPress = press;
    shader.uniforms.uSunDir = { value: toSun }; shader.uniforms.uFar = { value: GRASS_FAR };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + COVER_PARS)
      .replace('#include <project_vertex>', COVER_PROJECT)
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4( coverWorld, 1.0 );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAcross;')
      // a blade is folded along its middle: paler towards both edges
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + 0.22 * smoothstep( 0.25, 1.0, abs( vAcross ) );')
      // both faces are lit alike, as thin leaves are
      .replace('#include <normal_fragment_begin>', 'vec3 normal = normalize( vNormal );');
  };
  return material;
}

// ---------- planting ----------

function plantGrass(c, map, ground, material, limit) {
  const { THREE, S, W, H, level } = c, rng = c.rng(2024), { rnd, rr } = rng;
  const short = clumpGeometry(THREE, rng, SHORT_CLUMP), tall = clumpGeometry(THREE, rng, TALL_CLUMP);
  const beds = level.objects.flowers.map(([x, y]) => c.tc(x, y));
  const GRID = 0.218, VERGE = 3 * S;                   // one candidate clump per GRID x GRID cell, as far as VERGE beyond the map
  for (let gz = -VERGE; gz < H * S + VERGE; gz += GRID) for (let gx = -VERGE; gx < W * S + VERGE; gx += GRID) {
    const wx = gx + rnd() * GRID, wz = gz + rnd() * GRID;
    const meadow = ground.meadowAt(wx, wz);
    if (meadow < 0.2 || c.inCliff(Math.floor(wx / S), Math.floor(wz / S)) || map.onLogTile(wx, wz, 0.12)) continue;
    const edge = ground.earthEdge(wx, wz), turf = clamp01((0.47 - edge) / 0.2);      // 0 at the rim of bare earth, 1 well inside the meadow
    const tallness = map.tall(wx, wz);
    // a little shorter where flowers grow, so they show
    const cap = beds.reduce((lowest, bed) => Math.min(lowest, 0.115 + 0.1 * Math.hypot(wx - bed.x, wz - bed.z)), limit(wx, wz));
    const isTall = edge < 0.4 && tallness > 0.5 && cap > 0.22;
    let chance, height;
    if (edge > 0.5) { chance = edge < 0.62 ? 0.3 : 0; height = rr(0.04, 0.075); }      // a few stray tufts on the earth beside the turf
    else if (isTall) { chance = 0.6; height = mix(0.22, 0.34, smooth(0.5, 0.8, tallness)) * rr(0.88, 1); }
    else {
      chance = smooth(0.2, 0.75, meadow) * (0.5 + 0.5 * turf) * mix(0.45, 1, smooth(0.15, 0.5, map.walk(wx, wz)));      // thinner off the walkable ground, where bushes hide it
      height = (0.1 + 0.07 * c.fbm2(wx * 0.4 + 17, wz * 0.4 + 29, 2)) * (rnd() < 0.12 ? rr(1.2, 1.45) : rr(0.8, 1.15))
        * (0.55 + 0.45 * turf) * (0.7 + 0.3 * meadow) * (1 + 0.6 * smooth(0.25, 0.5, tallness));
    }
    if (rnd() > chance) continue;
    height = Math.min(height, cap);
    const girth = isTall ? rr(0.17, 0.22) : 0.07 + height * 0.35;
    const dry = rnd() < 0.07 ? [1.24, 1.1, 0.78] : [1, 1, 1];                         // now and then a clump the sun has yellowed
    const tint = ground.turfColour(wx, wz).map((v, k) => v * dry[k] * rr(0.9, 1.1));
    c.addInst(isTall ? 'grassTall' : 'grass', isTall ? tall : short, material,
      c.mtx(wx, 0, wz, girth * rr(0.8, 1.25), height, girth * rr(0.8, 1.25), rnd() * Math.PI * 2), new THREE.Color(tint[0], tint[1], tint[2]), { shadow: false });
  }
}

// Where the ferns stand: on the map's 'fern' tiles, and tucked under the forest's edge where the bushes are.
function fernSpots(c, map, limit) {
  const { S, W, H, walkAt, inCliff } = c, { rnd, rr } = c.rng(5150), log = c.tc(...c.LOG_TILE), spots = [];
  for (const [x, y] of c.level.objects.fern) {
    const p = c.tc(x, y);
    for (let i = 0; i < 3; i++) {
      const a = (i + rnd()) * 2.1;
      spots.push({ x: p.x + Math.cos(a) * 0.42, z: p.z + Math.sin(a) * 0.42, reach: rr(0.42, 0.52), top: Math.min(0.32, limit(p.x, p.z)) });
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (walkAt(x, y) || inCliff(x, y) || map.isPond(x, y)) continue;
    for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!walkAt(x + nx, y + ny) || rnd() > 0.25) continue;
      // rooted inside the forest tile; rule 4 lets it reach at most 0.4 m over the walkable one
      const p = c.tc(x, y), back = S / 2 - rr(0.25, 0.45), along = rr(-0.6, 0.6);
      const spot = { x: p.x + nx * back - ny * along, z: p.z + ny * back + nx * along, reach: rr(0.45, 0.55), top: 0.34 };
      if (map.pathDistance(spot.x, spot.z) > spot.reach + 0.05 && Math.hypot(spot.x - log.x, spot.z - log.z) > 2.6 + spot.reach) spots.push(spot);
    }
  }
  return spots;
}

// Where the pebbles lie: nearly all on the paths and the pond shore.
function stoneSpots(c, map) {
  const { S, W, H, walkAt } = c, { rnd, rr } = c.rng(8086), fire = c.tc(...(c.level.campfire || [-60, -60])), spots = [];
  for (let tries = 0; spots.length < 80 && tries < 8000; tries++) {
    const x = rnd() * W * S, z = rnd() * H * S, pond = map.pond(x, z), onEarth = map.dirtAt(x, z) > 0.62 || (pond > 0.15 && pond < 0.45);
    if (!walkAt(Math.floor(x / S), Math.floor(z / S)) || map.onLogTile(x, z, 0.1) || Math.hypot(x - fire.x, z - fire.z) < 1.1 || (!onEarth && rnd() < 0.93)) continue;
    spots.push({ x, z, radius: rnd() < 0.25 ? rr(0.05, 0.085) : rr(0.022, 0.045) });
  }
  return spots;
}

function coverMesh(c, map, ground, material, limit, ferns, stones) {
  const { THREE, S, W, H, level, walkAt } = c, rng = c.rng(7031), { rnd, rr } = rng;
  const b = meshBuilder(), pick = (list) => list[Math.floor(rnd() * list.length)];
  const fire = c.tc(...(level.campfire || [-60, -60])), scarecrow = c.tc(...(level.scarecrow || [-60, -60]));
  // may something this tall stand here? (walkable ground, clear of the log's tile, the fire and the scarecrow)
  const fits = (wx, wz, height) => walkAt(Math.floor(wx / S), Math.floor(wz / S)) && !c.inCliff(Math.floor(wx / S), Math.floor(wz / S)) && !map.onLogTile(wx, wz, 0.15)
    && height <= limit(wx, wz) && Math.hypot(wx - fire.x, wz - fire.z) > 1.1 && Math.hypot(wx - scarecrow.x, wz - scarecrow.z) > 0.4;
  // try random places on the map until `count` of them were used (place returns true when it used the spot)
  const scatter = (count, place) => { for (let made = 0, tries = 0; made < count && tries < count * 80; tries++) if (place(rnd() * W * S, rnd() * H * S)) made++; };

  const stem = { stem: lit('#6ca44f'), stemLow: lit('#538f3d') };
  const KINDS = {
    daisy: { ...stem, petals: 8, size: [0.04, 0.05], petal: lit('#fffff5'), throat: lit('#dedecb'), heart: lit('#e4be47'), heartRim: lit('#ca8c2e') },
    buttercup: { ...stem, petals: 5, size: [0.03, 0.037], petal: lit('#e5c94a'), throat: lit('#dca836'), heart: lit('#dca836'), heartRim: lit('#ca8c2e') },
    bellflower: { ...stem, petals: 5, size: [0.032, 0.04], petal: lit('#9f8ef4'), throat: lit('#7c68db'), heart: lit('#eadf96'), heartRim: lit('#ccb25a') },
    cosmos: { ...stem, petals: 6, size: [0.044, 0.054], petal: lit('#df9bcd'), throat: lit('#cf6aa8'), heart: lit('#e4be47'), heartRim: lit('#ca8c2e') },
  };
  const flower = (kind, wx, wz, heights) => {
    const height = Math.min(rr(...heights), limit(wx, wz) - 0.06);          // the head stands a few cm above the stem's top
    if (height < 0.1 || !fits(wx, wz, height) || ground.earthEdge(wx, wz) > 0.4) return false;
    addFlower(b, rng, wx, wz, height, KINDS[kind]);
    return true;
  };
  // a bed of flowers on each of the map's 'flowers' tiles
  level.objects.flowers.forEach(([x, y], n) => {
    const p = c.tc(x, y), kinds = [['daisy', 'daisy', 'buttercup'], ['daisy', 'bellflower', 'daisy'], ['cosmos', 'cosmos', 'daisy']][n % 3];
    for (let i = 0; i < 36; i++) { const a = rnd() * Math.PI * 2, r = 0.7 * Math.pow(rnd(), 0.8); flower(kinds[i % 3], p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, [0.16, 0.25]); }
  });
  // small groups of wildflowers in the open meadow
  scatter(30, (wx, wz) => {
    if (map.tall(wx, wz) > 0.3 || ground.meadowAt(wx, wz) < 0.9) return false;
    const kind = pick(['daisy', 'buttercup', 'bellflower', 'daisy', 'cosmos']);
    let made = 0;
    for (let i = 0, n = 3 + Math.floor(rnd() * 4); i < n; i++) if (flower(kind, wx + rr(-0.35, 0.35), wz + rr(-0.35, 0.35), [0.14, 0.21])) made++;
    return made > 0;
  });

  // broad-leaved plants in the turf, many of them along the edges of the paths
  const BROADLEAF = { dark: lit('#468546'), mid: lit('#62a150'), light: lit('#80b862') };
  scatter(46, (wx, wz) => {
    const edge = ground.earthEdge(wx, wz);
    if (!fits(wx, wz, 0.09) || edge > 0.46 || map.tall(wx, wz) > 0.5 || (edge < 0.25 && rnd() < 0.6)) return false;
    addBroadleaf(b, rng, wx, wz, rr(0.09, 0.14), BROADLEAF);
    return true;
  });
  const CLOVER = { dark: lit('#448a45'), light: lit('#7ec567') };
  scatter(36, (wx, wz) => {
    if (!fits(wx, wz, 0.08) || ground.earthEdge(wx, wz) > 0.35 || map.tall(wx, wz) > 0.4) return false;
    addClover(b, rng, wx, wz, CLOVER);
    return true;
  });

  for (const f of ferns) addFern(b, rng, f.x, f.z, f.reach, f.top, { dark: lit('#458b49'), light: lit('#8dc665') });

  const AUTUMN = ['#caa454', '#bd7b3f', '#a05a39', '#d1bd6c', '#8a6e48'].map(lit);
  // fallen leaves, mostly near the trees
  scatter(90, (wx, wz) => {
    if (!fits(wx, wz, 0.03) || (map.open(wx, wz) > 0.9 && rnd() < 0.8)) return false;
    addLeaf(b, rng, wx, wz, pick(AUTUMN));
    return true;
  });
  const STONE = ['#a89e8e', '#b3a891', '#9e978c', '#bcb09a'].map(lit);
  for (const s of stones) addPebble(b, rng, s.x, s.z, s.radius, pick(STONE));

  const mesh = new THREE.Mesh(b.geometry(THREE), material);
  mesh.receiveShadow = true; mesh.name = 'groundCover';
  return mesh;
}
