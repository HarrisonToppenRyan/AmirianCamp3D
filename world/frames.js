// world/frames.js (10-12): "level frames", for a level with raised ground (ledges that are climbed to by a vine:
// level.levels, world/common.js). In every other level this module does nothing at all.
//
// The scripted layer (the story, the captures, the cameras) writes ground = 0 everywhere, in hundreds of places. So
// when Anne stands on a ledge it is the WORLD that is drawn lower, not Anne that is higher:
//   G0  'frame:ground'  everything that belongs to the low ground: the world as built (terrain, forest, the ledges'
//                       own rock) and whatever the story stands on low tiles. Its y is 0 while she is on the low
//                       ground and -H while she is on a ledge.
//   G1  'frame:ledge'   what the story stands on top of a ledge, written with y = 0 like everything else. Its y is +H
//                       while she is on the low ground and 0 while she is on a ledge.
//   the scene's root    Anne, the lights and the sky, her familiar, and every piece of kit that a scene writes world
//                       coordinates into (vines, ties, tools, loose shoes, bubbles ...): always in her frame.
// A group with y = 0 gives its children the same world matrices as the scene would: for everything on the level she
// stands on, a thing's own position IS its world position, as the scripted layer takes it to be.
//
//   createFrames({ THREE, scene, C }) -> {
//     on            a level with ledges
//     G             [G0, G1] (null without ledges)
//     takeWorld()   call once, right after the world modules have built: all they made goes into G0 (not the sky)
//     mark() / settleNew(mark)   the story's dressing: every thing an area script stood somewhere in the map between
//                   the two calls goes into the group of the ground it stands on (kit left at the origin stays)
//     settle(obj, lv)  one thing, by the tile it stands on (or to level lv), its coordinates as written
//     carry(obj, lv)   a thing that has MOVED to the other level (a figure that climbed): its place in the world kept
//     free(obj)        a thing back into her frame (the scene's root), its place in the world kept
//     set(lv)       she is on level lv now: returns the y that she and the cameras must be shifted by (0: no change)
//     level(), levelOf(obj) }
export function createFrames({ THREE, scene, C }) {
  const H = C.LEDGE_H, on = H > 0;
  if (!on) {
    const same = (o) => o;
    return { on, G: null, H: 0, takeWorld() {}, mark: () => null, settleNew: () => [], settle: same, carry: same, free: same, set: () => 0, level: () => 0, levelOf: () => 0, report: () => null };
  }
  const G = [new THREE.Group(), new THREE.Group()];
  G[0].name = 'frame:ground'; G[1].name = 'frame:ledge'; G[1].position.y = H;
  scene.add(G[0], G[1]);
  const tileLv = (x, z) => C.levelAt(Math.floor(x / C.S), Math.floor(z / C.S));
  // (a thing in one of the groups is still "in the scene": scene.remove takes it out of its group)
  const baseRemove = THREE.Object3D.prototype.remove;
  scene.remove = function (...list) {
    for (const o of list) { const p = o && o.parent; if (p === scene) baseRemove.call(scene, o); else if (p === G[0] || p === G[1]) p.remove(o); }
    return scene;
  };
  // what stays in her frame whatever it is: the sun and the sky's other lights with their targets, the dome
  const skyKind = (o) => o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight || o.name === 'sky';
  function takeWorld() {
    const targets = new Set(scene.children.filter((o) => o.isDirectionalLight).map((o) => o.target));
    for (const o of scene.children.slice()) if (o !== G[0] && o !== G[1] && !skyKind(o) && !targets.has(o)) G[0].add(o);
  }
  const inMap = (p) => p.x > 0 && p.z > 0 && p.x < C.W * C.S && p.z < C.H * C.S;
  const mark = () => new Set(scene.children);
  // the story's dressing: what an area script added to the scene and stood somewhere in the map. Kit (hidden meshes that a
  // scene writes world coordinates into) is made at the origin and stays in her frame; so does what is tagged
  // userData.frame = 'anne' (her familiar).
  function settleNew(before) {
    const moved = [];
    for (const o of scene.children.slice()) {
      if (before.has(o) || o === G[0] || o === G[1] || skyKind(o) || o.isLight || o.userData.frame === 'anne') continue;
      if (!inMap(o.position) || (Math.abs(o.position.x) < 1e-6 && Math.abs(o.position.z) < 1e-6)) continue;
      settle(o); moved.push(o);
    }
    return moved;
  }
  function settle(obj, lv) {
    if (!obj) return obj;
    const L = lv === undefined ? tileLv(obj.position.x, obj.position.z) : (lv ? 1 : 0);
    if (obj.parent !== G[L]) G[L].add(obj);
    obj.userData.settled = true;
    return obj;
  }
  function carry(obj, lv) { if (obj && obj.parent !== G[lv ? 1 : 0]) { scene.updateMatrixWorld(true); G[lv ? 1 : 0].attach(obj); } return obj; }
  function free(obj) { if (obj && obj.parent !== scene) { scene.updateMatrixWorld(true); scene.attach(obj); } return obj; }
  function set(lv) {
    lv = lv ? 1 : 0; const was = C.frame(); if (lv === was) return 0;
    C.setFrame(lv); G[0].position.y = -lv * H; G[1].position.y = (1 - lv) * H;
    scene.updateMatrixWorld(true);
    return (was - lv) * H;
  }
  const levelOf = (obj) => (obj && obj.parent === G[1] ? 1 : obj && obj.parent === G[0] ? 0 : C.frame());
  // (tests) what is where: the story's things in each group, and what is left at the root away from the origin
  function report() {
    const row = (o) => `${o.name || o.type}${o.visible ? '' : ' (hidden)'} @ ${(o.position.x / C.S).toFixed(1)},${o.position.y.toFixed(2)},${(o.position.z / C.S).toFixed(1)}`;
    return { level: C.frame(), ground: G[0].children.length, ledge: G[1].children.map(row),
      story: G[0].children.filter((o) => o.userData.settled).map(row),
      root: scene.children.filter((o) => o !== G[0] && o !== G[1] && (Math.abs(o.position.x) > 1e-6 || Math.abs(o.position.z) > 1e-6)).map(row) };
  }
  return { on, G, H, takeWorld, mark, settleNew, settle, carry, free, set, level: () => C.frame(), levelOf, report };
}
