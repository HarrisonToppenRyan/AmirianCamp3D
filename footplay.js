// footplay.js (10-03, as he asked): Anne's soles are played with in the foot cam. Reworked the same day, as he asked again:
// "an automatic cinematic style animation with no input from the player besides to stop or switch to something else",
// directed with his Motion Reel Kit's rules (lib/motion.js; ~/Documents/Claude/motion-reel-kit):
//   - every move is a closed-form spring, a pure function of the take's own time (Motion.track: one spring per change,
//     never restarted); variation is seeded (mulberry32), so a take always plays the same way;
//   - everything sits on a beat grid (96 beats a minute, four to the bar): strokes, hops, licks, her voice and her lines;
//   - the camera is a shot list: hard cuts on bar lines, never a crossfade, and every held shot keeps moving (a slow push
//     of a few per cent, a little drift); something new every bar.
// The player picks a tool in the side bar and it plays by itself; "Stop" (or the same button again) ends it.
//   Fingers   a woman's hand with long, sharp nails (their colour is the player's choice), in two ways: "Teasing" (the
//             nails rake slowly from the ball of her foot to her heel, again and again, each finger curling in turn) and
//             "Tickling" (the hand stays on a spot, only its fingers scribble; it hops to another spot every two beats);
//   Feather   slow strokes, little circles, flicks under her toes; it bends against the sole and trails behind itself;
//   Tongue    a mouth right behind her sole and a tongue the size of a real one: one lick a bar, from the ball of her
//             foot all the way up to her heel;
//   Fuzzy brush  scrubs its way over the sole in little circles, and takes saliva and tickle specks off (A.scrubMarks).
// Standing, she lifts a foot into the sole flash (her heel up out of the shoe, the shoe left on the ground: anne_next.js)
// and holds it for a take of eight bars; then the other foot (now and then in another pair of shoes). How she takes it
// depends on the tool: the feather teases (she rather likes it), raking nails and the tongue make her giggle, scribbling
// nails and the brush make her laugh out loud; her leg shakes with it (A.setLegShake); what she says depends on the tool.
//  - "Tie her up": she lies on her front, ankles and big toes tied (ties.js, as the captures tie her), both soles to the
//    picture; the tools take her soles in turn (the fingers: a hand on each sole at once).
//  - clean(o): after a capture left saliva or tickle specks on her soles (captures.js shoeFlash, logscene.js): THERE the
//    player scrubs them off with the mouse, one sole and then the other (as he asked for that game).
// Smoothness: her sole is sampled once into a smooth surface (soleOf), so a tool's path over it never jumps; a tool's hand
// is held on her foot as it is BEFORE it shakes (A.footRest), steady, and only what touches rides the skin as it quivers:
// each fingernail is brought down to the skin by its own knuckle (fingerDown). Nothing here goes into her skin.
// Host (index.html): update(dt, t) every frame after the clips; camGoal() is where the camera should be (or null; with
// `direct` it is taken as it is, cuts and all); wantsPointer() keeps the camera drag off; busy() stops the bored idles;
// tied() stops her walking.
const VQ = new URL(import.meta.url).search;
const { createTies } = await import('./ties.js' + VQ);
await import('./lib/motion.js' + VQ);
const Motion = globalThis.Motion;

export function createFootPlay(env) {
  const { THREE, scene, camera, renderer, anne, A } = env;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), clamp = THREE.MathUtils.clamp, PI = Math.PI;
  const FLASH = { L: 'IdleTiptoe', R: 'IdleTiptoeR' }, HOLD_AT = { L: 2.5, R: 2.9 };      // (her heel is up, before she looks round)
  const voice = (b, v) => { if (env.voice) env.voice(b, v); };
  const sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const has = (n) => A.hasClip && A.hasClip(n), TS = () => (env.timeScale ? env.timeScale() : 1);
  const stored = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, keep = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const other = (sd) => (sd === 'L' ? 'R' : 'L');

  // =====================================================================================================
  //                         the kit's grid: beats, seeded noise, values with several targets
  // =====================================================================================================
  const BPM = 96, BEAT = 60 / BPM, BAR = 4 * BEAT;                         // 0.625 s a beat, 2.5 s a bar
  // (springs of our own beside the kit's presets: a slow drag is a row of small steps, each on a soft spring)
  const GLIDE = { response: 0.62, damping: 1 }, SLOW = { response: 0.95, damping: 1 }, LICK = { response: 0.42, damping: 1 }, BACK = { response: 0.5, damping: 1 };
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = (seed, n, ch = 0) => mulberry32((seed ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(ch + 1, 0x85EBCA6B)) | 0)();      // the same (seed, n, channel): the same number
  const noise1 = (seed) => { const r = mulberry32(seed), v = Array.from({ length: 256 }, () => r() * 2 - 1); return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 255] + (v[(i + 1) & 255] - v[i & 255]) * u; }; };
  const N1 = noise1(1117), N2 = noise1(2203), N3 = noise1(3301);
  // A value that is given a new target now and then. keysOf(bar, take) -> [[beat in that bar, value, spring?], ...] in order;
  // it is the sum of one spring per change (the kit's track()), over this bar and the three before it (older springs have
  // long settled: their last value is where it starts from). The keys are kept on the take, per bar.
  let trackId = 0;
  function makeTrack(keysOf, init = 0, preset = 'default', back = 3) {
    const id = trackId++;
    return (s, tk) => {
      const bar = Math.max(0, Math.floor(s / BAR)); let c = tk.c[id];
      if (!c || c.bar !== bar) {
        const from = Math.max(0, bar - back); let v0 = typeof init === 'function' ? init(tk) : init;
        for (let b = from - 1; b >= 0; b--) { const ks = keysOf(b, tk); if (ks.length) { v0 = ks[ks.length - 1][1]; break; } }
        const keys = [[-1, v0]];
        for (let b = from; b <= bar; b++) for (const k of keysOf(b, tk)) keys.push([(b * 4 + k[0]) * BEAT, k[1], k[2]]);
        c = tk.c[id] = { bar, keys };
      }
      return Motion.track(s, c.keys, preset);
    };
  }

  // =====================================================================================================
  //                                                the tools
  // Each is a group whose own frame lies on the sole: +Y out of the sole, +Z along it (heel to toes), +X across it; the
  // point that touches is its origin.
  // =====================================================================================================
  function makeBrush() {
    const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.5 });
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.03, 5, 14), wood); back.rotation.x = PI / 2; back.scale.set(1, 1, 0.5); back.position.y = 0.02; g.add(back);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.007, 0.105, 10), wood); handle.position.set(0, 0.062, -0.034); handle.rotation.x = -0.52; g.add(handle);
    // the fuzz: soft pink-white bristles, a couple of hundred of them, a little untidy
    const N = 210, fz = new THREE.InstancedMesh(new THREE.ConeGeometry(0.0017, 0.0145, 5), new THREE.MeshStandardMaterial({ color: 0xffd9ec, roughness: 0.95, emissive: 0x402030, emissiveIntensity: 0.25 }), N);
    const d = new THREE.Object3D(); let s = 7;
    const rn = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < N; i++) {
      const a = rn() * PI * 2, r = Math.sqrt(rn());
      d.position.set(Math.cos(a) * r * 0.0125, 0.0073 + 0.0025 * rn(), Math.sin(a) * r * 0.026); d.rotation.set(PI + (rn() - 0.5) * 0.5, 0, (rn() - 0.5) * 0.5); d.scale.setScalar(0.8 + 0.5 * rn());
      d.updateMatrix(); fz.setMatrixAt(i, d.matrix);
    }
    fz.instanceMatrix.needsUpdate = true; g.add(fz);
    return g;
  }
  // The feather: a ribbon drawn afresh every frame along a curve from the quill (held off the sole) to its tip (on the
  // sole), so that it bends where it is pressed and trails behind its strokes; three points across (a slight keel).
  function makeFeather() {
    const NS = 18, pos = new Float32Array((NS + 1) * 3 * 3), colr = new Float32Array((NS + 1) * 3 * 3), idx = [];
    for (let i = 0; i < NS; i++) { const a = i * 3, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
    for (let i = 0; i <= NS; i++) { const s = i / NS, tip = sst(s, 0.6, 1), c = [[0.97 - 0.12 * tip, 0.95 - 0.2 * tip, 1.0], [0.86, 0.8, 0.7], [0.97 - 0.12 * tip, 0.95 - 0.2 * tip, 1.0]]; for (let k = 0; k < 3; k++) colr.set(c[k], (i * 3 + k) * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, emissive: 0x2a2444, emissiveIntensity: 0.45 })); mesh.frustumCulled = false;
    const p = V3(), tg = V3(), w = V3(), f = V3();
    // p0..p3: a cubic curve, the quill's end to the tip; nrm: the sole's normal (the vane lies flat to the sole); flut: how much it flutters
    mesh.userData.draw = (p0, p1, p2, p3, nrm, t, flut) => {
      for (let i = 0; i <= NS; i++) {
        const s = i / NS, m = 1 - s, a = m * m * m, b = 3 * m * m * s, c = 3 * m * s * s, d = s * s * s;
        p.set(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y, a * p0.z + b * p1.z + c * p2.z + d * p3.z);
        tg.set(3 * m * m * (p1.x - p0.x) + 6 * m * s * (p2.x - p1.x) + 3 * s * s * (p3.x - p2.x), 3 * m * m * (p1.y - p0.y) + 6 * m * s * (p2.y - p1.y) + 3 * s * s * (p3.y - p2.y), 3 * m * m * (p1.z - p0.z) + 6 * m * s * (p2.z - p1.z) + 3 * s * s * (p3.z - p2.z));
        if (tg.lengthSq() < 1e-12) tg.subVectors(p3, p0); tg.normalize();
        w.crossVectors(nrm, tg); if (w.lengthSq() < 1e-8) w.set(1, 0, 0); w.normalize(); f.crossVectors(tg, w);
        const v = clamp((s - 0.2) / 0.8, 0, 1), half = 0.0011 + 0.0185 * Math.pow(Math.sin(PI * Math.pow(v, 0.78)), 0.7);      // (a bare quill, then the vane, rounded off at its tip)
        const wave = flut * 0.0035 * s * s * Math.sin(t * 9 - s * 9);
        const o = i * 9;
        pos[o] = p.x - w.x * half + f.x * wave; pos[o + 1] = p.y - w.y * half + f.y * wave; pos[o + 2] = p.z - w.z * half + f.z * wave;
        pos[o + 3] = p.x + f.x * (0.0016 * v + wave); pos[o + 4] = p.y + f.y * (0.0016 * v + wave); pos[o + 5] = p.z + f.z * (0.0016 * v + wave);
        pos[o + 6] = p.x + w.x * half + f.x * wave; pos[o + 7] = p.y + w.y * half + f.y * wave; pos[o + 8] = p.z + w.z * half + f.z * wave;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    };
    return mesh;
  }
  // A hand: a woman's, with long sharp nails. It is Anne's own modelled hand and forearm (hs: 'R' or 'L'), cut out of her
  // skin into a small skinned mesh of its own (the vertices her wrist, hand and forearm bones carry), on copies of those
  // bones in their bind pose: a real hand, with real knuckles to curl. It sits in a frame of its own: the wrist at the
  // origin, fingers along +Z, the back of the hand +Y (the palm faces the sole); +X is the thumb's side of a right hand and
  // the little finger's side of a left one (so a left hand is the right one's mirror image in the same frame). Each finger:
  // three bones that curl towards the palm (curl(a1, a2, a3)); `tip`: the point of its nail; `root`, `ax0`: its knuckle and
  // the axis it curls about (fingerDown brings the nail to her skin with that knuckle); `mid`: its last joint.
  // (batch 22, as he asked) The hands and the tongue are LILITH's: her pale skin, her long purple gloves (fingerless here,
  // for the nails). She comes through a small portal that opens in the ground: her upper arms go down into it.
  const LIL_GLOVE = [0.30, 0.10, 0.40], LIL_SKIN = new THREE.Color(1.0, 0.93, 0.97), LIL_ARM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.60, 0.50, 0.50), roughness: 0.55, emissive: 0x24100c });
  function makeHand(hs = 'R') {
    const left = hs === 'L';
    const wrist = anne.getObjectByName('wrist' + hs), a1 = anne.getObjectByName('lowerarm01' + hs), a2 = anne.getObjectByName('lowerarm02' + hs);
    let src = null, most = 0;
    if (wrist && a1 && a2) anne.traverse((o) => {
      if (!o.isSkinnedMesh || !o.skeleton || !o.geometry.index) return; const wi = o.skeleton.bones.indexOf(wrist); if (wi < 0) return;
      const SI = o.geometry.attributes.skinIndex; let n = 0; for (let i = 0; i < SI.count; i += 3) if (SI.getX(i) === wi) n++;
      if (n > most) { most = n; src = o; }
    });
    if (!src) return makeHandPlain();
    const M4 = () => new THREE.Matrix4(), S = [a1, a2, wrist]; wrist.traverse((b) => { if (b !== wrist && b.isBone) S.push(b); });
    const sk = src.skeleton, si = S.map((b) => sk.bones.indexOf(b)); if (si.some((i) => i < 0)) return makeHandPlain();
    const map = new Map(si.map((i, k) => [i, k]));
    const G = src.geometry, PA = G.attributes.position, NA = G.attributes.normal, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, IX = G.index;
    const CA = G.attributes.color, keepV = new Int32Array(PA.count).fill(-1), pos = [], nor = [], colr = [], sidx = [], swt = [], dom = []; let nv = 0;      // (her skin's colours are painted on its vertices, her hands' under the gloves too)
    for (let i = 0; i < PA.count; i++) {
      const ix = [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)], w = [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)];
      let win = 0, kd = 0; for (let c = 0; c < 4; c++) { if (map.has(ix[c])) win += w[c]; if (w[c] > w[kd]) kd = c; }
      if (win < 0.5) continue;
      keepV[i] = nv++; pos.push(PA.getX(i), PA.getY(i), PA.getZ(i)); nor.push(NA.getX(i), NA.getY(i), NA.getZ(i)); dom.push(map.has(ix[kd]) ? map.get(ix[kd]) : 0);
      if (CA) colr.push(CA.getX(i), CA.getY(i), CA.getZ(i));
      for (let c = 0; c < 4; c++) { sidx.push(map.has(ix[c]) ? map.get(ix[c]) : 0); swt.push(w[c]); }      // (what her upper arm carried goes to the forearm's root)
    }
    const tri = []; for (let i = 0; i < IX.count; i += 3) { const a = keepV[IX.getX(i)], b = keepV[IX.getX(i + 1)], c = keepV[IX.getX(i + 2)]; if (a >= 0 && b >= 0 && c >= 0) tri.push(a, b, c); }
    if (tri.length < 300) return makeHandPlain();
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sidx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(swt, 4)); geo.setIndex(tri);
    if (CA) geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    // the bones, as they are in the bind pose (from the skeleton's inverses), under `fit`, which brings the wrist to the origin of the hand's own frame
    const rest = si.map((i) => M4().copy(sk.boneInverses[i]).invert()), rp = rest.map((m) => V3().setFromMatrixPosition(m)), rq = rest.map((m) => new THREE.Quaternion().setFromRotationMatrix(M4().extractRotation(m)));
    const g = new THREE.Group(), hand = new THREE.Group(), fit = new THREE.Group(); hand.rotation.order = 'YXZ'; g.add(hand); hand.add(fit);
    const bones = S.map((b) => { const nb = new THREE.Bone(); nb.name = 'Hand_' + b.name; return nb; });
    S.forEach((b, k) => { const pk = S.indexOf(b.parent), loc = pk >= 0 ? M4().copy(rest[pk]).invert().multiply(rest[k]) : rest[k].clone(); loc.decompose(bones[k].position, bones[k].quaternion, bones[k].scale); (pk >= 0 ? bones[pk] : fit).add(bones[k]); bones[k].userData.q0 = bones[k].quaternion.clone(); });
    const bi = (name) => S.findIndex((b) => b.name === name), W = 2;
    // the hand's own directions in the bind pose: along the fingers, towards the thumb's side, out of the back of the hand
    const kI = bi('finger2-1' + hs), kP = bi('finger5-1' + hs), kM = bi('finger3-1' + hs); if (kI < 0 || kP < 0 || kM < 0) return makeHandPlain();
    const fwd = V3().subVectors(rp[kM], rp[W]).normalize(), acr = V3().subVectors(rp[kI], rp[kP]); acr.addScaledVector(fwd, -acr.dot(fwd)).normalize();
    const hx = left ? acr.clone().negate() : acr, back = V3().crossVectors(fwd, hx).normalize();
    // fit: bind space -> the hand's frame (+X as said above, back of the hand +Y, fingers +Z), the wrist at its origin
    const toHand = M4().makeBasis(hx, back, fwd).invert().multiply(M4().makeTranslation(-rp[W].x, -rp[W].y, -rp[W].z)); toHand.decompose(fit.position, fit.quaternion, fit.scale);
    // her own skin's material (anne_next.js skinMaterial: the painted colours, soft wrapped light, a warm scatter at the shadow's
    // edge), so that the hand is lit exactly as her soles are; a plain one went grey-blue in the shade beside them
    let annSkin = null; anne.traverse((o) => { if (!annSkin && o.isSkinnedMesh && o.material && o.material.name === 'Anne_Skin') annSkin = o.material; });
    const own = CA && annSkin && A.ownSkin ? A.ownSkin({ band: LIL_GLOVE }) : null;      // (10-04: not HER skin: a hand of its own, whatever tone the player gave her; batch 22: Lilith's, in her long fingerless glove)
    if (own) own.color.multiply(LIL_SKIN);
    const skin = own || (CA && annSkin ? annSkin : null) || (CA ? new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.5, 0.4, 0.375), roughness: 0.55, envMapIntensity: 0.2, emissive: 0x2a140e }) : new THREE.MeshStandardMaterial({ color: 0xb8907c, roughness: 0.55 }));
    const nailMat = new THREE.MeshStandardMaterial({ color: 0xc4122f, roughness: 0.16, metalness: 0.05 });
    const mesh = new THREE.SkinnedMesh(geo, skin); mesh.bind(new THREE.Skeleton(bones, si.map((i) => sk.boneInverses[i].clone())), src.bindMatrix); mesh.frustumCulled = false; g.add(mesh);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), LIL_ARM); bones[0].add(cap);      // (her elbow: the cut end is closed)
    g.userData.elbow = cap;
    // each finger: its three bones, the axis each curls about (in its own space), the tip of its long nail
    const _v = V3(), tipOf = (k) => { let y = 0, r = 0, n = 0; const inv = sk.boneInverses[si[k]], bm = src.bindMatrix; for (let i = 0; i < dom.length; i++) if (dom[i] === k) { _v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(bm).applyMatrix4(inv); if (_v.y > y) y = _v.y; r += Math.hypot(_v.x, _v.z); n++; } return { y, r: n ? r / n : 0.006 }; };
    const finger = (i, nailLen) => {
      const ks = [1, 2, 3].map((j) => bi(`finger${i}-${j}${hs}`)); if (ks.some((k) => k < 0)) return null;
      const ax = ks.map((k) => V3().copy(hx).applyQuaternion(rq[k].clone().invert()).normalize()), T = tipOf(ks[2]), r = Math.max(0.0045, Math.min(0.008, T.r));
      const dl = V3().copy(back).applyQuaternion(rq[ks[2]].clone().invert()); dl.y = 0; dl.normalize();      // (the back of the fingertip, in its bone's space)
      const cone = new THREE.ConeGeometry(r * 0.95, nailLen, 10); cone.scale(1, 1, 0.42);
      const n = new THREE.Mesh(cone, nailMat); n.rotation.y = Math.atan2(dl.x, dl.z); n.position.copy(dl).multiplyScalar(r * 0.55); n.position.y = T.y - 0.006 + nailLen / 2; bones[ks[2]].add(n);
      const tip = new THREE.Object3D(); tip.position.copy(dl).multiplyScalar(r * 0.55); tip.position.y = T.y - 0.006 + nailLen; bones[ks[2]].add(tip);
      const b = ks.map((k) => bones[k]), q = new THREE.Quaternion();
      // (sp: a curled finger's tip drawn in towards the middle finger's, as the tips of a real hand come together when it
      // closes: a turn about the hand's own length at the knuckle, before the finger curls)
      const spAx = V3().copy(fwd).applyQuaternion(rq[ks[0]].clone().invert()).normalize(), spSign = (left ? -1 : 1) * [0, 0, -1.6, 0, 1, 1.9][i];
      return { k: i - 2, tip, root: b[0], mid: b[2], ax0: ax[0], curl(c1, c2, c3, sp = 0) {
        b[0].quaternion.copy(b[0].userData.q0); if (sp) b[0].quaternion.multiply(q.setFromAxisAngle(spAx, sp * spSign));
        b[0].quaternion.multiply(q.setFromAxisAngle(ax[0], c1)); b[1].quaternion.copy(b[1].userData.q0).multiply(q.setFromAxisAngle(ax[1], c2)); b[2].quaternion.copy(b[2].userData.q0).multiply(q.setFromAxisAngle(ax[2], c3));
      } };
    };
    const fingers = [2, 3, 4, 5].map((i) => finger(i, 0.021)).filter(Boolean), thumb = finger(1, 0.018);
    if (fingers.length < 4 || !thumb) return makeHandPlain();
    thumb.k = -1;
    // the wrist bends back a little, so that her forearm rises off the sole while her fingers lie to it
    const wq = new THREE.Quaternion(), wax = V3().copy(hx).applyQuaternion(rq[W].clone().invert()).normalize();
    Object.assign(g.userData, { hand, fingers, thumb, nailMat, real: true, side: hs, wristBone: bones[W], wristBend(a) { bones[W].quaternion.copy(bones[W].userData.q0).multiply(wq.setFromAxisAngle(wax, a)); } });
    return g;
  }
  // (if her model has no such bones: a plain hand of capsules)
  function makeHandPlain() {
    const g = new THREE.Group(), hand = new THREE.Group(); hand.rotation.order = 'YXZ'; g.add(hand);
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1cbb6, roughness: 0.62 }), nailMat = new THREE.MeshStandardMaterial({ color: 0xc4122f, roughness: 0.16, metalness: 0.05 });
    const seg = (parent, r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r), 4, 10), skin); m.rotation.x = PI / 2; m.position.z = len / 2; parent.add(m); };
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); palm.scale.set(0.0335, 0.0112, 0.043); palm.position.set(0, 0, -0.038); hand.add(palm);
    const arm = new THREE.Group(); arm.position.set(0, 0, -0.07); arm.rotation.x = 0.3; hand.add(arm);      // (her forearm, away and up out of the picture)
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.03, 0.26, 16), skin); fore.rotation.x = PI / 2; fore.scale.set(1, 1, 0.74); fore.position.z = -0.13; arm.add(fore);
    const nail = (parent, r, len, at) => {       // a long nail, pointed, lying on the back of the fingertip; returns its tip
      const n = new THREE.Mesh(new THREE.ConeGeometry(r * 0.86, len, 10), nailMat); n.rotation.x = PI / 2; n.scale.set(1, 1, 0.4); n.position.set(0, r * 0.42, at - 0.0045 + len / 2); parent.add(n);
      const tip = new THREE.Object3D(); tip.position.set(0, r * 0.42, at - 0.0045 + len); parent.add(tip); return tip;
    };
    const F = [[-0.0245, 0.0, [0.031, 0.02, 0.016], 0.0064], [-0.0082, 0.004, [0.034, 0.022, 0.017], 0.0066], [0.0082, 0.002, [0.031, 0.02, 0.016], 0.0063], [0.0238, -0.004, [0.025, 0.016, 0.014], 0.0056]];
    const fingers = F.map(([x, z, L, r], k) => {
      const j1 = new THREE.Group(); j1.position.set(x, 0, z); j1.rotation.order = 'YXZ'; j1.rotation.y = (1.5 - k) * 0.075; hand.add(j1); seg(j1, r, L[0]);
      const j2 = new THREE.Group(); j2.position.z = L[0]; j1.add(j2); seg(j2, r * 0.92, L[1]);
      const j3 = new THREE.Group(); j3.position.z = L[1]; j2.add(j3); seg(j3, r * 0.84, L[2]);
      return { k, tip: nail(j3, r * 0.84, 0.02, L[2]), root: j1, mid: j3, ax0: V3(1, 0, 0), curl(c1, c2, c3) { j1.rotation.x = c1; j2.rotation.x = c2; j3.rotation.x = c3; } };
    });
    const t1 = new THREE.Group(); t1.position.set(-0.031, -0.003, -0.05); t1.rotation.order = 'YXZ'; t1.rotation.y = -0.85; hand.add(t1); seg(t1, 0.0078, 0.032);
    const t2 = new THREE.Group(); t2.position.z = 0.032; t1.add(t2); seg(t2, 0.0068, 0.025);
    const thumb = { k: -1, tip: nail(t2, 0.0068, 0.017, 0.025), root: t1, mid: t2, ax0: V3(1, 0, 0), curl(c1, c2) { t1.rotation.x = c1; t2.rotation.x = c2; } };
    Object.assign(g.userData, { hand, fingers, thumb, nailMat, real: false, side: 'R', wristBend() {} });
    return g;
  }
  // the tongue: the size of a real one (about 3 cm across, 4 cm out of the mouth), flat, rounded at its tip; a flattened
  // tube drawn afresh every frame from the mouth to her skin
  function makeTongue() {
    const R = 16, S = 12, pos = new Float32Array(R * S * 3), idx = [];
    for (let i = 0; i < R - 1; i++) for (let k = 0; k < S; k++) { const a = i * S + k, b = i * S + (k + 1) % S; idx.push(a, a + S, b, b, a + S, b + S); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe2607f, roughness: 0.32, metalness: 0, emissive: 0x3a1018, emissiveIntensity: 0.4 })); mesh.frustumCulled = false;
    const p = V3(), tg = V3(), w = V3(), h = V3();
    mesh.userData.draw = (p0, p1, p2, across) => {          // a quadratic curve root -> bend -> tip; `across`: its width's direction
      for (let i = 0; i < R; i++) {
        const s = i / (R - 1), m = 1 - s;
        p.set(m * m * p0.x + 2 * m * s * p1.x + s * s * p2.x, m * m * p0.y + 2 * m * s * p1.y + s * s * p2.y, m * m * p0.z + 2 * m * s * p1.z + s * s * p2.z);
        tg.set(2 * m * (p1.x - p0.x) + 2 * s * (p2.x - p1.x), 2 * m * (p1.y - p0.y) + 2 * s * (p2.y - p1.y), 2 * m * (p1.z - p0.z) + 2 * s * (p2.z - p1.z));
        if (tg.lengthSq() < 1e-12) tg.subVectors(p2, p0); tg.normalize();
        w.copy(across).addScaledVector(tg, -across.dot(tg)); if (w.lengthSq() < 1e-8) w.set(1, 0, 0); w.normalize(); h.crossVectors(tg, w);
        const rw = (0.0115 + 0.003 * Math.sin(PI * Math.min(1, s * 1.1))) * (s > 0.8 ? Math.sqrt(Math.max(0, 1 - ((s - 0.8) / 0.2) ** 2)) : 1), rh = Math.max(0.0008, rw * (0.34 - 0.1 * s));      // (widest in its middle, rounded off at the tip, flatter towards it)
        for (let k = 0; k < S; k++) { const a = k / S * PI * 2, o = (i * S + k) * 3; pos[o] = p.x + w.x * Math.cos(a) * rw + h.x * Math.sin(a) * rh; pos[o + 1] = p.y + w.y * Math.cos(a) * rw + h.y * Math.sin(a) * rh; pos[o + 2] = p.z + w.z * Math.cos(a) * rw + h.z * Math.sin(a) * rh; }
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    };
    return mesh;
  }
  // the mouth the tongue comes out of: a pair of lips right behind her sole (it looks along its own +Z)
  function makeMouth() {
    const g = new THREE.Group();
    // (lips, not a ring: wide, not tall, their roll flattened; 5 cm across like anyone's)
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.0172, 0.0052, 10, 28), new THREE.MeshStandardMaterial({ color: 0xc2405f, roughness: 0.38, emissive: 0x2c060e, emissiveIntensity: 0.5 })); lips.scale.set(1.22, 0.6, 0.8); g.add(lips);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(0.0168, 22), new THREE.MeshBasicMaterial({ color: 0x24070d, side: THREE.DoubleSide })); dark.scale.set(1.22, 0.6, 1); dark.position.z = -0.0012; g.add(dark);
    return g;
  }
  const HANDS = { R: makeHand('R'), L: makeHand('L') };
  const TOOLS = {
    fingers: { label: 'Fingers', obj: HANDS.R, off: 0 },
    feather: { label: 'Feather', obj: makeFeather(), off: 0.0012 },
    tongue: { label: 'Tongue', obj: makeTongue(), off: 0.0016 },
    brush: { label: 'Fuzzy brush', obj: makeBrush(), off: 0.0008 },
  };
  const mouth = makeMouth();
  const allTools = [mouth, HANDS.L, ...Object.values(TOOLS).map((x) => x.obj)];
  for (const o of allTools) { o.visible = false; o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.frustumCulled = false; } }); scene.add(o); }
  // ----- the portal (batch 22): a dark swirling hole with a bright rim, flat on the ground; a small one stands behind her mouth
  const PORTAL_FS = `
    uniform float uT, uK; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      if (r > 1.0) discard;
      float sw = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uT * 3.2), sw2 = 0.5 + 0.5 * sin(a * 5.0 - r * 14.0 + uT * 2.1);
      vec3 deep = vec3(0.035, 0.0, 0.07), mid = vec3(0.42, 0.08, 0.72), hot = vec3(1.0, 0.45, 0.95);
      vec3 c = mix(deep, mid, smoothstep(0.25, 0.95, r) * (0.45 + 0.55 * sw));
      c += hot * (pow(smoothstep(0.72, 1.0, r), 2.0) * (0.7 + 0.5 * sw2) + 0.25 * pow(sw * sw2, 3.0) * r);
      float edge = 1.0 - smoothstep(0.93, 1.0, r);
      gl_FragColor = vec4(c * (0.6 + 0.6 * uK), edge * uK);
    }`;
  function makePortal(r) {
    const u = { uT: { value: 0 }, uK: { value: 1 } };
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: PORTAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.045, 8, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 1.9), toneMapped: false }));
    const g = new THREE.Group(); g.add(m, ring); g.userData.u = u; g.visible = false; g.traverse((o) => { o.frustumCulled = false; o.castShadow = false; o.renderOrder = 3; });
    return g;
  }
  const portal = makePortal(0.17); scene.add(portal);
  const sparks = (() => { const n = 14, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(1.5, 0.7, 1.8), size: 0.014, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); pts.frustumCulled = false; pts.visible = false; scene.add(pts); return pts; })();
  const mouthPortal = makePortal(0.066); mouthPortal.position.set(0, 0, -0.016); mouth.add(mouthPortal); mouthPortal.visible = true;
  // PORT.n: the way through it, from Lilith's side to Anne's (up out of the ground; or, when she lies tied with her soles
  // up, DOWN on to them from a portal in the air above them: batch 23, as he asked). What is on Lilith's side of the
  // portal's plane is not drawn (a clipping plane on every material of her tools): an arm ends where the portal is.
  const PORT = { want: 0, k: 0, at: V3(), set: false, n: V3(0, 1, 0), air: false, two: false, plane: new THREE.Plane(V3(0, 1, 0), 1e6) };
  // (tests: &pout= how far out from her wrist a hand's portal opens in the ground; &pup= how high over her soles the one in the air)
  const PQ = (k, d) => { const q = new URLSearchParams(location.search); return q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : d; }, PORT_OUT = PQ('pout', 0.36), PORT_UP = PQ('pup', 0.44), PORT_BACK = PQ('pback', 0.03);
  if (env.renderer) env.renderer.localClippingEnabled = true;
  const ZAX = V3(0, 0, 1), _pu = V3(), _pv = V3(), _pt = V3();
  function portalTick(dt, t) {
    PORT.k = THREE.MathUtils.damp(PORT.k, PORT.want, PORT.want ? 7 : 11, dt); const k = PORT.k;
    mouthPortal.userData.u.uT.value = t * 1.3; mouthPortal.userData.u.uK.value = ST.tied ? 0.5 : 0.9;      // (tied, the camera looks past it at her soles: it is half clear)
    portal.visible = sparks.visible = k > 0.015;
    if (!portal.visible) { PORT.plane.constant = 1e6; return; }      // (no portal: nothing of hers is cut off)
    PORT.plane.setFromNormalAndCoplanarPoint(PORT.n, _pt.copy(PORT.at).addScaledVector(PORT.n, PORT.air ? 0 : -0.02));
    // (a small one for one arm or the mouth, a wider one for both arms)
    portal.position.copy(PORT.at); portal.quaternion.setFromUnitVectors(ZAX, PORT.n); portal.scale.setScalar(Math.max(0.001, k * (PORT.air ? 0.95 : PORT.two ? 1 : 0.7) * (1 + 0.03 * Math.sin(t * 5))));
    portal.userData.u.uT.value = t; portal.userData.u.uK.value = Math.min(1, k * 1.2);
    _pu.set(1, 0, 0); if (Math.abs(PORT.n.x) > 0.9) _pu.set(0, 0, 1); _pu.addScaledVector(PORT.n, -_pu.dot(PORT.n)).normalize(); _pv.crossVectors(PORT.n, _pu);      // two directions in its plane
    const P = sparks.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const ph = (t * 0.55 + i * 0.37) % 1, a = i * 2.4 + t * 0.6, r = 0.15 * k * (PORT.two ? 1 : 0.7) * (0.35 + 0.65 * ((i * 0.618) % 1)), c = Math.cos(a) * r, d = Math.sin(a) * r, up = 0.02 + ph * 0.22 * k;
      P.setXYZ(i, PORT.at.x + _pu.x * c + _pv.x * d + PORT.n.x * up, PORT.at.y + _pu.y * c + _pv.y * d + PORT.n.y * up, PORT.at.z + _pu.z * c + _pv.z * d + PORT.n.z * up);
    }
    P.needsUpdate = true; sparks.material.opacity = 0.9 * k;
  }
  // her upper arms: from each elbow down into the portal (a hand that is shown has one)
  const ARMS = {};
  { // (lit as the hand is: the hand's own skin material, the colour of its forearm's skin painted on every point)
    let hm = null; HANDS.R.traverse((o) => { if (!hm && o.isSkinnedMesh) hm = o; });
    const CAh = hm && hm.geometry.attributes.color, avg = [0.93, 0.80, 0.78];
    if (CAh) { let n = 0; avg[0] = avg[1] = avg[2] = 0; for (let i = 0; i < CAh.count; i += 5) { avg[0] += CAh.getX(i); avg[1] += CAh.getY(i); avg[2] += CAh.getZ(i); n++; } for (let k = 0; k < 3; k++) avg[k] /= Math.max(1, n); }
    const paint = (geo) => { const a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = avg[0]; a[i + 1] = avg[1]; a[i + 2] = avg[2]; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
    const skinM = hm && CAh && A.ownSkin ? A.ownSkin() : null; if (skinM) skinM.color.multiply(LIL_SKIN);
    for (const hs of ['R', 'L']) {
      const geo = paint(new THREE.CylinderGeometry(0.03, 0.037, 1, 16, 1, true)); geo.translate(0, -0.5, 0);
      const m = new THREE.Mesh(geo, skinM || LIL_ARM); m.visible = false; m.frustumCulled = false; m.castShadow = false; scene.add(m); ARMS[hs] = m;
      const cap = HANDS[hs].userData.elbow; if (cap && skinM) { paint(cap.geometry); cap.material = skinM; }
    }
  }
  const _ae = V3(), _ad = V3(), DOWN = V3(0, -1, 0);
  // (10-04, as he asked: "the arms are very awkwardly bent: make it to where the hands are angled so it's not like that")
  // How her arms ran: the hand's pose (poseHand) sets the forearm too, for a hand that left the picture by its edge: the elbow
  // up and out behind it. Lilith's portal was then opened under that elbow, and the upper arm drawn from one to the other:
  // standing, a post straight up out of the ground folded over 107 to 115 degrees; tied, each arm out to an elbow beside
  // her foot and back in 120 to 129 degrees. Now the arm is built from the portal: the forearm is swung about its wrist
  // towards the place the arm comes through (the hand itself is not moved: its wrist takes up the turn), as far as a wrist
  // gives and no lower than the ground; and the portal is opened where such an arm comes from. The elbows then bend 30 to
  // 65 degrees standing and 40 to 80 tied.
  // passGround, passAir: how far from the portal's middle an arm goes through it, on its own hand's side (ground: one arm; air: two).
  // wrist: how far her hand may come to stand to the line of its forearm: from the ground 43 degrees (her hand points down
  // her sole and her arm comes from below it: more, and her wrist is cocked right back in every close shot), from the air
  // 55 (hands laid on her soles from above, as on a table).
  const SWING = { max: PQ('swm', 0.62), wristGround: PQ('swr', 0.75), wristAir: PQ('swa', 0.96), floor: 0.058, passAir: PQ('ppass', 0.10), passGround: 0.03 };      // (tests: &swm= &swr= &swa= &ppass=)
  const _sE = V3(), _sW = V3(), _sK = V3(), _sC = V3(), _sD = V3(), _sQ = V3(), _sA = V3(), _sN = V3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  // (in the air her two arms come through side by side, each on its own hand's side of the portal's level line: taken
  // towards each wrist's own place across a leaning portal they came through one spot, one trunk forking into two forearms)
  const _sU = V3(), UPV = V3(0, 1, 0);
  function passPoint(W, out) {
    out.subVectors(W, PORT.at);
    if (PORT.air) { _sU.crossVectors(PORT.n, UPV); if (_sU.lengthSq() < 1e-6) _sU.set(1, 0, 0); _sU.normalize(); const sgn = out.dot(_sU) >= 0 ? 1 : -1; return out.copy(PORT.at).addScaledVector(_sU, sgn * SWING.passAir); }
    out.addScaledVector(PORT.n, -out.dot(PORT.n)); const l = out.length(); if (l > SWING.passGround) out.multiplyScalar(SWING.passGround / l); return out.add(PORT.at);
  }
  // the largest turn up to `hi` for which ok(turn) holds (ok(0) is taken to hold; found by halving: it moves smoothly with what goes in)
  const mostTurn = (hi, ok) => { if (ok(hi)) return hi; let a = 0, b = hi; for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (ok(m)) a = m; else b = m; } return a; };
  function swingArm(o) {
    const H = o.userData; if (!H.real || !H.wristBone || !PORT.set) return;
    o.updateMatrixWorld(true);
    H.elbow.getWorldPosition(_sE); H.hand.getWorldPosition(_sW); H.fingers[1].root.getWorldPosition(_sK);
    _sD.subVectors(_sE, _sW); const L2 = _sD.length(); if (L2 < 0.05) return; _sD.divideScalar(L2);      // her forearm as posed: wrist to elbow
    _sQ.subVectors(passPoint(_sW, _sC), _sW).normalize();                                             // ... and the way to where her arm comes through
    (H.pass || (H.pass = V3())).copy(_sC);
    const ang = _sD.angleTo(_sQ); if (ang < 0.02) return;
    _sA.crossVectors(_sD, _sQ).normalize(); _sK.sub(_sW).normalize();                                  // the turn's axis; the way her hand points
    const floorY = anne.position.y + SWING.floor;
    const at = (a) => _sN.copy(_sD).applyAxisAngle(_sA, a);
    let a = Math.min(ang, SWING.max);
    const wmax = PORT.air ? SWING.wristAir : SWING.wristGround; a = mostTurn(a, (x) => PI - at(x).angleTo(_sK) <= wmax);                                    // (her hand to the line of her forearm: what a wrist gives)
    if (!PORT.air) a = mostTurn(a, (x) => _sW.y + at(x).y * L2 >= floorY);                             // (her elbow stays off the ground)
    if (a < 0.003) return;
    const wb = H.wristBone; wb.getWorldQuaternion(_q3);                                                // her hand as it is: kept
    o.getWorldQuaternion(_q2); _q1.setFromAxisAngle(_sA, a).multiply(_q2); H.hand.quaternion.premultiply(_q2.invert().multiply(_q1));
    H.hand.updateMatrixWorld(true);
    wb.parent.getWorldQuaternion(_q2); wb.quaternion.copy(_q2.invert().multiply(_q3)); wb.updateMatrixWorld(true);
  }
  // Lilith's entrance, an arm: (k 0 to 1) first her hand and forearm come out through the portal in the line her upper arm
  // will lie in, hand first, until her elbow is at the portal; then her elbow comes on out along that line to its place while
  // her forearm turns from it to the hand's place on her sole. Everything of hers goes through the portal where her arm
  // does. (As one stiff piece from under the portal to its place, a nearly level arm rose out of the bare ground along its
  // whole length, half a metre of it outside the portal.) Called with the hand posed, and swung, as the take wants it.
  const COME = { k1: 0.55, hid: 0.27 }, _cE = V3(), _cW = V3(), _cU = V3(), _cF = V3(), _cD = V3(), _cP = V3(), _cq = new THREE.Quaternion();
  function comeThrough(o, k) {
    const H = o.userData, C = H.pass; o.updateMatrixWorld(true);
    H.elbow.getWorldPosition(_cE); H.hand.getWorldPosition(_cW);
    _cU.subVectors(_cE, C); const Lu = _cU.length(); _cF.subVectors(_cW, _cE); const L2 = _cF.length();
    if (Lu < 0.01 || L2 < 0.05 || k >= 0.9995) return;
    _cU.divideScalar(Lu); _cF.divideScalar(L2);
    if (k < COME.k1) { const a = k / COME.k1; _cD.copy(_cU); _cP.copy(C).addScaledVector(_cU, -(1 - a) * (L2 + COME.hid)); }      // (her elbow's place; her forearm's way)
    else { const b = (k - COME.k1) / (1 - COME.k1), e = b * b * (3 - 2 * b); _cP.copy(C).addScaledVector(_cU, Lu * b); _cq.setFromUnitVectors(_cF, _cU); _cD.copy(_cF).applyQuaternion(_q1.identity().slerp(_cq, 1 - e)); }
    _cq.setFromUnitVectors(_cF, _cD);                 // the turn of the whole of it about her elbow
    o.position.sub(_cE).applyQuaternion(_cq).add(_cP); o.quaternion.premultiply(_cq); o.updateMatrixWorld(true);
  }
  function armsTick() {
    for (const hs of ['R', 'L']) {
      const h = HANDS[hs], m = ARMS[hs], el = h.userData.elbow;
      if (!h.visible || !el || PORT.k < 0.02) { m.visible = false; continue; }
      // from her elbow to where the arm goes through the portal, and 9 cm on past it on Lilith's side (not drawn: the portal's plane cuts it)
      el.getWorldPosition(_ae);
      if (_ad.subVectors(_ae, PORT.at).dot(PORT.n) < 0.012) { m.visible = false; continue; }      // (her elbow is not through yet: nothing of her upper arm is on this side)
      if (h.userData.real && h.userData.pass) _ad.copy(h.userData.pass); else { _ad.addScaledVector(PORT.n, -_ad.dot(PORT.n)).multiplyScalar(0.12).add(PORT.at); }
      _ad.sub(_ae);
      let len = _ad.length(); if (len < 0.02) { m.visible = false; continue; }
      _ad.divideScalar(len); len += 0.09 / Math.max(0.3, -_ad.dot(PORT.n));
      m.position.copy(_ae); m.quaternion.setFromUnitVectors(DOWN, _ad); m.scale.set(1, len, 1); m.visible = true;
    }
  }
  // (everything of Lilith's is cut off at the portal's plane)
  { const cut = (o) => o.traverse((c) => { if (c.isMesh) for (const m of [].concat(c.material)) if (m && m.clippingPlanes !== undefined && !(m.clippingPlanes && m.clippingPlanes.length)) { m.clippingPlanes = [PORT.plane]; m.needsUpdate = true; } });
    cut(HANDS.R); cut(HANDS.L); cut(ARMS.R); cut(ARMS.L); cut(TOOLS.tongue.obj); mouth.children.forEach((c) => { if (c !== mouthPortal) cut(c); }); }
  const hideTools = () => { for (const o of allTools) o.visible = false; ARMS.R.visible = ARMS.L.visible = false; };

  // =====================================================================================================
  //                                  how she takes each tool, and what she says
  // cap: how far it can take her (0..1); gain: how fast; shake: how much her leg shakes; kind: tease | giggle | laugh
  // =====================================================================================================
  const PROF = {
    feather: { cap: 0.46, gain: 0.6, shake: 0.4, kind: 'tease' },        // she rather likes it
    tease: { cap: 0.68, gain: 0.85, shake: 0.65, kind: 'giggle' },       // the nails raking down her sole
    tongue: { cap: 0.68, gain: 0.85, shake: 0.6, kind: 'giggle' },
    tickle: { cap: 1.0, gain: 1.35, shake: 1.0, kind: 'laugh' },         // the nails scribbling
    brush: { cap: 1.0, gain: 1.15, shake: 0.9, kind: 'laugh' },
  };
  // What she says, by what is at her feet (as he asked: different comments for every option, at random). first: as it
  // first touches her; mid: while it goes on; hard: when she cannot take any more (the laughing kinds); after: as it stops.
  const LINES = {
    feather: {       // teasing; she finds it rather nice
      first: ['Ooh! A feather? Hehe... that is so soft...', "Hm? Oh... hehe. Okay, that one's actually kind of nice.", 'A feather...? Hihi... you big tease.', 'Oh! Hehe... that is gentle. I can live with gentle.'],
      mid: ["Mmh... hehe... that's... kind of nice.", "Hihi... so soft... d-don't stop. I mean, STOP!", 'Ooh... you are teasing me... hehe...', 'Mmm-hm-hm... you are doing that on purpose...', 'Hehe... my toes keep curling...', 'A-ah... hehe... right along the arch...', 'Hehe... okay, I admit it. I like this one.', "It's like a little breeze on my sole... hihi.", 'Slow like that is... hehe... kind of relaxing, actually.', "Hihi... don't tell anyone I said it feels nice.", 'Mmh... a little higher... n-no, wait, that tickles! Hehe!'],
      toes: ['Eep! N-not under my toes! Hehehe!', 'Hihi! My toes! That is cheating!', 'Hehe! Right under the toes... you tease!'],
      after: ['Aww... I-I mean, finally!', "Hehe... that one I didn't mind so much.", 'Phew... hehe. You can do the feather again sometime. Maybe.'],
    },
    tease: {         // the nails raking slowly
      first: ['W-whoa! Are those NAILS?! Hehe... they are so sharp!', 'Eek! Long nails... hehe... be careful with those!', 'Oh no. Oh no no no... not the slow scratchy kind... hehe!', 'Hihi! W-who has nails that long?!'],
      mid: ['Hehehe! Y-your nails!', "Hihihi... so slow... that's WORSE!", 'Hehe! Stop dragging them like that!', 'Ahh-hehe! All the way down my sole!', 'Hihi! I can feel every single one!', 'Hehehe... toes to heel... AGAIN?!', 'Y-you are going slow on purpose! Hihihi!', "Hehe... it's like five little rakes... hihi!", 'Nnngh-hehe! Goosebumps! All the way up my legs!', 'Hihihi! J-just get it over with!'],
      after: ['Phew... my sole is still tingling...', 'Hehe... those nails are dangerous.', 'Hah... I can still feel them. Hehe.'],
    },
    tickle: {        // the nails scribbling
      first: ['W-wait, wait, what are you... AHAHA!!', 'Not the scribbling! Anything but-- AHAHAHA!', 'EEK! Hahaha! Y-your nails are EVIL!', 'N-no no no, not like THAT-- AHAHA!'],
      mid: ['Ahaha! That tickles!!', 'Hehe-haha! T-too much!', 'Ahaha! N-not the nails!', 'Hahaha! R-right there?! NOO!', 'Ahaha! M-my arch! Not my arch!', 'Hahaha! Y-you found the WORST spot!'],
      hard: ['AHAHAHA!! N-NOT THE NAILS!!', 'HAHAHA!! S-STOP SCRIBBLING!!', "AHAHAHAHA!! I C-CAN'T!!", 'NOO-HOHOHO!! RIGHT ON THE ARCH!!', 'HAHAHA!! MERCY!!', "AHAHA!! I'LL DO ANYTHING!! HAHAHA!!", 'HAHAHAHA!! M-MY LEG WILL NOT STOP SHAKING!!', 'AHAHAHA!! UNDER MY TOES?! NOOO!!'],
      after: ["Hah... hah... I c-can't breathe...", 'Phew!! ...You are EVIL. Hehe.', 'Hah... never... again... hehe.', 'M-my poor foot... hehe... hah...'],
    },
    tongue: {        // it startles her a little
      first: ['EEP! ...D-did you just lick my foot?!', 'Wha--?! Did you just... LICK my feet?!', 'HEY! Hehe... was that a TONGUE?!', 'Eek! W-what was... did you LICK me?!'],
      mid: ["Eep! Hehehe... that's wet!", 'Hihi! D-did you just lick me AGAIN?!', 'Hehehe! Toes to heel?! Gross!! ...hehe.', "Eww-hehe! It's all slobbery now!", 'Hihihi! Warm! And WET!', 'W-who DOES that?! Hehehe!', 'My sole is not a lollipop! Hihi!', 'Eww eww eww-- hehehe! It tickles!', 'I walked through a FOREST on those! Hehe!', 'Hihi! S-stop, it feels so weird!'],
      after: ["Ugh, now it's all wet... hehe.", "I can't believe you LICKED it.", 'Eww... I need to wash that. Hehe.'],
    },
    brush: {
      first: ['Is that... a scrub brush?! W-wait-- AHAHA!', 'Oh no, not the fuzzy one! Hehe-HAHA!', 'A brush?! My feet are clean enou-- AHAHAHA!'],
      mid: ["Ahaha! That's a scrub brush!", "Hehe-haha! It's so fuzzy!", 'Scrub scrub... ahaha!', 'Hahaha! The bristles get EVERYWHERE!', 'Hehe-haha! S-so many little bristles!'],
      hard: ['HAHAHA!! THE BRISTLES!!', 'AHAHAHA!! N-NOT SO HARD!!', "I C-CAN'T... HAHAHA!!", 'HAHAHA!! N-NOT MY ARCH!! NOO!!', 'AHAHA!! THEY ARE CLEAN!! THEY ARE CLEAN!!'],
      after: ['Phew... squeaky clean, I guess...', 'Hah... hah... that brush is a menace.', 'Hehe... they have never been this clean.'],
    },
    tied: ["I can't even pull them away!! Hehehe!", 'N-no fair! My toes are tied!!', 'Both soles?! At once?! Hahaha!', "I c-can't wiggle out of it! Hihihi!"],
    lift: ['Hm? My foot? ...Fine, just a little.', 'Oh, you want to see my sole? Hehe.', "Like this? ...Don't get any ideas."],
    swap: ['Okay, okay... the other foot now?', 'Other one! ...Be nice to it.', "Fine... this one's turn. Hehe.", 'Phew... and now this one?'],
    shoes: ['Hold on... let me try these on instead!', 'New shoes! Like them?', 'How about these ones?', 'Shoe change! Hehe.'],
    tie: ["H-hey! What's the rope for?!\n...You are enjoying this far too much.", 'Tied up AGAIN?! At least be gentle...', "My ankles AND my toes?!\nI can't even wiggle away!"],
    untie: ['Phew... finally! My poor feet...', 'Free! ...That was not fair, you know.', 'Hehe... okay. That was... something.'],
    cleanStart: ['W-wait, you are going to SCRUB them?\nHehe... okay. Gently!', 'A brush?! Fine... but it tickles, I warn you!'],
    cleanSwitch: ['Okay, okay... the other one now!', 'Phew... other foot. Be gentle!', 'One clean! Now this one... hehe.'],
    cleanDone: ['Hehe... phew! Squeaky clean...\nand still all tingly!', 'All clean! ...My feet are still giggling.', 'Clean soles! Thank you... I think. Hehe.'],
  };
  // (10-05) env.lines: another's own words for any of these (Boudicca's: boudicca.js BOU_FOOT_LINES)
  if (env.lines) for (const k in env.lines) LINES[k] = Array.isArray(env.lines[k]) ? env.lines[k] : Object.assign({}, LINES[k], env.lines[k]);
  // Lilith's lines (batch 22): the succubus of the Tower, mocking and theatrical; she calls her honey, sweetie, girl, brat.
  // `summon`: said the first time ever (he asked: she tells Anne, and so the player, that this is how to call her).
  const LIL = {
    summon: ['Well, well... somebody opened a door for me.', "Remember this little trick, my dearest Anne:\npick my Fingers or my Tongue, and I come through.\nAny time you like."],
    hello: ['You called, sweetie?', 'Miss me already, honey?', 'Ahh... that little door again. Delicious.', 'My nails were getting SO bored, girl.', 'Knock knock, my dearest Anne...', 'One little opening in the ground... and here I am.'],
    helloTongue: ['Mmm... you called for a taste, honey?', 'Open wide, little door... I am hungry.', 'My favourite summons, sweetie.'],
    tease: ['Slowly now... I want to count every twitch.', 'Such soft soles, honey... hold still for me.', 'Toes to heel... and back again. I have all day.', 'Shhh... my nails have only just begun.', 'Look at those toes curl... gorgeous.'],
    tickle: ['Sing for me, girl!', 'THERE it is... your weak spot!', 'Louder, brat! I came all this way!', 'Oh, I am keeping these feet.', 'Kitchy kitchy koo, my dearest Anne!'],
    tongue: ['Mmm... delicious, honey.', 'Just a little taste... and another.', 'Salty... sweet... MINE.', 'Hold still, sweetie... I am savouring this.'],
    bye: ['Call me again, honey. You know how.', 'Until the next little door, sweetie...', 'Mmm. Same time tomorrow, girl?'],
  };
  const AN_LIL = ['L-Lilith?! Out of the GROUND?!', 'W-wait... those are LILITH\'S hands!', 'Lilith?! How did you-- eek!'];
  // what she makes of her looks: her shoes, her toenails, her skin, what she wears, what she is (index.html's look, looks.js lookWords)
  function lilLooks() {
    if (env.name) return [];                             // (what Lilith makes of Anne's look is said of Anne)
    const W = (typeof window !== 'undefined' && window.__looks && window.__looks.lookWords()) || {}, K = (env.shoeLook && env.shoeLook()) || {}, out = [];
    if (W.soleWord) out.push(`Those ${W.soleWord} soles of yours, Anne... gorgeous.`, `Such pretty ${W.soleWord} feet, honey... and all mine.`);
    if (K.nail) out.push(`${K.nail.charAt(0).toUpperCase() + K.nail.slice(1)} toenails? You dressed them up for me, sweetie.`);
    if (K.label) out.push(`You came to me in ${String(K.label).toLowerCase()}, girl... barely a step out of them. How thoughtful.`);
    const T = { witch: 'Still playing the little witch, honey? Witches giggle too.', school: 'A schoolgirl? Then here is today\'s lesson, sweetie.', office: 'All business up there... and all giggles down here.', sporty: 'So sporty, girl! Let us see how long you last.',
      beach: 'Dressed for the beach? Bare feet suit you, honey.', sleep: 'Ready for bed, sweetie? No sleep for these toes.', goth: 'So dark and gloomy... I will have you giggling, girl.', bunny: 'A bunny! Do bunnies have ticklish feet? ...They do.',
      royal: 'Your Highness... your royal soles, if you please.', warrior: 'Armour everywhere but your soles, brat.', villain: 'A villain? There is only room for one of those here, honey.', maid: 'A maid? You missed a spot, sweetie... right HERE.',
      kimono: 'Such an elegant dress, honey... and such wiggly toes under it.', dancer: 'A dancer! Then point those toes for me, girl.', casual: 'Dressed so simply... and still delicious.', towel: 'Fresh from the bath, sweetie? Squeaky clean soles... mmm.',
      tribal: 'A little wild thing! Wild things giggle the loudest.', cute: 'All bows and laces... you are a gift, honey. I do love unwrapping.', idol: 'An idol! Sing for your biggest fan, girl.', elegant: 'All dressed up for me, honey? How delicious.',
      goddess: 'A goddess? Even goddesses have ticklish feet, sweetie.', fairy: 'A little fairy! I shall be gentle... no, I shall not.' };
    if (T[W.theme]) out.push(T[W.theme]);
    if (W.wearing) out.push(`${W.wearing.charAt(0).toUpperCase() + W.wearing.slice(1)}, honey? It suits you...\nand it leaves your soles to me.`);      // (batch 23: the outfit by its name)
    const Sp = { elf: 'Pointed ears AND ticklish feet, little elf? How delicious.', angel: 'An angel... oh, I have ALWAYS wanted to make one of you squeal.', demon: 'One of my own kind! Then you know exactly what comes next, honey.', alien: 'From another world, sweetie? Feet are feet... let us see.',
      robot: 'A robot? Somebody built you ticklish, girl. How thoughtful.', ghost: 'A ghost that giggles... I am not letting you fade away, honey.', flower: 'A little flower... I shall tickle your roots, sweetie.', cat: 'Here, kitty kitty... let me see those little paws.', fairy: 'A fairy! Small wings, big giggles.' };
    if (Sp[W.speciesWord]) out.push(Sp[W.speciesWord]);
    return out;
  }
  let lilFirst = stored('amirian3d.lilithCalled', '') !== '1';
  // (at random, as he asked, but never the same line twice running; the generator is seeded once a session)
  let rng = mulberry32((Date.now() ^ 0x51ed27) | 0);
  const lastPick = new Map();
  const pick = (a) => { let i = Math.floor(rng() * a.length) % a.length; if (a.length > 1 && i === lastPick.get(a)) i = (i + 1 + Math.floor(rng() * (a.length - 1))) % a.length; lastPick.set(a, i); return a[i]; };

  // =====================================================================================================
  //                                  the page: a bubble, a bar, the tools' side bar
  // =====================================================================================================
  const css = document.createElement('style');
  css.textContent = `
  #fp-bubble { position: fixed; left: 50%; top: 86px; transform: translateX(-50%); transform-origin: 50% 0; max-width: 420px; padding: 9px 16px; border-radius: 16px; background: rgba(34, 18, 60, .9); border: 1px solid #d8b455; color: #fff;
    font: 17px/1.35 Georgia, 'Times New Roman', serif; text-align: center; white-space: pre-line; pointer-events: none; visibility: hidden; z-index: 30; box-shadow: 0 4px 14px rgba(0,0,0,.5); }
  #fp-bubble2 { position: fixed; left: 50%; top: 150px; transform: translateX(-50%); transform-origin: 50% 0; max-width: 430px; padding: 8px 16px 9px; border-radius: 16px; background: rgba(58, 14, 78, .93); border: 1px solid #e58cff; color: #ffe9ff;
    font: italic 17px/1.35 Georgia, 'Times New Roman', serif; text-align: center; white-space: pre-line; pointer-events: none; visibility: hidden; z-index: 30; box-shadow: 0 4px 16px rgba(120, 30, 160, .55); }
  #fp-bubble2 b { display: block; font: normal 11px/1.2 Georgia, serif; letter-spacing: .14em; text-transform: uppercase; color: #f0a6ff; margin-bottom: 2px; }
  #fp-hud { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); width: 400px; padding: 9px 14px 11px; border-radius: 10px; background: rgba(34, 18, 60, .9); border: 1px solid #d8b455; color: #fff;
    font: 15px/1.3 Georgia, 'Times New Roman', serif; text-align: center; display: none; z-index: 30; pointer-events: none; }
  #fp-hud b { color: #f0cf6a; font-weight: normal; }
  #fp-hud .bar { height: 10px; margin-top: 7px; border-radius: 6px; background: rgba(255,255,255,.16); overflow: hidden; }
  #fp-hud .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #7ee08a, #d8f06a); border-radius: 6px; }
  #fp-side { position: fixed; right: 14px; top: 50%; transform: translateY(-50%); display: none; flex-direction: column; gap: 7px; padding: 10px; border-radius: 12px; background: rgba(34, 18, 60, .88);
    border: 1px solid #d8b455; color: #fff; font: 14px Georgia, 'Times New Roman', serif; z-index: 30; width: 150px; max-height: calc(100vh - 40px); overflow-y: auto; box-sizing: border-box; }
  #fp-side h4 { margin: 0 0 2px; font-weight: normal; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #f0cf6a; text-align: center; }
  #fp-side button { all: unset; cursor: pointer; padding: 7px 8px; border-radius: 9px; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.07); text-align: center; }
  #fp-side button:hover { background: rgba(255,255,255,.2); }
  #fp-side button.on { border-color: #f0cf6a; background: #5a2d91; }
  #fp-side button.stop { border-color: #e08a8a; }
  #fp-side button.off { opacity: .38; cursor: default; }
  #fp-side .sub { display: none; flex-direction: column; gap: 6px; padding: 2px 0 4px; }
  #fp-side .sub.on { display: flex; }
  #fp-side .two { display: flex; gap: 5px; }
  #fp-side .two button { flex: 1; padding: 5px 2px; font-size: 13px; }
  #fp-side .sw { display: grid; grid-template-columns: repeat(6, 18px); gap: 5px; justify-content: center; }
  #fp-side .sw i { display: block; width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.55); cursor: pointer; box-sizing: border-box; }
  #fp-side .sw i.on { border-color: #f0cf6a; box-shadow: 0 0 0 2px #f0cf6a; }
  #fp-side small { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; opacity: .7; text-align: center; }
  #fp-side hr { width: 100%; border: 0; border-top: 1px solid rgba(255,255,255,.25); margin: 2px 0; }
  #fp-side p { margin: 2px 0 0; font-size: 12px; line-height: 1.3; opacity: .82; text-align: center; }
  #fp-face { position: fixed; left: 14px; bottom: 64px; width: 196px; height: 196px; border: 1px solid #d8b455; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,.5);
    box-sizing: border-box; pointer-events: none; display: none; z-index: 28; }
  #fp-fade { position: fixed; inset: 0; background: #000; opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 29; }`;
  document.head.appendChild(css);
  const mk = (tag, id, parent = document.body, text) => { const e = document.createElement(tag); if (id) e.id = id; if (text) e.textContent = text; parent.appendChild(e); return e; };
  const bubbleEl = mk('div', 'fp-bubble'), bubble2El = mk('div', 'fp-bubble2'), hudEl = mk('div', 'fp-hud'), sideEl = mk('div', 'fp-side'), faceEl = mk('div', 'fp-face'), fadeEl = mk('div', 'fp-fade');
  hudEl.innerHTML = '<span id="fp-hud-t"></span><div class="bar"><i id="fp-hud-b"></i></div>';
  const hudT = hudEl.querySelector('#fp-hud-t'), hudB = hudEl.querySelector('#fp-hud-b');
  // her bubble pops in on a spring (the kit: nothing enters as a plain fade) and folds away at its end
  const BB = { t0: -9, dur: 0, on: false };
  function bubble(text, sec = 2.3) { bubbleEl.textContent = text; BB.t0 = ST.clock; BB.dur = sec; BB.on = true; bubbleEl.style.visibility = 'visible'; bubbleTick(); console.log('FOOTPLAY says: ' + text.split('\n')[0]); }
  function bubbleTick() {
    if (!BB.on) return;
    const a = ST.clock - BB.t0; if (a >= BB.dur) { BB.on = false; bubbleEl.style.visibility = 'hidden'; return; }
    const k = Motion.step(a + 1 / 120, 'snappy'), out = clamp(Motion.step(a - (BB.dur - 0.16), 'snappy'), 0, 1);
    bubbleEl.style.transform = `translateX(-50%) scale(${((0.8 + 0.2 * k) * (1 - 0.2 * out)).toFixed(4)})`; bubbleEl.style.opacity = (Math.min(1, (a + 1 / 60) / 0.05) * (1 - out)).toFixed(3);
  }
  // Lilith's (batch 22): under Anne's, in her own colours, her name over it
  const B2 = { t0: -9, dur: 0, on: false };
  function lilSays(text, sec = 2.8) { bubble2El.innerHTML = '<b>Lilith</b>'; bubble2El.appendChild(document.createTextNode(text.replace(/Anne/g, heroName()))); B2.t0 = ST.clock; B2.dur = sec; B2.on = true; bubble2El.style.visibility = 'visible'; bubble2Tick(); console.log('FOOTPLAY Lilith: ' + text.split('\n')[0]); }
  function bubble2Tick() {
    if (!B2.on) return;
    const a = ST.clock - B2.t0; if (a >= B2.dur) { B2.on = false; bubble2El.style.visibility = 'hidden'; return; }
    const k = Motion.step(a + 1 / 120, 'snappy'), out = clamp(Motion.step(a - (B2.dur - 0.16), 'snappy'), 0, 1);
    bubble2El.style.transform = `translateX(-50%) scale(${((0.8 + 0.2 * k) * (1 - 0.2 * out)).toFixed(4)})`; bubble2El.style.opacity = (Math.min(1, (a + 1 / 60) / 0.05) * (1 - out)).toFixed(3);
  }
  const heroName = () => env.name || (typeof window !== 'undefined' && window.__heroName ? window.__heroName() : 'Anne');      // (env.name: this foot cam is another's: Boudicca's)
  const press = (e, fn) => e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); fn(); });
  // (10-05) whose feet: a row of names when there is more than one to choose from (env.who: { names(), me, show(), pick(i) })
  let whoRow = null;
  if (env.who) { whoRow = mk('div', null, sideEl); whoRow.className = 'two'; env.who.names().forEach((nm, i) => { const b = mk('button', null, whoRow, nm); if (i === env.who.me) b.classList.add('on'); press(b, () => { if (i !== env.who.me) env.who.pick(i); }); }); }
  const whoNow = () => { if (!whoRow) return; const nm = env.who.names(); [...whoRow.children].forEach((b, i) => { if (b.textContent !== nm[i]) b.textContent = nm[i]; }); const d = env.who.show() ? 'flex' : 'none'; if (whoRow.style.display !== d) whoRow.style.display = d; };
  mk('h4', null, sideEl, 'Her soles');
  const btn = {};
  btn.fingers = mk('button', null, sideEl, 'Fingers'); press(btn.fingers, () => setTool(ST.tool === 'fingers' ? null : 'fingers'));
  const sub = mk('div', null, sideEl); sub.className = 'sub';
  const two = mk('div', null, sub); two.className = 'two';
  const bTease = mk('button', null, two, 'Teasing'), bTickle = mk('button', null, two, 'Tickling');
  press(bTease, () => setFingers('tease')); press(bTickle, () => setFingers('tickle'));
  mk('small', null, sub, "Lilith's nails");
  const swEl = mk('div', null, sub); swEl.className = 'sw';
  const NAILS = env.nailColours || [['Red', '#c4122f'], ['Dark red', '#7a0e1d'], ['Pink', '#e8457f'], ['Hot pink', '#ff5fa8'], ['Purple', '#5a2d91'], ['Black', '#16141a'], ['White', '#f4ece6'], ['Gold', '#e2b532'], ['Blue', '#2f6fe0'], ['Teal', '#149c9c'], ['Green', '#2e9e4f'], ['Silver', '#c0c4cc']];
  for (const [name, hex] of NAILS) { const i = mk('i', null, swEl); i.style.background = hex; i.title = name; i.dataset.c = hex; press(i, () => setNail(hex)); }
  for (const k of ['feather', 'tongue', 'brush']) { btn[k] = mk('button', null, sideEl, TOOLS[k].label); press(btn[k], () => setTool(ST.tool === k ? null : k)); }
  const bStop = mk('button', null, sideEl, 'Stop'); bStop.className = 'stop off'; press(bStop, () => setTool(null));
  mk('hr', null, sideEl);
  const bTie = mk('button', null, sideEl, 'Tie her up'); press(bTie, () => tie(!ST.tied));
  const hint = mk('p', null, sideEl);
  sideEl.addEventListener('pointerdown', (ev) => ev.stopPropagation());

  // =====================================================================================================
  //                                                  state
  // =====================================================================================================
  const ST = { mode: null, tool: null, fmode: stored('amirian3d.handmode', 'tease') === 'tickle' ? 'tickle' : 'tease', nail: stored('amirian3d.handnail', '#c4122f'), side: null, sideNext: 'L', phase: 'idle', pt: 0,
    uv: [0.5, 0], goal: [0.5, 0], on: false, speed: 0, T: 0, quiet: 0, lastLine: -9, lastVoice: -9, playT: 0, bar: false, left: 1, clean: null, mouseIn: false, shoesAt: 44, now: 0, clock: 0, frame: 0,
    tied: false, tying: false, clip: '', pegIn: 0, next: null, take: null, takes: 0, seed: (Date.now() & 0x3fffffff) ^ 0x2545f49, firstFor: null, shock: 0, frozen: false, tiedAnch: false, swapping: false,
    nailLo: 0, nailHi: 0, joint: 0, c1s: [0, 0, 0, 0], hs: [0, 0, 0, 0], worst: { h: 0 }, voiceAt: -99, tieGen: 0 };
  const ndc = new THREE.Vector2(0, 0), ray = new THREE.Raycaster(), plane = new THREE.Plane();
  const _c = V3(), _n = V3(), _p = V3(), _x = V3(), _q = V3(), _r = V3(), _s = V3(), _m = new THREE.Matrix4(), cam = { p: V3(), l: V3(), fov: 38, on: false, direct: false };
  const RX = V3(), RY = V3(), RZ = V3(), _nl = V3(), _tp = V3(), _kp = V3(), _ax = V3(), _vel = V3(), _hl = V3(), _uvh = { u: 0, v: 0, h: 0 };
  const marker = {}; const mkr = (n) => marker[n] || (marker[n] = anne.getObjectByName(n));
  const ties = createTies({ THREE, scene, anne, A });
  function hintNow() { hint.textContent = ST.tool ? 'It plays by itself. Stop, or pick another.' : ST.tied ? 'Pick one for her soles.' : 'Pick one: she lifts a foot and it plays by itself.'; }
  function showTool() { for (const n in btn) btn[n].classList.toggle('on', n === ST.tool); sub.classList.toggle('on', ST.tool === 'fingers'); bStop.classList.toggle('off', !ST.tool); }
  const keyOf = (tool) => (tool === 'fingers' ? ST.fmode : tool);
  // Pick a tool (it starts by itself), another one (it takes over where she is), or none (it stops)
  function setTool(k, quiet) {
    const was = ST.tool, wasKey = keyOf(was);
    ST.tool = k || null; showTool(); hideTools();
    if (ST.mode === 'free') {
      if (!k) {
        ST.take = null; ST.next = null; ST.firstFor = null;
        if (!ST.tied) { cam.on = false; if (ST.phase !== 'idle') lower(); }
        if (was && !quiet && ST.T > 0.12 && LINES[wasKey]) bubble(pick(LINES[wasKey].after), 2.4);
        if ((was === 'fingers' || was === 'tongue') && !quiet) lilSays(pick(LIL.bye), 2.4);
        PORT.want = 0; if (PORT.air) PORT.k = 0;
      } else {
        ST.firstFor = keyOf(k);
        if (ST.tied || ST.phase === 'held') startTake(ST.side || ST.sideNext);      // (her sole is there already: the new tool takes over)
      }
    }
    hintNow(); console.log('FOOTPLAY tool ' + (k || null));
  }
  function setFingers(m) {
    const was = ST.fmode; ST.fmode = m === 'tickle' ? 'tickle' : 'tease'; keep('amirian3d.handmode', ST.fmode); bTease.classList.toggle('on', ST.fmode === 'tease'); bTickle.classList.toggle('on', ST.fmode === 'tickle');
    if (was !== ST.fmode && ST.mode === 'free' && ST.tool === 'fingers') { ST.firstFor = ST.fmode; if (ST.take) startTake(ST.take.sd); }
  }
  function setNail(hex) { ST.nail = hex; keep('amirian3d.handnail', hex); for (const h of [HANDS.R, HANDS.L]) h.userData.nailMat.color.set(hex); for (const i of swEl.children) i.classList.toggle('on', i.dataset.c === hex); }
  setFingers(ST.fmode); setNail(/^#[0-9a-f]{6}$/i.test(ST.nail) ? ST.nail : '#c4122f');
  // (the pointer: only the clean-up after a capture is played with the mouse)
  const el = renderer.domElement;
  const toNdc = (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  el.addEventListener('pointermove', (e) => { toNdc(e); ST.mouseIn = true; });
  el.addEventListener('pointerleave', () => { ST.mouseIn = false; });
  el.addEventListener('pointerdown', (e) => { if (e.button === 0) { toNdc(e); ST.mouseIn = true; } });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && ST.mode === 'clean' && ST.clean && ST.phase === 'held') { ST.clean.skip = true; e.stopPropagation(); } }, true);      // (enough of this sole)
  // where on which sole the pointer is: { sd, u, v } or null
  function hitSole(sides) {
    let best = null;
    for (const sd of sides) {
      if (!sd || !A.solePoint(sd, 0.5, 0, _c, _n)) continue;
      plane.setFromNormalAndCoplanarPoint(_n, _c); ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, _p)) continue;
      const q = A.soleUV(sd, _p); if (!q || q.u < -0.12 || q.u > 1.12 || Math.abs(q.v) > 1.35) continue;
      if (!best || Math.abs(q.v) < Math.abs(best.v)) best = { sd, u: clamp(q.u, 0.02, 0.98), v: clamp(q.v, -0.95, 0.95) };
    }
    return best;
  }

  // =====================================================================================================
  //                      her sole as a smooth surface (a tool's path over it must never jump)
  // The skin of each sole is sampled once, in its foot bone's own space, into a grid of heights over the sole's middle
  // line, smoothed, and read back with Catmull-Rom splines: pos(u, v) (u: 0 heel .. 1 ball, v: -1..1 across), its normal,
  // and uvh(point): where a point is over it and how high. (anne_next.js solePoint takes the nearest skin vertex: fine for
  // laying marks, but a hand drawn along it stepped from vertex to vertex.)
  // =====================================================================================================
  const SOLE = {};
  function soleOf(sd) {
    if (SOLE[sd] !== undefined) return SOLE[sd];
    if (!A.solePoint || !A.solePoint(sd, 0.5, 0, _c, _n)) return (SOLE[sd] = null);      // (builds her sole's model)
    const MKs = A._marks && A._marks(), M = MKs && MKs.models && MKs.models[sd];
    if (!M || !M.P || !M.P.length) return (SOLE[sd] = null);
    const { H, R, B, n, fwd, side, span, lo, hi, P, N } = M, BINS = lo.length;
    const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
    // the sole's middle and half-width across, along it: smooth functions of u (the model keeps them in steps)
    const sm = (a) => a.map((x, i) => (a[Math.max(0, i - 1)] + 2 * x + a[Math.min(a.length - 1, i + 1)]) / 4);
    const cA = sm(lo.map((l, b) => (l + hi[b]) / 2)), wA = sm(lo.map((l, b) => (hi[b] - l) / 2 * 0.72));
    const at = (a, i) => a[Math.max(0, Math.min(BINS - 1, i))];
    const crA = (a, u) => { const x = Math.max(0, Math.min(BINS - 1, (u + 0.1) * 10 - 0.5)), i = Math.min(BINS - 2, Math.floor(x)); return cr(at(a, i - 1), at(a, i), at(a, i + 1), at(a, i + 2), x - i); };
    const line = (u, out) => out.copy(H).multiplyScalar((1 - u) * (1 - 2 * u)).addScaledVector(R, 4 * u * (1 - u)).addScaledVector(B, u * (2 * u - 1));
    const dline = (u, out) => out.copy(H).multiplyScalar(4 * u - 3).addScaledVector(R, 4 - 8 * u).addScaledVector(B, 4 * u - 1);
    const base = (u, v, out) => line(u, out).addScaledVector(side, crA(cA, u) + v * crA(wA, u));
    // the grid: how high her skin stands over that base (the highest skin point within 7.5 mm), holes filled from their neighbours
    const NU = 30, NV = 13, U0 = -0.1, U1 = 1.1, V0 = -1.2, V1 = 1.2, hg = new Float32Array(NU * NV), q = V3(), d = V3(), r2 = 0.0075 * 0.0075, faces = N.map((x) => x.dot(n) >= 0.5);
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      base(U0 + (U1 - U0) * i / (NU - 1), V0 + (V1 - V0) * j / (NV - 1), q);
      let best = -Infinity;
      for (let k = 0; k < P.length; k++) { if (!faces[k]) continue; d.subVectors(P[k], q); const a = d.dot(n), t2 = d.lengthSq() - a * a; if (t2 < r2 && a > -0.03 && a > best) best = a; }
      hg[i * NV + j] = best === -Infinity ? NaN : best;
    }
    for (let pass = 0; pass < NU + NV; pass++) {
      let left = 0; const nx = hg.slice();
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        if (!isNaN(hg[i * NV + j])) continue;
        let sum = 0, c = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= NU || y >= NV) continue; const h = hg[x * NV + y]; if (!isNaN(h)) { sum += h; c++; } }
        if (c) nx[i * NV + j] = sum / c; else left++;
      }
      hg.set(nx); if (!left) break;
    }
    if (isNaN(hg[0])) return (SOLE[sd] = null);
    for (let pass = 0; pass < 2; pass++) {              // smoothed: twice 1-2-1 each way
      const a = hg.slice(); for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) hg[i * NV + j] = (a[i * NV + Math.max(0, j - 1)] + 2 * a[i * NV + j] + a[i * NV + Math.min(NV - 1, j + 1)]) / 4;
      const b = hg.slice(); for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) hg[i * NV + j] = (b[Math.max(0, i - 1) * NV + j] + 2 * b[i * NV + j] + b[Math.min(NU - 1, i + 1) * NV + j]) / 4;
    }
    const Gh = (i, j) => hg[Math.max(0, Math.min(NU - 1, i)) * NV + Math.max(0, Math.min(NV - 1, j))];
    const hAt = (u, v) => {
      const x = clamp((u - U0) / (U1 - U0), 0, 1) * (NU - 1), y = clamp((v - V0) / (V1 - V0), 0, 1) * (NV - 1), i = Math.min(NU - 2, Math.floor(x)), j = Math.min(NV - 2, Math.floor(y)), fx = x - i, fy = y - j;
      const row = (ii) => cr(Gh(ii, j - 1), Gh(ii, j), Gh(ii, j + 1), Gh(ii, j + 2), fy);
      return cr(row(i - 1), row(i), row(i + 1), row(i + 2), fx);
    };
    // (beyond the flat of her sole, where her foot rounds away at its edges, its heel and its toes, the surface is taken to
    // go on level: a nail that slides off there stays at the sole's level in the air beside her foot, and never dips down
    // round it; so a nail's height falls evenly as its knuckle curls, and there is one answer only)
    const hOn = (u, v) => hAt(clamp(u, 0.03, 1.0), clamp(v, -1.0, 1.0));
    const pos = (u, v, out) => base(u, v, out).addScaledVector(n, hAt(u, v));
    const nrm = (u, v, out) => {
      pos(u + 0.05, v, q); pos(u - 0.05, v, d); const ax = q.x - d.x, ay = q.y - d.y, az = q.z - d.z;
      pos(u, v + 0.2, q); pos(u, v - 0.2, d); const bx = q.x - d.x, by = q.y - d.y, bz = q.z - d.z;
      out.set(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx); if (out.dot(n) < 0) out.negate(); return out.normalize();
    };
    const uvh = (p, out) => {       // (u, v) of a point in the bone's space, and how high it is over her skin
      let u = d.subVectors(p, H).dot(fwd) / span;
      for (let k = 0; k < 2; k++) { line(u, q); const f = q.sub(p).dot(fwd); const df = dline(u, d).dot(fwd); if (Math.abs(df) > 1e-6) u -= f / df; }
      line(u, q); d.subVectors(p, q);
      out.u = u; out.v = (d.dot(side) - crA(cA, u)) / Math.max(1e-4, crA(wA, u)); out.h = d.dot(n) - hOn(u, out.v); return out;
    };
    return (SOLE[sd] = { M, sd, bone: M.bone, n, fwd, side, span, pos, nrm, uvh });
  }
  // her foot's matrix as it is this frame (live), its inverse, and as it was before it shook (rest); once a frame per foot
  const LV = { L: { f: -1, m: null, inv: new THREE.Matrix4(), rest: null }, R: { f: -1, m: null, inv: new THREE.Matrix4(), rest: null } };
  function live(sd) {
    const L = LV[sd]; if (L.f === ST.frame && L.m) return L;
    const S = soleOf(sd); S.bone.updateWorldMatrix(true, false); L.m = S.bone.matrixWorld; L.inv.copy(L.m).invert(); L.rest = (A.footRest && A.footRest(sd)) || L.m; L.f = ST.frame;
    return L;
  }
  // a point of her sole in the world (and its normal): on her foot as it is (live: what touches her) or before it shook
  // (rest: what a steady hand goes by)
  function soleAt(sd, u, v, out, nOut, isLive) {
    const S = soleOf(sd); if (!S) return false;
    const L = live(sd), m = isLive ? L.m : L.rest;
    S.pos(u, v, out).applyMatrix4(m); if (nOut) S.nrm(u, v, nOut).transformDirection(m);
    return true;
  }
  // the sole's own directions on the foot at rest: RX across (towards her right), RY out of the sole, RZ along it towards her toes
  function refAxes(sd) { const S = soleOf(sd), m = live(sd).rest; RY.copy(S.n).transformDirection(m); RZ.copy(S.fwd).transformDirection(m); RX.crossVectors(RY, RZ).normalize(); RZ.crossVectors(RX, RY).normalize(); }
  // how high a point of the world is over her skin, as it is this frame
  function heightOver(sd, world) { const S = soleOf(sd); _hl.copy(world).applyMatrix4(live(sd).inv); return S.uvh(_hl, _uvh).h; }

  // =====================================================================================================
  //                       the choreography: what each tool does in each bar (the kit's tracks)
  // =====================================================================================================
  const pickOf = (tk, b, ch, list) => list[Math.floor(rnd(tk.seed, b, ch) * list.length) % list.length];
  const chain = (tk, b, ch, n, i0) => { let i = i0; for (let k = 0; k <= b; k++) i = (i + 1 + Math.floor(rnd(tk.seed, k, ch) * (n - 1))) % n; return i; };      // (never the same twice running)
  const LANES = [-0.5, -0.24, 0.02, 0.28, 0.52];
  const laneOf = (tk, b) => LANES[chain(tk, b, 1, LANES.length, 2)];
  const TR = {};
  // ----- the raking nails: one slow pull a bar from the ball of her foot to her heel (six half-beat steps on soft springs:
  // a glide), the hand lifted back in the last beat; some bars weave across the sole, some are two short pulls over her arch
  const teaseKind = (tk, b) => (b === 0 ? 'full' : pickOf(tk, b, 2, ['full', 'zig', 'full', 'double']));
  TR.hu = makeTrack((b, tk) => (teaseKind(tk, b) === 'double'
    ? [[0.4, 0.7, GLIDE], [0.8, 0.54, GLIDE], [1.2, 0.4, GLIDE], [1.75, 0.76, BACK], [2.4, 0.6, GLIDE], [2.8, 0.45, GLIDE], [3.2, 0.3, GLIDE], [3.6, 0.84, BACK]]
    : [[0.5, 0.74, GLIDE], [1, 0.62, GLIDE], [1.5, 0.5, GLIDE], [2, 0.38, GLIDE], [2.5, 0.26, GLIDE], [3, 0.15, GLIDE], [3.45, 0.84, BACK]]), 0.84);
  TR.hl = makeTrack((b, tk) => (teaseKind(tk, b) === 'double' ? [[0, 0], [1.55, 0.022], [2.1, 0], [3.4, 0.024]] : [[0, 0], [3.3, 0.024]]), 0.045);
  TR.hv = makeTrack((b, tk) => { const l = laneOf(tk, b), z = teaseKind(tk, b) === 'zig' ? [[1, clamp(l + 0.34, -0.6, 0.6)], [2, clamp(l - 0.34, -0.6, 0.6)], [3, l]] : []; return [...z, [3.5, laneOf(tk, b + 1)]]; }, (tk) => laneOf(tk, 0));
  TR.hc = makeTrack((b, tk) => (teaseKind(tk, b) === 'double' ? [[0.4, 0.62], [1.2, 0.8], [1.75, 0.52], [2.4, 0.62], [3.2, 0.8], [3.6, 0.52]] : [[0.5, 0.6], [1.5, 0.7], [2.5, 0.82], [3.5, 0.52]]), 0.52);      // (her fingers curl in as they pull)
  // ----- the scribbling nails: the hand on a spot, hopping to another every two beats; three ways its fingers go
  const SPOTS = [[0.5, 0.05], [0.78, -0.3], [0.78, 0.32], [0.3, 0.12], [0.62, 0.45], [0.62, -0.45], [0.2, -0.05], [0.42, -0.3]];
  const spotOf = (tk, i) => SPOTS[i <= 0 ? 0 : chain(tk, i - 1, 3, SPOTS.length, 0)];      // (one hop per spot from the first: never the same spot twice running)
  TR.ku = makeTrack((b, tk) => [[0, spotOf(tk, 2 * b)[0]], [2, spotOf(tk, 2 * b + 1)[0]]], (tk) => spotOf(tk, 0)[0]);
  TR.kv = makeTrack((b, tk) => [[0, spotOf(tk, 2 * b)[1]], [2, spotOf(tk, 2 * b + 1)[1]]], (tk) => spotOf(tk, 0)[1]);
  TR.kl = makeTrack(() => [[0.2, 0], [1.75, 0.014], [2.2, 0], [3.75, 0.014]], 0.045);
  const patOf = (tk, i) => Math.floor(rnd(tk.seed, i, 5) * 3) % 3;
  TR.kp = [0, 1, 2].map((p) => makeTrack((b, tk) => [[0, patOf(tk, 2 * b) === p ? 1 : 0], [2, patOf(tk, 2 * b + 1) === p ? 1 : 0]], (tk) => (patOf(tk, 0) === p ? 1 : 0)));
  // ----- the feather: long slow strokes, little circles on her arch, flicks under her toes, short strokes along her arch
  const featherKind = (tk, b) => (b === 0 ? 'long' : pickOf(tk, b, 2, ['long', 'circles', 'long', 'toes', 'arch']));
  TR.fu = makeTrack((b, tk) => { const k = featherKind(tk, b); return k === 'long' ? [[0, 0.86, SLOW], [2, 0.14, SLOW]] : k === 'circles' ? [[0, 0.5, SLOW]] : k === 'toes' ? [[0, 0.93]] : [[0, 0.64, SLOW], [2, 0.36, SLOW]]; }, 0.2);
  TR.fv = makeTrack((b, tk) => { const k = featherKind(tk, b), l = laneOf(tk, b); return k === 'long' ? [[0, l, SLOW], [2, -l * 0.6, SLOW]] : k === 'circles' ? [[0, 0, SLOW]] : k === 'toes' ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((x, i) => [x, (i % 2 ? 0.52 : -0.52) * (1 - 0.06 * i)]) : [[0, l * 0.6, SLOW]]; }, 0);
  TR.fa = makeTrack((b, tk) => (featherKind(tk, b) === 'circles' ? [[0.3, 1, SLOW], [3.4, 0, GLIDE]] : []), 0);
  TR.fl = makeTrack((b) => (b === 0 ? [[0, 0]] : []), 0.03);
  // ----- the tongue: one lick a bar, the ball of her foot to her heel; now and then a slow one, or two short ones over her arch
  const lickKind = (tk, b) => (b === 0 ? 'lick' : pickOf(tk, b, 2, ['lick', 'lick', 'slow', 'arch']));
  TR.lu = makeTrack((b, tk) => { const k = lickKind(tk, b);
    return k === 'slow' ? [[0.5, 0.8, GLIDE], [1, 0.66, GLIDE], [1.5, 0.52, GLIDE], [2, 0.38, GLIDE], [2.5, 0.25, GLIDE], [3, 0.12, GLIDE], [3.7, 0.93]]
      : k === 'arch' ? [[0, 0.7], [0.5, 0.54, LICK], [0.9, 0.38, LICK], [1.6, 0.7], [2.4, 0.54, LICK], [2.8, 0.38, LICK], [3.6, 0.93]]
        : [[0.5, 0.74, LICK], [0.875, 0.55, LICK], [1.25, 0.36, LICK], [1.625, 0.2, LICK], [2, 0.1, LICK], [3.1, 0.93]]; }, 0.93);
  TR.le = makeTrack((b, tk) => { const k = lickKind(tk, b); return k === 'slow' ? [[0.2, 1, 'snappy'], [3.3, 0, 'snappy']] : k === 'arch' ? [[0.2, 1, 'snappy'], [1.25, 0, 'snappy'], [2.1, 1, 'snappy'], [3.15, 0, 'snappy']] : [[0.2, 1, 'snappy'], [2.45, 0, 'snappy']]; }, 0);      // how far out it is
  TR.lm = makeTrack((b, tk) => { const k = lickKind(tk, b); return k === 'slow' ? [[0, 1, 'snappy'], [3.5, 0, 'snappy']] : k === 'arch' ? [[0, 1, 'snappy'], [1.4, 0, 'snappy'], [1.95, 1, 'snappy'], [3.3, 0, 'snappy']] : [[0, 1, 'snappy'], [2.65, 0, 'snappy']]; }, 0);      // the mouth: there or not
  TR.lv = makeTrack((b, tk) => [[3.2, b % 2 ? laneOf(tk, b + 1) * 0.8 : 0]], 0);
  // ----- the brush: a spot a beat, snaking over the sole, scrubbing in little circles
  TR.bu = makeTrack((b) => [0, 1, 2, 3].map((i) => [i, (b % 2 ? [0.86, 0.68, 0.5, 0.3] : [0.2, 0.4, 0.6, 0.8])[i]]), 0.3);
  TR.bv = makeTrack((b) => [0, 1, 2, 3].map((i) => [i, ((b * 4 + i) % 2 ? 1 : -1) * 0.36]), 0);
  TR.bl = makeTrack((b) => (b === 0 ? [[0, 0]] : []), 0.03);

  // =====================================================================================================
  //                                     the tools at work (standing or tied)
  // =====================================================================================================
  // ----- the hand. Its wrist and forearm go by the foot at rest (steady: no shake reaches them); each nail is brought down
  // to her skin as it is this frame by its own knuckle: Newton's steps on that knuckle's curl, from the same start every
  // frame, so the answer moves as smoothly as what goes into it.
  // (yaw: the hand comes in slanting across the sole from its outer side, about 50 degrees off its length: the four nails
  // then lie in a slanting row no wider than her sole, and its palm is beside her foot instead of over it;
  // c: her fingers' curls at their three joints; reach: how far below the level of its knuckle a nail touches, as an angle of
  // the knuckle-to-tip line: well short of straight down (PI / 2), where the knuckle could bring it no lower (so every nail
  // has a couple of centimetres of reach left for the hollow of her arch); sp: the fingers
  // drawn together, so that all four nails find her sole, which is no wider than the hand)
  const HP = { tease: { pitch: 0.4, yaw: 0.85, wrist: -0.42, c: [0.34, 0.62, 0.4], th: [0.12, 0.2, 0.25], reach: 0.75, sp: 0.09 }, tickle: { pitch: 0.4, yaw: 0.85, wrist: -0.42, c: [0.56, 0.84, 0.5], th: [0.15, 0.25, 0.3], reach: 0.86, sp: 0.09 } };
  const NOM = {}, PT = { a: V3(), b: V3() }, _e = V3(), _np = V3();
  // One finger's knuckle-to-tip line, seen in the plane it swings in: rho its length, phi its angle below the level of the
  // knuckle (0: straight ahead along the sole, PI / 2: straight down into it), k how much of the sole's normal lies in that plane
  const ARC = { rho: 0, phi: 0, k: 1 };
  function arcOf(f, nW) {
    _kp.setFromMatrixPosition(f.root.matrixWorld); _ax.copy(f.ax0).transformDirection(f.root.matrixWorld);
    _np.copy(nW).addScaledVector(_ax, -nW.dot(_ax)); ARC.k = Math.max(0.2, _np.length()); _np.normalize(); _e.crossVectors(_ax, _np);
    _vel.subVectors(_tp, _kp); const x = _vel.dot(_e), y = -_vel.dot(_np);
    ARC.rho = Math.max(1e-4, Math.hypot(x, y)); ARC.phi = Math.atan2(y, x); return ARC;
  }
  // where the middle nail's tip is in the hand's own frame, in a way's standing pose, and the knuckles' curl of that pose
  // (the one that gives the pose's reach); measured once
  function nominal(o, mode, sd) {
    const H = o.userData, key = mode + H.side + sd; if (NOM[key]) return NOM[key];
    const P = HP[mode], p0 = o.position.clone(), q0 = o.quaternion.clone(), up = V3(0, 1, 0), mid = H.fingers[1];
    o.position.set(0, 0, 0); o.quaternion.identity(); H.hand.position.set(0, 0, 0); H.hand.rotation.set(P.pitch, (sd === 'L' ? 1 : -1) * P.yaw, 0); H.wristBend(P.wrist);
    let c1 = P.c[0];
    for (let it = 0; it < 2; it++) { mid.curl(c1, P.c[1], P.c[2], P.sp); mid.tip.getWorldPosition(_tp); c1 += P.reach - arcOf(mid, up).phi; }
    for (const f of H.fingers) f.curl(c1, P.c[1], P.c[2], P.sp); H.thumb.curl(P.th[0], P.th[1], P.th[2]);
    o.updateMatrixWorld(true);
    const t = mid.tip.getWorldPosition(V3()); t.c1 = c1;
    t.x = (H.fingers[0].tip.getWorldPosition(_tp).x + t.x + H.fingers[2].tip.getWorldPosition(_tp).x) / 3;      // (across: the middle of its first three nails)
    o.position.copy(p0); o.quaternion.copy(q0);
    return (NOM[key] = t);
  }
  // A nail brought down to `target` above her skin by its knuckle. From the pose's own curl the knuckle is stepped the way
  // the nail has to go (curled if it is above its target, opened if it is below) until it has passed it, and the curl in
  // between is then found by halving: the nearest answer to the pose every frame, so it cannot hop between two answers or
  // overshoot; it never curls past the point where the nail points straight down (`top`).
  function fingerDown(f, c0, c2, c3, sp, target, sd, nW, lo = -0.62, hi = 1.5) {
    const gap = (c) => { f.curl(c, c2, c3, sp); f.tip.getWorldPosition(_tp); return heightOver(sd, _tp) - target; };
    let a = c0, ga = gap(a); if (Math.abs(ga) < 0.00008) return a;
    const top = Math.min(hi, a + (PI / 2 - arcOf(f, nW).phi)), dir = ga > 0 ? 1 : -1, end = dir > 0 ? top : lo;
    let b = a, gb = ga, best = a, gBest = Math.abs(ga);
    for (let i = 0; i < 12 && gb * ga > 0; i++) { a = b; ga = gb; if (b === end) break; b = dir > 0 ? Math.min(end, b + 0.1) : Math.max(end, b - 0.1); gb = gap(b); if (Math.abs(gb) < gBest) { gBest = Math.abs(gb); best = b; } }
    if (gb * ga > 0) { gap(best); return best; }      // (it cannot reach: as near as it gets)
    for (let i = 0; i < 6; i++) { const m = (a + b) / 2, gm = gap(m); if (gm * ga > 0) { a = m; ga = gm; } else { b = m; gb = gm; } }
    const c = ga === gb ? a : a + (b - a) * ga / (ga - gb); gap(c); return c;
  }
  function poseHand(o, tk, s, sd) {
    const S = soleOf(sd); if (!S) return 0;
    const H = o.userData, hand = H.hand, tick = tk.mode === 'tickle', P = HP[tick ? 'tickle' : 'tease'], sg = sd === 'L' ? 1 : -1, bt = s / BEAT, ph = tk.seed % 89;
    const u = tick ? TR.ku(s, tk) : TR.hu(s, tk), v = 0.45 * (tick ? TR.kv(s, tk) : TR.hv(s, tk)), lift = Math.max(0, tick ? TR.kl(s, tk) : TR.hl(s, tk));      // (the hand is as wide as her sole: it only shifts a little across it)
    const T0 = nominal(o, tick ? 'tickle' : 'tease', sd), c2b = tick ? P.c[1] : TR.hc(s, tk), c10 = T0.c1;
    // the hand is alive: it sways a little (slow seeded noise), follows its lane with a turn, and its wrist gives as the fingers pull
    hand.position.set(0, 0, 0);
    hand.rotation.set(P.pitch + 0.03 * N2(s * 0.27 + ph), sg * P.yaw + 0.045 * N1(s * 0.31 + ph) - (tick ? 0 : 0.2 * v), 0.04 * N3(s * 0.23 + ph));
    H.wristBend(P.wrist - (tick ? 0.03 * Math.sin(2 * PI * bt) : 0.25 * (c2b - 0.52)));
    refAxes(sd); soleAt(sd, u, v, _c, null, false);
    _m.makeBasis(RX, RY, RZ); o.quaternion.setFromRotationMatrix(_m);
    o.position.copy(_c).addScaledVector(RX, -T0.x).addScaledVector(RY, 0.0006 + lift - T0.y).addScaledVector(RZ, -T0.z);
    o.updateMatrixWorld(true);
    _nl.copy(S.n).transformDirection(live(sd).m);
    let w0 = 0, w1 = 0, w2 = 0; if (tick) { w0 = TR.kp[0](s, tk); w1 = TR.kp[1](s, tk); w2 = TR.kp[2](s, tk); }
    let lo = 9, hi = -9, jn = 9; const touch = 1 - sst(lift, 0.001, 0.007);
    for (const f of H.fingers) {
      let c2, c3, pluck = 0;
      if (tick) {      // scribbling: one after the other / a wave from first finger to little finger / all four together
        const a = 2 * PI * 2.5 * bt + 1.7 * f.k, b = 2 * PI * 2 * bt - 0.9 * f.k, c = 2 * PI * 2 * bt + 0.15 * f.k;      // (four scratches a second, or three)
        c2 = c2b + 0.17 * (w0 * Math.sin(a) + w1 * Math.sin(b) + w2 * Math.sin(c)); c3 = P.c[2] + 0.1 * (w0 * Math.sin(a + 1.1) + w1 * Math.sin(b + 1.1) + w2 * Math.sin(c + 1.1));
        const back = Math.max(0, w0 * Math.cos(a) + w1 * Math.cos(b) + w2 * Math.cos(c)); pluck = 0.0026 * back * back * (3 - 2 * Math.min(1, back));      // (each nail lifts a hair on its way back, and comes down again softly)
      } else { const a = 2 * PI * (bt - 0.22 * f.k); c2 = c2b + 0.15 * Math.sin(a); c3 = P.c[2] + 0.1 * Math.sin(a + 0.8); }      // raking: a ripple runs through the fingers, one to the beat
      // (in the air its fingers are loose; they reach down for her skin as the hand comes down, over the last few millimetres)
      // (...and a nail is never left in her skin: where the answer is to open the knuckle it is taken whole, in the air too)
      const air = c10 - 0.06; let c1 = air;
      if (touch > 0) { const sv = fingerDown(f, c10, c2, c3, P.sp, 0.0006 + pluck, sd, _nl); c1 = sv < air ? sv : air + (sv - air) * touch; }
      f.curl(c1, c2, c3, P.sp); let hNow = heightOver(sd, f.tip.getWorldPosition(_tp));
      if (hNow < 0.0005) { c1 = fingerDown(f, c1, c2, c3, P.sp, 0.0006, sd, _nl); hNow = heightOver(sd, f.tip.getWorldPosition(_tp)); }
      ST.c1s[f.k] = c1; ST.hs[f.k] = hNow;
      const over = _uvh.u > -0.04 && _uvh.u < 1.04 && Math.abs(_uvh.v) < 1.25;      // (is this nail over her sole at all, or in the air past its edge?)
      if (over && hNow < ST.worst.h) ST.worst = { h: hNow, k: f.k, c1: +c1.toFixed(3), c10: +c10.toFixed(3), c2: +c2.toFixed(2), beat: +bt.toFixed(2), u: +_uvh.u.toFixed(2), v: +_uvh.v.toFixed(2), lift: +(lift * 1000).toFixed(1), touch: +touch.toFixed(2), T: +ST.T.toFixed(2), sd };
      if (over && hNow < lo) lo = hNow; if (hNow > hi) hi = hNow;
      const hj = heightOver(sd, _kp.setFromMatrixPosition(f.mid.matrixWorld)); if (hj < jn) jn = hj;
    }
    // her thumb: off the sole, moving a little with the rest
    const th = P.th, tw = 0.05 * Math.sin(PI * bt + 0.6);
    H.thumb.curl(th[0] + tw, th[1], th[2]);
    if (heightOver(sd, H.thumb.tip.getWorldPosition(_tp)) < 0.004 + lift) fingerDown(H.thumb, th[0] + tw, th[1], th[2], 0, 0.004 + lift, sd, _nl, -0.9, 1.2);
    ST.nailLo = lo; ST.nailHi = hi; ST.joint = jn;
    PT.a.copy(o.position); H.fingers[1].tip.getWorldPosition(PT.b);
    o.visible = true;
    const down = lift < 0.004;
    return tick ? (down ? 1.3 : 0.35) : (down ? 0.9 : 0.2);
  }
  // ----- the feather: its tip on her skin, the quill held off the sole to its outer side and following late; what is
  // behind the tip trails behind the stroke (a pure function of time too: the stroke's own speed)
  const _f0 = V3(), _f1 = V3(), _f2 = V3(), _f3 = V3();
  const featherUV = (ss, tk, out) => { const a = TR.fa(ss, tk), w = ss * (PI / BEAT); out[0] = clamp(TR.fu(ss, tk) + a * 0.12 * Math.cos(w), 0.04, 0.96); out[1] = clamp(TR.fv(ss, tk) + a * 0.42 * Math.sin(w), -0.9, 0.9); return out; };
  const _uv = [0, 0], _uv1 = [0, 0], _uvq = [0, 0];
  function poseFeather(o, tk, s, sd, t) {
    if (!soleOf(sd)) return 0;
    const sx = sd === 'L' ? -1 : 1;
    featherUV(s, tk, _uv); featherUV(s - 0.05, tk, _uv1); featherUV(s - 0.16, tk, _uvq);
    refAxes(sd);
    soleAt(sd, _uv[0], _uv[1], _f3, _n, true); _f3.addScaledVector(_n, 0.0012 + Math.max(0, TR.fl(s, tk)));      // the tip, on her skin
    soleAt(sd, _uv1[0], _uv1[1], _p, null, false); soleAt(sd, _uv[0], _uv[1], _q, null, false); _s.subVectors(_q, _p).multiplyScalar(1 / 0.05);      // how fast the tip goes
    const sp = _s.length();
    soleAt(sd, _uvq[0] * 0.55 + 0.2, _uvq[1] * 0.5, _f0, null, false); _f0.addScaledVector(RY, 0.058).addScaledVector(RX, 0.17 * sx).addScaledVector(RZ, -0.045);      // the quill's end
    _s.multiplyScalar(-0.09); if (_s.length() > 0.03) _s.setLength(0.03);
    _f1.lerpVectors(_f0, _f3, 0.4).addScaledVector(RY, 0.012);
    _f2.copy(_f3).addScaledVector(RX, 0.055 * sx).addScaledVector(RY, 0.006).add(_s);      // pressed almost flat to the sole before the tip
    o.userData.draw(_f0, _f1, _f2, _f3, RY, t, 0.35 + Math.min(1, sp * 4));
    PT.a.copy(_f0); PT.b.copy(_f3);
    o.visible = true;
    return 0.45 + 0.6 * Math.min(1, sp * 5);
  }
  // ----- the tongue: a mouth over her sole, 3 cm nearer her toes than the tongue's tip and 2.7 cm off her skin, turned
  // half towards the sole; the tongue comes out of it, down onto her skin, and the mouth goes up the sole with it
  function poseLick(o, tk, s, sd, dt) {
    if (!soleOf(sd)) return 0;
    const ext = clamp(TR.le(s, tk), 0, 1.03), mk = clamp(TR.lm(s, tk), 0, 1.05);
    if (mk < 0.02) { o.visible = false; mouth.visible = false; return 0; }
    const u = TR.lu(s, tk), v = TR.lv(s, tk);
    refAxes(sd);
    soleAt(sd, u, v, _c, _n, true);
    soleAt(sd, Math.min(1.08, u + 0.2), v * 0.8, _r, null, false); _r.addScaledVector(RY, 0.027);
    _q.copy(RZ).multiplyScalar(-0.75).addScaledVector(RY, -0.62).normalize();                 // (the way the mouth faces: up the sole, and into it)
    mouth.position.copy(_r); mouth.up.copy(RY); mouth.lookAt(_s.copy(_r).add(_q)); mouth.scale.setScalar(0.86 + 0.14 * mk); mouth.visible = true; mouthPortal.visible = true;
    _f0.copy(_r).addScaledVector(_q, 0.002);                                                  // its root, in the mouth
    _p.copy(_c).addScaledVector(_n, 0.0018); _f3.lerpVectors(_f0, _p, ext);                   // its tip, flat on her skin (drawn in: back to the mouth)
    soleAt(sd, Math.min(1.06, u + 0.09), v * 0.9, _f1, _n, true); _f1.addScaledVector(_n, 0.0065); _f1.lerpVectors(_f0, _f1, ext);
    o.userData.draw(_f0, _f1, _f3, RX); o.visible = ext > 0.03;
    if (ext > 0.9 && A.scrubMarks) { const M = A._marks && A._marks(); if (M && (M.kind === 'wet' || M.kind === 'both')) { M.left = Math.max(M.left, 60); A.scrubMarks(sd, _c, 0.02, -dt * 7); } }      // (it leaves her sole wet where it went)
    PT.a.copy(_r); PT.b.copy(_f3);
    return ext > 0.6 ? 1 : 0.15;
  }
  // ----- the brush by itself (the foot cam): on her skin as it is, upright by the foot at rest
  function poseBrush(o, tk, s, sd, dt) {
    if (!soleOf(sd)) return 0;
    const lift = Math.max(0, TR.bl(s, tk)), w = s * (4 * PI / BEAT);      // (two little circles to the beat)
    refAxes(sd); soleAt(sd, clamp(TR.bu(s, tk) + 0.05 * Math.sin(w), 0.04, 0.96), clamp(TR.bv(s, tk) + 0.15 * Math.cos(w), -0.9, 0.9), _c, _n, true);
    _m.makeBasis(RX, RY, RZ); o.quaternion.setFromRotationMatrix(_m); o.position.copy(_c).addScaledVector(_n, TOOLS.brush.off + lift); o.rotateY(0.12 * Math.sin(w * 0.5)); o.visible = true;
    if (lift < 0.004 && A.scrubMarks) ST.left = A.scrubMarks(sd, _c, 0.026, dt);
    PT.a.copy(o.position); PT.b.copy(_c);
    return lift < 0.004 ? 1.05 : 0.2;
  }
  // ----- the brush under the mouse (the clean-up after a capture)
  function brushAtMouse(dt, t, hit) {
    const o = TOOLS.brush.obj, sd = ST.side; hideTools();
    if (!hit || !soleOf(sd)) return 0;
    const rub = Math.min(1.6, ST.speed), a = t * 13;
    refAxes(sd); soleAt(sd, ST.uv[0], ST.uv[1], _c, _n, true);
    _m.makeBasis(RX, RY, RZ); o.quaternion.setFromRotationMatrix(_m);
    o.position.copy(_c).addScaledVector(_n, TOOLS.brush.off).addScaledVector(RX, 0.004 * Math.cos(a) * (0.3 + rub)).addScaledVector(RZ, 0.006 * Math.sin(a * 0.8) * (0.3 + rub)); o.rotateY(0.12 * Math.sin(a * 0.5)); o.visible = true;
    if (A.scrubMarks) ST.left = A.scrubMarks(sd, _c, 0.026, (0.1 + rub * 0.9) * dt * 1.5);
    return 0.15 + rub;
  }
  // How she takes it: the level T climbs to what the tool can do to her, and sinks when she is left alone
  function react(dt, t, act, key) {
    const P = PROF[key] || PROF.brush, busyNow = act > 0.05;
    if (busyNow) { ST.T = ST.T > P.cap ? Math.max(P.cap, ST.T - 0.5 * dt) : Math.min(P.cap, ST.T + (0.1 + 0.34 * Math.min(1.3, act)) * P.gain * dt); ST.quiet = 0; ST.playT += dt; }
    else { ST.T = Math.max(0, ST.T - 0.28 * dt); ST.quiet += dt; }
    const T = ST.T;
    if (ST.shock > 0) { ST.shock -= dt; A.setExpression('surprised', 0.55); }      // (a tongue: it startles her first)
    else if (P.kind === 'tease') A.setExpression(T > 0.3 ? 'happy' : T > 0.07 ? 'embarrassed' : 'smile', Math.min(0.85, 0.3 + T * 1.3));
    else if (P.kind === 'giggle') A.setExpression(T > 0.3 ? 'laugh' : T > 0.07 ? 'happy' : 'smile', Math.min(0.8, 0.25 + T * 0.8));
    else A.setExpression(T > 0.62 ? 'laughHard' : T > 0.25 ? 'laugh' : T > 0.06 ? 'happy' : (ST.mode === 'clean' ? 'embarrassed' : 'smile'), Math.min(0.9, 0.25 + T * 0.7));
    A.setToeWiggle(T > 0.04 ? 0.07 + 0.3 * T : 0, 1.2 + 2.2 * T);
    if (A.setLegShake) {                                 // her leg shakes with it (the foot that is up; tied: both, the one being worked on more)
      const amp = T * P.shake * (busyNow ? 1 : 0.5), two = ST.take && ST.take.two;
      if (ST.tied) { A.setLegShake(ST.side === 'L' ? 'L' : 'R', amp * 0.6, 'knee'); A.setLegShake(ST.side === 'L' ? 'R' : 'L', amp * (two ? 0.6 : 0.33), 'knee'); }      // (her shins jerk up off the ground: a little less than a capture's, the tools' hands being held steady over them)
      else { A.setLegShake(ST.side, amp, 'pivot'); A.setLegShake(other(ST.side), 0); }
    }
    return P;
  }
  const bankOf = (P, T) => (P.kind === 'tease' ? (T > 0.36 ? 'giggle' : 'chuckle') : P.kind === 'giggle' ? 'giggle' : (T > 0.62 ? 'laughter' : 'giggle'));
  // (the clean-up: her voice and her lines by the clock, as before)
  function chatter(t, P, key) {
    const T = ST.T, every = P.kind === 'tease' ? 3.4 : P.kind === 'giggle' ? 2.3 : (T > 0.62 ? 1.6 : 2.3);
    if (T > 0.12 && t - ST.lastVoice > every) { ST.lastVoice = t; voice(bankOf(P, T), P.kind === 'tease' ? 0.6 : 0.8); }
    if (T > 0.22 && t - ST.lastLine > 3.6 && LINES[key]) { ST.lastLine = t; bubble(pick(P.kind === 'laugh' && T > 0.7 && LINES[key].hard ? LINES[key].hard : LINES[key].mid), 2.0); }
  }
  // the pointer on the sole: eased, and how fast it moves over it (in sole lengths a second)
  function track(dt, sides) {
    const h = ST.mouseIn ? hitSole(sides) : null;
    if (h && h.sd === ST.side) { ST.goal[0] = h.u; ST.goal[1] = h.v; }
    const ok = !!h && h.sd === ST.side, k = 1 - Math.exp(-dt * 16), du = (ST.goal[0] - ST.uv[0]) * k, dv = (ST.goal[1] - ST.uv[1]) * k;
    ST.uv[0] += du; ST.uv[1] += dv;
    const sp = ok && dt > 0 ? Math.hypot(du, dv * 0.35) / dt : 0;
    ST.speed += (sp - ST.speed) * Math.min(1, dt * 10); ST.on = ok;
    return ok;
  }

  // =====================================================================================================
  //        her face, in a corner of the picture all the time her soles are played with (10-04, as he asked:
  //        "no need to cut to her face laughing ... have it be in the corner at all times")
  // A camera of its own in front of her face, from under her hat's brim (lying on her front: from in front of her head, low);
  // the host draws its picture into the frame (post.js setInset) under a frame of the page's. The camera is anchored: her
  // head bobs inside the picture instead of dragging it, and the anchor is taken afresh when she changes her pose.
  // =====================================================================================================
  const faceCam = new THREE.PerspectiveCamera(29, 1, 0.05, 8); faceCam.layers.set(1);
  const FA = { on: false, head: V3(), p: V3(), l: V3(), tied: null, rect: null };
  addEventListener('resize', () => { FA.rect = null; });
  function faceInset(on) {
    if (!env.setInset) return;
    const hm = on ? mkr('Marker_Head') : null;
    if (!hm) { if (FA.on) { FA.on = false; faceEl.style.display = 'none'; env.setInset(null); } return; }
    hm.getWorldPosition(_p);
    if (!FA.on || FA.tied !== ST.tied || _p.distanceTo(FA.head) > 0.14) {
      FA.head.copy(_p); FA.tied = ST.tied;
      const yaw = anne.rotation.y; _q.set(Math.sin(yaw), 0, Math.cos(yaw)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));      // her front, her left
      if (ST.tied) {
        if (soleAt('L', 0.4, 0, _s, null, false)) { _s.sub(FA.head).negate(); _s.y = 0; if (_s.lengthSq() > 1e-4) _q.copy(_s).normalize(); }      // (the way she lies: her feet to her head)
        FA.p.copy(FA.head).addScaledVector(_q, 0.62).addScaledVector(_r, 0.2); FA.p.y = Math.max(anne.position.y + 0.07, FA.head.y - 0.05); FA.l.copy(FA.head); FA.l.y -= 0.09;      // (her face is under the marker: her hat must not fill the picture)
      } else { FA.p.copy(FA.head).addScaledVector(_q, 0.68).addScaledVector(_r, 0.22); FA.p.y -= 0.19; FA.l.copy(FA.head); FA.l.y -= 0.045; }
      faceCam.position.copy(FA.p); faceCam.lookAt(FA.l); faceCam.updateMatrixWorld(true);
    }
    if (!FA.on) { FA.on = true; faceEl.style.display = 'block'; FA.rect = null; }
    if (!FA.rect) { const a = faceEl.getBoundingClientRect(), c = renderer.domElement.getBoundingClientRect(); FA.rect = { x: a.left - c.left, y: c.bottom - a.bottom, w: a.width, h: a.height }; }
    env.setInset({ camera: faceCam, x: FA.rect.x, y: FA.rect.y, w: FA.rect.w, h: FA.rect.h, r: 14 });
  }

  // =====================================================================================================
  //                           the director: takes, the shot list, her voice on the beat
  // A take: one tool on one sole, eight bars standing (then she changes feet), four bars tied (then the other sole).
  // =====================================================================================================
  function startTake(sd) {
    const key = keyOf(ST.tool), n = ++ST.takes, seed = (ST.seed + Math.imul(n, 7919)) | 0;
    const was = ST.take, through = !!(was && was.tool === ST.tool && was.introLen === 0 && was.tied === ST.tied && (ST.tied || was.sd === sd));      // (Lilith is already here: no second entrance)
    ST.take = { n, seed, sd, tool: ST.tool, mode: key, tied: ST.tied, bars: ST.tied ? 4 : 8, t: 0, beat: -1, vAt: -9, shot: -1, c: {}, two: null, intro: 0, introLen: 0, said: 0 };
    // (batch 22) Lilith's tools come up through a portal in the ground first: the very first time she explains herself (3 bars),
    // when the tool is picked she says hello (1 bar), and on each new sole after that she is simply quick about it (2 beats)
    if (lilFirst && stored('amirian3d.lilithCalled', '') === '1') lilFirst = false;      // (she has explained herself since, to the other of the two)
    if ((ST.tool === 'fingers' || ST.tool === 'tongue') && !through) { const len = lilFirst ? 3 * BAR : ST.firstFor ? BAR : 2 * BEAT; ST.take.intro = ST.take.introLen = len; ST.take.greet = lilFirst ? 'summon' : ST.firstFor ? 'hello' : ''; PORT.set = false; }
    else if (ST.tool !== 'fingers' && ST.tool !== 'tongue') { PORT.want = 0; if (PORT.air) PORT.k = 0; }      // (in the air it is shut at once: the square-on camera would look through it while it closed)
    if (ST.tied && ST.tool === 'fingers') ST.take.two = { seed: (seed ^ 0x2f6e2b1) | 0, mode: key, c: {} };      // (tied: a hand on each sole)
    ST.side = sd; hideTools();
    if (ST.tool === 'tongue') { const M = A._marks && A._marks(); if (A.soleMarks && M && !M.kind) A.soleMarks('wet', 90, { empty: true }); }
    console.log(`FOOTPLAY take ${n} ${key} ${sd}${ST.tied ? ' tied' : ''}`);
  }
  const handFor = (sd) => HANDS[sd];      // (the hand of the foot's own side: its nails then lie in a slanting row along the sole; the other hand's would fan out across it)
  // ----- the shots. An anchor is taken at each cut (where her sole, her head and she herself are then): within a shot the
  // camera does not chase her foot, it only pushes in a few per cent and drifts.
  // (every shot is a close one: a tool's hand ends at its elbow, so its arm must leave the picture by an edge. The hand
  // covers her sole from straight behind, so the fingers are shown from the sole's inner side and in profile, where the
  // nails are seen on her skin; the other tools from straight behind first)
  const SEQS = {      // (10-04: no shot of her face in these any more: it is in the corner all the time, see faceInset)
    fingers: [[['side', 2], ['inner', 2], ['profile', 2], ['toes', 1], ['side', 1]], [['profile', 2], ['side', 2], ['toes', 1], ['inner', 2], ['profile', 1]]],
    stand: [[['sole', 2], ['inner', 2], ['side', 2], ['toes', 1], ['sole', 1]], [['inner', 2], ['sole', 2], ['toes', 1], ['side', 2], ['inner', 1]]],
    tied: [[['both', 2], ['close', 2]], [['close', 2], ['both', 2]]],
  };
  function shotAt(tk, s) {
    const list = SEQS[tk.tied ? 'tied' : tk.tool === 'fingers' ? 'fingers' : 'stand'][(tk.n + 1) % 2], bar = s / BAR; let b0 = 0;
    for (let i = 0; i < list.length; i++) { const [name, n] = list[i]; if (bar < b0 + n || i === list.length - 1) return { name, i, q: clamp((bar - b0) / n, 0, 1) }; b0 += n; }
    return { name: list[0][0], i: 0, q: 0 };
  }
  const AN = { C: V3(), N: V3(), Nh: V3(), O: V3(), F: V3(), L: V3(), head: V3(), mid: V3(), Nt: V3(), B: V3(), T: V3(), g: 0 };
  function anchor(sd) {
    const yaw = anne.rotation.y; AN.F.set(Math.sin(yaw), 0, Math.cos(yaw)); AN.L.set(Math.cos(yaw), 0, -Math.sin(yaw)); AN.g = anne.position.y;
    if (!soleAt(sd, 0.4, 0, AN.C, AN.N, false)) { AN.C.copy(anne.position); AN.N.copy(AN.F).negate(); }
    AN.Nh.copy(AN.N); AN.Nh.y = 0; if (AN.Nh.lengthSq() < 1e-4) AN.Nh.copy(AN.F).negate(); AN.Nh.normalize();
    AN.O.copy(AN.L).multiplyScalar(sd === 'L' ? 1 : -1); AN.O.addScaledVector(AN.Nh, -AN.O.dot(AN.Nh)).normalize();      // the foot's outer side
    if (!soleAt(sd, 1.12, 0, AN.T, null, false)) AN.T.copy(AN.C);      // (about where her toes are)
    const hm = mkr('Marker_Head'); if (hm) hm.getWorldPosition(AN.head); else AN.head.copy(anne.position).setY(anne.position.y + (A.headHeight || 1.45));
    if (ST.tied) {
      if (soleAt(other(sd), 0.4, 0, _p, _q, false)) { AN.mid.addVectors(AN.C, _p).multiplyScalar(0.5); AN.Nt.addVectors(AN.N, _q).normalize(); } else { AN.mid.copy(AN.C); AN.Nt.copy(AN.N); }
      AN.Nt.y = Math.max(0.28, AN.Nt.y); AN.Nt.normalize();
      AN.B.subVectors(AN.head, AN.mid); AN.B.y = 0; if (AN.B.lengthSq() < 1e-4) AN.B.copy(AN.F); AN.B.normalize();      // (the way she lies: her feet to her head)
    }
  }
  const dirOut = (a) => _s.copy(AN.Nh).multiplyScalar(Math.cos(a)).addScaledVector(AN.O, Math.sin(a));
  function shotPose(sh, s) {
    const q = sh.q, P = cam.p, Lk = cam.l, push = 1 + 0.06 * q, tall = !ST.tied && A.shoeHeel && A.shoeHeel() > 0;      // (a high heel she has stepped out of stands between a low camera and her sole: those two shots look down over it)
    switch (sh.name) {
      case 'sole': dirOut(0.52); Lk.copy(AN.C); P.copy(Lk).addScaledVector(_s, (tall ? 0.46 : 0.5) / push); P.y = tall ? Lk.y + 0.17 : Math.max(AN.g + 0.07, Lk.y - 0.035); Lk.y -= 0.02; cam.fov = 38; break;      // (low, facing her sole, turned 30 degrees to its outer side)
      case 'inner': dirOut(-0.5); Lk.copy(AN.C); P.copy(Lk).addScaledVector(_s, (tall ? 0.44 : 0.46) / push); P.y = tall ? Lk.y + 0.16 : Math.max(AN.g + 0.07, Lk.y - 0.01); cam.fov = 38; break;      // (from behind, turned to its inner side: the tool beyond her sole)
      case 'profile': dirOut(-1.36); Lk.copy(AN.C); P.copy(Lk).addScaledVector(_s, 0.4 / push); P.y = Math.max(AN.g + 0.07, Lk.y + 0.02); cam.fov = 36; break;      // (side on: her sole's edge, the nails on it)
      case 'side': dirOut(-0.95); Lk.copy(AN.C); P.copy(Lk).addScaledVector(_s, 0.42 / push); P.y = Math.max(AN.g + 0.07, Lk.y + 0.06); cam.fov = 36; break;      // (from its inner side: the tool in profile on her sole)
      case 'toes': Lk.copy(AN.T); P.copy(AN.T).addScaledVector(AN.F, 0.5 / push).addScaledVector(AN.O, 0.16); P.y = AN.g + 0.1; cam.fov = 38; break;      // (from in front of her, low: her toes curl)
      case 'both': Lk.copy(AN.mid);
        if (PORT.air && PORT.want && PORT.set) { Lk.lerp(PORT.at, 0.5); _s.copy(AN.Nt).multiplyScalar(0.7).addScaledVector(AN.O, 0.7).normalize(); P.copy(Lk).addScaledVector(_s, 0.94 / push); }      // (10-04: the portal over her soles, her arms down from it and her soles, all in the picture)
        else if (ST.tool === 'tongue') { _s.copy(AN.Nt).multiplyScalar(0.72).addScaledVector(AN.O, 0.62).normalize(); P.copy(AN.mid).addScaledVector(_s, 0.66 / push); Lk.addScaledVector(AN.Nt, 0.07); } else P.copy(AN.mid).addScaledVector(AN.Nt, 0.6 / push);
        P.y = Math.max(AN.g + 0.14, P.y); cam.fov = 40; break;      // (both soles, square on from behind and above her heels)
      case 'close': Lk.copy(AN.C); if ((PORT.air && PORT.want) || ST.tool === 'tongue') { _s.copy(AN.Nt).multiplyScalar(0.7).addScaledVector(AN.O, 0.6).normalize(); P.copy(AN.C).addScaledVector(_s, 0.46 / push); } else P.copy(AN.C).addScaledVector(AN.Nt, 0.4 / push).addScaledVector(AN.O, 0.07); P.y = Math.max(AN.g + 0.12, P.y); cam.fov = 36; break;
      default: Lk.copy(AN.C); P.copy(AN.C).addScaledVector(AN.Nt, 0.5); cam.fov = 38;
    }
    P.x += 0.004 * N1(s * 0.21 + 3.1); P.y += 0.0025 * N2(s * 0.19 + 7.7); P.z += 0.004 * N3(s * 0.23 + 1.3);      // (a held shot keeps moving: drift)
    cam.on = true; cam.direct = true;
  }
  // ----- on the beat: her voice, and what she says (the first touch of a tool; then every other bar)
  function onBeat(tk, b, P) {
    const T = ST.T, every = P.kind === 'tease' ? 6 : P.kind === 'giggle' ? 4 : (T > 0.62 ? 3 : 4);
    if (T > 0.12 && b - tk.vAt >= every && ST.clock - ST.voiceAt > every * BEAT * 0.8) { tk.vAt = b; ST.voiceAt = ST.clock; voice(bankOf(P, T), P.kind === 'tease' ? 0.6 : 0.8); }      // (the gap holds across a cut to the other sole or a change of tool)
    const L = LINES[tk.mode], at = tk.tool === 'tongue' ? 2 : 1; if (!L) return;
    if (ST.firstFor === tk.mode && b >= at) { ST.firstFor = null; bubble(pick(L.first), 2.6); if (tk.tool === 'tongue') ST.shock = 1.0; return; }
    // (batch 22) Lilith has her say between Anne's lines: about what she is doing, or about how Anne looks
    if ((tk.tool === 'fingers' || tk.tool === 'tongue') && b % 8 === (at + 4) % 8 && b > 4 && rnd(tk.seed, b, 21) < 0.62) {
      const looks = rnd(tk.seed, b, 22) < 0.45 ? lilLooks() : [];
      lilSays(pick(looks.length ? looks : LIL[tk.tool === 'tongue' ? 'tongue' : tk.mode] || LIL.tease), 2.6);
    }
    if (b % 8 !== at || T < 0.15) return;
    const bar = Math.floor(b / 4);
    bubble(pick(P.kind === 'laugh' && T > 0.7 && L.hard ? L.hard : tk.tied && rnd(tk.seed, b, 9) < 0.3 ? LINES.tied : tk.tool === 'feather' && L.toes && featherKind(tk, bar) === 'toes' ? L.toes : L.mid), 2.3);
  }
  // ----- (batch 22) Lilith comes through. The tool is posed as at the take's start (its hand off her sole, the mouth shut);
  // the portal opens in the ground under it; what is posed is then brought up out of the portal to that pose. While it
  // lasts the camera stands back far enough to show the ground. At its end the take plays on from its beginning.
  const _pq = V3(), _pw = V3();
  function summon(tk, s, sd, dt, t) {
    const el = tk.introLen - tk.intro, hands = tk.tool === 'fingers';      // seconds into it
    let act = 0;
    if (hands) { act = poseHand(handFor(sd, tk.tied), tk, 0, sd); if (tk.two) poseHand(handFor(other(sd), true), tk.two, BAR / 2, other(sd)); }
    else {                                              // (the mouth where it will first be, shut: poseLick itself shows nothing before the take's first beat)
      const u = TR.lu(0, tk), v = TR.lv(0, tk); refAxes(sd);
      soleAt(sd, Math.min(1.08, u + 0.2), v * 0.8, _r, null, false); _r.addScaledVector(RY, 0.027);
      _q.copy(RZ).multiplyScalar(-0.75).addScaledVector(RY, -0.62).normalize();
      mouth.position.copy(_r); mouth.up.copy(RY); mouth.lookAt(_s.copy(_r).add(_q)); mouth.scale.setScalar(0.9); mouth.visible = true; TOOLS.tongue.obj.visible = false;
    }
    if (!PORT.set) {                                    // where the portal opens: in the ground out from her wrist (a hand) or under the mouth; in the air over her soles when she is tied
      PORT.set = true; PORT.two = !!tk.two;
      const h1 = hands ? handFor(sd, tk.tied) : null;
      if (hands) { (h1.userData.elbow || h1).getWorldPosition(_pq); if (tk.two) { const h2 = handFor(other(sd), true); (h2.userData.elbow || h2).getWorldPosition(_pw); _pq.add(_pw).multiplyScalar(0.5); } }
      else _pq.copy(mouth.position);
      // (batch 23: tied, her soles up: the portal opens in the air right above them and Lilith comes DOWN through it.
      // 10-04: straight above the middle of her soles (it stood off towards her toes, before her fingertips: no wrist lets a
      // forearm come from there). It leans as it did: its upper side to her toes' end, where the cameras stand, a little
      // above it; leant the other way they saw it edge on, a pink stick.)
      if (tk.tied) { PORT.air = true; PORT.at.copy(AN.mid).addScaledVector(AN.B, PORT_BACK); PORT.at.y += PORT_UP; PORT.n.set(0, -0.85, 0).addScaledVector(AN.B, 0.53).normalize(); }
      else {
        PORT.air = false; PORT.n.set(0, 1, 0); PORT.at.set(_pq.x, anne.position.y + 0.012, _pq.z);
        // (10-04: a hand's portal is further out along the way its forearm leaves, PORT_OUT from its wrist: her arm then slants up
        // out of it towards her sole instead of standing up out of the ground under its own elbow)
        if (hands && h1.userData.real) { h1.userData.hand.getWorldPosition(_pw); _pq.sub(_pw).setY(0); if (_pq.lengthSq() > 1e-6) { _pq.normalize(); PORT.at.set(_pw.x + _pq.x * PORT_OUT, anne.position.y + 0.012, _pw.z + _pq.z * PORT_OUT); } }
      }
      PORT.want = 1; PORT.k = Math.min(PORT.k, 0.05);
    }
    if (hands) { swingArm(handFor(sd, tk.tied)); if (tk.two) swingArm(handFor(other(sd), true)); }
    // the rise: from under the portal up to the pose (the first third of the intro is the portal opening alone)
    const t0 = Math.min(0.7, tk.introLen * 0.3), k = clamp(Motion.step(el - t0, { response: Math.min(0.95, (tk.introLen - t0) * 0.75), damping: 1 }), 0, 1);
    const list = hands ? [handFor(sd, tk.tied)].concat(tk.two ? [handFor(other(sd), true)] : []) : [mouth];
    for (const o of list) {
      if (o !== mouth && o.userData.real && o.userData.pass) { comeThrough(o, k); o.visible = el > t0 * 0.6; continue; }
      // (the mouth, and a hand with no bones) from 34 cm behind the portal (on Lilith's side, unseen), on its middle line, to where the take wants it
      _pw.subVectors(o.position, PORT.at); const along = _pw.dot(PORT.n); _pw.addScaledVector(PORT.n, -along);      // (its place across the portal)
      // (10-04: down the portal's own middle line first and only then across to its place (the way across goes as the cube of
      // the way through): the portal in the air is no longer over the place the mouth goes to, and on a straight line from
      // one to the other it came through the portal's plane outside its ring)
      o.position.copy(PORT.at).addScaledVector(_pw, k * k * k).addScaledVector(PORT.n, -0.34 + (along + 0.34) * k); o.updateMatrixWorld(true); o.visible = el > t0 * 0.6;
      if (o === mouth) mouthPortal.visible = _pw.subVectors(mouth.position, PORT.at).dot(PORT.n) > 0.02;      // (its own small portal only once it is through the big one)
    }
    // the camera: back and up a little, the portal and her sole both in the picture
    if (PORT.air) {                                      // (tied: from one side and above, the portal over her soles and her soles both in the picture)
      _pw.copy(AN.mid).lerp(PORT.at, 0.55); cam.l.copy(_pw); _s.copy(AN.Nt).multiplyScalar(0.7).addScaledVector(AN.O, 0.7).normalize(); cam.p.copy(_pw).addScaledVector(_s, 0.98); cam.p.y = Math.max(AN.g + 0.2, cam.p.y); cam.fov = 42;      // (10-04: the whole of the portal, not its lower rim)
    } else { _pw.copy(AN.C).lerp(PORT.at, 0.5); cam.l.copy(_pw); dirOut(-0.95); cam.p.copy(_pw).addScaledVector(_s, 0.52 + 0.5 * Math.max(0, AN.C.distanceTo(PORT.at) - 0.3)); cam.p.y = Math.max(AN.g + 0.2, _pw.y + 0.26); cam.fov = 42; }      // (near and looking down: a bush behind her is not in the way)
    cam.on = true; cam.direct = true;
    // what is said: the first time ever she explains the door (he asked); otherwise a hello when the tool is picked
    if (tk.greet === 'summon') {
      if (tk.said === 0 && el > 0.5) { tk.said = 1; lilSays(LIL.summon[0], 2.6); }
      if (tk.said === 1 && el > 2.3) { tk.said = 2; bubble(pick(LINES.lilith || AN_LIL), 2.2); }
      if (tk.said === 2 && el > 3.3) { tk.said = 3; lilSays(LIL.summon[1], 4.0); lilFirst = false; keep('amirian3d.lilithCalled', '1'); }
    } else if (tk.greet === 'hello' && tk.said === 0 && el > 0.45) { tk.said = 1; lilSays(pick(hands ? LIL.hello : LIL.helloTongue), 2.2); }
    if (tk.intro <= 0) { tk.introLen = 0; tk.shot = -1; if (!hands) PORT.want = 0; }      // (the tongue's small portal floats by itself: the one in the ground closes)
    armsTick();
    react(dt, t, 0, tk.mode);
    return 0;
  }
  // ----- a frame of the take
  function direct(dt, t) {
    let tk = ST.take; if (!tk) return 0;
    if (!ST.frozen) { if (tk.intro > 0) tk.intro = Math.max(0, tk.intro - dt); else tk.t += dt; }
    if (tk.t >= tk.bars * BAR) {
      if (ST.tied) { startTake(other(tk.sd)); tk = ST.take; }      // (the other sole: a cut)
      else { ST.next = other(tk.sd); ST.swapping = true; lower(); return 0; }
    }
    const s = tk.t, sd = tk.sd, sh = shotAt(tk, s);
    if (sh.i !== tk.shot) { tk.shot = sh.i; anchor(sd); console.log('FOOTPLAY shot ' + sh.name); }
    shotPose(sh, s);
    hideTools();
    let act = 0;
    if (tk.introLen > 0) return summon(tk, s, sd, dt, t);
    if (tk.tool === 'fingers') { act = poseHand(handFor(sd, tk.tied), tk, s, sd); swingArm(handFor(sd, tk.tied)); if (tk.two) { act = Math.max(act, poseHand(handFor(other(sd), true), tk.two, s + BAR / 2, other(sd))); swingArm(handFor(other(sd), true)); } }
    else if (tk.tool === 'feather') act = poseFeather(TOOLS.feather.obj, tk, s, sd, t);
    else if (tk.tool === 'tongue') act = poseLick(TOOLS.tongue.obj, tk, s, sd, dt);
    else act = poseBrush(TOOLS.brush.obj, tk, s, sd, dt);
    armsTick();
    const P = react(dt, t, act, tk.mode), b = Math.floor(s / BEAT);
    if (b !== tk.beat) { tk.beat = b; onBeat(tk, b, P); }
    return act;
  }

  // =====================================================================================================
  //                                                every frame
  // =====================================================================================================
  function lift(sd) {
    ST.side = sd; ST.sideNext = other(sd); ST.phase = 'lifting'; ST.pt = 0; ST.quiet = 0; ST.uv = [0.45, 0]; ST.goal = [0.45, 0]; ST.on = false; ST.take = null;
    if (ST.mode !== 'clean') cam.on = false;
    // (a bored idle may be playing this very clip: past the point where her heel starts down again it must start afresh,
    // or she would be held standing flat)
    if (A.debug && A.debug().exclusiveClip === FLASH[sd] && A.clipTime(FLASH[sd]) > 5.0) A.releaseClips();
    if (has(FLASH[sd])) A.playClip(FLASH[sd], 0.35);
    hintNow(); console.log('FOOTPLAY lift ' + sd);
  }
  const still = () => { A.setToeWiggle(0); if (A.setLegShake) { A.setLegShake('L', 0); A.setLegShake('R', 0); } };
  function lower() {
    if (ST.phase === 'idle' || ST.phase === 'lowering' || ST.tied) return;
    if (A.holdClip) A.holdClip(false);
    A.playClip('Idle', 0.45); ST.phase = 'lowering'; ST.pt = 0; ST.on = false; ST.take = null; cam.on = false; ST.shock = 0;
    hideTools(); still(); A.setExpression('smile', 0.2); PORT.want = 0;
  }
  // (the clean-up) where the camera should be for the sole that is up: low, facing it, turned 30 degrees to the foot's outer
  // side (a sandal's back strap runs down the middle of the view), as captures.js shoeFlash has it
  function soleCam(sd, under) {
    const h = mkr(`Marker_Sole_${sd}_Heel`), a = mkr(`Marker_Sole_${sd}_Arch`), o = mkr(`Marker_Sole_${sd}_Out`); if (!h || !a || !o) return false;
    h.getWorldPosition(_p); a.getWorldPosition(_q); o.getWorldPosition(_r);
    _n.subVectors(_r, _q); _n.y = 0; const yaw = anne.rotation.y, sg = sd === 'R' ? -1 : 1;
    if (_n.lengthSq() < 1e-6) _n.set(-Math.sin(yaw), 0, -Math.cos(yaw)); _n.normalize();
    _x.set(Math.cos(yaw) * sg, 0, -Math.sin(yaw) * sg); _x.addScaledVector(_n, -_x.dot(_n)).normalize();
    _n.multiplyScalar(Math.cos(0.52)).addScaledVector(_x, Math.sin(0.52));
    cam.l.lerpVectors(_p, _q, 0.4); cam.p.copy(cam.l).addScaledVector(_n, 0.5); cam.p.y = Math.max(anne.position.y + 0.07, cam.l.y - 0.035);
    cam.l.y -= under; cam.fov = 38; cam.on = true; cam.direct = false;
    return true;
  }
  function update(dt, t) {
    ST.now = t; ST.clock += dt; ST.frame++;
    if (ST.bar && ST.frame % 20 === 0) whoNow();
    bubbleTick(); bubble2Tick(); portalTick(dt, t);
    faceInset(ST.mode === 'clean' || (ST.mode === 'free' && (!!ST.tool || ST.tied)));
    if (!ST.mode) return;
    if (ST.tied) return updTied(dt, t);
    const sd = ST.side;
    if (ST.mode === 'clean' && sd) hudT.innerHTML = `Scrub her <b>${sd === 'L' ? 'left' : 'right'} sole</b> clean: move the mouse over it <span style="opacity:.6">(Esc: that will do)</span>`;
    if (ST.mode === 'free' && ST.phase === 'idle' && ST.tool && ST.bar) {      // a tool is picked: she lifts a foot for it by herself
      const first = !ST.swapping; ST.swapping = false;
      lift(ST.next || ST.sideNext); ST.next = null;
      if (first) bubble(pick(LINES.lift), 2.0);
      return;
    }
    if (ST.phase === 'lifting') {
      ST.pt += dt;
      if (ST.mode === 'clean' && ST.pt > 0.9) soleCam(sd, 0.05);
      if (A.clipTime(FLASH[sd]) >= HOLD_AT[sd] || ST.pt > 6) {
        if (A.holdClip) A.holdClip(true); ST.phase = 'held'; ST.pt = 0; ST.quiet = 0;
        if (ST.mode === 'clean') soleCam(sd, 0.05); else if (ST.tool) startTake(sd); else { lower(); return; }
        hintNow();
      }
    } else if (ST.phase === 'lowering') {
      ST.pt += dt;
      if (ST.pt > 0.75) {
        ST.phase = 'idle'; cam.on = false; ST.T = 0; A.setExpression('neutral', 0);
        if (ST.mode === 'free') {
          if (ST.tool) {      // (the other foot next; now and then in another pair of shoes)
            if (ST.playT > ST.shoesAt && env.newShoes) { ST.playT = 0; ST.shoesAt = 40 + rng() * 30; if (env.newShoes()) bubble(pick(LINES.shoes), 2.4); }
            else if (ST.swapping) bubble(pick(LINES.swap), 2.0);
          } else { A.releaseClips(); ST.side = null; ST.next = null; ST.swapping = false; hintNow(); }
        }
      }
    }
    if (ST.phase !== 'held') return;
    // ----- her sole is up
    ST.pt += dt;
    if (ST.mode !== 'clean') { direct(dt, t); return; }
    // ----- the clean-up (the mouse): a sole done, the other one; both done, over
    const hit = track(dt, [sd]), act = brushAtMouse(dt, t, hit), P = react(dt, t, act, 'brush'); chatter(t, P, 'brush');
    const C = ST.clean, done = 1 - ST.left, MKs = A._marks && A._marks(); if (MKs && MKs.kind) MKs.left = Math.max(MKs.left, 30);      // (they do not fade away by themselves while she is being scrubbed)
    hudB.style.width = Math.round(100 * clamp((C.i + clamp(done / 0.95, 0, 1)) / C.sides.length, 0, 1)) + '%';
    if (ST.left < 0.14) C.near = (C.near || 0) + dt; else C.near = 0;      // (the last few specks: two seconds of trying is enough)
    if (ST.left < 0.05 || C.near > 2 || C.skip || (C.auto && ST.pt > C.auto)) {
      C.near = 0; C.skip = false;
      A.scrubMarks(sd, _c, 9, 9); C.i++;                     // (whatever is left of this one goes)
      if (C.i < C.sides.length) { bubble(pick(LINES.cleanSwitch), 2.2); ST.next = C.sides[C.i]; ST.left = 1; lowerThen(); }
      else finishClean();
    } else if (C.auto) { ST.mouseIn = true; const a = ST.pt * 5.2; A.solePoint(sd, 0.5 + 0.42 * Math.sin(a * 0.31), 0.6 * Math.sin(a), _q, _n); _q.project(camera); ndc.set(_q.x, _q.y); }      // (tests: the brush goes by itself)
  }
  // tied, on her front: both soles there for the tools; she squirms when it gets too much
  function updTied(dt, t) {
    if (ST.pegIn > 0 && --ST.pegIn === 0) ties.placePeg();
    ties.update();
    if (ST.tool && !ST.take) startTake(ST.side || 'R');
    if (ST.take) direct(dt, t);
    else {      // (nothing at her soles: the picture holds on them, breathing in and out a little)
      if (!ST.tiedAnch) { anchor(ST.side || 'R'); ST.tiedAnch = true; }
      shotPose({ name: 'both', q: 0.5 + 0.5 * Math.sin(ST.clock * 0.5) }, ST.clock); hideTools(); react(dt, t, 0, 'feather');
    }
    const want = ST.T > 0.3 ? 'StuckFlatTickled' : ST.T < 0.14 ? 'StuckFlat' : ST.clip;
    if (want !== ST.clip && has(want)) { ST.clip = want; A.playClip(want, 0.4); }
  }
  function lowerThen() { if (A.holdClip) A.holdClip(false); A.playClip('Idle', 0.45); ST.phase = 'between'; ST.pt = 0; hideTools(); still(); setTimeout(() => { if (ST.mode === 'clean' && ST.phase === 'between') { const n = ST.next; ST.next = null; lift(n); } }, 900 / TS()); }
  function finishClean() {
    const C = ST.clean; ST.clean = null; hudEl.style.display = 'none';
    if (A.holdClip) A.holdClip(false); A.playClip('Idle', 0.45); hideTools(); still();
    ST.mode = ST.bar ? 'free' : null; ST.phase = 'idle'; ST.side = null; ST.T = 0; cam.on = false; ST.tool = null; showTool(); hintNow();
    if (A.soleMarks) A.soleMarks(null);
    bubble(pick(LINES.cleanDone), 2.8); console.log('FOOTPLAY clean done');
    setTimeout(() => C.resolve(true), 700 / TS());
  }

  // =====================================================================================================
  //                                       tied up (the foot cam's "Tie her up")
  // =====================================================================================================
  const props = [];                                  // her shoes, beside her while she is tied
  const _bx = new THREE.Box3();
  function shoesBeside(on) {
    if (!on) { for (const p of props) p.visible = false; return; }
    if (!A.heelProp) return;
    if (!props.length) for (const left of [false, true]) { const g = new THREE.Group(), s = A.heelProp.clone(true); s.scale.set(left ? -1 : 1, 1, 1); s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); g.add(s); scene.add(g); props.push(g); }
    A.heelProp.updateMatrixWorld(true); _bx.setFromObject(A.heelProp, true);
    const yaw = anne.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;      // (her right)
    const bh = A.body ? A.body().h : 1;                  // (batch 23: her shoes are the size of her feet)
    props.forEach((g, i) => { g.scale.setScalar(bh); g.position.set(anne.position.x + rx * (0.5 + 0.13 * i) - fx * 0.25, anne.position.y + (0.002 - _bx.min.y) * bh, anne.position.z + rz * (0.5 + 0.13 * i) - fz * 0.25); g.rotation.set(0, yaw + (i ? 0.5 : -0.3), 0); g.visible = true; });
  }
  const fade = (to) => new Promise((res) => { fadeEl.style.opacity = to; setTimeout(res, 280); });
  // Is the clip she plays still one of ours (a foot up, down again, tied, or a bored idle we took over)? A scene that began
  // this very frame (a roaming creature has caught her, say) has played its own first clip already: that one is not let go.
  const MINE = new Set([FLASH.L, FLASH.R, 'Idle', 'StuckFlat', 'StuckFlatTickled', 'HeldProne', 'IdleLook', 'IdleCross', 'IdleCrossR']);
  const clipIsOurs = () => { const cur = A.debug ? A.debug().exclusiveClip : null; return !cur || MINE.has(cur); };
  function tieNow(on, keepClip) {
    hideTools(); still(); ST.T = 0; ST.next = null; ST.take = null; ST.tiedAnch = false; ST.swapping = false; ST.shock = 0; PORT.want = 0;
    if (on) {
      if (A.holdClip) A.holdClip(false);
      ST.tied = true; ST.phase = 'held'; ST.side = 'R'; ST.quiet = 0;
      A.setHeelsWorn(false); shoesBeside(true);
      ST.clip = has('StuckFlat') ? 'StuckFlat' : 'HeldProne'; A.playClip(ST.clip, 0);
      ties.look('rope'); ties.set({ on: true, k: 1, knot: 1, toe: 1, peg: 1, taut: 1 }); ST.pegIn = 3;
      A.setExpression('embarrassed', 0.5);
      if (ST.tool) ST.firstFor = keyOf(ST.tool);
    } else {
      ties.set({ on: false }); ties.update(); shoesBeside(false);
      A.setHeelsWorn(true); if (!keepClip) { A.releaseClips(); A.setExpression('neutral', 0); }
      ST.tied = false; ST.phase = 'idle'; ST.side = null; ST.clip = ''; cam.on = false;
    }
    bTie.textContent = ST.tied ? 'Untie her' : 'Tie her up'; bTie.classList.toggle('on', ST.tied); hintNow();
    console.log('FOOTPLAY ' + (on ? 'tied' : 'untied'));
  }
  async function tie(on) {
    if (ST.tying || on === ST.tied || ST.mode !== 'free') return;
    const gen = ++ST.tieGen;                         // (stop() and clean() move this on: a tie still fading in is then called off)
    ST.tying = true; await fade(1);
    if (gen !== ST.tieGen || ST.mode !== 'free') { fadeEl.style.opacity = 0; ST.tying = false; return; }      // (a scene began meanwhile, or she walked off)
    tieNow(on);
    await new Promise((r) => setTimeout(r, on ? 260 : 620));      // (untied: she is back on her feet before the picture comes back)
    await fade(0); ST.tying = false;
    if (gen === ST.tieGen && on === ST.tied) bubble(pick(on ? LINES.tie : LINES.untie), 2.8);
  }

  // =====================================================================================================
  //                                                 the host's calls
  // =====================================================================================================
  // The clean-up. o: { first: 'L' | 'R' (the sole that is up already, its clip held: the sole flash), auto (tests: seconds a
  // sole takes by itself) }. Resolves when both soles are clean and she stands again (Idle).
  function clean(o = {}) {
    return new Promise((resolve) => {
      ST.tieGen++; ST.shock = 0; PORT.want = 0;
      if (ST.tied) tieNow(false, !clipIsOurs());
      const first = o.first === 'R' ? 'R' : 'L', sides = [first, other(first)];
      ST.mode = 'clean'; ST.clean = { sides, i: 0, resolve, auto: o.auto || 0 }; ST.left = 1; ST.T = 0; ST.quiet = 0; ST.next = null; ST.take = null; ST.swapping = false;
      ST.tool = 'brush'; showTool(); hideTools(); hudEl.style.display = 'block'; hudB.style.width = '0%';
      bubble(pick(LINES.cleanStart), 2.6); console.log('FOOTPLAY clean start ' + first);
      if (o.held) { ST.side = first; ST.phase = 'held'; ST.pt = 0; ST.uv = [0.45, 0]; ST.goal = [0.45, 0]; soleCam(first, 0.05); }
      else lift(first);
    });
  }
  // the foot cam's side bar: shown while the foot cam is on and nothing else is going on
  function setBar(on) {
    if (on === ST.bar) return;
    ST.bar = on; sideEl.style.display = on ? 'flex' : 'none'; if (on) whoNow();
    // (10-05, review: there may be two of these, Anne's and Boudicca's) What one of them said does not stay up over the
    // other's picture; and Lilith's nail colour and her way with her fingers, which the two share, are taken again
    // from where they are kept whenever this one's panel comes up.
    if (!on) { BB.on = B2.on = false; bubbleEl.style.visibility = bubble2El.style.visibility = 'hidden'; }
    else { const n = stored('amirian3d.handnail', ST.nail); if (n !== ST.nail && /^#[0-9a-f]{6}$/i.test(n)) setNail(n); const m = stored('amirian3d.handmode', ST.fmode); if (m !== ST.fmode && (m === 'tease' || m === 'tickle')) setFingers(m); }
    if (on && !ST.mode) { ST.mode = 'free'; hintNow(); }
    if (!on && ST.mode === 'free') stop();
  }
  // everything down at once (she walks off, a scene starts, the foot cam goes off)
  function stop() {
    if (ST.mode === 'clean') return;
    const ours = clipIsOurs(); ST.tieGen++; ST.shock = 0;
    if (ST.tied) { tieNow(false, !ours); fadeEl.style.opacity = 0; }
    // (whenever it was busy, not only with a foot up: between two takes her clip is still ours while the phase is idle)
    else if ((ST.phase !== 'idle' || ST.tool) && ours) { if (A.holdClip) A.holdClip(false); A.releaseClips(); A.setExpression('neutral', 0); }
    hideTools(); still(); PORT.want = 0;
    ST.phase = 'idle'; ST.side = null; ST.next = null; ST.T = 0; ST.take = null; ST.tool = null; ST.firstFor = null; ST.swapping = false; cam.on = false; ST.mode = ST.bar ? 'free' : null;
    showTool(); hintNow();
  }
  // (tests) how smoothly the tool of the take goes: its pose is taken every 1/120 s over `sec` seconds of the take's time
  // (her foot as it is now), and the largest speed and acceleration of its two points are given (a = its hand or root,
  // b = what touches)
  function probe(sec = BAR, h = 1 / 120) {
    const tk = ST.take; if (!tk) return null;
    const run = (s) => { hideTools(); if (tk.tool === 'fingers') poseHand(handFor(tk.sd, tk.tied), tk, s, tk.sd); else if (tk.tool === 'feather') poseFeather(TOOLS.feather.obj, tk, s, tk.sd, s); else if (tk.tool === 'tongue') poseLick(TOOLS.tongue.obj, tk, s, tk.sd, 0); else poseBrush(TOOLS.brush.obj, tk, s, tk.sd, 0); };
    const out = { a: { v: 0, acc: 0 }, b: { v: 0, acc: 0 }, nailLo: 9, nailHi: -9, joint: 9 }, prev = { a: [V3(), V3()], b: [V3(), V3()] }, s0 = tk.t, d = V3();
    const n = Math.round(sec / h);
    for (let i = 0; i < n; i++) {
      run(s0 + i * h);
      for (const k of ['a', 'b']) {
        const p = PT[k], [p1, p2] = prev[k];
        if (i > 0) out[k].v = Math.max(out[k].v, d.subVectors(p, p1).length() / h);
        if (i > 1) { const ac = d.copy(p).addScaledVector(p1, -2).add(p2).length() / (h * h); if (ac > out[k].acc) { out[k].acc = ac; out[k].at = +((s0 + i * h) / BEAT).toFixed(2); } }
        p2.copy(p1); p1.copy(p);
      }
      if (tk.tool === 'fingers') { if (ST.nailLo < out.nailLo) { out.nailLo = ST.nailLo; out.at = +((s0 + i * h) / BEAT).toFixed(2); } out.nailHi = Math.max(out.nailHi, ST.nailHi); out.joint = Math.min(out.joint, ST.joint); }
    }
    run(s0);
    return { v: [+out.a.v.toFixed(3), +out.b.v.toFixed(3)], acc: [+out.a.acc.toFixed(2), +out.b.acc.toFixed(2)], nailMm: [+(out.nailLo * 1000).toFixed(2), +(out.nailHi * 1000).toFixed(2)], jointMm: +(out.joint * 1000).toFixed(1), lowAtBeat: out.at, accAtBeat: [out.a.at, out.b.at] };
  }
  try { soleOf('L'); soleOf('R'); } catch (e) { console.warn('[footplay] sole surface', e); }      // (both soles sampled while the game loads: a few milliseconds each, not a hitch at the first touch)
  return {
    update, clean, setBar, stop, setTool, setFingers, setNail, tie,
    busy: () => ST.mode === 'clean' || ST.tied || ST.tying || (ST.mode === 'free' && (ST.phase !== 'idle' || !!ST.tool)),
    tied: () => ST.tied || ST.tying,
    wantsPointer: () => ST.mode === 'clean',
    camGoal: () => (cam.on ? cam : null),
    state: () => { const tk = ST.take; return { mode: ST.mode, tool: ST.tool, fmode: ST.fmode, side: ST.side, phase: ST.phase, tied: ST.tied, T: +ST.T.toFixed(2), left: +ST.left.toFixed(3), on: ST.on, clip: ST.clip,
      take: tk ? { n: tk.n, s: +tk.t.toFixed(2), bar: Math.floor(tk.t / BAR), beat: +(tk.t / BEAT).toFixed(2), shot: shotAt(tk, tk.t).name, two: !!tk.two } : null,
      nailMm: [+(ST.nailLo * 1000).toFixed(2), +(ST.nailHi * 1000).toFixed(2)], jointMm: +(ST.joint * 1000).toFixed(1), hands: [HANDS.R.userData.real, HANDS.L.userData.real] }; },
    tools: Object.keys(TOOLS), BEAT, BAR,
    _playT: (x) => { ST.playT = x; },
    _point: (u, v, sd) => { const s = sd || ST.side; if (!s) return; ST.mouseIn = true; A.solePoint(s, u, v, _q, _n); _q.project(camera); ndc.set(_q.x, _q.y); },      // (tests: the pointer over that point of a sole)
    _seek: (s, freeze = true) => { if (ST.take) { ST.take.t = s; ST.take.beat = Math.floor(s / BEAT); ST.take.intro = ST.take.introLen = 0; ST.take.shot = -1; } ST.frozen = !!freeze; },      // (tests: the take at that time, held there)
    _freeze: (on) => { ST.frozen = !!on; },
    _intro: (el) => { const tk = ST.take; if (tk && tk.introLen > 0) tk.intro = Math.max(0.001, tk.introLen - el); return tk ? tk.introLen : 0; },      // (tests: Lilith's entrance at that many seconds into it; freeze first)
    _seed: (n) => { ST.seed = n | 0; rng = mulberry32(n | 0); },
    _probe: probe, _worst: (reset) => { const w = ST.worst; if (reset) ST.worst = { h: 0 }; return w; },
    _series: (b0, b1, n = 40) => { const tk = ST.take, out = []; if (!tk || tk.tool !== 'fingers') return out; for (let i = 0; i <= n; i++) { const bt = b0 + (b1 - b0) * i / n; hideTools(); poseHand(handFor(tk.sd, tk.tied), tk, bt * BEAT, tk.sd); out.push([+bt.toFixed(3), ...ST.c1s.map((x) => +x.toFixed(2)), ...ST.hs.map((x) => +(x * 1000).toFixed(1))]); } return out; },
    // (tests) Lilith's arms: where each elbow and wrist is, how far the elbow is bent (her upper arm comes from the portal) and
    // how far the hand is bent to its forearm, in degrees; and the portal
    _arms: () => { const r = (v) => v.toArray().map((x) => +x.toFixed(3)), out = { port: { at: r(PORT.at), n: r(PORT.n), k: +PORT.k.toFixed(2), air: PORT.air, two: PORT.two } };
      for (const hs of ['R', 'L']) { const h = HANDS[hs], m = ARMS[hs], H = h.userData; if (!h.visible || !H.real) continue;
        const e = H.elbow.getWorldPosition(V3()), w = H.hand.getWorldPosition(V3()), k = H.fingers[1].root.getWorldPosition(V3());
        const up = V3(0, 1, 0).applyQuaternion(m.quaternion), fo = w.clone().sub(e).normalize(), ha = k.clone().sub(w).normalize();
        out[hs] = { elbow: r(e), wrist: r(w), elbowDeg: +(up.angleTo(fo) * 180 / PI).toFixed(0), wristDeg: +(fo.angleTo(ha) * 180 / PI).toFixed(0), fore: r(fo), upper: r(up), arm: m.visible, len: +m.scale.y.toFixed(3) }; }
      return out; },
    _diag: () => {      // (tests) the sole's surface against her skin, and each nail of the hand at work
      const tk = ST.take, sd = tk ? tk.sd : 'L', S = soleOf(sd), out = { sd, surf: [], fingers: [] }; if (!S) return out;
      for (const [u, v] of [[0.1, 0], [0.3, 0], [0.5, 0], [0.5, 0.6], [0.5, -0.6], [0.7, 0], [0.9, 0], [0.9, 0.5]]) {
        soleAt(sd, u, v, _p, _q, true); A.solePoint(sd, u, v, _r, _s); const h = heightOver(sd, _r), uu = _uvh.u, vv = _uvh.v;
        out.surf.push([u, v, +(_p.distanceTo(_r) * 1000).toFixed(1), +(h * 1000).toFixed(1), +uu.toFixed(2), +vv.toFixed(2), +_q.dot(_s).toFixed(3)]);
      }
      if (tk && tk.tool === 'fingers') { const o = handFor(sd, tk.tied), H = o.userData; out.hand = H.side; out.T0 = nominal(o, tk.mode === 'tickle' ? 'tickle' : 'tease', sd).toArray().map((x) => +x.toFixed(4));
        for (const f of [...H.fingers, H.thumb]) { f.tip.getWorldPosition(_tp); const h = heightOver(sd, _tp); out.fingers.push([f.k, +(h * 1000).toFixed(1), +_uvh.u.toFixed(2), +_uvh.v.toFixed(2)]); }
        // (the nails' places in the hand's own frame, fingers drawn together or not)
        out.tips = {}; for (const sp of [0, 0.09]) out.tips[sp] = H.fingers.map((f) => { f.curl(0.1, 0.62, 0.4, sp); o.worldToLocal(f.tip.getWorldPosition(_tp)); return [+(_tp.x * 1000).toFixed(0), +(_tp.z * 1000).toFixed(0)]; }); }
      return out;
    },
  };
}
