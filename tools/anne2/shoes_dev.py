"""Quick look at her shoes: opens the stage-3 file, stands her in Idle (or the rest pose), renders close views of her feet.

    Blender -b --python tools/anne2/shoes_dev.py -- [--tag sh] [--clip Idle] [--frame 1] [--bare]
"""
import bpy, sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
a = C.argv(); arg = lambda n, d: a[a.index(n) + 1] if n in a else d
bpy.ops.wm.open_mainfile(filepath=os.path.join(C.ROOT, "build/anne2_s3.blend"))
rig = bpy.data.objects["Anne_Rig"]; rig.data.pose_position = 'POSE'
clip = arg("--clip", "Idle"); act = bpy.data.actions.get(clip)
if act: rig.animation_data_create(); rig.animation_data.action = act
bpy.context.scene.frame_set(int(arg("--frame", "1"))); bpy.context.view_layer.update()
STYLE = arg("--style", "sandal")                    # which pair she wears (s2_sandals.STYLES): sandal flipflop tstrap slide heels pumps
info = json.load(open(os.path.join(C.ROOT, "build", "anne2_shoes.json"))).get("styles", {}).get(STYLE, {})
for o in bpy.data.objects:
    if o.name in ("Anne_HeelProp", "Anne_Body") or o.name.startswith("Marker_") or o.name.startswith("Anne_ShoeProp_"): o.hide_render = True
    elif o.name.startswith("Anne_Heel_"): o.hide_render = "--bare" in a or STYLE != "sandal"
    elif o.name.startswith("Anne_Shoe_"): o.hide_render = "--bare" in a or not o.name.startswith("Anne_Shoe_%s_" % STYLE)
if info.get("dtheta"):                               # a high heel: the game pitches her feet further and lifts her (anne_next.js); the same here
    from mathutils import Matrix
    pb = rig.pose.bones; th = math.radians(info["dtheta"])
    rig.animation_data.action = None; bpy.context.view_layer.update()      # (the pose stays; the action would put her feet back)
    for sd in "LR":
        f = pb["foot." + sd]
        loc = f.matrix.translation.copy(); R = Matrix.Translation(loc) @ Matrix.Rotation(th, 4, 'X') @ Matrix.Translation(-loc)
        f.matrix = R @ f.matrix; bpy.context.view_layer.update()
        for b in pb:
            if b.name.startswith("toe") and b.name.endswith("-1." + sd):
                l2 = b.matrix.translation.copy(); b.matrix = Matrix.Translation(l2) @ Matrix.Rotation(-th, 4, 'X') @ Matrix.Translation(-l2) @ b.matrix; bpy.context.view_layer.update()
    rig.location.z += info.get("lift", 0.0); bpy.context.view_layer.update()
C.setup_stage()
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); fl = bpy.context.object; fl.data.materials.append(C.make_material("Dev_Floor", "#8f9aa5", rough=0.9))
tag = arg("--tag", "sh"); cell = (520, 420); shots = []
views = {"front34": ((0.42, -0.62, 0.30), (0.02, -0.06, 0.05)), "outer": ((0.75, -0.08, 0.14), (0.1, -0.08, 0.05)), "back34": ((0.38, 0.55, 0.26), (0.03, -0.02, 0.05)),
         "top": ((0.05, -0.2, 0.75), (0.0, -0.09, 0.0)), "inner": ((-0.55, -0.3, 0.2), (0.1, -0.08, 0.05)), "low": ((0.3, -0.6, 0.06), (0.02, -0.06, 0.045))}
if "--macro" in a:
    cell = (900, 700)
    views = {"macro1": ((0.30, -0.33, 0.22), (0.10, -0.10, 0.045)), "macro2": ((0.36, 0.16, 0.20), (0.12, -0.01, 0.07))}
if "--ankle" in a:                                  # the ankle strap all the way round her left foot
    cell = (700, 560)
    views = {"ank_front": ((0.20, -0.42, 0.20), (0.10, -0.02, 0.10)), "ank_out": ((0.52, -0.05, 0.18), (0.10, -0.02, 0.10)),
             "ank_back": ((0.20, 0.40, 0.20), (0.10, -0.02, 0.10)), "ank_in": ((-0.30, -0.10, 0.20), (0.10, -0.02, 0.10))}
for name, (cam, look) in views.items():
    p = os.path.join(C.RENDERS, "%s_%s.png" % (tag, name)); C.shot(p, cam, look, lens=70, res=cell); shots.append(p)
C.montage(shots, os.path.join(C.RENDERS, "%s_feet.png" % tag), cols=3 if "--macro" not in a else 2, cell=cell)
for p in shots: os.remove(p)
print("SHOES done")
