// anne.js: loads the character and owns her look (materials), animation clips and facial expressions.
// Contract: export async function loadAnne({ THREE, GLTFLoader, scene, ver, onProgress }) -> api (see the return at the bottom)

export async function loadAnne({ THREE, GLTFLoader, scene, ver, onProgress }) {
  const loader = new GLTFLoader();
  const loadGLB = (url, onProg) => new Promise((res, rej) => loader.load(url, res, onProg, rej));
  const [gltf, heelGltf] = await Promise.all([loadGLB('anne.glb?v=' + ver, onProgress), loadGLB('anne_heel_prop.glb?v=' + ver).catch(() => null)]);
  const anne = gltf.scene;

  // ---------- materials ----------
  const blushTex = new THREE.TextureLoader().load('tex/anne_blush_mask.png?v=' + ver); blushTex.flipY = false;
  const blushU = { value: 0 };
  anne.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material; const n = (m.name || '') + ' ' + (o.name || '');
    if (/long01|eyebrow|eyelash/.test(n)) { m.transparent = false; m.alphaTest = 0.45; m.depthWrite = true; m.side = THREE.DoubleSide; }
    if (/high-poly|highpoly/.test(n)) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; }
    if (/teeth/.test(n)) { m.map = null; m.color.setRGB(0.93, 0.91, 0.86); m.roughness = 0.3; m.needsUpdate = true; }   // a clean white band, like the portraits
    if (/eyebrow/.test(n)) m.color.setRGB(1.7, 1.35, 1.15);
    if (/\.body$/.test(m.name)) m.color.setRGB(1.0, 0.93, 0.88);                                                      // warmer, peachier skin
    if (/Hat|Heel/.test(n)) m.side = THREE.DoubleSide;
    if (/Purple|Gold|Yellow/.test(m.name)) { m.roughness = Math.max(m.roughness, .4); m.envMapIntensity = .8; }
    if (m.name === 'Anne_Yellow') { m.color.setRGB(0.80, 0.33, 0.0); m.roughness = 0.5; m.envMapIntensity = 0.45; m.sheen = 0; }   // the game's deep gold, no washed-out sheen in sunlight
    if (m.name === 'Anne_HeelPurple') { m.color.setRGB(0.16, 0.03, 0.40); m.roughness = 0.2; }
    if (/\.body$/.test(m.name) && m.map) {                     // cheek blush, driven by setExpression()
      m.onBeforeCompile = (sh) => {
        sh.uniforms.blushMap = { value: blushTex }; sh.uniforms.uBlush = blushU;
        sh.fragmentShader = 'uniform sampler2D blushMap;\nuniform float uBlush;\n' + sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n  float bl = clamp(texture2D(blushMap, vMapUv).r * uBlush * 1.25, 0.0, 1.0);\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.27, 0.34), bl * 0.72);');
      };
    }
  });
  scene.add(anne);

  // ---------- animation: every clip always plays; weights blend (locomotion) or cross-fade to one clip (scenes) ----------
  const mixer = new THREE.AnimationMixer(anne);
  const actions = {}, weights = {};
  for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); actions[clip.name] = a; weights[clip.name] = 0; }
  weights.Idle = 1;
  let exclusiveClip = null, clipFade = 0.25;
  const hatNodes = ['Anne_Hat', 'Anne_Hat_Band'].map((n) => anne.getObjectByName(n)).filter(Boolean);
  const heelNodes = ['Anne_Heel_L', 'Anne_Heel_R'].map((n) => anne.getObjectByName(n)).filter(Boolean);
  const ONE_SHOT = new Set(['Stomp']);
  for (const n of ONE_SHOT) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce, 1); actions[n].clampWhenFinished = true; }
  // exclusive cross-fade to one clip (fade <= 0 cuts instantly, e.g. behind a black screen)
  function playClip(name, fade = 0.3) {
    if (!actions[name]) { console.warn('missing clip', name); return; }
    if (exclusiveClip !== name && (weights[name] < 0.05 || ONE_SHOT.has(name))) { actions[name].reset(); actions[name].play(); }
    exclusiveClip = name; clipFade = Math.max(0.05, fade);
    if (fade <= 0) for (const n in actions) { weights[n] = n === name ? 1 : 0; actions[n].setEffectiveWeight(weights[n]); }
  }
  function releaseClips() { exclusiveClip = null; clipFade = 0.3; hatNodes.forEach((h) => { h.visible = true; }); }
  let heelsWorn = true;
  function setHeelsWorn(on) { heelsWorn = !!on; heelNodes.forEach((h) => { h.visible = heelsWorn; }); }
  // called once a frame: walkW 0..1 blends Idle and Walk while no exclusive clip is playing
  function updateClips(dt, walkW, speed) {
    for (const n in actions) {
      const target = exclusiveClip ? (n === exclusiveClip ? 1 : 0) : (n === 'Walk' ? walkW : n === 'Idle' ? 1 - walkW : 0);
      weights[n] = exclusiveClip ? THREE.MathUtils.damp(weights[n], target, 3 / clipFade, dt) : target;
      actions[n].setEffectiveWeight(weights[n]);
    }
    if (actions.Walk) actions.Walk.timeScale = speed / 1.3;
    mixer.update(dt);
  }

  // ---------- facial expressions (MakeHuman expression units exported as morph targets) ----------
  const morphMeshes = []; anne.traverse((o) => { if (o.isMesh && o.morphTargetDictionary) morphMeshes.push(o); });
  const EXPR = {
    neutral: { 'mouth-corner-puller': .12 },
    smile: { 'mouth-corner-puller': .6, 'eye-left-slit': .2, 'eye-right-slit': .2 },
    smug: { 'mouth-corner-puller': .4, 'eye-left-slit': .45, 'eye-right-slit': .45, 'eyebrows-left-up': .35, 'eyebrows-right-down': .2 },
    happy: { 'mouth-corner-puller': .9, 'mouth-open': .22, 'mouth-parling': .4, 'eyebrows-left-up': .25, 'eyebrows-right-up': .25, 'eye-left-slit': .25, 'eye-right-slit': .25 },
    surprised: { 'eye-left-opened-up': .9, 'eye-right-opened-up': .9, 'eyebrows-left-up': .9, 'eyebrows-right-up': .9, 'mouth-open': .35, 'mouth-parling': .5 },
    shocked: { 'eye-left-opened-up': 1, 'eye-right-opened-up': 1, 'eyebrows-left-up': 1, 'eyebrows-right-up': 1, 'eyebrows-left-inner-up': .5, 'eyebrows-right-inner-up': .5, 'mouth-open': .7, 'mouth-retraction': .3 },
    angry: { 'eyebrows-left-down': 1, 'eyebrows-right-down': 1, 'eye-left-slit': .5, 'eye-right-slit': .5, 'mouth-retraction': .5, 'mouth-compression': .2, 'nose-left-elevation': .5, 'nose-right-elevation': .5, 'mouth-open': .15 },
    embarrassed: { 'mouth-corner-puller': .3, 'eyebrows-left-inner-up': .6, 'eyebrows-right-inner-up': .6, 'eye-left-slit': .3, 'eye-right-slit': .3, 'mouth-compression': .2 },
    worried: { 'eyebrows-left-inner-up': .9, 'eyebrows-right-inner-up': .9, 'mouth-depression': .4, 'eye-left-opened-up': .3, 'eye-right-opened-up': .3, 'mouth-parling': .2 },
    strain: { 'eye-left-closure': .6, 'eye-right-closure': .6, 'eyebrows-left-down': .5, 'eyebrows-right-down': .5, 'mouth-retraction': .6, 'mouth-compression': .4, 'nose-left-elevation': .3, 'nose-right-elevation': .3 },
    laugh: { 'mouth-corner-puller': 1, 'mouth-open': .55, 'mouth-parling': .5, 'eye-left-closure': .6, 'eye-right-closure': .6, 'eyebrows-left-inner-up': .4, 'eyebrows-right-inner-up': .4, 'nose-left-elevation': .2, 'nose-right-elevation': .2 },
    laughHard: { 'mouth-corner-puller': 1, 'mouth-open': .62, 'mouth-elevation': .3, 'eye-left-closure': .95, 'eye-right-closure': .95, 'eyebrows-left-inner-up': .7, 'eyebrows-right-inner-up': .7, 'nose-left-elevation': .4, 'nose-right-elevation': .4 },
    pout: { 'mouth-pursing': .7, 'eyebrows-left-down': .3, 'eyebrows-right-down': .3, 'eye-left-slit': .2, 'eye-right-slit': .2, 'mouth-depression': .2 },
  };
  const FACE_KEYS = [...new Set(Object.values(EXPR).flatMap((e) => Object.keys(e)).concat(['eye-left-closure', 'eye-right-closure']))];
  const faceNow = Object.fromEntries(FACE_KEYS.map((k) => [k, 0]));
  // per mesh: [morph index, face key] pairs, resolved once
  const morphLinks = morphMeshes.map((m) => ({ inf: m.morphTargetInfluences, pairs: FACE_KEYS.map((k) => [m.morphTargetDictionary[k], k]).filter((p) => p[0] !== undefined) }));
  let exprName = 'neutral', blushTarget = 0, nextBlink = 2.5, blinkT = -1;
  function setExpression(name, blush = 0) { exprName = EXPR[name] ? name : 'neutral'; blushTarget = blush; }
  function updateFace(dt, t) {
    const e = EXPR[exprName];
    if (t > nextBlink && blinkT < 0) { blinkT = 0; nextBlink = t + 2.2 + Math.random() * 3.5; }
    let blink = 0; if (blinkT >= 0) { blinkT += dt; blink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) blinkT = -1; }
    const laughing = exprName === 'laugh' || exprName === 'laughHard';
    for (const k of FACE_KEYS) {
      let v = e[k] || 0;
      if (laughing && k === 'mouth-open') v += 0.18 * Math.sin(t * 15) + 0.08 * Math.sin(t * 23);
      if (k === 'eye-left-closure' || k === 'eye-right-closure') v = Math.max(v, blink);
      faceNow[k] = THREE.MathUtils.damp(faceNow[k], v, k.startsWith('eye-') && blink > 0 ? 40 : 12, dt);
    }
    for (const l of morphLinks) for (const p of l.pairs) l.inf[p[0]] = faceNow[p[1]];
    blushU.value = THREE.MathUtils.damp(blushU.value, blushTarget, 4, dt);
  }

  return {
    anne, mixer,
    heelProp: heelGltf ? heelGltf.scene : null,     // the loose-shoe mesh for the log scene
    headHeight: 1.45,                               // where the follow camera looks (metres above her feet)
    playClip, releaseClips, updateClips, setExpression, updateFace, setHeelsWorn,
    debug: () => ({ heelsWorn, exclusiveClip, hat: hatNodes.every((h) => h.visible) }),
  };
}
