"""Quick look at the story's pose clips without rebuilding Anne: opens the stage-3 file, keys the clips with poses.py,
reports what touches the ground, and renders contact sheets.

    Blender -b --python tools/anne2/poses_dev.py -- [--clips VineHeld,HeldProne] [--views side,34,top] [--n 3] [--tag p]

Sheets go to build/renders/<tag>_<Clip>.png (one row per view). Nothing is saved or exported.
"""
import bpy, sys, os, json, math, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
import gait; importlib.reload(gait)
import poses; importlib.reload(poses)

a = C.argv(); arg = lambda n, d: a[a.index(n) + 1] if n in a else d
bpy.ops.wm.open_mainfile(filepath=os.path.join(C.ROOT, arg("--blend", "build/anne2_s3.blend")))
rig = bpy.data.objects["Anne_Rig"]; rig.data.pose_position = 'POSE'
body = bpy.data.objects["Anne_Body"]; body.hide_set(False); body.hide_viewport = False          # (the stage-3 file keeps it hidden; the poses are measured on it)
shoes = [o for o in (bpy.data.objects.get("Anne_Heel_L"), bpy.data.objects.get("Anne_Heel_R")) if o]
suit = bpy.data.objects.get("Anne_Suit")
TH = math.radians(json.load(open(os.path.join(C.ROOT, "build", "anne2_shoes.json")))["theta"])
clips = arg("--clips", ",".join(poses.ALL)).split(","); views = arg("--views", "side,34,top").split(","); NS = int(arg("--n", "3")); tag = arg("--tag", "p")
log = lambda *x: (print("POSES", *x), sys.stdout.flush())
ACT = {}
def new_action(name):
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act; ACT[name] = act
# the heavy export meshes are not needed while keying
heavy = [o for o in bpy.data.objects if o.type == 'MESH' and o.name in ("Anne_Head", "Anne_Skin", "Anne_Feet")]
for o in heavy: o.hide_viewport = True
S = poses.build(rig, body, shoes, suit, TH, new_action, log, only=clips)
for o in heavy: o.hide_viewport = False

sc = bpy.context.scene
STANDING = ("Startle", "Point", "Cast", "ThiefIdle", "MycHeld", "MycHeldOut")
BARE = ("VineHeld", "SitFlat", "HeldBack", "HeldProne", "StuckFlat", "StuckFlatTickled", "StuckFlatStrain", "CampSleep", "CampSit", "CampWake", "CampLie", "HoleTease", "HoleTickled", "HoleBound", "HoleKickout", "PumpkinSeat", "PumpkinHeld", "PumpkinHigh", "IvyLegUp", "IvyLegUpTickled", "IvyWorship", "MycHeld", "MycHeldOut", "AlrHeld", "AlrHeldTickled", "NailShow")
# ---- what touches the ground in each clip
for name in clips:
    if name not in ACT: continue
    rig.animation_data.action = ACT[name]
    f0, f1 = ACT[name].frame_range; rows = []
    for fr in sorted({int(f0), int((f0 + f1) / 2), int(f1)}):
        sc.frame_set(fr); bpy.context.view_layer.update()
        objs = [body] + ([] if name in BARE else shoes) + ([suit] if suit else [])
        low = min(p.z for o in objs for p in poses.verts(o))
        wr = [rig.pose.bones["wrist." + s].head.z for s in "LR"]; hd = rig.pose.bones["head"].tail.z
        rows.append("f%d lowest %.0f mm, wrists %.0f / %.0f mm, head top %.2f m" % (fr, 1000 * low, 1000 * wr[0], 1000 * wr[1], hd))
    log("%s (%.2f s): %s" % (name, (f1 - f0) / 24.0, " | ".join(rows)))
    if name == "NailShow":
        sc.frame_set(int(f0)); bpy.context.view_layer.update()
        pb = rig.pose.bones; W = rig.matrix_world
        def at(n, tail=False): v = W @ (pb[n].tail if tail else pb[n].head); return "(%.3f, %.3f, %.3f)" % (v.x, v.y, v.z)
        log("NailShow f%d: big toe R %s L %s, little toe R %s L %s, ankle R %s, head %s, head top %s, knee R %s" % (f0, at("toe1-1.R", True), at("toe1-1.L", True), at("toe5-1.R", True), at("toe5-1.L", True), at("foot.R"), at("head"), at("head", True), at("lowerleg01.R")))

if "--norender" in a: views = []
# ---- contact sheets
body.hide_render = True
for o in bpy.data.objects:
    if o.name in ("Anne_HeelProp",) or o.name.startswith(("Marker_", "Anne_Shoe_", "Anne_ShoeProp_")): o.hide_render = True      # (the other styles of shoe: she wears the first)
    elif o.type == 'MESH' and o is not body: o.hide_render = False
C.setup_stage()
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0)); floor = bpy.context.object; floor.name = "Pose_Floor"
floor.data.materials.append(C.make_material("Pose_FloorMat", "#8f9aa5", rough=0.9))
for name in clips:
    if name not in ACT: continue
    rig.animation_data.action = ACT[name]
    f0, f1 = ACT[name].frame_range; N = int(round(f1 - f0))
    for o in shoes: o.hide_render = name in BARE
    for o in bpy.data.objects:
        if o.name in ("Anne_Hat", "Anne_HatBand"): o.hide_render = name in poses.HATLESS
    stand = name in STANDING; cell = (330, 560) if stand else (520, 380)
    hole = name.startswith("Hole"); floor.location.z = -1.25 if hole else (-poses.PUMPKIN_SEAT if name == "PumpkinSeat" else 0.0)
    if hole: cell = (300, 560)
    shots = []
    for view in views:
        for k in range(NS):
            fr = 1 + k * N / NS if N else 1
            sc.frame_set(int(fr), subframe=fr - int(fr)); bpy.context.view_layer.update()
            p = os.path.join(C.RENDERS, "%s_%s_%s_%02d.png" % (tag, name, view, k))
            if hole:                                      # the whole figure, the ground (her waist) at z = 0
                if view == "side": C.shot(p, (5.2, 0.0, -0.1), (0, 0.0, -0.18), lens=70, res=cell)
                elif view == "back": C.shot(p, (0.0, 5.2, -0.1), (0, 0.0, -0.18), lens=70, res=cell)
                elif view == "34": C.shot(p, (3.6, -3.7, 0.1), (0, 0.0, -0.18), lens=70, res=cell)
                else: C.shot(p, (0.0, -5.2, -0.1), (0, 0, -0.18), lens=70, res=cell)
            elif stand:
                if view == "side": C.shot(p, (4.6, -0.05, 0.95), (0, -0.05, 0.88), lens=70, res=cell)
                elif view == "top": C.shot(p, (0.0, -0.4, 5.2), (0, -0.1, 0.9), lens=70, res=cell)
                elif view == "34": C.shot(p, (3.3, -3.3, 1.3), (0, -0.05, 0.9), lens=70, res=cell)
                elif view == "hip": C.shot(p, (1.5, -1.5, 1.15), (0.12, 0.0, 1.0), lens=110, res=cell)       # close on her left hip (a hand on it)
                elif view == "pit2": C.shot(p, (0.75, -1.1, 1.36), (0.13, -0.06, 1.30), lens=300, res=(900, 760))       # very close on the front of her left armpit
                elif view == "pit": C.shot(p, (1.0, -1.1, 1.42), (0.16, -0.02, 1.36), lens=120, res=cell)       # close on her left armhole (the suit's edge under the arm)
                elif view == "pitf": C.shot(p, (0.25, -1.5, 1.42), (0.14, -0.02, 1.36), lens=120, res=cell)
                elif view == "hipf": C.shot(p, (0.25, -2.2, 1.05), (0.12, 0.0, 1.0), lens=110, res=cell)
                elif view == "hipb": C.shot(p, (1.2, 1.9, 1.15), (0.12, 0.0, 1.0), lens=110, res=cell)
                else: C.shot(p, (0.0, -4.6, 0.95), (0, 0, 0.88), lens=70, res=cell)
            else:
                if view == "side": C.shot(p, (4.6, -0.2, 0.55), (0, -0.2, 0.42), lens=58, res=cell)
                elif view == "top": C.shot(p, (0.0, -0.3, 5.0), (0, -0.2, 0.0), lens=60, res=cell)
                elif view == "34": C.shot(p, (3.0, -3.4, 1.5), (0, -0.2, 0.38), lens=58, res=cell)
                elif view == "feet": C.shot(p, (0.5, -2.6, 0.75), (0, -0.7, 0.5), lens=85, res=cell)
                elif view == "rear": C.shot(p, (0.25, 2.5, 1.25), (0, 0.75, 0.1), lens=70, res=cell)      # from behind and above her feet (prone clips)
                elif view == "soles": C.shot(p, (0.12, 1.75, 0.5), (0, 0.95, 0.1), lens=90, res=cell)
                elif view == "footside": C.shot(p, (1.5, 1.25, 0.3), (0, 0.9, 0.08), lens=100, res=cell)   # her feet from her left, low
                elif view == "foot34": C.shot(p, (0.9, 1.9, 0.7), (0, 0.95, 0.06), lens=100, res=cell)
                elif view == "nails": C.shot(p, (0.10, -1.12, 0.66), (0.06, -0.62, 0.34), lens=19.5, res=cell)       # the chooser's camera: close in front of her toes and above them (68 degrees high)
                else: C.shot(p, (0.0, -4.6, 0.6), (0, 0, 0.42), lens=58, res=cell)
            shots.append(p)
    C.montage(shots, os.path.join(C.RENDERS, "%s_%s.png" % (tag, name)), cols=NS, cell=cell)
    for p in shots: os.remove(p)
log("done")
