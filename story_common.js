// story_common.js: what every area's story script shares: Amaymon as a floating companion who pops out whenever he
// speaks, sparkles, where Anne's head and soles are, and checkpoints.
const V = new URL(import.meta.url).search;      // this file's own ?v=..., passed on so that no stale copy of what it imports is used
const { createActors } = await import('./actors.js' + V);

export function common(S) {
  const { THREE, scene, anne, A, V3 } = S;
  const K = createActors(THREE);
  S.actors.push({ update(dt, t) { K.time.value = t; } });

  // ---------- where things on her are ----------
  const marker = {}; const mk = (name) => marker[name] || (marker[name] = anne.getObjectByName(name));
  const headPos = (out = V3()) => { const m = mk('Marker_Head'); if (m) m.getWorldPosition(out); else out.set(anne.position.x, 1.55, anne.position.z); return out; };
  // which way her face looks (world): the model's own forward, carried by her head bone
  let headBone = null, headLocal = null;
  const headFwd = (out = V3()) => {
    if (headBone === null) {
      headBone = anne.getObjectByName('head') || false; headLocal = V3(0, 0, 1);
      if (headBone) anne.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && headLocal.z === 1) { const i = o.skeleton.bones.indexOf(headBone); if (i >= 0) headLocal.set(0, 0, 1).transformDirection(o.skeleton.boneInverses[i]); } });
    }
    if (!headBone) return out.set(Math.sin(anne.rotation.y), 0, Math.cos(anne.rotation.y));
    return out.copy(headLocal).transformDirection(headBone.matrixWorld);
  };
  // one sole: heel, arch and ball points, the direction the sole faces (out of the foot) and the outward side
  const sole = (side, o = {}) => {
    o.heel = (o.heel || V3()); o.arch = (o.arch || V3()); o.ball = (o.ball || V3()); o.n = (o.n || V3());
    for (const [k, nm] of [['heel', 'Heel'], ['arch', 'Arch'], ['ball', 'Ball'], ['n', 'Out']]) { const m = mk(`Marker_Sole_${side}_${nm}`); if (m) m.getWorldPosition(o[k]); }
    o.n.sub(o.arch).normalize();
    return o;
  };

  // The soles as a scene needs them (after logscene.js's readFeet): for each foot, this frame's heel, arch and ball
  // points, the direction the sole faces (n), heel-to-toes (fwd), across (side) and the foot's outer side (lat); and
  // a smoothed copy (sArch, sn) for cameras, so a kicking foot does not shake the picture. Call readFeet from S.late.
  const feet = ['R', 'L'].map((sd) => {
    const f = { s: sd, mk: ['Heel', 'Arch', 'Ball', 'Out'].map((p) => anne.getObjectByName(`Marker_Sole_${sd}_${p}`)),
      heel: V3(), arch: V3(), ball: V3(), out: V3(), n: V3(0, 0, 1), fwd: V3(0, 1, 0), side: V3(1, 0, 0), lat: V3(1, 0, 0),
      m1: [V3(), V3(), V3(), V3()], sHeel: V3(), sArch: V3(), sBall: V3(), sOutM: V3(), sn: V3(0, 0, 1),
      shin: anne.getObjectByName('lowerleg02' + sd), foot: anne.getObjectByName('foot' + sd) };
    f.real = [f.heel, f.arch, f.ball, f.out]; f.sm = [f.sHeel, f.sArch, f.sBall, f.sOutM];
    return f;
  });
  let snapFeet = true; const _fa = V3();
  function readFeet(dt) {
    anne.updateMatrixWorld(true);
    const k = snapFeet ? 1 : 1 - Math.exp(-3 * dt); snapFeet = false;
    for (const f of feet) {
      for (let i = 0; i < 4; i++) { if (f.mk[i]) f.mk[i].getWorldPosition(f.real[i]); f.m1[i].lerp(f.real[i], k); f.sm[i].lerp(f.m1[i], k); }
      f.n.subVectors(f.out, f.arch); if (f.n.lengthSq() < 1e-10) f.n.set(0, 0, 1); f.n.normalize();
      f.fwd.subVectors(f.ball, f.heel); f.fwd.addScaledVector(f.n, -f.fwd.dot(f.n)).normalize();
      f.side.crossVectors(f.n, f.fwd);
      f.sn.subVectors(f.sOutM, f.sArch); if (f.sn.lengthSq() < 1e-10) f.sn.set(0, 0, 1); f.sn.normalize();
    }
    _fa.subVectors(feet[0].arch, feet[1].arch); if (_fa.lengthSq() < 1e-8) _fa.set(1, 0, 0); _fa.normalize();
    feet[0].lat.copy(_fa); feet[1].lat.copy(_fa).negate();
  }
  // a point of the sole's centre line: u = 0 heel, 0.5 arch, 1 ball (it runs on past the ball to the toes: u up to 1.35)
  const along = (f, u, out) => out.copy(f.heel).multiplyScalar((1 - u) * (1 - 2 * u)).addScaledVector(f.arch, 4 * u * (1 - u)).addScaledVector(f.ball, u * (2 * u - 1));
  // put an object at `base`, its +Y along `dir` (unit) and its +Z turned towards `face`
  const _ox = V3(), _oz = V3(), _om = new THREE.Matrix4();
  function orient(obj, base, dir, face) {
    _oz.copy(face).addScaledVector(dir, -face.dot(dir)); if (_oz.lengthSq() < 1e-8) _oz.set(0, 1, 0); _oz.normalize();
    _ox.crossVectors(dir, _oz); obj.quaternion.setFromRotationMatrix(_om.makeBasis(_ox, dir, _oz)); obj.position.copy(base);
  }

  // ---------- Amaymon ----------
  const am = K.makeAmaymon(); scene.add(am.obj); S.actors.push(am);
  const _h = V3(), _p = V3();
  let amSpot = null;                               // a fixed place for him in this scene (else he floats at her shoulder)
  // He floats at one of her shoulders, or behind and above her: whichever the camera sees furthest to the side of her
  // head (so he never hangs in front of her face, and never hides behind her hat).
  const SPOTS = [[-0.46, 0.16, -0.28], [0.46, 0.16, -0.28], [0, -0.5, 0.12]];      // [to her left (+) / right (-), forward, up from her head]
  let amIdx = 0;
  function amShow() {
    if (amSpot) { am.hover(amSpot, headPos(_h)); return; }
    headPos(_h); const yaw = anne.rotation.y, cam = S.camera.position;
    const vx = _h.x - cam.x, vz = _h.z - cam.z, vl = Math.hypot(vx, vz) || 1;
    let best = amIdx, bs = -1e9;
    SPOTS.forEach(([sx, f, up], i) => {
      const x = _h.x + Math.cos(yaw) * sx + Math.sin(yaw) * f, z = _h.z - Math.sin(yaw) * sx + Math.cos(yaw) * f;      // (about her head, wherever a pose has put it)
      const side = Math.abs((x - cam.x) * vz - (z - cam.z) * vx) / vl + (i === amIdx ? 0.12 : 0) - (i === 2 ? 0.1 : 0);      // how far to the side of her head he would be, as the camera sees it
      if (side > bs) { bs = side; best = i; }
    });
    amIdx = best;
    const [sx, f, up] = SPOTS[best];
    _p.set(_h.x + Math.cos(yaw) * sx + Math.sin(yaw) * f, Math.max(0.25, _h.y + up), _h.z - Math.sin(yaw) * sx + Math.cos(yaw) * f);
    am.hover(_p, _h);
  }
  S.onSpeak = (sheet, on) => { if (sheet === 'am') { amShow(); if (on) am.talk(); } };
  S.actors.push({ update() { if (am.obj.visible && !amSpot && S.isActive()) amShow(); } });
  const prevEnd = S.onSceneEnd;
  S.onSceneEnd = () => { am.hide(); amSpot = null; if (prevEnd) prevEnd(); };

  // ---------- sparkles ----------
  const sparks = K.makeSparks(); scene.add(sparks.obj); S.actors.push(sparks);

  // ---------- checkpoints: where she comes round if the vines get the better of her ----------
  let check = { x: anne.position.x, z: anne.position.z, yaw: anne.rotation.y };
  const checkpoint = () => { check = { x: anne.position.x, z: anne.position.z, yaw: anne.rotation.y }; };
  const toCheckpoint = () => { anne.position.set(check.x, 0, check.z); anne.rotation.set(0, check.yaw, 0); };

  // ---------- what they make of her shoes and her toenails (the look she chose: "Anne's look") ----------
  // How much of her feet a pair shows: 3 flip-flops, slides, toe-posts; 2 strappy and T-strap sandals; 1 open-toe heels;
  // 0 closed-toe heels. Alraune, who adores feet, is the more delighted the more she can see, and put out by closed
  // shoes; Amaymon has his own opinion. Each returns lines [sheet, face, text, { expr, al: [expr, clip], feet }].
  const SHOW = { flipflop: 3, slide: 3, toeloop: 3, cross: 3, geta: 3, sandal: 2, tstrap: 2, gladiator: 2, heels: 1, wedges: 1, pumps: 0, flats: 0, mules: 0 };      // (10-03: five more kinds)
  const NOUN = { flipflop: 'flip-flops', slide: 'slides', toeloop: 'toe-posts', cross: 'slides', sandal: 'sandals', tstrap: 'T-straps', gladiator: 'gladiators', heels: 'heels', wedges: 'wedges', pumps: 'heels', flats: 'flats', mules: 'mules', geta: 'geta' };
  const look = () => Object.assign({ style: 'sandal', label: 'Strappy sandals', shoe: 'purple', nail: 'purple' }, (S.look && S.look()) || {});
  const cap1 = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const hue = (n, map) => { for (const [re, w] of map) if (re.test(n)) return w; return map[map.length - 1][1]; };
  // (10-03) the colour families, in the order they are tried (shades before the plain colour), and what each speaker
  // likens them to: one word list per speaker, in this order (index.html NAILS: Purple, Light purple, Dark red, ...)
  const NAIL_FAM = [/dark red/, /red/, /hot pink/, /light pink/, /pink/, /dark purple/, /light purple/, /purple/, /orange/, /yellow/, /gold/,
    /light green/, /green/, /teal/, /light blue/, /dark blue/, /blue/, /black/, /white/, /silver/, /./];
  const fam = (words) => NAIL_FAM.map((re, i) => [re, words[i]]);
  const NAIL_AL = fam(['like ripe cherries', 'like little ripe berries', 'like my brightest blossoms', 'like cherry blossoms', 'like rosebuds', 'like the plums in my garden',
    'like lavender', 'the very colour of my petals', 'like ripe fruit', 'like buttercups', 'like drops of honey', 'like fresh new shoots', 'the very colour of my vines',
    'like a forest pool', 'like the morning sky', 'like the night sky', 'like bluebells', 'as dark as my deepest roots', 'like little pearls', 'like moonlight on the water', 'so pretty']);
  const NAIL_AM = fam(['very dramatic', 'fiery, like your temper', 'loud, like you', 'very sweet', 'very cute', 'very mysterious', 'very dainty', 'very regal', 'very zesty',
    'very sunny', 'fancy!', 'very fresh', 'very... foresty', 'very fancy', 'cool as ice', 'very moody', 'very cool', 'dark and dangerous', 'very classy', 'shiny! I approve', 'lovely']);
  // (10-03) the Ivy Maidens, Boudicca and Alraune in her nest have their say too (he asked): a line on the shoes she
  // wears and one on her toenail colour. ivy: [sheet 'ivy', face 1 (grin) or 2 (open)]; bo: Boudicca's faces; alNest:
  // Alraune again, in her nest (and if the shoes are not the ones she saw in the forest, she notices).
  const NAIL_IVY = fam(['like ripe cherries', 'like wild berries', 'like foxglove flowers', 'like cherry blossoms', 'like apple blossom', 'like elderberries', 'like lavender',
    'like little violets', 'like marigolds', 'like buttercups', 'like honeycomb', 'like fresh moss', 'the colour of our leaves', 'like a forest pool', 'like forget-me-nots',
    'like the night sky', 'like bluebells', 'like nightshade berries', 'like morning dew', 'like moonlight', 'so pretty']);
  const NAIL_BO = fam(['ooh, very wicked', 'fiery! I like it', 'bright as candy, missy', 'sweet as sugar', 'cute as a button', 'dark and witchy', 'so dainty, darling', 'very witchy',
    'like a sunset', 'bright as sunshine', 'fancy, missy', 'fresh as spring', 'green as a frog', 'like a mermaid', 'cool as a mountain stream', 'deep as the night', 'blue as the sky',
    'ooh, dark and dangerous', 'very ladylike', 'shiny as a coin', 'lovely']);
  // (bare: her shoes are already off when the line is said, so even closed heels have shown her toes)
  function lookLines(who, bare = false) {
    const L = look(), lv = SHOW[L.style] ?? 2, c = L.shoe || 'pretty', Cc = cap1(c), nail = L.nail || 'painted', hid = lv === 0 && !bare;
    if (who === 'ivy') return { lv,
      shoe: { flipflop: `Ooh, ${c} flip-flops, sisters!\nThose little piggies are barely hidden at all!`, slide: `Slides! One ${c} strap...\nand all ten piggies out to play!`,
        toeloop: `A ${c} loop round each big toe...\nlike a ribbon on a present, sisters!`, sandal: `So many ${c} straps, so many little gaps...\nour vines will find every one!`,
        tstrap: `${Cc} T-straps! So proper...\nand yet those toes are wiggling at us!`, heels: `${Cc} heels! Up on her tippy toes, sisters...\nthose soles all stretched out for us!`,
        pumps: `${Cc} closed heels... those piggies are hiding\nin a shiny little box, sisters!`,
        gladiator: `${Cc} gladiator sandals, sisters!\nAll those straps... like little vines of her own!`, cross: `Two ${c} straps, crossed like a little bow...\nand every piggy out to play, sisters!`,
        wedges: `${Cc} wedges! Up on a little hill of her own...\nthose arches stretched out for us, sisters!`, flats: `Little ${c} flats... every piggy tucked away\nlike seeds in a pod, sisters!`,
        mules: `${Cc} mules! The piggies are hiding, sisters...\nbut those heels are all bare at the back!`,
        geta: `Wooden sandals on two little stilts, sisters!\nClip, clop... and every piggy out to play!` }[L.style] || 'Do these beautiful piggies deserve our attention?',
      nail: hid ? 'What colour are they in there, sisters?\nWe shall have to look!' : `And her toenails are painted ${nail}, sisters...\n${hue(nail, NAIL_IVY)}!`,
      tamed: `Such pretty toes, mistress...\n${nail === 'painted' ? 'and so nicely painted' : nail + ', ' + hue(nail, NAIL_IVY)}!` };
    if (who === 'bo') return { lv,
      shoe: { flipflop: `${Cc} flip-flops, brat? Out here?\nYou practically walked those feet over to me!`, slide: `Slides! One ${c} strap between me\nand those soles... how thoughtful, missy!`,
        toeloop: `Toe-posts! A little ${c} loop for each big toe...\nI could flick them right off!`, sandal: `Strappy ${c} sandals... I can count every one\nof those wiggly toes from here!`,
        tstrap: `${Cc} T-straps, very prim, darling...\nand still all ten toes on show!`, heels: `${Cc} heels, like back in the tower...\nI remember you dangling those, darling!`,
        pumps: `Closed ${c} heels? Hiding them from me, brat?\nI'll have those off you soon enough!`,
        gladiator: `${Cc} gladiator sandals, brat? Strapped up\nlike a little warrior... I'll unbuckle every one!`, cross: `Crossed ${c} straps, missy? Tied up like a present...\nand those toes all hanging out!`,
        wedges: `${Cc} wedges out here, darling? Up on your perch...\nI can see those arches from here!`, flats: `Little ${c} flats? Hiding every toe from me, brat?\nI'll have those off you soon enough!`,
        mules: `${Cc} mules, missy? Toes tucked away...\nbut you left the back door open on those heels!`,
        geta: `Wooden geta, missy? Clip-clop, clip-clop...\nI heard those toes coming a mile off!` }[L.style] || 'Such pretty shoes, brat...',
      nail: hid ? "And I'll bet those toes in there are painted\nsomething cute. I'll find out, missy!" : `And ${nail} toenails... ${hue(nail, NAIL_BO)}!\nJust look at those toes wiggle!`,
      back: `Back in those ${c} ${NOUN[L.style] || 'shoes'} already, brat?\nShame... I was getting used to those bare toes!` };
    // alNest: Alraune, in her nest (she saw the shoes once already, in the forest: S.flag('alLook'))
    const pair = (k) => String(k || '').split('|').slice(0, 2).join('|'), seen = S.state && S.state.flags ? S.state.flags.alLook : '';
    const noun = NOUN[L.style] || 'shoes';
    if (seen && pair(seen) !== pair(L.key)) return { lv,      // (not what she wore in the forest)
      shoe: `New ${c} ${noun} since the forest, darling?\n` + ['All wrapped up again... I do love unwrapping.', 'And your toes still peeking out... cheeky!', 'All those little gaps for my vines... delightful!', 'Even less in my way... you DO want to be tickled!'][lv],
      nail: hid ? "I still don't know what colour those toes are...\nbut I will, darling. I will." : `Those ${nail} toes...\n${hue(nail, NAIL_AL)}! I've thought of nothing else\nsince the forest!` };
    return { lv,
      shoe: ({ flipflop: `Still in those ${c} flip-flops?\nYou came all this way to be tickled, didn't you?`, slide: `Those ${c} slides again!\nMy children will have them off in a heartbeat.`,
        toeloop: `Toe-posts! Such a sweet little loop...\nmy vines will tie a bow on it!`, sandal: `Strappy ${c} sandals, here in my nest...\nmy little ones are already giggling!`,
        tstrap: `T-straps in my garden, darling?\nSo proper... and so very easy to unbuckle.`, heels: `Heels? In my nest?\nYou must want me to see those arches, darling!`,
        pumps: `Still hiding those toes in closed ${c} heels?\nIn MY nest, presents get unwrapped, darling.`,
        gladiator: `Gladiator sandals, here in my nest?\nAll those straps... my vines know a hundred more knots, darling.`, cross: `Those crossed ${c} straps again!\nLike a ribbon on a gift... and I do love untying ribbons.`,
        wedges: `Wedges? In my nest?\nUp on your little pedestal, arches on show... how thoughtful, darling!`, flats: `Still hiding those toes in little ${c} flats?\nIn MY nest, presents get unwrapped, darling.`,
        mules: `Mules, darling? Toes hidden...\nbut those bare heels are peeking out at me. Cheeky!`,
        geta: `Those little wooden stilts again, darling!\nClip, clop, straight into my nest... how thoughtful.` }[L.style] || 'Such lovely little feet...'),
      nail: hid ? "I still don't know what colour those toes are...\nbut I will, darling. I will." : `Those ${nail} toes...\n${hue(nail, NAIL_AL)}! I've thought of nothing else\nsince the forest!` };
  }
  function lookTalk(who) {
    const L = look(), lv = SHOW[L.style] ?? 2, c = L.shoe || 'pretty', Cc = cap1(c), nail = L.nail || 'painted';
    if (who === 'al') {
      const shoe = {
        flipflop: `OHHH!! ${Cc} flip-flops!!\nThose pretty feet are practically BARE\nalready, darling!!`,
        slide: `Slides!! Just one ${c} strap between\nmy vines and those lovely soles!!`,
        toeloop: `A little ${c} loop round the big toe,\nand nothing else? You spoil me, darling!!`,
        sandal: `Strappy ${c} sandals... so many little gaps\nfor my vines to slip through!`,
        tstrap: `${Cc} T-straps... how very proper.\nAnd yet those toes are all out on show!`,
        heels: `${Cc} high heels, how elegant...\nand those toes peeking out at the front.\nCheeky!`,
        pumps: `Hmph... closed ${c} heels?\nYou've wrapped those feet up like a present\nI'm not allowed to open, darling...`,
        gladiator: `${Cc} gladiator sandals... strapped all the way up!\nSo many little windows for my vines, darling!`,
        cross: `Two crossed ${c} straps and nothing else?!\nThose pretty toes are simply BEGGING for it,\ndarling!!`,
        wedges: `${Cc} wedges, how charming...\nthose arches lifted up like an offering,\nand the toes peeking out in front!`,
        flats: `Hmph... little ${c} flats?\nEvery toe tucked out of sight...\nyou are no fun at all, darling...`,
        mules: `Hmph... ${c} mules? You hide the toes\nand show me only your heels...\nwhat a tease you are, darling.`,
        geta: `OHHH!! Little wooden sandals, with a ${c} thong!!\nThose pretty feet set out on a tray for me,\ndarling!!`,
      }[L.style] || `Such ticklish little feet, tucked away\nin such pretty shoes...`;
      if (lv === 0) return { lv, lines: [
        ['al', 4, shoe, { feet: true, al: ['pout', 'Idle'] }],
        ['al', 4, "And I can't even see what colour\nyou've painted the toes in there..."],
        ['a1', 7, "Good. That's exactly why I wear them.", { expr: 'smug' }],
        ['al', 2, 'No matter, darling.\nPresents are made for unwrapping.', { al: ['smug', 'Idle'] }]] };
      const more = lv === 3 ? 'I want them all for myself!!' : lv === 2 ? 'Delightful!' : 'How lovely.';
      return { lv, lines: [
        ['al', lv === 3 ? 10 : 3, shoe, { feet: true, al: [lv >= 2 ? 'happy' : 'smile', lv === 3 ? 'Delight' : 'Idle'] }],
        ['al', lv === 3 ? 10 : 3, `And those toenails, painted ${nail}...\n${hue(nail, NAIL_AL)}!\n${more}`, { feet: true, toes: true, al: [lv === 3 ? 'laugh' : 'happy', lv === 3 ? 'Delight' : 'Idle'] }],
        lv >= 2 ? ['a2', 31, 'S-stop staring at my feet!!', { expr: 'embarrassed', blush: 0.6 }] : ['a2', 34, 'My shoes are none of your business!', { expr: 'angry' }]] };
    }
    // Amaymon, at the camp
    const shoe = {
      flipflop: `${Cc} flip-flops today, kitty?\nPractically barefoot! My tentacles approve.`,
      slide: `${Cc} slides! One little strap\nand nothing else... very generous of you.`,
      toeloop: `Toe-post sandals! Your big toes get a hug\nand the rest go free. I approve.`,
      sandal: `Strappy ${c} sandals! All those little gaps...\nvery practical. For tickling, I mean.`,
      tstrap: `${Cc} T-straps! Very proper.\nYour toes didn't get the memo, though.`,
      heels: `${Cc} high heels on a forest trail? Bold!\nAt least your toes get some fresh air.`,
      pumps: `Closed-toe heels?! Spoilsport!\nNot even a peek at your toenails!`,
      gladiator: `${Cc} gladiator sandals! Going to war, kitty?\nThe straps alone must take you an hour.`,
      cross: `Crossover slides! Two straps and a prayer.\nOne good tug and they are gone, kitty.`,
      wedges: `${Cc} wedges on a forest trail? Daring!\nAt least you get a better view from up there.`,
      flats: `Ballet flats?! Spoilsport!\nNot even a peek at your toenails!`,
      mules: `Mules! All toe box and no back...\nhalf a shoe each, and still no toes for me. Hmph.`,
      geta: `Wooden geta, kitty? Clip, clop, clip, clop...\nEvery monster in the forest heard you coming.`,
    }[L.style] || 'New shoes, kitty?';
    if (lv === 0) return { lv, lines: [['am', 14, shoe], ['a1', 7, "That's the idea.", { expr: 'smug' }]] };
    return { lv, lines: [['am', lv === 3 ? 2 : 4, shoe], ['am', 4, `And ${nail} toenails... ${hue(nail, NAIL_AM)}.`, { toes: true }],
      ['a2', 34, 'Eyes up here, you pesky overlord.', { expr: 'angry' }]] };
  }

  // ---------- (10-04, batch 22, as he asked) what they make of HER: her skin and her feet in her shoes, what she wears, what she is
  // Lilith, Amaymon, Alraune, the Ivy Maidens, Boudicca, Aurelia, Scylla, the ghosts, the fairies, Mr. Pumpkin and the
  // Myconids each have a line on her feet (her skin's tone, her shoes), one on her outfit (by its kind: looks.js `theme`)
  // and one on her species if she is not human. lookSay(who) -> { feet, outfit, species (null for a human) };
  // lookRemarks(who, n) -> up to n of them as plain texts (her feet first; then her species, or else her outfit).
  // (they speak of the tone of her skin, her hair, her clothes and her kind: never of a race)
  const A_THEME = { witch: 'a witch', school: 'a schoolgirl', office: 'an office lady', sporty: 'an athlete', beach: 'a beach girl', sleep: 'a sleepyhead', goth: 'a goth girl', bunny: 'a bunny girl', royal: 'a queen',
    warrior: 'a warrior', villain: 'a villain', maid: 'a maid', kimono: 'a lady in a fine robe', dancer: 'a dancer', casual: 'a girl out for a stroll', towel: 'a girl in a towel', tribal: 'a wild girl', cute: 'a doll in lace',
    idol: 'a pop star', elegant: 'an elegant lady', goddess: 'a goddess', fairy: 'a fairy' };
  const A_KIND = { elf: 'an elf', angel: 'an angel', demon: 'a demon', alien: 'an alien', robot: 'a robot', ghost: 'a ghost', flower: 'a flower girl', cat: 'a cat girl', fairy: 'a fairy' };
  const FEET_ADJ = { rose: 'rosy', crimson: 'crimson', lilac: 'lilac', violet: 'violet', sky: 'sky-blue', azure: 'azure', teal: 'teal', mint: 'mint-green', leaf: 'leaf-green', olive: 'olive', silver: 'silver', snow: 'snow-white', charcoal: 'charcoal', gold: 'golden' };
  const TH = {
    al: { witch: 'A little witch, hat and all...\nmy garden has never caught one so sweet.', school: 'A little scholar, in my garden?\nThen learn this, darling: flowers tickle.', office: 'So prim and proper, luv...\nmy vines do love undoing proper.',
      sporty: 'Dressed for a run, darling?\nYou will not get far on tickled feet.', beach: 'Dressed for the seaside, in MY forest?\nSo much bare skin for my vines, honey.', sleep: 'In your nightclothes, darling?\nThen let my petals tuck you in.',
      goth: 'All in black, luv...\nI shall put some colour in those cheeks.', bunny: 'A bunny in my garden! Do bunnies nibble flowers...\nor do flowers nibble bunnies?', royal: 'Royalty, in my garden!\nThen you shall have the royal treatment, Your Highness.',
      warrior: 'Armour, darling?\nMy vines find every gap. Every single one.', villain: 'So wicked, luv...\nand still such a sweet little morsel.', maid: 'A maid! My garden does need tending,\ndarling... afterwards.',
      kimono: 'Such a pretty robe, honey...\nlike petals of your own.', dancer: 'A dancer! Then dance for me, darling...\nmy vines will lead.', casual: 'Dressed so simply, luv... a gift in plain paper.\nI do love unwrapping.',
      towel: 'Straight from the bath, darling?\nFresh and clean... my favourite.', tribal: 'A wild little thing...\nmy forest will feel like home, honey.', cute: 'All laces and bows, darling!\nA present, wrapped just for me.',
      idol: 'A little star!\nSing for my garden, luv.', elegant: 'All dressed up, darling...\nand nowhere to go.', goddess: 'A goddess walks my garden!\nEven goddesses giggle, darling.', fairy: 'A little fairy...\nmy flowers have missed your kind, honey.' },
    am: { witch: 'The full witch outfit, apprentice!\nVery official.', school: 'Off to class, kitty?\nThe forest is a strict teacher. Hehehe.', office: 'Dressed for the office?\nThe forest does not take appointments, sweetie.',
      sporty: 'Sporty! Good.\nYou will be running a lot, kitty.', beach: 'A swimsuit. In a forest full of tickle monsters.\nBold, kitty. Very bold.', sleep: 'Still in your nightclothes,\nsleeping beauty?', goth: 'Very gloomy, kitty.\nThe vines will not care. Hehehe.',
      bunny: 'A bunny?! Hehehe...\noh, the forest is going to LOVE you.', royal: 'Your Majesty! Shall I carry the royal shoes\nwhen they come off?', warrior: 'Armour! ...It covers everything\nexcept what they are after, kitty.', villain: 'Ooh, scary.\nI am the demon here, apprentice.',
      maid: 'A maid! My pocket dimension\nneeds dusting, kitty.', kimono: 'Very elegant, kitty.\nTry not to trip over a vine.', dancer: 'A dancer! Then you are light on your feet.\nYou will need to be.', casual: 'Casual today, kitty?\nFine by me.',
      towel: 'A TOWEL?!\nKitty, we are going OUTSIDE.', tribal: 'Going wild, kitty?\nThe goblins will be flattered.', cute: 'So many bows, sweetie.\nThe Ivy Maidens will think you are a present.', idol: 'A pop star! Hehehe...\nthe forest is your audience, kitty.',
      elegant: 'All dressed up for a forest full of mud,\nsweetie?', goddess: 'A goddess! ...With very ticklish feet,\nI bet.', fairy: 'A fairy costume!\nThe real ones will have opinions, kitty.' },
    li: { witch: 'A proper little witch, hat to heel...\nhow delicious.', school: 'A schoolgirl? Then here is today\'s lesson,\nsweetie.', office: 'All business, girl?\nI know just how to make you unwind.', sporty: 'So sporty, honey!\nLet us see how long you last.',
      beach: 'Dressed for the beach, mortal?\nSo little between me and you.', sleep: 'Ready for bed, sweetie?\nI AM the thing in your dreams.', goth: 'So dark and gloomy, girl...\nyou dress like one of mine.', bunny: 'A bunny! Oh, honey...\nyou are simply begging to be caught.',
      royal: 'A queen? There is only ONE queen here,\nhoney.', warrior: 'Armour, mortal?\nNot one plate on those soles, I see.', villain: 'A villain? How adorable.\nLet me show you a real one.', maid: 'A maid! Then you shall serve me,\nsweetie. Feet first.',
      kimono: 'Such an elegant robe, honey...\nand such wiggly toes beneath it.', dancer: 'A dancer! Then point those toes\nfor me, girl.', casual: 'Dressed so plainly, mortal...\nand still delicious.', towel: 'Straight from the bath, sweetie?\nSqueaky clean... mmm.',
      tribal: 'A little wild thing!\nWild things squeal the loudest.', cute: 'All bows and laces...\na gift, honey. I do love unwrapping.', idol: 'An idol!\nSing for your biggest fan, girl.', elegant: 'All dressed up for me, honey?\nYou should not have.',
      goddess: 'A goddess? Even goddesses\nhave weaknesses, sweetie.', fairy: 'A little fairy!\nI shall be gentle... no. I shall not.' },
    ivy: { witch: 'A witch, sisters!\nDoes her magic tickle too?', school: 'She looks so clever, sisters!\nClever girls giggle too!', office: 'So neat and tidy, sisters!\nLet us make her all untidy!', sporty: 'She came to run, sisters!\nOur vines run faster!',
      beach: 'So much bare skin, sisters!\nSo many places to tickle!', sleep: 'She is dressed for bed, sisters!\nNo sleeping yet, little pixy!', goth: 'All in black, sisters!\nWe shall make her laugh all the same!', bunny: 'A bunny, sisters! A bunny!\nHop, hop, into our vines!',
      royal: 'A princess, sisters!\nPrincess piggies are the sweetest!', warrior: 'She wears armour, sisters!\nNot on her piggies, though!', villain: 'She looks so wicked, sisters!\nWicked girls giggle loudest!', maid: 'A maid, sisters!\nShe can tidy our vines... later!',
      kimono: 'Such a pretty robe, sisters!\nPretty as petals!', dancer: 'A dancer, sisters!\nLook at those dancing piggies!', casual: 'A girl out for a stroll, sisters!\nShe strolled right to us!', towel: 'Only a towel, sisters!\nShe is fresh from her bath!',
      tribal: 'A wild girl, sisters!\nAs wild as our forest!', cute: 'Bows and laces, sisters!\nShe is wrapped like a present!', idol: 'A singer, sisters!\nWe shall make her sing!', elegant: 'So elegant, sisters!\nAnd so ticklish, we bet!',
      goddess: 'A goddess, sisters!\nDo goddesses have piggies? They do!!', fairy: 'A fairy, sisters! Like a butterfly!\nPretty butterfly!' },
    bo: { witch: 'Still in the witch costume, rookie?\nIt suits you, brat. ♥', school: 'A school uniform, missy?\nThen teacher Boudicca will examine you!', office: 'So serious clothes, darling!\nI will make you not serious.', sporty: 'Sport clothes, brat?\nGood, you will need the stamina!',
      beach: 'A swimsuit, missy?! For ME?\nYou should not have, darling! ♥', sleep: 'Night clothes, rookie?\nIt is not bed time yet!', goth: 'All black, brat?\nVery moody. I like it. ♥', bunny: 'A BUNNY, missy?!\nOh, I am keeping you. ♥',
      royal: 'A queen, darling?\nIn my glade I give the orders!', warrior: 'Armour, rookie? Cute!\nYou forgot the feetsies. ♥', villain: 'A villain, brat?\nYou are too cute to be evil!', maid: 'A maid, missy!\nYou can polish my sword... after.',
      kimono: 'What a pretty robe, darling!\nI will be careful with it. Maybe.', dancer: 'A dancer, missy?\nThen show me your pointing toes! ♥', casual: 'Simple clothes, brat?\nSimple is good. Easy to catch!', towel: 'A TOWEL, missy?!\nYou are making this too easy! ♥',
      tribal: 'A wild girl, rookie!\nI tame wild things for breakfast.', cute: 'So many bows, darling!\nLike a doll! My doll. ♥', idol: 'A singer, missy?\nSing when I tickle, please!', elegant: 'So elegant, darling...\nyou dressed up for your Boudicca! ♥',
      goddess: 'A goddess, brat?\nGoddess feetsies are my favourite!', fairy: 'A fairy, missy?\nI caught a fairy! ♥' },
  };
  const KIND = {
    al: { elf: 'An elf! Your kind always did love my forest...\nand my forest loves you back.', angel: 'An angel, fallen into my garden...\noh, I shall keep you.', demon: 'A little demoness! Do your kind giggle too,\ndarling? Let us find out.',
      alien: 'Not from this world, luv?\nMy vines are curious too.', robot: 'A girl of metal...\ndo you rust if my flowers kiss you, darling?', ghost: 'A ghost, darling?\nMy vines can still hold you... I checked.', flower: 'A flower like me!\nCome here, little sprout.',
      cat: 'A kitty! Careful, darling...\nmy vines love to play with kittens.', fairy: 'A fairy with real wings!\nMy flowers have missed your kind, honey.' },
    am: { elf: 'Pointy ears suit you, apprentice.', angel: 'An angel travelling with a demon.\nHehehe... how scandalous.', demon: 'Horns and a tail!\nFinally, a proper apprentice.', alien: 'A new colour today, kitty?\n...I am not judging.', robot: 'A metal kitty!\nDo you squeak when tickled?',
      ghost: 'You look a bit pale, kitty.\nHehehe.', flower: 'A flower girl!\nAlraune will think you are family.', cat: 'Ears AND a tail!\nSo I was right to call you kitty!', fairy: 'Wings, kitty?\nDo they even work?' },
    li: { elf: 'Pointed ears AND ticklish feet,\nlittle elf? How delicious.', angel: 'An angel... oh, I have ALWAYS wanted\nto make one of you squeal.', demon: 'One of my own kind!\nThen you know exactly what comes next, honey.', alien: 'From another world, sweetie?\nFeet are feet... let us see.',
      robot: 'A robot? Somebody built you ticklish,\ngirl. How thoughtful.', ghost: 'A ghost that giggles...\nI am not letting you fade away, honey.', flower: 'A little flower...\nI shall tickle your roots, sweetie.', cat: 'Here, kitty kitty...\nlet me see those little paws.', fairy: 'A fairy! Small wings,\nbig giggles.' },
    ivy: { elf: 'An elf, sisters! Pointy ears!\nAnd pointy little toes!', angel: 'An angel, sisters!\nDo her feathers tickle HER?', demon: 'A little demon, sisters!\nWith a tail to hold her by!', alien: 'She is from the stars, sisters!\nStar piggies!', robot: 'A metal girl, sisters!\nDoes she giggle or does she beep?',
      ghost: 'A ghost, sisters!\nOur vines can hold her anyway!', flower: 'A flower, sisters! Like us!\nA little sister!', cat: 'A kitty, sisters!\nLook at her tail swish!', fairy: 'A fairy, sisters!\nA real pretty butterfly!' },
    bo: { elf: 'An elf, missy?\nPointy ears are so cute! ♥', angel: 'An angel, darling?!\nI caught an ANGEL! ♥', demon: 'A demon, brat?\nI fight demons. You, I will tickle.', alien: 'What are you, rookie?\nNever mind. You have feetsies.', robot: 'A robot, missy?\nWhere is your off button? Here? ♥',
      ghost: 'A ghost, brat?\nMy sword cannot cut you. My fingers can tickle!', flower: 'A flower girl, darling!\nYou smell nice. ♥', cat: 'A kitty, missy!\nHere, kitty kitty! ♥', fairy: 'A fairy, rookie?\nDo not fly away from me! ♥' },
  };
  function lookSay(who) {
    const L = look(), W = (S.lookWords && S.lookWords()) || {}, c = L.shoe || 'pretty', noun = NOUN[L.style] || 'shoes', shoes = (L.style === 'geta' ? 'wooden ' : c + ' ') + noun;
    const feet = W.fantasy ? (FEET_ADJ[W.soleWord] || W.soleWord || 'pretty') : (W.soleWord || 'pretty'), Feet = cap1(feet);
    const tint = W.fantasy ? 'soft' : W.skinDeep >= 9 ? 'soft' : W.skinDeep >= 5 ? 'rosy' : 'pink';
    const theme = W.theme || 'witch', kind = W.speciesWord && W.speciesWord !== 'human' ? W.speciesWord : null, aTheme = A_THEME[theme] || 'a witch', aKind = kind ? (A_KIND[kind] || 'a ' + kind) : null;
    const up = (t) => cap1(t), out = { theme, kind, feet: '', outfit: '', species: null, hair: null }, hair = W.hair || 'auburn';
    out.hair = { al: `Such lovely ${hair} hair, luv...\nI shall braid my flowers into it.`, am: `And the ${hair} hair suits you, kitty.\nDo not let it go to your head.`, li: `And that ${hair} hair, girl...\nI shall enjoy seeing it all dishevelled.`,
      ivy: `Look at her ${hair} hair, sisters!\nSo soft! So shiny!`, bo: `I like the ${hair} hair, missy!\nVery pretty. ♥` }[who] || null;
    switch (who) {
      case 'al': out.feet = `And those pretty ${feet} feet in those ${shoes}, darling...\nhow ${tint} and ticklish are those soles of yours?`; break;
      case 'am': out.feet = `${Feet} feet in ${shoes}, kitty?\nHehehe... every monster in this forest will thank you.`; break;
      case 'li': out.feet = `And such pretty ${feet} feet, honey...\nI could just eat them up.`; break;
      case 'ivy': out.feet = `Look, sisters! ${Feet} little feet in ${shoes}!\nTen pretty piggies, all for us!`; break;
      case 'bo': out.feet = `${Feet} feetsies in ${shoes}, missy?\nSo pretty! I will take good care. ♥`; break;
      case 'au': out.feet = `${Feet} feet and ${shoes}. My, my...\nthe little witch looks after herself.`; out.outfit = `Dressed as ${aTheme}, I see.\nFor a walk in the woods? Morons, all of you.`; out.species = aKind && `And ${aKind}, no less.\nThose fetch a good price, you know.`; break;
      case 'scylla': out.feet = `SUCH ${feet.toUpperCase()} LITTLE FEET!\nScylla has not tasted that flavour in years!`; out.outfit = `${up(aTheme).toUpperCase()} IN SCYLLA'S POOL?!\nScylla collects those!`; out.species = aKind && `${up(aKind).toUpperCase()}!\nScylla has never caught one of your kind!`; break;
      case 'ghost': out.feet = `Ooooh... ${feet} toesies...\nso waaarm...`; out.outfit = `Ooooh... ${aTheme}...\nall dressed up... for uuus...`; out.species = aKind && (kind === 'ghost' ? `Ooooh... one of uuus...\nbut so waaarm...` : `Ooooh... ${aKind}...\nwe never haunted one of thooose...`); break;
      case 'fairy': out.feet = `Tee hee! ${Feet} feet in ${shoes}!\nPretty, pretty!`; out.outfit = `Tee hee! ${up(aTheme)}!\nPretty, pretty!`; out.species = aKind && (kind === 'fairy' ? `Tee hee hee! A big sister!\nBig sisters giggle too!` : `Ooh! ${up(aKind)}!\nWe never caught one of those!`); break;
      case 'pumpkin': out.feet = `Hee hee! ${Feet} feet in ${shoes}!\nSofter than pumpkin flesh, I bet!`; out.outfit = `Hee hee hee! ${up(aTheme)} in my patch!\nSeed thieves come in all kinds!`; out.species = aKind && `Hee hee! ${up(aKind)}, stealing seeds!\nNow I have seen everything!`; break;
      case 'myc': out.feet = `Pretty ${feet} feet! Tick tick!`; out.outfit = 'Pretty! Tick!'; out.species = aKind && 'Ooo... new! Tick tick tick!'; break;
      default: out.feet = `Such pretty ${feet} feet...`;
    }
    // (batch 23, as he asked: what she wears is named) the five who have a line per kind of outfit open it with the outfit itself
    const wearing = W.wearing || aTheme, Wearing = cap1(wearing), CALL = { al: 'darling?', am: 'kitty?', li: 'honey?', ivy: 'sisters!', bo: 'missy?' };
    // (the Ivy Maidens' and Boudicca's lines open by naming her kind of outfit themselves: the outfit's own name takes that line's place)
    const rest = (t) => (who === 'ivy' || who === 'bo' ? t.split('\n').slice(1).join('\n') || t : t);
    if (TH[who]) { out.outfit = `${Wearing}, ${CALL[who]}\n` + rest(TH[who][theme] || TH[who].witch); out.species = kind ? (KIND[who][kind] || null) : null; }
    else if (W.wearing) out.outfit = { au: `Dressed in ${wearing}, I see.\nFor a walk in the woods? Morons, all of you.`, scylla: `${Wearing.toUpperCase()}, IN SCYLLA'S POOL?!\nScylla has never had a guest dressed like that!`,
      ghost: `Ooooh... ${wearing}...\nall dressed up... for uuus...`, fairy: `Tee hee! ${Wearing}!\nPretty, pretty!`, pumpkin: `Hee hee hee! ${Wearing}, in my patch!\nSeed thieves dress in all kinds!` }[who] || out.outfit;
    return out;
  }
  // the word for the colour of her soles (two old lines say "pink soles")
  const soleTint = () => { const W = (S.lookWords && S.lookWords()) || {}; return W.fantasy ? 'soft' : W.skinDeep >= 9 ? 'soft' : W.skinDeep >= 5 ? 'rosy' : 'pink'; };
  // (batch 23: her outfit is always among them: her feet, her outfit, then her species if she is not human, or else her hair)
  function lookRemarks(who, n = 2) { const L = lookSay(who), out = [L.feet]; if (n > 1) out.push(L.outfit); if (n > 2 || (n > 1 && L.species)) out.push(L.species || L.hair); return out.filter(Boolean).slice(0, Math.max(n, L.species ? 3 : n)); }

  // ---------- (10-03) the opening: Anne's memories (the 2D's scroll text), and skipping it ----------
  // memoryCards(): the four cards of her memories (the library plays them after Lilith leaves; the camp's intro menu too).
  async function memoryCards() {
    await S.card('', "It's been a week since then,\nevery night in my dreams ...\nshe comes back to torment me\nwith her merciless tricks.\n\nHad I never opened that damned book...\nHad I never gotten into that haunted library...\n\nThings would have been way more different\nand today I wouldn't be in this mess.", 'Press SPACE to continue');
    await S.mark('memory');
    await S.card('', 'My name is Anne and I applied as a novice to the\nSchool of Magic in the Tower of Wisdom,\nto become a magician.\n\nThe Tower of Wisdom is a very dangerous place:\nit used to be a hideout for sorcerers and necromancers,\nand for 300 years the magicians have been\ncleansing and scavenging its halls,\nand yet it is still a place with lots of hazards\nand secrets to unveil.', 'Press SPACE to continue');
    await S.card('', 'One day I discovered a secret passage\nleading to one of the secret libraries.\nThere in the darkest corners of the room,\ncovered by layers of dust and webs,\nI found the Grimoire of Conjuration,\nan ancient tome with plenty of summoning spells.\n\nNight after night, I spent hours reading its pages\nand training to animate non-living things with it.', 'Press SPACE to continue');
    await S.card('', "Then I found Her among its pages,\na beautiful representation.\nI didn't consider she was a dangerous demon:\nshe seemed more an angel than anything,\nand I performed the ritual to call her.\n\nFrom that day onwards, every night\nshe takes over my dreams\nand torments me with her tricks...\n\nI've got no choice.\nI must stop her,\nor I'll finish up being her toy\nforever in her realm of darkness.", 'Press SPACE to continue');
  }
  // introSkip(onSkip): while the opening plays, Esc twice skips it (the 2D's own intro menu has "Start game"); a small
  // hint says so. Returns a function that takes it away again.
  function introSkip(onSkip) {
    const el = document.createElement('div'), HINT = 'Esc twice: skip the intro';
    el.textContent = HINT; el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:60;padding:4px 12px;border-radius:12px;background:rgba(18,8,32,.6);color:#e9dcc4;font:13px Georgia,serif;pointer-events:none;opacity:.7';
    document.body.appendChild(el);
    let armedT = -1e9, done = false;
    const stop = () => { done = true; el.remove(); removeEventListener('keydown', key); };
    const key = (e) => {
      if (e.code !== 'Escape' || done) return; const now = performance.now();
      if (now - armedT < 3000) { stop(); onSkip(); return; }
      armedT = now; el.textContent = 'Press Esc again to skip the intro'; el.style.opacity = '1';
      setTimeout(() => { if (!done && performance.now() - armedT >= 2900) { el.textContent = HINT; el.style.opacity = '.7'; } }, 3000);
    };
    addEventListener('keydown', key);
    return stop;
  }

  return { K, am, amAt: (p) => { amSpot = p; }, amShow, sparks, headPos, headFwd, sole, checkpoint, toCheckpoint, lookTalk, lookLines, lookSay, lookRemarks, soleTint,
    feet, readFeet, snapSoles: () => { snapFeet = true; }, along, orient, memoryCards, introSkip };
}
