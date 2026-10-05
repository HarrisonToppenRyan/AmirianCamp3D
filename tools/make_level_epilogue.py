"""Builds level_edge.json and level_road.json: the two maps of the 2D game's Chapter 1 epilogue, in the format of
level.json (see make_level_rooms.py).
   python3 tools/make_level_epilogue.py

edge = Map 12 "DemoTransition": a clearing at the very edge of the North Forest round a lotus pond with three weeping
willows, a bushy meadow, and, cut off below a band of forest, the little hidden glade where Boudicca questions Anne.
road = Map 25 "DemoEndingLoop": the dirt road east through a green wood (the 2D map loops; here it is laid twice end to
end, which is as far as the two of them walk while they talk).

The 2D maps use tileset 2 ("Exterior"), which no other 3D level does; rather than map its tiles one by one, the walkable
layouts below are the ones read off the 2D maps (EPILOGUE_SPEC 1b, 1c: MV passage rules, flood-filled from the
arrival), and the decorations those maps draw are placed by hand from the same notes.
Letters: '#' forest, 'h' hedge wall (forest here), '~' water, 'x' open ground blocked by something standing on it,
'.' grass, 'b' bush (walkable, hides her legs: tall grass), ',' ground nobody reaches on foot (the hidden glade), ';'
dirt nobody reaches, ':' the dirt road. Marks are ground: '@' arrival, 'A' 'X' 'I' 'f' (the fire pit: blocked)."""
import json
EDGE = """\
#h#h#########.###
#h#,#########.###
#h#,#########@###
#xx~~~~~~~~~~.h##
x,x~~~~~~~~~..h##
x,,~~.f~~~~~..h##
bxxx..~~~~~......
bbbb........A.X.b
#bbbxbbbbbbbb.bbb
#bbbbbxxbbbxbb###
#################
#################
#################
#################
#################
#################
#################
#################
#################
#################
######,,,,,######
####,,,,,,,,,####
###,,,,,,,,,,,###
###,,,,,I,,,,,###
###,,,,,;,,,,,###
####,,,,,,,,,####
#################"""
# (the north-east corner, x 14-16 y 0-2, is canopy the 2D lets characters stand on: Boudicca's perch. Here it is forest;
#  story_edge.js gives her branches to crouch on. The hidden glade, rows 19-24, is drawn roomier than the 2D's (x 5-12,
#  y 20-23, an odd little shape): nobody walks there, and the scene's cameras need the room.)
ROAD = """\
########################
########################
########################
########################
####xxxxxx.~~###########
####...x.b.x~x#######xx#
####x...b...x.#######.x#
xx.x......b...x####xxbbx
:::::@:::::::::...bbb:::
b.b...b.......::::::::.b
###xbb..x....x....bbbb.#
###################bx.##
########################"""


def build(name, grid, objects, start, title, music, paths_out, path_tiles=(), tile=None, exits=()):
    rows = grid.split('\n'); h = len(rows); w = len(rows[0])
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    terrain, tall, walk = [], [], []
    for y, r in enumerate(rows):
        tr, tt, tw = '', '', ''
        for x, c in enumerate(r):
            if c in '#h': tr += '#'; tt += '.'; tw += '0'
            elif c == '~': tr += '~'; tt += '.'; tw += '0'
            elif c in 'xf': tr += 'g'; tt += '.'; tw += '0'
            elif c == 'b': tr += 'g'; tt += 't'; tw += '1'
            elif c in ':;': tr += 'd'; tt += '.'; tw += '1'
            else: tr += 'g'; tt += '.'; tw += '1'          # . , @ A X I
        terrain.append(tr); tall.append(tt); walk.append(tw)
    for (x, y) in path_tiles:
        terrain[y] = terrain[y][:x] + 'd' + terrain[y][x + 1:]
    obj = {k: [] for k in ('flowers', 'tree', 'conifer', 'lily', 'willow', 'fern', 'bush', 'rock', 'stump', 'totem', 'barrel', 'sapling', 'pumpkin', 'vine', 'hedge', 'bridge')}
    for k, v in objects.items(): obj[k] = [list(p) for p in v]
    lv = dict(name=name, glade=True, plateau=False, width=w, height=h, terrain=terrain, tallgrass=tall, walkable=walk, objects=obj,
              pumpkins_event=[], events=[], start=list(start), margin=4, pathsOut=paths_out, wraps=[], music=music, title=title, exits=list(exits))
    if tile: lv['tile'] = tile
    json.dump(lv, open('level_%s.json' % name, 'w'))
    print('==', name, '%dx%d' % (w, h), 'walkable', sum(r.count('1') for r in walk))
    for y in range(h): print('  ' + ''.join(('.' if walk[y][x] == '1' and terrain[y][x] == 'g' else terrain[y][x]) for x in range(w)) + '   ' + tall[y])


# ---------- the forest's edge ----------
build('edge', EDGE, {
    'willow': [(5, 4), (11, 5), (7, 6)],                 # in the water, crowns hanging over it
    'tree': [(2, 2), (1, 5)],                             # the two big round yellow-green trees of the west shore (2x2 each)
    'fern': [(0, 4), (2, 4), (0, 5), (1, 6), (2, 6), (4, 8), (1, 3)],
    'stump': [(3, 6)],                                    # the fallen log
    'sapling': [(6, 9), (7, 9), (11, 9)],                 # the tree line's three trunks on row 9
    'lily': [(3, 5), (4, 5), (6, 6), (8, 6), (10, 6), (10, 3), (4, 4), (9, 4), (8, 5)],
    'flowers': [(4, 6), (7, 7), (2, 7), (9, 7), (15, 7), (5, 21), (6, 20), (11, 21), (12, 23), (4, 23), (10, 24)],
    'rock': [(12, 21), (4, 22)],
    'bush': [(1, 3), (3, 21), (13, 22)],
}, (13, 2), "Forest's Edge", 'forest1.mp3', [[13, 'north']], path_tiles=[(13, 0), (13, 1), (13, 2), (13, 3), (13, 4), (13, 5), (13, 6), (12, 7), (13, 7)],
   # (after the chapter: the trail north goes back into the forest's lane, the meadow's east end on to the road)
   exits=[dict(tiles=[[13, 0]], to='forest', spawn=[50, 6], face='west'), dict(tiles=[[16, 6], [16, 7]], to='road', spawn=[1, 8], face='east')])

# ---------- the road out of the woods: the 2D strip twice, end to end ----------
road = '\n'.join(r + r for r in ROAD.replace('@', ':').split('\n'))      # (she arrives on the road itself)
O = {
    'tree': [(4, 4), (6, 4), (8, 4)],
    'sapling': [(10, 4), (3, 10), (13, 10)],
    'stump': [(12, 6), (11, 5)],                           # the fallen log; the dead trees' foot
    'rock': [(20, 7), (21, 5), (22, 6)],                   # the boulder, the foot of the little cliff
    'bush': [(0, 7), (1, 7), (3, 7), (7, 5), (13, 5), (4, 6), (14, 7), (19, 7), (23, 7), (8, 10), (20, 11), (22, 5)],
    'flowers': [(5, 5), (10, 5), (6, 6), (7, 6), (6, 7), (9, 7), (2, 9), (16, 9), (22, 10)],
    'fern': [(9, 5), (16, 7), (1, 9), (5, 10)],
}
for k in list(O): O[k] = O[k] + [(x + 24, y) for (x, y) in O[k]]
build('road', road, O, (5, 8), 'Forest Road', 'field1.mp3', [[8, 'west'], [8, 'east']], exits=[dict(tiles=[[0, 8], [0, 9]], to='edge', spawn=[15, 7], face='west'),
      # (10-05: Chapter 2) the road's east end goes on to the Trader Post
      dict(tiles=[[47, 8], [47, 9]], to='post', spawn=[10, 2], face='south')])
