// world/pond.js: what only the Forest Pond level has (level.name === 'pond'): the water, the lily pads, the boulders
// and rock banks, the waterfall on the north face, the tent and a few camp things. Simple stylised shapes; the ground,
// grass and trees come from terrain.js and foliage.js as in the camp.

export function buildPond(c) {
  const { THREE, scene, level, S, W, H, tileAt } = c, { rnd, rr } = c.rng(2002);
  const time = { value: 0 }, sunDir = new THREE.Vector3(14, 26, -18).normalize();
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sunDir.subVectors(o.position, o.target.position).normalize(); });
  const lit = (r, g, b) => new THREE.Color().setRGB(r, g, b);
  const group = new THREE.Group(); group.name = 'Pond'; scene.add(group);

  // ---------- water: one sheet under the whole map; the ground hides it everywhere but in the pond's dip ----------
  // (10-02: "more realistic"): rippled by layered drifting noise; the sky in it at grazing angles; dark where it is deep,
  // clearer and greener at the bank, with a thin broken line of foam along it; the sun's glint. How far a point is from
  // the bank comes from the map: a small texture, 1 deep in the middle of the water .. 0 on land (blurred tiles).
  const SH = 3, sw = W * SH, sh = H * SH;
  let field = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) field[y * sw + x] = tileAt(Math.floor(x / SH), Math.floor(y / SH)) === '~' ? 1 : 0;
  const wet = field.slice();
  for (let pass = 0; pass < 4; pass++) {             // (a few box blurs: the value falls off towards the bank)
    const out = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let a = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; a += xx < 0 || yy < 0 || xx >= sw || yy >= sh ? 1 : field[yy * sw + xx]; n++; }      // (off the map counts as water)
      out[y * sw + x] = a / n;
    }
    field = out;
  }
  const shoreData = new Uint8Array(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) { const v = wet[i] ? Math.max(0, Math.min(1, (field[i] - 0.45) / 0.55)) : 0; shoreData[i * 4] = Math.round(v * 255); shoreData[i * 4 + 3] = 255; }
  const shoreTex = new THREE.DataTexture(shoreData, sw, sh, THREE.RGBAFormat); shoreTex.magFilter = shoreTex.minFilter = THREE.LinearFilter; shoreTex.needsUpdate = true;
  const night = c.night || { value: 0 };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: time, uSun: { value: sunDir }, uShore: { value: shoreTex }, uMap: { value: new THREE.Vector2(W * S, H * S) }, uNight: night },
    vertexShader: /* glsl */ `varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight; uniform vec3 uSun; uniform sampler2D uShore; uniform vec2 uMap; varying vec3 vWorld;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y ); }
      float waves( vec2 p ) {                           // four layers of ripples, each drifting its own way
        float t = uTime;
        return noise( p * 1.1 + vec2( t * 0.22, t * 0.15 ) ) * 0.5 + noise( p * 2.6 - vec2( t * 0.30, -t * 0.21 ) ) * 0.25
             + noise( p * 5.7 + vec2( -t * 0.46, t * 0.37 ) ) * 0.13 + noise( p * 12.5 + vec2( t * 0.75, t * 0.6 ) ) * 0.06;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.04, h0 = waves( p ), hx = waves( p + vec2( e, 0.0 ) ), hz = waves( p + vec2( 0.0, e ) );
        vec3 n = normalize( vec3( ( h0 - hx ) / e * 0.09, 1.0, ( h0 - hz ) / e * 0.09 ) );
        vec3 v = normalize( cameraPosition - vWorld );
        float deep = texture2D( uShore, p / uMap ).r;   // 1 out in the middle .. 0 at the bank
        float fres = 0.03 + 0.97 * pow( 1.0 - max( dot( n, v ), 0.0 ), 5.0 );
        vec3 r = reflect( -v, n );
        vec3 sky = mix( vec3( 0.34, 0.48, 0.48 ), vec3( 0.13, 0.30, 0.50 ), clamp( r.y * 1.4, 0.0, 1.0 ) ) * ( 1.0 - 0.78 * uNight );      // (the forest's sky: canopy-green at the horizon)
        vec3 body = mix( vec3( 0.07, 0.22, 0.17 ), vec3( 0.01, 0.06, 0.08 ), smoothstep( 0.0, 0.7, deep ) ) * ( 1.0 - 0.6 * uNight );
        vec3 col = mix( body, sky, min( 1.0, fres * 0.85 + 0.05 ) );
        float sd = max( dot( reflect( -uSun, n ), v ), 0.0 );
        col += vec3( 1.0, 0.95, 0.84 ) * ( pow( sd, 240.0 ) * 2.6 + pow( sd, 22.0 ) * 0.10 ) * ( 1.0 - 0.85 * uNight );
        float foam = ( 1.0 - smoothstep( 0.02, 0.09, deep ) ) * smoothstep( 0.55, 0.8, noise( p * 7.5 + vec2( uTime * 0.35, -uTime * 0.2 ) ) );
        col = mix( col, vec3( 0.80, 0.86, 0.86 ) * ( 1.0 - 0.6 * uNight ), foam * 0.32 );
        float alpha = mix( 0.72, 0.96, smoothstep( 0.0, 0.5, deep ) ) + fres * 0.15 + foam * 0.2;
        gl_FragColor = vec4( col, clamp( alpha, 0.0, 1.0 ) );
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(W * S / 2, -0.12, H * S / 2); water.renderOrder = 2; group.add(water);

  // ---------- lily pads (some in flower) ----------
  const pads = level.objects.lily || [];
  if (pads.length) {
    const padGeo = new THREE.CircleGeometry(1, 16, 0.3, Math.PI * 2 - 0.55); padGeo.rotateX(-Math.PI / 2);
    const padMesh = new THREE.InstancedMesh(padGeo, new THREE.MeshLambertMaterial({ color: lit(0.07, 0.2, 0.05), side: THREE.DoubleSide }), pads.length * 2);
    const bloom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: lit(0.42, 0.1, 0.2) }), pads.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0, nb = 0;
    for (const [x, y] of pads) {
      for (let k = 0; k < 2; k++) {
        const r = k ? rr(0.2, 0.3) : rr(0.36, 0.48), px = (x + 0.5) * S + (k ? rr(-0.5, 0.5) : rr(-0.15, 0.15)), pz = (y + 0.5) * S + (k ? rr(-0.5, 0.5) : rr(-0.15, 0.15));
        padMesh.setMatrixAt(n++, m.compose(v.set(px, -0.105 + k * 0.003, pz), q.setFromAxisAngle(up, rr(0, 6.28)), s.set(r, 1, r)));
        if (!k && rnd() < 0.4) bloom.setMatrixAt(nb++, m.compose(v.set(px + rr(-0.08, 0.08), -0.04, pz + rr(-0.08, 0.08)), q.identity(), s.set(0.1, 0.075, 0.1)));
      }
    }
    padMesh.count = n; bloom.count = nb; padMesh.receiveShadow = true; group.add(padMesh, bloom);
  }

  // ---------- rock: boulders in the meadow and the water, banks where the map has cliff faces, a tall face in the north ----------
  const pos = [], col = [], ico = new THREE.IcosahedronGeometry(1, 2), ip = ico.attributes.position, p = new THREE.Vector3();
  const GREY = [0.2, 0.19, 0.18], MOSS = [0.08, 0.17, 0.05];
  function boulder(x, y, z, sx, sy, sz, moss) {
    const yaw = rr(0, 6.28), cs = Math.cos(yaw), sn = Math.sin(yaw), tone = rr(0.8, 1.15);
    for (let i = 0; i < ip.count; i++) {
      p.fromBufferAttribute(ip, i);
      const bump = 0.8 + 0.34 * c.fbm2(p.x * 1.7 + x * 3.1 + 40, p.y * 1.7 + p.z * 1.3 + z * 2.7 + 40, 2);
      p.multiplyScalar(bump); if (p.y > 0.55) p.y = 0.55 + (p.y - 0.55) * 0.35;                  // a flattish top
      const lx = p.x * sx, lz = p.z * sz, top = Math.max(0, p.y) * moss;
      pos.push(x + lx * cs - lz * sn, y + p.y * sy, z + lx * sn + lz * cs);
      const k = Math.min(1, top * 1.6) * (0.6 + 0.4 * c.noise2(p.x * 3 + x, p.z * 3 + z));
      for (let j = 0; j < 3; j++) col.push((GREY[j] * (1 - k) + MOSS[j] * k) * tone);
    }
  }
  const gy = (x, y) => (c.buildHeightAt ? c.buildHeightAt((x + 0.5) * S, (y + 0.5) * S) : 0);      // (10-12: on a ledge's top, if its tile is raised)
  for (const [x, y] of level.objects.rock || []) boulder((x + 0.5) * S, gy(x, y) + 0.12, (y + 0.5) * S, rr(0.5, 0.62), rr(0.5, 0.7), rr(0.45, 0.58), 0.5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tileAt(x, y) !== 'r') continue;
    const north = level.name === 'pond' && y <= 6, h = north ? rr(3.0, 3.8) : rr(1.1, 1.7);
    boulder((x + 0.5) * S + rr(-0.15, 0.15), gy(x, y) + h * 0.3, (y + 0.5) * S + rr(-0.15, 0.15), S * rr(0.66, 0.78), h, S * rr(0.66, 0.78), 1);
  }
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); rockGeo.computeVertexNormals();
  const rocks = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); rocks.castShadow = rocks.receiveShadow = true; rocks.name = 'Pond rocks'; group.add(rocks);

  // ---------- the waterfall: a streaked sheet down the north face, foam where it lands ----------
  if (level.waterfall) {
    const [fx, fy] = level.waterfall, wide = 2.6 * S, high = 3.5, z = fy * S + 0.5;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(wide, high, 1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: time },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        float h( float x ) { return fract( sin( x * 127.1 ) * 43758.5453 ); }
        void main() {
          float lane = floor( vUv.x * 34.0 ), fx = fract( vUv.x * 34.0 );
          float run = fract( vUv.y * ( 0.7 + h( lane ) ) + uTime * ( 0.55 + 0.5 * h( lane + 9.0 ) ) + h( lane + 3.0 ) );
          float streak = smoothstep( 0.0, 0.35, run ) * smoothstep( 1.0, 0.55, run ) * smoothstep( 0.0, 0.3, fx ) * smoothstep( 1.0, 0.7, fx );
          float edge = smoothstep( 0.0, 0.08, vUv.x ) * smoothstep( 1.0, 0.92, vUv.x );
          vec3 col = mix( vec3( 0.35, 0.62, 0.8 ), vec3( 1.5, 1.6, 1.7 ), 0.35 + 0.65 * streak );
          gl_FragColor = vec4( col, edge * ( 0.72 + 0.26 * streak ) * smoothstep( 0.0, 0.06, vUv.y ) );
        }`,
    }));
    fall.position.set((fx + 0.5) * S, high / 2 - 0.12, z); fall.renderOrder = 3; group.add(fall);
    const foam = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: time },
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vP; void main() { float r = length( vP ); float ring = 0.5 + 0.5 * sin( r * 16.0 - uTime * 5.0 ); gl_FragColor = vec4( vec3( 1.5 ), ( 1.0 - r ) * ( 0.35 + 0.5 * ring ) ); }`,
    }));
    foam.rotation.x = -Math.PI / 2; foam.scale.set(wide * 0.6, 1.5, 1); foam.position.set((fx + 0.5) * S, -0.1, z + 0.7); foam.renderOrder = 3; group.add(foam);
  }

  // ---------- the tent, and the odds and ends of the camp on the island ----------
  const solid = (geo, color, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  if (level.tent) {
    const t = c.tc(...level.tent), w = 1.75, d = 1.9, h = 2.3, g = new THREE.BufferGeometry();
    const A = [-w, 0, -d], B = [w, 0, -d], Cc = [w, 0, d], D = [-w, 0, d], R0 = [0, h, -d * 0.86], R1 = [0, h, d * 0.86];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...D, ...R1, ...A, ...R1, ...R0, ...B, ...R1, ...Cc, ...B, ...R0, ...R1, ...A, ...R0, ...B, ...D, ...Cc, ...R1], 3)); g.computeVertexNormals();
    solid(g, lit(0.4, 0.37, 0.3), t.x, 0, t.z);
    c.camBlockers.push({ x: t.x, y: 0.9, z: t.z, r: 2.3, ry: 1.7 });
    const door = new THREE.BufferGeometry(); door.setAttribute('position', new THREE.Float32BufferAttribute([-0.62, 0, 0, 0.62, 0, 0, 0, 1.55, -0.14], 3)); door.computeVertexNormals();
    solid(door, lit(0.03, 0.02, 0.02), t.x, 0.01, t.z + d + 0.03);
  }
  const o = level.objects;
  for (const [x, y] of o.stump || []) solid(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 12), lit(0.2, 0.12, 0.06), (x + 0.5) * S, 0.2, (y + 0.5) * S);
  for (const [x, y] of o.barrel || []) solid(new THREE.CylinderGeometry(0.3, 0.27, 0.8, 14), lit(0.22, 0.1, 0.05), (x + 0.5) * S, 0.4, (y + 0.5) * S);
  for (const [x, y] of o.totem || []) { solid(new THREE.BoxGeometry(0.55, 1.7, 0.5), lit(0.3, 0.14, 0.05), (x + 0.5) * S, 0.85, (y + 0.5) * S, 0.1); solid(new THREE.BoxGeometry(0.7, 0.14, 0.56), lit(0.16, 0.07, 0.03), (x + 0.5) * S, 1.0, (y + 0.5) * S, 0.1); }

  // ---------- plank bridges over the water (the map's bridge tiles are causeways in the ground: these lie on top) ----------
  const planks = level.objects.bridge || [];
  if (planks.length) {
    const wood = new THREE.MeshLambertMaterial({ color: lit(0.2, 0.11, 0.05) }), rail = new THREE.MeshLambertMaterial({ color: lit(0.12, 0.065, 0.03) });
    const isB = (x, y) => planks.some(([a, b]) => a === x && b === y), geo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(geo, wood, planks.length * 6), posts = new THREE.InstancedMesh(geo, rail, planks.length * 4);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0, np = 0;
    for (const [x, y] of planks) {
      const alongX = isB(x - 1, y) || isB(x + 1, y) || !(isB(x, y - 1) || isB(x, y + 1)) && tileAt(x, y - 1) === '~';      // the bridge runs east-west when its neighbours do, or when water lies north of it
      for (let k = 0; k < 6; k++) {              // six planks across each tile, a little uneven
        const o = (k + 0.5) / 6 * S - S / 2;
        v.set((x + 0.5) * S + (alongX ? o : 0), 0.045 + 0.008 * Math.sin(k * 2.3 + x), (y + 0.5) * S + (alongX ? 0 : o));
        s.set(alongX ? S / 6 - 0.03 : S * 0.86, 0.05, alongX ? S * 0.86 : S / 6 - 0.03);
        inst.setMatrixAt(n++, m.compose(v, q.setFromAxisAngle(up, 0.03 * Math.sin(k * 5.1 + y)), s));
      }
      for (const side of [-1, 1]) for (const e of [-1, 1]) {      // a post at each corner of the span's ends
        const endHere = alongX ? !isB(x + e, y) : !isB(x, y + e);
        if (!endHere) continue;
        v.set((x + 0.5) * S + (alongX ? e * S * 0.46 : side * S * 0.43), 0.3, (y + 0.5) * S + (alongX ? side * S * 0.43 : e * S * 0.46));
        posts.setMatrixAt(np++, m.compose(v, q.identity(), s.set(0.09, 0.6, 0.09)));
      }
    }
    inst.count = n; posts.count = np; inst.castShadow = inst.receiveShadow = posts.castShadow = true; group.add(inst, posts);
  }

  return { update(dt, t) { time.value = t; } };
}
