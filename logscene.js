// logscene.js: the "hollow log" event for the Forest Camp level. Contract: LOGSCENE_SPEC.md.
// Comedic tickle-trap only: the one thing that comes off is her pair of shoes.

export function createLogScene(ctx) {
  const { THREE, scene, camera, anne } = ctx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = THREE.MathUtils.clamp, PI = Math.PI;
  const ease = (k, dt) => 1 - Math.exp(-k * dt);
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  let seed = 7771;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- layout ----------
  const LOG_R = 0.3, LOG_FLOOR = 0.08, LOG_IN = LOG_R - LOG_FLOOR, LOG_LEN = 0.6;      // LOG_IN: the nominal inner radius (the floor is LOG_FLOOR thick)
  // The hollow is no round pipe: it is a low oval burrow that hugs her all the way through, from her waist at the
  // north mouth over her hips to her thighs at the south mouth, so she plainly cannot wiggle out. The floor is level.
  // z: along the log, north = -z. Stations: [z, half width, half height].
  const HOLE = [[-0.30, 0.162, 0.128], [-0.05, 0.186, 0.118], [0.30, 0.176, 0.100]];
  const holeAt = (z) => {                                    // -> [half width, half height, centre above the log's axis]
    const k = z < HOLE[1][0] ? 0 : 1, A = HOLE[k], B = HOLE[k + 1], t = sstep(A[0], B[0], z);
    const a = A[1] + (B[1] - A[1]) * t, b = A[2] + (B[2] - A[2]) * t;
    return [a, b, b - LOG_IN];
  };
  const base = ctx.tc(...(ctx.logAt || [14, 7]));          // log centre on the ground (y = 0) (10-02: the camp's (14,7); the forest's and the pond's logs: ctx.logAt)
  const northZ = base.z - LOG_LEN / 2, southZ = base.z + LOG_LEN / 2;
  // Where her body goes (ctx.stuck, optional): Marker_Chest is her hip centre (rigid with the root bone). By default it sits
  // 0.121 m above the log floor and 5 cm north of the log's middle: hips on the floor, shoulders clear of the north rim, knees at the south rim.
  const num = (v, d) => (Number.isFinite(v) ? v : d), SK = ctx.stuck || {};
  const chestTarget = V3(base.x, num(SK.hipY, LOG_R - LOG_IN + 0.121), base.z - num(SK.hipNorth, 0.05));
  const FACE_Y = num(SK.faceY, 0.56), FACE_N = num(SK.faceNorth, 0.17);
  const bushSE = V3(base.x + 3.4, 0, base.z + 3.3);        // the bushes the Kuns live in
  const OBST = [-0.2, 0, 0.2].map((dz) => ({ x: base.x, z: base.z + dz, r: 0.42 }));
  const WIDE_NW = V3(-0.62, 0, -0.78).normalize(), WIDE_SW = V3(-0.55, 0, 0.83).normalize();

  // ---------- dialogue data ----------
  // id: [speaker, sheet, face, expr (null = Amaymon, keep Anne's), blush, shot, text, clip]
  // shots: 'wide', 'face' (her face at the north end of the log), 'feet' (the Kuns at work, from the south),
  // 'soles' (the close-up of her soles while they are tickled) and 'kicks' (the same, zoomed out, for the minigame)
  const A = 'Anne', AM = 'Amaymon';
  const LINES = {
    1: [A, '01', 7, 'smug', 0, 'wide', "Mmmmh... what's this?"],
    2: [AM, 'am', 0, null, 0, 'wide', "What's so interesting about that old log?"],
    3: [A, '01', 0, 'happy', 0, 'wide', 'Lucky day! There are medicinal herbs in there!'],
    4: [A, '01', 0, 'smile', 0, 'wide', 'I could make good use of them...'],
    5: [A, '01', 0, 'happy', 0, 'wide', 'Yeah! With these I can brew a Healing Potion at the fire!'],
    6: [A, '01', 10, 'strain', 0, 'face', 'Almost got them...!', 'StuckStruggle'],
    7: [A, '01', 1, 'embarrassed', 0.6, 'face', 'Eeehm... now this is embarrassing.', 'StuckIdle'],
    8: [A, '01', 4, 'worried', 0.4, 'face', "...I'm stuck.", 'StuckIdle'],
    9: [A, '01', 7, 'worried', 0, 'face', 'Amaymon?', 'StuckIdle'],
    10: [AM, 'am', 0, null, 0, 'face', 'Right in front of you!'],
    11: [A, '02', 6, 'worried', 0, 'feet', '...'],
    12: [A, '02', 12, 'shocked', 0, 'feet', 'Wait wait wait!!!'],
    13: [A, '02', 42, 'shocked', 0, 'face', "WHO'S THERE?!", 'StuckStruggle'],
    14: [A, '02', 42, 'shocked', 0.3, 'soles', 'Oh no no no, NOT MY FEET!', 'StuckFlatStrain'],
    15: [A, '02', 42, 'shocked', 0.3, 'feet', 'Leave my shoes alone!!', 'StuckStruggle'],
    // (the Kuns tie her up between 15 and T1: her ankles together, her big toes together, the string pegged down taut)
    T1: [A, '02', 42, 'shocked', 0.3, 'feet', 'H-HEY!! What are you doing back there?! UNTIE ME!!', 'StuckFlat'],
    T2: [AM, 'am', 2, null, 0, 'feet', 'Ankles AND big toes. Tied tight. Thorough little things, aren\'t they?'],
    16: [A, '02', 42, 'laugh', 0.5, 'face', 'HELLO?!?!', 'StuckFlatTickled'],
    17: [A, '02', 40, 'laugh', 0.6, 'face', '...', 'StuckFlatTickled'],
    18: [A, '02', 14, 'laughHard', 0.8, 'soles', 'NO NO NO NO NO NO NO... STOP IT ALREADY!!!', 'StuckFlatTickled'],
    19: [AM, 'am', 0, null, 0, 'face', "What's so funny?"],
    20: [AM, 'am', 2, null, 0, 'face', "Hehehe, you look in distress! That's great! Can I watch?"],
    21: [A, '02', 16, 'angry', 0.6, 'face', 'Shut up and help me get out of here!!'],
    22: [AM, 'am', 4, null, 0, 'face', "Can't move on my own, sorry... Shall I cheer you on?"],
    23: [A, '02', 18, 'laughHard', 0.9, 'feet', 'SHAHAHAHA— HELP MEEEE!!!', 'StuckFlatTickled'],
    24: [AM, 'am', 4, null, 0, 'soles', 'COME ON, KITTY! YOU CAN DO IT! KICK THOSE LITTLE PESTS OUT!'],
    a: [AM, 'am', 4, null, 0, 'soles', "Come on!!! You've almost got it!!!", 'StuckFlatTickled'],
    b: [A, '02', 18, 'laughHard', 0.9, 'face', 'Y-YOU USELESS SACK OF LIMBS!! HAHAHAHA STOP IT!!'],
    E1: [A, '02', 4, 'angry', 0.4, 'aface', 'Damn little pests!!!'],
    E2: [A, '02', 4, 'angry', 0.4, 'kunsee', 'GET OUT OF HERE!!'],
    F1: [AM, 'am', 2, null, 0, 'wide', 'Now THAT was funny! You got your herbs... but those little muggers ran off with your coins!'],
    F2: [A, '01', 22, 'shocked', 0, 'wide', 'OH, NO!!!'],
    C1: [A, '02', 34, 'pout', 0.3, 'wide', '...At least they left my shoes.'],
    // (10-03) after D licked inside one of them (each a random one of these)
    W1: [A, '02', 19, 'embarrassed', 0.45, 'own', ["*squish*\n...Eww. EWW!! It's all WET in there!!", 'W-why is it warm?! And WET?!\nDid that little pest LICK the inside of my shoe?!',
      "Ugh... it's like stepping into a puddle of slobber.", "Nooo... it's soaking wet inside!!\nMy poor shoes!!"]],
    W2: [A, '02', 8, 'embarrassed', 0.4, 'flash', ['Look at that... my sole is all shiny with drool.\nGROSS!!', "Ugh, it's on my SOLES now too!\nEvery step goes *squelch*...",
      "It's sticky... it's between my toes...\nI need a bath. And new shoes."]],
    W4: [A, '02', 9, 'smile', 0.35, 'aface', ['Ahh... MUCH better. No more squish!\n...That brush tickled more than the licking, though.', "Clean soles! Hehe...\nDon't you dare tell Amaymon I giggled.",
      'There. Clean. ...The SHOES are still soggy, though.']],
    W3: [A, '02', 34, 'pout', 0.3, 'aface', ['Note to self: wash these in the pond.\nTwice. No... three times.', "...I'm walking funny now, aren't I.\n*squish* *squish* *squish*",
      'If I catch that yellow one near my shoes again...!!']],
    // the mimic shoes (the 2D game's "Mimic Shoes" scene: they tickle the feet that wear them)
    M1: [A, '01', 7, 'smug', 0, 'wide', 'Mmmh? Somebody left a pair of shoes out here.'],
    M2: [A, '02', 6, 'worried', 0, 'wide', 'These shoes look kinda... UUGHH!!! Did that one just wink at me?'],
    M3: [A, '01', 0, 'smile', 0, 'msit', 'Huh. A perfect fit. Comfy, too!', 'MimSit'],
    M4: [AM, 'am', 0, null, 0, 'msit', 'Kitty... your shoes are looking at you.'],
    M5: [A, '02', 14, 'laughHard', 0.8, 'msole', 'H-HEY!! WHAT IS IT D— AHAHAHA!! THAT TICKLES!!', 'SitTickle'],
    M6: [A, '02', 18, 'laughHard', 0.9, 'mside', 'NOT THIS ONE TOO!! HAHAHAHA!!', 'SitTickle'],
    M7: [AM, 'am', 2, null, 0, 'msit', 'Hehehe! Kick them off, kitty!', 'SitTickle'],
    M8: [A, '02', 18, 'laughHard', 0.9, 'msole', 'S-STOP IT!! AHAHAHAHA!!', 'SitBoth'],
    M9: [A, '02', 4, 'angry', 0.4, 'wide', 'BEGONE, YOU CREEPS!!!'],
    M10: [AM, 'am', 4, null, 0, 'wide', "I'd keep them. They clearly like you."],
    C2: [AM, 'am', 4, null, 0, 'wide', 'Careful out there, kitty!'],
    R1: [AM, 'am', 4, null, 0, 'wide', "You really enjoy gathering ingredients, don't you?"],
    R2: [A, '02', 34, 'pout', 0, 'wide', 'Ha ha... very funny.'],
  };
  // cues fired while a line is on screen: [delay s, fn (also fired if the line is left before the delay), gate].
  // A line with a gate can't be advanced (a press only finishes the typing) until gate(st) is true.
  const CUES = {
    10: [0.25, () => sneakIn()],
    12: [0.15, () => startGrab(), (st) => heelsLanded(st)],
    16: [0, () => startTickle()],
    E2: [0.9, () => { if (!NOFLEE) for (const g of kuns) if (g.mode === 'cower' || g.mode === 'startle' || g.mode === 'stare') leave(g, 'flee'); }],      // they wait for her shout, then run
  };
  // 'L:name' = label; [op, ...args] = step
  const SCRIPT = [
    'L:start', ['faceLog'], ['say', 1], ['say', 2], ['say', 3], ['say', 4],
    ['choice', 'Get the herbs', 'herbs', 'Leave', 'leave'],
    'L:leave', ['end'],
    'L:herbs', ['say', 5], ['fade', 1], ['getStuck'], ['wait', 0.15], ['fade', 0],
    ...Array.from({ length: 7 }, (_, i) => ['say', i + 6]), ['say', 15], ['say', 13], ['tie'], ['say', 'T1'], ['say', 14], ['say', 'T2'],
    ...Array.from({ length: 9 }, (_, i) => ['say', i + 16]),
    'L:round', ['game'], ['say', 'a'], ['say', 'b'], ['goto', 'round'],
    'L:escape', ['snapTies'], ['fade', 1], ['standUp', 'escape'], ['wait', 0.1], ['fade', 0], ['stomp'], ['say', 'E1'], ['say', 'E2'], ['goto', 'complete'],
    'L:fail', ['rob'], ['fade', 1], ['standUp', 'fail'], ['wait', 0.1], ['fade', 0], ['say', 'F1'], ['say', 'F2'],
    // (10-03) then she sits down and puts her shoes back on
    'L:complete', ['say', 'C1'], ['ownCheck', 'cdone'], ['fade', 1], ['ownSit'], ['wait', 0.15], ['fade', 0], ['ownPut'], ['wetCheck', 'cup'], ['say', 'W1'],
    'L:cup', ['wait', 0.25], ['fade', 1], ['ownUp'], ['wait', 0.1], ['fade', 0],
    // (10-03) D licked inside one of her shoes: up on her feet, the sole flash shows the saliva on her soles
    ['wetCheck', 'cdone'], ['flashOn'], ['say', 'W2'],
    // (10-03) and the option to scrub her soles clean with the fuzzy brush (footplay.js): the mouse over one sole, then the other
    ['choice', 'Scrub her soles clean with the fuzzy brush', 'brush', 'Leave them be', 'wdone'],
    'L:brush', ['brush'], ['say', 'W4'], ['goto', 'cdone'],
    'L:wdone', ['flashOff'], ['say', 'W3'],
    'L:cdone', ['say', 'C2'], ['end'],
    'L:repeat', ['faceLog'], ['say', 'R1'], ['say', 'R2'], ['end'],
    'L:mimic', ['faceShoes'], ['say', 'M1'], ['say', 'M2'],
    ['choice', 'Try them on', 'mwear', 'Leave them', 'leave'],
    'L:mwear', ['fade', 1], ['sitDown'], ['wait', 0.15], ['fade', 0], ['putOn'], ['say', 'M3'], ['say', 'M4'],
    ['mTease'], ['say', 'M5'], ['say', 'M6'], ['say', 'M7'],
    'L:mround', ['mgame'], ['mBoth'], ['say', 'M8'], ['goto', 'mround'],
    // (10-03) the mimics kicked off, she stays sitting and puts her own shoes back on, then gets up
    'L:mescape', ['fade', 1], ['mOff'], ['wait', 0.1], ['fade', 0], ['say', 'M9'], ['ownPut'], ['wait', 0.25], ['fade', 1], ['mStand'], ['wait', 0.1], ['fade', 0], ['say', 'M10'], ['end'],
  ];
  const faceUrl = (f) => new URL('faces/' + f, import.meta.url).href;
  const SHEETS = { '01': [faceUrl('anne-faceset-01.png'), 4, 12], '02': [faceUrl('anne-faceset-02.png'), 4, 12], am: [faceUrl('amaymon-faceset.png'), 4, 9] };
  // Portraits are drawn into a small canvas from bitmaps decoded once at load. As CSS backgrounds, Safari decoded each
  // big sheet the first time it appeared (and again whenever it had dropped it to save memory): a visible hitch.
  const BITMAPS = {};
  const portraitsReady = Promise.all(Object.keys(SHEETS).map(async (k) => {
    try { BITMAPS[k] = await createImageBitmap(await (await fetch(SHEETS[k][0])).blob()); } catch (e) { /* that sheet falls back to a CSS background */ }
  }));

  // ---------- temps (reused every frame) ----------
  const _a = V3(), _b = V3(), _c = V3();
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const UP = V3(0, 1, 0);

  // ---------- markers ----------
  // Fallbacks (anne-local, prone layout) are only used if the model lacks a marker.
  const FALLBACK = { Chest: [0, -0.05, 1.25], Head: [0, -0.03, 1.62] };
  for (const [s, x] of [['L', 0.11], ['R', -0.11]]) {
    FALLBACK[`Sole_${s}_Heel`] = [x, 0.13, 0.0]; FALLBACK[`Sole_${s}_Arch`] = [x, 0.07, -0.03];
    FALLBACK[`Sole_${s}_Ball`] = [x, 0.0, -0.04]; FALLBACK[`Sole_${s}_Out`] = [x, 0.09, -0.087];
  }
  const MK = {};
  function mk(name, out) {
    let o = MK[name];
    if (o === undefined) {
      o = MK[name] = anne.getObjectByName('Marker_' + name) || null;
      if (!o) console.warn(`[logscene] Marker_${name} not found; using an estimate`);
    }
    if (o) return o.getWorldPosition(out);
    const f = FALLBACK[name];
    return anne.localToWorld(out.set(f[0], f[1], f[2]));
  }

  // ---------- smooth procedural geometry ----------
  // A "G" collects closed surfaces for one BufferGeometry. Vertices are shared round every surface, so the normals have no seams.
  const newG = (uv) => ({ p: [], n: [], c: [], i: [], uv: uv ? [] : null });
  const UV_PLAIN = [0.5, 0.94], _p = V3();
  // Normals for the part of G that starts at vertex v0 / index i0, with its triangles turned to face outwards.
  function seal(G, v0, i0) {
    const P = G.p, I = G.i, N = G.n, nv = P.length / 3 - v0;
    let cx = 0, cy = 0, cz = 0, vol = 0;
    for (let v = v0 * 3; v < P.length; v += 3) { cx += P[v]; cy += P[v + 1]; cz += P[v + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    for (let pass = 0; pass < 2; pass++) {
      for (let t = i0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (pass === 0) vol += nx * (P[a] - cx) + ny * (P[a + 1] - cy) + nz * (P[a + 2] - cz);
        else for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
      }
      if (pass === 0 && vol < 0) for (let t = i0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
    }
    for (let v = v0 * 3; v < P.length; v += 3) { const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; }
  }
  // shape(): a surface with a pole at each end (or only at the start when `open`). f(v, a, out) is the point at v in 0..1 and angle a;
  // col is an array or col(v, a, point) -> array (r, g, b, or the four paint weights of a Kun); uv(v, a, point) -> [u, v].
  function shape(G, rows, m, f, col, open, uv) {
    const v0 = G.p.length / 3, i0 = G.i.length, last = open ? rows : rows + 1;
    const put = (v, a) => {
      f(v, a, _p); G.p.push(_p.x, _p.y, _p.z); G.n.push(0, 0, 0);
      const c = typeof col === 'function' ? col(v, a, _p) : col; for (let k = 0; k < c.length; k++) G.c.push(c[k]);
      if (G.uv) { const t = uv ? uv(v, a, _p) : UV_PLAIN; G.uv.push(t[0], t[1]); }
    };
    put(0, 0);
    for (let j = 1; j <= rows; j++) for (let k = 0; k < m; k++) put(j / last, k / m * PI * 2);
    if (!open) put(1, 0);
    const ring = (j, k) => v0 + 1 + (j - 1) * m + (k % m), end = v0 + 1 + rows * m;
    for (let k = 0; k < m; k++) {
      G.i.push(v0, ring(1, k), ring(1, k + 1));
      for (let j = 1; j < rows; j++) G.i.push(ring(j, k), ring(j + 1, k), ring(j + 1, k + 1), ring(j, k), ring(j + 1, k + 1), ring(j, k + 1));
      if (!open) G.i.push(ring(rows, k), end, ring(rows, k + 1));
    }
    seal(G, v0, i0);
  }
  function toGeo(G, col = G.c, like) {
    const g = new THREE.BufferGeometry();
    if (like) { g.setAttribute('position', like.attributes.position); g.setAttribute('normal', like.attributes.normal); g.setIndex(like.index); }
    else {
      g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3));
      if (G.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
      g.setIndex(G.i);
    }
    if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  // A smooth curve through control points [radius, ...]. The ends are mirrored through the axis, which rounds the poles of a lathed shape.
  function curve(pts) {
    const n = pts.length - 1, dim = pts[0].length, out = new Array(dim), mir = (p) => p.map((x, k) => (k ? x : -x)), pre = mir(pts[1]), post = mir(pts[n - 1]);
    return (t) => {
      const s = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(s)), u = s - i, a = i ? pts[i - 1] : pre, b = pts[i], c = pts[i + 1], d = i + 2 > n ? post : pts[i + 2];
      for (let k = 0; k < dim; k++) out[k] = 0.5 * (2 * b[k] + (c[k] - a[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * u * u * u);
      return out;
    };
  }
  // f for shape(): a tube along path(t, out) with an elliptical section rad(t) -> [across, thick]; `ref` picks the "across" direction.
  const _t0 = V3(), _t1 = V3(), _tT = V3(), _tN = V3(), _tB = V3();
  function tube(path, ref, rad, extra) {
    return (v, a, out) => {
      path(clamp(v - 0.01, 0, 1), _t0); path(clamp(v + 0.01, 0, 1), _t1); _tT.subVectors(_t1, _t0).normalize();
      _tN.copy(ref).addScaledVector(_tT, -ref.dot(_tT)).normalize(); _tB.crossVectors(_tT, _tN);
      const r = rad(v), ca = Math.cos(a), sa = Math.sin(a);
      path(v, out).addScaledVector(_tN, r[0] * ca).addScaledVector(_tB, r[1] * sa);
      if (extra) extra(out, v, ca, sa, _tT, _tN, _tB, r);
      return out;
    };
  }
  const lathe = (prof, x = 0, y = 0, z = 0, s = 1) => (v, a, out) => { const q = prof(v); return out.set(x + q[0] * s * Math.sin(a), y + q[1] * s, z + q[0] * s * Math.cos(a)); };
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };   // sRGB hex -> linear [r, g, b]
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  // ---------- procedural textures ----------
  function canvasTex(w, h, draw, repeatS) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeatS) t.wrapS = THREE.RepeatWrapping;
    return t;
  }
  // One texture for the whole log (it wraps twice round it), in four bands from the bottom: bark, end grain, hollow, plain white
  // (the vertex-coloured moss, knots, stub and mushrooms sample the white band).
  const VALLEY = [0.06, 0.25, 0.47, 0.65, 0.86];           // the grooves between the bark plates, as fractions of half a turn
  const logTex = canvasTex(1024, 512, (x, w, h) => {
    const round = (fn) => { for (const dx of [-w, 0, w]) { x.save(); x.translate(dx, 0); fn(); x.restore(); } };
    const wavy = (x0, y0, y1, sway, n = 5) => {              // a line along the log that wanders a little
      x.beginPath(); x.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) x.quadraticCurveTo(x0 + rr(-sway, sway), y0 + (y1 - y0) * (i - 0.5) / n, x0 + rr(-sway, sway) * 0.5, y0 + (y1 - y0) * i / n);
      x.stroke();
    };
    x.lineCap = x.lineJoin = 'round';
    x.fillStyle = '#7a553a'; x.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < VALLEY.length; i++) {                 // plates: lighter in the middle, a soft dark groove on each side
      const a = VALLEY[i] * w, b = (i + 1 < VALLEY.length ? VALLEY[i + 1] : VALLEY[0] + 1) * w, mid = (a + b) / 2, s0 = seed;
      round(() => {
        seed = s0;
        const g = x.createLinearGradient(a, 0, b, 0); g.addColorStop(0, 'rgba(150,112,78,0)'); g.addColorStop(0.5, 'rgba(158,119,83,.75)'); g.addColorStop(1, 'rgba(150,112,78,0)');
        x.fillStyle = g; x.fillRect(a, h / 2, b - a, h / 2);
        for (let y = h / 2 - 30; y < h + 20;) {                // the groove comes in pieces, each a little off the last
          const len = rr(70, 150), gx = a + rr(-10, 10);
          x.shadowColor = '#3a2618'; x.shadowBlur = 14; x.strokeStyle = 'rgba(58,38,24,.85)'; x.lineWidth = rr(9, 14); wavy(gx, y, y + len, 9, 3);
          x.shadowBlur = 4; x.strokeStyle = 'rgba(40,25,15,.75)'; x.lineWidth = 4; wavy(gx, y + 8, y + len - 8, 6, 3);
          y += len + rr(8, 30);
        }
        for (let k = 0; k < 3; k++) {                          // short cracks in every plate
          const cx = a + (b - a) * rr(0.2, 0.8), cy = h / 2 + rr(10, 170);
          x.shadowBlur = 6; x.strokeStyle = 'rgba(64,42,27,.5)'; x.lineWidth = rr(3, 7); wavy(cx, cy, cy + rr(35, 90), 8, 3);
        }
        x.shadowBlur = 0; x.strokeStyle = 'rgba(190,150,110,.28)'; x.lineWidth = 7; wavy(mid + rr(-12, 12), h / 2 + rr(0, 40), h - rr(0, 40), 10);
      });
    }
    x.shadowBlur = 0;
    // end grain: pale wood with growth rings (texture v runs from the bark edge in to the hollow)
    const ey = h / 4, eh = h / 4, g = x.createLinearGradient(0, ey + eh, 0, ey);
    g.addColorStop(0, '#8a6240'); g.addColorStop(0.2, '#c99d68'); g.addColorStop(0.75, '#d6ad78'); g.addColorStop(1, '#9a7148');
    x.fillStyle = g; x.fillRect(0, ey, w, eh);
    for (let i = 0; i < 6; i++) {
      const y = ey + eh * (0.16 + 0.125 * i) + rr(-3, 3), ph = rr(0, 6), amp = rr(2, 4);
      x.strokeStyle = `rgba(128,86,48,${rr(0.35, 0.6)})`; x.lineWidth = rr(3, 5.5); x.beginPath();
      for (let px = 0; px <= w; px += 16) x.lineTo(px, y + amp * Math.sin(px / w * PI * 6 + ph));
      x.stroke();
    }
    const hy = h / 8, hg = x.createLinearGradient(0, hy + h / 8, 0, hy); hg.addColorStop(0, '#4a3020'); hg.addColorStop(1, '#2c1b11');
    x.fillStyle = hg; x.fillRect(0, hy, w, h / 8);
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, hy);
  }, true);
  // particles: soft dot, leaf, sparkle, glow
  const fxTex = canvasTex(512, 128, (x) => {
    const blob = (cx, stops) => { const g = x.createRadialGradient(cx, 64, 0, cx, 64, 62); for (const [o, al] of stops) g.addColorStop(o, `rgba(255,255,255,${al})`); x.fillStyle = g; x.fillRect(cx - 64, 0, 128, 128); };
    blob(64, [[0, 1], [0.4, 0.6], [1, 0]]);
    x.save(); x.translate(192, 64);                          // a leaf with a soft vein
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -56); x.bezierCurveTo(34, -30, 30, 28, 0, 56); x.bezierCurveTo(-30, 28, -34, -30, 0, -56); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -44); x.lineTo(0, 46); x.stroke();
    x.restore();
    x.save(); x.translate(320, 64); x.fillStyle = '#fff';    // a four-pointed sparkle
    for (const r of [0, PI / 2]) { x.save(); x.rotate(r); x.beginPath(); x.moveTo(0, -58); x.quadraticCurveTo(5, -5, 58, 0); x.quadraticCurveTo(5, 5, 0, 58); x.quadraticCurveTo(-5, 5, -58, 0); x.quadraticCurveTo(-5, -5, 0, -58); x.fill(); x.restore(); }
    x.restore(); blob(320, [[0, 0.9], [0.3, 0.25], [0.6, 0]]);
    blob(448, [[0, 0.85], [0.35, 0.4], [1, 0]]);
  });
  function eyeTex(mid, light, dark, pupil) {                // looking straight at the eye: big iris, dark pupil, two catch-lights
    return canvasTex(256, 256, (x) => {
      x.fillStyle = dark; x.fillRect(0, 0, 256, 256);
      let g = x.createRadialGradient(128, 150, 8, 128, 128, 126); g.addColorStop(0, light); g.addColorStop(0.48, mid); g.addColorStop(0.9, dark);
      x.fillStyle = g; x.beginPath(); x.arc(128, 128, 127, 0, PI * 2); x.fill();
      g = x.createRadialGradient(128, 200, 4, 128, 178, 84); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(128, 128, 120, 0, PI * 2); x.fill();                       // light pooling low in the iris
      x.shadowColor = pupil; x.shadowBlur = 8; x.fillStyle = pupil; x.beginPath(); x.arc(128, 128, 50, 0, PI * 2); x.fill(); x.shadowBlur = 0;
      g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 96);       // shadow of the lid
      for (const [cx, cy, r] of [[90, 84, 30], [170, 172, 12]]) {
        g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, PI * 2); x.fill();
      }
    });
  }

  // ---------- materials: Lambert everywhere (cheap, no environment reflections) ----------
  // The Kuns, feathers and small props get a soft rim: lit a little more where the surface turns away from the camera.
  function rimPatch(sh) {
    sh.uniforms.lsRim = this.userData.rim;
    sh.fragmentShader = 'uniform float lsRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'float lsEdge = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);\n\toutgoingLight *= 1.0 + lsRim * lsEdge * lsEdge * lsEdge;\n\t#include <opaque_fragment>');
  }
  // The sky module's light units: a surface in full sun shows about 2.3 x its albedo, in shade 0.7 x. The colours in this file are
  // the sunlit look, so every material is dimmed by ALB; a little self-glow keeps the shaded side of the Kuns colourful.
  const ALB = 0.45, dim = (k = 1) => new THREE.Color().setScalar(ALB * k);
  const soft = (opts, rim = 1) => { const m = new THREE.MeshLambertMaterial({ vertexColors: true, color: dim(), ...opts }); m.userData.rim = { value: rim }; m.onBeforeCompile = rimPatch; return m; };

  // ---------- the log: one smooth mesh (bark, rounded rims, end grain, hollow, moss, knots, a stub, three mushrooms) ----------
  const root = new THREE.Group(); root.name = 'LS_Root'; scene.add(root);
  const shadowy = (m) => { m.castShadow = m.receiveShadow = true; return m; };
  const logG = new THREE.Group(); logG.name = 'LS_Log'; logG.position.set(base.x, LOG_R, base.z); root.add(logG);
  function barkDip(th, z) {                                  // relief of the bark: grooves where the texture paints them, plus a slow swell
    const u = ((th / PI) % 1 + 1) % 1; let d = 0;
    for (const v of VALLEY) { let k = Math.abs(u - v); k = Math.min(k, 1 - k) * PI; d = Math.max(d, Math.exp(-((k / 0.09) ** 2))); }
    return 0.005 * Math.sin(3 * th + 1 + z * 2.5) - 0.011 * d * (0.7 + 0.3 * Math.sin(z * 9 + th * 5));
  }
  {
    const G = newG(true), NA = 88, H = LOG_LEN / 2, FO = 0.03, FI = 0.016, prof = [];
    // the wall's cross-section as a closed loop of rows: [z, radius, texture v, bark relief, shade, starts a new texture band]
    // (inner: 1 = on the hollow's wall; 0..1 = on an end face, that far from the bark edge towards the hollow)
    const row = (z, r, v, w, c, cut, inner) => prof.push([z, r, v, w, c, cut, inner]);
    for (let i = 0; i <= 3; i++) { const a = i / 3 * PI / 2; row(-H + FO - FO * Math.cos(a), LOG_R - FO + FO * Math.sin(a), 0.004 + 0.026 * i / 3, Math.sin(a), 1, i === 0); }
    for (let i = 1; i < 8; i++) row(-H + FO + (LOG_LEN - 2 * FO) * i / 8, LOG_R, 0.03 + 0.44 * i / 8, 1, 1);
    for (let i = 0; i <= 3; i++) { const a = i / 3 * PI / 2; row(H - FO + FO * Math.sin(a), LOG_R - FO + FO * Math.cos(a), 0.47 + 0.026 * i / 3, Math.cos(a), 1); }
    const face = (sg) => {                                   // an end face with its inner fillet, from the bark edge in (sg = 1) or the other way (sg = -1)
      const rows = [[LOG_R - FO, 0, 0.525, 1], [LOG_R - FO - 0.015, 0, 0.6, 1], [LOG_IN + FI, 0, 0.68, 0.95]];
      for (let i = 1; i <= 2; i++) { const a = i / 2 * PI / 2; rows.push([LOG_IN + FI - FI * Math.sin(a), FI - FI * Math.cos(a), 0.68 + 0.045 * i / 2, 0.95 - 0.12 * i]); }
      if (sg < 0) rows.reverse();
      rows.forEach(([r, dz, v, c], i) => row(sg * (H - dz), r, v, 0, c, i === 0, clamp((LOG_R - FO - r) / (LOG_R - FO - LOG_IN), 0, 1)));
    };
    face(1);
    for (let i = 0; i <= 16; i++) { const z = (H - FI) * (1 - i / 8); row(z, LOG_IN, 0.775 + 0.075 * i / 16, 0, 0.3 + 0.4 * Math.abs(z) / H, i === 0, 1); }
    face(-1);
    const v0 = G.p.length / 3, i0 = G.i.length, W = NA + 1;
    for (const [z, r, v, w, c, , inner] of prof) for (let k = 0; k <= NA; k++) {
      const th = k / NA * PI * 2, rad = r + w * barkDip(th, z), ao = c * (0.62 + 0.38 * sstep(-1, -0.45, Math.sin(th) * (w ? 1 : 0.4)));
      if (inner !== undefined) {                             // end faces and the hollow: from the round bark edge to the oval burrow
        const [ha, hb, hy] = holeAt(clamp(z, -H, H)), ro = LOG_R - FO, sh = inner >= 1 ? ao * 0.7 : ao;
        const grow = 1 + (1 - inner) * 0.0;                  // (the fillet rows keep the oval's shape)
        G.p.push(Math.cos(th) * (ro + (ha * grow - ro) * inner), Math.sin(th) * ro * (1 - inner) + (hy + Math.sin(th) * hb) * inner, z); G.c.push(sh, sh, sh);
      } else { G.p.push(Math.cos(th) * rad, Math.sin(th) * rad, z); G.c.push(ao, ao, ao); }
      G.n.push(0, 0, 0); G.uv.push(k / NA * 2, v);
    }
    for (let j = 0; j + 1 < prof.length; j++) {
      if (prof[j + 1][5]) continue;
      for (let k = 0; k < NA; k++) { const a = v0 + j * W + k, b = a + W; G.i.push(a, b, b + 1, a, b + 1, a + 1); }
    }
    seal(G, v0, i0);
    {                                                        // the texture seams duplicate vertices: give each group one normal
      const P = G.p, N = G.n, at = new Map();
      for (let v = v0 * 3; v < P.length; v += 3) { const key = `${Math.round(P[v] * 2e4)},${Math.round(P[v + 1] * 2e4)},${Math.round(P[v + 2] * 2e4)}`, e = at.get(key); if (e) e.push(v); else at.set(key, [v]); }
      for (const e of at.values()) {
        if (e.length < 2) continue;
        let x = 0, y = 0, z = 0; for (const v of e) { x += N[v]; y += N[v + 1]; z += N[v + 2]; }
        const l = Math.hypot(x, y, z) || 1; for (const v of e) { N[v] = x / l; N[v + 1] = y / l; N[v + 2] = z / l; }
      }
    }
    // soft cushions that hug the bark: moss (green) and knots (dark)
    const cushion = (ang, z, wa, wz, hgt, k, top, rim) => shape(G, 5, 16, (v, a, out) => {
      const q = v * (1 + 0.2 * Math.sin(3 * a + k) + 0.1 * Math.sin(5 * a + 2.1 * k)), th = ang + q * wa * Math.cos(a), zz = z + q * wz * Math.sin(a);
      const r = LOG_R + barkDip(th, zz) + hgt * Math.pow(Math.max(0, 1 - v * v), 0.7) - 0.006 * v * v;
      return out.set(Math.cos(th) * r, Math.sin(th) * r, zz);
    }, (v) => mixc(top, rim, v * v), true);
    const mossA = lin('#8fca45'), mossB = lin('#3f7d2c'), knotA = lin('#5c3f2b'), knotB = lin('#3d281a');
    cushion(1.45, -0.05, 0.42, 0.2, 0.028, 0.4, mossA, mossB); cushion(1.92, 0.16, 0.3, 0.12, 0.022, 1.7, mossA, mossB);
    cushion(0.92, -0.19, 0.24, 0.09, 0.02, 3.1, mossA, mossB); cushion(2.32, -0.17, 0.2, 0.08, 0.018, 4.4, mossA, mossB); cushion(1.05, 0.2, 0.16, 0.07, 0.016, 5.2, mossA, mossB);
    cushion(0.33, -0.11, 0.13, 0.06, 0.02, 2.2, knotA, knotB); cushion(2.75, 0.14, 0.11, 0.05, 0.018, 0.9, knotA, knotB);
    // a broken branch: bark colour, pale wood where it snapped
    const stubDir = V3(-0.76, 0.6, 0.24).normalize(), stubA = lin('#6a4831'), stubB = lin('#d0a672');
    shape(G, 9, 14, tube((t, out) => out.set(-0.22, 0.16, 0.08).addScaledVector(stubDir, 0.25 * (1 - (1 - t) ** 2)).setY(out.y + 0.035 * t * t), UP,
      (t) => { const r = (0.056 - 0.02 * t) * Math.min(1, t * 20) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.8) / 0.2) ** 2)); return [r, r]; }), (v) => mixc(stubA, stubB, sstep(0.84, 0.97, v)));
    // three mushrooms on the ground beside it
    const capP = curve([[0, 0.086], [0.03, 0.08], [0.05, 0.062], [0.053, 0.048], [0.04, 0.041], [0, 0.046]]), stemP = curve([[0, -0.01], [0.015, 0], [0.012, 0.03], [0.011, 0.05], [0, 0.056]]);
    const capA = lin('#f0875a'), capB = lin('#cf5330'), cream = lin('#f4e6c8');
    for (const [dx, dz, s] of [[0.42, 0.16, 1], [0.49, 0.25, 0.7], [-0.45, -0.22, 0.85]]) {
      shape(G, 5, 8, lathe(stemP, dx, -LOG_R, dz, s), cream);
      shape(G, 8, 14, lathe(capP, dx, -LOG_R, dz, s), (v) => (v > 0.62 ? cream : mixc(capA, capB, sstep(0.1, 0.6, v))));
    }
    const m = shadowy(new THREE.Mesh(toGeo(G), new THREE.MeshLambertMaterial({ map: logTex, vertexColors: true, color: dim(1.1) }))); m.name = 'LS_LogMesh'; logG.add(m);
    // It is dark inside a hollow log. Seen from the south (where the feet shots are), three soft dark discs make the
    // inside darker the deeper you look, so the eye stays on what is at the opening.
    const shadeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.012, 0.008, 0.006), transparent: true, opacity: 0.4, depthWrite: false, fog: false, toneMapped: false });
    for (const z of [0.2, 0.1, 0.0]) {
      const [ha, hb, hy] = holeAt(z);
      const d = new THREE.Mesh(new THREE.CircleGeometry(1, 40), shadeMat); d.scale.set(ha - 0.004, hb - 0.004, 1); d.position.set(0, hy, z); d.name = 'LS_LogShade'; d.renderOrder = 1; logG.add(d);
    }
  }

  // ---------- particles: every dust puff, leaf and sparkle is a quad in one of two meshes (normal and additive blending) ----------
  const FX_CELL = { dust: 0, leaf: 1, spark: 2, glow: 3 }, POOL = [];
  function makeBatch(n, blending) {
    const pos = new Float32Array(n * 12), col = new Float32Array(n * 16), uv = new Float32Array(n * 8), idx = [];
    for (let q = 0; q < n; q++) idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
    const geo = new THREE.BufferGeometry();
    for (const [k, arr, sz] of [['position', pos, 3], ['color', col, 4], ['uv', uv, 2]]) { const at = new THREE.BufferAttribute(arr, sz); if (k !== 'uv') at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at); }
    geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(V3(base.x + 1.3, 0.5, base.z + 1.3), 6.5);       // covers the log, the path to the bushes and the flying shoes
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: fxTex, vertexColors: true, transparent: true, depthWrite: false, blending }));
    mesh.visible = false; mesh.renderOrder = 2; root.add(mesh);
    return { pos, col, uv, geo, mesh, n: 0, live: 0, dirty: false };
  }
  const fxNormal = makeBatch(44, THREE.NormalBlending), fxAdd = makeBatch(21, THREE.AdditiveBlending);
  function addPool(kind, n, b) {
    for (let i = 0; i < n; i++) {
      const q = b.n++, c = FX_CELL[kind], u0 = c / 4 + 0.004, u1 = (c + 1) / 4 - 0.004;
      b.uv.set([u0, 0.01, u1, 0.01, u1, 0.99, u0, 0.99], q * 8);
      POOL.push({ kind, b, q, p: V3(), v: V3(), col: new THREE.Color(), age: 0, life: 0, size: 0, spin: 0, rot: 0 });
    }
  }
  addPool('dust', 18, fxNormal); addPool('leaf', 26, fxNormal); addPool('spark', 20, fxAdd); addPool('glow', 1, fxAdd);
  const herbGlow = POOL[POOL.length - 1];
  const LEAF_COLS = [0x6aa238, 0x86b53f, 0x9a7a34, 0x4f8a2e];
  const _cr = V3(), _cu = V3();
  function quad(p, size, alpha) {                            // write one camera-facing quad (size 0 = hide it)
    const P = p.b.pos, C = p.b.col, h = size / 2, cs = Math.cos(p.rot) * h, sn = Math.sin(p.rot) * h;
    for (let j = 0, o = p.q * 12, oc = p.q * 16; j < 4; j++, o += 3, oc += 4) {
      const x = j === 0 || j === 3 ? -1 : 1, y = j < 2 ? -1 : 1, rx = x * cs - y * sn, ry = x * sn + y * cs;
      P[o] = p.p.x + _cr.x * rx + _cu.x * ry; P[o + 1] = p.p.y + _cr.y * rx + _cu.y * ry; P[o + 2] = p.p.z + _cr.z * rx + _cu.z * ry;
      C[oc] = p.col.r; C[oc + 1] = p.col.g; C[oc + 2] = p.col.b; C[oc + 3] = alpha;
    }
    p.b.dirty = true;
  }
  function emit(kind, pos, n, spread = 0.12) {
    for (let i = 0; i < POOL.length && n > 0; i++) {
      const p = POOL[i];
      if (p.kind !== kind || p.age < p.life) continue;
      n--; p.age = 0; p.rot = 0; p.b.live++;
      p.p.set(pos.x + rr(-spread, spread), pos.y + rr(-spread, spread) * 0.6, pos.z + rr(-spread, spread));
      if (kind === 'dust') { p.life = rr(0.5, 0.9); p.size = rr(0.12, 0.22); p.v.set(rr(-0.5, 0.5), rr(0.2, 0.7), rr(-0.5, 0.5)); p.col.setHex(0xd8c49c); }
      else if (kind === 'leaf') { p.life = rr(0.8, 1.4); p.size = rr(0.06, 0.1); p.v.set(rr(-1.2, 1.2), rr(0.8, 1.8), rr(-1.2, 1.2)); p.spin = rr(-8, 8); p.rot = rr(0, 6); p.col.setHex(LEAF_COLS[(rnd() * 4) | 0]); }
      else { p.life = rr(0.4, 0.75); p.size = rr(0.05, 0.09); p.v.set(rr(-0.12, 0.12), rr(0.12, 0.4), rr(-0.12, 0.12)); p.rot = rr(0, 1.5); p.spin = rr(-2, 2); p.col.setHex(rnd() < 0.5 ? 0xffe27a : 0xfff6c8); }
    }
  }
  function updParticles(dt) {
    _cr.set(1, 0, 0).applyQuaternion(camera.quaternion); _cu.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < POOL.length; i++) {
      const p = POOL[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) { p.b.live--; quad(p, 0, 0); continue; }
      const k = p.age / p.life;
      if (p.kind === 'leaf') { p.v.y -= 3.2 * dt; p.v.multiplyScalar(Math.exp(-2.2 * dt)); }
      else if (p.kind === 'dust') p.v.multiplyScalar(Math.exp(-3 * dt));
      p.rot += p.spin * dt; p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.01) p.p.y = 0.01;
      if (p.kind === 'dust') quad(p, p.size * (0.6 + 1.2 * k), 0.6 * (1 - k) * Math.min(1, k * 8));
      else if (p.kind === 'leaf') quad(p, p.size, Math.min(1, 3 * (1 - k)));
      else quad(p, p.size * Math.sin(PI * k), 1);
    }
    if (herb.visible) {                                      // the herb's glow rides in the additive batch
      const k = 0.5 + 0.5 * Math.sin(herbT * 2.4);
      herbMat.emissiveIntensity = 0.45 + 0.4 * k; quad(herbGlow, 0.44, 0.3 + 0.25 * k);
    } else if (herbGlowOn) quad(herbGlow, 0, 0);
    herbGlowOn = herb.visible;
    for (let i = 0; i < 2; i++) {
      const b = i ? fxAdd : fxNormal;
      b.mesh.visible = b.live > 0 || (i === 1 && herbGlowOn);
      if (b.dirty) { b.dirty = false; b.geo.attributes.position.needsUpdate = true; b.geo.attributes.color.needsUpdate = true; }
    }
  }

  // ---------- the herb sprig (just inside the north opening): an aloe-like fan of plump leaves ----------
  const herb = new THREE.Group(); herb.name = 'LS_Herb'; herb.position.set(base.x, LOG_R - LOG_IN + 0.005, northZ + 0.16); root.add(herb);
  const herbMat = soft({ color: dim(1.6), emissive: 0x2bd94a, emissiveIntensity: 0.6 }, 0.6);
  let herbT = 0, herbGlowOn = false;
  {
    const G = newG(), tipC = lin('#c8ff9e'), baseC = lin('#45c25a'), d = V3();
    for (let i = 0; i < 7; i++) {
      const k = i / 6 - 0.5, len = 0.2 - 0.1 * Math.abs(k), fan = k * 1.9;
      d.set(Math.sin(fan), Math.cos(fan), -0.28 - 0.3 * Math.abs(k)).normalize();
      const dx = d.x, dy = d.y, dz = d.z;
      shape(G, 9, 10, tube((t, out) => out.set(dx * len * t, dy * len * t - 0.035 * t * t * Math.abs(k) * 2, dz * len * t - 0.03 * t * t), V3(Math.cos(fan), -Math.sin(fan), 0),
        (t) => [0.02 * Math.pow(Math.sin(PI * Math.pow(t, 0.55)), 0.9) + 0.0005, 0.0075 * Math.pow(1 - t, 0.6) * Math.min(1, t * 8) + 0.0005]), (v) => mixc(baseC, tipC, v));
    }
    herb.add(new THREE.Mesh(toGeo(G), herbMat));
    herbGlow.p.set(herb.position.x, herb.position.y + 0.1, herb.position.z); herbGlow.col.setHex(0x7dff8a);
  }

  // ---------- the Kuns: geometry, built once for a Kun of scale 1 (0.60 m tall, half of it head) ----------
  // Every vertex carries four paint weights (belly, inner ear, line, deep shade); each Kun turns them into its own colours.
  const HIP_Y = 0.09, NECK_Y = 0.305, EYE_X = 0.06, EYE_Y = 0.112, EYE_Z = 0.08, EYE_R = 0.046, ARM_L = 0.185, LEG_L = 0.062, HAND_Y = 0.335;
  const headProf = curve([[0, 0, 0], [0.062, 0.008, 0], [0.105, 0.045, 0], [0.125, 0.1, 0], [0.118, 0.148, -0.004], [0.098, 0.188, -0.014], [0.073, 0.22, -0.031], [0.05, 0.247, -0.054], [0.031, 0.27, -0.08], [0.015, 0.288, -0.105], [0, 0.297, -0.12]]);
  function headAt(v, a, out, lift = 0) {                     // the head: a wide bulb with a soft muzzle, tapering into a crest that sweeps back
    const vt = clamp(v, 0.04, 0.96), [, y1, z1] = headProf(vt - 0.02), [, y2, z2] = headProf(vt + 0.02), [r, y, zc] = headProf(v);
    const tl = Math.hypot(y2 - y1, z2 - z1), ty = (y2 - y1) / tl, tz = (z2 - z1) / tl, ca = Math.cos(a), bulb = Math.exp(-(((y - 0.066) / 0.046) ** 2)) * sstep(0, 0.07, r);
    const front = (r + lift) * ca * (0.9 + 0.04 * ca) + 0.02 * bulb * Math.max(0, ca) ** 2;
    return out.set((r + lift) * Math.sin(a) * (1 + 0.05 * bulb), y - tz * front, zc + ty * front);
  }
  const KG = { head: newG(), body: newG(), lids: newG(), eyes: newG(true) };
  shape(KG.head, 26, 32, headAt, (v, a, p) => [0.55 * Math.exp(-(((p.y - 0.055) / 0.042) ** 2)) * sstep(0, 0.8, Math.cos(a)), 0, 0, 0.5 * sstep(0.17, 0.297, p.y) + 0.35 * sstep(0.035, 0, p.y)]);
  for (const s of [-1, 1]) {                                 // leaf-shaped ears, cupped forwards, darker inside
    const dir = V3(0.84 * s, 0.46, -0.28).normalize(), ref = V3(-0.4 * s, 1, 0.2);
    const leaf = (t) => Math.pow(Math.sin(PI * Math.pow(t, 0.62)), 0.8);
    shape(KG.head, 14, 12, tube((t, out) => out.set(0.092 * s, 0.128 + 0.03 * Math.sin(PI * t * 0.9), -0.012).addScaledVector(dir, 0.22 * t), ref,
      (t) => { const w = 0.054 * leaf(t); return [w, Math.min(w * 0.55, 0.0125 * (1 - 0.5 * t))]; },
      (out, v, ca, sa, T, N, B, r) => out.addScaledVector(B, s * 0.38 * r[0] * ca * ca)),
    (v, a) => [0, sstep(0.15, 0.7, s * Math.sin(a)) * sstep(0.97, 0.45, Math.abs(Math.cos(a))) * sstep(0.1, 0.24, v) * sstep(0.99, 0.8, v), 0, 0.3 * sstep(0.5, 1, v)]);
  }
  {                                                          // a tiny smile drawn on the muzzle
    let vm = 0.2; for (let lo = 0, hi = 0.4, i = 0; i < 20; i++) { vm = (lo + hi) / 2; if (headProf(vm)[1] < 0.05) lo = vm; else hi = vm; }
    shape(KG.head, 10, 5, tube((t, out) => headAt(vm + 0.03 * (2 * t - 1) ** 2, (t - 0.5) * 0.66, out, 0.0006), UP, (t) => { const r = 0.0036 * Math.pow(Math.sin(PI * t), 0.5) + 0.0002; return [r, r]; }), [0, 0, 1, 0]);
  }
  {
    const prof = curve([[0, -0.022], [0.05, -0.018], [0.082, 0.02], [0.09, 0.065], [0.08, 0.115], [0.062, 0.158], [0.046, 0.192], [0.036, 0.212], [0, 0.222]]);
    shape(KG.body, 16, 24, (v, a, out) => { const [r, y] = prof(v), ca = Math.cos(a); return out.set(r * Math.sin(a), y, r * ca * (1.015 + 0.085 * ca)); },   // a pear with a pale belly
      (v, a, p) => [sstep(1, 0.62, Math.hypot(Math.atan2(Math.sin(a), Math.cos(a)) / 1.15, (p.y - 0.062) / 0.085)), 0, 0, 0.3 * sstep(0.03, -0.022, p.y)]);
  }
  for (const s of [-1, 1]) {
    // eyes: spheres about the eye pivot; the texture is projected along the pupil axis (turned 12 degrees outwards)
    const fx = Math.sin(0.2 * s), fz = Math.cos(0.2 * s);
    shape(KG.eyes, 10, 20, (v, a, out) => out.set(EYE_X * s + EYE_R * Math.sin(v * PI) * Math.sin(a), EYE_R * Math.cos(v * PI), EYE_R * Math.sin(v * PI) * Math.cos(a)), [], false,
      (v, a, p) => [0.5 - 0.485 * ((p.x - EYE_X * s) * fz - p.z * fx) / EYE_R, 0.5 + 0.485 * p.y / EYE_R]);
    // upper lids: caps a little bigger than the eye, turned about the line through both eyes
    shape(KG.lids, 6, 16, (v, a, out) => {
      const th = Math.min(v, 0.84) / 0.84 * 1.45, R = EYE_R * (1.075 - Math.max(0, v - 0.84) * 0.56);
      return out.set(EYE_X * s + R * Math.sin(th) * Math.sin(a), R * Math.cos(th), R * Math.sin(th) * Math.cos(a));
    }, [0, 0, 0, 0.3], true);
  }
  // Arms and legs are soft tubes, rebuilt every frame in world space (one mesh per Kun); the feet are rigid and are copied in.
  const LM = 10, COS = [], SIN = [];
  for (let k = 0; k < LM; k++) { COS.push(Math.cos(k / LM * PI * 2)); SIN.push(Math.sin(k / LM * PI * 2)); }
  function limbSpec(rs, blob, tip, len) {                    // radii along the limb, then [distance past the end, radius] rings of its end blob
    const n = rs.length + blob.length, t = [], d = [], r = [], slope = [];
    rs.forEach((x, i) => { t.push(i / (rs.length - 1)); d.push(0); r.push(x); });
    for (const [dd, x] of blob) { t.push(1); d.push(dd); r.push(x); }
    const s = t.map((x, i) => x * len + d[i]);
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); slope.push(i === n - 1 && tip ? -r[a] / (len + tip - s[a]) : (r[b] - r[a]) / (s[b] - s[a])); }
    return { n, t, d, r, slope, tip, len, nv: n * LM + (tip ? 1 : 0) };
  }
  const ARM = limbSpec([0.024, 0.022, 0.02, 0.0185, 0.018, 0.0185, 0.02], [[0.004, 0.0225], [0.015, 0.0265], [0.028, 0.0255], [0.039, 0.018], [0.045, 0.009]], 0.0475, ARM_L);
  const LEG = limbSpec([0.036, 0.033, 0.029, 0.026, 0.025], [], 0, LEG_L);
  const FOOT = (() => {                                      // a plump foot with three toes; +Z = forwards, origin on the ground under the ankle
    const G = newG(), ball = (cx, cy, cz, rx, ry, rz, rows, m) => shape(G, rows, m, (v, a, out) => out.set(cx + rx * Math.sin(v * PI) * Math.sin(a), Math.max(0.0008, cy - ry * Math.cos(v * PI)), cz + rz * Math.sin(v * PI) * Math.cos(a)), []);
    ball(0, 0.0165, 0.012, 0.029, 0.0175, 0.042, 6, 10);
    for (const x of [-0.018, 0, 0.018]) ball(x, 0.0105, x ? 0.046 : 0.054, 0.0118, 0.0105, 0.0155, 4, 8);
    return { p: G.p, n: G.n, i: G.i, nv: G.p.length / 3 };
  })();
  const LIMB_W = (() => {                                    // paint weights of the limb mesh: [arm, arm, leg, leg, foot, foot]
    const w = [];
    for (const sp of [ARM, ARM]) for (let v = 0; v < sp.nv; v++) w.push(v >= 7 * LM ? 0.3 : 0, 0, 0, 0);
    for (let v = 0; v < 2 * LEG.nv; v++) w.push(0, 0, 0, 0.25);
    for (let v = 0; v < 2 * FOOT.nv; v++) w.push(0, 0, 0, 0.4);
    return w;
  })();
  const LIMB_I = (() => {
    const idx = []; let o = 0;
    for (const sp of [ARM, ARM, LEG, LEG]) {
      for (let i = 0; i + 1 < sp.n; i++) for (let k = 0; k < LM; k++) { const a = o + i * LM + k, b = o + i * LM + (k + 1) % LM; idx.push(a, b, a + LM, b, b + LM, a + LM); }
      if (sp.tip) for (let k = 0; k < LM; k++) idx.push(o + (sp.n - 1) * LM + k, o + (sp.n - 1) * LM + (k + 1) % LM, o + sp.n * LM);
      o += sp.nv;
    }
    for (let f = 0; f < 2; f++, o += FOOT.nv) for (const i of FOOT.i) idx.push(o + i);
    return idx;
  })();
  const LIMB_NV = 2 * ARM.nv + 2 * LEG.nv + 2 * FOOT.nv;
  function paint(W, pal) {                                   // paint weights -> this Kun's colours
    const out = new Float32Array(W.length / 4 * 3), sk = pal.skin, cs = [pal.belly, pal.ear, pal.line, pal.deep];
    for (let v = 0, o = 0; v < W.length; v += 4, o += 3) {
      let r = sk[0], g = sk[1], b = sk[2];
      for (let k = 0; k < 4; k++) { const w = W[v + k]; r += (cs[k][0] - sk[0]) * w; g += (cs[k][1] - sk[1]) * w; b += (cs[k][2] - sk[2]) * w; }
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
    return out;
  }
  const PALS = [
    { skin: '#7ecb3a', belly: '#b6e36a', ear: '#5aa82c', line: '#2f6e25', deep: '#58ab33', eye: ['#ff8a1e', '#ffd23f', '#b8430c', '#2b1004'] },
    { skin: '#f0c531', belly: '#f8e58a', ear: '#d89b1c', line: '#8a5a10', deep: '#dea622', eye: ['#6fc3ff', '#d2f1ff', '#2c6cc4', '#0b1a36'] },
  ].map((p) => ({
    skin: lin(p.skin), belly: lin(p.belly), ear: lin(p.ear), line: lin(p.line), deep: lin(p.deep),
    mat: soft({ emissive: new THREE.Color(p.skin).multiplyScalar(0.1) }, 0.6),
    eyeMat: (() => { const t = eyeTex(...p.eye); return new THREE.MeshLambertMaterial({ map: t, color: dim(1.2), emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25 }); })(),
  }));
  const kunGeo = {};
  for (const k of ['head', 'body', 'lids']) { const g0 = toGeo(KG[k], paint(KG[k].c, PALS[0])); kunGeo[k] = [g0, toGeo(KG[k], paint(KG[k].c, PALS[1]), g0)]; }
  kunGeo.eyes = toGeo(KG.eyes);

  function makeKun(name, scale, footIdx, ph, pi) {
    const pal = PALS[pi], add = (geo, mat, parent, cast) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
    const g = { name, scale, footIdx, ph, pos: V3(), dest: V3(), yaw: 0, face: 0, v: 0, pace: 0.9, walk: 0, mode: 'hidden', mt: 0, lean: 0, pitch: 0, hyaw: 0, lookYaw: 0, lookPitch: 0,
      lid: 0.88, blink: 1.5 + footIdx * 0.8 + ph * 0.21, blinkN: footIdx * 2, tau: 0, sb: 0, off: 0, grow: 0, spark: 0, fArm: footIdx, fdir: V3(0.7, -0.4, 0.5).normalize(), tip: V3(),
      j: footIdx, gy: 0, tk: 0, lph: ph * 0.13, from: V3(), fl: FEATHER_L * FEATHER_FS, fs: FEATHER_FS };      // gy: the height of what he stands on; tk, lph: tongue out, lick phase; fl, fs: his feather
    const rootG = g.root = new THREE.Group(); rootG.name = 'LS_Kun_' + name; rootG.scale.setScalar(scale); rootG.visible = false; root.add(rootG);
    const body = g.body = new THREE.Group(); body.position.y = HIP_Y; rootG.add(body);                  // leans about the hips
    add(kunGeo.body[pi], pal.mat, body, true);
    const head = g.head = new THREE.Group(); head.position.set(0, NECK_Y - HIP_Y, 0.004); body.add(head);
    add(kunGeo.head[pi], pal.mat, head, true);
    add(kunGeo.eyes, pal.eyeMat, head, false).position.set(0, EYE_Y, EYE_Z);
    g.lids = add(kunGeo.lids[pi], pal.mat, head, false); g.lids.position.set(0, EYE_Y, EYE_Z);
    // limbs: world-space vertices, rewritten every frame
    const geo = new THREE.BufferGeometry();
    g.lpos = new Float32Array(LIMB_NV * 3); g.lnor = new Float32Array(LIMB_NV * 3);
    for (const [k, arr] of [['position', g.lpos], ['normal', g.lnor]]) { const at = new THREE.BufferAttribute(arr, 3); at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at); }
    geo.setAttribute('color', new THREE.BufferAttribute(paint(LIMB_W, pal), 3)); geo.setIndex(LIMB_I);
    geo.boundingSphere = new THREE.Sphere(V3(base.x + 1.7, 0.3, base.z + 1.7), 4.6);                    // the whole way from the bushes to the log
    g.limbGeo = geo; g.limbs = add(geo, pal.mat, root, true); g.limbs.visible = false; g.limbs.name = 'LS_KunLimbs_' + name;
    let o = 0; const off = (sp) => { const x = o; o += sp.nv; return x; };
    g.arms = [-1, 1].map((s) => ({ s, off: off(ARM), cur: V3(s * REST[0], REST[1], REST[2]), from: V3(), bt: 1, kind: 0, hand: V3(), bp: V3(0, 0, 1) }));
    g.legs = [-1, 1].map((s) => ({ s, off: off(LEG), bp: V3(1, 0, 0), foot: 0 }));
    for (const l of g.legs) l.foot = off(FOOT);
    return g;
  }

  // ---------- feathers: pink and fluffy; a soft vane with a few splits and a downy base; tip at local (0, L, 0) ----------
  const FEATHER_L = 0.3, FEATHER_FS = 0.44;                  // the feather as modelled, and how much of that size a Kun's feather is
  const featherGeo = (() => {
    const G = newG(), L = FEATHER_L, spine = (t, out) => out.set(0.2 * L * t * (1 - t), L * t, 0), Z = V3(0, 0, 1);
    const hot = lin('#ff5fa9'), pale = lin('#ffb3da'), down = lin('#ffe1f0'), quill = lin('#fff3f8');
    const notch = (t, at) => { let k = 1; for (const [c, w, d] of at) k *= 1 - d * Math.exp(-(((t - c) / w) ** 2)); return k; };
    const SPLIT = [[[0.47, 0.011, 0.5], [0.74, 0.01, 0.45]], [[0.38, 0.011, 0.45], [0.62, 0.011, 0.5], [0.84, 0.009, 0.4]]];
    const width = (t, side) => {                             // half-width of the vane: bare quill, three puffs of down, then the blade with its splits
      if (t < 0.13) return 0.0035;
      const blade = 0.05 * Math.pow(Math.sin(PI * Math.pow((t - 0.13) / 0.87, 0.62)), 0.62) * notch(t, SPLIT[side]);
      return 0.0035 + blade * (t < 0.3 ? 0.7 + 0.25 * Math.abs(Math.sin((t - 0.13) / 0.17 * PI * 3)) : 1);
    };
    shape(G, 48, 12, tube((t, out) => spine(0.13 + 0.87 * t, out), V3(1, 0, 0),
      (t) => [0, 0.0016 + 0.004 * sstep(0.22, 0, t) + 0.0012 * Math.sin(PI * t)],
      (out, t, ca, sa, T, N) => {                            // each side has its own width, and the barbs sweep towards the tip
        const w = width(0.13 + 0.87 * t, ca > 0 ? 0 : 1) * Math.min(1, t * 40, (1 - t) * 40), k = Math.abs(ca) ** 0.8 * Math.sign(ca);
        out.addScaledVector(N, w * k).addScaledVector(T, Math.abs(k) * w * 0.4 * (1 - t * 0.7)); out.z += 0.16 * w * k * k;
      }),
    (v, a) => { const e = Math.abs(Math.cos(a)); return mixc(v < 0.2 ? mixc(down, hot, sstep(0.05, 0.2, v)) : hot, v < 0.2 ? down : pale, e * e * (0.55 + 0.45 * v)); });
    shape(G, 12, 6, tube((t, out) => spine(t * 0.97, out), Z, (t) => { const r = 0.0038 * (1 - 0.72 * t) * Math.min(1, t * 30 + 0.2); return [r, r]; }), quill);
    return toGeo(G);
  })();
  const featherMat = soft({ color: dim(1.15), emissive: 0x5a1238, emissiveIntensity: 0.9 }, 0.5);
  function makeFeather(name) {
    const f = new THREE.Mesh(featherGeo, featherMat); f.name = name; f.visible = false; f.castShadow = true; root.add(f); return f;
  }

  // ---------- loose heel props (local +Z = toe, local -Y = outsole, origin on the footbed) ----------
  const findMat = (re) => {
    let r = null;
    anne.traverse((o) => { if (!r && o.isMesh) for (const m of [].concat(o.material)) if (m && re.test(m.name || '')) { r = m; break; } });
    return r;
  };
  const anneHeel = findMat(/HeelPurple/i), anneSole = findMat(/HeelSole/i);
  const heelMat = (anneHeel || findMat(/Purple/i))?.clone() || new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.2, 0.04, 0.46) });
  const soleMat = anneSole?.clone() || new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.05, 0.01, 0.1) });
  const heelMatDS = heelMat.clone(); heelMatDS.side = THREE.DoubleSide;
  const soleMatDS = soleMat.clone(); soleMatDS.side = THREE.DoubleSide;
  function makeHeelProp(name, left) {
    const g = new THREE.Group(); g.name = name; g.visible = false;
    let lift = 0.012;                          // how far outside the sole skin the origin starts
    if (ctx.heelProp) {
      // The host's real shoe (anne2_heel_prop.glb): a RIGHT shoe standing on y = 0 with its toe along +Z, in whichever
      // style she wears (fitProp lays it in the group)
      const shoe = ctx.heelProp.clone(true);
      shoe.position.set(0, 0, 0); shoe.rotation.set(0, 0, 0); shoe.scale.set(left ? -1 : 1, 1, 1);
      shoe.traverse((o) => {
        if (!o.isMesh) return;
        shadowy(o);
        // (10-03) it keeps the prop's own materials: they are the ones the shoe colour chooser updates (anne_next.js
        // setShoeColor) and are already two-sided; the copies made here at load time stayed the default purple
      });
      g.add(shoe); lift = 0.004;
    } else {                                   // no real mesh from the host: a simple, rounded stand-in
      const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0) => { const m = shadowy(new THREE.Mesh(geo, mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; g.add(m); };
      const ball = new THREE.SphereGeometry(1, 20, 12);
      add(ball, soleMat, 0, -0.005, 0, 0.037, 0.008, 0.118); add(ball, heelMat, 0, 0.012, 0.06, 0.037, 0.03, 0.062); add(ball, heelMat, 0, 0.02, -0.085, 0.036, 0.034, 0.034);
      add(new THREE.CylinderGeometry(0.011, 0.005, 0.09, 12), heelMat, 0, -0.05, -0.095, 1, 1, 1, 0.12);
    }
    root.add(g);
    return { obj: g, lift, left, nb: new THREE.Box3(), mid: V3(), restY: 0.045 };
  }
  const props = [['R', false], ['L', true]].map(([s, left]) => ({ ...makeHeelProp('LS_Heel_' + s, left), pos: V3(), vel: V3(), axis: V3(1, 0, 0), spin: 0, state: 'off', bounces: 0, rest: new THREE.Quaternion(), lie: 'side' }));
  // (10-03) The shoes LIE on the ground, never half sunk: each style has its own shape (anne_next setShoeStyle swaps
  // the geometry every copy shares), so a shoe is fitted again whenever it leaves her foot. In the group the footbed
  // lies along +Z through the origin, outsole down (-Y), so it leaves the foot from where the worn one sat: a high
  // heel's footbed climbs from the ball (70% of its length from the back, 22% of its height) to the heel seat (15%,
  // 68%); a flat one lies 1.5 cm up. p.nb: the shoe's own box (toe +Z, standing on y = 0); p.mid: its point at the origin.
  const fA = V3(), fB = V3(), fC = V3(), fQ = new THREE.Quaternion(), fR = new THREE.Quaternion(), fX = V3(1, 0, 0), fZ = V3(0, 0, 1);
  function fitProp(p) {
    const shoe = p.obj.children[0];
    if (!ctx.heelProp || !shoe || p.obj.children.length !== 1) { p.nb.set(fA.set(-0.037, -0.14, -0.13), fB.set(0.037, 0.055, 0.12)); p.mid.set(0, 0, 0); return; }   // (the stand-in)
    ctx.heelProp.updateMatrixWorld(true); p.nb.setFromObject(ctx.heelProp, true);
    if (p.left) { const a = -p.nb.max.x; p.nb.max.x = -p.nb.min.x; p.nb.min.x = a; }        // (mirrored)
    const b = p.nb, sz = b.getSize(fC), hi = !!(ctx.heelStyle && ctx.heelStyle());
    fA.set(0, b.min.y + (hi ? 0.68 * sz.y : 0.015), b.min.z + 0.15 * sz.z); fB.set(0, b.min.y + (hi ? 0.22 * sz.y : 0.015), b.min.z + 0.7 * sz.z);
    shoe.rotation.set(-Math.atan2(fA.y - fB.y, fB.z - fA.z), 0, 0);
    p.mid.addVectors(fA, fB).multiplyScalar(0.5);
    shoe.position.copy(p.mid).applyEuler(shoe.rotation).negate();
  }
  // How it lies: 'up' on its sole, or 'side' rolled onto its outer side; its toe along `yaw`. -> q, and the height its
  // origin rests at (returned). (Seen from the shoe, +X is its wearer's left: a right shoe's outer side is -X.)
  function lieQ(p, lie, yaw, q) {
    const shoe = p.obj.children[0], b = p.nb, s = p.left ? -1 : 1;
    fQ.setFromAxisAngle(fX, shoe ? -shoe.rotation.x : 0);                  // the footbed's tilt undone: the shoe as it stands
    let y;
    if (lie === 'side') { fR.setFromAxisAngle(fZ, s * PI / 2); y = s > 0 ? p.mid.x - b.min.x : b.max.x - p.mid.x; }
    else { fR.identity(); y = p.mid.y - b.min.y; }
    q.setFromAxisAngle(UP, yaw).multiply(fR).multiply(fQ);
    return y + 0.002;
  }
  function restPose(p, lie, yaw) { p.lie = lie; p.restY = lieQ(p, lie, yaw, p.rest); }
  function lowY(p, q) {                          // how far below its origin the shoe reaches, turned by q (its box's corners)
    const b = p.nb, shoe = p.obj.children[0]; let lo = 0;
    fQ.setFromAxisAngle(fX, shoe ? shoe.rotation.x : 0); fR.copy(q).multiply(fQ);
    for (let i = 0; i < 8; i++) { fC.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(p.mid).applyQuaternion(fR); lo = Math.min(lo, fC.y); }
    return -lo;
  }
  const wX = V3(), wY = V3(), wZ = V3(), wM = new THREE.Matrix4();
  function wearPose(p, f, P, Q) {                // the shoe as it sits on that foot (as it left it): position P, rotation Q
    P.addVectors(f.heel, f.ball).multiplyScalar(0.5).addScaledVector(f.n, p.lift);
    wZ.subVectors(f.ball, f.heel); wZ.addScaledVector(f.n, -wZ.dot(f.n));
    if (wZ.lengthSq() < 1e-8) wZ.set(0, 1, 0).addScaledVector(f.n, -f.n.y);
    wZ.normalize(); wY.copy(f.n).negate(); wX.crossVectors(wY, wZ);           // x = y × z, outsole (-Y) along the sole normal
    wM.makeBasis(wX, wY, wZ); Q.setFromRotationMatrix(wM);
  }
  props.forEach(fitProp);

  // ---------- the stolen coin pouch: a soft sack tied with a cord, coins peeping out ----------
  const pouch = new THREE.Group(); pouch.name = 'LS_Pouch'; pouch.visible = false; root.add(pouch);
  {
    const G = newG(), sackP = curve([[0, 0], [0.046, 0.004], [0.071, 0.034], [0.073, 0.066], [0.06, 0.096], [0.036, 0.113], [0.041, 0.12], [0.04, 0.127], [0.031, 0.133], [0.04, 0.146], [0.051, 0.158], [0.04, 0.156], [0, 0.146]]);
    const sackA = lin('#b07a45'), sackB = lin('#7c5230'), cord = lin('#f0d68c'), dark = lin('#3a2616'), gold = lin('#ffd24a'), goldB = lin('#e2a51e');
    shape(G, 28, 20, (v, a, out) => { const [r, y] = sackP(v); const k = r * (1 + 0.1 * Math.sin(6 * a) * sstep(0.128, 0.15, y)); return out.set(k * Math.sin(a), y, k * Math.cos(a)); },
      (v, a, p) => (v > 0.9 ? dark : p.y > 0.114 && p.y < 0.131 ? cord : mixc(sackB, sackA, sstep(0, 0.1, p.y) * (0.75 + 0.25 * Math.sin(a + 1)))));
    const coinP = curve([[0, 0.0034], [0.017, 0.0034], [0.0205, 0.002], [0.0215, 0], [0.0205, -0.002], [0.017, -0.0034], [0, -0.0034]]), mat = new THREE.Matrix4(), eu = new THREE.Euler(), f0 = lathe(coinP);
    for (const [x, y, z, rx, rz] of [[0.01, 0.158, 0, 1.0, 0.25], [-0.014, 0.155, 0.008, 1.25, -0.45], [0.004, 0.153, -0.014, 0.5, 0.7], [-0.004, 0.164, -0.002, 1.5, 1.9]]) {
      mat.makeRotationFromEuler(eu.set(rx, 0, rz)).setPosition(x, y, z);
      shape(G, 6, 12, (v, a, out) => f0(v, a, out).applyMatrix4(mat), (v) => mixc(gold, goldB, sstep(0.3, 0.1, Math.abs(v - 0.5))));
    }
    const m = new THREE.Mesh(toGeo(G), soft({ emissive: 0x241505 }, 0.4)); m.castShadow = true; pouch.add(m);
  }

  const feet = ['R', 'L'].map((s) => ({ s, names: ['Heel', 'Arch', 'Ball', 'Out'].map((k) => `Sole_${s}_${k}`), heel: V3(), arch: V3(), ball: V3(), out: V3(), n: V3(), lat: V3(), away: V3(), dirOut: V3(),
    // the same frame, smoothed (two passes): what the Kuns and the camera work from, so that her kicking does not shake them
    m1: [V3(), V3(), V3(), V3()], sHeel: V3(), sArch: V3(), sBall: V3(), sOutM: V3(), sn: V3(0, 0, 1), sSide: V3(1, 0, 0), sAway: V3(0, 0, 1), sOut: V3(1, 0, 0) }));
  for (const f of feet) { f.real = [f.heel, f.arch, f.ball, f.out]; f.sm = [f.sHeel, f.sArch, f.sBall, f.sOutM]; }
  const REST = [0.112, 0.118, 0.03];                         // a hand hanging at the side (root space, x mirrored)
  // Small, as in the 2D game (about as tall as her foot is long): A (green, 0.20 m) works the RIGHT sole, B (yellow,
  // 0.19 m) the LEFT, C (green, 0.17 m) rides on her calves and holds the cord. (10-03) D (yellow, 0.17 m) makes off
  // with one of her shoes, lays it on its side by her right calf and licks its sole while the others carry on.
  const kuns = [makeKun('A', 0.34, 0, 0, 0), makeKun('B', 0.32, 1, 1.7, 1), makeKun('C', 0.29, 0, 3.1, 0), makeKun('D', 0.29, 0, 4.4, 1)];
  const KA = kuns[0], KB = kuns[1], KC = kuns[2], KD = kuns[3], PAIR = [KA, KB];
  for (const g of kuns) g.feather = makeFeather('LS_Feather_' + g.name);

  // ---------- the ties: a cord wound round both ankles, a string round both big toes, pegged down taut ----------
  // All of it follows her bones every frame and lies on her skin with a little air: nothing cuts into her.
  const BN = { shin: ['lowerleg02R', 'lowerleg02L'], foot: ['footR', 'footL'], toe: ['toe1-1R', 'toe1-1L'] };
  for (const k in BN) BN[k] = BN[k].map((n) => anne.getObjectByName(n) || null);
  const TIES_OK = Object.values(BN).every((a) => a.every(Boolean));
  if (!TIES_OK) console.warn('[logscene] leg bones not found: no ties');
  const NOFLEE = /[?&]noflee\b/.test(location.search);       // (tests) the Kuns stay where they cower
  const TIE_HOLD = +(new URLSearchParams(location.search).get('tieph') || -1), TIE_HOLD_AT = +(new URLSearchParams(location.search).get('tieat') || 0.8);      // (tests)
  const TIE = { on: false, k: 0, knot: 0, toe: 0, peg: 0, taut: 0, hold: 0 };     // how much of each is there (0..1); hold: C has the cord's end
  const ROPE_A = lin('#d9b574'), ROPE_B = lin('#9a7440');
  const ropeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#c9a262').multiplyScalar(0.85), side: THREE.DoubleSide });
  const stringMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#7d5126').multiplyScalar(0.9), side: THREE.DoubleSide });      // dark twine: it has to show on her skin
  const woodMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#8a6238').multiplyScalar(0.8) });
  // The cord: a helix of CT turns round BOTH shins, 3 to 8 cm above the ankle joints. RU, RV: how far its centre line
  // stands off a shin's axis across and front-to-back (her shins measure 1.7 by 2.4 cm there; the cord is C_R thick).
  const CT = 4.5, CSEG = 22, CS = 7, CN = Math.round(CT * CSEG) + 1, C_R = 0.0044, RU = 0.0235, RV = 0.0305;
  const cord = (() => {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(CN * CS * 3), nor = new Float32Array(CN * CS * 3), col = new Float32Array(CN * CS * 3), idx = [];
    for (let i = 0; i < CN; i++) for (let k = 0; k < CS; k++) {
      const c = mixc(ROPE_B, ROPE_A, 0.5 + 0.5 * Math.sin(k / CS * PI * 4 + i * 1.3)), o = (i * CS + k) * 3; col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];   // the twist of its strands
      if (i < CN - 1) { const a = i * CS + k, b = i * CS + (k + 1) % CS; idx.push(a, a + CS, b, b, a + CS, b + CS); }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    const mat = soft({}, 0.5); mat.side = THREE.DoubleSide;
    const m = new THREE.Mesh(geo, mat); m.name = 'LS_AnkleCord'; m.frustumCulled = false; m.castShadow = true; m.visible = false; root.add(m);
    return m;
  })();
  // The frapping turns that cinch the cord between her ankles, and the knot on top (local: x up off her calves, y down the shins, z across)
  const knot = new THREE.Group(); knot.name = 'LS_CordKnot'; knot.visible = false; root.add(knot);
  {
    const tor = new THREE.TorusGeometry(1, 0.118, 7, 28);
    for (const dz of [-0.0045, 0.0045]) { const m = new THREE.Mesh(tor, ropeMat); m.scale.set(RV + C_R + 0.0035, 0.031, 0.037); m.position.z = dz; m.castShadow = true; knot.add(m); }
    const lump = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), ropeMat); lump.scale.set(0.0075, 0.0085, 0.0105); lump.position.set(RV + C_R + 0.0075, 0, 0); knot.add(lump);
    for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0038, 0.04, 6), ropeMat); e.position.set(RV + C_R + 0.012, 0.004, sz * 0.02); e.rotation.set(0.5, 0, sz * 1.15); knot.add(e); }
  }
  // The string round her big toes: a loop on each (her big toe is 2.2 by 1.5 cm at its root; its bone runs off-centre
  // there), a twist between them, and the end that runs to the peg.
  const TOE_OFF = [V3(-0.0036, 0.013, 0.0056), V3(0.0036, 0.013, 0.0056)], TOE_RX = 0.0146, TOE_RZ = 0.0116;      // (bone space: the pad of the toe lies on the bone's +Z side)
  const toeLoopGeo = (() => {                         // two turns, side by side (the loop's own frame: radius 1 in XY, turns stacked along Z)
    const a = new THREE.TorusGeometry(1, 0.15, 6, 26), b = a.clone(); a.translate(0, 0, -0.17); b.translate(0, 0, 0.17);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array, na = a.attributes.normal.array, nb = b.attributes.normal.array, n = pa.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([...na, ...nb], 3));
    g.setIndex([...a.index.array, ...Array.from(b.index.array, (i) => i + n)]); return g;
  })();
  const toeLoops = [0, 1].map((j) => { const m = new THREE.Mesh(toeLoopGeo, stringMat); m.name = 'LS_ToeLoop_' + j; m.visible = false; m.frustumCulled = false; root.add(m); return m; });
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); unitCyl.translate(0, 0.5, 0);      // from the origin along +Y
  const line = (name, mat) => { const m = new THREE.Mesh(unitCyl, mat); m.name = name; m.visible = false; m.frustumCulled = false; root.add(m); return m; };
  const toeTwist = line('LS_ToeTwist', stringMat), toeTail = line('LS_ToeTail', stringMat), cordEnd = line('LS_CordEnd', ropeMat);
  const peg = new THREE.Group(); peg.name = 'LS_Peg'; peg.visible = false; root.add(peg);
  {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.006, 0.1, 9), woodMat); st.position.y = 0.05; st.castShadow = true; peg.add(st);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0105, 0.012, 9), woodMat); cap.position.y = 0.1; peg.add(cap);
  }
  const PEG_UP = 0.058, pegAt = V3(), pegTop = V3();        // how much of the peg stands out of the ground once driven
  const tC = V3(), tU = V3(), tV = V3(), tAx = V3(), tS = V3(), tF0 = V3(), tF1 = V3(), tP = V3(), tQ = V3(), tT = V3(), tN = V3(), tB2 = V3(), tW = V3(), tToe = V3(), tK = V3();
  let tieD = 0.08;
  function tieFrame() {                              // her ankles: the point between them (tC), across from R to L (tU), down the shins (tAx), up off her calves (tV); tS: south along the ground
    if (!TIES_OK) return;
    BN.foot[0].getWorldPosition(tF0); BN.foot[1].getWorldPosition(tF1);
    BN.shin[0].getWorldPosition(_a); BN.shin[1].getWorldPosition(_b);
    tAx.subVectors(tF0, _a).add(_c.subVectors(tF1, _b)).normalize();
    tU.subVectors(tF1, tF0); tieD = tU.length(); tU.addScaledVector(tAx, -tU.dot(tAx)).normalize();
    tV.crossVectors(tAx, tU).normalize(); if (tV.y < 0) tV.negate();
    tC.addVectors(tF0, tF1).multiplyScalar(0.5);
    tS.set(tAx.x, 0, tAx.z); if (tS.lengthSq() < 1e-6) tS.set(0, 0, 1); tS.normalize();
    tW.copy(tC).addScaledVector(tAx, -0.055);        // the middle of the cord's band
    BN.toe[0].getWorldPosition(_a); BN.toe[1].getWorldPosition(_b); tToe.addVectors(_a, _b).multiplyScalar(0.5);
  }
  const cordAt = (q, out) => {                       // the cord's centre line at q in 0..1
    const a = q * CT * PI * 2, ca = Math.cos(a);
    return out.copy(tC).addScaledVector(tAx, -(0.032 + 0.046 * q)).addScaledVector(tU, tieD * 0.5 * Math.tanh(3.2 * ca) + RU * ca).addScaledVector(tV, RV * Math.sin(a));
  };
  const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tx = V3(), _ty = V3(), _tz = V3();
  function span(m, A0, A1, r) {                      // lay a line mesh from A0 to A1
    _ty.subVectors(A1, A0); const len = _ty.length(); if (len < 1e-5) { m.visible = false; return; }
    _ty.divideScalar(len); _tx.set(1, 0, 0); if (Math.abs(_ty.x) > 0.9) _tx.set(0, 0, 1);
    _tz.crossVectors(_tx, _ty).normalize(); _tx.crossVectors(_ty, _tz);
    _tm.makeBasis(_tx, _ty, _tz); m.quaternion.setFromRotationMatrix(_tm); m.position.copy(A0); m.scale.set(r, len, r); m.visible = true;
  }
  function updTies() {
    const on = TIE.on && TIES_OK && stuck;
    if (ctx.anklesTogether) ctx.anklesTogether(on ? Math.min(1, TIE.k * 2) : 0);      // (10-03, as he asked: tied ankles are clamped right next to each other)
    cord.visible = on && TIE.k > 0.01; knot.visible = on && TIE.knot > 0; peg.visible = on && TIE.peg > 0;
    toeLoops[0].visible = toeLoops[1].visible = on && TIE.toe > 0;
    toeTwist.visible = on && TIE.toe > 0.5; toeTail.visible = on && TIE.taut > 0; cordEnd.visible = false;
    if (!on) return;
    tieFrame();
    if (cord.visible) {
      const P = cord.geometry.attributes.position, N = cord.geometry.attributes.normal, pa = P.array, na = N.array, n = Math.max(2, Math.round(1 + TIE.k * (CN - 1)));
      for (let i = 0; i < n; i++) {
        const q = i / (CN - 1); cordAt(q, tP); cordAt(Math.min(1, q + 0.004), tQ).sub(cordAt(Math.max(0, q - 0.004), tT)); tQ.normalize();
        tN.copy(tAx).addScaledVector(tQ, -tAx.dot(tQ)).normalize(); tB2.crossVectors(tQ, tN);
        const r = C_R * Math.min(1, 0.45 + (n - 1 - i) * 0.4, 0.45 + i * 0.4);                           // its two ends taper
        for (let k = 0; k < CS; k++) {
          const an = k / CS * PI * 2, cx = Math.cos(an), sx = Math.sin(an), o = (i * CS + k) * 3, nx = tN.x * cx + tB2.x * sx, ny = tN.y * cx + tB2.y * sx, nz = tN.z * cx + tB2.z * sx;
          pa[o] = tP.x + nx * r; pa[o + 1] = tP.y + ny * r; pa[o + 2] = tP.z + nz * r; na[o] = nx; na[o + 1] = ny; na[o + 2] = nz;
        }
      }
      cord.geometry.setDrawRange(0, (n - 1) * CS * 6); P.needsUpdate = true; N.needsUpdate = true;
    }
    if (knot.visible) {
      _tz.crossVectors(tV, tAx).normalize(); _tm.makeBasis(tV, tAx, _tz); knot.quaternion.setFromRotationMatrix(_tm);
      knot.position.copy(tW); knot.scale.setScalar(1 + 0.25 * (1 - TIE.knot));
      cordAt(1, tK).addScaledVector(tV, 0.004);      // where the cord's free end leaves the band
      if (TIE.hold > 0 && KC.mode === 'ride') { cordEnd.visible = true; span(cordEnd, tK, KC.arms[0].hand, C_R * 0.8); }
    }
    if (toeLoops[0].visible) {
      for (let j = 0; j < 2; j++) {
        const b = BN.toe[j], m = toeLoops[j], k = 1 + 0.8 * (1 - TIE.toe);
        b.getWorldQuaternion(_tq); m.quaternion.copy(_tq).multiply(_q.setFromAxisAngle(_tx.set(1, 0, 0), PI / 2));      // the loop's plane across the toe
        b.localToWorld(m.position.copy(TOE_OFF[j])); m.scale.set(TOE_RX * k, TOE_RZ * k, 0.0125);
      }
      if (toeTwist.visible) span(toeTwist, toeLoops[0].position, toeLoops[1].position, 0.0024);
      if (toeTail.visible) { tP.addVectors(toeLoops[0].position, toeLoops[1].position).multiplyScalar(0.5); span(toeTail, tP, pegTop, 0.002); }
    }
    if (peg.visible) { peg.position.copy(pegAt); peg.position.y = PEG_UP - 0.1 + 0.06 * (1 - TIE.peg); }
  }
  function placePeg() {                              // a hand's breadth beyond her toes; it leans away from the pull
    tieFrame(); pegAt.set(tToe.x + tS.x * 0.17, 0, tToe.z + tS.z * 0.17);
    peg.rotation.set(0, 0, 0); peg.quaternion.setFromAxisAngle(_tx.set(tS.z, 0, -tS.x), 0.3);
    pegTop.copy(pegAt).addScaledVector(tS, 0.012); pegTop.y = PEG_UP - 0.016;
  }
  function burstTies() {                             // she tears herself free: the cord and the string fly apart
    if (TIE.on && TIES_OK) { tieFrame(); emit('dust', tW, 6, 0.07); emit('leaf', tToe, 4, 0.08); emit('dust', pegAt, 3, 0.05); }
    TIE.on = false; TIE.hold = 0;
  }

  // ---------- UI ----------
  const CSS = `
.ls-hud { position: fixed; top: 12px; right: 16px; z-index: 3; padding: 6px 12px; font: 14px/1.5 Georgia, serif; color: #f4ecd8; text-align: right;
  background: linear-gradient(180deg, rgba(44,30,96,.78), rgba(20,13,50,.82)); border: 1px solid #c9a24a; border-radius: 6px; text-shadow: 0 1px 2px #000; pointer-events: none; }
.ls-hud b { color: #c9a24a; font-weight: normal; }
.ls-hud b.ls-bad { animation: ls-bad 1s ease-out; }
@keyframes ls-bad { 0%, 50% { color: #ff6b5e; } }
.ls-fade, .ls-flash { position: fixed; inset: 0; opacity: 0; pointer-events: none; z-index: 2; background: #000; }
.ls-flash { background: #d0201a; }
.ls-dlg { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(900px, 94vw); box-sizing: border-box; display: none; gap: 16px;
  align-items: flex-start; padding: 12px 18px 14px 12px; z-index: 3; color: #f4ecd8; font-family: Georgia, serif; cursor: pointer; user-select: none;
  background: linear-gradient(180deg, rgba(52,36,112,.93), rgba(20,13,52,.95)); border: 2px solid #c9a24a; border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,236,190,.08); }
.ls-dlg.ls-on { display: flex; }
.ls-face { flex: 0 0 144px; width: 144px; height: 144px; background-repeat: no-repeat; image-rendering: auto; border-radius: 4px;
  background-color: rgba(0,0,0,.25); box-shadow: inset 0 0 0 1px rgba(201,162,74,.55); }
.ls-body { flex: 1 1 auto; min-width: 0; padding-top: 2px; }
.ls-name { display: inline-block; margin-bottom: 8px; padding: 0 10px 1px 2px; color: #c9a24a; font-size: 17px; letter-spacing: .06em; border-bottom: 1px solid rgba(201,162,74,.6); }
.ls-text { font-size: 20px; line-height: 1.45; overflow-wrap: anywhere; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.ls-text .ls-rest { visibility: hidden; }
.ls-next { position: absolute; right: 14px; bottom: 8px; color: #c9a24a; font-size: 14px; visibility: hidden; }
.ls-dlg.ls-done .ls-next { visibility: visible; animation: ls-blink 1s steps(1) infinite; }
@keyframes ls-blink { 50% { opacity: 0; } }
.ls-choice { position: fixed; z-index: 3; display: none; min-width: 170px; max-width: 80vw; box-sizing: border-box; padding: 6px; font: 18px/1.3 Georgia, serif;
  color: #f4ecd8; background: linear-gradient(180deg, rgba(52,36,112,.95), rgba(20,13,52,.96)); border: 2px solid #c9a24a; border-radius: 6px;
  box-shadow: 0 6px 22px rgba(0,0,0,.5); user-select: none; }
.ls-choice.ls-on { display: block; }
.ls-opt { position: relative; padding: 6px 14px 6px 30px; border-radius: 4px; cursor: pointer; }
.ls-opt.ls-sel { background: rgba(201,162,74,.18); color: #fff3cf; }
.ls-opt.ls-sel::before { content: '\\25B6'; position: absolute; left: 9px; top: 9px; color: #c9a24a; font-size: 12px; }
.ls-gauge { position: fixed; left: 50%; top: 16%; transform: translateX(-50%); width: min(60vw, 520px); box-sizing: border-box; z-index: 3; display: none;
  padding: 12px 16px 12px; text-align: center; font-family: Georgia, serif; color: #f4ecd8; pointer-events: none;
  background: linear-gradient(180deg, rgba(52,36,112,.9), rgba(20,13,52,.92)); border: 2px solid #c9a24a; border-radius: 6px; }
.ls-gauge.ls-on { display: block; }
.ls-glabel { font-size: 17px; margin-bottom: 10px; text-shadow: 0 1px 2px #000; }
.ls-gbar { position: relative; height: 24px; border-radius: 12px; background: #1b1330; overflow: hidden;
  box-shadow: inset 0 0 0 2px rgba(201,162,74,.75), inset 0 3px 8px rgba(0,0,0,.6); }
.ls-gzone { position: absolute; top: 3px; bottom: 3px; border-radius: 3px; background: linear-gradient(180deg, #7ef08a, #2fae4a); box-shadow: 0 0 10px rgba(110,255,140,.6); }
.ls-gmark { position: absolute; top: 0; bottom: 0; width: 6px; margin-left: -3px; border-radius: 3px; background: #fff7dc; box-shadow: 0 0 8px #fff3b0; }
.ls-ground { margin-top: 8px; font-size: 13px; letter-spacing: .08em; color: #c9a24a; }
.ls-gauge.ls-miss .ls-gbar { box-shadow: inset 0 0 0 2px #ff5a4a, 0 0 16px #ff3a2a; }
.ls-gauge.ls-hit .ls-gbar { box-shadow: inset 0 0 0 2px #7ef08a, 0 0 16px #5aff7a; }
@media (max-width: 600px) {
  .ls-dlg { gap: 10px; padding: 8px 12px 12px 8px; bottom: 10px; }
  .ls-face { flex-basis: 84px; width: 84px; height: 84px; }
  .ls-name { font-size: 15px; margin-bottom: 4px; }
  .ls-text { font-size: 16px; }
  .ls-choice { font-size: 16px; }
  .ls-gauge { width: 88vw; top: 12%; }
  .ls-glabel { font-size: 15px; }
  .ls-hud { font-size: 12px; top: 8px; right: 10px; }
}`;
  const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  const el = (cls, parent = document.body, text = '') => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; parent.appendChild(e); return e; };
  const fadeEl = el('ls-fade'), flashEl = el('ls-flash');
  const hud = el('ls-hud'); hud.innerHTML = 'Herbs: <b>0</b><br>Coins: <b>60</b>';
  const [herbsEl, coinsEl] = hud.querySelectorAll('b');
  const dlg = el('ls-dlg'), faceEl = el('ls-face', dlg), bodyEl = el('ls-body', dlg), nameEl = el('ls-name', bodyEl), textEl = el('ls-text', bodyEl);
  const shownEl = document.createElement('span'), restEl = document.createElement('span'); restEl.className = 'ls-rest'; textEl.append(shownEl, restEl);
  const faceCv = document.createElement('canvas'); faceCv.width = faceCv.height = 288;
  faceCv.style.cssText = 'display:block;width:100%;height:100%;border-radius:inherit';
  faceEl.appendChild(faceCv); const faceCx = faceCv.getContext('2d');
  el('ls-next', dlg, '▼');
  const choiceEl = el('ls-choice');
  const gauge = el('ls-gauge'); el('ls-glabel', gauge, 'Press SPACE when the marker is in the green!');
  const gBar = el('ls-gbar', gauge), gZone = el('ls-gzone', gBar), gMark = el('ls-gmark', gBar), gRound = el('ls-ground', gauge);

  let herbs = (ctx.counts && ctx.counts.herbs) || 0, coins = ctx.counts ? ctx.counts.coins : 60, fadeV = 0, flashV = 0, chSel = 0, chN = 0;      // (the story keeps the counts between areas)
  const setHud = () => { herbsEl.textContent = herbs; coinsEl.textContent = coins; if (ctx.onCounts) ctx.onCounts(herbs, coins); };
  herbsEl.textContent = herbs; coinsEl.textContent = coins;
  const setFade = (v) => { fadeV = v; fadeEl.style.opacity = v; };
  const setFlash = (v) => { flashV = v; flashEl.style.opacity = v; };
  function showLine(id, L, text = L[6]) {
    const [url, cols, rows] = SHEETS[L[1]], fi = L[2], bm = BITMAPS[L[1]];
    faceCx.clearRect(0, 0, 288, 288);
    const own = L[0] === A && window.__facePortrait ? window.__facePortrait(L[3] || 'neutral', L[4] || 0) : null;      // (10-04: once the player has changed her look, a portrait made of her as she is: looks.js)
    if (own) { faceCx.drawImage(own, 0, 0, 288, 288); faceEl.style.backgroundImage = 'none'; }
    else if (bm) {
      const cw = bm.width / cols, ch = bm.height / rows;
      faceCx.drawImage(bm, (fi % cols) * cw, Math.floor(fi / cols) * ch, cw, ch, 0, 0, 288, 288);
      faceEl.style.backgroundImage = 'none';
    } else {
      faceEl.style.backgroundImage = `url("${url}")`;
      faceEl.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
      faceEl.style.backgroundPosition = `${(fi % cols) / (cols - 1) * 100}% ${Math.floor(fi / cols) / (rows - 1) * 100}%`;
    }
    nameEl.textContent = L[0] === A && window.__heroName ? window.__heroName() : L[0]; shownEl.textContent = ''; restEl.textContent = text;      // (10-04: her name is the player's)
    dlg.dataset.line = id; dlg.dataset.done = '0'; dlg.classList.remove('ls-done'); dlg.classList.add('ls-on');
  }
  const typeTo = (text, n) => { shownEl.textContent = text.slice(0, n); restEl.textContent = text.slice(n); };
  const lineDone = () => { dlg.classList.add('ls-done'); dlg.dataset.done = '1'; };
  const hideDlg = () => { dlg.classList.remove('ls-on', 'ls-done'); dlg.dataset.line = ''; };
  function placeChoice() {
    const r = dlg.getBoundingClientRect();
    choiceEl.style.right = (r.height ? Math.max(8, innerWidth - r.right) : 16) + 'px';
    choiceEl.style.bottom = (r.height ? innerHeight - r.top + 8 : 200) + 'px';
  }
  const optEls = [], markChoice = () => { for (let i = 0; i < optEls.length; i++) optEls[i].classList.toggle('ls-sel', i === chSel); };
  function fillChoice(labels) {                // the rows are made once (at load, for the script's choice) and reused
    chN = labels.length; chSel = 0;
    for (let i = 0; i < Math.max(chN, optEls.length); i++) {
      if (!optEls[i]) { optEls[i] = el('ls-opt', choiceEl); optEls[i].addEventListener('pointerdown', () => { chSel = i; markChoice(); }); }
      optEls[i].style.display = i < chN ? '' : 'none'; if (i < chN) optEls[i].textContent = labels[i];
    }
    markChoice();
  }
  function showChoice(labels) { fillChoice(labels); choiceEl.classList.add('ls-on'); placeChoice(); }
  const hideChoice = () => choiceEl.classList.remove('ls-on');
  addEventListener('resize', () => { if (choiceEl.classList.contains('ls-on')) placeChoice(); });

  // ---------- input (only while the scene is active; never swallows main's keys) ----------
  let active = false, armed = false, presses = 0, moves = 0, ending = -1;
  const OK_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE']);
  const held = new Set();                      // advance keys that are physically down (finish() waits for them)
  addEventListener('keydown', (e) => {
    if (!active || e.repeat) return;
    const ok = OK_KEYS.has(e.code) || e.key === 'Enter' || e.key === ' ';
    if (ok) held.add(e.code);
    if (!armed) return;
    if (ok) presses++;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') moves--;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moves++;
  });
  addEventListener('keyup', (e) => { held.delete(e.code); });
  addEventListener('blur', () => held.clear());
  addEventListener('pointerdown', (e) => { if (active && armed && e.button === 0) presses++; });

  // ---------- scene state ----------
  let sitting = false, mPhase = 0, mMiss = 0, mT = 0;     // the mimic-shoes scene: 0 worn and asleep, 1 one shoe at it, 2 both
  let stuck = false, snapChest = false, heelsOff = false, pulled = false, trapDone = !!(ctx.counts && ctx.counts.trapDone), misses = 0, cooldown = 0, stompT = 0;
  let lastExpr = 'neutral', lastBlush = 0, shot = 'wide', wideDir = WIDE_NW, cutCam = false, curClip = '', solesFov = 24, mFov = 50;
  if (trapDone) herb.visible = false;             // (she took the herbs on an earlier visit)
  const solesFocus = V3();
  const wideFocus = V3();
  const camPos = V3(), camLook = V3(), goalPos = V3(), goalLook = V3(), fromPos = V3(), fromLook = V3(), camDir = V3();
  let camT = 1, camKey = -1, camLift = 0, camDirOf = null;
  // (10-03, the Motion Reel Kit's rule for a held shot: it keeps moving; story.js has it for the story's scenes) every shot
  // of this scene is pushed in 3.5 % over its first nine seconds and drifts a few millimetres (seeded noise); not the
  // brush's shot, which is aimed with the mouse, nor a test's. `?camkit=0`: dead still, as before.
  const LSKIT = !/[?&]camkit=0/.test(location.search);
  const lsNoise = (seed) => { let a = seed | 0; const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }, v = Array.from({ length: 256 }, () => r() * 2 - 1); return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 255] + (v[(i + 1) & 255] - v[i & 255]) * u; }; };
  const lsN1 = lsNoise(7411), lsN2 = lsNoise(8527), lsN3 = lsNoise(9643);
  let lsClock = 0, heldKey = -99, heldT = 0;
  const SHOT_ID = { wide: 0, face: 2, feet: 4, soles: 6, kicks: 6, msit: 8, mput: 8, aface: 8, own: 8, test: 8, kunsee: 14, msole: 10, mside: 12, flash: 16, play: 16 };
  let testCam = null;
  // The close-up of her soles: a long lens from the south, raised and a little to one side so that the soles face it
  // and the log's wall is behind them. SOLES_SPAN metres must fit across the frame. 'kicks' is the same camera zoomed
  // out, for the minigame, where she kicks about.
  const SOLES_FOV = 24, KICKS_FOV = 40, SOLES_DIST = 1.1, SOLES_AZ = 12 * Math.PI / 180, SOLES_SPAN = 0.52;
  let solesElev = 0.6;                                   // the close-up looks straight at her soles: this follows the way they face
  const SOLES_KEY = SHOT_ID.soles + 1;
  let baseFov = camera.fov;
  const MIM_CLIP = { MimSit: 'SitIdle', MimPutOn: 'SitPutOn' };          // (10-03: the mimic scene's own sitting clips, her planted foot standing in its wedge; older models: the plain ones)
  const clip = (name, fade) => { if (MIM_CLIP[name] && !clipLen(name, 0)) name = MIM_CLIP[name]; if (name !== curClip) { curClip = name; ctx.playClip(name, fade); } };
  const clipLen = (name, dflt) => {            // the host loops every clip; this is how long one pass lasts
    for (const a of (ctx.mixer && ctx.mixer._actions) || []) if (a.getClip().name === name) return a.getClip().duration;
    return dflt;
  };
  function stand(x, z, fx, fz) {
    stuck = false; anne.position.set(x, 0, z); anne.rotation.set(0, Math.atan2(fx - x, fz - z), 0); anne.updateMatrixWorld(true);
  }
  // depth of field (optional host feature): the subject on the face and feet shots, nothing on wide shots
  const focusPt = V3(); let focusOn = null, focusK = 1;
  function setFocus(p, strength = 1) {             // strength > 1: a shallower depth of field (close-ups)
    if (typeof ctx.setFocus !== 'function') return;
    if (!p) { if (focusOn !== false) { focusOn = false; ctx.setFocus(null); } return; }
    if (focusOn && focusK === strength && focusPt.distanceToSquared(p) < 4e-4) return;
    focusOn = true; focusK = strength; ctx.setFocus(focusPt.copy(p), strength);
  }

  // ---------- feet: sole frame per foot, refreshed every lateUpdate while stuck ----------
  function readFeet(dt) {
    for (let j = 0; j < 2; j++) {
      const f = feet[j];
      mk(f.names[0], f.heel); mk(f.names[1], f.arch); mk(f.names[2], f.ball); mk(f.names[3], f.out);
      f.n.subVectors(f.out, f.arch); if (f.n.lengthSq() < 1e-10) f.n.set(0, 0, 1); f.n.normalize();
    }
    _a.subVectors(feet[0].arch, feet[1].arch); _a.y = 0; if (_a.lengthSq() < 1e-8) _a.set(1, 0, 0); _a.normalize();
    feet[0].lat.copy(_a); feet[1].lat.copy(_a).negate();              // horizontal, pointing to that foot's outer side
    mk('Chest', _b);
    const k = snapFeet ? 1 : ease(3, dt); snapFeet = false;
    for (let j = 0; j < 2; j++) {
      const f = feet[j];
      _c.set(f.n.x, 0, f.n.z);
      if (_c.lengthSq() < 0.01) _c.set(f.arch.x - _b.x, 0, f.arch.z - _b.z);   // soles face straight up: step away from the body
      _c.normalize(); f.away.copy(_c);
      f.dirOut.copy(_c).multiplyScalar(0.12).addScaledVector(f.lat, 1).normalize();     // beside the feet (profile to the feet camera)
      for (let i = 0; i < 4; i++) { f.m1[i].lerp(f.real[i], k); f.sm[i].lerp(f.m1[i], k); }             // the smoothed frame
      f.sn.subVectors(f.sOutM, f.sArch); if (f.sn.lengthSq() < 1e-10) f.sn.set(0, 0, 1); f.sn.normalize();
      _c.subVectors(f.sBall, f.sHeel); f.sSide.crossVectors(f.sn, _c); if (f.sSide.lengthSq() < 1e-10) f.sSide.set(1, 0, 0); f.sSide.normalize();
    }
    _a.subVectors(feet[0].sArch, feet[1].sArch); _a.y = 0; if (_a.lengthSq() < 1e-8) _a.set(1, 0, 0); _a.normalize();
    for (let j = 0; j < 2; j++) {
      const f = feet[j];
      _c.set(f.sn.x, 0, f.sn.z); if (_c.lengthSq() < 0.01) _c.set(f.sArch.x - _b.x, 0, f.sArch.z - _b.z);
      f.sAway.copy(_c.normalize()); f.sOut.copy(f.sAway).multiplyScalar(0.12).addScaledVector(_a, j ? -1 : 1).normalize();
    }
  }
  let snapFeet = true;

  // ---------- Kun behaviour: calm. They walk in a straight line, stop, and then only an arm moves. ----------
  const WALK = 0.9, RUN = 1.9, STROKE = 0.8, TURN = 0.95;   // m/s, m/s, strokes per second, how far they turn towards the feet camera (rad)
  const BLINKS = [3.1, 4.4, 2.6, 5.2, 3.7];                  // seconds between blinks
  const kT = V3(), kH = V3(), kS = V3(), kC = V3(), kP = V3(), kQ = V3(), kX = V3(), kY = V3(), kZ = V3(), kW = V3(), kL = V3(), kF = V3(), kPole = V3();
  const lT = V3(), lN = V3(), lB = V3(), lC = V3(), lE = V3();
  const along = (h, a, b, u, out) => out.copy(h).multiplyScalar((1 - u) * (1 - 2 * u)).addScaledVector(a, 4 * u * (1 - u)).addScaledVector(b, u * (2 * u - 1));   // heel -> arch -> ball
  function setMode(g, m) { g.mode = m; g.mt = 0; }
  function lookFrom(g, P, k) {                               // where the head turns once the Kun stands at g.dest facing g.face (set once: no looking about)
    const dx = P.x - g.dest.x, dz = P.z - g.dest.z, rel = Math.atan2(dx, dz) - g.face;
    g.lookYaw = clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -1.3, 1.3) * k;
    g.lookPitch = -clamp(Math.atan2(P.y - 0.42 * g.scale, Math.hypot(dx, dz)), -0.5, 0.6) * k;
  }
  // Where a Kun stands. Both spots come from the smoothed sole frames and are fixed when he sets off, so he never shuffles after her feet.
  function spotTickle(g) {                                   // beside the foot, half turned to the feet camera, the feather hand at shoulder height
    const f = feet[g.footIdx], sc = g.scale;
    kT.copy(f.sArch).addScaledVector(f.sn, 0.01);
    const hy = clamp(HAND_Y * sc, kT.y - 0.8 * g.fl, kT.y + 0.3 * g.fl), dy = hy - kT.y;
    kX.copy(f.sOut).multiplyScalar(0.92).addScaledVector(f.sAway, 0.4).normalize();
    kH.copy(kT).addScaledVector(kX, Math.sqrt(g.fl * g.fl - dy * dy)); kH.y = hy;             // the hand, with the tip on the arch
    g.fdir.subVectors(kH, kT).normalize();
    kZ.copy(f.sOut).multiplyScalar(-Math.cos(TURN)).addScaledVector(f.sAway, Math.sin(TURN)).normalize();   // the way he faces
    g.face = Math.atan2(kZ.x, kZ.z);
    const s = -(f.sOut.x * kZ.z - f.sOut.z * kZ.x) > 0 ? 1 : -1;                                        // the arm on the foot's side holds the feather
    g.fArm = s > 0 ? 1 : 0;
    g.dest.set(kH.x - (kZ.z * s * 0.135 + kZ.x * 0.075) * sc, 0, kH.z - (-kZ.x * s * 0.135 + kZ.z * 0.075) * sc);
    lookFrom(g, f.sArch, 0.5);
  }
  function spotGrab(g) {                                     // in front of the toe of her shoe, within reach
    const f = feet[g.footIdx];
    kT.subVectors(f.sBall, f.sHeel).multiplyScalar(0.45).add(f.sBall);
    g.dest.set(kT.x + f.sOut.x * 0.2 * g.scale, 0, kT.z + f.sOut.z * 0.2 * g.scale);
    g.face = Math.atan2(kT.x - g.dest.x, kT.z - g.dest.z); lookFrom(g, kT, 0.6);
  }
  function spotLick(g) {                                     // close beside the foot, a little behind the sole: his mouth level with her arch
    const f = feet[g.footIdx];
    g.dest.set(f.sArch.x + f.sOut.x * 0.118 - f.sAway.x * 0.055, 0, f.sArch.z + f.sOut.z * 0.118 - f.sAway.z * 0.055);      // (a little towards her heel: his face shows to the camera behind her feet)
    g.face = Math.atan2(f.sArch.x - g.dest.x, f.sArch.z - g.dest.z); lookFrom(g, f.sArch, 0.6);
  }
  function spotAnkle(g) {                                    // either side of her ankles, facing the cord (A on her right, B on her left)
    tieFrame(); const sd = g === KA ? -1 : 1, d = tieD * 0.5 + 0.125;
    g.dest.set(tW.x + tU.x * sd * d, 0, tW.z + tU.z * sd * d);
    g.face = Math.atan2(tW.x - g.dest.x, tW.z - g.dest.z); lookFrom(g, tW, 0.7);
  }
  function spotToes(g) {                                     // beside her big toes
    tieFrame(); g.dest.set(tToe.x + tU.x * 0.105 + tS.x * 0.02, 0, tToe.z + tU.z * 0.105 + tS.z * 0.02);
    g.face = Math.atan2(tToe.x - g.dest.x, tToe.z - g.dest.z); lookFrom(g, tToe, 0.7);
  }
  function spotPeg(g) {                                      // beside where the peg goes in
    placePeg(); g.dest.set(pegAt.x + tU.x * 0.085, 0, pegAt.z + tU.z * 0.085);
    g.face = Math.atan2(pegAt.x - g.dest.x, pegAt.z - g.dest.z); lookFrom(g, pegAt, 0.8);
  }
  const calfAt = (out) => {                                  // the top of her calves, between her two shins (where C rides)
    BN.shin[0].getWorldPosition(out); BN.shin[1].getWorldPosition(kQ); out.add(kQ).multiplyScalar(0.5).addScaledVector(tAx, 0.035); out.y += 0.047; return out;
  };
  function callC() {                                         // the third Kun runs up from the bushes and hops onto her calves
    if (!TIES_OK || KC.mode !== 'hidden') return;
    tieFrame(); KC.pos.set(bushSE.x - 0.3, 0, bushSE.z - 0.5); KC.gy = 0;
    KC.dest.set(tW.x - tAx.x * 0.24 + tU.x * 0.2, 0, tW.z - tAx.z * 0.24 + tU.z * 0.2); KC.pace = 2.0;
    KC.yaw = KC.face = Math.atan2(KC.dest.x - KC.pos.x, KC.dest.z - KC.pos.z); KC.v = KC.lean = KC.pitch = KC.hyaw = KC.walk = 0;
    for (const a of KC.arms) { a.cur.set(a.s * REST[0], REST[1], REST[2]); a.kind = 0; a.bt = 1; }
    setMode(KC, 'toRide'); kP.set(KC.pos.x, 0.12, KC.pos.z); emit('leaf', kP, 3, 0.15);
  }
  // (10-03) D: out of the bushes to the nearer of her shoes; he carries it on his head to a spot beside her right calf
  // (fixed when he sets off, in sight of the feet and kicks cameras), sets it down on its sole, side-on to the cameras,
  // and from behind it (facing them) licks INSIDE it, the footbed where her foot was ('toShoe' -> 'pick' -> 'haul' ->
  // 'drop' -> 'shoe'). If he is startled with it still in his hands, it drops where he stands.
  const SHOE_MODES = new Set(['pick', 'haul', 'drop']), dSpot = V3(), dN = V3(), dQ0 = new THREE.Quaternion(), dP0 = V3();
  let dYaw = 0, dLicked = false, flashName = 'IdleTiptoe', flashing = false;      // (dLicked: he licked inside her shoe this time, 10-03)
  const flashFlat = { p: V3(), r: 1.25, k: 0.985 };          // (the grass round her feet lies down for the low camera of the sole flash)
  function callD() {
    if (KD.mode !== 'hidden' || !pulled) return;
    const live = props.filter((p) => p.obj.visible && p.state !== 'fly');
    if (!live.length) return;
    const p = live.reduce((a, b) => (a.pos.distanceToSquared(bushSE) <= b.pos.distanceToSquared(bushSE) ? a : b)), f = feet[0];
    KD.shoe = p;
    dSpot.copy(f.sArch).addScaledVector(f.sOut, 0.36).addScaledVector(f.sAway, -0.3); dSpot.y = 0;
    dN.copy(f.sAway).negate(); dN.y = 0; dN.normalize();                                                   // from the shoe to where he will stand
    dYaw = Math.atan2(f.sOut.x, f.sOut.z);                                                                    // (its toe outwards: side-on to the cameras)
    KD.pos.set(bushSE.x - 0.1, 0, bushSE.z - 0.3); KD.gy = 0;
    kP.subVectors(KD.pos, p.pos).setY(0); if (kP.lengthSq() < 1e-6) kP.set(1, 0, 0); kP.normalize();
    KD.dest.copy(p.pos).addScaledVector(kP, 0.13 * KD.scale / 0.29).setY(0); KD.pace = 1.05;
    KD.face = Math.atan2(p.pos.x - KD.dest.x, p.pos.z - KD.dest.z); lookFrom(KD, p.pos, 0.7);
    KD.yaw = Math.atan2(KD.dest.x - KD.pos.x, KD.dest.z - KD.pos.z); KD.v = KD.lean = KD.pitch = KD.hyaw = KD.walk = 0; KD.lid = 0.88; KD.tk = 0;
    for (const a of KD.arms) { a.cur.set(a.s * REST[0], REST[1], REST[2]); a.kind = 0; a.bt = 1; }
    setMode(KD, 'toShoe'); kP.set(KD.pos.x, 0.12, KD.pos.z); emit('leaf', kP, 3, 0.15);
  }
  function headShoe(g, p, P, Q) {                            // the shoe across the top of his head, on its sole
    const y = lieQ(p, 'up', g.yaw + PI / 2, Q);
    g.root.localToWorld(P.set(0, 0.5, -0.02)); P.y += y - 0.002;
  }
  function dropShoe(g) {                                     // let go of it: it falls from where it is
    const p = g.shoe; if (!p || p.state !== 'held') return;
    p.pos.copy(p.obj.position); p.vel.set(0, 0, 0); p.axis.set(0, 1, 0); p.spin = 0; p.bounces = 2; p.state = 'fly';
  }
  function updShoeKun(g, dt) {                               // D with her shoe: where it is, each moment
    const p = g.shoe; if (!p) return;
    if (!SHOE_MODES.has(g.mode)) { dropShoe(g); return; }
    p.state = 'held';
    if (g.mode === 'pick') {                                 // from the grass up onto his head
      if (g.mt <= dt) { dP0.copy(p.obj.position); dQ0.copy(p.obj.quaternion); }
      headShoe(g, p, kQ, qB); const k = sst(g.mt, 0.15, 0.5);
      p.obj.position.lerpVectors(dP0, kQ, k); p.obj.quaternion.slerpQuaternions(dQ0, qB, k);
    } else if (g.mode === 'haul') { headShoe(g, p, p.obj.position, p.obj.quaternion); }
    else {                                                   // down in front of him, on its sole
      if (g.mt <= dt) { dP0.copy(p.obj.position); dQ0.copy(p.obj.quaternion); restPose(p, 'up', dYaw); }
      const k = sst(g.mt, 0, 0.4);
      kQ.copy(dSpot).setY(p.restY); p.obj.position.lerpVectors(dP0, kQ, k); p.obj.position.y += 0.03 * Math.sin(PI * k);
      p.obj.quaternion.slerpQuaternions(dQ0, p.rest, k);
      if (g.mt >= 0.4) { p.pos.copy(kQ); p.vel.set(0, 0, 0); p.obj.position.copy(kQ); p.obj.quaternion.copy(p.rest); p.state = 'rest'; setMode(g, 'shoe'); g.tk = 0; dLicked = true; }
    }
    p.pos.copy(p.obj.position);
  }
  // (10-03, as he asked) the saliva he leaves on the footbed of the shoe he licks, more as he goes on (ctx.propMarks, a set
  // per style); it goes with the shoe until she puts it back on
  function updBeds(dt) {
    if (!ctx.propMarks) return;
    const id = (ctx.shoeStyle && ctx.shoeStyle()) || '-';
    for (const p of props) {
      if (KD.shoe === p && KD.mode === 'shoe') p.bedK = Math.min(1, (p.bedK || 0) + dt * 0.3);
      if (!(p.bedK > 0)) continue;
      p.beds = p.beds || {};
      if (!p.beds[id]) { const pr = soleProfile(); p.beds[id] = ctx.propMarks(pr, { seed: 4241 + props.indexOf(p) * 17 }); (p.obj.children[0] || p.obj).add(p.beds[id].group); }
      for (const k in p.beds) p.beds[k].show(k === id ? 'wet' : null, k === id ? p.bedK : 0);
    }
  }
  // the inside of the shoe he licks, as a foot's frame for kunLick (heel, arch, ball along the footbed; n up out of it;
  // side across it)
  const SF = { heel: V3(), arch: V3(), ball: V3(), n: V3(), side: V3() }, PROF = {};
  function soleProfile() {                                   // the footbed's height along the shoe's own length, per style (24 steps, back to toe): the lowest surface facing up near its centre line (straps are above it, the outsole faces down)
    const id = (ctx.shoeStyle && ctx.shoeStyle()) || '-';
    if (PROF[id]) return PROF[id];
    const N = 24, y = new Array(N).fill(Infinity), b = props[0].nb, cx = (b.min.x + b.max.x) / 2, hw = (b.max.x - b.min.x) / 2, v = V3(), nv = V3(), nm = new THREE.Matrix3();
    if (ctx.heelProp) {
      ctx.heelProp.updateMatrixWorld(true);
      ctx.heelProp.traverse((o) => {
        if (!o.isMesh || !o.geometry.attributes.normal) return; const P = o.geometry.attributes.position, Nn = o.geometry.attributes.normal; nm.getNormalMatrix(o.matrixWorld);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (Math.abs(v.x - cx) > 0.35 * hw) continue;
          if (nv.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize().y < 0.8) continue;
          const j = clamp(Math.floor((v.z - b.min.z) / (b.max.z - b.min.z) * N), 0, N - 1); if (v.y < y[j]) y[j] = v.y;
        }
      });
    }
    for (let j = 0; j < N; j++) if (!isFinite(y[j])) y[j] = j ? y[j - 1] : b.min.y + 0.015;
    return (PROF[id] = { y, z0: b.min.z, z1: b.max.z, cx, hw });
  }
  const sfX = V3(), sfY = V3();
  function shoeFrame(p) {
    const pr = soleProfile(), shoe = p.obj.children[0], N = pr.y.length, id = ctx.shoeStyle && ctx.shoeStyle();
    const at = (u, out) => { const j = clamp(u * N - 0.5, 0, N - 1), j0 = Math.floor(j), j1 = Math.min(N - 1, j0 + 1); return out.set((pr.cx || 0), pr.y[j0] + (pr.y[j1] - pr.y[j0]) * (j - j0) + 0.001, pr.z0 + u * (pr.z1 - pr.z0)); };
    const st = ctx.shoeStyles ? ctx.shoeStyles().find((x) => x.id === id) : null;
    const U = st && st.closed ? [0.25, 0.43, 0.6] : st && st.heel ? [0.2, 0.5, 0.8] : [0.14, 0.42, 0.7];   // (clear of a toe post; the pumps: their open heel half)
    p.obj.updateMatrixWorld(true);
    const o = shoe && p.obj.children.length === 1 ? shoe : p.obj;
    if (o === shoe) { o.localToWorld(at(U[0], SF.heel)); o.localToWorld(at(U[1], SF.arch)); o.localToWorld(at(U[2], SF.ball)); }
    else for (const [k, u] of [['heel', U[0]], ['arch', U[1]], ['ball', U[2]]]) o.localToWorld(SF[k].set(0, 0.002, -0.12 + 0.24 * u));
    sfX.set(1, 0, 0).transformDirection(o.matrixWorld); sfY.set(0, 1, 0).transformDirection(o.matrixWorld);
    fC.subVectors(SF.ball, SF.heel).normalize(); SF.n.crossVectors(fC, sfX).normalize(); if (SF.n.dot(sfY) < 0) SF.n.negate();      // (square to the footbed's slope)
    SF.side.crossVectors(SF.n, fC).normalize();
    return SF;
  }
  function leave(g, m) {                                     // off to the bushes in a straight line
    g.gy = 0; g.tk = 0;
    g.dest.set(bushSE.x + (g.footIdx ? -0.2 : 0.25) + (g === KC ? -0.35 : g === KD ? 0.32 : 0), 0, bushSE.z + (g.footIdx ? 0.3 : -0.2) + (g === KD ? 0.25 : 0));
    g.face = Math.atan2(g.dest.x - g.pos.x, g.dest.z - g.pos.z); g.lookYaw = g.lookPitch = 0; setMode(g, m);
  }
  function hide(g) { setMode(g, 'gone'); g.root.visible = g.limbs.visible = g.feather.visible = false; if (g.tongue) g.tongue.visible = false; if (g === kuns[0]) pouch.visible = false; }
  function vanish(g) { kP.set(g.pos.x, 0.12, g.pos.z); emit('dust', kP, 4, 0.08); emit('leaf', kP, 6, 0.12); hide(g); }
  function sneakIn() {
    for (const g of PAIR) {
      if (g.mode !== 'hidden') continue;
      g.pos.set(bushSE.x + (g.footIdx ? 0 : 0.2), 0, bushSE.z + (g.footIdx ? -0.8 : -0.1));      // B further north: his line crosses well in front of the feet camera
      spotTickle(g); g.pace = clamp(g.pos.distanceTo(g.dest) / 4.2, 0.75, 1.15);                        // both arrive after about 4.5 s
      g.yaw = Math.atan2(g.dest.x - g.pos.x, g.dest.z - g.pos.z); g.v = g.lean = g.pitch = g.hyaw = g.walk = 0; g.lid = 0.88;
      for (const a of g.arms) { a.cur.set(a.s * REST[0], REST[1], REST[2]); a.kind = 0; a.bt = 1; }
      setMode(g, 'sneak');
      kP.set(g.pos.x, 0.35, g.pos.z); emit('leaf', kP, 4, 0.2);
    }
  }
  function startGrab() { if (pulled) return; for (const g of PAIR) { if (g.mode === 'hidden') sneakIn(); spotGrab(g); setMode(g, 'grab'); } }
  // Gate for line 12: the Kuns have to walk up, take hold and pull before the line can be left, and the heels have to
  // hit the ground while the feet shot is still up. Nobody teleports; the 9 s cap is only a safety net.
  function heelsLanded(st) {
    if (!pulled && st.t > 9) doPull();
    return pulled && (props[0].state !== 'fly' || props[0].bounces > 0) && (props[1].state !== 'fly' || props[1].bounces > 0);
  }
  function doPull() {
    if (pulled) return;
    pulled = true; heelsOff = true;
    ctx.setHeelsWorn(false); clip('StuckStruggle');          // she only gets to kick once they let go of her feet
    for (let i = 0; i < 2; i++) launchHeel(props[i], feet[i]);
    for (const g of PAIR) { g.dest.copy(g.pos); setMode(g, 'rise'); }
  }
  // The tickling, as on the 2D sheet: one Kun laps at a sole with his long tongue, the other strokes the other sole
  // with a feather; the third rides on her calves with the cord's end.
  function startTickle() {
    if (!pulled) doPull();
    spotLick(KA); setMode(KA, 'lick'); KA.tk = 0; KA.feather.visible = false;
    kP.copy(KB.dest); spotTickle(KB);
    if (KB.mode === 'watch' && kP.distanceTo(KB.dest) < 0.05) KB.dest.copy(kP);                         // already at his post: no shuffling
    setMode(KB, 'tickle'); KB.grow = KB.tau = KB.sb = KB.off = 0; KB.feather.visible = true;
    swapT = 0; callD();
  }
  let swapT = 0;
  function swapRoles(dt) {                                   // every nine seconds the licker and the one with the feather change jobs
    const L = KA.mode === 'lick' ? KA : KB.mode === 'lick' ? KB : null, F = KA.mode === 'tickle' ? KA : KB.mode === 'tickle' ? KB : null;
    if (!L || !F || cur && cur.op === OPS.game) return;
    if ((swapT += dt) < 9) return; swapT = 0;
    spotLick(F); setMode(F, 'lick'); F.tk = 0; F.feather.visible = false;
    spotTickle(L); setMode(L, 'tickle'); L.grow = L.tau = L.sb = L.off = 0; L.feather.visible = true;
  }
  function launchHeel(p, f) {
    fitProp(p); wearPose(p, f, p.pos, p.obj.quaternion);
    p.vel.copy(f.away).multiplyScalar(0.8).addScaledVector(f.dirOut, 0.6).normalize().multiplyScalar(rr(1.6, 1.95)); p.vel.y = rr(2.1, 2.5);   // off the sole, over the Kun's shoulder
    p.axis.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(); p.spin = rr(8, 12);
    p.state = 'fly'; p.bounces = 0; p.obj.position.copy(p.pos); p.obj.visible = true;
    emit('dust', p.pos, 3, 0.05);
  }
  const _eu = new THREE.Euler();
  function updProps(dt) {
    for (let i = 0; i < 2; i++) {
      const p = props[i];
      if (p.state === 'fly') {
        p.vel.y -= 9.8 * dt; p.pos.addScaledVector(p.vel, dt);
        _q.setFromAxisAngle(p.axis, p.spin * dt); p.obj.quaternion.premultiply(_q);
        const floor = lowY(p, p.obj.quaternion) + 0.002;                  // (whichever way it is turned, nothing of it goes into the ground)
        if (p.pos.y < floor && p.vel.y < 0) {
          p.pos.y = floor; p.bounces++; emit('dust', p.pos, 2, 0.04);
          if (p.bounces >= 3 || p.vel.y > -0.9) {
            p.state = 'rest';                    // a high heel comes to lie on its side; a flat one on its sole
            _c.set(0, 0, 1).applyQuaternion(p.obj.quaternion);
            restPose(p, ctx.heelStyle && ctx.heelStyle() ? 'side' : 'up', Math.atan2(_c.x, _c.z));
          } else { p.vel.y *= -0.38; p.vel.x *= 0.55; p.vel.z *= 0.55; p.spin *= 0.5; }
        }
      } else if (p.state === 'rest') {
        const k = Math.exp(-6 * dt); p.vel.x *= k; p.vel.z *= k;
        p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
        p.obj.quaternion.slerp(p.rest, ease(9, dt));
        p.pos.y = Math.max(lowY(p, p.obj.quaternion) + 0.002, p.pos.y + (p.restY - p.pos.y) * ease(12, dt));     // (settling, it rolls over the ground, not through it)
      } else continue;
      p.obj.position.copy(p.pos);
    }
  }

  // one limb of a Kun: a tube bent through S -> C -> H, then the rings of its end blob. `bp` (the bend plane) is kept between frames.
  function drawLimb(g, off, sp, S, C, H, bp, thin) {
    const P = g.lpos, N = g.lnor, sc = g.scale;
    lT.subVectors(C, S); lE.subVectors(H, C); lB.crossVectors(lT, lE);
    if (lB.lengthSq() > 1e-12) bp.copy(lB).normalize();
    let o = off * 3;
    for (let i = 0; i < sp.n; i++) {
      const t = sp.t[i], u = 1 - t;
      lC.copy(S).multiplyScalar(u * u).addScaledVector(C, 2 * u * t).addScaledVector(H, t * t);
      lT.subVectors(C, S).multiplyScalar(u).addScaledVector(lE, t).normalize();
      if (sp.d[i]) lC.addScaledVector(lT, sp.d[i] * sc);
      lN.crossVectors(bp, lT).normalize(); lB.crossVectors(lT, lN);
      const r = sp.r[i] * sc * (sp.d[i] ? 1 : thin), sl = sp.slope[i], inv = 1 / Math.hypot(1, sl);
      for (let k = 0; k < LM; k++, o += 3) {
        const dx = lN.x * COS[k] + lB.x * SIN[k], dy = lN.y * COS[k] + lB.y * SIN[k], dz = lN.z * COS[k] + lB.z * SIN[k];
        P[o] = lC.x + dx * r; P[o + 1] = lC.y + dy * r; P[o + 2] = lC.z + dz * r;
        N[o] = (dx - lT.x * sl) * inv; N[o + 1] = (dy - lT.y * sl) * inv; N[o + 2] = (dz - lT.z * sl) * inv;
      }
    }
    if (sp.tip) { P[o] = H.x + lT.x * sp.tip * sc; P[o + 1] = H.y + lT.y * sp.tip * sc; P[o + 2] = H.z + lT.z * sp.tip * sc; N[o] = lT.x; N[o + 1] = lT.y; N[o + 2] = lT.z; }
  }
  // the control point for a limb of length `len` from S to H that bulges towards `pole`; returns how much to thin it when it has to stretch
  function bend(S, H, len, pole, C) {
    kY.subVectors(H, S); const d = kY.length() || 1e-5; kY.divideScalar(d);
    const x = Math.min(d, len * 0.995) / 2, h = Math.max(Math.sqrt(Math.max(0, len * len / 4 - x * x)), len * 0.04);
    kW.copy(pole).addScaledVector(kY, -pole.dot(kY)); if (kW.lengthSq() < 1e-8) kW.set(0, -1, 0); kW.normalize();
    C.copy(S).add(H).multiplyScalar(0.5).addScaledVector(kW, 2 * h);
    return clamp(Math.sqrt(len / Math.max(d, len)), 0.72, 1);
  }
  function drawFoot(g, off, x, y, z, yaw) {
    const P = g.lpos, N = g.lnor, sc = g.scale, FP = FOOT.p, FN = FOOT.n, c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0, o = off * 3; i < FP.length; i += 3, o += 3) {
      const px = FP[i] * sc, pz = FP[i + 2] * sc;
      P[o] = x + px * c + pz * s; P[o + 1] = y + FP[i + 1] * sc; P[o + 2] = z - px * s + pz * c;
      N[o] = FN[i] * c + FN[i + 2] * s; N[o + 1] = FN[i + 1]; N[o + 2] = -FN[i] * s + FN[i + 2] * c;
    }
  }
  function placeFeather(g, B, dir, face, stretch) {          // base at B, shaft along dir, the vane's flat side towards `face`
    kZ.copy(face).addScaledVector(dir, -face.dot(dir)); if (kZ.lengthSq() < 1e-8) kZ.set(0, 1, 0); kZ.normalize();
    kX.crossVectors(dir, kZ);
    _m.makeBasis(kX, dir, kZ); g.feather.quaternion.setFromRotationMatrix(_m); g.feather.position.copy(B);
    g.feather.scale.set(g.grow * g.fs, g.grow * g.fs * stretch, g.grow * g.fs);
  }

  // runs after the mixer, so it can read this frame's markers
  function updKun(g, dt, t) {
    g.mt += dt;
    const m = g.mode, vis = m !== 'hidden' && m !== 'gone';
    g.root.visible = g.limbs.visible = vis;
    if (!vis) { g.feather.visible = false; return; }
    const f = g === KD && g.shoe ? shoeFrame(g.shoe) : feet[g.footIdx], sc = g.scale, run = m === 'flee';
    if (m === 'hopOn' || m === 'ride') {                     // C: up onto her calves in one hop, and there he stays
      tieFrame(); calfAt(kT); const k = m === 'ride' ? 1 : Math.min(1, g.mt / 0.4), e = k * k * (3 - 2 * k);
      g.pos.set(g.from.x + (kT.x - g.from.x) * e, 0, g.from.z + (kT.z - g.from.z) * e); g.dest.copy(g.pos); g.v = 0;
      g.gy = kT.y * e + 0.1 * Math.sin(PI * k) * (1 - e * 0.5);
      g.face = Math.atan2(tS.x, tS.z);                       // he faces her feet
      if (m === 'hopOn' && k >= 1) { setMode(g, 'ride'); TIE.hold = 1; }
    }
    // travel: straight to g.dest at a steady pace, eased at both ends
    kP.subVectors(g.dest, g.pos); kP.y = 0;
    const dist = kP.length(), moving = dist > 0.03;
    if (dist > 0.0006) {
      const want = Math.min(run ? RUN : m === 'carry' || m === 'scamper' ? 0.95 : g.pace, 0.012 + dist * 5);
      g.v += (want - g.v) * ease(want > g.v ? 5 : 18, dt);
      const step = Math.min(dist, g.v * dt); g.pos.addScaledVector(kP, step / dist); g.walk += step * (run ? 12 : 23) / (sc * 1.7);     // small legs: more steps to the metre
    } else { g.pos.copy(g.dest); g.v = 0; }
    g.yaw = lerpAngle(g.yaw, dist > 0.3 ? Math.atan2(kP.x, kP.z) : g.face, ease(dist > 0.3 ? 8 : 5, dt));

    if (m === 'sneak' && !moving) setMode(g, 'wait');
    else if (m === 'grab' && !moving) setMode(g, 'tug');
    // A pulls once his lean is done and B has had a good grip on the other shoe (or after 2 s if B is somehow late)
    else if (m === 'tug' && g === kuns[0] && g.mt > 0.8 && ((kuns[1].mode === 'tug' && kuns[1].mt > 0.5) || g.mt > 2)) doPull();
    else if (m === 'rise' && g.mt > 0.7) { spotTickle(g); setMode(g, 'watch'); }                         // then back to his post, to watch
    else if (m === 'toTie' && !moving) setMode(g, 'tie');
    else if (m === 'toToe' && !moving) setMode(g, 'toe');
    else if (m === 'toPeg' && !moving) setMode(g, 'peg');
    else if (m === 'toRide' && !moving) { g.from.copy(g.pos); setMode(g, 'hopOn'); }
    else if (m === 'startle' && g.mt > 0.4) setMode(g, 'cower');                                        // frozen where he stands, until she shouts
    else if (m === 'toShoe' && !moving) setMode(g, 'pick');
    else if (m === 'pick' && g.mt > 0.55) {                  // up on his head, off to his spot
      kP.copy(dSpot).addScaledVector(dN, 0.12 * sc / 0.29); g.dest.set(kP.x, 0, kP.z); g.face = Math.atan2(-dN.x, -dN.z); lookFrom(g, dSpot, 0.6); g.pace = 0.8; setMode(g, 'haul');
    }
    else if (m === 'haul' && !moving) setMode(g, 'drop');
    else if ((run || m === 'carry' || m === 'scamper') && dist < 0.3) { vanish(g); return; }

    // pose: every goal is eased; nothing here is random
    const amp = sstep(0, 0.3, g.v), still = !moving;
    let lean = (run ? 0.24 : 0.07) * amp, pitch = still ? g.lookPitch : 0, hyaw = still ? g.lookYaw : 0, lid = 0.88;
    if (m === 'tug') { lean = -0.3 * sstep(0, 0.75, g.mt); pitch = g.lookPitch - 0.1; }                 // one smooth lean back
    else if (m === 'rise') lean = -0.3 * (1 - sstep(0, 0.6, g.mt));                              // and straighten up
    else if (m === 'stare') lid = 0.94;
    else if (m === 'startle') { const k = sstep(0, 0.25, g.mt); lean = -0.14 * k; lid = 0.94 + 0.04 * k; }
    else if (m === 'cower') { lean = -0.16 + 0.015 * Math.sin(t * 31 + g.ph); lid = 0.98; pitch = g.lookPitch; hyaw = g.lookYaw; }
    else if (m === 'tickle' && still) {
      g.sb = Math.min(1, g.sb + dt / 0.8); g.tau += dt * sstep(0.25, 1, g.sb); lid = 0.85;
      // the head follows the feather a little
      g.root.worldToLocal(kQ.copy(g.tip));
      hyaw = clamp(Math.atan2(kQ.x, kQ.z) * 0.45, -0.7, 0.7); pitch = -clamp(Math.atan2(kQ.y - 0.42, Math.hypot(kQ.x, kQ.z)) * 0.4, -0.3, 0.35);
    }
    else if (m === 'pick' || m === 'drop') { lean = 0.32 * Math.sin(PI * clamp(g.mt / (m === 'pick' ? 0.5 : 0.4), 0, 1)); lid = 0.84; }   // down to the shoe and up again
    else if ((m === 'lick' || m === 'shoe') && still) {      // he leans in, his head down to her sole (D: down to her shoe's)
      g.tk = Math.min(1, g.tk + dt / 0.5); lean = (m === 'shoe' ? 0.6 : 0.2) * g.tk; lid = 0.8;
      g.root.worldToLocal(kQ.copy(g.tip));
      hyaw = clamp(Math.atan2(kQ.x, kQ.z) * 0.8, -0.9, 0.9); pitch = -clamp(Math.atan2(kQ.y - 0.36, Math.hypot(kQ.x, kQ.z)) * 0.75, -0.45, 0.5) - 0.1;
    }
    else if (m === 'tie' || m === 'toe') { lean = 0.22; lid = 0.8; }
    else if (m === 'peg') { lean = 0.16 + 0.1 * Math.abs(Math.sin(g.mt * 12)); lid = 0.84; }
    else if (m === 'ride') { lean = -0.16 + 0.03 * Math.sin(t * 7.3); pitch = 0.1 * Math.sin(t * 3.1); hyaw = 0.25 * Math.sin(t * 1.7); lid = 0.92; }
    if (m !== 'lick' && m !== 'shoe' && g.tk > 0) g.tk = Math.max(0, g.tk - dt / 0.3);
    g.lean += (lean - g.lean) * ease(12, dt); g.pitch += (pitch - g.pitch) * ease(5, dt); g.hyaw += (hyaw - g.hyaw) * ease(5, dt); g.lid += (lid - g.lid) * ease(8, dt);
    const br = 0.015 * Math.sin(t * 1.9 + g.ph);             // breathing
    g.root.position.set(g.pos.x, g.gy + (run ? 0.022 : 0.011) * 1.8 * sc * amp * (0.5 - 0.5 * Math.cos(2 * g.walk)) + (m === 'ride' ? 0.006 * Math.abs(Math.sin(t * 7.3)) : 0), g.pos.z); g.root.rotation.y = g.yaw;
    g.body.rotation.x = g.lean; g.body.scale.set(1 - br * 0.5, 1 + br, 1 - br * 0.5);
    g.head.rotation.set(g.pitch - g.lean * 0.6, g.hyaw, 0, 'YXZ');
    g.blink -= dt; if (g.blink < -0.2) g.blink = BLINKS[g.blinkN++ % BLINKS.length];
    const shut = g.blink < 0 ? (g.blink > -0.07 ? -g.blink / 0.07 : 1 + (g.blink + 0.07) / 0.13) : 0;   // closes in 0.07 s, opens in 0.13 s
    g.lids.rotation.x = 1.2 - 2.4 * g.lid * (1 - shut);
    g.root.updateMatrixWorld(true);
    kF.set(Math.sin(g.yaw), 0, Math.cos(g.yaw)); kL.set(kF.z, 0, -kF.x);                                // forwards and to his left

    // the feather's tip, when tickling: slow strokes heel -> arch -> ball and back along the smoothed sole, a slow weave across it,
    // and lifted clear of the real sole wherever that stands out further (her foot can push the feather, the feather never chases it)
    const tick = m === 'tickle', e = tick ? sstep(0, 1, g.sb) : 0;
    if (tick) {
      const u = 0.5 - 0.5 * Math.cos(2 * PI * STROKE * g.tau);
      along(f.sHeel, f.sArch, f.sBall, u, g.tip).addScaledVector(f.sSide, 0.012 * Math.sin(1.3 * g.tau + g.ph));
      const out = clamp(along(f.heel, f.arch, f.ball, u, kQ).sub(g.tip).dot(f.sn), 0, 0.09);
      g.off = out > g.off ? g.off + (out - g.off) * ease(30, dt) : Math.max(out, g.off - 0.05 * dt);
      g.tip.addScaledVector(f.sn, 0.01 + g.off);
      g.grow = Math.min(1, g.grow + dt * 3.5);
    }
    // arms: goals in root space (hands pinned to her shoe or the feather are converted); a new kind of goal is blended in over 0.45 s
    for (let i = 0; i < 2; i++) {
      const arm = g.arms[i], s = arm.s; let kind = 0;
      if (m === 'tug' || (m === 'grab' && dist < 0.3)) {     // both hands on the toe of the shoe
        kH.subVectors(f.ball, f.heel).multiplyScalar(0.45).add(f.ball).addScaledVector(f.n, 0.015).addScaledVector(kL, s * 0.034 * sc);
        g.root.worldToLocal(kH); kind = 1;
      } else if (m === 'tie') {                              // both hands at the cord, passing it round and round
        const sd = g === KA ? -1 : 1, a = g.mt * 9 + i * PI;
        kH.copy(tW).addScaledVector(tU, sd * (tieD * 0.5 + RU + 0.012)).addScaledVector(tV, 0.02 * Math.sin(a) * (1 - TIE.knot)).addScaledVector(tAx, 0.016 * Math.cos(a) * (1 - TIE.knot));
        g.root.worldToLocal(kH); kind = 7;
      } else if (m === 'toe') {                              // looping the string round her big toes
        const a = g.mt * 10 + i * PI;
        kH.copy(tToe).addScaledVector(tU, 0.022 + 0.008 * Math.sin(a)).addScaledVector(UP, 0.012 + 0.008 * Math.cos(a));
        g.root.worldToLocal(kH); kind = 8;
      } else if (m === 'peg') {                              // one fist drives the peg in, the other steadies it
        kH.copy(pegAt); kH.y = PEG_UP + 0.04 * (1 - TIE.peg) + (i === 0 ? 0.012 + 0.06 * Math.abs(Math.cos(g.mt * 12)) : -0.02);
        g.root.worldToLocal(kH); kind = 9;
      } else if (m === 'ride') {                             // both hands on the cord's end, pulling it taut
        kH.set(s * 0.03, 0.2 + 0.012 * Math.sin(t * 7.3), 0.1); kind = 10;
      } else if (m === 'lick' && still) {                    // his hands on the edge of her foot
        along(f.heel, f.arch, f.ball, i ? 0.62 : 0.38, kH).addScaledVector(f.sOut, 0.036).addScaledVector(f.n, 0.004);
        g.root.worldToLocal(kH); kind = 11;
      } else if (m === 'shoe' && still) {                    // D: his hands on the rim of the shoe, his side of it
        along(f.heel, f.arch, f.ball, i ? 0.66 : 0.34, kH).addScaledVector(f.side, (g.lsd || 1) * 0.04).addScaledVector(f.n, 0.01);
        g.root.worldToLocal(kH); kind = 11;
      } else if ((m === 'pick' || m === 'drop') && g.shoe) { // both hands on the shoe, either side of it
        kH.copy(g.shoe.obj.position).addScaledVector(kL, s * 0.032).addScaledVector(kF, -0.01);
        g.root.worldToLocal(kH); kind = 12;
      } else if (tick && i === g.fArm) {                     // the hand makes half of the stroke, the wrist the rest
        along(f.sHeel, f.sArch, f.sBall, 0.5 + (0.5 - 0.5 * Math.cos(2 * PI * STROKE * g.tau) - 0.5) * 0.55, kH).addScaledVector(f.sn, 0.01).addScaledVector(g.fdir, g.fl);
        g.root.worldToLocal(kH); kH.x += (s * 0.135 - kH.x) * (1 - e); kH.y += (0.29 - kH.y) * (1 - e); kH.z += (0.075 - kH.z) * (1 - e); kind = 2;
      } else if (m === 'carry' || m === 'haul') { kH.set(s * 0.085, 0.47, -0.02); kind = 3; }          // both hands hold the sack (D: her shoe) up on his head
      else if ((m === 'startle' && g.mt > 0) || m === 'cower') { kH.set(s * 0.13, 0.235, 0.05); kind = 4; }
      else if (run) { kH.set(s * 0.125, 0.16, -0.06); kind = 5; }
      else if (g.feather.visible && i === g.fArm) { kH.set(s * 0.125, 0.19, 0.055); kind = 6; }
      else kH.set(s * REST[0], REST[1], REST[2]);
      if (kind !== arm.kind) { arm.kind = kind; arm.from.copy(arm.cur); arm.bt = 0; }
      arm.bt = Math.min(1, arm.bt + dt / 0.45); arm.cur.lerpVectors(arm.from, kH, sstep(0, 1, arm.bt));
      g.body.localToWorld(kS.set(s * 0.058, 0.165, 0.005)); g.root.localToWorld(arm.hand.copy(arm.cur));
      kW.subVectors(arm.hand, kS).normalize(); kH.copy(arm.hand).addScaledVector(kW, -0.02 * sc);       // the wrist: the hand is a ball just past it
      kPole.copy(kL).multiplyScalar(s * 0.5).addScaledVector(kF, -0.35).addScaledVector(UP, -1);
      drawLimb(g, arm.off, ARM, kS, kC, kH, arm.bp, bend(kS, kH, ARM_L * sc, kPole, kC));
    }
    // legs: the feet step on the ground under the hips; when he stands they are planted
    for (let i = 0; i < 2; i++) {
      const leg = g.legs[i], s = leg.s, ph = g.walk + (i ? PI : 0), reach = (run ? 0.05 : 0.034) * amp;
      g.root.localToWorld(kP.set(s * 0.046, 0, reach * Math.sin(ph))); kP.y = g.gy + 0.014 * sc * amp * Math.max(0, Math.cos(ph));
      g.body.localToWorld(kS.set(s * 0.04, 0, 0)); kH.copy(kP); kH.y += 0.03 * sc;
      drawLimb(g, leg.off, LEG, kS, kC, kH, leg.bp, bend(kS, kH, LEG_L * sc, kF, kC));
      drawFoot(g, leg.foot, kP.x, kP.y, kP.z, g.yaw + s * 0.2);
    }
    g.limbGeo.attributes.position.needsUpdate = true; g.limbGeo.attributes.normal.needsUpdate = true;
    if (g.feather.visible) {
      const hand = g.arms[g.fArm].hand, s = g.arms[g.fArm].s;
      kY.copy(kL).multiplyScalar(s * 0.3).addScaledVector(kF, run ? -0.5 : 0.12).addScaledVector(UP, 1).normalize();   // just holding it: upright
      let stretch = 1;
      if (tick) {                                            // tip on the sole: the feather swings from "held" to "tickling" as the arm comes up
        kQ.subVectors(g.tip, hand); const len = kQ.length() || 1; kQ.divideScalar(len);
        kY.lerp(kQ, e).normalize(); stretch = 1 + (len / g.fl - 1) * e;
      }
      placeFeather(g, hand, kY, tick ? f.sn : kF, stretch);
    }
    if (m === 'carry') {                                     // the sack, nearly as big as he is, rides on his head, sparkling at a steady rate
      g.root.localToWorld(pouch.position.set(0, 0.6, -0.02)); pouch.rotation.set(0.12 * Math.sin(g.walk), g.yaw, 0, 'YXZ'); pouch.scale.setScalar(0.62);
      g.spark -= dt; if (g.spark <= 0) { g.spark += 0.11; kP.copy(pouch.position); kP.y += 0.11; emit('spark', kP, 1, 0.07); }
    }
    if (g.tongue) {                                          // the tongue: out and lapping while he licks, drawn back in otherwise
      const lick = (m === 'lick' || m === 'shoe') && still;
      if (lick || g.tk > 0.02) { g.tongue.visible = true; kunLick(g, dt, f); } else g.tongue.visible = false;
    }
    if (PROBE) PROBE.step(g);
  }

  // ?lsprobe=1 (testing): window.__lsProbe() -> per Kun and mode, the largest move in one update (metres) of its root, head and feather hand,
  // and the time this module's update + lateUpdate take. ?lsprobe=hide also hides everything the module draws (to measure its frame cost).
  const PROBE = /[?&]lsprobe\b/.test(location.search) ? { data: {}, last: {} } : null;
  if (PROBE) {
    if (/[?&]lsprobe=hide/.test(location.search)) root.visible = false;
    PROBE.step = (g) => {
      const key = g.name + ' ' + g.mode + (g.pos.distanceTo(g.dest) > 0 ? ' (walking)' : ''), L = PROBE.last[g.name];
      const cur = [g.root.position.clone(), g.head.localToWorld(V3(0, 0.1, 0)), g.arms[g.fArm].hand.clone()];
      const d = PROBE.data[key] || (PROBE.data[key] = { updates: 0, rootMax: 0, headMax: 0, handMax: 0, headSum: 0, handSum: 0 });
      if (L && L.key === key) {
        const r = cur[0].distanceTo(L.cur[0]), h = cur[1].distanceTo(L.cur[1]), a = cur[2].distanceTo(L.cur[2]);
        d.updates++; d.rootMax = Math.max(d.rootMax, r); d.headMax = Math.max(d.headMax, h); d.handMax = Math.max(d.handMax, a); d.headSum += h; d.handSum += a;
      }
      PROBE.last[g.name] = { key, cur };
    };
    window.__lsFeet = () => ({ base: [base.x, base.z], southZ, feet: feet.map((f) => ({ s: f.s, heel: f.sHeel.toArray().map((v) => +v.toFixed(3)), arch: f.sArch.toArray().map((v) => +v.toFixed(3)), ball: f.sBall.toArray().map((v) => +v.toFixed(3)), n: f.sn.toArray().map((v) => +v.toFixed(2)) })),
      cam: camera.position.toArray().map((v) => +v.toFixed(3)), fov: camera.fov, kuns: kuns.map((g) => [+(g.pos.x).toFixed(3), +(g.pos.z).toFixed(3)]) });
    window.__lsKuns = () => kuns.map((g) => ({ name: g.name, mode: g.mode, mt: +g.mt.toFixed(3), x: +(g.pos.x - base.x).toFixed(3), z: +(g.pos.z - base.z).toFixed(3), v: +g.v.toFixed(3) }));
    window.__lsProbe = () => { const o = {}, T = PROBE.time; o.time = { frames: T.frames, updateMeanMs: +(T.updMs / (T.frames || 1)).toFixed(4), lateUpdateMeanMs: +(T.lateMs / (T.frames || 1)).toFixed(4), updateMaxMs: +T.updMax.toFixed(3), lateUpdateMaxMs: +T.lateMax.toFixed(3), worstAt: T.worstAt }; for (const [k, d] of Object.entries(PROBE.data)) o[k] = { updates: d.updates, rootMax: +d.rootMax.toFixed(5), headMax: +d.headMax.toFixed(5), headMean: +(d.headSum / (d.updates || 1)).toFixed(5), handMax: +d.handMax.toFixed(5), handMean: +(d.handSum / (d.updates || 1)).toFixed(5) }; return o; };
  }

  // ---------- script ops: start(st) once, tick(st, dt, press) -> true when finished, end(st) on exit ----------
  const OPS = {
    say: {
      keys: true,
      start(st) {
        const id = st.args[0], L = LINES[id];
        st.text = Array.isArray(L[6]) ? L[6][(Math.random() * L[6].length) | 0] : L[6]; st.n = 0; st.done = st.shown = false; st.cue = CUES[id] || null; st.fired = false;
        showLine(id, L, st.text); shot = L[5];
        if (L[3]) { lastExpr = L[3]; lastBlush = L[4]; }
        ctx.setExpression(lastExpr, lastBlush);
        if (L[7]) clip(L[7]);
      },
      tick(st, dt, press) {
        if (st.cue && !st.fired && st.t >= st.cue[0]) { st.fired = true; st.cue[1](); }
        const open = !st.cue || !st.cue[2] || (st.fired && st.cue[2](st));
        if (!st.done) {
          const n = Math.min(st.text.length, st.n + 45 * dt);
          if ((n | 0) !== (st.n | 0)) typeTo(st.text, n | 0);
          st.n = n;
          if (n >= st.text.length) st.done = true;
          else if (press) { st.done = true; st.n = st.text.length; typeTo(st.text, st.n); press = false; }   // first press finishes the line
        }
        if (st.done && open && !st.shown) { st.shown = true; lineDone(); }     // the ▼ waits for the gate too
        return press && st.done && open;
      },
      end(st) { if (st.cue && !st.fired) st.cue[1](); },
    },
    choice: {
      keys: true,
      start(st) {
        st.labels = []; st.targets = [];
        for (let i = 0; i < st.args.length; i += 2) { st.labels.push(st.args[i]); st.targets.push(st.args[i + 1]); }
        moves = 0; showChoice(st.labels);
      },
      tick(st, dt, press) {
        if (moves) { chSel = ((chSel + moves) % chN + chN) % chN; moves = 0; markChoice(); }
        if (!press) return false;
        st.jump = st.targets[chSel]; hideChoice(); return true;
      },
    },
    fade: {
      start(st) { hideDlg(); st.from = fadeV; },
      tick(st) { const k = Math.min(1, st.t / 0.35); setFade(st.from + (st.args[0] - st.from) * k); return k >= 1; },
    },
    wait: { tick: (st) => st.t >= st.args[0] },
    goto: { start(st) { st.jump = st.args[0]; } },
    faceLog: {
      start(st) {
        hideDlg(); shot = 'wide'; clip('Walk', 0.2); st.y0 = anne.rotation.y;
        st.y1 = Math.atan2(base.x - anne.position.x, clamp(anne.position.z, northZ, southZ) - anne.position.z);
      },
      tick(st) {
        const k = Math.min(1, st.t / 0.4);
        anne.rotation.set(0, lerpAngle(st.y0, st.y1, k * k * (3 - 2 * k)), 0);
        if (k < 1) return false;
        clip('Idle', 0.25); return true;
      },
    },
    getStuck: {
      start() {
        herb.visible = false; herbs++; setHud();
        stuck = true; snapChest = snapFeet = true; anne.rotation.set(0, Math.PI, 0); clip('StuckIdle', 0);
        shot = 'face'; cutCam = true; wideDir = WIDE_SW;
        lastExpr = 'strain'; lastBlush = 0; ctx.setExpression('strain', 0);
      },
    },
    game: {
      keys: true,
      start(st) {
        hideDlg(); shot = 'kicks';
        st.w = [0.22, 0.17, 0.12][misses]; st.speed = [0.75, 1.05, 1.4][misses];
        st.z0 = rr(0.08, 0.92 - st.w); st.p = 0; st.dir = 1; st.res = null; st.rt = 0;
        gZone.style.left = st.z0 * 100 + '%'; gZone.style.width = st.w * 100 + '%'; gMark.style.left = '0%';
        gRound.textContent = `Round ${misses + 1} / 3`;
        gauge.classList.remove('ls-hit', 'ls-miss'); gauge.classList.add('ls-on');
        clip('StuckFlatStrain'); ctx.setExpression('strain', 0.6);
      },
      tick(st, dt, press) {
        if (st.res === null) {
          st.p += st.dir * st.speed * dt;
          if (st.p > 1) { st.p = 2 - st.p; st.dir = -1; } else if (st.p < 0) { st.p = -st.p; st.dir = 1; }
          gMark.style.left = st.p * 100 + '%';
          if (press && st.t > 0.25) {             // one press per round
            st.res = st.p >= st.z0 && st.p <= st.z0 + st.w;
            gauge.classList.add(st.res ? 'ls-hit' : 'ls-miss');
            if (st.res) ctx.setExpression('angry', 0.4);
            else { misses++; setFlash(0.45); ctx.setExpression('laughHard', 0.9); clip('StuckFlatTickled'); }
          }
          return false;
        }
        st.rt += dt; return st.rt > (st.res ? 0.45 : 0.6);
      },
      end(st) { gauge.classList.remove('ls-on'); st.jump = st.res ? 'escape' : misses >= 3 ? 'fail' : null; },
    },
    // The Kuns tie her up. Her legs come down (StuckFlat); A and B wind the cord round her ankles, B loops the string
    // round her big toes and drives the peg in, C runs up, hops onto her calves and takes the cord's end.
    tie: {
      start(st) {
        hideDlg(); shot = 'feet'; if (!pulled) doPull();
        clip('StuckFlat', 0.5); lastExpr = 'shocked'; lastBlush = 0.3; ctx.setExpression('shocked', 0.3);
        TIE.on = TIES_OK; TIE.k = TIE.knot = TIE.toe = TIE.peg = TIE.taut = TIE.hold = 0; st.ph = TIES_OK ? 0 : 9; st.t0 = 0; st.taps = 0;
      },
      tick(st) {
        const t = st.t;
        if (TIE_HOLD >= 0 && st.ph === TIE_HOLD && t - st.t0 > TIE_HOLD_AT) { if (!st.held) { st.held = true; console.log('HOLD reached: tie phase ' + st.ph); } return false; }
        if (st.ph === 0 && t > 0.6) { st.ph = 1; shot = 'kicks'; for (const g of PAIR) { spotAnkle(g); g.pace = 1.2; setMode(g, 'toTie'); } }      // (her legs are down: watch the tying from close)
        else if (st.ph === 1 && ((KA.mode === 'tie' && KB.mode === 'tie') || t > 3.5)) { st.ph = 2; st.t0 = t; for (const g of PAIR) if (g.mode !== 'tie') { g.pos.copy(g.dest); setMode(g, 'tie'); } }
        else if (st.ph === 2) {
          TIE.k = Math.min(1, (t - st.t0) / 1.6);
          if (TIE.k >= 1) { st.ph = 3; st.t0 = t; TIE.knot = 0.01; callC(); }
        } else if (st.ph === 3) {                  // the knot is pulled tight; then B is off to her toes
          TIE.knot = Math.min(1, (t - st.t0) / 0.3);
          if (TIE.knot >= 1) { st.ph = 4; emit('dust', tW, 2, 0.03); spotToes(KB); setMode(KB, 'toToe'); KA.lookYaw *= 0.5; setMode(KA, 'watch'); }
        } else if (st.ph === 4 && (KB.mode === 'toe' || t - st.t0 > 2.5)) { st.ph = 5; st.t0 = t; if (KB.mode !== 'toe') { KB.pos.copy(KB.dest); setMode(KB, 'toe'); } }
        else if (st.ph === 5) {
          TIE.toe = Math.min(1, (t - st.t0) / 0.75);
          if (TIE.toe >= 1) { st.ph = 6; st.t0 = t; spotPeg(KB); setMode(KB, 'toPeg'); }
        } else if (st.ph === 6 && (KB.mode === 'peg' || t - st.t0 > 2)) { st.ph = 7; st.t0 = t; st.taps = 0; if (KB.mode !== 'peg') { KB.pos.copy(KB.dest); setMode(KB, 'peg'); } TIE.peg = 0.01; }
        else if (st.ph === 7) {                    // three blows, the peg a third deeper with each
          const k = (t - st.t0) / 0.262;
          while (st.taps < 3 && k > st.taps + 0.5) { st.taps++; TIE.peg = st.taps / 3; kP.copy(pegAt); kP.y = 0.02; emit('dust', kP, 2, 0.03); }
          if (st.taps >= 3 && k > 3.3) { st.ph = 8; st.t0 = t; TIE.taut = 1; KB.dest.copy(KB.pos); setMode(KB, 'watch'); lookFrom(KB, tToe, 0.7); }
        } else if (st.ph === 8 && ((t - st.t0 > 0.5 && (KC.mode === 'ride' || KC.mode === 'hidden')) || t - st.t0 > 3)) st.ph = 9;
        return st.ph === 9 || t > 14;
      },
      end() {                                      // (also when the step is cut short: everything is in place)
        if (TIES_OK) { TIE.k = TIE.knot = TIE.toe = TIE.peg = TIE.taut = 1; if (pegAt.lengthSq() === 0) placePeg(); if (KC.mode === 'hidden') callC(); }
      },
    },
    snapTies: {                                    // the hit: she tears her feet free, and the Kuns jump
      start() {
        hideDlg(); shot = 'feet'; burstTies(); clip('StuckStruggle', 0.12); lastExpr = 'angry'; lastBlush = 0.4; ctx.setExpression('angry', 0.4);
        for (const g of kuns) { if (g.mode === 'gone' || g.mode === 'hidden') continue; g.tk = 0; g.feather.visible = false; g.gy = 0; g.dest.copy(g.pos); setMode(g, 'stare'); g.lean = -0.25; }
      },
      tick: (st) => st.t > 0.75,
    },
    standUp: {
      start(st) {
        TIE.on = false; TIE.hold = 0;
        let n = 0, gx = 0, gz = 0;
        for (const g of kuns) if (g.mode !== 'gone' && g.mode !== 'hidden') { n++; gx += g.pos.x; gz += g.pos.z; }
        if (st.args[0] === 'escape') {
          stand(base.x - 1.25, base.z + 1.05, n ? gx / n : base.x + 1, n ? gz / n : base.z + 1.5);
          for (const g of kuns) {                  // they stop where they are and look up at her
            if (g.mode === 'gone' || g.mode === 'hidden') continue;
            g.gy = 0; g.tk = 0; g.feather.visible = false;
            g.dest.copy(g.pos); g.face = Math.atan2(anne.position.x - g.pos.x, anne.position.z - g.pos.z);
            lookFrom(g, _a.set(anne.position.x, 1.45, anne.position.z), 0.8); setMode(g, 'stare');
          }
        } else {
          stand(base.x - 0.95, base.z + 0.15, bushSE.x, bushSE.z);
          for (const g of kuns) if (g.mode !== 'hidden') hide(g);           // the screen is black: whoever is still on his way is gone
        }
        // (10-03) her shoes stay where they lie: she puts them back on once the Kuns are gone (after C1: ownSit, ownPut)
        trapDone = true; if (ctx.onFlag) ctx.onFlag(ctx.flagKey || 'logDone', true);
        clip('Idle', 0); shot = st.args[0] === 'escape' ? 'aface' : 'wide'; wideDir = WIDE_SW; cutCam = true;
        if (n) wideFocus.set(gx / n, 0, gz / n); else wideFocus.set(base.x + 0.45, 0, southZ + 0.8);   // frame the Kuns' side
      },
    },
    stomp: {
      start() {
        clip('Stomp', 0.15); stompT = clipLen('Stomp', 1.04) - 0.25;           // one stomp: update() eases back to Idle as it lands
        lastExpr = 'angry'; lastBlush = 0.4; ctx.setExpression('angry', 0.4);
        _a.set(anne.position.x, 0.05, anne.position.z); emit('dust', _a, 5, 0.15);
        for (const g of kuns) if (g.mode === 'stare') { setMode(g, 'startle'); g.mt = -0.3 - g.footIdx * 0.12; }
      },
    },
    rob: {
      start() {
        clip('StuckStruggle'); lastExpr = 'shocked'; lastBlush = 0.3; ctx.setExpression('shocked', 0.3);
        shot = 'wide'; wideDir = WIDE_SW;
        coins = Math.max(0, coins - (10 + Math.floor(rnd() * 21))); setHud();
        coinsEl.classList.remove('ls-bad'); void coinsEl.offsetWidth; coinsEl.classList.add('ls-bad');
        TIE.on = false; TIE.hold = 0;              // they whip their cord and string away with them
        leave(KA, 'carry'); KA.feather.visible = false; pouch.visible = true;
        leave(KB, 'scamper'); KB.feather.visible = false; for (const g of [KC, KD]) if (g.mode !== 'hidden' && g.mode !== 'gone') leave(g, 'scamper');
      },
      tick: (st) => (st.t > 0.8 && kuns.every((g) => g.mode === 'gone' || g.mode === 'hidden')) || st.t > 3.2,
    },
    // ----- the mimic shoes -----
    faceShoes: {
      start(st) { hideDlg(); shot = 'wide'; wideFocus.copy(STONE); clip('Walk', 0.2); st.y0 = anne.rotation.y; st.y1 = Math.atan2(STONE.x - anne.position.x, STONE.z - anne.position.z); },
      tick(st) {
        const k = Math.min(1, st.t / 0.4);
        anne.rotation.set(0, lerpAngle(st.y0, st.y1, k * k * (3 - 2 * k)), 0);
        if (k < 1) return false;
        clip('Idle', 0.25); return true;
      },
    },
    sitDown: {                                   // (the screen is black) she sits down by the stone, her own shoes off, a mimic in front of each foot
      start() {
        sitting = true; mPhase = 0; mMiss = 0; snapFeet = true; mPutT = 0; mLeft = false; mPutLen = clipLen('MimPutOn') || clipLen('SitPutOn') || 3.1;
        anne.position.set(MIMIC.x, 0, MIMIC.z); anne.rotation.set(0, SIT_YAW, 0); anne.updateMatrixWorld(true);
        ctx.setHeelsWorn(false); heelsOff = true; parkHeels(true);
        clip('MimPutOn', 0); shot = 'mput'; cutCam = true;
        lastExpr = 'smile'; lastBlush = 0; ctx.setExpression('smile', 0);
      },
    },
    putOn: {                                     // she slips them on, one foot after the other
      start() { hideDlg(); },
      tick() {
        if (mPutT < 0.05 && feet[0].heel.lengthSq() > 0) mScale = clamp(feet[1].heel.distanceTo(feet[1].ball) / WCH, 0.8, 1.2);
        return mPutT >= mPutLen - 0.05;
      },
      end() { mPutT = mPutLen; },
    },
    mTease: {                                    // the shoes wake up: the right one slips off her foot and its tongue goes for her sole
      start() {
        mPhase = 1; clip('SitTickle', 0.15);
        for (const m of mimics) { m.k = 0; m.on = 1; }
        lastExpr = 'shocked'; lastBlush = 0.3; ctx.setExpression('shocked', 0.3);
      },
    },
    mBoth: { start() { if (mMiss >= 1) mPhase = 2; } },
    mgame: {
      keys: true,
      start(st) {
        hideDlg(); shot = 'msit';
        st.w = [0.24, 0.2, 0.16][Math.min(2, mMiss)]; st.speed = [0.7, 0.9, 1.1][Math.min(2, mMiss)];
        st.z0 = rr(0.08, 0.92 - st.w); st.p = 0; st.dir = 1; st.res = null; st.rt = 0;
        gZone.style.left = st.z0 * 100 + '%'; gZone.style.width = st.w * 100 + '%'; gMark.style.left = '0%';
        gRound.textContent = 'Kick them off!';
        gauge.classList.remove('ls-hit', 'ls-miss'); gauge.classList.add('ls-on');
      },
      tick(st, dt, press) {
        if (st.res === null) {
          st.p += st.dir * st.speed * dt;
          if (st.p > 1) { st.p = 2 - st.p; st.dir = -1; } else if (st.p < 0) { st.p = -st.p; st.dir = 1; }
          gMark.style.left = st.p * 100 + '%';
          if (press && st.t > 0.25) {
            st.res = st.p >= st.z0 && st.p <= st.z0 + st.w;
            gauge.classList.add(st.res ? 'ls-hit' : 'ls-miss');
            if (!st.res) { mMiss++; setFlash(0.3); }
          }
          return false;
        }
        st.rt += dt; return st.rt > 0.5;
      },
      end(st) { gauge.classList.remove('ls-on'); if (st.res || mMiss >= 3) st.jump = 'mescape'; },
    },
    mStand: { start() { mimicOff(); stand(MIMIC.x, MIMIC.z, STONE.x, STONE.z); clip('Idle', 0); shot = 'wide'; wideDir = WIDE_SW; cutCam = true; wideFocus.copy(STONE); lastExpr = 'angry'; lastBlush = 0.4; ctx.setExpression('angry', 0.4); } },
    // ----- (10-03) her own shoes back on -----
    ownCheck: { start(st) { if (!heelsOff) st.jump = st.args[0]; } },       // (still in them: nothing to put on)
    ownSit: { start() { ownSit(anne.position.x, anne.position.z, Math.atan2(WIDE_SW.x, WIDE_SW.z)); } },     // (black) where she stands, facing the open side
    mOff: {                                      // (black) the mimics back on their stone; she sits on, barefoot, her own shoes in front of her
      start() {
        sitting = false; mPhase = 0; mimicRest(); ownSit(MIMIC.x, MIMIC.z, SIT_YAW);
        shot = 'wide'; wideDir = WIDE_SW; wideFocus.copy(STONE); lastExpr = 'angry'; lastBlush = 0.4; ctx.setExpression('angry', 0.4);
      },
    },
    ownPut: {                                    // she slips them on: the right, then the left
      start() {
        hideDlg(); own.put = true; own.t = 0; own.len = clipLen('SitPutOn') || 3.1; clip('SitPutOn', 0.25); shot = 'own';
        lastExpr = 'pout'; lastBlush = 0.2; ctx.setExpression('pout', 0.2);
      },
      tick: () => own.t >= own.len - 0.05,
      end() { ownWear(0); ownWear(1); },
    },
    ownUp: { start() { ownEnd(); clip('Idle', 0); shot = 'wide'; wideDir = WIDE_SW; cutCam = true; wideFocus.copy(anne.position); lastExpr = 'smile'; lastBlush = 0; ctx.setExpression('smile', 0); } },
    // ----- (10-03) D licked inside her shoe: up on her feet, the sole flash (her heel up out of the shoe, anne_next.js) shows
    // the saliva on her soles (ctx.soleMarks); the clip is held while she says so -----
    wetCheck: { start(st) { if (!dLicked) st.jump = st.args[0]; } },
    flashOn: {
      start() {
        const fs = (location.search.match(/[?&]flash=([LR])/) || [])[1];      // (tests: ?flash=L | R)
        hideDlg(); flashName = (fs ? fs === 'R' : Math.random() < 0.5) ? 'IdleTiptoeR' : 'IdleTiptoe'; clip(flashName, 0.35); shot = 'aface';
        flashing = true; flashFlat.p.set(anne.position.x - Math.sin(anne.rotation.y) * 0.25, 0, anne.position.z - Math.cos(anne.rotation.y) * 0.25);
        if (ctx.soleMarks) ctx.soleMarks('wet', 45);
        lastExpr = 'embarrassed'; lastBlush = 0.4; ctx.setExpression('embarrassed', 0.4);
      },
      tick(st) {
        const t = ctx.clipTime ? ctx.clipTime(flashName) : st.t;
        if (t >= 1.5 && shot !== 'flash') shot = 'flash';
        if (t >= 3.3 || st.t > 6) { if (ctx.holdClip) ctx.holdClip(true); return true; }
        return false;
      },
    },
    brush: {                                     // (10-03) her soles scrubbed clean with the mouse (footplay.js): this one, then the other
      start(st) {
        hideDlg(); st.fin = !ctx.footPlay; if (st.fin) return;
        shot = 'play'; console.log('SHOE BRUSH'); if (ctx.soleMarks) ctx.soleMarks('wet', 45);      // (however long W2 and the choice took)
        ctx.footPlay.clean({ first: flashName.endsWith('R') ? 'R' : 'L', held: true, auto: /[?&]ls=/.test(location.search) ? 2.2 : 0 }).then(() => { st.fin = true; });
      },
      tick: (st) => st.fin,
      end() { curClip = 'Idle'; shot = 'aface'; lastExpr = 'smile'; lastBlush = 0.25; ctx.setExpression('smile', 0.25); },      // (footplay.js left her standing in Idle)
    },
    flashOff: {
      start() { hideDlg(); if (ctx.holdClip) ctx.holdClip(false); },
      tick(st) {
        const t = ctx.clipTime ? ctx.clipTime(flashName) : 3.3 + st.t;
        if (t >= 5.4 && shot === 'flash') shot = 'aface';
        if (t >= 7.6 || st.t > 6) { clip('Idle', 0.4); return true; }
        return false;
      },
    },
    end: { start() { finish(); } },
  };

  const steps = [], labels = {};
  for (const s of SCRIPT) if (typeof s === 'string') labels[s.slice(2)] = steps.length; else steps.push(s);
  for (const s of steps) if (s[0] === 'choice') fillChoice(s.filter((x, i) => i % 2 === 1));
  let pc = 0, cur = null;
  function runScript(dt, press) {
    for (let guard = 0; guard < 24 && active && ending < 0; guard++) {
      if (!cur) {
        if (pc >= steps.length) { finish(); return; }
        const s = steps[pc];
        cur = { op: OPS[s[0]], args: s.slice(1), t: 0, jump: null };
        if (cur.op.start) cur.op.start(cur);
        if (!active || ending >= 0) return;
      }
      cur.t += dt;
      if (cur.op.tick && !cur.op.tick(cur, dt, press)) return;
      if (cur.op.end) cur.op.end(cur);
      pc = cur.jump != null ? labels[cur.jump] : pc + 1;
      cur = null; dt = 0; press = false;
    }
  }
  function finish() {
    hideDlg(); hideChoice(); gauge.classList.remove('ls-on'); setFade(0); setFlash(0); setFocus(null); if (ctx.anklesTogether) ctx.anklesTogether(0);
    if (ctx.setCloseUp) ctx.setCloseUp('off');
    if (camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
    if (stuck) stand(base.x - 0.95, base.z + 0.15, base.x, base.z);
    if (sitting) { mimicOff(); stand(MIMIC.x, MIMIC.z, STONE.x, STONE.z); }
    ownEnd(); KD.shoe = null;
    anne.rotation.x = anne.rotation.z = 0; anne.position.y = 0;
    for (const o of OBST) {                    // never leave her inside the log
      const dx = anne.position.x - o.x, dz = anne.position.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.32;
      if (d < min) { if (d < 1e-4) anne.position.x = o.x - min; else { anne.position.x = o.x + dx * min / d; anne.position.z = o.z + dz * min / d; } }
    }
    if (heelsOff) { ctx.setHeelsWorn(true); heelsOff = false; }
    for (const p of props) { p.state = 'off'; p.obj.visible = false; }
    for (const g of kuns) { hide(g); g.mode = 'hidden'; g.gy = 0; g.tk = 0; }
    TIE.on = false; TIE.hold = 0; updTies();
    anne.updateMatrixWorld(true);
    clip('Idle', 0.3);
    // Control goes back in update(), once the key that closed the scene is up: the host reads a held E as "turn camera".
    stompT = 0; pc = steps.length; cur = null; ending = 0;
  }

  // ---------- the mimic shoes: a pair of dark blue pumps with eyes, standing in the grass near the log ----------
  // Worn, they wake up: each slips off the heel, hangs from the toes and tickles the sole with its tongue.
  const MIMIC = V3(base.x - 2.6, 0, base.z + 2.3), SIT_YAW = 0.55;
  {
    const TILE0 = ctx.S || 1.6;
    const ok = (x, z) => !ctx.walkAt || [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]].every(([a, b]) => ctx.walkAt(Math.floor((x + a) / TILE0), Math.floor((z + b) / TILE0)));
    for (const [dx, dz] of [[-2.6, 2.3], [-3.2, 1.4], [2.6, 2.4], [0, 3.2], [-2.2, 3.2], [3.0, 1.2]]) if (ok(base.x + dx, base.z + dz)) { MIMIC.set(base.x + dx, 0, base.z + dz); break; }
  }
  // they stand on a flat stone beside the spot where she sits down to try them
  const STONE = V3(MIMIC.x - Math.sin(SIT_YAW) * 0.55 - Math.cos(SIT_YAW) * 0.85, 0, MIMIC.z - Math.cos(SIT_YAW) * 0.55 + Math.sin(SIT_YAW) * 0.85), STONE_H = 0.2;
  {
    const g = new THREE.SphereGeometry(1, 18, 12), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), w = 1 + 0.1 * Math.sin(x * 5 + z * 3) + 0.07 * Math.sin(z * 7 - x * 2); P.setXYZ(i, x * w, Math.min(y, 0.55), z * w); }
    g.computeVertexNormals();
    const st = shadowy(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.2, 0.2, 0.19) }))); st.receiveShadow = true;
    st.scale.set(0.34, STONE_H / 0.55, 0.27); st.position.copy(STONE); st.rotation.y = 0.4; st.name = 'LS_MimicStone'; root.add(st);
    OBST.push({ x: STONE.x, z: STONE.z, r: 0.42 });
  }
  const flat = { p: V3(MIMIC.x + Math.sin(SIT_YAW) * 0.45, 0, MIMIC.z + Math.cos(SIT_YAW) * 0.45), r: 1.6, k: 0.985 };
  const flatLog = { p: V3(base.x, 0, southZ + 0.7), r: 1.5, k: 0.985 };      // behind the log, where her feet lie and the Kuns (no taller than the grass) work
  const MIMIC_COL = new THREE.Color().setRGB(0.012, 0.03, 0.11);
  const mimicMat = new THREE.MeshStandardMaterial({ color: MIMIC_COL, roughness: 0.42, metalness: 0.05 });
  const mouthMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.16, 0.02, 0.05) });
  const tongueMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.80, 0.10, 0.22), side: THREE.DoubleSide });
  const eyeWhite = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.85, 0.85, 0.8), emissive: new THREE.Color().setRGB(0.12, 0.12, 0.1) });
  const eyeDark = new THREE.MeshBasicMaterial({ color: 0x050308 }), toothMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(0.8, 0.78, 0.7) });
  const TN = 20, TS = 8;
  // The shoe (after the artist's clip): an open-toed wedge. Its mouth opens under her arch, between the heel block
  // and the toe plate; teeth line the mouth, spikes run down its back, a strap holds her toes. Local frame: origin
  // on the ground under her heel, +Z to the toes, +Y up. WH: heel height, ball distance and ball height of her
  // foot as it stands in a high heel (the group is scaled to her real foot the first time she sits down).
  const WH = { hh: 0.091, bz: 0.108, bh: 0.024 }, WPT = Math.max(WH.bh - 0.003, 0.012), WCH = Math.hypot(WH.bz, WH.hh - WH.bh);
  const shellMat = mimicMat.clone(); shellMat.side = THREE.DoubleSide;
  const WFIT = { toeW: 0.045, toeH: 0.027, toeZ: 0.01, heelR: 0.039, heelZ: 0.016, ankleR: 0.041, ankleY: 0.066, ankleZ: 0.1, ankleTilt: -0.96, W: 0.088, wall: 0.026 };      // (10-03: W as wide as her foot plus its walls, was 0.066; side walls she stands in, 2.6 cm)
  function makeWedge(name) {
    const { hh, bz } = WH, pt = WPT, g = new THREE.Group(); g.name = name;
    const W = WFIT.W, sh = new THREE.Shape();
    const pts = [[-0.02, hh - 0.002], [0.034, hh - 0.006], [0.02, hh * 0.56], [0.008, pt + 0.03], [0.022, pt + 0.005], [bz - 0.02, pt], [bz + 0.034, pt], [bz + 0.042, pt * 0.4], [bz + 0.024, 0], [-0.002, 0], [-0.012, hh * 0.4]];
    pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
    const body = new THREE.ExtrudeGeometry(sh, { depth: W - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
    body.rotateY(-PI / 2); body.translate((W - 0.006) / 2, 0, 0);
    g.add(shadowy(new THREE.Mesh(body, mimicMat)));
    const gum = new THREE.Mesh(new THREE.BoxGeometry(W - 0.016, 0.002, bz - 0.04), mouthMat); gum.position.set(0, pt + 0.0012, (bz - 0.02 + 0.014) / 2); g.add(gum);   // the floor of the mouth
    const cone = (r, h, x, y, z, rx, rz = 0) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), toothMat); c.position.set(x, y, z); c.rotation.set(rx, 0, rz); g.add(c); return c; };
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.007);
      for (let z = 0.038, i = 0; z < bz - 0.026; z += 0.0125, i++) cone(0.0044, 0.012 + 0.006 * ((i * 7) % 3) / 2, x, pt + 0.006, z, 0, sx * -0.12);            // lower jaw
      for (let i = 0; i < 6; i++) { const u = i / 5, y = hh * 0.56 + (pt + 0.03 - hh * 0.56) * u, z = 0.02 - 0.012 * u; cone(0.0044, 0.014, x, y, z + 0.006, 1.3); }   // back of the mouth
      for (let i = 0; i < 3; i++) { const u = i / 2, y = hh - 0.006 + (hh * 0.56 - hh + 0.006) * u * 0.8, z = 0.034 - 0.014 * u * 0.8; cone(0.0042, 0.013, x, y - 0.004, z + 0.004, 2.2); }   // fangs under the heel seat
      const tab = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.034, 3), mimicMat); tab.scale.x = 0.25; tab.position.set(sx * (W / 2 + 0.001), pt + 0.016, bz - 0.004); g.add(tab);      // the pointed tab by the toes
    }
    for (let i = 0; i < 9; i++) {                  // spikes down its back
      const u = i / 8, y = hh * (1 - u * 0.94), z = u < 0.6 ? -0.02 + 0.008 * (u / 0.6) : -0.012 + 0.01 * ((u - 0.6) / 0.4), len = 0.03 + 0.016 * ((i * 5) % 3) / 2;
      for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.0062, len, 7), mimicMat); c.position.set(sx * 0.017, y - 0.006, z - len * 0.36); c.rotation.x = -1.8; g.add(c); }
    }
    // what holds her foot: a broad band over the toes, and a cup round the heel
    const band = new THREE.CylinderGeometry(1, 1, 0.034, 22, 1, true, PI / 2, PI); band.rotateX(PI / 2);
    const strap = new THREE.Mesh(band, shellMat); strap.scale.set(WFIT.toeW, WFIT.toeH, 1); strap.position.set(0, pt - 0.001, bz + WFIT.toeZ); g.add(strap);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(WFIT.heelR, WFIT.heelR - 0.002, 0.06, 20, 1, true, PI / 2, PI), shellMat); cup.position.set(0, hh + 0.026, WFIT.heelZ); cup.scale.z = 1.15; g.add(cup);
    // (10-03) side walls along the sole line, heel to toes: her foot sits IN the shoe, not on top of a narrow wedge
    const sl = (z) => (z <= 0 ? hh : z >= bz ? WH.bh + (pt - WH.bh) * Math.min(1, (z - bz) / 0.03) : hh + (WH.bh - hh) * z / bz);
    const wall = new THREE.Shape(), WZ = [-0.024, 0, bz * 0.35, bz * 0.7, bz, bz + 0.03], top = (z) => sl(z) + WFIT.wall * (z > bz ? 0.55 : 1);
    WZ.forEach((z, i) => (i ? wall.lineTo(z, sl(z) - 0.004) : wall.moveTo(z, sl(z) - 0.004)));
    for (let i = WZ.length - 1; i >= 0; i--) wall.lineTo(WZ[i], top(WZ[i]));
    const wallGeo = new THREE.ExtrudeGeometry(wall, { depth: 0.0035, bevelEnabled: false }); wallGeo.rotateY(-PI / 2);
    for (const sx of [-1, 1]) { const w = shadowy(new THREE.Mesh(wallGeo, shellMat)); w.position.x = sx * (W / 2 - 0.002) + 0.00175; g.add(w); }
    const eyes = [-1, 1].map((sx) => {             // it is still the shoe that winked at her: two eyes sit on the toe strap
      const e = new THREE.Group(); e.position.set(sx * 0.012, pt + WFIT.toeH - 0.001, bz + WFIT.toeZ);
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.0078, 14, 10), eyeWhite), pu = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 10, 8), eyeDark);
      pu.position.set(sx * 0.0012, 0.0015, 0.0056); e.add(w, pu); g.add(e); return e;
    });
    root.add(g); return { obj: g, eyes };
  }
  const mimics = ['R', 'L'].map((sd, j) => {
    const m = makeWedge('LS_Mimic_' + sd);
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(TN * TS * 3), idx = [];
    for (let i = 0; i < TN - 1; i++) for (let k = 0; k < TS; k++) { const a = i * TS + k, b = i * TS + (k + 1) % TS; idx.push(a, a + TS, b, b, a + TS, b + TS); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    m.tongue = new THREE.Mesh(geo, tongueMat); m.tongue.frustumCulled = false; m.tongue.visible = false; m.tongue.castShadow = true; m.tongue.name = 'LS_MimicTongue_' + sd; root.add(m.tongue);
    m.k = 0; m.j = j; m.blink = 2 + j * 1.3; m.on = 0; m.ph = j * 0.37; m.aside = 0;
    return m;
  });
  for (const g of [...PAIR, KD]) {                 // the Kuns that lick have a tongue built like the mimics'
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(TN * TS * 3), idx = [];
    for (let i = 0; i < TN - 1; i++) for (let k = 0; k < TS; k++) { const a = i * TS + k, b = i * TS + (k + 1) % TS; idx.push(a, a + TS, b, b, a + TS, b + TS); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    g.tongue = new THREE.Mesh(geo, tongueMat); g.tongue.frustumCulled = false; g.tongue.visible = false; g.tongue.castShadow = true; g.tongue.name = 'LS_KunTongue_' + g.name; root.add(g.tongue);
  }
  const mS = V3(), mA = V3(), mB = V3(), mC = V3(), mD = V3(), mF = V3(), mX = V3(), mY = V3(), mZ = V3(), mP = V3(), mQ = V3(), mM = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
  let mPutT = 0, mPutLen = 3.1, mScale = 1, mLeft = false;
  function mimicRest() {                           // the pair standing on the stone where she found them
    mimics.forEach((m, j) => {
      const side = (j ? 0.05 : -0.05), yaw = SIT_YAW + (j ? 0.2 : -0.15);
      m.obj.quaternion.setFromAxisAngle(UP, yaw); m.obj.scale.setScalar(mScale);
      m.obj.position.set(STONE.x + side * Math.cos(SIT_YAW) - Math.sin(yaw) * 0.05, STONE_H - 0.012, STONE.z - side * Math.sin(SIT_YAW) - Math.cos(yaw) * 0.05);
      m.obj.visible = true; m.tongue.visible = false; m.on = 0; m.k = 0;
    });
  }
  mimicRest();
  // her own shoes wait in the grass beside her while she wears the mimics
  function parkHeels(show) {
    props.forEach((p, j) => {
      p.state = 'off'; p.obj.visible = show; if (!show) return;
      fitProp(p); restPose(p, 'up', SIT_YAW + 0.5 + j * 0.3); p.obj.quaternion.copy(p.rest);
      p.obj.position.set(MIMIC.x + Math.cos(SIT_YAW) * (0.5 + j * 0.13) - Math.sin(SIT_YAW) * 0.1, p.restY, MIMIC.z - Math.sin(SIT_YAW) * (0.5 + j * 0.13) - Math.cos(SIT_YAW) * 0.1);
      p.pos.copy(p.obj.position);
    });
  }
  function mimicOff() {                            // back in her own shoes; the mimics go back to where they stood
    sitting = false; mPhase = 0;
    ownEnd(); parkHeels(false);
    if (heelsOff) { ctx.setHeelsWorn(true); heelsOff = false; }
    mimicRest();
  }
  // ---------- (10-03) her own shoes back on: after the Kuns (once C1 is said) and after the mimics ----------
  // She sits where she is (the screen is black), her shoes standing in front of her feet; then SitPutOn: its hands are
  // at her right foot for its first second and at her left over 1.5-2.4 s, and each shoe comes up onto its foot inside
  // that (0.08-0.30, 0.5-0.72 of the clip, as the mimics do) and becomes the one she wears.
  const own = { on: false, put: false, t: 0, len: 3.1, yaw: 0, done: [false, false], from: [V3(), V3()], fromQ: [new THREE.Quaternion(), new THREE.Quaternion()], flat: { p: V3(), r: 1.6, k: 0.985 } };
  const oF = V3(), oL = V3(), oP = V3(), oQ = new THREE.Quaternion();
  function ownSit(x, z, yaw) {
    own.on = true; own.put = false; own.t = 0; own.yaw = yaw; own.done[0] = own.done[1] = false;
    stuck = false; anne.position.set(x, 0, z); anne.rotation.set(0, yaw, 0); anne.updateMatrixWorld(true);
    own.flat.p.set(x + Math.sin(yaw) * 0.45, 0, z + Math.cos(yaw) * 0.45);
    clip('SitIdle', 0); snapFeet = true; shot = 'own'; cutCam = true;
    for (const p of props) { p.state = 'own'; p.obj.visible = false; p.vel.set(0, 0, 0); fitProp(p); }      // (shown once her feet are read: updOwn)
    for (const g of kuns) if (g.mode !== 'hidden' && g.mode !== 'gone') hide(g);
    lastExpr = 'pout'; lastBlush = 0.2; ctx.setExpression('pout', 0.2);
  }
  function ownWear(i) {
    if (own.done[i]) return;
    own.done[i] = true; props[i].obj.visible = false; props[i].state = 'off';
    if (ctx.setShoe) ctx.setShoe(i ? 'L' : 'R', true);
  }
  function ownEnd() {
    if (!own.on) return;
    own.on = own.put = false;
    for (let i = 0; i < 2; i++) ownWear(i);
    if (heelsOff) { ctx.setHeelsWorn(true); heelsOff = false; }
  }
  function updOwn(dt) {
    if (!own.on) return;
    if (own.put) own.t += dt;
    oF.set(Math.sin(own.yaw), 0, Math.cos(own.yaw)); oL.set(oF.z, 0, -oF.x);
    props.forEach((p, i) => {
      if (own.done[i]) return;
      const f = feet[i], a0 = i ? 0.5 : 0.08, k = own.put ? sst(own.t / own.len, a0, a0 + 0.22) : 0;
      if (k <= 0) {                              // standing in the grass in front of her foot
        restPose(p, 'up', own.yaw + (i ? 0.45 : -0.45));
        p.pos.copy(f.ball).addScaledVector(oL, i ? 0.13 : -0.13).addScaledVector(oF, 0.06); p.pos.y = p.restY;
        p.obj.position.copy(p.pos); p.obj.quaternion.copy(p.rest); p.obj.visible = true;
        own.from[i].copy(p.pos); own.fromQ[i].copy(p.rest);
        return;
      }
      wearPose(p, f, oP, oQ);                    // up and onto her foot
      p.obj.position.lerpVectors(own.from[i], oP, k); p.obj.position.y += 0.1 * Math.sin(PI * k);
      p.obj.quaternion.slerpQuaternions(own.fromQ[i], oQ, k);
      if (k >= 1) ownWear(i);
    });
  }
  // The tongue: a broad flat tube along a cubic curve (root, two handles, tip). `wide`: the direction its width lies along.
  const tA = V3(), tB = V3(), tX = V3(), tY = V3();
  const bez = (s, a, b, c, d, o) => { const r = 1 - s, w0 = r * r * r, w1 = 3 * r * r * s, w2 = 3 * r * s * s, w3 = s * s * s; return o.set(w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y, w0 * a.z + w1 * b.z + w2 * c.z + w3 * d.z); };
  function drawTongue(m, p0, p1, p2, p3, wide, wd0, th, ripple) {
    const P = m.tongue.geometry.attributes.position, arr = P.array;
    for (let i = 0; i < TN; i++) {
      const s = i / (TN - 1);
      bez(s, p0, p1, p2, p3, tA); bez(Math.min(1, s + 0.02), p0, p1, p2, p3, tB).sub(bez(Math.max(0, s - 0.02), p0, p1, p2, p3, tY)); if (tB.lengthSq() < 1e-12) tB.subVectors(p3, p0); tB.normalize();
      tX.copy(wide).addScaledVector(tB, -wide.dot(tB)); if (tX.lengthSq() < 1e-8) tX.set(1, 0, 0); tX.normalize(); tY.crossVectors(tX, tB);
      const env = Math.sin(PI * Math.min(1, s * 1.1)) * s;                                     // a slow ripple, none at the root
      tA.addScaledVector(tX, Math.sin(s * 5 - mT * 6 + m.j * 2) * ripple * env).addScaledVector(tY, Math.cos(s * 4 - mT * 5 + m.j) * ripple * env);
      if (tFix) { const air = soleAir(tFix, tA); if (air < tFix.need && air > -0.03) { const up = (tFix.need - air) * Math.min(1, s * 5); tA.addScaledVector(tFix.n, up); if (s > 0.2 && up > lickStat.push) lickStat.push = up; } }
      const wd = wd0 * (0.72 + 0.5 * Math.sin(PI * Math.min(1, s * 0.8 + 0.2))) * (s > 0.84 ? Math.sqrt(Math.max(0, 1 - (s - 0.84) / 0.16)) * 0.85 + 0.15 : 1) * (s < 0.1 ? 0.6 + s * 4 : 1);
      for (let k = 0; k < TS; k++) {
        const an = k / TS * 2 * PI, o = (i * TS + k) * 3, cx = Math.cos(an) * wd, cy = Math.sin(an) * th;
        arr[o] = tA.x + tX.x * cx + tY.x * cy; arr[o + 1] = tA.y + tX.y * cx + tY.y * cy; arr[o + 2] = tA.z + tX.z * cx + tY.z * cy;
      }
    }
    P.needsUpdate = true; m.tongue.geometry.computeVertexNormals();
  }
  const sst = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Tongues are SHORT and lie ON her sole (10-02): a tongue reaches LICK_MAX from the mouth and no further, laps the
  // stretch of sole under the mouth (not the whole sole), and every ring of it that would come nearer her sole than its
  // own half thickness is pushed out along the sole's normal (drawTongue, while tFix is set). lickStat (window.__lick2):
  // the longest tongue drawn, how far short of the sole the worst one fell, the most a ring was pushed; in metres.
  const LICK_MAX = 0.09, LICK_AIR = 0.0022, lickStat = { len: 0, far: 0, push: 0, n: 0 };
  if (typeof window !== 'undefined') window.__lick2 = lickStat;
  let tFix = null; const lU = V3(), lV = V3(), fixF = { heel: null, arch: null, ball: null, n: null, fwd: V3(), side: V3(), L: 0.14, need: 0.005 };
  function soleFix(f, need) {                       // the sole's frame for the tongue about to be drawn
    fixF.heel = f.heel; fixF.arch = f.arch; fixF.ball = f.ball; fixF.n = f.n; fixF.need = need;
    fixF.fwd.subVectors(f.ball, f.heel); fixF.L = Math.max(0.05, fixF.fwd.length()); fixF.fwd.divideScalar(fixF.L); fixF.side.crossVectors(f.n, fixF.fwd).normalize();
    return fixF;
  }
  function soleAir(F, P) {                          // how far P stands off the sole (along its normal), or 9 when it is not over the foot
    const u = lU.subVectors(P, F.heel).dot(F.fwd) / F.L; if (u < -0.14 || u > 1.42) return 9;
    along(F.heel, F.arch, F.ball, clamp(u, 0, 1.35), lU); lV.subVectors(P, lU);
    const lat = Math.abs(lV.dot(F.side)); if (lat > 0.066) return 9;
    return lV.dot(F.n) + Math.max(0, lat - 0.028) * 0.6;
  }
  // a tongue from the mouth mP to the spot mQ on her sole: no longer than LICK_MAX (mQ is drawn back if it is)
  function layTongue(m, f, F, ext) {
    let D = mD.subVectors(mQ, mP).length(); lickStat.n++;
    if (D > LICK_MAX) { lickStat.far = Math.max(lickStat.far, D - LICK_MAX); mQ.copy(mP).addScaledVector(mD, LICK_MAX / D); D = LICK_MAX; }
    lickStat.len = Math.max(lickStat.len, D * ext);
    return D;
  }
  // One lick, as in the clip: the tongue lies curled in the mouth, rises and slides up her arch towards the heel, then
  // drags its whole flat length back down to the ball of her foot and curls away. A smooth loop, a little different per shoe.
  function lick(m, dt, f, sole) {
    m.ph = (m.ph + dt / (m.j ? 1.42 : 1.24)) % 1;
    const p = m.ph, ext = sst(p, 0.06, 0.3) * (1 - sst(p, 0.84, 1)), press = sst(p, 0.3, 0.48) * (1 - sst(p, 0.82, 0.94));
    m.obj.updateMatrixWorld(true);
    mY.set(0, 1, 0).transformDirection(m.obj.matrixWorld); mZ.set(0, 0, 1).transformDirection(m.obj.matrixWorld);
    mP.set(0, WPT + 0.012, 0.028).applyMatrix4(m.obj.matrixWorld);                               // root: the back of the mouth
    mB.copy(mP).addScaledVector(mZ, 0.034 * mScale).addScaledVector(mY, 0.006);                 // tip at rest: lying on the mouth's floor
    const F = soleFix(f, 0.0052 + LICK_AIR);
    // it laps the stretch of sole next to the mouth: up towards her heel, then back down
    const um = clamp(lU.subVectors(mP, f.heel).dot(F.fwd) / F.L, 0.25, 0.85), u = clamp(um + 0.2 * (p < 0.42 ? -sst(p, 0.08, 0.42) : -1 + 2 * sst(p, 0.42, 0.86)), 0.1, 1.0);
    along(f.heel, f.arch, f.ball, u, mQ).addScaledVector(f.n, F.need).addScaledVector(F.side, 0.008 * Math.sin(2 * PI * p + m.j));
    if (sole) mQ.addScaledVector(f.lat, sole);
    layTongue(m, f, F, ext, press);
    mQ.lerpVectors(mB, mQ, ext);                                                                // the tip
    mA.copy(mP).addScaledVector(mY, 0.008 + 0.014 * ext).addScaledVector(mZ, 0.010);             // it rises out of the mouth...
    mD.subVectors(mP, mQ).addScaledVector(f.n, -mD.dot(f.n)); if (mD.lengthSq() > 1e-8) mD.normalize();
    mC.copy(mQ).addScaledVector(f.n, 0.014 - 0.012 * press * ext).addScaledVector(mD, 0.022 * press * ext);   // ...and lays its end flat along her sole
    mX.crossVectors(f.n, mD); if (mX.lengthSq() < 1e-8) mX.copy(F.side);
    tFix = F; drawTongue(m, mP, mA, mC, mQ, mX, 0.0145, 0.0052, 0.0008); tFix = null;
    return ext;
  }
  // A Kun's tongue: short and pink. He stands with his mouth at the side of her sole (kunLick slides him there) and laps
  // the stretch of sole before it. It lies ON her sole and comes at it from the side he stands on.
  function kunLick(g, dt, f) {
    g.lph = (g.lph + dt / (g.j ? 1.5 : 1.32)) % 1;
    const p = g.lph, ext = sst(p, 0.04, 0.24) * (1 - sst(p, 0.86, 1)) * g.tk, press = sst(p, 0.24, 0.4) * (1 - sst(p, 0.82, 0.94));
    g.head.localToWorld(mP.set(0, 0.046, 0.108));                                              // his mouth
    const F = soleFix(f, 0.0034 + LICK_AIR); mF.copy(F.fwd); mS.copy(F.side);
    if ((g.mode === 'lick' || g.mode === 'shoe') && g.tk > 0.15) {                             // his mouth comes to the side of her sole (D: over the rim of her shoe), close
      if (!g.lsd) g.lsd = lU.subVectors(mP, f.arch).dot(mS) >= 0 ? 1 : -1;
      along(f.heel, f.arch, f.ball, 0.52, lV).addScaledVector(mS, g.lsd * 0.06).addScaledVector(f.n, 0.03).sub(mP);
      const k = Math.min(1, dt * 10); g.pos.x += lV.x * k; g.pos.z += lV.z * k; g.dest.copy(g.pos);
    } else g.lsd = 0;
    const um = clamp(lU.subVectors(mP, f.heel).dot(mF) / F.L, 0.2, 0.9), u = clamp(um + 0.3 * (sst(p, 0.2, 0.86) - 0.5), 0.1, 1.0);
    along(f.heel, f.arch, f.ball, u, mQ).addScaledVector(f.n, F.need).addScaledVector(mS, 0.007 * Math.sin(4 * PI * p + g.j));
    g.tip.copy(mQ);                                                                            // (his head follows it)
    layTongue(g, f, F, ext, press);
    mQ.lerpVectors(mP, mQ, ext);
    mD.subVectors(mQ, mP);
    mB.copy(mD).addScaledVector(f.n, -mD.dot(f.n)); if (mB.lengthSq() < 1e-8) mB.copy(mF); mB.normalize();      // the way it arrives, along her skin
    mX.crossVectors(f.n, mB);
    mA.copy(mP).addScaledVector(mD, 0.34).addScaledVector(f.n, 0.010 * ext);                    // it leaves his mouth...
    mC.copy(mQ).addScaledVector(f.n, (0.012 - 0.011 * press) * ext).addScaledVector(mB, -(0.010 + 0.016 * press) * ext);   // ...and its end lies flat on her sole
    tFix = F; drawTongue(g, mP, mA, mC, mQ, mX, 0.0098, 0.0034, 0.0006); tFix = null;
  }
  function wornFrame(f, m) {                       // the shoe as it sits on a foot (held as in a high heel): position and rotation
    mF.subVectors(f.ball, f.heel).normalize();
    mB.copy(f.n).negate().addScaledVector(mF, f.n.dot(mF)).normalize();                         // off the sole, into her foot
    const cy = (WH.bh - WH.hh) / WCH, cz = WH.bz / WCH;
    mY.copy(mF).multiplyScalar(cy).addScaledVector(mB, cz); mZ.copy(mF).multiplyScalar(cz).addScaledVector(mB, -cy); mX.crossVectors(mY, mZ);
    mM.makeBasis(mX, mY, mZ); qA.setFromRotationMatrix(mM);
    mA.copy(f.heel).addScaledVector(mY, -WH.hh * mScale);
  }
  function updMimic(dt, t) {
    mT += dt;
    for (const m of mimics) {                      // they blink (also while they just stand there)
      m.blink -= dt; const sy = m.blink < 0.12 ? 0.15 : 1; if (m.blink < 0) m.blink = 1.5 + 3 * rnd();
      for (const e of m.eyes) e.scale.y = sy;
    }
    if (!sitting) return;
    mPutT += dt;
    for (const m of mimics) {
      const f = feet[m.j], busy = mPhase > 0 && (m.j === 0 || mPhase === 2);                    // the right shoe first, the left one joins in later
      m.k += ((busy ? 1 : 0) - m.k) * ease(4, dt);
      wornFrame(f, m);                             // -> mA (position), qA (rotation), mX mY mZ
      mS.crossVectors(f.n, mF).normalize();
      if (mPhase === 0) {                          // she puts them on: each stands in front of its foot, then slides on under her hands
        const q = mPutT / mPutLen, a0 = m.j ? 0.5 : 0.08, on = sst(q, a0, a0 + 0.22); m.on = on;
        mB.set(mZ.x, 0, mZ.z).normalize();
        m.obj.position.copy(mA).addScaledVector(mB, 0.19 * (1 - on)); m.obj.position.y = mA.y * on;
        m.obj.quaternion.copy(qA); if (on < 1) { qB.setFromAxisAngle(UP, Math.atan2(mB.x, mB.z) + (m.j ? 0.25 : -0.25) * (1 - on)); m.obj.quaternion.slerp(qB, 1 - on); }
        m.tongue.visible = false; continue;
      }
      // They stay on her feet; awake, the tongue comes up out of the mouth under her arch and laps at her sole.
      m.obj.position.copy(mA); m.obj.quaternion.copy(qA);
      if (shot === 'mside') mLeft = true;
      const awake = m.j === 0 || mLeft || mPhase === 2;
      m.tongue.visible = awake;
      if (awake) lick(m, dt, f, 0);
    }
  }

  // ---------- camera shots ----------
  // The cameras stay over walkable ground: the host's grid when it passes one (ctx.walkAt), else the level's own.
  let walkAt = typeof ctx.walkAt === 'function' ? ctx.walkAt : null;
  if (!walkAt) fetch(new URL('level.json', import.meta.url)).then((r) => r.json()).then((lv) => {
    walkAt = (x, y) => x >= 0 && y >= 0 && x < lv.width && y < lv.height && lv.walkable[y][x] === '1';
  }).catch(() => console.warn('[logscene] no walkable grid (level.json): the scene cameras are not kept out of the trees'));
  const tile0 = ctx.tc(0, 0), TILE = ctx.S || 1.6, CAM_GAP = 1.2;     // CAM_GAP: the edge bushes spill into the clearing
  const openAt = (x, z) => !walkAt || walkAt(Math.floor((x - tile0.x) / TILE + 0.5), Math.floor((z - tile0.z) / TILE + 0.5));
  function clearRun(from, dx, dz, want) {      // how far (up to `want`) a camera can back off from `from` along (dx, dz) in the open
    for (let d = 0.2; d < want + CAM_GAP; d += 0.2) {
      const x = from.x + dx * d, z = from.z + dz * d;
      if (!openAt(x, z) || !openAt(x + dz * 0.6, z - dx * 0.6) || !openAt(x - dz * 0.6, z + dx * 0.6)) return Math.min(want, Math.max(0, d - CAM_GAP));
    }
    return want;
  }
  function updCamera(dt) {
    const k = clamp(1.3 / Math.max(0.3, camera.aspect), 1, 2.2);      // pull back on narrow screens
    if (shot === 'face' && stuck) {
      // A fixed 3/4 view from just below her hat brim (the head bobs inside the frame instead of dragging the camera)
      goalLook.set(base.x, FACE_Y, northZ - FACE_N);
      goalPos.set(goalLook.x + 0.3, FACE_Y, goalLook.z - Math.max(1, clearRun(goalLook, 0, -1, 1.5 * k)));
      setFocus(goalLook);
    } else if (shot === 'kunsee' && !stuck && !sitting) {
      // The Kuns as she sees them, looking down from where she stands: they stare up at her, then run.
      _c.set(anne.position.x - wideFocus.x, 0, anne.position.z - wideFocus.z); if (_c.lengthSq() < 1e-4) _c.set(0, 0, -1); _c.normalize();
      goalLook.set(wideFocus.x + _c.x * 0.2, 0.06, wideFocus.z + _c.z * 0.2);                 // (a little this side of them: the dialogue box covers the bottom of the picture)
      goalPos.set(wideFocus.x + _c.x * 1.3 + _c.z * 0.2, 1.0, wideFocus.z + _c.z * 1.3 - _c.x * 0.2); setFocus(solesFocus.copy(goalLook), 1.4); mFov = 32;
    } else if (shot === 'aface' && !stuck && !sitting) {     // her face, standing: she is cross
      mk('Head', goalLook); const fy = anne.rotation.y, fx = Math.sin(fy), fz = Math.cos(fy);
      goalPos.set(goalLook.x + fx * 1.3 + fz * 0.42, goalLook.y - 0.14, goalLook.z + fz * 1.3 - fx * 0.42); goalLook.y -= 0.07; setFocus(goalLook, 1.2);
    } else if (shot === 'flash' && !stuck && !sitting) {     // (10-03) the sole flash: low behind the foot that comes up, on its sole
      const sd = flashName.endsWith('R') ? 'R' : 'L', sg = sd === 'R' ? -1 : 1, fy = anne.rotation.y, bx = -Math.sin(fy), bz = -Math.cos(fy), lx = Math.cos(fy), lz = -Math.sin(fy);
      mk(`Sole_${sd}_Out`, goalPos); mk(`Sole_${sd}_Arch`, goalLook); goalPos.sub(goalLook); goalPos.y = 0;      // (as captures.js: facing the sole, turned 30 degrees to its outer side)
      if (goalPos.lengthSq() < 1e-6) goalPos.set(bx, 0, bz); goalPos.normalize();
      const ox = lx * sg - goalPos.x * (lx * sg * goalPos.x + lz * sg * goalPos.z), oz = lz * sg - goalPos.z * (lx * sg * goalPos.x + lz * sg * goalPos.z), ol = Math.hypot(ox, oz) || 1;
      const cx = goalPos.x * 0.866 + ox / ol * 0.5, cz = goalPos.z * 0.866 + oz / ol * 0.5;
      mk(`Sole_${sd}_Heel`, _c); goalLook.lerp(_c, 0.6);
      goalPos.set(goalLook.x + cx * 0.5, Math.max(0.07, goalLook.y - 0.035), goalLook.z + cz * 0.5);
      setFocus(solesFocus.copy(goalLook), 1.4); goalLook.y -= 0.05; mFov = 38;      // (looking a little under it: the dialogue box covers the bottom quarter)
    } else if (shot === 'play') {                            // (10-03) the brush: wherever footplay.js wants the camera (between her soles it stays put)
      const g = ctx.footPlay && ctx.footPlay.camGoal();
      if (g) { goalPos.copy(g.p); goalLook.copy(g.l); setFocus(solesFocus.copy(g.l), 1.4); mFov = g.fov; }
    } else if (shot === 'test' && testCam) { goalPos.copy(testCam.p); goalLook.copy(testCam.l); setFocus(null);        // (tests: __lsCam)
    } else if (shot === 'own' && own.on) {           // (10-03) her own shoes going back on: as 'mput', wherever she sits
      const fx = Math.sin(own.yaw), fz = Math.cos(own.yaw), a = own.yaw - 0.95;
      goalLook.set(anne.position.x + fx * 0.3, 0.34, anne.position.z + fz * 0.3);
      const want = 1.75 * k, d = Math.max(1.2, clearRun(goalLook, Math.sin(a), Math.cos(a), want));
      goalPos.set(goalLook.x + Math.sin(a) * d, 0.8, goalLook.z + Math.cos(a) * d); setFocus(null); mFov = baseFov;
    } else if ((shot === 'msit' || shot === 'mput') && sitting) {         // her whole figure on the ground, from her front right (closer while she puts them on)
      const fx = Math.sin(SIT_YAW), fz = Math.cos(SIT_YAW), a = SIT_YAW - 0.95, put = shot === 'mput';
      goalLook.set(anne.position.x + fx * (put ? 0.3 : 0.5), put ? 0.34 : 0.42, anne.position.z + fz * (put ? 0.3 : 0.5));
      const want = (put ? 1.75 : 2.5) * k, d = Math.max(1.2, clearRun(goalLook, Math.sin(a), Math.cos(a), want));   // never back into the bushes
      goalPos.set(goalLook.x + Math.sin(a) * d, put ? 0.8 : 0.95, goalLook.z + Math.cos(a) * d); setFocus(null); mFov = baseFov;
    } else if (shot === 'msole' && sitting) {        // the sole of the foot the shoe hangs from (both, once both are at it)
      const f = feet[0];
      goalLook.copy(f.sArch); if (mPhase === 2) goalLook.add(feet[1].sArch).multiplyScalar(0.5);
      setFocus(solesFocus.copy(goalLook), 2.0); mFov = mPhase === 2 ? 34 : 32;
      _c.set(-Math.cos(SIT_YAW), 0, Math.sin(SIT_YAW));                                      // her right-hand side: the shoe and her arch in profile
      goalPos.copy(goalLook).addScaledVector(_c, (mPhase === 2 ? 0.95 : 0.72) * Math.min(k, 1.6)).addScaledVector(f.sn, 0.12); goalPos.y = Math.max(0.12, goalPos.y + (mPhase === 2 ? 0.16 : 0.02)); goalLook.y += 0.02;
    } else if (shot === 'mside' && sitting) {        // bonus: the other foot from the side, low: the shoe she still wears licks her ankle
      const f = feet[1];
      goalLook.lerpVectors(f.sHeel, f.sBall, 0.5); goalLook.y = Math.max(0.07, f.sHeel.y * 0.75);
      setFocus(solesFocus.copy(goalLook), 2.0); mFov = 34;
      _c.set(f.sBall.x - f.sHeel.x, 0, f.sBall.z - f.sHeel.z).normalize();                        // side-on, from a touch behind and below, as in the clip
      goalPos.copy(goalLook).addScaledVector(f.lat, -0.6 * Math.min(k, 1.6)).addScaledVector(_c, -0.16); goalPos.y = 0.03;
      goalLook.y -= 0.075;                         // the dialogue box covers the bottom quarter: keep the foot above it
    } else if ((shot === 'soles' || shot === 'kicks') && stuck) {
      // The close-up: both soles fill the frame and sit high in it (the dialogue box covers its bottom quarter).
      // A shallow depth of field keeps the soles and the feathers sharp and melts everything behind them.
      goalLook.addVectors(feet[0].sArch, feet[1].sArch).multiplyScalar(0.5);   // the smoothed soles: her kicking does not shake the camera
      setFocus(solesFocus.copy(goalLook), shot === 'soles' ? 2.2 : 1.6);
      const ny = clamp((feet[0].sn.y + feet[1].sn.y) * 0.5, -1, 1), elGoal = clamp(Math.asin(ny), 0.45, 0.95);
      solesElev = cutCam || camKey !== SOLES_KEY ? elGoal : solesElev + (elGoal - solesElev) * ease(2, dt);
      const half = Math.tan(SOLES_FOV * Math.PI / 360), ce = Math.cos(solesElev), ax = Math.sin(SOLES_AZ), az = Math.cos(SOLES_AZ);
      const want = Math.max(SOLES_DIST, SOLES_SPAN / (2 * half * camera.aspect));        // further back on a narrow screen
      const d = Math.min(want, Math.max(1.0, clearRun(goalLook, ax, az, want * ce) / ce));
      // no room to back off that far: a wider lens instead
      const tight = d < want - 0.01 ? Math.min(62, 2 * Math.atan(SOLES_SPAN / (2 * d * camera.aspect)) * 180 / Math.PI) : SOLES_FOV;
      solesFov = shot === 'kicks' ? Math.max(KICKS_FOV, tight) : tight;
      if (shot === 'soles') goalLook.y -= 0.18 * d * Math.tan(solesFov * Math.PI / 360);
      goalPos.set(goalLook.x + ax * ce * d, goalLook.y + Math.sin(solesElev) * d, goalLook.z + az * ce * d);
    } else if (shot === 'feet' && stuck) {
      // The 2D game's view of this scene: from behind and above, looking down the length of her legs to the log's back
      // mouth. Her soles face this camera; the Kuns stand either side of her feet.
      _c.addVectors(feet[0].sArch, feet[1].sArch).multiplyScalar(0.5);         // the smoothed soles: her kicking does not shake the camera
      goalLook.set(base.x, 0.12, southZ + 0.2 + 0.48 * clamp(_c.z - southZ, 0.2, 1));      // (the dialogue box covers the bottom quarter: her feet sit just above it, the log at the top)
      const el = 0.8, want = 1.85 * k * Math.cos(el), run = Math.max(0.9, clearRun(goalLook, 0.09, 1, want));
      goalPos.set(goalLook.x + 0.09 * run, goalLook.y + Math.tan(el) * run, goalLook.z + run);
      setFocus(_c.setY(Math.max(0.06, _c.y)));
    } else {
      const wf = kuns[0].mode === 'carry' ? kuns[0].pos : feet[1].sArch;        // the robbery: pan with the Kun who has the pouch
      if (stuck) goalLook.set((chestTarget.x + wf.x) / 2, 0.6, (chestTarget.z + wf.z) / 2);
      else goalLook.set((anne.position.x + wideFocus.x) / 2, 0.8, (anne.position.z + wideFocus.z) / 2);
      // Keep the bearing while the boom fits on it. When it doesn't (narrow screens pull back a long way), swing to
      // the nearest bearing with clearly more room (15° steps either side of the preferred one) and rise for the rest.
      const want = 3.9 * k;
      if (camDirOf !== wideDir) { camDirOf = wideDir; camDir.copy(wideDir); }
      let run = clearRun(goalLook, camDir.x, camDir.z, want);
      if (run < want - 0.3) {
        let best = run + 0.6;
        for (let i = 0; i <= 12; i++) {
          _c.copy(wideDir).applyAxisAngle(UP, (i & 1 ? 1 : -1) * ((i + 1) >> 1) * 0.2618);
          const r = clearRun(goalLook, _c.x, _c.z, want);
          if (r > best) { best = run = r; camDir.copy(_c); }
          if (r >= want) break;
        }
      }
      run = Math.max(1.5, run);
      goalPos.copy(goalLook).addScaledVector(camDir, run); goalPos.y += 1.35 + 0.35 * (want - run);
      setFocus(null);
    }
    const key = SHOT_ID[shot] + (stuck ? 1 : 0);
    if (key !== camKey && (key === SOLES_KEY || camKey === SOLES_KEY || key >= 8 || camKey >= 8)) cutCam = true;    // into and out of a close-up: always a cut
    const fovGoal = key === SOLES_KEY ? solesFov : key >= 10 ? mFov : baseFov;                             // within the close-up the lens zooms; a cut sets it
    const fov = cutCam || key !== camKey ? fovGoal : camera.fov + (fovGoal - camera.fov) * ease(6, dt);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // close-ups are drawn at (nearly) the screen's own resolution; the host builds what that needs while she gets stuck
    // (the screen is black then) and drops it when she stands up (black again)
    if (ctx.setCloseUp) ctx.setCloseUp(stuck ? (key === SOLES_KEY ? 'on' : 'ready') : key >= 10 ? 'on' : 'off');
    if (cutCam) { camPos.copy(goalPos); camLook.copy(goalLook); cutCam = false; camT = 1; camKey = key; }
    else if (key !== camKey) {                 // new shot: 0.5 s smoothstep, lifted over the log on long moves
      camKey = key; camT = 0; fromPos.copy(camPos); fromLook.copy(camLook); camLift = Math.min(1.4, 0.35 * fromPos.distanceTo(goalPos));
    }
    if (camT < 1) {
      camT = Math.min(1, camT + dt / 0.5); const e = camT * camT * (3 - 2 * camT);
      camPos.lerpVectors(fromPos, goalPos, e); camPos.y += Math.sin(Math.PI * e) * camLift; camLook.lerpVectors(fromLook, goalLook, e);
    } else { camPos.lerp(goalPos, ease(8, dt)); camLook.lerp(goalLook, ease(8, dt)); }
    lsClock += dt; if (key !== heldKey) { heldKey = key; heldT = lsClock; }
    if (LSKIT && shot !== 'play' && shot !== 'test') {
      const d = camPos.distanceTo(camLook), kk = 1 / (1 + 0.035 * Math.min(1, (lsClock - heldT) / 9)), a = Math.min(0.012, 0.0035 * d);
      camera.position.set(camLook.x + (camPos.x - camLook.x) * kk + a * lsN1(lsClock * 0.17 + 1.3),
        Math.max(camPos.y - 0.02, camLook.y + (camPos.y - camLook.y) * kk + 0.6 * a * lsN2(lsClock * 0.15 + 4.1)),
        camLook.z + (camPos.z - camLook.z) * kk + a * lsN3(lsClock * 0.19 + 8.2));
    } else camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function lateUpdate(dt, t) {
    herbT = t;
    updProps(dt); updParticles(dt); updMimic(dt, t);
    if (!active) return;
    if (sitting || own.on) { anne.updateMatrixWorld(true); readFeet(dt); updOwn(dt); }
    if (stuck) {                               // pin Marker_Chest to the log's centre
      mk('Chest', _a); _b.subVectors(chestTarget, _a);
      // Hard-snap while the screen is black: the host cross-fades clips, so her pose is still settling into the stuck one.
      if (snapChest || fadeV >= 0.999) { anne.position.add(_b); snapChest = false; } else anne.position.addScaledVector(_b, ease(10, dt));
      anne.updateMatrixWorld(true);
      readFeet(dt);
    }
    swapRoles(dt);
    for (const g of kuns) updKun(g, dt, t);
    if (KD.shoe && KD.mode !== 'hidden' && KD.mode !== 'gone') updShoeKun(KD, dt); else if (KD.shoe) dropShoe(KD);
    updBeds(dt);
    updTies();
    updCamera(dt);
  }

  const nearMimic = () => Math.hypot(anne.position.x - STONE.x, anne.position.z - STONE.z) <= 1.35;
  const api = {
    update(dt, t) {
      if (!active) { if (cooldown > 0) cooldown -= dt; return; }
      if (ending >= 0) {                       // the script is over; wait (briefly) for the closing key to come up
        ending += dt;
        if (held.size && ending < 0.5) return;
        ending = -1; active = false; cooldown = 0.6; held.clear();
        ctx.onEnd(); return;
      }
      const press = presses > 0;
      if (press) presses = Math.min(presses - 1, 1);   // one press per frame, at most one queued behind it
      if (flashV > 0) setFlash(Math.max(0, flashV - dt * 2.5));
      if (stompT > 0 && (stompT -= dt) <= 0 && curClip === 'Stomp') clip('Idle', 0.3);
      runScript(dt, armed && press);
      if (!cur || !cur.op.keys) presses = 0;   // presses made during fades and walks are dropped
      armed = true;                            // ignore the key event that triggered interact()
    },
    lateUpdate,
    isActive: () => active,
    ready: portraitsReady,                     // resolves once the dialogue portraits are decoded
    // The prompt stays up during the post-scene cooldown (interact() just ignores it then): with no prompt the host
    // would read a second tap of E as "turn the camera".
    promptText() {
      if (active) return null;
      if (nearMimic()) return 'E — Look at the shoes';
      const dx = anne.position.x - base.x, dz = anne.position.z - clamp(anne.position.z, northZ, southZ);
      return dx * dx + dz * dz <= 1.7 * 1.7 ? 'E — Inspect the log' : null;
    },
    interact() {
      if (active || cooldown > 0) return;      // the cooldown stops a double-tap from starting the scene again
      active = true; armed = false; presses = 0; moves = 0; curClip = ''; cutCam = false; ending = -1; stompT = 0; camDirOf = null; held.clear(); KD.shoe = null; dLicked = false; flashing = false;
      for (const p of props) { p.bedK = 0; if (p.beds) for (const k in p.beds) p.beds[k].show(null, 0); }
      baseFov = camera.fov;
      camPos.copy(camera.position); camera.getWorldDirection(_a); camLook.copy(camPos).addScaledVector(_a, 4); camKey = -1;
      lastExpr = 'neutral'; lastBlush = 0; shot = 'wide'; wideDir = WIDE_NW; wideFocus.copy(base); cur = null;
      if (nearMimic()) { pc = labels.mimic; wideFocus.copy(STONE); wideDir = WIDE_SW; }
      else if (trapDone) pc = labels.repeat;
      else { pc = labels.start; pulled = false; misses = 0; stuck = false; TIE.on = false; TIE.k = TIE.knot = TIE.toe = TIE.peg = TIE.taut = TIE.hold = 0; pegAt.set(0, 0, 0); }
    },
    obstacles: () => OBST,
    mimicPos: () => STONE,
    putT: () => (sitting && mPhase === 0 ? mPutT : -1),
    mimicProbe: () => ({ parts: mimics[1].obj.children.map((ch) => { const b = new THREE.Box3().setFromObject(ch); return [ch.geometry ? ch.geometry.type : 'grp', ...b.min.toArray().map((v) => +v.toFixed(2)), ...b.max.toArray().map((v) => +v.toFixed(2))]; }).filter((p) => p[5] - p[2] > 0.1 || /Torus|Cyl/.test(p[0])), mPutT, mPutLen, mPhase, mScale, clip: curClip, m: mimics.map((m) => ({ p: m.obj.position.toArray().map((v) => +v.toFixed(3)), y: V3(0, 1, 0).applyQuaternion(m.obj.quaternion).toArray().map((v) => +v.toFixed(2)), z: V3(0, 0, 1).applyQuaternion(m.obj.quaternion).toArray().map((v) => +v.toFixed(2)), on: m.on, k: m.k })),
      feet: feet.map((f) => ({ heel: f.heel.toArray().map((v) => +v.toFixed(3)), ball: f.ball.toArray().map((v) => +v.toFixed(3)), n: f.n.toArray().map((v) => +v.toFixed(2)) })) }),
    ownT: () => (own.put ? own.t : -1),
    dLick: () => (KD.mode === 'shoe' ? KD.mt : -1),
    grassFlat: () => (flashing && active ? flashFlat : sitting ? flat : own.on ? own.flat : stuck ||(active && kuns.some((g) => g.mode !== 'hidden' && g.mode !== 'gone')) ? flatLog : null),
  };
  if (typeof window !== 'undefined' && /[?&](ls|ms)=/.test(location.search)) {      // (tests) her loose shoes as drawn; a shot to look through
    const bx = new THREE.Box3();
    window.__lsShoes = () => props.map((p) => { p.obj.updateMatrixWorld(true); bx.setFromObject(p.obj, true); return { state: p.state, lie: p.lie, vis: p.obj.visible, minY: +bx.min.y.toFixed(4), maxY: +bx.max.y.toFixed(4), x: +(p.obj.position.x - base.x).toFixed(3), z: +(p.obj.position.z - base.z).toFixed(3) }; });
    window.__lsShot = (s) => { shot = s; cutCam = true; };
    window.__lsCam = (i, d = 0.55, h = 0.3, a = 0) => { const p = props[i].obj.position; testCam = { p: V3(p.x + Math.sin(a) * d, h, p.z + Math.cos(a) * d), l: V3(p.x, 0.05, p.z) }; shot = 'test'; cutCam = true; };
    window.__lsD = () => ({ mode: KD.mode, mt: +KD.mt.toFixed(2), x: +(KD.pos.x - base.x).toFixed(3), z: +(KD.pos.z - base.z).toFixed(3), tongue: !!(KD.tongue && KD.tongue.visible), lick: lickStat });
  }
  if (PROBE) {                                 // also time the module's own work per frame
    const T = PROBE.time = { frames: 0, updMs: 0, lateMs: 0, updMax: 0, lateMax: 0, worstAt: '' }, u = api.update, l = api.lateUpdate;
    api.update = (dt, t) => { const a = performance.now(); u(dt, t); const d = performance.now() - a; if (active) { T.frames++; T.updMs += d; if (d > T.updMax) { T.updMax = d; T.worstAt = 'update at line ' + dlg.dataset.line; } } };
    api.lateUpdate = (dt, t) => { const a = performance.now(); l(dt, t); const d = performance.now() - a; if (active) { T.lateMs += d; if (d > T.lateMax) { T.lateMax = d; if (d > T.updMax) T.worstAt = 'lateUpdate at line ' + dlg.dataset.line; } } };
  }
  return api;
}
