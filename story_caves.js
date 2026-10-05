// story_caves.js: the Caves under the North Forest (the 2D game's Map 21 "ForestCaves"), reached by the cave mouth at
// tile (6,46) of the forest and open from her first day there. The 2D room has no story scene of its own: it is an
// optional side cave lit by one shaft of daylight, where Myconids guard the narrow corridors, a goddess statue stands in a
// pool under a waterfall (here: the cave's place to rest, where she comes round), a skeleton holds a scroll, two chests
// hold ingredients and potions, and a hidden pit waits in the east corridor (miss every kick there and Scylla's grotto
// lies below it). Positions are the 2D map's own tiles.
// (Later-chapter events of this room, the friendly Myconid lady, the glowing Myconid, the fairy and the black imp, are
// not here: see STORY_SPEC.md.)
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { creatureKit } = await import('./creatures.js' + V);
const { createTraps } = await import('./traps.js' + V);
const { createScylla } = await import('./scylla.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, V3, TILE } = S, C = common(S), { K, sparks } = C;
  const cap = createCaptures(S, C, env), kit = creatureKit(S, C, env, cap), { spot, add } = kit, { GOLD, PURPLE } = kit.col;
  const objs = S.level.objects || {};
  // the 2D tints the cave dim, cold and blue-green (R -64, G -16, B +32, grey 34): a dim sky and a cold grade; the shaft of
  // daylight and the crystals are the light
  S.night(0.8, 0); {                                                    // (a little more light while a scene plays: the dark is for exploring)
    const G = { k: -1 }, post = env.post;
    if (post && post.setGrade) S.actors.push({ update(dt) { const goal = S.isActive() ? 1 : 0, k0 = G.k; G.k = G.k < 0 ? goal : G.k + (goal - G.k) * Math.min(1, dt * 2.5); if (Math.abs(G.k - k0) > 1e-4) post.setGrade(0.74, 0.93, 1.12, 0.14, 0.72 + 0.23 * G.k); } });
  }

  // =====================================================================================================
  //                                                 the room
  // =====================================================================================================
  // crystal plants (the 2D draws the crystals on the tile above their roots: they stand on the tile below)
  (objs.crystal || []).forEach(([x, y], i) => { const c = add(K.makeCrystalPlant(i * 7 + 3, i === 1 ? new THREE.Color(1.0, 0.85, 0.2) : null)); c.obj.position.copy(S.tileC(x, y + 1)); c.obj.rotation.y = i * 2.1; });
  // the shaft of daylight she came down, and climbs back up
  const SHAFT = S.tileC(15, 2), shaft = add(K.makeLightShaft(7.5, 0.8)); shaft.obj.position.set(SHAFT.x, 0, SHAFT.z + TILE * 0.42);

  // ---------- the goddess statue in the pool under the falls: the cave's place to rest ----------
  const STATUE = S.tileC(4, 2), statue = add(K.makeShrine()); statue.obj.position.copy(STATUE); statue.obj.scale.setScalar(1.45);
  { const l = new THREE.PointLight(0xbfe0ff, 1.3, 5.5, 1.5); l.position.set(STATUE.x, 2.2, STATUE.z + 0.6); scene.add(l); }
  S.block('statue', STATUE.x, STATUE.z, 0.6);
  const pray = async () => {
    await S.turnTo(STATUE); S.cam.two(anne, STATUE, { y: 1.3, y2: 1.7, dist: 3.6, pitch: 0.12 });
    S.toast('A ruined altar to praise Goddess Vellicandra', 'note', 2.8); await S.wait(1.0);
    if (await S.choice(['Worship', 'Leave']) !== 0) return;
    sparks.burst(V3(STATUE.x, 1.9, STATUE.z), GOLD, 28, 1.0, 1.4);
    await S.note('A gentle warmth... you feel rested.', 'success'); C.checkpoint();
  };
  S.on({ id: 'statue', at: V3(STATUE.x, 0, STATUE.z + TILE * 0.55), r: 0.75, touch: true, when: () => Math.cos(anne.rotation.y) < -0.55, run: pray });      // (the 2D: walking north into the pedestal)
  S.on({ id: 'statueE', at: STATUE, r: 2.0, action: 'E — Look at the statue', run: pray });

  // ---------- the skeleton by the pool, and its scroll ----------
  const SKEL = S.tileC(2, 2), skel = add(K.makeSkeleton()); skel.obj.position.copy(SKEL); skel.obj.rotation.y = 0.5;
  if (S.flag('scroll')) skel.scroll.visible = false;
  S.block('skeleton', SKEL.x, SKEL.z, 0.5);
  S.on({ id: 'skeleton', at: SKEL, r: 1.8, action: 'E — Look at the skeleton', run: async () => {
    await S.turnTo(SKEL); S.cam.two(anne, SKEL, { y: 1.1, y2: 0.2, dist: 2.6, pitch: 0.32 });
    await S.say('a1', 4, 'Something dead...', { expr: 'worried' });
    if (S.flag('scroll')) return;
    S.emote(anne, 'dots', 1.0); await S.wait(1.1);
    await S.say('a1', 2, 'Oh, a scroll?', { expr: 'surprised' });
    await S.say('am', 0, 'What is it?');
    await S.say('a1', 6, "I don't know. I can't read it.");
    await S.say('am', 0, "Take it to the camp and learn how to read\nit when you've got some time to spare.");
    await S.say('am', 0, 'Might be of use.');
    skel.scroll.visible = false; S.flag('scroll', true);
    sparks.burst(V3(SKEL.x, 0.4, SKEL.z), GOLD, 16, 0.9, 1.0); S.toast('Magic Scroll +1', 'success', 2.4);
  } });

  // ---------- two chests: ingredients in the grotto's corner; potions or odds and ends in the north-east alcove ----------
  kit.chest('chestK', 1, 3, { kind: 'ingredients', face: Math.PI / 2 });
  kit.chest('chestL', 21, 3, { kind: Math.random() < 0.5 ? 'items' : 'potions' });

  // =====================================================================================================
  //                                                 Myconids
  // =====================================================================================================
  // Three blue patches (two Myconids each, the 2D's troop 4) in the mouths of the narrow corridors, one red (one or two),
  // and the "Myconid Nest" lady who stands in the grotto already (one, no spores first). Each blocks its corridor until
  // she is beaten: to reach the grotto she has to get past the blue one at (3,10) or the red one at (5,8).
  const MYCS = [[21, 11, 'blue'], [21, 4, 'blue'], [3, 10, 'blue'], [5, 8, 'red'], [2, 4, 'blue', true]];
  MYCS.forEach(([x, y, tint, lady], i) => {
    const id = 'cmyc' + i, at = spot(x, y), m = add(K.makeMyconid(i + 11, tint)); m.obj.position.copy(at.p); m.faceTo(at.p.x + 0.3, at.p.z + 4);
    const ev = S.on({ id, at: at.p, r: 1.2, touch: true, run: async () => {
      const how = await kit.myconid({ m, at, tint, lady, n: lady ? 1 : tint === 'red' ? () => 1 + Math.floor(Math.random() * 2) : 2 });
      if (how === 'won') S.remove(id);
    } });
    if (!ev) { m.obj.visible = false; return; }
    if (lady) m.wake();
    S.block(id, at.p.x, at.p.z, 0.6); S.avoid(m.obj, 0.6, 1.9, () => m.obj.visible);
  });

  // ---------- the hidden pit in the east corridor (the 2D's tentacle trap: traps.js, kind 'vines') ----------
  // There is no way round it; once it has gone off it is an open pit she hops over.
  // Four misses there and the floor of the pit gives way to Scylla's grotto (scylla.js; the 2D: CE 80 CAPTURE3).
  const scylla = createScylla(S, C, cap, env);
  createTraps(S, C, env, { holeAt: S.tileC(21, 7), faceTo: S.tileC(21, 3), kind: 'vines', id: 'ctrap', cap, wake: kit.wakeUp, below: () => scylla.grotto() });

  // =====================================================================================================
  //                                           the way out, arriving
  // =====================================================================================================
  // walking north into the foot of the shaft: she steps up into the light and is gone, back at the cave mouth
  S.on({ id: 'climb', at: V3(SHAFT.x, 0, SHAFT.z + TILE * 0.36), r: 0.75, touch: true, when: () => Math.cos(anne.rotation.y) < -0.55, run: async () => {
    const from = anne.position.clone(), to = V3(SHAFT.x, 0, SHAFT.z + TILE * 0.1); let k = 0;
    const fade = S.fade(1, 0.5);
    await S.until((dt) => { k = Math.min(1, k + dt / 0.5); anne.position.lerpVectors(from, to, k); return k >= 1; });
    await fade; S.go('forest', [6, 48], 'south');
  } });

  S.hint = async () => {
    await S.say('am', 0, 'Damp, dark and full of mushrooms.\nThe way out is the shaft of light we came down.');
    if (S.progress >= 20 && S.progress < 30) await S.say('am', 0, "Alraune's nest is not down here, though.\nLook for a hole among the flowers up in the forest.");
  };
  S.onArrive = () => { C.checkpoint(); };
  S.blockExit = () => false;
}
