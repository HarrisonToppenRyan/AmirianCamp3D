"""Measure what the game's scenes need to know about her legs (stage-3 file, rest pose): how far her skin stands from
the line of each leg bone (the tables SHIN_R and THIGH_R of captures.js), and how wide and deep her shin is above the
ankle (the coils, cuffs and cords round it are sized by that).

    Blender -b --python tools/anne2/measure.py
"""
import bpy, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import common as C
bpy.ops.wm.open_mainfile(filepath=os.path.join(C.ROOT, "build/anne2_s3.blend"))
rig = bpy.data.objects["Anne_Rig"]; rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
def pts(name):
    o = bpy.data.objects[name]; ev = o.evaluated_get(dg); me = ev.to_mesh(); P = [o.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear(); return P
# (the export meshes: the skin as the game shows it, one or two levels of subdivision finer than Anne_Body)
body = [p for n in ("Anne_Skin", "Anne_Feet") if bpy.data.objects.get(n) for p in pts(n) if p.x > 0.0] or [p for p in pts("Anne_Body") if p.x > 0.0]
B = rig.data.bones
hip = B["upperleg01.L"].head_local; knee = B["lowerleg01.L"].head_local; ank = B["foot.L"].head_local
print("MEAS thigh %.3f shin %.3f" % ((knee - hip).length, (ank - knee).length))
def ring(a, b, t, half=0.010):
    c = a.lerp(b, t); ax = (b - a).normalized(); rs = []
    for p in body:
        d = p - c; s = d.dot(ax)
        if abs(s) < half:
            q = d - ax * s
            if q.length < 0.15: rs.append((q.length, q.x, q.y))
    return rs
def table(a, b, ts):
    out = []
    for t in ts:
        rs = ring(a, b, t); out.append([t, round(max(r[0] for r in rs), 4)] if rs else [t, None])
    return out
print("MEAS SHIN_R (ankle 0 .. knee 1):", table(ank, knee, (0, 0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1)))
print("MEAS THIGH_R (knee 0 .. hip 1):", table(knee, hip, (0, 0.05, 0.15, 0.3, 0.45, 0.6)))
def table4(a, b, ts):
    """[t, outer side, inner side, back, front]: how far the skin reaches from the bone line in each of the four directions
    (x = out to her left side for this left leg, y = back): a coil wound round her leg follows these, not the furthest point."""
    out = []
    for t in ts:
        rs = ring(a, b, t)
        if not rs: out.append([t, None, None, None, None]); continue
        out.append([t, round(max(r[1] for r in rs), 4), round(-min(r[1] for r in rs), 4), round(max(r[2] for r in rs), 4), round(-min(r[2] for r in rs), 4)])
    return out
print("MEAS SHIN_E (ankle 0 .. knee 1):", table4(ank, knee, (0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1)))
print("MEAS THIGH_E (knee 0 .. hip 1):", table4(knee, hip, (0, 0.05, 0.15, 0.3, 0.45, 0.6)))
L = (ank - knee).length
for d in (0.03, 0.05, 0.07, 0.09):                       # so far above the ankle joint, along the shin
    rs = ring(ank, knee, d / L, 0.006)
    print("MEAS shin %.0f mm above the ankle: across %.4f .. %.4f (half %.4f), deep %.4f .. %.4f (half %.4f), furthest %.4f" % (
        1000 * d, min(r[1] for r in rs), max(r[1] for r in rs), (max(r[1] for r in rs) - min(r[1] for r in rs)) / 2,
        min(r[2] for r in rs), max(r[2] for r in rs), (max(r[2] for r in rs) - min(r[2] for r in rs)) / 2, max(r[0] for r in rs)))
t1 = B["toe1-1.L"]; a = t1.head_local; b = t1.tail_local; ax = (b - a).normalized()
near = [p for p in body if abs((p - a).dot(ax) - 0.006) < 0.004 and ((p - a) - ax * (p - a).dot(ax)).length < 0.03]
print("MEAS big toe at its root: across %.4f, high %.4f (n %d)" % (max(p.x for p in near) - min(p.x for p in near), max(p.z for p in near) - min(p.z for p in near), len(near)))
print("MEAS done")
