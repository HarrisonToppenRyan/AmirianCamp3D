# Batch 7 (asked 2026-10-01, late evening): what was asked, the plan, the state

## The request, verbatim

"once you're done, install the following 8 skills as well to help with the 3d models and enviornment so far for the
entire game, have the enviornment and characters look ultra hd and as high of quality as you can, use shadders, details
on the feet, faces, and hands of the charscters, etc: https://github.com/ahujasid/mcp-for-blender,
https://github.com/emalorenzo/three-agent-skills, https://github.com/majiayu000/claude-skill-registry,
https://github.com/MonumentalSystems/Atlas-Agent-Teams, https://github.com/Andrew1326/dominations,
https://github.com/majiayu000/claude-skill-registry, https://github.com/phuetz/code-buddy,
https://github.com/Svetlana-DAO-LLC/cad-agent. Also for all capture scences (anne, in the log, alurane, myconids, hole
trap, and ivy maidens) have the capture scenes look the same in the 2d animation in terms of angle (but show a close up
on her feet wheb they're getting tickled once in a while in the capture animation), when anne gets tickled on the feet
and body, dont have anything go though her body, have it be on her body but not IN her body if that makes scense. The
2d animaition scences capture it perfectly and should be modded afterwards. Also in the camp have any be sleeping on
her side like in the 2d game rather then reusing the animation of her putting the mimic shoes on, put the hole trap
next to the log and mimic shoes and have all options animated (vines, farries, theif, ivy maidens, ghost) as well as
the pumpkin in the first area also have the animations ready when interacted with by the main character. When anne
gets stuck in the log, don't have her kicking around her legs for too long. Instead the kuns (who should be smaller of
around the side of the gold ball should come out and tie her ankles and big toes togher tight and taught and have
anne's feet rest on the ground before the kuns start to tickle and lick Anne's soles. Use whatever skill is best sutied
for the task you're currently working on. Remeber, anne's feet are the main focus on the entire game so make sure they
look smooth and professionally poslished in every scene."

## Standing rules (unchanged)

- The 2D game is adult; the recreation is not. Anne is an adult, stays dressed; only her shoes (and hat) come off; the
  scenes are comedy tickle gags. Where a 2D sheet turns nude or sexual (the Myconid sheet from row 3, `alraune-capture-21/22`,
  the spread-leg last frames of the hole-trap "back" sheets) the 3D scene follows the clothed frames only.
- One thread: no agent fan-outs (the account's session limit), one browser or Blender process at a time, 8 GB RAM.
- Nothing goes through her: every tickler, cord, tongue and coil rides on the surface with clearance.

## Where the 2D references are

Decoded to `<scratch>/ref2d/*.png` (viewing copies in `ref2d/v/`), from `www/img/pictures/*.rpgmvp` (restore the PNG
header: first 16 bytes after the 16-byte RPGMV header are replaced by the standard PNG signature + IHDR start).
Sheets are grids of frames, played by the `KunAnimations` plugin.

| scene | sheet | grid | event |
|---|---|---|---|
| log | `anne-wooden-log-trapped-1` | 12 x 5 of 112x256 | CE 78 `SceneWoodenLogTRAP` (dump line 22676) |
| hole trap | `anne-stuck-trap-top-1` (8 x 9 of 192x192), `-front-<kind>-1` (12 x 5 of 192x240), `-back-<kind>-1` (4 x 7) | kinds: `tcl` vines, `fairies`, `ghost`, `ivy`, `aurelia` (the thief; she is the separate sheet `aurelia-tickler-1`) | CE 77 `SceneTrapHole` (22107) |
| pumpkin | `anne-pumpkin-fiend-1` | 8 x 5 | CE 62 `ScenePUMPKIN` (14411) |
| Myconids | `anne-myconid-1` rows 1-2 only | 8 x 6 | CE 52 `SceneMyconids` (9026) |
| Alraune | `alraune-capture-11`, `-12` (clothed rows) | 8 x 14 | CE 50 `SceneAlraune` (7455) |
| Ivy Maidens | `anne-ivy-maidens-1..3`, `anne-ivymaidens-1..3` | to check | CE 51 `SceneIvyMaiden` (8414) |

The event dump is `<scratch>/story/ce_all.txt` (made by `story/dump.py` from `www/data/CommonEvents.json`).

What the sheets show:
- **Log**: front view (head and hands out of the front hole), then the rear view from above and behind: her shorts in
  the hole, legs out straight towards the camera, soles up; Kuns as tall as her foot is long stand beside her feet and
  lick her soles with long pink tongues; one stands on her calves.
- **Hole trap**: `top` = eye-level view above the floor, she is in the hole to her waist, hat on, laughing; at the end
  she slips through and only the hat is left. `front` = from below: shorts and legs hang from the ceiling, shoes are
  pulled off, feet teased. `back` = from behind below: her gloved fingers on the rim, legs kick, then get wound or
  tied. Flow: fall -> top -> front (shoes off) -> top -> front tease + gauge -> top laughing -> front tickle + gauge
  -> top -> back tease + gauge -> top -> back tickle + gauge -> top "end" (she slips through). The 2D sandbox menu:
  Fairy Trap / Tentacle Trap / Ivy Maiden Trap / Ghost Trap / Aurelia Trap.
- **Pumpkin**: side view; she sits by a pumpkin; a dark vine with a jack-o'-lantern head winds round her legs, lifts
  them, the head is at her soles.
- **Myconid** (rows 1-2): side view; the lady holds her from behind, one leg held out level, a capped child at the sole.
- **Alraune** (sheet 11): side view; Alraune on her flower on the left, Anne held level on vines at her shoulder
  height on the right, feet towards Alraune, who tickles them; hat and shoes on the ground.

## Plan

1. Skills (done, see the report below).
2. Log: Kuns about 0.2 m tall; short kicking; new clip `StuckFlat` (legs out straight, feet resting on the ground,
   soles up); Kuns come out, pull the shoes off, tie her ankles and her big toes together, taut; then tickle and lick;
   main camera = the 2D rear view, close-ups of the soles now and then.
3. Camp: she sleeps on her side (`CampSleep`).
4. Hole trap beside the log and the mimic shoes: menu of five (vines, fairies, thief, ivy maidens, ghosts), each
   animated; views top / front / back as in 2D; a gauge per stage.
5. Pumpkin in the camp: its scene on interaction.
6. Ivy Maidens, Myconids, Alraune: restage on the 2D angles, close-ups now and then.
7. Quality pass: skin, feet, hands, faces, shaders, resolution, environment; inside the frame budget.

## Skills report (2026-10-01)

Installed in `~/.claude/skills/`: `three-best-practices` (emalorenzo/three-agent-skills), `blender-expert-skills`
(scenario-labs set, picked from the registry), `blender-python-automation` (the five Blender guides of
Andrew1326/dominations), `atlas-3d-team` (documents of MonumentalSystems/Atlas-Agent-Teams, without its hooks, MCP
list and multi-agent commands), `cad-agent` (skill text; its Docker server is not installed).
`mcp-for-blender`: was already installed as the `blender` MCP server (`uvx blender-mcp` -> mcp-for-blender 2.1.3); its
Blender add-on was updated 1.7 -> 1.8. It needs Blender open with the add-on's server started.
Not installed: the CloudAI-X Three.js set from the registry (the permission system blocked writing its index; the
folder was removed), `phuetz/code-buddy` (a separate coding agent, nothing for 3D).

# Batch 8 (asked 2026-10-01, while batch 7 was under way): ONLY after batch 7 is finished

## The request, verbatim

"also when you are competly done with that task you're doing now, don't forget to make ALL of the animations from the
IVY madiens, moconids, etc. Do an exact 1:1 recreation from the 2d animations rather than making up your own. Also when
the main chracter defeats an enemy animation options are aviable to the player as well. Animate those in 3d 1:1 to how
they look in the 2d original game as well. Also Anne feet in her shoes don't look quite as fluid still, the shoes look
spiky and rough and not smooth at all, so instead make here wear purple sandals instead of heels so her feet look more
exposed, make Anne's body a (tiny bit fatter since she looks a little too skinny). Also in any dialoge where feet are
mentioned have it a close up shot of anne's feet in her shoes. Don't have her toes wiggle constantly only one small
wiggle for about 1-2 seconds and that's it. Make it to where at the beggining of the same you can choose the toe color
of Anne's toenails as well and a model of anne holding her feet up near towards the screen so that when you hover over
a color her toes will change to that color to give the player an idea of what it would look like. Finally, when Anne is
sleeping on the campsite and then sits up, she looks very unntral, have her lay on her side and bring her upper body up
to and make it look a lot more natural. Do this ONLY after you finished everything in your current prompt you're doing
now."

## Items

1. Every animation of the Ivy Maidens, Myconids and the others: 1:1 with the 2D sheets (pose, angle, order of stages),
   not invented. (Same limit as always: clothed frames only; nude or sexual frames are not recreated.)
2. The options the player gets after DEFEATING an enemy: find them in the 2D events (CE 50, 51, 52, ...), animate them
   1:1 as well.
3. Shoes: purple sandals instead of the heels (the heels read as spiky and rough); feet more exposed.
4. Body a tiny bit fuller.
5. Any dialogue line that mentions feet: a close-up of her feet in her shoes.
6. Toe wiggle: one small wiggle of 1-2 seconds, then still. Never constant.
7. Start of the game: a toenail colour chooser, with Anne holding her feet up towards the screen; hovering a colour
   previews it on her toes.
8. Camp: sleeping on her side and a natural sit-up (overlaps batch 7 item 3: done once, properly).

Keep batch 7 code shoe-agnostic (the shoe meshes and the loose-shoe prop come from the model file), so that item 3 is a
model change, not a rewrite of the scenes.

## State

(update below as work proceeds)

- 10-01 23:50. Skills done. **Log scene reworked** (VER 74): Kuns 0.20 / 0.19 / 0.17 m (three: A green and B yellow at her
  soles, C green on her calves); clips `StuckFlat`, `StuckFlatTickled`, `StuckFlatStrain` (in `tools/anne2/poses.py`,
  `key_log`); order of lines 6..12, 15, 13, [tie], T1, 14, T2, 16..24; op `tie` (cord round both ankles with frapping
  turns and knot, twine round both big toes, peg, taut line; `?tieph=N&tieat=s` freezes it at phase N); licking tongue
  (`kunLick`) and feather, roles swap every 9 s; rear camera as on the 2D sheet (`feet`), close-ups `soles` / `kicks`
  follow the way her soles face; escape: `snapTies`, `aface`, `kunsee` (`?noflee` keeps the Kuns in the picture).
  Played with real keys in WebKit (`tools/webkit/drive.mjs ... key=KeyE pattern=mh`): ends clean.
  STILL TO DO for the log: update LOGSCENE_SPEC.md; re-run `ls=complete|end|repeat|fail` and the mimic scene (`ms=`).
- 10-02 02:40. **Camp sleep done** (VER 76: `CampSleep` on her side, `CampWake` / `CampLie` one-shots, shoes and hat beside the bed).
  **Hole trap done** (VER 93), `traps.js` + `thief.js`: pile of leaves at the first open spot beside the log; menu
  vines / fairies / the thief / Ivy Maidens / ghosts / leave; fall, shoes off, four bouts (tease front, tickle front,
  bind back, bound back) with a gauge each, close-ups of her feet in each bout; escape (`HoleKickout`) or slip-through
  (hat left on the grass). Test: `?prog=10&ev=hole&pick=<0 vines,1 fairies,2 thief,3 ivy,4 ghosts>&sa=<pattern>&hold=<mark>`,
  marks `hfall hshoes htease hfeet1 htickle hfeet2 hbind hbound hfeet3 hkick hend`. All five: both endings leave
  `{active:false, heelsWorn:true, hat:true, y:0}`. Thief also played with real keys in WebKit (`drive.mjs ... at=17,7 key=KeyE pick=2`).
  The thief (2D `aurelia-tickler-1`) is a SECOND FIGURE from Anne's model: `A.makeTwin(SkeletonUtils.clone, LOOK)` in
  anne_next.js (own materials: stockings and bracers are drawn by the skin shader, `uSock` / `uBand`; hair recoloured in
  its shader; own mixer and face), clip `ThiefIdle` (poses.py `key_thief`), arms aimed by two-bone IK in thief.js, fingers
  posed there, feather and scarf props. Clearance is measured on the solved bones every frame (`thief.gap`,
  `window.__traps.thief.dbg()`): least air seen 0.8 mm under fingertips, 3.6 mm under the feather's tip.
  For her the hollow's floor is let down 0.4 m (`low` group): Anne's feet are then at her shoulders, as on the sheet.
  The hollow is 0.3 m deeper for everyone than at VER 76 (FLOOR -2.05; the small ones keep to LV -1.75).
  Tool: `<scratch>/story/anims.py <sheet name part>` prints the 2D frame sets (name, frames, fps, next) of a sheet.
  NEXT: pumpkin (CE 62), then restage Ivy / Myconid / Alraune on the 2D angles, then the quality pass, docs, memory.
- 10-02 10:40. **Pumpkin done** (VER 97, traps.js: `ev=pumpkin`, marks `pwake ptease plick1 pfeet1 plick2 pfeet2 pfree pend`, clips
  `PumpkinSeat PumpkinHeld PumpkinHigh`; flag `mrPumpkin` after a kick-free adds "Wake Mr. Pumpkin" to its menu).
  **Model changes of batch 8 done early** (they touch every later screenshot): body a little fuller (s1 MACRO weight 0.46 and
  four targets; waist +4 %, hips +3 %), **purple sandals** instead of pumps (`tools/anne2/s2_sandals.py`, part `sandals` of
  s3; object names Anne_Heel_L/R kept; no hidden skin any more; theta 4.3 deg), leg-radius tables re-measured
  (`tools/anne2/measure.py`), per-foot shoes (`A.setShoe('L'|'R', on)`), `A.setNailColor(css)`.
  **Restaged 1:1 after the clothed 2D sets** (VER 108): Ivy Maidens round 1 = CAPTURE1 (sheet anne-ivymaidens-1: `IvyLegUp`,
  `IvyLegUpTickled`; two heads at her raised foot, leg coil, tongues; marks `captured tickle`); Myconids round 1 = CAPTURE1
  (sheet anne-myconid-1 rows 1-2: `MycHeld`, `MycHeldOut`; lady behind her with drawn arms, second lady `lady2` at her
  outstretched foot; marks `myc1 myc1b`); **Alraune capture, new** (sheet alraune-capture-11: `AlrHeld`, `AlrHeldTickled`;
  `cap.alraune`, played in the clearing at the mouth of the lane when the lane fight is lost; Alraune's arms reach by IK
  (`alraune.reach`); marks `alcap altease alfeet alkiss altickle alaway`). Side shots go through `side2d` (her left, or her
  right when trees are in the way; sets `far`). NOT recreated (nude / sexual in 2D): Ivy CAPTURE2 + 3 (sheets -3, -2),
  Myconid sheet from row 3 and CAPTURE2/3, alraune-capture-12/21/22, every `pussy` / `fj` / `cum` / `whip` set: the
  3D keeps its own clothed rounds 2 and 3 there.
  Shared helpers moved into the capture kit: `readLegs legAt makeSpiral(…, only) makeTongue lick`.
  NEXT: defeat options (Ivy: stomp / pamper = sheet 1 worship sets, clip `IvyWorship`; Myconid: stomp / pamper), dialogue
  foot close-ups + one short toe wiggle, toenail colour chooser at the start, quality pass, regression (log, mimic, camp
  opening with sandals), docs, memory.
- 10-02 afternoon. **Defeat options done** (`tamed(group, kind, lady)` in story_forest.js: Stomp / Pamperings / Leave after a
  won Ivy fight or a hit on a Myconid's spore gauge; `cap.pamper`, clip `IvyWorship`, marks `pamper pamper2`).
  **Dialogue foot close-ups** (story.js `feetCut` / `FEET_WORDS`: a line that names her feet, toes, soles or shoes cuts to her
  feet in her sandals while she simply stands; `{ noFeet: true }` opts a line out) and **one short toe wiggle**
  (`S.toes(amp, rate, sec = 1.6)`; scenes that tickle pass `Infinity` and end it with `S.toes(0)`). Test flag
  `&holdtext=<part of a line>` stops on that line.
  **Toenail colour chooser** (index.html `chooseNails`, VER 111-116): a new game's "Begin" opens it; the start screen has a
  button for it at any time; 14 swatches, the colour under the pointer is tried on at once, a click keeps it
  (`localStorage amirian3d.nail`), "Start" begins. She lies back on her hands with her legs held up (clip `NailShow`),
  camera pinned (`pinCam`, fov 70) in front of and above her toes. Test: `?nails` opens it under `?auto`, `&nail=<i>`
  presets a colour; `tools/webkit/drive.mjs ... nail=<i>` hovers, pictures and chooses swatch i with the real pointer.
  Test flags (`auto ev ls ms log`) skip it.
  **Sandals: ankle strap fixed** (s2_sandals.py `level()`): the strap was cut from the skin's points near a height, which up
  the shin is half a loop of vertices; it dived into her ankle on the inner side and stood off in two fins. Now cut from
  exact level sections plus the points within 1.5 mm. Nearest skin to a sandal 0.89 mm.
  **Skin through the suit fixed** (anne_next.js `depthBias(m, 6)` on `Anne_Suit` and `Anne_Trim`, twin included): the fold of
  the armpit crossed the suit in a ragged line with an arm held across her; the suit's DEPTH is drawn 6 mm nearer.
  **Myconid hold**: the holding lady is drawn up to 1.3 x (`lady.size(1.3)`, actors.js), stands 0.52 m behind Anne and
  0.1 m to the far side, so her cap stands over Anne's head as on the sheet (at her own size Anne's head sank into the
  cap); Anne's hat lies in the grass for the scene; `shotMFace` (from the picture's side, above the caps).
  **Face close-ups** (`shot.face`): aimed by where her face looks (`C.headFwd`), `turn` = how far round to her left; marks
  `face1 face2 face3 mface`.
  Regression with the sandals and the fuller body (headless Chrome unless said): chooser + camp opening with real pointer
  and keys in WebKit; log `ls=tied|tickle`; mimic `ms=mput2|mtease|mend`; hole trap all five kinds to the end; pumpkin
  `h mm mmh`; Ivy `mh mmmm` (+ WebKit, all gauges missed); Myconid `mh mmmm`: every one ends
  `{heelsWorn:true, exclusiveClip:null, hat:true, shoes both on, y:0}`. `tools/endstate.sh <name> "<query with ev=>"` does that.
  Frame cost (WebKit, 1999x1300, `tools/perf.sh`): 11.6-12.1 ms against the 11 ms budget, measured under memory pressure;
  adaptive resolution covers it in play. No heavier shading was added for that reason.
- 10-02 evening. Start screen checked end to end in WebKit with the real pointer (`node tools/webkit/startflow.mjs`): Begin opens
  the chooser, hover tries a colour on, leaving puts the chosen one back, a click keeps it and stores it, Start begins with
  her sandals on; with a saved game Continue starts at once with the stored colour, and the start screen's own button
  opens the chooser. Alraune's lane played with real keys in WebKit and to both losing ends in Chrome. VER 124.
  OPEN: his own Safari has not seen any of this; the frame cost sits just over the budget (see above).

# Batch 9 (asked 2026-10-02 afternoon): legs closer, shoe styles and colours, shorter tongues. DONE (VER 142)
- **Legs closer together.** s1_body.py: `?-upperleg-fat-incr` 0.5 (thighs meet below the groin) and `legs_in` (`LEGS_IN` 0.012: everything
  from the hip joints down, the joints too, moved 12 mm towards the middle). gait.py: knees track a little IN (`knee_out` < 0, Idle's
  poles), walk and jog a little narrower. captures.js `THIGH_R` / `SHIN_R` re-measured (`tools/anne2/measure.py`).
- **Seven shoe styles** (tools/anne2/s2_sandals.py `STYLES`): sandal (default, names Anne_Heel_L/R kept), flipflop, tstrap, slide,
  toeloop (his photos IMG_9617-19), heels (open toe, stiletto), pumps (closed). Other styles are `Anne_Shoe_<id>_L/R` in anne2.glb and
  `Anne_ShoeProp_<id>` in `anne2_shoe_props.glb`; `anne2.json` `shoes` = order, labels, and for the high heels `dthetaDeg` 24.5 and
  `lift` 0.051. The flat ones share ONE sole, so they share her clips. The high heels are an ADDED pose in the game (anne_next.js
  `toesAfter`): foot pitched further about the shin's left-right axis, toes bent back by as much, rig node lifted while she stands or
  walks (`STAND`). Closed shoe: her forefoot and toenails are not drawn inside it (skin shader `uToeBox`, from `hide` in the json), so
  its toe box is a smooth shell. Loose shoes: every scene's copies share the geometry of ONE prop; `A.setShoeStyle(id)` copies the
  style's shape into it. `A.setShoeColor(upper, sole)`, `A.shoeStyles()`, `A.shoeStyle()`.
  Look at one: `Blender -b --python tools/anne2/shoes_dev.py -- --tag sh_x --style <id> [--macro|--ankle]`.
- **Chooser** (index.html `chooseNails`, now "Anne's look"): style buttons, 14 shoe colours, 7 sole colours, 14 toenail colours; hover
  tries on, click keeps (`localStorage amirian3d.shoe / .shoecol / .solecol / .nail`). Test: `?nails`, `&shoe=<id>&shoecol=<hex>&solecol=<hex>`.
- **Tongues short and ON her soles.** captures.js `lick(T, mouth, f, dt, k, period, w, th, reach = 0.085)`: capped length, laps 5 cm
  of sole under the mouth, every ring pushed out of the sole (`soleAir`); whoever licks is brought to the sole
  (`soleSpot`, `mouthTo`): Ivy heads slide and lean (toe end / far side, never over the sole), the second Myconid lady slides, sinks or
  draws herself up, Alraune's vines bring Anne's feet to her mouth (`AL.holdTo`), ghosts float to it, hole maidens' holders slide, the
  pumpkin keeps 6.5 cm (`PK.near`). logscene.js: the same for the Kuns (`kunLick` slides him beside the sole) and the mimic shoes.
  Measure: `tools/lick.sh <name> "<query&hold=mark>"` (captures / traps: `window.__lick`), `tools/lick2.sh` (log scene: `__lick2`):
  longest tongue, how far short, how much pushed. Now 43-140 mm long, was up to 430.

# Batch 10 (asked 2026-10-02, while batch 9 was under way). DONE (VER 148)
- **Never stuck.** index.html: walking is more forgiving than `free` (which scenes use to find a clear spot): she may stand up to
  `OUT` 0.15 m beyond walkable ground; a step is allowed when it ends on a clear spot or makes a blocked spot better (`canStep`);
  on blocked ground she is moved out of it every frame without a key (`unstick`: the steepest way out, or the nearest clear spot
  within 2.4 m). `window.__stuck()` reads it; `tools/endstate.sh` now also reports the spot a scene leaves her on and how far she
  can walk from it. Tested: dropped inside the mimic stone and 0.9 m out of bounds, she is out in under a second and walks.
- **Leg wraps tighter.** captures.js: every coil (`makeSpiral`) follows the leg's measured extent in four directions (`SHIN_E`,
  `THIGH_E` from tools/anne2/measure.py; a little boxier than an ellipse, tube + 1.5 mm off the skin), not the furthest point all
  round; the ankle wraps (`makeWraps`) are 4 mm narrower across.
- **The hole trap is in the middle of the camp**, a few steps from the fire towards where she arrives (traps.js `spots`; the spots by
  the log only if the camp's ground is not open), and the pile of leaves is a real heap now.
- **Her feet now and then while she speaks** (story.js `RAND_FEET` 0.27, never two of her lines running; five angles, the low ones
  behind her too). `?feetcut=<0..1>` sets the chance; under `?sa` it is 0 unless given.
- **Foot cam** (index.html, key F, any shoes): low behind her feet; F again: from behind and to her right, calves down; F again: off.
  The grass round her feet is laid flat while it is on.
- **Bored standing about** (gait.py `key_idle_fidget`, clips `IdleLook` 7 s and `IdleTiptoe` 8 s, keyed every frame): after 5 s
  without moving (then every 3.5-7.5 s) she looks round and down at the ground, or her free foot goes back behind the other and up on
  its toes and rocks there. In a backless style (flip-flops, toe-post sandals, slides) the shoe stays with her toes and her heel comes
  up out of it (anne_next.js `updDangle`: the worn shoe copied as it is, the copy riding on her toe bone). High heels: looking only.
  Walking or a scene ends it at once. `?nobored` turns it off; `window.__bored()`.
- Tested in WebKit with real clicks and keys: choose pink flip-flops in the chooser, walk, F, stand: the tiptoe with the heel out of
  the shoe, as in his photos (`Idle animnation base`); walking away ends it. Log `ls=end`, mimic `ms=mend`, hole, pumpkin, Ivy,
  Myconid: all end clean and she can walk off.


# Batch 11 (asked 2026-10-02 evening, with three later additions). DONE (VER 159)
Ankles a little thicker (`s1_body.py` `measure-ankle-circ-decr` 0.32); the flip-flop strap follows her foot in the sole
flash; the bored idles alternate left and right foot and wiggle her toes; Anne's look (shoes, colours, toenails) can be
changed during play (L, or the button); the sole flash in every kind of shoe with the shoe's sole left on the ground; a
crossed-ankles variant (`IdleCross`, `IdleCrossR`). The rest of the forest's rooms: the Caves (Map 21, `story_caves.js`)
and the Ivy Maidens' Nest (Map 20, `story_nest.js`) with every Chapter 1 event (see STORY_SPEC.md "The caves", "The nest");
the forest creature code moved to `creatures.js`; `traps.js` takes options for a hidden pit anywhere.
Then (asked during it): Alraune's lines in the lane meeting react to her shoes and toenail colour (the more of her feet
they show, the happier she is; closed heels disappoint her) and Amaymon says what he thinks at the camp (morning, the
fire when the look has changed, right after changing it there): `lookTalk` in `story_common.js`, `S.look()` from
index.html. Anne's face nearer her portraits, "more white, less Asian": `race` caucasian 1.0 (was 0.35 asian), a
straight nose with a bridge, deeper-set and a little smaller eyes, a narrower oval face, paler pinker skin, and a cooler
skin shade in `anne_next.js`.

# Batch 12 (asked 2026-10-02 night). DONE (VER 168)
- Bridge: she stands ON the planks (index.html `BRIDGE`, `DECK_H` 0.08; in scenes too while she stands).
- Water in every glade area (`world/pond.js`): layered drifting ripples, sky at grazing angles, deep vs shallow colour
  from a blurred map of the water tiles, a thin broken foam line at the bank, sun glint; dims at night.
- Foot cam: a third angle, low in front of her feet (F cycles behind, behind-right, front, off).
- Crossed ankles: `gait.py` keeps the crossing leg clear of the other: shin cross-sections from `measure.py`'s
  SHIN_E (outer, inner, back, front), the crossing foot moved back until they do not overlap (knees may touch), the
  crossing knee turned a little out, toes kept out of the standing heel. Previews: `gait_dev.py --views legs,legsR,legsL,legsRs`.
- The nest: built bigger (`level.tile` 2.1, any area may set its own tile size: `world/common.js`); she may stand on the
  very edge of the bank, 0.45 m into the shallows, following the bank's slope (`OUT_W`, glade areas only); a map in the
  corner (N; on by default in the rooms; story marks via `S.mapMarks`); her glowing blossoms along the way to Alraune
  (a path found through both loops); vine arches with lanterns where the paths run round to the other side (A, B).
- From a review workflow (two readers): hidden pits were showing the leaf pile and could be walked round (now hidden,
  r 1.0); a failed room pit wakes her at the checkpoint; `?dir=east|west`; the nest ladder no longer fires on reload;
  every stomp animates; creatures go back where they stood after Pamperings; 2D wording for the Myconid menu; the
  statue and the glade hole are walked into (and E); the close-up of her soles in Alraune's capture no longer sits
  behind Alraune's hair.
# Batch 13 (asked 2026-10-02 late night: every Chapter 1 monster scene, a tied-up choice, the epilogue, the opening,
# Ultra HD; then: no music in the intro, forest and bird sounds by day, music switchable). DONE (VER 190)
- Content line kept everywhere: the 2D's nude scenes are rebuilt CLOTHED (only her shoes and hat come off; tickling and
  foot licking); NOT recreated, clothed or not: footjob sets, genital frames, undressing, the futa and wetplay branches,
  whip/pain play, the lust-bar "enjoy" branches (Boudicca's _ENJOY too), Lilith's sexual stage (CE 87 406-471), the Lyra
  and Lucille seductions. Tied-prone scenes are framed on her feet and face, never centred on her rear.
- When caught (T): the 2D's scenes, tied up on her front (`captures.js bound`: ankles and big toes, licked or tickled by
  whoever caught her, in the style of the log), or both in turn (10-03, batch 15: now both in ONE capture by default, the
  tied scene as the last round). Every Chapter 1 captor has the tied version.
- Ivy Maidens wander as the 2D's do (`creatures.js roam`, a tile at a time, never after her); frozen in scenes and
  during the hollow-log scene. The pumpkin's tied close-up keeps her feet in the picture.
- Graphics: Ultra HD by default (U toggles High): full resolution, 3072 shadow maps, anisotropic filtering.
- Sound: the 2D's ambient loops always on (camp: birds, insects, wind; at night fire, crickets, trees; the pond's water;
  the rooms' drips; the library's storm); the music is off unless M (remembered). The 2D's sound effects and Anne's
  voice banks (giggle, laughter, cackling, gasp; Lilith's chuckle) in `story.js` `S.se`, `S.voice`, `S.voiceLoop`.
- THE OPENING (`story_library.js`, area `library`, an indoor set: `level.interior`): a new game goes from the camp's
  Begin to the haunted Secret Library at night in a storm; Lilith (`lilith.js`: blue hair, horns, pointed ears, red eyes,
  purple suit, gloves and boots, crimson bat wings, hovering) with Anne held in a high-backed chair by glowing violet
  bands (new clips ChairBound / ChairBare / ChairTickled); her heels slid off, kisses and licks on her soles, her nails
  ("Coochie coochie koo"), the Kiss of the Succubus on her sole, Amaymon's voice from his ball, Lilith leaves; the memory
  text on cards; then the camp's night before (`prologue` flag). Tests skip it with ?prog / ?hold / ?ev / ?noprologue.
- THE EPILOGUE (`story_edge.js` area `edge`, `story_road.js` area `road`; levels from `tools/make_level_epilogue.py`):
  the forest's lane at progress >= 30 leads to the clearing by the lotus pond; Boudicca (`boudicca.js`: silver ponytail
  with a blue bow, tanned, violet suit, arm guards, thigh boots) hops through the boughs and pounces; the hogtie
  interrogation in the hidden glade at dusk (new clips Hogtie / HogtieTickled for Anne, KneelSit for her; `ties.js`
  wrists and the hog line), the mark flaring on her sole, the long talk, the lick and the kisses, the _RESIST answer;
  the thief takes the Grimmoire and every coin (flag `grimmoireStolen`, coins 0); "Meanwhile..." (Lyra and Lilith over
  black, Theme7); the road east with Boudicca following, the theft found, Amaymon bonked twice; the end card (progress
  100, flag `boudicca`). After it the clearing and the road are open to walk with Boudicca a few steps behind.
- Scylla (`scylla.js`): four misses at the cave pit and the floor gives way to her grotto (tentacles round her ankles and
  big toes, tips on her soles, four kick-free gauges: "LIMBS OFF!!" or she wakes at her last rest).
- The 2D's other two hollow logs (CE 78): the North Forest (16,14) and the pond (34,8) (`index.html LOG_AT`, flags
  `logDone_forest`, `logDone_pond`). The forest's sixth Myconid patch (the 2D's EV15, on open ground at (33,42)).
- Not built from the 2D's Chapter 1 list: the forest's two vine ladders and the wall maiden (EV11, EV20, EV111), the
  three push-back vine walls, Alraune's optional CAPTURE2, the pond fairies and black imp as pickups, the Halloween pumpkins.

# Batch 14 (asked 2026-10-03, after batch 13). DONE (VER 198)
Asked: had every monster and tickle scene got the tied-up option? Lilith's lines to fit the shoes Anne actually wears;
Lilith clipping into the footstool; her hands glitchy and not smooth; both faces too puffy, softer and more feminine;
a way to skip the opening as in the 2D. Then: loose shoes floating or half in the ground in the tickle scenes, so they
lie on the ground or another monster licks their soles while the scene goes on; after every capture, a short scene of
Anne putting her shoes back on.
- Tied option: every Chapter 1 captor, Scylla's grotto included (`scylla.js grottoTied`). Not the mimic shoes: they are
  shoes she wears, not a captor. The log is tied already; Boudicca's and Lilith's scenes are scripted.
- Lilith: her shoe lines follow the style (`story_library.js shoeTalk`), the footstool is gone (she kneels at the near
  foot), and her hands are smooth (`thief.js`: fingertips measured over the whole wiggle, eased engage, soft reach,
  no carried bias; the gap to the sole stays positive, +3 mm).
- Faces: `tools/anne2/s1_body.py` targets (narrower jaw and chin, no cheek volume, smaller nose); Lilith and Boudicca
  are built from the same body.
- Skipping the opening: the 2D's start menu (Lilith's prelude / the scroll / first night / Amaymon / Start game), and
  Esc twice during the opening or the first night jumps to the morning.
- Loose shoes: `captures.js` (each style measured, `restOf`: upright or on its side; no wobble, no vines carrying them)
  and `logscene.js` (`fitProp`, `lieQ`, `lowY`); every style rests 2 mm above the ground. Then he added: the monsters
  lick the INSIDE of the shoe, not the bottom. So a licked shoe stands on its sole and the tongue lies on the footbed
  (measured per style: the lowest surface facing up near the centre line): the Myconid children in their capture
  (bowed over the rim), and in the log scene Kun D, who carries one shoe into the picture and licks inside it. An Ivy
  Maiden licker was tried and dropped (her head is bigger than the shoe; bowed to the grass her hair buried it): in the
  Ivy rounds her shoes just lie in the grass. Upside-down shoes were dropped too (a strappy sandal stands on its straps).
- Shoes back on (`captures.js putShoesOn`, gated by `A.lastBare`): after every capture's ending (free, wake-up, lost,
  the pits, Scylla, the hole trap, the pumpkin, the Ivy and Myconid pamperings); in the log scene after C1 and after
  the mimics; in the opening once Lilith has gone; on the road, before the walk with Boudicca.

# Batch 15 (asked 2026-10-03, after batch 14). VER 208
Asked: the monster captures keep ALL their animations and add the prone tied scene; the hole trap keeps its own
animations (no prone), but its monsters lick and tickle the footbeds of her shoes as well as her soles, and its views
come a little closer; the camera swings round behind her by itself while she walks; the Ivy Maidens, Boudicca and
Alraune in her nest comment on her feet, toenail colour and shoes as chosen; the mimic shoes did not sit fully on her
feet and her left leg went into the ground; the 2D's feather at the campsite with Anne tickling her own feet. (He also
said the threejs-skills file may be created if it helps: not needed for this batch.)
- Captures: S.capStyle() is 'both' by default (T cycles both / 2D only / tied only; new storage key
  `amirian3d.capstyle2`, so an old choice does not hide the new default). 'both': every 2D round as before, and if she
  is still caught, `bound()` with `o.chained` as the last round (its own opening and closing lines, her hat stays off in
  the grass). Ivy, Myconids, Alraune (creatures.js), Scylla (scylla.js: the 2D grotto, then `grottoTied(true)`), the
  pumpkin (traps.js: his two 2D rounds, then `pumpkinTied(st, true)`). Console `BOUND chained <kind>`.
- The hole trap: `tiedTrap` is gone. Her shoes land on the hollow's floor (`s.baseY`, captures.js) in front of her,
  standing on their soles; vines (vines, Ivy), two fairies (fairies) and two ghosts (ghosts: they float just behind a
  shoe and lick inside it) work the footbeds (`kit.shoeFrame`, `tick()` takes a frame function, `JOB.shoe`); a new
  `shot.shoes()` close-up in bouts 1 and 3 (marks `hshoe1`, `hshoe2`). Views closer: top 1.85 m, below 1.8 m fov 42,
  feet 0.62 m. The thief has no shoe work (she is the thief).
- Camera (index.html): `AUTO_FOLLOW`: while she walks the camera eases behind her (`heading + PI`, 1.7/s scaled by speed),
  paused 2.5 s after the player turns it by hand; the keys' frame is latched while held (`moveYaw`), so A or S do not
  chase their own tail. Off with `?nofollow` (and in tests that set `?yaw`, `?look`, `?cam`). After a scene it waits
  2.5 s; the foot cam returns behind her.
- Look comments: `story_common.js lookLines(who)` for 'ivy', 'bo', 'alNest' (shoe line per style, toenail line per
  colour; Ivy's tamed line; Boudicca's back-in-your-shoes line; Alraune notices new shoes since the forest via
  `S.flag('alLook')`). Slotted into: Ivy encounters (shoe and toenail lines take turns), Ivy round 1, the tied Ivy
  scene, the tamed pampering, the hole-trap maidens; Boudicca's "Gotcha", the glade's scene 1, the road after the
  put-on and `S.onLook` on the road; Alraune's nest boss, her 2D capture's toes close-up, the tied Alraune scene.
- Mimic shoes: new clips `MimSit`, `MimPutOn` (s3_finish.py `plant_foot(..., 'wedge')`: a planted foot stands in the
  wedge, pitched by TW and lifted so the ball marker is on the toe plate) and `SitTickle` re-planted; the wedge is as wide
  as her foot (0.088) with side walls (WFIT.wall) and a bigger heel cup. The left wedge went 6 cm into the ground; now 6 mm.
- The feather: a Stiff Feather lies by the camp (`E — Pick up the feather`, flag `feather`); "Rest by the fire" then
  offers "Relax with the feather...": shoes off beside her, clips FeatherSit / FeatherTickle / FeatherTickleHard
  (poses.py `key_feather`: right foot up before her chest, sole to her), the feather drawn from her right hand to her sole
  each frame, chuckle then giggles then laughter as it speeds up, the 2D's "continue / stop" choices each round; then her
  shoes back on. Marks `feather0`, `feather1`, `feather3`. Not recreated: the 2D's lust-gauge gate, its other sheet's
  self-worship frames.
- Review (two read-only agents, about 0.6M tokens) found 16 defects; all fixed: Alraune's "new shoes" check (S.flag(k)
  is a boolean: read S.state.flags), closed-heel toenail lines with her feet already bare (`lookLines(who, bare)`), the
  camera latch keyed on the wheel (now `camTurned`, Q / E and drag only), the look chooser letting scenes start under it
  (`prompting` checks `pinCam`), F / L during loading, the Myconid children's shoe tongues left on in rounds 2-3 and the
  children not called out (`lady.kids(true)`), ticklers sharing one tool mesh (six catkins, two fronds), the pumpkin's
  frozen tongue when chained, the chained gauge labels ("tied up · try n / 3"; the 2D's last gauge no longer says "Last
  chance" when the tied part follows), the chained hat (only kept off if the 2D part had it off), a tongue mesh per
  Scylla visit, the children sliding in from the map's origin, per-frame allocation in `shoeSole`.

# Batch 16 (asked 2026-10-03, after batch 15). VER 212
Asked: when she puts her shoes back on after a capture, if a monster licked the footbed of her shoe she says how wet
the inside feels (and a few more random lines); if it was tickled she says her feet still tickle from the vines and
tentacles rubbing inside her shoes; then she does the idle sole flash again, showing a little saliva or green tickle
specks on her soles, with dialogue.
- Who worked inside her shoes is noted as it happens: `A.shoeWork = { lick, tick }` (captures.js `noteShoe(kind, who)`,
  in the kit). The Myconid children (`shoeLick`, `who: 'kids'`), the hole trap's ghosts (lick) and its vines, Ivy
  Maidens and fairies (tickle) (traps.js `shoesDo(stage)` with each kind's `work: [kind, who]`). A capture's start
  clears it (`begin`, `kit.use(true)`), except the tied part chained after the 2D rounds (`begin(..., chained)`).
- `putShoesOn` (captures.js): when there was shoe work, it holds SitPutOn once the right foot is in (`A.holdClip`) for
  the first line; once she is up, `shoeFlash`: `IdleTiptoe` or `IdleTiptoeR` at random (`?flash=L|R` in tests), a low
  camera square on to the lifted sole, turned 30 degrees to the foot's outer side (a sandal's back strap runs down the
  middle of the view), looking a little under it (the dialogue box covers the bottom); the clip is held at 3.3 s (L) or
  3.7 s (R), when she has looked back down at it (mark `shoeflash`); a line; then her face and one more line. Every
  line is picked at random (`SHOE_LINES` in / sole / out; console `SHOE LINE <when>: ...`, `SHOE FLASH <clip> wet|specks`).
- The marks (anne_next.js `soleMarks(kind, sec)`: 'wet' | 'specks' | 'both' | null, 45 s then a 3 s fade): fitted ON
  the skin (each placed on the highest skin point facing out of the sole near it, in the foot bone's space, from the
  bind pose; widths per stretch of the sole from the same points). Saliva: a faint glaze whose edges fade (alphaMap),
  unlit white shine strokes and tiny bubbles (a lit clear film only darkened the skin where it mirrored the ground and
  read as dirt). Specks: 46 tiny green and yellow-green bits per sole (an InstancedMesh). Cleared when a capture starts.
- The log scene: `dLicked` (D got to lick inside her shoe); after the put-on W1 (she sits in them), then up: `flashOn`
  (the clip, shot 'flash', the grass round her feet lies down: `flashFlat`), W2 over the held clip, `flashOff`, W3 (a
  random line each: a line's text may be an array). Test targets `ls=wet1|wet2|wet3` (the driver loses two rounds first:
  `miss: 2`, so that D gets to her shoe).
- `A.holdClip(on, at)`: pauses the clip she plays (`action.paused`; a ONE_SHOT replay resets it).

# Batch 17 (asked 2026-10-03, while batch 16 was under way). VER 217
Asked: everyday names for her toenail colours (shades allowed) and every enemy's and Amaymon's lines matching the
colour; more kinds of shoe with the dialogue and mechanics of the others; the hole trap's Ivy Maidens stand too close to
see the soles being licked: longer tongues; after she shows her feet with tickle spores or saliva on them, the option of
a minigame: clean them with a fuzzy brush by moving the mouse over one sole, then the other (she giggles: it is a
ticklish scrub brush); the saliva and spores more spread out and on the footbed of her shoes as well as her soles; her
feet and shoes must NEVER sink into the ground anywhere, in any cutscene; in the foot cam a side bar to tickle or lick
her soles (as the 2D lets Anne freestyle-tickle a foe: hands, feather, tongue...): she reacts, holds the foot-teasing
pose while she is played with, and changes her shoes now and then.
- Toenail colours (index.html `NAILS`): Purple, Light purple, Dark purple, Red, Dark red, Pink, Hot pink, Light pink,
  Orange, Yellow, Gold, Green, Light green, Teal, Blue, Light blue, Dark blue, Black, White, Silver. A colour saved under
  an old name goes to the nearest (`nearestNail`). Lines: story_common.js `NAIL_FAM` (the families in the order tried,
  shades before the plain colour) and one word list per speaker in that order (`fam([...])`: Alraune, Amaymon, the Ivy
  Maidens, Boudicca); Lilith names the colour itself. Checked: every colour reaches its own entry for every speaker.
- Five more kinds of shoe (tools/anne2/s2_sandals.py `STYLES`, twelve now; thirteen since batch 22's `geta`): `gladiator` (three bands, a strap up the
  middle to the ankle strap: `spine`), `cross` (crossover slides: two slanted bands, `xover`, the upper one lifted over
  the other), `wedges` (a high heel whose sole is carried down to the ground from heel to ball: `style["wedge"]`; same
  heel height as `heels`, so the Hi clips and the heel pose fit), `flats` (ballet flats: the pumps' closed upper on the
  flat sole), `mules` (`upper(mule=True)`: the toe box only, open behind the instep). All keep the two materials in
  order. Lines for each: story_common.js (`SHOW` cross 3, gladiator 2, wedges 1, flats and mules 0; `NOUN`; Ivy, Boudicca,
  Alraune in the forest and in her nest, Amaymon), story_library.js (Lilith, Anne's answer, the closed kinds' "all this
  time"), traps.js (Aurelia), story.js `FEET_WORDS`. The sole flash, the loose shoes, the put-on, the footbed measure
  take any style as it is.
- The hole trap's Ivy Maidens (traps.js `updMaids`): mouths 22 cm to the outer side of each sole (were 9 cm), tongues
  up to 34 cm (`lick(..., reach)`); the feet shot goes between the two of them (`shot.feet`: side 0, 0.74 m for `ivy`).
- Marks (anne_next.js): one system, `layMarks(sample, fwd, o)`: saliva (streaks with highlights, droplets, bubbles) and
  specks (a jittered grid) spread over the whole stretch. On her soles heel to ball (`soleModel`: the skin's points in
  the foot bone's space), on the footbed of the shoes she wears (`bedModel`: the insole's own points behind the toe
  joints; thin, in the 1 mm under her sole; in the sole flash the set is attached to the baked shoe so it stays down in
  it), and on a loose shoe's footbed (`A.propMarks(profile)`: captures.js `shoeBed` grows them while the shoe is licked
  or tickled, logscene.js `updBeds` for the shoe D licks). `A.shoeWork` is now cleared when the shoes are back on.
- The sole flash keeps its dropped shoe until her heel is back in it (`updDangle`: the heel's place as seen from her
  toes), so a scene can end the flash early with a fade.
- footplay.js (new): the player's tools on her soles. `clean(o)`: the fuzzy-brush clean-up (offered by a choice after the
  flash's line, captures.js `shoeFlash` and logscene.js `brush`; W4 after it): the brush follows the mouse over the sole
  that is up (`A.solePoint`, `A.soleUV`), `A.scrubMarks` shrinks the marks under it, a bar shows how clean; then the other
  foot comes up; she laughs the more the faster it goes (expression, toes, voice, bubbles). In story tests (`sa=`) and
  log tests (`ls=`) the brush goes by itself. The foot cam (F): a side bar "Her soles" (Fingers, Feather, Tongue, Fuzzy
  brush); click a foot, she lifts it into the flash and holds it while it is played with; left alone 3 s she lets it
  down; the tongue leaves saliva where it goes (`soleMarks(.., { empty: true })` then negative scrubbing), the brush
  takes it off; after about 25 s of play she changes into another pair (`newShoes`, kept as her look). Host: index.html
  (`footPlay.update`, `camGoal`, `wantsPointer`, `busy` stops the bored idles). Console `FOOTPLAY ...`.
- Never under the ground (anne_next.js `groundFeet`, after every clip update and once more after the scenes' own
  updates): the outermost points of each foot (skin and toes; the shoe on it) are compared with the ground under them
  (`setGround(fn)`: index.html gives the planks of a bridge and the pond's bed; `setFloor(y)`: the hollow under the hole
  trap) and the leg is bent (two-bone IK, the foot keeps its tilt) until nothing is below it. More than 35 cm under is
  left alone (a fall into a pit). `A.groundStats()` reports the deepest it had to correct.

# Batch 18 (asked 2026-10-03, while batch 17 was being finished). VER 229
Asked: the tongue by a CLICK on her sole, coming not from the ground but from right behind her sole: one quick lick from
the bottom of the sole dragged all the way up to the heel, Anne giggling; the fingers a human, feminine hand with long
sharp nails in a colour the player chooses, in two ways: "Teasing" (the hand rakes slowly across her sole again and
again) and "Tickling" (the nails down on her sole, only the fingers moving); the feather should bend and flex like a real
one; she hardly reacted beyond her toes: her legs should shake a bit; her shoes clipped into the ground a lot while she was
played with: not at all; how much she giggles or laughs depends on the tool (the feather: she likes it, teased; the raking
hand and the tongue: giggles; the hard tickling hand and the brush: laughter); then an option to tie her up: prone on her
stomach, toes and ankles tied, with every tool and animation of the foot teasing usable on her there.
- Review of batch 17 first (two read-only agents, about 0.39M tokens): 7 defects, all fixed: a bored idle already playing
  the flash clip froze her flat when that foot was clicked (lift() restarts it past 5 s); `footPlay.stop()` a frame after
  an E-started scene undid its first clip (now stopped before `interact()`); a queued other foot was still lifted after
  the tool was put away; an "empty" marks session was not remembered (`MK.fill`); negative scrubbing regrew specks; any
  change of look during a flash showed the worn shoe beside its dropped copy (`dangle.style`, the node kept hidden);
  the marks could time out before the brush began (re-armed).
- footplay.js rewritten. The hand (`makeHand`): Anne's own right hand and forearm cut out of her skin mesh into a small
  SkinnedMesh on copies of those bones in the bind pose (from `skeleton.boneInverses`), in a frame of its own (wrist at the
  origin, fingers +Z, back of the hand +Y, thumb's side +X), shaded by her own `Anne_Skin` material, with a long pointed
  nail on every fingertip (`nailMat`, the player's colour: 12 swatches, kept as `amirian3d.handnail`); `curl(a1, a2, a3)`
  per finger, `wristBend`. It is set down by its nail tips (`placeHand`): fingers pointing down the sole, the forearm
  rising off it behind the heel (never up out of the ground). Teasing: one slow rake every 1.7 s from the ball of the
  foot up to the heel, lifted back. Tickling: the hand stays, the fingers scribble at 3 Hz. (`makeHandPlain`: capsules,
  only if the model had no such bones.)
- The feather: a ribbon drawn each frame along a cubic curve from the quill (off the sole, on the foot's outer side) to
  the tip on the skin: pressed nearly flat before the tip, trailing behind its own strokes (`featherLag`), fluttering.
- The tongue: a click on the sole (`startLick`): a mouth just off the sole's outer edge, 4.5 cm behind it, turned half to
  the picture; the tongue out onto the ball of the foot and dragged up to the heel in 1.15 s, saliva growing behind it;
  a second click queues one more. Waiting, the mouth hovers level with the pointer.
- How she takes it (`PROF`): feather cap 0.46 (smile, then `embarrassed`, then `happy`; chuckles; "that's... kind of
  nice"), raking nails and tongue cap 0.68 (`laugh`, giggles), scribbling nails and brush cap 1.0 (`laughHard`,
  laughter). Her leg shakes: `A.setLegShake(side, amp, mode)`: 'pivot' (standing: the foot trembles about the ball of
  the foot, the knee following by IK, toes kept as they are; measured 12 mm at the heel) or 'knee' (tied: the shin jerks
  up at the knee, never down).
- The shoe she steps out of: it rode on toe 2, which wiggles when she is tickled, and rocked into the ground; it rides on
  toe 3 now (the bone the shoe's toe part is bound to, still in a shoe), is lifted if any of its low points would go
  under the ground, and is placed BEFORE the leg shake. Measured while tickled at full strength: lowest point 0.00 mm
  in sandals, heels, mules, flip-flops (`A.dangleLow()`).
- "Tie her up" / "Untie her" (the side bar's last button; a short fade): shoes off beside her, `StuckFlat`, the ties of
  ties.js (ankles roped, big toes tied and pegged), the camera square on to both soles (`tiedCam`); the pointer picks the
  sole it is over; `StuckFlatTickled` while the level is above 0.3; walking is off (`footPlay.tied()`), F or any scene
  unties her at once.
- Tests: `tools`-style drivers through `__dbg.footPlay`: `setTool`, `setFingers('tease'|'tickle')`, `setNail(hex)`,
  `_click(side)`, `_point(u, v, side)`, `_lick(side, v)`, `tie(on)`, `state()`. Syntax checks must parse the files as
  MODULES (`node --check` on a `.js` with top-level await passed a broken file): copy to `.mjs` first.

# Batch 19 (asked 2026-10-03, while batch 18 was being finished). VER 231 (ankles, the pit), 251 (the rest)
Asked: when her ankles are tied they are not close enough together: clamped right next to each other, in any instance;
the tongue not so long: about the size of a real human tongue; again different comments by Anne, at random, depending on
what is at her feet (the feather she finds teasing and even a bit enjoyable; the tongue slightly shocks her: "Did you
just lick my feet?"), different kinds of dialogue like this for all options; in the tentacle pit, not the Ivy Maidens'
models reused but tentacles / vines of its own.
- Ankles (anne_next.js): `A.anklesTogether(0..1)`: each ankle is drawn to the middle between them (two-bone IK, the feet
  keep their tilt) until the joints are 5 cm apart (`ANK.gap`: her heels touch). Called by ties.js (captures, the
  epilogue, the foot cam's "Tie her up"), logscene.js `updTies`, the hole trap's coil and cuffs, the pumpkin's vine;
  each sets it back to 0 at its end. Measured 0.050 m in five tied scenes (`A.ankleGap()`).
- The hole trap's fourth dweller (traps.js `KINDS.ivy`, the key is kept, its label is "Tentacles"): no maidens; six
  tentacles of its own (`tents`: `kit.makeVine` in dark violet and plum with a row of pale suckers, `updTents`, jobs
  `TJOB.sole` and `TJOB.shoe`) come up out of the pit: they take her shoes off, tease and tickle her soles, lick inside
  the shoes; a seventh winds her ankles (`spiralTent`). Her first line there: "T-TENTACLES?!".
- The tongue (footplay.js `makeTongue`, `poseLick`): 2.3 cm wide at its root, 2.9 in its middle, about 4 cm out of the
  mouth (it was a thin 9 cm), flat, round-tipped; the mouth (5 cm lips) is over her sole itself, 3 cm nearer her toes
  than the tongue's tip and 2.7 cm off her skin, and goes up the sole with the lick.
- What she says (footplay.js `LINES`): for each of feather, teasing nails, tickling nails, tongue, brush a pool `first`
  (as it first touches her: the feather "that is so soft...", the tongue "EEP! ...D-did you just lick my foot?!" with a
  second of the `surprised` face), `mid` (while it goes on; the feather she rather likes: "okay, I admit it. I like this
  one"), `hard` (the laughing kinds, above 0.7), `after` (when it is stopped); the feather has `toes` for its flicks
  under her toes; `tied`, `swap`, `shoes`, `lift`. Picked at random, never the same line twice running (`pick`).

# Batch 20 (asked 2026-10-03, while batch 19 was under way). VER 251
Asked: the movements when tickling her are still very fidgety and unsmooth (the hand and arm above all, "more of a solid
rake motion"); the sharp fingers must move too, not just the hand; the player should not control the hand: an automatic,
cinematic animation with no input besides stopping it or switching to something else; and his Motion Reel Kit
(~/Documents/Claude/motion-reel-kit) brought into the game itself for more cinematic scenes.
- The kit in the game: `lib/motion.js` is the kit's spring library, unchanged (a note on top). footplay.js follows its
  rules: every move a closed-form spring and a pure function of the take's time (`makeTrack`: `Motion.track`, one
  spring per change, never restarted; keys per bar, the last four bars summed); seeded variation only (`mulberry32`,
  `rnd(seed, n, channel)`, `noise1`), so a take always plays the same way; a beat grid (96 a minute, `BEAT` 0.625 s,
  `BAR` 2.5 s) for strokes, hops, licks, her voice (`onBeat`) and her lines (beat 1 of every other bar); a shot list
  with hard cuts on bar lines, no crossfades, every held shot pushed in 6 % and drifting (`SEQS`, `shotAt`, `anchor`,
  `shotPose`); something new every bar; her bubble pops in on a spring instead of fading in.
- No steering: picking a tool starts it (standing: she lifts a foot by herself, takes of 8 bars, then the other foot,
  now and then in another pair of shoes; tied: takes of 4 bars, the soles in turn). The side bar: the tools, "Stop",
  "Tie her up". `wantsPointer()` is true only in the clean-up after a capture, which is still played with the mouse.
- Why it was fidgety, and what was done:
  1. the sole's own point and normal came from the nearest skin vertex (anne_next.js `solePoint`), and its width in
     steps of a tenth of its length: a tool drawn along it stepped from vertex to vertex and turned with each normal.
     Now `soleOf(sd)`: the skin sampled once into a grid of heights in the foot bone's space, smoothed, read with
     Catmull-Rom splines (`pos`, `nrm`, `uvh`); beyond the flat of the sole it goes on level, so a nail's height falls
     evenly as its knuckle curls (one answer only).
  2. the whole hand was re-fitted every frame by its lowest nail. Now the hand's place comes from the tracks alone, and
     each nail is brought to her skin by its own knuckle (`fingerDown`: stepped and halved from the pose's own curl,
     never past straight down; `arcOf`), so the fingers are what moves: a ripple through them as they rake (one a
     beat, and they curl in as they pull), three ways of scribbling when they tickle (blended by weights on springs).
  3. the hand rode on her foot, and her foot shook at 9 to 21 Hz. Now the shake is 3 to 6.5 Hz (anne_next.js
     `legShake`), and the hand is held on her foot as it is BEFORE the shake (`A.footRest(side)`; tied: the middle of
     the knee shake), steady; only the nails ride the skin as it quivers.
- The hand: the hand of the foot's own side (`makeHand('R' | 'L')`: both of Anne's are cut out), coming in slanting
  across the sole from its outer side (yaw 0.85): its four nails lie in a slanting row no wider than her sole and its
  palm is beside her foot, not over it; curled fingertips are drawn together as a real hand's are (`sp`). Tied: a hand
  on each sole at once (`take.two`).
- Shots (close ones only: a hand ends at its elbow, so its arm leaves the picture by an edge): standing `side`,
  `inner`, `profile`, `sole`, `face` (from under her hat's brim), `toes` (from in front, low); tied `both`, `close`,
  `tface`. index.html `footCamera` takes `camGoal()` as it is when it says `direct`. In a high-heeled style
  (`A.shoeHeel()`), the shoe she has stepped out of stands between a low camera and her sole: `sole` and `inner` then
  look down over it from 17 cm higher.
- Measured (`__dbg.footPlay._probe(seconds)`: the tool's pose every 1/120 s): raking hand wrist 0.42 m/s, 13 m/s2 at
  most, nail tip 0.64 m/s, 40 m/s2 (the lift at the end of a rake); scribbling 24 m/s2; feather 11; brush 7. Every
  nail over her sole between 0.5 mm and its target above her skin, standing and tied, never in it. A live take at 60
  frames a second: lift 2.5 s, shots at 0, 5, 10, 12.5, 17.5 s, down at 20 s, the other foot up by 26 s.
- Tests: `_seed(n)`, `_seek(seconds, freeze)`, `_freeze(on)`, `_probe(sec)`, `_series(beat0, beat1, n)` (curls and nail
  heights), `_worst(reset)`, `_diag()`, `state()` (`take`: number, time, bar, beat, shot). Console `FOOTPLAY take ...`,
  `FOOTPLAY shot ...`, `FOOTPLAY says: ...`. Three drivers are now in `tools/`: `tools/chk.sh <files>` (the module-aware
  syntax check), `tools/tune.mjs` (evaluate a list of snippets in the page, a screenshot after each: how the takes were
  stepped through and probed), `tools/reg.sh [dir]` (the 22 capture scenes played to their end, one browser at a time).
- Checked at VER 249 to 251: the 22 scenes of `tools/reg.sh` all reach their end (the mouse clean-up finishes in the eight
  that have it); a WebKit run (hand, tongue, tie, two hands) without an error; stop while she lifts, a change of tool in
  mid-take, tying and untying while it runs, and F while it runs all leave her standing in her shoes.
- The independent review: the first try (one read-only agent given the whole of footplay.js) wrote nothing in 47
  minutes and was stopped. The second (three readers, one slice and one concern each, line ranges, at most 5 findings,
  structured output) took 8.5 minutes and about 0.33M tokens: five findings, all fixed (VER 253): a tie still fading in
  could land on top of a scene started in the same instant (`ST.tieGen`: `stop()` and `clean()` call a pending tie off);
  `stop()` let her clip go only with a foot up, not in the frame between two takes; the tongue's startled second
  (`ST.shock`) leaked into whatever played next; the scribbling hand's first hop could land where it started (`spotOf`);
  her voice's spacing was reset by every new take (`ST.voiceAt`). Found on the way: a scene begun by touch (a roaming
  creature) in the same frame had its first clip let go by `stop()`: now only a clip that is still ours is released
  (`clipIsOurs`). The geometry slice found nothing.

# After batch 20 (2026-10-03: "what should be next? whatever it is, start on that"): the kit's camera in every scene. VER 253
He left the choice to me. Chosen: (1) the review above; (2) his "more cinematic scenes" taken beyond the foot cam: two
of the Motion Reel Kit's rules put into the cameras that every scene uses.
- story.js `updCam` (all story scenes: captures, traps, dialogues): a move that is not a cut is now a closed-form,
  critically damped spring (`Motion.step`; response 4 / rate: a rate of 3.2 settles in about a second, as before) and a
  new goal in mid-move adds a spring without restarting the first (`segs`): the old blend started at full speed (measured
  on a 3.5 m move: 11.4 m/s in its first frame; now 2.1 m/s, rising to 7.4). Every held shot keeps moving: pushed in
  4.5 % over nine seconds and drifting a few millimetres (seeded noise). A cut cuts the lens too (it used to zoom after
  the cut). `{ still: true }` on a shot keeps it dead still (captures.js: the mouse brush). Measured in two capture
  scenes over 15 s: 883 of 900 frames were dead still before, none now; the same cuts; no jump in speed.
- logscene.js `updCamera`: the same push (3.5 %) and drift on every shot but the brush's and a test's; its authored
  half-second blends are left as they are.
- `?camkit=0` gives both back as they were, to compare.
- Left alone on purpose: the 2D rounds' staging and cut timing (waits, not beats: there is no music under the scenes to
  be on the beat of), the game's own follow camera, the foot cam's default views.
- Checked at VER 253: `tools/reg.sh` again, 22 of 22 scenes to their end, no exception, the mouse clean-up finished in
  the eight that have it; a capture (the pumpkin) and the log scene in WebKit without an error; the three fixes above
  by test (stop between two takes at six moments; a tie called off in its fade; a scene's first clip kept when the bar
  goes off under it, standing and tied).


# Batch 21 (2026-10-04): the player's own Anne. VER 261
## The request, verbatim
"For the character of Anne herself, have her be customizable at the beggining of the game where you can change her skin
tone, race (an asian, black, hispanic, white, or mixed character for diversity and inclusion), face, eyes, haircolor,
hairstyle, outfit (to multiple different types of outfits), etc. Also when a user starts up the game, ne need to ask
them to change Anne's footwear or toenails on both the title screen and then still give them that option if they click
'new/continue game'. Also have it where the user can change Anne's name at the beggining as well. When Anne is getting
her feet played with from the footcam scene, no need to cut to Anne's face laughing having it take up the whole screen.
Instead have it be in the coner at all times." Then: "also include Indian, Native American and Arab, as well in the
options for more diversity and inclusion as well please."

## How the unclear sentence was read
"ne need to ask them to change Anne's footwear or toenails on both the title screen and then ... if they click
new/continue game" reads as "no need" or as "we need". What was built serves both: nothing is asked twice, and the offer
is always in reach. The title screen has two optional buttons ("Customize <name>", "Shoes and toenails": the same panel
on its Name or its Feet tab); a NEW game goes through the panel once (Begin); Continue goes straight in; during play L
(or the button under the counters) opens the panel. He was told so in the report.

## What there is
- `looks.js` (`createLooks(env)`): the panel `#cc` with eight tabs: Name, Heritage, Skin, Face, Eyes, Hair, Outfit,
  Feet (the old shoes-and-toenails card, moved in). Hover tries on, click keeps; the camera frames what the tab is about;
  drag turns her. The look is kept under `localStorage['amirian3d.look.v1']`.
  - Name: up to 14 characters; every line, card, toast, choice and name plate says it (`story.js` `tx()`; the log scene
    through `window.__heroName`).
  - Heritage: eight starting points (Asian, Black, Hispanic, White, Mixed, Indian, Native American, Arab): a skin tone,
    eye and hair colours, and a face (weights of the face shapes below). Everything can be changed afterwards.
  - Skin: 14 tones (Porcelain to Ebony). Eyes: 10 colours, 4 lid sets, slant, lid fold. Hair: 18 colours, 10 styles
    (long, wavy, curls, bob, pixie, ponytail, twintails, braids, bun, afro: the last goes without the hat).
  - Face: sliders for Softness, Jaw, Cheekbones, Chin, Roundness, Nose width / bridge / length, Lips, Mouth width, Brow.
  - Outfit: nine (Witch, Sorceress, Adventurer, Summer dress, Scholar, Sporty, Rose, Midnight, Skater): colours of suit,
    trim, gloves, choker, hat and band; a second suit colour below a height; arms gloved, bare or with bracers; stockings
    of any colour and height; a short flared skirt, a skirt to the knee, a belt with a buckle; the hat on or off. A suit
    colour of the player's own (14) and the hat on/off can be set over any outfit.
- The model (`tools/anne2`): `s2_hair.py` builds the ten hairstyles (nodes `Anne_Hair`, `Anne_Hair_<id>`;
  `build/anne2_hair.json` -> `anne2.json` `hair`); `s2_outfit.py` builds `Anne_Skirt`, `Anne_SkirtLong` (+ `...Trim`)
  and `Anne_Belt` (ring-built cloth: `body_ring` is the CONVEX outline of her skin in a band of heights; rays from her
  middle fall into the gap between her thighs and gave a collapsed skirt); `s3_finish.py` `face_shapes()` adds 15 static
  shape keys `shape-...` (sums of MakeHuman's own targets, carried to her stylised head by `retarget_gain`, masked to her
  face, slid on the eyeball near the eyes, lips kept closed (`seal`); the two heritage bases are the other two MakeHuman
  macros with the head's own move/turn/scale taken out (`unposed`: without that they moved her face by 146 mm)).
  Brows, lashes and the mouth's inside get the same keys (`transfer_keys`, `interior_follows_skin`).
- The game (`anne_next.js`): `setSkinTone, setEyeColor, setHairColor, setHairStyle, setShape, setLidBias,
  setOutfitColors (suit, suit2+split, trim, glove, choker, hat, band, skirt, belt), setArms, setLegs, setParts,
  setHatWorn, hatWorn, snapFace, ownSkin`. Twins (Lilith, Boudicca, the thief, Scylla) and the foot cam's hands take
  none of it (`ownLook()`: own uniforms; `builtColor`: colours as built).
- Her portraits: once her look is not the built one, a line's portrait is a picture of HER face in that expression, made
  in the game (`looks.portrait(expr, blush)` -> `post.portrait(camera)`: a camera and two lights of their own on layer
  2, 288 px, cached until her look changes; warmed up at load and when the panel closes).
- The foot cam: no full-screen cut to her face any more. Her laughing face is in a round-cornered inset at the bottom
  left for as long as a tool plays or she is tied (`post.setInset`, layer 1, 196 px; `footplay.js` `faceInset`).
- Lines that spoke of her looks follow them (`S.lookWords()`: `hairWord`, `soleWord`, `pale`, `hat`): Alraune's
  "redheaded friend", Lilith's "from the tip of her hat" and "your feet look quite pale", the "porcelain soles" toast.
- The loose hat of the scenes (`actors.js makeWitchHat`) is the hat of her look: in its colours, and never shown when
  her look has no hat (`window.__hatLook`, an accessor on the prop's `visible`).

## Checked (VER 262)
- Contact sheets from the game: every face shape at +1 and -1, the eight heritages, the nine outfits, the ten hairstyles
  with and without the hat, the belted outfits close up.
- The title screen in a fresh browser: "Begin | Customize Anne | Shoes and toenails"; Begin opens the panel on its Name
  tab; a name typed there ("Priya") is on the look button and in the saved look; the Feet tab shows her feet; Begin
  starts the game.
- A capture with a twin in it (the thief) and a custom look: the thief keeps her own hair, dress and skin (her hair node
  the default one, no skirt, no face shape); the foot cam with a custom look: the hands keep their own skin, her face
  is in the corner with her own tone and hair.
- `tools/reg.sh`: 22 of 22 scenes to their end, no error. WebKit: a capture with a custom look to its end, no exception.
- NOT checked: Safari itself with a custom look (WebKit's test build only); the portrait's cost on a slow machine.

# Batch 22 (2026-10-04, queued by him during batch 21): a face of her own, Lilith's portal, species, his outfit list, lines about her looks, geta. VER 273+
## The request, verbatim
"Once you're done with the current task you're working on I have a few more things. Make Anne's facial structure also be
editable as well so If i want a softer more femine face I can change that. Have the female hands with the sharp finger
nails, and the tounge belong to Lilith and when in the footcam if the user clicks on the hands option have a small portal
open up from the ground and the female hands rise up from there before they start to tickle Anne's feet. Have Lilith
mention to Anne (and thus the player) and she can summon Lilith Anytime by doing this method. Also give the player the
option to have Anne be other species as well, like a Angel girl, Demon girl, alien girl, elf girl, robot girl, ghost
girl, plant girl, etc in the customizable menu. Give Anne the option to also have outfits like the nerd girl,
cheerleader girl, business casual, beach girl, harem girl, goth girl, bikini armor, princess girl, gym girl, supervillan
girl, fairy girl, lingerie, simple t-shirt and panties, sport outfit, kimono, towel, maid, teacher girl. pjamas, crop top,
tank top, school girl, mimikirt, short skirt, bunny girl, cheongsam, evil queen, greek goodess, dancer girl, blouse,
gothic lingerie, tribsl golbin outfit, pastel with laces, emo girl, stage bunny girl outfit, royal queen outfit, flight
attnedent, coastal myth outfit, J-pop/K-pop outfit, slave Leia outfit (from retrun on the Jedi), mature outing fit, etc.
Based on the characters appreance, race, type of shoes, color, and outfit, make the dialoge by Lilith, Annymon, Alurane,
Ivy maiden, and any other enemy that can talk make comments accoridnly (for example dialoge by Alurane: "And those sexy
White feet in those flip flops, how pink and ticklish are those soles of yours darling?"). Add another shoe for Anne to
wear (Kimono wooden sandals). Only get started on this once you're done with your current list of tasks."

## Two lines I kept, and told him
- Every outfit covers what a swimsuit covers, or more: her chest and her seat are never bare. The three he named after
  underwear are in as nightwear with a top and shorts ("Satin nightwear", "T-shirt and sleep shorts", "Gothic
  nightwear"); the Return-of-the-Jedi one is "Space princess" (the gold two-piece with the long maroon panels).
- The lines speak of the TONE of her skin, her hair, her shoes, her outfit and her species, never of a race: his example
  became Alraune's "And those pretty porcelain feet in those purple flip-flops, darling... how pink and ticklish are
  those soles of yours?" (the tone's word changes with the skin chosen: honey, caramel, ebony, mint-green...).

## What there is
- Face (looks.js Face tab): six ready-made shapes (As built, Soft, Round, Heart, Sharp, Strong) over the eleven sliders
  (Softness, Jaw, Cheekbones, Chin, Roundness, Nose width / bridge / length, Lips, Mouth width, Brow) and the two builds.
- Lilith's portal (footplay.js): the foot cam's hands and tongue are Lilith's (her pale skin, her long purple gloves,
  fingerless here). Picking Fingers or Tongue opens a swirling portal in the ground under her elbow; her arm comes up out
  of it (an upper arm from each elbow down into the portal, `ARMS`, `armsTick`); the tongue's mouth has a small portal of
  its own that rises out of the one in the ground. `summon()`: the intro before a take (the tool posed as at the take's
  start, brought up from under the portal by a spring; the camera stands back to show the ground). The first time ever
  (kept under `amirian3d.lilithCalled`) it lasts three bars and Lilith says how to call her: "Remember this little trick,
  my dearest <name>: pick my Fingers or my Tongue, and I come through. Any time you like."; afterwards one bar and a
  hello; on each new sole two beats. Lilith has her own bubble (`#fp-bubble2`, `lilSays`) and speaks between Anne's lines:
  about what she is doing, or about Anne's looks (`lilLooks`: her soles' tone, toenail colour, shoes, outfit, species).
- Species (looks.js Species tab; `SPECIES`): Human, Elf, Angel, Demon, Alien, Robot, Ghost, Plant, Cat girl, Fairy. Each
  is what wear.js hangs on her (halo and feathered wings; horns, bat wings and a tail; antennae; ear discs and an aerial;
  a flower crown and leaves; cat ears and a tail in her hair's colour; fairy wings), a share of the elf-ear face shape,
  a suggested skin tone, eyes and hair (taken back when she leaves the species), a skin finish (the robot's metal) or a
  glow (the ghost). The Skin tab has 14 more tones for them. A hat does not go over horns, ears, a halo or a crown.
- Outfits: fifty (the nine of batch 21 and his forty-one), grouped on the Outfit tab. An outfit is data (`OUTFITS`): a
  cut of her suit (`cut`), colours, a pattern on suit and skirt, sleeves and gloves painted on her arms, stockings with a
  make (net, hoops, sheer), cloth of the model (`parts`), things from wear.js (`acc`), a `theme` for the lines.
  - anne_next.js: `setCut` (a bare midriff, a neckline with or without straps, a V in front only, a high leg line):
    the suit is not drawn there and the SAME surface is drawn as her skin by a second mesh (`Anne_SuitBare`: her skin's
    material on the suit's geometry and bones, sunk 3 mm to where her skin was, not drawn on the suit's own hems where her
    real skin still is: `aHem`). `setPattern` (hoops, stripes, dots, plaid, scales), `setSleeves`, `setArms(kind, colour,
    ends)`, `setLegs(colour, top, make, colour2, size)`, `setSuitFinish({ metal })`, `setSkinFinish`, `setGlow`,
    `setTrimLow` (no bead where painted trousers meet the suit).
  - the model: `Anne_SkirtTube`, `Anne_SkirtPencil`, `Anne_SkirtMaxi`, `Anne_Tutu`, `Anne_Panels`, `Anne_Apron`,
    `Anne_Cape` (each with a `...Trim`), built by the same ring builder (`windows` for panels, `zh` for where the cloth
    leaves her, `extra` for what lies over another).
  - wear.js: about thirty things built from simple shapes in the rest space and hung on the bone under them
    (`rigidAt`) or skinned like the skin nearest to each point (`skinned`): halo, horns, antennae, robotears, catears,
    bunnyears, crown, spikycrown, tiara, headband, sweatband, hairbow, laurel, flower, flowercrown, glasses, cap, tie,
    bowtie, collar, scarf, pearls, highcollar, pauldrons, armbands, obi, sash, leaves, wings_angel / bat / fairy,
    tail_demon / cat / bunny. They are on layers 1 and 2 (the corner picture, her portraits) and never on a twin.
- Lines about her looks (story_common.js `lookSay(who)`, `lookRemarks(who, n)`): Lilith, Amaymon, Alraune, the Ivy
  Maidens and Boudicca have a line each for every outfit theme (22) and every species (9), and one on her feet in her
  shoes by her skin's tone; Aurelia, Scylla, the ghosts, the fairies, Mr. Pumpkin and the Myconids have theirs by
  template. Said where each already spoke of her shoes (captures.js, creatures.js, story_forest / nest / camp / library /
  edge, traps.js, scylla.js); Amaymon also when her look is changed during play.
- Geta ("Wooden geta", the thirteenth shoe): `s2_sandals.py` `geta=True`: a rigid board 11 mm thicker than a sole, two
  teeth under it (no top faces: the game takes the lowest up-facing surface for the footbed), a wide cloth thong. She
  stands 45 mm higher in them (`lift`, now applied to any style that has one); the board is wood-coloured unless a sole
  colour is picked. A line for them from every speaker who has shoe lines.

## Checked (batch 22, VER 277)
- Contact sheets from the game: all 41 new outfits; the nine species; every cut, sleeve, stocking make and pattern; the
  new cloth, the geta, the elf ears; the portal sequence (Fingers and Tongue, standing and tied); the face presets; a
  gown gathered up in the Feet tab and in the foot cam; a portrait with a crown.
- Lines read off the page in seven capture scenes with seven different looks: every speaker's remarks came out in their
  own voice with the right words (the skin tone's word, the shoes, the outfit's kind, the species) and her name.
- `tools/reg.sh`: 26 of 26 scenes to their end with no error (four new ones: the geta, and three with a look of the
  player's own, one of them beside a twin). WebKit: the foot cam with the portal and a heavy look, no exception.
- A three-reader review of the new code (wear.js; the portal in footplay.js; the look's isolation in anne_next.js and
  looks.js): ten findings, all fixed. The worst two: a `//` comment I had put in the middle of a patched line swallowed
  the two statements after it (the portal never faded); and a twin's suit shared ONE compiled shader with hers
  (`depthBias` took its cache key after wrapping `onBeforeCompile`), so a twin would have been drawn with her cut and
  pattern: her suit's program now has a key of its own (`|suitlook`). Also: the portal stayed open after untying, the
  small portal stopped turning, switching Teasing / Tickling summoned Lilith again, twins took her metal finish and her
  shoe and nail colours, the fairy's right wings were upside down, the laurel's leaves stood on end.
- After the review: the gowns' front below the belt was round like a belly (the cloth took the outline of her thighs
  already at her hips): it now lies on her hips and widens below them (`build_skirt`: `o1/r1` blended into `oh/rh`).
- NOT checked: Safari itself (WebKit's test build only); every outfit in every scene (lying and tied poses put capes,
  wings and tails through the ground, which hides them); frame rate on his machine with a heavy look.

# Batch 23 (2026-10-04, queued by him during batch 22). VER 278+
## The request, verbatim
"Once you're done with your current task list you're working on, when Anne is tied up on the ground with her toes and
ankles tied up, dont the have portal be on the ground, rather have the portal open up right above Anne's faced up soles
for the Lilith options for when she comes in. Also have the enemies comment of the type of outfit Anne wears as well
depending on what she's wearing too. Also have an option when building the main character for her body width and length
as well. For every outfit that has her having leg wear, have an option to also remove her legwear as well. Do this only
when you're done with the current task list you're on."

## What was built (batch 23)
- The portal when she is tied (footplay.js): she lies with her soles up, so the portal opens IN THE AIR right above them
  (`PORT.at = AN.mid + AN.Nt * 0.34`, `PORT.n = -AN.Nt`, `PORT.air`) and Lilith's arms (or her mouth) come DOWN through
  it. `PORT.n` is the way through the portal from her side to Anne's (straight up for the one in the ground). Whatever of
  Lilith's is on the far side of the portal is not drawn: one clipping plane (`PORT.plane`, `renderer.
  localClippingEnabled`) on every material of her tools; with no portal its constant is 1e6. The upper arms run from each
  elbow to a point beyond the portal. The tied shots ('both', 'close') and the intro look from one side of the portal, not
  through it (also for the tongue, whose small portal is half clear when she is tied).
- What they say of her outfit (story_common.js): her outfit is always spoken of now, by its own name (`looks.js WEARING`:
  "a maid's uniform", "a kimono", "bikini armour"...; `S.lookWords().wearing`): the five with written lines open the
  outfit line with it ("A kimono, darling?"), the template speakers use it ("Hee hee hee! A kimono, in my patch!").
  `lookRemarks`: her feet, her outfit, then her species if she is not human (or her hair in the long meetings).
- Her body (looks.js Body tab; anne_next.js `setBody(w, h)`): Length 0.92 to 1.08 is a uniform scale of her (`anne.scale`);
  Width 0.90 to 1.12 scales every body bone's inverse bind matrix ACROSS the bone's own line (shoulders to calves; her
  head, hands and feet keep their size, her shoes too; no joint moves, so every clip and scene keeps its places). Twins
  get the built matrices back (`PRISTINE`: SkeletonUtils.clone shares the array by reference). Things that depend on her
  size follow: the leg thickness the vines and coils wind round (captures.js `BK`), the loose shoes' size, the things
  wear.js hangs on her (`wear.refit`).
- Legwear (looks.js Outfit tab, "Her legwear": As the outfit has it / Bare legs; `L.legwear === false`): stockings, tights,
  leggings, painted trousers and greaves can be left off any outfit that has them (the suit's own shorts stay).

## Checked (batch 23, VER 283)
- Contact sheets: tied, Fingers and Tongue: the portal in the air above her soles, the arms down through its ring, the
  side-on camera, the portal shut at once when the feather takes over; the Body tab at both ends of both sliders; an
  outfit with and without its legwear; the log scene (tied in the log, a gown, the widest and tallest body): no clipping.
- Lines read off the page in three scenes: the outfit is named by every speaker ("A maid's uniform, sisters!", "A
  kimono, in my patch!", "Dressed in a cheerleader's uniform, I see.").
- `tools/reg.sh` twice (before and after the review's fixes): 26 of 26 both times (two of the scenes with a body of the
  player's own, one beside a twin). WebKit: tied foot cam with the air portal and a body change, no exception.
- A two-reader review: six findings, all fixed (loose shoes took her length in one path only and rested at the built
  size; the follow camera and her emote bubble did not follow her length; in the air the arms met the portal's plane
  outside its ring; the mouth's small portal showed before the mouth was through; the square-on camera looked through
  the closing air portal).
- Found by the WebKit run: wear.js `ring()` used a field its ray does not return, so the kimono's obi and the dancer's
  sash had never been built (the catch around a builder only logged, in words the test drivers do not print): fixed,
  and a failed builder now logs "WEAR Error", which they print. All 14 outfits with accessories and 7 species: none fails.
- NOT checked: Safari itself; her body's width and length in every scene (a chair, a pit and the log were made for the
  built size: within the sliders' range nothing was seen to clip in the log, the pit and four captures).
- NOTE: iCloud had offloaded `build/*.blend` (flags `dataless`: the disk is nearly full). They come back when read; a
  model rebuild needs the network for that.
- LESSON, again: a `//` comment appended to a patched line swallowed the rest of that line twice in this session (the
  portal's two statements; a closing brace in wear.js). `tools/chk.sh` catches the second kind only. Comments go on
  their own line in a scripted patch.
- An audit of every trailing comment in the code for statements hidden behind it found two more: `S.flag('alLook', ...)`
  in story_forest.js (mine, batch 22: Alraune no longer noted which shoes she had seen) and, from an earlier session,
  `m.renderOrder = 4; obj.add(m);` in actors.js `makeLightShaft` (the shaft of daylight in the caves, the nest and
  Scylla's pool had never been in the scene: only its disc on the ground). Both restored; the shafts checked by eye in
  the nest and the caves. VER 285.

# Batch 24 (2026-10-04). VER 286+
## The request, verbatim
"for the mixed options do all possible combinations when the user selects that role (e.g. half white-half asian, half
black-half white, half hispanic-half arab, etc). Also in the scenes with Lilith tickles Anne's feet the arms are very
awkwardly bent. make it to where the hands are angled so it's not like that."

## How "the scenes with Lilith" was read
Three places: the foot cam standing (her arm out of the portal in the ground), the foot cam with Anne tied (two arms out
of the portal in the air), and the Tower library prologue (she kneels at Anne's feet). All three were measured before
anything was changed (an elbow's bend: 0 = straight; a wrist's bend: the hand to the line of its forearm):

| where | before | after |
|---|---|---|
| foot cam, standing | elbow 107 to 115, wrist 23 to 26: a post straight up out of the ground, folded over | elbow 30 to 64, wrist 43 |
| foot cam, tied | elbows 120 to 129: each arm out to an elbow beside her foot and back in | elbows 42 to 79, wrists 47 to 55 |
| library, both hands on a sole | right wrist folded back 112, left elbow 128, right hand 4 to 8 cm short of the sole | elbows 45 to 95, wrists to 40, fingertips within 2 cm |
| library, her mouth at a sole | the working arm folded double under her chin (elbow 146), the other hand 4 to 6 cm through the floor | elbow 59 to 93; the other hand rests on the floor |

## What was built
### Mixed heritage (looks.js)
With "Mixed" picked the Heritage tab shows two rows, "Half" and "And half", over the seven heritages (White, Black, Asian,
Hispanic, Indian, Native American, Arab): 21 pairings, and the same one twice gives that heritage. `mixLook(a, b)`: every
face slider is the mean of the two; the skin is the tone halfway between the two in the tone list (the mean of the two
colours came out too light: white + black gave Sand, the list gives Honey); the eyes are the darker-leaning step between
them (`EYE_RANK`); the hair is the natural shade nearest the mean; a lid shape of its own from either heritage (any but the plain 'almond') is kept. `L.mix =
['white', 'black']` is saved with her look; `?lk={"heritage":"mixed","mix":["hispanic","arab"]}`; the caption under the
rows reads "Half Hispanic, half Arab." (`mixName`).

### The arm solver all four twins share (thief.js `solve`)
- `wrist` (createThief's option, radians; Lilith 0.7, the others 0 = as it was): where the hand a scene asks for and the
  forearm the elbow allows disagree by more than that, the HAND is turned towards its forearm's line until they agree;
  her fingertips still go to the point named.
- `twist` (Lilith 0.6): what the hand is turned about its forearm's own line is shared with the lower forearm bone.
- A fault that was there for everyone: the easing towards full reach (`soft`) was applied again at each clearance step
  (up to 13 times a frame), so a wrist asked beyond 85% of her reach crept back to 85% and the hand hung 4 to 8 cm off the
  sole it was sent to. It is applied once now (`reach(eased)`); the clearance steps clamp hard.

### The library prologue (story_library.js)
- Where she kneels (`STG`: 0.42 across and 0.44 before the middle of the soles, turned 0.75, leaning 0.4) was chosen by
  trying 126 places with the solver itself and measuring both arms through 'all', 'toes' and 'circle'.
- With her mouth at the nearer sole her LEFT hand works on the other sole (`toes0`, `trail0`: a name ending in 0 is the
  other foot) and her right hand rests on the floor (`FLOOR(sd)`, `hands(L, R, rest)`); for the kiss both rest.
- The shoes: she leans in for each (`STG.off1`, `off2`) and her hand lies along its own arm (`offShoe`): upright, her arm
  stopped 10 to 15 cm short of both heels. The second is seen from the far side (`shots.low()`): from beside her shoulder
  her own head was in the way. The first shoe lands clear of where she kneels now.
- Tests: `&lx= &lz= &lyaw= &llean= &loff1= &loff2=`, `&lwrist= &ltwist=`; marks `shoe1`, `shoe2`; `__lib` (lil, LK, shots,
  tickle, hands, feet, along, FLOOR, STG).

### The foot cam (footplay.js)
- `swingArm(o)`, after `poseHand`: the forearm is turned about its wrist towards the place the arm comes through the
  portal (`passPoint`), by at most `SWING.max`, no further than a wrist gives (`wristGround` 0.75, `wristAir` 0.96) and,
  from the ground, no lower than 5.8 cm (`mostTurn`: found by halving, so it moves smoothly). The hand group is turned and
  its wrist bone turned back by as much: the hand, and every nail on her skin, stays exactly where `poseHand` put it
  (checked: 0.6 mm over her skin, as before).
- The portal in the ground opens `PORT_OUT` (0.36 m) from her wrist along the way her forearm leaves, not under her elbow.
- The portal in the air is straight above the middle of her soles (`PORT_UP` 0.44 m), not off towards her toes, and her
  two arms come through it side by side (`passAir` 0.10 either side of its level line).
- Lilith's entrance (`comeThrough(o, k)`): hand and forearm come out through the portal in the line of the upper arm, hand
  first; then the elbow comes out along that line while the forearm turns to the hand's place. (One stiff piece moved
  from under the portal to its place rose out of the bare ground beside the portal.) The mouth keeps its straight path.
- The upper arm (`armsTick`) is drawn from her elbow to that frame's pass point (`H.pass`) and not at all while her elbow
  is still behind the portal.
- Cameras: the entrance on the ground stands further back the further the portal is; tied, the entrance and the wide shot
  ('both') look from higher and aim between her soles and the portal, so the whole of it is in the picture.
- Tests: `&pout= &pup= &pback= &swm= &swr= &swa= &ppass=`; `__dbg.footPlay._arms()` (each elbow's and wrist's bend, the
  portal), `._intro(seconds)` (her entrance at that moment, after `._freeze(true)`).

### Tools
`tools/tune.mjs` closes its browser on SIGINT, SIGTERM, SIGHUP, SIGPIPE and a closed output pipe: a run piped into `head`
had left two headless browsers running for six hours with 368 MB of profile in the temp folder.

## Checked (batch 24, VER 309)
- Mixed: a printed table of all 21 pairings (white + black: Honey skin, hazel eyes, chestnut hair; black + asian: Golden,
  dark brown, black; hispanic + arab: Golden, brown, dark brown), a 21-tile contact sheet, the Heritage tab itself.
- Arms, by numbers: every figure in the table above is read off the running game (`__dbg.footPlay._arms()`,
  `__lib.lil.dbg()` and the bones' own places), before and after.
- Arms, by eye (contact sheets): the library at the marks feet, shoe1, shoe2, heels, lick, coochie, kiss and in each of its
  shots (two, soles, low, lil, face, wide), and played to its end with no error; the foot cam's entrance frame by frame
  (standing, tied, the tongue tied), each of its shots (side, inner, profile, toes; both, close), Teasing and Tickling.
- The foot cam played live through a change of foot, tying, both finger modes, untying and Stop, sampled every 60 ms: no
  error, no elbow over 80 degrees, wrists to 43 (ground) and 55 (air). Her nails: 0.6 mm over her skin where they touch,
  as before the change.
- The other three who use the solver, after its reach fix: the thief (htease, htickle, hbound) and Boudicca (scene1 to 3):
  least air under a fingertip 2.5 to 3.9 mm, nothing in her skin; by eye their hands are on her soles. In Boudicca's
  third scene and the thief's bound one the points asked for are 3 to 5 cm beyond their arms' length (they were 4 to 8 cm
  further off before): left as they are. Scylla's arms are not aimed in her scene.
- `tools/reg.sh`: 26 of 26, twice (before and after the review's fixes). WebKit: the library at 'coochie' (both hands
  within 7 mm of their points) and the foot cam standing then tied (elbows 40; 63 and 49): no exception.
- A three-reader review (thief.js `solve`; story_library.js; footplay.js): seven findings, all fixed.
  - story_library.js: a cut to Lilith's face fired while her head was still down at Anne's sole: turned to the soles as
    she kneels now, the camera, which stands before her face, was in Anne's lap behind her leg (reproduced by screenshot).
    She straightens first (a second of the two-shot). A lick framed from beside her shoulder showed the back of her head:
    from the far side now, as the other two. She kept her 0.12 rad kneeling lean while hovering afterwards (older than
    this batch): reset when she leaves her knees.
  - thief.js: a hand sent from a sole straight on to the floor ('reach') lost its clearance while it was still at the
    sole: it keeps its air and its pull until it is away (`fromClaw`; traced frame by frame: 5.7 mm of air at the least).
    The forearm's share of the hand's twist would flip at half a turn: it fades out towards it. The wrist rule could turn a
    hand past a quarter turn and put its palm on the other side: capped at 80 degrees. (The last two are not reached by
    any pose in the game today.)
  - footplay.js: tied, the mouth's straight path crossed the portal's plane outside its ring now that the portal is not
    over the place the mouth goes to: down the portal's middle line first, then across.
- Found on the way, older than this batch: Lilith's free hand went 4 to 6 cm through the library's floor whenever she bent
  to a sole; her arm stopped 10 to 15 cm short of both shoes when she took them off; the solver's reach fault (all four
  twins). All fixed.
- A body of the player's own length (Body tab) in the library: Anne's soles are 3.4 cm higher or lower in the chair, and
  at the shortest body Lilith's right hand hung 3.9 cm off the sole. `kneelFor(soleY, at)`: her lean takes up the
  difference and she kneels that much nearer or further, so her shoulders stay the same way off the soles (`STG.dl` is
  added to every lean of hers there). Measured at both ends of the slider: fingertips within 2.1 cm through 'all', 'toes'
  and 'circle', her hand at both shoes within 1.3 cm; the built body's figures are unchanged. The prologue played to its
  end with the built body and with a short cat girl in a maid's uniform: no error.
- NOT checked: Safari itself (WebKit's test build only); the foot cam on sloping ground (the portal in the ground and the
  elbow's floor are taken at Anne's own height, as before).

# Batch 25 (2026-10-05). VER 310+
## The requests, verbatim, in the order they came (all in one sitting)
1. "in the scene when Bouducaa talkes Anne, there's a flow and bush blocking the view. Also no need to have foot shots on
   Anne during cutscenes unless a charscter is talking about Anne's feet specicfally."
2. "also in the same cutscnene when Bouducaa is tickling Anne's feet, both sake way too voilenetly"
3. "Once you're done with all of those tasts, when boducaa licks Anne's feet in that cuscne it looks very figity and way
   too rushed when she licks Anne's sole."
4. "once you're done, Boducaa doesn't stop walking when Anne and Bouducaa are talking about the lose book. Bouducaa walks
   in place a lot."
5. "once you're done, create a foot cam option for bouducaa as well with all of the same mechanics that work for Anne,
   then make the next chapter from the 2D game tough the forest of LYS, the campsite, and then the captial city where the
   thief is interegated."

## State (kept up to date while working: read this first after a break)
ALL FIVE requests are DONE (VER 330). Items 1 to 4 at VER 324; 5a (Boudicca's foot cam) at VER 326, reviewed and fixed at
329; 5b (Chapter 2) built at 327, reviewed and fixed at 328/329: see "5b, what was built", "Reviews" and "Checked
(batch 25)" at the end of this batch. If a break comes before the final report: run `tools/reg.sh` and `tools/reg2.sh`
once more if any shared file was touched since, then report (what is and is not built; the 2D's order of the campsite).

## What was built (items 1 to 4)
- 1a The view at the tackle. The low shot before the pounce (story_edge.js) sat inside a blooming bush. world/foliage.js
  now records every bush (`c.bushes`: the dome's middle and radii); story.js: no shot is CUT to from inside one (0.28 m
  round its dome) nor with one on the first 2.5 m of its line of sight: `shotGoal` passes over such a bearing, a shot
  given by hand (`cam.set` with `cut`) is moved the least way that clears it and still sees its subject (`clearOfBush`;
  that shot moved 0.7 m sideways). `o.bush: true` leaves a shot alone; `&bushfix=0` switches it off; every moved shot is
  in `window.__camFix` and logs "CAMFIX from > to" (tools/reg.sh prints it: in the 26 scenes only the cave pit's
  `shot.top()` moves, 0.35 m).
- 1b Foot shots. story.js `say`: a line is shown over her feet only when the scene says so (`o.feet`: her shoes, her
  toenails) or the line names feet, toes or soles and is not another speaker's own (`herFeet`). Her shoes alone no longer
  count, and the random cut on one of her own lines in four is gone. story_camp.js / creatures.js: no foot shot for a
  remark on her outfit. `&saylog` fills `window.__sayLog` (sheet, 'flag' | 'word' | '', text).
- 2 The shaking. The clip `HogtieTickled` was four jerks in half a second: her feet went 12 cm to and fro at 0.88 m/s
  (peak 2.8), and Boudicca's hands with them at 1 m/s. Rebuilt (tools/anne2/poses.py, a headless Blender run: only that
  clip changed): six moves in 1.5 s. Measured in the scene: her feet 0.25 m/s (peak 0.6 to 1.0), Boudicca's wrists 0.3.
  `A.clipSpeed(name, k)`; story_edge.js `stage`: 1.25 for the hardest stage, 0.5 while her sole is licked.
  Also: Boudicca's idle hands are held up over Anne's toes (`READY`), not let down into her lap: her lap is under soles
  that face the sky, and a hand that came up from there to a sole went through the foot, where the clearance threw it
  20 cm in one frame (traced; now the largest step of a wrist is 1.5 cm a frame).
- 3 The lick. `updMouth`: her body goes to the sole eased, at most 0.28 m/s, and follows the foot slowly (her head moved at
  0.47 m/s with every twitch; now under 1 cm a frame); her tongue comes out once her mouth is there (`LK.close`,
  `atSole`); a lick takes 2.2 s (1.1), two whole ones; the kisses are a second apart. One slow hand on the other sole.
- 4 Walking on the spot. thief.js `follow`: she stopped only when NOT further than her gap, and her last step put her
  exactly on it, so rounding decided whether she stood or walked in place. Now: within 3 cm once whoever she follows
  stands still. On the road she walks at Anne's pace (1.52). Checked: idle 12 samples out of 12 after Anne stops.
- Reviewed by two readers: six findings, all fixed (a close-up found in a bush could only be pulled straight back; the
  feet picture after a feet line was put back through the bush test; a moved shot was not tested for seeing its subject;
  Amaymon's remark on her feet got no picture in closed shoes; a follower behind a slower leader stopped and started;
  the kiss sounds and the end of the lick did not wait for her mouth).
- `tools/reg.sh`: 26 of 26 with the rebuilt model (before the review's fixes: run again at the end of the batch).

## 5a, what was built (a foot cam for Boudicca, VER 326)
- Her body for it: boudicca.js `loadBoudiccaBody` = a second WHOLE figure from Anne's file (`loadAnne` called again: 230 ms,
  about 120 MB of heap; nothing in anne_next.js is shared between two calls), dressed by Anne's own look setters (skin
  '#d7a882' and hair '#dcdaea' set by eye beside the twin), with the twin's ponytail and bow (`dress`). Her boots are leg
  guards from the ankle up and closed brown flats: her feet are bare inside them. The twin of the scenes now wears the
  same (`look.shoe`, `look.sockLow` in anne_next.js `makeTwin`), so nothing changes when one takes the other's place.
- footplay.js: `env.name` (whose foot cam: Lilith says "my dearest Boudicca"), `env.lines` (her own words for every pool:
  boudicca.js `BOU_FOOT_LINES`), `env.who` (a row of names at the top of the panel). A second `createFootPlay` runs for
  her body: her own panel, tools, ropes (ties.js), Lilith's portal, face in the corner.
- index.html: `setFootWho('bou' | 'anne')`: the twin is hidden and her body stands in its place while the foot cam is on
  her; `footCamera` follows whoever it is on; back to the twin when the foot cam goes off, she takes a step, a scene
  starts or the look panel opens. The row shows only where she walks with Anne: `S.party = { boudicca: bou }` (story_edge.js
  after the epilogue, story_road.js). Tests: `__footWho('bou')` (a promise), `__bouFoot()` -> { body, fp }.
- Checked: every tool on her standing (feather, fingers with Lilith's arm at 51 degrees, tongue, brush), tied with both of
  Lilith's arms, her lines, her face in the corner, back to Anne; the row hidden in the camp; WebKit: no exception.
- NOT built: her changing shoes mid-play (Anne's `newShoes`), Lilith's remarks on her looks, bored idles for her.

## Chapter 2 in the 2D game (read 10-05 by three readers; their digests and dialogue dumps are in `refs/ch2/`)
Order in the 2D (GAME_PROGRESS = variable 3): world map (100) -> Trader Post, Map053, the CAMPSITE (optional there, and
BEFORE the forest) -> Forest of Lys, Map036 (105; the Dryad on the second bridge; south exit 110) -> Valyndra City gate,
Map001 (115; the gate guard sends them to Vice-Captain Elora, 120) -> the barracks, Map048 "Capital City Dungeons": the
thief AURELIA BLUE is already in foot stocks (arrested that morning); Boudicca and Elora tickle a foot each (fingers, a
brush, toe ties) until she gives in; Anne gets the Grimoire and the gold back (130) -> closing talk at the gate (140: the
chapter's end; the Velvet Rug pub and Dawn Harbor are the next part).
- He listed "the forest of LYS, the campsite, and then the capital": in the 2D the campsite comes first. Build it in the
  2D's order (road -> Trader Post -> forest -> city) and tell him.
- Campsite: Camellia Flaire the apothecary (first meeting; a fortune read from Anne's soles: TICKLE), the fire (sleep ->
  the first night is a Lilith nightmare: the tickling variants only, Anne dressed), by night Anne may tickle sleeping
  Camellia's feet and sleeping Boudicca (three stages). Morning. South exit into the forest.
- Forest: intro talk; enemies seen on the map (slimes, hornets, myconids, wild vines, trap holes, a hollow log); the Dryad
  (capture: branches tickle her feet, the gauge; then the fight; won: the party tickles the dryad, three stages).
- City: every scene on the main path is STORY or TICKLE. Left out as before: every ADULT stage (the digests name them).

## 5b, what was built (Chapter 2, "Dawn comes Slowly", VER 327+)
Four areas (index.html `AREAS`; maps: `tools/make_level_ch2.py`), entered from the road's east end (it was a card saying
"not built yet"): road -> `post` -> `lys` -> `valyndra` -> `barracks` -> `valyndra`. The 2D's order: the campsite comes
BEFORE the forest (he listed the forest first: tell him).
- **The cast** (cast2.js): Camellia, the Dryad, Elora, the gate guard, Mia, and the thief barefoot. Second figures of
  Anne's model like the others (thief.js), now with one of the model's own hairstyles, skirts, cape and belt, bare feet
  and sleeves: anne_next.js `makeTwin` `look.hairStyle / parts / bare / sleeve`; thief.js `o.bare` (the Bare gaits),
  `o.patch` (her own look with a few things changed), `target(feet)` (whose soles her hands keep their air over).
  Portraits: the 2D's own sheets, decoded into `faces/` (camellia, dryad, elora, mia, valyndra-guards); story.js `SHEETS`
  ca, dr, el, mi, gu. Music town2.mp3 / town3.mp3 and five sound effects, converted from the 2D's files.
- **footwork.js**: one figure kneeling at the bare soles of another who sits with her legs out (the library's staging,
  made general): `solesOf(root)` (the soles of a second figure), `footWork(S, C, fig, feet, { side, kit, floor })`:
  where she kneels on either side, her hands' paths ('circle', 'trail', 'all', 'toes', 'read'; a name ending in 0 = the
  other sole), a scrub brush held in a hand, her lips and tongue at a sole. Used four times: Camellia at Anne's soles,
  Lilith in the nightmare, Boudicca at the dryad's, Elora and Boudicca at a foot each of the thief.
- **post** (story_post.js; Map 53): Camellia at her stall (first meeting, her questions, herbs for 30 gold); the fortune
  read from Anne's soles for 100 gold (fingers along the lines, a kiss, her tongue; "hold still" gauge, three tries: a
  miss and she tickles); the purse of 1000 gold behind the tent (the thief took all of theirs); the fire: sleep until
  morning; the first night is Lilith's nightmare (the 2D's variant 2, feet: in the library's chair under a dome of
  dark, three rounds, a "wake up" gauge after each); signpost, cabin, pool, dead tree.
- **lys** (story_lys.js; Map 36, one of its two halves, compact): coming in; the dryad on the second bridge: her
  branches (captures.js `bound`, her vines from where she stands), "the hard way" (three gauges), and won: the 2D's
  DOMINATION, three stages, her own roots seat her on a stump, Boudicca at one sole, Anne's conjured feather at the
  other; two wild Ivy Maidens off the road; the south gate ("That's the main road!", the teleport talk, the bonk).
- **valyndra** (story_valyndra.js; Map 1, only the square inside the south gate; a set): the walls, the gate guard,
  the guard house door in the wall; after the dungeon the closing talk (the Velvet Rug) and the chapter's end card.
- **barracks** (story_barracks.js; Map 48; a set): the thief in the stocks (built round her ankles as she sits; her
  wrists cuffed to the chair's arms), the argument, the contest: fingers, the brush, the toe ties, the confession;
  the bag on the table: the Grimmoire and the stolen gold (story_edge.js now keeps how much she took). Afterwards the
  room stays as it was left (Elora, Mia, the prisoner: the 2D's three short lines).
- Progress: 100 (Chapter 1 done) -> 105 forest intro -> 110 the south gate -> 115 the walls -> 120 the guard -> 130
  the Grimmoire -> 140 the chapter's end. Flags: camellia, fortune, postPurse, postNightmare, dryadMet, dryadDone,
  dryadUnlocked, grimmoire.
- Tests: `tools/reg2.sh [dir]` (14 scenes; each prints "CH2 <name> done"); `&coins=N`; `?level=post&cast` (the cast in
  a row); `window.__post / __lys / __val / __bar`.
- NOT built (the 2D has them; say so): the camp's two optional night scenes (Anne tickling the sleeping Camellia, and
  the sleeping Boudicca), Camellia's shop as a shop, the forest's slimes, hornets, myconids, trap holes and hollow
  log, its second half and side maps, the rest of the city. Left out as everywhere: every ADULT stage (the dryad's
  later capture stages, nightmare variants 1 and 3, the game-over scenes); the nightmare's other tickling variants
  (4, 5, 6: not feet).

## Reviews (batch 25: readers only, no browsers; I checked each finding in the source or the browser before fixing)
- Items 1 to 4: two readers, six findings, all fixed (listed above).
- Chapter 2: three readers (the rig and the figures; the two sets; the two outdoor areas) and one refuter per finding:
  16 findings, 14 confirmed and FIXED, 2 refuted (one I had fixed meanwhile, one latent and fixed anyway).
  1. story.js `finish`: a scene that ends with `S.go(...)` saved THIS area over the one `leaveFor` had just written
     (Continue then went back to the dungeon). Now no place-save once she has left. The forest's edge had it too.
  2. The picture cut to Boudicca while she was still walking to the stocks: her walk is awaited.
  3. The chapter's end: the next aim is set before the card (a game closed on the card kept the old aim for good).
  4. The gold given back twice if the game was closed in the 0.8 s after it: the book, the progress and the gold are
     saved in one go, and the amount kept from the theft is cleared.
  5. Nothing solid: the gate's two towers, the crates, Elora and Mia in the room afterwards.
  6. Two door leaves hung beside their frames (a box's own X runs along (cos ry, -sin ry): the sign was wrong).
  7. Boudicca's eyes stayed shut after the night. 8. She was missing from the morning's picture after the nightmare.
  9. The main-road talk could be walked round (its circle was 3.2 m across in a glade 8 m wide): 8.4 m now.
  10. creatures.js `roam`: a wandering Ivy Maiden's record kept her home tile: Anne turned to the empty tile to fight.
  11. `bou.follow(null)` outside the party's flag made a Boudicca who is not in the party (tests only).
  12. footwork.js: two hands on ONE sole could be sent to the same patch (a mixed pair such as 'all' + 'toes'): each
      hand keeps to its half (`ROLE`), and sent to the toes alone the nearer-heel hand changes jobs with the other.
      Measured: fingertip pads never nearer than 3.9 cm (it was 0 for Elora).
  13. The brush scrubbed up into the other hand: it keeps to heel-to-ball, the other hand to the toes (3 cm apart).
  14. A stage set before she knelt tipped a STANDING figure forward (Lilith hovered leaning 7 degrees): the rig touches
      her lean and place only while she is on her knees there.
- Boudicca's foot cam: two readers, six findings, all FIXED. Leaving her foot cam hid her figure before it was settled:
  a shoe she had stepped out of stayed lying in the grass (the copy belongs to the scene) and she was found again in the
  pose she left in (now: `releaseClips(); updateClips(2, 0)` first; checked: the scene's children go 248 -> 249 with
  the loose shoe and back to 248); her hidden twin had walked on, so she jumped up to 2.6 m on the way back (the twin
  takes her figure's place: 0.00 m); the other's speech bubbles stayed up; Lilith's first-time speech played once per
  figure; her nail colour and mode were kept per figure; Anne stayed on the face inset's layer (post.js `setInset`).

## Checked (batch 25, VER 330)
- `tools/reg2.sh` (Chapter 2, each scene to its end; no error text): 14 of 14 before the review, 14 of 14 after its
  fixes, 15 of 15 after the foot cam fixes (a late reading added). It has 17 lines now: the two added last (Camellia's
  shop and questions; a wild Ivy Maiden in the Forest of Lys) passed run on their own, not yet in a full pass.
- `tools/reg.sh` once more after the foot cam fixes (footplay.js, post.js): 26 of 26.
- The foot cam switch (to Boudicca, a tool, back to Anne), Chrome and WebKit: the scene's children 248 -> 249 -> 248,
  her twin at her figure's place (0.00 m), no error. The three optional lines in the dungeon afterwards: no error.
- `tools/reg.sh` (the 26 scenes of the earlier chapters): 26 of 26 after the Chapter 2 fixes. On the run before, one
  scene's headless browser hung for 18 minutes (the page never answered; the runner had no hard limit: it has one
  now, `timeout + 90 s`); that scene passed alone, and the whole list passed on the next run.
- Walked through every exit with real key presses: road -> post, post -> lys, post -> road, lys -> post, lys ->
  valyndra, valyndra -> barracks, valyndra -> lys, barracks -> valyndra; the bridge is free once the dryad is done.
- WebKit (the engine Safari uses), seven Chapter 2 scenes to their end: no error. Safari itself: NOT run.
- 60 frames a second in all four areas in headless Chrome with the real GPU (draw calls: 94 to 297).
- Measured: the thief's ankles in the stocks move 1.3 cm sideways, 2 cm down, 3.1 cm up while she is tickled: the
  holes are ovals that clear that. The least air under any fingertip on a sole, all scenes: 2.1 mm (never in the skin).
- Looked at, picture by picture: the cast in a row, each area from above, every stage of the reading, the nightmare,
  the dryad's two scenes, the gate, the guard, the closing talk, every stage of the interrogation, the room afterwards.
- NOT checked: Safari itself; a game played from Chapter 1's end to Chapter 2's end in ONE sitting by hand (each scene
  and each exit was run on its own); sound (the tests run muted: the new music and effects are files that load).



# Batch 26 (2026-10-07). VER 331+
## The request, verbatim
"add in a title screen just like in the 2D game, have the tital screen radomly rotate between Anne and the other characters
featured, have anne doing a little foot pose like she does in the 2d version but randomly assing her her outfit, shoes,
design, race, and skin color."

## What the 2D's title is (read from the game: System.json, KunMainThemes, img/titles1 + img/titles2)
- A backdrop picked at random from seven sea-and-dark-tower paintings (five winter ones from 1 to 28 December), and a
  foreground picked at random from eight: the logo "AMIRIAN Curse" on a dark band down the middle, Anne to its left and one
  other to its right (Lilith in four of them, with Anne flying past, one shoe off and a bare foot out; four others
  standing). The menu at the foot of the band. Music Theme4.

## What was built (`title.js`, `title/`, `theme4.mp3`)
- When: a plain visit (the address has none of the test or arrival flags; the rule is an inline script in index.html's head,
  `window.__TITLE`). Not when walking in from another area, not in any test with `auto`, not straight after "New game"
  (that page opens on her look, `sessionStorage amirian3d.newgame`). `?notitle`: the old card.
- Where: a group at (-400, 0, -400), far outside every map, turned so that the area's own sun is to the upper left. A
  sandstone ledge (flat where they stand), boulders and tufts along its far edge, the 2D's backdrop on a plane 40 m behind
  (unlit, not fogged; sized to cover the picture for any window shape). The camera: 30 degrees, level, swaying a little.
- The area's night and colour grade are set aside while it shows (the dungeon, the library) and put back when it ends; the
  story's own overlays and the HUD are hidden by `html.title-on`.
- Anne: `looks.random()` (new: a heritage or a half-and-half mix with its face, a skin tone near it or now and then any,
  half the time a species, eyes, hair, hairstyle, a ready-made face with a little of every slider, her build, one of the 50
  outfits), `looks.apply(look)` (nothing saved), and from index.html's lists a pair of shoes, their colour, a sole, her
  toenails. Her poses: IdleTiptoe, IdleCrossR, IdleTiptoeR, IdleCross in turn (the heel up out of her shoe, the shoe left
  hanging from her toes, her toes wiggling), turned SIDE-ON for each with the foot that comes up nearest the picture
  (studied from four angles: from the front the heel is hidden behind her other leg), facing the picture between two. A
  gown is gathered to her knees while a foot shows.
- Beside her: Lilith (hovering), Boudicca, Aurelia, Camellia, the Dryad, Elora, Mia: thief.js / cast2.js twins, made when
  first shown. After two of her poses (26 s at the latest) the picture fades and all three change (never the same partner
  or backdrop twice running).
- The page: the logo in Amarante (title/Amarante.woff2, OFL), the band, the menu (Continue / New game / Customize / Shoes
  and toenails; up, down, Enter), a caption under each figure. A tall window: no band, the logo over the top, the menu over
  the foot.
- Ending it (`title.go(fn)`, in the click itself so that sound may start): the picture goes dark at once, her own look,
  shoes, place and the area's light come back, `fn` runs (start, or the look panel), the game fades in.
- Music: the 2D's Theme4 (theme4.mp3) while the title shows, if the player has the music on (M).
- December: the winter backdrops, snow on the ledge, dusk light (`?twinter` to see it).
- Engine: `story_common.js common(S)` is kept on S (the title shares the area's); `post.grade()`; `looks.random()`,
  `looks.describe()`.

## Left out
- The 2D's flying pose (Anne on her staff, a shoe falling): the model has no such clip; her standing foot poses are used.
- Alraune, Scylla and the creatures as partners (their own models need their scenes' props).
