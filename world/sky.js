// world/sky.js: sky dome, sunlight, fill and rim lights, fog, shadows and the environment map used for reflections.
// Contract: export function buildSky(c) -> { sun, update(dt, t, focus) }
//   sun    : the THREE.DirectionalLight that casts the shadows
//   update : called every frame; `focus` is a THREE.Vector3 the shadows should be centred on (Anne, or the cut-scene)
//
// Brightness (post.js shows scene values 1:1 up to about 0.5 and rolls off softly above that):
//   a Lambert surface facing up shows about  albedo x 2.5 in full sun  and  albedo x 0.7 in shade.
//   Mid grey (#808080) comes out near sRGB (203, 196, 181) in the sun and (96, 109, 124) in the shade.
//   Unlit colours are shown as they are; values above 1 glow.

export function buildSky(c) {
  const { THREE, scene, renderer, S, W, H, qp } = c;
  const rad = THREE.MathUtils.degToRad;
  const linear = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

  // ---------- the sun: in the north-east (north is -z, east is +x), 50 degrees up ----------
  const SUN_ELEVATION = rad(50), SUN_AZIMUTH = rad(45);
  const SUN_DIR = new THREE.Vector3(Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH), Math.sin(SUN_ELEVATION), -Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH));

  // ---------- lights ----------
  const sun = new THREE.DirectionalLight(linear(1.0, 0.86, 0.61), 8.0);                  // warm key
  // cool sky from above, warm green bounce off the sunlit grass and dirt from below
  const fill = new THREE.HemisphereLight(linear(0.524, 0.704, 1.0), linear(0.50, 0.515, 0.22), 2.25);
  // a cool kicker from behind-left of whatever the camera looks at: it outlines characters. No shadows.
  const rim = new THREE.DirectionalLight(linear(0.72, 0.88, 1.0), 3.0);
  scene.add(sun, sun.target, fill, rim);                  // the sun stays the first directional light

  // ---------- sky colours (scene brightness) and fog ----------
  const SKY_ZENITH = linear(0.47, 1.12, 2.0);
  const SKY_HORIZON = linear(1.55, 2.25, 2.55);
  const SKY_BELOW = linear(0.30, 0.52, 0.34);            // under the horizon: hazy far forest (seen past the edge of the world and in reflections)
  const SUN_GLOW = linear(1.0, 0.90, 0.74);
  const CLOUD_LIT = linear(4.0, 4.0, 3.9), CLOUD_SHADE = linear(0.75, 0.95, 1.3);
  scene.background = SKY_HORIZON;
  scene.fog = new THREE.Fog(SKY_HORIZON, 18, 130);       // aerial perspective: far things fade into the horizon colour

  // ---------- clouds: a 360 degree strip of puffs, painted once ----------
  // Soft white discs are added up; the sky shader cuts the sum at half height, which gives rounded cloud outlines.
  const cloudTex = c.canvasTex(1024, 256, (ctx, w, h) => {
    const { rnd, rr } = c.rng(4242);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1, 2);                                     // the strip is 360 x 45 degrees: in this space a circle stays round on the dome
    const puff = (x, y, r) => {
      for (const wrap of [-w, 0, w]) {                   // the strip joins up with itself left and right
        const g = ctx.createRadialGradient(x + wrap, y, 0, x + wrap, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.55, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + wrap, y, r, 0, Math.PI * 2); ctx.fill();
      }
    };
    const COUNT = 9;
    for (let i = 0; i < COUNT; i++) {
      const cx = (i + rr(0.2, 0.8)) / COUNT * w, base = rr(0.47, 0.82) * h / 2, width = rr(40, 90), height = width * rr(0.22, 0.32);
      const puffs = 12 + Math.floor(rnd() * 8);
      for (let k = 0; k < puffs; k++) {
        const u = rr(-1, 1), lift = rnd() * (1 - u * u);                  // a heap: tallest in the middle
        const r = width * rr(0.10, 0.17) * (1.25 - 0.5 * lift);
        puff(cx + u * width * 0.5, base - r * 0.6 - lift * height, r);    // every puff stands on the same flat base or on the heap
      }
    }
  }, { repeat: true, srgb: false, anisotropy: 1 });
  cloudTex.wrapT = THREE.ClampToEdgeWrapping;

  // ---------- sky dome: a sphere glued to the camera, drawn on the far plane ----------
  const skyUniforms = {
    uZenith: { value: SKY_ZENITH }, uHorizon: { value: SKY_HORIZON }, uBelow: { value: SKY_BELOW },
    uSunDir: { value: SUN_DIR }, uSunGlow: { value: SUN_GLOW },
    uCloudLit: { value: CLOUD_LIT }, uCloudShade: { value: CLOUD_SHADE }, uClouds: { value: cloudTex },
    uDrift: { value: 0 },
    uTreeline: { value: 0 },      // 1 while the reflection map is drawn: adds a dark band of forest around the horizon
  };
  const skyMat = new THREE.ShaderMaterial({
    name: 'sky', uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      varying vec2 vUv;
      void main() {
        vDir = position;
        vUv = uv;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);     // turns with the camera, never moves
        gl_Position = p.xyww;                                                    // depth = 1: behind everything
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uZenith, uHorizon, uBelow, uSunDir, uSunGlow, uCloudLit, uCloudShade;
      uniform sampler2D uClouds;
      uniform float uDrift, uTreeline;
      varying vec3 vDir;
      varying vec2 vUv;
      void main() {
        vec3 dir = normalize(vDir);
        float up = dir.y;

        // gradient: a pale band at the horizon that turns blue quickly
        float t = 1.0 - pow(1.0 - clamp(up, 0.0, 1.0), 2.6);
        vec3 col = mix(uHorizon, uZenith, t);

        // sun: the sky is warmer on its side, a smooth glow, a soft disc
        float side = max(dot(normalize(dir.xz + 1e-5), normalize(uSunDir.xz)), 0.0);
        float away = 1.0 - max(dot(dir, uSunDir), 0.0);
        col += uSunGlow * (0.45 * side * side * (1.0 - t) + 0.8 * exp(-away * 14.0) + 5.0 * exp(-away * 260.0) + 40.0 * (1.0 - smoothstep(0.0003, 0.0008, away)));

        // clouds: the strip covers 0 to 45 degrees of elevation
        vec2 cuv = vec2(vUv.x + uDrift, (vUv.y - 0.5) * 4.0);
        float d = texture2D(uClouds, cuv).r;
        float dUp = texture2D(uClouds, cuv + vec2(0.003, 0.05)).r;                // a step towards the sun
        float edge = max(fwidth(d) * 1.5, 0.035);
        float cover = smoothstep(0.5 - edge, 0.5 + edge, d) * step(0.0, cuv.y) * step(cuv.y, 1.0);
        vec3 cloud = mix(uCloudShade, uCloudLit, clamp(0.55 + (d - dUp) * 2.5, 0.0, 1.0));   // bright where it thins out towards the sun
        cloud = mix(uHorizon, cloud, smoothstep(0.02, 0.20, up));                 // clouds sink into the haze at the horizon
        col = mix(col, cloud, cover);

        // under the horizon, and the ring of forest for reflections
        col = mix(col, uBelow, smoothstep(0.0, -0.10, up));
        col = mix(col, uBelow * 0.55, uTreeline * (1.0 - smoothstep(0.05, 0.22, up)));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  dome.name = 'sky'; dome.frustumCulled = false; dome.renderOrder = 1000;       // drawn after the opaque world: only the visible sky is shaded
  scene.add(dome);

  // ---------- environment map for reflections (eyes, shoes, water): the sky itself plus a ring of forest ----------
  {
    const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(dome.geometry, skyMat));
    skyUniforms.uTreeline.value = 1;
    new THREE.CubeCamera(0.1, 10, cube).update(renderer, envScene);
    skyUniforms.uTreeline.value = 0;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromCubemap(cube.texture).texture;
    scene.environmentIntensity = 0.3;
    pmrem.dispose(); cube.dispose();
  }

  // ---------- shadows ----------
  // One shadow map covering a BOX x BOX metre square around the focus point, seen from the sun.
  // 1536 texels over 28 m = 1.8 cm per texel; the 3 x 3 PCFSoft filter turns that into an edge about 5 cm wide.
  const MAP = c.ultra ? 3072 : 1536, BOX = 28, SUN_DISTANCE = 60, DEPTH = 90;      // (Ultra: twice as fine, 0.9 cm a texel)
  renderer.shadowMap.enabled = !(qp && qp.has('noshadow'));
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true;
  sun.shadow.mapSize.set(MAP, MAP);
  Object.assign(sun.shadow.camera, { left: -BOX / 2, right: BOX / 2, top: BOX / 2, bottom: -BOX / 2, near: 1, far: 1 + DEPTH });
  sun.shadow.bias = -0.015 / DEPTH;                      // 1.5 cm towards the light: no acne, and feet stay attached to their shadows
  sun.shadow.normalBias = 0.02;                          // 2 cm along the surface normal: no acne on surfaces the light only grazes

  // The shadow camera looks along -SUN_DIR. Moving the box in whole shadow-map texels along the camera's own right/up
  // axes keeps every shadow edge on the same texels from frame to frame, so edges do not crawl when the focus moves.
  const lightRight = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, SUN_DIR).normalize();
  const lightUp = new THREE.Vector3().crossVectors(SUN_DIR, lightRight);
  const TEXEL = BOX / MAP;
  const centre = new THREE.Vector3(W * S / 2, 0, H * S / 2);
  // ---------- night: the same sky and lights, turned down and blue (c.night.value: 0 day .. 1 night) ----------
  const DAY = { zen: SKY_ZENITH.clone(), hor: SKY_HORIZON.clone(), below: SKY_BELOW.clone(), glow: SUN_GLOW.clone(), lit: CLOUD_LIT.clone(), shade: CLOUD_SHADE.clone(),
    sun: sun.color.clone(), sunI: sun.intensity, sky: fill.color.clone(), ground: fill.groundColor.clone(), fillI: fill.intensity, rimI: rim.intensity, fog: scene.fog.color.clone() };
  const NIGHT = { zen: linear(0.012, 0.022, 0.07), hor: linear(0.035, 0.07, 0.16), below: linear(0.008, 0.016, 0.022), glow: linear(0.16, 0.2, 0.3), lit: linear(0.22, 0.27, 0.4), shade: linear(0.03, 0.045, 0.09),
    sun: linear(0.5, 0.66, 1.0), sunI: 0.9, sky: linear(0.16, 0.26, 0.55), ground: linear(0.04, 0.07, 0.06), fillI: 0.85, rimI: 0.9, fog: linear(0.02, 0.04, 0.09) };
  let nightNow = 0;
  function applyNight(k) {
    nightNow = k;
    SKY_ZENITH.lerpColors(DAY.zen, NIGHT.zen, k); SKY_HORIZON.lerpColors(DAY.hor, NIGHT.hor, k); SKY_BELOW.lerpColors(DAY.below, NIGHT.below, k);
    SUN_GLOW.lerpColors(DAY.glow, NIGHT.glow, k); CLOUD_LIT.lerpColors(DAY.lit, NIGHT.lit, k); CLOUD_SHADE.lerpColors(DAY.shade, NIGHT.shade, k);
    sun.color.lerpColors(DAY.sun, NIGHT.sun, k); sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * k;
    fill.color.lerpColors(DAY.sky, NIGHT.sky, k); fill.groundColor.lerpColors(DAY.ground, NIGHT.ground, k); fill.intensity = DAY.fillI + (NIGHT.fillI - DAY.fillI) * k;
    rim.intensity = DAY.rimI + (NIGHT.rimI - DAY.rimI) * k;
    scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, k);
    scene.environmentIntensity = 0.3 - 0.24 * k;
  }

  function update(dt, t, focus) {
    if (c.night && c.night.value !== nightNow) applyNight(c.night.value);
    const f = focus || centre;
    const x = Math.round(f.dot(lightRight) / TEXEL) * TEXEL, y = Math.round(f.dot(lightUp) / TEXEL) * TEXEL, z = Math.round(f.dot(SUN_DIR));
    sun.target.position.set(0, 0, 0).addScaledVector(lightRight, x).addScaledVector(lightUp, y).addScaledVector(SUN_DIR, z);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, SUN_DISTANCE);
    sun.target.updateMatrixWorld();
    skyUniforms.uDrift.value = (t * 0.0006) % 1;         // the clouds go once round the sky in half an hour
  }
  update(0, 0, centre);

  // ---------- the rim light follows the camera: always from behind-left of the view, low ----------
  const RIM_SIDE = rad(55), RIM_UP = rad(15);
  const forward = new THREE.Vector3();
  dome.onBeforeRender = (r, s, camera) => {
    camera.getWorldDirection(forward);
    const len = Math.hypot(forward.x, forward.z);
    if (len < 1e-3) return;                              // looking straight up or down: keep the last direction
    const fx = forward.x / len, fz = forward.z / len;    // view direction on the ground; (fz, -fx) is to its left
    const k = Math.cos(RIM_UP);
    rim.position.set((fx * Math.cos(RIM_SIDE) + fz * Math.sin(RIM_SIDE)) * k, Math.sin(RIM_UP), (fz * Math.cos(RIM_SIDE) - fx * Math.sin(RIM_SIDE)) * k);
  };

  return { sun, update };
}
