"""Builds the four maps of Chapter 2 ("Dawn comes Slowly"), in the format of level.json (see make_level_epilogue.py):
   python3 tools/make_level_ch2.py

post      the 2D game's Map 53 "Trader Post" (25x25): the campsite on the road south, with Camellia Flaire's tent and
          stall, the fire, the signpost, the locked fortune teller's cabin, the pond. Drawn a little smaller (22x20).
lys       Map 36 "ForestOfLys" (60x130, two near-identical halves stacked): ONE half, drawn compact (42x38): the South
          Road, the bridge over the stream, the bridge over the river where the dryad stands, the south gate; (10-12)
          side paths to the glades where the forest's creatures are, and two ledges that are climbed to by a vine: the
          one above the "Weeds" (events 120 / 121) and the Glade of Lys (the 2D's Map 28, behind its secret path).
valyndra  Map 1 "ValyndraCity" (90x60): only what Chapter 2 plays in, the square inside the south gate with the guard
          house door east of the gate. A set (interior): story_valyndra.js builds the walls and houses.
barracks  Map 48 "Barraks" ("Capital City Dungeons", 23x13): one room, the stocks at the middle of the back wall. A set.

Letters (outdoor maps): '#' forest, '~' water, 'x' open ground blocked by something standing on it, '.' grass,
'b' tall grass, ':' the dirt road, '=' a bridge (a causeway in the water, planks on top), 'L' grass on top of a ledge
(raised ground: tools/ledges.py). Sets: '1' floor, '0' not."""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledges

OBJ = ('flowers', 'tree', 'conifer', 'lily', 'willow', 'fern', 'bush', 'rock', 'stump', 'totem', 'barrel', 'sapling', 'pumpkin', 'vine', 'hedge', 'bridge')


def build(name, rows, objects, start, title, music, paths_out, exits=(), extra=None, climbs=None):
    h = len(rows); w = len(rows[0])
    assert all(len(r) == w for r in rows), [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    terrain, tall, walk, bridges = [], [], [], []
    for y, r in enumerate(rows):
        tr, tt, tw = '', '', ''
        for x, c in enumerate(r):
            if c == '#': tr += '#'; tt += '.'; tw += '0'
            elif c == '~': tr += '~'; tt += '.'; tw += '0'
            elif c == 'x': tr += 'g'; tt += '.'; tw += '0'
            elif c == 'b': tr += 'g'; tt += 't'; tw += '1'
            elif c == ':': tr += 'd'; tt += '.'; tw += '1'
            elif c == '=': tr += 'd'; tt += '.'; tw += '1'; bridges.append([x, y])
            else: tr += 'g'; tt += '.'; tw += '1'
        terrain.append(tr); tall.append(tt); walk.append(tw)
    obj = {k: [] for k in OBJ}
    for k, v in objects.items(): obj[k] = [list(p) for p in v]
    obj['bridge'] = bridges
    lv = dict(name=name, glade=True, plateau=False, width=w, height=h, terrain=terrain, tallgrass=tall, walkable=walk, objects=obj,
              pumpkins_event=[], events=[], start=list(start), margin=4, pathsOut=paths_out, wraps=[], music=music, title=title, exits=list(exits))
    lv.update(extra or {})
    if climbs:                                   # raised ground: the 'L' tiles, and the forest that stands round them
        top = {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == 'L'}
        raised = ledges.raise_around(terrain, walk, top, 1, low=set().union(*[ledges.beside(c['base'], c['top']) for c in climbs]))
        lv.update(levels=ledges.rows(raised, w, h), ledgeH=3.0, climbs=climbs); ledges.check(lv)
        rows = [''.join('^' if (x, y) in raised and c == '#' else c for x, c in enumerate(r)) for y, r in enumerate(rows)]
    json.dump(lv, open('level_%s.json' % name, 'w'))
    print('==', name, '%dx%d' % (w, h), 'walkable', sum(r.count('1') for r in walk))
    print('     ' + ''.join('%d' % (x // 10) for x in range(w))); print('     ' + ''.join('%d' % (x % 10) for x in range(w)))
    for y in range(h): print('  %2d ' % y + rows[y])


def build_set(name, rows, start, title, music, exits=()):
    h = len(rows); w = len(rows[0])
    assert all(len(r) == w for r in rows), [(i, len(r)) for i, r in enumerate(rows) if len(r) != w]
    lv = dict(name=name, glade=False, plateau=False, interior=True, width=w, height=h, terrain=['g' * w] * h, tallgrass=['.' * w] * h, walkable=list(rows),
              objects={k: [] for k in OBJ}, pumpkins_event=[], events=[], start=list(start), margin=2, pathsOut=[], wraps=[], music=music, title=title, exits=list(exits))
    json.dump(lv, open('level_%s.json' % name, 'w'))
    print('==', name, '%dx%d' % (w, h), 'floor', sum(r.count('1') for r in rows))
    for y in range(h): print('  %2d ' % y + rows[y])


# ---------- the Trader Post ----------
POST = """\
######################
##########:###########
####~~~~##:###########
###~~~~~~.:.....x#####
###~~~~~..:....xxx.###
###.~~~...:.....x...##
##........:..........#
##xxxxx...:..........#
##xxxxx...:....x.....#
##..x.....:::::......#
##........:..........#
##...xxx..:..........#
##...xxx..:.....x....#
##bbbb....:..........#
##bbbb....:..........#
###bbb....:.........##
#####.....:......#####
##########:###########
##########:###########
##########:###########""".split('\n')
build('post', POST, {
    'lily': [(5, 3), (6, 4), (4, 4), (7, 3)],
    'rock': [(9, 3), (3, 5)],
    'flowers': [(3, 6), (8, 5), (12, 4), (18, 10), (19, 14), (7, 15), (19, 6), (8, 10)],
    'fern': [(2, 10), (20, 7), (19, 12), (6, 16)],
    'stump': [(8, 12)],
    'barrel': [(19, 5), (14, 5)],                           # (nothing stands south of the fire: Anne's dream is played there)
}, (10, 2), 'Trader Post', 'field1.mp3', [[10, 'north'], [10, 'south']],
    exits=[dict(tiles=[[10, 0]], to='road', spawn=[44, 8], face='west'), dict(tiles=[[10, 19]], to='lys', spawn=[8, 1], face='south')],
    extra=dict(campfire=[15, 8], tent=[16, 4]))

# ---------- the Forest of Lys: carved, not drawn (a road through thick forest, a stream, a river) ----------
W, H = 42, 38
g = [['#'] * W for _ in range(H)]
ROAD = [(8, 0), (8, 5), (11, 9), (11, 14), (9, 17), (12, 19), (20, 19), (22, 22), (20, 27), (22, 32), (22, 37)]
GLADES = [(8, 3, 2.3), (11, 15.5, 2.6), (12.5, 19, 2.4), (20.5, 19, 2.8), (21, 27, 2.9), (22, 34, 2.2), (9, 17, 1.8)]
# (10-12) off the road: narrow paths to the glades where the forest's creatures are (the 2D map is a web of such glades)
PATHS = [
    [(10, 6), (14, 5), (18, 4)],                       # east of the way in: the hornets' meadow
    [(9, 16), (6, 15), (4, 16)],                       # west, along the stream's south bank: the slimes' marsh
    [(11, 20), (8, 23), (7, 26)],                      # south-west of the first bridge: the mushroom hollow
    [(22, 18), (26, 15), (30, 14)],                    # north-east of the second bridge: the east woods
    [(23, 27), (26, 27)],                              # east of the lower road: to the foot of the Glade of Lys
]
GLADES += [(17.5, 4.5, 3.0), (20.5, 6.5, 2.0), (4.5, 16, 2.4), (6.5, 26.5, 3.0), (9.5, 29, 2.0), (30.5, 14, 3.2), (34, 16.5, 2.2), (26.5, 27, 1.6)]


def seg_d(px, py, a, b):
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L)) if L else 0
    return math.hypot(px - ax - dx * t, py - ay - dy * t)


for y in range(H):
    for x in range(W):
        d = min(seg_d(x, y, ROAD[i], ROAD[i + 1]) for i in range(len(ROAD) - 1))
        if d <= 1.55: g[y][x] = '.'
        if any(math.hypot(x - cx, y - cy) <= r for cx, cy, r in GLADES): g[y][x] = '.'
        if any(seg_d(x, y, p[i], p[i + 1]) <= 1.0 for p in PATHS for i in range(len(p) - 1)): g[y][x] = '.'
        if d <= 0.5: g[y][x] = ':'
# the stream (east-west, two tiles wide, rows 11-12) and the river it runs into (north-south, columns 16-17)
for x in range(W):
    for y in (11, 12): g[y][x] = '~'
for y in range(11, H):
    for x in (16, 17): g[y][x] = '~'
for (x, y) in [(3, 10), (4, 10), (5, 10), (4, 13), (5, 13), (6, 13), (21, 10), (22, 10), (23, 10), (15, 13), (18, 13), (15, 26), (18, 27), (18, 28), (15, 30)]: g[y][x] = '~'      # (the banks are not ruled lines)
for (x, y) in [(11, 11), (11, 12), (16, 19), (17, 19)]: g[y][x] = '='      # the two bridges
# (10-12) the two ledges: the one above the weeds, west of the way in (the 2D's is north of its first glade: aloe and a
# Mandragora), and the Glade of Lys, east of the lower road (the 2D's Map 28: the Mandragoras' garden)
for x in range(1, 6):
    for y in range(1, 9):
        if not (x in (1, 5) and y in (1, 8)): g[y][x] = 'L'
for x in range(28, 37):
    for y in range(22, 32):
        if math.hypot((x - 32) / 4.6, (y - 26.5) / 5.2) <= 1.0: g[y][x] = 'L'
LYS_CLIMBS = [dict(id='weeds', base=[6, 4], top=[5, 4]), dict(id='glade', base=[27, 27], top=[28, 27])]
for x in range(W): g[0][x] = '#' if x != 8 else ':'; g[H - 1][x] = '#' if x != 22 else ':'
for y in range(H): g[y][0] = '#'; g[y][W - 1] = '#'
for (x, y) in [(6, 3), (10, 3), (13, 14), (9, 15), (19, 17), (23, 20), (23, 26), (19, 29), (24, 33), (20, 35)]:
    if g[y][x] == '.': g[y][x] = 'b'
LYS = [''.join(r) for r in g]
free = lambda x, y: 0 <= x < W and 0 <= y < H and LYS[y][x] in '.b'
cand = dict(
    flowers=[(7, 2), (9, 4), (10, 7), (12, 10), (10, 14), (12, 16), (8, 18), (13, 20), (19, 18), (21, 20), (22, 24), (19, 26), (22, 28), (21, 31), (23, 34), (21, 36), (13, 17)],
    fern=[(7, 5), (10, 5), (12, 13), (10, 18), (14, 18), (18, 20), (22, 18), (20, 24), (22, 26), (20, 29), (23, 32), (21, 33)],
    rock=[(9, 13), (13, 16), (19, 21), (22, 29)],
    stump=[(12, 17), (19, 28)],
    bush=[(7, 4), (13, 15), (21, 17), (23, 27)],
    lily=[],
)
objs = {k: [p for p in v if free(*p)] for k, v in cand.items()}
objs['lily'] = [(3, 11), (6, 12), (14, 11), (20, 12), (24, 11), (16, 15), (17, 23), (16, 28), (17, 33)]
objs['willow'] = [(14, 12), (2, 11)]
build('lys', LYS, objs, (8, 1), 'Forest of Lys', 'forest1.mp3', [[8, 'north'], [22, 'south']],
      exits=[dict(tiles=[[8, 0]], to='post', spawn=[10, 18], face='north'), dict(tiles=[[22, 37]], to='valyndra', spawn=[12, 12], face='north')], climbs=LYS_CLIMBS)

# ---------- Valyndra City: the square inside the south gate (a set) ----------
VAL = """\
00000000000111000000000000
00000000000111000000000000
00000000000111000000000000
00000000000111000000000000
00000000000111000000000000
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00111111111111111111111100
00000000000111000010000000
00000000000111000000000000
00000000000111000000000000""".split('\n')
build_set('valyndra', VAL, (12, 12), 'Valyndra City', 'field1.mp3',
          exits=[dict(tiles=[[11, 15], [12, 15], [13, 15]], to='lys', spawn=[22, 36], face='north'), dict(tiles=[[18, 13]], to='barracks', spawn=[5, 6], face='north')])

# ---------- the guard house dungeon (a set) ----------
BAR = """\
00000000000
01111111110
01111111110
01111111110
01111111110
01111111110
01111111110
01111111110
00000100000""".split('\n')
build_set('barracks', BAR, (5, 6), 'Capital City Dungeons', 'dungeon3.mp3',
          exits=[dict(tiles=[[5, 8]], to='valyndra', spawn=[18, 11], face='north')])
