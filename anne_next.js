// anne_next.js: the stylised Anne (v2). Same contract as anne.js:
//   export async function loadAnne({ THREE, GLTFLoader, scene, ver, onProgress, qp }) -> api
// It loads <base>.glb, <base>_heel_prop.glb and <base>.json (base = "anne2", or ?glb=...).
// What lives here: her materials (soft stylised skin, shader-drawn eyes, hair, outfit), animation clips,
// facial expressions, blinking, gaze, blush.

export async function loadAnne({ THREE, GLTFLoader, scene, ver, onProgress, qp }) {
  const base = (qp && qp.get('glb')) || 'anne2';
  const loader = new GLTFLoader();
  const loadGLB = (url, onProg) => new Promise((res, rej) => loader.load(url, res, onProg, rej));
  const [gltf, heelGltf, propsGltf, metrics] = await Promise.all([
    loadGLB(`${base}.glb?v=${ver}`, onProgress),
    loadGLB(`${base}_heel_prop.glb?v=${ver}`).catch(() => null),
    loadGLB(`${base}_shoe_props.glb?v=${ver}`).catch(() => null),      // the loose shoes of the other styles she may wear
    fetch(`${base}.json?v=${ver}`).then((r) => r.json()).catch(() => ({})),
  ]);
  const anne = gltf.scene;
  const OWN = new Set(); anne.traverse((o) => OWN.add(o.name));      // the model's own nodes (makeTwin copies only these)
  const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;
  const num = (k, d) => (qp && qp.get(k) ? parseFloat(qp.get(k)) : d);
  // The model's colours are display colours; under this sun a surface shows at about 2.5 x its albedo, so they are
  // scaled down here (one number per material family, tunable from the address bar while looking).
  const SKIN_GAIN = num('skin', 0.42), HAIR_GAIN = num('hair', 0.55), EYE_GAIN = num('eye', 0.42), ENV = num('env', 0.25);

  // ---------- shared shader inputs ----------
  // Blender space (x, y, z) is glTF space (x, z, -y): the json stores Blender coordinates.
  const toGl = (v) => new THREE.Vector3(v[0], v[2], -v[1]), toGlSize = (v) => new THREE.Vector3(v[0], v[2], v[1]);
  const eyeL = metrics.eyes && metrics.eyes.left, eyeR = metrics.eyes && metrics.eyes.right;
  const U = {
    toeBox: { value: new THREE.Vector4(0, 0, 0, 0) },      // (see the skin shader: her forefoot inside a closed shoe)
    eyeCentreL: { value: eyeL ? toGl(eyeL.centre) : new THREE.Vector3(0.033, 1.49, 0.12) },
    eyeCentreR: { value: eyeR ? toGl(eyeR.centre) : new THREE.Vector3(-0.033, 1.49, 0.12) },
    eyeHalf: { value: eyeL ? toGlSize(eyeL.half) : new THREE.Vector3(0.018, 0.017, 0.013) },
    gaze: { value: new THREE.Vector2(0, 0) },          // x: + looks to her left, y: + looks up (radians-ish, small)
    pupil: { value: 1 },                               // pupil size multiplier
    blush: { value: 0 },
    sunDir: { value: new THREE.Vector3(0.4, 0.75, -0.52).normalize() },   // towards the sun, world space (read from the scene below)
    faceLift: { value: num('facelift', 40) },          // metres: see liftFaceShadow
    headW: { value: new THREE.Vector3(0, 1.6, 0) },    // the middle of her head, world space (updateFace)
    faceEven: { value: num('faceeven', 0) },           // how far the face's shadow is evened out (0 = each point its own, 1 = one value for the whole face)
    // (10-04, as he asked: the player makes her look their own; see "her look" below)
    tone: { value: new THREE.Vector3(1, 1, 1) },       // her skin tone over the porcelain one her skin was painted in, channel by channel (linear)
    toneDeep: { value: 0 },                            // how deep that tone is (0 = the painted one .. 1): her soles stay lighter, the pale rim fades
    irisIn: { value: new THREE.Vector3(0.24, 0.62, 1.00) }, irisOut: { value: new THREE.Vector3(0.02, 0.16, 0.66) },      // her irises: near the pupil, at the rim
    hairCol: { value: new THREE.Vector3(1, 1, 1) }, hairOn: { value: 0 },      // her hair's colour (0: the painted auburn)
    sock: { value: new THREE.Vector4(0, 0, 0, 0) }, sockLow: { value: -1 },   // stockings: colour and the rest height they reach up to; and down to (her feet stay bare)
    band: { value: new THREE.Vector4(0, 0, 0, 0) },    // bracers on her forearms: colour, on
    suit2: { value: new THREE.Vector4(0, 0, 0, 0) },   // her suit below a rest height in a second colour: rgb, the height (0: one colour)
    // (10-04, batch 22: his list of outfits) what an outfit bares of her suit, and what it paints on it and on her
    cutN: { value: new THREE.Vector4(0, 0, 0, 0) },    // a neckline: bare above x (m, at her middle) + y per metre to her sides; z: at her back (0: as in front, 9: never); w: shoulder straps kept at this |x| (0: none)
    cutM: { value: new THREE.Vector4(0, 0, 0, 0) },    // a bare midriff from x up to y (m); z: a leg line: bare below z at her middle (0: none), rising w per metre to her sides
    pat: { value: new THREE.Vector4(0, 0, 0, 0) }, patS: { value: new THREE.Vector2(0.04, 0) },       // a pattern on her suit: colour, kind (1 hoops, 2 stripes, 3 dots, 4 plaid, 5 scales); its size (m), where (0 all, 1 above the split, 2 below)
    patK: { value: new THREE.Vector4(0, 0, 0, 0) }, patKS: { value: new THREE.Vector2(0.04, 0) },     // ... and on her skirt
    sleeve: { value: new THREE.Vector4(0, 0, 0, 0) },  // sleeves painted on her upper arms: colour, how far down from the shoulder (1 = to the elbow; 0: none)
    bandEnds: { value: new THREE.Vector2(0.10, 0.90) },      // where the forearm band starts and ends, elbow (0) to wrist (1)
    sock2: { value: new THREE.Vector4(0, 0, 0, 0) }, sockS: { value: 0.03 },      // her stockings' make: a second colour + kind (1 net, 2 hoops, 3 sheer); its size (m)
    glow: { value: new THREE.Vector4(0, 0, 0, 0) },    // a light of her skin's own (a ghost, a robot's seams): colour, strength
    skirtLow: { value: 0 },                            // a long skirt is not drawn below this rest height (gathered up to her knees in the foot cam and in scenes about her feet)
    trimLow: { value: 0 },                             // the bead along her suit's hems is not drawn below this height (trousers painted on her legs: no bead where they meet the suit)
  };
  // (rest pose, metres) what an outfit's cut bares of her suit: 0 cloth .. 1 bare; w = half the width of the edge
  const CUT_GLSL = `
    uniform vec4 uCutN, uCutM;
    float bareW(vec3 p, float w) {
      float ax = abs(p.x), b = 0.0;
      if (uCutN.x > 0.0) {
        float line = (p.z > -0.02 || uCutN.z <= 0.0) ? uCutN.x + uCutN.y * ax : uCutN.z;
        float up = smoothstep(line - w, line + w, p.y);
        if (uCutN.w > 0.0) up *= smoothstep(0.011 - w * 0.5, 0.011 + w * 0.5, abs(ax - uCutN.w));
        b = max(b, up);
      }
      if (uCutM.y > uCutM.x) b = max(b, smoothstep(uCutM.x - w, uCutM.x + w, p.y) * (1.0 - smoothstep(uCutM.y - w, uCutM.y + w, p.y)));
      if (uCutM.z > 0.0) { float line = uCutM.z + uCutM.w * max(0.0, ax - 0.05); b = max(b, 1.0 - smoothstep(line - w, line + w, p.y)); }
      return b;
    }
`;
  // a pattern in the cloth (rest pose): 0 the cloth's own colour .. 1 the pattern's
  const PAT_GLSL = `
    float patAt(vec4 pat, float s, vec3 p) {
      if (pat.a < 0.5) return 0.0;
      float a = atan(p.x, p.z) * 0.16;
      if (pat.a < 1.5) return step(0.5, fract(p.y / s));
      if (pat.a < 2.5) return step(0.5, fract(a / s));
      if (pat.a < 3.5) { vec2 g = vec2(a, p.y) / s; g.x += 0.5 * floor(g.y); return 1.0 - step(0.3, length(fract(g) - 0.5)); }
      if (pat.a < 4.5) { float u = step(0.62, fract(a / s)), v = step(0.62, fract(p.y / s)); return max(u, v) * 0.6 + u * v * 0.4; }
      if (pat.a < 5.5) { vec2 g = vec2(a, p.y) / s; g.x += 0.5 * floor(g.y); vec2 f = fract(g) - vec2(0.5, 1.0); return smoothstep(0.40, 0.5, length(f)) * 0.7; }
      return 0.0;
    }
`;
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && o.target) U.sunDir.value.subVectors(o.position, o.target.position).normalize(); });
  // Her face takes no cast shadows: not from her own hat and hair (the 2D portraits have no such shadow, and under this
  // sun the brim would grey the whole face), and not from the trees either (in the forest their dapple lay on her face
  // in grey patches that read as dirt in every close-up). The face asks the shadow map about a point `faceLift` metres
  // towards the sun, above everything. `where`: a GLSL expression for the share of the lift (0..1).
  // (?facelift=0.6 gives back tree shade on her face; ?faceeven=0.86 then evens it out over the face.)
  const liftFaceShadow = (sh, where, UU = U) => {
    Object.assign(sh.uniforms, { uSunDirW: UU.sunDir, uFaceLift: UU.faceLift, uHeadW: UU.headW, uFaceEven: UU.faceEven });
    sh.vertexShader = 'uniform vec3 uSunDirW, uHeadW;\nuniform float uFaceLift, uFaceEven;\n' + sh.vertexShader.replace('#include <shadowmap_vertex>', `#include <shadowmap_vertex>
      #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      { float faceShare = ( ${where} );
        vec3 facePoint = mix( worldPosition.xyz, uHeadW, uFaceEven * faceShare );
        vDirectionalShadowCoord[ 0 ] = directionalShadowMatrix[ 0 ] * vec4( facePoint + shadowWorldNormal * directionalLightShadows[ 0 ].shadowNormalBias + uSunDirW * ( uFaceLift * faceShare ), 1.0 ); }
      #endif`);
  };

  // ---------- materials ----------
  let skinShadowOk = false;                           // (set when the skin's shadow line was found in three's shader chunk)
  // Skin: vertex colours, soft wrapped light, a warm scatter band at the shadow edge, a peachy rim, and blush on the cheeks.
  // (UU: the figure's own shader inputs. look: what a second figure wears on her skin, see makeTwin: `sock` = [r, g, b,
  // top] colours her legs below that rest height, `band` = [r, g, b] her forearms between elbow and wrist.)
  const NO4 = new THREE.Vector4(0, 0, 0, 0), ELBOW = new THREE.Vector3(0.2818, 1.1829, 0.0233), WRIST = new THREE.Vector3(0.3871, 1.0659, 0.1545);
  // (batch 22) more of her rest pose, read off her skeleton: her left shoulder; her left hip, knee and ankle
  const restOf = (name, fb) => { let v = null; anne.traverse((o) => { if (!v && o.isSkinnedMesh && o.skeleton) { const i = o.skeleton.bones.findIndex((b) => b.name === name); if (i >= 0) v = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(o.skeleton.boneInverses[i]).invert().premultiply(o.bindMatrix)); } }); return v || new THREE.Vector3(...fb); };
  const SHOULDER = restOf('upperarm01L', [0.17, 1.36, -0.02]), LEG = [restOf('upperleg01L', [0.09, 0.9, 0]), restOf('lowerleg01L', [0.11, 0.48, 0]), restOf('footL', [0.13, 0.085, -0.03])];
  function skinMaterial(m, UU = U, look = null) {
    // (the painted colours are display colours; as a surface under this sun they need to be about 2/3 as bright)
    m.vertexColors = true; m.map = null; m.color.setScalar(SKIN_GAIN); m.roughness = 0.55; m.metalness = 0; m.envMapIntensity = ENV;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uBlush: UU.blush, uEyeL: UU.eyeCentreL, uEyeR: UU.eyeCentreR, uEyeHalf: UU.eyeHalf,
        uToeBox: UU.toeBox || { value: NO4 }, uSock: look && look.sock ? { value: new THREE.Vector4(...look.sock) } : UU.sock, uSockLow: look && look.sockLow !== undefined ? { value: look.sockLow } : UU.sockLow, uBand: look && look.band ? { value: new THREE.Vector4(...look.band, 1) } : UU.band, uBandA: { value: ELBOW }, uBandB: { value: WRIST },
        uSleeve: look && look.sleeve ? { value: new THREE.Vector4(...look.sleeve) } : UU.sleeve, uSleeveA: { value: SHOULDER }, uBandEnds: UU.bandEnds, uSock2: UU.sock2, uSockS: UU.sockS, uGlow: UU.glow, uLegA: { value: LEG[0] }, uLegB: { value: LEG[1] }, uLegC: { value: LEG[2] },
        uTone: UU.tone, uToneDeep: UU.toneDeep });
      sh.vertexShader = 'varying vec3 vRest, vRestN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position; vRestN = normal;');
      liftFaceShadow(sh, 'smoothstep( 1.44, 1.48, position.y )', UU);      // (the head: above the chin, in the rest pose)
      sh.fragmentShader = 'varying vec3 vRest, vRestN;\nuniform float uBlush, uToneDeep, uSockLow, uSockS;\nuniform vec3 uEyeL, uEyeR, uEyeHalf, uBandA, uBandB, uTone, uSleeveA, uLegA, uLegB, uLegC;\nuniform vec4 uSock, uBand, uToeBox, uSleeve, uSock2, uGlow;\nuniform vec2 uBandEnds;\nfloat cloth = 0.0;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          {                                                    // (10-04) her skin tone, over the porcelain one she was painted in; the undersides
            float under = smoothstep(0.3, 0.8, -vRestN.y) * (1.0 - smoothstep(0.035, 0.07, vRest.y)) * uToneDeep;      // of her feet stay lighter the deeper it is
            diffuseColor.rgb *= mix(uTone, mix(uTone, vec3(1.0), 0.42) * vec3(1.0, 0.95, 0.93), under);
          }
          {                                                    // cheek blush: an oval below and outside each eye
            vec3 cl = uEyeL + vec3(0.010, -0.046, 0.0), cr = uEyeR + vec3(-0.010, -0.046, 0.0);
            vec2 s = vec2(0.036, 0.024);
            float dl = length((vRest.xy - cl.xy) / s), dr = length((vRest.xy - cr.xy) / s);
            float front = smoothstep(cl.z - 0.06, cl.z - 0.02, vRest.z);
            float cheek = (1.0 - smoothstep(0.35, 1.0, min(dl, dr))) * front;
            vec3 rose = vec3(0.93, 0.32, 0.36) * mix(vec3(1.0), uTone * 1.5 + 0.08, uToneDeep);      // (a deeper skin blushes deeper, not pink paint)
            diffuseColor.rgb = mix(diffuseColor.rgb, rose, cheek * (0.10 + 0.55 * uBlush));
          }
          // (inside a closed shoe her forefoot is not drawn: uToeBox = the line of the REST pose it starts at, the height it ends at, left on, right on)
          if (uToeBox.x > 0.0 && vRest.z > uToeBox.x && vRest.y < uToeBox.y && (vRest.x > 0.0 ? uToeBox.z : uToeBox.w) > 0.5) discard;
          if (uSock.a > 0.0) {                                 // stockings: below a height of the rest pose, with a darker hem (and above uSockLow: footless)
            float k = (1.0 - smoothstep(uSock.a - 0.003, uSock.a + 0.003, vRest.y)) * smoothstep(uSockLow - 0.003, uSockLow + 0.003, vRest.y);
            float hem = smoothstep(uSock.a - 0.03, uSock.a - 0.024, vRest.y);
            vec3 sc = uSock.rgb * (1.0 - 0.3 * hem);
            if (uSock2.a > 0.5) {                              // (batch 22) their make: a net, hoops of a second colour, or sheer
              vec3 q = vec3(abs(vRest.x), vRest.yz);
              vec3 ax = q.y > uLegB.y ? mix(uLegB, uLegA, clamp((q.y - uLegB.y) / (uLegA.y - uLegB.y), 0.0, 1.0)) : mix(uLegC, uLegB, clamp((q.y - uLegC.y) / (uLegB.y - uLegC.y), 0.0, 1.0));
              float ang = atan(q.x - ax.x, q.z - ax.z) * 0.055;
              if (uSock2.a < 1.5) { float d1 = abs(fract((q.y + ang) / uSockS) - 0.5), d2 = abs(fract((q.y - ang) / uSockS) - 0.5); k *= max(1.0 - smoothstep(0.07, 0.13, min(d1, d2)), hem); }
              else if (uSock2.a < 2.5) sc = mix(sc, uSock2.rgb, step(0.5, fract(q.y / uSockS)));
              else k *= 0.5 + 0.5 * hem;
            }
            diffuseColor.rgb = mix(diffuseColor.rgb, sc, k); cloth = max(cloth, k);
          }
          if (uSleeve.a > 0.0) {                               // (batch 22) sleeves: from her shoulder down her upper arm (the forearm: the band below)
            vec3 q = vec3(abs(vRest.x), vRest.yz), ab = uBandA - uSleeveA;
            float ts = dot(q - uSleeveA, ab) / dot(ab, ab);
            float k = (1.0 - smoothstep(uSleeve.a - 0.02, uSleeve.a, ts)) * (1.0 - step(0.09, length(q - uSleeveA - ab * clamp(ts, 0.0, 1.2)))) * smoothstep(0.105, 0.125, q.x);
            float hem = smoothstep(uSleeve.a - 0.09, uSleeve.a - 0.03, ts) * step(uSleeve.a, 0.99);
            diffuseColor.rgb = mix(diffuseColor.rgb, uSleeve.rgb * (1.0 - 0.25 * hem), k); cloth = max(cloth, k);
          }
          if (uBand.a > 0.0) {                                 // bracers: from below the elbow to the wrist, along the forearm of the rest pose
            vec3 q = vec3(abs(vRest.x), vRest.yz), ab = uBandB - uBandA;
            float tb = dot(q - uBandA, ab) / dot(ab, ab);
            float k = smoothstep(uBandEnds.x, uBandEnds.x + 0.015, tb) * (1.0 - smoothstep(uBandEnds.y, uBandEnds.y + 0.015, tb)) * (1.0 - step(0.075, length(q - uBandA - ab * tb)));      // (only what is near the forearm's own line)
            float rim = max((1.0 - smoothstep(uBandEnds.x + 0.015, uBandEnds.x + 0.07, tb)) * step(0.0, uBandEnds.x), smoothstep(uBandEnds.y - 0.06, uBandEnds.y, tb));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBand.rgb * (1.0 - 0.28 * rim), k); cloth = max(cloth, k);
          }`)
        .replace('#include <opaque_fragment>', `
          #if NUM_DIR_LIGHTS > 0
          {
            float ndl = dot(normal, directionalLights[0].direction);
            float band = exp(-pow((ndl - 0.02) * 3.6, 2.0));                      // light scattering through skin at the terminator
            outgoingLight += diffuseColor.rgb * vec3(1.0, 0.42, 0.40) * band * 0.07 * directionalLights[0].color * (1.0 - cloth);
            float wrap = smoothstep(-0.55, 0.15, ndl) * (1.0 - smoothstep(0.0, 0.5, ndl));   // lift the first stretch of shadow
            outgoingLight += diffuseColor.rgb * vec3(0.50, 0.38, 0.34) * wrap * 0.07 * directionalLights[0].color;
          }
          #endif
          { float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.2);
            outgoingLight += vec3(1.0, 0.90, 0.89) * rim * 0.09 * (1.0 - cloth) * (1.0 - 0.65 * uToneDeep);
            outgoingLight += uGlow.rgb * uGlow.a * (0.22 + 1.6 * pow(rim, 0.6)) * (1.0 - cloth); }      // (10-02: a cooler, pinker rim and shade: fair porcelain skin, as in her portraits; 10-04: fainter on a deeper skin)
          {                                                    // Skin in the shade keeps its own colour. The sky's light alone turns it grey-blue,
            vec3 ind = reflectedLight.indirectDiffuse;         // worst where skin faces the sky (the backs of her legs and her soles when she lies on
            float amb = dot(ind, vec3(0.299, 0.587, 0.114));   // her front): the shade keeps its brightness and takes the colour of her skin in warm light.
            vec3 tone = diffuseColor.rgb * vec3(1.0, 0.93, 0.91); tone /= max(1e-4, dot(tone, vec3(0.299, 0.587, 0.114)));
            outgoingLight += (amb * tone * ${num('skinlift', 1.1).toFixed(3)} - ind) * ${num('skinamb', 0.85).toFixed(3)} * (1.0 - cloth);
          }
          #include <opaque_fragment>`);
      // Cast shadows lie lightly on her skin (leaf dapple and the shade of a vine read as dirt on bare legs and soles):
      // in shadow her skin still takes this share of the sun.
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
        /getShadow\( directionalShadowMap\[ i \][^;]*?vDirectionalShadowCoord\[ i \] \)/, (m0) => { skinShadowOk = true; return `mix( ${num('skinshade', 0.3).toFixed(3)}, 1.0, ${m0} )`; }));
    };
  }

  // Eyes are drawn by the shader on the eyeball's surface: sclera, iris, pupil, catch-lights. Gaze moves the iris, so
  // the (non-spherical, stylised) eyeball never has to rotate.
  const IRIS_IN = new THREE.Vector3(0.24, 0.62, 1.00), IRIS_OUT = new THREE.Vector3(0.02, 0.16, 0.66);
  function eyeMaterial(m, UU = U, look = null) {
    m.map = null; m.alphaMap = null; m.emissiveMap = null; m.emissive.setRGB(0, 0, 0); m.transparent = false; m.alphaTest = 0;
    m.color.setRGB(1, 1, 1); m.roughness = 0.12; m.metalness = 0; m.envMapIntensity = 1.2;
    m.side = THREE.FrontSide;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uEyeL: UU.eyeCentreL, uEyeR: UU.eyeCentreR, uEyeHalf: UU.eyeHalf, uGaze: UU.gaze, uPupil: UU.pupil, uGain: { value: EYE_GAIN },
        uIrisIn: look && look.iris ? { value: new THREE.Vector3(...look.iris[0]) } : (UU.irisIn || { value: IRIS_IN }), uIrisOut: look && look.iris ? { value: new THREE.Vector3(...look.iris[1]) } : (UU.irisOut || { value: IRIS_OUT }) });
      sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;');
      liftFaceShadow(sh, '1.0', UU);
      sh.fragmentShader = `varying vec3 vRest;
        uniform vec3 uEyeL, uEyeR, uEyeHalf, uIrisIn, uIrisOut; uniform vec2 uGaze; uniform float uPupil, uGain;
        vec3 eyeExtra = vec3(0.0);
        ` + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float side = vRest.x > 0.0 ? 1.0 : -1.0;
            vec3 c = side > 0.0 ? uEyeL : uEyeR;
            vec3 n = normalize((vRest - c) / uEyeHalf);                               // direction on the unit eyeball
            vec3 g = normalize(vec3(uGaze.x - side * 0.045, uGaze.y, 1.0));           // gaze, eyes converging a little
            float ang = acos(clamp(dot(n, g), -1.0, 1.0));
            vec3 tx = normalize(cross(vec3(0.0, 1.0, 0.0), g)), ty = cross(g, tx);
            float az = atan(dot(n, ty), dot(n, tx));
            const float IRIS = 0.62; float PUP = 0.25 * uPupil;
            // sclera: warm white, shaded under the upper lid and towards the corners
            vec3 col = mix(vec3(0.97, 0.95, 0.93), vec3(0.66, 0.58, 0.60), smoothstep(0.15, 1.0, n.y) * 0.55 + smoothstep(0.55, 1.0, abs(n.x)) * 0.35);
            // iris: dark rim, clear blue body, lighter towards the pupil, soft rays
            float t = clamp(ang / IRIS, 0.0, 1.0);
            float rays = 0.5 + 0.5 * sin(az * 22.0 + sin(az * 7.0) * 1.3);
            vec3 iris = mix(uIrisIn, uIrisOut, smoothstep(0.30, 0.95, t));
            iris = mix(iris, iris * 1.25, rays * 0.25 * (1.0 - t));
            iris = mix(iris, uIrisOut * 0.32 + vec3(0.004), smoothstep(0.80, 1.0, t));       // limbal ring (10-04: of the iris's own colour)
            iris *= mix(0.72, 1.08, smoothstep(0.75, -0.75, dot(n, ty)));             // darker under the upper lid, lit from below
            col = mix(col, iris, 1.0 - smoothstep(IRIS - 0.025, IRIS + 0.012, ang));
            col = mix(col, vec3(0.012, 0.012, 0.03), 1.0 - smoothstep(PUP - 0.02, PUP + 0.015, ang));
            // catch-lights: one large upper-left (her right), one small lower-right, fixed on the eyeball
            vec3 h1 = normalize(g + tx * -0.30 + ty * 0.30), h2 = normalize(g + tx * 0.26 + ty * -0.24);
            float k1 = 1.0 - smoothstep(0.10, 0.155, acos(clamp(dot(n, h1), -1.0, 1.0)));
            float k2 = 1.0 - smoothstep(0.035, 0.07, acos(clamp(dot(n, h2), -1.0, 1.0)));
            eyeExtra = vec3(1.0) * (k1 * 0.95 + k2 * 0.6);
            diffuseColor.rgb = col * uGain;
          }`)
        .replace('#include <opaque_fragment>', 'outgoingLight += eyeExtra;\n#include <opaque_fragment>');
    };
  }

  const glove = (m) => { m.color.setRGB(0.080, 0.024, 0.22); m.roughness = 0.36; m.envMapIntensity = 0.5; };
  // Cloth lies ON her: where her skin comes within a few millimetres of the suit from underneath (the fold of the armpit
  // with an arm held across her, the top of a thigh drawn up) the two surfaces crossed each other in a ragged line.
  // The suit is drawn as if it were that little nearer the eye (its depth only; nothing moves on the screen).
  const depthBias = (m, mm) => {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 nearer = projectionMatrix * (mvPosition + vec4(0.0, 0.0, ${(mm / 1000).toFixed(5)}, 0.0)); gl_Position.z = nearer.z / nearer.w * gl_Position.w; }`);
    };
    const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.customProgramCacheKey = () => key + '|bias' + mm;
  };
  // (10-04) what the player's look recolours: her own materials by part, and each one's colour as built (a twin made from
  // her takes those, never hers of the moment)
  const lookMats = { suit: [], trim: [], glove: [], choker: [], hat: [], band: [], brow: [], hair: [], skirt: [], belt: [], apron: [], cape: [] }, builtColor = {};
  const part = (m, k) => { lookMats[k].push(m); if (!builtColor[m.name]) builtColor[m.name] = m.color.clone(); };
  const suit = (m) => { m.color.setRGB(0.42, 0.170, 0.005); m.roughness = 0.6; m.metalness = 0; m.envMapIntensity = ENV; part(m, 'suit');
    // (10-04: below a rest height the suit can take a second colour: a top and shorts, a bodice and a skirt's own colour)
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uSuit2: U.suit2, uCutN: U.cutN, uCutM: U.cutM, uPat: U.pat, uPatS: U.patS });
      sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;');
      // (batch 22: what the outfit's cut bares is not drawn here: the same shape is drawn there as her skin, see suitBare; a
      // darker edge along every cut; a pattern in the cloth, all of it or only above / below the split)
      sh.fragmentShader = 'varying vec3 vRest;\nuniform vec4 uSuit2, uPat;\nuniform vec2 uPatS;\n' + CUT_GLSL + PAT_GLSL + sh.fragmentShader.replace('#include <clipping_planes_fragment>', 'if (bareW(vRest, 0.0015) > 0.5) discard;\n#include <clipping_planes_fragment>').replace('#include <color_fragment>', `#include <color_fragment>
        float low = 1.0 - smoothstep(uSuit2.a - 0.003, uSuit2.a + 0.003, vRest.y);
        if (uSuit2.a > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, uSuit2.rgb, low);
        if (uPat.a > 0.5 && (uPatS.y < 0.5 || (uPatS.y < 1.5 ? low < 0.5 : low > 0.5))) diffuseColor.rgb = mix(diffuseColor.rgb, uPat.rgb, patAt(uPat, uPatS.x, vRest));
        diffuseColor.rgb *= 1.0 - 0.34 * smoothstep(0.0, 0.5, bareW(vRest, 0.011));`);
    };
    if (m.name === 'Anne_Suit') depthBias(m, 6);
    // (a twin's suit is a clone with the depth bias alone: the two must not share one compiled program, or the twin is drawn with HER cut and pattern)
    { const k = m.customProgramCacheKey(); m.customProgramCacheKey = () => k + '|suitlook'; } };
  const nails = [];                                    // her nail materials (setNailColor)
  const shoeMats = { upper: [], sole: [] };            // her shoes' materials, on her feet and on every loose shoe (setShoeColor)
  const nail = (m) => { m.color.setRGB(0.10, 0.03, 0.24); m.roughness = 0.15; m.envMapIntensity = 1.1; nails.push(m); if (!builtColor[m.name]) builtColor[m.name] = m.color.clone();
    m.onBeforeCompile = (sh) => {                         // (her toenails too are not drawn inside a closed shoe)
      sh.uniforms.uToeBox = U.toeBox;
      sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;');
      sh.fragmentShader = 'varying vec3 vRest;\nuniform vec4 uToeBox;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>',
        'if (uToeBox.x > 0.0 && vRest.z > uToeBox.x && vRest.y < uToeBox.y && (vRest.x > 0.0 ? uToeBox.z : uToeBox.w) > 0.5) discard;\n#include <clipping_planes_fragment>');
    }; };
  const tune = {
    Anne_Teeth: (m) => { m.map = null; m.color.setRGB(0.80, 0.78, 0.74); m.emissive.setRGB(0.42, 0.41, 0.39); m.roughness = 0.6; m.envMapIntensity = 0.2; },   // one clean, softly lit band
    Anne_Tongue: (m) => { m.map = null; m.color.setRGB(0.80, 0.30, 0.33); m.roughness = 0.45; m.envMapIntensity = 0.3; },
    Anne_Nail: nail, Anne_NailShod: nail,
    Anne_Hair: (m) => { m.vertexColors = true; m.map = null; m.color.setScalar(HAIR_GAIN); m.roughness = 0.5; m.metalness = 0; m.envMapIntensity = ENV * 1.2; m.side = THREE.DoubleSide; part(m, 'hair');
      // (10-04: her hair in any colour: the strands' painted light and dark stay as its shade, the colour is the player's)
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uHairCol: U.hairCol, uHairOn: U.hairOn });
        sh.fragmentShader = 'uniform vec3 uHairCol;\nuniform float uHairOn;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          if (uHairOn > 0.0) { float l = dot(vColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, uHairCol * clamp(0.62 + l * 2.2, 0.62, 1.15), uHairOn); }`);
      }; },
    Anne_Brow: (m) => { m.color.setRGB(0.085, 0.030, 0.011); m.roughness = 0.9; m.envMapIntensity = 0; part(m, 'brow'); },
    Anne_Gum: (m) => { m.map = null; m.color.setRGB(0.42, 0.11, 0.13); m.roughness = 0.5; m.envMapIntensity = 0.2; },
    Anne_Lash: (m) => { m.color.setRGB(0.03, 0.012, 0.008); m.roughness = 1; m.envMapIntensity = 0; m.side = THREE.DoubleSide; },
    Anne_Suit: suit, Anne_SuitPaint: suit,
    Anne_Trim: (m) => { m.color.setRGB(0.50, 0.30, 0.04); m.roughness = 0.35; m.metalness = 0.5; m.envMapIntensity = 0.9; depthBias(m, 6); part(m, 'trim'); },
    Anne_Glove: (m) => { glove(m); part(m, 'glove'); }, Anne_GlovePaint: (m) => { glove(m); part(m, 'glove'); },
    Anne_Choker: (m) => { m.color.setRGB(0.080, 0.024, 0.22); m.roughness = 0.45; m.envMapIntensity = 0.4; part(m, 'choker'); },
    Anne_Gem: (m) => { m.color.setRGB(0.86, 0.60, 0.12); m.roughness = 0.2; m.metalness = 0.8; },
    Anne_Hat: (m) => { m.vertexColors = true; m.map = null; m.color.setScalar(0.70); m.roughness = 0.75; m.metalness = 0; m.envMapIntensity = ENV; m.side = THREE.DoubleSide; part(m, 'hat');
      // (the underside of the brim frames her face and is always in shade: a little light of its own keeps it purple, as in her portraits)
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.5;'); }; },
    // (10-04: the loose pieces an outfit can add; a skirt is seen from inside too, and each lies over what is under it)
    Anne_Skirt: (m) => { m.color.setRGB(0.42, 0.170, 0.005); m.roughness = 0.65; m.metalness = 0; m.envMapIntensity = ENV; m.side = THREE.DoubleSide; depthBias(m, 9); part(m, 'skirt');
      const prev = m.onBeforeCompile;                     // (batch 22: a pattern in the skirt's cloth)
      m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
        Object.assign(sh.uniforms, { uPat: U.patK, uPatS: U.patKS, uSkirtLow: U.skirtLow });
        sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;');
        // (a gown is gathered up to her knees wherever her feet are what the picture is about: not drawn below uSkirtLow)
        sh.fragmentShader = 'varying vec3 vRest;\nuniform vec4 uPat;\nuniform vec2 uPatS;\nuniform float uSkirtLow;\n' + PAT_GLSL + sh.fragmentShader.replace('#include <clipping_planes_fragment>', 'if (vRest.y < uSkirtLow) discard;\n#include <clipping_planes_fragment>').replace('#include <color_fragment>', '#include <color_fragment>\n  if (uPat.a > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, uPat.rgb, patAt(uPat, uPatS.x, vRest));\n  diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(uSkirtLow, uSkirtLow + 0.02, vRest.y)) * step(0.01, uSkirtLow);'); };
      const key = m.customProgramCacheKey(); m.customProgramCacheKey = () => key + '|pat'; },
    Anne_Apron: (m) => { m.color.setRGB(0.80, 0.78, 0.74).multiplyScalar(0.6); m.roughness = 0.65; m.metalness = 0; m.envMapIntensity = ENV; m.side = THREE.DoubleSide; depthBias(m, 12); part(m, 'apron'); },
    Anne_Cape: (m) => { m.color.setRGB(0.080, 0.024, 0.22); m.roughness = 0.6; m.metalness = 0; m.envMapIntensity = ENV; m.side = THREE.DoubleSide; depthBias(m, 4); part(m, 'cape'); },
    Anne_Belt: (m) => { m.color.setRGB(0.10, 0.05, 0.02); m.roughness = 0.5; m.metalness = 0; m.envMapIntensity = ENV; depthBias(m, 13); part(m, 'belt'); },
    Anne_Buckle: (m) => { m.color.setRGB(0.50, 0.30, 0.04); m.roughness = 0.3; m.metalness = 0.6; m.envMapIntensity = 0.9; depthBias(m, 13); part(m, 'trim'); },
    Anne_HatBand: (m) => { m.color.setRGB(0.50, 0.30, 0.04); m.roughness = 0.35; m.metalness = 0.5; m.envMapIntensity = 0.9; part(m, 'band'); },
    Anne_HeelPurple: (m) => { m.color.setRGB(0.065, 0.016, 0.17); m.roughness = 0.14; m.envMapIntensity = 1.2; m.side = THREE.DoubleSide; shoeMats.upper.push(m); if (!builtColor[m.name]) builtColor[m.name] = m.color.clone(); },
    Anne_HeelSole: (m) => { m.color.setRGB(0.04, 0.012, 0.08); m.roughness = 0.5; m.side = THREE.DoubleSide; shoeMats.sole.push(m); if (!builtColor[m.name]) builtColor[m.name] = m.color.clone(); },
  };
  const seen = new Set(), shod = [];                   // shod: the skin inside her shoes (hidden while they are on)
  const styleMaterial = (m) => {
    if (!m || seen.has(m)) return; seen.add(m);
    // the exported file gives cloth and hair a white sheen and makes every surface two-sided: neither is wanted here
    if (m.sheen !== undefined) m.sheen = 0;
    if (m.clearcoat !== undefined && !/Heel|Nail/.test(m.name)) m.clearcoat = 0;
    m.side = THREE.FrontSide;
    if (m.name === 'Anne_Skin' || m.name === 'Anne_SkinShod') skinMaterial(m);
    else if (m.name === 'Anne_Eye') eyeMaterial(m);
    else if (tune[m.name]) tune[m.name](m);
    m.needsUpdate = true;
  };
  anne.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    for (const m of [].concat(o.material)) styleMaterial(m);
    if (/Lash|Brow|Eyes/.test(o.name)) o.castShadow = false;
    if (/Shod$/.test((o.material && o.material.name) || '')) { shod.push(o); o.visible = false; }
  });
  if (heelGltf) heelGltf.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) styleMaterial(m); });
  if (propsGltf) propsGltf.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) styleMaterial(m); });
  scene.add(anne);

  // ---------- animation: every clip always plays; weights blend (locomotion) or cross-fade to one clip (scenes) ----------
  const mixer = new THREE.AnimationMixer(anne);
  const actions = {}, weights = {};
  // The export's keys start at frame 1 = 1/24 s: moved to 0, or every loop would rest a frame at its seam. The loader
  // hands many tracks ONE shared array of key times, so each array is moved once (moving it per track moved it hundreds
  // of times and froze her legs).
  const movedTimes = new Set();
  for (const clip of gltf.animations) {
    for (const tr of clip.tracks) {
      if (movedTimes.has(tr.times)) continue; movedTimes.add(tr.times);
      const t0 = tr.times[0]; if (t0 > 1e-4 && t0 < 0.06) for (let i = 0; i < tr.times.length; i++) tr.times[i] -= t0;
    }
    clip.resetDuration();
    const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); actions[clip.name] = a; weights[clip.name] = 0;
  }
  weights.Idle = 1;
  const FLASH = ['IdleTiptoe', 'IdleTiptoeR', 'IdleCross', 'IdleCrossR'];      // (10-02: the sole flashes: her heel up out of her shoe)
  const ONE_SHOT = new Set(['Stomp', 'StompBare', 'SitPutOn', 'MimPutOn', 'Startle', 'Cast', 'SitUp', 'FallBack', 'Flop', 'CampWake', 'CampLie', 'HoleKickout', 'IdleLook', ...FLASH, ...FLASH.map((n) => n + 'Hi')]);
  for (const n of ONE_SHOT) if (actions[n]) { actions[n].setLoop(THREE.LoopOnce, 1); actions[n].clampWhenFinished = true; }
  // ---------- her shoes: several styles (tools/anne2/s2_sandals.py STYLES), one worn at a time ----------
  // All of them are in the model; the first (her strappy sandals) keeps the names Anne_Heel_L / R. The flat ones share a
  // sole, so they share her clips. The two with a high heel pitch her feet further (dtheta, toes flat) and lift her:
  // that is added to whatever clip plays, here (heelPose below). The loose shoes the scenes throw about are copies of
  // ONE object (heelProp): changing style puts the new style's shape into the geometry those copies share.
  const SHOES = metrics.shoes && metrics.shoes.order ? metrics.shoes : { order: ['sandal'], styles: { sandal: { label: 'Strappy sandals', heel: false, closed: false, dthetaDeg: 0, lift: 0 } } };
  const shoeNodes = {};
  SHOES.order.forEach((id, i) => { shoeNodes[id] = (i ? [`Anne_Shoe_${id}_L`, `Anne_Shoe_${id}_R`] : ['Anne_Heel_L', 'Anne_Heel_R']).map((n) => anne.getObjectByName(n)).filter(Boolean); });
  let shoeStyle = SHOES.order[0];
  const styleNow = () => SHOES.styles[shoeStyle] || {};
  const meshesOf = (o) => { const a = []; if (o) o.traverse((c) => { if (c.isMesh) a.push(c); }); return a; };
  const propMeshes = meshesOf(heelGltf && heelGltf.scene), propGeo = {};
  propGeo[SHOES.order[0]] = propMeshes.map((m) => m.geometry.clone());
  if (propsGltf) for (const id of SHOES.order.slice(1)) { const g = meshesOf(propsGltf.scene.getObjectByName('Anne_ShoeProp_' + id)).map((m) => m.geometry); if (g.length === propMeshes.length) propGeo[id] = g; }
  const heelNodes = shoeNodes[SHOES.order[0]];
  let exclusiveClip = null, clipFade = 0.25, heelsWorn = true;
  // without her shoes she stands and walks flat-footed: Idle and Walk resolve to the barefoot clips
  // (barefoot: a clip's ...Bare version if it has one; in high heels: its ...Hi version, made for them, if it has one)
  const resolve = (name) => (!heelsWorn && actions[name + 'Bare'] ? name + 'Bare' : heelsWorn && styleNow().heel && actions[name + 'Hi'] ? name + 'Hi' : name);
  function playClip(name, fade = 0.3) {
    const real = resolve(name);
    if (!actions[real]) { console.warn('missing clip', name); return; }
    if (exclusiveClip !== name && (weights[real] < 0.05 || ONE_SHOT.has(real))) { actions[real].reset(); actions[real].play(); }
    exclusiveClip = name; clipFade = Math.max(0.05, fade);
    if (!actions[real].isScheduled()) actions[real].play();
    if (fade <= 0) for (const n in actions) { weights[n] = n === real ? 1 : 0; actions[n].setEffectiveWeight(weights[n]); }
  }
  function releaseClips() { exclusiveClip = null; clipFade = 0.3; }
  // (her shoes can come off one at a time: setShoe('L' | 'R', on). heelsWorn: both are on. `shod` is skin that only shows barefoot: the pumps had some, her sandals have none.)
  const worn = { L: true, R: true };
  const showShoes = () => {
    heelsWorn = worn.L && worn.R;
    for (const id of SHOES.order) for (const h of shoeNodes[id]) h.visible = id === shoeStyle && worn[h.name.slice(-1)] !== false;
    shod.forEach((o) => { o.visible = !heelsWorn; });
    const hd = styleNow().closed && styleNow().hide;      // (a closed shoe: her forefoot is not drawn inside it)
    if (hd) U.toeBox.value.set(hd[0], hd[1], worn.L ? 1 : 0, worn.R ? 1 : 0); else U.toeBox.value.set(0, 0, 0, 0);
  };
  function setShoeStyle(id) {
    if (!SHOES.styles[id] || !shoeNodes[id] || !shoeNodes[id].length) return false;
    shoeStyle = id; showShoes();
    const g = propGeo[id]; if (g) propMeshes.forEach((m, i) => { m.geometry.copy(g[i]); });      // every loose shoe in the game takes the new shape
    return true;
  }
  // her shoes' colour (any CSS colour): the straps or the upper, and the sole (left out: a darker shade of the same)
  const _sc = new THREE.Color();
  function setShoeColor(upper, sole) {
    _sc.set(upper); for (const m of shoeMats.upper) m.color.copy(_sc).multiplyScalar(0.5);
    if (sole) { _sc.set(sole); for (const m of shoeMats.sole) m.color.copy(_sc).multiplyScalar(0.5); }
    else for (const m of shoeMats.sole) m.color.copy(_sc).multiplyScalar(0.2);
  }
  function setHeelsWorn(on) { worn.L = worn.R = !!on; showShoes(); }
  function setShoe(side, on) { worn[side] = !!on; showShoes(); }
  // her toenails' colour (any CSS colour); the game keeps the player's choice
  function setNailColor(c) { for (const m of nails) m.color.set(c); }
  // her hat can be taken off (asleep by the fire, knocked off by a vine): the story shows a loose one where it lies
  // (10-04: and the player's look may have no hat at all: `hatWorn`; then there is none to take off or to lie about)
  const hatNodes = ['Anne_Hat', 'Anne_HatBand'].map((n) => anne.getObjectByName(n)).filter(Boolean);
  let hatOn = true, hatWorn = true;
  function setHat(on) { hatOn = !!on; hatNodes.forEach((h) => { h.visible = hatOn && hatWorn; }); }

  // ---------- (10-04, as he asked) her look: the player makes her their own at the start of the game ----------
  // Skin tone, eye colour, hair colour and style, the outfit's colours and parts, the shape of her face. Colours are
  // CSS colours as the player sees them (display colours); under this sun a surface is about half as bright (the
  // gains below). Everything here is hers alone: a twin (Lilith, Boudicca, the thief) keeps the looks it was given.
  const SKIN_BUILT = new THREE.Color('#fde9e3'), HAT_BUILT = new THREE.Color('#6b3bab'), _lc = new THREE.Color();
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  function setSkinTone(css) {
    _lc.set(css || '#fde9e3');
    U.tone.value.set(_lc.r / SKIN_BUILT.r, _lc.g / SKIN_BUILT.g, _lc.b / SKIN_BUILT.b);
    U.toneDeep.value = clamp(1 - lum(_lc) / lum(SKIN_BUILT), 0, 1);
  }
  function setEyeColor(css) {       // the iris: lighter towards the pupil, darker at its rim
    if (!css) { U.irisIn.value.set(0.24, 0.62, 1.00); U.irisOut.value.set(0.02, 0.16, 0.66); return; }
    _lc.set(css); const l = lum(_lc);
    U.irisIn.value.set(_lc.r, _lc.g, _lc.b).multiplyScalar(1.35).addScalar(0.035 + 0.05 * l);
    U.irisOut.value.set(_lc.r, _lc.g, _lc.b).multiplyScalar(0.42);
  }
  function setHairColor(css) {      // null: the painted auburn
    if (!css) { U.hairOn.value = 0; for (const m of lookMats.brow) m.color.copy(builtColor[m.name]); return; }
    _lc.set(css); U.hairCol.value.set(_lc.r, _lc.g, _lc.b).multiplyScalar(HAIR_GAIN); U.hairOn.value = 1;
    const k = Math.min(0.24, 0.07 / Math.max(0.05, lum(_lc)));      // her brows: the same colour, darker (never lighter than a mid brown)
    for (const m of lookMats.brow) m.color.setRGB(_lc.r * k + 0.004, _lc.g * k + 0.003, _lc.b * k + 0.002);
  }
  // the outfit's colours: { suit, suit2 (below `split` metres of the rest pose, or null), split, trim, glove, choker, hat, band }
  const GAIN = { suit: 0.47, trim: 0.8, glove: 0.78, choker: 0.78, band: 0.8, skirt: 0.47, belt: 0.5, apron: 0.55, cape: 0.47 };
  function setOutfitColors(o = {}) {
    for (const k of ['suit', 'trim', 'glove', 'choker', 'band', 'skirt', 'belt', 'apron', 'cape']) {
      if (o[k] === undefined) continue;
      for (const m of lookMats[k]) { if (o[k]) { _lc.set(o[k]); m.color.copy(_lc).multiplyScalar(GAIN[k]); } else m.color.copy(builtColor[m.name]); }
    }
    if (o.hat !== undefined) for (const m of lookMats.hat) { if (o.hat) { _lc.set(o.hat); m.color.setRGB(0.7 * _lc.r / HAT_BUILT.r, 0.7 * _lc.g / HAT_BUILT.g, 0.7 * _lc.b / HAT_BUILT.b); } else m.color.setScalar(0.70); }      // (the hat is painted on its points: top and underside)
    if (o.suit2 !== undefined || o.split !== undefined) {
      if (o.suit2 && o.split > 0) { _lc.set(o.suit2); U.suit2.value.set(_lc.r * GAIN.suit, _lc.g * GAIN.suit, _lc.b * GAIN.suit, o.split); } else U.suit2.value.set(0, 0, 0, 0);
    }
  }
  // her arms: 'gloves' (the long gloves and their cuffs), 'bare', or 'bracers' (bare, a band of `bandColor` on each forearm)
  const gloveMeshes = [], cuffNodes = ['Anne_Cuffs', 'Anne_CuffTrim'].map((n) => anne.getObjectByName(n)).filter(Boolean); let bareMat = null;
  anne.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'Anne_GlovePaint') gloveMeshes.push({ o, glove: o.material }); });
  // (batch 22: 'sleeves' = bare hands and a band the whole length of the forearm, the lower half of a long sleeve; `ends`: the band's own start and end, elbow 0 to wrist 1)
  function setArms(kind = 'gloves', bandColor = null, ends = null) {
    const bare = kind !== 'gloves';
    { const E = ends || (kind === 'sleeves' ? [-0.3, 0.93] : [0.10, 0.90]); U.bandEnds.value.set(E[0], E[1]); }
    if (bare && !bareMat && gloveMeshes.length) { bareMat = gloveMeshes[0].glove.clone(); bareMat.name = 'Anne_GlovePaint'; skinMaterial(bareMat); bareMat.roughness = skinFinish.rough; bareMat.metalness = skinFinish.metal; bareMat.side = THREE.FrontSide; bareMat.needsUpdate = true; }
    for (const g of gloveMeshes) g.o.material = bare && bareMat ? bareMat : g.glove;
    for (const c of cuffNodes) c.visible = !bare;
    if ((kind === 'bracers' || kind === 'sleeves') && bandColor) { _lc.set(bandColor); U.band.value.set(_lc.r * 0.6, _lc.g * 0.6, _lc.b * 0.6, 1); } else U.band.value.set(0, 0, 0, 0);
  }
  // sleeves painted on her upper arms: a colour and how far down they come (0.4 short, 1.05 to the elbow and under the forearm's band)
  function setTrimLow(y = 0) { U.trimLow.value = y; }
  // a gown gathered up: nothing of a skirt below `y` (rest height) is drawn, nor the bead along a long hem; 0 lets it down again
  let skirtUp = -1; const maxiTrim = anne.getObjectByName('Anne_SkirtMaxiTrim'), maxi = anne.getObjectByName('Anne_SkirtMaxi');
  function setSkirtLift(y = 0) { if (y === skirtUp) return; skirtUp = y; U.skirtLow.value = y; if (maxiTrim) maxiTrim.visible = !!(maxi && maxi.visible) && !y; }
  function setSleeves(color = null, len = 1.05) { if (!color) { U.sleeve.value.set(0, 0, 0, 0); return; } _lc.set(color); U.sleeve.value.set(_lc.r * 0.6, _lc.g * 0.6, _lc.b * 0.6, len); }
  // her legs: 'bare', or stockings of `color` from her ankles up to `top` metres of the rest pose (her feet stay bare)
  // (batch 22: `make`: 'net' (fishnets), 'hoops' (rings of `color2`), 'sheer' (her skin shows through); `size` in metres)
  const SOCKS = { net: 1, hoops: 2, sheer: 3 };
  function setLegs(color = null, top = 0.62, make = null, color2 = null, size = 0.03) {
    if (!color) { U.sock.value.set(0, 0, 0, 0); U.sock2.value.set(0, 0, 0, 0); return; }
    _lc.set(color); U.sock.value.set(_lc.r * 0.55, _lc.g * 0.55, _lc.b * 0.55, top); U.sockLow.value = 0.085;
    if (color2) _lc.set(color2); U.sock2.value.set(_lc.r * 0.55, _lc.g * 0.55, _lc.b * 0.55, SOCKS[make] || 0); U.sockS.value = size;
  }
  function setHatWorn(on) { hatWorn = !!on; setHat(hatOn); }
  // the parts an outfit adds or leaves off (nodes of the model, when it has them): { Anne_Skirt: true, ... }
  const PARTS = /^Anne_(Skirt(Long|Tube|Pencil|Maxi)?|Tutu|Panels|Apron|Cape|Belt)(Trim)?$/;
  function setParts(o = {}) { for (const n in o) { const node = anne.getObjectByName(n); if (node) node.visible = !!o[n]; } if (typeof skirtUp === 'number' && skirtUp > 0) { const t = anne.getObjectByName('Anne_SkirtMaxiTrim'); if (t) t.visible = false; } }
  anne.traverse((o) => { if (PARTS.test(o.name)) o.visible = false; });
  // ---------- (batch 22) her outfit's cut: what of her suit is bare ----------
  // The skin under her suit is not in the model (it would show through in every pose), so a bare midriff, a lower neckline
  // or a high leg line is the suit's OWN surface drawn as her skin: a second mesh on the same geometry and bones with her
  // skin's material, drawn where the cut says bare (and a little way under the cloth's edge, so that no gap opens) and
  // sunk to where her skin was. The suit itself is not drawn there (`suit` above), nor is the bead along its hems.
  // Her chest and her seat are never bare: looks.js keeps every cut to what a swimsuit covers, or more.
  let suitBare = null;
  {
    const sm = anne.getObjectByName('Anne_Suit'); let skinSrc = null, skinMesh = null;
    anne.traverse((o) => { if (!skinSrc && o.isSkinnedMesh && o.material && o.material.name === 'Anne_Skin') { skinSrc = o.material; skinMesh = o; } });
    if (sm && sm.isSkinnedMesh && skinSrc) {
      const g = sm.geometry;
      if (!g.attributes.color) {                         // her skin's painted colour, as on her thighs
        const c = [0, 0, 0]; let n = 0; const P = skinMesh.geometry.attributes.position, Cc = skinMesh.geometry.attributes.color;
        if (Cc) for (let i = 0; i < P.count; i += 3) { const y = P.getY(i); if (y > 0.55 && y < 0.78) { c[0] += Cc.getX(i); c[1] += Cc.getY(i); c[2] += Cc.getZ(i); n++; } }
        const col = n ? c.map((v) => v / n) : [0.95, 0.80, 0.74], a = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < a.length; i += 3) { a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
      // The suit's own hems (its turned-in rim and the two rings of faces next to it): her real skin is still under those
      // (the model keeps a ring of it at every opening), so the bare mesh is not drawn there: no ridge where a hem was.
      if (g.index && !g.attributes.aHem) {
        const P = g.attributes.position, I = g.index.array, id = new Map(), vid = new Int32Array(P.count);
        for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); if (!id.has(k)) id.set(k, id.size); vid[i] = id.get(k); }
        const edges = new Map();
        for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = vid[I[t + e]], b = vid[I[t + (e + 1) % 3]], k = a < b ? a * 1e6 + b : b * 1e6 + a; edges.set(k, (edges.get(k) || 0) + 1); }
        const hem = new Uint8Array(id.size); for (const [k, n] of edges) if (n === 1) { hem[Math.floor(k / 1e6)] = 1; hem[k % 1e6] = 1; }
        for (let ring = 0; ring < 2; ring++) { const add = []; for (let t = 0; t < I.length; t += 3) { const a = vid[I[t]], b = vid[I[t + 1]], c = vid[I[t + 2]]; if (hem[a] || hem[b] || hem[c]) add.push(a, b, c); } for (const v of add) hem[v] = 1; }
        const H = new Float32Array(P.count); for (let i = 0; i < P.count; i++) H[i] = hem[vid[i]]; g.setAttribute('aHem', new THREE.BufferAttribute(H, 1));
      }
      const mat = skinSrc.clone(); mat.name = 'Anne_SuitBare'; skinMaterial(mat); const inner = mat.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => {
        inner(sh, r); Object.assign(sh.uniforms, { uCutN: U.cutN, uCutM: U.cutM });
        sh.vertexShader = 'attribute float aHem;\nvarying float vHem;\n' + CUT_GLSL + sh.vertexShader.replace('vRest = position; vRestN = normal;', 'vRest = position; vRestN = normal; vHem = aHem;\n  transformed -= normal * 0.0031 * bareW(position, 0.02);');
        sh.fragmentShader = 'varying float vHem;\n' + CUT_GLSL + sh.fragmentShader.replace('#include <clipping_planes_fragment>', 'if (bareW(vRest, 0.006) < 0.2 || vHem > 0.5) discard;\n#include <clipping_planes_fragment>');
      };
      mat.customProgramCacheKey = () => 'suitbare'; mat.side = THREE.FrontSide; mat.needsUpdate = true;
      suitBare = new THREE.SkinnedMesh(g, mat); suitBare.name = 'Anne_SuitBare'; suitBare.bind(sm.skeleton, sm.bindMatrix);
      suitBare.position.copy(sm.position); suitBare.quaternion.copy(sm.quaternion); suitBare.scale.copy(sm.scale);
      suitBare.castShadow = false; suitBare.receiveShadow = true; suitBare.frustumCulled = false; suitBare.visible = false; sm.parent.add(suitBare);
    }
    const st = anne.getObjectByName('Anne_SuitTrim');   // the bead along the suit's hems: a material of its own (the skirts' beads share the other), not drawn where the cut is bare
    if (st && st.isMesh && st.material && tune.Anne_Trim) {
      const m = st.material.clone(); m.name = 'Anne_Trim'; if (m.sheen !== undefined) m.sheen = 0; m.side = THREE.FrontSide; tune.Anne_Trim(m);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
        Object.assign(sh.uniforms, { uCutN: U.cutN, uCutM: U.cutM, uTrimLow: U.trimLow });
        sh.vertexShader = 'varying vec3 vRestT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRestT = position;');
        sh.fragmentShader = 'varying vec3 vRestT;\nuniform float uTrimLow;\n' + CUT_GLSL + sh.fragmentShader.replace('#include <clipping_planes_fragment>', 'if (bareW(vRestT, 0.012) > 0.12 || vRestT.y < uTrimLow) discard;\n#include <clipping_planes_fragment>'); };
      const key = m.customProgramCacheKey(); m.customProgramCacheKey = () => key + '|cut'; m.needsUpdate = true; st.material = m;
    }
  }
  // ---------- (batch 23, as he asked) her body's width and its length ----------
  // Length: the whole of her is scaled (her height; whatever rides on her bones goes with her).
  // Width: every bone from her shoulders to her calves holds its skin that much further from (or nearer to) its own line:
  // the bones' inverse bind matrices are scaled ACROSS the bone, in the bone's own space. No joint moves, so every clip,
  // marker and scene keeps its places; her head, hands and feet keep their size (and so do her shoes).
  // A twin shares the model's inverse bind matrices by reference (SkeletonUtils.clone -> Skeleton.clone): makeTwin gives
  // each twin the built ones back (PRISTINE).
  const PRISTINE = new Map();                          // a skeleton's boneInverses array -> copies of the matrices as built
  const BODYK = (n) => (/^(root|spine0[1-5]|pelvis[LR]|breast[LR]|clavicle[LR]|shoulder01[LR]|upperarm0[12][LR]|upperleg0[12][LR])$/.test(n) ? 1 : /^(lowerarm01|lowerleg01)[LR]$/.test(n) ? 0.9 : /^lowerarm02[LR]$/.test(n) ? 0.5
    : /^lowerleg02[LR]$/.test(n) ? 0.35 : n === 'neck01' ? 0.5 : /^neck0[23]$/.test(n) ? 0.2 : 0);
  const bodySkels = []; anne.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && !PRISTINE.has(o.skeleton.boneInverses)) { PRISTINE.set(o.skeleton.boneInverses, o.skeleton.boneInverses.map((m) => m.clone())); bodySkels.push(o.skeleton); } });
  const bodyNow = { w: 1, h: 1 }, _bs = new THREE.Matrix4(), _ba = new THREE.Vector3();
  function setBody(w = 1, h = 1) {
    w = Math.max(0.85, Math.min(1.18, +w || 1)); h = Math.max(0.9, Math.min(1.1, +h || 1));
    if (h !== bodyNow.h) { anne.scale.setScalar(h); bodyNow.h = h; }
    if (w === bodyNow.w) return;
    bodyNow.w = w;
    for (const sk of bodySkels) {
      const P0 = PRISTINE.get(sk.boneInverses);
      sk.bones.forEach((b, i) => {
        const k = BODYK(b.name), inv = sk.boneInverses[i]; inv.copy(P0[i]); if (!k) return;
        // the bone's own line: towards where its child bones start (straight up its Y if it has none)
        _ba.set(0, 0, 0); let n = 0; for (const c of b.children) if (c.isBone) { _ba.add(c.position); n++; }
        if (!n || _ba.lengthSq() < 1e-10) _ba.set(0, 1, 0); _ba.normalize();
        const f = 1 + (w - 1) * k, g = 1 - f, x = _ba.x, y = _ba.y, z = _ba.z;      // f across the line, 1 along it: f * I + (1 - f) * a a^T
        _bs.set(f + g * x * x, g * x * y, g * x * z, 0, g * y * x, f + g * y * y, g * y * z, 0, g * z * x, g * z * y, f + g * z * z, 0, 0, 0, 0, 1);
        inv.premultiply(_bs);
      });
    }
  }
  // what an outfit bares of her suit, in metres of the rest pose (nothing given: nothing bare):
  //   neck: bare above this height at her middle; slope: ... rising by this per metre to her sides (a V);
  //   back: the same line at her back (default: as in front; 9: her back stays covered); straps: two straps kept at this |x|;
  //   mid: [from, to] a bare midriff; leg: a leg line, bare below this height at her middle, rising by legSlope per metre to her sides
  function setCut(o = {}) {
    const m = o.mid || [0, 0];
    U.cutN.value.set(o.neck || 0, o.slope || 0, o.back || 0, o.straps || 0); U.cutM.value.set(m[0], m[1], o.leg || 0, o.legSlope || 0);
    if (suitBare) suitBare.visible = (o.neck || 0) > 0 || m[1] > m[0] || (o.leg || 0) > 0;
  }
  // a pattern in the cloth: setPattern('suit' | 'skirt', 'hoops' | 'stripes' | 'dots' | 'plaid' | 'scales' | null, colour, size in metres, zone (suit: 0 all, 1 above the split, 2 below))
  const PATS = { hoops: 1, stripes: 2, dots: 3, plaid: 4, scales: 5 };
  function setPattern(where, kind = null, color = null, size = 0.04, zone = 0) {
    const u = where === 'skirt' ? U.patK : U.pat, us = where === 'skirt' ? U.patKS : U.patS, k = PATS[kind] || 0;
    if (!k || !color) { u.value.set(0, 0, 0, 0); return; }
    _lc.set(color); u.value.set(_lc.r * GAIN.suit, _lc.g * GAIN.suit, _lc.b * GAIN.suit, k); us.value.set(size, zone);
  }
  // what her skin is made of (a robot: metal 0.85, rough 0.3) and a light of its own (a ghost): every skin material she has
  const skinMats = () => { const set = new Set(); anne.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && /^Anne_(Skin|SkinShod|SuitBare)$/.test(m.name)) set.add(m); }); if (bareMat) set.add(bareMat); for (const sh of shod) for (const m of [].concat(sh.material)) set.add(m); return set; };
  let skinFinish = { metal: 0, rough: 0.55 };
  function setSkinFinish(o = {}) { skinFinish = { metal: o.metal || 0, rough: o.rough === undefined ? 0.55 : o.rough }; for (const m of skinMats()) { m.metalness = skinFinish.metal; m.roughness = skinFinish.rough; } }
  function setGlow(color = null, k = 0) { if (!color || !k) { U.glow.value.set(0, 0, 0, 0); return; } _lc.set(color); U.glow.value.set(_lc.r, _lc.g, _lc.b, k); }
  // cloth of metal (armour): her suit's and her skirt's finish
  function setSuitFinish(o = {}) { for (const k of ['suit', 'skirt']) for (const m of lookMats[k]) { m.metalness = o.metal ? 0.85 : 0; m.roughness = o.metal ? 0.34 : (k === 'suit' ? 0.6 : 0.65); m.envMapIntensity = o.metal ? 1.0 : ENV; } }      // (none is worn until an outfit says so; the nodes themselves, not the meshes under one with two materials)
  // her hairstyles: the model's hair nodes (the first keeps the name Anne_Hair), one shown at a time
  const HAIR = metrics.hair && metrics.hair.order ? metrics.hair : { order: ['long'], styles: { long: { label: 'Long and straight', hat: true } } };
  const hairNodes = {}; HAIR.order.forEach((id, i) => { const n = anne.getObjectByName(i ? 'Anne_Hair_' + id : 'Anne_Hair'); if (n) hairNodes[id] = n; });
  let hairStyle = HAIR.order[0];
  function setHairStyle(id) { if (!hairNodes[id]) id = HAIR.order[0]; hairStyle = id; for (const k in hairNodes) hairNodes[k].visible = k === id; return id; }
  setHairStyle(hairStyle);
  // the shape of her face: weights of the model's `shape-...` morph targets ({ 'shape-jaw-wide': 0.4, ... }); they stay
  // as set (the expressions do not touch them). And a standing share of her lid morphs (the set of her eyes): setLidBias.
  const shapeLinks = []; anne.traverse((o) => { if (o.isMesh && o.morphTargetDictionary) shapeLinks.push(o); });
  const SHAPES = [...new Set(shapeLinks.flatMap((o) => Object.keys(o.morphTargetDictionary).filter((k) => k.startsWith('shape-'))))];
  function setShape(w = {}) { for (const o of shapeLinks) for (const k of SHAPES) { const i = o.morphTargetDictionary[k]; if (i !== undefined) o.morphTargetInfluences[i] = w[k] || 0; } }
  // Toes: a wiggle on top of whatever clip plays (a scene asks for it with setToeWiggle). The mixer only writes a bone
  // when its blended value changes, so the pose it left is kept here and handed back before each update; the wiggle is
  // then added to this frame's pose. In her shoes the middle toe keeps still (the front of the shoe hangs on it) and
  // the others only lift off the sole, never press into it.
  const TOE_BONES = [];
  for (const sd of ['L', 'R']) for (let i = 1; i <= 5; i++) { const b = anne.getObjectByName(`toe${i}-1${sd}`); if (b) TOE_BONES.push({ b, i, sd, base: b.quaternion.clone(), on: false }); }
  const FOOT_X = new THREE.Vector3(1, 0, 0), _tq = new THREE.Quaternion();      // (every toe curls about its foot bone's X; + curls to the sole, - lifts)
  let toeAmp = 0, toeNow = 0, toeT = 0, toeRate = 1;
  function setToeWiggle(amp = 0, rate = 1) { toeAmp = amp; toeRate = rate; }    // amp in radians (0.1 is slight), 0 = off
  // A high heel: her foot is pitched further at the ankle (about her left-right axis, as the shin carries it) and her toes
  // bent back by as much, so that they lie flat; while she stands or walks she is lifted by what the heel adds.
  const skel = (() => { let k = null; anne.traverse((o) => { if (!k && o.isSkinnedMesh && o.skeleton) k = o.skeleton; }); return k; })();
  const restAxis = (boneName) => { const b = anne.getObjectByName(boneName), i = skel && b ? skel.bones.indexOf(b) : -1; return i >= 0 ? new THREE.Vector3(1, 0, 0).transformDirection(skel.boneInverses[i]) : new THREE.Vector3(1, 0, 0); };
  const FEET_B = ['L', 'R'].map((sd) => { const b = anne.getObjectByName('foot' + sd); return b ? { b, sd, base: b.quaternion.clone(), on: false, ax: restAxis('lowerleg02' + sd) } : null; }).filter(Boolean);
  const rigNode = anne.getObjectByName('Anne_Rig'), STAND = new Set(['Idle', 'Point', 'Cast', 'Startle', 'Stomp', 'IdleLook', ...FLASH]);
  let liftNow = 0;
  const heelOn = (sd) => !!styleNow().heel && worn[sd] && addK > 1e-3;
  let addK = 1;                                        // (how much of the added pose: none while a clip made for high heels plays)
  function toesBefore() { for (const t of TOE_BONES) if (t.on) t.b.quaternion.copy(t.base); for (const f of FEET_B) if (f.on) f.b.quaternion.copy(f.base); }
  function toesAfter(dt) {
    toeNow = damp(toeNow, toeAmp, 8, dt); toeT += dt * toeRate;
    const nativeHi = !!(exclusiveClip && /Hi$/.test(resolve(exclusiveClip)));
    addK = dt > 0 ? damp(addK, nativeHi ? 0 : 1, 7, dt) : (nativeHi ? 0 : 1);
    const st = styleNow(), dth = (st.dthetaDeg || 0) * Math.PI / 180 * addK;
    for (const f of FEET_B) { f.on = heelOn(f.sd); if (!f.on) continue; f.base.copy(f.b.quaternion); f.b.quaternion.premultiply(_tq.setFromAxisAngle(f.ax, dth)); }
    for (const t of TOE_BONES) {
      const hi = heelOn(t.sd), wig = toeNow > 1e-4 && !(heelsWorn && (t.i === 3 || st.closed));      // (in a closed shoe her toes keep still)
      t.on = hi || wig; if (!t.on) continue;
      t.base.copy(t.b.quaternion);
      if (hi) t.b.quaternion.premultiply(_tq.setFromAxisAngle(FOOT_X, -dth));
      if (!wig) continue;
      const w = 0.6 * Math.sin(toeT * 7.3 + t.i * 1.9 + (t.sd === 'L' ? 0 : 2.1)) + 0.4 * Math.sin(toeT * 11.7 + t.i * 0.8);
      t.b.quaternion.premultiply(_tq.setFromAxisAngle(FOOT_X, heelsWorn ? -toeNow * (0.5 + 0.5 * w) : toeNow * w));
    }
    if (rigNode) {
      const up = (st.heel || st.lift > 0.004) && (worn.L || worn.R) && (!exclusiveClip || STAND.has(exclusiveClip)) ? (st.lift || 0) * (st.heel ? addK : 1) : 0;      // (batch 22: geta are flat but stand on teeth)
      liftNow = dt > 0 ? damp(liftNow, up, 10, dt) : up; rigNode.position.y = liftNow;
    }
  }
  // The sole flash (10-02): when she rises on the toes of one foot (FLASH clips), her shoe's sole does NOT come up with her heel,
  // whatever she wears: it stays on the ground under her toes. The shoe as it is at that moment is copied into the world and
  // the worn one hidden; the copy's sole rides on her toe bone (her toes stay flat on it), so her heel comes up out of it.
  // The straps and uppers go with her foot as far as they stand above the sole (blended by height: the ends sewn into the sole
  // stay down, an ankle strap goes all the way up with her ankle); a closed pump stays whole (her heel slips out of it).
  // (10-03: it rode on her second toe, which wiggles when she is tickled, and the dropped shoe rocked into the ground with it.
  // Her third toe is the one the shoe's own toe part is bound to, and it keeps still in a shoe.)
  const dangle = { on: null, side: 'L', toe: { L: anne.getObjectByName('toe3-1L') || anne.getObjectByName('toe2-1L'), R: anne.getObjectByName('toe3-1R') || anne.getObjectByName('toe2-1R') }, M0i: new THREE.Matrix4(), M: new THREE.Matrix4(), parts: [], low: [] };
  const _dv = new THREE.Vector3(), _dw = new THREE.Vector3();
  function bakeShoe(node, closed) {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; dangle.parts = []; dangle.low = [];
    node.updateWorldMatrix(true, true);
    node.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position, n = pos.count, base = new Float32Array(n * 3), wf = new Float32Array(n);
      const straps = !closed && !/Sole/.test((o.material && o.material.name) || '');
      let any = false;
      for (let i = 0; i < n; i++) {
        const h = pos.getY(i);                         // (her rest pose stands on the ground: the height of the shoe's point)
        wf[i] = straps ? THREE.MathUtils.smoothstep(h, 0.012, 0.04) : 0; if (wf[i] > 0) any = true;
        _dv.fromBufferAttribute(pos, i); o.applyBoneTransform(i, _dv); _dv.applyMatrix4(o.matrixWorld); base[i * 3] = _dv.x; base[i * 3 + 1] = _dv.y; base[i * 3 + 2] = _dv.z;
      }
      for (let i = 0; i < n; i += 7) if (base[i * 3 + 1] < 0.02) dangle.low.push(new THREE.Vector3(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]));      // (what of it is near the ground: kept above it, see updDangle)
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3).setUsage(THREE.DynamicDrawUsage)); if (o.geometry.index) geo.setIndex(o.geometry.index); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, o.material); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      if (any) { m.matrixAutoUpdate = false; scene.add(m); dangle.parts.push({ m, src: o, base, wf }); }      // (moves vertex by vertex: in world space)
      else g.add(m);                                                                                             // (rides on her toes as a whole)
    });
    return g;
  }
  function flashSide() { const n = exclusiveClip && resolve(exclusiveClip); if (!n) return null; const b = n.replace(/Hi$/, ''); return FLASH.includes(b) ? (b.endsWith('R') ? 'R' : 'L') : null; }
  function updDangle(dt = 1 / 60) {
    const side = flashSide(), a = side && actions[resolve(exclusiveClip)], want = !!(a && worn[side] && dangle.toe[side]);
    if (want && !dangle.on && a.time > 0.3 && a.time < 1.2) {
      const node = (shoeNodes[shoeStyle] || []).find((h) => h.name.endsWith(side));
      if (node) {
        dangle.side = side; dangle.on = bakeShoe(node, !!styleNow().closed); scene.add(dangle.on); node.visible = false; dangle.style = shoeStyle;
        const bed = MK.beds[shoeStyle] && MK.beds[shoeStyle][side];      // (10-03: the marks on its footbed stay in it, down on the ground)
        if (bed) { dangle.on.updateMatrixWorld(true); dangle.on.attach(bed.group); dangle.bed = bed; }
        dangle.toe[side].updateWorldMatrix(true, false); dangle.M0i.copy(dangle.toe[side].matrixWorld).invert();
        const hm = anne.getObjectByName(`Marker_Sole_${side}_Heel`); dangle.heel = hm; dangle.wait = 0;      // (where her heel sits in the shoe, as seen from her toes)
        if (hm) dangle.h0 = dangle.toe[side].worldToLocal(hm.getWorldPosition(new THREE.Vector3()));
      }
    }
    // (her foot is back in it: the worn shoe again. 10-03: only once her heel is down in it: a scene that ends the flash early
    // (a fade to another clip) lowers the foot over that fade, and the worn shoe must not jump up onto the raised heel)
    let back = false;
    if (dangle.on) {                                    // (showShoes, called by any change of her look, would show the worn one again beside its copy)
      if (dangle.style !== shoeStyle) back = true;
      else { const nd = (shoeNodes[shoeStyle] || []).find((h) => h.name.endsWith(dangle.side)); if (nd) nd.visible = false; }
    }
    if (dangle.on && !back && (!want || side !== dangle.side || a.time > a.getClip().duration - 0.2)) {
      dangle.wait = (dangle.wait || 0) + dt;
      back = !dangle.heel || !dangle.h0 || dangle.wait > 1.5 || dangle.toe[dangle.side].worldToLocal(dangle.heel.getWorldPosition(_dw)).distanceTo(dangle.h0) < 0.012;
    }
    if (back) {
      if (dangle.bed) { const b = dangle.bed; b.bone.add(b.group); b.group.position.set(0, 0, 0); b.group.quaternion.identity(); b.group.scale.set(1, 1, 1); dangle.bed = null; }      // (first: its meshes are not the baked shoe's to dispose of)
      scene.remove(dangle.on); dangle.on.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const pt of dangle.parts) { scene.remove(pt.m); pt.m.geometry.dispose(); }
      dangle.on = null; dangle.parts = []; showShoes(); return;
    }
    if (!dangle.on) return;
    const toe = dangle.toe[dangle.side]; toe.updateWorldMatrix(true, false);
    dangle.M.multiplyMatrices(toe.matrixWorld, dangle.M0i);
    // (10-03) and it never goes under the ground either, whatever her toes do: the lowest points it had when it was dropped
    { let pen = 0; for (const p of dangle.low) { _dv.copy(p).applyMatrix4(dangle.M); const g = groundAt(_dv.x, _dv.z) - _dv.y; if (g > pen) pen = g; } if (pen > 0 && pen < 0.2) dangle.M.elements[13] += pen; }
    dangle.on.matrix.copy(dangle.M); dangle.on.matrixWorldNeedsUpdate = true;
    for (const pt of dangle.parts) {                    // straps: between where the sole has them and where her foot takes them
      const P = pt.m.geometry.attributes.position, arr = P.array, o = pt.src; o.updateWorldMatrix(true, false);
      for (let i = 0; i < pt.wf.length; i++) {
        _dv.set(pt.base[i * 3], pt.base[i * 3 + 1], pt.base[i * 3 + 2]).applyMatrix4(dangle.M);
        const w = pt.wf[i];
        if (w > 0) { _dw.fromBufferAttribute(o.geometry.attributes.position, i); o.applyBoneTransform(i, _dw); _dw.applyMatrix4(o.matrixWorld); _dv.lerp(_dw, w); }
        arr[i * 3] = _dv.x; arr[i * 3 + 1] = _dv.y; arr[i * 3 + 2] = _dv.z;
      }
      P.needsUpdate = true; pt.m.geometry.computeVertexNormals(); pt.m.geometry.computeBoundingSphere();
    }
  }
  // Locomotion: Idle, Walk, Jog and Run blend by her speed. The three gaits share one stride phase (every clip starts
  // with the right foot coming down), and that phase advances by distance covered, so the feet stay planted at any
  // speed: one loop of a clip covers its STRIDE in metres (the gait model's own numbers, exported with her).
  const GAITS = ['Walk', 'Jog', 'Run'].filter((n) => actions[n]);
  const STRIDE = Object.assign({ Walk: 1.52, Jog: 1.8, Run: 2.93 }, metrics.stride || {});
  const GAIT_V = Object.assign({ Walk: 1.52, Jog: 2.4, Run: 4.4 }, metrics.gaitSpeed || {});      // the speed each gait was made for
  let stridePhase = 0;
  const gaitW = {};
  function updateClips(dt, speed = 0) {
    const idle = resolve('Idle'), excl = exclusiveClip && resolve(exclusiveClip);
    // which gaits, how much of each, and the stride at this speed
    let stride = STRIDE[GAITS[0]] || 1.5, wIdle = 1;
    for (const n of GAITS) gaitW[n] = 0;
    if (GAITS.length) {
      const v0 = GAIT_V[GAITS[0]];
      if (speed <= v0) { gaitW[GAITS[0]] = clamp(speed / (0.75 * v0), 0, 1); wIdle = 1 - gaitW[GAITS[0]]; }
      else {
        wIdle = 0;
        let k = 0; while (k < GAITS.length - 2 && speed > GAIT_V[GAITS[k + 1]]) k++;
        const a = GAITS[k], b = GAITS[Math.min(k + 1, GAITS.length - 1)];
        const t = a === b ? 0 : clamp((speed - GAIT_V[a]) / (GAIT_V[b] - GAIT_V[a]), 0, 1);
        gaitW[a] += 1 - t; gaitW[b] += t; stride = STRIDE[a] + (STRIDE[b] - STRIDE[a]) * t;
      }
    }
    // standing still, the phase waits where a first step starts: the right foot planted, the left one just leaving the ground
    if (!excl) stridePhase = speed < 0.05 ? 0.12 : (stridePhase + dt * speed / stride) % 1;
    const real = {}; for (const n of GAITS) real[resolve(n)] = gaitW[n];
    for (const n in actions) {
      const target = excl ? (n === excl ? 1 : 0) : (n in real ? real[n] : n === idle ? wIdle : 0), a = actions[n];
      weights[n] = damp(weights[n], target, excl ? 3 / clipFade : 14, dt);
      // (a clip that has faded out leaves the mixer: with 28 clips of 489 channels each, keeping them all running cost half a millisecond a frame)
      if (target === 0 && weights[n] < 0.002) { weights[n] = 0; if (a.isScheduled()) a.stop(); continue; }
      if (!a.isScheduled()) a.play();
      a.setEffectiveWeight(weights[n]);
    }
    for (const g of GAITS) for (const n of [g, g + 'Bare']) {
      const a = actions[n]; if (!a) continue;
      if (excl) a.timeScale = a.getClip().duration / (STRIDE[g] / GAIT_V[g]);      // (a scene that plays a gait by name lets it run on the clock: the file holds it finely sampled, longer than real time)
      else { a.timeScale = 0; a.time = stridePhase * a.getClip().duration; }
    }
    groundBefore(); toesBefore(); mixer.update(dt); toesAfter(dt); ankles(dt); groundFeet(); updDangle(dt); legShake(dt);
  }
  // test hook: hold one clip at a point of its loop (0..1)
  function poseClip(name, phase) {
    const real = resolve(name); if (!actions[real]) return false;
    if (!actions[real].isScheduled()) actions[real].play();
    for (const n in actions) { weights[n] = n === real ? 1 : 0; actions[n].setEffectiveWeight(weights[n]); }
    actions[real].timeScale = 0; actions[real].time = phase * actions[real].getClip().duration; groundBefore(); toesBefore(); mixer.update(0); toesAfter(0);
    return true;
  }

  // ---------- face: expressions, blinking, gaze, blush ----------
  // Values are weights of the MakeHuman expression units (stage 3 scales them to the stylised head; 1 = full).
  const EXPR = {
    neutral: { 'mouth-corner-puller': .22 },
    smile: { 'mouth-corner-puller': .7, 'eye-left-slit': .25, 'eye-right-slit': .25 },
    smug: { 'mouth-corner-puller': .5, 'eye-left-slit': .5, 'eye-right-slit': .5, 'eyebrows-left-up': .4, 'eyebrows-right-down': .2 },
    happy: { 'mouth-corner-puller': .95, 'mouth-open': .25, 'mouth-parling': .4, 'eyebrows-left-up': .3, 'eyebrows-right-up': .3, 'eye-left-slit': .3, 'eye-right-slit': .3 },
    surprised: { 'eye-left-opened-up': .9, 'eye-right-opened-up': .9, 'eyebrows-left-up': .9, 'eyebrows-right-up': .9, 'mouth-open': .35, 'mouth-parling': .5, pupil: .75 },
    shocked: { 'eye-left-opened-up': 1, 'eye-right-opened-up': 1, 'eyebrows-left-up': 1, 'eyebrows-right-up': 1, 'eyebrows-left-inner-up': .5, 'eyebrows-right-inner-up': .5, 'mouth-open': .65, 'mouth-retraction': .25, pupil: .6 },
    angry: { 'eyebrows-left-down': 1, 'eyebrows-right-down': 1, 'eye-left-slit': .45, 'eye-right-slit': .45, 'mouth-retraction': .45, 'mouth-compression': .2, 'nose-left-elevation': .4, 'nose-right-elevation': .4, 'mouth-open': .12 },
    embarrassed: { 'mouth-corner-puller': .35, 'eyebrows-left-inner-up': .7, 'eyebrows-right-inner-up': .7, 'eye-left-slit': .3, 'eye-right-slit': .3, 'mouth-compression': .2, gazeY: -0.12, gazeX: 0.1 },
    worried: { 'eyebrows-left-inner-up': .95, 'eyebrows-right-inner-up': .95, 'mouth-depression': .4, 'eye-left-opened-up': .3, 'eye-right-opened-up': .3, 'mouth-parling': .2 },
    strain: { 'eye-left-closure': .7, 'eye-right-closure': .7, 'eyebrows-left-down': .6, 'eyebrows-right-down': .6, 'mouth-retraction': .6, 'mouth-compression': .4, 'nose-left-elevation': .3, 'nose-right-elevation': .3 },
    laugh: { 'mouth-corner-puller': 1, 'mouth-open': .5, 'mouth-parling': .5, 'eye-left-closure': .7, 'eye-right-closure': .7, 'eyebrows-left-inner-up': .45, 'eyebrows-right-inner-up': .45 },
    laughHard: { 'mouth-corner-puller': 1, 'mouth-open': .62, 'mouth-elevation': .3, 'eye-left-closure': 1, 'eye-right-closure': 1, 'eyebrows-left-inner-up': .75, 'eyebrows-right-inner-up': .75, 'nose-left-elevation': .3, 'nose-right-elevation': .3 },
    tired: { 'eye-left-closure': .42, 'eye-right-closure': .42, 'eyebrows-left-inner-up': .35, 'eyebrows-right-inner-up': .35, 'mouth-depression': .15 },
    sleep: { 'eye-left-closure': 1, 'eye-right-closure': 1, 'mouth-parling': .12 },
    pout: { 'mouth-pursing': .7, 'eyebrows-left-down': .3, 'eyebrows-right-down': .3, 'eye-left-slit': .2, 'eye-right-slit': .2, 'mouth-depression': .2, gazeX: -0.12 },
  };
  const EXTRA = new Set(['pupil', 'gazeX', 'gazeY']);
  const MID_KEYS = ['eye-left-closure-mid', 'eye-right-closure-mid'];     // driven from the closure, not set by expressions
  const FACE_KEYS = [...new Set(Object.values(EXPR).flatMap((e) => Object.keys(e)).filter((k) => !EXTRA.has(k)).concat(['eye-left-closure', 'eye-right-closure']))];
  // One face: the morph targets under `root`, and the eye and blush inputs UU of its materials.
  function makeFace(root, UU) {
    const faceNow = Object.fromEntries(FACE_KEYS.concat(MID_KEYS).map((k) => [k, 0]));
    const morphLinks = [];
    root.traverse((o) => {
      if (o.isMesh && o.morphTargetDictionary) morphLinks.push({ inf: o.morphTargetInfluences, pairs: FACE_KEYS.concat(MID_KEYS).map((k) => [o.morphTargetDictionary[k], k]).filter((p) => p[0] !== undefined) });
    });
    let exprName = 'neutral', blushTarget = 0, nextBlink = 2.5, blinkT = -1, gazeGoal = null;
    let sacX = 0, sacY = 0, nextSaccade = 1.5;
    let talking = false, talkK = 0;                  // while her line is being typed her mouth moves (story.js)
    let bias = {};                                   // (10-04) a standing share of some morphs, under every expression: the set of her eyes
    const headMarker = root.getObjectByName('Marker_Head');
    function update(dt, t) {
      const e = EXPR[exprName];
      if (headMarker) headMarker.getWorldPosition(UU.headW.value);
      if (t > nextBlink && blinkT < 0) { blinkT = 0; nextBlink = t + 2.4 + Math.random() * 3.2; }
      let blink = 0; if (blinkT >= 0) { blinkT += dt; blink = Math.sin(Math.min(1, blinkT / 0.17) * Math.PI); if (blinkT > 0.17) blinkT = -1; }
      const laughing = exprName === 'laugh' || exprName === 'laughHard';
      talkK = damp(talkK, talking && !laughing && exprName !== 'sleep' ? 1 : 0, 14, dt);
      for (const k of FACE_KEYS) {
        let v = e[k] || 0;
        if (laughing && k === 'mouth-open') v += 0.16 * Math.sin(t * 15) + 0.07 * Math.sin(t * 23);
        if (k === 'mouth-open') v += talkK * (0.2 + 0.16 * Math.sin(t * 17) + 0.1 * Math.sin(t * 29 + 1));      // talking: the jaw works
        if (k === 'eye-left-closure' || k === 'eye-right-closure') v = Math.max(v, blink);
        faceNow[k] = damp(faceNow[k], v, k.startsWith('eye-') && blink > 0 ? 45 : 12, dt);
      }
      for (const sd of ['left', 'right']) { const c = clamp(faceNow[`eye-${sd}-closure`], 0, 1); faceNow[`eye-${sd}-closure-mid`] = 4 * c * (1 - c); }
      for (const l of morphLinks) for (const p of l.pairs) l.inf[p[0]] = Math.min(1.05, faceNow[p[1]] + (bias[p[1]] || 0));
      if (t > nextSaccade) { nextSaccade = t + 0.7 + Math.random() * 2.2; sacX = (Math.random() - 0.5) * 0.10; sacY = (Math.random() - 0.5) * 0.05; }
      const gx = gazeGoal ? gazeGoal.x : (e.gazeX || 0) + sacX, gy = gazeGoal ? gazeGoal.y : (e.gazeY || 0) + sacY;
      UU.gaze.value.x = damp(UU.gaze.value.x, clamp(gx, -0.45, 0.45), 18, dt);
      UU.gaze.value.y = damp(UU.gaze.value.y, clamp(gy, -0.3, 0.3), 18, dt);
      UU.pupil.value = damp(UU.pupil.value, e.pupil || 1, 8, dt);
      UU.blush.value = damp(UU.blush.value, blushTarget, 4, dt);
    }
    return {
      setExpression(name, blush = 0) { exprName = EXPR[name] ? name : 'neutral'; blushTarget = blush; },
      setTalking(on) { talking = !!on; },
      setGaze(g) { gazeGoal = g; },                    // look direction: null = idle (small eye movements), or { x, y } in roughly radians (+x her left, +y up)
      setBias(b) { bias = b || {}; },
      snap(name, blush = 0) {                          // (10-04) this expression at once, no easing (the portraits made of her)
        exprName = EXPR[name] ? name : 'neutral'; blushTarget = blush; const e = EXPR[exprName];
        for (const k of FACE_KEYS) faceNow[k] = e[k] || 0;
        for (const sd of ['left', 'right']) { const c = clamp(faceNow[`eye-${sd}-closure`], 0, 1); faceNow[`eye-${sd}-closure-mid`] = 4 * c * (1 - c); }
        for (const l of morphLinks) for (const p of l.pairs) l.inf[p[0]] = Math.min(1.05, faceNow[p[1]] + (bias[p[1]] || 0));
        UU.gaze.value.set(e.gazeX || 0, e.gazeY || 0); UU.pupil.value = e.pupil || 1; UU.blush.value = blush;
      },
      update,
    };
  }
  const face = makeFace(anne, U);
  const setExpression = face.setExpression, setTalking = face.setTalking, setGaze = face.setGaze;
  const updateFace = (dt, t) => { face.update(dt, t); updMarks(dt); };

  // ---------- (10-03) marks of what was done to her feet: a little saliva ('wet') where something licked, green tickle specks
  // ('specks') where vines and tentacles rubbed; or 'both'. soleMarks(kind, seconds): spread over both soles, heel to ball,
  // and over the footbeds of the shoes she wears (in the sole flash they stay down in the shoe while her heel comes up:
  // see dangle); then they fade; soleMarks(null): gone. Every mark lies ON its surface: a sole's own skin points (those
  // that face out of the sole, in the foot bone's bind-pose space, from the Marker_Sole_* points), an insole's own points.
  // layMarks() does the same for any surface (the loose shoes' footbeds: captures.js, logscene.js). Each mark can be
  // scrubbed off (scrubMarks: the fuzzy brush, footplay.js). ----------
  const MK = { kind: null, k: 0, left: 0, mats: null, models: {}, soles: null, beds: {}, wetA: 0.22, shineA: 0.75 };
  const _mv = new THREE.Vector3(), _mw = new THREE.Vector3(), _mq = new THREE.Quaternion(), _mm = new THREE.Matrix4(), _ms = new THREE.Vector3(), _UPm = new THREE.Vector3(0, 1, 0);
  function markMats() {
    if (MK.geo) return MK.geo;
    // (saliva is clear: a faint glaze whose edges fade out (alphaMap: a flattened blob's dome, 1 at its top, 0 at its rim),
    // with unlit white shine strokes and tiny bubbles, as it is drawn: lit, a clear film only darkened the skin where it
    // mirrored the ground, and read as dirt)
    const grad = document.createElement('canvas'); grad.width = 2; grad.height = 64;
    { const g2 = grad.getContext('2d'), im = g2.createImageData(2, 64); for (let r = 0; r < 64; r++) { const y = 1 - r / 63, a = Math.max(0, Math.min(1, (y - 0.5) / 0.32)), v = Math.round(255 * a * a * (3 - 2 * a)); for (let c = 0; c < 2; c++) { const o = (r * 2 + c) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; } } g2.putImageData(im, 0, 0); }
    const edge = new THREE.CanvasTexture(grad);
    MK.geo = { blob: new THREE.SphereGeometry(1, 16, 8), speck: new THREE.IcosahedronGeometry(1, 1), edge,
      COLS: [0x7cd321, 0x9be15d, 0x58b82a, 0xc6ee52, 0x3f9f3a, 0xa8d83e].map((c) => new THREE.Color(c)) };
    return MK.geo;
  }
  function newMats() {           // (each set of marks that fades on its own has its own three materials)
    const G = markMats();
    return { wet: new THREE.MeshStandardMaterial({ color: 0xe4eef5, roughness: 0.04, metalness: 0, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 2, alphaMap: G.edge }),
      shine: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, alphaMap: G.edge }),
      speck: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, transparent: true, opacity: 0, emissive: 0x2c7010, emissiveIntensity: 0.5 }) };
  }
  // points of a skinned mesh in one bone's own space (its bind pose: what is weighted to that bone is rigid with it)
  function boneSpace(o, bone, keep) {
    const P = [], N = [], bi = o.skeleton ? o.skeleton.bones.indexOf(bone) : -1, g = o.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, PA = g.attributes.position, NA = g.attributes.normal;
    if (bi < 0 || !SI || !SW || !NA) return { P, N };
    const m4 = new THREE.Matrix4().multiplyMatrices(o.skeleton.boneInverses[bi], o.bindMatrix), nm = new THREE.Matrix3().getNormalMatrix(m4), q = new THREE.Vector3();
    for (let i = 0; i < PA.count; i++) {
      const w = (SI.getX(i) === bi ? SW.getX(i) : 0) + (SI.getY(i) === bi ? SW.getY(i) : 0) + (SI.getZ(i) === bi ? SW.getZ(i) : 0) + (SI.getW(i) === bi ? SW.getW(i) : 0);
      if (w < 0.6) continue;
      q.fromBufferAttribute(NA, i).applyMatrix3(nm).normalize(); if (!keep(q)) continue;
      P.push(new THREE.Vector3().fromBufferAttribute(PA, i).applyMatrix4(m4)); N.push(q.clone());
    }
    return { P, N };
  }
  // one sole, in its foot bone's space: heel, arch, ball, the way out of it (n), along it, across it; its skin points; how
  // wide its flat is along it; fit(u, v): a point ON the skin (u: 0 heel, 0.5 arch, 1 ball; v: -1..1 across the flat)
  function soleModel(sd) {
    if (MK.models[sd] !== undefined) return MK.models[sd];
    const bone = anne.getObjectByName('foot' + sd), mk = ['Heel', 'Arch', 'Ball', 'Out'].map((p) => anne.getObjectByName(`Marker_Sole_${sd}_${p}`));
    if (!bone || !mk.every(Boolean)) return (MK.models[sd] = null);
    bone.updateWorldMatrix(true, false);
    const V = () => new THREE.Vector3(), d = V(), q = V();
    const [H, R, B, O] = mk.map((m) => (m.parent === bone ? m.position.clone() : bone.worldToLocal(m.getWorldPosition(V()))));
    const n = O.clone().sub(R).normalize(), fwd = B.clone().sub(H); fwd.addScaledVector(n, -fwd.dot(n)).normalize();
    const side = V().crossVectors(n, fwd).normalize(), span = B.clone().sub(H).dot(fwd);
    const line = (u, out) => out.copy(H).multiplyScalar((1 - u) * (1 - 2 * u)).addScaledVector(R, 4 * u * (1 - u)).addScaledVector(B, u * (2 * u - 1));
    const shoeParts = new Set(); for (const id in shoeNodes) for (const s of shoeNodes[id]) s.traverse((o) => shoeParts.add(o));
    const P = [], N = [];
    anne.traverse((o) => { if (o.isSkinnedMesh && !shoeParts.has(o)) { const r = boneSpace(o, bone, (nv) => nv.dot(n) >= 0.3); P.push(...r.P); N.push(...r.N); } });
    if (P.length < 30) { console.warn('[anne] marks: sole skin not found for foot ' + sd); return (MK.models[sd] = null); }
    const BINS = 14, lo = new Array(BINS).fill(Infinity), hi = new Array(BINS).fill(-Infinity), bin = (u) => Math.max(0, Math.min(BINS - 1, Math.floor((u + 0.1) / 1.4 * BINS)));
    for (let i = 0; i < P.length; i++) { if (N[i].dot(n) < 0.6) continue; const u = d.subVectors(P[i], H).dot(fwd) / span, b = bin(u), s = d.subVectors(P[i], line(u, q)).dot(side); lo[b] = Math.min(lo[b], s); hi[b] = Math.max(hi[b], s); }
    for (let b = 0; b < BINS; b++) if (!isFinite(lo[b])) { lo[b] = -0.018; hi[b] = 0.018; }
    const M = { sd, bone, H, R, B, n, fwd, side, span, line, bin, lo, hi, P, N };
    M.at = (u, v, out) => { const b = bin(u); return line(u, out).addScaledVector(side, (lo[b] + hi[b]) / 2 + v * (hi[b] - lo[b]) / 2 * 0.72); };
    M.fit = (u, v, out, nOut, r = 0.0065) => {
      M.at(u, v, q);
      let best = -Infinity, j = -1;
      for (let i = 0; i < P.length; i++) { d.subVectors(P[i], q); const a = d.dot(n), t2 = d.lengthSq() - a * a; if (t2 < r * r && a > -0.03 && a > best) { best = a; j = i; } }
      if (j < 0) return false;
      out.copy(q).addScaledVector(n, best); nOut.copy(N[j]); return true;
    };
    // (u, v) of a point in the bone's space: the inverse of `at`, near enough for a brush
    M.uv = (p) => { const u = d.subVectors(p, H).dot(fwd) / span, b = bin(u), s = d.subVectors(p, line(u, q)).dot(side); return [u, (s - (lo[b] + hi[b]) / 2) / Math.max(1e-4, (hi[b] - lo[b]) / 2 * 0.72)]; };
    return (MK.models[sd] = M);
  }
  // the footbed of the shoe she wears, in the same space: the insole's points (facing her sole, within a few millimetres
  // of the sole's line); fit(u, v): the insole's top there, facing up into her foot
  function bedModel(sd, style) {
    const key = sd + '|' + style; if (MK.models[key] !== undefined) return MK.models[key];
    const S0 = soleModel(sd), node = (shoeNodes[style] || []).find((h) => h.name.endsWith(sd));
    if (!S0 || !node) return (MK.models[key] = null);
    const P = [], N = [], d = new THREE.Vector3(), q = new THREE.Vector3();
    node.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const r = boneSpace(o, S0.bone, (nv) => nv.dot(S0.n) <= -0.5);
      for (let i = 0; i < r.P.length; i++) {
        const u = Math.max(0, Math.min(1.1, d.copy(r.P[i]).sub(S0.H).dot(S0.fwd) / S0.span)), a = d.subVectors(r.P[i], S0.line(u, q)).dot(S0.n);
        if (a > -0.004 && a < 0.03) { P.push(r.P[i]); N.push(r.N[i]); }
      }
    });
    if (P.length < 20) return (MK.models[key] = null);
    const M = Object.assign({}, S0, { P, N });
    M.fit = (u, v, out, nOut, r = 0.007) => {
      S0.at(u, v, q);
      let best = Infinity, j = -1;
      for (let i = 0; i < P.length; i++) { d.subVectors(P[i], q); const a = d.dot(S0.n), t2 = d.lengthSq() - a * a; if (t2 < r * r && a < best) { best = a; j = i; } }
      if (j < 0) return false;
      out.copy(q).addScaledVector(S0.n, best); nOut.copy(N[j]); return true;
    };
    return (MK.models[key] = M);
  }
  // Lay marks on a surface. sample(u, v, pos, nrm) -> true where (u, v) is on it (u along it, v across, -1..1); fwd: the
  // way along it (for the streaks' length). o: { seed, us: [u0, u1], wet: [streaks, drops, bubbles], specks: n, thin }.
  // Returns { group, wet (a Group), specks (an InstancedMesh), list (every mark: for scrubbing), mats, show(kind, k) }.
  function layMarks(sample, fwd, o = {}) {
    const G = markMats(), mats = o.mats || newMats(), group = new THREE.Group(), wet = new THREE.Group(); group.add(wet); group.name = o.name || 'Anne_Marks';
    let seed = o.seed || 0x2545f491;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pos = new THREE.Vector3(), nrm = new THREE.Vector3(), qa = new THREE.Quaternion(), f2 = new THREE.Vector3(), list = [], th = o.thin ? 0.35 : 1;
    const [u0, u1] = o.us || [0, 1];
    const place = (obj, u, v, len, wid, t, lift) => {
      if (!sample(u, v, pos, nrm)) return false;
      obj.position.copy(pos).addScaledVector(nrm, lift);
      qa.setFromUnitVectors(_UPm, nrm); obj.quaternion.copy(qa);
      f2.copy(fwd).applyQuaternion(qa.invert()); obj.rotateY(Math.atan2(f2.x, f2.z));      // (its length along the surface)
      obj.scale.set(wid, t, len); return true;
    };
    const blob = (mat, u, v, len, wid, t, lift, order) => { const s = new THREE.Mesh(G.blob, mat); s.renderOrder = order; if (place(s, u, v, len, wid, t, lift)) { wet.add(s); list.push({ obj: s, s0: s.scale.clone(), life: 1 }); } };
    // saliva, spread over the whole stretch: lick streaks (each with its highlights), droplets, tiny bubbles
    const [nS, nD, nB] = o.wet || [6, 8, 8], uAt = (i, n) => u0 + (u1 - u0) * (i + 0.15 + 0.7 * rnd()) / n;
    for (let i = 0; i < nS; i++) {
      const u = uAt(i, nS), v = (i % 2 ? 1 : -1) * (0.2 + 0.45 * rnd()), len = 0.010 + 0.006 * rnd(), wid = 0.0042 + 0.002 * rnd();
      blob(mats.wet, u, v, len, wid, 0.0008 * th, 0.0005 * th, 2);
      blob(mats.shine, u + 0.025, v + 0.22, len * 0.55, wid * 0.2, 0.0002, 0.0011 * th, 3);      // (its highlight, off its middle)
      if (rnd() < 0.6) blob(mats.shine, u - 0.05, v - 0.18, len * 0.22, wid * 0.14, 0.0002, 0.0011 * th, 3);
    }
    for (let i = 0; i < nD; i++) {
      const u = uAt(i, nD), v = rnd() * 1.8 - 0.9, r = 0.0012 + rnd() * 0.0012;
      blob(mats.wet, u, v, r, r, r * 0.5 * th, 0.0004 * th, 2); blob(mats.shine, u + 0.006, v + 0.12, r * 0.32, r * 0.32, 0.0002, (0.0004 + r * 0.5) * th, 3);
    }
    for (let i = 0; i < nB; i++) { const u = uAt(i, nB), r = 0.0003 + rnd() * 0.0003; blob(mats.shine, u, rnd() * 1.6 - 0.8, r, r, r * th, 0.0012 * th, 3); }      // (tiny bubbles)
    // the specks: a jittered grid over the whole stretch (spread out, not in a clump), green with a little yellow among them
    const nSp = o.specks === undefined ? 80 : o.specks, rows = Math.max(1, Math.round(Math.sqrt(nSp * 1.6))), cols = Math.max(1, Math.ceil(nSp / rows));
    const sp = new THREE.InstancedMesh(G.speck, mats.speck, rows * cols); sp.frustumCulled = false; group.add(sp);
    const dummy = new THREE.Object3D(); let k = 0;
    for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
      if (rnd() < 0.12) continue;
      const u = u0 + (u1 - u0) * (a + rnd()) / rows, v = -0.95 + 1.9 * (b + rnd()) / cols, r = 0.001 + rnd() * rnd() * 0.0016;
      if (!place(dummy, u, v, r, r * (0.8 + rnd() * 0.5), r * 0.6 * th, 0.0003 * th)) continue;
      dummy.rotateY(rnd() * Math.PI * 2); dummy.updateMatrix(); sp.setMatrixAt(k, dummy.matrix); sp.setColorAt(k, G.COLS[(rnd() * G.COLS.length) | 0]);
      list.push({ inst: sp, i: k, m0: dummy.matrix.clone(), life: 1 }); k++;
    }
    sp.count = k; sp.instanceMatrix.needsUpdate = true; if (sp.instanceColor) sp.instanceColor.needsUpdate = true;
    wet.visible = false; sp.visible = false;
    return { group, wet, specks: sp, list, mats,
      show(kind, kk) {
        const w = kk > 0 && (kind === 'wet' || kind === 'both'), s = kk > 0 && (kind === 'specks' || kind === 'both');
        mats.wet.opacity = MK.wetA * kk; mats.shine.opacity = MK.shineA * kk; mats.speck.opacity = kk; wet.visible = w; sp.visible = s;
      },
      hide() { wet.visible = false; sp.visible = false; },      // (not seen, its materials left alone: other sets may share them)
      reset(life = 1) {      // (life 0: all there but unseen, for a tongue to bring out where it licks)
        for (const m of list) {
          m.life = life;
          if (m.obj) { m.obj.visible = life > 0.04; m.obj.scale.copy(m.s0).multiplyScalar(Math.max(1e-4, life)); }
          else if (life >= 1) m.inst.setMatrixAt(m.i, m.m0); else { m.m0.decompose(_mv, _mq, _ms); _ms.multiplyScalar(Math.max(1e-4, life)); _mm.compose(_mv, _mq, _ms); m.inst.setMatrixAt(m.i, _mm); }
        }
        sp.instanceMatrix.needsUpdate = true;
      },
    };
  }
  // marks on a loose shoe's footbed (captures.js, logscene.js): prof = { y: [the footbed's height in N steps, back to toe],
  // z0, z1, cx, hw } in the shoe's own space, as both measure it; each call makes a set with materials of its own
  function propMarks(prof, o = {}) {
    const N = prof.y.length, hw = prof.hw || 0.03, len = prof.z1 - prof.z0;
    const yAt = (u) => { const j = Math.max(0, Math.min(N - 1, u * N - 0.5)), j0 = Math.floor(j), j1 = Math.min(N - 1, j0 + 1); return prof.y[j0] + (prof.y[j1] - prof.y[j0]) * (j - j0); };
    const sample = (u, v, pos, nrm) => {
      if (u < 0.05 || u > 0.95) return false;
      pos.set(prof.cx + v * hw * 0.42, yAt(u) + 0.0004, prof.z0 + u * len); nrm.set(0, 1, -(yAt(u + 0.04) - yAt(u - 0.04)) / (0.08 * len)).normalize(); return true;
    };
    return layMarks(sample, new THREE.Vector3(0, 0, 1), Object.assign({ us: [0.08, 0.92], wet: [4, 6, 5], specks: 50, thin: true, name: 'Anne_PropMarks' }, o));
  }
  // her soles' and her worn shoes' marks (one set of materials: they fade together)
  function solesUp() {
    if (MK.soles) return MK.soles;
    MK.mats = newMats(); MK.soles = {};
    for (const sd of ['L', 'R']) {
      const M = soleModel(sd); if (!M) continue;
      const set = layMarks(M.fit, M.fwd, { mats: MK.mats, seed: 0x2545f491 + (sd === 'L' ? 0 : 7919), us: [-0.02, 1.02], name: 'Anne_SoleMarks_' + sd });
      M.bone.add(set.group); MK.soles[sd] = set;
    }
    return MK.soles;
  }
  function bedsUp(style) {
    if (MK.beds[style] !== undefined) return MK.beds[style];
    const out = {};
    for (const sd of ['L', 'R']) {
      const M = bedModel(sd, style); if (!M) continue;
      // (behind the toe joints only: in front of them the insole bends with her toes; and thin: it lies in the 1 mm between
      // her sole and the insole until her heel comes up out of the shoe)
      const set = layMarks(M.fit, M.fwd, { mats: MK.mats, seed: 0x51ed270b + (sd === 'L' ? 0 : 104729), us: [0.0, 0.7], wet: [4, 5, 4], specks: 46, thin: true, name: 'Anne_BedMarks_' + sd });
      set.bone = M.bone; set.sd = sd; M.bone.add(set.group); out[sd] = set;
    }
    return (MK.beds[style] = out);
  }
  function soleMarks(kind, sec = 45, o = {}) {
    if (!kind) { MK.kind = null; MK.k = 0; MK.left = 0; updMarks(0); return; }
    solesUp(); bedsUp(shoeStyle);
    const fill = o.empty ? 0 : 1;                      // (an empty session: all there but unseen, for a tongue to bring out; remembered, so that a full one asked for later is full)
    if (MK.kind !== kind || MK.left <= 0 || MK.fill !== fill) { for (const sd in MK.soles) MK.soles[sd].reset(fill); for (const st in MK.beds) for (const sd in MK.beds[st]) MK.beds[st][sd].reset(fill); }
    MK.fill = fill;
    MK.kind = kind; MK.left = sec;
    updMarks(0);
  }
  function updMarks(dt) {
    if (!MK.soles) return;
    if (MK.kind) { MK.left -= dt; MK.k = MK.left > 0 ? Math.min(1, MK.k + dt / 0.25 + (dt ? 0 : 1)) : Math.max(0, MK.k - dt / 3); if (MK.left <= 0 && MK.k <= 0) MK.kind = null; }
    const k = MK.kind ? MK.k : 0;
    for (const sd in MK.soles) MK.soles[sd].show(MK.kind, k);
    if (k > 0 && !MK.beds[shoeStyle]) { const nb = bedsUp(shoeStyle); if (MK.fill === 0) for (const sd in nb) nb[sd].reset(0); }      // (another pair put on in an empty session: its footbeds start empty too)
    for (const st in MK.beds) for (const sd in MK.beds[st]) { if (st === shoeStyle) MK.beds[st][sd].show(MK.kind, k); else MK.beds[st][sd].hide(); }      // (they share the soles' materials: another pair's set is only hidden)
  }
  // the fuzzy brush (footplay.js): marks of this sole within r of a world point lose `amount` of their life (they shrink
  // away); returns how much of that sole's marks is left (0..1)
  function scrubMarks(sd, world, r, amount) {
    const set = MK.soles && MK.soles[sd]; if (!set || !MK.kind) return 0;
    const wet = MK.kind === 'wet' || MK.kind === 'both', spk = MK.kind === 'specks' || MK.kind === 'both';
    let left = 0, all = 0, dirty = false;
    set.group.updateWorldMatrix(true, true);
    for (const m of set.list) {
      if (m.obj ? !wet : !spk) continue;
      all++;
      if (amount < 0 ? !!m.obj : m.life > 0) {         // (growing: the saliva only, never the specks a brush took off)
        if (m.obj) m.obj.getWorldPosition(_mw); else { _mw.setFromMatrixPosition(m.m0).applyMatrix4(m.inst.matrixWorld); }
        const dd = _mw.distanceTo(world);
        if (dd < r) {
          m.life = Math.max(0, Math.min(1, m.life - amount * (1 - 0.5 * dd / r)));      // (amount < 0: they grow: a tongue wets the sole where it goes)
          if (m.obj) { m.obj.scale.copy(m.s0).multiplyScalar(m.life); m.obj.visible = m.life > 0.04; }
          else { m.m0.decompose(_mv, _mq, _ms); _ms.multiplyScalar(Math.max(1e-4, m.life)); _mm.compose(_mv, _mq, _ms); m.inst.setMatrixAt(m.i, _mm); dirty = true; }
        }
      }
      left += m.life;
    }
    if (dirty) set.specks.instanceMatrix.needsUpdate = true;
    return all ? left / all : 0;
  }
  // a point on a sole's skin, in the world (footplay.js puts its tools there): u along the sole, v across it
  function solePoint(sd, u, v, out, nOut) {
    const M = soleModel(sd); if (!M) return false;
    if (!M.fit(u, v, out, nOut, 0.009)) { M.at(u, v, out).addScaledVector(M.n, 0.002); nOut.copy(M.n); }
    M.bone.updateWorldMatrix(true, false); out.applyMatrix4(M.bone.matrixWorld); nOut.transformDirection(M.bone.matrixWorld);
    return true;
  }
  // (u, v) of a world point over a sole (and how far off it the point is, along its normal)
  function soleUV(sd, world) {
    const M = soleModel(sd); if (!M) return null;
    M.bone.updateWorldMatrix(true, false); _mv.copy(world).applyMatrix4(_mm.copy(M.bone.matrixWorld).invert());
    const [u, v] = M.uv(_mv); return { u, v, off: _mw.subVectors(_mv, M.at(Math.max(-0.1, Math.min(1.1, u)), 0, _ms)).dot(M.n) };
  }
  // ---------- (10-03, as he asked) her feet and her shoes NEVER sink into the ground, anywhere, in any scene. After the clip is
  // applied, whatever of a foot is below the ground under it (its skin and toes; the shoe on it; the top of her foot too,
  // when she lies on her front) is brought up to the ground: that leg bends a little more at hip and knee (two-bone IK),
  // and the foot keeps its own tilt. The ground is 0 unless the host says otherwise: setGround(fn(x, z)) (index.html: the
  // plank bridges, the pond's shallows), setFloor(y) for a scene's own floor (the hollow under the hole trap; null: back
  // to the ground). A foot more than 35 cm under is being taken there on purpose (a fall into a pit) and is left alone. ----------
  const GR = { fn: null, floor: null, sets: {}, legs: {}, max: 0, lifts: 0, on: true, by: {} };
  function setGround(fn) { GR.fn = typeof fn === 'function' ? fn : null; }
  function setFloor(y) { GR.floor = typeof y === 'number' ? y : null; }
  const DIRS = (() => { const d = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) d.push(new THREE.Vector3(x, y, z).normalize()); return d; })();
  // the outermost points of one foot, each with the bone that carries it: of its skin and toes (bare), or of the shoe on it
  function footHull(sd, shod) {
    const key = sd + '|' + (shod ? shoeStyle : 'bare'); if (GR.sets[key]) return GR.sets[key];
    const out = [], foot = anne.getObjectByName('foot' + sd); if (!foot) return (GR.sets[key] = out);
    const bones = [foot]; foot.traverse((b) => { if (b !== foot && /^toe/.test(b.name)) bones.push(b); });
    let meshes = [];
    if (shod) { const node = (shoeNodes[shoeStyle] || []).find((h) => h.name.endsWith(sd)); if (node) node.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); }); }
    else { anne.traverse((o) => { if (o.isSkinnedMesh && /Feet/.test(o.name)) meshes.push(o); }); if (!meshes.length) { const sp = new Set(); for (const id in shoeNodes) for (const n of shoeNodes[id]) n.traverse((o) => sp.add(o)); anne.traverse((o) => { if (o.isSkinnedMesh && !sp.has(o)) meshes.push(o); }); } }
    // one pass over each mesh: every vertex goes to the bone that carries most of it, in that bone's own space (bind pose)
    const pts = new Map(bones.map((b) => [b, []])), v = new THREE.Vector3();
    for (const o of meshes) {
      const g = o.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, PA = g.attributes.position; if (!SI || !SW || !o.skeleton) continue;
      const bi = new Map(); bones.forEach((b) => { const i = o.skeleton.bones.indexOf(b); if (i >= 0) bi.set(i, { b, m: new THREE.Matrix4().multiplyMatrices(o.skeleton.boneInverses[i], o.bindMatrix) }); });
      if (!bi.size) continue;
      for (let i = 0; i < PA.count; i++) {
        const w = [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)], ix = [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)];
        let k = 0; for (let c = 1; c < 4; c++) if (w[c] > w[k]) k = c;
        // (only what is all but rigid with its bone: the skin round her ankle is shared with her shin, and taken as rigid with
        // the foot it swung 8 cm under the ground whenever she sat with her ankles bent)
        const e = bi.get(ix[k]); if (!e || w[k] < (e.b === foot ? 0.88 : 0.6)) continue;
        pts.get(e.b).push(v.fromBufferAttribute(PA, i).applyMatrix4(e.m).clone());
      }
    }
    for (const b of bones) {
      const P = pts.get(b); if (!P.length) continue;
      const seen = new Set(), dirs = b === foot ? DIRS : DIRS.filter((d, i) => i % 2 === 0);
      for (const d of dirs) { let best = -Infinity, j = -1; for (let i = 0; i < P.length; i++) { const a = P[i].dot(d); if (a > best) { best = a; j = i; } } if (j >= 0 && !seen.has(j)) { seen.add(j); out.push({ bone: b, p: P[j] }); } }
      const M = b === foot ? soleModel(sd) : null;       // and under the sole a closer look (a stiletto's tip, a sole's corners): the lowest point of each cell
      if (M) {
        const cell = new Map();
        for (let i = 0; i < P.length; i++) { const [u, vv] = M.uv(P[i]); if (u < -0.3 || u > 1.4 || Math.abs(vv) > 2.2) continue; const c = Math.floor((u + 0.3) * 5) * 8 + Math.floor((vv + 2.2) * 1.2), a = P[i].dot(M.n), e = cell.get(c); if (!e || a > e.a) cell.set(c, { a, i }); }
        for (const e of cell.values()) if (!seen.has(e.i)) { seen.add(e.i); out.push({ bone: b, p: P[e.i] }); }
      }
    }
    return (GR.sets[key] = out);
  }
  const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _g3 = new THREE.Vector3(), _g4 = new THREE.Vector3(), _g5 = new THREE.Vector3(), _g6 = new THREE.Vector3(), _g7 = new THREE.Vector3(), _g8 = new THREE.Vector3();
  const _gq1 = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gq3 = new THREE.Quaternion(), _gqf = new THREE.Quaternion();
  const turnTo = (bone, q) => { bone.getWorldQuaternion(_gq2).premultiply(q); bone.parent.getWorldQuaternion(_gq3); bone.quaternion.copy(_gq3.invert().multiply(_gq2)); bone.updateMatrixWorld(true); };
  const legOf = (sd) => GR.legs[sd] || (GR.legs[sd] = { th: anne.getObjectByName('upperleg01' + sd), sh: anne.getObjectByName('lowerleg01' + sd), ft: anne.getObjectByName('foot' + sd),
    toes: [1, 2, 3, 4, 5].map((i) => anne.getObjectByName(`toe${i}-1${sd}`)).filter(Boolean) });
  const saveLeg = (L) => { if (!L.saved) L.saved = [L.th.quaternion.clone(), L.sh.quaternion.clone(), L.ft.quaternion.clone(), L.toes.map((t) => t.quaternion.clone())]; };      // (put back before the next frame's clips: groundBefore)
  function liftFoot(sd, up) { const L = legOf(sd); if (!L.ft) return; L.ft.getWorldPosition(_g4); _g4.y += up; ankleTo(sd, _g4, null); }
  // her ankle to a point (the thigh and shin turn: two-bone IK), her foot keeping its tilt or taking `footQ` (a world quaternion)
  function ankleTo(sd, to, footQ) {
    const L = legOf(sd);
    if (!L.th || !L.sh || !L.ft) return;
    saveLeg(L);
    const H = L.th.getWorldPosition(_g1), K = L.sh.getWorldPosition(_g2), A0 = L.ft.getWorldPosition(_g3); if (footQ) _gqf.copy(footQ); else L.ft.getWorldQuaternion(_gqf);
    const l1 = K.distanceTo(H), l2 = A0.distanceTo(K), A2 = _g4.copy(to);
    const d = _g5.subVectors(A2, H); let dl = d.length(); d.normalize(); dl = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-3, dl));
    // the knee stays on the side of the hip-to-ankle line it is on (a straight leg bends it forward, the way she faces)
    const hk = _g6.subVectors(K, H), ha = _g7.subVectors(A0, H).normalize(), pole = _g8.copy(hk).addScaledVector(ha, -hk.dot(ha));
    if (pole.lengthSq() < 1e-7) pole.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y));
    pole.addScaledVector(d, -pole.dot(d)); if (pole.lengthSq() < 1e-9) return; pole.normalize();
    const a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const K2 = _g7.copy(H).addScaledVector(d, a).addScaledVector(pole, h);
    turnTo(L.th, _gq1.setFromUnitVectors(_g6.subVectors(K, H).normalize(), _g8.subVectors(K2, H).normalize()));
    L.sh.getWorldPosition(K); L.ft.getWorldPosition(A0);
    turnTo(L.sh, _gq1.setFromUnitVectors(_g6.subVectors(A0, K).normalize(), _g8.subVectors(A2, K).normalize()));
    L.ft.parent.getWorldQuaternion(_gq3); L.ft.quaternion.copy(_gq3.invert().multiply(_gqf)); L.ft.updateMatrixWorld(true);      // (the foot's own tilt, as it was)
  }
  // (the mixer only writes a bone when its clip's value changes: a held pose would keep what the lift did to it, and the
  // heel pose of toesAfter would be laid on top of it again. So the three bones go back to what they were first.)
  function groundBefore() { for (const sd in GR.legs) { const L = GR.legs[sd]; if (L.saved) { L.th.quaternion.copy(L.saved[0]); L.sh.quaternion.copy(L.saved[1]); L.ft.quaternion.copy(L.saved[2]); L.toes.forEach((t, i) => t.quaternion.copy(L.saved[3][i])); L.saved = null; } } }
  const groundAt = (x, z) => (GR.floor !== null ? GR.floor : GR.fn ? GR.fn(x, z) : 0);
  // ---------- (10-03, as he asked) whenever her ankles are tied they are clamped right next to each other, in every scene:
  // anklesTogether(0..1) (ties.js and the log scene's own ties as the cord goes on; the hole trap's coil and cuffs; the
  // pumpkin's vine). Each ankle is drawn in to the middle between them (two-bone IK, the feet keeping their tilt) until
  // her heels touch (ANK.gap between the ankle joints). ----------
  const ANK = { k: 0, kk: 0, gap: 0.05 };
  function anklesTogether(k = 0) { ANK.k = Math.max(0, Math.min(1, k)); }
  function ankles(dt) {
    ANK.kk = damp(ANK.kk, ANK.k, 7, dt); if (ANK.kk < 0.005) return;
    const L = legOf('L'), R = legOf('R'); if (!L.ft || !R.ft) return;
    const a = L.ft.getWorldPosition(_sv1), b = R.ft.getWorldPosition(_sv2), d = _sv3.subVectors(b, a), dist = d.length();
    if (dist <= ANK.gap + 1e-4) return;
    const mv = (dist - ANK.gap) * 0.5 * ANK.kk; d.divideScalar(dist);
    _sv4.copy(a).addScaledVector(d, mv); ankleTo('L', _sv4, null);
    _sv4.copy(b).addScaledVector(d, -mv); ankleTo('R', _sv4, null);
  }
  // ---------- (10-03, as he asked: "her legs should be shaking a bit" when her feet are tickled) setLegShake(side, 0..1, mode).
  // 'pivot' (a foot up on its toes, the sole flash): the foot trembles about the ball of the foot, her heel quivering, her
  // knee following; her toes stay as they are, and the shoe she has stepped out of is not moved (it is placed first).
  // 'knee' (lying on her front, tied): her shin jerks UP at the knee a little, never down into the ground. ----------
  // (10-03, later: "very fidgety and unsmooth") the quiver now runs at 3 to 6.5 Hz (it was 9 to 21: at 60 frames a second
  // that came out as a jitter), over the same range; and each foot's own matrix BEFORE the shake is kept (footRest): the
  // foot cam's tools hold their hand steady on that, and only their tips ride the skin as it quivers (footplay.js).
  const SHK = { L: { amp: 0, k: 0, mode: 'pivot', rest: new THREE.Matrix4(), has: false }, R: { amp: 0, k: 0, mode: 'pivot', rest: new THREE.Matrix4(), has: false }, t: 0 };
  const footRest = (sd) => { const h = SHK[sd]; return h && h.has ? h.rest : null; };
  function setLegShake(sd, amp = 0, mode = 'pivot') { const h = SHK[sd]; if (h) { h.amp = Math.max(0, Math.min(1, amp)); h.mode = mode; } }
  const _sq1 = new THREE.Quaternion(), _sq2 = new THREE.Quaternion(), _sq3 = new THREE.Quaternion(), _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3(), _sv4 = new THREE.Vector3();
  function legShake(dt) {
    SHK.t += dt;
    for (const sd of ['L', 'R']) {
      const h = SHK[sd], L = legOf(sd); h.k = damp(h.k, h.amp, 9, dt);
      if (L.ft) { L.ft.updateWorldMatrix(true, false); h.rest.copy(L.ft.matrixWorld); h.has = true; }
      if (h.k < 0.004) continue;
      const M = soleModel(sd); if (!L.ft || !L.sh || !M) continue;
      const t = SHK.t + (sd === 'L' ? 0 : 1.7), burst = 0.62 + 0.38 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 0.6);
      const n1 = (0.6 * Math.sin(t * 19) + 0.28 * Math.sin(t * 29 + 1.3) + 0.12 * Math.sin(t * 41 + 0.4)) * burst, n2 = (0.6 * Math.sin(t * 17 + 2) + 0.4 * Math.sin(t * 27)) * burst;
      if (h.mode === 'knee') {
        saveLeg(L);
        const K = L.sh.getWorldPosition(_sv1), A0 = L.ft.getWorldPosition(_sv2), ax = _sv3.set(Math.cos(anne.rotation.y), 0, -Math.sin(anne.rotation.y));      // (across her)
        const up = _sv4.crossVectors(ax, A0.sub(K)).y >= 0 ? 1 : -1;                                 // (which way round lifts her foot)
        // (it only ever lifts: so first to the middle of the shake, which is what footRest gives here, a steady pose for a
        // tool's hand to go by; then the shake itself about that)
        turnTo(L.sh, _sq1.setFromAxisAngle(ax, up * h.k * 0.075 * 0.5)); h.rest.copy(L.ft.matrixWorld);
        turnTo(L.sh, _sq1.setFromAxisAngle(ax, up * h.k * 0.075 * 0.5 * n1));
        continue;
      }
      const toe = dangle.toe[sd]; if (!toe) continue;
      const P = toe.getWorldPosition(_sv1), A0 = L.ft.getWorldPosition(_sv2); L.ft.getWorldQuaternion(_sq2);
      const tq = L.toes.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
      const ax = _sv3.copy(M.side).transformDirection(L.ft.matrixWorld), nn = _sv4.copy(M.n).transformDirection(L.ft.matrixWorld);
      _sq1.setFromAxisAngle(ax, h.k * (0.085 * n1 + 0.05 * Math.sin(t * 6.3) * burst)).multiply(_sq3.setFromAxisAngle(nn, h.k * 0.06 * n2));      // (a quiver, and a slower squirm under it)
      A0.sub(P).applyQuaternion(_sq1).add(P); _sq2.premultiply(_sq1);
      ankleTo(sd, A0, _sq2);
      L.toes.forEach((b, i) => { b.parent.getWorldQuaternion(_sq3); b.quaternion.copy(_sq3.invert().multiply(tq[i])); b.updateMatrixWorld(true); });      // (her toes as they were)
    }
  }
  function groundFeet() {
    if (!GR.on || !anne.visible) return;
    anne.updateMatrixWorld(true);
    for (const sd of ['L', 'R']) {
      const shod = worn[sd] && !(dangle.on && dangle.side === sd);
      let pen = 0;
      for (const set of (shod ? [footHull(sd, true), footHull(sd, false)] : [footHull(sd, false)])) for (const e of set) {
        _g1.copy(e.p).applyMatrix4(e.bone.matrixWorld);
        const g = (GR.floor !== null ? GR.floor : GR.fn ? GR.fn(_g1.x, _g1.z) : 0) - _g1.y; if (g > pen) pen = g;
      }
      if (pen > GR.max && pen <= 0.35) GR.max = pen;
      if (pen > 0.002 && pen <= 0.35) { const c = (exclusiveClip && resolve(exclusiveClip)) || 'walk'; if (!(GR.by[c] >= pen)) GR.by[c] = +pen.toFixed(4); }      // (tests: which clip it was)
      if (pen > 0.0006 && pen <= 0.35) { GR.lifts++; liftFoot(sd, pen); }
    }
  }
  // (10-03) hold the clip she plays where it is (a scene talks over a pose: her heel up in a sole flash), or let it run on
  // again, from `at` seconds if given
  function holdClip(on, at) {
    const n = exclusiveClip && resolve(exclusiveClip), a = n && actions[n]; if (!a) return false;
    a.paused = !!on; if (at !== undefined) a.time = Math.min(at, a.getClip().duration);
    return true;
  }

  // ---------- a second figure from the same model (the thief of the hole trap) ----------
  // clone: SkeletonUtils.clone. look: { name, hide: [node names], tint: { material name: [r, g, b] | (m) => {} }, sock, band, iris,
  // hair: { base, right, left } }. She shares Anne's meshes and clips; her materials, bones, mixer and face are her own.
  // (10-04) what anything made from her but not her (a twin; the foot cam's hands) is drawn with: none of the player's
  // look. Its own tone, eyes, legs and arms, as built or as its `look` says.
  const ownLook = () => Object.assign({}, U, { toeBox: { value: new THREE.Vector4(0, 0, 0, 0) }, gaze: { value: new THREE.Vector2(0, 0) }, pupil: { value: 1 }, blush: { value: 0 }, headW: { value: new THREE.Vector3(0, 1.6, 0) },
    tone: { value: new THREE.Vector3(1, 1, 1) }, toneDeep: { value: 0 }, irisIn: { value: new THREE.Vector3(0.24, 0.62, 1.00) }, irisOut: { value: new THREE.Vector3(0.02, 0.16, 0.66) },
    sock: { value: new THREE.Vector4(0, 0, 0, 0) }, sockLow: { value: -1 }, band: { value: new THREE.Vector4(0, 0, 0, 0) },
    sleeve: { value: new THREE.Vector4(0, 0, 0, 0) }, bandEnds: { value: new THREE.Vector2(0.10, 0.90) }, sock2: { value: new THREE.Vector4(0, 0, 0, 0) }, sockS: { value: 0.03 }, glow: { value: new THREE.Vector4(0, 0, 0, 0) } });
  // a skin material of its own, lit as hers is: for a hand that is not hers (footplay.js)
  function ownSkin(look = {}) {
    let src = null; anne.traverse((o) => { if (!src && o.isSkinnedMesh && o.material && o.material.name === 'Anne_Skin') src = o.material; });
    if (!src) return null;
    const c = src.clone(); c.name = 'Anne_Skin'; skinMaterial(c, ownLook(), look); c.needsUpdate = true; return c;
  }
  function makeTwin(clone, look = {}) {
    const twin = clone(anne); twin.name = look.name || 'Twin'; twin.visible = false; twin.scale.setScalar(1);
    twin.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) { const P0 = PRISTINE.get(o.skeleton.boneInverses); if (P0) o.skeleton.boneInverses = P0.map((m) => m.clone()); } });      // (batch 23: not her body's width: the clone shares her inverse bind matrices by reference)
    { const extra = []; twin.traverse((o) => { if (!OWN.has(o.name)) extra.push(o); }); for (const o of extra) o.removeFromParent(); }      // (not what scenes have hung on Anne's bones: cuffs, cords)
    const UU = ownLook();
    // (10-05) look.shoe: one of the shoe styles instead of the first (Boudicca: closed flats, her leg guards ending at her
    // ankles with look.sockLow); in a closed shoe her forefoot is not drawn, as Anne's is not
    // (10-05, Chapter 2's cast) look.bare: no shoes at all (she plays the Bare clips: thief.js `bare`); look.hairStyle: one of
    // the model's hairstyles instead of the first; look.parts: the skirts, cape, apron and belt to show (node names; their
    // materials are tinted by name like the rest); look.sleeve: [r, g, b, how far down her upper arm]
    const twinShoe = look.shoe && SHOES.styles[look.shoe] && shoeNodes[look.shoe] && shoeNodes[look.shoe].length ? look.shoe : SHOES.order[0];
    { const st = SHOES.styles[twinShoe], hd = !look.bare && st && st.closed && st.hide; if (hd) UU.toeBox.value.set(hd[0], hd[1], 1, 1); }
    const made = new Map(), keep = /Teeth|Gum|Tongue|Lash/;
    const dress = (m) => {
      if (!m || keep.test(m.name)) return m;
      if (made.has(m)) return made.get(m);
      const c = m.clone(); c.name = m.name; made.set(m, c);
      if (builtColor[m.name]) c.color.copy(builtColor[m.name]);      // (10-04: as built, not as the player has recoloured hers)
      if (/^Anne_(Suit|SuitPaint|Skirt)$/.test(m.name)) { c.metalness = 0; c.roughness = m.name === 'Anne_Skirt' ? 0.65 : 0.6; c.envMapIntensity = ENV; }      // (nor her cloth of metal)
      if (m.name === 'Anne_Skin' || m.name === 'Anne_SkinShod') skinMaterial(c, UU, look);
      else if (m.name === 'Anne_GlovePaint') { skinMaterial(c, UU, look); c.roughness = 0.55; }      // her hands are bare: the glove's faces carry skin colours too
      else if (m.name === 'Anne_Eye') eyeMaterial(c, UU, look);
      else if (m.name === 'Anne_Suit' || m.name === 'Anne_Trim') depthBias(c, 6);
      else if (m.name === 'Anne_Hair' && look.hair) {
        c.vertexColors = true; c.color.setScalar(1); c.side = THREE.DoubleSide;
        const H = look.hair;
        c.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, { uHairA: { value: new THREE.Vector3(...H.base) }, uHairR: { value: new THREE.Vector3(...H.right) }, uHairL: { value: new THREE.Vector3(...H.left) } });
          sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position;');
          sh.fragmentShader = 'varying vec3 vRest;\nuniform vec3 uHairA, uHairR, uHairL;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
            {                                                  // the strands' painted light and dark stay; their colour is hers: pale, with a lock of another colour at each side of her face
              float l = dot(vColor.rgb, vec3(0.3, 0.59, 0.11)), shade = clamp(0.62 + l * 2.2, 0.62, 1.15);
              float front = smoothstep(0.015, 0.06, vRest.z) * smoothstep(1.30, 1.38, vRest.y);
              float lockR = front * (1.0 - smoothstep(-0.075, -0.045, vRest.x)), lockL = front * smoothstep(0.045, 0.075, vRest.x);
              diffuseColor.rgb = mix(mix(uHairA, uHairR, lockR), uHairL, lockL) * shade;
            }`);
        };
      }
      const t = look.tint && look.tint[m.name];
      if (Array.isArray(t)) c.color.setRGB(t[0], t[1], t[2]); else if (t) t(c);
      c.needsUpdate = true; return c;
    };
    const hide = new Set(look.hide || []);
    twin.traverse((o) => {
      if (hide.has(o.name)) o.visible = false;
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
      if (/Shod$/.test(o.material.name || '')) o.visible = false;        // she keeps her shoes on
    });
    twin.traverse((o) => { if (/^Anne_Shoe_/.test(o.name)) o.visible = false; });      // (she wears the first style, whatever Anne has on)
    // (10-04: and the first hairstyle and the outfit as built, whatever the player has given Anne; no shape of her face but the built one)
    twin.traverse((o) => { if (/^Anne_(Hair_|Skirt|Belt|Cape|Sash|Tutu|Panels|Apron)/.test(o.name)) o.visible = false; else if (/^Anne_(Hair|Suit|SuitTrim|Choker|Hat|HatBand)$/.test(o.name) && !hide.has(o.name)) o.visible = true;
      if (o.isMesh && o.morphTargetDictionary) for (const k in o.morphTargetDictionary) if (k.startsWith('shape-')) o.morphTargetInfluences[o.morphTargetDictionary[k]] = 0; });
    for (const n of ['Anne_Heel_L', 'Anne_Heel_R']) { const h = twin.getObjectByName(n); if (h) h.visible = !look.bare && twinShoe === SHOES.order[0]; }
    { const hs = look.hairStyle && look.hairStyle !== HAIR.order[0] ? twin.getObjectByName('Anne_Hair_' + look.hairStyle) : null;
      if (hs) { const h0 = twin.getObjectByName('Anne_Hair'); if (h0) h0.visible = false; hs.traverse((o) => { o.visible = true; }); }
      for (const n of look.parts || []) { const pt = twin.getObjectByName(n); if (pt) pt.traverse((o) => { o.visible = true; }); } }
    if (!look.bare && twinShoe !== SHOES.order[0]) for (const sd of ['L', 'R']) { const h = twin.getObjectByName('Anne_Shoe_' + twinShoe + '_' + sd); if (h) h.traverse((o) => { o.visible = true; }); }      // (the pass above hid its parts one by one)
    scene.add(twin);
    const mx = new THREE.AnimationMixer(twin), acts = {}; let cur = null;
    const action = (name) => { if (!acts[name]) { const clip = gltf.animations.find((c) => c.name === name); if (!clip) return null; acts[name] = mx.clipAction(clip); } return acts[name]; };
    function play(name, fade = 0.3) {
      const a = action(name); if (!a || a === cur) return a;
      a.reset(); a.setEffectiveWeight(1); a.play();
      if (cur && fade > 0) a.crossFadeFrom(cur, fade, false); else if (cur) cur.stop();
      cur = a; return a;
    }
    let skinned = null; twin.traverse((o) => { if (!skinned && o.isSkinnedMesh) skinned = o; });
    return { obj: twin, mixer: mx, play, action, face: makeFace(twin, UU), skeleton: skinned ? skinned.skeleton : null, bone: (n) => twin.getObjectByName(n) };
  }

  const eyeH = metrics.eyeHeight || 1.5;
  return {
    anne, mixer, metrics,
    heelProp: heelGltf ? heelGltf.scene : null,
    get headHeight() { return (eyeH - 0.06) * bodyNow.h; },      // where the follow camera looks (batch 23: at her head, whatever her length)
    stuck: metrics.stuck || null,                   // where her hips and face are in the hollow log (for the cut-scene)
    ownSkin, playClip, releaseClips, updateClips, poseClip, holdClip, soleMarks, setExpression, setTalking, setGaze, updateFace, setHeelsWorn, setShoe, setNailColor, setShoeStyle, setShoeColor, shoeHeel: () => +(styleNow().heel || styleNow().lift > 0.03 || 0), setSkinTone, setEyeColor, setHairColor, setOutfitColors, setArms, setLegs, setSleeves, setTrimLow, setSkirtLift, setBody, body: () => bodyNow, setCut, setPattern, setSkinFinish, setGlow, setSuitFinish, setHatWorn, hatWorn: () => hatWorn, setParts, setHairStyle, hairStyle: () => hairStyle, hairStyles: () => HAIR.order.filter((id) => hairNodes[id]).map((id) => Object.assign({ id }, HAIR.styles[id])), setShape, shapes: () => SHAPES.slice(), setLidBias: (b) => face.setBias(b), snapFace: (n, b) => face.snap(n, b), shoeStyle: () => shoeStyle, clipSec: (n) => { const r = resolve(n); return (metrics.clips && metrics.clips[r]) || (actions[r] ? actions[r].getClip().duration : 0); }, heelStyle: () => !!styleNow().heel, shoeStyles: () => SHOES.order.map((id) => ({ id, label: SHOES.styles[id].label, heel: !!SHOES.styles[id].heel, closed: !!SHOES.styles[id].closed })).filter((x) => shoeNodes[x.id] && shoeNodes[x.id].length), setHat, setToeWiggle, hasClip: (n) => !!actions[n], makeTwin,
    clipTime: (n) => { const a = actions[resolve(n)]; return a ? a.time : 0; },
    // (10-05) how fast a clip of hers runs (1 = as built): a scene's tickled clip a little faster for the hardest tickling,
    // slower while something is done to her feet that needs them nearly still. Not for the gaits (they run on her stride).
    clipSpeed: (n, k = 1) => { for (const x of [n, n + 'Bare', n + 'Hi']) if (actions[x] && !GAITS.includes(n)) actions[x].timeScale = k; }, clipLength: (n) => { const a = actions[resolve(n)]; return a ? a.getClip().duration : 0; }, _marks: () => MK, scrubMarks, solePoint, soleUV, layMarks, propMarks, setGround, setFloor, groundFeet, setLegShake, footRest, anklesTogether, ankleGap: () => { const a = legOf('L').ft, b = legOf('R').ft; return a && b ? +a.getWorldPosition(_sv1).distanceTo(b.getWorldPosition(_sv2)).toFixed(4) : -1; }, groundStats: (reset) => { const r = { max: +GR.max.toFixed(4), lifts: GR.lifts, by: Object.assign({}, GR.by) }; if (reset) { GR.max = 0; GR.lifts = 0; GR.by = {}; } return r; },
    dangleLow: () => { if (!dangle.on) return null; let y = Infinity; for (const p of dangle.low) { _dv.copy(p).applyMatrix4(dangle.M); if (_dv.y < y) y = _dv.y; } return +y.toFixed(5); },      // (tests: the lowest point of the shoe she has stepped out of) groundOn: (on) => { GR.on = !!on; },
    debug: () => ({ heelsWorn, exclusiveClip, hat: hatOn }), skinShadowOk: () => skinShadowOk, shoes: () => ({ L: worn.L, R: worn.R }),
  };
}
