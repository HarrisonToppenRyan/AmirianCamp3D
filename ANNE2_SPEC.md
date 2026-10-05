# Anne v2: a stylised (animated-film) heroine

The player's verdict on the current Anne: "her face looks creepy and not much like her 2D sprite". They want her face,
body and feet in the style of a modern animated feature, like these three renders they supplied:

- `/Users/harrisontoppenryan/Documents/Elektratouch/Screenshot 2026-09-29 at 9.04.26 PM.png`
- `/Users/harrisontoppenryan/Documents/Elektratouch/Screenshot 2026-09-29 at 9.04.38 PM.png`
- `/Users/harrisontoppenryan/Documents/Elektratouch/lighting_preview1.png`

Those renders are a **style** target (proportions, simplification, skin, eyes, feet, lighting). The **character** is Anne
from the 2D game, an adult witch adventurer: `refs/anne_portraits_2d.png` (her face and expressions), `refs/anne_sprite_sheet.png`,
`refs/anne_log_scene_2d.png`. Anne: long straight ginger hair with a centre parting and long front locks, blue eyes, fair
skin, pink lips; purple witch hat with a gold band, purple choker, sleeveless gold-yellow jumpsuit with shorts-length legs,
long purple gloves, purple high-heeled pumps.

She is always dressed. Skin that the outfit covers is deleted before export. Check renders must show her dressed too
(see "painted suit" below). Nothing sexual: she is the lead of a comedy cut-scene.

## Why the current one looks creepy (fix every one of these)

1. Realistic head and photo skin texture: pores and blotches under game lighting read as "uncanny". Wanted: smooth,
   simplified skin with soft colour gradients, no photo texture.
2. Small realistic eyes, opened wide, staring straight ahead and parallel. Wanted: large eyes, the upper lid resting over
   the top of the iris, eyes converging slightly, a big iris and pupil with a catch-light, a softly shaded eyeball (never
   pure white).
3. Thin sparse eyebrows and lashes. Wanted: thicker, cleanly shaped brows and a dark upper lash line.
4. Hair cards with a visible scalp. Wanted: chunky, smooth hair with volume.
5. A realistic mouth with a full row of teeth when laughing. Wanted: simpler mouth shapes; teeth as a clean white band.
6. Faceted limbs. Wanted: smooth silhouettes everywhere, especially shoulders, knees, ankles, feet and toes.

## Pipeline

Everything is built by scripts in `tools/anne2/`, run with headless Blender 4.5:

```
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/anne2/<script>.py -- [args]
```

Blender's own window is not running and must not be needed. The MakeHuman add-on (MPFB 2) is installed but not enabled in
the saved preferences; every script must start with:

```python
import addon_utils
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService
SYS = LocationService.get_mpfb_data()   # targets live in SYS/targets/<category>/<name>.target.gz
USR = LocationService.get_user_data()   # asset pack: eyes, eyebrows, eyelashes, teeth, hair, skins, clothes
```

Useful, verified facts:

- `HumanService.create_human(macro_detail_dict=..., scale=0.1, feet_on_ground=True)` makes the base mesh (1 unit = 1 m,
  +Z up, she faces -Y, her left is +X). `HumanService.add_builtin_rig(body, "default")` adds the rig (163 bones; the
  game's animations and the cut-scene use these bone names: root, pelvis.L/R, upperleg01/02.L/R, lowerleg01/02.L/R,
  foot.L/R, toe1-1.L .. toe5-3.R, spine05..spine01, neck01..03, head, clavicle.L/R, shoulder01.L/R, upperarm01/02.L/R,
  lowerarm01/02.L/R, wrist.L/R, finger*, jaw, eye.L/R and more). Keep this rig and these names.
- `TargetService.load_target(body, path, weight=w)` adds a shape key. **Weights above 1 work** (they extrapolate) once you
  raise `key.slider_max`. A first probe (`/private/tmp/claude-501/-Users-harrisontoppenryan/37295956-7e5f-4f0c-8919-8f8a5e5681d7/scratchpad/probe_style.py`,
  results in `.../scratchpad/probe/probe_faces.png`) pushed eye scale to 2.2 and head, nose, chin and neck targets hard and
  got a clean, clearly stylised head with no mesh damage. Start from that script: it is a working example of the whole
  create, target, rig, refit, render loop.
- `HumanService.refit(body)` moves the rig and the fitted assets (eyes, lashes, brows, teeth) to the morphed shape. Call
  it with the rig in rest position.
- Fitted assets: `HumanService.add_mhclo_asset(os.path.join(USR, "eyes/high-poly/high-poly.mhclo"), body, asset_type="Eyes", subdiv_levels=0, material_type="MAKESKIN")`,
  likewise `teeth/teeth_base/teeth_base.mhclo` ("Teeth").
- The base mesh carries helper geometry (joint cubes, eye/hair/teeth helpers, a skirt and tights helper). Vertex group
  `body` marks the real body. Bone vertex groups carry the skin weights. Other useful groups: `lips`, `toenails`,
  `fingernails`, `ears`, `scalp`, `helper-l-eye`, `helper-r-eye`.
- Expression morphs come from `SYS/targets/expression/units/caucasian/*.target.gz` (mouth-open, mouth-corner-puller,
  eye-left-closure, eyebrows-left-up, ...). Stage 3 loads them; stage 1 must leave the face in a state where they still
  work (see "eyelids").
- Background renders work: `scene.render.engine = 'BLENDER_EEVEE_NEXT'`, then `bpy.ops.render.render(write_still=True)`.
- Blender's Python has numpy but no PIL. The system `python3` has PIL but no numpy.
- In background mode there is no window: operators that need a 3D view fail. Use the data API, or
  `with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):` for
  object operators such as `modifier_apply` and `shape_key_remove`.

Stages and files (one owner per file):

| stage | script | input | output |
|---|---|---|---|
| 1 body | `tools/anne2/s1_body.py` | nothing | `build/anne2_s1.blend`, `build/renders/s1_*.png`, `build/anne2_s1.json` |
| 2 hair | `tools/anne2/s2_hair.py` | s1 blend | hair, brows, lashes objects; `build/anne2_hair.blend` |
| 2 outfit | `tools/anne2/s2_outfit.py` | s1 blend | jumpsuit, gloves, choker, hat; `build/anne2_outfit.blend` |
| 2 shoes | `tools/anne2/s2_shoes.py` | s1 blend | pumps, loose-shoe prop, sole markers; `build/anne2_shoes.blend` |
| 3 finish | `tools/anne2/s3_finish.py` | s1 blend + stage-2 modules | expressions, animations, markers, `anne2.glb`, `anne2_heel_prop.glb`, `anne2.json` |

Each stage-2 script exposes `def build(ctx)` (so stage 3 can call them all in one Blender run on the s1 file) and, when
run directly, opens the s1 blend, calls `build`, renders checks and saves its own blend.

Shared helpers go in `tools/anne2/common.py` (owned by the stage-1 author; stage-2 authors may only read it).

## Scene contract after stage 1 (`build/anne2_s1.blend`)

- Scene `Anne2`, collection `Anne2`.
- `Anne_Rig`: the armature at the origin, rest pose = MakeHuman default (arms out and slightly down).
- `Anne_Body`: the full base mesh, parented to the rig with an Armature modifier, **all stylisation baked into its basis
  shape**, no shape keys left, helper geometry still present (hidden by a Mask modifier on group `body`). It keeps every
  vertex group. It has a colour attribute `Col` (per vertex or per face corner, linear RGB) holding the painted skin.
- `Anne_Eyes`, `Anne_Teeth`: fitted, rigged, with final materials (`Anne_Eye`, `Anne_Teeth`).
- Materials on `Anne_Body`: `Anne_Skin` (uses `Col`), `Anne_Nail` (toenail and fingernail faces, purple polish).
- Custom property `Anne_Body["suit_faces"]` is not needed; instead a vertex group `suit` (weight 1) marks the vertices the
  jumpsuit will cover, and `gloves`, `choker` mark those regions (stage 2 builds the garments from them).
- `build/anne2_s1.json`: numbers other stages need: total height, head top z, eye centre positions, chin z, neck base z,
  shoulder z, crotch z, knee z, ankle z, foot length, heel and toe y, the list of targets and weights used.

## Stage 1 brief: body, face, eyes, skin

Goal: a stylised adult heroine whose bare head (no hair yet) already looks appealing, not creepy.

**Proportions** (measure, do not eyeball: print the ratios)

- Height about 1.70 m. Head (chin to crown) about 1/6.5 of height (realistic is 1/7.5). Legs long: crotch height about
  0.50 to 0.52 of height. Slender neck. Narrow sloping shoulders. Slim waist, moderate hips and bust. Slender arms, small
  hands. Smooth slender legs with soft knees, slim ankles. Feet slightly small and narrow, elegant, with a clear arch.
- Face: a soft oval that narrows to a small chin; full cheeks; the eyes sit at about the middle of the head or slightly
  below; eye width (corner to corner) about 1/4 of the face width each, one eye-width apart or a little more; the visible
  iris fills most of the eye opening height; small short nose with a soft tip and barely any bridge or nostril detail;
  a small mouth with full lips, corners slightly up; smooth brow ridge; small ears.
- She must read as an adult woman, like the references. Do not make a child or a chibi.

**Eyelids:** at rest the upper lid covers the top 15 to 20 percent of the iris and the lower lid just touches its bottom.
Achieve it by baking part of the expression targets `eye-left-slit` / `eye-right-slit` (or closure) into the basis, or by
moving the eyeballs, whichever gives the cleaner result. The lids must not cut into the eyeball.

**Eyes:** blue. Paint a new 1024 x 1024 eye texture for the MakeHuman eye mesh's UV layout (inspect
`USR/eyes/materials/lightblue_eye.png` to see where the iris sits): a large iris (clear blue with a darker rim and
lighter rays towards the pupil), a large pupil, one soft white catch-light at the upper left of the pupil, a sclera that
is warm off-white and darkens towards the top (lid shadow). Save it as `tex/anne2_eye.png` in the project folder. Rotate
each eye inwards by about 2 degrees so she looks at something 1.5 m ahead.

**Skin:** no texture. Paint colours into `Col`: base fair warm peach about sRGB `#f6cdb4`; soft rosy blush `#f0a08f` on
cheeks, nose tip, ear rims, shoulders, elbows, knuckles, knees, heels, balls of the feet and toe tips; lips `#d9607a`
with a crisp edge following the lip loops; a slightly darker, warmer tone in the eye sockets and under the chin; a thin
dark line along the upper lid edge. Blend smoothly (the mesh is dense enough). Fingernails and toenails get their own
material `Anne_Nail`, glossy purple `#5a2d91`.

**Smoothness:** Stage 3 will subdivide once at export. Check with a Subdivision modifier (level 1) in your renders that
shoulders, elbows, knees, ankles, heels and toes are smooth and well shaped. Fix pinches from extreme targets.

**Feet:** the cut-scene shows her bare soles in close-up, and the player asked for detailed, precise feet. With
subdivision the toes must be cleanly separated and rounded, nails neat, the arch and ball clearly formed, the sole smooth.
Render both soles from behind and a 3/4 view of the feet and check them.

**Painted suit:** so that every check render shows her dressed, give the faces in the `suit` region a flat gold-yellow
(`#f2a516`) material `Anne_SuitPaint` (and gloves/choker regions purple). Stage 2 replaces it with real garments.

**Renders** (EEVEE, soft three-point light, neutral grey-blue background, skin with a little subsurface): full body front,
side, back; face front, 3/4, profile; a close-up of the eyes; both feet 3/4 and the soles. Look at every one. Put a
side-by-side of your face next to the player's reference face in `build/renders/s1_compare.png`.

Iterate until the face is appealing. Extreme values are fine if the result is clean. If MakeHuman targets cannot reach
a shape, deform the basis directly with smooth falloffs (remember the helper geometry and joint cubes must move with it,
then refit).

**Report:** the final target list, measured ratios, what still looks wrong, and anything stage 2 and 3 must know.

## Stage 2 briefs (three authors work at the same time, each on its own script and its own output blend)

Common rules: read `build/anne2_s1.blend` and `build/anne2_s1.json`; never save over the s1 blend; put check renders in
`build/renders/s2_<part>_*.png`; smooth shading everywhere; every mesh is parented to `Anne_Rig` with an Armature modifier
and carries bone vertex groups (copy weights from the nearest body surface unless told otherwise); test the fit in these
poses, not only the rest pose: (a) standing, arms down at the sides; (b) walking stride, one thigh 35 degrees forward and
the other 25 degrees back, arms swinging; (c) head turned 40 degrees and tilted 20 degrees; (d) lying face down, chest
arched up about 60 degrees, head upright, shins bent up 50 degrees (the cut-scene pose). The legacy pose code in
`tools/anne2/legacy/anim_src.py` shows how those poses are keyed (`aim(bone, direction)`).
Every check render must show her dressed (the painted suit from stage 1 is enough until the real suit exists).

### `s2_hair.py`: hair, eyebrows, eyelashes

- **Hair** `Anne_Hair`, material `Anne_Hair`: long, straight, ginger (`#e2702a`, darker `#b5521f` at the roots and
  underneath, lighter `#f29a4e` streaks), centre parting, two long front locks that frame the face and fall over the
  collarbones, the rest down her back to the waist. Chunky, smooth, sculpted-looking clumps as in the reference renders:
  a scalp cap plus 25 to 45 thick tapered locks that overlap into one solid mass, tips tapering to points. No alpha cards,
  no visible scalp. Colour as a vertex-colour attribute `Col` (root-to-tip gradient plus lock-to-lock variation).
  At most 25k triangles. It must not cut into the face, neck or shoulders in poses (a) to (d), and it must sit under a
  witch hat: keep the cap within 1.5 cm of the skull above the hat line (the hat band sits about 5 cm above the brows).
  Skinning: above chin level 100 percent head; below that blend over 15 cm into the upper spine (`spine01`, `spine02`),
  so the hair lies along her back and chest instead of sticking out like a board.
- **Eyebrows** `Anne_Brows`, material `Anne_Brow` (`#8a3f1c`): two smooth solid strips that follow the brow, thicker at
  the inner end, tapering outwards, with a soft arch. 0.6 mm off the skin.
- **Eyelashes** `Anne_Lashes`, material `Anne_Lash` (`#2a130c`): a dark tapered strip along each upper lid edge, 3 to 5 mm
  long, thicker and slightly winged at the outer corner.
- Brows and lashes must follow the face when it makes expressions. Stage 3 handles that by binding each of their
  vertices to the nearest face triangle, so keep them close to the skin and do not parent them to bones other than
  through the Armature modifier.

### `s2_outfit.py`: jumpsuit, gloves, choker, hat

- **Jumpsuit** `Anne_Suit` (material `Anne_Suit`, `#f2a516`) with piping `Anne_SuitTrim` (material `Anne_Trim`, gold
  `#c9860f`, a rounded bead along every hem): sleeveless, round neckline just below the choker, leg openings at
  shorts length. Built from the body surface (vertex group `suit`) pushed out 4 to 6 mm and **smoothed so that no anatomy
  shows through**: the bust is one soft shape, no navel, no creases. Visible cloth thickness at the hems.
- **Gloves** `Anne_Gloves` (material `Anne_Glove`, `#5a2d91`, satin): from the fingertips to the middle of the upper arm,
  ending in a slightly flared cuff with gold piping.
- **Choker** `Anne_Choker` (material `Anne_Choker`, purple) with a small gold oval gem `Anne_Gem` at the front.
- **Hat** `Anne_Hat` (material `Anne_Hat`, purple) with `Anne_HatBand` (gold band and a small buckle): a soft cone that
  bends backwards with a little curl at the tip, a wide brim with a gentle wave. **Tilt the whole hat back about
  15 degrees and turn the front of the brim up**, so that a camera 30 degrees above her can still see her eyes (the old
  hat hid her face). Parent it to the `head` bone. It sits over the hair: inner radius = skull + 1.8 cm.
- Mark the skin that the garments hide: vertex group `hidden` on `Anne_Body` (everything under the suit, gloves and
  choker except a two-vertex margin at each opening). Stage 3 deletes it.
- Budgets (triangles): suit 12k, gloves 12k, hat 4k, choker and gem 1k.

### `s2_shoes.py`: pumps, the loose shoe, the sole markers

- **Pumps** `Anne_Heel_L`, `Anne_Heel_R` (materials `Anne_HeelPurple` glossy `#5a2d91`, `Anne_HeelSole` dark `#2a1247`):
  closed almond toe, low-cut vamp, a counter round the heel, a 6.5 cm stiletto, thin sole. Built around the real foot:
  1.2 to 2 mm clear of the skin everywhere inside, no skin poking through and no gap wider than 1.5 mm at the topline,
  in the rest pose and with the foot pitched for standing in heels. The legacy builder `tools/anne2/legacy/pump_src.py`
  and its test `shoe_test.py` did this for the old body (cross-section rings measured from the foot; toe box weighted to
  `toe3-1`; the stiletto pre-tilted so it stands vertical when the foot pitches by `theta = asin(heel height / heel-to-ball distance)`).
  Reuse the method, improve the shape. At most 6k triangles a shoe.
- **Loose shoe** `Anne_HeelProp`: one right shoe as a separate, unrigged mesh, standing on the ground (sole on z = 0, toe
  towards -Y), for the moment the Kuns pull her shoes off.
- **Sole markers:** empties `Marker_Sole_L_Heel`, `_Arch`, `_Ball`, `_Out` and the same for `R`, parented to the `foot`
  bones. Heel, Arch and Ball lie on the skin of the bare sole at 13, 45 and 72 percent of the foot length from the heel;
  Out is 6 cm off the sole at the arch, along the sole's outward normal.
- Write `build/anne2_shoes.json`: `theta` in degrees, heel height, foot length, and the marker positions.

## What shipped (2026-10-01)

The plan above was followed with these differences. Read this section first; where it disagrees with the briefs, this
section is what the code does.

**Rebuild from nothing** (each step is one headless Blender run; about 30 s, then 2 minutes):

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b --python tools/anne2/s1_body.py                  # body, face, eyes, painted skin -> build/anne2_s1.blend + .json
    $B -b --python tools/anne2/s3_finish.py -- --out anne2  # dresses her (stage 2), expressions, clips, export
                                                            # -> anne2.glb, anne2_heel_prop.glb, anne2.json, build/anne2_s3.blend

Check renders without exporting: `tools/anne2/s2_check.py -- --parts outfit,hair,shoes --views face,head,body,suit,feet,poses [--heels]`
(dressed character in the fit-test poses) and `tools/anne2/s3_faces.py` (every expression the game uses, front and
three-quarter). Both write contact sheets to `build/renders/`.

**Files**

| file | what it does |
|---|---|
| `s1_body.py`, `common.py` | stage 1 and the shared helpers (unchanged plan) |
| `s2_util.py` | helpers for stage 2: rest-pose snapshot of the body, distance and weight queries, tubes, hulls |
| `s2_outfit.py` | suit, piping, glove cuffs, choker, hat |
| `s2_hair.py` | scalp cap, locks, fringe, brows, lashes |
| `s2_shoes.py` | pumps, loose shoe, the skin the shoes hide |
| `s2_check.py`, `s3_faces.py` | check renders |
| `s3_finish.py` | runs the stage-2 builders in the order outfit, hair, shoes; expressions; clips; export |

**Outfit.** The suit is a separate mesh made from the body faces stage 1 painted, pushed 3.6 mm off the skin, smoothed
like taut cloth and subdivided once. The skin under it is smoothed first and hidden at export (group `hidden`), the
crowded vertices at the bust are welded and the cloth is smoothed by distance over the chest and seat, so no anatomy
shows. Hems turn inwards and carry a gold bead. The gloves stay painted on the skin (material `Anne_GlovePaint`); only
their cuffs are geometry. The choker is a 20 mm band that starts 33 mm up the neck (higher and it catches the jaw). There
is no gem (her sprite has none). The hat is tilted back 15 degrees; its opening is fitted to the head's outline.

**Hair.** Caramel ginger (`#c1763a`), as in her sprite. Each lock's centre line is hung on her by a small drape step
(fall, rest on skin or suit, slide), so locks lie on shoulders, back and chest. Above the chin the hair follows the
head, below it hands over to the neck and spine bones.

**Shoes.** Every section of the shoe is a smooth analytic outline fitted round the foot's cross-section, so the shell
is clean and never closer than 1.9 mm to the skin. Skin inside the shoes gets the materials `Anne_SkinShod` and
`Anne_NailShod`; the game hides those meshes while the shoes are on, so nothing can poke through. The stiletto is
pre-tilted by `theta` (29.7 degrees) and stands upright once the foot is pitched.

**Expressions.** MakeHuman's expression units, retargeted per vertex with stage 1's `retarget_gain`. Eyelids are NOT
morphed straight: `eye-*-closure`, `-slit` and `-opened-up` are baked from poses of the lid bones, which turn about
the eyeball's centre (the lids meet at 45 degrees). `eye-*-closure-mid` is a corrective the game weights with
4c(1-c), so a half-closed lid stays on the eyeball. The inside of the mouth follows the skin in front of it in every
key, and is only painted dark where it is more than a few millimetres behind the skin. The head is cut from the body
under the middle of the choker and the morphs fade out just above the cut.

**In the game** (`anne_next.js`, now the default; `?anne=old` loads the first version). Things that cost time:

- The exported materials carry a white sheen (`KHR_materials_sheen`) on hair and cloth and are all two-sided. The
  loader switches both off; with the sheen on, everything looks pastel.
- The model's colours are display colours. Under the game's sun a surface shows at roughly 2.5 times its albedo, so
  the loader scales them: skin 0.42, hair 0.55, eyes 0.42 (`?skin=`, `?hair=`, `?eye=`, `?env=` override them while
  you look).
- The eyes are drawn by a shader on the eyeball (sphere centre and radius come from `anne2.json`); the eye texture
  from stage 1 is not used in the game.
- Test views: `?look=dx,dy,dz,tx,ty,tz` (camera relative to her, `&bare=1` shoes off, `&expr=name:blush`),
  `?face=name:blush&fd=&fa=&fy=`.

**Numbers.** 150k triangles in all (head 33k, skin 63k, hair 14k, suit 13k, shoes 6k each). Frame cost in WebKit at
the pixel budget: 8.5 ms in the open, 9.3 ms in the tickle scene (the first version measured the same). The whole
cut-scene in real time, both endings: no frame over 34 ms.

**Known small flaws.** A slight kink in the piping at the top of each armhole. A faint pale spot can show under the
lower lip in wide-mouthed expressions. The lower lids read a little heavy from below.

### Finer feet (2026-10-01, later the same day)

The cut-scene now shows her soles in close-up, so the feet are exported one subdivision level finer than the rest.
`skin_and_feet()` in `s3_finish.py` subdivides the whole skin at level 1 and at level 2 (limit surface on), then cuts
both above the ankles (every base face below 0.13 m in the rest pose is "foot"): `Anne_Skin` keeps the coarse part,
`Anne_Feet` the fine part. Because both come from the same surface, the cut is invisible; the coarse side is given the
fine side's extra points along the cut (80 points, each moved 0.1 mm) and both sides use the fine mesh's normals there.
Do not subdivide the two parts separately: each would treat the cut as an open edge and the shading would crease.
`Anne_Feet` is 70k triangles (the character is 203k in all); in play, with her shoes on, most of it is hidden and the
cost is under half a millisecond a frame.

`Stomp` (in shoes) and `StompBare` are each one stamp of the right foot; `anne_next.js` picks the `Bare` version of any
clip while her shoes are off.

## Changes on 10-01 (later rounds)

- Body nearer the 2D sprite: `weight` 0.38, `cupsize` 0.72, waist target 1.0, narrower shoulders, fuller hips and bust, slimmer underbust (`TARGETS` in `s1_body.py`).
- Face more natural: oval head instead of round, less child-like (`head-age-decr` 0.15), flatter cheeks, nose and mouth lower apart, `EYE_SCALE` 1.22, `IRIS_FRAC` 0.57, `HEAD_RATIO` 1/7.2, no head widening.
- Feet: `FOOT_RATIO` 0.126, shorter `TOE_LEN`.
- Default shoes are open-toed heels: in `s2_shoes.py` the upper ends at `OPEN` (0.79 to 0.84 of the foot length), in front of it only a low rim (`RIM`) round a short sole (`EXT` 0.006); skin in front of the band is no longer hidden when shod.
- New clips: `SitIdle`, `SitTickle`, `SitBoth`, `SitPutOn` (mimic shoes scene).

## Locomotion (10-01): `tools/anne2/gait.py`

Idle, Walk, Jog, Run and their barefoot twins come from a gait model instead of hand-keyed poses.

- Feet: each foot is pinned to a point of ground that moves back at the clip's own speed and rolls over it (heel tip, flat, toe joints, toe tips in the walk; ball of the foot only in jog and run). In the air the ankle follows a smooth arc. Hips: their height is solved per frame from the knee bend a person has at that point of the step, then smoothed; the pelvis also turns, drops and shifts. Legs: two-bone IK. Chest turns against the pelvis, head stays forward, arms swing against the legs, fingers curl.
- `class Pose` is a small forward-kinematics solver, so a clip is keyed in a fraction of a second. `tools/anne2/gait_dev.py` re-keys the clips on the saved stage-3 file, checks on the shoe meshes that planted feet do not slide or sink, and renders contact sheets (`--clips Walk,Jog,Run,Idle --views side,front --walk "key=value;..."`).
- Tables `WALK` (1.52 m/s, stride 1.52 m), `JOG` (2.4 m/s, 1.80 m), `RUN` (4.4 m/s, 2.93 m). `frames` is real time at 24 fps; `SUB = 2` keys are written per frame, so the clip in the file is twice as long as real time.
- In the game (`anne_next.js` `updateClips(dt, speed)`): the gaits blend by speed and share one stride phase that advances by distance / stride (`anne2.json`: `stride`, `gaitSpeed`), with `action.time` set directly, so planted feet stay put at any speed. Measured in WebKit: the slowest tenth of sole speeds is 0.03 (walk), 0.07 (jog), 0.16 m/s (run, the foot rolling). A cut-scene that plays a gait by name runs it at real speed.
- Why a jog: at the 2.4 m/s he asked for, a walk needs more than three steps a second, which is what looked inhuman. A true walk is 1.5 m/s (Alt).
- Idle: weight on the right leg, feet 10 cm apart ("legs closer together").
- The stiletto now ends exactly on the ground in the standing pose (`s2_shoes.py`: the tip is found from the ankle pivot; before, it stopped 18 mm short).

## Face (10-01, towards her 2D portraits)

- `s1_body.py`: almond eyes (`EYE_SCALE` 1.42, `LID_COVER` 0.30, outer corner raised 9 deg), set closer (`EYE_OUT` 0.0055), narrower head and jaw, pointed chin, smaller nose with the nostrils turned down, thinner and narrower lips, paler skin. The "eyeball comes through the skin" test now casts a ray from the eye centre (the old nearest-face test cut holes in the eyeball once the lids were lowered).
- `s2_hair.py`: darker auburn hair, thinner arched brows, heavier upper lash line, lower fringe, wider front locks. `s2_outfit.py`: hat lower and nearly level, lighter underside.
- `anne_next.js` `liftFaceShadow`: the face and eyes ask the shadow map about a point 0.6 m towards the sun, so her own hat and hair never shade her face (trees and rocks still do). The hat's underside has a little light of its own.

## Evening of 10-01: softer face, story poses, toes, hat
- **Jaw** ("her jawbone is way too sharp"): `TARGETS` in `s1_body.py`: `head-invertedtriangular` 0.5 -> 0.3, `chin-triangle` 0.6 -> 0.3, `chin-prominent-incr` 0.3 -> 0.1, `cheek-volume-incr` 0 -> 0.3, new `head/head-fat-incr` 0.15; the painted tone under the jaw is wider and weaker (strength 0.4, blur 5). `jaw_w_over_face_w` 0.724 -> 0.777. Trial renders of four settings are made with `--nosave --tag jN --views face,preview --out DIR --set "T:..."`; softer than this (`head-fat-incr` 0.25, `cheek-volume-incr` 0.4) starts to read as the round face that was rejected earlier.
- **Story poses**: `tools/anne2/poses.py` (called by `s3_finish.py` after `key_put()`), keyed with `gait.Pose`: `CampSleep`, `CampSit`, `Startle`, `Point`, `Cast`, `VineHeld`, `VineHeldShod`, `SitFlat`, `HeldBack`, `HeldProne`, `LaughFit`. A pose is written in her body frame and grounded by measuring the meshes. Quick look without a rebuild: `Blender -b --python tools/anne2/poses_dev.py -- --clips A,B --views side,34,top --n 2 --tag p` (contact sheets in `build/renders/`). The full build now takes about 25 s and the GLB has 28 clips (13.2 MB).
- **Runtime** (`anne_next.js`): `setToeWiggle(amp, rate)` adds a toe wiggle after the mixer (in her shoes the middle toe keeps still, it carries the shoe's front, and the others only lift); `setHat(on)`; the face takes no cast shadows at all now (`faceLift` 40 m: tree dapple lay on her face in grey patches) and shaded skin keeps some warmth; clips that have faded out are taken out of the mixer.
- **A trap that cost an hour**: the glTF loader gives many tracks ONE shared array of key times. Moving "each track's" times (to start clips at 0 instead of 1/24 s) moved the shared array hundreds of times: every clip's timing was garbage and her legs froze while she moved. Shift each distinct array once (`movedTimes`). Check with `?gaitprobe` at a steady jog: planted share about 0.3, slowest tenth about 0.01 m/s.
- **Shoes**: fitted to the foot as it stands in them (rest pose and heels pose together, `heels_points`), weights along the topline evened out, 15 mm of skin kept below the topline (`KEEP_SKIN`). The ragged topline seen in tests is mostly the 1x test resolution plus close-up sharpening; at 2x it is clean.

## Skin in the shade (2026-10-01, VER 72)
The sky's light alone turned shaded skin grey-blue, worst where skin faces the sky (the backs of her legs and her soles
when she lies on her front). `skinMaterial` now keeps the brightness of the ambient light but gives it the colour of her
skin under a warm light (`?skinamb=0.85`, `?skinlift=1.1`), and cast shadows lie lightly on skin: in shadow it still
takes 30% of the sun (`?skinshade=0.3`; the line is patched into three's `lights_fragment_begin`, `A.skinShadowOk()`
says whether the patch found its place). `?skinwarm` is retired.

## 10-02: sandals, a fuller body, nails, a second figure
- **Body** (s1_body.py): MACRO weight 0.46, waist-circ-decr 0.85, less upper-arm, lower-leg and upper-leg trimming: a little
  fuller (waist +4 %, hips +3 %). Leg radius tables for the game's coils re-measured with `tools/anne2/measure.py`.
- **Purple sandals instead of the pumps** (`tools/anne2/s2_sandals.py`, part `sandals` of s3_finish.py, now the default): a
  thin sole cut from the convex print of her foot, a band over the ball, a strap over the instep, one round the ankle and
  one up the back of the heel. Object names `Anne_Heel_L/R` and `Anne_HeelProp` are kept (the game knows them); nothing
  of the foot is hidden any more (no `Anne_SkinShod`). theta 4.3 deg, heel lift 10 mm. Straps are read off the foot along
  the SAME directions for every rib (`radii`) and straightened across their width (`even`). The ankle strap is cut from
  exact level sections of the leg (`level(z, band)`): the nearby points alone are half a loop of vertices up the shin.
  Nearest skin 0.89 mm. Look: `Blender -b --python tools/anne2/shoes_dev.py -- --tag sh [--macro | --ankle] [--bare]`.
- **In the game** (anne_next.js): `A.setShoe('L' | 'R', on)` (one sandal at a time), `A.shoes()`, `A.setNailColor(css)`
  (her toenails; the player's choice, index.html `chooseNails`), `A.makeTwin(clone, look)` (a second figure from the same
  model with its own materials, mixer and face: the thief), `depthBias(m, 6)` on the suit and its trim (their depth is
  drawn 6 mm nearer: skin that crossed the suit in the fold of an armpit no longer shows as a ragged patch).
- **New clips** (poses.py): `ThiefIdle`, `IvyLegUp`, `IvyLegUpTickled`, `IvyWorship`, `MycHeld`, `MycHeldOut`, `AlrHeld`,
  `AlrHeldTickled`, `PumpkinSeat`, `PumpkinHeld`, `PumpkinHigh`, `HoleTease`, `HoleTickled`, `HoleBound`, `HoleKickout`,
  `CampSleep` (on her side), `CampWake`, `CampLie`, `NailShow` (the chooser: lying back on her hands, legs held up and all
  but straight, toes pointed away; the chooser's camera is poses_dev's view `nails`). 51 clips, 15.85 MB.
- poses_dev.py views added: `hip hipf hipb pit pitf nails`; it prints `NailShow`'s toe and head positions.

## 10-02 later: legs together, seven shoe styles, bored idles
- Legs: `?-upperleg-fat-incr` 0.5 and `legs_in` (s1_body.py `LEGS_IN` 0.012); knees track inwards (gait.py).
- Shoes: `tools/anne2/s2_sandals.py` builds every style in `STYLES` (see BATCH7_PLAN.md, batch 9). Previews:
  `shoes_dev.py --style <id>`; gait_dev / poses_dev show the first style only.
- Clips `IdleLook`, `IdleTiptoe` (gait.py `key_idle_fidget`), 53 clips, 17.9 MB.


## 10-02 evening: face and crossed ankles
- Face nearer her portraits ("more white, less Asian"): `MACRO race` caucasian 1.0 (was asian 0.35 / caucasian 0.65);
  `head-oval` 0.5, `cheek-volume-incr` 0.05, `cheek-bones-incr` 0.35; the nose straight with a bridge (`nose-curve-concave`
  0.25, `nose-scale-depth-decr` 0, `nose-trans-backward` 0, `nose-hump-decr` 0.5, `nose-greek-decr` 0); `HEAD_XYZ` x 0.91;
  `EYE_SCALE` 1.34, `EYE_BROW_FLAT` 0.3 and `EYE_BACK` 0.003 (deeper-set); skin `#fde9e3`, blush `#f0a6a0`, socket
  `#eab4a8`. In the game the skin's shade and rim are cooler (`anne_next.js`: tone 1.0/0.93/0.91, rim 1.0/0.90/0.89).
  The legs did not change (`measure.py`: within 1 mm). Old build kept in the scratchpad (`anne_v159`).
- Crossed ankles: see BATCH7_PLAN.md batch 12 (`legs_overlap` in `gait.py`'s `key_idle_fidget`).

## 10-02 night: hogtie, kneeling, the chair
- `poses.py` (`key_held`): **Hogtie** / **HogtieTickled** (on her front, wrists crossed at the small of her back
  (spine04, not spine01: spine01 is up between her shoulders), shins up and together, soles to the sky; tickled: head
  tossing, hips squirming), **KneelSit** (Boudicca: kneeling, sat back on her heels), **ChairBound** (shod) /
  **ChairBare** / **ChairTickled** (the opening: seat 0.47 m, wrists on the armrests, legs out straight on a footstool,
  soles forward). Previews: `poses_dev.py -- --clips Hogtie,ChairBare --views side,34`. The game's ties for the hogtie
  are `ties.js` (`wrists`, `hog`).

## 10-03: a softer, less puffy face (Anne, and Lilith and Boudicca, built from the same body)
He found both faces "a bit puffy". `tools/anne2/s1_body.py` TARGETS: a more inverted-triangle head (0.30 -> 0.45), no
head fat (0.15 -> 0), cheek volume down (`cheek/?-cheek-volume-decr` 0.35, the incr target 0.05 -> 0), a narrower
chin (width-decr 0.75 -> 0.95) and a little shorter (height-decr 0.12; above about 0.15 the face rounds again), a
smaller, narrower nose (scale-horiz-decr 0.7, volume-decr 0.4, point-width-decr 0.45, scale-vert-decr 0.35, nostrils
width and flaring decr 1.0). Jaw/face width 0.812 -> 0.720. Rebuilt with both headless runs (s1 then s3).
Also new clips (`poses.py`): ChairBound / ChairBare / ChairTickled for the opening; the hogtie's wrists now ride on
spine04. Her loose shoes and putting them back on: `LOGSCENE_SPEC.md` 10-03 and `STORY_SPEC.md` (`SitPutOn`).

## 10-03 later: mimic wedges she stands in, and the feather
- `s3_finish.py plant_foot(side, x, y, mode)`: a foot planted on the ground beside her. 'flat' as before (bare feet,
  flat shoes: SitIdle, SitPutOn); 'wedge' for the mimic shoes (logscene.js WH: heel seat 9.1 cm, ball 2.4 cm, 10.8 cm
  apart): pitched by TW = atan2(0.067, 0.108) and lifted until the ball marker is on the toe plate. New clips MimSit
  (SitIdle in the wedges) and MimPutOn (each foot rises into its wedge as it goes on); SitTickle's planted foot stands
  in its wedge. The left wedge used to sit 6 cm in the ground.
- `poses.py key_feather`: FeatherSit, FeatherTickle (0.5 s), FeatherTickleHard (0.33 s). Sitting, left leg out, right
  knee drawn up and out, that foot held before her chest with its sole to her (`sole_to_her`: P.orient with the toes
  up and the sole facing her), left hand at the ankle, right hand stroking. FE_FWD / FE_UP / FE_FLEX set where that
  ankle is held. The game draws the feather from her right hand to her sole (story_camp.js).

## 10-03 (batches 16-17): marks on her soles, five more shoes, feet never under the ground
- Shoes: twelve styles now (thirteen since batch 22: `geta`, see below) (`s2_sandals.py STYLES`): added `gladiator`, `cross`, `wedges`, `flats`, `mules` (new strap
  kinds `spine`, `xband`; `style["wedge"]`; `("upper", "mule")`). Previews as before: `shoes_dev.py --style <id> --tag sh_<id>`.
  The build is still one run: `Blender -b --python tools/anne2/s3_finish.py -- --out anne2` (2 minutes; 12 styles).
- `anne_next.js` API added: `soleMarks(kind, sec, { empty })`, `scrubMarks(side, worldPoint, r, amount)` (negative: grow),
  `solePoint(side, u, v, pos, normal)`, `soleUV(side, worldPoint)`, `layMarks`, `propMarks(profile)`, `holdClip(on, at)`,
  `setGround(fn)`, `setFloor(y)`, `groundFeet()`, `groundStats(reset)`, `groundOn(on)`.
- The sole model (`soleModel(side)`): heel, arch, ball and the way out of the sole from the `Marker_Sole_*` points (children
  of the foot bone), the skin's points that face out of the sole in the bone's bind-pose space, the flat's width along
  it; `fit(u, v)` is a point ON the skin. `bedModel(side, style)`: the same for the insole of the worn shoe.
- `groundFeet`: per foot, the outermost points of its skin and toes and of the shoe on it (`footHull`: each vertex goes to
  the bone that carries most of it, kept in that bone's space; 26 directions for the foot, half of them for each toe
  bone, plus the lowest point of each cell of a grid under the sole). The thigh, shin and foot are put back to what the
  clip gave them before the next frame's clips (`groundBefore`), because the mixer only writes a bone whose value changed.
- Batch 18: `setLegShake(side, amp, 'pivot' | 'knee')`, `ankleTo(side, point, footQuat)` (two-bone IK, used by the ground
  clamp and the shake), `dangleLow()`. The sole flash's dropped shoe rides on `toe3-1` and is kept above the ground; the
  order each frame is groundBefore, toesBefore, mixer, toesAfter, groundFeet, updDangle, legShake.
- Batch 19: `anklesTogether(0..1)` (her ankles clamped side by side whenever they are tied: `ankles(dt)` runs after the
  toes and before the ground clamp), `ankleGap()`.
- Batch 20: the leg shake runs at 3 to 6.5 Hz (it was 9 to 21 Hz: a jitter at 60 frames a second), over the same range.
  `footRest(side)`: the foot bone's world matrix BEFORE the shake ('pivot') or at the middle of it ('knee', which only
  ever lifts): what footplay.js holds a tool's hand steady by. The sole's smooth surface for the tools is built in
  footplay.js (`soleOf`) from `_marks().models[side]` (the sole model: heel, arch, ball, normal, the skin's points).


## 10-04 (batch 21): the player's look. Ten hairstyles, face shapes, skirts and a belt
Rebuild: `Blender -b --python tools/anne2/s3_finish.py -- --out anne2` (about 6 minutes now; anne2.glb 26.8 MB). On this
8 GB machine the export step crawls when memory is short (one run sat in it for over five minutes and hit a 10-minute
limit): run it in the background with a long limit.
- Hair (`s2_hair.py`): `STYLES` = long, wavy, curls, bob, pixie, ponytail, twintails, braids, bun, afro. Each is its own
  node (`Anne_Hair` for the first, `Anne_Hair_<id>` for the rest), one visible at a time (`A.setHairStyle`). The list and
  whether a style goes under the hat are in `anne2.json` `hair` (from `build/anne2_hair.json`). `ANNE_HAIR=a,b` builds a
  subset. The braids' front locks hang in front of each ear (they crossed her face at first).
- Face shapes (`s3_finish.py` `FACE_SHAPES`, `face_shapes()`): 15 static shape keys named `shape-...`
  (base-asian, base-african, soft, jaw-wide, chin-long, cheekbones, face-round, nose-wide, nose-bridge, nose-long,
  lips-full, mouth-wide, brow-heavy, eye-fold, eye-slant). Each is a sum of MakeHuman targets x `retarget_gain` x a face
  mask (nothing moves on scalp, ears, neck: every hairstyle, the hat and the choker still fit). Near the eyes a shape
  slides ON the eyeball (`on_ball`). Her lips stay closed (`seal`: lip points within 3 mm of each other move alike; the
  two macros parted them by 5 mm). A macro target (another build of the whole person) also moves, turns and resizes the
  head: `unposed` takes the best-fitting similarity out first (without it the "face shape" was 146 mm). `shape-eye-slant`
  is made here (the lids turned 9 degrees about each eye's axis). Brows, lashes, teeth and tongue get the same keys.
  The game: `A.setShape({ 'shape-...': weight })`; `A.shapes()` lists them; twins have them at zero.
- Skirts and a belt (`s2_outfit.py`): `Anne_Skirt` (hem z 0.725), `Anne_SkirtLong` (hem z 0.565, above her knees so that
  it never has to bend at them), each with a `...Trim` bead along the hem, and `Anne_Belt` (two materials: belt, buckle).
  Ring-built cloth: `body_ring` = the CONVEX outline of her skin in a band of heights (`hull2d`), `waist_height` 1.11,
  `hip_height` 0.95; below the hips the cloth hangs from the outline of everything between her hips and the top of her
  thighs, flared, in folds, `push_out` 7 mm clear of skin and suit. `cloth_weights`: the nearest skin's weights, shared
  between her two sides within 7 cm of her middle, then evened out along and across the rings.
  LESSON: rays cast from her middle axis at hip height start in the gap between her thighs (the first build's skirt was
  a 4 cm tube). And a node with two materials becomes a group with a mesh per material: hide and show the NODE, never
  by a name prefix (the belt's meshes stayed hidden).
- `anne_next.js`: `lookMats` (suit, trim, glove, choker, hat, band, brow, hair, skirt, belt) and `builtColor`; the skirt
  is two-sided and drawn 9 mm nearer (the belt 13 mm) so that neither fights the suit under it. The parts are hidden at
  load; `A.setParts({ node: bool })` shows what an outfit has.
- Skin tone: `uTone` multiplies the painted skin (soles and palms stay lighter), `uToneDeep` fades the rim light and
  deepens the blush. Eyes: `uIrisIn/uIrisOut`. Hair colour: the strands' painted light and dark stay, the hue is hers.
- `A.ownSkin(look)`: a skin material that takes none of the player's look (the foot cam's hands).

## 10-04 (batch 22): cuts of the suit, more cloth, elf ears, geta
- `shape-ear-elf` (`s3_finish.py` FACE_SHAPES): MakeHuman's ear targets (pointed x 2.2, taller, standing out, turned
  back) with no face mask (they move the ears only). Species use a share of it.
- Cloth (`s2_outfit.py` `build_skirt(name, hem_z, flare, folds, fold_amp, zh, windows, extra, mat, trim)`):
  `Anne_SkirtTube` (hem 0.735, straight), `Anne_SkirtPencil` (0.56, narrowing), `Anne_SkirtMaxi` (0.115: a gown; it
  follows thighs and shins), `Anne_Tutu` (0.845, leaves her 5 cm under the waist and stands out), `Anne_Panels` (front
  and back strips: `windows=[(0, 19), (180, 21)]` degrees), `Anne_Apron` (a front window, 6 mm outside the short skirt,
  its own material), `Anne_Cape` (`build_cape`: rings of the convex outline of shoulders and upper arms from the neck
  to the waist, open in front, 4 cm off her back so long hair lies under it). Materials: Anne_Skirt (all skirts, tutu,
  panels), Anne_Apron, Anne_Cape, Anne_Belt, Anne_Buckle; every `...Trim` is Anne_Trim.
- Geta (`s2_sandals.py`): `dict(id="geta", geta=True, straps=[("thong", 0.50, 0.0125)])`, `GETA` = board 11 mm, teeth
  34 mm tall and 16 mm deep at 0.26 and 0.63 of the foot. `thick()` has no taper at the tip for it, `bend_row` is the
  foot's own row (wood does not bend). lift 44.6 mm, no extra pitch. anne_next.js applies `lift` to any style that has
  one (it was heels only); `A.shoeHeel()` is true for a tall flat shoe too (the foot cam's low shots look over it).
- The suit's cut (anne_next.js): uniforms `cutN` (neck height, V slope, back height, strap |x|) and `cutM` (midriff
  from/to, leg line height and slope); `CUT_GLSL bareW(restPosition, edgeWidth)`. The suit discards where bare and
  darkens its edge; `Anne_SuitBare` (her skin's material on the suit's geometry) draws there, sunk 3.1 mm along the
  normal, with a constant painted colour (the mean of her thighs' vertex colours) and `aHem` (1 on the suit's rim and
  the two rings of faces next to it: not drawn there, her real skin is under those). The hem bead (`Anne_SuitTrim`) has
  a material of its own that discards in bare places and below `trimLow`.
  LESSON: a GLSL chunk prepended to three's shader must end with a newline (its first line is `#define STANDARD`).
- Skin shader: `uSleeve` (rgb, how far down the upper arm from SHOULDER to ELBOW), `uBandEnds` (the forearm band's ends),
  `uSock2`/`uSockS` (net: two diagonal families of lines round the leg's own axis from hip, knee and ankle; hoops of a
  second colour; sheer), `uGlow`. SHOULDER and the leg's three points are read off the skeleton's bind pose (`restOf`).
- Finishes: `setSkinFinish({ metal, rough })` on every skin material (also the bare-arm and bare-suit ones);
  `setSuitFinish({ metal })` on suit and skirt.

## 10-04 (batch 23): her body's width and length
`A.setBody(w, h)`, `A.body()` -> `{ w, h }`. h: `anne.scale` (uniform). w: for each body bone (`BODYK(name)`: 1 for root,
spine01-05, pelvis, breast, clavicle, shoulder01, upperarm01/02, upperleg01/02; 0.9 for lowerarm01 and lowerleg01; 0.5
lowerarm02; 0.35 lowerleg02; 0.5 neck01; 0.2 neck02/03; 0 for head, hands, feet and the face's bones) the inverse bind
matrix as built (`PRISTINE`) is premultiplied by `f*I + (1-f)*a*a^T` (f = 1 + (w-1)*k across the bone's line a, 1 along
it; a = towards the bone's child bones, in its own space). Joints, clips, markers and the sole model do not move.
`makeTwin` gives a twin fresh copies of the built matrices and scale 1 (a clone shares her array by reference).
What reads her size: captures.js `BK` (shin and thigh thickness for coils), `throwShoe` (loose shoes' scale), ties.js
`bodyK` (the ankle cord), wear.js `refit` (rigid accessories take their bone's inverse anew), looks.js (the panel's
camera height).
