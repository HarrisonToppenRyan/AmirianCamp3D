
import bpy, math
from mathutils import Vector, Matrix
def key_all_actions():
    rig = bpy.data.objects["Anne_Rig"]; sc = bpy.context.scene; B = rig.data.bones
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    info = eval(bpy.data.texts["anne_heel_info"].as_string()); TH = math.radians(info["L"]["theta"])
    REST_DIR = {b.name: (b.tail_local - b.head_local).normalized() for b in B}
    TOES = [b.name for b in B if b.name.startswith("toe")]
    def reset():
        for pb in rig.pose.bones: pb.location = (0,0,0); pb.rotation_quaternion = (1,0,0,0); pb.scale = (1,1,1)
        bpy.context.view_layer.update()
    def aim(bname, d):
        pb = rig.pose.bones[bname]; bpy.context.view_layer.update()
        q = (pb.tail - pb.head).normalized().rotation_difference(Vector(d).normalized())
        M = pb.matrix.copy(); h = M.translation.copy()
        pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
        bpy.context.view_layer.update()
    def rotx(v, a): return Matrix.Rotation(a, 3, 'X') @ Vector(v)
    def mirror(d): return (-d[0], d[1], d[2])
    def set_feet(phis):
        for side, phi in phis.items():
            aim(f"foot.{side}", rotx(REST_DIR[f"foot.{side}"], phi))
            for t in TOES:
                if t.endswith("-1." + side): aim(t, rotx(REST_DIR[t], phi - TH))
    def leg(side, thigh, shin):
        f = (lambda d: d) if side == "L" else mirror
        return {f"upperleg01.{side}": f(thigh), f"upperleg02.{side}": f(thigh), f"lowerleg01.{side}": f(shin), f"lowerleg02.{side}": f(shin)}
    def arms(swing_L):
        out = {}
        for side, s in (("L", swing_L), ("R", -swing_L)):
            up = (0.17, -0.22*s, -0.97); lo = (0.11, -0.16 - 0.22*max(s, 0), -0.97)
            if side == "R": up, lo = mirror(up), mirror(lo)
            out.update({f"upperarm01.{side}": up, f"upperarm02.{side}": up, f"lowerarm01.{side}": lo, f"lowerarm02.{side}": lo})
        return out
    shoes = [bpy.data.objects["Anne_Heel_L"], bpy.data.objects["Anne_Heel_R"]]
    def ground_z():
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); z = 9
        for o in shoes:
            ev = o.evaluated_get(dg); m = ev.to_mesh(); z = min(z, min((o.matrix_world @ v.co).z for v in m.vertices)); ev.to_mesh_clear()
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
    def standing(frame, pose, feet, extra=None):
        reset()
        for b, d in pose.items(): aim(b, d)
        set_feet(feet)
        if extra: extra()
        move_root(dv=(0, 0, -ground_z())); key_all(frame)
    rig.animation_data_create(); rig.animation_data.action = None
    for tr in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(tr)
    for n in ("Walk", "Idle", "StuckIdle", "StuckStruggle", "StuckTickled", "Stomp"):
        if n in bpy.data.actions: bpy.data.actions.remove(bpy.data.actions[n])
    acts = {}
    def new_action(n):
        a = bpy.data.actions.new(n); a.use_fake_user = True; rig.animation_data.action = a; acts[n] = a
    # Walk
    new_action("Walk")
    FRONT = ((0.02, -0.36, -0.93), (0.02, -0.10, -0.99)); BACK = ((0.02, 0.26, -0.96), (0.02, 0.44, -0.90))
    STAND = ((0.02, 0.03, -1.0), (0.02, 0.05, -1.0));    SWING = ((0.02, -0.24, -0.97), (0.02, 0.36, -0.93))
    lean = lambda: aim("spine03", (0, -0.04, 1))
    d10, d22, d12 = math.radians(10), math.radians(22), math.radians(12)
    standing(1,  {**leg("R", *FRONT), **leg("L", *BACK),  **arms(+1)}, {"R": TH - d10, "L": TH + d22}, lean)
    standing(7,  {**leg("R", *STAND), **leg("L", *SWING), **arms(0)},  {"R": TH, "L": TH + d12}, lean)
    standing(13, {**leg("L", *FRONT), **leg("R", *BACK),  **arms(-1)}, {"L": TH - d10, "R": TH + d22}, lean)
    standing(19, {**leg("L", *STAND), **leg("R", *SWING), **arms(0)},  {"L": TH, "R": TH + d12}, lean)
    standing(25, {**leg("R", *FRONT), **leg("L", *BACK),  **arms(+1)}, {"R": TH - d10, "L": TH + d22}, lean)
    # Idle
    new_action("Idle")
    STILL = {**leg("L", (0.035, 0.0, -1), (0.035, 0.02, -1)), **leg("R", (0.035, 0.0, -1), (0.035, 0.02, -1)), **arms(0)}
    standing(1, STILL, {"L": TH, "R": TH})
    standing(30, STILL, {"L": TH, "R": TH}, lambda: (aim("spine01", (0, 0.035, 1)), aim("neck01", (0.03, -0.08, 1))))
    standing(60, STILL, {"L": TH, "R": TH})
    # Stomp
    new_action("Stomp")
    FISTS = {}
    for side in ("L", "R"):
        up = (0.2, 0.14, -0.97); lo = (0.14, -0.30, -0.94)
        if side == "R": up, lo = mirror(up), mirror(lo)
        FISTS.update({f"upperarm01.{side}": up, f"upperarm02.{side}": up, f"lowerarm01.{side}": lo, f"lowerarm02.{side}": lo})
    angry = lambda: (aim("spine03", (0, -0.12, 1)), aim("head", (0, -0.30, 0.95)))
    KNEE = ((0.04, -0.62, -0.78), (0.04, 0.12, -0.99))
    for f, extra_leg, feet in ((1, {}, {"L": TH, "R": TH}), (6, leg("R", *KNEE), {"L": TH, "R": TH + 0.2}), (10, {}, {"L": TH, "R": TH}),
                               (15, leg("L", *KNEE), {"L": TH + 0.2, "R": TH}), (19, {}, {"L": TH, "R": TH}), (25, {}, {"L": TH, "R": TH})):
        standing(f, {**STILL, **FISTS, **extra_leg}, feet, angry)
    # Stuck: propped on her forearms inside the log. armature space: head end = -Y, feet end = +Y, up = +Z
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
    rig.animation_data.action = None
    for n, a in acts.items():
        for fc in a.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
        tr = rig.animation_data.nla_tracks.new(); tr.name = n; st = tr.strips.new(n, int(a.frame_range[0]), a); st.name = n; tr.mute = True
    return {n: tuple(a.frame_range) for n, a in acts.items()}
