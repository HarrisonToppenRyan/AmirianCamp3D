"""Feasibility probe: how far can MakeHuman targets be pushed towards a stylised (animated-film) face?"""
import bpy, os, sys, math, addon_utils
from mathutils import Vector

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService

OUT = "/private/tmp/claude-501/-Users-harrisontoppenryan/37295956-7e5f-4f0c-8919-8f8a5e5681d7/scratchpad/probe/"
os.makedirs(OUT, exist_ok=True)
SYS = LocationService.get_mpfb_data(); USR = LocationService.get_user_data()
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
K = float(argv[0]) if argv else 1.0          # overall stylisation strength
TAG = argv[1] if len(argv) > 1 else "a"

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
sc = bpy.context.scene

MACRO = {'gender': 0.0, 'age': 0.5, 'muscle': 0.4, 'weight': 0.38, 'proportions': 1.0, 'height': 0.5, 'cupsize': 0.5, 'firmness': 0.7,
         'race': {'asian': 0.2, 'caucasian': 0.7, 'african': 0.1}}
body = HumanService.create_human(macro_detail_dict=MACRO, scale=0.1, feet_on_ground=True)
body.name = "P_Body"

# (target, weight at K = 1). Weights above 1 extrapolate the target.
FACE = [
    ("eyes/l-eye-scale-incr", 2.2), ("eyes/r-eye-scale-incr", 2.2),
    ("eyes/l-eye-height2-incr", 0.8), ("eyes/r-eye-height2-incr", 0.8),
    ("eyes/l-eye-corner2-up", 0.5), ("eyes/r-eye-corner2-up", 0.5),
    ("eyes/l-eye-trans-down", 0.6), ("eyes/r-eye-trans-down", 0.6),
    ("eyes/l-eye-trans-out", 0.5), ("eyes/r-eye-trans-out", 0.5),
    ("eyes/l-eye-bag-decr", 1.0), ("eyes/r-eye-bag-decr", 1.0),
    ("head/head-round", 0.9), ("head/head-scale-horiz-incr", 0.8), ("head/head-scale-vert-incr", 0.5), ("head/head-scale-depth-incr", 0.7),
    ("forehead/forehead-scale-vert-incr", 0.4),
    ("nose/nose-scale-horiz-decr", 1.0), ("nose/nose-scale-vert-decr", 0.9), ("nose/nose-scale-depth-decr", 0.8),
    ("nose/nose-point-up", 0.7), ("nose/nose-volume-decr", 0.8), ("nose/nose-nostrils-width-decr", 0.8), ("nose/nose-hump-decr", 0.8),
    ("mouth/mouth-scale-horiz-decr", 0.5), ("mouth/mouth-upperlip-volume-incr", 0.5), ("mouth/mouth-lowerlip-volume-incr", 0.7),
    ("mouth/mouth-cupidsbow-incr", 0.5), ("mouth/mouth-angles-up", 0.5), ("mouth/mouth-trans-up", 0.3),
    ("chin/chin-width-decr", 1.0), ("chin/chin-height-decr", 0.7), ("chin/chin-prominent-decr", 0.5), ("chin/chin-jaw-drop-decr", 0.6), ("chin/chin-triangle", 0.5),
    ("cheek/l-cheek-volume-incr", 0.6), ("cheek/r-cheek-volume-incr", 0.6), ("cheek/l-cheek-bones-decr", 0.6), ("cheek/r-cheek-bones-decr", 0.6),
    ("neck/neck-scale-horiz-decr", 0.9), ("neck/neck-scale-depth-decr", 0.9), ("neck/measure-neck-height-incr", 0.5),
    ("ears/l-ear-scale-decr", 0.4), ("ears/r-ear-scale-decr", 0.4),
    ("torso/measure-shoulder-dist-decr", 0.7), ("torso/measure-waist-circ-decr", 0.8),
    ("legs/upperlegs-height-incr", 0.6), ("legs/lowerlegs-height-incr", 0.6),
    ("arms/l-upperarm-fat-decr", 0.6), ("arms/r-upperarm-fat-decr", 0.6), ("arms/l-lowerarm-fat-decr", 0.5), ("arms/r-lowerarm-fat-decr", 0.5),
    ("hands/l-hand-scale-decr", 0.4), ("hands/r-hand-scale-decr", 0.4),
    ("feet/l-foot-scale-decr", 0.3), ("feet/r-foot-scale-decr", 0.3),
]
missing = []
for t, v in FACE:
    p = os.path.join(SYS, "targets", t + ".target.gz")
    if not os.path.exists(p): missing.append(t); continue
    TargetService.load_target(body, p, weight=0.0)
for kb in body.data.shape_keys.key_blocks:
    kb.slider_max = 4.0; kb.slider_min = -1.0
for t, v in FACE:
    name = TargetService.filename_to_shapekey_name(t + ".target.gz") if hasattr(TargetService, "filename_to_shapekey_name") else None
kbs = body.data.shape_keys.key_blocks
names = [k.name for k in kbs]
applied = 0
for t, v in FACE:
    short = t.split("/")[1]
    k = kbs.get(short) or next((kb for kb in kbs if kb.name.endswith(short)), None)
    if k is None: missing.append("key:" + short); continue
    k.value = v * K; applied += 1
print("PROBE applied", applied, "missing", missing)

HumanService.add_builtin_rig(body, "default")
rig = body.parent
for rel in ("eyes/high-poly/high-poly.mhclo", "eyelashes/eyelashes02/eyelashes02.mhclo", "eyebrows/eyebrow001/eyebrow001.mhclo"):
    HumanService.add_mhclo_asset(os.path.join(USR, rel), body, asset_type=rel.split("/")[0].capitalize(), subdiv_levels=0, material_type="MAKESKIN")
HumanService.refit(body)

# preview materials: smooth peach skin with subsurface, no texture
def mat(name, col, rough=0.5, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs["Base Color"].default_value = col; b.inputs["Roughness"].default_value = rough
    try:
        b.inputs["Subsurface Weight"].default_value = sss; b.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2); b.inputs["Subsurface Scale"].default_value = 0.01
    except Exception: pass
    return m
skin = mat("P_Skin", (0.93, 0.66, 0.52, 1), 0.45, 0.6)
body.data.materials.clear(); body.data.materials.append(skin)
for p in body.data.polygons: p.use_smooth = True
sd = body.modifiers.new("Sub", "SUBSURF"); sd.levels = 1; sd.render_levels = 1
print("PROBE height", round(body.dimensions.z, 3), "children", [c.name for c in rig.children])

# light + camera
def look(cam, loc, tgt):
    cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); sc.collection.objects.link(cam); sc.camera = cam
for nm, e, rot in (("Key", 3.0, (math.radians(55), 0, math.radians(35))), ("Fill", 1.2, (math.radians(60), 0, math.radians(-70)))):
    l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN")); l.data.energy = e; l.rotation_euler = rot; sc.collection.objects.link(l)
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.82, 0.9, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
eng = [e.identifier for e in sc.render.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else sc.render.engine
sc.render.resolution_x, sc.render.resolution_y = 560, 640
bpy.context.view_layer.update()
head = rig.matrix_world @ rig.pose.bones["head"].head
hz = head.z + 0.09
cam.data.lens = 85
look(cam, (0.05, -1.1, hz + 0.02), (0, 0, hz)); sc.render.filepath = OUT + f"face_{TAG}_front.png"; bpy.ops.render.render(write_still=True)
look(cam, (0.75, -0.85, hz + 0.05), (0, -0.03, hz)); sc.render.filepath = OUT + f"face_{TAG}_34.png"; bpy.ops.render.render(write_still=True)
cam.data.lens = 50; sc.render.resolution_x, sc.render.resolution_y = 420, 760
look(cam, (0.6, -3.9, 0.95), (0, 0, 0.83)); sc.render.filepath = OUT + f"body_{TAG}.png"; bpy.ops.render.render(write_still=True)
print("PROBE done", TAG)
