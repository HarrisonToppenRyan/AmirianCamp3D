"""Check renders of her facial expressions, from the stage-3 file.

    Blender -b --python tools/anne2/s3_faces.py -- [--blend build/anne2_s3.blend] [--tag s3] [--only name,name]

Sets the same expression weights the game uses (the table below mirrors EXPR in anne_next.js) and renders each one
from the front and at three quarters into build/renders/<tag>_faces.png.
"""
import bpy, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C

a = C.argv(); arg = lambda n, d: a[a.index(n) + 1] if n in a else d
bpy.ops.wm.open_mainfile(filepath=os.path.join(C.ROOT, arg("--blend", "build/anne2_s3.blend")))
EXPR = {
    "neutral": {"mouth-corner-puller": .22},
    "blink": {"eye-left-closure": 1, "eye-right-closure": 1},
    "half blink": {"eye-left-closure": .5, "eye-right-closure": .5},
    "smile": {"mouth-corner-puller": .7, "eye-left-slit": .25, "eye-right-slit": .25},
    "smug": {"mouth-corner-puller": .5, "eye-left-slit": .5, "eye-right-slit": .5, "eyebrows-left-up": .4, "eyebrows-right-down": .2},
    "shocked": {"eye-left-opened-up": 1, "eye-right-opened-up": 1, "eyebrows-left-up": 1, "eyebrows-right-up": 1, "eyebrows-left-inner-up": .5, "eyebrows-right-inner-up": .5, "mouth-open": .65, "mouth-retraction": .25},
    "angry": {"eyebrows-left-down": 1, "eyebrows-right-down": 1, "eye-left-slit": .45, "eye-right-slit": .45, "mouth-retraction": .45, "mouth-compression": .2, "nose-left-elevation": .4, "nose-right-elevation": .4, "mouth-open": .12},
    "embarrassed": {"mouth-corner-puller": .35, "eyebrows-left-inner-up": .7, "eyebrows-right-inner-up": .7, "eye-left-slit": .3, "eye-right-slit": .3, "mouth-compression": .2},
    "strain": {"eye-left-closure": .7, "eye-right-closure": .7, "eyebrows-left-down": .6, "eyebrows-right-down": .6, "mouth-retraction": .6, "mouth-compression": .4, "nose-left-elevation": .3, "nose-right-elevation": .3},
    "laugh": {"mouth-corner-puller": 1, "mouth-open": .5, "mouth-parling": .5, "eye-left-closure": .7, "eye-right-closure": .7, "eyebrows-left-inner-up": .45, "eyebrows-right-inner-up": .45},
    "laughHard": {"mouth-corner-puller": 1, "mouth-open": .62, "mouth-elevation": .3, "eye-left-closure": 1, "eye-right-closure": 1, "eyebrows-left-inner-up": .75, "eyebrows-right-inner-up": .75, "nose-left-elevation": .3, "nose-right-elevation": .3},
    "pout": {"mouth-pursing": .7, "eyebrows-left-down": .3, "eyebrows-right-down": .3, "eye-left-slit": .2, "eye-right-slit": .2, "mouth-depression": .2},
}
only = arg("--only", "")
names = [n for n in EXPR if not only or n in only.split(",")]
rig = bpy.data.objects["Anne_Rig"]; rig.data.pose_position = 'REST'
body = bpy.data.objects.get("Anne_Body")
if body: body.hide_render = True
for o in bpy.data.objects:
    if o.name in ("Anne_HeelProp",) or o.name.startswith("Marker_"): o.hide_render = True
    elif o.type == 'MESH' and o is not body: o.hide_render = False
for n in [x for x in arg("--hide", "").split(",") if x]:
    if bpy.data.objects.get(n): bpy.data.objects[n].hide_render = True
objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys and o is not body]
ZOOM = "--zoom" in a

def set_expr(e):
    for o in objs:
        for kb in o.data.shape_keys.key_blocks:
            if kb.name == "Basis": continue
            v = e.get(kb.name, 0.0)
            if kb.name.endswith("closure-mid"):
                c = e.get(kb.name[:-4], 0.0); v = 4 * c * (1 - c)
            kb.slider_max = 5.0; kb.value = v

C.setup_stage()
shots = []
tag = arg("--tag", "s3")
for n in names:
    set_expr(EXPR[n])
    for view, loc in (("f", (0.0, -0.98, 1.56)), ("q", (0.60, -0.80, 1.57))):
        p = os.path.join(C.RENDERS, f"{tag}_face_{n.replace(' ', '_')}_{view}.png")
        if ZOOM: C.shot(p, (loc[0] * 0.5, loc[1] * 0.5, 1.50), (0, -0.12, 1.485), lens=85, res=(420, 440))
        else: C.shot(p, loc, (0, -0.03, 1.545), lens=85, res=(420, 440))
        shots.append(p)
C.montage(shots, os.path.join(C.RENDERS, tag + "_faces.png"), cols=6, cell=(420, 440))
print("S3F | rendered", len(shots))
