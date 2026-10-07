// looks.js (10-04, as he asked): the player makes her their own at the beginning of the game. Her name, a heritage to start
// from (Asian, Black, Hispanic, White, Mixed, Indian, Native American, Arab), her skin tone, the shape of her face, her
// eyes, her hair's colour and style, her outfit, and (as before) her shoes and toenails: one panel with a tab for each,
// the camera on what the tab is about, every choice tried on her at once (pointer over it) and kept by a click.
//  - A heritage only fills in the other tabs (a skin tone, eye and hair colours, a face): everything stays free to change
//    afterwards, and any skin tone goes with any of them.
//  - The look is kept with the browser's saved game under 'amirian3d.look.v1' (her shoes and nails keep their own keys)
//    and put on her at every load (areas are page loads).
//  - Applying it is anne_next.js's work (setSkinTone, setEyeColor, setHairColor, setHairStyle, setShape, setLidBias,
//    setOutfitColors, setArms, setLegs, setParts, setHatWorn); what the model does not have (a hairstyle, a face shape, an
//    outfit's part) is simply not offered.
// Host (index.html): createLooks(env) -> { open(then, tab), apply(), name(), state(), customized(), ... }.
// (batch 22, as he asked) A species tab (elf, angel, demon, alien, robot, ghost, plant, cat girl, fairy), fifty outfits
// (his list: each one a cut of her suit, colours, sleeves, stockings, a skirt or other cloth of the model, and what
// wear.js hangs on her), sliders and ready-made shapes for her face. Every outfit covers what a swimsuit covers, or more.
const VQ = new URL(import.meta.url).search;
const { createWear } = await import('./wear.js' + VQ);
export function createLooks(env) {
  const { A, anne, camera, post, THREE, scene } = env;
  const $ = (id) => document.getElementById(id);
  const KEY = 'amirian3d.look.v1', HEX = /^#[0-9a-f]{6}$/i;

  // ---------- what there is to choose from ----------
  const SKINS = [['Porcelain', '#fde9e3'], ['Ivory', '#f8dfd0'], ['Fair', '#f2d2bc'], ['Beige', '#e9c2a3'], ['Sand', '#ddb08c'], ['Honey', '#d19f76'], ['Golden', '#c48d60'],
    ['Tan', '#b47a4c'], ['Caramel', '#a1683c'], ['Bronze', '#8a5530'], ['Brown', '#6f4326'], ['Deep brown', '#56331d'], ['Espresso', '#41261a'], ['Ebony', '#2f1c14']];
  // (batch 22) tones for those who are not human (any species may wear any tone)
  const SKINS2 = [['Rose', '#e8a0a8'], ['Crimson', '#b8323a'], ['Lilac', '#b9a2e6'], ['Violet', '#7a55c8'], ['Sky', '#8fc4f0'], ['Azure', '#3f7fe0'], ['Teal', '#3fb8a8'],
    ['Mint', '#a8e6c0'], ['Leaf', '#6fbf5a'], ['Olive', '#8a9a4a'], ['Silver', '#c0c4cc'], ['Snow', '#f1f5fb'], ['Charcoal', '#4a4a52'], ['Gold', '#d9b05e']];
  // What she is. skin, eyes, hair: suggested when the species is picked (the player may change them); shape: weights added to
  // her face's own; acc: what wear.js hangs on her; finish: her skin's make; glow: a light of its own; word: for the lines.
  const SPECIES = {
    human: ['Human', { word: 'human' }],
    elf: ['Elf', { word: 'elf', shape: { 'shape-ear-elf': 1 } }],
    angel: ['Angel', { word: 'angel', acc: [['halo'], ['wings_angel']] }],
    demon: ['Demon', { word: 'demon', acc: [['horns'], ['wings_bat'], ['tail_demon']], skin: '#b8323a', eyes: '#b3761f', hair: '#1a1614', shape: { 'shape-ear-elf': 0.55 } }],
    alien: ['Alien', { word: 'alien', acc: [['antennae']], skin: '#a8e6c0', eyes: '#21140c', hair: '#1fa39a', shape: { 'shape-ear-elf': 0.4 } }],
    robot: ['Robot', { word: 'robot', acc: [['robotears']], skin: '#c0c4cc', eyes: '#5aa8e8', hair: '#b9b9c0', finish: { metal: 0.85, rough: 0.3 } }],
    ghost: ['Ghost', { word: 'ghost', skin: '#f1f5fb', eyes: '#5aa8e8', hair: '#efece8', glow: ['#9fc8ff', 0.32] }],
    plant: ['Plant', { word: 'flower', acc: [['flowercrown'], ['leaves']], skin: '#6fbf5a', eyes: '#3f8f4f', hair: '#e86fa8' }],
    cat: ['Cat girl', { word: 'cat', acc: [['catears'], ['tail_cat']] }],
    fairy: ['Fairy', { word: 'fairy', acc: [['wings_fairy']], shape: { 'shape-ear-elf': 0.6 } }],
  };
  const SPECIES_ORDER = ['human', 'elf', 'angel', 'demon', 'alien', 'robot', 'ghost', 'plant', 'cat', 'fairy'];
  const EYES = [['Blue', ''], ['Light blue', '#5aa8e8'], ['Grey', '#7f8c99'], ['Green', '#3f8f4f'], ['Hazel', '#8a6a2f'], ['Amber', '#b3761f'], ['Brown', '#5b3a1e'],
    ['Dark brown', '#3a2414'], ['Black', '#21140c'], ['Violet', '#7a55c8']];
  const HAIRS = [['Auburn', ''], ['Black', '#1a1614'], ['Soft black', '#2b2320'], ['Dark brown', '#3d2a1e'], ['Brown', '#5c3c26'], ['Chestnut', '#7a4526'], ['Copper', '#b5562a'],
    ['Ginger', '#cf6e2d'], ['Strawberry blonde', '#d99a6c'], ['Golden blonde', '#d9b05e'], ['Platinum', '#e9dcc0'], ['Silver', '#b9b9c0'], ['White', '#efece8'], ['Red', '#c2182b'],
    ['Pink', '#e86fa8'], ['Purple', '#7a4ac8'], ['Blue', '#3f6fe0'], ['Teal', '#1fa39a']];
  // the set of her eyes: a standing share of her lid morphs (anne_next.js setLidBias)
  const lids = (o) => { const b = {}; for (const k in o) { b['eye-left-' + k] = o[k]; b['eye-right-' + k] = o[k]; } return b; };
  const LIDS = { almond: ['Almond', {}], round: ['Round', lids({ 'opened-up': 0.45 })], narrow: ['Narrow', lids({ slit: 0.3 })], soft: ['Soft', lids({ closure: 0.14 })] };
  // The shapes of her face the model can have (its `shape-...` morph targets), as sliders. [label, lowest, highest]
  const SHAPE_UI = {
    'shape-soft': ['Softness', -1, 1], 'shape-jaw-wide': ['Jaw', -1, 1], 'shape-cheekbones': ['Cheekbones', -1, 1], 'shape-chin-long': ['Chin', -1, 1], 'shape-face-round': ['Roundness', -1, 1],
    'shape-nose-wide': ['Nose width', -1, 1], 'shape-nose-bridge': ['Nose bridge', -1, 1], 'shape-nose-long': ['Nose length', -1, 1],
    'shape-lips-full': ['Lips', -1, 1], 'shape-mouth-wide': ['Mouth width', -1, 1], 'shape-brow-heavy': ['Brow', -1, 1],
  };
  // ready-made faces (they set the sliders; the heritage's build stays)
  const FACE_PRESETS = [['asbuilt', 'As built', {}], ['soft', 'Soft', { 'shape-soft': 1, 'shape-jaw-wide': -0.35, 'shape-lips-full': 0.3, 'shape-brow-heavy': -0.4 }],
    ['round', 'Round', { 'shape-face-round': 0.8, 'shape-soft': 0.4, 'shape-chin-long': -0.4 }], ['heart', 'Heart', { 'shape-cheekbones': 0.7, 'shape-jaw-wide': -0.7, 'shape-chin-long': 0.3, 'shape-soft': 0.3 }],
    ['sharp', 'Sharp', { 'shape-cheekbones': 0.6, 'shape-face-round': -0.6, 'shape-nose-bridge': 0.4, 'shape-soft': -0.5 }], ['strong', 'Strong', { 'shape-jaw-wide': 0.7, 'shape-brow-heavy': 0.5, 'shape-chin-long': 0.4, 'shape-soft': -0.8 }]];
  const EYE_SHAPE_UI = { 'shape-eye-slant': ['Slant', -1, 1], 'shape-eye-fold': ['Lid fold', 0, 1], 'shape-eye-wide': ['Spacing', -1, 1] };
  // (not sliders of their own: what a heritage is built from, the two structures MakeHuman knows beside the one she was made in)
  const BASE_SHAPES = ['shape-base-asian', 'shape-base-african'];
  // A heritage: a starting point. skin, eyes, hair: colours; face: weights of the shapes above; lids: the set of her eyes.
  const HERITAGE = {
    white: ['White', { skin: '#fde9e3', eyes: '', hair: '', lids: 'almond', face: {} }],
    asian: ['Asian', { skin: '#f2d2bc', eyes: '#3a2414', hair: '#1a1614', lids: 'almond', face: { 'shape-base-asian': 0.65, 'shape-eye-slant': 0.45, 'shape-eye-fold': 0.6, 'shape-nose-bridge': -0.3, 'shape-face-round': 0.2 } }],
    black: ['Black', { skin: '#6f4326', eyes: '#3a2414', hair: '#1a1614', lids: 'almond', face: { 'shape-base-african': 0.85, 'shape-lips-full': 0.5, 'shape-nose-wide': 0.45 } }],
    hispanic: ['Hispanic', { skin: '#c48d60', eyes: '#5b3a1e', hair: '#3d2a1e', lids: 'almond', face: { 'shape-base-african': 0.15, 'shape-base-asian': 0.2, 'shape-lips-full': 0.2, 'shape-cheekbones': 0.2 } }],
    mixed: ['Mixed', { skin: '#b47a4c', eyes: '#8a6a2f', hair: '#3d2a1e', lids: 'almond', face: { 'shape-base-african': 0.4, 'shape-base-asian': 0.1, 'shape-lips-full': 0.25, 'shape-nose-wide': 0.15 } }],
    indian: ['Indian', { skin: '#a1683c', eyes: '#3a2414', hair: '#1a1614', lids: 'round', face: { 'shape-base-african': 0.15, 'shape-nose-long': 0.3, 'shape-nose-bridge': 0.25, 'shape-lips-full': 0.2, 'shape-brow-heavy': 0.2 } }],
    native: ['Native American', { skin: '#b47a4c', eyes: '#3a2414', hair: '#1a1614', lids: 'almond', face: { 'shape-base-asian': 0.5, 'shape-cheekbones': 0.5, 'shape-nose-bridge': 0.3, 'shape-jaw-wide': 0.2, 'shape-eye-slant': 0.15 } }],
    arab: ['Arab', { skin: '#d19f76', eyes: '#5b3a1e', hair: '#2b2320', lids: 'almond', face: { 'shape-nose-bridge': 0.45, 'shape-nose-long': 0.25, 'shape-brow-heavy': 0.4, 'shape-lips-full': 0.15, 'shape-base-african': 0.1 } }],
  };
  const HERITAGE_ORDER = ['asian', 'black', 'hispanic', 'white', 'mixed', 'indian', 'native', 'arab'];
  // (10-04, as he asked) "Mixed" is any two of the other seven, half and half: every pairing (21 of them). Her skin is the
  // tone midway between the two (the nearest of the tones on the Skin tab), her eyes the shade midway between theirs, her
  // hair the nearest natural colour to the mean of theirs, her face the mean of the two faces.
  const BASES = ['white', 'black', 'asian', 'hispanic', 'indian', 'native', 'arab'], AUBURN = '#a9571f';
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const midHex = (a, b) => { const A = rgbOf(a), B = rgbOf(b); return '#' + [0, 1, 2].map((k) => Math.round(255 * Math.pow((Math.pow(A[k] / 255, 2.2) + Math.pow(B[k] / 255, 2.2)) / 2, 1 / 2.2)).toString(16).padStart(2, '0')).join(''); };
  const nearestOf = (list, hex, built) => { const T = rgbOf(hex); let best = list[0][1], bd = Infinity; for (const [, h] of list) { const C = rgbOf(h || built), d = (C[0] - T[0]) ** 2 + (C[1] - T[1]) ** 2 + (C[2] - T[2]) ** 2; if (d < bd) { bd = d; best = h; } } return best; };
  const EYE_RANK = ['', '#5aa8e8', '#7f8c99', '#3f8f4f', '#8a6a2f', '#b3761f', '#5b3a1e', '#3a2414', '#21140c'];      // her eye colours, light to dark
  function mixLook(a, b) {
    const A = HERITAGE[a][1], B = HERITAGE[b][1];
    if (a === b) return { skin: A.skin, eyes: A.eyes, hair: A.hair, lids: A.lids, face: Object.assign({}, A.face) };
    const face = {}; for (const k of new Set([...Object.keys(A.face), ...Object.keys(B.face)])) face[k] = +(((A.face[k] || 0) + (B.face[k] || 0)) / 2).toFixed(3);
    const ia = EYE_RANK.indexOf(A.eyes), ib = EYE_RANK.indexOf(B.eyes);
    const sa = SKINS.findIndex((x) => x[1] === A.skin), sb = SKINS.findIndex((x) => x[1] === B.skin);      // (the tones run light to dark: the one midway between the two)
    return { skin: sa >= 0 && sb >= 0 ? SKINS[Math.round((sa + sb) / 2)][1] : nearestOf(SKINS, midHex(A.skin, B.skin)), eyes: EYE_RANK[Math.ceil(((ia < 0 ? 6 : ia) + (ib < 0 ? 6 : ib)) / 2)],
      hair: nearestOf(HAIRS.slice(0, 13), midHex(A.hair || AUBURN, B.hair || AUBURN), AUBURN), lids: A.lids !== 'almond' ? A.lids : B.lids, face };
  }
  const okMix = (m) => (Array.isArray(m) && m.length === 2 && m.every((x) => BASES.includes(x)) ? [m[0], m[1]] : ['white', 'black']);
  const herLook = (id, mix) => (id === 'mixed' ? (([a, b]) => mixLook(a, b))(okMix(mix)) : HERITAGE[id][1]);
  const mixName = (mix) => { const [a, b] = okMix(mix); return a === b ? HERITAGE[a][0] : 'Half ' + HERITAGE[a][0] + ', half ' + HERITAGE[b][0]; };
  // Outfits: what she wears. colours as the player sees them (null: as the model was built); arms: gloves | bare | bracers;
  // legs: a stocking colour or null; parts: the model's own extra pieces, shown if it has them; hat: her witch's hat.
  // (batch 22) more fields. cut: what of her suit is bare (anne_next.js setCut; her chest and seat never are); pat / patK:
  // a pattern on the suit / the skirt [kind, colour, size, zone]; sleeve: [colour, length] on her upper arms ('suit' = the
  // suit's colour); arms 'sleeves': the forearm's half of a long sleeve (bandCol), `ends`: a band's own ends; legMake, legCol2,
  // legSize: her stockings' make; metal: cloth of metal; parts: the model's cloth, by name (Skirt, SkirtLong, SkirtTube,
  // SkirtPencil, SkirtMaxi, Tutu, Panels, Apron, Cape, Belt); acc: what wear.js hangs on her; theme: for the lines about it.
  const CUT = { crop: { mid: [1.0, 1.165] }, low: { mid: [0.975, 1.165] }, tank: { neck: 1.335, straps: 0.068 }, cami: { neck: 1.318, straps: 0.058 }, tube: { neck: 1.315 },
    vee: { neck: 1.30, slope: 0.9, back: 9 }, sweet: { neck: 1.325, slope: 0.35, back: 9 }, brief: { leg: 0.86, legSlope: 0.95 } };
  const cut = (...k) => Object.assign({}, ...k.map((n) => CUT[n]));
  const W = '#f4f1ea', K = '#16141a', GOLD = '#e2b532', NAVY = '#1f2a52', RED = '#c4122f', WINE = '#7a0e1d', DENIM = '#2f5fa0';
  const OUTFITS = {
    witch: ['Witch', { arms: 'gloves', hat: true, theme: 'witch' }],
    sorceress: ['Sorceress', { suit: '#5b2a86', skirt: '#32204f', belt: '#221a36', trim: GOLD, glove: '#221a36', choker: '#221a36', hatCol: '#32204f', band: GOLD, arms: 'gloves', legs: '#221a36', legTop: 0.66, hat: true, parts: ['SkirtLong', 'Belt'], theme: 'witch' }],
    adventurer: ['Adventurer', { suit: '#3f6b3a', suit2: '#6a4a2e', split: 0.6, belt: '#4a3220', trim: '#c9a23a', choker: '#6a4a2e', arms: 'bracers', bandCol: '#6a4a2e', hat: false, parts: ['Belt'], theme: 'warrior' }],
    summer: ['Summer dress', { suit: W, trim: '#e9c46a', choker: '#e86fa8', arms: 'bare', hat: false, parts: ['Skirt'], theme: 'casual' }],
    scholar: ['Scholar', { suit: '#f4ece6', skirt: NAVY, belt: K, trim: '#c0c4cc', choker: NAVY, arms: 'bare', legs: '#1d1b26', legTop: 0.52, hat: false, parts: ['SkirtLong', 'Belt'], theme: 'school' }],
    sporty: ['Sporty', { suit: '#19a7a0', suit2: '#f2f2f2', split: 0.6, trim: '#f2f2f2', choker: '#19a7a0', arms: 'bare', hat: false, theme: 'sporty' }],
    rose: ['Rose', { suit: '#d6457a', skirt: '#b83a6a', trim: '#f7b3cc', glove: '#f4ece6', choker: '#f4ece6', hatCol: '#b83a6a', band: '#f7b3cc', arms: 'gloves', legs: '#f4ece6', legTop: 0.6, hat: true, parts: ['Skirt'], theme: 'witch' }],
    midnight: ['Midnight', { suit: K, belt: '#7a55c8', trim: '#7a55c8', glove: K, choker: '#7a55c8', hatCol: K, band: '#7a55c8', arms: 'gloves', legs: K, legTop: 0.7, hat: true, parts: ['SkirtLong', 'Belt'], theme: 'goth' }],
    skater: ['Skater', { suit: K, skirt: RED, belt: K, trim: '#f2f2f2', choker: K, arms: 'bare', legs: K, legTop: 0.5, hat: false, parts: ['Skirt', 'Belt'], theme: 'casual' }],
    // ----- his list (batch 22)
    nerd: ['Nerd girl', { suit: '#7a4a2e', sleeve: [W, 1.05], arms: 'sleeves', bandCol: W, skirt: '#3d5a3a', patK: ['plaid', '#1d2a1c', 0.045], trim: '#c0c4cc', choker: W, legs: W, legTop: 0.5, hat: false, parts: ['Skirt'], acc: [['glasses'], ['collar'], ['tie', { color: WINE }]], theme: 'school' }],
    cheer: ['Cheerleader', { cut: cut('crop'), suit: RED, pat: ['hoops', W, 0.09, 1], skirt: W, trim: RED, choker: W, arms: 'bare', legs: W, legTop: 0.2, hat: false, parts: ['Skirt'], acc: [['hairbow', { color: RED }]], theme: 'sporty' }],
    business: ['Business casual', { suit: W, suit2: '#2b2f3a', split: 0.47, sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', legs: '#2b2f3a', legTop: 0.82, belt: K, trim: '#c0c4cc', choker: '#2b2f3a', hat: false, parts: ['Belt'], acc: [['collar']], theme: 'office' }],
    beach: ['Beach girl', { cut: cut('cami', 'crop', 'brief'), suit: '#19a7a0', pat: ['dots', W, 0.03], trim: W, choker: '#f2cf2b', arms: 'bare', hat: false, acc: [['flower', { color: '#ff5fa8' }]], theme: 'beach' }],
    harem: ['Harem dancer', { cut: cut('tube', 'low'), suit: '#7a55c8', trim: GOLD, choker: GOLD, arms: 'bracers', bandCol: GOLD, ends: [0.72, 0.9], legs: '#b79cf2', legTop: 0.84, legMake: 'sheer', skirt: '#5b2a86', hat: false, parts: ['Panels'], acc: [['sash', { color: GOLD, coins: true }], ['armbands'], ['tiara', { color: GOLD, color2: '#c4122f' }]], theme: 'dancer' }],
    goth: ['Goth girl', { suit: K, skirt: K, trim: '#8a8d96', glove: K, choker: K, arms: 'gloves', legs: K, legTop: 0.74, legMake: 'net', legSize: 0.028, hat: false, parts: ['Skirt', 'Belt'], belt: '#3b1663', theme: 'goth' }],
    armor: ['Bikini armour', { cut: cut('tube', 'crop', 'brief'), suit: '#c9a23a', metal: true, trim: '#8a6a2a', choker: '#8a6a2a', arms: 'bracers', bandCol: '#b08a3a', legs: '#b08a3a', legTop: 0.43, belt: '#6a4a2e', hat: false, parts: ['Belt'], acc: [['pauldrons'], ['tiara', { color: '#c9a23a', color2: '#c4122f' }]], theme: 'warrior' }],
    princess: ['Princess', { cut: cut('sweet'), suit: '#f7b3cc', sleeve: ['suit', 0.38], skirt: '#f7b3cc', trim: W, glove: W, choker: W, arms: 'gloves', hat: false, parts: ['SkirtMaxi'], acc: [['tiara']], theme: 'royal' }],
    gym: ['Gym girl', { cut: cut('tank', 'crop'), suit: '#e8457f', suit2: K, split: 0.47, trim: K, choker: '#e8457f', arms: 'bare', legs: K, legTop: 0.82, hat: false, acc: [['sweatband', { color: '#e8457f' }]], theme: 'sporty' }],
    villain: ['Supervillain', { suit: '#3b1663', sleeve: ['suit', 1.05], glove: K, legs: 'suit', legTop: 0.82, cape: K, belt: GOLD, trim: GOLD, choker: K, arms: 'gloves', hat: false, parts: ['Cape', 'Belt'], acc: [['highcollar', { color: K, color2: '#7a0e1d' }]], theme: 'villain' }],
    fairy: ['Fairy', { cut: cut('cami'), suit: '#6fbf5a', skirt: '#a8e6c0', trim: '#f2cf2b', choker: '#6fbf5a', arms: 'bare', hat: false, parts: ['Tutu'], acc: [['flowercrown'], ['wings_fairy']], theme: 'fairy' }],
    nightwear: ['Satin nightwear', { cut: cut('cami'), suit: '#f7b3cc', suit2: '#f7b3cc', trim: W, choker: W, arms: 'bare', hat: false, theme: 'sleep' }],
    tee: ['T-shirt and sleep shorts', { suit: W, suit2: '#f7b3cc', split: 0.4, sleeve: ['suit', 0.42], trim: W, choker: W, arms: 'bare', hat: false, theme: 'sleep' }],
    sport: ['Sport outfit', { suit: '#2748b8', suit2: W, split: 0.47, pat: ['hoops', W, 0.11, 1], trim: W, choker: '#2748b8', arms: 'bracers', bandCol: W, ends: [0.78, 0.92], legs: W, legTop: 0.3, hat: false, acc: [['sweatband', { color: W }]], theme: 'sporty' }],
    kimono: ['Kimono', { cut: cut('vee'), suit: RED, pat: ['dots', '#f7b3cc', 0.05], sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', skirt: RED, patK: ['dots', '#f7b3cc', 0.05], trim: GOLD, choker: W, hat: false, parts: ['SkirtMaxi'], acc: [['obi', { color: GOLD, color2: WINE }], ['flower', { color: W }]], theme: 'kimono' }],
    towel: ['Bath towel', { cut: cut('tube'), suit: W, skirt: W, trim: W, choker: W, arms: 'bare', hat: false, parts: ['SkirtTube'], theme: 'towel' }],
    maid: ['Maid', { suit: K, sleeve: ['suit', 0.42], skirt: K, apron: W, trim: W, choker: W, arms: 'bracers', bandCol: W, ends: [0.76, 0.93], legs: W, legTop: 0.66, hat: false, parts: ['Skirt', 'Apron'], acc: [['headband', { frill: true }], ['collar']], theme: 'maid' }],
    teacher: ['Teacher', { suit: '#f4ece6', sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', skirt: '#3d2a1e', belt: K, trim: '#c0c4cc', choker: '#3d2a1e', legs: K, legTop: 0.82, legMake: 'sheer', hat: false, parts: ['SkirtPencil', 'Belt'], acc: [['glasses'], ['collar']], theme: 'office' }],
    pajamas: ['Pyjamas', { suit: '#8fc4f0', pat: ['dots', W, 0.04], sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', legs: 'suit', legTop: 0.82, trim: W, choker: '#8fc4f0', hat: false, theme: 'sleep' }],
    croptop: ['Crop top', { cut: cut('crop'), suit: '#ff9a1f', suit2: DENIM, split: 0.47, trim: W, choker: '#ff9a1f', arms: 'bare', hat: false, theme: 'casual' }],
    tanktop: ['Tank top', { cut: cut('tank'), suit: W, suit2: DENIM, split: 0.47, trim: '#c0c4cc', choker: K, arms: 'bare', hat: false, theme: 'casual' }],
    school: ['School girl', { suit: W, sleeve: ['suit', 0.42], skirt: NAVY, trim: NAVY, choker: W, arms: 'bare', legs: W, legTop: 0.5, hat: false, parts: ['Skirt'], acc: [['collar', { color: NAVY }], ['bowtie', { color: RED }]], theme: 'school' }],
    miniskirt: ['Miniskirt', { suit: '#e8457f', sleeve: ['suit', 0.42], skirt: K, trim: K, choker: K, arms: 'bare', hat: false, parts: ['SkirtTube'], theme: 'casual' }],
    shortskirt: ['Short skirt', { cut: cut('tank'), suit: W, skirt: DENIM, trim: W, choker: '#e86fa8', arms: 'bare', hat: false, parts: ['Skirt'], theme: 'casual' }],
    bunny: ['Bunny girl', { cut: cut('tube', 'brief'), suit: K, trim: K, choker: W, arms: 'bracers', bandCol: W, ends: [0.8, 0.93], legs: K, legTop: 0.86, legMake: 'net', legSize: 0.026, hat: false, acc: [['bunnyears', { color: K }], ['tail_bunny'], ['bowtie', { color: K }]], theme: 'bunny' }],
    cheongsam: ['Cheongsam', { suit: RED, pat: ['dots', GOLD, 0.032], sleeve: ['suit', 0.3], skirt: RED, patK: ['dots', GOLD, 0.032], trim: GOLD, choker: RED, arms: 'bare', hat: false, parts: ['SkirtPencil'], acc: [['flower', { color: GOLD }]], theme: 'kimono' }],
    evilqueen: ['Evil queen', { cut: cut('vee'), suit: K, skirt: K, cape: '#3b1663', trim: '#7a55c8', glove: '#3b1663', choker: K, arms: 'gloves', hat: false, parts: ['SkirtMaxi', 'Cape'], acc: [['highcollar', { color: K, color2: '#5b2a86' }], ['spikycrown']], theme: 'royal' }],
    goddess: ['Greek goddess', { cut: cut('tank'), suit: W, skirt: W, belt: GOLD, trim: GOLD, choker: GOLD, arms: 'bare', hat: false, parts: ['SkirtMaxi', 'Belt'], acc: [['laurel'], ['armbands']], theme: 'goddess' }],
    dancer: ['Dancer', { cut: cut('cami', 'brief'), suit: '#f7b3cc', skirt: '#f7d7e3', trim: W, choker: '#f7b3cc', arms: 'bare', legs: W, legTop: 0.87, legMake: 'sheer', hat: false, parts: ['Tutu'], acc: [['hairbow', { color: '#f7b3cc' }]], theme: 'dancer' }],
    blouse: ['Blouse', { suit: W, sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', skirt: '#5c3c26', belt: '#3d2a1e', trim: '#c0c4cc', choker: W, hat: false, parts: ['SkirtLong', 'Belt'], acc: [['collar'], ['bowtie', { color: '#5c3c26' }]], theme: 'office' }],
    gothnight: ['Gothic nightwear', { cut: cut('cami'), suit: K, trim: '#7a55c8', glove: K, choker: '#7a55c8', arms: 'bare', legs: K, legTop: 0.7, legMake: 'net', legSize: 0.03, hat: false, theme: 'goth' }],
    goblin: ['Tribal goblin outfit', { cut: cut('tube', 'low', 'brief'), suit: '#6a4a2e', skirt: '#5c3c26', belt: '#3d2a1e', trim: '#efe6d2', choker: '#3d2a1e', arms: 'bracers', bandCol: '#5c3c26', hat: false, parts: ['Panels', 'Belt'], acc: [['pearls', { teeth: true }], ['armbands', { color: '#efe6d2' }]], theme: 'tribal' }],
    pastel: ['Pastel with laces', { suit: '#f7d7e3', sleeve: ['suit', 0.4], skirt: '#cfe8ff', trim: W, choker: W, arms: 'bare', legs: W, legTop: 0.6, legMake: 'hoops', legCol2: '#f7d7e3', legSize: 0.06, hat: false, parts: ['Tutu'], acc: [['headband', { frill: true }], ['hairbow', { color: '#b79cf2' }]], theme: 'cute' }],
    emo: ['Emo girl', { suit: K, sleeve: ['suit', 0.42], skirt: RED, patK: ['plaid', K, 0.05], belt: K, trim: '#8a8d96', choker: K, arms: 'bracers', bandCol: K, ends: [0.05, 0.93], legs: K, legTop: 0.7, legMake: 'hoops', legCol2: '#7a55c8', legSize: 0.05, hat: false, parts: ['Skirt', 'Belt'], theme: 'goth' }],
    stagebunny: ['Stage bunny girl', { cut: cut('tube', 'brief'), suit: RED, pat: ['dots', GOLD, 0.02], trim: GOLD, choker: W, arms: 'bracers', bandCol: W, ends: [0.8, 0.93], legs: K, legTop: 0.86, legMake: 'net', legSize: 0.026, hat: false, acc: [['bunnyears', { color: W }], ['tail_bunny'], ['bowtie', { color: GOLD }]], theme: 'bunny' }],
    queen: ['Royal queen', { cut: cut('sweet'), suit: WINE, skirt: WINE, cape: '#5b2a86', trim: GOLD, glove: W, choker: GOLD, arms: 'gloves', hat: false, parts: ['SkirtMaxi', 'Cape'], acc: [['crown'], ['pearls']], theme: 'royal' }],
    flight: ['Flight attendant', { suit: NAVY, sleeve: ['suit', 1.05], arms: 'sleeves', bandCol: 'suit', skirt: NAVY, trim: GOLD, choker: W, legs: '#3d2a1e', legTop: 0.82, legMake: 'sheer', hat: false, parts: ['SkirtPencil'], acc: [['cap', { color: NAVY }], ['scarf', { color: RED }]], theme: 'office' }],
    coastal: ['Coastal myth', { cut: cut('tube', 'low'), suit: '#3fb8a8', pat: ['scales', '#149c9c', 0.03], skirt: '#149c9c', patK: ['scales', '#3fb8a8', 0.04], trim: '#f6f1ea', choker: '#f6f1ea', arms: 'bare', hat: false, parts: ['SkirtMaxi'], acc: [['pearls'], ['flower', { color: '#f7b3cc' }], ['armbands', { color: '#f6f1ea' }]], theme: 'beach' }],
    idol: ['J-pop / K-pop idol', { cut: cut('crop'), suit: '#ff5fa8', skirt: K, patK: ['plaid', '#ff5fa8', 0.05], trim: W, choker: K, arms: 'bracers', bandCol: W, ends: [0.72, 0.93], legs: W, legTop: 0.66, hat: false, parts: ['Skirt'], acc: [['hairbow', { color: '#ff5fa8' }]], theme: 'idol' }],
    space: ['Space princess', { cut: cut('tube', 'low', 'brief'), suit: '#c9a23a', metal: true, skirt: WINE, belt: '#c9a23a', trim: '#8a6a2a', choker: '#c9a23a', arms: 'bare', hat: false, parts: ['Panels', 'Belt'], acc: [['armbands']], theme: 'dancer' }],
    outing: ['Evening out', { cut: cut('vee'), suit: WINE, skirt: WINE, belt: K, trim: GOLD, choker: K, arms: 'bare', legs: K, legTop: 0.82, legMake: 'sheer', hat: false, parts: ['SkirtLong', 'Belt'], acc: [['pearls']], theme: 'elegant' }],
  };
  // (batch 23, as he asked: the enemies speak of the outfit itself) what each is called in a line, with its article
  const WEARING = { witch: "a witch's dress", sorceress: "a sorceress's robes", adventurer: "an adventurer's gear", summer: 'a summer dress', scholar: "a scholar's blouse and skirt", sporty: 'a sports suit', rose: "a rose-pink witch's dress",
    midnight: "a midnight witch's dress", skater: 'a skater skirt', nerd: 'a sweater vest and glasses', cheer: "a cheerleader's uniform", business: 'a blouse and slacks', beach: 'a bikini', harem: "a dancer's silks", goth: 'a black goth dress',
    armor: 'bikini armour', princess: "a princess's gown", gym: 'gym clothes', villain: "a villain's suit and cape", fairy: 'a fairy dress', nightwear: 'satin nightwear', tee: 'a T-shirt and sleep shorts', sport: 'a track uniform', kimono: 'a kimono',
    towel: 'a bath towel', maid: "a maid's uniform", teacher: "a teacher's blouse and skirt", pajamas: 'pyjamas', croptop: 'a crop top', tanktop: 'a tank top', school: 'a school uniform', miniskirt: 'a miniskirt', shortskirt: 'a short skirt',
    bunny: 'a bunny suit', cheongsam: 'a cheongsam', evilqueen: "an evil queen's gown", goddess: "a goddess's robes", dancer: 'a ballet tutu', blouse: 'a blouse and skirt', gothnight: 'gothic nightwear', goblin: "a goblin's leathers",
    pastel: 'pastel lace', emo: 'an emo outfit', stagebunny: 'a sparkling bunny suit', queen: "a queen's gown", flight: "a flight attendant's uniform", coastal: "a mermaid's dress", idol: "an idol's stage outfit", space: 'a golden two-piece',
    outing: 'an evening dress' };
  // the tab's own order: by kind
  const OUTFIT_GROUPS = [['Witchcraft', ['witch', 'sorceress', 'rose', 'midnight', 'adventurer']], ['Everyday', ['summer', 'skater', 'croptop', 'tanktop', 'miniskirt', 'shortskirt', 'blouse', 'outing']],
    ['School and work', ['scholar', 'nerd', 'school', 'teacher', 'business', 'flight', 'maid']], ['Sport and stage', ['sporty', 'sport', 'gym', 'cheer', 'dancer', 'idol']],
    ['Dark', ['goth', 'emo', 'gothnight', 'villain']], ['Crowns', ['princess', 'queen', 'evilqueen', 'goddess']], ['Far away', ['kimono', 'cheongsam', 'harem', 'space', 'coastal', 'fairy', 'goblin', 'armor', 'pastel']],
    ['Bunnies', ['bunny', 'stagebunny']], ['Beach and bedtime', ['beach', 'towel', 'nightwear', 'tee', 'pajamas']]];
  const OUTFIT_ORDER = OUTFIT_GROUPS.flatMap((g) => g[1]);
  const SUIT_COLS = [['As designed', ''], ['Orange', '#f2a516'], ['Red', '#c4122f'], ['Rose', '#d6457a'], ['Violet', '#5b2a86'], ['Navy', '#1f2a52'], ['Royal blue', '#2748b8'], ['Teal', '#19a7a0'],
    ['Forest green', '#3f6b3a'], ['Mint', '#6fe3b2'], ['Brown', '#6a4a2e'], ['White', '#f4f1ea'], ['Grey', '#8a8d96'], ['Black', '#16141a']];
  const HAIR_WORD = { auburn: 'redheaded', copper: 'redheaded', ginger: 'redheaded', red: 'redheaded', black: 'raven-haired', 'soft black': 'raven-haired', 'dark brown': 'brunette', brown: 'brunette',
    chestnut: 'brunette', 'strawberry blonde': 'blonde', 'golden blonde': 'blonde', platinum: 'blonde', silver: 'silver-haired', white: 'white-haired' };
  const SOLE_WORD = ['porcelain', 'ivory', 'fair', 'creamy', 'peachy', 'honey', 'golden', 'sun-kissed', 'caramel', 'bronze', 'cocoa', 'mahogany', 'espresso', 'ebony'];
  const PART_NAMES = ['Skirt', 'SkirtLong', 'SkirtTube', 'SkirtPencil', 'SkirtMaxi', 'Tutu', 'Panels', 'Apron', 'Cape', 'Belt'];
  // (the suit's own span in the rest pose, for the height an outfit's second colour starts at: `split` is a share of it)
  let suitSpan = [0.78, 1.36];
  { const s = anne.getObjectByName('Anne_Suit'); if (s) s.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.boundingBox === null) o.geometry.computeBoundingBox(); if (o.isMesh && o.geometry && o.geometry.boundingBox) suitSpan = [o.geometry.boundingBox.min.y, o.geometry.boundingBox.max.y]; }); }

  // ---------- her look: the state, kept and put on her ----------
  const BODY = { w: [0.9, 1.12], h: [0.92, 1.08] };      // (batch 23) how far her body's width and length (her height) may go from the built ones
  const DEFAULT = () => ({ name: 'Anne', heritage: 'white', mix: ['white', 'black'], species: 'human', skin: '#fde9e3', eyes: '', hair: '', hairStyle: '', lids: 'almond', shape: {}, outfit: 'witch', suit: '', hat: null, legwear: null, body: { w: 1, h: 1 } });
  const cleanName = (v) => String(v || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  function load() {
    const L = DEFAULT();
    try {
      let v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (env.qp && env.qp.has('lk')) v = Object.assign(v || {}, JSON.parse(env.qp.get('lk')));      // (tests: ?lk={"heritage":"black","name":"Zara"} over the kept look; a heritage alone fills in its colours and face)
      if (v && v.species && SPECIES[v.species] && env.qp && env.qp.has('lk') && v.skin === undefined && v.heritage === undefined) { const Sp = SPECIES[v.species][1]; v = Object.assign({}, Sp.skin ? { skin: Sp.skin } : {}, Sp.eyes ? { eyes: Sp.eyes } : {}, Sp.hair ? { hair: Sp.hair } : {}, v); }
      if (v && v.heritage && HERITAGE[v.heritage] && env.qp && env.qp.has('lk') && v.skin === undefined) { const H = herLook(v.heritage, v.mix); v = Object.assign({ skin: H.skin, eyes: H.eyes, hair: H.hair, lids: H.lids, shape: Object.assign({}, H.face) }, v); }
      if (v && typeof v === 'object') {
        if (cleanName(v.name)) L.name = cleanName(v.name);
        if (HERITAGE[v.heritage]) L.heritage = v.heritage;
        L.mix = okMix(v.mix);
        if (SPECIES[v.species]) L.species = v.species;
        if (HEX.test(v.skin)) L.skin = v.skin;
        if (v.eyes === '' || HEX.test(v.eyes)) L.eyes = v.eyes;
        if (v.hair === '' || HEX.test(v.hair)) L.hair = v.hair;
        if (typeof v.hairStyle === 'string') L.hairStyle = v.hairStyle;
        if (LIDS[v.lids]) L.lids = v.lids;
        if (v.shape && typeof v.shape === 'object') for (const k in v.shape) if (/^shape-[a-z-]+$/.test(k) && isFinite(v.shape[k])) L.shape[k] = Math.max(-1.5, Math.min(1.5, +v.shape[k]));
        if (OUTFITS[v.outfit]) L.outfit = v.outfit;
        if (v.suit === '' || HEX.test(v.suit)) L.suit = v.suit;
        if (v.hat === true || v.hat === false) L.hat = v.hat;
        if (v.legwear === false) L.legwear = false;
        if (v.body && typeof v.body === 'object') L.body = { w: Math.max(BODY.w[0], Math.min(BODY.w[1], +v.body.w || 1)), h: Math.max(BODY.h[0], Math.min(BODY.h[1], +v.body.h || 1)) };
      }
    } catch (e) { /* no saved look */ }
    return L;
  }
  let L = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { /* private mode */ } };
  const hairStyles = () => (A.hairStyles ? A.hairStyles() : []);
  const has = (node) => !!anne.getObjectByName(node);
  // put a look on her (the kept one, or one being tried)
  let lookStamp = null;                              // (set below: her portraits are made afresh when her look changes)
  const wear = createWear({ THREE, A, anne });
  const HAIR_BUILT = '#a9571f', SUIT_BUILT = '#f2a516';
  function apply(look = L) {
    if (!A.setSkinTone) return;
    if (lookStamp) lookStamp();
    const Sp = (SPECIES[look.species] || SPECIES.human)[1];
    A.setSkinTone(look.skin); A.setEyeColor(look.eyes || null); A.setHairColor(look.hair || null);
    const hs = hairStyles(), style = hs.find((x) => x.id === look.hairStyle) || hs[0];
    if (style) A.setHairStyle(style.id);
    A.setShape(Object.assign({}, look.shape || {}, Sp.shape || {})); A.setLidBias((LIDS[look.lids] || LIDS.almond)[1]);
    if (A.setSkinFinish) { A.setSkinFinish(Sp.finish || {}); A.setGlow(...(Sp.glow || [null, 0])); }
    const O = (OUTFITS[look.outfit] || OUTFITS.witch)[1], suit = look.suit || O.suit || null;
    const C = (v) => (v === 'suit' ? (suit || SUIT_BUILT) : v) || null;      // ('suit': whatever colour the suit has now)
    A.setOutfitColors({ suit, suit2: O.suit2 || null, split: O.split ? suitSpan[0] + (suitSpan[1] - suitSpan[0]) * O.split : 0, trim: O.trim || null, glove: O.glove || null, choker: O.choker || null, hat: O.hatCol || null, band: O.band || null,
      skirt: (look.suit && (!O.skirt || O.skirt === O.suit) ? look.suit : O.skirt) || suit, belt: O.belt || null, apron: O.apron || null, cape: O.cape || null });      // (a skirt with no colour of its own is the suit's: a dress)
    const legs = look.legwear === false ? null : C(O.legs);      // (batch 23: her legwear can be left off any outfit that has some)
    A.setArms(O.arms || 'gloves', C(O.bandCol), O.ends || null); A.setLegs(legs, O.legTop || 0.62, O.legMake || null, O.legCol2 || null, O.legSize || 0.03);
    if (A.setBody) { A.setBody((look.body && look.body.w) || 1, (look.body && look.body.h) || 1); if (wear.refit) wear.refit(); }
    if (A.setCut) {
      A.setCut(O.cut || {}); A.setSleeves(O.sleeve ? C(O.sleeve[0]) : null, O.sleeve ? O.sleeve[1] : 1.05); A.setSuitFinish({ metal: !!O.metal });
      A.setPattern('suit', ...(O.pat || [null])); A.setPattern('skirt', ...(O.patK || [null]));
      A.setTrimLow(legs && (O.legTop || 0.62) > 0.79 ? 0.85 : 0);      // (trousers and tights: no bead where they meet the suit)
    }
    const parts = {}; for (const n of PART_NAMES) { const on = (O.parts || []).includes(n); parts['Anne_' + n] = on; parts['Anne_' + n + 'Trim'] = on; } A.setParts(parts);
    // what hangs on her: her species' own (in her hair's colour where it is fur) and her outfit's
    const hairCss = look.hair || HAIR_BUILT;
    wear.set([...(Sp.acc || []), ...(O.acc || [])].map(([id, o]) => [id, Object.assign(/^(catears|tail_cat)$/.test(id) ? { hair: hairCss } : {}, o || {})]));
    // her hat: the outfit's word, unless the player has said otherwise; never over a hairstyle that does not go under it, nor over horns, ears, a halo or a crown
    const hat = (look.hat === null || look.hat === undefined ? O.hat !== false : look.hat) && !(style && style.hat === false) && !wear.top();
    A.setHatWorn(hat);
    if (env.onHat) env.onHat({ worn: hat, hat: O.hatCol || null, band: O.band || null });      // (the loose hat of the scenes: the same one)
  }
  const customized = () => { const D = DEFAULT(); const hs = hairStyles(); return L.species !== 'human' || L.skin !== D.skin || L.eyes !== '' || L.hair !== '' || (L.hairStyle && hs.length && L.hairStyle !== hs[0].id) || L.lids !== 'almond' || Object.values(L.shape).some((v) => Math.abs(v) > 0.02) || L.outfit !== 'witch' || L.suit !== '' || L.hat === false || L.legwear === false || Math.abs((L.body || {}).w - 1) > 0.01 || Math.abs((L.body || {}).h - 1) > 0.01; };

  // ---------- the panel ----------
  const css = document.createElement('style');
  css.textContent = `
  #cc { position: fixed; left: 16px; top: 16px; bottom: 16px; width: 348px; display: none; flex-direction: column; gap: 8px; padding: 12px 12px 10px; box-sizing: border-box; z-index: 6;
    border-radius: 12px; background: rgba(24, 12, 44, .93); border: 1px solid #d8b455; color: #f4e9d8; font: 14px Georgia, 'Times New Roman', serif; box-shadow: 0 6px 22px rgba(0,0,0,.55); }
  #cc .cc-title { font-size: 19px; color: #f0cf6a; text-align: center; letter-spacing: .04em; }
  #cc .cc-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  #cc .cc-tabs b { font-weight: normal; text-align: center; padding: 6px 2px; border-radius: 8px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.06); cursor: pointer; font-size: 13px; }
  #cc .cc-tabs b:hover { background: rgba(255,255,255,.18); }
  #cc .cc-tabs b.on { border-color: #f0cf6a; background: #5a2d91; }
  #cc .cc-body { flex: 1; overflow-y: auto; padding: 2px 2px 4px; min-height: 0; }
  #cc .cc-pane { display: none; flex-direction: column; gap: 8px; }
  #cc .cc-pane.on { display: flex; }
  #cc .cc-h { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #f0cf6a; margin-top: 4px; }
  #cc .cc-note { font-size: 12.5px; line-height: 1.35; opacity: .82; }
  #cc .cc-row { display: grid; grid-template-columns: repeat(7, 34px); gap: 8px; justify-content: start; }
  #cc .cc-row i { display: block; width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255,255,255,.5); cursor: pointer; box-sizing: border-box; }
  #cc .cc-row i.on { border-color: #f0cf6a; box-shadow: 0 0 0 2px #f0cf6a; }
  #cc .cc-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  #cc .cc-pills b { font-weight: normal; padding: 6px 11px; border-radius: 14px; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.07); cursor: pointer; }
  #cc .cc-pills b:hover { background: rgba(255,255,255,.2); }
  #cc .cc-pills b.on { border-color: #f0cf6a; background: #5a2d91; }
  #cc .cc-sl { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 8px; }
  #cc .cc-sl input { width: 100%; accent-color: #d8b455; }
  #cc input[type=text] { all: unset; box-sizing: border-box; width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.45); background: rgba(0,0,0,.28); font: 17px Georgia, serif; color: #fff; }
  #cc .cc-cap { min-height: 18px; text-align: center; font-size: 13px; color: #f0cf6a; }
  #cc .cc-foot { display: flex; gap: 8px; align-items: center; }
  #cc .cc-foot .btn { margin: 0; flex: 1; text-align: center; padding: 9px 20px; border: 1px solid #d8b455; border-radius: 6px; background: #5a2d91; color: #fff; font-size: 16px; cursor: pointer; }
  #cc .cc-foot .btn:hover { background: #6d3aab; }
  #cc .cc-foot span { cursor: pointer; font-size: 12.5px; opacity: .75; text-decoration: underline; padding: 0 4px; }
  #cc #nails { position: static; display: flex; width: auto; max-height: none; overflow: visible; background: none; border: 0; padding: 0; box-shadow: none; }
  #cc #nails .nl-title, #cc #nails #nl-go { display: none; }
  @media (max-width: 760px) { #cc { width: 300px; left: 8px; top: 8px; bottom: 8px; } #cc .cc-row { grid-template-columns: repeat(6, 34px); } }`;
  document.head.appendChild(css);
  const mk = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const box = mk('div', '', document.body); box.id = 'cc';
  const titleEl = mk('div', 'cc-title', box), tabsEl = mk('div', 'cc-tabs', box), bodyEl = mk('div', 'cc-body', box), capEl = mk('div', 'cc-cap', box), footEl = mk('div', 'cc-foot', box);
  const resetEl = mk('span', '', footEl, 'Start over'), goEl = mk('div', 'btn', footEl, 'Start');
  box.addEventListener('pointerdown', (e) => e.stopPropagation()); box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('keydown', (e) => e.stopPropagation()); box.addEventListener('keyup', (e) => e.stopPropagation());
  box.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  const TABS = [['name', 'Name'], ['heritage', 'Heritage'], ['species', 'Species'], ['body', 'Body'], ['skin', 'Skin'], ['face', 'Face'], ['eyes', 'Eyes'], ['hair', 'Hair'], ['outfit', 'Outfit'], ['feet', 'Feet']];
  const panes = {}, tabBtn = {};
  for (const [id, label] of TABS) { tabBtn[id] = mk('b', '', tabsEl, label); tabBtn[id].addEventListener('click', () => show(id)); panes[id] = mk('div', 'cc-pane', bodyEl); }
  let cap = '';
  const say = (t) => { capEl.textContent = t || cap; };
  // a round swatch: tried on at once under the pointer, kept by a click
  const marks = [];                                  // functions that mark what is chosen
  function swatches(parent, list, get, tryOn, pick) {
    const row = mk('div', 'cc-row', parent);
    for (const [name, hex] of list) {
      const e = mk('i', '', row); e.style.background = hex || 'linear-gradient(135deg, #c9a 50%, #654 50%)'; e.title = name; e.dataset.c = hex;
      e.addEventListener('pointerenter', () => { tryOn(hex); say(name); });
      e.addEventListener('pointerleave', () => { apply(); say(); });
      e.addEventListener('click', () => { pick(hex); save(); apply(); markAll(); });
    }
    marks.push(() => { for (const e of row.children) e.classList.toggle('on', e.dataset.c === get()); });
    return row;
  }
  function pills(parent, list, get, tryOn, pick) {
    const row = mk('div', 'cc-pills', parent);
    for (const [id, label] of list) {
      const e = mk('b', '', row, label); e.dataset.s = id;
      e.addEventListener('pointerenter', () => { tryOn(id); say(label); });
      e.addEventListener('pointerleave', () => { apply(); say(); });
      e.addEventListener('click', () => { pick(id); save(); apply(); markAll(); });
    }
    marks.push(() => { for (const e of row.children) e.classList.toggle('on', e.dataset.s === get()); });
    return row;
  }
  function slider(parent, key, label, lo, hi) {
    const row = mk('div', 'cc-sl', parent); mk('span', '', row, label);
    const inp = mk('input', '', row); inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = 0.05;
    inp.addEventListener('input', () => { L.shape[key] = +inp.value; if (Math.abs(L.shape[key]) < 0.03) delete L.shape[key]; apply(); });
    inp.addEventListener('change', () => { save(); });
    marks.push(() => { inp.value = L.shape[key] || 0; });
  }
  const withLook = (patch) => Object.assign({}, L, patch);
  const markAll = () => { for (const f of marks) f(); cap = summary(); say(); titleEl.textContent = L.name === 'Anne' ? 'Make her yours' : 'Make ' + L.name + ' yours'; if (env.onName) env.onName(L.name); };
  const nameOf = (list, hex, d) => { const f = list.find((x) => x[1] === hex); return f ? f[0] : d; };
  const summary = () => `${L.name} · ${nameOf(SKINS, L.skin, 'her own').toLowerCase()} skin · ${nameOf(HAIRS, L.hair, 'auburn').toLowerCase()} hair · ${(OUTFITS[L.outfit] || OUTFITS.witch)[0].toLowerCase()}`;

  // ----- Name
  { const p = panes.name; mk('div', 'cc-h', p, 'Her name');
    const inp = mk('input', '', p); inp.type = 'text'; inp.maxLength = 14; inp.spellcheck = false; inp.autocomplete = 'off';
    inp.addEventListener('input', () => { const v = cleanName(inp.value); L.name = v || 'Anne'; save(); markAll(); });
    inp.addEventListener('blur', () => { inp.value = L.name; });
    marks.push(() => { if (document.activeElement !== inp) inp.value = L.name; });
    mk('div', 'cc-note', p, 'Everyone in the story will know her by this name.');
    mk('div', 'cc-note', p, 'Then go through the tabs: a heritage to start from, her skin, face, eyes, hair, outfit, shoes and toenails. Drag the picture to turn her round.'); }
  // ----- Heritage: a starting point
  { const p = panes.heritage; mk('div', 'cc-h', p, 'A heritage to start from');
    const look = (id, mix = L.mix) => { const H = herLook(id, mix); return withLook({ heritage: id, mix: okMix(mix), skin: H.skin, eyes: H.eyes, hair: H.hair, lids: H.lids, shape: Object.assign({}, H.face) }); };
    pills(p, HERITAGE_ORDER.map((id) => [id, HERITAGE[id][0]]), () => L.heritage, (id) => apply(look(id)), (id) => { L = look(id); });
    // "Mixed": which two (shown while it is the one picked). Every pairing of the seven is there.
    const mixBox = mk('div', '', p); mixBox.style.cssText = 'display:none;flex-direction:column;gap:8px';
    mk('div', 'cc-h', mixBox, 'Half');
    pills(mixBox, BASES.map((id) => [id, HERITAGE[id][0]]), () => L.mix[0], (id) => apply(look('mixed', [id, L.mix[1]])), (id) => { L = look('mixed', [id, L.mix[1]]); });
    mk('div', 'cc-h', mixBox, 'And half');
    pills(mixBox, BASES.map((id) => [id, HERITAGE[id][0]]), () => L.mix[1], (id) => apply(look('mixed', [L.mix[0], id])), (id) => { L = look('mixed', [L.mix[0], id]); });
    const mixCap = mk('div', 'cc-note', mixBox, '');
    marks.push(() => { mixBox.style.display = L.heritage === 'mixed' ? 'flex' : 'none'; mixCap.textContent = mixName(L.mix) + '.'; });
    mk('div', 'cc-note', p, 'It only fills in the other tabs: a skin tone, eye and hair colours, the lines of her face. Change any of them afterwards as you like; every skin tone goes with every one of these.'); }
  // ----- Species (batch 22): what she is. A species with colours of its own suggests them once; they stay free to change.
  { const p = panes.species; mk('div', 'cc-h', p, 'What she is');
    const look = (id) => { const was = (SPECIES[L.species] || SPECIES.human)[1], Sp = SPECIES[id][1], H = herLook(L.heritage, L.mix), o = { species: id };
      for (const k of ['skin', 'eyes', 'hair']) { if (Sp[k]) o[k] = Sp[k]; else if (was[k] && L[k] === was[k]) o[k] = H[k]; }      // (leaving a species gives back what it had suggested)
      return withLook(o); };
    pills(p, SPECIES_ORDER.map((id) => [id, SPECIES[id][0]]), () => L.species, (id) => apply(look(id)), (id) => { L = look(id); });
    mk('div', 'cc-note', p, 'Wings, horns, ears, a tail or a halo come with it; a hat does not go over horns, ears or a halo. Some suggest a skin tone, eyes and hair of their own: change them on their tabs as you like (the Skin tab has tones for every kind).'); }
  // ----- Body (batch 23, as he asked): her body's width and its length
  { const p = panes.body; mk('div', 'cc-h', p, 'Her body');
    const row = (key, label, lo, hi) => { const r = mk('div', 'cc-sl', p); mk('span', '', r, label); const inp = mk('input', '', r); inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = 0.01;
      inp.addEventListener('input', () => { L.body = Object.assign({ w: 1, h: 1 }, L.body, { [key]: +inp.value }); apply(); });
      inp.addEventListener('change', () => { save(); markAll(); });
      marks.push(() => { inp.value = (L.body && L.body[key]) || 1; }); };
    row('w', 'Width', BODY.w[0], BODY.w[1]); row('h', 'Length', BODY.h[0], BODY.h[1]);
    mk('div', 'cc-note', p, 'Width: slimmer or fuller, from her shoulders to her calves (her head, hands and feet keep their size). Length: shorter or taller.');
    const rs = mk('div', 'cc-pills', p), b = mk('b', '', rs, 'As built'); b.addEventListener('click', () => { L.body = { w: 1, h: 1 }; save(); apply(); markAll(); }); }
  // ----- Skin
  { const p = panes.skin; mk('div', 'cc-h', p, 'Skin tone');
    swatches(p, SKINS, () => L.skin, (hex) => apply(withLook({ skin: hex })), (hex) => { L.skin = hex; });
    mk('div', 'cc-h', p, 'Other kinds');
    swatches(p, SKINS2, () => L.skin, (hex) => apply(withLook({ skin: hex })), (hex) => { L.skin = hex; }); }
  // ----- Face: the model's shapes as sliders
  { const p = panes.face;
    const have = (A.shapes ? A.shapes() : []), mine = Object.keys(SHAPE_UI).filter((k) => have.includes(k));
    if (mine.length) {                                   // (batch 22) ready-made shapes: they set the sliders below
      mk('div', 'cc-h', p, 'A shape to start from');
      const face = (id) => { const P = FACE_PRESETS.find((x) => x[0] === id)[2], sh = {}; for (const k in L.shape) if (!SHAPE_UI[k]) sh[k] = L.shape[k]; for (const k in P) if (have.includes(k)) sh[k] = P[k]; return withLook({ shape: sh }); };
      const now = () => { const f = FACE_PRESETS.find((x) => Object.keys(SHAPE_UI).every((k) => Math.abs((L.shape[k] || 0) - (x[2][k] || 0)) < 0.04)); return f ? f[0] : ''; };
      pills(p, FACE_PRESETS.map((x) => [x[0], x[1]]), now, (id) => apply(face(id)), (id) => { L = face(id); });
    }
    mk('div', 'cc-h', p, 'The lines of her face');
    if (mine.length) for (const k of mine) slider(p, k, ...SHAPE_UI[k]);
    else mk('div', 'cc-note', p, 'This model has one face shape.');
    const bases = BASE_SHAPES.filter((k) => have.includes(k));
    if (bases.length) { mk('div', 'cc-h', p, 'Build'); for (const k of bases) slider(p, k, k === 'shape-base-asian' ? 'East Asian' : 'African', 0, 1); mk('div', 'cc-note', p, 'The underlying structure of her face (a heritage sets these).'); } }
  // ----- Eyes
  { const p = panes.eyes; mk('div', 'cc-h', p, 'Eye colour');
    swatches(p, EYES.map(([n, h]) => [n, h]), () => L.eyes, (hex) => apply(withLook({ eyes: hex })), (hex) => { L.eyes = hex; });
    for (const e of p.querySelectorAll('.cc-row i')) if (!e.dataset.c) e.style.background = '#3f8ee8';
    mk('div', 'cc-h', p, 'Their set');
    pills(p, Object.keys(LIDS).map((id) => [id, LIDS[id][0]]), () => L.lids, (id) => apply(withLook({ lids: id })), (id) => { L.lids = id; });
    const have = (A.shapes ? A.shapes() : []), mine = Object.keys(EYE_SHAPE_UI).filter((k) => have.includes(k));
    for (const k of mine) slider(p, k, ...EYE_SHAPE_UI[k]); }
  // ----- Hair
  { const p = panes.hair, hs = hairStyles();
    if (hs.length > 1) { mk('div', 'cc-h', p, 'Style'); pills(p, hs.map((x) => [x.id, x.label || x.id]), () => (hs.find((x) => x.id === L.hairStyle) || hs[0]).id, (id) => apply(withLook({ hairStyle: id })), (id) => { L.hairStyle = id; }); }
    mk('div', 'cc-h', p, 'Colour');
    swatches(p, HAIRS, () => L.hair, (hex) => apply(withLook({ hair: hex })), (hex) => { L.hair = hex; });
    for (const e of p.querySelectorAll('.cc-row i')) if (!e.dataset.c) e.style.background = '#a9571f'; }
  // ----- Outfit
  { const p = panes.outfit;
    for (const [title, ids] of OUTFIT_GROUPS) { mk('div', 'cc-h', p, title);
      pills(p, ids.map((id) => [id, OUTFITS[id][0]]), () => L.outfit, (id) => apply(withLook({ outfit: id, suit: '', hat: null })), (id) => { L.outfit = id; L.suit = ''; L.hat = null; }); }
    mk('div', 'cc-h', p, 'Its main colour');
    swatches(p, SUIT_COLS, () => L.suit, (hex) => apply(withLook({ suit: hex })), (hex) => { L.suit = hex; });
    mk('div', 'cc-h', p, 'Her hat');
    const hatNow = () => { const O = (OUTFITS[L.outfit] || OUTFITS.witch)[1]; return (L.hat === null ? O.hat !== false : L.hat) ? 'on' : 'off'; };
    pills(p, [['on', "Witch's hat"], ['off', 'No hat']], hatNow, (id) => apply(withLook({ hat: id === 'on' })), (id) => { L.hat = id === 'on'; });
    // (batch 23, as he asked) her legwear: stockings, tights, leggings, trousers, greaves. Any outfit that has some can go without.
    mk('div', 'cc-h', p, 'Her legwear');
    const legRow = pills(p, [['on', 'As the outfit has it'], ['off', 'Bare legs']], () => (L.legwear === false ? 'off' : 'on'), (id) => apply(withLook({ legwear: id === 'off' ? false : null })), (id) => { L.legwear = id === 'off' ? false : null; });
    const legNote = mk('div', 'cc-note', p, '');
    marks.push(() => { const has = !!(OUTFITS[L.outfit] || OUTFITS.witch)[1].legs; legRow.style.opacity = has ? 1 : 0.45; legNote.textContent = has ? '' : 'This outfit has no legwear of its own.'; });
    mk('div', 'cc-note', p, 'She is always dressed: an outfit changes what she wears, never whether. A hat does not go over ears, horns, a halo or a crown.'); }
  // ----- Feet: her shoes and toenails (index.html's rows, as before)
  { const n = $('nails'); if (n) panes.feet.appendChild(n); }
  resetEl.addEventListener('click', () => { const name = L.name; L = DEFAULT(); L.name = name; save(); apply(); markAll(); });

  // ---------- the camera and her pose, by tab ----------
  const VIEW = { name: 'body', heritage: 'bust', species: 'body', body: 'body', skin: 'bust', face: 'face', eyes: 'face', hair: 'hair', outfit: 'body', feet: 'feet' };
  let openNow = false, tab = 'name', then = null, base = null, lastTab = 'name';
  function pinFor(view) {
    const { p, h } = base, fx = Math.sin(h), fz = Math.cos(h), eye = ((A.metrics && A.metrics.eyeHeight) || 1.58) * ((L.body && L.body.h) || 1);
    const at = (f, l, u) => [p.x + fx * f + fz * l, p.y + u, p.z + fz * f - fx * l];      // (forward of her, to her left, up)
    // the panel covers the left of the picture: the camera looks past her right side, so that she stands right of the middle
    if (view === 'face') return [[...at(0.7, 0.2, eye - 0.01), ...at(0, -0.075, eye - 0.035)], 26];
    if (view === 'bust') return [[...at(1.05, 0.3, eye - 0.06), ...at(0, -0.13, eye - 0.16)], 30];
    if (view === 'hair') return [[...at(1.5, 0.75, eye - 0.1), ...at(0, -0.2, eye - 0.3)], 32];
    return [[...at(3.0, 0.75, 1.0), ...at(0, -0.42, 0.88)], 34];
  }
  function show(id) {
    if (!panes[id]) id = 'name';
    const was = tab; tab = id; lastTab = id;
    for (const k in panes) { panes[k].classList.toggle('on', k === id); tabBtn[k].classList.toggle('on', k === id); }
    if (!openNow) return;
    if (VIEW[id] === 'feet') { if (env.feetPose) env.feetPose(true); }
    else {
      if (VIEW[was] === 'feet' || !env.pinned()) { if (env.feetPose) env.feetPose(false); A.releaseClips(); A.setExpression('smile', 0.15); }
      const [pin, fov] = pinFor(VIEW[id]); env.pin(pin, fov);
    }
    apply(); markAll();
  }
  // drag the picture: she turns round where she stands
  let drag = null;
  const el = env.canvas;
  el.addEventListener('pointerdown', (e) => { if (openNow && VIEW[tab] !== 'feet') drag = { x: e.clientX, h: env.heading() }; });
  addEventListener('pointermove', (e) => { if (drag && openNow) env.setHeading(drag.h + (e.clientX - drag.x) * 0.012); });
  addEventListener('pointerup', () => { drag = null; });
  function open(done, startTab) {
    if (openNow) return;
    openNow = true; then = done || null; base = { p: anne.position.clone(), h: env.heading() };
    if (env.feetRows) env.feetRows();
    box.style.display = 'flex'; const s = $('start'); if (s) s.style.display = 'none';
    show(startTab || lastTab); console.log('LOOKS open ' + tab);
  }
  function close() {
    if (!openNow) return;
    openNow = false; box.style.display = 'none'; drag = null;
    if (env.feetPose) env.feetPose(false);
    env.setHeading(base.h); env.unpin(); A.releaseClips(); A.setExpression('neutral'); apply(); save();
    warm();
    console.log('LOOKS done ' + JSON.stringify({ name: L.name, skin: L.skin, outfit: L.outfit }));
    const f = then; then = null; if (f) f();
  }
  goEl.addEventListener('click', close);

  // ---------- her portraits, made of her as she is ----------
  // The story's dialogue portraits are drawn ones of the look she was built with. Once the player has changed her look, a
  // portrait is a small picture of HER face in the line's expression: taken by a camera of its own in front of her head
  // (wherever her head is, and upright by it), under two lights of its own (so a cave or the night gives the same
  // portrait as the camp), on the corner inset's backdrop. Each is made once, when a line first needs it, and kept until
  // her look changes or her hat goes on or off.
  const pCam = new THREE.PerspectiveCamera(31, 1, 0.05, 6); pCam.layers.set(2);
  const key = new THREE.DirectionalLight(0xfff0e2, 3.5), fill = new THREE.HemisphereLight(0xe6ecff, 0x7a6658, 1.6);
  key.layers.set(2); fill.layers.set(2); key.castShadow = false; scene.add(key, key.target, fill);
  anne.traverse((o) => o.layers.enable(2));
  const cache = new Map(), headM = anne.getObjectByName('Marker_Head'); let version = 0;
  const _h = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  function portrait(expr = 'neutral', blush = 0) {
    if (!post.portrait || !headM || !A.snapFace || !customized()) return null;
    const hat = !!(A.debug().hat && A.hatWorn()), k = [version, expr, Math.round(blush * 3), hat ? 1 : 0].join('|');
    if (cache.has(k)) return cache.get(k);
    anne.updateMatrixWorld(true);
    headM.getWorldPosition(_h); headM.getWorldQuaternion(_q);
    _f.set(0, 0, 1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q); _s.crossVectors(_u, _f).normalize();      // her head's own front, up and left
    pCam.position.copy(_h).addScaledVector(_f, 0.74).addScaledVector(_s, 0.2).addScaledVector(_u, -0.13); pCam.up.copy(_u);
    pCam.lookAt(_h.x - _u.x * 0.035, _h.y - _u.y * 0.035, _h.z - _u.z * 0.035); pCam.updateMatrixWorld(true);
    key.position.copy(_h).addScaledVector(_f, 1.2).addScaledVector(_s, 0.7).addScaledVector(_u, 0.9); key.target.position.copy(_h); key.target.updateMatrixWorld(true); key.updateMatrixWorld(true);
    A.snapFace(expr, blush);
    const shot = post.portrait(pCam), n = shot.size, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const cx = cv.getContext('2d'), img = cx.createImageData(n, n), row = n * 4;
    for (let y = 0; y < n; y++) img.data.set(shot.pixels.subarray((n - 1 - y) * row, (n - y) * row), y * row);      // (GL's rows run upwards)
    cx.putImageData(img, 0, 0);
    if (cache.size > 60) cache.clear();
    cache.set(k, cv); return cv;
  }
  lookStamp = () => { version++; cache.clear(); };
  // (the first portrait compiles her materials for its two lights: done here and when the panel closes, not in the middle of a line)
  function warm() { try { if (customized()) portrait('neutral', 0); } catch (e) { /* made when a line first needs it */ } }
  markAll(); apply(); warm();
  return {
    open, close, apply, portrait, isOpen: () => openNow, name: () => L.name, state: () => JSON.parse(JSON.stringify(L)), customized, goLabel: (t) => { goEl.textContent = t; },
    // words for the lines that speak of her looks: her hair ('auburn'; hairWord 'redheaded'), her skin ('caramel'; soleWord for
    // her soles; pale: whether "pale" is a word for her), her outfit, whether she wears her hat
    lookWords: () => { const hair = nameOf(HAIRS, L.hair, 'auburn').toLowerCase(), si = SKINS.findIndex((x) => x[1] === L.skin);
      const O = OUTFITS[L.outfit] || OUTFITS.witch, s2 = SKINS2.find((x) => x[1] === L.skin);
      return { hair, hairWord: HAIR_WORD[hair] || (hair + '-haired'), skin: (s2 ? s2[0] : nameOf(SKINS, L.skin, '')).toLowerCase(), skinDeep: si, soleWord: s2 ? s2[0].toLowerCase() : (SOLE_WORD[si] || 'soft'), pale: s2 ? false : si < 5, fantasy: !!s2,
        outfit: L.outfit, outfitName: O[0].toLowerCase(), wearing: WEARING[L.outfit] || ('a ' + O[0].toLowerCase()), legwear: !!O[1].legs && L.legwear !== false, theme: O[1].theme || 'witch', species: L.species, speciesWord: (SPECIES[L.species] || SPECIES.human)[1].word, hat: A.hatWorn ? A.hatWorn() : true }; },
    update: (dt, t) => wear.update(dt, t), wear, tab: () => tab,
    // (tests) set fields as a click would: set({ skin: '#6f4326', outfit: 'summer' }); heritage(id) as its pill does
    set: (patch) => { L = Object.assign(L, patch); save(); apply(); markAll(); },
    heritage: (id, mix) => { if (!HERITAGE[id]) return; const H = herLook(id, mix || L.mix); L = withLook({ heritage: id, mix: okMix(mix || L.mix), skin: H.skin, eyes: H.eyes, hair: H.hair, lids: H.lids, shape: Object.assign({}, H.face) }); save(); apply(); markAll(); },
    // (10-07, the title screen) a look made up at random: a heritage (or two, half and half) with its face, a skin tone near
    // that heritage's or (now and then) any other, a species, eyes, hair, a hairstyle, a ready-made face on top with a little of
    // every slider, her build, one of the outfits. Nothing is kept: apply(look) tries it on, apply() puts her own back.
    random: (rnd = Math.random) => {
      const pick = (a) => a[Math.floor(rnd() * a.length)], jit = (k) => (rnd() * 2 - 1) * k;
      const heritage = pick(HERITAGE_ORDER), mix = [pick(BASES), pick(BASES)]; if (mix[0] === mix[1]) mix[1] = BASES[(BASES.indexOf(mix[0]) + 1 + Math.floor(rnd() * (BASES.length - 1))) % BASES.length];
      const H = herLook(heritage, mix), species = rnd() < 0.5 ? 'human' : pick(SPECIES_ORDER.slice(1)), Sp = SPECIES[species][1];
      const si = SKINS.findIndex((x) => x[1] === H.skin);
      let skin = rnd() < 0.2 || si < 0 ? pick(SKINS)[1] : SKINS[Math.max(0, Math.min(SKINS.length - 1, si + Math.round(jit(2.4))))][1];
      if (Sp.skin) skin = rnd() < 0.7 ? Sp.skin : pick(SKINS2)[1];
      const eyes = Sp.eyes && rnd() < 0.6 ? Sp.eyes : rnd() < 0.6 ? H.eyes : pick(EYES)[1];
      const hair = Sp.hair && rnd() < 0.6 ? Sp.hair : rnd() < 0.5 ? H.hair : pick(HAIRS)[1];
      const shape = Object.assign({}, H.face), preset = pick(FACE_PRESETS)[2];
      for (const k in preset) shape[k] = (shape[k] || 0) + preset[k] * 0.7;
      for (const k in SHAPE_UI) shape[k] = +Math.max(-1, Math.min(1, (shape[k] || 0) + jit(0.25))).toFixed(3);
      const hs = hairStyles();
      return { name: L.name, heritage, mix, species, skin, eyes, hair, hairStyle: hs.length ? pick(hs).id : '', lids: rnd() < 0.6 ? H.lids : pick(Object.keys(LIDS)), shape,
        outfit: pick(OUTFIT_ORDER), suit: rnd() < 0.2 ? pick(SUIT_COLS)[1] : '', hat: null, legwear: null, body: { w: +(1 + jit(0.07)).toFixed(3), h: +(1 + jit(0.045)).toFixed(3) } };
    },
    // what a look is, in a few words (the title screen's caption)
    describe: (look) => ({ heritage: look.heritage === 'mixed' ? mixName(look.mix) : HERITAGE[look.heritage][0], species: (SPECIES[look.species] || SPECIES.human)[0], outfit: (OUTFITS[look.outfit] || OUTFITS.witch)[0],
      skin: nameOf([...SKINS, ...SKINS2], look.skin, ''), hair: nameOf(HAIRS, look.hair, 'Auburn'), fantasy: SKINS2.some((x) => x[1] === look.skin) }),
    mixLook, mixName, show, lists: { SKINS, SKINS2, EYES, HAIRS, HERITAGE_ORDER, BASES, OUTFIT_ORDER, SPECIES_ORDER, OUTFITS, SPECIES },
  };
}
