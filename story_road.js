// story_road.js: the road out of the woods (the 2D game's Map 25 "DemoEndingLoop"), the last scene of Chapter 1
// (CommonEvent 107, label PARTY). Boudicca has joined: the two walk east along the road talking about the curse,
// until Anne remembers the Grimmoire, and finds it gone, with all their coin. Amaymon saw the thief ("She's gone
// south!!!") and did nothing ("I was distracted by the show!"): he is bonked twice. Then south, after her: the end
// of the chapter (in the 2D, the World Map and Chapter 2, "Dawn comes Slowly": here the road's east end leads on to it,
// the Trader Post: story_post.js).
// After the card she is free to walk the road with Boudicca a few steps behind her; west goes back to the clearing.
const V = new URL(import.meta.url).search;
const { common } = await import('./story_common.js' + V);
const { createBoudicca } = await import('./boudicca.js' + V);
const { createCaptures } = await import('./captures.js' + V);

export async function setup(S, env) {
  const { THREE, anne, V3 } = S, C = common(S);
  const bou = createBoudicca(S, C);
  const kit = createCaptures(S, C, env).kit;         // (10-03: only for her shoes going back on, after the glade)
  const PI = Math.PI, tc = (x, y) => S.tileC(x, y);
  S.late.push((dt, t) => bou.update(dt, t));
  const BO = { 0: 'smile', 1: 'smug', 2: 'happy', 3: 'smug', 4: 'neutral', 5: 'surprised', 6: 'angry', 7: 'worried', 8: 'smug', 9: 'happy', 10: 'smug', 11: 'laugh', 12: 'angry', 13: 'angry', 15: 'tired', 20: 'embarrassed' };
  const say = async (sh, i, text, o = {}) => {
    if (sh === 'bo') { bou.expr(BO[i] || 'smile'); bou.talk(true); }
    await S.say(sh, i, text, o);
    if (sh === 'bo') bou.talk(false);
  };
  const lines = async (L) => { for (const l of L) { if (typeof l === 'function') await l(); else await say(...l); } };
  const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;background:#fff'; document.body.appendChild(flashEl);
  const flash = async () => { flashEl.style.transition = 'opacity .05s'; flashEl.style.opacity = 0.7; await S.wait(0.07); flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = 0; };
  // Amaymon is bonked: the hammer, a white flash, and he is squashed flat for a moment
  async function bonk() {
    S.se('se_Hammer', 1.0, 0.6); flash(); S.emote(anne, 'anger', 1.0);
    const o = C.am.obj; let t = 0;
    await S.until((dt) => { t += dt; const k = Math.min(1, t / 0.7), sq = Math.sin(PI * k) * (1 - k * 0.3); o.scale.set(1 + 0.45 * sq, 1 - 0.55 * sq, 1 + 0.45 * sq); return k >= 1; });
    o.scale.set(1, 1, 1);
  }

  // ---------- walking east along the road while they talk (the 2D: she walks round and round its looping map) ----------
  // (one continuous walk at the clip's own pace, the camera tracking beside her, until the scene says stop)
  let walking = false;
  function walkOn() {
    walking = true; anne.rotation.y = PI / 2; S.clip('Walk', 0.3);
    return S.until((dt) => {
      if (!walking || anne.position.x > tc(44, 0).x) { walking = false; return true; }
      anne.position.x += 1.52 * dt;
      S.cam.set(V3(anne.position.x + 0.3, 1.8, anne.position.z + 4.4), V3(anne.position.x - 0.45, 1.0, anne.position.z), { fov: 44, rate: 2.0 });      // (both of them in the picture)
      return false;
    });
  }

  async function party() {
    S.setFade(1);
    S.place(tc(5, 8), PI / 2); S.clip('Idle', 0);
    // (10-05: at Anne's own pace, 1.52 m/s: at 1.3 she fell behind as they walked and talked, and ran to catch up every twelve seconds)
    bou.show(V3(tc(5, 8).x - 1.6, 0, tc(5, 8).z), PI / 2); bou.follow(() => anne.position, 1.3, 1.52); S.party = { boudicca: bou };      // (S.party: who walks with her: the foot cam offers Boudicca's feet too)
    S.cam.set(V3(anne.position.x + 0.3, 1.8, anne.position.z + 4.4), V3(anne.position.x - 0.45, 1.0, anne.position.z), { fov: 44, cut: true });
    S.flag('boudicca', true);
    await S.wait(0.6);
    // (10-03) her shoes came off in the glade: by the roadside she slips them back on, Boudicca waiting; then black again
    await kit.putShoesOn({ force: true, at: tc(5, 8), yaw: PI / 2, expr: 'tired' });
    await S.wait(0.4); await S.fade(1, 0.7);
    S.place(tc(5, 8), PI / 2); S.clip('Idle', 0); S.cam.set(V3(anne.position.x + 0.3, 1.8, anne.position.z + 4.4), V3(anne.position.x - 0.45, 1.0, anne.position.z), { fov: 44, cut: true });
    await S.wait(0.3); await S.mark('road');
    await say('a1', 22, "Honestly ... I don't understand exactly\nwhat happened before,\nbut I'd rather talk and hear nothing\nabout that from now on...");
    await say('bo', 1, 'Shame ♥');
    if (C.lookLines) await say('bo', 2, C.lookLines('bo').back);      // (10-03: she has an eye on them still)
    const w = walkOn();
    await S.fade(0, 1.0);
    await lines([
      ['a1', 6, "Never though I'd find help for this business.\nI thought I was the only one."],
      ['a1', 7, 'have you been visited by her too?\nin your dreams, I mean?'],
      ['bo', 4, "Hmmm ... yes .. but let's say...\nI'd rather not to talk about that ..."],
      ['bo', 5, "Although if we've been cursed ...\nI've been thinking, we may be not the only\npeople being visited each night, don't you think?\n... and we may not be alone looking for a cure..."],
      ['a1', 6, "Aye, joining forces will make more sense\nto face Lilith.\nOnce we reach the city, we should look for other\ncompanions. We'll need all the help we can get."],
      ['bo', 1, '... and a good plan ...\n\nWhat about that book?'],
      ['a1', 0, 'Ohh!! The Grimmoire of Conjuration!!\nI can research on it a way to subjugate\nthe demoness and return her to ...'],
    ]);
    // she stops dead, and whirls round
    walking = false; await w; S.clip('Idle', 0.2);
    await S.emote(anne, 'exclaim', 0.9); S.progress = 40;
    await S.turnTo(V3(anne.position.x - 3, 0, anne.position.z), 0.2); S.emote(anne, 'exclaim', 0.9);
    S.cam.face(anne, { dist: 2.4, turn: 0.4, y: 1.45 }); await S.mark('stop');
    await lines([
      ['a2', 5, "Wait ...\nWHAT THE HELL!!!\nWHERE'S THE GRIMMOIRE????"],
      ['am', 12, "It's gone..."],
      ['a2', 6, 'WHAT?'],
      ['am', 0, 'Somebody stole it...'],
      () => { S.emote(anne, 'exclaim', 0.9); },
      ['a2', 5, "OMGGG!!!\nWe've been stolen the Grimmoire of Conjuration!!!"],
      ['a2', 4, 'And all our money!!'],
      () => { S.emote(anne, 'anger', 1.0); },
      ['a2', 4, "WHY ON EARTH DIDN'T YOU SAY ANYTHING?!?!"],
      ['am', 4, 'I was distracted by the show !'],
      () => { S.emote(anne, 'anger', 1.0); },
      ['a2', 5, 'COME OOOOOOOON!!!'],
      () => { S.cam.two(anne, bou.obj, { dist: 2.2, y: 1.4 }); S.emote(bou.obj, 'exclaim', 0.9); },
      ['bo', 13, 'WAIT!!\n!!\nWho is that?!?!?!'],
      ['a1', 43, 'You mean Amaymon?!?!??!\na pretty useless pain in m--'],
      ['am', 5, "SHOW MORE RESPECT, LADY!!\nI'M A FEARSOME ARCH-DEMON!!"],
      ['a2', 36, 'Ah yes!! BLAH BLAH BLAH ... here he comes again!\nA ball with some noddles coming out of it ...\nsorry, "tentacles" ...'],
      ['bo', 9, 'OH MY!!\nSo you have a Pocket-Demon-God!!'],
      ['am', 5, "This isn't my true form you moron."],
      ['bo', 10, "Amazing!\nSo, you're her pet, yes?"],
      ['bo', 2, 'Did you buy this little guy at the\nTower of Wisdom?'],
      ['am', 5, "If I showed you what I really looked like\nyou'd probably faint from fear."],
      ['bo', 3, 'OH HOW CUTE!!!\nLook at those cute tentacles wiggling!'],
      ['am', 5, 'You little-'],
      () => S.mark('bonk'),
      () => bonk(),
      () => S.cam.face(anne, { dist: 2.4, turn: 0.4, y: 1.45 }),
      ['a2', 4, 'Can we get back to the issue at hand here?\nThe freaking grimoire is gone!'],
      ['am', 9, "Don't stress you, girls.\nI can track down the Grimmoire.\nIt doesn't matter how far away it is,\nI can smell the aura it gives off."],
      ['a2', 35, 'oh, really?\nWell, tell me this "oh wise" one,\nwhere is the thief now?'],
      ['am', 8, "\nShe's gone south!!!"],
      ['a2', 36, 'Whait there!\n\nSHE? ...'],
      ['a1', 47, "So you've even seen the thief ...\n\nBut you didn't alert us at all, did you?"],
      ['am', 4, "What can I say?\nBoudicca is very good with those fingers of hers!\nI couln't help but enjoy the show!\n♥♥♥"],
      () => S.cam.two(anne, bou.obj, { dist: 2.2, y: 1.4 }),
      ['bo', 1, 'Well, look at it!\nI can even get along with the pocket-god,\nhihi...'],
      ['a2', 34, "...You both don't look terribly concerned\nabout the situation, guys..."],
      ['bo', 8, 'If "she" has indeed gone south...\nShe\'s most likely heading for Valyndra City,\nso we\'ll need to make our way\nthrough the Forest of Lys'],
      ['am', 5, 'ALLRIGHT, GIRLS!!!\nSHALL WE MOVE SOUTH THEN!\nThe great Amaymon leads the way!!'],
      ['am', 15, 'HA HA HA HA HA HA HA HA HA HA...'],
      () => bonk(),
      () => S.wait(1.0),
      ['am', 10, "hey what's wrong now?"],
      () => S.cam.face(anne, { dist: 2.3, turn: 0.4, y: 1.45 }),
      ['a2', 4, "You talk far too much you braggart!!!\nThis waste of time is your fault!!\nYou didn't say anything about the thief when\nyou had the chance, you useless ball of tentacles!!!"],
      ['am', 17, '...'],
      ['a2', 2, 'I COMMAND, AND I GIVE ORDERS HERE!'],
      () => S.cam.two(anne, bou.obj, { dist: 2.2, y: 1.4 }),
      ['bo', 1, 'So...\n\nshall we go south, then?'],
      ['a2', 1, '... YES. LET\'S GO SOUTH!!'],
    ]);
    S.toast('Quest complete: Leave the forest', 'success', 2.6); await S.wait(0.7);
    await S.turnTo(V3(anne.position.x + 3, 0, anne.position.z), 0.2);
    S.cam.set(V3(anne.position.x + 1.0, 1.9, anne.position.z + 4.6), V3(anne.position.x + 3.5, 1.0, anne.position.z), { fov: 46, rate: 1.4 });
    const end = S.walk([V3(anne.position.x + 8, 0, anne.position.z)], { speed: 1.4 });
    await S.wait(2.4); await S.fade(1, 1.2); await end;
    S.progress = 100;
    await S.card('Chapter 1 - The journey begins: complete', 'Great!\nFor a moment I\'d thought we\'d stay in that forest forever!\n\nChapter 2 - Dawn comes Slowly\nA thief stole the Grimmoire of Conjuration.\nI won\'t ever be able to confront Lilith without the book!\n\nTravel south through the Forest of Lys\nto Valyndra City.', 'Press SPACE to keep walking');
    S.objective('Chapter 2: follow the road east to the Trader Post, then south through the Forest of Lys.');
    S.cam.behind(anne, { cut: true, dist: 5 });
    await S.fade(0, 0.8);
  }

  if (!(S.progress >= 37 && S.progress < 100) && S.flag('boudicca')) {
    const p = anne.position.clone().addScaledVector(V3(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y)), -1.3);
    bou.show(p, anne.rotation.y); bou.follow(() => anne.position, 1.5, 1.4); S.party = { boudicca: bou };
  }
  // (10-05) the end of the road: on to the Trader Post and Chapter 2 (the level's east exit; it was a card saying "not built yet")
  S.blockExit = () => S.progress < 100;
  S.hint = async () => { await say('am', 0, 'South, after that thief!\nThe road runs on east to the Trader Post.\nWest goes back to the clearing.'); };
  S.onArrive = () => { C.checkpoint(); if (S.progress >= 37 && S.progress < 100) S.run(party);
    // (10-05: a game saved when Chapter 2 was "not built yet" still says so: it is built now)
    else if (S.progress >= 100 && S.progress < 105 && /not built/.test(S.state.flags.goal || '')) S.objective('Chapter 2: follow the road east to the Trader Post, then south through the Forest of Lys.'); };
  // (10-03) walking the road with her, Boudicca remarks on whatever Anne changes her shoes or toenails to (Anne's look, L)
  S.onLook = () => {
    if (!S.flag('boudicca') || S.isActive() || !C.lookLines) return;
    S.run(async () => { const L = C.lookLines('bo'); await say('bo', 1, L.shoe, { feet: true }); await say('bo', 9, L.nail, { feet: true }); await say('a2', 34, 'Eyes on the road, Boudicca.', { expr: 'pout' }); });
  };
  if (typeof window !== 'undefined') window.__road = { bou };
}
