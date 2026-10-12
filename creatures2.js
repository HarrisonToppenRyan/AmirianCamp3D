// creatures2.js (10-12): the Forest of Lys's HORNETS and SLIMES as she meets them: the 2D game's map events "Hornet" and
// "Slime" (eight of each on its Map 36; here a few, in the glades off the road) and its CE 58 / CE 59:
//   HORNETS!! / SLIMES!!!   she walks into one (they come for her: the hornets fast, the slimes slowly)
//   a word about how she looks (her feet and shoes, her outfit, her kind: by turns), then the fight: the gauge, twice
//   lost:  caught. captures2.js: her shoes come off and her feet are tickled, a sister joins; still caught after that,
//          she is tied up on her front (captures.js `bound`: the player's "when caught" choice, T) and comes round at
//          the last checkpoint
//   won:   the 2D's DOMINATION: "GOTCHAA!!", then the party tickles HER (the area's own scene: o.tame), and if she
//          gave up, the reward: Honey ("HORNET UNLOCKED!!" / "SLIME UNLOCKED!!" the first time)
// Everybody is dressed and stays so; only shoes come off; the 2D's adult stages are not built.
//
// One figure per kind for all its spots (and one sister): a twin of Anne's model is a whole character to draw, and the
// forest is thick: one glade is in sight at a time. She is at whichever of her spots Anne is nearest to, and changes
// spot only when Anne is far from both. A beaten one is gone until the forest is entered again (as in the 2D game).
// She is drawn only within RANGE of Anne and in the picture (she and her shadow are some 180,000 triangles a frame).
//
//   creatureKit2(S, C, env, ck, cap, cap2, cast3) -> { pack(kind, spots, o) }
//     kind 'hornet' | 'slime';  spots [[tx, ty], ...];  o: { tame: async ({ kind, fig, sheet, say, back, P }) -> stage 0..3,
//       aside() (whoever travels with her goes out of the picture: she is caught), back() (and comes back) }
//     pack -> { kind, fig, sis, recs, update(dt, t), cur(), meet(i) }      (the area calls update from its S.late hook)
export function creatureKit2(S, C, env, ck, cap, cap2, cast3) {
  const { THREE, anne, A, TILE } = S, { sparks } = C, PI = Math.PI, LED = S.ledge;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const pick = (L) => L[Math.floor(Math.random() * L.length)], rr = (a, b) => a + Math.random() * (b - a);
  const HONEY = new THREE.Color(1.9, 1.3, 0.25), AQUA = new THREE.Color(0.5, 1.1, 1.9), GOLD = new THREE.Color(1.7, 1.3, 0.4);
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const walkable = (x, z) => env.walkAt(Math.floor(x / TILE), Math.floor(z / TILE)) && (!LED || LED.levelAt(x, z) === 0);
  const clear = (a, b) => { for (let k = 1; k <= 8; k++) if (!walkable(a.x + (b.x - a.x) * k / 8, a.z + (b.z - a.z) * k / 8)) return false; return true; };

  const KIND = {
    hornet: { sheet: 'ho', who: 'hornet', name: 'Hornet', warn: 'HORNETS!!', flies: true, speed: 2.0, notice: 6.5, radius: 2.6, leash: 5.5, gauge: [0.2, 0.95], spark: HONEY, pitch: 1.22,
      got: "GOTCHAA!!|You can't escape now...|Now, what should I do with you?", off: 'Now, get lost, you buzzing pest!|Lesson learned, buzz-brain!|You have messed up with the wrong girl!',
      free: 'STAP IT ALREADY, YOU CREEPY THING!!!|HANDS OFF!!', away: 'The hornets buzz off, very pleased with themselves.',
      flag: 'hornetUnlocked', unlock: ['HORNET UNLOCKED!!', 'Spoil her delicious honey!'], item: ['Honey', 1, 4],
      bound: { open: [[0, "Hold ssstill, prezziousss...\nthe hive hazz ssso many feathers to try! BZZT!"]], tickle: [[0, 'BZZZT! Lizzten to her zzing!\nLouder, lil flower, louder!']], lick: [[0, 'Ssso ticklish... our queen\nwill be zzzo pleazzed!']],
        fast: [[0, 'BZZZZZZZT!! FASSSTER, SSSISTERS!!']], lost: [[0, "Hzzhzzhzz... don't pout, prezziousss!\nWe'll play again zzzoon!"]] } },
    slime: { sheet: 'sl', who: 'slime', name: 'Slime', warn: 'SLIMES!!!', flies: false, speed: 0.85, notice: 5, radius: 2.0, leash: 4, gauge: [0.23, 0.8], spark: AQUA, pitch: 0.94,
      got: 'Come here, you, jelly face!', off: 'GET LOST, SLIMMY!!|Uggghh... too sticky...', free: 'Stay away!!', away: 'The slimes ooze away, very pleased with themselves.',
      flag: 'slimeUnlocked', unlock: ['SLIME UNLOCKED!!', 'This is getting sticky!'], item: ['Jelly Drops', 1, 2],
      bound: { open: [[0, 'Blub... stay a little longer...\nyou are so nice and warm!']], tickle: [[0, 'Blub blub! Wiggly toes!\nI like wiggly toes!']], lick: [[0, 'So squirmy... blub...\nlike a little fish!']],
        fast: [[0, 'BLUB BLUB BLUB!! MORE WIGGLES!!']], lost: [[0, 'Blub... bye bye, warm girl...\ncome and play again!']] } },
  };

  function pack(kind, spots, o = {}) {
    const P = KIND[kind], make = (x) => (kind === 'hornet' ? cast3.createHornet(S, C, x) : cast3.createSlime(S, C, x));
    const fig = make({}), sis = make({ sister: true }), say = cap2.sayAs(P.sheet, fig);
    const st = { cur: null, at: V3(), to: null, wait: 1, busy: false, grace: 0, near: false };
    const RANGE = 24, _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
    // is she in the picture? (her whole figure in a ball; the camera as it stood for the frame just drawn)
    const inView = () => { const cam = S.camera; _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm); fig.obj.getWorldPosition(_sp.center); _sp.center.y += 1.0; _sp.radius = 2.0; return _fr.intersectsSphere(_sp); };
    const idle = () => { fig.clip('IdleBare', 0.3); if (P.flies) { fig.hover(1, 0); fig.buzz(1); } };
    const recs = spots.map(([tx, ty], i) => {
      const rec = { id: kind + i, i, kind, home: S.tileC(tx, ty), fig, alive: true };
      rec.ev = S.on({ id: rec.id, at: rec.home.clone(), r: 1.25, lv: 0, touch: true, when: () => st.cur === rec && !st.busy && st.grace <= 0 && !!fig.obj && fig.obj.visible, run: () => meet(rec) });
      if (!rec.ev) rec.alive = false;
      return rec;
    });
    // where she is: at the spot nearest to Anne, changed only while Anne is far from where she is now
    function choose() {
      let best = null, bd = 1e9;
      for (const r of recs) if (r.alive) { const d = Math.hypot(anne.position.x - r.home.x, anne.position.z - r.home.z); if (d < bd) { bd = d; best = r; } }
      if (!best) { if (st.cur) { fig.hide(); st.cur = null; } return; }
      if (best === st.cur || (st.cur && Math.hypot(anne.position.x - st.at.x, anne.position.z - st.at.z) < 15)) return;
      st.cur = best; st.at.copy(best.home); st.to = null; st.wait = rr(0.5, 2);
      fig.show(st.at, 0, 'IdleBare'); idle(); S.settle(fig.obj, 0); best.ev.p.copy(st.at);
    }
    function roam(dt) {
      const rec = st.cur, p = st.at, dA = Math.hypot(anne.position.x - p.x, anne.position.z - p.z);
      st.near = dA < RANGE; fig.obj.visible = st.near && inView(); if (!st.near) return;
      if (st.grace > 0) st.grace -= dt;
      let goal = null, sp = P.speed * 0.5;
      if (st.grace <= 0 && dA < P.notice && (!LED || LED.level() === 0)) {      // she comes for her, never further from home than her leash
        goal = V3(anne.position.x, 0, anne.position.z);
        if (goal.distanceTo(rec.home) > P.leash * TILE) goal.sub(rec.home).setLength(P.leash * TILE).add(rec.home);
        if (walkable(goal.x, goal.z) && clear(p, goal)) { sp = P.speed; st.to = null; } else goal = null;
      }
      if (!goal) {
        if (st.wait > 0) { st.wait -= dt; return; }
        if (!st.to) {
          for (let k = 0; k < 8 && !st.to; k++) { const a = Math.random() * 6.283, r = (0.3 + 0.7 * Math.random()) * P.radius * TILE, q = V3(rec.home.x + Math.cos(a) * r, 0, rec.home.z + Math.sin(a) * r); if (walkable(q.x, q.z) && clear(p, q)) st.to = q; }
          if (!st.to) { st.wait = 1; return; }
        }
        goal = st.to;
      }
      const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { if (goal === st.to) { st.to = null; st.wait = rr(0.8, 2.8); } return; }
      const step = Math.min(d, sp * dt); p.x += dx / d * step; p.z += dz / d * step;
      fig.face(Math.atan2(dx, dz)); fig.obj.position.x = p.x; fig.obj.position.z = p.z; if (!P.flies) fig.obj.position.y = 0;
      rec.ev.p.copy(p);
    }
    function update(dt, t) {
      if (!S.isActive() && !st.busy) { choose(); if (st.cur && fig.obj) roam(dt); }
      else if (!st.busy && st.cur && fig.obj) fig.obj.visible = st.near;      // (another scene plays: its camera may turn anywhere)
      if (fig.obj && fig.obj.visible) fig.update(dt, t);
      if (sis.obj && sis.obj.visible) sis.update(dt, t);
    }
    const home = (rec) => { st.at.copy(rec.home); st.to = null; st.wait = 2; fig.show(st.at, 0, 'IdleBare'); idle(); fig.expr('smile'); S.settle(fig.obj, 0); rec.ev.p.copy(st.at); if (sis.obj) sis.hide(); };
    const zapM = { get obj() { return fig.obj; }, zapY: P.flies ? 1.5 : 1.15, shake() { fig.expr('shocked'); }, lean() {} };

    // ---------- she walks into her (or is caught up with) ----------
    async function meet(rec) {
      st.busy = true;
      try {
        if (st.cur !== rec || !fig.obj) { st.cur = rec; home(rec); }      // (she is always there when it is walked into; a test may start it from afar)
        fig.obj.visible = true; st.near = true;
        const back = anne.position.clone().setY(0);
        fig.follow(null); fig.face(yawTo(fig.obj.position, anne.position)); fig.expr('smug');
        S.toast(P.warn, 'warning'); S.expr('angry'); S.emote(anne, 'exclaim', 0.8); await S.turnTo(fig.obj.position, 0.2);
        S.cam.two(anne, fig.obj, { y: 1.25, dist: 3.1, pitch: 0.18 });
        if (kind === 'slime') await S.say('a1', 47, pick(['Dammit!', 'Here we go again!', 'Heads up!', 'Careful!']), { expr: 'angry' }); else await S.wait(0.45);
        // a word on how she looks: her feet and shoes, what she wears, her kind (by turns)
        const R = C.lookRemarks ? C.lookRemarks(P.who, 3) : [], n = S.state.flags[kind + 'LookN'] = (S.state.flags[kind + 'LookN'] || 0) + 1, k = R.length ? (n - 1) % R.length : 0;
        if (R[k]) await say(0, R[k], { feet: k === 0 });
        let won = true;
        for (let i = 0; i < 2; i++) {
          const hit = await S.gauge({ label: 'Strike! Press SPACE in the green!', sub: `${P.name}  (${i + 1} / 2)`, width: P.gauge[0] - 0.02 * i, speed: P.gauge[1] + 0.08 * i });
          if (!hit) { won = false; break; }
          await ck.zap(zapM); sparks.burst(V3(fig.obj.position.x, zapM.zapY, fig.obj.position.z), P.spark, 16, 1.4, 0.9);
        }
        if (won) await beaten(rec, back); else await caught(rec, back);
      } finally { st.busy = false; st.grace = 3.5; }
    }
    async function beaten(rec, back) {
      S.toast(P.got, 'success', 2.2); S.expr('smug'); fig.expr('worried'); if (P.flies) { fig.hover(0.25, 0); fig.buzz(0.4); } await S.wait(1.0);
      const stage = o.tame ? await o.tame({ kind, fig, sheet: P.sheet, say, back, P }) : 0;
      if (stage >= 3) {
        S.se('se_Item3', 0.7);
        if (!S.flag(P.flag)) { S.flag(P.flag, true); S.toast(P.unlock[0], 'success', 2.4); await S.wait(1.0); S.toast(P.unlock[1], 'note', 2.2); await S.wait(0.7); }
        const [nm, a, b] = P.item, n = a + Math.floor(Math.random() * (b - a + 1)); S.addHerbs(n); S.toast(`${nm} x${n}`, 'success', 2.2);
      } else S.toast(P.off, 'dialog', 2.2);
      // she is gone: until the forest is entered again
      if (fig.obj && fig.obj.visible) sparks.burst(V3(fig.obj.position.x, 1.0, fig.obj.position.z), P.spark, 30, 1.8, 1.2);
      fig.hide(); rec.alive = false; S.remove(rec.id, false); st.cur = null; S.expr('smug');
      await S.wait(0.6); C.checkpoint();
    }
    async function caught(rec, back) {
      if (kind === 'hornet') { S.se('se_Load', 0.6); await S.say('a1', 42, 'Oucchhhh!! WHAT THE ....', { expr: 'shocked' }); } else { S.se('se_Down1', 0.6); S.toast('Too slow!|It has her ankles!', 'warning', 1.6); await S.wait(0.5); }
      const way = S.capStyle ? S.capStyle() : '2d';
      let r = way === 'tied' && cap.bound ? null : await cap2[kind]({ fig }, { seat: back, sister: sis, setup: o.aside });      // (it ends in the dark, its stage ended)
      if (!r || (way === 'both' && !r.free && cap.bound)) {
        const proxy = { get obj() { return fig.obj; }, lean() {}, laugh(on) { fig.expr(on ? 'laugh' : 'smug'); }, shake() { fig.expr('shocked'); }, hop() {} };
        r = await cap.bound({ kind, list: [proxy], keep: true, chained: !!r, seat: back, yaw: yawTo(back, rec.home), theme: kind === 'hornet' ? 'rope' : 'mist',
          setup: ({ mid, out }) => { if (o.aside) o.aside(); if (sis.obj) sis.hide(); fig.follow(null); if (P.flies) { fig.hover(0, 0); fig.buzz(0.3); } fig.show(V3(mid.x + out.x * 1.55, 0, mid.z + out.z * 1.55), Math.atan2(-out.x, -out.z), 'KneelSit'); fig.expr('smug'); },
          tools: [[0, 0, 'stroke', 'toes', 'duster', { rate: 1.1 }], [0, 1, 'stroke', 'toes', 'duster', { rate: 1.2, ph: 2.0 }], [0, 0, 'arch', 'side', 'catkin', { rate: 1.3 }], [0, 1, 'toes', 'side', 'catkin', { rate: 1.2, ph: 1.1 }]],
          say: async (stage) => { for (const [i, text] of P.bound[stage] || []) await say(i, text); } });
      }
      // (dark) everybody back to their own places
      S.clip('Idle', 0); home(rec);
      if (r.free) {
        const away = V3(back.x - rec.home.x, 0, back.z - rec.home.z); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
        // (a step further from her home, as far as there is ground to stand on: not into the stream, not into the trees)
        let k = 1.6; while (k > 0.05 && !walkable(back.x + away.x * k, back.z + away.z * k)) k -= 0.2;
        S.place(V3(back.x + away.x * k, 0, back.z + away.z * k), Math.atan2(-away.x, -away.z));
        if (o.back) o.back();
        await cap.kit.putShoesOn(); S.cam.behind(anne, { cut: true, dist: 4.5 }); await S.fade(0, 0.4); S.expr('angry');
        S.toast(P.free, 'dialog', 2.2); if (A.hasClip && A.hasClip('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.9); S.clip('Idle', 0.2); }
        console.log('LYS ' + kind + ' caught free'); return;
      }
      C.toCheckpoint(); if (o.back) o.back();         // (whoever travels with her is beside her as she comes round)
      await ck.wakeUp(false);
      S.toast(P.away, 'note', 2.4); console.log('LYS ' + kind + ' caught lost');
    }
    return { kind, P, fig, sis, recs, update, cur: () => st.cur, meet: (i) => meet(recs[i]), state: st };
  }
  return { pack, KIND };
}
