# STORY_SPEC: the story from the camp to Alraune's retreat

What exists as of 2026-10-01 (evening). The player's brief: "generate the rest of the game up until Anne interacts with
Alraune for the first time: the rest of the forest map, enemies, dialogue; keep crafting and combat out of it for now and
for any battle just do the space-bar check; after Alraune retreats into her lair is where you can stop."

Content rule (unchanged): the 2D game is adult, the recreation is not. Capture scenes are comedy: Anne is an adult,
she stays dressed, only her shoes (and once her hat) come off, what tickles her are plants and mushrooms. Bawdy lines
of the source are left out or reworded; nothing sexual is shown or said.

## Files

| file | owns |
|---|---|
| `story.js` | the engine: saved state, dialogue box with portraits, choices, the space-bar gauge, toasts, objective, fades, night, cards, emotes, scripted walking, the cinematic camera, events, the test driver |
| `story_common.js` | what every area shares: the actor kit, Amaymon (floats beside her head, never in front of her face), sparkles, head and sole positions (`feet`, `readFeet`, `along`, `orient`), checkpoints |
| `story_camp.js` | the night before, the morning after (tutorial for the gauge), "rest by the fire" |
| `story_pond.js` | a hint only |
| `story_forest.js` | the North Forest: vine walls, signposts, shrine, hole, herbs, Ivy Maidens, Myconids, the arrival scene, the blocked lane, Alraune, the interrogation, the lair |
| `captures.js` | what happens when she misses the space bar: three rounds for the Ivy Maidens, three for the Myconids, Alraune's own capture, and the "pamperings" a beaten creature gives her; the capture kit (`kit`: leg frames, spirals, tongues) that traps.js shares |
| `traps.js` | the camp's two traps: the hole under the pile of leaves beside the log (vines / fairies / the thief / tentacles of its own, since batch 19 / ghosts) and the pumpkin fiend among the pumpkins |
| `thief.js` | Aurelia the thief: a second figure made from Anne's own model (`A.makeTwin`), her arms aimed by two-bone IK with the clearance measured every frame |
| `actors.js` | creatures and props built in code: vine walls, Ivy Maidens, Myconids and their children, Amaymon, herbs, signposts, hole, shrine, Alraune's flower, sparkles, the loose witch hat |
| `alraune.js` | Alraune herself (painted face per expression, mane, lily, gown of leaves, arm poses) |
| `story_library.js` | (10-02) the opening: the haunted Secret Library, Lilith, the chair, the Kiss of the Succubus, Amaymon's ball, the memory cards (area `library`, an indoor set) |
| `story_edge.js`, `story_road.js` | (10-02) the Chapter 1 epilogue: Boudicca's ambush and interrogation, the theft, "Meanwhile...", the road, the end card |
| `boudicca.js`, `lilith.js`, `scylla.js` | (10-02) more second figures on thief.js's footing (their LOOK, what they wear on their bones, their scene) |
| `ties.js` | the cords of the tied-up captures: ankles, big toes, a peg; wrists and the hog line (Boudicca); themes per captor |

## Progress (the 2D game's GAME_PROGRESS)
0 new game -> 5 after the night scene -> 10 after the morning scene -> 15 after the forest's arrival scene -> 16 at the
blocked lane -> 20 after Alraune has gone down into her lair ("To be continued"; the hole in the flower glade says so too).
(10-02) A new game plays the opening first (flag `prologue`, progress 1), then the camp. After the nest: 30 (Alraune
beaten), 35 (the lane), 37 (Boudicca), 40 (the theft found), 100 (Chapter 1 done; flags `boudicca`, `grimmoireStolen`).
Saved in localStorage `amirian3d.save.v1` with flags, removed events (per area), herbs, coins, and where she is
(`level`, `at`: tiles, fractional, so `tc(at)` is the very spot). The start card shows Begin, or Continue + New game.

Where she stands is saved when a scene ends, when she arrives in an area, every 8 s of walking about and when the page
is closed (`pagehide`); never in the middle of a scene (story or log scene). The plain address (no `?level`) loads the
saved area; she starts on the saved spot whenever the address has no `?at`. After walking in from another area the
address forgets how she arrived (`?go` marker, `history.replaceState`), so a reload is "Continue" on the spot.
"New game" clears the save and loads the plain address.

## Writing a scene
An area script's `setup(S, env)` registers events with `S.on({ id, at, r, touch | action, when, run })`; `run` is an
async function: `await S.say('a1', 4, 'text')`, `await S.gauge({...})`, `await S.walk([...])`, `S.cam.two(a, b)`,
`S.cam.at(point, bearing, { y, pitch, dist, fov, focus, cut })`, `S.expr(name, blush)`, `S.clip(name, fade)`,
`S.toes(amp)`, `S.late.push(fn)` (runs after her clip is applied each frame: anything that touches her belongs there).
Portrait sheets: `a1`, `a2` (Anne), `am` (Amaymon), `al` (Alraune), `ivy`, `myc`.

## The forest's creatures (after the 2D art)
- **Ivy Maiden**: slate-green vines; the head hangs from its stalk; a porcelain mask face with magenta eyes without
  pupils (the other kind: yellow-green face, violet eyes), three painted expressions (`calm`, `grin`, `open`), leaf
  hair parted over the brow. `m.setFace`, `m.talk`, `m.laugh`, `m.lean`, `m.shake`, `m.emerge`, `m.sink`.
- **Myconid**: a patch of mushrooms; disturbed, the lady rises: pale stem body with a frilled collar, purple hair,
  purple smirk, a great cap over her eyes (orange or red kind). Three children (`m.minis`, `m.kids(on)`).
- **Alraune**: light green skin, red eyes on black, lilac eye shadow, red lips, a mane of wavy red hair parted on her
  left, the pink lily behind her right ear; six painted expressions (`smile smug happy surprised laugh pout`), poses
  `Rise Idle Delight Command`. She wears a gown of leaves.

## Fights and captures
Every fight is one space-bar gauge per enemy. A miss:
- (10-03) **Her loose shoes** lie on the ground in every capture (upright or on their side, at the height their style
  needs: `captures.js restOf`), never carried about, wobbling or half sunk. The Myconid children lick INSIDE them (the
  footbed, bowed over the rim: `shoeSole`, `kidLicker`). **Every capture that ends** (free, woken, lost, the pits,
  Scylla, the hole trap, the pumpkin, the pamperings) closes with her sitting down and slipping them back on
  (`kit.putShoesOn`: `SitPutOn`, close on her feet; it only runs when her shoes came off, `A.lastBare`; mark
  `shoeson`, console `SHOES going on`). The same in the opening once Lilith has gone and on the road before the walk.
- **Ivy Maidens** (`cap.ivy`): round 1 "Shoes off, pretty butterfly" (vines coil round her ankles: helices parented to
  her shin bones; her shoes are pulled off on camera, or every other time the lash that caught her has already knocked
  off her shoes and hat, `cap.snatch`; four fuzzy vine tips stroke her soles), round 2 "Meet the sisters" (on her back,
  more maidens sprout: catkins, a fern frond, a dandelion clock and a sneeze, a moment of black, close on her soles),
  round 3 "A lesson" (on her front, shins up, tufts of leaf hair as dusters). One "kick free" gauge after each round;
  three misses and she comes round at her last checkpoint. The lost fight at the lane plays round 3 only.
- **Myconids** (`cap.myconid`): the children run off with her shoes and rub their caps on her toes; giggle spores (she
  is doubled up on her knees, they bounce on her soles); the fairy ring (the lady dusts her soles with two puffballs).
- **Since 10-02 round 1 of both follows the 2D capture sheets** (their clothed frame sets only, same side-on angle through
  `side2d`, with a close-up of her feet from time to time): Ivy = sheet anne-ivymaidens-1 (`IvyLegUp`: on her back on her
  elbows, her right leg held straight up in a coil between two heads that lick the sole); Myconid = sheet anne-myconid-1
  rows 1-2 (`MycHeld` / `MycHeldOut`: a lady has her from behind, a second takes her outstretched foot). The holding lady
  is drawn up to 1.3 x (`lady.size`) and stands behind and to the far side so that her cap is OVER Anne's head; Anne's
  hat lies in the grass. Rounds 2 and 3 are the 3D's own (the sheets go nude there).
- **Alraune** (`cap.alraune`, the lane fight lost): sheet alraune-capture-11 (`AlrHeld`, `AlrHeldTickled`): held level in
  vines before her, Alraune's fingers and then her tongue at the soles; one gauge.
- **A beaten creature** (`tamed` in story_forest.js): Stomp / Pamperings / Leave. Pamperings = `cap.pamper` (clip
  `IvyWorship`: she sits back on her hands on a stool of vines, her feet held up to the maidens or the lady).
- **Dialogue about her feet**: any line whose text names her feet, toes, soles or shoes is shown over a close-up of her
  feet in her sandals (story.js `feetCut`), with ONE small toe wiggle of a second and a half. Only while she stands in
  Idle or Point with her shoes on; `{ noFeet: true }` opts a line out. `S.toes(amp, rate, sec)`: scenes that tickle her
  pass `Infinity` and stop it with `S.toes(0)`.
- **Face close-ups** (`shot.face`) are aimed by where her face looks (`C.headFwd`), `turn` = radians round to her left.
- Nothing enters her skin: each tickler rides `CLEAR` (16 mm) off the sole's own frame and arrives along the sole
  (`updTicklers`); every tip is built with no vertex below that plane.
- Wide shots go through `sideOn(c, yaw, off, o)`: the wanted side of her, or the other side when trees or the others
  push the camera far off it. The lost capture ends on a pull-back along the bearing the camera already has.

## The meeting with Alraune (`blockedLane`, `afterBattle`)
Triggered from the two "exit spots" of the 2D map at progress 15. While they talk about how ticklish her feet are the
picture cuts to her feet in their heels (`shots.feet`), and her toes stir a little (`S.toes(0.13)`). Then three guards,
one gauge each; won: Alraune sinks away, the slow maiden is questioned, a cut to the glade shows her going down the
hole, progress 20, "To be continued".

## Tests
`tools/st.sh <name> "<query>" [wait text] [w h]` runs one story test in headless Chrome and saves `build/st/<name>.png`
(`ST_OUT=<dir>` saves elsewhere; `EVAL=<js>` is evaluated before the picture is taken).
- `&ev=<event id>` stands her next to an event and starts it (`ivy0..19`, `myc0..4`, `intro`, `exitS`, `exitW`, `lane`, `hole`, `shrine`, `sign0..4`, `herb0..10`; in the camp `hole`, `pumpkin`).
- `&pick=a,b,c` answers the choice boxes in order; `&holdtext=<part of a line>` freezes on that line.
- `tools/endstate.sh <name> "<query with ev=>"` plays an event to its end and prints what it leaves behind (shoes, hat, clip, height).
- `&feetcut=<0..1>`: the chance that a line of hers cuts to her feet (0 under `?sa` unless given); `?nobored` keeps her from growing bored when she stands still; key F is the foot cam.
- `tools/lick.sh` / `tools/lick2.sh`: how long the tongues are and whether they reach and stay on her soles.
- `?nails` opens the chooser of her look: shoes, their colours, toenails (`&nail=<i>`, `&shoe=<id>`, `&shoecol=<hex>`, `&solecol=<hex>` preset it); `drive.mjs ... nail=<i>` uses it with the real pointer.
- `&sa=hit | miss | hm..` plays lines, choices and gauges by itself; `&hold=<mark>` or `&hold=L<n>` freezes for a screenshot.
  Marks: `night night2 morning` (camp); `intro captured tickle face1 captured2 tickle2 face2 captured3 tickle3 face3 soles3 away lash myc1 myc1b mface myc2 myc3 alraune alraune2 feet feet2 battle gone interrogate lair alcap altease alfeet alkiss altickle alaway pamper pamper2 card gauge choice` (forest); `hfall hshoes htease hfeet1 htickle hfeet2 hbind hbound hfeet3 hkick hend`, `pwake ptease plick1 pfeet1 plick2 pfeet2 pfree pend` (the camp's traps).
- `&ts=4` speeds the story clock up; `&prog=n`, `&fresh`, `&flags=a,b` (`flags=ivyN` makes the next capture the "lash" opening).
- `&show=ivy | ivyY | myc | mycR | al` puts one creature beside her with the camera on it (`&vd=` distance, `&vy=` height, `&va=` bearing, `&vf=` face, `&vc=` pose, `&vk` children).
- End-state check: run with `&ts=4` and evaluate `window.__dbg.story.isActive()`, `window.__dbg.A.debug()` after the scene (see the commands in this file's history: trap lost / dodged, lane lost / won, Myconid, a pair of maidens all end with shoes and hat back on).
- Real keys: `node tools/webkit/play.mjs URL w=900 h=600 quiet=1 -- wait:READY click:#start ...` (in zsh build the repeated `tap:Space sleep:300` steps as an ARRAY: an unquoted string is one argument). Played this way: a new game through both camp scenes, the walk out of the south exit, the forest loading, the arrival scene; saving and Continue (camp and forest), reload, New game.
- A scene played like a player: `node tools/webkit/drive.mjs URL pattern=mmmm yaw=0 walk=KeyW,1500 shots=/dir/prefix` walks her into an event, presses Space for every line and hits or misses each gauge on purpose by reading it off the screen (one letter per gauge). Played this way: a whole Ivy Maiden capture (`at=38,30`, walk north) and a whole Myconid capture (`at=34,41`, `walk=KeyW,900`), every gauge missed: both end at the checkpoint with shoes and hat on.
- Syntax check of a module: `node --input-type=module --check < file.js`. (`node --check file.js` passes files with syntax errors: it does not parse them as modules.)

## Not done
What the 2D shows nude or sexual is not recreated (Ivy CAPTURE2/3, the Myconid sheet from its third row, alraune-capture-12/21/22,
the "dominate" sheets): Anne stays dressed, only her shoes and hat come off.
Crafting, real combat; the 2D map's two "ladder" vines, the wall maiden and three push-back vine walls; the pond's
fairies and black imp as pickups; Alraune's CAPTURE2; Chapter 2 (the card at the end of the road says so).


## The caves (`story_caves.js`, the 2D's Map 21 "ForestCaves")
In from the forest's cave mouth (6,46) at any progress; out by walking north into the shaft of light at (15,2). Dim and
cold (`S.night` 0.8 and `post.setGrade`, a little lighter during scenes). Blue Myconid patches at (21,11), (21,4), (3,10)
(two each), a red one at (5,8) (one or two), the standing "Myconid Nest" lady at (2,4) (one, no spores): `kit.myconid`
in `creatures.js` (rise, spores dodge, Attack / Leave, a gauge per Myconid, the first ever beaten only stomped, then
Stomp / Pamperings / Spare her). Each blocks its corridor until beaten. The goddess statue (4,2) is the cave's rest and
checkpoint; the skeleton (2,2) gives the Magic Scroll (flag `scroll`); chests (1,3) and (21,3) (`kit.chest`, `kit.loot`:
herbs and coins, names in a toast); the hidden pit (21,7) is the camp trap's `vines` kind (`createTraps` with `holeAt`).
Not built (later chapters): the friendly lady (6,4), the glowing Myconid (19,4), the fairy, the black imp.

## The nest (`story_nest.js`, the 2D's Map 20 "IvyMaidenNest")
In by the glade hole (36,12) from progress 20 ("Jump down / Leave"; the first jump makes it 21); she lands at (5,3).
Arrival scene (21 -> 25) with Amaymon's doodle (drawn clothed: her feet, "TICKLE HERE"). Out by the vines at (5,2)
("Climb up / Leave" the first time) to (36,13). The map loops: west edge (0,9) to the east meadow (23,9), the stair cut
(21,0) to the south path (21,17) (arches A and B, the map on N, a trail of glowing blossoms). Three Ivy Maiden pairs at
(13,4), (10,10), (14,8); pits (4,4) and (11,15) (kind `ivy`); the aloe (6,10); chests (18,8) (behind Alraune, after
her), (20,14), (6,14). Alraune at (18,9): her lines, then three gauges (maiden, Alraune, maiden). Won: a clothed stand-in
for the 2D's "play with her a little" (her own vines hold her arms up, Anne's conjured feather; "Tickle her!" /
"Random Spot!" / "Spare her", three stages; flag `alrauneUnlocked`), then she lashes out and is gone: progress 30, every
vine and maiden of the nest and the forest gone, "Leave" (to the forest lane (46,6), "OH YES!!!") or "Stay and explore":
35. Lost: `cap.alraune`, she comes round under the hole. The forest's lane at (50,6) then leads out of the forest to the
epilogue (`story_edge.js`, `story_road.js`; see BATCH7_PLAN.md batch 13).

### Shoes back on after shoe work (10-03, batch 16)
`A.shoeWork = { lick, tick }` names whoever licked or tickled inside her shoes (`kit.noteShoe`); `putShoesOn` then holds
SitPutOn with the right foot in for a line (wet inside / still tickles), and once she is up `shoeFlash` plays the sole
flash with `A.soleMarks('wet' | 'specks' | 'both')` on her soles, a line over the held clip (mark `shoeflash`) and one
more. Lines in `captures.js SHOE_LINES`, picked at random; `?flash=L|R` fixes the foot in tests.

### Batch 17 (10-03): the brush, the foot cam's tools, floors
- After the flash's line a choice: "Scrub her soles clean with the fuzzy brush" / "Leave them be". The brush is
  `S.footPlay.clean({ first, held: true })` (footplay.js); the scene follows its camera (`camGoal`) until it resolves,
  then `SHOE_LINES.clean`. In story tests (`sa=`) the choice takes the brush (first option) and the brush goes by itself;
  `&pick=<kind>,1` leaves them be.
- A scene that takes her feet under the ground on purpose says so: `A.setFloor(y)` (the hole trap: the hollow's floor;
  -99 while she slips through or jumps down a hole), `A.setFloor(null)` afterwards.
- `&shoe=<style>` (thirteen styles: `geta` since batch 22), `&nail=<index>` (twenty colours) choose her look in tests.
- Tied ankles are clamped together in every scene (batch 19): whatever ties them calls `A.anklesTogether(k)` as it goes
  on and `A.anklesTogether(0)` when it comes off (ties.js does it for the captures and the epilogue).
- The story camera follows two of the Motion Reel Kit's rules (10-03, `lib/motion.js`): a move that is not a cut is a
  critically damped spring (retargets add a spring, none is restarted), and a held shot is pushed in 4.5 % over nine
  seconds and drifts a little. `S.cam.set(.., { still: true })` (or any shot's `still`) keeps a shot dead still: use it
  where the player aims with the mouse. `?camkit=0` turns both off. A cut now cuts the field of view as well.


## Her look in the lines (10-04, batch 21)
- `S.heroName()`: every 'Anne' in a line, card, toast, choice or objective is replaced by the player's name (`tx()` in
  story.js); the name plate too. Write lines with "Anne" as before.
- `S.lookWords()`: `{ hair, hairWord ('redheaded', 'raven-haired', 'brunette', 'blonde', ...), skin, skinDeep (0-13),
  soleWord ('porcelain' ... 'ebony'), pale (bool), outfit, hat (bool) }`. Four lines use it so far (Alraune's
  "redheaded friend", Lilith's "tip of her hat" and "feet look quite pale", the "porcelain soles" toast).
- `S.facePortrait(expr, blush)`: her own face for a line's portrait once her look is not the built one.
- The loose hat (`kit.throwHat`, the hat by her bed) is the hat of her look and is never shown when her look has none.

## What they say about her (10-04, batch 22)
`C.lookSay(who)` -> `{ feet, outfit, species, theme, kind }`, `C.lookRemarks(who, n)` -> texts. who: 'al', 'am', 'li',
'ivy', 'bo' (a written line per outfit theme and per species), 'au', 'scylla', 'ghost', 'fairy', 'pumpkin', 'myc'
(templates in their voices). Themes are looks.js `OUTFITS[..].theme`: witch, school, office, sporty, beach, sleep, goth,
bunny, royal, warrior, villain, maid, kimono, dancer, casual, towel, tribal, cute, idol, elegant, goddess, fairy.
`S.lookWords()` now also gives `theme`, `outfitName`, `species`, `speciesWord`, `fantasy`. A new outfit needs a `theme`
from that list (or a new theme needs a line in each of the five tables `TH.al/am/li/ivy/bo` and a word in `A_THEME`);
a new species needs a line in `KIND.*` and a word in `A_KIND`. A new shoe style needs: SHOW, NOUN, and a line in
lookLines('ivy'/'bo'/'alNest'), lookTalk('al'/'am'), story_library.js shoeTalk, traps.js Aurelia's hello, and its noun
in story.js FEET_WORDS.
Rule kept: the lines name the tone of her skin, her hair, her clothes, her shoes and her species; never a race.

## Her outfit by name (10-04, batch 23)
`S.lookWords().wearing` ("a maid's uniform": looks.js `WEARING`, one per outfit) is in every speaker's outfit line;
`lookRemarks(who, n)` always has the outfit (feet, outfit, then species or hair). A new outfit needs a `WEARING` entry.

## Lilith at her feet in the library: where she kneels, what her hands do (10-04, batch 24)
- `STG` (story_library.js): she kneels 0.42 m to Anne's left of the middle of her soles and 0.44 m before them, turned
  0.75 rad towards them, leaning 0.4 rad while her hands work. Chosen by measuring the arm solver at 126 places (both
  elbows 45 to 95 degrees, wrists to 40, fingertips within 2 cm of the point they are sent to). Moving the chair, the soles
  or her clip means measuring again: `&lx= &lz= &lyaw= &llean=` and `__lib.lil.dbg()` (`miss`: how far the fingertips came
  out from the point named). `kneelFor` adjusts her lean and how near she kneels to the height of Anne's soles (a body
  of the player's own length puts them up to 3.4 cm higher or lower); `STG.dl` is added to her leans at Anne's feet.
- `hands(L, R, rest)`: a pattern name per hand (`circle`, `trail`, `all`, `toes`; with a 0 on the end: on her OTHER sole);
  `rest`: a hand with no pattern is set down on the floor before its shoulder (`FLOOR`). Whenever she bends right down
  (her mouth at a sole: the licks, the kiss; the far shoe) a free hand must rest: left hanging it goes through the floor.
- With her mouth at the nearer sole her hands cannot work on that same sole (her shoulders are a hand's length from it):
  her left hand takes the other sole.
- thief.js options a twin may be given: `wrist` (how far a hand may stand to the line of its forearm; the hand is turned,
  the fingertips keep their point) and `twist` (the forearm's share of the hand's turn about its own line). Lilith has
  both (0.7, 0.6); the thief, Boudicca and Scylla have neither and move as before, except that a hand asked beyond 85% of
  its arm's reach now arrives (it used to stop 4 to 8 cm short).

## Batch 25 (10-05): what a line shows, where a shot may stand, and Chapter 2
- **A line over her feet** (story.js `say`): only when the scene says so (`o.feet`) or the line names feet, toes or
  soles and is not another speaker's own (`herFeet`); `o.noFeet` never; `S.noFeetCut = true` for a whole area (the
  dungeon: every word about feet there is about the thief's). No cut at random any more.
- **No shot from inside a bush** (`shotGoal`, `cam.set` on a cut): see WORLD_SPEC, batch 25. `o.bush: true` leaves it.
- **`A.clipSpeed(clip, k)`** (how fast a tickled clip runs), **`S.party = { boudicca }`** (who walks with her: the foot
  cam offers her feet too), **`S.voicePitch`** (somebody else's laughter from Anne's voice bank: the thief 0.9... the
  dryad 1.1; set back to 1).
- **A scene with somebody at a sitter's soles** is footwork.js: `seat` / `stage(name)` tables in the area's script name
  the sitter's clip, toes and voice, what each hand of whoever kneels does, and her mouth; `S.late` order: the sitter's
  soles (`C.readFeet` or `solesOf(...).read`), `fw.pre`, the figures' `update`, `fw.post`.
- **Chapter 2** (story_post.js, story_lys.js, story_valyndra.js, story_barracks.js): the 2D's own lines throughout
  (refs/ch2/*_dialogue.txt); where a line was not for this game it has a stand-in (the dryad's "layers of cotton
  fabrics" is about Anne's shoes; Boudicca's "sexy girls" are "pretty girls"). Progress 100 -> 105 -> 110 -> 115 ->
  120 -> 130 -> 140. What the 2D plays on its world map is played at the place itself (the walls in the gate, the
  teleport talk at the forest's south gate).
- Tests: `tools/reg2.sh` (each scene to its end: "CH2 <name> done"), marks: reading, lines, kiss, lick, tickle, fortune;
  asleep, dream, feet, nlick, ntickle, ndone; dryad, bound, btickle, dwon, dtickle; mainRoad; walls, guard, street;
  arrive, first, soles, each, fingers, over, brush, ties, confess.
- **A scene that ends by leaving** (`S.go(level, tile, dir)` as its last act): `finish()` no longer saves this area's
  name and her spot once she has left (`closed`): `leaveFor` has saved where Continue must take her.
- **A creature that wanders** (creatures.js `roam`) takes `rec.at.p` with it: `encounter` turns her to where it is.

