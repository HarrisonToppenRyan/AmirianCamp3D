# Art direction: Forest Camp 3D

The player asked for the game to stop looking "blocky" and for the heroine to look like a character from an animated
feature film. Everything in the game should look like it belongs in the same film.

## The look

Stylised animated-feature look (think of a modern CG family film), not realism and not low-poly:

- **Soft, rounded forms.** No visible facets anywhere: smooth normals, enough segments on every silhouette the camera can
  get close to, bevelled or rounded edges. `flatShading` is banned.
- **Simple, clean surfaces.** Broad colour gradients and a few large painted details. No photographic noise, no fine
  speckle, no tiling that the eye can pick out.
- **Big, medium, small.** Every object has one clear big shape, a few medium shapes and sparing small detail.
- **Warm sun, cool shade.** A warm key light, a cooler sky fill, soft shadows that are never black, a gentle glow on
  bright things. Colours are saturated but harmonious.
- **Appeal over accuracy.** Slightly exaggerated proportions: chunky tree trunks, plump bushes, big friendly shapes.

Reference frames (the player supplied these as the target style; study them before you start):

- `/Users/harrisontoppenryan/Documents/Elektratouch/lighting_preview1.png` (park scene: lighting, foliage, grass, materials)
- `/Users/harrisontoppenryan/Documents/Elektratouch/Screenshot 2026-09-29 at 9.04.26 PM.png` (character: skin, face, hair, feet)
- `/Users/harrisontoppenryan/Documents/Elektratouch/Screenshot 2026-09-29 at 9.04.38 PM.png` (character, side view)

What the place is in the original 2D game: `refs/forestcamp_map_2d.png` (a sunny forest clearing with dirt paths, a campfire,
a waterfall and pond in the north-west, a wall of huge tree trunks along the north, dense forest all around).

## Palette

| thing | colours |
|---|---|
| grass | `#7dbb3c` sunlit, `#4f8f2c` mid, `#356b25` shade |
| foliage | `#8cc63f` highlights, `#4c9a2f` mid, `#27602a` deep shade |
| dirt path | `#c79a62` sunlit, `#a57745` mid |
| tree bark | `#7a553a` light, `#5a3b29` dark |
| rock | `#9a9388` light, `#6f6a62` dark, moss `#6a9a3a` |
| water | `#49b6b3` shallow, `#1f7f8f` deep, foam white |
| sky | `#8fd0f2` zenith to `#d9f0f5` horizon, warm sun glow |
| Anne | suit `#f2a516` (gold yellow), accessories `#5a2d91` (purple), hair `#e2702a` (ginger), eyes blue |
| Kuns | body `#7ecb3a` (green one) and `#f0c531` (yellow one), eyes orange / sky blue |

## Scale and space

1 unit = 1 metre. A map tile is 1.6 m. Anne is about 1.7 m tall. The clearing is roughly 25 m x 12 m.
The sun is in the north-east, about 50 degrees above the horizon (`world/sky.js` owns the light).

## Hard performance rules (the game must run at 60 frames per second in Safari on an 8 GB M3 MacBook Air)

The whole frame has **11 ms**. Measured today in WebKit: the old scenery took 8.5 ms of that, of which shadows were 5 ms.
So the new art has to be cheaper than the old art while looking far better. That is possible because the old art wasted
its budget on overdraw and heavy shaders. Rules:

1. **Cheap shaders on big things.** Ground, foliage and rocks use `MeshLambertMaterial` (or a small custom shader), not
   `MeshStandardMaterial`/`MeshPhysicalMaterial`. Standard/Physical materials are for small hero objects only.
2. **Little overdraw.** Do not stack many layers of large overlapping surfaces. Far forest = a few big shapes, not hundreds
   of trees behind each other.
3. **Few shadow casters.** Only objects that visibly shadow the playable area cast shadows. Ground cover never casts.
4. **Triangle and draw-call budgets** are in `WORLD_SPEC.md`. Use instancing (`c.addInst`) for anything repeated.
5. **Everything is built at load.** No new geometry, materials or textures after the build function returns (the page
   pre-draws the whole scene once behind the start screen so nothing stutters later).
6. **No per-frame garbage.** `update()` must not allocate.
7. **No files, no network.** Textures are drawn on canvases at load, deterministic (use `c.rng(seed)`).
