// world/foliage.js: the forest around the clearing: the wall of giant trees along the north side, the ring of
// broadleaf trees and conifers, the bushes on the clearing's edge, the vines, and the far canopy that closes the horizon.
// Contract: export function buildFoliage(c) -> { update(dt, t) }   (c = world/common.js instance)
//
// Everything is generated once and merged into a few static meshes (one per material and 16 m region, plus one per
// material for the shadow casters), drawn with three cheap Lambert-based materials: bark, leaf masses and cut-out
// leaf sprigs. Plants do not read the shadow map: their shade is baked into vertex colours, which costs nothing per
// pixel and cannot pop when the shadow box moves.

export function buildFoliage(c) {
  const { THREE, scene, level, S, M, W, H, tileAt, walkAt, inCliff, heightAt } = c;
  const { rnd, rr } = c.rng(4242);
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lin = (hex) => new THREE.Color(hex).toArray();                 // sRGB hex -> linear [r, g, b], the space vertex colours are in

  // direction towards the sun (world/sky.js owns the light; the art direction puts it in the north-east)
  const sunDir = new THREE.Vector3(14, 26, -18).normalize();
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && o.position.y > o.target.position.y) sunDir.subVectors(o.position, o.target.position).normalize(); });
  const sunny = (nx, ny, nz) => clamp01(0.5 + 0.5 * (nx * sunDir.x + ny * sunDir.y + nz * sunDir.z));   // 1 = faces the sun

  // ---------- reading the map ----------
  const POND = !!level.glade;                                                                   // glade levels (the pond, the North Forest): everything that is not forest stays clear
  const isOpen = POND ? (x, y) => c.inMap(x, y) && !'#|'.includes(tileAt(x, y)) : (x, y) => walkAt(x, y) && !inCliff(x, y);                                     // ground the player can reach
  const outs = level.pathsOut || [[6, 'north'], [8, 'south']];
  const isPathOut = (x, y) => outs.some(([n, side]) => (side === 'north' ? x === n && y < 0 && y >= -M + 2 : side === 'south' ? x === n && y >= H && y < H + M - 2
    : side === 'west' ? y === n && x < 0 && x >= -M + 2 : y === n && x >= W && x < W + M - 2));      // the paths leaving the map: [column, 'north' | 'south'] or [row, 'west' | 'east']
  const keepClear = (x, y) => isOpen(x, y) || isPathOut(x, y);
  const barren = (x, y) => '~Wr'.includes(tileAt(x, y)) || (!POND && x === 2 && y < 0);                  // water, rock, and the stream beyond the map edge
  const reserved = level.pumpkins_event.map(([x, y]) => [(x + 0.5) * S, (y + 0.5) * S]);        // props.js puts its pumpkins on these tiles
  const onReserved = (wx, wz, gap) => reserved.some((p) => Math.hypot(p[0] - wx, p[1] - wz) < gap);

  // row: how many tiles a tile is away from the kept-clear ground (1 = touches it, corners included)
  const GX = W + 2 * M, GY = H + 2 * M, cell = (x, y) => (y + M) * GX + (x + M);
  const inBuilt = (x, y) => x >= -M && y >= -M && x < W + M && y < H + M;
  const rows = new Uint8Array(GX * GY).fill(255);
  {
    let edge = [];
    for (let y = -M; y < H + M; y++) for (let x = -M; x < W + M; x++) if (keepClear(x, y)) { rows[cell(x, y)] = 0; edge.push([x, y]); }
    for (let row = 1; edge.length; row++) {
      const next = [];
      for (const [x, y] of edge) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (inBuilt(nx, ny) && rows[cell(nx, ny)] === 255) { rows[cell(nx, ny)] = row; next.push([nx, ny]); }
      }
      edge = next;
    }
  }
  const rowOf = (x, y) => (inCliff(x, y) ? Math.max(3, rows[cell(x, y)]) : rows[cell(x, y)]);   // the plateau is 4 m up: never the front row

  // distance in metres from a world point to the nearest kept-clear tile (0 on one); looks 4 tiles around
  function clearance(wx, wz) {
    const tx = Math.floor(wx / S), ty = Math.floor(wz / S);
    let best = 4 * S;
    for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) {
      if (!keepClear(x, y)) continue;
      const dx = Math.max(x * S - wx, 0, wx - (x + 1) * S), dz = Math.max(y * S - wz, 0, wz - (y + 1) * S);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }
  // how far a world point over kept-clear ground is from the nearest tile where plants may root (0 when not over clear ground)
  function overhang(wx, wz) {
    const tx = Math.floor(wx / S), ty = Math.floor(wz / S);
    if (!keepClear(tx, ty)) return 0;
    let best = S;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (keepClear(x, y)) continue;
      const dx = Math.max(x * S - wx, 0, wx - (x + 1) * S), dz = Math.max(y * S - wz, 0, wz - (y + 1) * S);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }
  const LOW = 2.6, LOW_REACH = 0.38;                                                             // below LOW metres plants may reach this far over open ground (the rule allows 0.4)
  // metres from a world point to the circle around the hollow log that must stay empty (the cut-scene's low camera)
  const logX = (c.LOG_TILE[0] + 0.5) * S, logZ = (c.LOG_TILE[1] + 0.5) * S;
  const logGap = (wx, wz) => Math.hypot(wx - logX, wz - logZ) - 2.7;
  // unit vector pointing away from the open ground at a world point
  function intoForest(wx, wz) {
    const gx = clearance(wx + 0.8, wz) - clearance(wx - 0.8, wz), gz = clearance(wx, wz + 0.8) - clearance(wx, wz - 0.8), l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];
  }
  // Only plants whose shadow reaches the playable ground cast one: shadows that fall into the forest are never seen.
  const shadowStep = [-sunDir.x / sunDir.y, -sunDir.z / sunDir.y];                               // where a point's shadow lands, per metre of its height
  const shadowShows = (x, z, height) => [0.3, 0.65, 1].some((k) => clearance(x + shadowStep[0] * height * k, z + shadowStep[1] * height * k) < 0.8);

  // ---------- textures ----------
  // bark: smooth, with soft grooves running up the trunk; nearly white so the vertex colours give the hue
  const barkTex = c.canvasTex(512, 1024, (g, w, h) => {
    const r = c.rng(907);
    g.fillStyle = '#f1e9dc'; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    // A line running the whole height, wandering a little. It closes on itself top to bottom and is repeated left and
    // right, so the texture tiles. `path` = [sway in pixels, whole turns, phase].
    const strand = (x0, path, width, style) => {
      g.lineWidth = width; g.strokeStyle = style;
      for (const shift of [-w, 0, w]) {
        g.beginPath();
        for (let y = -32; y <= h + 32; y += 16) g.lineTo(x0 + shift + Math.sin(y / h * TAU * path[1] + path[2]) * path[0], y);
        g.stroke();
      }
    };
    for (let i = 0; i < 15; i++) {
      const x0 = (i + r.rr(0.2, 0.8)) * w / 15, width = r.rr(10, 24), path = [r.rr(3, 13), 1 + Math.floor(r.rnd() * 3), r.rnd() * TAU];
      strand(x0, path, width, 'rgba(92,62,40,0.13)');                           // a groove: wide and faint, then narrower and darker
      strand(x0, path, width * 0.55, 'rgba(78,50,32,0.16)');
      strand(x0, path, width * 0.2, 'rgba(52,32,20,0.22)');
      strand(x0 + width * 0.9, path, r.rr(8, 14), 'rgba(255,251,240,0.4)');     // the ridge beside it catches the light
    }
  }, { repeat: true, anisotropy: 8 });

  // One pointed leaf with its stalk end at (x, y), growing along `angle` (0 = right, -90 deg = up). `lum` = how light it
  // is. Painted near-white so that vertex colours give the green, or in its own green where `green` is set. With
  // `cutout` only the leaf's shape is filled, in white.
  const leafCss = (lum, green) => (green ? `rgb(${Math.round(120 * lum)},${Math.round(190 * lum)},${Math.round(70 * lum)})` : `rgb(${Math.round(245 * lum)},${Math.round(255 * lum)},${Math.round(214 * lum)})`);
  function paintLeaf(g, cutout, x, y, angle, length, fat, lum, green = false) {
    const wide = length * fat;
    g.save(); g.translate(x, y); g.rotate(angle);
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(length * 0.2, -wide, length * 0.7, -wide * 0.85, length, 0);
    g.bezierCurveTo(length * 0.7, wide * 0.85, length * 0.2, wide, 0, 0);
    if (cutout) { g.fillStyle = '#fff'; g.fill(); g.restore(); return; }
    g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = leafCss(lum * 0.84, green); g.stroke();      // the colour spills past the cut-out, so no fringe shows when the texture is filtered
    const shade = g.createLinearGradient(0, 0, length, 0);
    shade.addColorStop(0, leafCss(lum * 0.68, green)); shade.addColorStop(0.75, leafCss(lum, green));
    g.shadowColor = 'rgba(20,44,8,0.5)'; g.shadowBlur = 20; g.fillStyle = shade; g.fill(); g.shadowColor = 'transparent';      // a soft shadow on the leaves underneath
    g.save(); g.clip(); g.fillStyle = 'rgba(30,60,10,0.1)'; g.fillRect(0, 0, length, wide * 1.2); g.restore();              // one half a little darker: a fold along the midrib
    g.lineCap = 'round'; g.lineWidth = Math.max(2, length * 0.016); g.strokeStyle = 'rgba(255,255,235,0.3)';
    g.beginPath(); g.moveTo(length * 0.06, 0); g.lineTo(length * 0.88, 0); g.stroke();
    g.restore();
  }

  // leaf pattern: overlapping leaves (green channel) and tufts of needles (red channel), tiling both ways. The leaf
  // masses multiply their colour by it, projected from three sides, so a smooth mass reads as layers of leaves up close
  // and fades to plain colour far away.
  const leafPattern = c.canvasTex(512, 512, (g, w, h) => {
    const r = c.rng(55);
    // draws at (x, y) and again across the edges, so the pattern tiles
    const tiled = (x, y, draw) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) if (x + ox > -130 && x + ox < w + 130 && y + oy > -130 && y + oy < h + 130) draw(x + ox, y + oy); };
    const needles = document.createElement('canvas'); needles.width = w; needles.height = h;
    const n = needles.getContext('2d');
    n.fillStyle = '#3c3c3c'; n.fillRect(0, 0, w, h); n.lineCap = 'round';
    for (let i = 0; i < 520; i++) {                                           // short strokes combed one way, each over a darker underlay
      const a = -Math.PI / 2 + r.rr(-0.45, 0.45), length = r.rr(38, 70), lum = r.rr(0.5, 1);
      tiled(r.rnd() * w, r.rnd() * h, (x, y) => {
        for (const [width, shade] of [[10, 0.45], [5.5, 1]]) {
          n.lineWidth = width; n.strokeStyle = `rgb(${Math.round(255 * lum * shade)},0,0)`;
          n.beginPath(); n.moveTo(x, y); n.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length); n.stroke();
        }
      });
    }
    g.fillStyle = '#4a4f3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) {
      const angle = -Math.PI / 2 + r.rr(-1.1, 1.1), length = r.rr(70, 120), lum = r.rr(0.6, 1);
      tiled(r.rnd() * w, r.rnd() * h, (x, y) => paintLeaf(g, false, x, y, angle, length, 0.34, lum));
    }
    const leaves = g.getImageData(0, 0, w, h), tufts = n.getImageData(0, 0, w, h);
    for (let i = 0; i < leaves.data.length; i += 4) leaves.data[i] = tufts.data[i];
    g.putImageData(leaves, 0, 0);
  }, { repeat: true, srgb: false, anisotropy: 4 });

  // leaf atlas: sprigs of leaves as cut-out cards. Colour and cut-out are painted separately so the colour carries on
  // under the cut-out's edge (no dark fringe when the texture is filtered).
  const ATLAS = 1024;
  const uvRect = (px, py, size) => [px / ATLAS, py / ATLAS, (px + size) / ATLAS, (py + size) / ATLAS];      // [left, top, right, bottom]
  const SPRIG = { broadA: uvRect(0, 0, 512), broadB: uvRect(512, 0, 512), needles: uvRect(0, 512, 512),
    ivy: uvRect(512, 512, 256), blossom: uvRect(768, 512, 256), berries: uvRect(512, 768, 256), frond: uvRect(768, 768, 256) };
  const mirrored = (rect) => [rect[2], rect[1], rect[0], rect[3]];
  const LEAFY = [SPRIG.broadA, SPRIG.broadB, mirrored(SPRIG.broadA), mirrored(SPRIG.broadB)];
  function paintAtlas(g, cutout) {
    const r = c.rng(31);                                                        // the colour pass and the cut-out pass must draw the same shapes
    g.fillStyle = cutout ? '#000' : leafCss(0.8, false); g.fillRect(0, 0, ATLAS, ATLAS);
    const leaf = (x, y, angle, length, fat, lum, green) => paintLeaf(g, cutout, x, y, angle, length, fat, lum, green);
    const rad = (deg) => deg * Math.PI / 180, up = -90;
    // a tuft of leaves fanning out from (x, y): [degrees from upright, length, lightness], back to front
    const tuft = (x, y, fat, leaves) => { for (const [lean, length, lum] of leaves) leaf(x + lean * 0.45, y - Math.abs(lean) * 0.5, rad(up + lean + r.rr(-5, 5)), length * r.rr(0.93, 1.05), fat, lum); };
    tuft(256, 482, 0.29, [[-66, 205, 0.7], [64, 200, 0.72], [-45, 285, 0.79], [47, 280, 0.81], [-22, 350, 0.88], [25, 345, 0.92], [2, 395, 1]]);
    // a twig leaning to one side: leaves left and right along it, and one at its tip
    const stem = (u) => [708 + 150 * u + 30 * Math.sin(Math.PI * u), 494 - 400 * u];
    g.lineCap = 'round'; g.lineWidth = 12; g.strokeStyle = cutout ? '#fff' : leafCss(0.6, false);
    g.beginPath(); for (let u = 0; u <= 0.9; u += 0.05) g.lineTo(...stem(u)); g.stroke();
    for (let i = 0; i < 7; i++) {
      const u = 0.06 + i * 0.125, [x, y] = stem(u), [x2, y2] = stem(u + 0.02), along = Math.atan2(y2 - y, x2 - x);
      leaf(x, y, along + (i % 2 ? 1 : -1) * rad(r.rr(48, 62)), 235 - i * 14, 0.33, 0.68 + i * 0.04);
    }
    leaf(...stem(0.88), rad(up + 24), 135, 0.36, 1);
    // conifer bough: paired needle tufts along a twig, shorter towards the tip
    for (let i = 0; i < 8; i++) {
      const y = 1000 - i * 52, length = 215 - i * 21, lum = 0.66 + i * 0.045;
      leaf(256, y, rad(up - 58), length, 0.2, lum); leaf(256, y, rad(up + 58), length, 0.2, lum + 0.03);
    }
    leaf(256, 640, rad(up), 120, 0.24, 1);
    // ivy: a three-pointed leaf and a small one beside it
    const ivy = (x, y, size, lean, lum) => { for (const side of [-24, 24, 0]) leaf(x, y, rad(up + lean + side), size * (side ? 0.86 : 1), side ? 0.36 : 0.34, side ? lum * 0.94 : lum); };
    ivy(650, 756, 215, 6, 0.95); ivy(590, 742, 115, -58, 0.8);
    // blossom: five-petal flowers with a warm centre
    g.lineJoin = 'round';
    for (const [x, y, size] of [[832, 590, 44], [934, 612, 38], [880, 684, 48], [820, 722, 34], [948, 720, 36]]) {
      for (let petal = 0; petal < 5; petal++) {
        const a = petal / 5 * TAU + x;
        g.beginPath(); g.arc(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6, size * 0.44, 0, TAU);
        if (!cutout) { g.lineWidth = 8; g.strokeStyle = '#f1ece6'; g.stroke(); }
        g.fillStyle = '#fff'; g.fill();
      }
      g.beginPath(); g.arc(x, y, size * 0.3, 0, TAU); g.fillStyle = cutout ? '#fff' : '#ffc23a'; g.fill();
    }
    // berries: a bunch of round berries on two leaves (in their own colours: the card is not tinted green)
    leaf(640, 1000, rad(up - 38), 170, 0.36, 0.8, true); leaf(640, 1000, rad(up + 40), 165, 0.36, 0.9, true);
    for (const [x, y, size] of [[610, 872, 30], [668, 880, 32], [640, 826, 30], [596, 928, 26], [686, 934, 28], [641, 934, 30]]) {
      g.beginPath(); g.arc(x, y, size, 0, TAU);
      if (!cutout) { g.lineWidth = 8; g.strokeStyle = '#b3241d'; g.stroke(); }
      g.fillStyle = cutout ? '#fff' : '#e5352b'; g.fill();
      if (!cutout) { g.beginPath(); g.arc(x - size * 0.3, y - size * 0.32, size * 0.28, 0, TAU); g.fillStyle = 'rgba(255,225,215,0.75)'; g.fill(); }
    }
    // frond: a small leaf with leaflets
    for (let i = 0; i < 5; i++) { leaf(896, 1010 - i * 38, rad(up - 62), 105 - i * 12, 0.3, 0.74 + i * 0.05); leaf(896, 1010 - i * 38, rad(up + 62), 105 - i * 12, 0.3, 0.77 + i * 0.05); }
    leaf(896, 850, rad(up), 78, 0.3, 1);
  }
  const leafTex = (() => {
    const paint = (cutout) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = ATLAS;
      const g = canvas.getContext('2d'); paintAtlas(g, cutout);
      return g.getImageData(0, 0, ATLAS, ATLAS).data;
    };
    const rgba = paint(false), mask = paint(true);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = mask[i];
    const tex = new THREE.DataTexture(new Uint8Array(rgba.buffer), ATLAS, ATLAS, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = c.ultra ? c.ANISO : 4;
    tex.needsUpdate = true;
    return tex;
  })();

  // ---------- materials ----------
  const windTime = { value: 0 };
  // aWind: x = how far the vertex may move in the wind (0 = rigid), y = phase, z = scale of the leaf pattern (masses only: 0 = none, negative = needles)
  const SWAY_PARS = 'uniform float uWindTime;\nattribute vec3 aWind;\n';
  const SWAY = /* glsl */`
    float gust = uWindTime * 0.9 + position.x * 0.21 + position.z * 0.17;
    float flutter = uWindTime * 2.3 + aWind.y;
    transformed.x += aWind.x * ( 0.05 * sin( gust ) + 0.014 * sin( flutter ) );
    transformed.z += aWind.x * ( 0.035 * sin( gust * 0.83 + 1.3 ) + 0.014 * cos( flutter * 1.13 ) );`;
  // the leaf pattern, projected along the three axes and blended by which way the surface faces
  const PATTERN_VERTEX = /* glsl */`
    vLeafPos = vec4( position * aWind.z, aWind.z );
    vLeafSide = normal;`;
  const PATTERN_FRAGMENT = /* glsl */`
    vec3 leafSide = vLeafSide * vLeafSide; leafSide *= leafSide; leafSide /= leafSide.x + leafSide.y + leafSide.z;
    vec2 kinds = texture2D( uLeaves, vLeafPos.zy ).rg * leafSide.x + texture2D( uLeaves, vLeafPos.xz ).rg * leafSide.y + texture2D( uLeaves, vLeafPos.xy ).rg * leafSide.z;
    float leaves = vLeafPos.w < 0.0 ? kinds.r : kinds.g;                        // a negative scale picks the needles (and turns them to hang)
    diffuseColor.rgb *= mix( 1.0, 0.42 + 1.2 * leaves, step( 0.0001, abs( vLeafPos.w ) ) );`;
  // Lambert lighting, softened for plants: light wraps round the form, and leaves glow where the sun is behind them.
  const softLight = (wrap, glow) => /* glsl */`
    varying vec3 vViewPosition;
    struct LambertMaterial { vec3 diffuseColor; float specularStrength; };
    void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
      float facing = dot( geometryNormal, directLight.direction );
      float lit = saturate( ( facing + ${wrap} ) / ( 1.0 + ${wrap} ) );
      // light coming through the leaves: seen against the sun, on the plant's rim (deep in its shadow side no sun arrives)
      float behind = saturate( dot( - geometryViewDir, directLight.direction ) );
      vec3 through = ${glow} * ( 0.25 + 0.75 * behind * behind ) * saturate( 1.0 + 1.6 * facing ) * ( 1.0 - lit ) * vec3( 1.0, 0.9, 0.3 );
      reflectedLight.directDiffuse += directLight.color * ( lit + through ) * BRDF_Lambert( material.diffuseColor );
    }
    void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
      reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
    }
    #define RE_Direct RE_Direct_Lambert
    #define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert`;
  function plantMaterial(name, params, { wrap, glow, sways, pattern, cards }) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...params });
    mat.name = name;
    mat.customProgramCacheKey = () => name;
    mat.onBeforeCompile = (sh) => {
      let vertex = sh.vertexShader, fragment = sh.fragmentShader.replace('#include <lights_lambert_pars_fragment>', softLight(wrap, glow));
      if (sways) {
        sh.uniforms.uWindTime = windTime;
        vertex = SWAY_PARS + vertex.replace('#include <begin_vertex>', '#include <begin_vertex>' + SWAY);
      }
      if (pattern) {
        sh.uniforms.uLeaves = { value: leafPattern };
        vertex = 'varying vec4 vLeafPos;\nvarying vec3 vLeafSide;\n' + vertex.replace('#include <begin_vertex>', '#include <begin_vertex>' + PATTERN_VERTEX);
        fragment = 'uniform sampler2D uLeaves;\nvarying vec4 vLeafPos;\nvarying vec3 vLeafSide;\n' + fragment.replace('#include <color_fragment>', '#include <color_fragment>' + PATTERN_FRAGMENT);
      }
      // sprig cards are lit like the mass they sit on, on both faces
      if (cards) fragment = fragment.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
      // "#undef USE_SHADOWMAP": the plants never sample the shadow map (see the note at the top of the file)
      sh.vertexShader = '#undef USE_SHADOWMAP\n' + vertex; sh.fragmentShader = '#undef USE_SHADOWMAP\n' + fragment;
    };
    return mat;
  }
  const MATERIAL = {
    bark: plantMaterial('foliage-bark', { map: barkTex }, { wrap: '0.25', glow: '0.0' }),
    mass: plantMaterial('foliage-mass', {}, { wrap: '0.45', glow: '0.07', sways: true, pattern: true }),
    card: plantMaterial('foliage-card', { map: leafTex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }, { wrap: '0.45', glow: '0.4', sways: true, cards: true }),
    // lumps that are never seen (no colour, no depth written) but cast a shadow: they shape the shade under the giant trees
    shade: new THREE.MeshBasicMaterial({ name: 'foliage-shade', colorWrite: false, depthWrite: false }),
  };
  // the shadow of a swaying mass sways with it
  const swayDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  swayDepth.onBeforeCompile = (sh) => {
    sh.uniforms.uWindTime = windTime;
    sh.vertexShader = SWAY_PARS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + SWAY);
  };

  // ---------- colour ----------
  // These are albedos for the light of world/sky.js, where a face in full sun shows about albedo x 2.3 and one in shade
  // albedo x 0.5: the art direction's leaf colours (#8cc63f sunlit, #27602a deep shade) come out of these on screen.
  const BROADLEAF = [lin('#2a6242'), lin('#3d8238'), lin('#7a9a30')];           // crease or underside, mid, facing the sun
  const NEEDLE = [lin('#1d4a34'), lin('#2f6f3e'), lin('#56893f')];
  const BARK_DARK = lin('#45342a'), BARK_LIGHT = lin('#7a5c46'), MOSS = lin('#55803a'), VINE = lin('#4a4a26');
  const SPRIG_GAIN = 1.15;                                                      // sprigs are multiplied by the atlas (about 0.7): this makes them a touch lighter than the mass under them
  const ink = { r: 0, g: 0, b: 0, flex: 0, leafy: 0 };                          // scratch: colour, wind flex and leaf-pattern scale of the vertex being made
  function setInk(a, b, k, gain = 1) { ink.r = (a[0] + (b[0] - a[0]) * k) * gain; ink.g = (a[1] + (b[1] - a[1]) * k) * gain; ink.b = (a[2] + (b[2] - a[2]) * k) * gain; }
  // every plant has its own cast: warmer (yellower) or cooler (bluer), and a little lighter or darker
  const hue = [1, 1, 1];
  function pickHue(range) { const warm = rr(-range, range), light = rr(0.86, 1.08); hue[0] = light * (1 + 0.24 * warm); hue[1] = light; hue[2] = light * (1 - 0.3 * warm); }
  // leaf colour along a ramp: t = 0 deep shade, 0.5 mid, 1 sunlit
  function leafInk(ramp, t, gain = 1) {
    const k = clamp01(t) * 2;
    if (k < 1) setInk(ramp[0], ramp[1], k, gain); else setInk(ramp[1], ramp[2], k - 1, gain);
    ink.r *= hue[0]; ink.g *= hue[1]; ink.b *= hue[2];
  }

  // ---------- geometry batches: one merged mesh per material and region; shadow casters in larger regions of their own ----------
  // (In the camp the casters make four meshes per material; in the North Forest, sixteen: only those in view, or in
  // the sun's shadow box, are drawn. As one mesh they cost 440,000 triangles twice a frame wherever she stood.)
  const REGION = 16, SHADOW_REGION = 32;                                        // metres; a region's mesh is culled as a whole
  const batches = new Map();
  function batchAt(kind, x, z, casts) {
    const key = casts ? `${kind} shadow ${Math.floor(x / SHADOW_REGION)},${Math.floor(z / SHADOW_REGION)}` : `${kind} ${Math.floor(x / REGION)},${Math.floor(z / REGION)}`;
    let b = batches.get(key);
    if (!b) { b = { kind, casts, count: 0, pos: [], nor: [], col: [], uv: [], wind: [], idx: [] }; batches.set(key, b); }
    return b;
  }
  function addVertex(b, x, y, z, nx, ny, nz, u, v, phase) {                     // colour, wind flex and leaf pattern come from `ink`
    b.pos.push(x, y, z); b.nor.push(nx, ny, nz); b.col.push(ink.r, ink.g, ink.b); b.uv.push(u, v); b.wind.push(ink.flex, phase, ink.leafy);
    return b.count++;
  }

  // ---------- shapes ----------
  // unit geodesic spheres with shared vertices, by subdivision frequency (20 * freq * freq triangles)
  const geodesics = new Map();
  function geodesic(freq) {
    if (geodesics.has(freq)) return geodesics.get(freq);
    const t = (1 + Math.sqrt(5)) / 2;
    const corner = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const face = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const dirs = [], tris = [], seen = new Map();
    const point = (a, b, d, i, j) => {
      const k = freq - i - j;
      let x = a[0] * k + b[0] * i + d[0] * j, y = a[1] * k + b[1] * i + d[1] * j, z = a[2] * k + b[2] * i + d[2] * j;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
      if (!seen.has(key)) { seen.set(key, dirs.length / 3); dirs.push(x, y, z); }
      return seen.get(key);
    };
    for (const [ia, ib, id] of face) {
      const a = corner[ia], b = corner[ib], d = corner[id];
      for (let i = 0; i < freq; i++) for (let j = 0; j < freq - i; j++) {
        tris.push(point(a, b, d, i, j), point(a, b, d, i + 1, j), point(a, b, d, i, j + 1));
        if (i + j < freq - 1) tris.push(point(a, b, d, i + 1, j), point(a, b, d, i + 1, j + 1), point(a, b, d, i, j + 1));
      }
    }
    const made = { dirs, tris };
    geodesics.set(freq, made);
    return made;
  }

  // A lumpy ball: a sphere that swells over a few broad bumps. rx, ry, rz are its largest radii.
  function lumpyBall(x, y, z, rx, ry, rz, lumpCount, lumpSize) {
    const lumps = [], turn = rnd() * TAU;
    for (let i = 0; i < lumpCount; i++) {                                       // spread over the top and the sides
      const up = 0.95 - 1.4 * (i + rnd()) / lumpCount, flat = Math.sqrt(1 - up * up), a = turn + i * 2.4 + rr(-0.4, 0.4);
      lumps.push([Math.cos(a) * flat, up, Math.sin(a) * flat, lumpSize * rr(0.65, 1), rr(5, 10)]);
    }
    const raw = (dx, dy, dz) => { let s = 1; for (const l of lumps) s += l[3] * Math.exp(l[4] * (dx * l[0] + dy * l[1] + dz * l[2] - 1)); return s; };
    let peak = 1;
    const probe = geodesic(2).dirs;
    for (let i = 0; i < probe.length; i += 3) peak = Math.max(peak, raw(probe[i], probe[i + 1], probe[i + 2]));
    return { x, y, z, rx, ry, rz, swell: (dx, dy, dz) => raw(dx, dy, dz) / peak };
  }

  // Adds a ball's skin to a batch. Normals are smooth and bent towards the direction away from `hub` (the middle of the
  // whole plant), so a crown of several balls shades as one soft volume. paint(x, y, z, nx, ny, nz) sets `ink`.
  function addBall(batch, ball, freq, hub, bend, floorY, phase, paint) {
    const { dirs, tris } = geodesic(freq), n = dirs.length;
    const P = new Float32Array(n), N = new Float32Array(n), slot = new Int32Array(n / 3).fill(-1);
    for (let i = 0; i < n; i += 3) {
      const s = ball.swell(dirs[i], dirs[i + 1], dirs[i + 2]);
      P[i] = ball.x + dirs[i] * s * ball.rx; P[i + 1] = ball.y + dirs[i + 1] * s * ball.ry; P[i + 2] = ball.z + dirs[i + 2] * s * ball.rz;
    }
    for (let t = 0; t < tris.length; t += 3) {                                  // every face adds its normal to its three corners
      const a = tris[t] * 3, b = tris[t + 1] * 3, d = tris[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[a], vy = P[d + 1] - P[a + 1], vz = P[d + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[d] += nx; N[d + 1] += ny; N[d + 2] += nz;
    }
    const emit = (i) => {
      if (slot[i] >= 0) return slot[i];
      const k = i * 3, px = P[k], py = P[k + 1], pz = P[k + 2];
      let nx = N[k], ny = N[k + 1], nz = N[k + 2], l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const hx = px - hub.x, hy = py - hub.y, hz = pz - hub.z, hl = Math.hypot(hx, hy, hz) || 1;
      if (nx * hx + ny * hy + nz * hz > 0) {                                    // (faces that look at the hub are buried inside the crown)
        nx += (hx / hl - nx) * bend; ny += (hy / hl - ny) * bend; nz += (hz / hl - nz) * bend; l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      }
      paint(px, py, pz, nx, ny, nz);
      return (slot[i] = addVertex(batch, px, py, pz, nx, ny, nz, 0, 0, phase));
    };
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], d = tris[t + 2];
      if (P[a * 3 + 1] < floorY && P[b * 3 + 1] < floorY && P[d * 3 + 1] < floorY) continue;     // buried
      batch.idx.push(emit(a), emit(b), emit(d));
    }
  }

  // A sprig: one cut-out card rooted at (px, py, pz), growing along the unit vector g and lying across `face`.
  // (nx, ny, nz) is the normal it is lit with. Sprigs that would hang too far over the open ground are left out.
  function addSprig(batch, px, py, pz, gx, gy, gz, size, rect, nx, ny, nz, phase, paint, face) {
    let sx = gy * face[2] - gz * face[1], sy = gz * face[0] - gx * face[2], sz = gx * face[1] - gy * face[0];
    const sl = (Math.hypot(sx, sy, sz) || 1) * 2 / size; sx /= sl; sy /= sl; sz /= sl;                // half the card's width
    const bx = px - gx * size * 0.08, by = py - gy * size * 0.08, bz = pz - gz * size * 0.08;        // the stalk end sits just inside the mass
    const tx = bx + gx * size, ty = by + gy * size, tz = bz + gz * size;
    if (Math.min(by - heightAt(bx, bz), ty - heightAt(tx, tz)) < LOW && Math.max(overhang(tx, tz), overhang(bx, bz)) > LOW_REACH - size * 0.25) return;      // (10-12: low above the ground it hangs over, a ledge's top too)
    if (logGap(tx, tz) < size * 0.5) return;
    let mx = nx + gx * 0.5, my = ny + gy * 0.5, mz = nz + gz * 0.5; const ml = Math.hypot(mx, my, mz); mx /= ml; my /= ml; mz /= ml;   // the tip leans its normal outwards
    paint(0);
    const a = addVertex(batch, bx - sx, by - sy, bz - sz, nx, ny, nz, rect[0], rect[3], phase);
    addVertex(batch, bx + sx, by + sy, bz + sz, nx, ny, nz, rect[2], rect[3], phase);
    paint(1);
    addVertex(batch, tx + sx, ty + sy, tz + sz, mx, my, mz, rect[2], rect[1], phase);
    addVertex(batch, tx - sx, ty - sy, tz - sz, mx, my, mz, rect[0], rect[1], phase);
    batch.idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }

  // Covers a ball's skin between two heights (-1 = bottom, 1 = top) with sprigs. They lie on the skin like shingles,
  // tips out and `lift`ed up the slope (down it when lift is negative), so leaves hide the smooth ball and break up its
  // outline. paint(tip, x, y, z) sets `ink` for the stalk end (tip = 0) and the tip (1).
  function addSprigs(batch, ball, count, size, rects, lowest, highest, lift, phase, paint) {
    for (let i = 0; i < count; i++) {
      const dy = rr(lowest, highest), flat = Math.sqrt(1 - dy * dy), a = rnd() * TAU, dx = Math.cos(a) * flat, dz = Math.sin(a) * flat;
      const s = ball.swell(dx, dy, dz), px = ball.x + dx * s * ball.rx, py = ball.y + dy * s * ball.ry, pz = ball.z + dz * s * ball.rz;
      let nx = dx / ball.rx, ny = dy / ball.ry, nz = dz / ball.rz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // two directions in the skin: up the slope, and across it
      let ux = -nx * ny, uy = 1 - ny * ny, uz = -nz * ny; const ul = Math.hypot(ux, uy, uz);
      if (ul < 0.1) { ux = Math.cos(a); uy = 0; uz = Math.sin(a); } else { ux /= ul; uy /= ul; uz /= ul; }
      const wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux, turn = rr(-0.45, 0.45);
      let gx = nx * 0.55 + ux * lift + wx * turn, gy = ny * 0.55 + uy * lift + wy * turn, gz = nz * 0.55 + uz * lift + wz * turn; const gl = Math.hypot(gx, gy, gz); gx /= gl; gy /= gl; gz /= gl;
      const length = size * rr(0.8, 1.2);
      addSprig(batch, px, py, pz, gx, gy, gz, length, rects[Math.floor(rnd() * rects.length)], nx, ny, nz, phase + i,
        (tip) => paint(tip, px + gx * length * tip, py + gy * length * tip, pz + gz * length * tip), [nx, ny, nz]);
    }
  }

  // A round tube along a path of [x, y, z, radius] points: slim trunks, branches, vine stems. The texture strip of
  // width uSpan runs half-way round and back again, so it has no seam. paint(k, nx, ny, nz) sets `ink`; k = 0..1 along the path.
  function addTube(batch, path, sides, uSpan, vPerMetre, phase, paint) {
    const first = batch.count, last = path.length - 1;
    let nx = 0.36, ny = 0.11, nz = 0.93, run = 0;                               // a side vector carried along the path so the rings do not twist
    for (let i = 0; i <= last; i++) {
      const p = path[i], a = path[Math.max(0, i - 1)], b = path[Math.min(last, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      const along = nx * tx + ny * ty + nz * tz; nx -= tx * along; ny -= ty * along; nz -= tz * along;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      if (i) run += Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]);
      for (let j = 0; j < sides; j++) {
        const ang = j / sides * TAU, cs = Math.cos(ang), sn = Math.sin(ang);
        const ox = nx * cs + bx * sn, oy = ny * cs + by * sn, oz = nz * cs + bz * sn;
        paint(i / last, ox, oy, oz);
        addVertex(batch, p[0] + ox * p[3], p[1] + oy * p[3], p[2] + oz * p[3], ox, oy, oz, uSpan * (1 - Math.abs(2 * j / sides - 1)), run * vPerMetre, phase);
      }
    }
    for (let i = 0; i < last; i++) for (let j = 0; j < sides; j++) {
      const a = first + i * sides + j, a1 = first + i * sides + (j + 1) % sides, b = a + sides, b1 = a1 + sides;
      batch.idx.push(a, a1, b, a1, b1, b);
    }
  }

  // bark colour: brown that darkens into the ground and under the crown, with moss low down on the faces that look up,
  // and half of the plant's own cast. (ox, oz) is the outward direction, so the pattern runs round the trunk without a seam.
  function barkInk(seed, ox, oz, height, ny, top, gain) {
    const moss = clamp01((1.3 - height) / 1.1) * smooth(0.4, 0.7, c.fbm2(seed + ox * 1.4, seed * 1.7 + oz * 1.4 + height * 1.2, 3)) * (0.5 + 0.5 * clamp01(ny * 1.8 + 0.25));
    const shade = gain * (0.5 + 0.5 * smooth(-0.05, 0.6, height)) * (1 - 0.4 * smooth(top * 0.45, top * 0.85, height));
    setInk(BARK_DARK, BARK_LIGHT, 0.25 + 0.6 * c.fbm2(seed * 2 + ox * 0.9 + height * 0.3, seed + oz * 0.9, 2));
    ink.r = (ink.r + (MOSS[0] - ink.r) * moss) * shade * (0.5 + 0.5 * hue[0]); ink.g = (ink.g + (MOSS[1] - ink.g) * moss) * shade * (0.5 + 0.5 * hue[1]); ink.b = (ink.b + (MOSS[2] - ink.b) * moss) * shade * (0.5 + 0.5 * hue[2]);
    ink.flex = 0; ink.leafy = 0;
  }

  // ---------- plants ----------
  // The giant trees' crowns and upper trunks cast no shadow: at this sun angle they would put the camp fire, the log
  // and the whole northern half of the clearing in shade. The trunk casts up to this height (with any branch that
  // leaves it lower down), and a few unseen lumps just above give the shade a soft, leafy edge that stops short of the
  // fire and the log.
  const SHADOW_TOP = 4.4;
  const fireAt = level.campfire || [-60, -60], fireX = (fireAt[0] + 0.5) * S, fireZ = (fireAt[1] + 0.5) * S;
  function addShade(x, z, y0, facing) {
    for (let i = 0; i < 4; i++) {
      const a = facing + rr(-1.5, 1.5), out = rr(0.3, 1.3), sx = x + Math.cos(a) * out, sz = z + Math.sin(a) * out;
      for (let size = 1; size > 0.4; size -= 0.2) {                             // too close to the fire or the log: try a smaller, lower lump
        const r = rr(0.9, 1.4) * size, up = SHADOW_TOP + rr(0.3, 1.5) * size, landX = sx + shadowStep[0] * up, landZ = sz + shadowStep[1] * up;
        if (logGap(landX, landZ) < r + 0.4 || Math.hypot(landX - fireX, landZ - fireZ) < r + 1.2) continue;
        addBall(batchAt('shade', x, z, true), lumpyBall(sx, y0 + up, sz, r, r * 0.7, r, 4, 0.3), 2, { x: sx, y: y0 + up, z: sz }, 0, -1e9, rnd() * TAU, () => { ink.flex = 0.8; ink.leafy = 0; });
        break;
      }
    }
  }

  // The trunk of a giant tree: a tall tapered column whose foot flares into buttress roots. Rings up to SHADOW_TOP go
  // to `low`, the rest to `high`. Returns the surface so that branches and vines can sit on it.
  function addBigTrunk(low, high, x, z, y0, radius, top, sides, levels, reach) {
    const seed = rnd() * 50, leanX = rr(-0.3, 0.3), leanZ = rr(-0.25, 0.25);
    const ribs = 9 + Math.floor(rnd() * 5), ribTurn = rnd() * TAU, oval = rnd() * TAU;
    const roots = [];
    for (let i = 0, n = 5 + Math.floor(rnd() * 3); i < n; i++) {                // [angle, half-width (rad, no narrower than the mesh can show), length]
      roots.push([(i + rr(0.15, 0.85)) / n * TAU, Math.max(rr(0.26, 0.38), 7.5 / sides), Math.max(0.05, Math.min(rr(0.4, 0.75), reach - radius * 1.3))]);
    }
    const flare = 1.6;                                                          // height where the roots have merged into the column
    // how far the roots reach out at an angle: the strongest root there, blended smoothly with its neighbours (no crease between two roots)
    const rootAt = (a) => { let m = 0; for (const r of roots) { let d = Math.abs(a - r[0]) % TAU; if (d > Math.PI) d = TAU - d; m += (r[2] * Math.exp(-(d * d) / (r[1] * r[1]))) ** 3; } return Math.cbrt(m); };
    const radiusAt = (a, y) => {
      const foot = clamp01(1 - y / flare);
      const column = radius * (1 - 0.34 * clamp01(y / top)) * (1 + 0.2 * foot * foot) * (1 + 0.05 * Math.cos(2 * a + oval));
      return column * (1 + 0.03 * Math.sin(a * ribs + ribTurn + y * 0.3) * (0.3 + 0.7 * foot)) + rootAt(a) * foot ** 2.4;
    };
    const axisX = (y) => x + leanX * (y / top) ** 2, axisZ = (y) => z + leanZ * (y / top) ** 2;
    const at = (a, y) => { const r = radiusAt(a, y); return [axisX(y) + Math.cos(a) * r, y0 + y, axisZ(y) + Math.sin(a) * r]; };
    // the skin as a grid of points (one ring per level); normals come from the grid itself, so they agree with the triangles
    const grid = levels.map((y) => { const ringPoints = []; for (let j = 0; j < sides; j++) ringPoints.push(at(j / sides * TAU, y)); return ringPoints; });
    const uShift = rnd(), vShift = rnd(), lastLevel = levels.length - 1;
    const ring = (batch, i, stride) => {
      const first = batch.count;
      for (let j = 0; j <= sides; j += stride) {
        const k = j % sides, p = grid[i][k], up = grid[Math.min(i + 1, lastLevel)][k], down = grid[Math.max(i - 1, 0)][k], next = grid[i][(k + 1) % sides], prev = grid[i][(k + sides - 1) % sides];
        const ux = up[0] - down[0], uy = up[1] - down[1], uz = up[2] - down[2], ax = next[0] - prev[0], ay = next[1] - prev[1], az = next[2] - prev[2];
        let nx = uy * az - uz * ay, ny = uz * ax - ux * az, nz = ux * ay - uy * ax; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        barkInk(seed, Math.cos(k / sides * TAU), Math.sin(k / sides * TAU), levels[i], ny, top, 1);
        addVertex(batch, p[0], p[1], p[2], nx, ny, nz, j / sides * 2 + uShift, levels[i] / 4 + vShift, 0);
      }
      return first;
    };
    let batch = low, stride = 1, below = ring(batch, 0, stride);
    for (let i = 1; i <= lastLevel; i++) {
      const above = ring(batch, i, stride);
      for (let j = 0; j < sides / stride; j++) batch.idx.push(below + j, above + j, below + j + 1, below + j + 1, above + j, above + j + 1);
      below = above;
      if (levels[i] === SHADOW_TOP) { batch = high; stride = sides > 20 ? 2 : 1; below = ring(batch, i, stride); }       // up there nobody gets close: half the sides will do
    }
    return { radiusAt, axisX, axisZ, y0, top, seed };
  }

  // a heavy branch leaving a giant trunk at height `from` towards `angle`: it sweeps out, then up into the crown
  function addBranch(batch, trunk, from, angle) {
    const path = [], dx = Math.cos(angle), dz = Math.sin(angle), reach = rr(1.3, 2), rise = rr(2.6, 3.4), thick = rr(0.2, 0.26);
    for (let i = 0; i <= 7; i++) {
      const k = i / 7, out = reach * (1 - (1 - k) ** 1.7);
      path.push([trunk.axisX(from) + dx * out, trunk.y0 + from + rise * (0.3 * k + 0.7 * k * k), trunk.axisZ(from) + dz * out, thick * (1 - 0.7 * k) * (i ? 1 : 1.5)]);
    }
    addTube(batch, path, 9, 0.3, 0.3, 0, (k, nx, ny, nz) => barkInk(trunk.seed, nx, nz, from + rise * k, ny, trunk.top, 0.92));
  }

  // a vine winding up a giant trunk: a smooth stem with leaves lying on the bark
  function addVine(trunk) {
    const stem = [], start = rr(0.6, 2.4), turns = rr(0.8, 1.3) * (rnd() < 0.5 ? 1 : -1), height = rr(4.6, 5.8), phase = rnd() * TAU;
    const x0 = trunk.axisX(0), z0 = trunk.axisZ(0);
    const at = (k, out) => {
      const y = 0.03 + height * k, a = start + turns * TAU * k + 0.5 * Math.sin(k * 9 + phase) + 0.25 * Math.sin(k * 23 + phase * 2), r = trunk.radiusAt(a, y) + out;
      return [trunk.axisX(y) + Math.cos(a) * r, trunk.y0 + y, trunk.axisZ(y) + Math.sin(a) * r, Math.cos(a), Math.sin(a)];
    };
    for (let i = 0; i <= 44; i++) { const k = i / 44, p = at(k, 0.012); stem.push([p[0], p[1], p[2], 0.024 - 0.014 * k]); }
    addTube(batchAt('mass', x0, z0, false), stem, 5, 1, 1, 0, (k, nx, ny) => { setInk(VINE, MOSS, 0.6 * k, 0.6 + 0.3 * clamp01(ny + 0.6)); ink.flex = 0; ink.leafy = 0; });
    const cards = batchAt('card', x0, z0, false);
    for (let i = 0; i < 40; i++) {
      const k = (i + rnd()) / 40, p = at(k, 0.06), side = i % 2 ? 1 : -1;
      // the leaf lies on the bark: it grows along the trunk's surface, sideways and down from the stem
      let gx = -p[4] * side * 0.8, gy = rr(-0.8, 0.15), gz = p[3] * side * 0.8; const gl = Math.hypot(gx, gy, gz); gx /= gl; gy /= gl; gz /= gl;
      const size = rr(0.2, 0.38) * (1 - 0.3 * k), tone = rr(0.45, 0.9);
      addSprig(cards, p[0], p[1], p[2], gx, gy, gz, size, i % 5 ? SPRIG.ivy : SPRIG.frond, p[3] * 0.8, 0.35, p[4] * 0.8, phase + i,
        (tip) => { leafInk(BROADLEAF, tone + 0.2 * tip, 1.1); ink.flex = 0.15 * tip; }, [p[3], 0, p[4]]);
    }
  }

  // Leaf colour for a point of a crown made of `balls`: darker and cooler low down and in the creases between the balls,
  // warm on the sun's side. `dim` > 0 also darkens everything near the ground (trees deep in the forest stand in shade).
  function crownPaint(ramp, y0, low, high, balls, self, dim, flexLow, flexHigh, leafy) {
    return (px, py, pz, nx, ny, nz) => {
      const h = clamp01((py - low) / (high - low));
      let crease = 1;
      for (const b of balls) if (b !== self) crease = Math.min(crease, smooth(0.8, 1.3, Math.hypot((px - b.x) / b.rx, (py - b.y) / b.ry, (pz - b.z) / b.rz)));
      leafInk(ramp, 0.12 + 0.45 * h + 0.3 * sunny(nx, ny, nz) * (0.4 + 0.6 * h), 0.9 * (0.5 + 0.5 * crease) * (1 - dim + dim * smooth(2.5, 6.5, py - y0)));
      ink.flex = flexLow + (flexHigh - flexLow) * h; ink.leafy = leafy;
    };
  }
  // the same for the sprigs on a crown: lighter than the mass under them, lightest at their tips
  const sprigPaint = (ramp, low, high, flex) => (tip, px, py) => {
    leafInk(ramp, 0.2 + 0.45 * clamp01((py - low) / (high - low)) + 0.15 * tip, SPRIG_GAIN);
    ink.flex = flex * (0.6 + 0.6 * tip);
  };

  // A giant tree of the trunk wall. grade 0 = front row (seen from 1 m), 1 = just behind, 2 = glimpsed between the others.
  const HERO_LEVELS = [-0.35, 0, 0.14, 0.3, 0.5, 0.74, 1.02, 1.36, 1.8, 2.4, 3.2, SHADOW_TOP, 6.2, 8.2];
  const PLAIN_LEVELS = [-0.3, 0, 0.35, 1, 2, SHADOW_TOP];
  function bigTree(x, z, grade, vine) {
    const y0 = heightAt(x, z), radius = rr(0.5, 0.68) * (grade ? 0.92 : 1), top = rr(9, 10.5);
    pickHue(0.5);
    const casts = grade === 0 && shadowShows(x, z, SHADOW_TOP);
    const levels = (grade === 0 ? HERO_LEVELS : PLAIN_LEVELS).concat(top);
    const trunk = addBigTrunk(batchAt('bark', x, z, casts), batchAt('bark', x, z, false), x, z, y0, radius, top, [40, 12, 8][grade], levels, clearance(x, z) + LOW_REACH);
    const [fx, fz] = intoForest(x, z), facing = Math.atan2(-fz, -fx);            // `facing` looks at the clearing
    if (grade === 0) {
      if (rnd() < 0.7) {
        const from = rr(3.6, 5.2);
        addBranch(batchAt('bark', x, z, casts && from < SHADOW_TOP), trunk, from, facing + rr(-1.2, 1.2));
      }
      if (vine) addVine(trunk);
      if (casts) addShade(x, z, y0, facing);
    }
    // crown: one great ball set back from the clearing, with two lower skirts on the front trees
    const phase = rnd() * TAU, balls = [];
    const back = grade === 0 ? 1.1 : 0.3, cx = x + fx * back + rr(-0.4, 0.4), cz = z + fz * back + rr(-0.4, 0.4);
    const spread = Math.min(rr(3.1, 3.8), clearance(cx, cz) + 1.7, logGap(cx, cz) - 1), cy = y0 + rr(8.3, 9.2) + grade * 0.5;
    balls.push(lumpyBall(cx, cy, cz, spread, spread * 0.82, spread, 6, 0.32));
    if (grade === 0) for (const turn of [-1, 1]) {
      const a = facing + turn * rr(0.5, 1.3), out = rr(1.2, 2), sx = cx + Math.cos(a) * out, sz = cz + Math.sin(a) * out;
      const r = Math.min(rr(1.4, 1.9), clearance(sx, sz) + 1.3, logGap(sx, sz) - 0.6);
      balls.push(lumpyBall(sx, y0 + rr(6.7, 7.3), sz, r, r * 0.8, r, 4, 0.3));
    }
    const hub = { x: cx, y: cy - 1, z: cz }, low = y0 + 5.2, high = cy + spread * 0.8;
    const mass = batchAt('mass', x, z, false), cards = batchAt('card', x, z, false);
    balls.forEach((ball, i) => {
      addBall(mass, ball, i || grade ? 3 : 4, hub, 0.5, -1e9, phase, crownPaint(BROADLEAF, y0, low, high, balls, ball, 0, 0.5, 1, 0.3));
      if (grade === 2) return;
      const paint = sprigPaint(BROADLEAF, low, high, 1);
      const size = i ? 0.75 : 0.95;
      addSprigs(cards, ball, i ? 22 : (grade ? 18 : 64), size, LEAFY, -0.9, 0.2, -0.3, phase, paint);                      // hanging from the underside, seen from the clearing
      addSprigs(cards, ball, i ? 10 : (grade ? 18 : 34), size, LEAFY, 0.2, 0.98, 0.5, phase, paint);                       // the top, seen from above
    });
  }

  // A broadleaf tree: a slim trunk and a rounded crown of a main ball and a few satellites. `fine` = near the clearing;
  // the others stand in the forest's shade and only their tops catch the light.
  function broadleaf(x, z, spread, crownY, fine) {
    const y0 = heightAt(x, z), phase = rnd() * TAU, seed = rnd() * 50;
    const casts = fine && shadowShows(x, z, crownY + spread * 0.5);
    pickHue(1);
    const leanX = rr(-0.35, 0.35), leanZ = rr(-0.35, 0.35), girth = spread * rr(0.085, 0.11);
    const trunk = [];
    for (let i = 0; i <= 5; i++) {
      const k = i / 5, y = -0.3 + (crownY + 0.3) * k;
      trunk.push([x + leanX * k * k, y0 + y, z + leanZ * k * k, girth * (1 - 0.45 * k) * (1 + 0.9 * (1 - smooth(-0.3, 0.7, y)))]);
    }
    // (the back trees' trunks stand in the dark: no bark texture needed, so they go with the leaf masses)
    addTube(batchAt(fine ? 'bark' : 'mass', x, z, false), trunk, fine ? 10 : 6, 0.5, 0.3, 0, (k, nx, ny, nz) => barkInk(seed, nx, nz, -0.3 + (crownY + 0.3) * k, ny, crownY, fine ? 1 : 0.5));
    const cx = x + leanX, cz = z + leanZ, balls = [lumpyBall(cx, y0 + crownY, cz, spread, spread * rr(0.72, 0.82), spread, 6, 0.3)];
    for (let i = 0, n = fine ? 3 : 1; i < n; i++) {
      const a = rnd() * TAU, out = spread * rr(0.5, 0.7), r = spread * rr(0.46, 0.6);
      balls.push(lumpyBall(cx + Math.cos(a) * out, y0 + crownY + spread * rr(-0.3, 0.25), cz + Math.sin(a) * out, r, r * 0.8, r, 4, 0.28));
    }
    const hub = { x: cx, y: y0 + crownY - spread * 0.25, z: cz }, low = y0 + crownY - spread * 0.8, high = y0 + crownY + spread * 0.8;
    const mass = batchAt('mass', x, z, casts), cards = batchAt('card', x, z, false);
    balls.forEach((ball, i) => {
      addBall(mass, ball, fine ? (i ? 3 : 4) : (i ? 2 : 3), hub, 0.5, -1e9, phase, crownPaint(BROADLEAF, y0, low, high, balls, ball, fine ? 0 : 0.8, 0.3, 1, fine ? 0.5 : 0.3));
      const paint = sprigPaint(BROADLEAF, low, high, 1);
      if (fine) addSprigs(cards, ball, i ? 30 : 110, spread * 0.3, LEAFY, -0.6, 0.98, 0.5, phase, paint);
      else addSprigs(cards, ball, i ? 12 : 40, spread * 0.36, LEAFY, -0.2, 0.98, 0.5, phase, paint);
    });
    if (noteCam || fine) c.camBlockers.push({ x: cx, y: y0 + crownY, z: cz, r: spread * 1.2 + 0.1, ry: spread * 0.9 },
      { trunk: true, x, z, lx: leanX, lz: leanZ, y0, h: crownY - spread * 0.4, r: girth * 1.5 });
  }
  let noteCam = false;                             // set while the pond glade's own trees are built (see below)

  // A conifer: tiers of drooping boughs stacked up a straight trunk. Each tier is a soft skirt whose rim is scalloped
  // into boughs, shingled with needle sprays; a larger spray hangs from the tip of every bough.
  function conifer(x, z, height, spread, fine) {
    const y0 = heightAt(x, z), phase = rnd() * TAU, seed = rnd() * 50;
    const casts = fine && shadowShows(x, z, height * 0.8);
    pickHue(0.6);
    const tiers = fine ? 6 : 4, boughs = fine ? 6 : 5, low = fine ? rr(0.9, 1.2) : 1.6;
    addTube(batchAt(fine ? 'bark' : 'mass', x, z, false), [[x, y0 - 0.3, z, 0.3], [x, y0 + 0.25, z, 0.2], [x, y0 + height * 0.5, z, 0.12], [x, y0 + height * 0.92, z, 0.03]], 8, 0.4, 0.3, 0,
      (k, nx, ny, nz) => barkInk(seed, nx, nz, height * k, ny, height, 0.8));
    const mass = batchAt('mass', x, z, casts), cards = batchAt('card', x, z, false);
    const step = (height - low) / tiers, flexAt = (y) => 0.25 + 0.75 * clamp01((y - y0) / height);
    for (let i = 0; i < tiers; i++) {
      const rim = spread * (1 - 0.8 * i / (tiers - 1)) ** 0.9, rimY = y0 + low + step * i;
      const topY = i === tiers - 1 ? y0 + height : rimY + step * 1.75, drop = topY - rimY, turn = rnd() * TAU;
      const sides = boughs * (fine && i < 2 ? 6 : 4);                           // the lowest tiers are seen from 1 m
      const bough = (a) => 0.5 + 0.5 * Math.cos(boughs * a + turn);             // 1 along the middle of a bough, 0 in the notch between two
      const at = (a, t) => {                                                    // t = 0 at the trunk, 1 at the rim
        const r = rim * (0.05 + 0.95 * t ** 0.75) * (1 - 0.32 * t * t * (1 - bough(a)));
        return [x + Math.cos(a) * r, topY - drop * t ** 1.5 - 0.22 * rim * t * t * bough(a), z + Math.sin(a) * r];
      };
      const normalAt = (a, t) => {                                              // from the surface itself
        const pa = at(a + 0.05, t), pb = at(a - 0.05, t), pi = at(a, t - 0.05), po = at(a, t + 0.05);
        const ax = pa[0] - pb[0], ay = pa[1] - pb[1], az = pa[2] - pb[2], tx = po[0] - pi[0], ty = po[1] - pi[1], tz = po[2] - pi[2];
        const nx = ay * tz - az * ty, ny = az * tx - ax * tz, nz = ax * ty - ay * tx, l = Math.hypot(nx, ny, nz);
        return [nx / l, ny / l, nz / l];
      };
      // The skin, ring by ring from the peak outwards: three rings down the slope and the rim's rounded nose; then the
      // underside, dark, from the rim back up to the trunk.
      const first = mass.count;
      leafInk(NEEDLE, 0.2, 0.6); ink.flex = flexAt(topY); ink.leafy = -1.1;
      addVertex(mass, x, topY + 0.02 * rim, z, 0, 1, 0, 0, 0, phase);
      const slope = [0.3, 0.68, 0.94];
      for (let k = 0; k < 6; k++) for (let j = 0; j < sides; j++) {
        const a = j / sides * TAU, cs = Math.cos(a), sn = Math.sin(a);
        let p, n;
        if (k < 3) {
          const t = slope[k]; p = at(a, t); n = normalAt(a, t);
          leafInk(NEEDLE, 0.05 + 0.5 * t * t * (0.6 + 0.4 * bough(a)) + 0.3 * sunny(n[0], n[1], n[2]) * t, 0.4 + 0.6 * smooth(0.1, 0.8, t));     // dark under the tier above and in the notches, lighter towards the tips
          ink.flex = flexAt(p[1]) * (0.5 + 0.5 * t);
        } else if (k < 5) {                                                     // the nose, and the same ring again where the underside starts
          p = at(a, 1); p[1] -= 0.05 * rim; n = k === 3 ? [cs * 0.92, -0.38, sn * 0.92] : [cs * 0.2, -0.98, sn * 0.2];
          leafInk(NEEDLE, k === 3 ? 0.3 + 0.2 * bough(a) : 0.1, k === 3 ? 0.75 : 0.5); ink.flex = flexAt(p[1]);
        } else {
          p = [x + cs * rim * 0.16, rimY + drop * 0.5, z + sn * rim * 0.16]; n = [-cs * 0.5, -0.86, -sn * 0.5];
          leafInk(NEEDLE, 0, 0.3); ink.flex = flexAt(p[1]) * 0.5;
        }
        addVertex(mass, p[0], p[1], p[2], n[0], n[1], n[2], 0, 0, phase);
      }
      for (let j = 0; j < sides; j++) {
        const j1 = (j + 1) % sides;
        mass.idx.push(first, first + 1 + j1, first + 1 + j);
        for (const k of [0, 1, 2, 4]) {
          const a = first + 1 + k * sides + j, b = first + 1 + k * sides + j1, d = a + sides, e = b + sides;
          mass.idx.push(a, b, d, b, e, d);
        }
      }
      // needle sprays: one hanging from the tip of every bough, the others lying down the slope like shingles
      const spray = (a, t, size, hang) => {
        const p = at(a, t), nrm = normalAt(a, t), q = at(a, t + 0.1), tone = 0.25 + 0.4 * t * t;
        let gx = q[0] - p[0], gy = q[1] - p[1] - hang, gz = q[2] - p[2]; const gl = Math.hypot(gx, gy, gz); gx /= gl; gy /= gl; gz /= gl;
        addSprig(cards, p[0], p[1], p[2], gx, gy, gz, size * rr(0.85, 1.15), SPRIG.needles, nrm[0], nrm[1], nrm[2], phase + a * 7,
          (tip) => { leafInk(NEEDLE, tone + 0.4 * tip, SPRIG_GAIN); ink.flex = flexAt(p[1]) * (0.7 + 0.5 * tip); }, nrm);
      };
      const size = Math.max(0.42, rim * 0.6);
      for (let k = 0; k < boughs; k++) spray((k * TAU - turn) / boughs, 0.93, size, 0.12);
      if (fine) for (let k = 0, n = Math.round(2 + rim * 7); k < n; k++) spray((k + rnd()) / n * TAU, rr(0.4, 0.8), size * 0.9, 0.02);
    }
  }

  // A plump shrub: one lumpy dome shingled with sprigs. grade 2 = lines the clearing (seen from 1 m), 1 = the small
  // ones between them, 0 = understory further back.
  function bush(x, z, radius, grade, bloom) {
    const y0 = heightAt(x, z), tall = radius * rr(0.85, 1.1), phase = rnd() * TAU, gain = grade ? 1 : 0.6;
    pickHue(1);
    const casts = grade === 2 && shadowShows(x, z, tall * 1.2);
    const ball = lumpyBall(x, y0 + tall * 0.4, z, radius, tall, radius, grade === 2 ? 6 : 4, 0.3);
    if (c.bushes) c.bushes.push({ x, y: y0 + tall * 0.4, z, r: radius, h: tall });
    const top = y0 + tall * 1.4;
    addBall(batchAt('mass', x, z, casts), ball, 3, ball, 0.3, y0 - 0.12, phase, (px, py, pz, nx, ny, nz) => {
      const h = clamp01((py - y0) / (top - y0));
      leafInk(BROADLEAF, 0.15 + 0.45 * h + 0.25 * sunny(nx, ny, nz), gain * 0.95 * (0.45 + 0.55 * smooth(0, 0.45, py - y0)));      // darker where it meets the ground
      ink.flex = 0.5 * h; ink.leafy = 0.77;
    });
    const cards = batchAt('card', x, z, false);
    addSprigs(cards, ball, [8, 24, 52][grade], radius * 0.5, LEAFY, -0.3, 0.98, 0.5, phase, (tip, px, py) => { leafInk(BROADLEAF, 0.2 + 0.45 * clamp01((py - y0) / (top - y0)) + 0.15 * tip, gain * SPRIG_GAIN); ink.flex = 0.3 + 0.3 * tip; });
    if (bloom) {
      const petals = [lin('#ffffff'), lin('#ffd3ea'), lin('#fff0a8'), lin('#ffffff')][Math.floor(rnd() * 4)], rect = rnd() < 0.3 ? SPRIG.berries : SPRIG.blossom;
      for (let i = 0; i < 12; i++) {                                            // blossoms face outwards, standing just off the dome
        const dy = rr(0.1, 0.9), flat = Math.sqrt(1 - dy * dy), a = rnd() * TAU, dx = Math.cos(a) * flat, dz = Math.sin(a) * flat, s = ball.swell(dx, dy, dz) + 0.22;
        const gx = -dx * dy / flat, gy = flat, gz = -dz * dy / flat, half = rr(0.1, 0.14);                 // the way up along the dome
        addSprig(cards, x + dx * s * radius - gx * half, ball.y + dy * s * tall - gy * half, z + dz * s * radius - gz * half, gx, gy, gz, half * 2, rect, dx, dy, dz, phase + i,
          () => { ink.r = petals[0] * 0.42; ink.g = petals[1] * 0.42; ink.b = petals[2] * 0.42; ink.flex = 0.5; }, [dx, dy, dz]);
      }
    }
  }

  // A mass of distant forest: one tall dome standing on the ground, nearly black below, catching the light on top.
  function farMass(x, z, rx, rz, height, freq) {
    const y0 = heightAt(x, z);
    pickHue(0.7);
    const ball = lumpyBall(x, y0 + height * 0.4, z, rx, height * 0.6, rz, 5, 0.3);
    addBall(batchAt('mass', x, z, false), ball, freq, ball, 0.3, y0 - 0.2, rnd() * TAU, (px, py, pz, nx, ny, nz) => {
      const h = clamp01((py - y0) / height);
      leafInk(BROADLEAF, 0.02 + 0.45 * smooth(0.35, 1, h) + 0.25 * sunny(nx, ny, nz) * h, 0.9 * (0.2 + 0.8 * smooth(0.25, 0.7, h)));
      ink.flex = 0.8 * h; ink.leafy = 0.3;
    });
  }

  // ---------- planting ----------
  const tileCentre = (x, y) => [(x + 0.5) * S, (y + 0.5) * S];
  const trunks = [];                                                            // [x, z] of every trunk, so trees keep their distance
  const crowded = (x, z, gap) => trunks.some((p) => Math.hypot(p[0] - x, p[1] - z) < gap);
  const shuffled = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const isSoil = (x, y) => inBuilt(x, y) && !keepClear(x, y) && !barren(x, y);
  const soil = [];                                                              // every tile where something may grow: [x, y, row]
  const isRim = (x, y) => x < -M + 2 || y < -M + 2 || x >= W + M - 2 || y >= H + M - 2;       // the two outermost rings of tiles: the wall that closes the horizon
  const nearRim = (x, y) => isRim(x - 2, y) || isRim(x + 2, y) || isRim(x, y - 2) || isRim(x, y + 2);   // no trunks here: the wall's domes would swallow them
  for (let y = -M; y < H + M; y++) for (let x = -M; x < W + M; x++) if (isSoil(x, y)) soil.push([x, y, isRim(x, y) ? 9 : rowOf(x, y)]);

  // the giant trees stand on the map's '|' tiles; a vine climbs the front tree of each column the map marks
  const vineColumns = new Set(level.objects.vine.map(([x]) => x));
  for (const [x, y, row] of soil) {
    if (tileAt(x, y) !== '|' || row > 3) continue;                            // (those deeper in the forest are part of its dark mass)
    const front = keepClear(x + 1, y) || keepClear(x - 1, y) || keepClear(x, y + 1) || keepClear(x, y - 1);
    const [cx, cz] = tileCentre(x, y), [fx, fz] = intoForest(cx, cz), back = front ? 0.2 : 0;      // the front trees stand back a little: room for their roots
    const px = cx + fx * back + rr(-0.1, 0.1), pz = cz + fz * back + rr(-0.1, 0.1);
    trunks.push([px, pz]);
    bigTree(px, pz, front ? 0 : row <= 2 ? 1 : 2, front && vineColumns.has(x) && keepClear(x, y + 1));
  }

  // conifers: the map marks every tile a conifer sprite covers. The tree stands on the lowest tile of each run it can
  // grow on, and on every second tile of the long runs beside the south path.
  const coniferRoots = new Set();
  for (const [x, y] of level.objects.conifer) {
    const root = POND ? [x, y] : isSoil(x, y) ? [x, y] : isSoil(x, y + 1) ? [x, y + 1] : null;
    if (root && !onReserved(...tileCentre(...root), 0.5)) coniferRoots.add(root.join());
  }
  const conifers = new Set([...coniferRoots].filter((key) => {
    const [x, y] = key.split(',').map(Number);
    let below = 0;
    while (coniferRoots.has(`${x},${y + below + 1}`)) below++;
    return below % 2 === 0;
  }));
  for (const key of conifers) {
    const [x, y] = key.split(',').map(Number), [cx, cz] = tileCentre(x, y), [fx, fz] = intoForest(cx, cz), near = rowOf(x, y) === 1;
    const px = cx + fx * (near ? 0.25 : 0) + rr(-0.1, 0.1), pz = cz + fz * (near ? 0.25 : 0) + rr(-0.1, 0.1);
    trunks.push([px, pz]);
    if (POND) { const h = rr(3.8, 5.2), sp = rr(0.95, 1.25); c.camBlockers.push({ cone: true, x: px, z: pz, y0: heightAt(px, pz) + 1.0, h: h - 1.0, r: sp }); conifer(px, pz, h, sp, true); }
    else { const h = rr(6.2, 8), sp = near ? Math.min(rr(1.25, 1.5), clearance(px, pz) + 0.1) : rr(1.4, 1.8); c.camBlockers.push({ cone: true, x: px, z: pz, y0: heightAt(px, pz) + 1.0, h: h - 1.0, r: sp }); conifer(px, pz, h, sp, near); }
  }
  // the glade's own trees (pond level): round trees, willows, saplings and flowering bushes where the map has them
  if (POND) {
    const o = level.objects;
    // (each of these trees is also noted for the camera: it must not sit in a crown or look through a trunk)
    const crown = (px, pz, spread, crownY) => { noteCam = true; broadleaf(px, pz, spread, crownY, true); noteCam = false; };
    for (const [x, y] of o.tree || []) { const px = (x + 1) * S + rr(-0.1, 0.1), pz = (y + 0.5) * S; trunks.push([px, pz]); crown(px, pz, rr(1.5, 1.9), rr(3.6, 4.4)); }
    for (const [x, y] of o.willow || []) { const px = (x + 0.5) * S, pz = (y + 0.5) * S; trunks.push([px, pz]); crown(px, pz, rr(2.3, 2.6), rr(4.8, 5.4)); }
    for (const [x, y] of o.sapling || []) { const px = (x + 0.5) * S, pz = (y + 0.5) * S; trunks.push([px, pz]); crown(px, pz, rr(0.9, 1.1), rr(2.6, 3)); }
    for (const [x, y] of o.bush || []) bush((x + 1) * S, (y + 0.5) * S, rr(0.7, 0.85), 2, true);
  }

  // the bushes that line the clearing: a big one and a small one on every front-row tile
  for (const [x, y, row] of soil) {
    if (row !== 1 || tileAt(x, y) === '|' || conifers.has(`${x},${y}`)) continue;
    const [cx, cz] = tileCentre(x, y);
    if (onReserved(cx, cz, 0.5)) continue;
    const [fx, fz] = intoForest(cx, cz);
    for (const small of [false, true]) {
      // The dome's edge sits 0.1 m short of the open ground; its sprigs reach about 0.3 m further (0.4 m is allowed).
      const want = small ? rr(0.42, 0.56) : rr(0.66, 0.9), forward = S / 2 + 0.1 - want - (small ? rr(0, 0.3) : 0);
      const along = small ? rr(0.45, 0.75) * (rnd() < 0.5 ? 1 : -1) : rr(-0.2, 0.2);
      const px = cx - fx * forward - fz * along, pz = cz - fz * forward + fx * along;
      const radius = Math.min(want, clearance(px, pz) + 0.1);
      if (radius > 0.3) bush(px, pz, radius, small ? 1 : 2, !small && rnd() < 0.3);
    }
  }

  // second row: full-quality broadleaf trees, with a few low bushes under them
  for (const [x, y] of shuffled(soil.filter(([x, y, row]) => row === 2 && tileAt(x, y) !== '|' && !nearRim(x, y)))) {
    const [cx, cz] = tileCentre(x, y), px = cx + rr(-0.4, 0.4), pz = cz + rr(-0.4, 0.4);
    if (onReserved(px, pz, 1)) continue;
    if (!crowded(px, pz, 2.7)) {
      trunks.push([px, pz]);
      // inside the map the crowns stay back from the clearing; beside the paths out of it they are taller and arch over the path
      if (y >= 0 && y < H) broadleaf(px, pz, Math.min(rr(1.9, 2.5), clearance(px, pz) + 0.55), rr(4.4, 5.4), true);
      else broadleaf(px, pz, Math.min(rr(2.5, 3), clearance(px, pz) + 1.3), rr(5.9, 6.5), true);
    } else if (rnd() < 0.45) bush(cx + rr(-0.5, 0.5), cz + rr(-0.5, 0.5), rr(0.6, 0.95), 0, false);
  }

  // third and fourth rows: taller, simpler trees whose crowns show above the front ones
  for (const [x, y] of shuffled(soil.filter(([x, y, row]) => (row === 3 || row === 4) && tileAt(x, y) !== '|' && !nearRim(x, y)))) {
    const [cx, cz] = tileCentre(x, y), px = cx + rr(-0.5, 0.5), pz = cz + rr(-0.5, 0.5);
    if (crowded(px, pz, 2.5) || onReserved(px, pz, 1.2)) continue;
    trunks.push([px, pz]);
    broadleaf(px, pz, rr(2.3, 3), rr(6, 7.6), false);
  }

  // beyond: big dark domes, larger and taller the further out. Those on the rim form the wall that closes the horizon;
  // the others stop short of every trunk and two tiles short of the clearing, so the trees stand in front of them.
  const covered = new Uint8Array(GX * GY);
  for (const [x, y, row] of soil) {
    if (row < 4 || covered[cell(x, y)] || (row === 4 && tileAt(x, y) !== '|')) continue;
    const reach = row < 6 ? 1 : 2, [cx, cz] = tileCentre(x, y);
    for (let dy = 0; dy <= reach; dy++) for (let dx = 0; dx <= reach; dx++) if (inBuilt(x + dx, y + dy)) covered[cell(x + dx, y + dy)] = 1;
    const mx = cx + reach * S / 2 + rr(-0.5, 0.5), mz = cz + reach * S / 2 + rr(-0.5, 0.5), room = clearance(mx, mz);
    let radius = (reach + 1) * S * rr(1.15, 1.3);                               // (the lumps shrink a dome to about three quarters of this, so they still overlap)
    if (isRim(x, y)) radius = Math.min(radius, room + LOW_REACH);
    else {
      if (room < 4 * S) radius = Math.min(radius, room - 2 * S);
      for (const t of trunks) radius = Math.min(radius, Math.hypot(t[0] - mx, t[1] - mz) - 0.5);
    }
    // (smooth outlines for those that can show against the sky; the ones buried in the forest make do with fewer faces)
    if (radius > 1.2) farMass(mx, mz, radius, radius, 7.5 + Math.min(row, 9) * rr(0.35, 0.5), row < 6 || isRim(x, y) ? 3 : 2);
  }
  // and one across the far end of each path, so that no sky shows down the corridor
  for (const [n, side] of outs) {
    const [x, y, ax, az] = side === 'north' ? [n, -M + 2, 0, -1] : side === 'south' ? [n, H + M - 3, 0, 1] : side === 'west' ? [-M + 2, n, -1, 0] : [W + M - 3, n, 1, 0];
    const [cx, cz] = tileCentre(x, y);
    farMass(cx + ax * (S / 2 + 2.2), cz + az * (S / 2 + 2.2), ax ? 2.4 : 3.6, ax ? 3.6 : 2.4, 10.5, 3);
  }

  // ---------- meshes ----------
  for (const [key, b] of batches) {
    if (!b.idx.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    if (b.kind !== 'mass') geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    if (b.kind !== 'bark') geo.setAttribute('aWind', new THREE.Float32BufferAttribute(b.wind, 3));
    geo.setIndex(b.idx);
    const mesh = new THREE.Mesh(geo, MATERIAL[b.kind]);
    mesh.name = 'foliage ' + key;
    mesh.castShadow = b.casts; mesh.receiveShadow = false;
    if (b.casts && b.kind !== 'bark') mesh.customDepthMaterial = swayDepth;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }

  return { update(dt, t) { windTime.value = t; } };
}
