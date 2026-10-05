# World modules: contracts, rules, budgets, testing

Read `ART_DIRECTION.md` first. This file is the technical contract.

The page (`index.html`, three@0.170.0 through an import map) builds the level from modules. Each module is one file with
one owner. **Edit only the file(s) you own.** `index.html`, `world/common.js`, `anne.js`, `level.json` and anything you do
not own are read-only for you. If you need something from a file you do not own, work around it inside your own file and
say so in your final report.

| file | export | owns |
|---|---|---|
| `world/common.js` | `createCommon(...)` | shared helpers (frozen) |
| `world/sky.js` | `buildSky(c) -> { sun, update(dt, t, focus) }` | sky dome, sun and fill lights, fog, shadows, environment map |
| `post.js` | `createPost({ THREE, renderer, scene, camera, qp }) -> api` | drawing a frame: resolution, tone mapping, post effects |
| `world/terrain.js` | `buildTerrain(c) -> { update(dt, t) }` | ground, grass, flowers, ferns, ground litter |
| `world/foliage.js` | `buildFoliage(c) -> { update(dt, t) }` | trees, bushes, vines, the forest around the clearing |
| `world/props.js` | `buildProps(c) -> { update(dt, t) }` | cliff, waterfall, stream, pond, campfire, pumpkins, scarecrow, butterflies |
| `logscene.js` | `createLogScene(ctx)` | the hollow log, the Kuns, feathers, the cut-scene (see `LOGSCENE_SPEC.md`) |

Build order: sky, terrain, foliage, props, then `c.flushInst()`, then Anne, then the log scene.
`update(dt, t)` is called once per frame (`dt` seconds since last frame, `t` seconds since start).

## `c`: the common object (`world/common.js`)

```
c.THREE, c.scene, c.renderer, c.level, c.qp (URLSearchParams)
c.S = 1.6            metres per tile          c.M = 9   tiles of forest margin built around the map
c.W = 20, c.H = 16   map size in tiles        c.CLIFF_H = 4.0   height of the waterfall plateau
c.tileAt(x, y)       'g' grass, 'd' dirt path, '#' forest, '|' big trunk wall, '~' water, 'W' waterfall, 'r' rock ('#' outside the map)
c.walkAt(x, y)       true where the player can walk
c.tallAt(x, y)       true where the map has tall grass
c.tc(x, y)           THREE.Vector3: world centre of tile (x, y) on the ground. world x = (tileX + 0.5) * 1.6, world z = (tileY + 0.5) * 1.6
c.inCliff(x, y)      true on the plateau (tiles x < 4 and y < 5, and beyond the map edge there)
c.heightAt(wx, wz)   ground height at a world position (0, or CLIFF_H on the plateau)
c.objAt['x,y']       what the 2D map has on a tile: 'conifer' | 'pumpkin' | 'flowers' | 'fern' | 'vine' | 'hedge'
c.level              the raw data: terrain[], walkable[], tallgrass[], objects{}, campfire, scarecrow, log, pumpkins_event, start
c.LOG_TILE = [14, 7] the hollow log stands on this tile (logscene.js builds it; leave the tile's ground clear)
c.rng(seed)          -> { rnd(), rr(a, b), tint(hex, v) }   deterministic random numbers; use your own seed
c.mtx(x, y, z, sx, sy, sz, ry, rx, rz)   -> Matrix4
c.canvasTex(w, h, draw(ctx2d, w, h), { repeat, srgb, anisotropy })   -> CanvasTexture
c.noise2(x, y), c.fbm2(x, y, octaves)    smooth value noise in [0, 1]
c.addInst(key, geo, mat, matrix, color, { shadow: true, receive: true, chunk: true })
                     collect an instance. Same key = same geometry + material. Instances are grouped into 12 m cells so
                     cells outside the view are skipped. shadow:false = does not cast a shadow.
```

North is -z, east is +x. The camera normally follows Anne from 3 to 6 m away, 1.5 to 4 m up; in the cut-scene it goes as
low as 0.5 m and as close as 1 m to the log.

## Rules that protect the gameplay

1. **Walkable ground is flat at y = 0.** Do not raise, lower or tilt it. Visual relief is allowed only on tiles that are
   not walkable, and must meet y = 0 where it touches a walkable tile.
2. **Nothing solid on walkable tiles** except ground cover up to 0.35 m tall (grass, flowers, pebbles, leaves).
   On dirt path tiles (`'d'`): nothing taller than 0.1 m.
3. **Within 2.6 m of the centre of `c.LOG_TILE`**: nothing taller than 0.2 m (the cut-scene camera sits low there).
4. **Edges:** things rooted on non-walkable tiles may reach over walkable tiles only above 2.6 m, or by at most 0.4 m below that.
   The middle of the clearing must stay open to the sky (it is a sunny clearing).
5. **Fixed places:** plateau = tiles x < 4, y < 5 (plus the margin beyond the map edge), its south face is at world z = 8.0;
   the waterfall falls down that face at world x = 4.0 (tile column 2); the pond lies at its foot (tiles x 0..4, y 5..8);
   campfire on `level.campfire`; scarecrow on `level.scarecrow`; pumpkins on `level.pumpkins_event`; paths leave the map
   north at tile column 6 and south at tile column 8 (keep those corridors open, 1 tile wide, through the margin).
6. **Lights:** only `world/sky.js` adds lights, except the campfire's own point light (in `world/props.js`, no shadow).
7. **Fog:** every material must respect scene fog (built-in three materials do; custom `ShaderMaterial`s need `fog: true` and the fog chunks).

## Budgets

Measured in the heaviest of the standard views with `tools/perf.sh` (WebKit, real GPU, full-screen laptop window).
"Cost" = your module's frame time on top of an empty world (`&only=none` is about 3.4 ms: sky + Anne).

| module | frame cost | triangles in view | draw calls | shader programs | texture memory |
|---|---|---|---|---|---|
| sky + post (all effects) | <= 2.5 ms | <= 6k | <= 6 + post passes | <= 10 | <= 40 MB incl. render targets |
| terrain | <= 1.8 ms | <= 90k | <= 24 | <= 6 | <= 24 MB |
| foliage | <= 2.5 ms | <= 150k | <= 60 | <= 8 | <= 16 MB |
| props | <= 1.2 ms | <= 60k | <= 45 | <= 12 | <= 12 MB |
| log scene (Kuns etc.) | <= 1.0 ms | <= 40k | <= 60 | <= 10 | <= 8 MB |
| shadows (all casters, owned by sky.js) | <= 2.0 ms | casters <= 120k | | | 2048 x 2048 map |

Whole frame target: **<= 11 ms**. Today's scenery: terrain 1.5 ms, foliage 4.4 ms, props 0.9 ms, shadows about 5 ms.

Texture memory = width x height x 4 bytes x 1.33. Count draw calls and triangles with `renderer.info` (the PERF line prints them).

## Looking at your work

A web server already serves this folder at `http://127.0.0.1:8123/` (if `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8123/index.html`
does not print 200, start one: `cd /Users/harrisontoppenryan/Documents/AmirianCamp3D && (python3 -m http.server 8123 --bind 127.0.0.1 >/dev/null 2>&1 &)`).

Screenshot (headless Chrome on the real GPU; about 4 s):

```
node tools/cdp_run.mjs "http://127.0.0.1:8123/index.html?auto&cam=13.6,2.6,19.5,13.6,1.2,14" gpu=1 dpr=1 w=1280 h=800 wait=READY delay=1500 shot=/abs/path/out.png
```

Then look at the PNG with the Read tool. The run prints every console message; **the console must be clean** (no errors or
warnings from your module). Put screenshots in your own scratch folder under `/private/tmp/claude-501/...scratchpad/<yourname>/`
(create it), never in the project folder.

URL flags:

- `auto` skips the start screen. `cam=px,py,pz,lx,ly,lz` pins the camera at p looking at l.
- `only=terrain,props` loads just those world modules (sky always loads). `only=none` = empty world.
- `perf=1&secs=6` prints a `PERF {...}` line (draw calls, triangles, shader programs, textures) then `PERF done`.
- `ls=<state>` plays the cut-scene to a state and prints `HOLD reached` (states: intro choice blush stuck grab laugh tickle minigame escape fail complete end).
- `noshadow=1`, `noaa=1`, `dpr=1.5`, `pixels=2600000`, `noadapt=1`, `nowarm=1` for experiments.

Standard views (use all of them before you call your work done):

| name | cam= |
|---|---|
| start | `13.6,2.6,19.5,13.6,1.2,14` |
| fire | `19.5,1.8,13.5,16.8,0.6,10.4` |
| pond | `10.5,2.2,13.5,4.5,1.5,9` |
| log | `20.0,1.6,15.5,23.2,0.5,12.0` |
| trunks | `18,1.7,12.5,19,2.5,5` |
| overview | `16,16,22,15,0,11` |
| ground | `14.5,0.5,13,16,0.2,11.5` |
| edge | `12,1.6,10,6,1.2,6` |

Performance (WebKit = Safari's engine, which is what the player uses):

```
tools/perf.sh ""                 # whole scene, start view
tools/perf.sh "&only=terrain"    # one module on its own (compare with "&only=none")
tools/perf.sh "&ls=tickle"       # the cut-scene
tools/perf.sh "&cam=10.5,2.2,13.5,4.5,1.5,9"   # another view
```

It prints `frame X ms avg, Y ms worst | ... draw calls, triangles, shaders, textures`. Other agents are working on this
machine at the same time, so timings are noisy: run it three times and take the lowest; triangle, draw-call and shader
counts are exact. Also check Safari's engine draws your work correctly at least once:

```
node tools/webkit/run.mjs "http://127.0.0.1:8123/index.html?auto&cam=13.6,2.6,19.5,13.6,1.2,14" wait=READY delay=1500 shot=/abs/path/out.png
```

Syntax check before every screenshot: `cp world/yourfile.js /tmp/chk_yourname.mjs && node --check /tmp/chk_yourname.mjs`.

## Working alongside other agents

Several agents are rebuilding different modules in this same folder right now. You will see their half-finished work in
your screenshots; that is expected. If the page shows an error that comes from someone else's file, use `only=` to leave
their module out and carry on. Never edit, revert or "fix" a file you do not own. The machine has 8 GB of memory and is
busy: run one headless browser at a time and do not leave any running.

## Definition of done

- All eight standard views look like the art direction, with no facets, no holes, no z-fighting, no flicker.
- The gameplay rules above hold (check the ground and log views especially).
- Budgets met (state your measured numbers).
- Console clean in Chrome and WebKit.
- Your final report lists: what you built, measured numbers, anything you could not do, and anything that the integrator
  must know (for example a new URL flag or an assumption about another module).

## Status (2026-10-01)

All four world modules, `post.js` and the thin `index.html` shell shipped as specified. `VER` in `index.html` is 14
(bump it whenever a module or asset changes). Anne is loaded by `anne_next.js` unless the address has `?anne=old`.
Frame cost in WebKit at the pixel budget, with everything on: 8.5 ms average at the start view.

### Measured in the real Safari app (2026-10-01)

Recipe (no browser automation needed; the page reports on itself):

    node tools/serve.mjs 8124 /tmp/reports.jsonl &
    open -g -a Safari "http://127.0.0.1:8124/index.html?auto&ls=end&rt=1&perf=1&report=<tag>"     # whole cut-scene, real time
    open -g -a Safari "http://127.0.0.1:8124/index.html?auto&perf=1&secs=60&walk=100000&report=<tag>"   # a minute of walking

Each report line has the frame-time histogram and the long frames as `[time ms, length ms, where, shaders, script
update ms, script render ms]`. A reporting tab replaces itself with a blank page afterwards.

Rules learnt the hard way:

- Check `sysctl -n kern.memorystatus_vm_pressure_level` first (1 = normal, 2 = warning). At 2 everything stutters and the
  numbers mean nothing. This Mac has 8 GB and often sits at 2.
- Every `open` makes a new tab and a game tab holds about 350 MB. Left open they push the Mac into memory pressure and
  spoil the next measurement. AppleScript control of Safari is not permitted (the call hangs). To free them, find the
  page processes by start time (`ps -axo pid,lstart,rss,command | grep WebKit.WebContent`) and end exactly those.
- The script's own share of a long frame was 2 to 4 ms every time: the pauses are the browser's or the system's.

Results with memory pressure normal: 60 fps (average 16.7 to 17.2 ms, 99th percentile 19 to 22 ms). One pause of about
60 ms comes roughly six seconds after the page has loaded, whatever is on screen (also when standing still). Beyond
that, none to two isolated pauses of 40 to 65 ms in a 30 second cut-scene, at no particular line. Walking across the
map does not add any. Not caused by: post effects, shadows, anti-aliasing, the dialogue portraits (those are now drawn
from pre-decoded bitmaps anyway). The scene holds 24 MB of vertex data and 16 MB of textures (`?mem=1` prints it).

### Close-ups (2026-10-01)

`post.setCloseUp('off' | 'ready' | 'on')` and `post.setFocus(point, strength)` exist for the cut-scene's close-up.

- While a close-up is `'on'` the final pass sharpens what is in focus (`?sharp=0..1`, default 0.7): each pixel is pushed
  away from the average of its four neighbours but never beyond their range, so edges and detail get crisper with no halos.
- Depth of field uses 48 taps (24 left dotted rings round a blurred edge against a dark background).
- **Drawing the close-up at the screen's own resolution was tried and is off.** The code is there (`?hipixels=4.3e6`,
  optionally `&hisamples=2`): a second set of render targets built while the screen is black, used only by the close-up
  shots, with a fall-back if they run slow. Measured on the M3 MacBook Air in Chrome, full-screen (1470 x 956 at 2x), the
  `soles` shot: 2.6 million pixels (the budget) 60 fps; 3.2 million with 4x MSAA 52 fps; 3.2 million with 2x MSAA 60 fps;
  4.3 million (the panel's own resolution) 47 fps with 4x MSAA, 53 with 2x, 56 with none. The cost is the anti-aliased
  pixels themselves, not the scenery (hiding the whole world saved 2 ms of 27). So the close-up stays at the budget.
- New test flags: `&holdperf=N` (with `ls=<state>&rt=1&perf=1`: time only the N seconds after the state is reached),
  `window.__postInfo()`, `?mem=1` (bytes of vertex data and textures in the scene).

## The Forest Pond (second area, added 10-01)

The camp's north path (tile 6,0) leads to the Forest Pond, as in the 2D game (Map004 event "TestArea" -> Map002 at 18,37).

- `level_pond.json` is generated from the game's Map002 by `python3 tools/make_level.py` (terrain letters, passability from the tileset flags and a flood fill from the entrance, objects by tile id). `?level=pond` loads it; `level.json` is the camp (`name: 'camp'`).
- Changing area reloads the page: `level.exits` = `[{ tiles, to, spawn, face }]`; `index.html` fades and sets `?level=&at=x,y&face=`. `&noexit` stops the reload (tests). `?at=x,y` places her on any tile.
- The world modules read a few level fields instead of constants: `plateau: false` (no waterfall plateau, `inCliff` is false everywhere), `log` (absent: no log), `pathsOut` (`[[x, 'north'|'south']]`), `margin` (forest ring in tiles; 6 for the pond, 9 for the camp), `scarecrow`, `tent`, `waterfall`. In the pond level foliage.js keeps every non-forest tile clear and plants the map's own trees (`tree`, `willow`, `sapling`, `bush`, smaller `conifer`).
- `world/pond.js` (pond level only): the water sheet, lily pads, boulders and rock banks on `r` tiles (taller along the north), the waterfall and its foam, the tent, stumps, barrel, totem. props.js skips the camp's plateau, pumpkins and scarecrow there but keeps the campfire (at `level.campfire`) and butterflies.
- Simplifications: one ground height (the 2D map's ledges are rock banks, the upper ledge behind the ivy ladder is not reachable), no characters or events in the pond, the log scene and the mimic shoes exist only in the camp.
- Measured: 60 fps in Chrome; 10.9 ms per frame in WebKit from the island (budget 11), about 710k triangles.

## The follow camera (rewritten 10-01, `camera.js`)

The player owns the camera: Q / E or drag turn it, the wheel zooms. It never turns by itself (an earlier "swing to a free bearing" assist changed what W meant under a held key and was removed).

- `createFollowCam({ THREE, C, level, walkAt })` -> `place(pivot, yaw, pitch, dist, out)` returns the boom length and leaves the camera point in `out`. The boom is walked outwards from her head in 15 cm steps; each step is pushed 0.6 m clear of solid tiles and tested against `C.camBlockers`.
- Solid tiles: camp = everything she cannot walk on except open water (the camera may hang over the little pond); pond = forest and beyond the map at any height, rock banks below their top (2.3 m, 4.4 m along the north face).
- `C.camBlockers` (filled by `world/foliage.js` and `world/pond.js`): tree crowns (ellipsoids), conifers (cones), trunks, the tent. Foliage in the way: the pitch drops until the boom fits under the canopy. A trunk in the way: the camera looks from up to 0.4 rad to one side (the player's yaw is not touched). A wall: a shorter boom.
- Boom shorter than about 2 m (her back to the forest, the narrow north path): the view blends to first person. The camera goes to her eyes and looks out level along the same bearing, and `anne.visible` goes false, so the player can always look round. Cut-scenes set her visible again.
- Why the pond camera looked broken before: the exit passed her arrival direction as `?face=south`, which is also the old face-test flag (`?face=<expression>` pins the camera on her face). The parameter is now `?dir=`, and test flags are stripped from the URL when she changes area.
- Tests: `tools/webkit/play.mjs` plays the page in WebKit with real key, mouse and wheel events, step by step (`wait:`, `down:`, `up:`, `drag:`, `wheel:`, `shot:`, `eval:`), and follows the tab across the area reload. `tools/camtour.sh "<query>" <prefix>` turns the camera through eight bearings at one spot and saves a contact sheet. Hooks: `window.__setCam(yaw, pitch, dist)`, `window.__cam()`.

## Movement (10-01)

- Speeds: plain = 2.4 m/s (an easy jog), Shift = 4.4 m/s (run), Alt = 1.5 m/s (walk). She accelerates at 10 m/s2 and stops at 16 m/s2 (`vel`, `dirX`, `dirZ` in `index.html`).
- The music's on/off state and position carry over the area reload (sessionStorage) and resume with the first key or click.

## The North Forest (third area, added 10-01, evening)
- `level_forest.json` from `tools/make_level_forest.py` (the 2D game's Map003, 60 x 60 tiles), opened with `?level=forest`. The camp's south exit (tile 8,15) leads to it; its exit at (56,37..38) leads back.
- The 2D map loops (`scrollType 3`): `level.wraps` lists the edge tiles where a trail runs on; walking off one brings her in at the opposite edge under a short fade (`tryWrap` / `updWrap` in `index.html`). The lower and the upper half of the forest are only connected this way.
- `level.events` keeps the 2D map's 144 events (id, name, tile, sprite) for reference; what the 3D story places is in `story_forest.js`.
- Cost. The forest is nine times the camp's area, so three things changed in the world modules: shadow-casting foliage is batched in 32 m regions instead of one mesh per material (`world/foliage.js`, `SHADOW_REGION`); grass clumps shrink into the turf between 32 and 42 m from the camera and grass chunks beyond 42 m are not drawn (`world/terrain.js`, `GRASS_FAR`; `C.camera` is now passed to `createCommon`); nothing else was thinned. Measured in WebKit on a quiet machine: the lane where Alraune appears 8.3 ms, the longest view down the arrival trail 12.0 ms (1.58 M triangles; budget 11). Later the same evening every view, the camp included, measured about 30 % slower with another app using the machine (`coreaudiod` 20 %, load 2.3 to 4.3): re-measure on a quiet machine before believing either number.
- Story shots must not sit in a tree: `camera.js` gained `free(p, pad)` and `sight(a, b, pad, stop)`; `story.js` `shotGoal` tries the wanted bearing first, then the nearest bearing, height and distance from which every subject (`see`) is visible, and also keeps clear of the story's own things (`S.avoid`).

## 10-03: the camera follows her round by itself
He asked not to have to turn the camera all the time. While she walks (vel > 0.3) the follow camera's bearing eases
towards behind her (`camYaw -> heading + PI`, rate 1.7/s, scaled by her speed up to a jog); for 2.5 s after the player
turns it by hand (Q / E, drag, wheel: `camManual`) or a scene ends, it stays where it is. The walking keys' frame is
latched while the same keys stay down (`moveYaw`): otherwise, with the camera turning, holding A would walk her in a
circle and S would chase its own tail. `?nofollow` turns it off (and tests that place the camera: `?yaw`, `?look`,
`?cam`). The foot cam (F) hands back with the camera behind her.

## The foot cam's side bar, and the ground under her feet (10-03, batch 17)
- With the foot cam on (F) and no scene playing, a side bar "Her soles" offers Fingers, Feather, Tongue, Fuzzy brush
  (footplay.js). Pick one and click a foot: she lifts it into the sole flash and holds it; the tool follows the mouse over
  the sole and she laughs; left alone for 3 s she puts the foot down; walking off ends it. The camera goes to the sole
  (`footPlay.camGoal()` in `footCamera`); the mouse does not turn the camera while a tool is picked (`wantsPointer`);
  the bored idles wait (`busy`). After about 25 s of play she changes into another pair of shoes (`newShoes`).
- `A.setGround(fn)`: what the ground is under a point, for her feet (anne_next.js `groundFeet`): `DECK_H` on a bridge
  tile, the pond's bed where she wades (-0.35 at most), 0 elsewhere. Tests: `__dbg.A.groundStats()` gives the deepest
  correction so far and how many, `__footCam(n)` sets the foot cam, `__dbg.footPlay.state()` its play state.

### The foot cam's tools, second version (10-03, batch 18)
Side bar: Fingers (with "Teasing" / "Tickling" and "Her nails": 12 colours), Feather, Tongue (a click on the sole licks it
from the ball of the foot up to the heel), Fuzzy brush, and "Tie her up" / "Untie her" (she lies on her front, ankles and
big toes tied, both soles to the picture; every tool works there). The feather teases, raking nails and the tongue make
her giggle, scribbling nails and the brush make her laugh; her leg shakes (`A.setLegShake`). Tied, she cannot walk
(`footPlay.tied()`); the grass is pressed further back (`footFlat` at her feet, 1.8 m).

### The foot cam's tools, third version: they play by themselves (10-03, batches 19 and 20)
Pick a tool in the side bar and it plays by itself; "Stop" (or the same button again, or walking off, or F) ends it. No
steering with the mouse (only the brush clean-up after a capture is still a mouse game). Standing she lifts a foot by
herself and holds it for a take of eight bars (20 s), then the other foot, now and then in another pair of shoes; tied,
the tools take her soles in turn (the fingers: a hand on each sole at once). footplay.js directs the picture as well:
`footPlay.camGoal()` returns `{ p, l, fov, direct }` and with `direct` index.html `footCamera` takes it as it is every
frame (hard cuts on its bar lines, its own slow push inside a shot; `fcDirect`); out of it, a cut back to the foot cam's
own view. While it directs, the grass is pressed 1.9 m round her (2.2 m tied). Its motion rules are the Motion Reel
Kit's (`lib/motion.js`, loaded by footplay.js): see BATCH7_PLAN.md, batch 20.


## The player's own Anne (10-04, batch 21)
`looks.js`: name, heritage, skin, face, eyes, hair, outfit, feet, in one panel (`#cc`). A new game goes through it once;
the title screen offers it ("Customize <name>", "Shoes and toenails"); L opens it during play. Kept in
`localStorage['amirian3d.look.v1']`. Tests: `?lk=<URI-encoded JSON>` lays a look over the kept one (a heritage alone
fills in its colours and face); `__looks.set({...})`, `__looks.heritage(id)`, `__looks.open(null, tab)`,
`__looks.show(tab)`, `__looks.state()`.
The foot cam shows her face in a corner inset for as long as a tool plays or she is tied (no full-screen face shots).
Her name is in every line (`story.js` `tx()`), her portrait in a line is a picture of her as she is (`looks.portrait`).
Content line, unchanged: she is an adult and always dressed; an outfit changes what she wears, never whether.

## Species, fifty outfits, Lilith's portal (10-04, batch 22)
- looks.js: tabs Name, Heritage, Species, Skin, Face, Eyes, Hair, Outfit, Feet. `wear.js` hangs what a species or an
  outfit adds (`looks.update(dt, t)` each frame from index.html: wings, tails, the halo move). Tests: `?lk={"species":
  "demon","outfit":"villain"}` (a species alone fills in its suggested colours), `__looks.lists.OUTFITS`,
  `__looks.wear.names`.
- The foot cam: Fingers and Tongue are Lilith's and come through a portal in the ground (footplay.js `summon`); the first
  use ever she explains it. `localStorage['amirian3d.lilithCalled']` = '1' afterwards (remove it to see the long intro).
- The thirteenth shoe, "Wooden geta", is in the Feet tab's list like the others.

## Body, legwear, the portal in the air (10-04, batch 23)
- looks.js: a Body tab (Width, Length; `L.body = { w, h }`), and on the Outfit tab "Her legwear" (`L.legwear === false`:
  bare legs on an outfit that has stockings, tights, trousers or greaves). Tests: `?lk={"body":{"w":1.12,"h":1.06},
  "legwear":false}`.
- The foot cam tied: Lilith's portal opens in the air above her soles (footplay.js `PORT.air`); standing it is in the
  ground as before.

## Mixed heritage pairings, Lilith's arms in the foot cam (10-04, batch 24)
- looks.js: with Heritage "Mixed" picked two rows appear, "Half" and "And half", over the seven heritages (21 pairings;
  the same one twice is that heritage). `L.mix = [a, b]`; `mixLook(a, b)`, `mixName(mix)`; test: `?lk={"heritage":"mixed",
  "mix":["black","asian"]}`. A new heritage only needs its entry in `HERITAGE` and its id in `BASES`.
- The foot cam: Lilith's arm is built from the portal to her hand. `poseHand` still puts the hand and its nails on her
  skin; `swingArm` then turns the forearm about its wrist towards the portal (the hand does not move), the portal opens
  where such an arm comes from (in the ground 0.36 m out from her wrist; in the air straight above the middle of her soles,
  the two arms side by side), and she enters hand first through the portal (`comeThrough`). Elbows bend 30 to 80 degrees
  (they bent 107 to 129). Tests: `__dbg.footPlay._arms()`, `._intro(s)`, `&pout= &pup= &swr= &swa=`.
- A hand's forearm now leaves LOW from a hand on a standing foot's sole (her arm comes from the ground): a new shot
  that looks along the ground on the sole's outer side will have her forearm in it.

## Bushes and the story's camera; four more areas (10-05, batch 25)
- world/foliage.js records every bush it plants in `c.bushes` ({ x, y, z, r, h }: the dome). story.js keeps every shot it
  cuts to out of them (0.28 m round the dome) and off the first 2.5 m of its line of sight: a placed shot tries another
  bearing, a shot given by hand is moved the least way that clears it and still sees what it looks at (`clearOfBush`;
  logged as "CAMFIX from > to", kept in `window.__camFix`; `&bushfix=0` off).
- **Chapter 2's maps** (`python3 tools/make_level_ch2.py` writes all four):
  - `post` 22x20, a glade level with `campfire` and `tent`: the pond north-west, the path north to south, the stall and
    chair east, the cabin and the stone pool west. Nothing stands on the open ground south of the fire (the dream's dome
    is put there: 4.6 m).
  - `lys` 28x38, carved by rule, not drawn: the road's waypoints with 1.5 tiles of grass either side, six glades, a
    stream two tiles wide (rows 11-12), a river two tiles wide (columns 16-17), '=' bridge tiles where the road crosses.
  - `valyndra` 26x16 and `barracks` 11x9: SETS (`interior: true`: only the sky is built; '1' = floor). The story builds
    them: the city wall (8.2 m, the gate's arch, two towers, banners, the guard house doorway at tile 18,13), house
    fronts from one `house(x0, x1, zFront, depth, height, { face })`, a well, stalls, a cart across the street north;
    the dungeon's room, torches, cells, the stocks. A set's tiles that are not floor are solid for the camera
    (camera.js), so furniture is blocked with `S.block`, not with tiles.
- level_road.json has a second exit (its east end, to `post`): written by tools/make_level_epilogue.py.

