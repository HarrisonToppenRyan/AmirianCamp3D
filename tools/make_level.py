"""Builds level_pond.json (the Forest Pond, Map002 of the 2D game) in the format of level.json.
   python3 tools/make_level.py"""
import json, collections
W = '/Users/harrisontoppenryan/Downloads/Vids/AmirianCurseGame/www/data/'
m = json.load(open(W + 'Map002.json')); w, h = m['width'], m['height']; d = m['data']
flags = json.load(open(W + 'Tilesets.json'))[m['tilesetId']]['flags']
lay = lambda z, x, y: d[(z * h + y) * w + x]
kind = lambda t: (t - 2048) // 48 if t >= 2048 else None
FACE = {1648, 1649, 1650, 1656, 1657, 1658}

def passable(x, y):
    for z in (3, 2, 1, 0):
        f = flags[lay(z, x, y)]
        if f & 0x10: continue
        return (f & 0x0f) == 0
    return False

terrain, tall = [], []
for y in range(h):
    row, trow = '', ''
    for x in range(w):
        t0, t1 = lay(0, x, y), lay(1, x, y); k = kind(t0)
        if k is None: c = 'r' if t0 in FACE else 'g'
        elif k < 16: c = '~'
        elif k == 17: c = 'd'
        elif k < 48: c = 'g'
        elif k == 125: c = '|'
        else: c = '#'
        if c == '~' and 16 in (lay(2, x, y), lay(3, x, y)): c = 'd'          # the plank bridge: a causeway
        if c in 'gr' and not passable(x, y) and any(640 <= lay(z, x, y) <= 663 for z in (2, 3)): c = '#'   # under the forest canopy
        if c == '~' and y < 5: c = 'r'                                        # the waterfall's rock face (pond.js hangs the water on it)
        row += c; trow += 't' if kind(t1) == 39 and c == 'g' else '.'
    terrain.append(row); tall.append(trow)

ok = [[passable(x, y) and terrain[y][x] in 'gd' for x in range(w)] for y in range(h)]
for x, y in ((22, 5), (22, 6)): ok[y][x] = False                               # the ivy ladder to the upper ledge: not climbed here
start = (18, 36); seen = {start}; todo = [start]
while todo:
    x, y = todo.pop()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and ok[ny][nx] and (nx, ny) not in seen: seen.add((nx, ny)); todo.append((nx, ny))
walk = [''.join('1' if (x, y) in seen else '0' for x in range(w)) for y in range(h)]

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
            if [x, y] not in obj[k]: obj[k].append([x, y])
for k in ('pumpkin', 'vine', 'hedge', 'conifer', 'flowers', 'fern'): obj.setdefault(k, [])
fall = [x for x in range(w) if terrain[6][x] == '~' and terrain[5][x] != '~']
level = dict(name='pond', glade=True, width=w, height=h, terrain=terrain, tallgrass=tall, walkable=walk, objects=dict(obj),
             campfire=[23, 25], tent=[23, 23], waterfall=[13, 5], plateau=False, margin=6, start=list(start), pumpkins_event=[],
             pathsOut=[[18, 'south']], exits=[dict(tiles=[[17, 38], [18, 38], [19, 38], [17, 39], [18, 39], [19, 39]], to='camp', spawn=[6, 2], face='south')])
json.dump(level, open('level_pond.json', 'w'))
print('\n'.join(a + '   ' + b for a, b in zip(terrain, walk)))
print({k: len(v) for k, v in obj.items()}, 'walkable', len(seen))
print('rows 0-7 layer0 x10..16:', [[lay(0, x, y) for x in range(10, 17)] for y in range(0, 8)])
