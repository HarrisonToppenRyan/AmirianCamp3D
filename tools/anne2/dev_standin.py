"""Development stand-in for stage 1: a rough stylised body that follows the stage-1 scene contract (names, groups,
colour attribute), so stage 3 can be developed before the real stage 1 exists. Not used for the shipped model.

run: Blender -b --python tools/anne2/dev_standin.py      -> build/dev_s1.blend
"""
import bpy, os, sys, math, json, addon_utils
from mathutils import Vector

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService

ROOT = "/Users/harrisontoppenryan/Documents/AmirianCamp3D"
SYS = LocationService.get_mpfb_data(); USR = LocationService.get_user_data()
sc = bpy.context.scene; sc.name = "Anne2"
col = bpy.data.collections.new("Anne2"); sc.collection.children.link(col)
bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children["Anne2"]

MACRO = {'gender': 0.0, 'age': 0.5, 'muscle': 0.4, 'weight': 0.38, 'proportions': 1.0, 'height': 0.5, 'cupsize': 0.5, 'firmness': 0.7,
         'race': {'asian': 0.2, 'caucasian': 0.7, 'african': 0.1}}
body = HumanService.create_human(macro_detail_dict=MACRO, scale=0.1, feet_on_ground=True)
body.name = "Anne_Body"
T = [("eyes/l-eye-scale-incr", 2.2), ("eyes/r-eye-scale-incr", 2.2), ("head/head-round", 0.9), ("head/head-scale-horiz-incr", 0.8),
     ("head/head-scale-vert-incr", 0.3), ("head/head-scale-depth-incr", 0.7), ("nose/nose-scale-horiz-decr", 1.0), ("nose/nose-scale-vert-decr", 0.9),
     ("chin/chin-width-decr", 1.0), ("neck/neck-scale-horiz-decr", 0.9), ("neck/neck-scale-depth-decr", 0.9),
     ("legs/upperlegs-height-incr", 0.6), ("legs/lowerlegs-height-incr", 0.6)]
for t, v in T: TargetService.load_target(body, os.path.join(SYS, "targets", t + ".target.gz"), weight=0.0)
kbs = body.data.shape_keys.key_blocks
for kb in kbs: kb.slider_max = 4.0
for t, v in T:
    k = next(kb for kb in kbs if kb.name.endswith(t.split("/")[1])); k.value = v
HumanService.add_builtin_rig(body, "default")
rig = body.parent; rig.name = "Anne_Rig"
eyes = HumanService.add_mhclo_asset(os.path.join(USR, "eyes/high-poly/high-poly.mhclo"), body, asset_type="Eyes", subdiv_levels=0, material_type="MAKESKIN")
teeth = HumanService.add_mhclo_asset(os.path.join(USR, "teeth/teeth_base/teeth_base.mhclo"), body, asset_type="Teeth", subdiv_levels=0, material_type="MAKESKIN")
rig.data.pose_position = 'REST'
HumanService.refit(body)
rig.data.pose_position = 'POSE'
with bpy.context.temp_override(object=body, active_object=body, selected_objects=[body], selected_editable_objects=[body]):
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
for o in rig.children:
    if o.name.endswith("high-poly"): o.name = "Anne_Eyes"
    elif o.name.endswith("teeth_base"): o.name = "Anne_Teeth"
print("STANDIN children", [o.name for o in rig.children], "height", round(body.dimensions.z, 3))

# regions as vertex groups: suit, gloves, choker
B = rig.data.bones; BONES = {b.name for b in B}
me = body.data
gname = {g.index: g.name for g in body.vertex_groups}; bodyg = body.vertex_groups["body"].index
crotch = B["upperleg01.L"].head_local.z - 0.07; neck = B["neck01"].head_local.z; shoulder_z = B["upperarm01.L"].head_local.z
suit, gloves, choker = [], [], []
for v in me.vertices:
    if not any(g.group == bodyg and g.weight > 0.5 for g in v.groups): continue
    gs = [g for g in v.groups if gname[g.group] in BONES]
    d = gname[max(gs, key=lambda g: g.weight).group] if gs else ""
    z = v.co.z
    if z < neck - 0.035 and (d.startswith(("spine", "breast", "pelvis", "clavicle")) or (d.startswith("shoulder01") and z < shoulder_z + 0.02) or (d.startswith("upperleg") and z > crotch - 0.085)): suit.append(v.index)
    if d.startswith(("wrist", "finger", "metacarpal", "lowerarm", "upperarm02")): gloves.append(v.index)
    if d.startswith("neck") and neck + 0.012 < z < neck + 0.04: choker.append(v.index)
for n, ids in (("suit", suit), ("gloves", gloves), ("choker", choker)):
    body.vertex_groups.new(name=n).add(ids, 1.0, 'REPLACE')

# colour attribute Col + materials
ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
lipg = body.vertex_groups["lips"].index
for v in me.vertices:
    lip = any(g.group == lipg and g.weight > 0.3 for g in v.groups)
    ca.data[v.index].color = (0.70, 0.11, 0.19, 1) if lip else (0.92, 0.61, 0.46, 1)
def mat(name, col):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs["Base Color"].default_value = col
    return m, b
skin, sb = mat("Anne_Skin", (0.92, 0.61, 0.46, 1))
an = skin.node_tree.nodes.new("ShaderNodeVertexColor"); an.layer_name = "Col"; skin.node_tree.links.new(an.outputs["Color"], sb.inputs["Base Color"])
nail, _ = mat("Anne_Nail", (0.1, 0.03, 0.28, 1))
me.materials.clear(); me.materials.append(skin); me.materials.append(nail)
tn = {body.vertex_groups[n].index for n in ("toenails", "fingernails")}
innail = [any(g.group in tn and g.weight > 0.5 for g in v.groups) for v in me.vertices]
for p in me.polygons:
    p.use_smooth = True; p.material_index = 1 if all(innail[i] for i in p.vertices) else 0
for o, nm in ((bpy.data.objects["Anne_Eyes"], "Anne_Eye"), (bpy.data.objects["Anne_Teeth"], "Anne_Teeth")):
    if o.material_slots and o.material_slots[0].material: o.material_slots[0].material.name = nm

for o in list(sc.collection.objects):
    pass
json.dump({"height": body.dimensions.z, "standin": True}, open(os.path.join(ROOT, "build/dev_s1.json"), "w"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "build/dev_s1.blend"))
print("STANDIN saved")
