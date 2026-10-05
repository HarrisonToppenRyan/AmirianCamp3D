// boudicca.js: Boudicca Silverthorn, the tower's spellblade who ambushes Anne at the forest's edge (the 2D game's
// Chapter 1 epilogue, CE 107). Like the thief (thief.js) she is a second figure made from Anne's own model, in her own
// colours, after her portraits (faces/boudicca.png) and her walking sprite: silver-white hair gathered in a high
// ponytail on her right with a blue-violet bow, blue eyes, warm tanned skin, a violet suit with a dark high collar,
// dark-brown leather arm guards and thigh-high boots. Her arms and hands are thief.js's: aimed at points on Anne's soles,
// never into them.
const V = new URL(import.meta.url).search;
const { createThief } = await import('./thief.js' + V);

const TAN = [0.88, 0.70, 0.54];                       // her skin: Anne's fair skin times this (a warm honey tan)
const tan = (rough) => (m) => { m.color.multiply({ r: TAN[0], g: TAN[1], b: TAN[2] }); if (rough) m.roughness = rough; };
export const BOU_LOOK = {
  name: 'Boudicca',
  hide: ['Anne_Hat', 'Anne_HatBand', 'Anne_Cuffs', 'Anne_CuffTrim'],
  sock: [0.115, 0.068, 0.040, 0.70],                  // thigh-high boots (to this rest height)
  // (10-05: her boots are leg guards from her ankles up and a closed brown shoe, her feet bare inside them: the same on
  // her twin and on the whole figure the foot cam uses, loadBoudiccaBody below)
  sockLow: 0.085, shoe: 'flats',
  band: [0.13, 0.080, 0.045],                         // arm guards
  iris: [[0.36, 0.66, 1.0], [0.04, 0.22, 0.76]],
  hair: { base: [0.66, 0.65, 0.72], right: [0.63, 0.62, 0.70], left: [0.63, 0.62, 0.70] },
  tint: {
    Anne_Skin: tan(), Anne_SkinShod: tan(), Anne_GlovePaint: tan(0.55),
    Anne_Suit: (m) => { m.color.setRGB(0.25, 0.11, 0.36); m.roughness = 0.55; },
    Anne_Trim: (m) => { m.color.setRGB(0.10, 0.06, 0.035); m.roughness = 0.5; m.metalness = 0.1; },
    Anne_Choker: (m) => { m.color.setRGB(0.03, 0.025, 0.03); m.roughness = 0.6; },      // (her dark high collar)
    Anne_HeelPurple: (m) => { m.color.setRGB(0.12, 0.07, 0.04); m.roughness = 0.45; m.metalness = 0.05; },
    Anne_HeelSole: [0.05, 0.035, 0.025],
    Anne_Nail: [0.10, 0.12, 0.62],                    // (her bow's blue-violet: seen when her shoes are off)
    Anne_Brow: [0.45, 0.44, 0.50],
  },
};

// the ponytail and its bow, built in model space (rest pose) and carried by her head
function dress({ tw, THREE, onBone }) {
  const g = onBone('head'); if (!g) return;
  tw.mouth = new THREE.Object3D(); tw.mouth.position.set(0, 1.497, 0.152); g.add(tw.mouth);      // (her lips, for kisses)
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  // strands: a canvas of fine light and dark lines along the tail
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const cx = cv.getContext('2d');
  cx.fillStyle = '#a9a7b6'; cx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 160; i++) { const y = Math.random() * 256, l = 150 + Math.random() * 100; cx.strokeStyle = `rgba(${l},${l},${l + 14},${0.25 + Math.random() * 0.4})`; cx.lineWidth = 1 + Math.random() * 2; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(64, y + (Math.random() - 0.5) * 6); cx.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.77, 0.84), map: tex, roughness: 0.42, metalness: 0.05 });
  // high on her right (her right is -X), behind the ear; up and out, then down behind her shoulder
  const BASE = V3(-0.079, 1.667, 0.0);
  const path = new THREE.CatmullRomCurve3([BASE, V3(-0.098, 1.684, -0.012), V3(-0.122, 1.672, -0.04), V3(-0.13, 1.60, -0.075), V3(-0.128, 1.50, -0.10), V3(-0.12, 1.40, -0.116), V3(-0.108, 1.30, -0.112), V3(-0.096, 1.215, -0.10)]);
  const SEG = 48, RAD = 14, geo = new THREE.TubeGeometry(path, SEG, 1, RAD, false), P = geo.attributes.position;
  const rOf = (u) => (u < 0.06 ? 0.017 + 0.1 * u : 0.023 + 0.012 * Math.sin(Math.min(1, (u - 0.06) / 0.3) * Math.PI / 2)) * (u > 0.35 ? 1 - 0.82 * Math.pow((u - 0.35) / 0.65, 1.3) : 1);
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG, c = path.getPointAt(u), r = rOf(u);
    for (let k = 0; k <= RAD; k++) { const n = i * (RAD + 1) + k; const v = V3(P.getX(n), P.getY(n), P.getZ(n)).sub(c); const wav = 1 + 0.08 * Math.sin(k * 2.1 + i * 0.7); P.setXYZ(n, c.x + v.x * r * wav, c.y + v.y * r * wav, c.z + v.z * r * 0.8 * wav); }
  }
  geo.computeVertexNormals();
  const tail = new THREE.Mesh(geo, hairMat); tail.castShadow = true; tail.receiveShadow = true; g.add(tail);
  // the bow: two loops and two short tails round a knot, facing out from her head
  const bowMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.11, 0.12, 0.42), roughness: 0.5, metalness: 0.05 });
  const bow = new THREE.Group(); bow.position.copy(BASE).add(V3(-0.006, 0.004, 0)); bow.rotation.set(0, 0, -0.35); g.add(bow);
  for (const s of [1, -1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.009, 8, 20), bowMat); loop.scale.set(1, 0.62, 0.55); loop.rotation.set(0, Math.PI / 2, s * 0.35); loop.position.set(-0.004, 0.012, s * 0.03); loop.castShadow = true; bow.add(loop);
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.016), bowMat); end.position.set(-0.006, -0.026, s * 0.011); end.rotation.set(s * 0.32, 0, 0); end.castShadow = true; bow.add(end);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), bowMat); knot.scale.set(0.8, 1, 1); bow.add(knot);
}

export function createBoudicca(S, C) {
  return createThief(S, C, { look: BOU_LOOK, dress, idle: 'ThiefIdle' });
}

// ---------- (10-05, as he asked: "create a foot cam option for boudicca as well with all of the same mechanics that work for
// Anne") ----------
// The Boudicca of the scenes is a twin of Anne's model (thief.js): her own colours, bones and face, her arms aimed, and no
// more. The foot cam asks everything of a body that Anne's can do: a heel that comes up out of its shoe, toes that curl and
// wiggle, a leg that shakes, the tied pose and its ropes, marks on her soles, feet that never sink into the ground. So for
// the foot cam she is a second WHOLE figure from Anne's file (anne_next.js loadAnne, called again: nothing in it is shared
// between two calls), dressed by the same setters Anne's look uses: her tan, her silver hair with the ponytail and its bow
// (the same `dress` as her twin's), her violet suit, her arm guards. Her thigh-high boots are leg guards from the ankle up
// and a closed brown shoe: her feet are bare inside them, as the foot cam needs them.
// Returns Anne's kind of API (B.anne is her figure), hidden; index.html shows her in the twin's place while the foot cam is on her.
export async function loadBoudiccaBody({ THREE, GLTFLoader, scene, ver }) {
  const { loadAnne } = await import('./anne_next.js?v=' + ver);
  const B = await loadAnne({ THREE, GLTFLoader, scene, ver, qp: new URLSearchParams('') });
  const lin = (r, g, b, gain = 1) => '#' + new THREE.Color(Math.min(1, r / gain), Math.min(1, g / gain), Math.min(1, b / gain)).getHexString();      // (a colour as the setters want it: a display colour, before their own gains)
  B.setSkinTone('#d7a882'); B.setEyeColor(null); B.setHairColor('#dcdaea');      // (set by eye beside her twin: the tan of the twin's material is not a plain multiple of this one's tone)
  if (B.hairStyles) { const hs = B.hairStyles(); if (hs.length) B.setHairStyle(hs[0].id); }
  B.setOutfitColors({ suit: lin(0.25, 0.11, 0.36, 0.47), trim: lin(0.10, 0.06, 0.035, 0.8), choker: lin(0.03, 0.025, 0.03, 0.78) });
  B.setArms('bracers', lin(0.13, 0.080, 0.045, 0.6)); B.setLegs(lin(0.115, 0.068, 0.040, 0.55), 0.70); B.setHatWorn(false);
  if (B.setShoeStyle) { const want = ['flats', 'pumps', 'mules'], have = (B.shoeStyles ? B.shoeStyles() : []).map((x) => x.id || x); B.setShoeStyle(want.find((w) => have.includes(w)) || have[0]); }
  if (B.setShoeColor) B.setShoeColor(lin(0.12, 0.07, 0.04, 0.5), lin(0.05, 0.035, 0.025, 0.5));
  if (B.setNailColor) B.setNailColor('#5b63d6');     // (her bow's blue-violet)
  // her ponytail, its bow and her lips' place: on her head bone, as on her twin
  let sk = null; B.anne.traverse((o) => { if (!sk && o.isSkinnedMesh && o.skeleton) sk = o.skeleton; });
  if (sk) {
    const bi = new Map(sk.bones.map((b, i) => [b.name, i]));
    const onBone = (n) => { const i = bi.get(n); if (i === undefined) return null; const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(sk.boneInverses[i]); sk.bones[i].add(g); return g; };
    dress({ tw: B, THREE, onBone });
  }
  B.anne.name = 'BoudiccaBody'; B.anne.visible = false;
  return B;
}

// what Boudicca says while the foot cam's tools are on HER soles (footplay.js LINES, her own words for each): the one who
// usually does the tickling, proud, and every bit as ticklish
export const BOU_FOOT_LINES = {
  feather: {
    first: ["A feather? On ME? Hah... hehe... t-that's nothing!", "Ooh... a feather. You'll have to do better than-- hihi!", "Pff. A spellblade's soles are tough as-- hehe... s-stop that."],
    mid: ['Hehe... n-not bad, rookie...', "Hihi... okay, that's... kind of nice. Tell no one.", 'Mmh... slower... I mean, STOP. Hehe.', 'Hehe... you learned that from me, did you not?', 'Hihi... my toes are curling by themselves...'],
    toes: ['Eep! U-under the toes is MY trick! Hehehe!', 'Hihi! Not between them! Cheater!', 'Hehe! My toes! Rookie, that is low!'],
    after: ["Hmph... I've had worse. Hehe.", 'Phew... not bad at all, rookie.', 'You may do that again sometime. Maybe.'],
  },
  tease: {
    first: ['W-whoa, whose NAILS are those?! Hehe!', "Hey hey hey! Long nails?! That's cheating! Hihi!", 'Oh no... not the slow kind... I INVENTED the slow kind! Hehe!'],
    mid: ['Hehehe! S-so this is what it feels like!', 'Hihihi... slow is WORSE! I should know!', 'Ahh-hehe! All the way down my sole!', 'Hehe! I-I take back everything I did to you!', 'Hihi! Every single nail!', "Y-you're enjoying this! Hehehe!"],
    after: ['Phew... my soles are still tingling...', 'Hehe... note to self: that one WORKS.', 'Hah... okay. I had that coming.'],
  },
  tickle: {
    first: ["W-wait, wait, I'm the tickler he-- AHAHA!!", "Not the scribbling! I'll talk, I'll-- AHAHAHA!", 'EEK! Hahaha! N-no fair!!'],
    mid: ['Ahaha! That tickles!!', 'Hehe-haha! T-too much, rookie!', 'Hahaha! N-not my arches!!', 'Ahaha! R-right there?! NOO!', 'Hahaha! I-I yield! Almost!'],
    hard: ['AHAHAHA!! N-NOT THE NAILS!!', 'HAHAHA!! I YIELD!! I YIELD!!', "AHAHAHAHA!! S-SPELLBLADES DON'T-- HAHAHA!!", 'NOO-HOHOHO!! MY ARCHES!!', 'HAHAHA!! MERCY, ROOKIE, MERCY!!', "AHAHA!! I'LL NEVER TIE YOU UP AGAIN!! HAHAHA!!"],
    after: ['Hah... hah... okay... you win this one...', 'Phew!! ...I taught you too well. Hehe.', "Hah... I'm getting you back for that. Hehe."],
  },
  tongue: {
    first: ['EEP! ...D-did you just LICK my foot?!', "Wha--?! Hey! That's MY move!", 'HEY! Hehe... was that a TONGUE?!'],
    mid: ["Eep! Hehehe... that's wet!", 'Hihi! A-again?!', 'Hehehe! Toes to heel?! I only did that ONCE to you!', "Eww-hehe! It's all slobbery!", 'Hihihi! Warm! And WET!', 'My sole is not a lollipop, rookie! Hihi!'],
    after: ["Ugh, now it's all wet... hehe.", "I can't believe you licked it. ...Fine. We're even.", 'Eww... okay, I deserved that. Hehe.'],
  },
  brush: {
    first: ['Is that a scrub brush?! W-wait-- AHAHA!', 'Oh no, not the fuzzy one! Hehe-HAHA!', 'A brush?! My feet are clean enou-- AHAHAHA!'],
    mid: ['Ahaha! The bristles!!', "Hehe-haha! It's so fuzzy!", 'Scrub scrub... ahaha!', 'Hahaha! They get EVERYWHERE!', 'Hehe-haha! S-so many little bristles!'],
    hard: ['HAHAHA!! THE BRISTLES!!', 'AHAHAHA!! N-NOT SO HARD!!', "I C-CAN'T... HAHAHA!!", 'HAHAHA!! N-NOT MY ARCHES!! NOO!!', "AHAHA!! THEY'RE CLEAN!! THEY'RE CLEAN!!"],
    after: ['Phew... squeaky clean, I guess...', 'Hah... hah... that brush is a menace.', 'Hehe... I need one of those.'],
  },
  tied: ["I can't pull them away!! Hehehe! N-now I know!", 'N-no fair! Those are MY knots!!', 'Both soles?! At once?! Hahaha!', "I c-can't wiggle out! Hihihi!"],
  lift: ["My foot? ...Fine. Just don't get cocky, rookie.", 'Oh, you want to see MY soles for once? Hehe.', 'Like this? Careful... I bite.'],
  swap: ['Okay, okay... the other one now?', 'Other foot! ...Go easy on it.', "Fine... this one's turn. Hehe."],
  tie: ["H-hey! Rope?! On ME?!\n...You've been taking notes.", "Tied up?! That's my job, rookie!", 'My ankles AND my toes?!\nOh, you are going to pay for this.'],
  untie: ['Phew... finally! My poor feet...', 'Free! ...Sleep with one eye open, rookie.', 'Hehe... okay. That was... educational.'],
  lilith: ['L-Lilith?! Out of the GROUND?!', 'W-wait... I know those nails!!', 'The succubus?! Here?! H-hands off!'],
};
