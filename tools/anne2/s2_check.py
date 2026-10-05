"""Stage-2 check renders (the dressed character in the fit-test poses).

    Blender -b --python tools/anne2/s2_check.py -- [--parts outfit,hair,shoes] [--views face,head,body,poses,feet] [--tag s2] [--out DIR]

Opens build/anne2_s1.blend, runs the stage-2 builders, shows her as the game will (covered skin hidden, one level of
subdivision) and writes build/renders/<tag>_*.png plus a contact sheet <tag>_sheet.png. Nothing is saved.
"""
import bpy, sys, os, math, importlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C

a = C.argv()
arg = lambda n, d: a[a.index(n) + 1] if n in a else d
parts = [p for p in arg("--parts", "outfit,hair,shoes").split(",") if p and p != "none"]
views = arg("--views", "face,head,body,poses").split(",")
tag = arg("--tag", "s2"); out = arg("--out", C.RENDERS)

ctx = C.open_s1()
for p in parts:
    importlib.import_module("s2_" + p).build(ctx)
body, rig = ctx["body"], ctx["rig"]
if body.vertex_groups.get("hidden"):
    m = body.modifiers.new("HideCovered", "MASK"); m.vertex_group = "hidden"; m.invert_vertex_group = True
C.setup_stage()
if "--heels" in a:                                   # stand her in her shoes (foot pitch from the shoes stage)
    import s2_shoes
    s2_shoes.pose_in_heels(ctx)
    if body.vertex_groups.get("shod"):               # the game hides the skin inside the shoes while they are on
        m = body.modifiers.new("HideShod", "MASK"); m.vertex_group = "shod"; m.invert_vertex_group = True

C.add_subsurf(body, 1)
shots = []
bone = lambda n: np.array(rig.pose.bones[n].head)

def shot(name, loc, target, lens=50, res=(560, 700), pose="rest", rel=None):
    if pose is not None:
        C.test_pose(rig, pose)
        if "--heels" in a and pose in ("a", "rest"):
            s2_shoes.pose_in_heels(ctx, reset=False)
    if rel is not None:                               # camera relative to a bone (poses that move her)
        target = bone(rel) + np.array(target); loc = target + np.array(loc)
    path = os.path.join(out, f"{tag}_{name}.png")
    C.shot(path, tuple(loc), tuple(target), lens=lens, res=res); shots.append(path)

if "face" in views:
    shot("face_front", (0, -0.95, 1.585), (0, 0, 1.585), lens=85, res=(600, 700))
    shot("face_34", (0.62, -0.78, 1.60), (0, -0.03, 1.585), lens=85, res=(600, 700))
    shot("face_game", (0.0, -1.55, 2.45), (0, -0.05, 1.56), lens=85, res=(600, 700))
if "head" in views:
    shot("head_side", (1.1, -0.05, 1.56), (0, -0.03, 1.56), lens=85, res=(600, 700))
    shot("head_back", (0.3, 1.15, 1.52), (0, 0, 1.50), lens=85, res=(600, 700))
if "body" in views:
    shot("body_front", (0, -3.7, 1.0), (0, 0, 0.90), res=(480, 760), pose="a")
    shot("body_34", (2.2, -2.9, 1.2), (0, 0, 0.90), res=(480, 760), pose="a")
    shot("body_back", (0.6, 3.6, 1.1), (0, 0, 0.90), res=(480, 760), pose="a")
if "suit" in views:
    shot("suit_front", (0.55, -1.25, 1.34), (0, 0, 1.20), lens=70, res=(600, 700), pose="a")
    shot("suit_side", (1.4, -0.1, 1.2), (0, 0, 1.15), lens=70, res=(600, 700), pose="a")
    shot("suit_back", (0.5, 1.3, 1.02), (0, 0, 0.96), lens=70, res=(600, 700), pose="a")
if "poses" in views:
    shot("pose_walk", (2.4, -2.7, 1.1), (0, 0, 0.9), res=(480, 760), pose="b")
    shot("pose_turn", (0.45, -1.05, 0.12), (0, 0, 0.02), lens=70, res=(600, 700), pose="c", rel="head")
    shot("pose_prone", (1.7, -1.1, 0.75), (0, 0.45, -0.1), lens=50, res=(760, 480), pose="d", rel="head")
    shot("pose_prone_front", (0.3, -1.0, 0.22), (0, 0, 0.03), lens=70, res=(700, 520), pose="d", rel="head")
if "feet" in views:
    shot("feet_34", (0.62, -0.62, 0.30), (0.05, -0.08, 0.05), lens=60, res=(720, 480), pose="a")
    shot("feet_side", (0.9, -0.09, 0.10), (0.14, -0.09, 0.05), lens=85, res=(720, 480), pose="a")
    shot("feet_front", (0.0, -0.9, 0.22), (0.0, -0.1, 0.05), lens=70, res=(720, 480), pose="a")
    shot("feet_back", (0.25, 0.8, 0.16), (0.0, 0.0, 0.05), lens=70, res=(720, 480), pose="a")
    shot("feet_top", (0.14, -0.20, 0.75), (0.14, -0.09, 0.03), lens=85, res=(560, 600), pose="a")
if shots:
    C.montage(shots, os.path.join(out, tag + "_sheet.png"), cols=int(arg("--cols", "4")), cell=(480, 600))
if "--save" in a:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(C.BUILD, "anne2_s2.blend"), copy=True)
print("S2 | check done:", len(shots), "renders")
