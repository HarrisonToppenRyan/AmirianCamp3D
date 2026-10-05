// creatures.js: the Ivy Maidens and the Myconids as every area meets them (story_forest.js, story_caves.js,
// story_nest.js): where a thing stands, the fights (one space-bar gauge per creature), what she may do with those she
// has beaten (stomp on them, have them pamper her feet, or leave them be), what happens when they catch her
// (captures.js plays the scene), where she comes round, and the chests and their loot.
//
//   creatureKit(S, C, env, cap) -> { spot, add, face, midOf, back, ambush, encounter, fight, stompOn, tamed, zap,
//                                    captured, wakeUp, myconid, chest, loot, col }
export function creatureKit(S, C, env, cap) {
  const { THREE, scene, anne, A, V3, TILE } = S, { sparks } = C;
  const walkAt = env.walkAt, has = (n) => A.hasClip && A.hasClip(n);
  const GREEN = new THREE.Color(0.5, 1.6, 0.5), GOLD = new THREE.Color(1.7, 1.3, 0.4), PINK = new THREE.Color(1.6, 0.5, 1.1);
  const SPORE = new THREE.Color(1.2, 1.3, 0.3), PURPLE = new THREE.Color(1.1, 0.45, 1.6);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // ---------- where a thing stands: on its tile, or at the edge of the nearest open tile if its own is forest ----------
  function spot(tx, ty) {
    const p = S.tileC(tx, ty);
    if (walkAt(tx, ty)) return { p, open: true };
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (walkAt(tx + dx, ty + dy)) return { p: p.add(V3(dx * TILE * 0.52, 0, dy * TILE * 0.52)), open: false, dx, dy };
    return { p, open: false };
  }
  const add = (actor) => { scene.add(actor.obj); if (actor.update) S.actors.push(actor); return actor; };

  // =====================================================================================================
  //                                                 the Ivy Maidens
  // =====================================================================================================
  const face = (m) => m.faceTo(anne.position.x, anne.position.z);
  const midOf = (group, out = V3()) => { out.set(0, 0, 0); for (const m of group) out.add(m.obj.position); return out.multiplyScalar(1 / group.length); };
  const back = V3();                               // where she stood before the fight (she is put back there afterwards)

  // a maiden bursts out of the ground under her feet
  async function ambush(rec) {
    back.copy(anne.position); rec.out = true;
    for (const m of rec.group) { face(m); m.emerge(); }
    S.expr('shocked'); S.emote(anne, 'exclaim', 0.9);
    S.cam.two(anne, midOf(rec.group), { y: 1.2, dist: 3.0, pitch: 0.2 });
    await S.hop(rec.at.p, 0.9, 0.3); await S.turnTo(rec.at.p, 0.15);
    S.toast('IVY MAIDENS!!!|IVIES!!!|WATCH OUT, IVY MAIDENS!!!', 'warning');
    await S.wait(0.5);
    if (await S.gauge({ label: 'Jump clear! Press SPACE in the green!', width: 0.22, speed: 0.95 })) {      // out of its reach: fight it or walk on
      S.toast("I've seen you coming this time!|Not today, you tangled weed!", 'dialog');
      await S.hop(rec.at.p, 1.2, 0.3); S.expr('angry'); await S.wait(0.3);
      return true;
    }
    return captured(rec);
  }
  // (10-02) a wild creature that wanders about its spot, as the 2D's do: to a random open place within `radius` tiles of
  // home, a pause, another; when she comes near, it turns to her (o.chase: and comes for her, never further than
  // `leash` tiles from home). Its touch event and its blocker go with it. Still while a scene plays or while it is down.
  function roam(rec, o = {}) {
    const home = rec.at.p.clone(), R = (o.radius || 2.5) * TILE, LEASH = (o.leash || o.radius * 1.6 || 4) * TILE, sp = o.speed || 0.55;
    const offs = rec.group.map((m) => m.obj.position.clone().sub(home)), st = { at: home.clone(), to: null, wait: Math.random() * 2.5, dir: V3() };
    const okAt = (x, z) => walkAt(Math.floor(x / TILE), Math.floor(z / TILE));
    const clear = (a, b) => { for (let k = 1; k <= 10; k++) if (!okAt(a.x + (b.x - a.x) * k / 10, a.z + (b.z - a.z) * k / 10)) return false; return true; };
    // (10-05, review: and the record's own place: `encounter` turns her to rec.at.p, which stayed at the creature's home)
    const place = () => { rec.group.forEach((m, i) => m.obj.position.set(st.at.x + offs[i].x, 0, st.at.z + offs[i].z)); if (o.ev) o.ev.p.copy(st.at); rec.at.p.copy(st.at); S.moveBlock(rec.id, st.at.x, st.at.z); };
    rec.home = () => { st.at.copy(home); st.to = null; st.wait = 2; place(); };      // (captured() puts them back here)
    S.actors.push({ update(dt) {
      if (S.isActive() || (env.logScene && env.logScene.isActive()) || !rec.out || !rec.group.length || !rec.group[0].up) return;      // (frozen while a scene plays, the hollow log's too)
      const dA = Math.hypot(anne.position.x - st.at.x, anne.position.z - st.at.z);
      if (o.notice !== 0 && dA < (o.notice || 5)) {
        for (const m of rec.group) m.faceTo(anne.position.x, anne.position.z);
        if (!o.chase) return;
        const goal = V3(anne.position.x, 0, anne.position.z);
        if (goal.distanceTo(home) > LEASH) goal.sub(home).setLength(LEASH).add(home);
        if (!okAt(goal.x, goal.z) || !clear(st.at, goal)) return;
        st.to = goal; st.wait = 0;
      }
      if (st.wait > 0) { st.wait -= dt; return; }
      if (!st.to && o.style === 'tiles') {          // (the 2D's random walk: a tile at a time; half the time on the same way, a third a new one, a sixth a rest)
        const r = Math.random(); if (r > 5 / 6) { st.wait = 0.6 + Math.random() * 0.8; return; }
        const tx = Math.floor(st.at.x / TILE), tz = Math.floor(st.at.z / TILE), DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (!st.d || r > 0.5) st.d = DIRS[Math.floor(Math.random() * 4)];
        const p = S.tileC(tx + st.d[0], tz + st.d[1]);
        if (okAt(p.x, p.z) && p.distanceTo(home) <= R && clear(st.at, p)) st.to = p; else { st.d = null; st.wait = 0.3; return; }
      }
      if (!st.to) {
        for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, r = (0.25 + 0.75 * Math.random()) * R, p = V3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r); if (okAt(p.x, p.z) && clear(st.at, p)) { st.to = p; break; } }
        if (!st.to) { st.wait = 1; return; }
      }
      st.dir.subVectors(st.to, st.at); const d = st.dir.length();
      if (d < 0.06) { st.to = null; st.wait = o.style === 'tiles' ? 0.5 + Math.random() * 0.9 : 1.2 + Math.random() * 3.2; return; }
      st.at.addScaledVector(st.dir, Math.min(1, sp * dt / d));
      for (const m of rec.group) m.faceTo(st.to.x, st.to.z);
      place();
    } });
  }
  // she walks into a wild Ivy Maiden
  async function encounter(rec) {
    back.copy(anne.position);
    for (const m of rec.group) { face(m); m.lean(0.5); }
    S.toast(rec.group.length > 1 ? 'IVY MAIDENS!!!|IVIES!!!|WATCH OUT, IVY MAIDENS!!!' : 'A wild Ivy Maiden!!', 'warning');
    S.expr('angry'); await S.turnTo(rec.at.p, 0.2);
    S.cam.two(anne, midOf(rec.group), { y: 1.2, dist: 3.0, pitch: 0.2 });
    await S.wait(0.5);
    if (C.lookLines && rec.group[0]) {                     // (10-03) a word on her shoes, or her toenails, first (they take turns)
      const m = rec.group[0], L = C.lookLines('ivy'), n = S.state.flags.ivyLookN = (S.state.flags.ivyLookN || 0) + 1;
      if (m.setFace) m.setFace('grin');
      const R = C.lookRemarks ? C.lookRemarks('ivy', 2) : [];      // (batch 22: and, in turn with those, what they make of her)
      // (10-05: her feet in the picture for a word on her feet, her shoes or her toenails; not for one on her outfit: R[1])
      const k4 = n % 4, outfit = k4 === 0 && !!R[1];
      await S.say('ivy', (m.kind === 'yellow' ? 4 : 0) + 1, k4 === 1 ? L.shoe : k4 === 2 ? (R[0] || L.nail) : k4 === 3 ? L.nail : (R[1] || L.shoe), outfit ? {} : { feet: true });
    }
    return fight(rec);
  }
  // the fight: one gauge per foe (o.names: what each is called under the gauge); a miss and they have her
  async function fight(rec, o = {}) {
    const n = rec.group.length;
    for (let i = 0; i < n; i++) {
      const m = rec.group[i];
      const sub = o.names ? `${o.names[i]} (${i + 1} / ${n})` : n > 1 ? `Ivy Maiden ${i + 1} / ${n}` : (o.sub || '');
      const hit = await S.gauge({ label: 'Strike! Press SPACE in the green!', sub, width: (o.width || 0.2) - 0.02 * i, speed: (o.speed || 0.85) + 0.1 * i });
      if (!hit) return o.noCapture ? false : captured(rec);
      await zap(m);
    }
    if (!o.keep) {
      S.toast('Time to remove the weeds!|GOTCHAA!!', 'dialog'); S.expr('smug'); await S.wait(0.9);
      await tamed(rec.group, 'ivy');
      for (const m of rec.group) m.sink();
      S.remove(rec.id); S.expr('smug'); await S.wait(0.7);
    }
    return true;
  }
  // She has won: what the 2D game then offers (its DOMINATION menu): stomp on them, have them pamper her feet, or leave.
  async function stompOn(m, n = 3, kind = 'ivy') {
    const p = m.obj.position, d = V3(anne.position.x - p.x, 0, anne.position.z - p.z); if (d.lengthSq() < 0.01) d.set(0, 0, 1); d.normalize();
    S.place(V3(p.x + d.x * 0.62, 0, p.z + d.z * 0.62), Math.atan2(-d.x, -d.z));
    S.cam.at(V3(p.x + d.x * 0.3, 0, p.z + d.z * 0.3), Math.atan2(-d.x, -d.z) + Math.PI / 2, { y: 0.75, pitch: 0.06, dist: 3.3, cut: true, through: true });
    S.expr('angry'); S.toast(kind === 'ivy' ? "Now you're not that fond of curling round my ankles, huh?|Now you will show more respect to my feet!!|Take your new lesson!!" : 'Head back to ground, nasty creep!!!', 'dialog', 2.6);
    for (let i = 0; i < n; i++) {
      if (has('Stomp')) S.clip('Stomp', 0.08); await S.wait(0.42);
      if (m.shake) m.shake(1.3); if (m.lean) m.lean(-0.7 - 0.15 * i); if (m.hop) m.hop();
      sparks.burst(V3(p.x + d.x * 0.25, 0.15, p.z + d.z * 0.25), GOLD, 14, 1.4, 0.7); await S.wait(0.55);
      S.clip('Idle', 0.06); await S.wait(0.08);      // (so that the next stomp plays from the start)
    }
    S.clip('Idle', 0.2); S.expr('smug');
  }
  async function tamed(group, kind, lady) {
    const who = group[0] || lady;
    for (let n = 0; n < 5; n++) {
      S.toast(kind === 'ivy' ? 'What else can you do for me now...|What else are you useful for?' : 'Now... what else could I do with you, maggot?', 'dialog', 2.2);
      const pk = await S.choice(kind === 'ivy' ? ['Stomp her!', 'Pamperings', 'Leave her alone'] : ['Stomp', 'Pamperings', 'Spare her']);      // (Myconids: the 2D's Stomp / Worship / Spare her)
      if (pk === 0) { await stompOn(who, 3, kind); if (kind !== 'ivy') return 'stomped'; }
      else if (pk === 1 && cap.pamper) {
        const back2 = anne.position.clone(), yaw2 = anne.rotation.y;
        const them = (kind === 'ivy' ? group : [lady]).filter(Boolean).map((m) => [m, m.obj.position.clone(), m.obj.rotation.y]);
        await cap.pamper(kind === 'ivy' ? { kind, group } : { kind, lady });
        for (const [m, p, ry] of them) { m.obj.position.copy(p); m.obj.rotation.y = ry; }      // (everybody back where they stood)
        S.place(back2, yaw2); S.clip('Idle', 0); await cap.kit.putShoesOn(); S.cam.behind(anne, { cut: true, dist: 4.2 }); await S.fade(0, 0.5);
        S.toast(kind === 'ivy' ? 'Ivy Maiden tamed!|The Ivy Maiden surrenders!!' : 'Myconid tamed!', 'success', 2.2);
      } else return 'left';
    }
    return 'left';
  }
  // her spell: a burst of light that wilts the maiden
  async function zap(m) {
    if (has('Cast')) S.clip('Cast', 0.1);
    const p = V3(m.obj.position.x, m.zapY || 1.2, m.obj.position.z);
    await S.wait(0.18); sparks.burst(C.headPos().add(V3(0, -0.3, 0)), GOLD, 10, 1.0, 0.6);
    await S.wait(0.12); sparks.burst(p, GOLD, 30, 2.2, 1.0); sparks.burst(p, GREEN, 16, 1.4, 1.6);
    if (m.shake) m.shake(1.2); if (m.lean) m.lean(-0.5); await S.wait(0.45); S.clip('Idle', 0.2);
  }

  // ---------- caught (captures.js plays the scene; here: who, where, and what comes after) ----------
  // (10-03) S.capStyle(): 'both' (the default: the 2D game's rounds, then tied up on her front as the last round), '2d' or 'tied'
  const capWay = () => (!cap.bound || !S.capStyle ? '2d' : S.capStyle());
  async function captured(rec, o = {}) {
    const way = capWay(), tied = way === 'tied';          // (the player's choice, T; 10-03: the fallback game-over capture too)
    let lashed = false;                                    // every other time the 2D scene plays, the lash that catches her takes her shoes and hat at once
    if (!tied) { const n = S.state.flags.ivyN = (S.state.flags.ivyN || 0) + 1; lashed = !o.gameOver && !o.coil && n % 2 === 0; }      // (10-03: counted over the 2D scenes only)
    if (lashed && !tied) await cap.snatch(rec.group[0]);
    // (10-03) 'both' (the default): every 2D round as before, and if she is still caught, tied up on her front as the last
    let r = tied ? null : await cap.ivy(rec, { seat: back, lashed, gameOver: o.gameOver, intro: o.intro });
    if (!r || (way === 'both' && !r.free)) r = await cap.bound(Object.assign({ kind: 'ivy', list: rec.group, seat: back, theme: 'vine', lick: rec.group.slice(0, 1), chained: !!r,
      tools: [[0, 0, 'stroke', 'toes', 'duster', { rate: 1.1 }], [1, 1, 'stroke', 'toes', 'duster', { rate: 1.2, ph: 2.0 }], [0, 0, 'arch', 'side', 'catkin', { rate: 1.3 }], [1, 1, 'arch', 'side', 'catkin', { rate: 1.2, ph: 1.1 }]] }, o.bound || {}));
    const { free } = r;
    // (the screen is dark here) everybody back to their own places
    S.clip('Idle', 0);
    rec.group.forEach((m, i) => { m.lean(free ? -0.3 : 0.4); if (rec.at) m.obj.position.set(rec.at.p.x + (i ? (i % 2 ? 0.75 : -0.75) : 0), 0, rec.at.p.z + (i ? 0.3 : 0)); });
    if (rec.home) rec.home();                      // (an area may stand its creatures differently)
    if (free && !o.gameOver) {
      const away = V3(back.x - rec.at.p.x, 0, back.z - rec.at.p.z); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
      S.place(V3(rec.at.p.x + away.x * 2.6, 0, rec.at.p.z + away.z * 2.6), Math.atan2(-away.x, -away.z));
      await cap.kit.putShoesOn();                        // (10-03: her shoes back on before anything else)
      S.cam.behind(anne, { cut: true, dist: 4.5 });
      await S.fade(0, 0.4); S.expr('angry');
      if (has('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.9); S.clip('Idle', 0.2); }
      return false;
    }
    if (o.keepHere) return false;
    await wakeUp(free);
    return false;
  }
  // they had their fun (or she broke away at the last): she comes round where she last felt safe
  async function wakeUp(free) {
    C.toCheckpoint(); S.cam.behind(anne, { cut: true, dist: 4.5 }); S.expr('tired');
    await S.wait(0.6); await cap.kit.putShoesOn({ expr: 'tired' }); await S.fade(0, 1.0);      // (10-03: she comes round and slips her shoes back on)
    if (free) { await S.say('a2', 24, "...That was too close.\nLet's not do that again."); return; }
    await S.say('am', 4, 'Welcome back, sleeping beauty.\nThey carried you all the way back here,\ngiggling the whole time.');
    await S.say('a2', 24, "...Not a word.\nNot. One. Word.");
    await S.say('am', 0, 'Shall we try again? A little more carefully?');
  }

  // =====================================================================================================
  //                                  Myconids, as the caves have them (the 2D's CE 52)
  // =====================================================================================================
  // A patch of speckled mushrooms that rises as a Myconid lady when she bumps into it (or a lady who stands there
  // already: o.lady), a puff of spores to dodge (missed: they have her at once), then "Attack" / "Leave". Leave: she steps
  // back and the lady sinks into her patch again (it still blocks the way). Attack: one gauge per Myconid of the troop
  // (o.n); all hit = won: the stomp, and once a Myconid has been beaten before, the menu Stomp / Pamperings / Let her go.
  // Caught: the Myconids' rounds (captures.js); broken free she is asked again, else she comes round at the checkpoint.
  //   o: { m (makeMyconid), at ({ p }), tint, n, lady }  ->  'won' | 'left' | 'lost'
  async function myconid(o) {
    const { m, at } = o, n = typeof o.n === 'function' ? o.n() : (o.n || 1);
    const look = () => S.cam.two(anne, at.p, { y: 1.1, y2: 0.9, dist: 2.8, pitch: 0.2 });
    back.copy(anne.position); m.faceTo(anne.position.x, anne.position.z);
    let asked = !o.lady;
    if (o.lady) {
      look(); await S.turnTo(at.p, 0.15);
      await S.say('a1', 5, 'Dammit, these things are everywhere...', { expr: 'angry' });
      await S.say('a1', 1, "They're in my way...");
    } else {
      m.wake(); m.kids(true); S.emote(anne, 'exclaim', 0.8); S.expr('surprised');
      S.toast('Myconids!!|What the?!?!|Oh, NO!!|Huh??', 'warning');
      look(); await S.hop(at.p, 0.5); await S.turnTo(at.p, 0.15); await S.wait(0.5);
      back.copy(anne.position);
      m.hop(); sparks.burst(V3(at.p.x, 1.2, at.p.z), PURPLE, 26, 1.2, 0.8);
      const lvl = 1 + Math.floor(Math.random() * 3);      // (the 2D's ACTION_GAUGE_LEVEL 1..3: the higher, the narrower the window)
      if (!await S.gauge({ label: 'Spores! Hold your breath: SPACE in the green!', width: 0.28 - 0.03 * lvl, speed: 0.72 + 0.08 * lvl })) {
        if (!await caught()) return 'lost';
      }
    }
    for (;;) {
      if (asked) {
        S.emote(anne, 'exclaim', 0.6); S.expr('angry');
        if (await S.choice(['Attack', 'Leave']) !== 0) {
          await S.hop(at.p, 0.55);                     // a step back
          if (!o.lady) { m.kids(false); m.sleep(); }   // (she sinks into her patch again, in the way as before)
          S.expr('pout'); return 'left';
        }
      }
      asked = true;
      let won = true;
      for (let i = 0; i < n; i++) {
        const hit = await S.gauge({ label: 'Strike! Press SPACE in the green!', sub: n > 1 ? `Myconid ${i + 1} / ${n}` : 'Myconid', width: 0.2 - 0.02 * i, speed: 0.85 + 0.1 * i });
        if (!hit) { won = false; break; }
        await zap(m);
      }
      if (won) { await beaten(); return 'won'; }
      if (!await caught()) return 'lost';
    }
    async function caught() {                        // true: she broke free (and is asked again)
      const { free } = await mycCapture(m);
      S.clip('Idle', 0); m.obj.position.copy(at.p); m.faceTo(back.x, back.z);
      if (free) {
        const away = V3(back.x - at.p.x, 0, back.z - at.p.z); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
        S.place(V3(at.p.x + away.x * 1.9, 0, at.p.z + away.z * 1.9), Math.atan2(-away.x, -away.z));
        await cap.kit.putShoesOn();
        look(); await S.fade(0, 0.4); S.expr('angry');
        S.toast("You'll regret it, you creep!|Keep your spores to yourself!", 'dialog', 2.2);
        return true;
      }
      if (!o.lady) { m.kids(false); m.sleep(); }
      await wakeUp(false);
      S.toast('The Myconids scurry off, very pleased with themselves.', 'note', 2.4);
      return false;
    }
    async function beaten() {
      S.toast('Head back to ground, nasty creep!!!', 'dialog', 2.2);
      if (!S.flag('mycUnlocked')) {                  // (the first Myconid she ever beats: just the stomping)
        await stompOn(m, 3, 'myc'); S.flag('mycUnlocked', true); S.toast('Myconid Unlocked!!', 'success', 2.4); await S.wait(0.6);
      } else {
        await stompOn(m, 2, 'myc'); S.toast('Myconid gives up!!|Myconid surrenders!!', 'success', 2.0); await S.wait(0.5);
        if (await tamed([], 'myc', m) !== 'stomped') S.toast('Now, get lost, you creep!', 'dialog', 2.0);
      }
      m.kids(false); m.sleep(); sparks.burst(V3(at.p.x, 0.3, at.p.z), GOLD, 22, 1.6, 1.0); await S.wait(0.6); S.clip('Idle', 0.2);
      if (o.tint === 'blue' && !o.lady) S.toast('Myconid root destroyed!', 'info', 2.2);      // (the blue patches only: the 2D's DISABLE)
      m.obj.visible = false;
    }
  }

  // Alraune has her (a lost fight): the 2D game's CAPTURE1 (captures.js alraune), or tied up on her front, the flower beyond
  // her feet, Alraune's own vines at her soles and her maidens licking them (the player's choice, S.capStyle).
  //   o: { fig, al, bloom, at, yaw, maidens }  (as cap.alraune)
  async function alrauneCapture(o) {
    const way = capWay();
    if (way !== 'tied') { const r = await cap.alraune(o); if (way !== 'both' || r.free || !cap.bound) return r; }      // (10-03: then tied up, as the last round)
    const chained = way === 'both', list = (o.maidens || []).slice(0, 3), al = o.al || { expr() {}, clip() {} };
    const vine = (k) => (out) => out.copy(o.bloom.obj.position).setY(0.85 + 0.1 * k);
    const lines = {
      open: [[1, "Lovely!\nI never miss a chance to play\nwith my catch for a while...", 'smile', 'Idle'], [3, 'Let me see those feet closer...', 'smug', 'Lean']],
      tickle: [[2, 'Such a little cutie! Look at those ' + (C.soleTint ? C.soleTint() : 'pink') + ' soles!!!\nThey look so smooth...\n... so sensitive...', 'happy', 'Delight'], [8, "OOPS!!\nSomeone's got ticklish feet here!", 'laugh', 'Delight']],
      lick: [[3, "Now... my dears, give those slender feet\na proper taste for me...", 'smug', 'Command']],
      fast: [[3, 'COOOOCHIE COOOCHIE KOOOOOO!!\nKEEP THOSE LOVELY FEET DANCING FOR ME,\nHONEY!!!', 'laugh', 'Delight'], [0, "I could spend days like this!!!!!\nI hope you're having as much fun as I am,\ndarling!!!", 'happy', 'Idle']],
      lost: [[2, 'I want you all for me...', 'smug', 'Idle']],
    };
    if (chained) {                                       // (straight after her 2D capture: new words for the new part)
      lines.open = [[3, "Oh, don't go yet, darling!\nMy dears, tie her down for me... ankles AND toes!", 'smug', 'Command'], [1, "There... now those lovely feet\ncan't run away from me!", 'smile', 'Lean']];
      lines.tickle = [[8, "Look at them twitch! Every little wiggle\nis mine to enjoy...", 'laugh', 'Delight']];
      lines.lost = [[0, "Mmm... I'll keep you a little longer, honey.\nYour feet and I are getting along so well...", 'smug', 'Idle']];
    } else if (C.lookLines) { const L = C.lookLines('alNest'); if (L.lv > 0) lines.tickle.push([10, L.nail.replace(/ I've thought of nothing else\nsince the forest!/, '\nI could look at them all day!'), 'laugh', 'Delight']); }      // (10-03: tied alone: her toenails too)
    for (const m of list) m.showNow();
    return cap.bound({ kind: 'alraune', list, chained, seat: anne.position.clone(), yaw: Math.atan2(o.bloom.obj.position.x - anne.position.x, o.bloom.obj.position.z - anne.position.z), theme: 'vine',
      setup: ({ mid, out }) => { o.bloom.obj.position.set(mid.x + out.x * 1.75, 0, mid.z + out.z * 1.75); o.bloom.obj.rotation.y = Math.atan2(-out.x, -out.z); o.bloom.showNow(); al.clip('Lean', 0); al.expr('smug'); },
      tools: [[vine(0), 0, 'stroke', 'toes', 'catkin', { rate: 1.1 }], [vine(1), 1, 'stroke', 'toes', 'catkin', { rate: 1.2, ph: 2.0 }], [vine(2), 0, 'arch', 'side', 'frond', { rate: 1.3 }], [0, 1, 'arch', 'side', 'duster', { rate: 1.2, ph: 1.1 }]],
      lick: list.slice(0, 1),
      say: async (stage) => { for (const [i, text, e, c] of lines[stage] || []) { al.expr(e); al.clip(c, 0.3); await S.say('al', i, text); } },
    });
  }

  // a Myconid has her: the 2D game's rounds, then (10-03, 'both', the default) tied up on her front as the last; or either alone (T)
  async function mycCapture(m) {
    const way = capWay();
    if (way !== 'tied') { const r = await cap.myconid({ m }, { seat: back }); if (way !== 'both' || r.free || !cap.bound) return r; }
    return cap.bound({ kind: 'myconid', list: [m], seat: back, theme: 'hyphae', kids: m, lick: [m], chained: way === 'both',
      tools: [[0, 0, 'arch', 'side', 'spore', { rate: 1.1 }], [0, 1, 'toes', 'toes', 'puff', { rate: 1.3, ph: 1.2 }], [0, 0, 'stroke', 'heel', 'spore', { rate: 0.9, ph: 2.1 }]] });
  }

  // =====================================================================================================
  //                                         chests and what is in them
  // =====================================================================================================
  // The 2D's loot packs (CE 121). There is no crafting or inventory in the 3D yet: ingredients count as herbs, gems
  // and gold as coins, and the rest is named in a toast.
  const PACKS = {
    ingredients1: ['Fairy Powder', 'Aloe', 'Mandragora Leaf', 'Wild Blossom', 'Cherry', 'Grapes', 'Mushroom Cap', 'Berries', 'Lavender', 'Artemisia', 'Clover', 'Jelly Drops'],
    ingredients2: ['Refined Essence', 'Refined Narcotic', 'Essential Oil', 'Honey', 'Crystal Seeds', 'Ivy Maiden Seeds'],
    potions1: ['Healing Drops', 'Healing Water', 'Magic Drops', 'Magic Water', 'Restoration Drops', 'Cure', 'Action Boost'],
    potions2: ['Healing Elixir', 'Healing Water', 'Mana Jolt', 'Restoration Water', 'Refreshing Water', 'Antidote', 'Stimulant Water', 'Action Boost', 'Action Burst'],
    potions3: ['Power Drops', 'Skill Boost', 'Mindblowing Syrup', 'Lucky Nectar', 'Invigorant Juice', 'Magic Resilience', 'Action Burst'],
    bombs: ['Pestilent Bomb', 'Narcotic Bomb', 'Flash Bomb', 'Frost Bomb', 'Oil Bomb', 'Mind Breaker'],
    gems: ['Topaz', 'Emerald', 'Sapphire', 'Amethyst', 'Ruby', 'Diamond'],
    clutter: ['Cogs', 'Copper Ore', 'Fairy Tickler', 'Stiff Feather', 'Cotton', 'Fluffy Quill'],
  };
  const roll = () => 1 + Math.floor(Math.random() * 100);
  // kind: 'ingredients' | 'potions' | 'items' | 'treasure' (the 2D labels); returns the lines it showed
  function loot(kind) {
    const got = [];
    const take = (pack, count) => { const names = PACKS[pack].slice().sort(() => Math.random() - 0.5); for (let i = 0; i < count; i++) got.push([pack, names[i % names.length]]); };
    const ingredients = () => (roll() > 40 ? take('ingredients2', 2 + Math.floor(Math.random() * 3)) : take('ingredients1', 2 + Math.floor(Math.random() * 2)));
    if (kind === 'ingredients') ingredients();
    else if (kind === 'potions') { const c = roll(); if (c > 80) take('potions3', 3); else if (c > 60) take('bombs', 1); else if (c > 40) take('potions2', 2); else if (c > 20) take('potions1', 4); else if (c > 5) take('ingredients1', 2); }
    else if (kind === 'items' || kind === 'treasure') {
      if (kind === 'treasure') take('gems', 1 + Math.floor(Math.random() * 2));
      const c = roll(); if (c > 90) take('gems', 1 + Math.floor(Math.random() * 2)); else if (c > 20) ingredients(); else if (c > 5) take('clutter', 1);
    }
    const count = {}; for (const [pack, nm] of got) count[nm] = (count[nm] || 0) + 1;
    const herbs = got.filter(([p]) => p.startsWith('ingredients')).length, gems = got.filter(([p]) => p === 'gems').length;
    const coins = gems * 25 + (kind === 'treasure' ? 50 + Math.floor(Math.random() * 150) : 0);
    if (herbs) S.addHerbs(herbs);
    if (coins) S.counts(S.state.herbs, S.state.coins + coins);
    const lines = Object.entries(count).map(([nm, k]) => nm + ' x' + k);
    if (coins) lines.push(coins + ' coins');
    S.toast(lines.length ? lines.join(', ') : '...Empty.', lines.length ? 'success' : 'note', 3.2);
    return lines;
  }
  // a chest on tile (tx, ty): blue (the 2D's blue-and-gold one) or wooden; o: { kind, when, blocks (default true), face (yaw) }
  function chest(id, tx, ty, o = {}) {
    const at = spot(tx, ty), c = add(C.K.makeChest(!!o.blue)); c.obj.position.copy(at.p); c.obj.rotation.y = o.face || 0;
    if (o.blocks !== false) S.block(id + 'B', at.p.x, at.p.z, 0.42);
    const ev = S.on({ id, at: at.p, r: o.r || 1.45, action: 'E — Open the chest', when: o.when, run: async () => {
      await S.turnTo(at.p); S.cam.two(anne, at.p, { y: 1.0, y2: 0.4, dist: 2.6, pitch: 0.3 });
      let k = 0; await S.until((dt) => { k = Math.min(1, k + dt / 0.5); c.open(k); return k >= 1; });
      c.burst(); sparks.burst(V3(at.p.x, 0.6, at.p.z), o.blue ? PURPLE : GOLD, 22, 1.2, 1.0);
      await S.wait(0.3); loot(o.kind || 'ingredients'); S.remove(id); await S.wait(0.8);
    } });
    if (!ev) c.open(1);                              // (opened on an earlier visit)
    return c;
  }
  return { spot, add, face, midOf, back, ambush, encounter, fight, stompOn, tamed, zap, captured, wakeUp, myconid, mycCapture, alrauneCapture, chest, loot, pick, roam,
    col: { GREEN, GOLD, PINK, SPORE, PURPLE } };
}
