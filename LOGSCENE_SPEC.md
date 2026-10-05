# Log Scene module (`logscene.js`): how it is wired

> Written as the build spec, then corrected to match what shipped. Where the two differed, this file now describes the shipped behaviour.

A self-contained ES module for the Three.js level in this folder (`index.html`, three@0.170.0 via import map).
It recreates the "hollow log" event from the 2D game: Anne reaches into a hollow log for herbs, gets stuck
lengthwise (head poking out one end, legs/feet out the other), little forest goblins pull her heels off and
tickle her soles with pink feathers, a timing minigame decides whether she breaks free, then control returns.

Content boundary: comedic tickle-trap only. No clothing removal other than her two shoes. No nudity, nothing sexual.

## Export

```js
export function createLogScene(ctx) { ... return api; }
```

### `ctx` (provided by index.html)

| field | type | notes |
|---|---|---|
| `THREE` | module namespace | use this, do not import three yourself |
| `scene`, `camera`, `renderer` | three objects | |
| `anne` | `THREE.Object3D` | glTF root of the character; the main loop moves/rotates it when the scene is NOT active |
| `mixer` | `THREE.AnimationMixer` | main loop calls `mixer.update(dt)` every frame (see frame order) |
| `playClip(name, fade = 0.3)` | fn | exclusive cross-fade to one clip. Names: `Idle`, `Walk`, `StuckIdle`, `StuckStruggle`, `StuckTickled`, `Stomp` |
| `setExpression(name, blush = 0)` | fn | smooth facial morph blend. Names: `neutral`, `smile`, `smug`, `happy`, `surprised`, `shocked`, `angry`, `embarrassed`, `worried`, `strain`, `laugh`, `laughHard`, `pout` |
| `setHeelsWorn(bool)` | fn | shows/hides the purple heels on Anne's feet |
| `tc(x, y)` | fn → `Vector3` | world centre (y = 0) of map tile (x, y). 1 tile = `S` metres |
| `S` | number | 1.6 |
| `onEnd()` | fn | call once when the scene finishes and control returns to the player (main re-snaps its follow camera) |
| `heelProp` | `Object3D` or null | the real pump mesh (`anne_heel_prop.glb`, a right shoe standing on y = 0, toe along +Z). Cloned and mirrored for the two loose shoes; a simple stand-in is built if it is null |
| `walkAt(x, y)` | fn → bool | the level's walkable-tile test; keeps the scene cameras out of the trees |

Markers inside `anne` (find with `anne.getObjectByName(name)`, read with `getWorldPosition`). All are
children of skeleton bones so they follow every animation:

- `Marker_Sole_L_Heel`, `Marker_Sole_L_Arch`, `Marker_Sole_L_Ball`, `Marker_Sole_L_Out` (and the same for `_R_`).
  Heel/Arch/Ball lie on the skin of the sole. `Out` sits 6 cm off the sole along its outward normal
  (normal = normalize(Out - Arch)). L = the character's left foot.
- `Marker_Chest` is, despite the name, her **hip centre** (parented to the root bone, so it stays put while the chest arches
  and the legs kick). `Marker_Head` is the centre of the head.

### Returned `api`

```js
{
  update(dt, t),       // called BEFORE mixer.update(dt) every frame (state machine, clip choice, UI)
  lateUpdate(dt, t),   // called AFTER mixer.update(dt), before render (marker-driven placement, goblins, feathers, camera)
  isActive(),          // true while the scene owns Anne and the camera (main then skips movement + follow camera)
  promptText(),        // string like "E — Inspect the log" when Anne stands within 1.7 m of the log and the scene is idle, else null
  interact(),          // main calls this when the player presses E / Space / Enter while promptText() !== null
  obstacles(),         // [{x, z, r}] circles approximating the log, main blocks Anne's movement with them
}
```

Frame order in main: `logScene.update(dt,t)` → (movement only if !isActive()) → `mixer.update(dt)` →
`logScene.lateUpdate(dt,t)` → (follow camera only if !isActive()) → render.

## The log

- Build it yourself: a hollow fallen log at `ctx.tc(14, 7)`, axis running north–south (world ±Z).
  Outer radius ~0.5 m, wall ~0.08 m, length 0.8 m, open at both ends, dark inner surface, bark outside
  (procedural canvas texture is fine), a few knots/moss patches. Sits on the ground (y = outer radius).
- A small glowing green herb sprig (aloe-like fan of leaves) is visible just inside the north opening
  until she takes it.
- Head end = NORTH opening (world -Z side), feet end = SOUTH opening (+Z side).
- `obstacles()` returns 3 circles along the axis covering the log (r ≈ 0.55).

## Placing Anne in the log

Stuck clips (`StuckIdle`, `StuckStruggle`, `StuckTickled`) have her lying face down along her own local +Z axis, propped up on
her hands with her chest arched and her head upright (hat on), shins bent up behind her. Root at the local origin.

1. On entering the stuck state set `anne.rotation.set(0, Math.PI, 0)` (local +Z → world −Z = north = head end).
2. Every `lateUpdate` while stuck: read `Marker_Chest` (the hip centre) and move `anne.position` so it sits at
   `(log.x, 0.201, log.z − 0.05)`: 0.08 log wall + 0.012 cloth + 0.109 hip-centre height above the belly skin. That puts her
   hips on the log floor, her shoulders just clear of the north rim and her knees at the south rim. Snap while the screen is
   black, smooth afterwards.

Numbers come from the model: re-measure them (see `anne_source.blend`, text block `anim_src`) if the stuck pose changes.

## Flow (state machine)

Use a small data-driven script runner: a list of steps, each either a dialogue line, a choice, an action
(fade, clip change, goblin cue, wait), or a branch label. Keep it readable.

First interaction:

1. Anne turns to face the log (walk-in-place for 0.4 s is fine), wide shot. Lines 1–4, then the choice.
2. Choice **Leave** → close dialogue, end (`onEnd`), log stays interactive.
3. Choice **Get the herbs** → line 5, fade to black 0.35 s, switch to stuck (herb sprig disappears, Herbs +1), fade in.
4. Lines 6–10 (face shot), goblins sneak in from the southeast bushes during line 10.
5. Lines 11–15 (alternating feet / face shots). During line 12 goblin A grabs the RIGHT heel:
   `setHeelsWorn(false)` exactly when the pull happens and spawn two loose heel props at the sole markers;
   they arc away 1–2 m and land on the ground with a bounce. `StuckStruggle` while they tug.
6. From line 16 on, both goblins tickle: each holds a pink feather; the feather tip strokes the sole from
   Heel → Arch → Ball and back (about 1.5 strokes/s) with a little lateral wiggle, tip held ~1 cm outside the
   sole (use the Out marker for the normal). Clip `StuckTickled`. Expression follows the lines.
7. After line 24: the **struggle minigame**, up to 3 rounds.
   - UI: centred horizontal gauge (≈ 60% width, max 520 px), a marker that ping-pongs, a green target zone.
     Zone width 22% → 17% → 12% by round; marker speed increases each round. Label: "Press SPACE when the marker is in the green!"
   - One press per round (Space / Enter / E / click). Hit → ESCAPE. Miss → a quick red flash, then the two
     between-round lines, then the next round. After 3 misses → FAIL.
   - During the minigame play `StuckStruggle`, goblins keep tickling.
8. **ESCAPE**: fade, Anne stands beside the south opening facing the goblins, clip `Stomp`, both goblins
   panic and flee toward the bushes, each vanishing in a small puff of leaves/dust. Lines E1–E2 (wide shot).
9. **FAIL**: goblins scamper off carrying a sparkling coin pouch; Coins −(random 10..30, not below 0);
   fade, Anne stands beside the log; lines F1–F2 (wide).
10. **COMPLETE** (both branches): Anne walks to the nearer fallen heel, `setHeelsWorn(true)`, remove the props,
    lines C1–C2, then `onEnd()`.

Any later interaction: lines R1–R2 only (no trap), then `onEnd()`.

## Dialogue script

Portrait sheets live in `faces/`: `anne-faceset-01.png`, `anne-faceset-02.png` (576×1728, 4 cols × 12 rows)
and `amaymon-faceset.png` (576×1296, 4 cols × 9 rows). Every face is 144×144; face index `i` is at
`x = (i % 4) * 144, y = floor(i / 4) * 144`. Amaymon is Anne's companion (a small floating eye-orb demon who
calls her "kitty"); Amaymon is a voice + portrait only, never a 3D model.

`shot`: `wide` = 3/4 view of Anne and the log; `face` = a fixed 3/4 view from 1.5 m north of her head at brim height
(0.56 m), so the camera sees under the hat brim and her head bobs inside the frame; `feet` = camera ~1.5 m south of the feet end, low (0.5 m), looking at the midpoint of
the two `Arch` markers. Ease camera moves over ~0.5 s.

| id | speaker | sheet | face | expr (blush) | shot | text |
|---|---|---|---|---|---|---|
| 1 | Anne | 01 | 7 | smug | wide | Mmmmh... what's this? |
| 2 | Amaymon | am | 0 | – | wide | What's so interesting about that old log? |
| 3 | Anne | 01 | 0 | happy | wide | Lucky day! There are medicinal herbs in there! |
| 4 | Anne | 01 | 0 | smile | wide | I could make good use of them... |
| choice | | | | | | **Get the herbs** / **Leave** |
| 5 | Anne | 01 | 0 | happy | wide | Yeah! With these I can brew a Healing Potion at the fire! |
| 6 | Anne | 01 | 10 | strain | face | Almost got them...! |
| 7 | Anne | 01 | 1 | embarrassed (0.6) | face | Eeehm... now this is embarrassing. |
| 8 | Anne | 01 | 4 | worried (0.4) | face | ...I'm stuck. |
| 9 | Anne | 01 | 7 | worried | face | Amaymon? |
| 10 | Amaymon | am | 0 | – | face | Right in front of you! |
| 11 | Anne | 02 | 6 | worried | feet | ... |
| 12 | Anne | 02 | 12 | shocked | feet | Wait wait wait!!! |
| 13 | Anne | 02 | 42 | shocked | face | WHO'S THERE?! |
| 14 | Anne | 02 | 42 | shocked (0.3) | feet | Oh no no no, NOT MY FEET! |
| 15 | Anne | 02 | 42 | shocked (0.3) | feet | Leave my shoes alone!! |
| 16 | Anne | 02 | 42 | laugh (0.5) | face | HELLO?!?! |
| 17 | Anne | 02 | 40 | laugh (0.6) | face | ... |
| 18 | Anne | 02 | 14 | laughHard (0.8) | feet | NO NO NO NO NO NO NO... STOP IT ALREADY!!! |
| 19 | Amaymon | am | 0 | – | face | What's so funny? |
| 20 | Amaymon | am | 2 | – | face | Hehehe, you look in distress! That's great! Can I watch? |
| 21 | Anne | 02 | 16 | angry (0.6) | face | Shut up and help me get out of here!! |
| 22 | Amaymon | am | 4 | – | face | Can't move on my own, sorry... Shall I cheer you on? |
| 23 | Anne | 02 | 18 | laughHard (0.9) | feet | SHAHAHAHA— HELP MEEEE!!! |
| 24 | Amaymon | am | 4 | – | feet | COME ON, KITTY! YOU CAN DO IT! KICK THOSE LITTLE PESTS OUT! |
| between rounds a | Amaymon | am | 4 | – | feet | Come on!!! You've almost got it!!! |
| between rounds b | Anne | 02 | 18 | laughHard (0.9) | face | Y-YOU USELESS SACK OF LIMBS!! HAHAHAHA STOP IT!! |
| E1 | Anne | 02 | 4 | angry (0.4) | wide | Damn little pests!!! |
| E2 | Anne | 02 | 4 | angry (0.4) | wide | GET OUT OF HERE!! |
| F1 | Amaymon | am | 2 | – | wide | Now THAT was funny! You got your herbs... but those little muggers ran off with your coins! |
| F2 | Anne | 01 | 22 | shocked | wide | OH, NO!!! |
| C1 | Anne | 02 | 34 | pout (0.3) | wide | ...At least they left my shoes. |
| C2 | Amaymon | am | 4 | – | wide | Careful out there, kitty! |
| R1 | Amaymon | am | 4 | – | wide | You really enjoy gathering ingredients, don't you? |
| R2 | Anne | 02 | 34 | pout | wide | Ha ha... very funny. |

Amaymon lines: call `setExpression` for Anne anyway to keep her face reacting (e.g. keep the previous Anne
expression, or `worried` while stuck).

## UI (all DOM, created by the module; inject one `<style>` block, prefix classes with `ls-`)

- Dialogue window: bottom-centred, width min(900px, 94vw), RPG-style: dark indigo translucent gradient,
  1–2 px gold border (#c9a24a), rounded 6 px, 144×144 portrait on the left (CSS `background` crop of the sheet,
  `image-rendering: auto`), speaker name tag above the text in gold, typewriter text ~45 chars/s, a blinking ▼
  when complete. Space / Enter / E / click: first press finishes the line, second advances.
- Choice window: small box above the dialogue's right side, arrow keys or W/S to move, Space/Enter/E/click to pick.
- HUD (top-right): `Herbs: n` and `Coins: n` (start 60). Always visible.
- Interaction prompt is rendered by main from `promptText()`; don't draw your own.
- Fade overlay: full-screen black div with opacity transitions.
- Minigame gauge as described.
- Must work at phone width without horizontal scroll; font: Georgia, serif; text colour #f4ecd8.

## Goblins (procedural, two of them)

Small (0.55–0.65 m tall) cartoon forest goblins: green skin, oversized head with long pointed ears, big yellow
eyes with dark pupils, wide grin, pointy nose, brown leaf-cloth loincloth / tunic, skinny limbs. Low-poly flat
shading is fine. Idle bob, hop when moving, arms animated procedurally (holding a feather: pink, curved, with
barb edges). Goblin A works the RIGHT sole, goblin B the LEFT sole; they stand on the ground beside the feet
end, facing the soles. They enter from the southeast, exit the same way.

## Quality bar

- No errors in the console; no per-frame allocations in hot paths beyond a few temp vectors (reuse them).
- All timings in seconds via `dt`; nothing depends on frame rate.
- Keyboard handlers must ignore input when the scene is inactive, and must not break main's WASD handling.
- Cleanly restorable: after `onEnd()` Anne is standing (`playClip('Idle')` is fine, main resumes Idle/Walk
  blending), upright (`rotation.x/z = 0`), heels worn, on walkable ground next to the log (not inside it).
- Keep it in ONE file: `logscene.js`. Target 700–1100 lines. Comment only where the intent is non-obvious.

## Testing

`index.html` has a built-in driver that plays the scene through the real DOM and key events and stops at a named state:

    http://127.0.0.1:8123/index.html?auto&ls=<state>

States: `intro choice blush stuck grab laugh tickle minigame escape fail complete end leave repeat`. It logs
`HOLD reached: ...` when it gets there (`end` and `leave` also log an `ENDED ...` line with her position, heels and clip
state after control returns). `?auto&face=<expression>:<blush>` shows one expression in close-up and logs `FACE ready`.

`tools/cdp_shot.mjs` takes a screenshot of any of those once the log line appears:

    node tools/cdp_shot.mjs "http://127.0.0.1:8123/index.html?auto&ls=tickle" /tmp/tickle.png 1280 800 "HOLD reached"

## Round 3 changes (the player's feedback after playing)

"Don't have the Kuns run around and be so fidgety when the scene plays", "make it run smoothly", "make the graphics
higher quality instead of so blocky".

### The creatures are Kuns

In the 2D game the creatures are called Kuns. See `refs/kun_ref.png` (left: the walking sprite; right: eight face
variants). A Kun is a small imp: a big onion or teardrop-shaped head that tapers to a soft point on top, two huge
leaf-shaped ears sticking out sideways, two very large round glossy eyes, a tiny smiling mouth, a small pear-shaped body
with a pale belly, short stubby arms and legs. No clothes, no nose. Total height 0.55 to 0.6 m, head about half of it.

- Kun A (works the right sole): green `#7ecb3a`, belly `#b6e36a`, inner ears `#5aa82c`, eyes orange `#ff8a1e` with a
  yellow highlight.
- Kun B (works the left sole): yellow `#f0c531`, belly `#f8e58a`, eyes sky blue `#6fc3ff`.
- Smooth, rounded, appealing (see `ART_DIRECTION.md`): no flat shading, enough segments that no silhouette shows
  facets at 1 m. Eyes are the focus: big, with a dark pupil and two highlights.

### Calm behaviour

- They walk in at a steady pace on a straight line and stop. No hopping, no bouncing (a step bob of at most 1.5 cm).
- While waiting or watching: they stand still. Only slow breathing (1 to 2 percent scale) and blinking. No bobbing,
  swaying, looking about or arm waving.
- Pulling the shoes: one smooth lean back each. No shaking.
- After the shoes come off: they straighten up. No falling over, no cackling, no jumping.
- Tickling: feet planted, body still. Only the feather arm moves, in slow smooth strokes (about 0.8 strokes per second,
  down from 1.5), and the head follows the feather a little.
- Leaving after an escape: they turn and run off in a straight line, quick but smooth (bob at most 3 cm), and vanish in
  the puff at the bushes. Leaving after a failure: they walk off with the coin pouch.
- Nothing random per frame. Every motion eased.

### Better-looking props

The hollow log (same size and place: outer radius 0.5 m, wall 0.08 m, length 0.8 m), the feathers, the coin pouch and the
particles should match the art direction: smooth bark with rounded rims, soft moss, fluffy pink feathers.

### Smoothness and cost

- Whole log scene: at most 1.0 ms of frame time, 40k triangles, 60 draw calls, 10 shader programs (`WORLD_SPEC.md`).
- Kuns, log and props use `MeshLambertMaterial` or `MeshStandardMaterial` without environment reflections; no
  `MeshPhysicalMaterial`.
- Everything is created when `createLogScene` runs. Nothing is created later (the page pre-draws every object once
  behind the start screen, hidden ones included, so their shaders and buffers are ready).
- `update` and `lateUpdate` must not allocate.

### New optional inputs in `ctx`

- `ctx.setFocus(point | null)`: ask for a depth-of-field focus point (a `THREE.Vector3`); call it with the subject on the
  face and feet shots and with `null` on wide shots and at the end. It may be missing: guard the call.
- `ctx.stuck`: where Anne's body goes in the log, because a new Anne model is coming with different proportions.
  `{ hipY, hipNorth, faceY, faceNorth }` = world height of `Marker_Chest` when she lies in the log (default
  `LOG_R - LOG_IN + 0.121`), how far north of the log centre it is pinned (default 0.05), and the face-shot look-at
  height (default 0.56) and its distance north of the north opening (default 0.17). Use the defaults when `ctx.stuck`
  is missing.

## Status (2026-10-01)

What shipped matches the "Round 3 changes" above, with the stylised Anne (`anne_next.js`, see `ANNE2_SPEC.md`) as the
default. Measured with `?lsprobe=1`: while the Kuns watch or tickle, their roots do not move and their heads move at
most 0.6 mm per update; only the feather hand strokes. The scene reads `ctx.stuck` from `anne2.json` (where her hips
and face sit in the log) and takes the loose shoe from `anne2_heel_prop.glb`. Both endings run in real time with no
frame over 34 ms.

## Close-up and ending (2026-10-01, later the same day)

Asked for: a bigger close-up of her feet while they are tickled, smoother and sharper feet in that shot, and no awkward
walk after she escapes.

**Shots.** Besides `wide`, `face` and `feet` there are now `soles` and `kicks`:

- `soles`: the tickle lines (18, 23, 24, a). A long lens (vertical field of view 24 degrees) 1.25 m south of her soles,
  raised 30 degrees and 16 degrees to one side, so the soles face the camera and the log's wall is behind them. Both
  soles fill the frame and sit above the dialogue box. Entered and left with a hard cut, never a camera move.
- `kicks`: the minigame. The same camera zoomed out to 40 degrees (she kicks about and would leave the tight frame).
  `soles` and `kicks` share a shot id, so going between them is a zoom, not a cut.
- On a narrow screen the camera backs off until 0.66 m fits across the frame; where there is no room it widens the lens.
- The scene remembers the host camera's field of view at `interact()` and puts it back in `finish()`.

**Focus.** `ctx.setFocus(point, strength)`: the close-ups ask for a shallower depth of field (2.2 for `soles`, 1.6 for
`kicks`), which keeps the soles, feathers and hands sharp and melts the inside of the log.

**`ctx.setCloseUp(mode)`** (optional host hook) is called every frame: `'ready'` while she is stuck, `'on'` in the two
close-up shots, `'off'` otherwise. She gets stuck and stands up behind a black screen, so the host may rebuild buffers
on `'off' <-> 'ready'` without a visible stall. Today the host only sharpens the picture while it is `'on'`.

**The inside of the log** is darkened by three translucent dark discs (`LS_LogShade`) that face south: the deeper you
look in from the feet side, the darker. From the north (the face shot) they are not drawn.

**The ending.** The `fetchHeels` step is gone. She used to walk barefoot to wherever a shoe had landed, which read as
an awkward shuffle of several seconds. Now `standUp` (the screen is black) sets `trapDone`; she says her lines standing
where she is (10-03: barefoot, her shoes where they lie; she puts them back on after C1, see the 10-03 section). `Stomp` is a single stamp of the right foot, and
exists in two versions (`Stomp` in shoes, `StompBare` without); the host picks by what she is wearing.

## The mimic shoes (added 10-01)

A second scene in `logscene.js`, taken from the 2D game's "Mimic Shoes" item (Item 14, CommonEvent 81 `SceneMIMICS`, sheet `anne-mimic-shoes-1`).

- **Item**: a pair of dark blue pumps with eyes on a flat stone about 3 m south-west of the log (`STONE`; first walkable candidate). Prompt "E — Look at the shoes"; `interact()` picks the shoes when Anne is within 1.35 m of the stone, else the log.
- **Script** (`L:mimic` → `mwear` → `mround` → `mescape`): lines M1 to M10, choice "Try them on / Leave them". She sits at `MIMIC` (clip `SitIdle`, her own shoes tinted blue), the right shoe slips to her toes and its tongue tickles her sole (`SitTickle`), the kick-off gauge runs (`mgame`: a hit or three misses ends it), after the first miss both shoes are at it (`SitBoth`). `mStand` puts her back in her purple shoes and the pair back on the stone.
- **Shots**: `msit` (her whole figure), `msole` (the raised sole, the hanging shoe and tongue in profile from her outer side; from the front once both are at it), `mside` (the bonus: a low side view of the left foot still in its shoe, whose tongue comes out over the inner edge and licks the inside of her foot). Ids 8, 10, 12: always cuts; 10 and up use the close-up sharpening and their own field of view (`mFov`).
- **Shoes**: the hanging ones are `makeHeelProp` copies (`mimics`) with eyes found on the shoe surface by ray, teeth and a tongue tube rebuilt every frame (`updMimic`). The left shoe is her real skinned shoe (`realHeelL`) with its own eyes (`wornEyes`) until it slips off too, because the prop does not sit exactly on a foot.
- **Grass**: `grassFlat()` gives `world/terrain.js` a wider, flatter pressed patch (`uPress`) while she sits, so the low side shot is not hidden.
- **Tone**: same as the log: a comedy tickle gag, laughing faces, only her shoes come off. The source sheet's hearts are not used.
- **Tests**: `?auto&ms=mlook|msit|mtease|mside|mgame|mboth|mescape|mend`. Close-ups measured at 16.7 ms (60 fps) in Chrome.
- **Clips**: `SitIdle`, `SitTickle`, `SitBoth` from `key_sit()` in `tools/anne2/s3_finish.py`.

### Changes after his first look (10-01)

- The artist of the reference clip gave consent, so the bonus shot (`mside`) now shows the clip's shoe: a toothed wedge whose mouth opens under her arch, spikes down its back, a strap over the toes, its tongue lapping at the arch (`buildWedge`, sized from her planted foot; shown only in that shot, her real shoe otherwise). Camera: side-on from a touch behind, 3 cm above the ground.
- The shoes that have slipped off no longer hang from her toes: they float about 10 cm under the sole, opening turned to the foot, bobbing, tilting and leaning in with each lick (as on the sprite sheet). Alone, the shoe keeps to her inner side so the camera sees the whole sole.
- Tongues are driven by `lickState`: the tip darts to a new spot at uneven intervals, flutters in place or pulls back; a ripple runs down the tongue (`drawTongue`).
- Anne's feet: `FOOT_RATIO` 0.135 -> 0.126 and `TOE_LEN` about 12% shorter in `tools/anne2/s1_body.py` (both Blender stages rerun).

### Second round (10-01)

- Both mimic shoes are now the open-toed toothed wedge in every shot (`makeWedge`, eyes on the toe strap); the tinted pumps, `realHeelL`, `wornEyes` and the shot-dependent swap are gone. `wornFrame` places a wedge on a foot from the sole markers; `mScale` fits it to her foot.
- Put-on step: after the fade she sits forward (clip `SitPutOn`, `put()`/`key_put()` in `s3_finish.py`), barefoot, her own pumps parked beside her (`parkHeels`), and each mimic slides onto its foot under her hands (`putOn` op, `mPutT`, shot `mput`). Tests: `?ms=mput1`, `?ms=mput2` (the scene freezes there).
- Tongue: one smooth looping lick modelled on the clip (`lick`): curled in the mouth, up the arch to the heel, a long flat drag back to the ball, curl away. Cubic curve, 20 rings. The earlier darting `lickState` is gone.
- `msit`/`mput` cameras use `clearRun` so they never back into the bushes; the sole close-up looks from her true right-hand side in both phases.
- Face: `EYE_SCALE`/`EYE_DEPTH_SCALE` 1.80 -> 1.42, `IRIS_FRAC` 0.70 -> 0.62, `HEAD_RATIO` 1/6.5 -> 1/6.9 in `s1_body.py`.

### Third round (10-01)

- The mimic shoes never leave her feet: no floating state. `SitTickle` and `SitBoth` keep both feet in the high-heel pose (`heel_r=True`), the tongue of each awake shoe laps at the arch from the mouth under it (right shoe from M5, left from the `mside` shot, both in phase 2). `msole` is a side view from her right.
- Fit: the wedge's heel seat was moved under her heel (it stuck out 3 cm behind), a heel cup and a broad toe band (`WFIT`) hold the foot. An ankle strap was tried and removed: it never sat on the ankle.

## The log is tight (10-01, evening)
"The log looks too big and the character could easily wiggle out": `LOG_R` 0.3, `LOG_LEN` 0.6 and the hollow is an oval burrow given by `HOLE` (`[z, half width, half height]` along the log, `holeAt(z)`), only a little larger than her hips. Counts (herbs, coins) and the "trap done" flag are now shared with the story's saved game (`ctx.counts`, `ctx.onCounts`, `ctx.onFlag`).

## 10-02: the Kuns tie her feet (batch 7)
She no longer kicks for long. Once she is stuck her legs lie flat and her feet rest on the ground (`StuckFlat`,
`StuckFlatStrain`, `StuckFlatTickled`); the Kuns (now about the size of the gold ball) come out, wind a cord round her
ankles, knot it, tie her big toes together and peg the line taut (`TIE`: `?tieph=N&tieat=s` freezes it at phase N), and
only then tickle and lick her soles (a feather and a tongue, `kunLick`; the two swap every 9 s). Lines `T1`, `T2`.
Camera: from behind her feet as on the 2D sheet (`feet`), close-ups `soles` / `kicks` follow the way her soles face.
On the escape the ties snap (`snapTies`). Tests: `?prog=10&ls=tie|tied|tickle|minigame|escape|fail|complete|end|repeat`
(`prog=10` skips the camp's opening, which otherwise plays first). With the sandals (10-02): `ls=tied`, `ls=tickle`,
`ms=mput2|mtease|mend` checked; the mimic pair is still a pair of dark blue wedges and takes the place of her sandals.

## 10-03: her shoes lie on the ground, a fourth Kun licks one, and she puts them back on
- **Lying, never sunk or floating.** The loose shoes take her current style's shape (the geometry is shared and swapped
  by `setShoeStyle`), so `fitProp` fits each again as it leaves her foot: a high heel's footbed line as before, a flat
  footbed 1.5 cm up. In flight the bounce floor is the lowest corner of the shoe's own box as it is turned (`lowY`); it
  comes to rest on its side (high heels) or on its sole (flats) at exactly the height that shape needs (`lieQ`), and
  settling it rolls over the ground, not through it. (Upside down was tried for the licked one: a strappy sandal then
  stands on its straps like a little table, so it is not used.) Measured with every style: lowest point 2 mm above the grass.
- **Kun D** (yellow, 0.17 m, `KD`): called when the tickling starts (`callD` from `startTickle`). He runs from the
  bushes to the nearer shoe, lifts it onto his head, carries it to a spot beside her right calf (in sight of the
  `kicks` and `feet` cameras), sets it down on its sole, side-on to the cameras (toe outwards), and from behind it,
  facing the cameras, licks INSIDE it: the footbed where her foot was (he asked for the inside, not the bottom). The
  tongue is a Kun's (`kunLick` on `shoeFrame`: the footbed line measured from the mesh per style, `soleProfile` = the
  lowest surface facing up near the centre line; flats are licked clear of the toe post, the pumps on their open heel
  half). He comes at it as A comes at her sole, mouth over the rim on his side, hands on the rim. Modes `toShoe`,
  `pick`, `haul`, `drop`, `shoe`; startled with the shoe still in his hands, he drops it (`dropShoe`). He stares,
  cowers and flees with the others, and scampers off in the robbery.
- **Her shoes back on.** `standUp` no longer puts them on: they stay where they lie through the stomp and E1/E2 (or
  F1/F2). After C1 ("...At least they left my shoes."): black, she sits where she stands facing the open side
  (`ownSit`), her shoes upright in front of her feet; `ownPut` plays `SitPutOn` (the right shoe comes up onto its foot
  over 0.08-0.30 of the clip, the left over 0.50-0.72, each then becomes the worn one through `ctx.setShoe`); black,
  she stands (`ownUp`), C2. The mimic scene does the same after the mimics are kicked off (`mOff`, M9 said sitting,
  `ownPut`, `mStand`, M10). Camera `own` (as `mput`, wherever she sits). Host context gains `setShoe`, `heelStyle`,
  `shoeStyle`.
- Tests: `ls=dlick` (D licking for 2 s; `__lsShot('kicks')` to look), `ls=own1|own2` (the right / left shoe going on,
  frozen), `ls=ownf` (after the robbery), `ls=cdone` (C2, shoes worn), `ms=mown|mown2|mdone`; `window.__lsShoes()`
  (each loose shoe's state, lie and lowest point), `window.__lsD()`, `window.__lsCam(i, d, h, a)` (a camera on shoe i).

## 10-03 later: the mimic shoes fit
He said they did not look fully on her feet and her left leg went through the ground. The wedge is now as wide as her
foot (WFIT.W 0.088, was 0.066) with side walls along the sole line (WFIT.wall 2.6 cm) and a bigger heel cup, so her foot
sits IN it. Her planted foot (the bent leg) used to lie flat on the grass, so its 9 cm wedge was buried: the scene now
plays MimPutOn and MimSit (and a re-planted SitTickle), where a planted foot stands in its wedge (s3_finish.py
plant_foot 'wedge'). Lowest point of the left wedge: -6 mm (was -63 mm at its origin). `MIM_CLIP` falls back to the
plain clips on an older model.

### Wet shoes after the put-on (10-03, batch 16)
When D got to lick inside one of her shoes (`dLicked`, set as he starts on the footbed), after `ownPut` she says W1 (a
random one of four: the text of a line may be an array), and once she is up: `flashOn` plays `IdleTiptoe` or
`IdleTiptoeR`, puts saliva on her soles (`ctx.soleMarks('wet', 45)`), lays the grass round her feet down (`flashFlat`)
and cuts to shot `flash` (key 16: low, facing the lifted sole, turned 30 degrees to its outer side, looking 5 cm under
it so the sole clears the dialogue box) at 1.5 s; at 3.3 s the clip is held (`ctx.holdClip`) for W2; `flashOff` lets it
run on, cuts to `aface` at 5.4 s and to Idle at 7.6 s; W3. Host context gains `soleMarks`, `holdClip`, `clipTime`.
Tests: `?ls=wet1|wet2|wet3` (the driver loses two rounds first, `miss: 2`), `&flash=L|R`.

### The brush, and saliva on the licked shoe (10-03, batch 17)
After W2 a choice ("Scrub her soles clean with the fuzzy brush" / "Leave them be"): `brush` runs `ctx.footPlay.clean`
(shot `play`: the camera footplay.js asks for), then W4 and the end; else `flashOff` and W3 as before. The shoe D licks
shows saliva on its footbed while he licks (`updBeds`, `ctx.propMarks`). Tests: `ls=wet4` (the brush, which goes by
itself in `ls=` tests), `ls=wet3` (leave them be: the driver's `nobrush`).
- Batch 19: `updTies` calls `ctx.anklesTogether` as the Kuns' cord goes on (her ankles side by side under it), and
  `finish()` sets it back to 0.
- 10-03: every shot of the scene is pushed in 3.5 % over its first nine seconds and drifts a few millimetres (the Motion
  Reel Kit's rule for held shots; `LSKIT`, `?camkit=0` off), except the brush's (`play`) and a test's.


## 10-04 (batch 21): her name and her face
`showLine`: when the speaker is Anne the name is `window.__heroName()` and the portrait `window.__facePortrait(expr,
blush)` (her own face, once the player has changed her look); the drawn portraits are used otherwise.
