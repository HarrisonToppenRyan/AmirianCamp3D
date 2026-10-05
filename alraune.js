// alraune.js: Alraune, queen of the Ivy Maidens, as she stands in her great flower (actors.js makeBloom gives the
// flower and the `seat` she rises from). Built in code like her maidens, after her 2D portraits (faces/alraune.png):
// light green skin, heavy-lidded red eyes on black, lilac eye shadow, red lips, a great mane of wavy red hair parted
// on her left and swept across her brow to the pink lily behind her right ear, pale tendrils hanging from it.
// The 2D figure is unclothed; here she wears a gown of leaves from the flower up to her collar bones.
//
//   createAlraune({ THREE, K, seat }) -> { obj, headPos(out), mouthPos(out), setExpression(name), setTalking(on), playClip(name), reach(side, fn), update(dt, t) }
//   expressions   smile | smug | happy | surprised | laugh | pout      (her portraits 0, 2, 3, 8, 10, 4)
//   clips         Rise | Idle | Delight | Command | Lean                (poses of her arms and trunk, eased in code)
//   reach('L' | 'R', fn)   that hand's fingertips go where fn(point, dir, palm) says each frame (world space: the point,
//                 the way her fingers point, the way her palm faces); null gives the arm back to the pose

export async function createAlraune({ THREE, K, seat }) {
  const { V3, col, mix } = K, PI = Math.PI, TAU = PI * 2;
  const clamp = THREE.MathUtils.clamp;
  const SKIN = col(0.44, 0.63, 0.25), SKIN2 = col(0.25, 0.4, 0.15);       // (linear; MAT.plant shows them at about 2.5 x in full sun: see SKIN_K)
  const SKIN_K = 0.44, sk = (c) => c.clone().multiplyScalar(SKIN_K);
  const HAIR0 = col(0.06, 0.005, 0.005), HAIR1 = col(0.2, 0.02, 0.014), HAIR2 = col(0.36, 0.075, 0.045);
  const LEAF0 = col(0.02, 0.085, 0.03), LEAF1 = col(0.05, 0.19, 0.055), LEAF2 = col(0.1, 0.3, 0.07);
  const PETAL0 = col(0.3, 0.09, 0.2), PETAL1 = col(0.42, 0.2, 0.31), PETAL2 = col(0.5, 0.36, 0.43);
  const body = new THREE.Group(); body.name = 'Alraune'; seat.add(body); body.scale.setScalar(1.12);

  // ---------- her face, painted as her portraits show it ----------
  const N = 512, C0 = N / 2;
  function face(e) {
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d');
    x.fillStyle = '#b4d28a'; x.fillRect(0, 0, N, N);
    // the face rounds away into shade at its edge; the hair shades the brow; a soft shade under the lower lip and the chin
    let g = x.createRadialGradient(C0, 290, 110, C0, 280, 300); g.addColorStop(0, 'rgba(136,168,104,0)'); g.addColorStop(0.55, 'rgba(136,168,104,0.45)'); g.addColorStop(1, 'rgba(88,120,72,0.95)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
    g = x.createLinearGradient(0, 40, 0, 190); g.addColorStop(0, 'rgba(70,100,60,0.85)'); g.addColorStop(1, 'rgba(110,150,90,0)'); x.fillStyle = g; x.fillRect(0, 0, N, 200);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const lids = { smile: 0.78, smug: 0.5, happy: 0.56, surprised: 1.12, laugh: 0, pout: 0.8 }[e];
    const brow = { smile: [0, 0], smug: [-4, 0.05], happy: [-7, -0.04], surprised: [-16, -0.12], laugh: [-10, -0.1], pout: [7, 0.2] }[e];      // [lift (px, - = up), tilt (inner end down +)]
    for (const sx of [-1, 1]) {
      // cheek: a warmer flush under the eye, and the two small lights her portraits put there
      g = x.createRadialGradient(C0 + sx * 112, 304, 4, C0 + sx * 112, 304, 58); g.addColorStop(0, 'rgba(196,128,112,0.34)'); g.addColorStop(1, 'rgba(196,128,112,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(C0 + sx * 112, 304, 60, 36, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(236,250,206,0.85)'; x.beginPath(); x.arc(C0 + sx * 150, 272, 3.2, 0, TAU); x.fill(); x.beginPath(); x.arc(C0 + sx * 141, 286, 2.4, 0, TAU); x.fill();
      x.save(); x.translate(C0 + sx * 104, 236); x.scale(sx * 1.16, 1.16);           // (drawn for her left eye; mirrored for the right)
      // lilac eye shadow from the lid up to the brow, winged outwards
      g = x.createLinearGradient(0, -52, 0, 6); g.addColorStop(0, 'rgba(136,104,152,0)'); g.addColorStop(0.55, 'rgba(136,104,152,0.62)'); g.addColorStop(1, 'rgba(96,60,110,0.8)'); x.fillStyle = g;
      x.beginPath(); x.moveTo(-52, 8); x.bezierCurveTo(-34, -40, 30, -50, 74, -34); x.bezierCurveTo(52, -12, 20, -4, -52, 8); x.fill();
      if (lids > 0) {
        const up = -24 * Math.min(1, lids), lo = 12;                          // how high the upper lid stands
        const eye = () => { x.beginPath(); x.moveTo(-50, 8); x.bezierCurveTo(-30, up * 1.05 - 2, 22, up * 1.2 - 6, 56, -16); x.bezierCurveTo(34, lo + 4, -8, lo + 8, -50, 8); x.closePath(); };
        eye(); x.fillStyle = '#120809'; x.fill();
        x.save(); eye(); x.clip();
        g = x.createRadialGradient(-2, -3, 2, -2, -3, 21); g.addColorStop(0, '#ff5a44'); g.addColorStop(0.5, '#d42020'); g.addColorStop(1, '#5a0808'); x.fillStyle = g; x.beginPath(); x.arc(-2, -3, 20, 0, TAU); x.fill();
        x.fillStyle = '#0c0405'; x.beginPath(); x.arc(-2, -3, 7.5, 0, TAU); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(-10, -11, 4.6, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,220,210,0.7)'; x.beginPath(); x.arc(6, 5, 2.4, 0, TAU); x.fill();
        x.fillStyle = 'rgba(8,4,6,0.55)'; x.fillRect(-56, up * 1.3 - 10, 120, 12);                 // the lid's own shadow on the eye
        x.restore();
        // lashes: a heavy upper line with a wing, a fine lower one
        x.strokeStyle = '#0c0507'; x.lineWidth = 8; x.beginPath(); x.moveTo(-51, 8); x.bezierCurveTo(-30, up * 1.05 - 3, 22, up * 1.2 - 7, 58, -17); x.stroke();
        x.lineWidth = 5; x.beginPath(); x.moveTo(52, -15); x.quadraticCurveTo(66, -22, 76, -34); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(44, -19); x.quadraticCurveTo(54, -30, 58, -40); x.stroke();
        x.lineWidth = 2.6; x.beginPath(); x.moveTo(-48, 9); x.bezierCurveTo(-8, lo + 9, 34, lo + 5, 56, -15); x.stroke();
        x.strokeStyle = 'rgba(60,84,48,0.7)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-44, up - 12); x.bezierCurveTo(-18, up * 1.5 - 14, 26, up * 1.6 - 16, 56, -30); x.stroke();      // the crease of the lid
      } else {                                                                  // laughing: both eyes shut, two happy arcs
        x.strokeStyle = '#0c0507'; x.lineWidth = 8; x.beginPath(); x.moveTo(-50, 2); x.bezierCurveTo(-24, -22, 24, -24, 56, -6); x.stroke();
        x.lineWidth = 5; x.beginPath(); x.moveTo(50, -8); x.quadraticCurveTo(64, -12, 74, -22); x.stroke();
        x.lineWidth = 2.5; for (const k of [-0.5, 0, 0.5]) { x.beginPath(); x.moveTo(k * 50, -16 + Math.abs(k) * 10); x.lineTo(k * 62, -4 + Math.abs(k) * 12); x.stroke(); }
      }
      // brow: red-brown, thick at the inner end, arched, thinning to a point
      x.save(); x.translate(-6, -58 + brow[0]); x.rotate(-brow[1]);
      x.fillStyle = '#8a3a22'; x.beginPath(); x.moveTo(-50, 8); x.bezierCurveTo(-20, -16, 30, -22, 76, -6); x.bezierCurveTo(34, -12, -14, -4, -46, 17); x.closePath(); x.fill();
      x.restore();
      x.restore();
    }
    // nose: a shade down one side of the bridge, the tip's own shadow, a small light on the tip
    x.strokeStyle = 'rgba(104,140,84,0.9)'; x.lineWidth = 5; x.beginPath(); x.moveTo(266, 244); x.quadraticCurveTo(274, 290, 262, 316); x.stroke();
    x.strokeStyle = 'rgba(72,104,60,0.95)'; x.lineWidth = 4; x.beginPath(); x.moveTo(240, 322); x.quadraticCurveTo(256, 334, 272, 322); x.stroke();
    x.fillStyle = 'rgba(236,250,206,0.5)'; x.beginPath(); x.ellipse(252, 304, 5, 8, 0, 0, TAU); x.fill();
    // mouth
    const DARK = '#7a0606', RED = '#c41414', LIGHT = '#f0685e', my = 0;
    x.save(); x.translate(C0, 374); x.scale(1.2, 1.2); x.translate(-C0, 0);      // (the mouth is drawn about (C0, 0), a fifth larger than first laid out)
    const lipsShut = (w, curve, drop = 0) => {                                  // closed lips: a cupid's bow over a fuller lower lip
      x.fillStyle = DARK; x.beginPath(); x.moveTo(C0 - w, my - curve); x.quadraticCurveTo(C0 - w * 0.4, my - 13, C0, my - 6); x.quadraticCurveTo(C0 + w * 0.4, my - 13, C0 + w, my - curve); x.quadraticCurveTo(C0, my + 6 + drop, C0 - w, my - curve); x.fill();
      x.fillStyle = RED; x.beginPath(); x.moveTo(C0 - w * 0.88, my - curve + 3); x.quadraticCurveTo(C0, my + 30 + drop, C0 + w * 0.88, my - curve + 3); x.quadraticCurveTo(C0, my + 8 + drop, C0 - w * 0.88, my - curve + 3); x.fill();
      x.fillStyle = LIGHT; x.beginPath(); x.ellipse(C0 + 6, my + 13 + drop * 0.7, w * 0.3, 3.6, 0, 0, TAU); x.fill();
      x.strokeStyle = '#3a0303'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(C0 - w - 3, my - curve - 1); x.quadraticCurveTo(C0, my + 6 + drop, C0 + w + 3, my - curve - 1); x.stroke();
    };
    const lipsOpen = (w, h, curve, teeth, tongue) => {                          // an open smile: w half width, h how far it opens
      x.fillStyle = DARK; x.beginPath(); x.moveTo(C0 - w, my - curve); x.quadraticCurveTo(C0 - w * 0.4, my - 13, C0, my - 7); x.quadraticCurveTo(C0 + w * 0.4, my - 13, C0 + w, my - curve); x.quadraticCurveTo(C0, my + h + 20, C0 - w, my - curve); x.fill();
      x.fillStyle = '#2a0406'; x.beginPath(); x.moveTo(C0 - w * 0.86, my - curve + 3); x.quadraticCurveTo(C0, my - 2, C0 + w * 0.86, my - curve + 3); x.quadraticCurveTo(C0, my + h + 6, C0 - w * 0.86, my - curve + 3); x.fill();
      if (tongue) { x.fillStyle = '#d0504a'; x.beginPath(); x.ellipse(C0, my + h * 0.62, w * 0.42, h * 0.3, 0, 0, TAU); x.fill(); }
      if (teeth) { x.fillStyle = '#f8f4ee'; x.beginPath(); x.moveTo(C0 - w * 0.8, my - curve + 3); x.quadraticCurveTo(C0, my - 2, C0 + w * 0.8, my - curve + 3); x.quadraticCurveTo(C0, my + h * teeth, C0 - w * 0.8, my - curve + 3); x.fill(); }
      x.fillStyle = RED; x.beginPath(); x.moveTo(C0 - w * 0.8, my + h * 0.42 - curve * 0.3); x.quadraticCurveTo(C0, my + h + 24, C0 + w * 0.8, my + h * 0.42 - curve * 0.3); x.quadraticCurveTo(C0, my + h + 6, C0 - w * 0.8, my + h * 0.42 - curve * 0.3); x.fill();
      x.fillStyle = LIGHT; x.beginPath(); x.ellipse(C0 + 6, my + h + 12, w * 0.26, 3.4, 0, 0, TAU); x.fill();
    };
    if (e === 'smile') lipsShut(44, 8);
    else if (e === 'smug') lipsOpen(50, 14, 12, 0.75, false);
    else if (e === 'happy') lipsOpen(58, 20, 15, 0.7, false);
    else if (e === 'laugh') lipsOpen(60, 44, 14, 0.42, true);
    else if (e === 'surprised') { x.fillStyle = DARK; x.beginPath(); x.ellipse(C0, my + 4, 22, 20, 0, 0, TAU); x.fill(); x.fillStyle = '#2a0406'; x.beginPath(); x.ellipse(C0, my + 5, 13, 12, 0, 0, TAU); x.fill(); x.fillStyle = LIGHT; x.beginPath(); x.ellipse(C0 + 5, my + 19, 8, 2.6, 0, 0, TAU); x.fill(); }
    else lipsShut(32, -5, -3);                                                  // pout
    x.restore();
    g = x.createRadialGradient(C0, 428, 4, C0, 428, 50); g.addColorStop(0, 'rgba(104,140,84,0.5)'); g.addColorStop(1, 'rgba(104,140,84,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(C0, 428, 54, 16, 0, 0, TAU); x.fill();
    x.fillStyle = '#3a0808'; x.fillRect(0, N - 22, 22, 22);                    // (the back of the head takes this corner's colour: it is under her hair)
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const FACES = {}; for (const e of ['smile', 'smug', 'happy', 'surprised', 'laugh', 'pout']) FACES[e] = face(e);

  // her head: an egg with a small chin, the nose, the brow and the lips raised a little, the eyes set back; the face
  // texture is laid on from the front before the shaping, so the features sit on their own forms
  const R = 0.105;
  function headGeo() {
    const g = new THREE.SphereGeometry(R, 44, 34), P = g.attributes.position, uv = g.attributes.uv;
    const bump = (x, v, cx, cv, sx, sv) => Math.exp(-(((x - cx) / sx) ** 2) - (((v - cv) / sv) ** 2));
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const v = y / R, u = x / R, front = z > -R * 0.2;
      uv.setXY(i, front ? 0.5 + u * 0.5 : 0.02, front ? 0.5 + v * 0.5 : 0.02);
      x *= v > 0 ? 0.9 : 0.9 - 0.4 * Math.pow(-v, 1.7);
      z *= (z > 0 ? 0.84 : 0.92) * (v < 0 ? 1 - 0.2 * v * v : 1);
      if (z > 0) {
        z += R * (0.10 * bump(u, v, 0, -0.2, 0.11, 0.1) + 0.05 * bump(u, v, 0, -0.04, 0.07, 0.2)            // tip and bridge of the nose
          + 0.035 * bump(u, v, 0, -0.47, 0.2, 0.07) + 0.03 * bump(u, v, 0, -0.76, 0.2, 0.14)                 // lips, chin
          - 0.035 * (bump(u, v, 0.39, 0.09, 0.17, 0.09) + bump(u, v, -0.39, 0.09, 0.17, 0.09))               // the eyes sit back
          + 0.02 * (bump(u, v, 0.4, 0.3, 0.22, 0.07) + bump(u, v, -0.4, 0.3, 0.22, 0.07))                    // brow
          + 0.025 * (bump(u, v, 0.45, -0.2, 0.2, 0.16) + bump(u, v, -0.45, -0.2, 0.2, 0.16)));               // cheeks
        if (v < -0.3) z += R * 0.1 * (-v - 0.3);
      }
      P.setXYZ(i, x, y * 1.12, z);
    }
    g.computeVertexNormals(); return g;
  }

  // ---------- trunk: bare shoulders and arms, a gown of leaves from the flower up to her collar bones ----------
  const parts = [], S1 = sk(SKIN), S2 = sk(SKIN2);
  // (lathe profiles are [radius, height]; the trunk is then flattened front to back)
  const flat = (geo, k) => { geo.scale(1, 1, k); return geo; };
  parts.push(flat(K.lathe([[0.16, -0.12], [0.15, 0.06], [0.118, 0.2], [0.105, 0.27], [0.128, 0.36], [0.152, 0.45], [0.16, 0.5], [0.15, 0.56], [0.105, 0.605], [0.056, 0.63], [0.047, 0.66], [0.045, 0.74]],
    (p) => (p.y > 0.505 ? mix(S2, S1, clamp((p.y - 0.5) * 9, 0, 1)) : mix(LEAF0, LEAF1, clamp(p.y * 2.2, 0, 1))), 28), 0.74));
  for (const sx of [-1, 1]) {                         // shoulders, and the bust under the leaves
    parts.push(K.place(K.ball(0.052, S1, 1.05, 0.9, 0.95, 14), V3(sx * 0.158, 0.565, 0)));
    parts.push(K.place(K.ball(0.062, LEAF1, 1, 0.95, 0.9, 14), V3(sx * 0.066, 0.44, 0.072)));
  }
  const rr = K.rng(77);
  // the gown: rows of overlapping leaves, their tips up over her bust, larger ones flaring into the flower below
  for (let row = 0; row < 4; row++) {
    const n = [11, 12, 12, 14][row], y = [0.5, 0.4, 0.29, 0.16][row], rad = [0.15, 0.16, 0.128, 0.14][row], L = [0.11, 0.13, 0.15, 0.2][row];
    for (let i = 0; i < n; i++) {
      const a = (i + (row % 2) * 0.5) / n * TAU, cx = Math.sin(a), cz = Math.cos(a), bust = row === 0 ? 0.02 * Math.max(0, cz) : row === 1 ? 0.035 * Math.max(0, cz) * (1 - 0.6 * Math.abs(cx)) : 0;
      const at = V3(cx * (rad + 0.004), y - L * 0.72, cz * (rad * 0.74 + bust + 0.006));
      const dir = row < 3 ? V3(cx * 0.16, 1, cz * 0.16 + (row === 1 ? 0.18 * Math.max(0, cz) : 0)) : V3(cx * 0.8, -0.55, cz * 0.8);
      const g = K.leaf(L * rr.r(0.92, 1.1), L * 0.56, row < 3 ? -0.12 : 0.3, 0.3, mix(LEAF0, i % 2 ? LEAF1 : LEAF2, rr.r(0.35, 1)), 0.6, 5);
      // (a leaf lies along +Y with its face to +Z: turn that face outwards, then stand it along dir)
      g.rotateY(Math.atan2(cx, cz)); parts.push(K.place(g, row < 3 ? at : V3(cx * rad, 0.2, cz * rad * 0.74), dir));
    }
  }
  // two thin vines over her shoulders hold the gown up, a leaf where each meets it
  for (const sx of [-1, 1]) {
    parts.push(K.tube([V3(sx * 0.075, 0.5, 0.105), V3(sx * 0.1, 0.565, 0.07), V3(sx * 0.1, 0.6, 0.0), V3(sx * 0.09, 0.57, -0.07), V3(sx * 0.075, 0.5, -0.1)], () => 0.0065, () => LEAF1, 6, 16));
    parts.push(K.place(K.leaf(0.05, 0.03, 0.2, 0.3, LEAF2), V3(sx * 0.08, 0.505, 0.11), V3(sx * 0.5, 0.6, 0.6)));
  }
  body.add(K.shadowy(new THREE.Mesh(K.merge(parts), K.MAT.plant)));

  // arms: shoulder -> elbow -> wrist groups, so that she can gesture
  const armPart = (len, r0, r1) => K.tube([V3(0, 0, 0), V3(0, -len * 0.5, 0.004), V3(0, -len, 0)], (t) => r0 + (r1 - r0) * t, () => S1, 10, 10);
  const arms = [-1, 1].map((sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.165, 0.565, 0); body.add(sh);
    sh.add(K.shadowy(new THREE.Mesh(armPart(0.25, 0.04, 0.032), K.MAT.plant)));
    const el = new THREE.Group(); el.position.set(0, -0.25, 0); sh.add(el);
    const fore = [armPart(0.225, 0.032, 0.022)];
    for (let k = 0; k < 3; k++) { const a = k * 2.2 + (sx > 0 ? 0 : 1); fore.push(K.place(K.leaf(0.05, 0.026, 0.3, 0.3, k % 2 ? LEAF1 : LEAF2), V3(Math.cos(a) * 0.022, -0.175 - k * 0.012, Math.sin(a) * 0.022), V3(Math.cos(a) * 0.7, 0.75, Math.sin(a) * 0.7))); }      // a cuff of small leaves
    el.add(K.shadowy(new THREE.Mesh(K.merge(fore), K.MAT.plant)));
    const wr = new THREE.Group(); wr.position.set(0, -0.225, 0); el.add(wr);
    const hand = [K.place(K.ball(0.028, S1, 0.95, 1.35, 0.5, 10), V3(0, -0.036, 0))];
    for (let f = 0; f < 4; f++) hand.push(K.tube([V3((f - 1.5) * 0.011, -0.062, 0), V3((f - 1.5) * 0.013, -0.1, 0.006), V3((f - 1.5) * 0.014, -0.125 + Math.abs(f - 1.5) * 0.008, 0.016)], (t) => 0.0068 * (1 - 0.35 * t), () => S1, 6, 6));
    hand.push(K.tube([V3(sx * -0.022, -0.03, 0.004), V3(sx * -0.038, -0.058, 0.014), V3(sx * -0.042, -0.08, 0.022)], (t) => 0.0078 * (1 - 0.3 * t), () => S1, 6, 5));
    wr.add(K.shadowy(new THREE.Mesh(K.merge(hand), K.MAT.plant)));
    return { sh, el, wr, sx };
  });

  // ---------- head, hair, lily ----------
  const neck = new THREE.Group(); neck.position.set(0, 0.7, 0.004); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.135, 0.012); neck.add(head);
  const faceMat = new THREE.MeshLambertMaterial({ map: FACES.smile, color: col(0.5, 0.5, 0.5), emissive: col(0.13, 0.13, 0.13), emissiveMap: FACES.smile });
  const skull = K.shadowy(new THREE.Mesh(headGeo(), faceMat)); head.add(skull);
  {
    // the mane: locks from a parting on her left, each rising a little before it falls (volume), waving on the way down
    const O = V3(0, 0, 0), locks = [], h = K.rng(5);
    const tone = (i, dark) => (t) => mix(mix(HAIR0, HAIR1, clamp((dark ? 0.1 : 0.4) + 0.55 * ((i * 0.37) % 1), 0, 1)), HAIR2, (dark ? 0.15 : 0.7) * Math.pow(Math.sin(PI * clamp(t * 1.15, 0, 1)), 2) * ((i % 3) ? 0.5 : 1));
    const wide = (W) => (t) => W * Math.pow(Math.sin(PI * Math.pow(Math.min(1, t * 1.02), 0.5)), 0.65) + 0.003;
    // the front of her head at (x, y), for locks that lie on her brow and temples (the shaping of headGeo, without its bumps)
    const surf = (x, y, lift) => { const v = clamp(y / (1.12 * R), -0.99, 0.99), xs = x / (R * (v > 0 ? 0.9 : 0.9 - 0.4 * Math.pow(-v, 1.7))); return Math.sqrt(Math.max(0.0, 1 - xs * xs - v * v)) * R * 0.84 + lift * R; };
    const on = (x, y, lift = 0.1) => V3(x * R, y * R, surf(x * R, y * R, lift));
    const part = (k) => V3(0.36 * R, (1.14 - 0.05 * k * k) * R, (0.4 - 0.95 * k) * R);          // the parting, from above her brow (k = 0) back over the crown (k = 1)
    const fall = (root, deg, len, swell, wave, i, dark, W) => {
      const a = deg * PI / 180, dx = Math.sin(a), dz = Math.cos(a), sgn = i % 2 ? 1 : -1, pts = [root];
      pts.push(V3(root.x * 0.5 + dx * 0.55 * R, (1.2 + 0.1 * swell) * R, root.z * 0.6 + dz * 0.5 * R));
      pts.push(V3(dx * (1.08 + 0.16 * swell) * R, 0.55 * R, dz * (1.04 + 0.12 * swell) * R - 0.04 * R));
      for (let k = 1; k <= 6; k++) {
        const t = k / 6, y = (0.1 - len * t) * R, w = wave * Math.sin(t * 6.0 + i * 1.9) * sgn, out = 1.12 + 0.18 * swell + 0.3 * Math.sin(t * PI) + 0.12 * t + 0.1 * wave * Math.cos(t * 6.0 + i);
        const fz = dz > 0.2 ? 0.4 * t * R : 0;                                // the front locks come forward over her shoulders
        pts.push(V3(dx * out * R + dz * w * R, y, dz * out * R - dx * w * R + fz - 0.1 * t * R));
      }
      locks.push(K.lock(pts, wide(W * R), tone(i, dark), O, 0.36, 20));
    };
    // under layer (darker, fuller), then the top layer with its waves
    [70, 98, 126, 154, 180, -154, -126, -98, -70].forEach((deg, i) => fall(part(0.5 + 0.05 * (i % 3)), deg, 4.4 + h.r(-0.3, 0.4), 0, 0.14, i, true, 1.15));
    [58, 80, 103, 127, 151, 174, -163, -140, -117, -94, -72].forEach((deg, i) => fall(part(0.22 + 0.07 * (i % 4)), deg, 4.0 + h.r(-0.4, 0.5), 1, 0.3, i + 3, false, 0.95));
    // the sweep across her brow: from the parting over her forehead to her right temple, and on down past the lily
    for (let i = 0; i < 5; i++) {
      const root = part(0.0 + 0.07 * i), d = 0.09 * i;                         // i = 0 is the lowest, nearest her brows
      locks.push(K.lock([root, on(0.2, 1.0 + d * 0.4, 0.16), on(-0.1, 0.84 + d, 0.15), on(-0.48, 0.62 + d, 0.14), on(-0.8, 0.34 + d * 0.8, 0.14), V3(-1.02 * R, (-0.2 + d * 0.3) * R, (0.4 - 0.05 * i) * R),
        V3(-1.14 * R, -0.95 * R, (0.42 - 0.05 * i) * R), V3(-1.0 * R, (-1.8 - 0.25 * i) * R, (0.62 - 0.05 * i) * R), V3(-1.22 * R, (-2.6 - 0.3 * i) * R, (0.74 - 0.05 * i) * R), V3(-1.05 * R, (-3.3 - 0.3 * i) * R, 0.8 * R)],
        wide((0.62 - 0.03 * i) * R), tone(i + 1, i === 4), O, 0.36, 22));
    }
    // and the shorter side of the parting: over her left temple, down beside her cheek
    for (let i = 0; i < 4; i++) {
      const d = 0.08 * i;
      locks.push(K.lock([part(0.0 + 0.08 * i), on(0.56, 0.98 + d * 0.3, 0.14), on(0.8, 0.5 + d, 0.14), V3(1.02 * R, (-0.1 + d) * R, (0.42 - 0.07 * i) * R), V3(1.14 * R, -0.95 * R, (0.44 - 0.06 * i) * R),
        V3(1.0 * R, (-1.9 - 0.25 * i) * R, (0.64 - 0.05 * i) * R), V3(1.2 * R, (-2.7 - 0.3 * i) * R, (0.74 - 0.05 * i) * R), V3(1.06 * R, (-3.4 - 0.3 * i) * R, 0.8 * R)], wide((0.6 - 0.03 * i) * R), tone(i + 5, i === 3), O, 0.36, 20));
    }
    // a cap under it all, so no scalp shows between the locks
    const cap = new THREE.SphereGeometry(R * 1.0, 20, 14); cap.scale(0.93, 1.15, 0.92); cap.translate(0, R * 0.05, -R * 0.24);      // (well behind her face)
    locks.push(K.shade(cap, () => HAIR0));
    head.add(K.shadowy(new THREE.Mesh(K.merge(locks), K.MAT.plant)));
    // the lily behind her right ear: six pointed petals curling back, a pale throat, stamens; thin pale tendrils hang from it
    const lily = [], at = V3(-0.98 * R, 0.5 * R, 0.5 * R), out = V3(-0.78, 0.3, 0.56).normalize();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.3, L = R * (i % 2 ? 0.78 : 0.9);
      const pg = K.leaf(L, L * 0.36, 0.5, 0.25, mix(PETAL1, i % 2 ? PETAL2 : PETAL0, 0.45), 0.72, 6);
      lily.push(K.place(pg, V3(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2 - 0.95, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), a))));
    }
    lily.push(K.ball(R * 0.1, col(0.5, 0.45, 0.3), 1, 1, 1, 8));
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; lily.push(K.tube([V3(0, 0, 0), V3(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1, R * 0.2), V3(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, R * 0.3)], () => 0.0016, () => col(0.45, 0.3, 0.36), 4, 5)); lily.push(K.place(K.ball(0.0036, col(0.3, 0.13, 0.06), 1, 1, 1, 6), V3(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, R * 0.3))); }
    const lm = new THREE.Mesh(K.merge(lily), K.MAT.plant); lm.position.copy(at); lm.quaternion.setFromUnitVectors(V3(0, 0, 1), out); head.add(K.shadowy(lm));
    const tend = [], pale = col(0.2, 0.26, 0.12), pale2 = col(0.32, 0.36, 0.22);
    [[0, 3.3, 0.0], [1, 2.6, 0.9], [2, 1.9, 2.0]].forEach(([i, len, ph]) => {
      const pts = []; for (let k = 0; k <= 7; k++) { const t = k / 7; pts.push(V3(at.x - 0.04 * R * i + 0.13 * R * Math.sin(t * 5 + ph) - 0.12 * R * t, at.y - 0.25 * R - len * R * t, at.z + 0.1 * R + 0.1 * R * Math.cos(t * 4 + ph) + 0.22 * R * t)); }
      tend.push(K.tube(pts, (t) => 0.0042 * (1 - 0.6 * t), (t) => mix(pale, pale2, t), 5, 22));
      tend.push(K.place(K.leaf(0.035, 0.014, 0.3, 0.3, mix(PETAL1, PETAL2, 0.5), 0.7, 4), pts[7], V3(0.2, -1, 0.3)));
      tend.push(K.place(K.leaf(0.03, 0.013, 0.3, 0.3, pale2, 0.7, 4), pts[4], V3(-0.6, -0.4, 0.5)));
    });
    head.add(K.shadowy(new THREE.Mesh(K.merge(tend), K.MAT.plant)));
  }

  // ---------- poses, eased in code ----------
  // per arm: shoulder [x (forward +), z (out from her side +)], elbow bend, wrist; trunk lean and turn
  const POSE = {
    Idle: { R: [0.5, 0.42, 1.95, 0.3], L: [0.1, 0.34, 0.5, 0.1], lean: 0.03, turn: 0.1, tilt: 0.06 },          // one hand up by her collar bone, the other easy at her side
    Rise: { R: [0.9, 1.0, 0.5, 0.0], L: [0.9, 1.0, 0.5, 0.0], lean: -0.08, turn: 0, tilt: 0 },                    // arms opening as she comes up
    Delight: { R: [1.15, 0.2, 2.25, 0.4], L: [1.15, 0.2, 2.25, 0.4], lean: 0.1, turn: 0, tilt: 0.16 },           // hands together under her chin
    Command: { R: [0.5, 1.75, 0.35, -0.3], L: [0.3, 1.5, 0.5, -0.2], lean: 0.16, turn: 0, tilt: -0.04 },         // arms flung wide and high
    Lean: { R: [1.1, 0.25, 0.9, 0.1], L: [1.1, 0.25, 0.9, 0.1], lean: 0.34, turn: 0, tilt: 0.1 },                 // bent forward over what she holds, both hands out before her
  };
  const st = { talk: false, tk: 0, clip: 'Idle', expr: 'smile', shown: 'smile', t: 0, cur: JSON.parse(JSON.stringify(POSE.Idle)) };
  const show = (e) => { if (e !== st.shown && FACES[e]) { st.shown = e; faceMat.map = FACES[e]; faceMat.emissiveMap = FACES[e]; } };
  // ---------- an arm that reaches: shoulder, elbow and wrist turned so that her fingertips come to a point ----------
  // (lengths in her own units: upper arm 0.25, forearm 0.225, wrist to fingertips 0.125; the body is scaled 1.12)
  const RCH = { L: null, R: null }, rw = { L: 0, R: 0 };
  const _p = V3(), _d = V3(), _n = V3(), _S = V3(), _E = V3(), _W = V3(), _wt = V3(), _dn = V3(), _pl = V3(), _el = V3(), _x = V3(), _a = V3(), _b = V3();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const setWorldQuat = (o, q) => { o.parent.getWorldQuaternion(_q3); o.quaternion.copy(_q3.invert().multiply(q)); o.updateWorldMatrix(false, true); };
  const turnTo = (o, tip, want) => { o.getWorldPosition(_a); _b.subVectors(tip, _a).normalize(); o.getWorldQuaternion(_q); _q2.setFromUnitVectors(_b, _x.copy(want).normalize()).multiply(_q); setWorldQuat(o, _q2); };
  function reachArm(a, fn, w) {
    fn(_p, _d, _n);                                    // fingertips, the way the fingers point, the way the palm faces
    const sc = body.getWorldScale(_x).x, L1 = 0.25 * sc, L2 = 0.225 * sc;
    _d.normalize(); _n.addScaledVector(_d, -_n.dot(_d)); if (_n.lengthSq() < 1e-6) _n.set(0, 1, 0); _n.normalize();
    // (her two longest fingers end 0.121 along the hand and 0.016 to the palm's side of its line: the wrist is put where THEY touch the point)
    _wt.copy(_p).addScaledVector(_d, -0.121 * sc).addScaledVector(_n, -0.016 * sc);
    a.sh.getWorldPosition(_S); a.el.getWorldPosition(_E); a.wr.getWorldPosition(_W);
    _wt.lerpVectors(_W, _wt, w);
    _dn.subVectors(_wt, _S); const far = _dn.length(), d = Math.min(Math.max(far, Math.abs(L1 - L2) + 0.01), (L1 + L2) * 0.997); _dn.divideScalar(far || 1);
    const ax = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - ax * ax));
    _pl.set(a.sx * 0.5, -1, -0.2).applyQuaternion(body.getWorldQuaternion(_q)); _pl.addScaledVector(_dn, -_pl.dot(_dn)).normalize();      // elbows down and out
    _el.copy(_dn).multiplyScalar(ax).addScaledVector(_pl, h);
    turnTo(a.sh, _E, _el);
    a.el.getWorldPosition(_E); a.wr.getWorldPosition(_W); turnTo(a.el, _W, _x.copy(_S).addScaledVector(_dn, d).sub(_E));
    // the hand: its fingers run along its own -Y, its palm faces +Z
    _a.copy(_d).negate(); _b.crossVectors(_a, _n);                                 // x = y cross z
    a.wr.getWorldQuaternion(_q); _q2.setFromRotationMatrix(_m.makeBasis(_b, _a, _n)); _q.slerp(_q2, w); setWorldQuat(a.wr, _q);
  }
  return {
    obj: body, placeholder: false,
    headPos: (out) => skull.getWorldPosition(out),
    mouthPos: (out) => { skull.getWorldPosition(out); skull.getWorldQuaternion(_q); return out.add(_x.set(0, -0.055, 0.105).applyQuaternion(_q).multiplyScalar(body.getWorldScale(_a).x)); },
    reach(side, fn) { RCH[side] = fn || null; },
    shoulderPos: (side, out) => (side === 'R' ? arms[0] : arms[1]).sh.getWorldPosition(out),
    setExpression(e) { st.expr = FACES[e] ? e : 'smile'; },
    setTalking(on) { st.talk = !!on; },
    playClip(name) { if (POSE[name]) { st.clip = name; st.t = 0; } },
    update(dt, t) {
      st.t += dt;
      const goal = st.clip === 'Rise' && st.t > 1.6 ? POSE.Idle : POSE[st.clip], k = Math.min(1, dt * (st.clip === 'Command' ? 6 : 3.2)), c = st.cur;
      for (const s of ['R', 'L']) for (let i = 0; i < 4; i++) c[s][i] += (goal[s][i] - c[s][i]) * k;
      c.lean += (goal.lean - c.lean) * k; c.turn += (goal.turn - c.turn) * k; c.tilt += (goal.tilt - c.tilt) * k;
      st.tk += ((st.talk ? 1 : 0) - st.tk) * Math.min(1, dt * 10);
      const br = Math.sin(t * 1.4), sway = Math.sin(t * 0.8);
      body.rotation.set(c.lean + 0.012 * br, c.turn + 0.07 * sway, 0.03 * Math.sin(t * 0.63));
      neck.rotation.set(0.04 * Math.sin(t * 1.1) + 0.035 * st.tk * Math.sin(t * 8.5), 0.1 * Math.sin(t * 0.7) - c.turn * 0.6, c.tilt + 0.04 * Math.sin(t * 0.9));
      for (const a of arms) {
        const p = c[a.sx < 0 ? 'R' : 'L'], w = 0.04 * Math.sin(t * 1.3 + (a.sx < 0 ? 0 : 1.7));
        a.sh.rotation.set(-p[0] - w, 0, a.sx * (p[1] + 0.03 * br));
        a.el.rotation.set(-p[2] + 0.06 * Math.sin(t * 1.9 + a.sx), a.sx * -0.25 * Math.min(1, p[2]), 0);
        a.wr.rotation.set(p[3] + 0.1 * Math.sin(t * 2.3 + a.sx), 0, a.sx * 0.1 * Math.sin(t * 1.7));
      }
      for (const a of arms) {                            // an arm that has been given something to reach for
        const s = a.sx < 0 ? 'R' : 'L'; rw[s] += ((RCH[s] ? 1 : 0) - rw[s]) * Math.min(1, dt * 6);
        if (RCH[s] && rw[s] > 0.01) { body.updateWorldMatrix(true, true); reachArm(a, RCH[s], rw[s]); }
      }
      // her face: the expression asked for; while she speaks her mouth opens and shuts
      const e = st.expr;
      show(st.talk && Math.sin(t * 17) > 0.1 ? (e === 'laugh' ? 'happy' : e === 'smile' || e === 'pout' ? 'smug' : e === 'smug' ? 'happy' : 'smile') : e);
    },
  };
}
