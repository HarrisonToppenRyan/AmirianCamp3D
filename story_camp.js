// story_camp.js: the camp's part of the story: the night before (Anne wakes from one of Lilith's dreams and talks the
// plan over with Amaymon), the morning after (his tutorial for the space-bar gauge), and the way out to the forest.
// The lines follow the 2D game's Fireplace event; its bawdier jokes are left out.
const V = new URL(import.meta.url).search;      // this file's own ?v=..., passed on so that no stale copy of what it imports is used
const { common } = await import('./story_common.js' + V);
const { createTraps } = await import('./traps.js' + V);

export async function setup(S, env = {}) {
  const { anne, A, V3 } = S, C = common(S), { am } = C;
  const fire = S.tileC(...S.level.campfire);
  const bed = V3(fire.x - 1.7, 0, fire.z + 0.9), bedYaw = Math.atan2(fire.x - bed.x, fire.z - bed.z);      // where she sleeps, feet to the fire
  const has = (n) => A.hasClip && A.hasClip(n);
  const WIDE = bedYaw + 1.0;                           // the night's wide shot: from the side she faces in her sleep, the fire beside her
  // her hat lies beside her while she sleeps
  const hat = C.K.makeWitchHat(); S.scene.add(hat.obj);
  // (asleep she lies on her left side, her head away from the fire: `head` is where it points, `front` is the way she faces)
  const headDir = V3(-Math.sin(bedYaw), 0, -Math.cos(bedYaw)), frontDir = V3(Math.cos(bedYaw), 0, -Math.sin(bedYaw));
  hat.obj.position.set(bed.x + headDir.x * 0.85 - frontDir.x * 0.45, 0.03, bed.z + headDir.z * 0.85 - frontDir.z * 0.45); hat.obj.rotation.set(0.12, 1.1, -0.2);
  const hatOff = (off) => { if (A.setHat) A.setHat(!off); hat.obj.visible = !!off; };
  // She sleeps barefoot, as on the 2D sprite: her shoes stand in front of her, down by her feet.
  const shoes = [false, true].map((left, i) => {
    const g = new S.THREE.Group();
    if (A.heelProp) { const sh = A.heelProp.clone(true); sh.scale.set(left ? -1 : 1, 1, 1); sh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.add(sh); }
    g.position.set(bed.x - headDir.x * 0.5 + frontDir.x * (0.66 + i * 0.13), 0, bed.z - headDir.z * 0.5 + frontDir.z * (0.66 + i * 0.13));
    g.rotation.y = bedYaw + 0.5 + i * 0.3; g.visible = false; S.scene.add(g); return g;
  });
  const bare = (on) => { A.setHeelsWorn(!on); for (const g of shoes) g.visible = !!on; };
  const prevEnd = S.onSceneEnd; S.onSceneEnd = () => { bare(false); if (prevEnd) prevEnd(); };       // (however a scene ends, she walks off in her shoes)
  // one of the clips that play once: start it and wait for it to run out
  const once = async (name, then, fade = 0.15) => { if (!has(name)) { S.clip(then, 0.6); return; } S.clip(name, fade); await S.wait(Math.max(0.2, A.clipLength(name) - 0.12)); S.clip(then, 0.25); };

  async function nightBefore() {
    console.log('SCENE nightBefore');
    const stopSkip = C.introSkip(() => { S.flag('prologue', true); S.progress = Math.max(S.progress, 5); S.go('camp', [11, 6], 'west'); });      // (Esc twice: on to the morning)
    if (env.quiet) env.quiet(true);                    // (10-02: no music tonight: the fire, the crickets and the trees)
    S.setFade(1); S.setNight(1); S.objective('');
    S.place(bed, bedYaw); S.clip(has('CampSleep') ? 'CampSleep' : 'SitIdle', 0); S.expr('sleep'); hatOff(true); bare(true);
    C.amAt(V3(bed.x + headDir.x * 0.45 + frontDir.x * 0.75, 0.34, bed.z + headDir.z * 0.45 + frontDir.z * 0.75));      // he hovers in front of her face
    S.cam.at(V3((bed.x + fire.x) / 2, 0, (bed.z + fire.z) / 2), WIDE, { y: 0.45, pitch: 0.2, dist: 4.6, cut: true });
    await S.wait(0.8); await S.fade(0, 1.8);
    await S.emote(anne, 'zzz', 1.6, -0.6);
    await S.mark('night');
    await S.say('am', 8, "Hey you!! You're finally awake!");
    S.expr('tired'); await once('CampWake', has('CampSit') ? 'CampSit' : 'SitIdle');      // she rolls onto her back and pushes herself up
    await S.wait(0.3);
    S.cam.at(C.headPos(), bedYaw + 0.55, { y: C.headPos().y - 0.05, pitch: 0.06, dist: 2.3, fov: 38 });
    await S.say('am', 4, 'Seems like you were having quite the dream! Hehehe.');
    await S.say('a1', 17, 'Damn!\n\nIt was her again...');
    await S.say('am', 4, '....');
    await S.say('a1', 8, '... what?');
    await S.say('am', 4, 'Lilith again? She does love her games.');
    S.emote(anne, 'anger', 1.0, -0.5);
    await S.say('a1', 43, "It's not funny!");
    await S.say('am', 4, 'OOOhhh!!!\nIt is for me, sweetie!\nI showed her those tricks!');
    await S.say('a1', 43, 'Shut up!');
    await S.say('a2', 24, "Never thought a dream could tickle so bad...");
    await S.say('a1', 4, "Is it early yet?\nOh my...\nI hope not to go back there again...");
    await S.say('am', 0, "You're lucky to see her in your dreams.");
    await S.say('a1', 43, "Easy for you to say. You're not the one she plays with.");
    await S.say('a2', 35, "I feel so tired...\n\nI'd better get some more rest.");
    await S.mark('night2');
    await S.say('a1', 8, 'So after leaving the forest, what will\nour next move be?\nShould we head right to where Lilith is hiding?');
    S.cam.at(V3((bed.x + fire.x) / 2, 0, (bed.z + fire.z) / 2), WIDE, { y: 0.5, pitch: 0.16, dist: 4.0 });
    await S.say('am', 1, "It's north, though not on this continent.\nThere's an isolated island to the north-east.");
    await S.say('a1', 1, "Traveling to another land?\nOh my...\nWhat's there?");
    await S.say('am', 12, "I don't know much about that land,\njust that it was the hideout of the Sorcerer.\nHe used to summon Lilith there.");
    await S.say('am', 14, 'I remember how lonely those days were for me...');
    await S.say('a1', 4, "Wait a moment...\nThere's no island to the north...\nbut Amirian Island...");
    await S.say('am', 0, 'Yes.\nLilith is there.');
    S.emote(anne, 'sweat', 1.0, -0.5);
    await S.say('a2', 3, "Damn...\nI don't think we'll find a ship that will take us there.\nThat island is said to be cursed, haunted by evil mana...");
    await S.say('am', 0, 'The sorcerer is long gone.\nThe island has most likely been deserted\nfor some time.');
    await S.say('am', 8, "We should act quickly.\nLilith is probably planning on resurrecting\nthe sorcerer's empire.\nThe sooner we confront her, the better.");
    S.cam.at(C.headPos(), bedYaw + 0.55, { y: C.headPos().y - 0.05, pitch: 0.06, dist: 2.3, fov: 38 });
    await S.say('a1', 20, "Well...\n\nI guess there's no choice.");
    await S.say('am', 0, 'I cannot get a physical body in this world.\nIf I could, I would go to meet her.');
    await S.say('am', 6, "Just bring me there and I'll talk with my\nbeloved Empress.\nI bet she misses me so much.");
    await S.say('a2', 36, "Are you sure?\n\nShe didn't seem like that in your last\nlovers' tiff...");
    await S.say('am', 5, "Mind your tongue there, lady!\nYou're speaking with the Supreme Overlord\nof Mischief and Grandmaster of All Tickles!");
    await S.say('am', 15, "Next time we meet she'll be begging me\nto make her laugh again--\nHA HA HA HA HA!!!");
    await S.say('a1', 8, 'If you say so...');
    await S.say('a1', 1, "So, I bring you to Lilith's hideout,\nyou get her to remove my curse.\nWhat could possibly go wrong...");
    await S.say('am', 0, "Aye.\n\nIt's a fair deal to reward your help.");
    await S.say('a2', 21, 'Good night.');
    await S.say('am', 0, 'Want me to wake you up later?');
    await S.say('a2', 1, 'No...');
    await S.say('a2', 1, '... and keep your limbs away from me while\nI\'m sleeping!');
    await S.say('am', 4, '...Magic word?');
    S.emote(anne, 'anger', 1.0, -0.5);
    await S.say('a2', 4, 'PLEEEAASSEEEEEEE!!!!');
    await S.say('am', 3, 'You mortals are really boring,\naren\'t you?');
    S.cam.at(V3((bed.x + fire.x) / 2, 0, (bed.z + fire.z) / 2), WIDE, { y: 0.45, pitch: 0.2, dist: 4.6 });
    await once('CampLie', has('CampSleep') ? 'CampSleep' : 'SitIdle'); S.expr('sleep');
    await S.fade(1, 1.6);
    stopSkip(); await amaymonCard();
    S.progress = 5;
  }

  // who Amaymon is (the 2D's second scroll text, _AMAYMON), on black
  async function amaymonCard() {
    await S.card('', "I could not ask the Master Wizards for help after my mistake at the Academy,\nso I'm on my own with this annoying sack of wiggly limbs.\n\nAmaymon was in the Secret Library too. He's the reason Lilith didn't take me\nwith her, so... I owe him my life, somehow.\n\nHe came out of this dark glass ball, a magic artifact he uses like a peephole.\nHe cannot come through it: he can only make a few tentacles to crawl,\ngrab things, or bother me.\n\nEither way, he's the only one who gets Lilith angry, and that works for me:\nI have no other way to make her lift my curse.\n\nWe're heading North-East, following Lilith's track to her secret hideout.");
  }
  // (10-03) A new game opens with the 2D's own intro menu (CE 87 starts with it): from Lilith's prelude in the Tower
  // (story_library.js), from her memories, from the first night here, from Amaymon's introduction, or straight to the
  // start of the game (the morning).
  async function introMenu() {
    S.setFade(1); S.setNight(1); if (env.quiet) env.quiet(true);
    await S.wait(0.4);
    await S.say('', 0, 'Where would you like to begin?');
    const pick = await S.choice(["Lilith's prelude", 'Scroll introduction', 'First night campsite', "Amaymon's introduction", 'Start game']);
    if (pick === 0) { S.go('library', [4, 3], 'south'); await new Promise(() => {}); }
    S.flag('prologue', true);
    if (pick === 1) await C.memoryCards();
    if (pick <= 2) { await nightBefore(); await morningAfter(); return; }
    if (pick === 3) await amaymonCard();
    S.progress = Math.max(S.progress, 5); await morningAfter();
  }

  async function morningAfter() {
    S.setFade(1); S.setNight(0); hatOff(false); bare(false);
    const spot = V3(fire.x - 1.5, 0, fire.z + 1.3);
    S.place(spot, Math.atan2(fire.x - spot.x, fire.z - spot.z) + 0.5); S.clip('Idle', 0); S.expr('neutral'); C.amAt(null);
    S.cam.face(anne, { y: 1.3, dist: 3.4, turn: 0.55, pitch: 0.1, fov: 42, cut: true, focusK: 1.2 });
    await S.wait(0.5); await S.fade(0, 1.4);
    await S.mark('morning');
    await S.say('am', 0, 'Good morning, sleeping beauty!\nAre you up to go?');
    await S.say('a1', 0, 'Ready.');
    await lookRemark();
    await S.say('am', 0, 'By the way...\nDo you want to play a game?');
    S.emote(anne, 'question', 1.0);
    await S.say('a1', 6, 'What kind of game?');
    await S.say('am', 4, 'A funny game!');
    S.emote(anne, 'dots', 1.0);
    await S.say('a2', 36, 'WHAT\nKIND\nOF\nGAME?');
    await S.say('am', 1, "It's just a TUTORIAL, my cute apprentice...\n\nI've just decided you're worthy enough to\nlearn from my priceless knowledge.");
    await S.say('a2', 34, "Hey!\nI don't remember ever telling you I\nwanted to learn your tricks, you pesky overlord.");
    await S.say('am', 4, "Are you sure?\n\nThere's a prize for the lady if she wins!!");
    await S.say('a2', 1, "Sure, now you've got my attention...\n\nSo... what's the prize?");
    await S.say('am', 4, 'A kiss on your cheek!');
    await S.say('a2', 36, "Ooohh...\n\nAnd... what's going to happen if I lose?");
    await S.say('am', 4, 'Then I get to tickle your feet!');
    await S.say('a2', 36, 'May I exchange you for a nice toothbrush?', { keep: true });
    if (await S.choice(['Practice!', "Later, let's go!"]) === 0) await practice();
    await S.say('am', 1, "Remember!\nWhen you're lost, rest by a fire or a shrine\nand ask me.");
    await S.say('a1', 0, "Got it!\nShall we leave this forest and\nhead to Dawn Harbor.");
    S.progress = 10; if (env.quiet) env.quiet(false);
    S.objective('Leave the camp by the south trail.');
    S.toast('The log, the odd shoes and the pond to the north can wait... or not.', 'note', 4);
  }

  async function practice() {
    await S.say('am', 0, 'When things get dicey, a marker runs along a bar.\nPress SPACE while it is in the green!');
    let wins = 0;
    for (let i = 0; i < 3; i++) {
      const hit = await S.gauge({ sub: `Try ${i + 1} / 3`, width: 0.24 - 0.03 * i, speed: 0.7 + 0.12 * i });
      if (hit) { wins++; C.sparks.burst(C.headPos().add(V3(0, 0.3, 0)), new S.THREE.Color(1.6, 1.3, 0.4), 16, 1.2); S.expr('happy'); await S.say('am', i === 2 ? 6 : 0, ['Not bad, apprentice!', 'Again! You have the knack.', 'Flawless! I taught you well.'][i]); }
      else { S.expr('shocked', 0.4); S.emote(anne, 'exclaim', 0.9); await S.say('a2', 5, 'EEK--! Keep those limbs off my feet!!'); await S.say('am', 4, 'Hehehe... a miss is a miss.'); }
    }
    S.expr('neutral');
    if (wins === 3) await S.say('am', 13, 'Three out of three! The prize is yours:\n*smooch*');
    else if (wins === 0) await S.say('am', 2, 'Zero out of three...\nWe shall practise on the road, apprentice.');
  }

  // ---------- Amaymon's view of her shoes and her toenails (story_common.js lookTalk): in the morning, by the fire when
  //            she has changed them since he last said something, and as soon as she changes them here (Anne's look, L) ----------
  async function lookRemark() {
    const t = C.lookTalk('am'); S.flag('lookSeen', S.look ? S.look().key : '');
    let n = 0;
    const R = C.lookRemarks ? C.lookRemarks('am', 3) : [];      // (batch 22: and what he makes of the rest of her: her feet by her skin's tone, what she is or wears)
    // (10-05: the picture goes to her feet for what he says of her feet, her shoes and her toenails; not for what he makes of
    // her outfit or of what she is: R[0] is the remark on her feet, the others are not)
    const lines = t.lines.slice(); lines.splice(Math.max(1, lines.length - 1), 0, ...R.map((x, k) => ['am', 4, x, k ? { other: true } : { hers: true }]));
    for (const [sheet, i, text, o = {}] of lines) await S.say(sheet, i, text, Object.assign(o.other ? {} : o.hers ? { feet: true, feetView: n++ } : sheet === 'am' && t.lv > 0 ? { feet: true, feetView: n++ } : sheet === 'am' && !n++ ? { feet: true } : { noFeet: true }, o));
  }
  S.onLook = () => { if (S.progress >= 10 && !S.isActive()) S.run(lookRemark); };
  const lookChanged = () => !!S.look && S.state.flags.lookSeen !== S.look().key;

  // ---------- the camp's traps: the hole under the pile of leaves, the pumpkin (traps.js) ----------
  const traps = createTraps(S, C, env);

  // ---------- (10-03) the feather, and an evening's self-tickling by the fire (he asked: "like in the 2D game") ----------
  // The 2D: its feathers (Stiff Feather, Fluffy Quill, Fairy tickler) come from shops, and the fireplace's Rest menu has
  // "Relax ..." (CE170 SceneAnne, the pure feather sheet anne-solo-play-12): she chuckles, then strokes her own sole with
  // a feather, faster and faster, giggling, and every few seconds "Oh I love it! | Feels great! | ..." or
  // "Later... | Enough... | Stop it". Here the feather lies in the grass by the camp; once she has it, resting by the
  // fire offers it. (The 2D's lust-gauge gate and its other sheet's self-worship frames are not part of this game.)
  const THREE = S.THREE;
  function makeFeather() {                              // a white feather with a blush of pink at the tip: quill along +Y from 0, vane 0.05..0.33
    const g = new THREE.Group();
    const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0042, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0xece4d6 })); quill.position.y = 0.15; g.add(quill);
    const vane = new THREE.Shape(); vane.moveTo(0, 0.05); vane.bezierCurveTo(0.042, 0.1, 0.048, 0.22, 0.004, 0.33); vane.bezierCurveTo(-0.04, 0.24, -0.044, 0.1, 0, 0.05);
    const vg = new THREE.ShapeGeometry(vane, 12), P = vg.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const k = THREE.MathUtils.smoothstep(P.getY(i), 0.2, 0.33); col[i * 3] = 1.0; col[i * 3 + 1] = 0.97 - 0.32 * k; col[i * 3 + 2] = 0.97 - 0.18 * k; }
    vg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const vm = new THREE.Mesh(vg, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a2a30, side: THREE.DoubleSide })); vm.castShadow = true; g.add(vm);
    S.scene.add(g); return g;
  }
  // where it lies: the first open spot near the fire (not on the hole's pile, nor in the way of the tent)
  const FEATHER_AT = (() => {
    const T = S.TILE, ok = (x, z) => !env.walkAt || [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].every(([a, b]) => env.walkAt(Math.floor((x + a) / T), Math.floor((z + b) / T)));
    const hole = traps && traps.hole ? traps.hole.at : null;
    for (const [dx, dz] of [[1.9, -1.5], [-1.2, -1.9], [2.2, 0.6], [-2.4, -0.4], [0.4, -2.4]]) {
      const x = fire.x + dx, z = fire.z + dz;
      if (ok(x, z) && (!hole || Math.hypot(x - hole.x, z - hole.z) > 1.6)) return V3(x, 0, z);
    }
    return V3(fire.x + 1.9, 0, fire.z - 1.5);
  })();
  const lying = makeFeather(); lying.position.set(FEATHER_AT.x, 0.012, FEATHER_AT.z); lying.rotation.set(-Math.PI / 2 + 0.06, 0, 0.9); lying.visible = !S.flag('feather');
  S.actors.push({ update(dt, t) { if (lying.visible && Math.sin(t * 2.3) > 0.985) C.sparks.burst(V3(FEATHER_AT.x, 0.12, FEATHER_AT.z), new THREE.Color(1.6, 1.4, 1.5), 2, 0.25, 0.4); } });
  S.on({ id: 'feather', at: FEATHER_AT, r: 1.3, action: 'E — Pick up the feather', when: () => S.progress >= 10 && !S.flag('feather'), run: async () => {
    await S.turnTo(FEATHER_AT); S.cam.face(anne, { y: 1.35, dist: 2.4, turn: 0.4, cut: true });
    lying.visible = false; S.flag('feather', true); C.sparks.burst(V3(FEATHER_AT.x, 0.2, FEATHER_AT.z), new THREE.Color(1.6, 1.4, 1.5), 12, 0.8, 0.6);
    S.toast('Stiff Feather obtained!', 'success', 2.6);
    await S.say('a1', 7, "A feather? ...Ooh, it's so soft.\nThat could come in handy...", { expr: 'smile' });
    await S.say('a1', 0, '...for writing. Obviously.', { expr: 'smug' });
    await S.say('am', 2, 'Obviously, kitty.');
  } });

  // the scene: her shoes off and beside her, she sits by the fire with her right foot up and its sole to her (clips
  // FeatherSit / FeatherTickle / FeatherTickleHard, tools/anne2/poses.py); the feather runs from her right hand to her
  // sole (drawn each frame), its tip stroking heel to ball and back, faster each time she goes on
  const held = makeFeather(); held.visible = false;
  const FT = { on: false, t: 0, rate: 1, u: 0.5 };
  const wrist = anne.getObjectByName('wristR'), _w = V3(), _hd = V3(), _tp = V3(), _y = V3(), _z = V3(), _x = V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  S.late.push((dt) => {
    if (!FT.on || !wrist) { held.visible = false; return; }
    FT.t += dt * FT.rate; C.readFeet(dt);
    const f = C.feet[0];                                // her right foot (the one held up)
    wrist.getWorldPosition(_w); wrist.getWorldQuaternion(_q); _hd.set(0, 1, 0).applyQuaternion(_q);      // (the hand runs on along the wrist bone)
    const base = _w.addScaledVector(_hd, 0.075);
    FT.u = 0.12 + 0.76 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 0.75 * FT.t));
    C.along(f, FT.u, _tp).addScaledVector(f.side, 0.012 * Math.sin(FT.t * 5.1)).addScaledVector(f.n, 0.006);
    _y.subVectors(_tp, base); if (_y.lengthSq() < 1e-6) _y.copy(f.n).negate(); _y.normalize();
    _z.copy(f.side).addScaledVector(_y, -f.side.dot(_y)); if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1); _z.normalize(); _x.crossVectors(_y, _z);      // (the vane's flat side across her sole: it brushes, and shows to the side camera)
    _m.makeBasis(_x, _y, _z); held.quaternion.setFromRotationMatrix(_m);
    held.position.copy(_tp).addScaledVector(_y, -0.33); held.scale.set(1, 1, 1); held.visible = true;      // (its tip on her sole, the quill running back through her fingers)
  });
  const pickOne = (s) => { const a = s.split('|'); return a[Math.floor(Math.random() * a.length)]; };
  async function featherTime() {
    await S.fade(1, 0.5);
    // beside the fire, facing past it, so the camera at her front sees her face, her raised sole and the flames
    const at = V3(fire.x + 1.35, 0, fire.z - 0.75), yaw = Math.atan2(fire.x - at.x, fire.z - at.z) + 1.25;
    S.place(at, yaw); A.setHeelsWorn(false);
    const fw = V3(Math.sin(yaw), 0, Math.cos(yaw)), lf = V3(fw.z, 0, -fw.x);
    shoes.forEach((g, i) => { g.position.copy(at).addScaledVector(lf, 0.48 + 0.12 * i).addScaledVector(fw, -0.05 + 0.1 * i); g.rotation.set(0, yaw + 0.4 + 0.3 * i, 0); g.visible = true; });      // (her shoes stand beside her)
    S.clip(has('FeatherSit') ? 'FeatherSit' : 'SitIdle', 0); C.snapSoles(); FT.on = true; FT.t = 0; FT.rate = 0.5;
    for (let i = 0; i < 3; i++) await S.frame();
    const hd = C.headPos(), sole = V3().copy(C.feet[0].arch), mid = V3().lerpVectors(hd, sole, 0.5);
    S.cam.set(V3().copy(mid).addScaledVector(fw, 0.55).addScaledVector(lf, -1.3).setY(mid.y + 0.12), mid, { fov: 40, cut: true });      // (from her right side: her face, the raised sole in profile, the feather between them)
    S.expr('smile', 0.3); await S.fade(0, 0.8); await S.mark('feather0');
    S.voice('chuckle', 0.8); await S.wait(1.8);                                  // (idle: she chuckles)
    let n = 0;
    for (;;) {
      n++; const hard = n >= 3;
      S.clip(has('FeatherTickle') ? (hard ? 'FeatherTickleHard' : 'FeatherTickle') : 'SitIdle', 0.3); FT.rate = hard ? 2.3 : 1.1 + 0.35 * n;
      S.voiceLoop(hard ? 'laughter' : 'giggle', hard ? 2.4 : 3.0); S.expr(hard ? 'laughHard' : 'laugh', hard ? 0.75 : 0.45); S.toes(hard ? 0.4 : 0.25, hard ? 2.4 : 1.6, Infinity);
      if (n === 1) await S.mark('feather1'); await S.wait(3.2 + 2.2 * Math.random()); if (hard && n === 3) await S.mark('feather3');
      const pick = await S.choice([pickOne('Oh, I love it!|Feels great!|Again, again!!'), pickOne('Later...|Enough...|Okay, stop it!')]);
      if (pick === 1) break;
    }
    S.voiceLoop(null); S.toes(0); S.expr('happy', 0.4); FT.on = false; held.visible = false;
    await S.fade(1, 0.6);
    for (const g of shoes) g.visible = false;
    if (!S.flag('featherTime')) { S.flag('featherTime', true); S.toast("Anne's feather time unlocked!|A little feather time by the fire, any evening!", 'success', 3.0); }
    await traps.kit.putShoesOn({ force: true, at, yaw, expr: 'happy' });         // (and her shoes back on: it fades in itself)
  }

  // ---------- by the fire: ask Amaymon what to do ----------
  S.hint = async () => {
    if (S.progress < 15) {
      await S.say('am', 0, 'Take your time to explore the campsite and\nthe pond following the north path.');
      await S.say('am', 8, 'When you are ready, the south trail leads\ninto the North Forest and on to the main road.');
    } else if (S.progress < 20) await S.say('am', 0, 'We should take the path Southwest.\nThat will take us to the main road.');
    else await S.say('am', 12, "Find the Ivy Maidens' Nest and force Alraune\nto clean up the path.");
  };
  S.on({ id: 'fire', at: fire, r: 2.2, action: 'E — Rest by the fire', when: () => S.progress >= 10, run: async () => {
    S.cam.two(anne, fire, { y: 1.1, y2: 0.4, dist: 3.4, pitch: 0.16 });
    await S.turnTo(fire); if (lookChanged()) await lookRemark();
    const pick = S.flag('feather') ? await S.choice(['Ask Amaymon what to do', 'Relax with the feather...', 'Not now']) : 0;      // (10-03: with the feather, the 2D's "Relax ...")
    if (pick === 1) { await featherTime(); return; }
    if (pick === 2) return;
    await S.hint(); await S.say('a1', 0, 'Got it.');
  } });

  // ---------- the story starts by itself ----------
  // (10-02) A new game begins with the opening in the Tower of Wisdom (story_library.js), which comes back here for the
  // night before. Tests that start the camp themselves (?prog, ?hold, ?ev, ?noprologue) skip it.
  const q = new URLSearchParams(location.search), NO_PROLOGUE = ['noprologue', 'prog', 'hold', 'holdtext', 'ev'].some((k) => q.has(k));
  S.onArrive = (how) => {
    const fromPrologue = how === 'exit' && S.progress < 10 && S.flag('prologue');      // (back from the opening, or skipped on to the morning)
    if (how !== 'start' && !fromPrologue) return;
    if (S.progress < 1 && !S.flag('prologue') && !NO_PROLOGUE) { S.setFade(1); S.run(introMenu); return; }
    if (S.progress < 5) S.run(async () => { await nightBefore(); await morningAfter(); });
    else if (S.progress < 10) S.run(morningAfter);
    else if (!S.state.flags.goal) S.objective('Leave the camp by the south trail.');
  };
}
