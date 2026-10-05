
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
def toe_protrusion_test(action="Idle", frame=1, tmin=0.62, verbose=True):
    rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]; sc = bpy.context.scene
    info = eval(bpy.data.texts["anne_heel_info"].as_string())
    B = rig.data.bones
    bodyg = body.vertex_groups["body"].index
    masks = [m for m in body.modifiers if m.type == 'MASK']
    for m in masks: m.show_viewport = False
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); me = ev.to_mesh(); REST = [v.co.copy() for v in me.vertices]; ev.to_mesh_clear()
    rig.data.pose_position = 'POSE'
    rig.animation_data.action = bpy.data.actions[action]; sc.frame_set(frame); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); me = ev.to_mesh(); POSED = [body.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear()
    for m in masks: m.show_viewport = True
    res = {}
    for side in ("L", "R"):
        I = info[side]; L = I["L"]; sx = 1 if B[f"foot.{side}"].head_local.x > 0 else -1
        cand = [v.index for v in body.data.vertices
                if any(g.group == bodyg and g.weight > 0.5 for g in v.groups)
                and REST[v.index].x * sx > 0.02 and REST[v.index].z < 0.08 and (I["heel_y"] - REST[v.index].y) / L > tmin]
        shoe = bpy.data.objects[f"Anne_Heel_{side}"]; sd = shoe.modifiers.get("Solid")
        if sd: sd.show_viewport = False
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        sev = shoe.evaluated_get(dg); sm = sev.to_mesh()
        verts = [shoe.matrix_world @ v.co for v in sm.vertices]; polys = [list(p.vertices) for p in sm.polygons]; sev.to_mesh_clear()
        if sd: sd.show_viewport = True
        bvh = BVHTree.FromPolygons(verts, polys)
        out = []
        for i in cand:
            p = POSED[i]; loc, nrm, idx, dist = bvh.find_nearest(p, 0.1)
            if loc is not None and (p - loc).dot(nrm) > 0.0: out.append((dist, (I["heel_y"] - REST[i].y) / L, REST[i]))
        out.sort(key=lambda t: -t[0]); res[side] = out
        if verbose:
            print(side, "toe-box skin verts", len(cand), "poking out", len(out),
                  [(round(d * 1000, 1), round(t, 2), round(r.x, 3), round(r.z, 3)) for d, t, r in out[:6]])
    return res
