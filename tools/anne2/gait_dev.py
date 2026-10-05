"""Quick look at the locomotion clips without rebuilding Anne: opens the stage-3 file, re-keys the clips with gait.py,
checks them on the meshes (do the feet stay on the ground, do they slide?) and renders contact sheets.

    Blender -b --python tools/anne2/gait_dev.py -- [--clips Walk,Run,Idle] [--views side,front] [--n 12] [--tag g]
"""
import bpy, sys, os, json, math, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
import gait; importlib.reload(gait)
from mathutils import Vector

a = C.argv(); arg = lambda n, d: a[a.index(n) + 1] if n in a else d
bpy.ops.wm.open_mainfile(filepath=os.path.join(C.ROOT, arg("--blend", "build/anne2_s3.blend")))
rig = bpy.data.objects["Anne_Rig"]; rig.data.pose_position = 'POSE'
shoes = [o for o in (bpy.data.objects.get("Anne_Heel_L"), bpy.data.objects.get("Anne_Heel_R")) if o]
TH = math.radians(json.load(open(os.path.join(C.ROOT, "build", "anne2_shoes.json")))["theta"])
clips = arg("--clips", "Walk,Jog,Run,Idle").split(","); views = arg("--views", "side,front").split(","); NS = int(arg("--n", "12")); tag = arg("--tag", "g")
log = lambda *x: (print("GAIT", *x), sys.stdout.flush())
ACT = {}
def new_action(name):
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act; ACT[name] = act
# --walk key=value,key=value / --run ...: try other numbers without editing gait.py
import ast
for flag, table_ in (("--walk", gait.WALK), ("--jog", gait.JOG), ("--run", gait.RUN)):
    for kv in [x for x in arg(flag, "").split(";") if x]:
        k, v = kv.split("=", 1); table_[k] = ast.literal_eval(v)
HI = None
_hs = [o for o in (bpy.data.objects.get("Anne_Shoe_heels_L"), bpy.data.objects.get("Anne_Shoe_heels_R")) if o]
if len(_hs) == 2:
    _st = json.load(open(os.path.join(C.ROOT, "build", "anne2_shoes.json"))).get("styles", {}).get("heels")
    if _st: HI = (_hs, math.radians(_st["theta_worn"]))
G = gait.build(rig, shoes, TH, new_action, log, only=clips, debug="--debug" in a, hi=HI)

sc = bpy.context.scene
def verts(o):
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); me = ev.to_mesh()
    pts = [o.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear(); return pts

# ---- checks on the meshes: lowest point of each shoe per frame, and how far its planted part moves against the ground
def tracked(o):
    """Two vertices of a shoe to follow: the tip of the heel and the sole under the toe joints (found in a flat frame)."""
    pts = verts(o); pb = rig.pose.bones["foot." + o.name[-1]]
    ih = min((i for i, p in enumerate(pts) if p.y > pb.head.y - 0.012), key=lambda i: pts[i].z)
    jy = sum(rig.pose.bones[t].head.y for t in G.toes[o.name[-1]]) / 5
    ib = min((i for i, p in enumerate(pts) if abs(p.y - jy) < 0.012), key=lambda i: pts[i].z)
    return ih, ib
for name in clips:
    if name not in ACT or name.startswith("Idle"): continue
    g = gait.RUN if name.startswith("Run") else gait.JOG if name.startswith("Jog") else gait.WALK
    f = G.foot_geo[not name.endswith("Bare")]
    rig.animation_data.action = ACT[name]
    N = int(round(ACT[name].frame_range[1] - ACT[name].frame_range[0])); low = {"L": [], "R": []}; worst = {"heel": 0.0, "ball": 0.0}; step = g["stride"] / N
    flat_frame = {"R": int(round(0.2 * N)) if not g["run"] else 1, "L": (int(round(0.2 * N)) + N // 2) % N if not g["run"] else 1 + N // 2}
    idx = {}
    for o in shoes:
        sc.frame_set(flat_frame[o.name[-1]] + 1); bpy.context.view_layer.update(); idx[o.name] = tracked(o)
    prev = {}
    for i in range(N + 1):
        sc.frame_set(i % N + 1); bpy.context.view_layer.update()
        for o in shoes:
            sd = o.name[-1]; pts = verts(o)
            if i < N: low[sd].append(min(p.z for p in pts))
            u = ((i % N) / N - (0.0 if sd == "R" else 0.5)) % 1.0
            mode = G.foot_at(g, f, sd, u)["mode"]
            ih, ib = idx[o.name]
            cur = (i, mode, pts[ih].y, pts[ib].y, pts[ih].z, pts[ib].z)
            pv = prev.get(sd)
            if pv and pv[0] == i - 1:
                if pv[1] in ("heel", "flat") and mode in ("heel", "flat"): worst["heel"] = max(worst["heel"], abs((cur[2] - pv[2]) - step))
                if pv[1] in ("flat", "toe") and mode in ("flat", "toe") and G.foot_at(g, f, sd, u)["toe"] == 0: worst["ball"] = max(worst["ball"], abs((cur[3] - pv[3]) - step))
            prev[sd] = cur
    log("%s on the meshes: lowest shoe point per frame (mm) R %s" % (name, " ".join("%.0f" % (1000 * z) for z in low["R"])))
    log("%s: deepest %.1f mm under the ground, highest lift %.0f mm | planted heel slides at most %.1f mm per frame, planted ball %.1f mm (the ground moves %.0f mm per frame)" % (
        name, -1000 * min(min(low["L"]), min(low["R"])), 1000 * max(max(low["L"]), max(low["R"])), 1000 * worst["heel"], 1000 * worst["ball"], 1000 * step))

if "--norender" in a: views = []
# ---- contact sheets
body = bpy.data.objects.get("Anne_Body")
if body: body.hide_render = True
for o in bpy.data.objects:
    if o.name in ("Anne_HeelProp",) or o.name.startswith(("Marker_", "Anne_Shoe_", "Anne_ShoeProp_")): o.hide_render = True      # (the other styles of shoe: she wears the first)
    elif o.type == 'MESH' and o is not body: o.hide_render = False
C.setup_stage()
# a floor to judge the contact against
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); floor = bpy.context.object; floor.name = "Gait_Floor"
floor.data.materials.append(C.make_material("Gait_FloorMat", "#8f9aa5", rough=0.9))
for name in clips:
    if name not in ACT: continue
    rig.animation_data.action = ACT[name]
    f0, f1 = ACT[name].frame_range; N = int(round(f1 - f0))
    for view in views:
        shots = []
        for k in range(NS):
            fr = 1 + k * N / NS
            sc.frame_set(int(fr), subframe=fr - int(fr)); bpy.context.view_layer.update()
            p = os.path.join(C.RENDERS, "%s_%s_%s_%02d.png" % (tag, name, view, k))
            if view == "side": C.shot(p, (4.6, -0.05, 0.95), (0, -0.05, 0.88), lens=70, res=(330, 560))
            elif view == "front": C.shot(p, (0.0, -4.6, 0.95), (0, 0, 0.88), lens=70, res=(330, 560))
            elif view == "back": C.shot(p, (0.0, 4.6, 0.95), (0, 0, 0.88), lens=70, res=(330, 560))
            elif view == "feet": C.shot(p, (1.6, -0.1, 0.16), (0, -0.05, 0.14), lens=60, res=(420, 300))
            elif view == "heels": C.shot(p, (0.55, 1.35, 0.22), (0.0, 0.05, 0.12), lens=60, res=(420, 300))      # low, behind her, from her left: as the foot cam sees her
            elif view == "legs": C.shot(p, (0.75, 1.9, 0.42), (0.0, 0.02, 0.3), lens=55, res=(420, 420))      # her lower legs from behind and to her left (crossing feet)
            elif view == "legsR": C.shot(p, (-0.75, 1.9, 0.42), (0.0, 0.02, 0.3), lens=55, res=(420, 420))
            elif view == "legsL": C.shot(p, (1.7, 0.05, 0.36), (0.0, 0.03, 0.3), lens=55, res=(420, 420))      # her lower legs from her left side
            elif view == "legsRs": C.shot(p, (-1.7, 0.05, 0.36), (0.0, 0.03, 0.3), lens=55, res=(420, 420))
            shots.append(p)
        C.montage(shots, os.path.join(C.RENDERS, "%s_%s_%s.png" % (tag, name, view)), cols=NS, cell=(420, 300) if view in ("feet", "heels") else (420, 420) if view.startswith("legs") else (330, 560))
        for p in shots: os.remove(p)
log("done")
