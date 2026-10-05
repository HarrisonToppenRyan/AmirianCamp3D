
import bpy, os, math
from mathutils import Vector
from bl_ext.user_default.mpfb.services import HumanService, TargetService, ObjectService
D = "/Users/harrisontoppenryan/Library/Application Support/Blender/4.5/extensions/.user/user_default/mpfb/data"

MACRO = {'gender': 0.0, 'age': 0.5, 'muscle': 0.45, 'weight': 0.42, 'proportions': 0.8,
         'height': 0.55, 'cupsize': 0.5, 'firmness': 0.6,
         'race': {'asian': 0.2, 'caucasian': 0.65, 'african': 0.15}}

def use_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    lc = bpy.context.view_layer.layer_collection.children[name]
    bpy.context.view_layer.active_layer_collection = lc
    return c

def build_character(coll_name, loc):
    c = use_collection(coll_name)
    for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    body = HumanService.create_human(macro_detail_dict=MACRO, scale=0.1, feet_on_ground=True)
    body.name = coll_name + "_Body"
    # subtle original face shaping
    for t, v in (("head/head-oval", 0.35), ("nose/nose-scale-horiz-decr", 0.25), ("eyes/r-eye-scale-incr", 0.2),
                 ("eyes/l-eye-scale-incr", 0.2), ("mouth/mouth-lowerlip-volume-incr", 0.3), ("chin/chin-prominent-decr", 0.2)):
        try: TargetService.load_target(body, os.path.join(D.replace("/extensions/.user/user_default/mpfb/data", "/extensions/user_default/mpfb/data"), "targets", t + ".target.gz"), weight=v)
        except Exception as e: print("target skip", t, e)
    HumanService.add_builtin_rig(body, "default")
    rig = body.parent
    rig.name = coll_name + "_Rig"
    for rel in ("eyes/high-poly/high-poly.mhclo", "eyebrows/eyebrow001/eyebrow001.mhclo",
                "eyelashes/eyelashes01/eyelashes01.mhclo", "teeth/teeth_base/teeth_base.mhclo"):
        at = rel.split("/")[0].capitalize()
        HumanService.add_mhclo_asset(os.path.join(D, rel), body, asset_type=at, subdiv_levels=0)
    HumanService.add_mhclo_asset(os.path.join(D, "hair/long01/long01.mhclo"), body, asset_type="Hair", subdiv_levels=0)
    HumanService.set_character_skin(os.path.join(D, "skins/young_caucasian_female/young_caucasian_female.mhmat"), body)
    rig.location = loc
    return rig, body

def restyle_outfit(obj):
    m = obj.material_slots[0].material
    nt = m.node_tree; L = nt.links
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    for l in list(b.inputs["Base Color"].links): L.remove(l)
    uv = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 90
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.12; ramp.color_ramp.elements[0].color = (0.95, 0.93, 0.85, 1)
    ramp.color_ramp.elements[1].position = 0.16; ramp.color_ramp.elements[1].color = (0.85, 0.55, 0.06, 1)
    L.new(uv.outputs["UV"], vor.inputs["Vector"]); L.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    ao = next((n for n in nt.nodes if n.name == "aoMix"), None)
    if ao:
        for l in list(ao.inputs[1].links): L.remove(l)
        L.new(ramp.outputs["Color"], ao.inputs[1])
        for l in list(ao.outputs[0].links): L.remove(l)
        L.new(ao.outputs[0], b.inputs["Base Color"])
    else:
        L.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.75
    try: b.inputs["Sheen Weight"].default_value = 0.4
    except Exception: pass
    m.diffuse_color = (0.85, 0.55, 0.06, 1)

import bpy, os, math
from mathutils import Vector
from bl_ext.user_default.mpfb.services import HumanService, TargetService
D = "/Users/harrisontoppenryan/Library/Application Support/Blender/4.5/extensions/.user/user_default/mpfb/data"
SYS = "/Users/harrisontoppenryan/Library/Application Support/Blender/4.5/extensions/user_default/mpfb/data"

MACRO2 = {'gender': 0.0, 'age': 0.5, 'muscle': 0.4, 'weight': 0.36, 'proportions': 0.95,
          'height': 0.52, 'cupsize': 0.55, 'firmness': 0.7,
          'race': {'asian': 0.5, 'caucasian': 0.45, 'african': 0.05}}
FACE = [("eyes/l-eye-scale-incr", 1.0), ("eyes/r-eye-scale-incr", 1.0),
        ("eyes/l-eye-height2-incr", 0.5), ("eyes/r-eye-height2-incr", 0.5),
        ("eyes/l-eye-corner2-up", 0.4), ("eyes/r-eye-corner2-up", 0.4),
        ("head/head-round", 0.55), ("head/head-scale-vert-decr", 0.15),
        ("nose/nose-scale-horiz-decr", 0.45), ("nose/nose-scale-vert-decr", 0.35),
        ("nose/nose-point-up", 0.35), ("nose/nose-volume-decr", 0.3),
        ("mouth/mouth-upperlip-volume-incr", 0.45), ("mouth/mouth-lowerlip-volume-incr", 0.6),
        ("mouth/mouth-scale-horiz-decr", 0.15), ("mouth/mouth-angles-up", 0.35), ("mouth/mouth-cupidsbow-incr", 0.4),
        ("chin/chin-prominent-decr", 0.35), ("chin/chin-width-decr", 0.35), ("chin/chin-height-decr", 0.2),
        ("cheek/l-cheek-volume-incr", 0.35), ("cheek/r-cheek-volume-incr", 0.35),
        ("cheek/l-cheek-bones-decr", 0.3), ("cheek/r-cheek-bones-decr", 0.3),
        ("feet/l-foot-scale-decr", 0.25), ("feet/r-foot-scale-decr", 0.25)]
EXPR = ["mouth-open", "mouth-corner-puller", "mouth-elevation", "mouth-retraction", "mouth-parling",
        "eye-left-closure", "eye-right-closure", "eye-left-slit", "eye-right-slit",
        "eye-left-opened-up", "eye-right-opened-up", "eyebrows-left-inner-up", "eyebrows-right-inner-up",
        "eyebrows-left-up", "eyebrows-right-up", "nose-left-elevation", "nose-right-elevation"]

def use_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[name]
    return c

def darken_hair(obj):
    m = obj.material_slots[0].material; nt = m.node_tree
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.name == 'diffuseTexture')
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Value"].default_value = 0.18; hs.inputs["Saturation"].default_value = 0.6
    for l in list(b.inputs["Base Color"].links): nt.links.remove(l)
    nt.links.new(tex.outputs["Color"], hs.inputs["Color"]); nt.links.new(hs.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.35
    try: b.inputs["Coat Weight"].default_value = 0.2
    except Exception: pass

def nail_polish(body):
    pm = bpy.data.materials.get("Nail_Polish") or bpy.data.materials.new("Nail_Polish")
    pm.use_nodes = True
    b = next(n for n in pm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs["Base Color"].default_value = (0.32, 0.12, 0.55, 1); b.inputs["Roughness"].default_value = 0.12
    try: b.inputs["Coat Weight"].default_value = 1.0
    except Exception: pass
    pm.diffuse_color = (0.32, 0.12, 0.55, 1)
    me = body.data; me.materials.append(pm); idx = len(me.materials) - 1
    gids = {body.vertex_groups[n].index for n in ("toenails", "fingernails")}
    innail = [any(g.group in gids and g.weight > 0.5 for g in v.groups) for v in me.vertices]
    cnt = 0
    for p in me.polygons:
        if all(innail[i] for i in p.vertices): p.material_index = idx; cnt += 1
    return cnt

def build_character_v2(coll_name, loc, expressions=False):
    c = use_collection(coll_name)
    for o in list(c.objects):
        if o.type != 'CAMERA': bpy.data.objects.remove(o, do_unlink=True)
    body = HumanService.create_human(macro_detail_dict=MACRO2, scale=0.1, feet_on_ground=True)
    body.name = coll_name + "_Body"
    for t, v in FACE:
        TargetService.load_target(body, os.path.join(SYS, "targets", t + ".target.gz"), weight=v)
    if expressions:
        for e in EXPR:
            TargetService.load_target(body, os.path.join(SYS, "targets/expression/units/asian", e + ".target.gz"), weight=0.0)
    HumanService.add_builtin_rig(body, "default")
    rig = body.parent; rig.name = coll_name + "_Rig"
    for rel in ("eyes/high-poly/high-poly.mhclo", "eyebrows/eyebrow010/eyebrow010.mhclo",
                "eyelashes/eyelashes02/eyelashes02.mhclo", "teeth/teeth_base/teeth_base.mhclo"):
        HumanService.add_mhclo_asset(os.path.join(D, rel), body, asset_type=rel.split("/")[0].capitalize(), subdiv_levels=0)
    hair = HumanService.add_mhclo_asset(os.path.join(D, "hair/long01/long01.mhclo"), body, asset_type="Hair", subdiv_levels=0)
    HumanService.set_character_skin(os.path.join(D, "skins/young_caucasian_female/young_caucasian_female.mhmat"), body)
    darken_hair(next(o for o in rig.children_recursive if o.name.endswith("long01")))
    print("nail faces", nail_polish(body))
    HumanService.add_mhclo_asset(os.path.join(D, "clothes/female_elegantsuit01/female_elegantsuit01.mhclo"), body, asset_type="Clothes", subdiv_levels=1)
    restyle_outfit(next(o for o in rig.children_recursive if o.name.endswith("female_elegantsuit01")))
    sd = body.modifiers.new("Subdiv", "SUBSURF"); sd.levels = 1; sd.render_levels = 2
    rig.location = loc
    return rig, body
