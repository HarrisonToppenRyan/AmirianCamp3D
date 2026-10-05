"""Headless Blender pass: propped-up stuck pose, hip pin marker, re-key, re-export, save."""
import bpy, math, sys
from mathutils import Vector, Matrix

SRC = "/Users/harrisontoppenryan/Documents/AmirianCamp3D/anne_source.blend"
sc = bpy.data.scenes["AnneExport"]
if bpy.context.window:
    bpy.context.window.scene = sc
print("scene:", bpy.context.scene.name, "| objects:", len(sc.objects))
assert bpy.context.scene.name == "AnneExport", "AnneExport is not the active scene"

rig = bpy.data.objects["Anne_Rig"]
col = bpy.data.collections["Anne"]
B = rig.data.bones
print("rig world:", [round(v, 4) for v in rig.matrix_world.translation], "actions:", [a.name for a in bpy.data.actions])

# ---------------------------------------------------------------- hip pin marker
# The log scene pins "Marker_Chest" to a fixed point in the log. Pinning the hips (rigid with the root bone)
# keeps her seated on the log floor while the chest arches and the legs kick.
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'; pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
rig.data.pose_position = 'REST'
bpy.context.view_layer.update()
old = bpy.data.objects.get("Marker_Chest")
if old:
    bpy.data.objects.remove(old, do_unlink=True)
hip = (B["upperleg01.L"].head_local + B["upperleg01.R"].head_local) / 2
mk = bpy.data.objects.new("Marker_Chest", None)
mk.empty_display_type = 'SPHERE'; mk.empty_display_size = 0.012
col.objects.link(mk)
mk.location = hip
bpy.context.view_layer.update()
Mw = mk.matrix_world.copy()
mk.parent = rig; mk.parent_type = 'BONE'; mk.parent_bone = "root"
bpy.context.view_layer.update()
mk.matrix_world = Mw
mk.hide_render = True
rig.data.pose_position = 'POSE'
print("hip marker at", [round(v, 3) for v in hip])

# ---------------------------------------------------------------- new stuck section in anim_src
t = bpy.data.texts["anim_src"]
s = t.as_string()
a = s.index("    # Stuck (prone)")
b = s.index("    rig.animation_data.action = None\n    for n, a in acts.items():")
NEW = r'''    # Stuck: propped on her forearms inside the log. armature space: head end = -Y, feet end = +Y, up = +Z
    PRONE = Matrix.Rotation(math.radians(90), 3, 'X')
    body = bpy.data.objects["Anne_Body"]
    blen = lambda n: (B[n].tail_local - B[n].head_local).length
    FLOOR_GAP = 0.092                      # belly skin above the ground outside the log (wall 0.08 + cloth)
    def lowest_z():
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        hy = rig.pose.bones["upperleg01.L"].head.y
        ev = body.evaluated_get(dg); m = ev.to_mesh(); mw = body.matrix_world
        z = 1e9
        for v in m.vertices:
            p = mw @ v.co
            if hy - 0.30 < p.y < hy + 0.40 and abs(p.x) < 0.3 and p.z < z: z = p.z
        ev.to_mesh_clear(); return z
    def prone(frame, bL, bR, aL, aR, arch=1.0, head=(0.0, 0.0), arm_sp=0.0, sway=0.0, curl=0.0, spread=0.10):
        reset(); move_root(rot=PRONE); move_root(dv=(sway, 0, -0.62))
        for side, b in (("L", bL), ("R", bR)):
            th_ = (spread, 1.0, -0.05); shin = (spread * 0.6, math.cos(b), math.sin(b))
            if side == "R": th_, shin = mirror(th_), mirror(shin)
            for bn in (f"upperleg01.{side}", f"upperleg02.{side}"): aim(bn, th_)
            for bn in (f"lowerleg01.{side}", f"lowerleg02.{side}"): aim(bn, shin)
        for bn, z in (("spine04", 0.06), ("spine03", 0.28), ("spine02", 0.52), ("spine01", 0.70)):
            zz = min(0.95, z * arch); aim(bn, (0, -math.sqrt(1 - zz * zz), zz))
        for bn, z in (("neck01", 0.86), ("neck02", 0.94), ("neck03", 0.985)):
            zz = min(0.995, z * (0.75 + 0.25 * arch)); aim(bn, (head[0] * 0.4, -math.sqrt(1 - zz * zz), zz))
        aim("head", (head[0], head[1], 1.0))                 # bone straight up = face looking forward; +y tips the face up
        gz = lowest_z() - FLOOR_GAP                           # ground level outside the log
        for side in ("L", "R"):
            sg = 1 if side == "L" else -1
            sh = rig.pose.bones[f"upperarm01.{side}"].head
            Lu = blen(f"upperarm01.{side}") + blen(f"upperarm02.{side}")
            c = max(0.25, min(0.96, (sh.z - gz - 0.05) / Lu)); rem = math.sqrt(1 - c * c)
            up = (sg * (0.10 + 0.25 * rem + arm_sp), -rem, -c)
            for bn in (f"upperarm01.{side}", f"upperarm02.{side}"): aim(bn, up)
            el = rig.pose.bones[f"lowerarm01.{side}"].head
            Lf = blen(f"lowerarm01.{side}") + blen(f"lowerarm02.{side}")
            sl = max(-0.6, min(0.0, -(el.z - gz - 0.035) / Lf))
            lo = (sg * -0.10, -math.sqrt(1 - sl * sl), sl)
            for bn in (f"lowerarm01.{side}", f"lowerarm02.{side}"): aim(bn, lo)
            aim(f"wrist.{side}", (sg * -0.05, -1.0, 0.0))
        for side, a in (("L", aL), ("R", aR)):
            pb = rig.pose.bones[f"lowerleg02.{side}"]; shin = (pb.tail - pb.head).normalized()
            aim(f"foot.{side}", Matrix.Rotation(-math.pi / 2 + a, 3, 'X') @ shin)
            for tn in TOES:
                if tn.endswith("-1." + side):
                    fb = rig.pose.bones[f"foot.{side}"]; fd = (fb.tail - fb.head).normalized()
                    aim(tn, Matrix.Rotation(curl, 3, 'X') @ fd)
        key_all(frame)
    new_action("StuckIdle")
    prone(1,  0.85, 0.85, 0.15, 0.15, arch=1.00, head=(0.00, 0.05))
    prone(30, 0.95, 0.80, 0.25, 0.10, arch=0.94, head=(0.10, 0.00))
    prone(60, 0.85, 0.85, 0.15, 0.15, arch=1.00, head=(0.00, 0.05))
    new_action("StuckStruggle")
    prone(1,  1.45, 0.30, 0.45, 0.05, arch=1.05, head=(0.25, 0.10), arm_sp=0.05, sway=0.03)
    prone(7,  0.85, 0.85, 0.20, 0.20, arch=0.85, head=(0.00, -0.10))
    prone(13, 0.30, 1.45, 0.05, 0.45, arch=1.05, head=(-0.25, 0.10), arm_sp=0.05, sway=-0.03)
    prone(19, 0.85, 0.85, 0.20, 0.20, arch=0.85, head=(0.00, -0.10))
    prone(25, 1.45, 0.30, 0.45, 0.05, arch=1.05, head=(0.25, 0.10), arm_sp=0.05, sway=0.03)
    new_action("StuckTickled")
    prone(1,  0.95, 0.80, -0.25, 0.35, arch=1.08, head=(0.12, 0.30), curl=0.55, sway=0.02)
    prone(4,  0.80, 1.00, 0.35, -0.25, arch=0.95, head=(-0.08, 0.02), curl=-0.30, sway=-0.02)
    prone(7,  1.00, 0.80, -0.25, 0.35, arch=1.08, head=(0.14, 0.34), curl=0.55, sway=0.02)
    prone(10, 0.80, 0.95, 0.35, -0.25, arch=0.95, head=(-0.10, 0.04), curl=-0.30, sway=-0.02)
    prone(13, 0.95, 0.80, -0.25, 0.35, arch=1.08, head=(0.12, 0.30), curl=0.55, sway=0.02)
'''
s2 = s[:a] + NEW + s[b:]
t.clear(); t.write(s2)
ns = {}
exec(s2, ns)
print("keyed:", ns["key_all_actions"]())

# ---------------------------------------------------------------- measurements for the scene module
body = bpy.data.objects["Anne_Body"]
def measure(action, frame):
    rig.animation_data.action = bpy.data.actions[action]
    sc.frame_set(frame); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); m = ev.to_mesh(); mw = body.matrix_world
    pts = [mw @ v.co for v in m.vertices]
    ev.to_mesh_clear()
    P = lambda n: (rig.matrix_world @ rig.pose.bones[n].head)
    hipm = bpy.data.objects["Marker_Chest"].matrix_world.translation.copy()
    headm = bpy.data.objects["Marker_Head"].matrix_world.translation.copy()
    hy = P("upperleg01.L").y
    low = min(p.z for p in pts if hy - 0.30 < p.y < hy + 0.40 and abs(p.x) < 0.3)
    gz = low - 0.092
    sh = P("upperarm01.L"); el = P("lowerarm01.L"); wr = P("wrist.L")
    wrt = rig.matrix_world @ rig.pose.bones["wrist.L"].tail
    knee = P("lowerleg01.L"); foot = P("foot.L")
    allmin = min(p.z for p in pts)
    return dict(H=round(hipm.z - low, 4), d_sh=round(hipm.y - sh.y, 3), d_head=round(hipm.y - headm.y, 3),
                shoulder_h=round(sh.z - gz, 3), head_h=round(headm.z - gz, 3), elbow_h=round(el.z - gz, 3),
                wrist_h=round(wr.z - gz, 3), hand_tip_h=round(wrt.z - gz, 3), hand_reach=round(hipm.y - wrt.y, 3),
                knee_d=round(knee.y - hipm.y, 3), knee_h=round(knee.z - gz, 3), foot_h=round(foot.z - gz, 3),
                foot_d=round(foot.y - hipm.y, 3), lowest_any_h=round(allmin - gz, 3))
for act, fr in (("StuckIdle", 1), ("StuckIdle", 30), ("StuckStruggle", 1), ("StuckStruggle", 7), ("StuckTickled", 1), ("StuckTickled", 4)):
    print("MEASURE", act, fr, measure(act, fr))
rig.animation_data.action = None

# ---------------------------------------------------------------- check renders (optional in background)
try:
    cam = bpy.data.objects["Anne_Cam"]; sc.camera = cam
    out = "/private/tmp/claude-501/-Users-harrisontoppenryan/37295956-7e5f-4f0c-8919-8f8a5e5681d7/scratchpad/"
    for o in col.objects:
        if o.name.startswith("Marker_"): o.hide_render = True
    exp = bpy.data.objects.get("Anne_Body_Export")
    if exp: exp.hide_render = True
    sc.render.resolution_x, sc.render.resolution_y = 760, 520
    sc.render.resolution_percentage = 100
    shots = [("StuckIdle", 1, (0.9, -2.0, 0.55), "front"), ("StuckIdle", 1, (2.2, -0.2, 0.7), "side"),
             ("StuckTickled", 1, (0.25, -1.5, 0.35), "frontlow"), ("StuckStruggle", 1, (-1.6, 1.9, 0.9), "back")]
    for act, fr, loc, tag in shots:
        rig.animation_data.action = bpy.data.actions[act]; sc.frame_set(fr); bpy.context.view_layer.update()
        hm = bpy.data.objects["Marker_Chest"].matrix_world.translation
        look = Vector((hm.x, hm.y - 0.25, hm.z + 0.1))
        cam.data.lens = 35; cam.location = Vector(loc) + Vector((0, hm.y, hm.z - 0.2))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = out + f"stuck2_{tag}.png"
        bpy.ops.render.render(write_still=True)
        print("rendered", tag)
    rig.animation_data.action = None
except Exception as e:
    print("render skipped:", repr(e))

# ---------------------------------------------------------------- export + save
exec(bpy.data.texts["export_src"].as_string(), ns)
r = ns["export_anne"]()
print("EXPORT", r[0], r[1], "MB")
bpy.ops.wm.save_as_mainfile(filepath=SRC, copy=False)
print("SAVED", SRC)
