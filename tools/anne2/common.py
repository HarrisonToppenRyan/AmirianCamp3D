"""Shared helpers for the Anne v2 pipeline (tools/anne2/*.py): headless Blender 4.5 + the MakeHuman add-on (MPFB 2).

Owner: stage 1 (s1_body.py). Stage 2 and 3 scripts import it read-only:

    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import common as C
    HumanService, TargetService, LocationService = C.enable_mpfb()
    ctx = C.open_s1()                      # opens build/anne2_s1.blend, returns the scene objects and the s1 numbers
    C.setup_stage()                        # camera, soft three-point light, grey-blue world
    C.test_pose(ctx["rig"], "b")           # the four fit poses of the spec: "a" arms down, "b" stride, "c" head turn, "d" prone
    C.shot(C.RENDERS + "/s2_hair_b.png", (1.2, -3.0, 1.0), (0, 0, 0.9))

Conventions: 1 unit = 1 m, +Z up, Anne faces -Y, her left is +X. All colours handed to materials and colour
attributes are LINEAR; use hex_lin("#f6cdb4") to convert from the sRGB hex codes in the spec.
"""
import bpy, os, sys, math, json
import numpy as np
from contextlib import contextmanager
from mathutils import Vector, Matrix, Quaternion

# ------------------------------------------------------------------------------------------------ paths
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))            # the project folder (AmirianCamp3D)
BUILD = os.path.join(ROOT, "build")
RENDERS = os.path.join(BUILD, "renders")
TEX = os.path.join(ROOT, "tex")
S1_BLEND = os.path.join(BUILD, "anne2_s1.blend")
S1_JSON = os.path.join(BUILD, "anne2_s1.json")
EYE_TEX = os.path.join(TEX, "anne2_eye.png")
MPFB_ID = "bl_ext.user_default.mpfb"
SCENE = "Anne2"
COLLECTION = "Anne2"
RIG, BODY, EYES, TEETH = "Anne_Rig", "Anne_Body", "Anne_Eyes", "Anne_Teeth"


def argv():
    """Script arguments after the '--' on the Blender command line."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# ------------------------------------------------------------------------------------------------ add-on, files
def enable_mpfb():
    """Enable the MakeHuman add-on and return (HumanService, TargetService, LocationService)."""
    import addon_utils
    addon_utils.enable(MPFB_ID, default_set=True, persistent=True)
    from bl_ext.user_default.mpfb.services import HumanService, TargetService, LocationService
    return HumanService, TargetService, LocationService


def mpfb_paths():
    """(SYS, USR): MPFB system data (targets/<category>/<name>.target.gz) and the user asset pack (eyes, teeth, ...)."""
    _, _, LocationService = enable_mpfb()
    return LocationService.get_mpfb_data(), LocationService.get_user_data()


def new_file():
    """Empty factory file with MPFB enabled again (factory settings switch add-ons off). Returns the scene."""
    import addon_utils
    addon_utils.enable(MPFB_ID, default_set=True, persistent=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable(MPFB_ID, default_set=True, persistent=True)
    return bpy.context.scene


def use_collection(name=COLLECTION, scene=None):
    """Create (if needed) and activate a collection so that new objects land in it. Returns the collection."""
    scene = scene or bpy.context.scene
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    if name not in scene.collection.children:
        scene.collection.children.link(c)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[name]
    return c


def ctx():
    """The stage context of the open file: dict(scene, col, rig, body, eyes, teeth, info) (info = build/anne2_s1.json)."""
    enable_mpfb()
    info = {}
    if os.path.exists(S1_JSON):
        with open(S1_JSON) as f:
            info = json.load(f)
    D = bpy.data.objects
    return {"scene": bpy.data.scenes.get(SCENE) or bpy.context.scene, "col": bpy.data.collections.get(COLLECTION),
            "rig": D.get(RIG), "body": D.get(BODY), "eyes": D.get(EYES), "teeth": D.get(TEETH), "info": info}


def open_s1():
    """Open build/anne2_s1.blend (never save over it) and return ctx()."""
    import addon_utils
    addon_utils.enable(MPFB_ID, default_set=True, persistent=True)
    bpy.ops.wm.open_mainfile(filepath=S1_BLEND)
    addon_utils.enable(MPFB_ID, default_set=True, persistent=True)
    return ctx()


@contextmanager
def override(obj):
    """Context for object operators in background mode: with C.override(o): bpy.ops.object.modifier_apply(modifier="X")."""
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
        yield


# ------------------------------------------------------------------------------------------------ colour
def srgb_to_lin(c):
    """One sRGB channel value (0..1) to linear."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin_to_srgb(c):
    """One linear channel value (0..1) to sRGB."""
    c = min(max(c, 0.0), 1.0)
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_lin(h, alpha=1.0):
    """'#f6cdb4' (sRGB) -> linear (r, g, b, a) for materials and colour attributes."""
    h = h.lstrip("#")
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (alpha,)


def make_material(name, color, rough=0.5, sss=0.0, sss_radius=(1.0, 0.35, 0.2), sss_scale=0.008, coat=0.0, metallic=0.0,
                  spec=0.5, sheen=0.0, vcol=None, emission=0.0):
    """Create or reset a Principled material. color: '#hex' (sRGB) or linear rgb(a). vcol: name of a colour attribute to
    use as base colour instead. Returns the material; its Principled node is material.node_tree.nodes['BSDF']."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.name = "BSDF"; b.location = (0, 0)
    nt.links.new(b.outputs[0], out.inputs[0])
    col = hex_lin(color) if isinstance(color, str) else tuple(color) + (1.0,) * (4 - len(color))
    b.inputs["Base Color"].default_value = col
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Subsurface Weight"].default_value = sss
    b.inputs["Subsurface Radius"].default_value = sss_radius
    b.inputs["Subsurface Scale"].default_value = sss_scale
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Sheen Weight"].default_value = sheen
    if emission:
        b.inputs["Emission Color"].default_value = col
        b.inputs["Emission Strength"].default_value = emission
    if vcol:
        a = nt.nodes.new("ShaderNodeVertexColor"); a.name = "Col"; a.layer_name = vcol; a.location = (-300, 0)
        nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
    m.diffuse_color = col
    return m


# ------------------------------------------------------------------------------------------------ mesh data
def get_co(obj, key=None):
    """Vertex positions (object space) as an (N, 3) float array: the mesh itself, or one shape key (name)."""
    me = obj.data
    a = np.empty(len(me.vertices) * 3, dtype=np.float32)
    if key is None:
        me.vertices.foreach_get("co", a)
    else:
        me.shape_keys.key_blocks[key].data.foreach_get("co", a)
    return a.reshape(-1, 3).astype(np.float64)


def set_co(obj, co):
    """Write an (N, 3) array into the mesh's vertex positions (the mesh must have no shape keys)."""
    me = obj.data
    me.vertices.foreach_set("co", np.asarray(co, dtype=np.float32).ravel())
    me.update()


def eval_verts(obj, world=True, modifiers=("ARMATURE",)):
    """World-space (or object-space) positions of the mesh as it is deformed right now: (N, 3) array.

    Only modifiers whose type is listed stay switched on while evaluating (default: just the Armature), so the result
    has one row per original vertex, in vertex order. Pass modifiers=None to evaluate the full stack (Mask and
    Subdivision change the vertex count)."""
    saved = []
    if modifiers is not None:
        for m in obj.modifiers:
            saved.append((m, m.show_viewport))
            m.show_viewport = m.type in modifiers and m.show_viewport
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    a = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", a)
    ev.to_mesh_clear()
    for m, s in saved:
        m.show_viewport = s
    bpy.context.view_layer.update()
    a = a.reshape(-1, 3).astype(np.float64)
    if world:
        M = np.array(obj.matrix_world)
        a = a @ M[:3, :3].T + M[:3, 3]
    return a


def vg_weights(obj, name):
    """Weights of one vertex group as an (N,) array (0 where the vertex is not in the group; all 0 if no such group)."""
    w = np.zeros(len(obj.data.vertices))
    g = obj.vertex_groups.get(name)
    if g is None:
        return w
    gi = g.index
    for v in obj.data.vertices:
        for ge in v.groups:
            if ge.group == gi:
                w[v.index] = ge.weight
                break
    return w


def vg_mask(obj, name, min_weight=0.5):
    """Boolean (N,) array: vertices whose weight in the group is above min_weight."""
    return vg_weights(obj, name) > min_weight


def set_vg(obj, name, weights):
    """Create or replace a vertex group from an (N,) weight array or a boolean mask (weights of 0 are left out)."""
    g = obj.vertex_groups.get(name)
    if g is not None:
        obj.vertex_groups.remove(g)
    g = obj.vertex_groups.new(name=name)
    w = np.asarray(weights, dtype=float)
    for i in np.nonzero(w > 1e-4)[0]:
        g.add([int(i)], float(min(w[i], 1.0)), 'REPLACE')
    return g


def bone_weights(obj, rig):
    """(names, W): the skin weights as an (N, n_bones) array, columns in the order of names (deform vertex groups)."""
    bones = {b.name for b in rig.data.bones}
    names = [g.name for g in obj.vertex_groups if g.name in bones]
    col = {obj.vertex_groups[n].index: i for i, n in enumerate(names)}
    W = np.zeros((len(obj.data.vertices), len(names)))
    for v in obj.data.vertices:
        for ge in v.groups:
            c = col.get(ge.group)
            if c is not None:
                W[v.index, c] = ge.weight
    return names, W


def body_mask(body):
    """Boolean (N,) array: True for real body vertices (group 'body'), False for MakeHuman helper geometry."""
    return vg_mask(body, "body", 0.5)


def smoothstep(x, lo=0.0, hi=1.0):
    """Hermite 0..1 ramp of x between lo and hi (array or scalar); lo > hi gives a falling ramp."""
    t = np.clip((np.asarray(x, dtype=float) - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def add_subsurf(obj, levels=1, name="CheckSubsurf"):
    """Add (or update) a Subdivision modifier used for check renders; returns it. Stage 3 subdivides once at export."""
    m = obj.modifiers.get(name) or obj.modifiers.new(name, "SUBSURF")
    m.levels = levels; m.render_levels = levels
    return m


def shade_smooth(obj):
    """Smooth shading on every face."""
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()


# ------------------------------------------------------------------------------------------------ expressions
def read_target(path, n_verts, scale=0.1):
    """A MakeHuman .target / .target.gz file as an (N, 3) displacement array in Blender space (metres)."""
    import gzip
    d = np.zeros((n_verts, 3))
    op = gzip.open if str(path).endswith(".gz") else open
    with op(path, "rt") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            i, x, y, z = line.split()
            d[int(i)] = (float(x) * scale, -float(z) * scale, float(y) * scale)
    return d


def mh_rest(body):
    """The unstylised MakeHuman shape of Anne_Body (attribute 'mh_rest', written by stage 1): (N, 3)."""
    a = np.empty(len(body.data.vertices) * 3, dtype=np.float32)
    body.data.attributes["mh_rest"].data.foreach_get("vector", a)
    return a.reshape(-1, 3).astype(np.float64)


def retarget_gain(body, blur=14):
    """Per-vertex size ratio between the stylised Anne_Body and its MakeHuman shape ('mh_rest'): the local edge
    length ratio, smoothed over the surface (about 1.3 on the head, about 2.3 round the eyes). (N,) array."""
    me = body.data
    q = mh_rest(body); p = get_co(body)
    n = len(me.vertices)
    e = np.empty(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get("vertices", e); e = e.reshape(-1, 2)
    lq = np.linalg.norm(q[e[:, 0]] - q[e[:, 1]], axis=1); lp = np.linalg.norm(p[e[:, 0]] - p[e[:, 1]], axis=1)
    sq = np.zeros(n); sp = np.zeros(n); deg = np.zeros(n)
    for k in (0, 1):
        np.add.at(sq, e[:, k], lq); np.add.at(sp, e[:, k], lp); np.add.at(deg, e[:, k], 1.0)
    g = sp / np.maximum(sq, 1e-12)
    for _ in range(blur):
        acc = np.zeros(n)
        np.add.at(acc, e[:, 0], g[e[:, 1]]); np.add.at(acc, e[:, 1], g[e[:, 0]])
        g = 0.5 * g + 0.5 * acc / np.maximum(deg, 1.0)
    return g


def retarget_delta(body, delta):
    """Adapt a MakeHuman displacement (made for the unstylised head, e.g. an expression target) to the stylised
    Anne_Body: every vertex displacement is multiplied by the local size ratio (retarget_gain), so a region that
    stage 1 enlarged moves proportionally further. Directions are kept. Returns an (N, 3) array."""
    return delta * retarget_gain(body)[:, None]


def expression_delta(body, unit, race="caucasian", retarget=True):
    """Displacement (N, 3) of one MakeHuman expression unit (e.g. 'mouth-open', 'mouth-corner-puller',
    'eyebrows-left-up') for Anne_Body, retargeted to the stylised face. For the eyelids use lid_pose() / the lid
    bones instead: a straight-line morph cannot follow the big eyeball."""
    SYS, _ = mpfb_paths()
    d = read_target(os.path.join(SYS, "targets", "expression", "units", race, unit + ".target.gz"), len(body.data.vertices))
    return retarget_delta(body, d) if retarget else d


def add_shape_key(obj, name, delta, value=0.0):
    """Add a shape key (creating the Basis if needed) that moves every vertex by delta (N, 3). Returns the key."""
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
    k = obj.shape_key_add(name=name, from_mix=False)
    co = get_co(obj, "Basis") + delta
    k.data.foreach_set("co", co.astype(np.float32).ravel())
    k.slider_max = 2.0; k.slider_min = -1.0
    k.value = value
    return k


def lid_pose(rig, upper=0.0, lower=0.0, side="LR"):
    """Pose the eyelids with the lid bones (orbicularis03 = upper lid, orbicularis04 = lower lid): the lids turn
    about the centre of the eyeball and so slide over it. upper / lower: degrees towards closing (see
    build/anne2_s1.json 'lid_close_deg' for the angles that just close the eye). Call reset_pose() to undo."""
    for sd in side:
        ec = rig.pose.bones["eye." + sd]
        for bone, deg, sign in (("orbicularis03." + sd, upper, 1.0), ("orbicularis04." + sd, lower, -1.0)):
            pb = rig.pose.bones[bone]
            bpy.context.view_layer.update()
            R = Matrix.Rotation(math.radians(sign * deg), 4, 'X')
            M = pb.matrix.copy(); h = ec.matrix.translation.copy()
            pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()


def jaw_open(rig, degrees):
    """Open the mouth by turning the jaw bone (the lower teeth are skinned to it and follow)."""
    turn(rig, "jaw", "X", degrees)


# ------------------------------------------------------------------------------------------------ posing
def reset_pose(rig):
    """All pose bones back to rest (quaternion rotation mode)."""
    rig.data.pose_position = 'POSE'
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def aim(rig, bone, direction):
    """Rotate a pose bone (shortest arc, about its head) so that it points along direction (armature space)."""
    pb = rig.pose.bones[bone]
    bpy.context.view_layer.update()
    q = (pb.tail - pb.head).normalized().rotation_difference(Vector(direction).normalized())
    M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()


def turn(rig, bone, axis, degrees):
    """Rotate a pose bone about its head, around an armature-space axis ('X', 'Y', 'Z' or a vector), by degrees."""
    pb = rig.pose.bones[bone]
    bpy.context.view_layer.update()
    ax = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}.get(axis) if isinstance(axis, str) else Vector(axis)
    R = Matrix.Rotation(math.radians(degrees), 4, ax)
    M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()


def move_root(rig, offset=None, rot=None):
    """Translate and/or rotate (3x3 or 4x4 matrix, about the root's head) the whole figure through the root bone."""
    root = rig.pose.bones["root"]
    bpy.context.view_layer.update()
    M = root.matrix.copy(); h = M.translation.copy()
    if rot is not None:
        M = Matrix.Translation(h) @ Matrix(rot).to_4x4() @ Matrix.Translation(-h) @ M
    if offset is not None:
        M.translation += Vector(offset)
    root.matrix = M
    bpy.context.view_layer.update()


def _mirror(d):
    return (-d[0], d[1], d[2])


def _both(rig, names, d, side):
    d = d if side == "L" else _mirror(d)
    for n in names:
        aim(rig, f"{n}.{side}", d)


def arms_down(rig, swing=0.0):
    """Arms hanging at the sides; swing > 0 swings the left arm forward and the right arm back (walk)."""
    for side, s in (("L", swing), ("R", -swing)):
        _both(rig, ("upperarm01", "upperarm02"), (0.17, -0.22 * s, -0.97), side)
        _both(rig, ("lowerarm01", "lowerarm02"), (0.11, -0.16 - 0.22 * max(s, 0), -0.97), side)


def test_pose(rig, which):
    """The four fit-test poses of the spec. 'rest': MakeHuman rest pose. 'a': standing, arms down at the sides.
    'b': walking stride (left thigh 35 degrees forward, right thigh 25 degrees back, arms swinging).
    'c': arms down, head turned 40 degrees and tilted 20 degrees. 'd': lying face down, chest arched up about
    60 degrees, head upright, shins bent up 50 degrees (the cut-scene pose; the body lies along +Y, head end at -Y)."""
    reset_pose(rig)
    if which == "rest":
        return
    if which in ("a", "b", "c"):
        arms_down(rig, 1.0 if which == "b" else 0.0)
    if which == "b":
        f, b = math.radians(35), math.radians(25)
        for n in ("upperleg01.L", "upperleg02.L"): aim(rig, n, (0.02, -math.sin(f), -math.cos(f)))
        for n in ("lowerleg01.L", "lowerleg02.L"): aim(rig, n, (0.02, -math.sin(f - 0.35), -math.cos(f - 0.35)))
        for n in ("upperleg01.R", "upperleg02.R"): aim(rig, n, (-0.02, math.sin(b), -math.cos(b)))
        for n in ("lowerleg01.R", "lowerleg02.R"): aim(rig, n, (-0.02, math.sin(b + 0.25), -math.cos(b + 0.25)))
    elif which == "c":
        turn(rig, "neck02", "Z", 14); turn(rig, "neck03", "Z", 12); turn(rig, "head", "Z", 14)
        turn(rig, "neck03", "Y", 8); turn(rig, "head", "Y", 12)
    elif which == "d":
        move_root(rig, rot=Matrix.Rotation(math.radians(90), 3, 'X'))
        for side in ("L", "R"):
            sg = 1 if side == "L" else -1
            for n in ("upperleg01", "upperleg02"): aim(rig, f"{n}.{side}", (sg * 0.10, 1.0, -0.05))
            a = math.radians(50)
            for n in ("lowerleg01", "lowerleg02"): aim(rig, f"{n}.{side}", (sg * 0.06, math.cos(a), math.sin(a)))
        for bn, z in (("spine04", 0.06), ("spine03", 0.28), ("spine02", 0.52), ("spine01", 0.70)):
            aim(rig, bn, (0, -math.sqrt(1 - z * z), z))
        for bn, z in (("neck01", 0.86), ("neck02", 0.94), ("neck03", 0.985)):
            aim(rig, bn, (0, -math.sqrt(1 - z * z), z))
        aim(rig, "head", (0, 0.05, 1.0))
        for side in ("L", "R"):
            sg = 1 if side == "L" else -1
            for n in ("upperarm01", "upperarm02"): aim(rig, f"{n}.{side}", (sg * 0.30, -0.55, -0.78))
            for n in ("lowerarm01", "lowerarm02"): aim(rig, f"{n}.{side}", (sg * -0.10, -0.97, -0.22))
            pb = rig.pose.bones[f"lowerleg02.{side}"]; shin = (pb.tail - pb.head).normalized()
            aim(rig, f"foot.{side}", Matrix.Rotation(-math.pi / 2 + 0.15, 3, 'X') @ shin)
        # rest on the ground: lowest evaluated body point to z = 0
        body = bpy.data.objects.get(BODY)
        if body is not None:
            z = eval_verts(body)[body_mask(body)][:, 2].min()
            move_root(rig, offset=(0, 0, -z))
    elif which != "a":
        raise ValueError("unknown test pose " + repr(which))
    bpy.context.view_layer.update()


# ------------------------------------------------------------------------------------------------ rendering
BG = (0.47, 0.53, 0.60)        # neutral grey-blue backdrop (sRGB)


def setup_stage(scene=None, bg=BG, samples=48, transparent=False, level=1.0):
    """Camera 'Stage_Cam', a soft three-point area-light rig ('Stage_Lights' empty: rotate it about Z to move the
    lights round the figure; shot() does that for you), a grey-blue backdrop with neutral ambient light, EEVEE settings.
    level scales all light. Safe to call again."""
    scene = scene or bpy.context.scene
    D = bpy.data
    coll = D.collections.get("Stage") or D.collections.new("Stage")
    if "Stage" not in scene.collection.children:
        scene.collection.children.link(coll)
    cam = D.objects.get("Stage_Cam")
    if cam is None:
        cam = D.objects.new("Stage_Cam", D.cameras.new("Stage_Cam")); coll.objects.link(cam)
    scene.camera = cam
    cam.data.clip_start = 0.02; cam.data.clip_end = 100
    rigo = D.objects.get("Stage_Lights")
    if rigo is None:
        rigo = D.objects.new("Stage_Lights", None); coll.objects.link(rigo)
        #          name    energy  size  position (figure faces -Y)     colour
        for nm, en, size, loc, colr in (("Stage_Key", 95.0, 1.8, (-1.5, -2.6, 2.5), (1.0, 0.96, 0.90)),
                                        ("Stage_Fill", 30.0, 2.6, (2.4, -2.2, 1.2), (0.88, 0.93, 1.0)),
                                        ("Stage_Rim", 80.0, 1.2, (1.3, 2.6, 2.7), (1.0, 0.97, 0.92)),
                                        ("Stage_Under", 8.0, 2.5, (0.0, -1.6, -0.6), (1.0, 0.92, 0.88))):
            ld = D.lights.new(nm, "AREA"); ld.energy = en; ld.size = size; ld.color = colr
            ld["base_energy"] = en
            lo = D.objects.new(nm, ld); coll.objects.link(lo); lo.parent = rigo; lo.location = loc
            lo.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    for o in rigo.children:
        o.data.energy = o.data.get("base_energy", o.data.energy) * level
    w = D.worlds.get("Stage_World") or D.worlds.new("Stage_World")
    scene.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    back = nt.nodes.new("ShaderNodeBackground"); amb = nt.nodes.new("ShaderNodeBackground")
    mix = nt.nodes.new("ShaderNodeMixShader"); lp = nt.nodes.new("ShaderNodeLightPath")
    back.inputs[0].default_value = tuple(srgb_to_lin(c) for c in bg) + (1.0,)       # what the camera sees
    amb.inputs[0].default_value = (0.80, 0.86, 1.0, 1.0); amb.inputs[1].default_value = 0.22 * level   # soft sky fill
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(amb.outputs[0], mix.inputs[1]); nt.links.new(back.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    engines = [e.identifier for e in scene.render.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    ee = scene.eevee
    for attr, val in (("taa_render_samples", samples), ("use_shadows", True), ("use_raytracing", False),
                      ("use_gtao", True), ("shadow_ray_count", 2), ("shadow_step_count", 6)):
        try: setattr(ee, attr, val)
        except Exception: pass
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    scene.view_settings.view_transform = 'Standard'
    try: scene.view_settings.look = 'None'
    except Exception: pass
    scene.view_settings.exposure = 0.0; scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    return cam, rigo


def look_at(cam, loc, target, roll=0.0):
    """Place the camera at loc looking at target (world space); roll in degrees."""
    cam.location = loc
    q = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y')
    cam.rotation_euler = (q @ Quaternion((0, 0, 1), math.radians(roll))).to_euler()


def shot(path, loc, target, lens=50, res=(560, 700), ortho=None, lights_follow=True, light_target=None, roll=0.0,
         scene=None):
    """Render one still to path. loc/target: camera position and aim point. lens in mm, or ortho = view height in metres
    for an orthographic camera. lights_follow turns the light rig so the key light stays at the camera's upper left and
    centres it on light_target (default: target), which keeps every view (back, soles, close-ups) evenly lit."""
    scene = scene or bpy.context.scene
    cam = bpy.data.objects.get("Stage_Cam")
    if cam is None:
        cam, _ = setup_stage(scene)
    scene.camera = cam
    if ortho:
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'; cam.data.lens = lens
    look_at(cam, loc, target, roll)
    rigo = bpy.data.objects.get("Stage_Lights")
    if rigo is not None:
        t = Vector(light_target if light_target is not None else target)
        if lights_follow:
            d = Vector(loc) - Vector(target)
            rigo.rotation_euler = (0, 0, math.atan2(d.x, -d.y))
            rigo.location = (t.x, t.y, t.z - 1.0)
        else:
            rigo.rotation_euler = (0, 0, 0); rigo.location = (0, 0, 0)
    scene.render.resolution_x, scene.render.resolution_y = int(res[0]), int(res[1])
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    return path


def load_pixels(path):
    """An image file as a float array (H, W, 4), row 0 at the BOTTOM (Blender order), sRGB values 0..1."""
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


def save_pixels(path, a):
    """Write a float array (H, W, 3 or 4), row 0 at the bottom, sRGB values 0..1, as an 8-bit PNG."""
    a = np.asarray(a, dtype=np.float32)
    h, w = a.shape[:2]
    if a.shape[2] == 3:
        a = np.concatenate([a, np.ones((h, w, 1), dtype=np.float32)], axis=2)
    img = bpy.data.images.new("tmp_save", w, h, alpha=True)
    img.pixels.foreach_set(np.clip(a, 0, 1).ravel())
    img.filepath_raw = path; img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return path


def resize_nearest(a, w, h):
    """Nearest-neighbour resize of an (H, W, C) array."""
    H, W = a.shape[:2]
    ys = np.minimum((np.arange(h) * H / h).astype(int), H - 1)
    xs = np.minimum((np.arange(w) * W / w).astype(int), W - 1)
    return a[ys][:, xs]


def montage(paths, out, cols=3, cell=None, pad=6, bg=(0.2, 0.2, 0.22)):
    """Contact sheet of several image files (left to right, top to bottom). cell = (w, h) of each tile (default: the
    first image's size). Handy for looking at many check renders in one go."""
    tiles = [load_pixels(p) for p in paths]
    cw, ch = cell or (tiles[0].shape[1], tiles[0].shape[0])
    rows = (len(tiles) + cols - 1) // cols
    W = cols * cw + (cols + 1) * pad; H = rows * ch + (rows + 1) * pad
    sheet = np.ones((H, W, 4), dtype=np.float32); sheet[:, :, :3] = bg
    for i, t in enumerate(tiles):
        s = min(cw / t.shape[1], ch / t.shape[0])
        tw, th = max(1, int(t.shape[1] * s)), max(1, int(t.shape[0] * s))
        t = resize_nearest(t, tw, th)
        r, c = divmod(i, cols)
        x0 = pad + c * (cw + pad) + (cw - tw) // 2
        y0 = H - (pad + r * (ch + pad)) - ch + (ch - th) // 2
        sheet[y0:y0 + th, x0:x0 + tw, :] = t
    return save_pixels(out, sheet)
