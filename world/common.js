// world/common.js: what the world modules (terrain.js, foliage.js, props.js) share.
// One instance is created by index.html and passed to each module's build function.

export function createCommon({ THREE, scene, renderer, level, qp, camera = null, ultra = false }) {
  const S = level.tile || 1.6;     // metres per map tile (10-02: an area may be built bigger: the Ivy Maidens' nest)
  const M = level.margin || 9;                // forest margin (tiles) built around the map
  const CLIFF_H = 4.0;        // height of the waterfall plateau
  const W = level.width, H = level.height;

  // ---------- the map ----------
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const tileAt = (x, y) => (inMap(x, y) ? level.terrain[y][x] : '#');     // g grass, d dirt, # forest, | big trunk, ~ water, W waterfall, r rock
  const walkAt = (x, y) => inMap(x, y) && level.walkable[y][x] === '1';
  const tallAt = (x, y) => inMap(x, y) && level.tallgrass[y][x] === 't';
  const tc = (x, y) => new THREE.Vector3((x + 0.5) * S, 0, (y + 0.5) * S);   // world centre of tile (x, y), on the ground
  const inCliff = level.plateau === false ? () => false : (tx, ty) => tx < 4 && ty < 5;                               // the plateau: tiles with x < 4 and y < 5 (and beyond the map edge)
  // ---------- (10-12) raised ground: the ledges that are climbed to by a vine (tools/ledges.py; world/ledges.js builds them) ----------
  // level.levels: rows of '0' / '1', the tiles that stand on the raised ground; level.ledgeH: how high (m).
  // "Level frames" (world/frames.js): the scripted layer writes ground = 0 everywhere, so while Anne stands on a ledge
  // the WORLD is drawn LEDGE_H lower instead, and every height is told relative to the ground she stands on: heightAt()
  // is 0 under her feet on either level. buildHeightAt() is the height as built (the world modules stand things with it).
  const LEDGE_H = level.levels ? (level.ledgeH || 3) : 0;
  const levelAt = LEDGE_H ? (tx, ty) => (inMap(tx, ty) && level.levels[ty][tx] === '1' ? 1 : 0) : () => 0;
  let frameLv = 0;
  const frame = () => frameLv, setFrame = (lv) => { frameLv = lv ? 1 : 0; }, frameH = () => frameLv * LEDGE_H;
  const buildHeightAt = (wx, wz) => { const tx = Math.floor(wx / S), ty = Math.floor(wz / S); return inCliff(tx, ty) ? CLIFF_H : levelAt(tx, ty) * LEDGE_H; };
  const heightAt = (wx, wz) => buildHeightAt(wx, wz) - frameLv * LEDGE_H;
  const objAt = {};                                                           // "x,y" -> 'conifer' | 'pumpkin' | 'flowers' | 'fern' | 'vine' | 'hedge'
  for (const [k, list] of Object.entries(level.objects)) for (const [x, y] of list) objAt[`${x},${y}`] = k;
  const LOG_TILE = level.log || [-60, -60];                                                   // the hollow log of the log scene stands here (built by logscene.js)

  // ---------- seeded randomness: one independent stream per module, so modules do not disturb each other ----------
  function rng(seed) {
    let s = seed | 0;
    const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const tint = (base, v) => new THREE.Color(base).offsetHSL(rr(-v, v) * 0.3, rr(-v, v), rr(-v, v));
    return { rnd, rr, tint };
  }

  // ---------- small helpers ----------
  const ANISO = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 8;
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
  const mtx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
    new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  function canvasTex(w, h, draw, { repeat = false, srgb = true, anisotropy = 4 } = {}) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = ultra ? ANISO : anisotropy;      // (Ultra: the sharpest filtering the GPU has, for ground seen at a slant)
    return t;
  }
  // smooth, tileable-enough value noise in [0, 1] (deterministic)
  const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c2 = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  }
  const fbm2 = (x, y, oct = 4) => { let a = 0, f = 1, w = 0.5, n = 0; for (let i = 0; i < oct; i++) { a += noise2(x * f, y * f) * w; n += w; f *= 2.03; w *= 0.5; } return a / n; };

  // ---------- instancing ----------
  // addInst() collects instances; flushInst() (called once by index.html after every module has built) turns each
  // batch into InstancedMeshes, one per CHUNK-sized cell of the world, so whole cells behind the camera are culled.
  //   key    : batch name. Instances with the same key must share geo and mat.
  //   opts   : { shadow: true (cast shadows), receive: true, chunk: true (false = one mesh, never culled) }
  const CHUNK = 12;           // metres
  const batches = new Map();
  function addInst(key, geo, mat, matrix, color = null, opts = null) {
    const chunk = !opts || opts.chunk !== false;
    const e = matrix.elements;
    const k = chunk ? `${key}|${Math.floor(e[12] / CHUNK)},${Math.floor(e[14] / CHUNK)}` : key;
    let b = batches.get(k);
    if (!b) { b = { geo, mat, list: [], shadow: !opts || opts.shadow !== false, receive: !opts || opts.receive !== false }; batches.set(k, b); }
    b.list.push({ matrix, color });
  }
  function flushInst() {
    const made = [];
    for (const [key, b] of batches) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length);
      b.list.forEach((it, i) => { im.setMatrixAt(i, it.matrix); if (it.color) im.setColorAt(i, it.color); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = b.shadow; im.receiveShadow = b.receive; im.name = 'inst:' + key;
      im.computeBoundingSphere();
      scene.add(im); made.push(im);
    }
    batches.clear();
    return made;
  }

  const night = { value: 0 };                  // 0 day .. 1 night (the story sets it; world/sky.js and the campfire follow)
  const camBlockers = [];     // what the follow camera must stay out of besides solid tiles (camera.js): tree crowns, conifers
  const bushes = [];          // (10-05) every bush foliage.js plants: { x, y, z, r, h } (its dome's middle and radii): a story shot is not taken from inside one (story.js)
  return { ultra, ANISO, THREE, scene, renderer, camera, level, qp, S, M, CLIFF_H, W, H, inMap, tileAt, walkAt, tallAt, tc, inCliff, heightAt, objAt, LOG_TILE, camBlockers, bushes, night,
    LEDGE_H, levelAt, frame, setFrame, frameH, buildHeightAt,
    rng, mtx, canvasTex, noise2, fbm2, addInst, flushInst, CHUNK };
}
