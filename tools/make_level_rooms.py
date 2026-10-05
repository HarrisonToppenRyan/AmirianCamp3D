"""Builds level_caves.json and level_nest.json: the two rooms under the North Forest (Map 21 "ForestCaves" and Map 20
"IvyMaidenNest" of the 2D game), in the format of level.json.
   python3 tools/make_level_rooms.py

Both rooms are drawn in the 2D tileset 4 ("Dungeon", its Grass Maze set): leafy hedges for walls, grass over a mat of
roots for ground, a teal stream. Terrain letters as in make_level_forest.py: g grass, d dark ground, # hedge (built as
forest), r rock face, ~ water. Walkable = what the 2D game lets her reach on foot from where she arrives (its passability
per direction, flood-filled; the nest loops round like the forest: `wraps`). The decorations the 2D map draws on its
upper layers are listed in `objects` (crystal plants, the goddess statue, boulders, bushes, the light shaft...)."""
import json, collections
W = '/Users/harrisontoppenryan/Downloads/Vids/AmirianCurseGame/www/data/'
ROOMS = {
    # name: (map, arrival tile, exits, title, music, entry text)
    'caves': (21, (15, 4), [], 'Caves', 'caves1.mp3'),      # (the way out, the shaft of light at (15,2), is story_caves.js's)
    'nest': (20, (5, 4), [], "Ivy Maiden's Nest", 'dungeon3.mp3'),      # (built bigger: TILE below)
}
# B/C/D tiles of tileset 4 -> what the 3D builds there
DECOR = {52: 'sprouts', 60: 'bush', 68: 'conifer', 76: 'bigbush', 105: 'rock', 519: 'rock', 526: 'orbrock', 109: 'planks', 7: 'vines', 15: 'vines',
         49: 'pebbles', 583: 'pinkstones', 518: 'flowers', 128: 'shaft', 545: 'statue', 561: 'crystal', 560: 'crystal', 853: 'glow', 250: 'skeleton'}
for name, (mid, start, exits, title, music) in ROOMS.items():
    m = json.load(open(W + 'Map%03d.json' % mid)); w, h = m['width'], m['height']; d = m['data']
    flags = json.load(open(W + 'Tilesets.json'))[m['tilesetId']]['flags']
    lay = lambda z, x, y: d[(z * h + y) * w + x]
    kind = lambda t: (t - 2048) // 48 if t >= 2048 else None
    loopH = m['scrollType'] in (2, 3); loopV = m['scrollType'] in (1, 3)

    def chk(x, y, bit):                          # RPG Maker's passability of one tile in one direction
        for z in (3, 2, 1, 0):
            f = flags[lay(z, x % w, y % h)]
            if f & 0x10: continue
            return (f & bit) == 0
        return False
    DIRS = {(0, 1): (1, 8), (-1, 0): (2, 4), (1, 0): (4, 2), (0, -1): (8, 1)}
    def canpass(x, y, dx, dy):
        nx, ny = x + dx, y + dy
        if not loopH and not 0 <= nx < w: return False
        if not loopV and not 0 <= ny < h: return False
        return chk(x, y, DIRS[(dx, dy)][0]) and chk(nx, ny, DIRS[(dx, dy)][1])
    seen = {start}; todo = [start]
    while todo:
        x, y = todo.pop()
        for (dx, dy) in DIRS:
            if not canpass(x, y, dx, dy): continue
            p = ((x + dx) % w, (y + dy) % h)
            if p not in seen: seen.add(p); todo.append(p)

    terrain, tall = [], []
    for y in range(h):
        row, trow = [], ''
        for x in range(w):
            t0, t1 = lay(0, x, y), lay(1, x, y); k = kind(t0)
            if k is None: c = 'g'                        # (A5 ground)
            elif k < 16: c = '~'                          # water and waterfalls
            elif k == 19: c = 'd'
            elif k < 48: c = 'g'
            elif k == 89: c = 'r'                         # the one face of grey rock beside the big waterfall
            else: c = '#'                                 # the leafy hedge: tops and faces
            row.append(c); trow += 't' if kind(t1) == 39 and c in 'gd' else '.'
        terrain.append(row); tall.append(trow)
    for (x, y) in seen:                                    # (seedlings on water are walked on in the 2D: a causeway of roots)
        if terrain[y][x] == '~': terrain[y][x] = 'd'
    for y in range(h):                                     # ground she cannot reach: hedge
        for x in range(w):
            if (x, y) not in seen and terrain[y][x] in 'gd': terrain[y][x] = '#'
    walk = [''.join('1' if (x, y) in seen and terrain[y][x] in 'gd' else '0' for x in range(w)) for y in range(h)]
    falls = [[x, y] for y in range(h) for x in range(w) if kind(lay(0, x, y)) in (7, 11)]
    obj = collections.defaultdict(list)
    for y in range(h):
        for x in range(w):
            for z in (2, 3):
                k = DECOR.get(lay(z, x, y))
                if k and [x, y] not in obj[k]: obj[k].append([x, y])
    for k in ('pumpkin', 'vine', 'hedge', 'conifer', 'flowers', 'fern', 'tree', 'willow', 'sapling', 'bush', 'rock', 'stump', 'totem', 'barrel', 'lily'): obj.setdefault(k, [])
    obj['bridge'] = []
    wraps, outs = [], []
    if loopH:
        for yy in range(h):
            if (0, yy) in seen and (w - 1, yy) in seen and canpass(0, yy, -1, 0): wraps += [dict(edge='west', n=yy), dict(edge='east', n=yy)]; outs += [[yy, 'west'], [yy, 'east']]
    if loopV:
        for xx in range(w):
            if (xx, 0) in seen and (xx, h - 1) in seen and canpass(xx, 0, 0, -1): wraps += [dict(edge='north', n=xx), dict(edge='south', n=xx)]; outs += [[xx, 'north'], [xx, 'south']]
    events = []
    for e in m['events']:
        if not e: continue
        img = e['pages'][0]['image']
        events.append(dict(id=e['id'], name=e['name'], x=e['x'], y=e['y'], sprite=img['characterName'], index=img['characterIndex']))
    level = dict(name=name, glade=True, plateau=False, width=w, height=h, terrain=[''.join(r) for r in terrain], tallgrass=tall, walkable=walk,
                 objects=dict(obj), pumpkins_event=[], events=events, start=list(start), margin=3, pathsOut=outs, wraps=wraps, music=music, title=title,
                 exits=exits, waterfalls=falls, room=True)
    if name == 'nest': level['tile'] = 2.1      # (10-02: "a bit bigger": 2.1 m a tile instead of 1.6; its paths along the water were too narrow)
    json.dump(level, open('level_%s.json' % name, 'w'))
    print('==', name, 'map', mid, '%dx%d' % (w, h), 'loops' if wraps else '', 'walkable', sum(r.count('1') for r in walk), 'wraps', len(wraps) // 2)
    for y in range(h): print('  ' + ''.join(('.' if walk[y][x] == '1' else terrain[y][x]) for x in range(w)) + '   ' + tall[y])
    print('  objects', {k: v for k, v in obj.items() if v})
