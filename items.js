// items.js (10-12): the 2D game's plants to gather (its CE 122: "item ALOE / BERRIES / CLOVER / BLOSSOM"), and the
// Mandragora, which is a chase and nothing else: a tuft of leaves in the ground that rustles now and then; touched, a
// little walking root hops out with a squeal and runs from her, half as fast as she walks, a pause between its steps;
// caught, it gives its leaves (in the Glade of Lys its root) and is gone. There is no inventory in the 3D yet: every
// ingredient counts as herbs and is named in a toast (as the chests do, creatures.js).
//
//   createItems(S, C, env, ck) -> { plant(kind, id, tx, ty, o), mandragora(id, tx, ty, o), make }
//     kind: 'aloe' | 'berries' | 'blossom' | 'clover'      o: { n: [min, max] }
//     mandragora o: { gives: 'leaf' | 'root', tint: 0..2, when() }
export function createItems(S, C, env, ck) {
  const { THREE, scene, anne, TILE } = S, K = C.K, { sparks } = C, PI = Math.PI, TAU = PI * 2;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), col = K.col, LED = S.ledge;
  const GREEN = new THREE.Color(0.5, 1.6, 0.5), GOLD = new THREE.Color(1.7, 1.3, 0.4);
  const mesh = (parts, mat = K.MAT.plant, cast = true) => K.shadowy(new THREE.Mesh(K.merge(parts), mat), cast);

  // ---------- what they look like ----------
  const make = {
    aloe: (seed) => { const a = K.makeAloe(seed); return { obj: a.obj, picked: (v) => a.picked(v) }; },
    // a low bush hung with red berries
    berries(seed) {
      const r = K.rng(seed), bush = [], fruit = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r.r(-0.3, 0.3), d = i ? r.r(0.1, 0.2) : 0; bush.push(K.place(K.ball(r.r(0.15, 0.2), K.mix(col(0.07, 0.24, 0.06), col(0.13, 0.36, 0.09), r()), 1, 0.85, 1, 9), V3(Math.cos(a) * d, r.r(0.13, 0.2), Math.sin(a) * d))); }
      for (let i = 0; i < 9; i++) { const a = r() * TAU; bush.push(K.place(K.leaf(r.r(0.1, 0.15), 0.07, 0.4, 0.3, i % 2 ? K.G.leaf : K.G.leaf2), V3(Math.cos(a) * 0.2, r.r(0.14, 0.3), Math.sin(a) * 0.2), V3(Math.cos(a), 0.7, Math.sin(a)))); }
      for (let i = 0; i < 18; i++) { const a = r() * TAU, d = r.r(0.16, 0.3), y = r.r(0.1, 0.34); fruit.push(K.place(K.ball(r.r(0.02, 0.028), K.mix(col(0.75, 0.05, 0.06), col(0.95, 0.16, 0.1), r()), 1, 1, 1, 7), V3(Math.cos(a) * d * (1 - y * 0.6), y, Math.sin(a) * d * (1 - y * 0.6)))); }
      const obj = new THREE.Group(), b = mesh(fruit); obj.add(mesh(bush), b); obj.name = 'Berries';
      return { obj, picked: (v) => { b.visible = !v; } };
    },
    // a wild blossom: a spray of pink flowers over a few leaves
    blossom(seed) {
      const r = K.rng(seed), green = [], heads = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r.r(-0.2, 0.2); green.push(K.place(K.leaf(r.r(0.16, 0.24), 0.09, 0.5, 0.3, i % 2 ? col(0.14, 0.4, 0.12) : col(0.1, 0.32, 0.14), 0.6, 5), V3(0, 0.01, 0), V3(Math.cos(a) * 0.8, 0.8, Math.sin(a) * 0.8))); }
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + r.r(-0.3, 0.3), d = i ? r.r(0.06, 0.13) : 0, h = r.r(0.26, 0.42), top = V3(Math.cos(a) * d * 1.6, h, Math.sin(a) * d * 1.6);
        green.push(K.tube([V3(Math.cos(a) * d * 0.4, 0, Math.sin(a) * d * 0.4), V3(Math.cos(a) * d, h * 0.55, Math.sin(a) * d), top], (t) => 0.011 * (1 - 0.4 * t), () => col(0.12, 0.32, 0.1), 5, 6));
        heads.push(K.place(K.flower(r.r(0.055, 0.075), 5, K.mix(col(0.95, 0.45, 0.65), col(1.0, 0.7, 0.82), r()), col(0.95, 0.85, 0.4), 0.3), top, V3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3)));
      }
      const obj = new THREE.Group(), f = mesh(heads, K.MAT.plant, false); obj.add(mesh(green), f); obj.name = 'Blossom';
      return { obj, picked: (v) => { f.visible = !v; } };
    },
    // a patch of clover, one of them four-leaved
    clover(seed) {
      const r = K.rng(seed), green = [], lucky = [];
      const sprig = (list, x, z, h, n, c) => {
        list.push(K.tube([V3(x, 0, z), V3(x + 0.01, h, z)], () => 0.006, () => col(0.12, 0.34, 0.1), 4, 3));
        for (let k = 0; k < n; k++) { const a = k / n * TAU + x * 9; list.push(K.place(K.ball(0.032, c, 1, 0.22, 1, 7), V3(x + 0.01 + Math.cos(a) * 0.03, h, z + Math.sin(a) * 0.03))); }
      };
      for (let i = 0; i < 16; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.26; sprig(green, Math.cos(a) * d, Math.sin(a) * d, r.r(0.05, 0.11), 3, K.mix(col(0.1, 0.36, 0.1), col(0.18, 0.5, 0.14), r())); }
      sprig(lucky, 0.02, 0.01, 0.14, 4, col(0.3, 0.7, 0.2));
      const obj = new THREE.Group(), f = mesh(lucky, K.MAT.plant, false); obj.add(mesh(green, K.MAT.plant, false), f); obj.name = 'Clover';
      return { obj, picked: (v) => { f.visible = !v; } };
    },
    // the Mandragora: a root on two stubby legs, a tuft of leaves on its head (all that shows while it sits in the ground)
    mandragora(seed, tint = 0) {
      const r = K.rng(seed), skin = [col(0.78, 0.64, 0.46), col(0.82, 0.52, 0.6), col(0.84, 0.74, 0.36)][tint % 3], dark = K.mix(skin, col(0.2, 0.12, 0.08), 0.45);
      const body = [], tuft = [];
      body.push(K.lathe([[0.001, 0.07], [0.05, 0.08], [0.085, 0.14], [0.095, 0.2], [0.085, 0.26], [0.06, 0.3], [0.03, 0.32], [0.001, 0.325]], (p) => K.mix(dark, skin, Math.min(1, 0.35 + p.y * 2.6)), 12));
      for (const s of [-1, 1]) {
        body.push(K.place(K.cone(0.03, 0.09, dark, 6), V3(s * 0.045, 0.085, 0), V3(s * 0.25, -1, 0)));                         // legs
        body.push(K.tube([V3(s * 0.08, 0.2, 0), V3(s * 0.14, 0.17, 0.02), V3(s * 0.17, 0.2, 0.03)], (t) => 0.014 * (1 - 0.5 * t), () => skin, 5, 5));      // arms
        body.push(K.place(K.ball(0.014, col(0.03, 0.02, 0.02), 1, 1.2, 0.6, 6), V3(s * 0.035, 0.235, 0.082)));              // eyes
      }
      body.push(K.place(K.ball(0.02, col(0.25, 0.06, 0.06), 1.1, 0.7, 0.5, 6), V3(0, 0.19, 0.09)));                           // its mouth, open
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r.r(-0.2, 0.2), up = i < 2; tuft.push(K.place(K.leaf(r.r(0.16, 0.24), 0.07, up ? 0.25 : 0.7, 0.3, i % 2 ? col(0.14, 0.44, 0.14) : col(0.2, 0.5, 0.12), 0.6, 5), V3(0, 0.315, 0), V3(Math.cos(a) * (up ? 0.25 : 1), up ? 1 : 0.42, Math.sin(a) * (up ? 0.25 : 1)))); }
      const obj = new THREE.Group(), inner = new THREE.Group(), b = mesh(body), t = mesh(tuft, K.MAT.plant, false); inner.add(b, t); obj.add(inner); obj.name = 'Mandragora';
      return { obj, inner, body: b, tuft: t };
    },
  };

  // ---------- a plant to pick ----------
  const NAME = { aloe: 'Aloe', berries: 'Berries', blossom: 'Wild Blossom', clover: 'Clover' }, COUNT = { aloe: [1, 2], berries: [2, 4], blossom: [1, 2], clover: [1, 2] };
  let seedN = 40;
  function plant(kind, id, tx, ty, o = {}) {
    const at = ck.spot(tx, ty), pl = make[kind](++seedN + tx * 3 + ty), p = at.p;
    pl.obj.position.copy(p); pl.obj.rotation.y = (tx * 7 + ty * 13) % 6; scene.add(pl.obj);
    if (kind === 'aloe' || kind === 'berries') S.block(id + 'B', p.x, p.z, kind === 'aloe' ? 0.3 : 0.34);
    const ev = S.on({ id, at: p, r: 1.35, action: 'E — Pick the ' + NAME[kind].toLowerCase(), run: async () => {
      await S.turnTo(p); S.emote(anne, 'exclaim', 0.7);
      let t = 0; S.se('se_Item1', 0.6, 1.1);
      await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.5); pl.obj.rotation.z = 0.16 * Math.sin(k * PI * 5) * (1 - k); return k >= 1; });      // (it is shaken: the 2D's plant flicks left and right)
      pl.obj.rotation.z = 0; pl.picked(true); sparks.burst(V3(p.x, 0.4, p.z), GREEN, 14, 0.9, 1.3);
      const [a, b] = o.n || COUNT[kind], n = a + Math.floor(Math.random() * (b - a + 1));
      S.addHerbs(n); S.toast(`${NAME[kind]} x${n}`, 'success', 1.8); S.remove(id);
    } });
    if (!ev) pl.picked(true);                        // (picked on an earlier visit)
    return pl;
  }

  // ---------- the Mandragora ----------
  // (one touch event that goes with it: the first touch and it is out of the ground and away; the next one has it)
  function mandragora(id, tx, ty, o = {}) {
    const home = S.tileC(tx, ty), m = make.mandragora(tx * 5 + ty * 3 + 1, o.tint === undefined ? (tx + ty) % 3 : o.tint), DOWN = -0.3;
    m.obj.position.copy(home); m.obj.rotation.y = (tx * 3 + ty) % 6; m.inner.position.y = DOWN; m.body.visible = false; scene.add(m.obj);
    const st = { mode: 'buried', t: Math.random() * 8, hop: null, pause: 0, steps: 0, lv: LED ? LED.levelAt(home.x, home.z) : 0 };
    const okAt = (x, z) => env.walkAt(Math.floor(x / TILE), Math.floor(z / TILE)) && (!LED || LED.levelAt(x, z) === st.lv) && Math.hypot(x - home.x, z - home.z) < 5.5 * TILE;
    const squeal = (v = 0.5) => S.se('se_vo_gnome_hit1', v, 1.75 + Math.random() * 0.3);
    const hopTo = (x, z, sec = 0.3) => { st.hop = { x0: m.obj.position.x, z0: m.obj.position.z, x, z, t: 0, sec }; m.obj.rotation.y = Math.atan2(x - m.obj.position.x, z - m.obj.position.z); };
    // a step away from her: the way that takes it furthest from her among those it may go
    function flee(len = 0.62) {
      const p = m.obj.position, ax = p.x - anne.position.x, az = p.z - anne.position.z, base = Math.atan2(ax, az); let best = null, bd = -1;
      for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
        const a = base + da + (Math.random() - 0.5) * 0.3, x = p.x + Math.sin(a) * len, z = p.z + Math.cos(a) * len; if (!okAt(x, z)) continue;
        const d = Math.hypot(x - anne.position.x, z - anne.position.z) - Math.abs(da) * 0.12; if (d > bd) { bd = d; best = [x, z]; }
      }
      if (best) hopTo(best[0], best[1]); return !!best;
    }
    const ev = S.on({ id, at: home, r: 0.85, touch: true, when: () => st.mode !== 'gone' && (!o.when || o.when()), run: async () => {
      if (st.mode === 'buried') {                    // out of the ground with a squeal, and one hop away
        st.mode = 'out'; m.body.visible = true; S.se('se_Jump2', 0.6, 1.4); S.emote(anne, 'exclaim', 0.7); S.expr('surprised');
        let t = 0; await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.22); m.inner.position.y = DOWN * (1 - k) + 0.14 * Math.sin(PI * k); return k >= 1; });
        m.inner.position.y = 0; squeal(0.6); if (!flee(TILE * 0.9)) flee(0.5);
        if (!S.flag('mandraSeen')) { S.flag('mandraSeen', true); S.toast('A Mandragora!! Catch it!', 'warning', 2.2); }
        await S.wait(0.25); S.expr('angry');
        return;
      }
      // caught
      st.mode = 'gone'; st.hop = null; squeal(0.7);
      const p = m.obj.position; await S.turnTo(p, 0.12);
      let t = 0; await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.3); m.inner.scale.setScalar(1 - 0.85 * k); m.inner.rotation.y += dt * 22; return k >= 1; });
      sparks.burst(V3(p.x, 0.25, p.z), GOLD, 18, 1.2, 0.9); m.obj.visible = false;
      const root = o.gives === 'root', n = root ? 1 : 1 + Math.floor(Math.random() * 2);
      S.addHerbs(root ? 3 : n); S.toast(root ? 'Mandragora Root x1' : `Mandragora Leaf x${n}`, 'success', 2.2); S.se('se_Item1', 0.6, 1.0); S.expr('smug');
      S.remove(id); await S.wait(0.4);
    } });
    if (!ev) { m.obj.visible = false; return m; }
    S.actors.push({ update(dt, t) {
      if (st.mode === 'gone' || !m.obj.visible) return;
      if (st.mode === 'buried') {                    // it rustles for a couple of seconds, every ten or so
        st.t += dt; const k = st.t % 10; m.tuft.rotation.z = k > 8 ? 0.2 * Math.sin((k - 8) * 16) * Math.sin((k - 8) * PI / 2) : 0;
        return;
      }
      m.tuft.rotation.z = 0.12 * Math.sin(t * 9);
      if (st.hop) {
        const h = st.hop; h.t += dt; const k = Math.min(1, h.t / h.sec);
        m.obj.position.set(h.x0 + (h.x - h.x0) * k, 0, h.z0 + (h.z - h.z0) * k); m.inner.position.y = 0.13 * Math.sin(PI * k); m.inner.scale.set(1, 1 + 0.18 * Math.sin(PI * k), 1);
        if (k >= 1) { st.hop = null; st.pause = 0.26 + Math.random() * 0.2; m.inner.scale.set(1, 1, 1); if (++st.steps % 3 === 0) squeal(0.35); }
        ev.p.copy(m.obj.position);
        return;
      }
      if (S.isActive()) return;
      st.pause -= dt;
      const d = Math.hypot(anne.position.x - m.obj.position.x, anne.position.z - m.obj.position.z);
      if (st.pause <= 0 && d < 3.4 && (!LED || LED.level() === st.lv)) { if (!flee()) st.pause = 0.4; }      // (cornered: it dithers, and she has it)
      else if (d >= 3.4) m.obj.rotation.y += Math.sin(t * 1.3 + tx) * dt * 1.5;      // (it looks about)
    } });
    return m;
  }
  return { plant, mandragora, make };
}
