"""Builds level_forest.json (the North Forest, Map003 of the 2D game) in the format of level.json.
   python3 tools/make_level_forest.py
(The pond has its own, older generator: tools/make_level.py. This one reads passability per direction.)

Terrain letters: g grass, d dirt (also plank bridges: a causeway), # forest, | trunk wall, ~ water, r rock (cliff faces
and, in the forest, the plateaus that are only reached by climbing in the 2D game). The 3D levels have one ground
height, so cliffs become rock banks. Walkable = what the 2D game lets her reach on foot from the entrance (its
per-direction passability, flood-filled round the looping map; see FOREST below)."""
import json, collections, sys
W = '/Users/harrisontoppenryan/Downloads/Vids/AmirianCurseGame/www/data/'
which = 'forest'
MAP = {'pond': 2, 'forest': 3}[which]
m = json.load(open(W + 'Map%03d.json' % MAP)); w, h = m['width'], m['height']; d = m['data']
flags = json.load(open(W + 'Tilesets.json'))[m['tilesetId']]['flags']
lay = lambda z, x, y: d[(z * h + y) * w + x]
kind = lambda t: (t - 2048) // 48 if t >= 2048 else None
FACE = {1648, 1649, 1650, 1656, 1657, 1658}

def chk(x, y, bit):                              # RPG Maker's passability of one tile in one direction
    for z in (3, 2, 1, 0):
        f = flags[lay(z, x % w, y % h)]
        if f & 0x10: continue
        return (f & bit) == 0
    return False
DIRS = {(0, 1): (1, 8), (-1, 0): (2, 4), (1, 0): (4, 2), (0, -1): (8, 1)}
def canpass(x, y, dx, dy):
    return chk(x, y, DIRS[(dx, dy)][0]) and chk(x + dx, y + dy, DIRS[(dx, dy)][1])
def fill(start):                                 # the map loops in both directions (scrollType 3): neighbours wrap round
    seen = {start}; todo = [start]
    while todo:
        x, y = todo.pop()
        for (dx, dy) in DIRS:
            p = ((x + dx) % w, (y + dy) % h)
            if p not in seen and canpass(x, y, dx, dy): seen.add(p); todo.append(p)
    return seen

terrain = []; tall = []
for y in range(h):
    row, trow = [], ''
    for x in range(w):
        t0, t1 = lay(0, x, y), lay(1, x, y); k = kind(t0)
        if k is None: c = 'r' if t0 in FACE else 'g'
        elif k < 16: c = '~'
        elif k == 17: c = 'd'
        elif k < 48: c = 'g'
        elif k == 125: c = '|'
        elif k >= 48 and k < 112: c = 'g'        # (A3/A4 tiles used as ground detail)
        else: c = '#'
        if c == 'g' and kind(t1) == 17: c = 'd'                               # a dirt path drawn on the upper ground layer
        if c in 'gr' and not chk(x, y, 15) and any(640 <= lay(z, x, y) <= 687 for z in (2, 3)): c = '#'   # under the forest canopy
        row.append(c); trow += 't' if kind(t1) == 39 and c == 'g' else '.'
    terrain.append(row); tall.append(trow)

extra = {}
if which == 'pond':
    for y in range(h):
        for x in range(w):
            if terrain[y][x] == '~' and y < 5: terrain[y][x] = 'r'           # the waterfall's rock face (pond.js hangs the water on it)
    seen = fill((18, 36), blocked={(22, 5), (22, 6)})                          # (the ivy ladder to the upper ledge is not climbed here)
    seen = {p for p in seen if terrain[p[1]][p[0]] in 'gd~'}
    extra = dict(campfire=[23, 25], tent=[23, 23], waterfall=[13, 5], start=[18, 36], pathsOut=[[18, 'south']], margin=6,
                 exits=[dict(tiles=[[17, 38], [18, 38], [19, 38], [17, 39], [18, 39], [19, 39]], to='camp', spawn=[6, 2], face='south')])
else:
    # FOREST. The 2D map loops: walking off one edge brings her in at the opposite edge. That is how the lower forest
    # (the entrance from the camp, the river, the flower glade with the hole) and the upper forest (the shrine loop
    # and the lane to the Main Road) are joined. The 3D level keeps the loop: `wraps` lists the edge tiles she can
    # cross, and the game fades and carries her to the other side.
    seen = fill((56, 38))
    for y in range(h):                           # passable ground she cannot reach (the ledges reached by climbing in 2D): rock
        for x in range(w):
            if (x, y) not in seen and terrain[y][x] in 'gd' and chk(x, y, 15): terrain[y][x] = 'r'
    wraps = []; outs = []
    for y in range(h):
        if (0, y) in seen and (w - 1, y) in seen and canpass(0, y, -1, 0): wraps.append(dict(edge='west', n=y)); wraps.append(dict(edge='east', n=y)); outs += [[y, 'west'], [y, 'east']]
    for x in range(w):
        if (x, 0) in seen and (x, h - 1) in seen and canpass(x, 0, 0, -1): wraps.append(dict(edge='north', n=x)); wraps.append(dict(edge='south', n=x)); outs += [[x, 'north'], [x, 'south']]
    extra = dict(start=[56, 39], margin=4, pathsOut=outs, wraps=wraps, music='forest2.mp3', title='North Forest',
                 exits=[dict(tiles=[[56, 38], [56, 37]], to='camp', spawn=[8, 13], face='north')])

bridge = []
for (x, y) in sorted(seen):
    if terrain[y][x] == '~': terrain[y][x] = 'd'; bridge.append([x, y])     # a plank bridge: a causeway (pond.js lays the planks)
walk = [''.join('1' if (x, y) in seen and terrain[y][x] in 'gd' else '0' for x in range(w)) for y in range(h)]
terrain = [''.join(r) for r in terrain]

obj = collections.defaultdict(list)
IDS = {101: 'conifer', 120: 'tree', 622: 'willow', 546: 'sapling', 520: 'bush', 95: 'rock', 601: 'totem', 77: 'barrel', 92: 'stump', 179: 'stump', 87: 'fern', 91: 'fern'}
for i in (764, 767, 186, 94, 96, 97, 98, 88): IDS[i] = 'flowers'
for i in range(190, 204): IDS[i] = 'lily'
for y in range(h):
    for x in range(w):
        for z in (2, 3):
            k = IDS.get(lay(z, x, y))
            if not k: continue
            if k == 'lily' and terrain[y][x] != '~': continue
            if k in ('flowers', 'fern') and terrain[y][x] != 'g': continue
            if k in ('tree', 'conifer', 'willow', 'sapling', 'bush') and terrain[y][x] in '#|': continue      # (inside the forest: the forest builder plants its own)
            if [x, y] not in obj[k]: obj[k].append([x, y])
for k in ('pumpkin', 'vine', 'hedge', 'conifer', 'flowers', 'fern'): obj.setdefault(k, [])
obj['bridge'] = bridge

events = []
for e in m['events']:
    if not e: continue
    img = e['pages'][0]['image']
    events.append(dict(id=e['id'], name=e['name'], x=e['x'], y=e['y'], sprite=img['characterName'], index=img['characterIndex']))

level = dict(name=which, glade=True, plateau=False, width=w, height=h, terrain=terrain, tallgrass=tall, walkable=walk, objects=dict(obj),
             pumpkins_event=[], events=events if which == 'forest' else [], **extra)
json.dump(level, open('level_%s.json' % which, 'w'))
print('\n'.join(a + '   ' + b for a, b in zip(terrain, walk)) if w <= 40 else '\n'.join(''.join(('.' if walk[y][x] == '1' else terrain[y][x]) for x in range(w)) for y in range(h)))
print({k: len(v) for k, v in obj.items()}, 'walkable', sum(r.count('1') for r in walk), 'letters', dict(collections.Counter(''.join(terrain))))
