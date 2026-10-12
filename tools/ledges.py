"""Raised ground: the ledges that are reached by climbing a vine (make_level_forest.py, make_level_ch2.py).

The fields a level gets, and what the game makes of them (world/ledges.js, index.html):
   levels   rows of '0' / '1': the tiles that stand on the raised ground, walkable or not
   ledgeH   how high, in metres
   climbs   [{id, base: [x, y], top: [x, y]}]: she stands on `base` (low ground) and climbs to `top` (raised); the two
            are in one row or one column, and the rock face she climbs is the edge of the raised ground between them

raise_around(terrain, walk, top, ring, low): the tiles of `top`, and every tile within `ring` of one of them that she
cannot walk on and that is not water (nor in `low`): the trees, bushes and rocks round a ledge stand up there with it,
so that from on top it is a clearing in the forest and not a pillar."""


def raise_around(terrain, walk, top, ring=1, low=()):
    h, w = len(terrain), len(terrain[0])
    out = set(top)
    for (x, y) in top:
        for dy in range(-ring, ring + 1):
            for dx in range(-ring, ring + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and walk[ny][nx] != '1' and terrain[ny][nx] != '~' and (nx, ny) not in low: out.add((nx, ny))
    return out


def beside(base, top):
    """the two tiles left and right of the foot of a climb: they stay low (`low` above), so that the rock face she
    climbs is a straight wall and she does not stand in a slot one tile wide"""
    (bx, by), (tx, ty) = base, top
    return {(bx, by - 1), (bx, by + 1)} if by == ty else {(bx - 1, by), (bx + 1, by)}


def between(base, top):
    """the tiles of the rock face: strictly between the foot of a climb and its top (none if they touch)"""
    (bx, by), (tx, ty) = base, top
    assert bx == tx or by == ty, (base, top)
    n = max(abs(tx - bx), abs(ty - by)); sx = (tx > bx) - (tx < bx); sy = (ty > by) - (ty < by)
    return [(bx + sx * k, by + sy * k) for k in range(1, n)]


def rows(tiles, w, h):
    return [''.join('1' if (x, y) in tiles else '0' for x in range(w)) for y in range(h)]


def check(level):
    """every climb starts on low walkable ground and ends on raised walkable ground; no walkable tile of one height
    touches a walkable tile of the other except across a climb (nothing to trip over: the game refuses the step)"""
    lv, wk = level['levels'], level['walkable']
    for c in level['climbs']:
        (bx, by), (tx, ty) = c['base'], c['top']
        assert wk[by][bx] == '1' and lv[by][bx] == '0', ('base', c)
        assert wk[ty][tx] == '1' and lv[ty][tx] == '1', ('top', c)
        for (x, y) in between(c['base'], c['top']): assert lv[y][x] == '1' and wk[y][x] == '1', ('face', c, x, y)
    return True
