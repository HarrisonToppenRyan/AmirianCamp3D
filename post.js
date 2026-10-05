// post.js: how a frame gets drawn to the screen, and at what resolution.
// Contract: export function createPost({ THREE, renderer, scene, camera, qp }) -> api
//   api.render(dt)             draw one frame
//   api.setSize(w, h)          the window changed size (CSS pixels)
//   api.frameTime(ms)          called every frame with the time since the previous frame; lets the module adapt resolution/quality
//   api.warm()                 async: compile everything it needs (called once behind the start screen)
//   api.setFocus(point|null, strength = 1)   a THREE.Vector3 the cut-scene wants in sharp focus (null = no depth of field);
//                              strength > 1 blurs what is out of focus more (a shallower depth of field, for close-ups)
//   api.setCloseUp(mode)       'off' | 'ready' | 'on': a cut-scene's close-up shots are drawn at (nearly) the screen's own resolution
//   api.info()                 { dpr, quality, tier, pixels } for the perf report
//
// Resolution policy: a Retina screen has ~5.6 million pixels at full size. Drawing the 3D scene at that size costs more
// than a 60 fps frame allows on an M-series laptop, so the scene is drawn at a pixel budget and scaled up by the browser.
// The text and dialogue boxes are HTML, so they stay sharp.
//
// A frame:
//   1. the scene is drawn into an HDR target with 4x MSAA: scene brightness, nothing clipped, no tone mapping;
//   2. bloom: what is brighter than a sunlit white surface (fire, sky, highlights) is blurred at 1/8 and 1/32 size;
//   3. depth of field (only while a focus point is set): a blurred 1/4-size copy of the frame, guided by the depth buffer;
//   4. one final pass draws the canvas: depth of field, bloom, vignette, the film curve, sRGB.
// When frames stay slow at the lowest resolution, effects are dropped tier by tier (TIERS below).
//
// URL flags: post=off (draw straight to the canvas with the film curve only: the baseline for cost comparisons),
// tier=0..4 (start at that quality tier), focus=x,y,z (pin the depth-of-field focus to a world point, for testing),
// and for resolution experiments dpr, pixels, noadapt, hipixels, hisamples, nocloseup.

// The film curve, used by the final pass and by post=off. Scene brightness in, display brightness (linear, 0..1) out.
// Up to about 0.5 it is nearly 1:1 (plus a little contrast and saturation); above that the brightest channel is
// compressed smoothly towards 1, so colours keep their hue instead of clipping, and very bright things drift to white.
const FILM_GLSL = /* glsl */`
  vec3 film(vec3 c) {
    c = max(c, 0.0);
    c = 0.18 * pow(c / 0.18, vec3(1.10));                                        // gentle S-curve around mid grey
    c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.04);                 // a little extra saturation
    c = max(c * vec3(1.03, 1.0, 0.955), 0.0);                                     // slightly warm
    float peak = max(c.r, max(c.g, c.b));
    if (peak > 0.5) {
      float shoulder = 1.0 - 0.25 / peak;                                         // continues y = x smoothly from 0.5 towards 1
      vec3 keptHue = c * (shoulder / peak);
      vec3 perChannel = mix(c, 1.0 - 0.25 / max(c, 0.5), step(0.5, c));           // every channel on the shoulder: orange -> yellow -> white
      c = mix(keptHue, perChannel, 1.0 - 1.0 / (0.12 * (peak - shoulder) + 1.0));    // only far above 1 (fire, sun) does the hue give way
    }
    return c;
  }`;

export function createPost({ THREE, renderer, scene, camera, qp, ultra = false }) {
  // ---------- resolution ----------
  const PIXEL_BUDGET = +(qp.get('pixels') || (ultra ? 9e6 : 2.6e6));       // High: about 2040 x 1275; Ultra: the screen's own pixels (Retina at most), adaptive scaling below
  const fixedDpr = qp.has('dpr') ? +qp.get('dpr') : 0;
  const native = Math.min(window.devicePixelRatio || 1, 2);
  let w = innerWidth, h = innerHeight, dpr = 1, scale = 1;       // scale: adaptive factor on top of the budget (1 = full budget)
  const budgetDpr = () => Math.min(native, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h)));
  // A cut-scene can ask for a close-up (setCloseUp). With a close-up budget (HI_BUDGET), the canvas is at up to that many
  // pixels while the scene lasts and the shots that ask for it are drawn at that size; everything else is still drawn
  // at the pixel budget and scaled up by the final pass, so only the close-up shot has to afford the extra pixels.
  // Measured on the M3 MacBook Air: at 4.3 million pixels the close-up runs at 47 fps (53 with 2x MSAA); the most it
  // holds at 60 is 3.2 million with 2x MSAA, which looks no better than the budget with 4x. So this is OFF unless the
  // address asks for it (?hipixels=4.3e6&hisamples=2, for a faster machine). What a close-up always gets is SHARPEN.
  const HI_BUDGET = +(qp.get('hipixels') || (ultra ? 9e6 : 0)), HI_SAMPLES = +(qp.get('hisamples') || 4);      // (Ultra: close-ups at the screen's own pixels too, falling back if they cannot hold the frame rate)
  const SHARPEN = qp.has('sharp') ? +qp.get('sharp') : 0.7;
  let closeUp = 'off', hi = null, hiBlocked = false, hiAvg = 16.7, hiSlow = 0, warmHi = 0;
  const stdDpr = () => fixedDpr || Math.max(0.75, +(budgetDpr() * scale).toFixed(3));
  const hiDpr = () => (HI_BUDGET ? Math.max(stdDpr(), +Math.min(native, Math.sqrt(HI_BUDGET / Math.max(1, w * h))).toFixed(3)) : stdDpr());

  // HDR targets need EXT_color_buffer_float. Without it, or with post=off, the scene goes straight to the canvas.
  const gl = renderer.getContext();
  const direct = qp.get('post') === 'off' || !renderer.extensions.has('EXT_color_buffer_float');

  // ---------- quality tiers: what is dropped, in this order, when the lowest resolution is still too slow ----------
  const TIERS = [
    { samples: 4, bloom: true, dof: true },
    { samples: 4, bloom: true, dof: false },
    { samples: 4, bloom: false, dof: false },
    { samples: 2, bloom: false, dof: false },
    { samples: 0, bloom: false, dof: false },
  ];
  const lastTier = direct ? 0 : TIERS.length - 1;
  let tier = Math.min(lastTier, Math.max(0, Math.floor(+qp.get('tier') || 0)));

  function apply() {
    dpr = closeUp !== 'off' && hi ? hiDpr() : stdDpr();
    renderer.setPixelRatio(dpr); renderer.setSize(w, h);
    if (!direct) sizeTargets();
  }

  // adaptive quality: lower the resolution first, then drop effects; recover slowly when there is headroom
  let avg = 16.7, hold = 2500, backoff = 8000;
  function frameTime(ms) {
    if (ms > 250) return;                                   // a one-off stall (tab switch, load)
    if (closeUp !== 'off' && hi) {                          // with a close-up set, nothing is resized in mid-scene; but a close-up
      if (closeUp === 'on' && !hiBlocked) {                 // that cannot hold 60 fps at the higher resolution falls back to the standard one
        hiAvg += (ms - hiAvg) * 0.08;
        if (hiAvg <= 20.5) hiSlow = 0; else if (++hiSlow > 40 && !qp.has('noadapt')) hiBlocked = true;
      }
      return;
    }
    if (fixedDpr || qp.has('noadapt')) return;              // fixed by the URL
    avg += (ms - avg) * 0.06; hold -= ms;
    if (hold > 0) return;
    if (avg > 21 && (scale > 0.6 || tier < lastTier)) {
      if (scale > 0.6) scale = Math.round(scale * 10 - 1) / 10; else tier++;
      backoff = Math.min(60000, backoff * 2); hold = 2500;
    } else if (avg < 17.4 && (tier > 0 || scale < 1)) {
      if (tier > 0) tier--; else scale = Math.round(scale * 10 + 1) / 10;
      hold = backoff;
    } else { hold = 1000; return; }
    avg = 16.7; apply();
  }
  const setSize = (nw, nh) => { w = nw; h = nh; apply(); };
  const pixels = () => Math.round(w * dpr) * Math.round(h * dpr);

  // ---------- the direct path: no targets, no passes; the film curve moves into the materials ----------
  if (direct) {
    THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(      // three's hook for a custom tone mapping function
      'vec3 CustomToneMapping( vec3 color ) { return color; }', FILM_GLSL + '\nvec3 CustomToneMapping( vec3 color ) { return film( color ); }');
    renderer.toneMapping = THREE.CustomToneMapping;
    apply();
    return {
      render() { renderer.render(scene, camera); },
      setSize, frameTime,
      async warm() {},
      setFocus() {}, setCloseUp() {},
      info: () => ({ dpr, quality: 'direct, no effects', tier: -1, pixels: pixels() }),
    };
  }

  // Materials write scene brightness; the final pass applies the film curve and sRGB. With these two settings the
  // programs the page compiles for the canvas are the very ones used when drawing into the HDR target.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  // ---------- render targets ----------
  // R11F_G11F_B10F holds HDR colour in 4 bytes per pixel, half of RGBA16F. With 4 samples per pixel the cost of the
  // scene pass is mostly the memory it moves, so this is the cheaper format by a wide margin.
  const hdrTarget = (options) => new THREE.WebGLRenderTarget(1, 1, { format: THREE.RGBFormat, type: THREE.HalfFloatType, internalFormat: 'R11F_G11F_B10F', depthBuffer: false, ...options });
  // A target set: the HDR scene target (with depth), two bloom targets (1/8 and 1/32 of the frame) and two depth-of-field
  // targets (1/4: colour + blur size in alpha). The standard set always exists; the close-up set only while asked for.
  const makeSet = () => ({
    scene: hdrTarget({ depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1), resolveDepthBuffer: false }),
    bloom: [hdrTarget(), hdrTarget()],
    dof: [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false })),
  });
  const disposeSet = (set) => { set.scene.depthTexture.dispose(); set.scene.dispose(); for (const t of set.bloom) t.dispose(); for (const t of set.dof) t.dispose(); };
  const std = makeSet();
  const maxSamples = Math.max(0, ...(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES) || []));
  const bufferSize = new THREE.Vector2(), ONE = new THREE.Vector2(1, 1);
  function sizeSet(set, x, y, samples) {
    samples = Math.min(maxSamples, samples);
    if (set.scene.samples !== samples) { set.scene.samples = samples; set.scene.dispose(); }      // its buffers are rebuilt with the new sample count
    set.scene.setSize(x, y);
    for (const rt of set.dof) rt.setSize(Math.ceil(x / 4), Math.ceil(y / 4));
    set.bloom[0].setSize(Math.ceil(x / 8), Math.ceil(y / 8));
    set.bloom[1].setSize(Math.ceil(x / 32), Math.ceil(y / 32));
  }
  function sizeTargets() {
    renderer.getDrawingBufferSize(bufferSize).max(ONE);            // never 0 x 0 (a collapsed window)
    if (closeUp === 'off' || !hi) { sizeSet(std, bufferSize.x, bufferSize.y, TIERS[tier].samples); return; }
    const b = stdDpr();                                            // close-up mode: the canvas is larger than the standard set
    sizeSet(std, Math.max(1, Math.round(w * b)), Math.max(1, Math.round(h * b)), TIERS[tier].samples);
    sizeSet(hi, bufferSize.x, bufferSize.y, HI_SAMPLES);
  }
  apply();

  // ---------- full-screen passes ----------
  const VERT = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const pass = (name, uniforms, fragmentShader, options) => new THREE.ShaderMaterial({ name, uniforms, vertexShader: VERT, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...options });

  // bloom, step 1: keep what is brighter than the threshold, at 1/8 size (each of the 16 taps averages 2 x 2 pixels)
  const BLOOM_THRESHOLD = 2.0, BLOOM_KNEE = 1.0, BLOOM_STRENGTH = 0.35, BLOOM_WIDE = 0.6;
  const brightMat = pass('bloom bright', { tScene: { value: null }, uTexel: { value: new THREE.Vector2() } }, /* glsl */`
    uniform sampler2D tScene;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 16; i++) {
        vec2 offset = vec2(float(i % 4), float(i / 4)) * 2.0 - 3.0;
        vec3 c = min(texture2D(tScene, vUv + offset * uTexel).rgb, 64.0);
        float peak = max(c.r, max(c.g, c.b));
        float knee = clamp(peak - ${(BLOOM_THRESHOLD - BLOOM_KNEE).toFixed(3)}, 0.0, ${(2 * BLOOM_KNEE).toFixed(3)});
        float over = max(knee * knee / ${(4 * BLOOM_KNEE).toFixed(3)}, peak - ${BLOOM_THRESHOLD.toFixed(3)});       // soft start below the threshold
        sum += vec4(c * (over / max(peak, 1e-4)), 1.0) / (1.0 + peak);         // weighted down when very bright: a spark must not flicker as it moves
      }
      gl_FragColor = vec4(sum.rgb / sum.a, 1.0);
    }`);
  // bloom, steps 2 and 3: a wide halo at 1/32 size, blended back into the 1/8 level
  const BLUR_FRAG = /* glsl */`
    uniform sampler2D tSrc;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
      vec3 sum = texture2D(tSrc, vUv + uStep).rgb + texture2D(tSrc, vUv - uStep).rgb
               + texture2D(tSrc, vUv + vec2(uStep.x, -uStep.y)).rgb + texture2D(tSrc, vUv + vec2(-uStep.x, uStep.y)).rgb;
      gl_FragColor = vec4(sum * 0.25, ${BLOOM_WIDE.toFixed(2)});              // alpha: the share of the wide halo in the result
    }`;
  const blurUniforms = () => ({ tSrc: { value: null }, uStep: { value: new THREE.Vector2() } });
  const downMat = pass('bloom down', blurUniforms(), BLUR_FRAG);
  const upMat = pass('bloom up', blurUniforms(), BLUR_FRAG, { transparent: true });

  // depth of field, step 1: a 1/4-size copy of the frame in which every pixel knows how blurred it is
  // (alpha, signed: negative in front of the sharp zone, positive behind it)
  const lens = new THREE.Vector4(1, 0, 0.1, 200);         // focus distance (m), strength 0..1, camera near, camera far
  const LENS_GLSL = /* glsl */`
    uniform vec4 uLens;
    float blurAt(float depth) {                          // -1 (near, fully blurred) .. 0 (sharp) .. 1 (far, fully blurred)
      float z = uLens.z * uLens.w / (uLens.w - depth * (uLens.w - uLens.z));              // depth buffer -> metres
      float x = 1.0 - uLens.x / z;
      return clamp(sign(x) * max(abs(x) - 0.22, 0.0) * 2.5 * uLens.y, -1.0, 1.0);        // sharp from 0.8 x to 1.3 x the focus distance
    }`;
  const dofDownMat = pass('dof down', { tScene: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uLens: { value: lens } }, LENS_GLSL + /* glsl */`
    uniform sampler2D tScene, tDepth;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      vec4 sum = vec4(0.0);
      float blur = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + uTexel * vec2(i < 2 ? -1.0 : 1.0, i == 0 || i == 2 ? -1.0 : 1.0);
        float b = blurAt(texture2D(tDepth, uv).x);
        vec3 c = min(texture2D(tScene, uv).rgb, 64.0);
        // blurred pixels win, so a sharp object does not leak into the blur behind it; very bright pixels count for
        // less, so a highlight melts into the blur instead of showing the sampling pattern as a ring of dots
        sum += vec4(c, 1.0) * ((abs(b) + 0.001) / (1.0 + max(c.r, max(c.g, c.b))));
        if (abs(b) > abs(blur)) blur = b;
      }
      gl_FragColor = vec4(sum.rgb / sum.a, blur);
    }`);
  // depth of field, step 2: every pixel collects the pixels whose blur disc reaches it
  const DOF_TAPS = 48, DOF_RADIUS = 0.022;                // largest blur disc: 2.2% of the frame height (48 taps: no dotted rings round a blurred edge)
  const sunflower = Array.from({ length: DOF_TAPS }, (_, i) => {         // an even spread of points over a disc: x, y, distance from the centre
    const r = Math.sqrt((i + 0.5) / DOF_TAPS), a = i * 2.39996;
    return `vec3(${(Math.cos(a) * r).toFixed(4)}, ${(Math.sin(a) * r).toFixed(4)}, ${r.toFixed(4)})`;
  });
  const dofBlurMat = pass('dof blur', { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxRadius: { value: 1 } }, /* glsl */`
    uniform sampler2D tSrc;
    uniform vec2 uTexel;
    uniform float uMaxRadius;                            // the largest blur disc, in texels
    varying vec2 vUv;
    const vec3 TAPS[${DOF_TAPS}] = vec3[${DOF_TAPS}](${sunflower.join(', ')});
    void main() {
      vec4 centre = texture2D(tSrc, vUv);
      float centreSize = abs(centre.a) * uMaxRadius;
      // A pixel behind this one cannot spread over it: its disc counts only up to twice ours. A sharp pixel takes
      // everything instead: the final pass never shows it, but its blurred neighbours are interpolated with it and
      // must not pick up the sharp colour.
      bool sharp = centreSize < 0.3;
      float limit = sharp ? uMaxRadius : centreSize * 2.0;
      vec4 sum = vec4(centre.rgb, 1.0) * ((sharp ? 0.001 : 1.0) / (1.0 + max(centre.r, max(centre.g, centre.b))));
      for (int i = 0; i < ${DOF_TAPS}; i++) {
        vec4 tap = texture2D(tSrc, vUv + TAPS[i].xy * uMaxRadius * uTexel);
        float size = abs(tap.a) * uMaxRadius;
        if (tap.a > centre.a) size = min(size, limit);
        float reach = clamp(size - TAPS[i].z * uMaxRadius + 0.5, 0.0, 1.0);                  // this pixel's disc covers us
        sum += vec4(tap.rgb, 1.0) * (reach / (1.0 + max(tap.r, max(tap.g, tap.b))));
      }
      gl_FragColor = vec4(sum.rgb / sum.a, 1.0);
    }`);

  // the final pass
  const finalUniforms = {
    tScene: { value: null }, tBloom: { value: null }, tDof: { value: null }, tDepth: { value: null },
    uBloom: { value: 0 }, uBloomStep: { value: new THREE.Vector2() }, uLens: { value: lens }, uAspect: { value: 1 },
    uSharp: { value: 0 }, uSceneTexel: { value: new THREE.Vector2() },
    uGrade: { value: new THREE.Vector4(1, 1, 1, 0) }, uExpo: { value: 1 },      // an area's colour grade (setGrade): rgb gains, greyness; and its exposure
  };
  const finalMat = pass('final', finalUniforms, FILM_GLSL + LENS_GLSL + /* glsl */`
    uniform sampler2D tScene, tBloom, tDof, tDepth;
    uniform float uBloom, uAspect, uSharp, uExpo;
    uniform vec2 uBloomStep, uSceneTexel;
    uniform vec4 uGrade;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb;
      if (uSharp > 0.0) {                                // close-ups: steeper edges and detail in what is in focus, never
        vec3 n = texture2D(tScene, vUv + vec2(0.0, uSceneTexel.y)).rgb, s = texture2D(tScene, vUv - vec2(0.0, uSceneTexel.y)).rgb;   // beyond
        vec3 e = texture2D(tScene, vUv + vec2(uSceneTexel.x, 0.0)).rgb, w = texture2D(tScene, vUv - vec2(uSceneTexel.x, 0.0)).rgb;   // the neighbours' range (no halos)
        c = clamp(c + uSharp * (c - 0.25 * (n + s + e + w)), min(c, min(min(n, s), min(e, w))), max(c, max(max(n, s), max(e, w))));
      }
      if (uLens.y > 0.0) c = mix(c, texture2D(tDof, vUv).rgb, smoothstep(0.03, 0.14, abs(blurAt(texture2D(tDepth, vUv).x))));
      if (uBloom > 0.0) {
        vec3 glow = texture2D(tBloom, vUv + uBloomStep).rgb + texture2D(tBloom, vUv - uBloomStep).rgb
                  + texture2D(tBloom, vUv + vec2(uBloomStep.x, -uBloomStep.y)).rgb + texture2D(tBloom, vUv + vec2(-uBloomStep.x, uBloomStep.y)).rgb;
        c += glow * (0.25 * uBloom);
      }
      c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), uGrade.w) * uGrade.rgb * uExpo;        // the area's grade (the 2D's screen tint)
      vec2 q = (vUv - 0.5) * vec2(mix(1.0, uAspect, 0.5), 1.0);
      c *= 1.0 - 0.30 * smoothstep(0.45, 1.25, length(q) * 1.25);                                   // vignette
      c = film(c);
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));              // linear -> sRGB
      c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;   // dither: no banding in the sky
      gl_FragColor = vec4(c, 1.0);
    }`);

  const tri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)), finalMat);
  tri.frustumCulled = false;
  const triCam = new THREE.Camera();
  function draw(material, target, clear = true) {
    tri.material = material;
    renderer.autoClear = clear;
    renderer.setRenderTarget(target);
    renderer.render(tri, triCam);
  }

  // ---------- an inset: a second, small picture drawn over a corner of the frame (10-04, footplay.js: her face in a corner
  // all the time her soles are played with, as he asked, instead of cuts to it). Only what is on layer 1 is drawn into it
  // (setInset puts its subject and the lights there), on a plain backdrop; it goes through the frame's own grade, film
  // curve and sRGB, without bloom, depth of field or vignette, and uses the frame's shadow maps as they are.
  // o: { camera (its layers set to 1), subject, x, y, w, h (CSS pixels from the canvas's bottom left), r (corner radius) }
  let inset = null, insetSubject = null;
  const INSET_BG = new THREE.Color(0.05, 0.028, 0.095), insetSize = new THREE.Vector2();
  const insetRT = hdrTarget({ depthBuffer: true, samples: Math.min(4, maxSamples) }); insetRT.setSize(400, 400);
  const insetUniforms = { tSrc: { value: insetRT.texture }, uGrade: finalUniforms.uGrade, uExpo: finalUniforms.uExpo, uSize: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0 } };
  const insetMat = pass('inset', insetUniforms, FILM_GLSL + /* glsl */`
    uniform sampler2D tSrc; uniform vec4 uGrade; uniform float uExpo, uRadius; uniform vec2 uSize; varying vec2 vUv;
    void main() {
      vec2 p = abs(vUv - 0.5) * uSize - (0.5 * uSize - uRadius);
      if (length(max(p, 0.0)) > uRadius) discard;                                                   // rounded corners
      vec3 c = texture2D(tSrc, vUv).rgb;
      c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), uGrade.w) * uGrade.rgb * uExpo;
      c = film(c);
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));              // linear -> sRGB
      gl_FragColor = vec4(c, 1.0);
    }`);
  function drawInset() {
    const bg = scene.background, auto = renderer.shadowMap.autoUpdate;
    scene.background = INSET_BG; renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = true; renderer.setRenderTarget(insetRT); renderer.render(scene, inset.camera);
    scene.background = bg; renderer.shadowMap.autoUpdate = auto;
    renderer.getSize(insetSize);
    renderer.setRenderTarget(null); renderer.setViewport(inset.x, inset.y, inset.w, inset.h); renderer.setScissor(inset.x, inset.y, inset.w, inset.h); renderer.setScissorTest(true);
    insetUniforms.uSize.value.set(inset.w, inset.h); insetUniforms.uRadius.value = inset.r || 0;
    draw(insetMat, null, false);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, insetSize.x, insetSize.y);
  }

  // (10-04) A portrait: what `cam` sees (its own layer of the scene), drawn the inset's way into a small picture and read
  // back as sRGB bytes (GL order: bottom row first). looks.js makes her dialogue portraits of her this way when the player
  // has changed her look (the story's drawn ones show the look she was built with).
  const SHOT = 288, shotRT = new THREE.WebGLRenderTarget(SHOT, SHOT, { depthBuffer: false }), shotPixels = new Uint8Array(SHOT * SHOT * 4), shotGrade = new THREE.Vector4();
  function portrait(cam) {
    const bg = scene.background, auto = renderer.shadowMap.autoUpdate, reset = renderer.info.autoReset;
    scene.background = INSET_BG; renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = true; renderer.setRenderTarget(insetRT); renderer.render(scene, cam);
    scene.background = bg; renderer.shadowMap.autoUpdate = auto;
    insetUniforms.uSize.value.set(SHOT, SHOT); insetUniforms.uRadius.value = 0;
    shotGrade.copy(finalUniforms.uGrade.value); const expo = finalUniforms.uExpo.value; finalUniforms.uGrade.value.set(1, 1, 1, 0); finalUniforms.uExpo.value = 1;      // (no area's tint on her portrait)
    draw(insetMat, shotRT);
    finalUniforms.uGrade.value.copy(shotGrade); finalUniforms.uExpo.value = expo;
    renderer.readRenderTargetPixels(shotRT, 0, 0, SHOT, SHOT, shotPixels);
    renderer.setRenderTarget(null); renderer.autoClear = true; renderer.info.autoReset = reset;
    return { size: SHOT, pixels: shotPixels };
  }

  // ---------- one frame ----------
  function drawFrame(bloom, dof, T = std) {
    T.scene.resolveDepthBuffer = dof;                    // the depth texture is only filled when depth of field reads it
    renderer.autoClear = true;
    renderer.setRenderTarget(T.scene);
    renderer.render(scene, camera);
    renderer.info.autoReset = false;                     // the perf counters keep the scene's numbers and add the passes below
    const W = T.scene.width, H = T.scene.height;

    if (bloom) {
      const [tight, wide] = T.bloom;
      brightMat.uniforms.tScene.value = T.scene.texture; brightMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      draw(brightMat, tight);
      downMat.uniforms.tSrc.value = tight.texture; downMat.uniforms.uStep.value.set(1 / tight.width, 1 / tight.height);
      draw(downMat, wide);
      upMat.uniforms.tSrc.value = wide.texture; upMat.uniforms.uStep.value.set(0.5 / wide.width, 0.5 / wide.height);
      draw(upMat, tight, false);                         // blended over what is there
    }

    if (dof) {
      dofDownMat.uniforms.tScene.value = T.scene.texture; dofDownMat.uniforms.tDepth.value = T.scene.depthTexture;
      dofDownMat.uniforms.uTexel.value.set(1 / W, 1 / H);
      draw(dofDownMat, T.dof[0]);
      dofBlurMat.uniforms.tSrc.value = T.dof[0].texture;
      dofBlurMat.uniforms.uTexel.value.set(1 / T.dof[0].width, 1 / T.dof[0].height);
      dofBlurMat.uniforms.uMaxRadius.value = DOF_RADIUS * T.dof[0].height;
      draw(dofBlurMat, T.dof[1]);
    }

    // the final pass fills the canvas, whatever size the set is (in close-up mode the standard set is smaller than the canvas)
    finalUniforms.tScene.value = T.scene.texture; finalUniforms.tDepth.value = T.scene.depthTexture;
    finalUniforms.tDof.value = T.dof[1].texture; finalUniforms.tBloom.value = T.bloom[0].texture;
    finalUniforms.uBloomStep.value.set(0.5 / T.bloom[0].width, 0.5 / T.bloom[0].height);
    finalUniforms.uBloom.value = bloom ? BLOOM_STRENGTH : 0;
    finalUniforms.uAspect.value = W / H;
    finalUniforms.uSharp.value = closeUp === 'on' ? SHARPEN : 0; finalUniforms.uSceneTexel.value.set(1 / W, 1 / H);
    draw(finalMat, null);
    if (inset) drawInset();
    renderer.autoClear = true; renderer.info.autoReset = true;
  }

  const pinnedFocus = qp.has('focus') ? new THREE.Vector3(...qp.get('focus').split(',').map(Number)) : null;
  let focus = pinnedFocus, dofAmount = 0, focusDistance = 1, focusK = 1, lensK = 1;
  const eye = new THREE.Vector3(), forward = new THREE.Vector3();
  function render(dt = 1 / 60) {
    // depth of field fades in and out, and the focus distance glides, so a change of shot does not pop
    const wanted = TIERS[tier].dof && focus ? 1 : 0, starting = dofAmount === 0;
    dofAmount += (wanted - dofAmount) * (1 - Math.exp(-dt * 6));
    if (Math.abs(wanted - dofAmount) < 0.01) dofAmount = wanted;
    if (focus) {
      camera.getWorldDirection(forward); eye.setFromMatrixPosition(camera.matrixWorld);
      const distance = Math.max(0.2, (focus.x - eye.x) * forward.x + (focus.y - eye.y) * forward.y + (focus.z - eye.z) * forward.z);
      focusDistance = starting ? distance : focusDistance + (distance - focusDistance) * (1 - Math.exp(-dt * 8));
    }
    lensK = starting ? focusK : lensK + (focusK - lensK) * (1 - Math.exp(-dt * 8));
    lens.set(focusDistance, dofAmount * lensK, camera.near, camera.far);
    // the close-up set: for the shots that asked for it, and for two frames when it is created (behind a black screen),
    // so that its buffers exist before the first close-up
    const T = hi && (warmHi > 0 || (closeUp === 'on' && !hiBlocked)) ? hi : std;
    if (warmHi > 0) warmHi--;
    drawFrame(TIERS[tier].bloom, dofAmount > 0, T);
  }

  // 'off' (normal play), 'ready' (a cut-scene with close-ups is running: build the close-up set; call this while the screen
  // is black) or 'on' (this shot is a close-up). Does nothing when the window is small enough to be at full resolution already.
  function setCloseUp(mode) {
    mode = mode === 'on' || mode === 'ready' ? mode : 'off';
    if (qp.has('nocloseup') || fixedDpr) mode = 'off';
    if (mode === closeUp) return;
    const was = closeUp; closeUp = mode;
    if (mode === 'on') { hiAvg = 16.7; hiSlow = 0; }
    if (was === 'off') {
      if (hiDpr() > stdDpr() * 1.08) { hi = makeSet(); hiBlocked = false; warmHi = 2; apply(); } else hi = null;
    } else if (mode === 'off' && hi) { disposeSet(hi); hi = null; apply(); }
  }

  // Compile every pass, then draw one frame with all effects on, so the targets exist and the GPU has built its
  // pipelines before play starts. (The scene's own materials are compiled by the page.)
  async function warm() {
    const all = new THREE.Scene();
    for (const material of [brightMat, downMat, upMat, dofDownMat, dofBlurMat, finalMat]) { const mesh = new THREE.Mesh(tri.geometry, material); mesh.frustumCulled = false; all.add(mesh); }
    await renderer.compileAsync(all, triCam);
    lens.set(1, 1, camera.near, camera.far);
    drawFrame(true, true);
  }

  return {
    render, setSize, frameTime, warm, setCloseUp,
    // an area's look, like the 2D's "tint screen": gains for red, green and blue, how grey (0..1), and the exposure
    setGrade(r = 1, g = 1, b = 1, grey = 0, expo = 1) { finalUniforms.uGrade.value.set(r, g, b, grey); finalUniforms.uExpo.value = expo; },
    setFocus(point, strength = 1) { focus = pinnedFocus || point || null; focusK = strength; },   // strength > 1: a shallower depth of field
    portrait,
    setInset(o) {                                    // the corner inset (see drawInset); null: off
      // (10-05, review: one subject at a time is on the inset's layer: Anne's stayed on it, and stood in the corner picture of
      // Boudicca's face. Whenever the inset comes on its subject is gone through again: what she wears may have changed.)
      if (o && (!inset || (o.subject && o.subject !== insetSubject))) {
        if (!inset) scene.traverse((x) => { if (x.isLight) x.layers.enable(1); });
        if (insetSubject && o.subject && insetSubject !== o.subject) insetSubject.traverse((x) => x.layers.disable(1));
        if (o.subject) { o.subject.traverse((x) => x.layers.enable(1)); insetSubject = o.subject; }
      }
      inset = o || null;
    },
    info: () => ({ dpr, quality: `msaa ${std.scene.samples}x${TIERS[tier].bloom ? ', bloom' : ''}${TIERS[tier].dof ? ', depth of field' : ''}`, tier, pixels: pixels(),
      closeUp: closeUp + (hi ? ` ${hi.scene.width}x${hi.scene.height} msaa ${hi.scene.samples}x${hiBlocked ? ' (too slow: standard set used)' : ''}` : ''), std: [std.scene.width, std.scene.height] }),
  };
}
