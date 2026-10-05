"""Headless Blender pass: rebuild the export body without the skin that the jumpsuit and gloves cover."""
import bpy, bmesh

SRC = "/Users/harrisontoppenryan/Documents/AmirianCamp3D/anne_source.blend"
sc = bpy.data.scenes["AnneExport"]
if bpy.context.window:
    bpy.context.window.scene = sc
assert bpy.context.scene.name == "AnneExport"
rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]; col = bpy.data.collections["Anne"]
B = rig.data.bones; BONES = {b.name for b in B}
me = body.data
basis = me.shape_keys.key_blocks["Basis"].data
gname = {g.index: g.name for g in body.vertex_groups}
bodyg = body.vertex_groups["body"].index

dom, isb = [], []
for v in me.vertices:
    gs = [g for g in v.groups if gname[g.group] in BONES]
    dom.append(gname[max(gs, key=lambda g: g.weight).group] if gs else "")
    isb.append(any(g.group == bodyg and g.weight > 0.5 for g in v.groups))

# the jumpsuit's coverage (same rule that built Anne_Cloth_Jumpsuit)
crotch = B["upperleg01.L"].head_local.z - 0.07
neck = B["neck01"].head_local.z
shoulder_z = B["upperarm01.L"].head_local.z
leg_cut = crotch - 0.085
TORSO = ("spine", "breast", "pelvis", "clavicle")
def under_suit(i):
    if not isb[i]: return False
    d, z = dom[i], basis[i].co.z
    if z > neck - 0.035: return False
    if d.startswith(TORSO): return True
    if d.startswith("shoulder01") and z < shoulder_z + 0.02: return True
    if d.startswith("upperleg") and z > leg_cut: return True
    return False
covered = {i for i in range(len(me.vertices)) if under_suit(i)}

# erode twice so a 2-ring band of skin stays under the neckline, armholes and leg openings
nbr = {}
for e in me.edges:
    a, b = e.vertices
    nbr.setdefault(a, []).append(b); nbr.setdefault(b, []).append(a)
inner = covered
for _ in range(2):
    inner = {i for i in inner if all(n in inner for n in nbr.get(i, []))}
print("UNDER covered", len(covered), "removed after erosion", len(inner))

# what the masks hide (helper geometry, hands under the gloves)
hidden = set()
for m in body.modifiers:
    if m.type != 'MASK' or not m.vertex_group: continue
    gi = body.vertex_groups[m.vertex_group].index
    for v in me.vertices:
        inside = any(g.group == gi and g.weight > m.threshold for g in v.groups)
        if (inside if m.invert_vertex_group else not inside): hidden.add(v.index)

old = bpy.data.objects.get("Anne_Body_Export")
if old: bpy.data.objects.remove(old, do_unlink=True)
exp = body.copy(); exp.data = body.data.copy(); exp.name = "Anne_Body_Export"; exp.data.name = "Anne_Body_Export"
col.objects.link(exp)
exp.parent = rig; exp.matrix_parent_inverse = body.matrix_parent_inverse.copy()
bm = bmesh.new(); bm.from_mesh(exp.data); bm.verts.ensure_lookup_table()
kill = hidden | inner
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in kill], context='VERTS')
bm.to_mesh(exp.data); bm.free(); exp.data.update()
for m in list(exp.modifiers):
    if m.type == 'MASK': exp.modifiers.remove(m)
next(m for m in exp.modifiers if m.type == 'ARMATURE').object = rig
exp.hide_viewport = True; exp.hide_render = True
print("UNDER export body verts", len(exp.data.vertices), "shape keys", len(exp.data.shape_keys.key_blocks))

ns = {}
exec(bpy.data.texts["export_src"].as_string(), ns)
r = ns["export_anne"]()
print("EXPORT", r[0], r[1], "MB")
bpy.ops.wm.save_as_mainfile(filepath=SRC, copy=False)
print("SAVED")
