// camera.js: where the follow camera may be. index.html owns the player's yaw, pitch and distance; this module
// answers "how far along that boom can the camera go, and where exactly does it sit", so that it never ends up in
// the forest wall, inside a tree's crown, in a rock bank or under the waterfall plateau.
//
//   solid tiles   camp: every tile Anne cannot walk on (the forest and its edge bushes, the waterfall plateau), at any
//                       height, except open water: the camera may hang over the little pond
//                 pond: the forest ('#', '|') and everything beyond the map at any height; rock banks ('r') below their top
//   blockers      C.camBlockers, filled by world/foliage.js and world/pond.js in the pond level: tree crowns
//                 ({ x, y, z, r, ry } ellipsoids) and conifers ({ cone: true, x, z, y0, h, r })
//
// The boom is walked outwards from her head in small steps. Each step is first pushed RHO clear of the solid tiles
// (so in a corridor the camera slides along the middle instead of stopping at the wall); the walk ends at the first
// step that cannot be freed or lies inside a blocker.

export function createFollowCam({ THREE, C, level, walkAt }) {
  const { S } = C, POND = !!level.glade, NORTH_FACE = level.name === 'pond' ? 6 : -1;      // glade levels (pond, forest): see `top`
  const RHO = 0.6;                 // clearance from solid tiles (edge foliage overhangs the open ground)
  const TREE = 0.3;                // clearance from crowns and conifers
  const STEP = 0.15, MIN_LEN = 1.3;
  const blockers = C.camBlockers || [];

  // the height below which a tile is solid for the camera (Infinity: at any height)
  const top = POND
    ? (tx, tz) => (!C.inMap(tx, tz) || '#|'.includes(C.tileAt(tx, tz)) ? Infinity : C.tileAt(tx, tz) === 'r' ? (tz <= NORTH_FACE ? 4.4 : 2.3) : -Infinity)
    : (tx, tz) => (walkAt(tx, tz) || (C.inMap(tx, tz) && '~W'.includes(C.tileAt(tx, tz)) && !C.inCliff(tx, tz)) ? -Infinity : Infinity);
  // (10-12) raised ground (a ledge, world/ledges.js) is solid up to its top, and what stands on it that much higher. The
  // camera's own y is told in Anne's frame (world/frames.js: on a ledge the world is drawn lower); the tiles, the crowns
  // and the trunks are kept in the heights they were built at, so the frame's height is added before anything is compared.
  const fH = C.frameH || (() => 0), tileH = C.LEDGE_H ? (tx, tz) => C.levelAt(tx, tz) * C.LEDGE_H : () => 0;
  const solid = (tx, tz, y) => { const h = tileH(tx, tz), t = top(tx, tz); return y + fH() < (h > 0 ? Math.max(t + h, h) : t); };

  // push (x, z) RHO clear of the solid tiles around it; false when it lies in one (or cannot be freed)
  const q = new THREE.Vector3();
  function pushOut(p) {
    let tx = Math.floor(p.x / S), tz = Math.floor(p.z / S);
    if (solid(tx, tz, p.y)) return false;
    for (let pass = 0; pass < 2; pass++) {
      for (let nz = tz - 1; nz <= tz + 1; nz++) for (let nx = tx - 1; nx <= tx + 1; nx++) {
        if ((nx === tx && nz === tz) || !solid(nx, nz, p.y)) continue;
        const cx = Math.min(Math.max(p.x, nx * S), (nx + 1) * S), cz = Math.min(Math.max(p.z, nz * S), (nz + 1) * S);
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d < RHO && d > 1e-6) { p.x += dx / d * (RHO - d); p.z += dz / d * (RHO - d); }
      }
    }
    tx = Math.floor(p.x / S); tz = Math.floor(p.z / S);
    return !solid(tx, tz, p.y);
  }
  const nearBuf = [];
  let near = blockers;                               // (the blockers within reach of the boom, refreshed once a frame)
  function inBlocker(p, list = near, pad = 0) {      // 0 = free, 2 = in a crown, conifer or the tent, 3 = behind a trunk
    const py = p.y + fH();
    for (const b of list) {
      let dx = p.x - b.x, dz = p.z - b.z;
      if (b.trunk) {
        const ty = py - (b.y0 || 0);
        if (ty > b.h) continue;
        const k = Math.min(1, Math.max(0, (ty + 0.3) / (b.h + 0.3))), r = b.r + 0.22 + pad;
        dx -= b.lx * k * k; dz -= b.lz * k * k;
        if (dx * dx + dz * dz < r * r) return 3;
      } else if (b.cone) {
        const u = (py - b.y0) / b.h;
        if (u < -0.25 || u > 1.05) continue;
        const r = b.r * (1 - 0.8 * Math.min(1, Math.max(0, u))) ** 0.9 + TREE + pad;
        if (dx * dx + dz * dz < r * r) return 2;
      } else {
        const r = b.r + TREE + pad, ry = b.ry + TREE + pad, dy = py - b.y;
        if ((dx * dx + dz * dz) / (r * r) + dy * dy / (ry * ry) < 1) return 2;
      }
    }
    return 0;
  }

  // Walk the boom. Returns the length reached and leaves the camera point for that length in `out`.
  // `why` afterwards: 0 = the whole boom is free, 1 = stopped by solid tiles, 2 = by foliage, 3 = by a trunk.
  let why = 0;
  function reach(pivot, yaw, pitch, dist, out, trees = true) {
    const cp = Math.cos(pitch), dx = Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = Math.cos(yaw) * cp;
    let got = 0; out.copy(pivot); why = 0;
    for (let s = 0.45; s <= dist + 1e-6; s += STEP) {
      q.set(pivot.x + dx * s, pivot.y + dy * s, pivot.z + dz * s);
      if (!pushOut(q)) { why = 1; break; }
      if (trees && (why = inBlocker(q))) break;
      out.copy(q); got = s;
    }
    return got;
  }
  // The best the boom can do at this bearing:
  //   foliage in the way          -> duck: the highest pitch below the player's that gets (nearly) the whole boom under the canopy
  //   the forest wall in the way  -> a shorter boom, a little steeper
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), best = new THREE.Vector3();
  let cause = 0;                                     // what limits the solved boom (as `why`)
  function solve(pivot, yaw, pitch, dist, out) {
    let len = reach(pivot, yaw, pitch, dist, out); cause = why;
    if (len >= dist * 0.98) return len;
    if (why === 2) {
      for (let p = pitch - 0.04; p >= 0.02; p -= 0.04) {
        const l = reach(pivot, yaw, p, dist, tmp);
        if (l > len + 0.25) { len = l; out.copy(tmp); cause = why; }
        if (l >= dist * 0.98) break;
      }
    } else if (why === 1) {
      // a wall: the camera comes in closer along the same line, and a little higher the closer it gets, so that she
      // does not fill the view (index.html hides her altogether when the camera ends up at her head)
      const l = reach(pivot, yaw, Math.min(1.2, pitch + (1 - len / dist) * 0.3), dist, tmp);
      if (l >= len - 0.2) { len = l; out.copy(tmp); cause = why || 1; }
    }
    return len;
  }

  let lastOff = 0;                                   // the sidestep in use (radians of yaw), kept while it still works
  return {
    // Where the camera should be for the player's yaw / pitch / distance: leaves the point in `out`, returns the
    // boom's length. A trunk between her and the camera is sidestepped: the camera looks from a slightly different
    // bearing (the player's own yaw, which steers her walk, is not touched).
    place(pivot, yaw, pitch, dist, out) {
      const reachXZ = dist + 4;
      nearBuf.length = 0;                            // (one array, refilled: nothing for the garbage collector)
      for (const b of blockers) if (Math.abs(b.x - pivot.x) < reachXZ && Math.abs(b.z - pivot.z) < reachXZ) nearBuf.push(b);
      near = nearBuf;
      let len = solve(pivot, yaw, pitch, dist, out);
      if (cause === 3 && len < dist * 0.9) {
        const offs = [0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4];
        if (lastOff) offs.unshift(lastOff);
        let found = 0;
        for (const d of offs) {
          const l = solve(pivot, yaw + d, pitch, dist, tmp2);
          if (cause !== 3 && l > len + 0.5) { len = l; out.copy(tmp2); found = d; break; }
        }
        lastOff = found;
      } else lastOff = 0;
      if (len < MIN_LEN) {                           // hemmed in on every side: sit just behind her whatever the leaves do
        const l = reach(pivot, yaw, pitch, Math.min(dist, 1.8), tmp, false);
        if (l > len) { out.copy(tmp); len = l; }
      }
      return len;
    },
    // For the story's fixed shots: is a camera point clear (0.35 m from solid tiles, `pad` clear of every tree), and
    // can it see a point (nothing solid and no tree on the line between them; the last `stop` metres are not tested,
    // so a thing standing against the forest or under a tree still counts as seen)?
    free(p, pad = 0) {
      for (const [dx, dz] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) if (solid(Math.floor((p.x + dx) / S), Math.floor((p.z + dz) / S), p.y)) return false;
      return !inBlocker(p, blockers, pad);
    },
    sight(a, b, pad = 0, stop = 0) {
      const len = a.distanceTo(b), n = Math.max(2, Math.ceil(len / 0.3));
      for (let i = 1; i < n; i++) {
        if (len * (1 - i / n) < stop) break;
        q.lerpVectors(a, b, i / n); if (solid(Math.floor(q.x / S), Math.floor(q.z / S), q.y) || inBlocker(q, blockers, pad)) return false;
      }
      return true;
    },
    // How far the boom gets at a bearing, solid tiles only (tests).
    room(pivot, yaw, pitch, dist) { return reach(pivot, yaw, pitch, dist, best, false); },
    blockers,
  };
}
