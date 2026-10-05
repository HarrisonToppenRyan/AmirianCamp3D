
import bpy, bmesh, math
from mathutils import Vector
def build_pumps(EXT=0.022, TIPW=0.5, SHIFT=0.30, TIPH=0.35, MARGIN=0.005, TOPM=0.007):
    rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]; col = bpy.data.collections["Anne"]
    for n in [o.name for o in col.objects if o.name.startswith("Anne_Heel")]:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
    PAT = bpy.data.materials["Anne_HeelPurple"]; SOLE = bpy.data.materials["Anne_HeelSole"]
    B = rig.data.bones; BONES = {b.name for b in B}
    masks = [m for m in body.modifiers if m.type == 'MASK']
    for m in masks: m.show_viewport = False
    rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); em = ev.to_mesh()
    CO = [v.co.copy() for v in em.vertices]; ev.to_mesh_clear()
    for m in masks: m.show_viewport = True
    gname = {g.index: g.name for g in body.vertex_groups}; bodyg = body.vertex_groups["body"].index
    dom, isb = [], []
    for v in body.data.vertices:
        gs = [g for g in v.groups if gname[g.group] in BONES]
        dom.append(gname[max(gs, key=lambda g: g.weight).group] if gs else "")
        isb.append(any(g.group == bodyg and g.weight > 0.5 for g in v.groups))
    HEEL_H = 0.065; NSEC = 36; K = 44; NEXP = 2.5
    def sup(v): return math.copysign(abs(v) ** (2.0 / NEXP), v)
    def sm(a, b, x): x = max(0.0, min(1.0, (x - a) / (b - a))); return x * x * (3 - 2 * x)
    def blur(vals, n=2):
        for _ in range(n):
            vals = [vals[0]] + [(vals[i-1] + 2*vals[i] + vals[i+1]) / 4 for i in range(1, len(vals)-1)] + [vals[-1]]
        return vals
    info = {}
    for side in ("L", "R"):
        sx = 1 if B[f"foot.{side}"].head_local.x > 0 else -1
        P = [CO[i] for i in range(len(CO)) if isb[i] and CO[i].z < 0.10 and CO[i].x * sx > 0.02
             and (dom[i].startswith(("foot", "toe")) or dom[i].startswith("lowerleg02"))]
        low = [p for p in P if p.z < 0.03]
        heel_y, toe_y = max(p.y for p in low), min(p.y for p in low); L = heel_y - toe_y
        ts = [s / NSEC for s in range(NSEC + 1)]
        ys = [heel_y + 0.004 - (L + EXT) * t for t in ts]
        raw = []
        for y in ys:
            band = [p for p in P if abs(p.y - y) < 0.010 and p.z < 0.075]
            if len(band) < 3: band = sorted(P, key=lambda p: abs(p.y - y))[:12]
            raw.append((min(p.x for p in band), max(p.x for p in band), min(p.z for p in band), max(p.z for p in band)))
        cx = blur([(a + b) / 2 for a, b, _, _ in raw]); wx = blur([(b - a) / 2 + MARGIN for a, b, _, _ in raw])
        zb = blur([c - 0.0035 for _, _, c, _ in raw]); zt = blur([d + TOPM for _, _, _, d in raw])
        for i, t in enumerate(ts):
            if t > 0.80:
                s = sm(0.80, 1.0, t); cx[i] += -sx * wx[i] * SHIFT * s; wx[i] *= 1.0 - TIPW * s ** 1.2
            if t > 0.88: zt[i] = zb[i] + (zt[i] - zb[i]) * (1 - TIPH * sm(0.88, 1.0, t))
            if t < 0.05: wx[i] *= 0.55 + 0.45 * sm(0.0, 0.05, t)
        def th_open(i, h):
            zc = (zb[i] + zt[i]) / 2; wz = (zt[i] - zb[i]) / 2
            r = max(-1.0, min(1.0, (h - zc) / wz)); c = math.copysign(abs(r) ** (NEXP / 2.0), r)
            return math.acos(max(-1.0, min(1.0, c)))
        i46 = min(range(len(ts)), key=lambda i: abs(ts[i] - 0.46))
        th0 = []
        for i, t in enumerate(ts):
            if t <= 0.46:
                h = 0.050 if t < 0.16 else 0.050 + (0.024 - 0.050) * sm(0.16, 0.46, t)
                th0.append(th_open(i, h))
            else:
                th0.append(th_open(i46, 0.024) * (1 - sm(0.46, 0.62, t)))
        bm = bmesh.new(); rings = []
        for i in range(len(ts)):
            zc = (zb[i] + zt[i]) / 2; wz = (zt[i] - zb[i]) / 2
            rings.append([bm.verts.new((cx[i] + wx[i] * sup(math.sin(th0[i] + (2*math.pi - 2*th0[i]) * k / K)), ys[i],
                                        zc + wz * sup(math.cos(th0[i] + (2*math.pi - 2*th0[i]) * k / K)))) for k in range(K + 1)])
        for s in range(NSEC):
            for k in range(K): bm.faces.new([rings[s][k], rings[s][k + 1], rings[s + 1][k + 1], rings[s + 1][k]])
        for ring, dy in ((rings[0], 0.003), (rings[-1], -0.004)):
            c = sum((v.co for v in ring), Vector()) / len(ring); c.y += dy
            cv = bm.verts.new(c)
            for k in range(K):
                f = [ring[k], ring[k + 1], cv]; bm.faces.new(f if dy < 0 else f[::-1])
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f in bm.faces:
            f.material_index = 1 if (f.normal.z < -0.6 and f.calc_center_median().z < 0.015) else 0
        nshell = len(bm.verts)
        i4 = 4; Hc = Vector((cx[i4], heel_y - 0.034, zb[i4] + 0.001)); Bp = Vector((cx[i4], heel_y - 0.72 * L, 0.0))
        d = Hc.y - Bp.y; th = math.asin(HEEL_H / d)
        Tp = Bp + Vector((0, d * math.cos(th) ** 2, -d * math.cos(th) * math.sin(th)))
        axis = (Tp - Hc).normalized(); u = Vector((1, 0, 0)); u = (u - axis * u.dot(axis)).normalized(); w = axis.cross(u)
        hv = []
        for c0, hw, hd in [(Hc, 0.019, 0.023), (Hc + (Tp - Hc) * 0.4, 0.0105, 0.0125), (Tp, 0.0042, 0.0052)]:
            for a in range(8):
                ang = 2 * math.pi * a / 8; hv.append(bm.verts.new(c0 + u * hw * math.cos(ang) + w * hd * math.sin(ang)))
        for lv in range(2):
            for a in range(8):
                bm.faces.new([hv[lv*8 + a], hv[lv*8 + (a+1) % 8], hv[(lv+1)*8 + (a+1) % 8], hv[(lv+1)*8 + a]]).material_index = 1
        bm.faces.new(hv[16:24][::-1]).material_index = 1; bm.faces.new(hv[0:8]).material_index = 1
        bm.normal_update()
        me2 = bpy.data.meshes.new(f"Anne_Heel_{side}"); bm.to_mesh(me2); bm.free()
        ob = bpy.data.objects.new(f"Anne_Heel_{side}", me2); col.objects.link(ob)
        me2.materials.append(PAT); me2.materials.append(SOLE)
        for p in me2.polygons: p.use_smooth = True
        fb, tb = f"foot.{side}", f"toe3-1.{side}"
        ob.vertex_groups.new(name=fb); ob.vertex_groups.new(name=tb)
        for v in me2.vertices:
            t = (heel_y - v.co.y) / L
            wt = 0.0 if v.index >= nshell else sm(0.63, 0.75, t)
            if wt < 1: ob.vertex_groups[fb].add([v.index], 1 - wt, 'REPLACE')
            if wt > 0: ob.vertex_groups[tb].add([v.index], wt, 'REPLACE')
        ob.parent = rig; ob.modifiers.new("Armature", "ARMATURE").object = rig
        sd = ob.modifiers.new("Solid", "SOLIDIFY"); sd.thickness = 0.0022; sd.offset = 1.0; sd.use_rim = True; sd.use_even_offset = False
        info[side] = dict(theta=math.degrees(th), L=L, heel_y=heel_y, toe_y=toe_y)
    rig.data.pose_position = 'POSE'
    t = bpy.data.texts["anne_heel_info"]; t.clear(); t.write(repr(info))
    return info
