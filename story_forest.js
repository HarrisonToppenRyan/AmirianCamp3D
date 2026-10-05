// story_forest.js: the North Forest's part of the story (the 2D game's Map003 at GAME_PROGRESS 10 to 20):
// the Ivy Maidens overrun the forest, every way out is choked with vines, and where the lane to the Main Road is
// blocked Anne meets their queen, Alraune, for the first time. It ends when Alraune has gone back to her lair.
//
// Positions are the 2D map's own event tiles. Every fight is the space-bar gauge for now (no combat, no crafting).
// A lost fight is the 2D game's capture scene kept as a comedy tickle gag: the vines take her shoes and tickle her
// feet until she breaks free.
const V = new URL(import.meta.url).search;      // this file's own ?v=..., passed on so that no stale copy of what it imports is used
const { common } = await import('./story_common.js' + V);
const { createCaptures } = await import('./captures.js' + V);
const { creatureKit } = await import('./creatures.js' + V);

export async function setup(S, env) {
  const { THREE, scene, anne, A, V3, TILE } = S, C = common(S), { K, am, sparks } = C;
  const walkAt = env.walkAt, has = (n) => A.hasClip && A.hasClip(n);
  const GREEN = new THREE.Color(0.5, 1.6, 0.5), GOLD = new THREE.Color(1.7, 1.3, 0.4), PINK = new THREE.Color(1.6, 0.5, 1.1), SPORE = new THREE.Color(1.2, 1.3, 0.3);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cap = createCaptures(S, C, env);           // what happens when she misses the space bar (captures.js)

  // where a thing stands, the fights, the stomping and the pamperings, the captures and waking up: creatures.js
  const kit = creatureKit(S, C, env, cap), { spot, add, back, ambush, encounter, fight, tamed, captured, wakeUp } = kit;

  // =====================================================================================================
  //                                             the forest's furniture
  // =====================================================================================================
  // (progress 30/35: Alraune is beaten and every vine wall, wild Ivy Maiden and the lane's tangle is gone; the three orange
  //  Myconids too, the two red ones stay)
  const CLEAN = S.progress >= 30;
  const REMARK = "No way I'm touching this...|I'd rather stay away...|So wiggly... nasty!";
  const BLOCKED = "It's blocking the path...|Cannot move through...|No way to move through...";
  // vine walls: [tile x, tile y, what she says]; they stand until Alraune is dealt with
  const WALLS = [[20, 42], [47, 3], [43, 3], [45, 3], [31, 4], [41, 10], [36, 11], [39, 40], [41, 49], [27, 52], [41, 20], [43, 19], [3, 15], [0, 15], [18, 11], [24, 10],
    [32, 51], [38, 50], [25, 52], [32, 37], [53, 4], [46, 38], [49, 37], [21, 51, BLOCKED], [21, 52, BLOCKED], [21, 53, BLOCKED]];
  const walls = {};
  if (!CLEAN) WALLS.forEach(([x, y, say], i) => {
    const at = spot(x, y), w = add(K.makeVineWall(at.p.x, at.p.z, i + 1)); walls[x + ',' + y] = w; S.avoid(at.p, 0.85, 2.6, () => w.obj.visible);
    if (at.open) S.block('wall' + i, at.p.x, at.p.z, 0.78);
    S.on({ id: 'wall' + i, at: at.p, r: 1.25, touch: true, run: async () => { S.toast(say || REMARK, 'dialog'); S.expr('worried'); await S.hop(at.p, 0.35); await S.wait(0.3); } });
  });
  // the lane to the Main Road: a tunnel of vines under the great trees (tiles 50..53 of row 6, and up the trunks)
  const LANE = [[50, 6], [51, 6], [52, 6], [53, 6]];
  const laneWalls = CLEAN ? [] : LANE.map(([x, y], i) => { const p = S.tileC(x, y), w = add(K.makeVineWall(p.x, p.z, 40 + i)); S.block('lane' + i, p.x, p.z, 0.8); S.avoid(p, 0.85, 2.6, () => w.up); return w; });
  if (!CLEAN) for (const [x, y] of [[50, 4], [50, 5], [51, 5], [52, 5]]) { const at = spot(x, y); add(K.makeVineWall(at.p.x, at.p.z - 0.2, x + y)); }

  // signposts (the 2D game's own wording)
  const SIGNS = [
    [43, 43, async () => { await S.say('', 0, 'South-West: To the Main Road\nSouth-East: Danger! Do not get close to the swamp!', { name: 'Signpost' }); await S.say('a1', 6, "It's... this way."); }],
    [40, 51, async () => { await S.say('', 0, 'South-West: To the Main Road\nEast: To the swamp', { name: 'Signpost' }); }],
    [11, 17, async () => { await S.say('', 0, 'West: Main Road, Valyndra City, Dawn Harbor\nEast: North Forest Glade', { name: 'Signpost' }); }],
    [42, 4, async () => { await S.say('', 0, 'Main Road', { name: 'Signpost' }); }],
    [55, 4, async () => { await S.say('', 0, '- Main Road\n- Dawn Harbor', { name: 'Signpost' }); }],
  ];
  SIGNS.forEach(([x, y, read], i) => {
    const at = spot(x, y), sp = add(K.makeSignpost(2)); sp.obj.position.copy(at.p); sp.obj.rotation.y = i * 1.3;
    S.block('sign' + i, at.p.x, at.p.z, 0.22);
    S.on({ id: 'sign' + i, at: at.p, r: 1.6, action: 'E — Read the signpost', run: async () => { await S.turnTo(at.p); await read(); } });
  });

  // the hole in the flower glade: the way down to the Ivy Maidens' nest
  const HOLE = spot(36, 12).p, hole = add(K.makeHole()); hole.obj.position.copy(HOLE); S.block('hole', HOLE.x, HOLE.z, 0.7);
  const facing = (p, k = 0.75) => { const dx = p.x - anne.position.x, dz = p.z - anne.position.z, l = Math.hypot(dx, dz) || 1; return (Math.sin(anne.rotation.y) * dx + Math.cos(anne.rotation.y) * dz) / l > k; };
  const lookHole = async () => {
    await S.turnTo(HOLE); S.cam.two(anne, HOLE, { y: 1.0, y2: 0.1, dist: 3.2, pitch: 0.42 });
    if (S.progress < 20) {
      await S.say('a1', 7, 'Creepy...', { expr: 'worried' });
      await S.say('am', 0, 'Will you go down there?');
      await S.say('a1', 1, "Not now.\nWe've got to move.");
    } else {
      if (S.progress === 20) {                     // (the first time only; afterwards just the question)
        await S.say('am', 0, 'Be careful there.\nTake healing and mana potions with you\nbefore facing her.');
        await S.say('a1', 7, 'Aye...');
      }
      if (await S.choice(['Jump down', 'Leave']) !== 0) return;
      // she jumps in: the 2D just fades to black; here a hop over the rim first
      const from = anne.position.clone(); let k = 0;
      if (A.setFloor) A.setFloor(-99);                 // (10-03: down the hole she goes: her feet are meant to go under the ground here)
      await S.until((dt) => { k = Math.min(1, k + dt / 0.55); anne.position.lerpVectors(from, HOLE, k); anne.position.y = 0.5 * Math.sin(Math.PI * k) - 0.9 * k * k; return k >= 1; });
      await S.fade(1, 0.35); anne.position.y = 0; if (A.setFloor) A.setFloor(null);
      if (S.progress === 20) { S.progress = 21; S.toast("Quest: Find Alraune's nest - done!", 'success', 2.4); }
      S.go('nest', [5, 3], 'south');
    }
  };
  S.on({ id: 'hole', at: HOLE, r: 1.25, touch: true, when: () => facing(HOLE), run: lookHole });      // (the 2D: she walks into its rim)
  S.on({ id: 'holeE', at: HOLE, r: 1.9, action: 'E — Look down the hole', run: lookHole });

  // the goddess shrine: a rest, a hint, and the place she comes round at
  const SHRINE = spot(42, 28).p, shrine = add(K.makeShrine()); shrine.obj.position.copy(SHRINE); S.block('shrine', SHRINE.x, SHRINE.z, 0.5);
  S.on({ id: 'shrine', at: SHRINE, r: 1.9, action: 'E — Pray at the shrine', run: async () => {
    await S.turnTo(SHRINE); S.cam.two(anne, SHRINE, { y: 1.2, dist: 3.4, pitch: 0.14 });
    sparks.burst(V3(SHRINE.x, 1.3, SHRINE.z), GOLD, 26, 1.0, 1.4);
    await S.note('A gentle warmth... you feel rested.', 'success'); C.checkpoint();
    await S.hint();
  } });

  // the cave in the south-west (the 2D's "LamiaDungeon", open from the start): she walks into its mouth and fades into the dark,
  // and comes in under the shaft of daylight in the Caves
  { const at = spot(6, 46), mouth = S.tileC(6, 46); S.on({ id: 'cave', at: mouth, r: 1.25, touch: true, run: async () => {
    S.cam.behind(anne, { dist: 4.2, pitch: 0.3 });
    const from = anne.position.clone(); let k = 0;
    const fade = S.fade(1, 0.5);
    await S.until((dt) => { k = Math.min(1, k + dt / 0.5); anne.position.lerpVectors(from, mouth, k * 0.6); return k >= 1; });
    await fade; S.go('caves', [15, 4], 'south');
  } }); }

  // herbs to pick (the 2D game's ingredient spots; there is no crafting yet, so they only count)
  const HERBS = [[10, 31], [14, 50], [49, 39], [11, 51], [34, 3], [36, 2], [14, 13], [43, 39], [24, 35], [31, 11]];      // ((16,14) is the hollow log's: logscene.js, index.html LOG_AT)
  HERBS.forEach(([x, y], i) => {
    const at = spot(x, y), h = add(K.makeHerb(i + 5)); h.obj.position.copy(at.p);
    const ev = S.on({ id: 'herb' + i, at: at.p, r: 1.3, action: 'E — Pick the herbs', run: async () => {
      await S.turnTo(at.p); sparks.burst(V3(at.p.x, 0.4, at.p.z), GREEN, 14, 0.9, 1.3); h.obj.visible = false; S.addHerbs(1); S.toast('Herbs +1', 'success', 1.6); S.remove('herb' + i);
    } });
    if (!ev) h.obj.visible = false;                // (picked on an earlier visit)
  });

  // =====================================================================================================
  //                                                 the Ivy Maidens
  // =====================================================================================================
  // the wild Ivy Maidens of the 2D map: [tile x, tile y, how many fight, hidden in the ground until she walks in]
  const WILD = [[11, 55, 1], [29, 13, 1], [28, 13, 1], [29, 14, 1], [18, 14, 1], [57, 22, 1], [38, 27, 1], [22, 55, 2], [21, 45, 2], [11, 34, 1], [28, 14, 1], [7, 19, 1], [44, 39, 1],
    [29, 38, 1, true], [20, 27, 1, true], [31, 39, 1, true], [12, 18, 1, true], [13, 19, 1, true], [53, 52, 1, true], [23, 5, 1, true]];
  const maidens = [];
  if (!CLEAN) WILD.forEach(([x, y, n, trap], i) => {
    const id = 'ivy' + i, at = spot(x, y), group = [];
    for (let k = 0; k < n; k++) {
      const m = add(K.makeIvyMaiden({ seed: i * 3 + k + 1, hidden: !!trap, gazer: n > 1 && k === 1 }));
      m.obj.position.set(at.p.x + (k ? (k % 2 ? 0.75 : -0.75) : 0), 0, at.p.z + (k ? 0.3 : 0)); m.obj.rotation.y = i * 1.7; group.push(m); S.avoid(m.obj, 0.5, 2.2, () => m.up);
    }
    const late = x === 44 && y === 39 && S.progress < 15;                 // (this one comes out of the trees in the arrival scene)
    const rec = { id, at, group, trap: !!trap, out: !trap };
    if (late) for (const m of group) m.hideNow();
    const ev = S.on({ id, at: at.p, r: trap ? 0.95 : 1.55, touch: true, when: () => S.progress >= 15 || !(x === 44 && y === 39), run: () => (rec.out ? encounter(rec) : ambush(rec)) });
    if (!ev) { for (const m of group) m.hideNow(); return; }
    if (!trap && at.open) S.block(id, at.p.x, at.p.z, 0.45);
    if (!trap && !(x === 44 && y === 39)) kit.roam(rec, { ev, style: 'tiles', radius: 8, speed: 1.7, notice: 0 });      // (10-02: they wander as the 2D's do: a tile at a time, freely, never after her; (44,39) stands still)
    maidens.push(rec);
  });

  // =====================================================================================================
  //                                                    Myconids
  // =====================================================================================================
  // The 2D map's Myconids: four orange ones and two red (quicker). A hit and she stamps the root out; a miss and
  // the lady and her children have her (captures.js).
  [[16, 33, 'orange'], [34, 40, 'orange'], [24, 4, 'orange'], [4, 16, 'red'], [45, 24, 'red'], [33, 42, 'orange']].forEach(([x, y, tint], i) => {      // (10-02: and the sixth, the 2D's EV15 at (31,45): that tile lies under this map's canopy, so on the open ground just north of it)
    if (tint === 'orange' && S.progress >= 35) return;
    const id = 'myc' + i, at = spot(x, y), m = add(K.makeMyconid(i + 2, tint)); m.obj.position.copy(at.p);
    S.avoid(m.obj, 0.6, 1.9, () => m.obj.visible);
    const ev = S.on({ id, at: at.p, r: 1.25, touch: true, run: async () => {
      back.copy(anne.position);
      m.faceTo(anne.position.x, anne.position.z); m.wake(); m.kids(true); S.emote(anne, 'exclaim', 0.8); S.expr('surprised');
      S.toast('Myconids!!|What the?!?!|Oh, NO!!|Huh??', 'warning');
      S.cam.two(anne, at.p, { y: 1.1, y2: 0.9, dist: 2.8, pitch: 0.2 });
      await S.hop(at.p, 0.5); await S.turnTo(at.p, 0.15); await S.wait(0.5);
      back.copy(anne.position);
      m.hop(); sparks.burst(V3(at.p.x, 1.2, at.p.z), SPORE, 26, 1.2, 0.8);
      if (await S.gauge({ label: 'Spores! Hold your breath: SPACE in the green!', width: tint === 'red' ? 0.17 : 0.24, speed: tint === 'red' ? 1.0 : 0.8 })) {
        S.expr('angry'); await S.say('am', 4, 'QUICKLY!!! Stamp on her root!\n...or make her useful first, kitty.');
        const how = await tamed([], 'myc', m);
        if (how !== 'stomped') {                       // (left alone, or pampered and then let go: the root is stamped out all the same)
          await S.walk([V3(at.p.x + (anne.position.x - at.p.x) * 0.5, 0, at.p.z + (anne.position.z - at.p.z) * 0.5)], { speed: 2.2 });
          S.toast('Head back to ground, nasty creep!!!', 'dialog', 2);
          if (has('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.3); }
        }
        m.sleep(); sparks.burst(V3(at.p.x, 0.3, at.p.z), GOLD, 22, 1.6, 1.0); await S.wait(0.6); S.clip('Idle', 0.2);
        S.toast('Myconid root destroyed!', 'info'); S.flag('mycUnlocked', true);
      } else {
        const { free } = await kit.mycCapture(m);      // (the 2D's rounds, or tied up: the player's choice)
        S.clip('Idle', 0); m.obj.position.copy(at.p); m.sleep();
        if (free) {
          const away = V3(back.x - at.p.x, 0, back.z - at.p.z); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
          S.place(V3(at.p.x + away.x * 2.4, 0, at.p.z + away.z * 2.4), Math.atan2(-away.x, -away.z));
          await cap.kit.putShoesOn();                    // (10-03: her shoes back on)
          S.cam.behind(anne, { cut: true, dist: 4.5 }); await S.fade(0, 0.4); S.expr('pout');
          S.toast('The Myconid has gone deep underground.|The Myconid has escaped.', 'note', 2.4);
        } else {
          await wakeUp(false);
          S.toast('The Myconids scurry off, very pleased with themselves.', 'note', 2.4);
        }
      }
      m.obj.visible = false; S.remove(id);
    } });
    if (!ev) m.obj.visible = false;
  });

  // =====================================================================================================
  //                                                   the story
  // =====================================================================================================
  // ----- arriving from the camp: the forest has changed overnight (2D event "GameProgress")
  if (S.progress < 15) { for (const k of ['46,38', '49,37']) if (walls[k]) walls[k].hide(); }      // (they sprout in the arrival scene)
  S.on({ id: 'intro', at: [51, 40], r: 3.4, touch: true, when: () => S.progress < 15, run: async () => {      // (wide: whichever side of the clearing she comes down)
    S.emote(anne, 'dots', 0.9); S.cam.behind(anne, { dist: 5.5, pitch: 0.4 });
    await S.walk([[48, 40], [48, 41], [47, 41], [47, 42], [44, 42]], { speed: 2.1 });
    await S.turnTo(S.tileC(44, 44)); S.cam.two(anne, S.tileC(44, 44), { y: 1.2, dist: 3.4, pitch: 0.14 });
    await S.say('a1', 4, 'We are far enough from the tower now.\nShall I take the south way then?');
    S.progress = 15;
    await S.say('am', 8, 'Wait, have you spotted the signposts along the trail?\nThese would help you find your way out.');
    // the vines stir in the tree line north of the trail
    const w1 = walls['46,38'], w2 = walls['49,37'], near = maidens.find((r) => r.id === 'ivy12');
    if (w1) w1.sprout(); if (w2) w2.sprout();
    if (near) { near.out = true; for (const m of near.group) { m.faceTo(anne.position.x, anne.position.z); m.emerge(); } }
    await S.wait(0.5); S.emote(anne, 'exclaim', 0.9); await S.turnTo(near ? near.at.p : S.tileC(44, 39)); S.expr('surprised');
    S.cam.two(anne, near ? near.at.p : S.tileC(44, 39), { y: 1.2, dist: 2.6, pitch: 0.16 });
    await S.mark('intro');
    await S.say('a1', 1, 'Hold on... What...\nwhat the hell are all those vine-like things?');
    if (near) for (const m of near.group) { m.shake(0.8); m.lean(0.5); m.faceTo(anne.position.x, anne.position.z); }
    await S.say('am', 0, "Watch out, they're Ivy Maidens.\nAnd they look angry.");
    await S.say('a1', 2, "Ivy Maidens? Here?\nI don't remember seeing them yesterday.");
    await S.say('am', 0, "Looks like they were working overtime last\nnight.\nThey're all over the place now...\nWe should be cautious.");
    await S.say('a1', 5, "It's creepy...\nWhy are they looking at...\nWAIT!!! ARE THEY AFTER ME????", { expr: 'shocked' });
    await S.say('am', 1, "They look frenzied. I don't think they're\nhere on their own.");
    await S.say('am', 1, "They're brainless creatures, unless they're\nunder the control of someone else.");
    await S.say('a1', 4, "We escaped the magician scouts yesterday.\nWhat if they summoned their pets to\nchase me?\nThis must be those wizards' work.");
    S.emote(anne, 'exclaim', 0.8);
    await S.say('a1', 2, "Let's go!\nWe should move fast and leave\nthis place as soon as possible.");
    await S.say('am', 0, 'Aye!');
    if (near) for (const m of near.group) m.lean(0);
    S.objective('Find the way out of the forest. The signposts point to the Main Road.');
    C.checkpoint();
  } });

  // ----- the two spots from which she sees the lane out (2D events "Exit Spot West" and "Exit Spot South")
  const STAGE = S.tileC(48, 6), BLOOM = V3(S.tileC(52, 6).x + 0.3, 0, S.tileC(52, 6).z), GUARD_X = STAGE.x + 1.45;      // she stops a tile short of the vines; the guards come up between
  S.on({ id: 'exitW', at: [43, 5], r: 1.5, touch: true, when: () => S.progress === 15, run: async () => {
    C.checkpoint(); S.emote(anne, 'exclaim', 0.8); S.cam.behind(anne, { dist: 5 });
    await S.say('a1', 2, 'Here it is!!!', { expr: 'happy' });
    await S.walk([[46, 5], [46, 6], STAGE], { speed: 3.2 });
    await blockedLane();
  } });
  S.on({ id: 'exitS', at: [47, 10], r: 1.5, touch: true, when: () => S.progress === 15, run: async () => {
    C.checkpoint(); S.emote(anne, 'exclaim', 0.8); S.cam.behind(anne, { dist: 5 });
    await S.say('a1', 2, "We've found it!!", { expr: 'happy' });
    await S.walk([[47, 6], STAGE], { speed: 3.2 });
    await blockedLane();
  } });
  // after a lost fight she is back at 15 and walks up again; at 16 the scene starts where she stands
  S.on({ id: 'lane', at: STAGE, r: 2.2, touch: true, when: () => S.progress === 16, run: () => blockedLane() });
  S.on({ id: 'laneLater', at: STAGE, r: 1.6, action: 'E — Look at the vines', when: () => S.progress >= 20 && S.progress < 30, run: async () => { await S.turnTo(S.tileC(50, 6)); await S.say('a1', 1, "It's blocked."); await S.hint(); } });

  // ----- after the nest: the lane is open. It leads out of the forest, to the clearing at its edge where the Chapter 1
  //       epilogue plays (story_edge.js: Boudicca's ambush, the theft); after the chapter, simply back to that clearing.
  //       (The 2D: one step on, the music and the forest's sound fade over 4 s, 2 s of black.)
  S.on({ id: 'laneOut', at: S.tileC(51, 6), r: 1.3, touch: true, when: () => S.progress >= 30, run: async () => {
    S.cam.behind(anne, { dist: 5, pitch: 0.25 });
    await S.walk([S.tileC(53, 6)], { speed: 2.0 });
    if (S.progress < 35) S.progress = 35;
    env.quiet(true); await S.fade(1, 1.0); await S.wait(1.4);
    S.go('edge', [13, 2], 'south');
    await new Promise(() => {});                         // (the page is leaving)
  } });
  // ----- coming back up from the nest after the fight ("Leave"): she is on the lane, facing the way out
  S.on({ id: 'ohYes', at: S.tileC(46, 6), r: 2.0, touch: true, when: () => S.flag('ohYes'), run: async () => {
    S.flag('ohYes', false); await S.turnTo(S.tileC(50, 6), 0.2); S.cam.two(anne, S.tileC(50, 6), { y: 1.3, dist: 3.4, pitch: 0.14 });
    S.emote(anne, 'exclaim', 0.8);
    await S.say('a1', 10, 'OH YES!!!', { expr: 'happy' });
    S.cam.behind(anne, { dist: 4.5 });
  } });

  // ----- Alraune -----
  const bloom = add(K.makeBloom()); bloom.obj.position.copy(BLOOM); bloom.obj.rotation.y = -Math.PI / 2;      // she faces west, down the lane
  S.avoid(bloom.obj, 1.0, 3.2, () => bloom.up);
  let alraune = null;                              // her figure in the flower (alraune.js)
  try { const mod = await import('./alraune.js?v=' + (env.VER || 1)); alraune = await mod.createAlraune({ THREE, K, scene, seat: bloom.seat, qp: null, ver: env.VER }); if (alraune.update) S.actors.push(alraune); }
  catch (e) { console.warn('alraune.js not loaded', e); }
  const alFace = (out = V3()) => (alraune && alraune.headPos ? alraune.headPos(out) : out.set(BLOOM.x, 2.0, BLOOM.z));
  const al = { expr: (n) => { if (alraune && alraune.setExpression) alraune.setExpression(n); }, clip: (n, f) => { if (alraune && alraune.playClip) alraune.playClip(n, f); }, talk: (on) => { if (alraune && alraune.setTalking) alraune.setTalking(on); } };
  const prevSpeak = S.onSpeak;
  S.onSpeak = (sheet, on) => { prevSpeak(sheet, on); if (sheet === 'al') al.talk(on); };
  // camera set-ups for the meeting: down the lane from behind Anne, on Alraune, on Anne
  const shots = {
    lane: (o = {}) => S.cam.at(V3(STAGE.x + 2.0, 0, STAGE.z), -Math.PI / 2 + 0.3, Object.assign({ y: 1.3, pitch: 0.2, dist: 5.4, through: true }, o)),
    her: (o = {}) => S.cam.at(alFace(), -Math.PI / 2 - 0.22, Object.assign({ y: alFace().y - 0.05, pitch: 0.02, dist: 2.3, fov: 36, focus: alFace(), focusK: 1.5 }, o)),
    herWide: (o = {}) => S.cam.at(BLOOM, -Math.PI / 2 - 0.12, Object.assign({ y: 1.35, pitch: 0.08, dist: 4.4 }, o)),
    anne: (o = {}) => S.cam.at(C.headPos(), Math.PI / 2 + 0.35, Object.assign({ y: C.headPos().y - 0.08, pitch: 0.03, dist: 2.0, fov: 36, focus: C.headPos(), focusK: 1.5 }, o)),
    // her feet in their heels, from low in front of her: the cut-away while they talk about how ticklish they are
    feet: (o = {}) => {
      C.snapSoles(); C.readFeet(0);
      const p = V3().addVectors(C.feet[0].ball, C.feet[1].ball).multiplyScalar(0.5); p.x += Math.sin(anne.rotation.y) * 0.03; p.z += Math.cos(anne.rotation.y) * 0.03;
      S.cam.at(p, anne.rotation.y + (o.turn === undefined ? 0.62 : o.turn), Object.assign({ y: 0.055, pitch: 0.14, dist: 0.8, fov: 30, focus: p.clone().setY(0.05), focusK: 2.2, cut: true, through: true, minY: 0.06, near: 0.25 }, o));
      if (env.post && env.post.setCloseUp) env.post.setCloseUp('on');
    },
    feetOff: () => { S.toes(0); if (env.post && env.post.setCloseUp) env.post.setCloseUp('off'); },
  };
  const guards = [0, 1, 2].map((i) => { const m = add(K.makeIvyMaiden({ seed: 90 + i, hidden: true, gazer: i === 1, height: 1.5 })); S.avoid(m.obj, 0.5, 2.2, () => m.up); return m; });

  async function blockedLane() {
    const first = S.progress < 16;
    S.progress = 16; S.objective('');
    S.place(STAGE, Math.PI / 2); S.clip('Idle', 0.2); shots.lane({ cut: !first });
    S.emote(anne, 'anger', 0.9);
    await S.say('a1', 5, 'Dammit!!\n... what now!', { expr: 'angry' });
    await S.say('am', 0, "These vines have been really busy.\nThe lane is blocked. It's a trap.");
    await S.say('a1', 1, "If the damn magicians are behind this,\nI haven't seen any evidence of their\npresence yet...");
    await S.say('am', 0, "I don't think the wizards are aware of this\nat all. These creatures look really familiar...");
    await S.say('al', 0, 'My my...\n\nWhat do we have here?', { name: '???' });
    S.emote(anne, 'question', 0.9); S.expr('surprised');
    await S.say('a1', 1, 'What?...\nWho said that?');
    // the vines draw aside and the great flower rises in the lane
    laneWalls[0].wilt(); laneWalls[1].wilt(); laneWalls[2].wilt();
    await S.wait(0.5); bloom.emerge(); al.clip('Rise', 0); shots.herWide();
    sparks.burst(V3(BLOOM.x, 0.6, BLOOM.z), PINK, 40, 1.6, 2.0);
    await S.wait(1.5); S.emote(anne, 'exclaim', 0.9); if (has('Startle')) S.clip('Startle', 0.1);
    await S.hop(BLOOM, 0.35); S.clip(has('Point') ? 'Point' : 'Idle', 0.2); shots.anne();
    await S.mark('alraune');
    await S.say('a1', 1, 'There!!\nWho are you?!!', { expr: 'angry' });
    S.clip('Idle', 0.3); shots.her(); al.expr('smile');
    await S.say('al', 2, "Ahhhh... Have you met my minions already?\nDo you like them? I've told them to\nbe especially gentle with you, darling.");
    await S.mark('alraune2');
    shots.anne();
    await S.say('a1', 1, "So you are the one commanding these creatures...\nI don't believe we've met yet.\nWHO THE HELL ARE YOU?", { expr: 'angry' });
    shots.lane();
    await S.say('am', 2, 'Me! Me! Me! Me! Me! Me! Me!\nI know I know I know who she is!!!');
    shots.her(); al.expr('surprised');
    await S.say('al', 8, "Oh... who's that?\nSo you're not alone here, dear, are you?");
    await S.say('am', 4, "You're one of Lilith's minions...");
    shots.anne();
    await S.say('a1', 5, 'What?', { expr: 'shocked' });
    shots.her(); al.expr('smug');
    await S.say('al', 2, "Your henchman is quite clever, dear!\nMy name is Alraune.\nSo riddle me this, henchman:\n    why do you think I'm here?");
    await S.say('am', 2, "That would be an exciting question!\nIf it wasn't obvious you're here\non your mistress' orders.");
    shots.anne(); S.emote(anne, 'exclaim', 0.9);
    await S.say('a2', 5, 'WWWHAAAAT!!!!????', { expr: 'shocked' });
    shots.her(); al.expr('smile');
    await S.say('al', 0, "My my...\nYou're really a good advisor, handsome!");
    await S.say('am', 2, 'Appreciated!');
    shots.lane();
    await S.say('am', 4, "Look! I've got these tentacles too!\nWanna see them wiggle?");
    S.emote(anne, 'sweat', 0.9);
    shots.her(); al.expr('smug');
    await S.say('al', 2, 'Hmmmmm...\nSo, henchman, tell me, do you use\nthose tentacles on your ' + (((S.lookWords && S.lookWords()) || {}).hairWord || 'redheaded') + ' friend?');      // (10-04: the hair the player gave her)
    S.emote(anne, 'exclaim', 0.8);
    // (they are talking about her feet: the picture goes to them, and her toes stir in her shoes)
    shots.feet(); S.toes(0.1, 1.2, 1.5); S.expr('embarrassed', 0.6);
    await S.say('am', 4, "Oh indeed! I do!\nShe loves having her feet tickled!\nI find it's a good way to calm her down\nwhen she's in a sour mood.", { noFeet: true });
    await S.mark('feet');
    shots.feetOff(); shots.anne({ cut: true }); S.emote(anne, 'anger', 1.0);
    await S.say('a2', 4, 'WWWWHHHHAHAAAAAATTTTTTT!!!!!', { expr: 'angry', blush: 0.6 });
    shots.her({ cut: true }); al.expr('happy'); al.clip('Delight', 0.3);
    await S.say('al', 8, "Ohh goodness!!\nI need to hear that laugh!!\nIt will feed me for days...");
    // what she has on her feet (story_common.js lookTalk): the pair, and the colour of her toenails. The more of her feet
    // it shows, the happier Alraune is; closed heels put her out.
    const talk = C.lookTalk('al'); let nf = 0;
    // (batch 22: her feet in her shoes by her skin's tone, and what she is or wears: before Anne answers)
    if (C.lookRemarks) { const R = C.lookRemarks('al', 3); talk.lines.splice(Math.max(1, talk.lines.length - 1), 0, ...R.map((t, k) => ['al', k ? 2 : 3, t, k ? { al: ['smug', 'Idle'] } : { feet: true, al: ['happy', 'Idle'] }])); }
    S.flag('alLook', ((S.look && S.look()) || {}).key || '');      // (10-03: so she notices new shoes in her nest)
    for (const [sheet, i, text, o = {}] of talk.lines) {
      if (o.al) { al.expr(o.al[0]); al.clip(o.al[1], 0.3); }
      if (o.feet) {
        shots.feet(nf++ ? { turn: 0.3, dist: 0.66, pitch: 0.12 } : { turn: -0.75, dist: 0.9, pitch: 0.2 });
        if (talk.lv > 0) S.toes(o.toes ? 0.14 : 0.1, 1.4, 1.6); S.expr(talk.lv ? 'embarrassed' : 'worried', 0.6);
      } else { shots.feetOff(); if (sheet === 'al') shots.her(); else shots.anne(); }
      await S.say(sheet, i, text, Object.assign({ noFeet: true }, o));
      if (nf === 1 && o.feet) await S.mark('feet2');
    }
    shots.feetOff();
    al.expr('laugh'); al.clip('Command', 0.3); shots.herWide({ cut: true });
    await S.say('al', 3, "COME HERE, MY MINIONS!!!\nWE'VE GOT A GUEST TO ATTEND TO!!!");
    // three of them come up between her and Anne
    guards.forEach((m, i) => { m.obj.position.set(GUARD_X + (i === 1 ? 0.35 : 0), 0, STAGE.z + (i - 1) * 1.15); m.faceTo(STAGE.x, STAGE.z); m.emerge(); });
    S.expr('angry'); shots.lane(); if (env.music) env.music('battle3.mp3');
    await S.wait(0.9); for (const m of guards) m.lean(0.5);
    await S.mark('battle');
    const rec = { id: 'guards', at: { p: V3(GUARD_X, 0, STAGE.z) }, group: guards };
    back.copy(STAGE);
    const won = await fight(rec, { keep: true, noCapture: true, width: 0.19, speed: 0.9 });
    if (!won) {                                    // they have her: the 2D game's game-over scene, and back to before the lane
      al.expr('laugh');
      // (the 2D game's SceneAlraune, CAPTURE1: her vines lift Anne up before the flower. It is played in the clearing at the
      //  mouth of the lane, where there is room to see it from the side, as the 2D sheet draws it)
      await S.say('al', 0, 'My my... such a lively guest!\nHold her still, my dears.');
      if (alraune && alraune.reach && cap.alraune) {
        const at = S.tileC(46, 6); at.z += 0.5;
        const { free } = await kit.alrauneCapture({ fig: alraune, al, bloom, at, yaw: Math.PI / 2, maidens: guards });      // (the 2D's scene, or tied up)
        S.clip('Idle', 0); bloom.hideNow(); bloom.obj.position.copy(BLOOM); bloom.obj.rotation.y = -Math.PI / 2; al.clip('Idle', 0);
        await wakeUp(free);
      } else await captured(rec, { gameOver: true, intro: async () => {} });
      for (const m of guards) m.hideNow(); bloom.hideNow(); laneWalls.forEach((w) => w.sprout(true));
      if (env.music) env.music(null);
      S.progress = 15; S.objective('Find the way out of the forest. The signposts point to the Main Road.');
      return;
    }
    if (env.music) env.music(null);
    await afterBattle();
  }

  async function afterBattle() {
    // Alraune sinks back into the ground; two of her maidens wilt, one is too slow
    guards[0].sink(); guards[2].sink(); guards[1].shake(1); guards[1].lean(-0.4);
    al.expr('pout'); shots.herWide();
    await S.say('al', 4, "Hmph. You are no fun at all, darling.\nWe shall play later... in MY garden.");
    bloom.sink(); sparks.burst(V3(BLOOM.x, 0.8, BLOOM.z), PINK, 36, 1.4, 1.6);
    await S.wait(1.3); laneWalls.forEach((w) => w.sprout()); shots.lane();      // (the vines close the lane again: the camera must be out of it)
    await S.wait(1.0);
    await S.mark('gone');
    shots.anne({ dist: 2.6 }); S.emote(anne, 'anger', 1.0);
    await S.say('a2', 4, "WHAT THE HELL WERE YOU THINKING,\nYOU FILTHY SACK OF LIMBS!", { expr: 'angry', blush: 0.4 });
    await S.say('am', 4, 'Sorry,\nthat conversation got me so excited!\nI remember those afternoons--');
    if (has('Stomp')) { S.clip('Stomp', 0.1); await S.wait(0.35); } sparks.burst(C.headPos().add(V3(-0.4, -0.25, 0)), GOLD, 14, 1.2, 0.8); await S.wait(0.5); S.clip('Idle', 0.2);
    await S.say('a2', 1, "...Do it again and you'll\nbe in serious trouble!");
    await S.say('am', 10, 'YES MISS!');
    shots.lane();
    await S.say('a2', 3, 'What now?\nWe must find and defeat her to get the path\nfree again.', { expr: 'worried' });
    await S.say('a1', 1, 'Where do we start searching?');
    await S.say('am', 0, 'Capture one of these Ivy Maidens\nbefore they escape!!');
    await S.say('am', 12, 'Then we might get some information from\nthem about their leader.');
    await S.say('am', 4, 'This is a good chance to\ninterrogate your foes!');
    // she pins the slow one under her heel
    const m = guards[1];
    S.expr('angry'); await S.walk([V3(m.obj.position.x - 0.85, 0, m.obj.position.z)], { speed: 2.6 }); await S.turnTo(m.obj.position, 0.15);
    S.cam.two(anne, m.obj.position, { y: 1.15, dist: 2.7, pitch: 0.16 });
    S.toast("Now you're not that fond of curling round my ankles, huh?", 'dialog', 3);
    for (let i = 0; i < 2; i++) { if (has('Stomp')) S.clip('Stomp', 0.1); await S.wait(0.35); m.shake(1.3); m.lean(-0.7); sparks.burst(V3(m.obj.position.x, 0.5, m.obj.position.z), GREEN, 12, 1.2, 1.0); await S.wait(0.6); S.clip('Idle', 0.15); await S.wait(0.2); }
    await S.mark('interrogate');
    await S.say('ivy', 4, 'Stoop it, stoop it!!!\n\nWe surrender, human!');
    await S.say('a1', 4, 'Remove all those weeds from my way!', { expr: 'angry' });
    await S.say('ivy', 1, 'We cannot do that, sweetie.\nOur mistress commands all our sisters here.');
    await S.say('ivy', 5, "Yess, you need to convince her, sweetie.\n\nShe's taking over the forest from her nest.");
    await S.say('a1', 5, "Then tell me!\n\n    Where's her nest!", { expr: 'angry' });
    await S.say('ivy', 5, 'Close, in the forest glade,\n    lots of flowers,\n    lots of sisters protecting her...\nwe are growing stronger... increasing our family...');
    await S.fade(1, 0.7);
    await S.say('am', 0, 'I bet we just need to follow the track\nof all those Ivy Maidens.', { keep: false });
    // cut to the glade: Alraune goes down into her lair
    m.sink();
    const HOLE_CAM = V3(HOLE.x - 1.2, 0, HOLE.z + 1.2), start = V3(HOLE.x - 3.8, 0, HOLE.z + 3.6);      // she comes up across the glade from the south-west
    bloom.obj.position.copy(start); bloom.obj.rotation.y = Math.atan2(HOLE.x - start.x, HOLE.z - start.z); bloom.showNow(); al.expr('smile'); al.clip('Idle', 0);
    S.cam.at(HOLE_CAM, 0.75, { y: 0.9, pitch: 0.3, dist: 8.5, cut: true });
    await S.wait(0.3); await S.fade(0, 0.8);
    await S.mark('lair');
    let t = 0; const from = start.clone();
    await S.until((dt) => { t += dt / 3.2; const k = S.sstep(0, 1, t); bloom.obj.position.lerpVectors(from, HOLE, k); bloom.obj.position.y = 0.12 * Math.sin(k * Math.PI * 5) * (1 - k); return t >= 1; });
    al.expr('smug'); await S.wait(0.5);
    bloom.sink(); sparks.burst(V3(HOLE.x, 0.7, HOLE.z), PINK, 40, 1.5, 1.6); await S.wait(1.4);
    await S.say('am', 8, "She's the Ivy Maidens' Queen,\nthese living vines protect her.\nI bet she's got a nest close.");
    await S.say('a1', 1, "A nest...\nAnd... where's that supposed to be?");
    await S.say('am', 0, 'There must be a hideout around.');
    await S.wait(0.8); await S.fade(1, 0.8);
    bloom.hideNow(); bloom.obj.position.copy(BLOOM); bloom.obj.rotation.y = -Math.PI / 2;
    S.place(S.tileC(47, 6), Math.PI); shots.anne({ cut: true, dist: 2.8 }); S.expr('angry');
    await S.wait(0.3); await S.fade(0, 0.8);
    await S.say('a2', 5, "Let's go to her hideout, kick her ass\nand clear this path!", { expr: 'angry' });
    S.progress = 20; C.checkpoint();
    S.objective("Find the Ivy Maidens' nest: a hideout among flowers and living vines.");
    await S.fade(1, 1.0);
    await S.card('To be continued', "Alraune has gone back to her lair.\n\nThe lane to the Main Road stays shut until Anne\nfinds the Ivy Maidens' nest and deals with their queen.", 'Press SPACE to keep exploring the forest');
    S.cam.behind(anne, { cut: true });
    await S.fade(0, 0.8);
  }

  // ---------- Amaymon's advice (shrines, and the lane after the meeting) ----------
  S.hint = async () => {
    if (S.progress < 15) await S.say('am', 0, 'Keep to the trail, and mind the plants.');
    else if (S.progress < 20) {
      await S.say('am', 0, 'We should take the path Southwest.\nThat will take us to the main road.');
      await S.say('am', 8, 'This forest winds back on itself: a trail that leaves\none side comes in at the other. Follow the signposts.');
    } else if (S.progress >= 30) {
      await S.say('am', 8, 'Alraune is gone, and the Ivy Maidens are not\nhere anymore.\nLooks like the forest is cleansed.\nThe path should be clear now.');
    } else {
      await S.say('am', 12, 'You cannot go through the wall of vines\nblocking the path.');
      await S.say('am', 0, "Find the Ivy Maidens' Nest and force Alraune\nto clean up the path.");
      await S.say('a1', 6, "And...\nwhere am I supposed to find that nest?");
      await S.say('am', 8, "There must be a hideout around. Look\nin places with lots of flowers\nand living vines. I'm sure there must be\na cave or a hole in the ground...");
      await S.say('am', 0, "Don't forget to take health and mana potions\nbefore getting in the nest.");
    }
  };

  // ---------- arriving ----------
  let wrapped = false;
  S.onArrive = (how) => {
    C.checkpoint();
    if (how === 'wrap' && !wrapped) { wrapped = true; S.toast('The trail winds on through the trees...', 'note', 2.2); }
    if (how !== 'wrap' && S.progress < 15) S.objective('Follow the trail west, away from the tower.');
    if (how !== 'wrap' && S.progress >= 15 && !S.state.flags.goal) S.objective(S.progress >= 30 ? 'Leave the forest: the lane to the Main Road should be clear now.' : S.progress >= 20 ? "Find the Ivy Maidens' nest: a hideout among flowers and living vines." : 'Find the way out of the forest. The signposts point to the Main Road.');
  };
  S.blockExit = () => false;

  // ---------- (tests) ?show=ivy|ivyY|myc|mycR: one of them beside her with the camera on it; &vd= distance, &vy= height, &va= bearing, &vf= face ----------
  const q = new URLSearchParams(location.search), show = q.get('show');
  if (show) {
    const p = V3(anne.position.x + 1.6, 0, anne.position.z); let y0 = 1.45;
    if (show === 'al') { bloom.obj.position.copy(p); bloom.obj.rotation.y = 0; bloom.showNow(); al.expr(q.get('vf') || 'smile'); al.clip(q.get('vc') || 'Idle'); if (q.has('vt')) al.talk(true); y0 = 1.44; }
    else if (show.startsWith('ivy')) { const m = add(K.makeIvyMaiden({ seed: +(q.get('vs') || 5), gazer: show === 'ivyY', height: 1.4 })); m.obj.position.copy(p); m.faceTo(p.x, p.z + 5); if (q.get('vf') === 'talk') m.talk(true); else if (q.get('vf')) m.setFace(q.get('vf')); }
    else { const m = add(K.makeMyconid(+(q.get('vs') || 3), show === 'mycR' ? 'red' : 'orange')); m.obj.position.copy(p); m.faceTo(p.x, p.z + 5); m.wake(); if (q.has('vk')) m.kids(true); y0 = 0.8; }
    const d = +(q.get('vd') || 1.2), a = +(q.get('va') || 0), y = +(q.get('vy') || y0), f = V3(p.x, y, p.z);
    window.__faceCam = () => { S.camera.position.set(p.x + Math.sin(a) * d, y + 0.05, p.z + Math.cos(a) * d); S.camera.lookAt(f); if (env.post) env.post.setFocus(null); };
    setTimeout(() => console.log('SHOW ready'), 2500);
  }
}
