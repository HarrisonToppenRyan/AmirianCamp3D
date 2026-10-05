"""Stage 3: assemble Anne v2 and export her for the game.

  Blender -b --python tools/anne2/s3_finish.py -- [--s1 build/anne2_s1.blend] [--parts outfit,hair,shoes] [--out anne2] [--render]

Steps: open the stage-1 blend, run the stage-2 part builders, add the facial expression shape keys (calibrated so a
blink really closes the stylised eyes) and copy them onto brows, lashes and teeth, key the animation clips, place the
markers the cut-scene uses, build the export meshes (covered skin removed, head split from body, one level of
subdivision), export `<out>.glb`, `<out>_heel_prop.glb` and `<out>.json`, and save `build/<out>_s3.blend`.
"""
import bpy, bmesh, os, sys, math, json, importlib, addon_utils
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)

ROOT = "/Users/harrisontoppenryan/Documents/AmirianCamp3D"
HERE = os.path.join(ROOT, "tools", "anne2")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
S1 = os.path.join(ROOT, arg("--s1", "build/anne2_s1.blend"))
PARTS = [p for p in arg("--parts", "outfit,hair,sandals").split(",") if p and p != "none"]      # the hair drapes over the suit
OUT = arg("--out", "anne2")
RENDER = "--render" in argv

# ---------------------------------------------------------------- tunables
HEEL_H = 0.065                 # stiletto height (m); used when the shoes stage left no theta
LOG_FLOOR = 0.08               # the log's wall thickness: its inner floor is this far above the ground
LOWER_LID_SHARE = 0.22         # in a blink the lower lid comes up this fraction of what the upper lid comes down
SUBDIV = 1                     # subdivision levels applied to the skin at export
FOOT_SUBDIV = 2                # ... and to the feet, which the cut-scene shows in close-up
FOOT_Z = 0.13                  # the feet: every skin face below this height in the rest pose (the ankle joint is at 0.064)
EXPRESSIONS = ["mouth-open", "mouth-corner-puller", "mouth-elevation", "mouth-depression", "mouth-retraction", "mouth-parling",
               "mouth-pursing", "mouth-compression", "mouth-upward-retraction",
               "eye-left-closure", "eye-right-closure", "eye-left-slit", "eye-right-slit", "eye-left-opened-up", "eye-right-opened-up",
               "eyebrows-left-inner-up", "eyebrows-right-inner-up", "eyebrows-left-up", "eyebrows-right-up",
               "eyebrows-left-down", "eyebrows-right-down", "nose-left-elevation", "nose-right-elevation",
               "eye-left-closure-mid", "eye-right-closure-mid"]
LID_KEYS = {"closure", "slit", "opened-up", "closure-mid"}
HEAD_BONE_PREFIXES = ("head", "jaw", "oris", "levator", "orbicularis", "oculi", "risorius", "temporalis", "special", "tongue", "eye", "neck03", "neck02")

bpy.ops.wm.open_mainfile(filepath=S1)
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
from bl_ext.user_default.mpfb.services import TargetService, LocationService
SYS = LocationService.get_mpfb_data()
sc = bpy.context.scene
rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]
col = rig.users_collection[0]
B = rig.data.bones; BONES = {b.name for b in B}
log = lambda *a: print("S3", *a)
log("opened", S1, "| objects:", sorted(o.name for o in sc.objects))


# ---------------------------------------------------------------- helpers
def obj(name):
    return bpy.data.objects.get(name)

def override(o):
    return bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o])

def world_verts(o, with_modifiers=True):
    """World-space vertex positions of an object as it is now (pose and modifiers applied)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    src = o.evaluated_get(dg) if with_modifiers else o
    me = src.to_mesh() if with_modifiers else src.data
    pts = [o.matrix_world @ v.co for v in me.vertices]
    if with_modifiers: src.to_mesh_clear()
    return pts

def body_coords():
    """World positions of the body's vertices as they are now (shape keys and pose applied), in base-mesh order.
    The Mask modifiers that hide helper geometry are switched off while evaluating, so indices match body.data."""
    masks = [m for m in body.modifiers if m.type == 'MASK' and m.show_viewport]
    for m in masks: m.show_viewport = False
    pts = world_verts(body)
    for m in masks: m.show_viewport = True
    bpy.context.view_layer.update()
    return pts

def body_flags():
    """Per base-mesh vertex: is it real body (not helper geometry), and which deform bone dominates it."""
    gname = {g.index: g.name for g in body.vertex_groups}
    bodyg = body.vertex_groups["body"].index
    isb, dom = [], []
    for v in body.data.vertices:
        isb.append(any(g.group == bodyg and g.weight > 0.5 for g in v.groups))
        gs = [g for g in v.groups if gname[g.group] in BONES]
        dom.append(gname[max(gs, key=lambda g: g.weight).group] if gs else "")
    return isb, dom

def group_set(o, name, threshold=0.5):
    g = o.vertex_groups.get(name)
    if g is None: return set()
    return {v.index for v in o.data.vertices if any(x.group == g.index and x.weight > threshold for x in v.groups)}

def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- 1. stage-2 parts
sys.path.insert(0, HERE)
ctx = {"root": ROOT, "rig": rig, "body": body, "s1_json": json.load(open(os.path.splitext(S1)[0] + ".json")) if os.path.exists(os.path.splitext(S1)[0] + ".json") else {}}
for part in PARTS:
    mod = importlib.import_module("s2_" + part)
    log("building part", part)
    mod.build(ctx)
rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]
rig.animation_data_clear(); reset_pose()
rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
ISB, DOM = body_flags()
BASIS = [v.co.copy() for v in body.data.vertices]
BODY_POLYS = [list(p.vertices) for p in body.data.polygons if all(ISB[i] for i in p.vertices)]


# ---------------------------------------------------------------- 2. expressions
def load_expressions():
    """The MakeHuman expression units as shape keys on the body, retargeted to the stylised head (every vertex moves
    in proportion to how much stage 1 enlarged its surroundings). The eyelid keys are made separately, from the lid
    bones, because a lid has to slide round the big eyeball instead of cutting straight through it."""
    import numpy as np
    import common as C
    for e in EXPRESSIONS:
        if e.split("-", 2)[-1] in LID_KEYS and e.startswith("eye-"): continue
        C.add_shape_key(body, e, C.expression_delta(body, e))
    kbs = body.data.shape_keys.key_blocks
    for kb in kbs: kb.slider_min = -1.0; kb.slider_max = 5.0; kb.value = 0.0
    head_scale = (B["head"].tail_local - B["head"].head_local).length / 0.141      # 0.141 m = the default head bone
    log("head scale vs default", round(head_scale, 3), "| expression keys", len(kbs) - 1)
    return kbs, head_scale

def lid_keys(kbs):
    """Blink, squint and wide-open keys baked from poses of the eyelid bones (they turn about the eyeball's centre).
    Returns the closing angles found for each side."""
    import numpy as np
    import common as C
    eyes = obj("Anne_Eyes"); result = {}
    rig.data.pose_position = 'POSE'; C.reset_pose(rig)
    rest = C.eval_verts(body, world=False)
    epts = world_verts(eyes) if eyes else []
    for side, sd, sx in (("left", "L", 1), ("right", "R", -1)):
        ev = [p for p in epts if p.x * sx > 0]
        cx = sum(p.x for p in ev) / len(ev); cz = sum(p.z for p in ev) / len(ev); ymin = min(p.y for p in ev)
        r = max(abs(p.x - cx) for p in ev)
        front = [p for p in ev if ((p.x - cx) ** 2 + (p.z - cz) ** 2) < (0.72 * r) ** 2]
        def covered(up, lo):
            C.reset_pose(rig); C.lid_pose(rig, upper=up, lower=lo, side=sd)
            bvh = BVHTree.FromPolygons(body_coords(), BODY_POLYS)
            n = sum(1 for p in front if bvh.ray_cast(p + Vector((0, -0.08, 0)), Vector((0, 1, 0)), 0.08 - 0.0004)[0] is not None)
            return n / max(1, len(front))
        open_cov = covered(0, 0); best = None
        loop = ctx["s1_json"].get("eye_loop_" + sd)             # lid margin: index 0 = middle of the upper lid, 15 = of the lower
        for up in range(16, 71):
            C.reset_pose(rig); C.lid_pose(rig, upper=up, lower=up * LOWER_LID_SHARE, side=sd)
            pv = C.eval_verts(body, world=False)
            if loop and pv[loop[0]][2] <= pv[loop[15]][2] + 0.0003: best = up; break
        if best is None: best = 44; log("eyelid", side, "margins never met; using", best)
        closed_cov = covered(best, best * LOWER_LID_SHARE)
        def delta(f, opened=False):
            C.reset_pose(rig)
            if opened: C.lid_pose(rig, upper=-9.0, lower=-4.0, side=sd)
            else: C.lid_pose(rig, upper=best * f, lower=best * LOWER_LID_SHARE * f, side=sd)
            return C.eval_verts(body, world=False) - rest
        d1 = delta(1.0); dh = delta(0.5)
        C.add_shape_key(body, f"eye-{side}-closure", d1)
        C.add_shape_key(body, f"eye-{side}-closure-mid", dh - 0.5 * d1)          # game: weight 4c(1-c) keeps the lid on the eyeball mid-blink
        C.add_shape_key(body, f"eye-{side}-slit", delta(0.42))
        C.add_shape_key(body, f"eye-{side}-opened-up", delta(0, opened=True))
        moved = float(np.linalg.norm(d1, axis=1).max())
        result[side] = (best, len(front), round(open_cov, 3), round(moved * 1000, 1))
        log("eyelid", side, "closes at upper", best, "deg, lower", round(best * LOWER_LID_SHARE, 1), "| eye covered: open", round(open_cov, 3), "closed", round(closed_cov, 3), "| largest move mm", round(moved * 1000, 1))
    C.reset_pose(rig)
    for kb in kbs: kb.slider_min = -1.0; kb.slider_max = 5.0; kb.value = 0.0
    return result

def transfer_keys(target, kbs):
    """Copy the body's expression keys onto a small mesh lying on the face (brows, lashes): each vertex follows the
    nearest face triangle."""
    me = body.data; me.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in me.loop_triangles if all(ISB[i] for i in t.vertices)]
    basis = kbs["Basis"].data
    base_co = [basis[i].co.copy() for i in range(len(me.vertices))]
    bvh = BVHTree.FromPolygons(base_co, tris)
    M = body.matrix_world.inverted() @ target.matrix_world; Mi = M.inverted()
    if target.data.shape_keys:
        with override(target): bpy.ops.object.shape_key_remove(all=True, apply_mix=False)
    target.shape_key_add(name="Basis", from_mix=False)
    near = []
    for v in target.data.vertices:
        p = M @ v.co
        loc, nrm, ti, dist = bvh.find_nearest(p)
        near.append((loc, tris[ti], p - loc))
    worst = 0.0
    for kb in kbs:
        if kb.name == "Basis": continue
        sk = target.shape_key_add(name=kb.name, from_mix=False)
        for vi, (loc, (a, b, c), off) in enumerate(near):
            moved = barycentric_transform(loc, base_co[a], base_co[b], base_co[c], kb.data[a].co, kb.data[b].co, kb.data[c].co) + off
            sk.data[vi].co = Mi @ moved
            worst = max(worst, (moved - (loc + off)).length)
    log("transferred", len(kbs) - 1, "keys to", target.name, "| largest move mm", round(worst * 1000, 1))

def lower_lip_offsets(kbs):
    """Per expression key: how far the lower lip (and so the jaw) moves."""
    lips = sorted(group_set(body, "lips", 0.3))
    basis = kbs["Basis"].data
    lipz = sum(basis[i].co.z for i in lips) / len(lips)
    low_lip = [i for i in lips if basis[i].co.z < lipz]
    return {kb.name: sum(((kb.data[i].co - basis[i].co) for i in low_lip), Vector()) / len(low_lip) for kb in kbs if kb.name != "Basis"}

def simplify_teeth(teeth):
    """Stylised mouth: keep only the upper teeth (a clean white band); they do not move with expressions."""
    jaw = teeth.vertex_groups.get("jaw")
    lower = [v.index for v in teeth.data.vertices if jaw and any(g.group == jaw.index and g.weight > 0.5 for g in v.groups)]
    if teeth.data.shape_keys:
        with override(teeth): bpy.ops.object.shape_key_remove(all=True, apply_mix=False)
    bm = bmesh.new(); bm.from_mesh(teeth.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in lower], context='VERTS')
    bm.to_mesh(teeth.data); bm.free(); teeth.data.update()
    for p in teeth.data.polygons: p.use_smooth = True
    log("teeth: removed", len(lower), "lower-jaw vertices, kept", len(teeth.data.vertices))

def add_tongue(kbs):
    """A tongue (MakeHuman asset), so an open mouth is not a void. It follows the jaw in every expression."""
    try:
        from bl_ext.user_default.mpfb.services import HumanService
        usr = LocationService.get_user_data()
        tongue = HumanService.add_mhclo_asset(os.path.join(usr, "tongue/tongue01/tongue01.mhclo"), body, asset_type="Tongue", subdiv_levels=0, material_type="MAKESKIN")
    except Exception as e:
        log("tongue skipped:", repr(e)); return None
    if tongue is None:
        tongue = next((o for o in rig.children if o.name.endswith("tongue01")), None)
    if tongue is None: log("tongue skipped: asset not found after fitting"); return None
    tongue.name = "Anne_Tongue"
    m = bpy.data.materials.get("Anne_Tongue") or bpy.data.materials.new("Anne_Tongue"); m.use_nodes = True
    next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs["Base Color"].default_value = (0.78, 0.22, 0.25, 1)
    tongue.data.materials.clear(); tongue.data.materials.append(m)
    for p in tongue.data.polygons: p.use_smooth = True
    for v in tongue.data.vertices: v.co.y += 0.007; v.co.z -= 0.002          # well behind the lips, whatever they do
    offs = lower_lip_offsets(kbs)
    tongue.shape_key_add(name="Basis", from_mix=False)
    for name, d in offs.items():
        sk = tongue.shape_key_add(name=name, from_mix=False)
        if d.length > 1e-5:
            for i in range(len(tongue.data.vertices)): sk.data[i].co = tongue.data.vertices[i].co + d * 0.85
    log("tongue added:", len(tongue.data.vertices), "vertices")
    return tongue

def paint_mouth_interior():
    """Colour the inside of the mouth dark red (the base mesh has a mouth cavity behind the lips)."""
    ca = body.data.color_attributes.get("Col")
    if ca is None: return
    lips = group_set(body, "lips", 0.3)
    lc = sum((BASIS[i] for i in lips), Vector()) / len(lips)
    half_w = max(abs(BASIS[i].x) for i in lips) * 1.15
    half_h = (max(BASIS[i].z for i in lips) - min(BASIS[i].z for i in lips)) * 1.6
    nbr = {}
    for e in body.data.edges:
        a_, b_ = e.vertices; nbr.setdefault(a_, []).append(b_); nbr.setdefault(b_, []).append(a_)
    bvh = BVHTree.FromPolygons(BASIS, BODY_POLYS)
    def inside(i):
        """Behind the lips, and hidden from the front by skin (the outer face has nothing in front of it)."""
        if not ISB[i] or i in lips or not (lc.y - 0.002 < BASIS[i].y < lc.y + 0.075): return False
        if abs(BASIS[i].x) > half_w or abs(BASIS[i].z - lc.z) > half_h: return False
        for d in (Vector((0, -1, 0)), Vector((0, -0.6, -0.8)), Vector((0, -0.6, 0.8))):      # (skin tucked under a lip can
            if bvh.ray_cast(BASIS[i] + d * 0.0015, d, 0.08)[0] is None: return False           #  still be seen from below or above)
        return True
    seen, todo = set(), [i for i in lips]
    while todo:
        i = todo.pop()
        for j in nbr.get(i, []):
            if j not in seen and inside(j): seen.add(j); todo.append(j)
    # Dark only where the cavity is really inside her head. Close behind the skin (the pocket under the lower lip is
    # barely a millimetre in) it keeps the colour of the skin in front of it, so nothing shows if the two ever cross.
    from mathutils.kdtree import KDTree
    vcol = {}
    if ca.domain == 'POINT':
        for i in range(len(BASIS)): vcol[i] = Vector(ca.data[i].color[:3])
    else:
        acc, cnt = {}, {}
        for l in body.data.loops:
            c = ca.data[l.index].color; i = l.vertex_index
            acc[i] = acc.get(i, Vector()) + Vector(c[:3]); cnt[i] = cnt.get(i, 0) + 1
        vcol = {i: acc[i] / cnt[i] for i in acc}
    # stage 1 painted the cavity too (a flat dark red): those vertices get the same treatment
    stage1 = Vector((0.102, 0.010, 0.019))
    for i, c in vcol.items():
        if ISB[i] and BASIS[i].z > lc.z - 0.06 and (c - stage1).length < 0.09 and abs(BASIS[i].x) < half_w * 1.3: seen.add(i)
    outer_f = [f for f in BODY_POLYS if not any(i in seen for i in f)]
    obvh = BVHTree.FromPolygons(BASIS, outer_f)
    outer_v = sorted({i for f in outer_f for i in f})
    kd = KDTree(len(outer_v))
    for i in outer_v: kd.insert(BASIS[i], i)
    kd.balance()
    final = {}
    for i in seen:
        loc, nrm, fi, dist = obvh.find_nearest(BASIS[i], 0.05)
        dist = 0.05 if loc is None else dist
        depth = min(1.0, max(0.0, (BASIS[i].y - lc.y) / 0.03))
        dark = Vector((0.33 - 0.22 * depth, 0.06 - 0.035 * depth, 0.07 - 0.04 * depth))
        t = max(0.0, min(1.0, (dist - 0.0035) / 0.007)); t = t * t * (3 - 2 * t)
        near = vcol.get(kd.find(BASIS[i])[1], dark)
        final[i] = near.lerp(dark, t)
    if ca.domain == 'POINT':
        for i, c in final.items(): ca.data[i].color = (c.x, c.y, c.z, 1.0)
    else:
        for l in body.data.loops:
            c = final.get(l.vertex_index)
            if c is not None: ca.data[l.index].color = (c.x, c.y, c.z, 1.0)
    log("mouth interior painted:", len(seen), "vertices")
    return seen

def interior_clearance(inside, kbs, gap=0.0045):
    """The mouth cavity has a pocket that lies barely a millimetre behind the skin under the lower lip: any expression
    makes it show through. Move every inner vertex that is closer than `gap` to the outer skin back to that distance
    (in the basis and in every key alike)."""
    if not inside: return
    nbr = {}
    for e in body.data.edges:
        a_, b_ = e.vertices; nbr.setdefault(a_, []).append(b_); nbr.setdefault(b_, []).append(a_)
    rim = {i for i in inside if any(j not in inside for j in nbr.get(i, []))}       # where the cavity joins the lips: stays
    outer = [f for f in BODY_POLYS if not any(i in inside for i in f)]              # all outer skin, lips included
    bvh = BVHTree.FromPolygons(BASIS, outer)
    moved = 0; worst = 0.0
    for i in sorted(inside - rim):
        loc, nrm, fi, dist = bvh.find_nearest(BASIS[i], 0.03)
        if loc is None or dist >= gap: continue
        off = -nrm * (gap - dist) if (BASIS[i] - loc).dot(nrm) <= 0 else -nrm * (gap + dist)     # to `gap` behind the skin
        for kb in kbs: kb.data[i].co = kb.data[i].co + off
        body.data.vertices[i].co = body.data.vertices[i].co + off
        BASIS[i] = BASIS[i] + off; moved += 1; worst = max(worst, off.length)
    log("mouth interior: moved", moved, "vertices away from the skin, by up to mm", round(worst * 1000, 1))

def interior_follows_skin(inside, kbs):
    """In every expression the inside of the mouth moves with the skin right in front of it (each inner vertex takes
    the offset of the nearest outer one, then the offsets are smoothed), so it can never poke out through the chin."""
    from mathutils.kdtree import KDTree
    if not inside: return
    # everything behind the lips counts as inside: grow the painted set over the rest of the cavity
    lips = group_set(body, "lips", 0.3)
    nbr = {}
    for e in body.data.edges:
        a_, b_ = e.vertices; nbr.setdefault(a_, []).append(b_); nbr.setdefault(b_, []).append(a_)
    outer = [i for i in range(len(BASIS)) if ISB[i] and i not in inside and BASIS[i].z > 1.40]
    kd = KDTree(len(outer))
    for i in outer: kd.insert(BASIS[i], i)
    kd.balance()
    near = {i: kd.find(BASIS[i])[1] for i in inside}
    basis = kbs["Basis"].data
    ins = sorted(inside); worst = 0.0
    for kb in kbs:
        if kb.name == "Basis": continue
        d = {i: kb.data[near[i]].co - basis[near[i]].co for i in ins}
        for _ in range(3):
            d = {i: (d[i] * 2 + sum((d[j] for j in nbr.get(i, []) if j in d), Vector())) / (2 + sum(1 for j in nbr.get(i, []) if j in d)) for i in ins}
        for i in ins:
            worst = max(worst, ((basis[i].co + d[i]) - kb.data[i].co).length)
            kb.data[i].co = basis[i].co + d[i]
    log("mouth interior follows the skin in", len(kbs) - 1, "keys | largest correction mm", round(worst * 1000, 1))

# ---------------------------------------------------------------- 2b. the shapes of her face (10-04)
# (As he asked: the player makes her their own at the start of the game: a heritage to start from, and the lines of her
# face.) Static shape keys named shape-...: the game sets their weights once (looks.js, anne_next.js setShape) and the
# expressions play on top. Each is a sum of MakeHuman's own targets (the two other ethnic macros it has beside the one she
# was made in; its detail targets for jaw, chin, cheeks, nose, lips, brow), carried to her stylised head the way the
# expression units are (every vertex moves in proportion to how much stage 1 enlarged its surroundings), and then:
#  - masked to her face: nothing moves on her scalp, ears and neck, so every hairstyle, her hat and her choker still fit;
#  - round her eyes it slides ON the big eyeball (each lid vertex keeps its distance from the eyeball's centre), so no
#    shape can cut a lid through the eye.
# shape-eye-slant is made here: the lids and the skin round each eye turned about the eye's own axis.
FACE_SHAPES = {
    "shape-base-asian": [("macrodetails/asian-female-young", 1.0), ("macrodetails/caucasian-female-young", -1.0)],
    "shape-base-african": [("macrodetails/african-female-young", 1.0), ("macrodetails/caucasian-female-young", -1.0)],
    "shape-soft": [("chin/chin-width-decr", 0.5), ("chin/chin-bones-decr", 0.5), ("head/head-oval", 0.4), ("cheek/?-cheek-volume-incr", 0.3), ("nose/nose-volume-decr", 0.4),
                   ("mouth/mouth-upperlip-volume-incr", 0.3), ("mouth/mouth-lowerlip-volume-incr", 0.3), ("chin/chin-prominent-decr", 0.3), ("forehead/forehead-nubian-decr", 0.2)],
    "shape-jaw-wide": [("chin/chin-width-incr", 0.5), ("chin/chin-width-decr", -0.5), ("head/head-square", 0.5), ("chin/chin-bones-incr", 0.3), ("chin/chin-bones-decr", -0.3)],
    "shape-chin-long": [("chin/chin-height-incr", 0.22), ("chin/chin-height-decr", -0.22), ("chin/chin-prominent-incr", 0.15), ("chin/chin-prominent-decr", -0.15)],
    "shape-cheekbones": [("cheek/?-cheek-bones-incr", 0.5), ("cheek/?-cheek-bones-decr", -0.5)],
    "shape-face-round": [("head/head-round", 0.6), ("cheek/?-cheek-volume-incr", 0.4), ("cheek/?-cheek-volume-decr", -0.4)],
    "shape-nose-wide": [("nose/nose-width2-incr", 0.5), ("nose/nose-width2-decr", -0.5), ("nose/nose-width3-incr", 0.5), ("nose/nose-width3-decr", -0.5),
                        ("nose/nose-nostrils-width-incr", 0.4), ("nose/nose-nostrils-width-decr", -0.4)],
    "shape-nose-bridge": [("nose/nose-hump-incr", 0.5), ("nose/nose-hump-decr", -0.5), ("nose/nose-scale-depth-incr", 0.35), ("nose/nose-scale-depth-decr", -0.35), ("nose/nose-width1-incr", 0.2)],
    "shape-nose-long": [("nose/nose-scale-vert-incr", 0.5), ("nose/nose-scale-vert-decr", -0.5), ("nose/nose-point-down", 0.25), ("nose/nose-point-up", -0.25)],
    "shape-lips-full": [("mouth/mouth-upperlip-volume-incr", 0.5), ("mouth/mouth-upperlip-volume-decr", -0.5), ("mouth/mouth-lowerlip-volume-incr", 0.5), ("mouth/mouth-lowerlip-volume-decr", -0.5),
                        ("mouth/mouth-upperlip-height-incr", 0.25), ("mouth/mouth-lowerlip-height-incr", 0.25)],
    "shape-mouth-wide": [("mouth/mouth-scale-horiz-incr", 0.5), ("mouth/mouth-scale-horiz-decr", -0.5)],
    "shape-brow-heavy": [("forehead/forehead-nubian-incr", 0.3), ("eyebrows/eyebrows-trans-down", 0.5), ("eyebrows/eyebrows-trans-up", -0.5), ("eyebrows/eyebrows-trans-forward", 0.3)],
    "shape-eye-fold": [("eyes/?-eye-epicanthus-in", 0.8), ("eyes/?-eye-eyefold-down", 0.5), ("eyes/?-eye-eyefold-concave", 0.3)],
    # (batch 22: another species) her ears alone: no face mask on these, the targets move nothing else
    "shape-ear-elf": [("ears/?-ear-shape-pointed", 2.2), ("ears/?-ear-scale-vert-incr", 0.9), ("ears/?-ear-wing-incr", 0.8), ("ears/?-ear-rot-backward", 0.5)],
}


def face_shapes():
    import numpy as np
    import common as C
    SYS, _ = C.mpfb_paths(); TD = os.path.join(SYS, "targets"); n = len(body.data.vertices)
    co = C.get_co(body); gain = C.retarget_gain(body)[:, None]; sj = ctx["s1_json"]

    def raw(rel):
        if "?" in rel:
            return raw(rel.replace("?", "l")) + raw(rel.replace("?", "r"))
        p = os.path.join(TD, rel + ".target.gz")
        if os.path.exists(p):
            return C.read_target(p, n)
        d, b = os.path.split(rel); q = [os.path.join(TD, d, sd + b + ".target.gz") for sd in ("l-", "r-")]
        if all(os.path.exists(x) for x in q):
            return C.read_target(q[0], n) + C.read_target(q[1], n)
        log("face shape: no target file for", rel); return np.zeros((n, 3))

    sm = lambda x, a, b_: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b_ - a), 0.0, 1.0))
    # ---- the mask: her face (and her jaw under her ears); not her scalp, the top of her head, her ears, her neck
    centre = np.array([0.0, -0.045, 1.60]); d = co - centre; r = np.linalg.norm(d, axis=1) + 1e-9; fy = -d[:, 1] / r
    w = np.maximum(sm(fy, 0.05, 0.5), sm(1.535 - co[:, 2], 0.0, 0.035) * sm(fy, -0.3, 0.05))
    w *= sm(co[:, 2], 1.40, 1.45) * (1 - sm(co[:, 2], 1.655, 1.70)) * (r < 0.2)
    w[C.vg_mask(body, "scalp", 0.5)] = 0.0
    w[13380:] = 0.0                                              # (the helper vertices are no part of her)
    e = np.empty(len(body.data.edges) * 2, dtype=np.int32); body.data.edges.foreach_get("vertices", e); e = e.reshape(-1, 2)
    deg = np.zeros(n); np.add.at(deg, e[:, 0], 1.0); np.add.at(deg, e[:, 1], 1.0)
    hard = w <= 0.0
    for _ in range(8):
        acc = np.zeros(n); np.add.at(acc, e[:, 0], w[e[:, 1]]); np.add.at(acc, e[:, 1], w[e[:, 0]])
        w = 0.5 * w + 0.5 * acc / np.maximum(deg, 1.0); w[hard] = 0.0
    # ---- her eyes: the eyeballs' centres and radius; near them a shape slides on the ball
    R = float(sj.get("eye_radius") or 0.023); cen = [np.array(sj["eye_centre_" + sd]) for sd in "LR"] if sj.get("eye_centre_L") else []

    def on_ball(D):
        for c in cen:
            v = co - c; dist = np.linalg.norm(v, axis=1) + 1e-9; k = (1 - sm(dist, 1.05 * R, 1.5 * R))[:, None]
            q = co + D - c; q = q / (np.linalg.norm(q, axis=1)[:, None] + 1e-9) * dist[:, None]
            D = D * (1 - k) + (c + q - co) * k
        return D

    # ---- a macro target (another build of the whole person) also moves, turns and resizes the head: that part is taken
    # out (the best-fitting move, turn and scale of the head as MakeHuman has it), and what is left is the face's own shape
    q0 = C.mh_rest(body); head = (np.arange(n) < 13380) & (co[:, 2] > 1.44) & (r < 0.2)

    def unposed(D):
        Pm = q0[head]; Qm = Pm + D[head]; pc = Pm.mean(0); qc = Qm.mean(0)
        Um, Sg, Vt = np.linalg.svd((Pm - pc).T @ (Qm - qc))
        dd = np.sign(np.linalg.det(Vt.T @ Um.T)); Rm = Vt.T @ np.diag([1.0, 1.0, dd]) @ Um.T
        sc = float((Sg * np.array([1.0, 1.0, dd])).sum() / ((Pm - pc) ** 2).sum())
        res = (q0 + D) - ((sc * (Rm @ (q0 - pc).T)).T + qc)
        log("face shape: head of the macro moved %.1f mm, scale %.3f; left on the face: max %.1f mm" % (np.linalg.norm(qc - pc) * 1e3, sc, np.linalg.norm(res[head], axis=1).max() * 1e3))
        return (Rm.T @ res.T).T / sc

    # ---- her lips stay closed: where the upper lip rests on the lower one (points of her lips within 3 mm of each other
    # that are not neighbours on the surface), both move alike
    from mathutils.kdtree import KDTree
    lipv = [int(i) for i in np.nonzero(C.vg_mask(body, "lips", 0.3) & (np.arange(n) < 13380))[0]]
    nb = {}
    for a_, b_ in e:
        nb.setdefault(int(a_), set()).add(int(b_)); nb.setdefault(int(b_), set()).add(int(a_))
    kd = KDTree(len(lipv))
    for k_, i in enumerate(lipv): kd.insert(tuple(co[i]), k_)
    kd.balance(); pairs = []
    for i in lipv:
        near = set(nb.get(i, ())) | {i}
        for j in list(near): near |= nb.get(j, set())
        for (pos, k_, dist) in kd.find_range(tuple(co[i]), 0.003):
            j = lipv[k_]
            if j > i and j not in near and abs(co[i][2] - co[j][2]) < 0.003: pairs.append((i, j))
    pa = np.array([p_[0] for p_ in pairs], dtype=int); pb = np.array([p_[1] for p_ in pairs], dtype=int)

    def seal(D, name):
        if not len(pa): return D
        gap = float(np.abs(D[pa, 2] - D[pb, 2]).max()) * 1e3
        for _ in range(4):
            m_ = (D[pa] + D[pb]) / 2; D[pa] = m_; D[pb] = m_
        if gap > 0.5: log("face shape %s: her lips would have parted by up to %.1f mm; kept closed (%d pairs)" % (name, gap, len(pa)))
        return D

    made = []
    for name, parts in FACE_SHAPES.items():
        D = np.zeros((n, 3))
        for rel, wt in parts:
            D += raw(rel) * wt
        if name.startswith("shape-base-"): D = unposed(D)
        if name.startswith("shape-ear-"):
            D = D * gain; D[13380:] = 0.0
        else:
            D = seal(on_ball(D * gain * w[:, None]), name)
        C.add_shape_key(body, name, D); made.append((name, float(np.linalg.norm(D, axis=1).max()) * 1000))
    # ---- the slant of her eyes: lids and the skin round each eye turned about the eye's own front-to-back axis (outer corners up)
    if cen:
        D = np.zeros((n, 3))
        for c, sg in zip(cen, (1.0, -1.0)):                      # (her left eye is at +x)
            v = co - c; dxz = np.hypot(v[:, 0], v[:, 2])
            k = (1 - sm(dxz, 0.9 * R, 2.6 * R)) * (v[:, 1] < 0.6 * R) * (np.arange(n) < 13380) * (np.sign(co[:, 0]) == sg)
            th = -sg * math.radians(9.0) * k
            x2 = v[:, 0] * np.cos(th) + v[:, 2] * np.sin(th); z2 = -v[:, 0] * np.sin(th) + v[:, 2] * np.cos(th)
            D[:, 0] += x2 - v[:, 0]; D[:, 2] += z2 - v[:, 2]
        C.add_shape_key(body, "shape-eye-slant", D); made.append(("shape-eye-slant", float(np.linalg.norm(D, axis=1).max()) * 1000))
    for kb in body.data.shape_keys.key_blocks:
        if kb.name.startswith("shape-"): kb.slider_min = -2.0; kb.slider_max = 2.0; kb.value = 0.0
    log("face shapes:", ", ".join("%s %.1f mm" % (a_, b_) for a_, b_ in made))
    return [m[0] for m in made]


kbs, HEAD_SCALE = load_expressions()
LIDS = lid_keys(kbs)
SHAPES = face_shapes()
kbs = body.data.shape_keys.key_blocks
rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
for name in ("Anne_Brows", "Anne_Lashes"):
    if obj(name): transfer_keys(obj(name), kbs)
if obj("Anne_Teeth"): simplify_teeth(obj("Anne_Teeth"))
TONGUE = add_tongue(kbs)
INSIDE = paint_mouth_interior()
interior_clearance(INSIDE, kbs)
interior_follows_skin(INSIDE, kbs)
for kb in kbs: kb.value = 0.0


# ---------------------------------------------------------------- 3. markers
def add_marker(name, loc, bone):
    old = obj(name)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    e = bpy.data.objects.new(name, None); e.empty_display_type = 'SPHERE'; e.empty_display_size = 0.012
    col.objects.link(e); e.location = loc
    bpy.context.view_layer.update(); Mw = e.matrix_world.copy()
    e.parent = rig; e.parent_type = 'BONE'; e.parent_bone = bone
    bpy.context.view_layer.update(); e.matrix_world = Mw; e.hide_render = True
    return e

rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
hip = (B["upperleg01.L"].head_local + B["upperleg01.R"].head_local) / 2
add_marker("Marker_Chest", hip, "root")                                    # the hip centre: what the log scene pins
hb = B["head"]; add_marker("Marker_Head", hb.head_local + (hb.tail_local - hb.head_local) * 0.5 + Vector((0, -0.01, 0)), "head")
if obj("Marker_Sole_L_Heel") is None:                                      # no shoes stage: place the sole markers here
    pts = [body.matrix_world @ BASIS[i] for i in range(len(BASIS))]
    bvh = BVHTree.FromPolygons(pts, [list(p.vertices) for p in body.data.polygons if all(ISB[i] for i in p.vertices)])
    for side in ("L", "R"):
        sx = 1 if B[f"foot.{side}"].head_local.x > 0 else -1
        plant = [pts[i] for i in range(len(pts)) if ISB[i] and pts[i].z < 0.03 and pts[i].x * sx > 0.03 and pts[i].y < 0.08]
        hy, ty = max(p.y for p in plant), min(p.y for p in plant); L = hy - ty
        for nm, t in (("Heel", 0.13), ("Arch", 0.45), ("Ball", 0.72)):
            y = hy - L * t
            band = [p for p in plant if abs(p.y - y) < 0.01]
            cx = sum(p.x for p in band) / len(band)
            hit = bvh.ray_cast(Vector((cx, y, -0.05)), Vector((0, 0, 1)), 0.2)
            z = hit[0].z if hit[0] is not None else 0.0
            add_marker(f"Marker_Sole_{side}_{nm}", Vector((cx, y, z - 0.002)), f"foot.{side}")
            if nm == "Arch": add_marker(f"Marker_Sole_{side}_Out", Vector((cx, y, z - 0.062)), f"foot.{side}")
rig.data.pose_position = 'POSE'


# ---------------------------------------------------------------- 4. animation clips
shoes_json = os.path.join(ROOT, "build", "anne2_shoes.json")
if os.path.exists(shoes_json) and ("shoes" in PARTS or "sandals" in PARTS):
    TH = math.radians(json.load(open(shoes_json))["theta"]); HEEL_H = json.load(open(shoes_json)).get("heel_height", HEEL_H)
else:
    plant = [BASIS[i] for i in range(len(BASIS)) if ISB[i] and BASIS[i].z < 0.03 and BASIS[i].x > 0.03 and BASIS[i].y < 0.08]
    hy, ty = max(p.y for p in plant), min(p.y for p in plant)
    TH = math.asin(min(0.95, HEEL_H / ((hy - 0.034) - (hy - 0.72 * (hy - ty)))))
log("heel pitch theta (deg)", round(math.degrees(TH), 2))

REST_DIR = {b.name: (b.tail_local - b.head_local).normalized() for b in B}
TOES = [b.name for b in B if b.name.startswith("toe")]
SHOES = [o for o in (obj("Anne_Heel_L"), obj("Anne_Heel_R")) if o]
SUIT = obj("Anne_Suit")

def aim(bname, d):
    """Rotate a pose bone about its head so it points along d (armature space)."""
    pb = rig.pose.bones[bname]; bpy.context.view_layer.update()
    q = (pb.tail - pb.head).normalized().rotation_difference(Vector(d).normalized())
    M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()

def rotx(v, a): return Matrix.Rotation(a, 3, 'X') @ Vector(v)
def mirror(d): return (-d[0], d[1], d[2])

def set_feet(phis, toe_flat):
    """Pitch each foot by phi from rest; with toe_flat the toes bend back so they stay on the ground (heels)."""
    for side, phi in phis.items():
        aim(f"foot.{side}", rotx(REST_DIR[f"foot.{side}"], phi))
        for t in TOES:
            if t.endswith("-1." + side): aim(t, rotx(REST_DIR[t], phi - toe_flat))

def leg(side, thigh, shin):
    f = (lambda d: d) if side == "L" else mirror
    return {f"upperleg01.{side}": f(thigh), f"upperleg02.{side}": f(thigh), f"lowerleg01.{side}": f(shin), f"lowerleg02.{side}": f(shin)}

def arms(swing_left, out=0.17):
    """Arms hanging at the sides; swing_left in -1..1 swings the left arm forward and the right arm back."""
    pose = {}
    for side, s in (("L", swing_left), ("R", -swing_left)):
        up = (out, -0.22 * s, -0.97); lo = (out * 0.65, -0.16 - 0.22 * max(s, 0), -0.97)
        if side == "R": up, lo = mirror(up), mirror(lo)
        pose.update({f"upperarm01.{side}": up, f"upperarm02.{side}": up, f"lowerarm01.{side}": lo, f"lowerarm02.{side}": lo})
    return pose

def lowest_z(objects):
    z = 1e9
    for o in objects:
        z = min(z, min(p.z for p in world_verts(o)))
    return z

def move_root(dv=None, rot=None):
    root = rig.pose.bones["root"]; M = root.matrix.copy(); h = M.translation.copy()
    if rot is not None: M = Matrix.Translation(h) @ rot.to_4x4() @ Matrix.Translation(-h) @ M
    if dv is not None: M.translation += Vector(dv)
    root.matrix = M; bpy.context.view_layer.update()

def key_all(frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if pb.name == "root": pb.keyframe_insert("location", frame=frame)

ACTIONS = {}
def new_action(name):
    old = bpy.data.actions.get(name)
    if old: bpy.data.actions.remove(old)
    a = bpy.data.actions.new(name); a.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = a; ACTIONS[name] = a

def standing(frame, pose, feet, heels=True, extra=None):
    """Key a standing pose: aim the bones, set the feet, then drop the root so the lowest shoe (or bare foot) touches the ground."""
    reset_pose()
    for b, d in pose.items(): aim(b, d)
    set_feet(feet, TH if heels else 0.0)
    if extra: extra()
    ground = SHOES if (heels and SHOES) else [body]
    move_root(dv=(0, 0, -lowest_z(ground)))
    key_all(frame)

FRONT = ((0.02, -0.36, -0.93), (0.02, -0.10, -0.99)); BACK = ((0.02, 0.26, -0.96), (0.02, 0.44, -0.90))
STAND = ((0.02, 0.03, -1.0), (0.02, 0.05, -1.0));     SWING = ((0.02, -0.24, -0.97), (0.02, 0.36, -0.93))
STILL = {**leg("L", (-0.030, 0.0, -1), (-0.030, 0.02, -1)), **leg("R", (-0.030, 0.0, -1), (-0.030, 0.02, -1)), **arms(0)}      # legs together (x < 0 = towards the middle)
d10, d12, d22 = math.radians(10), math.radians(12), math.radians(22)

def key_walk(name, heels):
    new_action(name)
    base = TH if heels else 0.0
    lean = lambda: aim("spine03", (0, -0.04, 1))
    for f, front, swing in ((1, "R", +1), (13, "L", -1), (25, "R", +1)):
        back = "L" if front == "R" else "R"
        standing(f, {**leg(front, *FRONT), **leg(back, *BACK), **arms(swing)}, {front: base - d10, back: base + d22}, heels, lean)
    for f, stand in ((7, "R"), (19, "L")):
        sw = "L" if stand == "R" else "R"
        standing(f, {**leg(stand, *STAND), **leg(sw, *SWING), **arms(0)}, {stand: base, sw: base + d12}, heels, lean)

def key_idle(name, heels):
    new_action(name)
    base = TH if heels else 0.0
    breathe = lambda: (aim("spine01", (0, 0.035, 1)), aim("neck01", (0.03, -0.08, 1)))
    standing(1, STILL, {"L": base, "R": base}, heels)
    standing(30, STILL, {"L": base, "R": base}, heels, breathe)
    standing(60, STILL, {"L": base, "R": base}, heels)

def key_stomp(name, heels):
    """One angry stamp of the foot. 'Stomp' is in her shoes, 'StompBare' without (the game picks by what she is wearing)."""
    new_action(name)
    base = TH if heels else 0.0
    fists = {}
    for side in ("L", "R"):
        up = (0.2, 0.14, -0.97); lo = (0.14, -0.30, -0.94)
        if side == "R": up, lo = mirror(up), mirror(lo)
        fists.update({f"upperarm01.{side}": up, f"upperarm02.{side}": up, f"lowerarm01.{side}": lo, f"lowerarm02.{side}": lo})
    angry = lambda: (aim("spine03", (0, -0.12, 1)), aim("head", (0, -0.30, 0.95)))
    knee = ((0.04, -0.62, -0.78), (0.04, 0.12, -0.99))
    for f, lift in ((1, None), (6, "R"), (10, None), (25, None)):      # one stamp of the right foot, then she stands her ground
        pose = {**STILL, **fists, **(leg(lift, *knee) if lift else {})}
        standing(f, pose, {"L": base + (0.2 if lift == "L" else 0.0), "R": base + (0.2 if lift == "R" else 0.0)}, heels, angry)

# --- stuck in the log: lying face down, propped on the forearms, chest arched up, head upright, shins bent up
PRONE = Matrix.Rotation(math.radians(90), 3, 'X')
blen = lambda n: (B[n].tail_local - B[n].head_local).length
BELLY_OBJS = [o for o in (SUIT, body) if o]
def belly_z():
    """Lowest point of her trunk between the knees and the ribs (what rests on the log floor)."""
    hy = rig.pose.bones["upperleg01.L"].head.y; z = 1e9
    for o in BELLY_OBJS:
        for p in world_verts(o):
            if hy - 0.30 < p.y < hy + 0.40 and abs(p.x) < 0.3 and p.z < z: z = p.z
    return z

def prone(frame, bend_l, bend_r, ankle_l, ankle_r, arch=1.0, head=(0.0, 0.0), arm_spread=0.0, sway=0.0, curl=0.0, spread=0.10):
    reset_pose(); move_root(rot=PRONE); move_root(dv=(sway, 0, -0.62))
    for side, b in (("L", bend_l), ("R", bend_r)):
        thigh = (spread, 1.0, -0.05); shin = (spread * 0.6, math.cos(b), math.sin(b))
        if side == "R": thigh, shin = mirror(thigh), mirror(shin)
        for bn in (f"upperleg01.{side}", f"upperleg02.{side}"): aim(bn, thigh)
        for bn in (f"lowerleg01.{side}", f"lowerleg02.{side}"): aim(bn, shin)
    for bn, z in (("spine04", 0.06), ("spine03", 0.28), ("spine02", 0.52), ("spine01", 0.70)):
        zz = min(0.95, z * arch); aim(bn, (0, -math.sqrt(1 - zz * zz), zz))
    for bn, z in (("neck01", 0.86), ("neck02", 0.94), ("neck03", 0.985)):
        zz = min(0.995, z * (0.75 + 0.25 * arch)); aim(bn, (head[0] * 0.4, -math.sqrt(1 - zz * zz), zz))
    aim("head", (head[0], head[1], 1.0))
    ground = belly_z() - (LOG_FLOOR + 0.004)                    # the ground outside the log, relative to her
    for side in ("L", "R"):
        sg = 1 if side == "L" else -1
        sh = rig.pose.bones[f"upperarm01.{side}"].head
        lu = blen(f"upperarm01.{side}") + blen(f"upperarm02.{side}")
        c = max(0.25, min(0.96, (sh.z - ground - 0.05) / lu)); rem = math.sqrt(1 - c * c)
        up = (sg * (0.10 + 0.25 * rem + arm_spread), -rem, -c)
        for bn in (f"upperarm01.{side}", f"upperarm02.{side}"): aim(bn, up)
        el = rig.pose.bones[f"lowerarm01.{side}"].head
        lf = blen(f"lowerarm01.{side}") + blen(f"lowerarm02.{side}")
        sl = max(-0.6, min(0.0, -(el.z - ground - 0.035) / lf))
        lo = (sg * -0.10, -math.sqrt(1 - sl * sl), sl)
        for bn in (f"lowerarm01.{side}", f"lowerarm02.{side}"): aim(bn, lo)
        aim(f"wrist.{side}", (sg * -0.05, -1.0, 0.0))
    for side, a in (("L", ankle_l), ("R", ankle_r)):
        pb = rig.pose.bones[f"lowerleg02.{side}"]; shin = (pb.tail - pb.head).normalized()
        aim(f"foot.{side}", Matrix.Rotation(-math.pi / 2 + a, 3, 'X') @ shin)
        for tn in TOES:
            if tn.endswith("-1." + side):
                fb = rig.pose.bones[f"foot.{side}"]; fd = (fb.tail - fb.head).normalized()
                aim(tn, Matrix.Rotation(curl, 3, 'X') @ fd)
    key_all(frame)

def key_stuck():
    new_action("StuckIdle")
    prone(1,  0.85, 0.85, 0.15, 0.15, arch=1.00, head=(0.00, 0.05))
    prone(30, 0.95, 0.80, 0.25, 0.10, arch=0.94, head=(0.10, 0.00))
    prone(60, 0.85, 0.85, 0.15, 0.15, arch=1.00, head=(0.00, 0.05))
    new_action("StuckStruggle")
    for f, bl, br, al, ar, hx, sw in ((1, 1.45, 0.30, 0.45, 0.05, 0.25, 0.03), (13, 0.30, 1.45, 0.05, 0.45, -0.25, -0.03), (25, 1.45, 0.30, 0.45, 0.05, 0.25, 0.03)):
        prone(f, bl, br, al, ar, arch=1.05, head=(hx, 0.10), arm_spread=0.05, sway=sw)
    for f in (7, 19): prone(f, 0.85, 0.85, 0.20, 0.20, arch=0.85, head=(0.00, -0.10))
    new_action("StuckTickled")
    for f in (1, 7, 13): prone(f, 0.95 if f != 7 else 1.00, 0.80, -0.25, 0.35, arch=1.08, head=(0.12, 0.30), curl=0.55, sway=0.02)
    for f in (4, 10): prone(f, 0.80, 1.00 if f == 4 else 0.95, 0.35, -0.25, arch=0.95, head=(-0.08, 0.02), curl=-0.30, sway=-0.02)

# --- (10-03) a foot planted beside her on the ground. 'flat': as it always was (ankle at SIT_ANKLE, pitched TH: bare
# or in flat shoes). 'wedge': standing in the mimic wedge (logscene.js WH: heel seat 9.1 cm up, ball 2.4 cm up, 10.8 cm
# apart), so the wedge that the game fits under her foot stands ON the ground instead of half in it: pitched by TW, the
# ankle raised until the ball marker is on the toe plate, the toes flat on it.
MIM_HH, MIM_BH, MIM_BZ = 0.091, 0.024, 0.108
TW = math.atan2(MIM_HH - MIM_BH, MIM_BZ)

def marker_z(name):
    o = bpy.data.objects.get(name)
    if not o: return None
    bpy.context.view_layer.update(); return o.matrix_world.translation.z

def plant_foot(side, ax, ay, mode="flat"):
    up_, lo_ = (f"upperleg01.{side}", f"upperleg02.{side}"), (f"lowerleg01.{side}", f"lowerleg02.{side}")
    z, phi = (SIT_ANKLE + 0.065, TW) if mode == "wedge" else (SIT_ANKLE, TH)
    for _ in range(4 if mode == "wedge" else 1):
        ik2(up_, lo_, (ax, ay, z), (0, 0, 1))
        aim(f"foot.{side}", rotx(REST_DIR[f"foot.{side}"], phi))
        for tn in TOES:
            if tn.endswith("-1." + side): aim(tn, REST_DIR[tn])
        if mode != "wedge": break
        bz = marker_z(f"Marker_Sole_{side}_Ball")
        if bz is None: break
        z += (MIM_BH + 0.002) - bz

# --- sitting on the ground, leaning back on her hands (the mimic-shoes scene): right leg held out, left foot planted
def sit(frame, lift_r, ankle_r, curl_r, lean=25.0, head=(0.0, 0.0), sway=0.0, left=None, heel_r=False, plant="flat"):
    """lift_r: how far the right leg is raised (degrees above level). ankle_r / curl_r: ankle and toe angles of that
    foot (radians; ankle 0 = sole square to the shin). left = (lift, ankle, curl) raises the left leg too; otherwise
    its foot is planted in its shoe. heel_r: the right foot is held as it sits in a shoe."""
    reset_pose(); move_root(rot=Matrix.Rotation(math.radians(-lean), 3, 'X'))
    for bn in ("neck01", "neck02", "neck03"): aim(bn, (head[0] * 0.5, 0.10 + head[1] * 0.5, 1.0))
    aim("head", (head[0], head[1], 1.0))
    for side, sg in (("L", 1), ("R", -1)):
        aim(f"upperarm01.{side}", (sg * 0.20, 0.52, -0.83)); aim(f"upperarm02.{side}", (sg * 0.20, 0.52, -0.83))
        aim(f"lowerarm01.{side}", (sg * 0.06, 0.30, -0.95)); aim(f"lowerarm02.{side}", (sg * 0.06, 0.30, -0.95))
        aim(f"wrist.{side}", (sg * 0.25, 0.85, -0.25))
    def raised(side, sg, lift, ankle, curl, heel):
        e = math.radians(lift); d = (sg * 0.05, -math.cos(e), math.sin(e)); d2 = (sg * 0.03, -math.cos(e + 0.06), math.sin(e + 0.06))
        for bn in (f"upperleg01.{side}", f"upperleg02.{side}"): aim(bn, d)
        for bn in (f"lowerleg01.{side}", f"lowerleg02.{side}"): aim(bn, d2)
        pb = rig.pose.bones[f"lowerleg02.{side}"]; shin = (pb.tail - pb.head).normalized()
        fd = Matrix.Rotation(-math.pi / 2 + (TH if heel else ankle), 3, 'X') @ shin
        aim(f"foot.{side}", fd)
        td = Matrix.Rotation(-math.pi / 2, 3, 'X') @ shin if heel else Matrix.Rotation(curl, 3, 'X') @ fd
        for tn in TOES:
            if tn.endswith("-1." + side): aim(tn, td)
    raised("R", -1, lift_r, ankle_r, curl_r, heel_r)
    if left: raised("L", 1, left[0], left[1], left[2], heel_r)
    else:    raised("L", 1, 40.0, 0.0, 0.0, True)                         # out of the way while the seat is found
    # sit her on the ground: the lowest point of her trunk and hands
    z = min(p.z for p in world_verts(body) if p.y > rig.pose.bones["upperleg01.L"].head.y - 0.12)
    move_root(dv=(sway, 0, -z))
    if not left:                                                          # plant the left foot, in its shoe
        hip = rig.pose.bones["upperleg01.L"].head.copy()
        plant_foot("L", hip.x + 0.03, hip.y - 0.40, plant)
    key_all(frame)

def key_sit():
    global SIT_ANKLE
    reset_pose(); set_feet({"L": TH, "R": TH}, TH); move_root(dv=(0, 0, -lowest_z(SHOES if SHOES else [body])))
    SIT_ANKLE = rig.pose.bones["foot.L"].head.z                           # ankle height when the shoe stands on the ground
    new_action("SitIdle")                                                 # trying the shoes on: she turns her foot to look
    sit(1, 12, 0, 0, heel_r=True); sit(30, 17, 0, 0, head=(0.04, -0.06), heel_r=True); sit(60, 12, 0, 0, heel_r=True)
    new_action("MimSit")                                                  # (10-03) SitIdle in the mimic wedges: the planted foot stands in its wedge
    sit(1, 12, 0, 0, heel_r=True, plant="wedge"); sit(30, 17, 0, 0, head=(0.04, -0.06), heel_r=True, plant="wedge"); sit(60, 12, 0, 0, heel_r=True, plant="wedge")
    new_action("SitTickle")                                               # one foot: toes curl and flare, she squirms
    for f, lift, ank, curl, hd, sw, ln in ((1, 14, -0.10, 0.50, (0.10, 0.22), 0.012, 27), (7, 18, 0.22, -0.35, (-0.06, 0.34), -0.012, 31),
                                           (13, 13, -0.18, 0.55, (0.12, 0.26), 0.012, 26), (19, 19, 0.25, -0.30, (-0.10, 0.36), -0.012, 32), (25, 14, -0.10, 0.50, (0.10, 0.22), 0.012, 27)):
        sit(f, lift, ank, curl, lean=ln, head=hd, sway=sw, heel_r=True, plant="wedge")   # her feet stay in the mimic shoes (the planted one stands in its wedge)
    new_action("SitBoth")                                                 # both feet: she falls back on her elbows' worth of lean and kicks
    for f, a, b in ((1, 0, 1), (7, 1, 0), (13, 0, 1), (19, 1, 0), (25, 0, 1)):
        R = (15, -0.15, 0.50) if a else (21, 0.25, -0.30); Lg = (15, -0.15, 0.50) if b else (21, 0.25, -0.30)
        sit(f, R[0], R[1], R[2], lean=36 + 3 * a, head=(0.10 if a else -0.10, 0.34), sway=0.012 if a else -0.012, left=Lg, heel_r=True)

# --- putting the mimic shoes on: sitting forward with her knees up, both hands at one foot, then the other, then she leans back
def ik2(upper, lower, target, pole):
    root = rig.pose.bones[upper[0]].head.copy(); l1 = sum(blen(b) for b in upper); l2 = sum(blen(b) for b in lower)
    dv = Vector(target) - root; d = min(dv.length, (l1 + l2) * 0.98); dn = dv.normalized()
    a_ = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h_ = math.sqrt(max(0.0, l1 * l1 - a_ * a_))
    up = Vector(pole) - dn * dn.dot(Vector(pole)); up.normalize()
    mid = root + dn * a_ + up * h_
    for bn in upper: aim(bn, mid - root)
    for bn in lower: aim(bn, root + dn * d - mid)

def put(frame, reach, lean=-16.0, dist=None, plant=None):
    dist = dist or {"L": 0.36, "R": 0.36}; plant = plant or {}
    reset_pose(); move_root(rot=Matrix.Rotation(math.radians(-lean), 3, 'X'))
    for bn in ("neck01", "neck02", "neck03"): aim(bn, (0.0, -0.22, 1.0))
    aim("head", (0.06 if reach == "L" else -0.06, -0.50, 1.0))
    e = math.radians(40.0)
    for side, sg in (("L", 1), ("R", -1)):
        for bn in (f"upperleg01.{side}", f"upperleg02.{side}", f"lowerleg01.{side}", f"lowerleg02.{side}"): aim(bn, (sg * 0.05, -math.cos(e), math.sin(e)))
    z = min(p.z for p in world_verts(body) if p.y > rig.pose.bones["upperleg01.L"].head.y - 0.12)
    move_root(dv=(0, 0, -z))
    for side, sg in (("L", 1), ("R", -1)):
        hip = rig.pose.bones[f"upperleg01.{side}"].head.copy()
        plant_foot(side, hip.x + sg * 0.03, hip.y - dist[side], plant.get(side, "flat"))
    ank = rig.pose.bones[f"foot.{reach}"].head.copy()
    for side, sg in (("L", 1), ("R", -1)):
        ik2((f"upperarm01.{side}", f"upperarm02.{side}"), (f"lowerarm01.{side}", f"lowerarm02.{side}"), ank + Vector((sg * 0.075, 0.075, 0.075)), (sg * 0.8, 0.3, -0.3))
        aim(f"wrist.{side}", (-sg * 0.35, -0.75, -0.55))
    key_all(frame)

def key_put():
    new_action("SitPutOn")
    put(1, "R"); put(24, "R"); put(36, "L"); put(58, "L")
    sit(76, 12, 0, 0, heel_r=True)
    new_action("MimPutOn")                                                # (10-03) the mimic wedges: each foot rises into its wedge as it goes on
    put(1, "R"); put(24, "R", plant={"R": "wedge"}); put(36, "L", plant={"R": "wedge"}); put(58, "L", plant={"R": "wedge", "L": "wedge"})
    sit(76, 12, 0, 0, heel_r=True, plant="wedge")

if "--skip-anim" not in argv:
    import gait                                    # Idle, Walk, Run and their barefoot twins: the gait model (gait.py)
    HI = None                                          # the high heels' own sole flashes (gait.build `hi`)
    try:
        st_ = json.load(open(shoes_json)).get("styles", {}).get("heels")
        hs_ = [o for o in (bpy.data.objects.get("Anne_Shoe_heels_L"), bpy.data.objects.get("Anne_Shoe_heels_R")) if o]
        if st_ and len(hs_) == 2: HI = (hs_, math.radians(st_["theta_worn"]))
    except Exception as e: log("no heels for the sole flashes:", e)
    gait.build(rig, SHOES, TH, new_action, log, hi=HI)
    reset_pose()
    key_stomp("Stomp", True); key_stomp("StompBare", False); key_stuck(); key_sit(); key_put()
    import poses                                   # the story's poses: camp, gestures, the forest's capture gags (poses.py)
    poses.build(rig, body, SHOES, SUIT, TH, new_action, log)
    reset_pose()
    rig.animation_data.action = None
    for tr in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(tr)
    for name, a in ACTIONS.items():
        for fc in a.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
        tr = rig.animation_data.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, int(a.frame_range[0]), a); st.name = name; tr.mute = True
    log("clips", {n: tuple(int(x) for x in a.frame_range) for n, a in ACTIONS.items()})


# ---------------------------------------------------------------- 5. numbers the game needs
def stuck_metrics():
    out = {}
    if "StuckIdle" not in ACTIONS: return out
    rig.animation_data.action = ACTIONS["StuckIdle"]; sc.frame_set(1); bpy.context.view_layer.update()
    hipm = obj("Marker_Chest").matrix_world.translation.copy(); headm = obj("Marker_Head").matrix_world.translation.copy()
    belly = belly_z()
    out = {"hipAboveBelly": round(hipm.z - belly, 4), "headNorthOfHip": round(hipm.y - headm.y, 4), "headAboveBelly": round(headm.z - belly, 4)}
    rig.animation_data.action = None
    return out

reset_pose(); rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
head_top = max(BASIS[i].z for i in range(len(BASIS)) if ISB[i])
eyes_o = obj("Anne_Eyes")
eye_z = sum(p.z for p in world_verts(eyes_o)) / len(eyes_o.data.vertices) if eyes_o else head_top - 0.12
rig.data.pose_position = 'POSE'
SM = stuck_metrics()
metrics = {
    "height": round(head_top, 4), "eyeHeight": round(eye_z, 4), "thetaDeg": round(math.degrees(TH), 3), "heelHeight": HEEL_H,
    "clips": {n: round((a.frame_range[1] - a.frame_range[0]) / sc.render.fps, 4) for n, a in ACTIONS.items()},
    # locomotion: metres covered by one loop of each clip, and the speed each was made for (the game blends by speed)
    "stride": {n: getattr(__import__("gait"), n.upper())["stride"] for n in ("Walk", "Jog", "Run")},
    "gaitSpeed": {n: round(getattr(__import__("gait"), n.upper())["stride"] / (getattr(__import__("gait"), n.upper())["frames"] / 24.0), 3) for n in ("Walk", "Jog", "Run")},
    "expressions": EXPRESSIONS, "eyelidCloseDeg": {k: v[0] for k, v in LIDS.items()}, "headScale": round(HEAD_SCALE, 3),
    "stuckPose": SM,
}
S1J = ctx.get("s1_json") or {}
if S1J.get("eye_centre_L") and S1J.get("eye_radius"):                    # the stylised eyeballs are spheres: say so exactly
    R = S1J["eye_radius"]
    metrics["eyes"] = {"left": {"centre": S1J["eye_centre_L"], "half": [R, R, R]}, "right": {"centre": S1J["eye_centre_R"], "half": [R, R, R]}}
if SM:
    hipY = LOG_FLOOR + 0.004 + SM["hipAboveBelly"]
    metrics["stuck"] = {"hipY": round(hipY, 4), "hipNorth": 0.05,
                        "faceY": round(LOG_FLOOR + 0.004 + SM["headAboveBelly"] - 0.02, 4), "faceNorth": round(SM["headNorthOfHip"] + 0.05 - 0.40, 4)}
log("metrics", json.dumps(metrics))


# ---------------------------------------------------------------- 6. export meshes: visible skin, head split, subdivision
def duplicate_part(name, keep_faces, with_keys):
    """A copy of the body restricted to some faces, with one level of subdivision baked in. Shape keys survive
    (each key is pushed through the same subdivision)."""
    o = body.copy(); o.data = body.data.copy(); o.name = name; o.data.name = name
    col.objects.link(o)
    o.parent = rig; o.matrix_parent_inverse = body.matrix_parent_inverse.copy()
    for m in list(o.modifiers):
        if m.type != 'ARMATURE': o.modifiers.remove(m)
    keep_v = {i for p in body.data.polygons if p.index in keep_faces for i in p.vertices}
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep_faces], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free(); o.data.update()
    if not with_keys and o.data.shape_keys:
        with override(o): bpy.ops.object.shape_key_remove(all=True, apply_mix=False)
    arm = next(m for m in o.modifiers if m.type == 'ARMATURE'); arm.object = rig
    if SUBDIV <= 0: return o
    arm.show_viewport = False
    sub = o.modifiers.new("Sub", "SUBSURF"); sub.levels = SUBDIV; sub.render_levels = SUBDIV; sub.boundary_smooth = 'PRESERVE_CORNERS'
    keys = [k.name for k in o.data.shape_keys.key_blocks if k.name != "Basis"] if o.data.shape_keys else []
    if keys:
        for k in o.data.shape_keys.key_blocks: k.value = 0.0
    dg = bpy.context.evaluated_depsgraph_get(); bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    base = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    shapes = {}
    for kn in keys:
        o.data.shape_keys.key_blocks[kn].value = 1.0
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        em = o.evaluated_get(dg).to_mesh()
        shapes[kn] = [v.co.copy() for v in em.vertices]
        o.evaluated_get(dg).to_mesh_clear()
        o.data.shape_keys.key_blocks[kn].value = 0.0
    groups = [g.name for g in o.vertex_groups]
    new = bpy.data.objects.new(name + "_x", base); col.objects.link(new)
    for g in groups: new.vertex_groups.new(name=g)
    new.parent = rig; new.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    if shapes:
        new.shape_key_add(name="Basis", from_mix=False)
        for kn, cos in shapes.items():
            sk = new.shape_key_add(name=kn, from_mix=False)
            for i, c in enumerate(cos): sk.data[i].co = c
    new.modifiers.new("Armature", "ARMATURE").object = rig
    for p in new.data.polygons: p.use_smooth = True
    bpy.data.objects.remove(o, do_unlink=True)
    new.name = name; new.data.name = name
    return new

def skin_and_feet(skin_faces):
    """Anne_Skin (SUBDIV levels) and Anne_Feet (FOOT_SUBDIV levels). The whole skin is subdivided at both levels and only
    then cut above the ankles, so the surface runs on across the cut as if it were one mesh. The coarser side is given
    the finer side's extra points along the cut (a watertight join) and both sides use the finer mesh's normals there,
    so the join does not show even in close-up."""
    import numpy as np
    from mathutils.kdtree import KDTree
    foot = {p.index for p in body.data.polygons if p.index in skin_faces and all(BASIS[i].z < FOOT_Z for i in p.vertices)}
    src = body.copy(); src.data = body.data.copy(); src.name = "Anne_SkinSrc"; col.objects.link(src)
    src.parent = rig; src.matrix_parent_inverse = body.matrix_parent_inverse.copy()
    for m in list(src.modifiers):
        if m.type != 'ARMATURE': src.modifiers.remove(m)
    bm = bmesh.new(); bm.from_mesh(src.data)
    lay = bm.faces.layers.int.new("part"); bm.faces.ensure_lookup_table()
    for f in bm.faces: f[lay] = 1 if f.index in foot else 0
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in skin_faces], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(src.data); bm.free(); src.data.update()
    if src.data.shape_keys:
        with override(src): bpy.ops.object.shape_key_remove(all=True, apply_mix=False)
    next(m for m in src.modifiers if m.type == 'ARMATURE').show_viewport = False
    groups = [g.name for g in src.vertex_groups]

    def level(n):
        sub = src.modifiers.new("Sub", "SUBSURF"); sub.levels = n; sub.render_levels = n
        sub.boundary_smooth = 'PRESERVE_CORNERS'; sub.use_limit_surface = True; sub.quality = 3
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        src.modifiers.remove(sub)
        return me

    def arrays(me):
        n = len(me.vertices); co = np.empty(n * 3, np.float32); nr = np.empty(n * 3, np.float32)
        me.vertices.foreach_get("co", co); me.vertex_normals.foreach_get("vector", nr)
        return co.reshape(-1, 3), nr.reshape(-1, 3)

    def tree(points):
        kd = KDTree(len(points))
        for i, c in enumerate(points): kd.insert(c, i)
        kd.balance(); return kd

    def cut(me, keep):
        part = np.empty(len(me.polygons), np.int32); me.attributes["part"].data.foreach_get("value", part)
        b = bmesh.new(); b.from_mesh(me); b.faces.ensure_lookup_table()
        bmesh.ops.delete(b, geom=[f for f in b.faces if part[f.index] != keep], context='FACES')
        bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context='VERTS')
        return b

    lo, hi = level(SUBDIV), level(FOOT_SUBDIV)
    (lo_co, lo_n), (hi_co, hi_n) = arrays(lo), arrays(hi)
    lo_kd, hi_kd = tree(lo_co), tree(hi_co)
    b_hi, b_lo = cut(hi, 1), cut(lo, 0)
    seam = [v.co.copy() for v in b_hi.verts if v.is_boundary]            # the feet's only open edges are the two cuts
    seam_kd = tree(seam)
    on_seam = lambda c: seam_kd.find(c)[2] < 2e-5
    edges = [e for e in b_lo.edges if e.is_boundary and on_seam(e.verts[0].co) and on_seam(e.verts[1].co)]
    for e in edges:
        for v in e.verts: v.co = seam_kd.find(v.co)[0]                     # exactly the finer mesh's points
    res = bmesh.ops.subdivide_edges(b_lo, edges=edges, cuts=1)
    new = [g for g in res["geom_inner"] if isinstance(g, bmesh.types.BMVert)]
    worst = 0.0
    for v in new:
        c, i, dist = seam_kd.find(v.co); worst = max(worst, dist); v.co = c
    out = []
    for b, me, name, full_kd, full_n in ((b_lo, lo, "Anne_Skin", lo_kd, lo_n), (b_hi, hi, "Anne_Feet", hi_kd, hi_n)):
        b.to_mesh(me); b.free(); me.update()
        if me.attributes.get("part"): me.attributes.remove(me.attributes["part"])
        for p in me.polygons: p.use_smooth = True
        normals = []
        for v in me.vertices:
            if name == "Anne_Skin" and on_seam(v.co): n = hi_n[hi_kd.find(v.co)[1]]
            else: n = full_n[full_kd.find(v.co)[1]]
            normals.append((float(n[0]), float(n[1]), float(n[2])))
        me.normals_split_custom_set_from_vertices(normals)
        old = obj(name)
        if old: bpy.data.objects.remove(old, do_unlink=True)
        o = bpy.data.objects.new(name, me); me.name = name; col.objects.link(o)
        if not o.vertex_groups:
            for g in groups: o.vertex_groups.new(name=g)
        o.parent = rig; o.matrix_parent_inverse = src.matrix_parent_inverse.copy()
        o.modifiers.new("Armature", "ARMATURE").object = rig
        out.append(o)
    bpy.data.objects.remove(src, do_unlink=True)
    log("feet: base faces", len(foot), "| join: edges", len(edges), "extra points", len(new), "moved by up to mm", round(worst * 1000, 3))
    return out

rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
hidden = group_set(body, "hidden")
visible_faces = [p for p in body.data.polygons if all(ISB[i] for i in p.vertices) and not all(i in hidden for i in p.vertices)]
# The head (which carries the expression morphs) is cut from the body round the neck, under the middle of the choker
# band, along the same tilted plane the band lies in; the morphs fade out just above the cut so the seam never opens.
NECK0 = B["neck01"].head_local.copy(); NECK_AX = (B["neck02"].tail_local - NECK0).normalized()
try:
    import s2_outfit
    split_s = s2_outfit.P["CHOKER_S"] + s2_outfit.P["CHOKER_H"] * 0.5
except Exception:
    split_s = 0.043
axial = [(BASIS[i] - NECK0).dot(NECK_AX) for i in range(len(BASIS))]
split_z = NECK0.z + split_s
def is_head(p):
    return all(axial[i] >= split_s for i in p.vertices) and p.center.z > NECK0.z
basis_kb = body.data.shape_keys.key_blocks["Basis"].data
faded = 0
for kb in body.data.shape_keys.key_blocks:
    if kb.name == "Basis": continue
    for i in range(len(BASIS)):
        if axial[i] < split_s + 0.022 and ISB[i]:
            d = kb.data[i].co - basis_kb[i].co
            if d.length > 1e-7:
                t = max(0.0, min(1.0, (axial[i] - split_s - 0.002) / 0.02)); t = t * t * (3 - 2 * t)
                kb.data[i].co = basis_kb[i].co + d * t; faded += 1
log("neck seam at", round(split_s, 3), "m up the neck; morph offsets faded near it:", faded)
head_faces = {p.index for p in visible_faces if is_head(p)}
skin_faces = {p.index for p in visible_faces} - head_faces
for n in ("Anne_Head", "Anne_Skin", "Anne_Feet"):
    if obj(n): bpy.data.objects.remove(obj(n), do_unlink=True)
head_o = duplicate_part("Anne_Head", head_faces, True)
skin_o, feet_o = skin_and_feet(skin_faces)
log("export skin: head faces", len(head_o.data.polygons), "verts", len(head_o.data.vertices), "| body faces", len(skin_o.data.polygons), "verts", len(skin_o.data.vertices),
    "| feet faces", len(feet_o.data.polygons), "verts", len(feet_o.data.vertices), "| hidden verts", len(hidden), "| split z", round(split_z, 3))
rig.data.pose_position = 'POSE'


# ---------------------------------------------------------------- 7. export
def tri_count(o):
    dg = bpy.context.evaluated_depsgraph_get(); me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); n = len(me.loop_triangles); o.evaluated_get(dg).to_mesh_clear(); return n

EXPORT_NAMES = ["Anne_Head", "Anne_Skin", "Anne_Feet", "Anne_Eyes", "Anne_Teeth", "Anne_Tongue", "Anne_Hair", "Anne_Brows", "Anne_Lashes", "Anne_Suit", "Anne_SuitTrim",
                "Anne_Gloves", "Anne_Choker", "Anne_Gem", "Anne_Hat", "Anne_HatBand", "Anne_Heel_L", "Anne_Heel_R"]
export_objs = [obj(n) for n in EXPORT_NAMES if obj(n)]
extra = [o for o in rig.children_recursive if o.type == 'MESH' and o not in export_objs and o is not body and o.name != "Anne_HeelProp" and not o.hide_render]
if extra: log("also exporting (not in the standard list):", [o.name for o in extra])
export_objs += extra
markers = [o for o in sc.objects if o.name.startswith("Marker_")]
tris = {o.name: tri_count(o) for o in export_objs}
log("triangles", tris, "total", sum(tris.values()))
metrics["triangles"] = tris

reset_pose(); rig.animation_data.action = None
for tr in rig.animation_data.nla_tracks: tr.mute = False
for o in export_objs:
    if o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks: k.value = 0.0
sc.frame_set(1)
for o in bpy.context.view_layer.objects: o.select_set(False)
body.hide_set(True)
for o in [rig] + export_objs + markers:
    o.hide_set(False); o.hide_viewport = False; o.select_set(True)
bpy.context.view_layer.objects.active = rig
glb = os.path.join(ROOT, OUT + ".glb")
res = bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_skins=True, export_def_bones=False,
    export_morph=True, export_morph_normal=False, export_try_sparse_sk=True,
    export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
    export_extras=False, export_image_format='AUTO')
for tr in rig.animation_data.nla_tracks: tr.mute = True
log("exported", glb, res, round(os.path.getsize(glb) / 1e6, 2), "MB")

prop = obj("Anne_HeelProp")
if prop:
    for o in bpy.context.view_layer.objects: o.select_set(False)
    prop.hide_set(False); prop.select_set(True); bpy.context.view_layer.objects.active = prop
    pglb = os.path.join(ROOT, OUT + "_heel_prop.glb")
    bpy.ops.export_scene.gltf(filepath=pglb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_animations=False, export_skins=False, export_morph=False)
    log("exported", pglb, round(os.path.getsize(pglb) / 1e3, 1), "KB")

# the other styles of shoe the player may choose (s2_sandals.STYLES): their loose shoes in one file, and what the game
# must add to her pose for each (more pitch at the ankle and a lift, for the two with a high heel)
more = [o for o in bpy.data.objects if o.name.startswith("Anne_ShoeProp_")]
if more:
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in more: o.hide_set(False); o.hide_viewport = False; o.select_set(True)
    bpy.context.view_layer.objects.active = more[0]
    sglb = os.path.join(ROOT, OUT + "_shoe_props.glb")
    bpy.ops.export_scene.gltf(filepath=sglb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_animations=False, export_skins=False, export_morph=False)
    log("exported", sglb, round(os.path.getsize(sglb) / 1e3, 1), "KB", [o.name for o in more])
hair_json = os.path.join(ROOT, "build", "anne2_hair.json")      # (10-04: her hairstyles, s2_hair.STYLES: the game's list of them)
if os.path.exists(hair_json) and "hair" in PARTS:
    hj = json.load(open(hair_json)); metrics["hair"] = {"order": hj["order"], "styles": {k: {"label": v["label"], "hat": v["hat"]} for k, v in hj["styles"].items()}}
if os.path.exists(shoes_json):
    sj = json.load(open(shoes_json))
    if sj.get("styles"):
        metrics["shoes"] = {"order": sj["order"], "styles": {k: {"label": v["label"], "heel": v["heel"], "closed": v["closed"], "dthetaDeg": v["dtheta"], "lift": v["lift"], "hide": v.get("hide")} for k, v in sj["styles"].items()}}

json.dump(metrics, open(os.path.join(ROOT, OUT + ".json"), "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "build", os.path.basename(OUT) + "_s3.blend"), copy=True)
log("done")
