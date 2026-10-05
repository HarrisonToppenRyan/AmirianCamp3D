"""Anne v2: the locomotion clips (Idle, Walk, Run and their barefoot twins), built from a small gait model.

    build(rig, shoes, TH, new_action, log)     called by s3_finish.py (and by gait_dev.py for quick looks)

How a cycle is made (all in armature space: +Z up, she faces -Y, +X is her left; the clip is "in place": the ground
moves backwards under her at the clip's own speed, `stride / duration`):

  feet     Each foot follows the same timeline, half a cycle apart. On the ground it is pinned to a point that moves
           back with the ground and rolls over it like a real foot in a shoe: on the heel tip at first contact (walk),
           flat, then up over the toe joints, then over the tip of the toes. In the air the ankle follows a smooth arc
           to the next contact. A running step lands on the ball of the foot and never puts the heel down.
  hips     Their height is not animated by hand: for every frame it is the height at which the standing leg has the
           knee bend a person has at that moment of the step (table KNEE), smoothed over the cycle. So the body
           sinks into each step and rises over the leg. The pelvis also swings forward with the leading leg, drops
           on the side of the swinging leg and shifts over the standing foot.
  legs     Two-bone IK from each hip joint to its ankle, knees forward.
  trunk    The chest turns against the pelvis, the head stays on the walking direction, the arms swing against the legs
           with the elbows bending on the way forward.

Posing is done with a small forward-kinematics solver of its own (class Pose), so no dependency-graph update is needed
per bone: a clip is keyed in a fraction of a second.
"""
import bpy, math
from mathutils import Vector, Matrix, Quaternion

Rx = lambda a: Matrix.Rotation(a, 3, 'X')
Ry = lambda a: Matrix.Rotation(a, 3, 'Y')
Rz = lambda a: Matrix.Rotation(a, 3, 'Z')
rad = math.radians
TAU = 2 * math.pi


def smooth(x, a=0.0, b=1.0):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def table(points, x):
    """Piecewise-smooth interpolation through (x, y) points (clamped at the ends)."""
    if x <= points[0][0]: return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * smooth(x, x0, x1)
    return points[-1][1]


# ---------------------------------------------------------------------------------------------------------- pose
class Pose:
    """Forward kinematics on the rest armature: armature-space matrices of every bone from per-bone basis matrices."""

    def __init__(self, rig):
        self.rig = rig
        self.B = rig.data.bones
        self.names = [b.name for b in self.B]                          # parents come before their children
        self.rest = {b.name: b.matrix_local.copy() for b in self.B}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in self.B}
        self.kids = {n: [] for n in self.names}
        for n, p in self.parent.items():
            if p: self.kids[p].append(n)
        self.local = {n: (self.rest[self.parent[n]].inverted() @ self.rest[n]) if self.parent[n] else self.rest[n].copy() for n in self.names}
        self.reset()

    def reset(self):
        self.basis = {n: Matrix.Identity(4) for n in self.names}
        self._w = {}

    def world(self, n):
        w = self._w.get(n)
        if w is None:
            p = self.parent[n]
            w = (self.world(p) @ self.local[n] if p else self.local[n]) @ self.basis[n]
            self._w[n] = w
        return w

    def _dirty(self, n):
        stack = [n]
        while stack:
            k = stack.pop()
            if k in self._w: del self._w[k]
            stack.extend(self.kids[k])

    def set_world(self, n, M):
        p = self.parent[n]
        base = self.world(p) @ self.local[n] if p else self.local[n]
        self.basis[n] = base.inverted() @ M
        self._dirty(n)

    def head(self, n): return self.world(n).translation.copy()
    def tail(self, n): return self.world(n) @ Vector((0, self.B[n].length, 0))
    def direction(self, n): return (self.world(n).to_3x3() @ Vector((0, 1, 0))).normalized()

    def turn(self, n, R):
        """Rotate bone n (and what hangs on it) about its head by the armature-space rotation R."""
        W = self.world(n); h = W.translation.copy()
        self.set_world(n, Matrix.Translation(h) @ R.to_4x4() @ Matrix.Translation(-h) @ W)

    def aim(self, n, d):
        q = self.direction(n).rotation_difference(Vector(d).normalized())
        self.turn(n, q.to_matrix())

    def orient(self, n, R):
        """Give bone n the orientation R @ (its rest orientation), whatever its parents do."""
        h = self.head(n)
        self.set_world(n, Matrix.Translation(h) @ (R @ self.rest[n].to_3x3()).to_4x4())

    def write(self):
        """Write the pose to the rig without keying it (for measuring on the meshes)."""
        for pb in self.rig.pose.bones:
            b = self.basis[pb.name]
            pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = b.to_quaternion()
            pb.location = b.translation if pb.name == "root" else (0, 0, 0)
        bpy.context.view_layer.update()

    def apply(self, frame, last=None):
        """Write the pose to the rig and key it. `last` (bone -> quaternion of the previous key) keeps signs continuous."""
        for pb in self.rig.pose.bones:
            b = self.basis[pb.name]
            pb.rotation_mode = 'QUATERNION'
            q = b.to_quaternion()
            if last is not None:
                if pb.name in last and last[pb.name].dot(q) < 0: q.negate()
                last[pb.name] = q.copy()
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if pb.name == "root":
                pb.location = b.translation
                pb.keyframe_insert("location", frame=frame)


# ---------------------------------------------------------------------------------------------------- the gait model
class Gait:
    def __init__(self, rig, shoes, TH, log=print):
        self.rig, self.shoes, self.TH, self.log = rig, shoes, TH, log
        self.P = Pose(rig)
        B = rig.data.bones
        self.c0 = Vector(B["root"].tail_local)                                   # the middle of the pelvis (rest)
        self.hip_off = {s: Vector(B["upperleg01." + s].head_local) - self.c0 for s in "LR"}
        self.l1 = B["upperleg01.L"].length + B["upperleg02.L"].length
        self.l2 = B["lowerleg01.L"].length + B["lowerleg02.L"].length
        self.toes = {s: [b.name for b in B if b.name.startswith("toe") and b.name.endswith("-1." + s)] for s in "LR"}
        # fingers: the chains of phalanges per hand (finger1 is the thumb)
        self.fingers = {s: [[b.name for b in B if b.name.startswith("finger%d-" % k) and b.name.endswith("." + s)] for k in range(1, 6)] for s in "LR"}
        for s in "LR":
            for chain in self.fingers[s]: chain.sort()
        self.spine = ["spine05", "spine04", "spine03", "spine02", "spine01"]
        self.neck = ["neck01", "neck02", "neck03", "head"]

    # ----- the foot in its shoe (or bare), measured on the meshes once per kind
    def measure_foot(self, heels):
        """Standing on flat ground with the foot pitched as in the shoe (or flat when bare): where, relative to the
        ankle, are the heel's contact point H, the toe joints J and the tip of the toes T; and the ankle's height."""
        P, rig = self.P, self.rig
        th = self.TH if heels else 0.0
        P.reset()
        for s in "LR":
            P.orient("foot." + s, Rx(th))
            for t in self.toes[s]: P.orient(t, Rx(0.0))
        if rig.animation_data: rig.animation_data.action = None
        P.write()
        dg = bpy.context.evaluated_depsgraph_get()
        if heels and self.shoes:
            src = [o for o in self.shoes if o.name.endswith("_L")][0]
        else:
            src = bpy.data.objects["Anne_Body"]
        ev = src.evaluated_get(dg); me = ev.to_mesh()
        ank = P.head("foot.L")
        pts = [src.matrix_world @ v.co for v in me.vertices]
        pts = [p for p in pts if p.x > 0.02 and p.z < ank.z + 0.02] if src.name == "Anne_Body" else pts
        ev.to_mesh_clear()
        ground = min(p.z for p in pts)
        back = [p for p in pts if p.y > ank.y - 0.012]
        zh = min(p.z for p in back)
        hs = [p for p in back if p.z < zh + 0.002]
        H = Vector((ank.x, sum(p.y for p in hs) / len(hs), ground))
        J = sum((P.head(t) for t in self.toes["L"]), Vector()) / len(self.toes["L"])
        tip_y = min(p.y for p in pts if p.z < ground + 0.012)
        T = Vector((ank.x, tip_y + 0.004, ground))
        f = dict(az=ank.z - ground, h=H - ank, j=Vector((0, J.y - ank.y, J.z - ank.z)), t=Vector((0, T.y - J.y, T.z - J.z)),
                 jz=J.z - ground, th=th, ground=ground)
        f["h"].x = 0.0
        self.log("gait: foot (%s) ankle %.3f above the ground | heel point %.3f behind, %.1f mm off the ground | toe joints %.3f ahead, %.3f up | toe tip %.3f ahead of the joints" % (
            "heels" if heels else "bare", f["az"], f["h"].y, 1000 * (zh - ground), -f["j"].y, f["jz"], -f["t"].y))
        P.reset()
        self.foot_geo = getattr(self, "foot_geo", {}); self.foot_geo[bool(heels)] = f
        return f

    def leg_len(self, knee_deg):
        c = math.cos(rad(knee_deg))
        return math.sqrt(self.l1 ** 2 + self.l2 ** 2 + 2 * self.l1 * self.l2 * c)

    def knee_of(self, d):
        c = (d * d - self.l1 ** 2 - self.l2 ** 2) / (2 * self.l1 * self.l2)
        return math.degrees(math.acos(max(-1.0, min(1.0, c))))

    # ----- one foot at local phase u (0 = its first contact): ankle position, pitch of foot and toes, on the ground?
    def foot_at(self, g, f, side, u):
        sg = 1.0 if side == "L" else -1.0
        u = u % 1.0
        yaw = sg * rad(g["toe_out"])                                  # (she faces -Y: a positive turn about Z takes the toes to +X, her left)
        Rzf = Rz(yaw)
        x = sg * g["half_width"]
        y_hip = self.c0.y + self.hip_off["L"].y
        fs = g["stance"]
        # the ankle's place if the foot stood flat on its spot of ground, which moves back with the ground
        flat = Vector((x, y_hip + g["stride"] * (u - g["align"]), f["az"]))
        if u < fs:
            tau = u / fs
            if g["run"]:
                p = rad(table(g["pitch"], tau)); q = rad(table(g["toe_roll"], tau))
                mode = "toe"
            else:
                u1, u2 = g["flat_from"], g["heel_off"]
                if u < u1:
                    p = -rad(g["strike"]) * (1 - smooth(u / u1)); mode = "heel"; q = 0.0
                elif u < u2:
                    p = 0.0; mode = "flat"; q = 0.0
                else:
                    k = (u - u2) / (fs - u2)
                    p = rad(g["push"]) * smooth(k) ** 0.9; q = rad(g["toe_push"]) * smooth(k, 0.45, 1.0); mode = "toe"
            if mode == "heel":
                Hg = flat + Rzf @ f["h"]
                ank = Hg - Rzf @ (Rx(p) @ f["h"])
                return dict(ankle=ank, pitch=p, toe=p, yaw=yaw, ground=True, mode=mode)
            if mode == "flat":
                return dict(ankle=flat, pitch=0.0, toe=0.0, yaw=yaw, ground=True, mode=mode)
            # over the toe joints (toes flat), then over the tip of the toes (toes turning by q)
            Jg = flat + Rzf @ f["j"]
            if q > 0:
                Tg = Jg + Rzf @ f["t"]
                Jg = Tg - Rzf @ (Rx(q) @ f["t"])
            ank = Jg - Rzf @ (Rx(p + q) @ f["j"])
            return dict(ankle=ank, pitch=p + q, toe=q, yaw=yaw, ground=True, mode=mode)
        # ---- in the air: from the last pose on the ground to the next first contact
        w = (u - fs) / (1 - fs)
        a = self.foot_at(g, f, side, fs - 1e-6); b = self.foot_at(g, f, side, 0.0)
        y0, y1 = a["ankle"].y, b["ankle"].y - g["stride"] * 0.0      # (both already in the body frame)
        m = g["stride"] * (1 - fs)                                   # speed of the ground in units of w
        m0, m1 = m * g["leave"], m * g["land"]
        h00 = 2 * w ** 3 - 3 * w ** 2 + 1; h10 = w ** 3 - 2 * w ** 2 + w; h01 = -2 * w ** 3 + 3 * w ** 2; h11 = w ** 3 - w ** 2
        y = h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1
        z = a["ankle"].z + (b["ankle"].z - a["ankle"].z) * smooth(w) + g["lift"] * math.sin(math.pi * w ** g["lift_early"]) ** 1.4
        x = a["ankle"].x + (b["ankle"].x - a["ankle"].x) * smooth(w) - sg * g["swing_in"] * math.sin(math.pi * w)
        p = table([(0.0, a["pitch"]), (g["tuck_at"], a["pitch"] + rad(g["tuck"])), (1.0, b["pitch"])], w)
        tq = a["toe"] * (1 - smooth(w, 0.0, 0.35)) + b["toe"] * smooth(w, 0.7, 1.0)
        return dict(ankle=Vector((x, y, z)), pitch=p, toe=tq, yaw=yaw, ground=False, mode="air")

    def curl_fingers(self, side, curl, thumb=0.35):
        """Relaxed hands: bend every finger joint towards the palm by `curl` degrees (the thumb by a share of it)."""
        P = self.P
        ch = self.fingers[side]
        if not ch[2]: return
        w = P.head("wrist." + side)
        u = (P.tail(ch[2][-1]) - w).normalized()                                # along the hand
        across = (P.head(ch[4][0]) - P.head(ch[1][0])).normalized()            # index knuckle -> little finger knuckle
        n = u.cross(across).normalized()
        if n.dot(P.tail(ch[0][-1]) - w) < 0: n = -n                           # the thumb is on the palm's side
        for k, chain in enumerate(ch):
            for j, b in enumerate(chain):
                d = P.direction(b); axis = d.cross(n)
                if axis.length < 1e-6: continue
                a = rad(curl) * (thumb if k == 0 else (0.8 + 0.1 * k)) * (1.0, 1.15, 0.8)[min(j, 2)]
                P.turn(b, Matrix.Rotation(a, 3, axis.normalized()))

    # ----- the pelvis' turn, tilt and sideways shift at phase ph (the height comes from solve_height)
    def pelvis_at(self, g, ph):
        yaw = rad(g["hip_yaw"]) * math.cos(TAU * ph)
        roll = rad(g["hip_drop"]) * math.cos(TAU * (ph - g["drop_at"]))
        x = -g["hip_shift"] * math.cos(TAU * (ph - g["shift_at"]))
        R = Rz(yaw) @ Ry(roll) @ Rx(rad(g["pelvis_lean"]))
        return x, R, yaw, roll

    def solve_height(self, g, f, N):
        """Height of the pelvis centre for each of the N frames: where the standing leg has the knee bend of KNEE."""
        raw = []
        for i in range(N):
            ph = i / N
            x, R, _, _ = self.pelvis_at(g, ph)
            best = None
            for side, off in (("R", 0.0), ("L", 0.5)):
                u = (ph - off) % 1.0
                ft = self.foot_at(g, f, side, u)
                if not ft["ground"]: continue
                tau = u / g["stance"]
                d = self.leg_len(table(g["knee"], tau) if tau <= g.get("knee_until", 1.0) else g["knee_min"] + 4.0)
                hj = R @ self.hip_off[side]
                hx = x + hj.x - ft["ankle"].x; hy = self.c0.y + hj.y - ft["ankle"].y
                hz = ft["ankle"].z + math.sqrt(max(1e-6, d * d - hx * hx - hy * hy)) - hj.z
                best = hz if best is None else min(best, hz)
            raw.append(best)
        # in the air (running): a throw between the take-off and the landing heights
        if any(v is None for v in raw):
            T = g["frames"] / 24.0 * g.get("time_scale", 1.0)
            i = 0
            while i < N:
                if raw[i] is None:
                    j = i
                    while raw[j % N] is None: j += 1
                    z0, z1 = raw[(i - 1) % N], raw[j % N]; n = j - i + 1
                    dt = n * T / N
                    for k in range(i, j):
                        t = (k - i + 1) / n
                        raw[k % N] = z0 + (z1 - z0) * t + 0.5 * 9.81 * dt * dt * t * (1 - t) * g.get("fly", 1.0)
                    i = j
                else:
                    i += 1
        # smooth: keep the mean and the harmonics a two-legged gait has (2, 4, 6 per cycle)
        mean = sum(raw) / N; out = [mean] * N
        for k in g.get("harmonics", (2, 4)):
            a = 2 / N * sum(raw[i] * math.cos(TAU * k * i / N) for i in range(N))
            b = 2 / N * sum(raw[i] * math.sin(TAU * k * i / N) for i in range(N))
            out = [out[i] + a * math.cos(TAU * k * i / N) + b * math.sin(TAU * k * i / N) for i in range(N)]
        mean_out = sum(out) / N
        out = [mean_out + (v - mean_out) * g.get("bob", 1.0) for v in out]
        # never ask a standing leg for more than its length
        worst = 0.0
        for i in range(N):
            ph = i / N
            x, R, _, _ = self.pelvis_at(g, ph)
            for side, off in (("R", 0.0), ("L", 0.5)):
                ft = self.foot_at(g, f, side, (ph - off) % 1.0)
                if not ft["ground"]: continue
                hj = Vector((x, self.c0.y, out[i])) + R @ self.hip_off[side]
                worst = max(worst, (hj - ft["ankle"]).length - self.leg_len(g["knee_min"]))
        self.log("gait: pelvis height: raw %.3f..%.3f, smoothed %.3f..%.3f, lowered by %.1f mm so that every standing leg reaches" % (min(raw), max(raw), min(out), max(out), 1000 * max(0.0, worst)))
        if g.get("debug"):
            self.log("   raw      " + " ".join("%.0f" % (1000 * v) for v in raw))
            self.log("   smoothed " + " ".join("%.0f" % (1000 * v) for v in out))
        if worst > 0:
            lo, hi = 0.0, 0.25
            for _ in range(30):
                mid = (lo + hi) / 2; ok = True
                for i in range(N):
                    ph = i / N
                    x, R, _, _ = self.pelvis_at(g, ph)
                    for side, off in (("R", 0.0), ("L", 0.5)):
                        ft = self.foot_at(g, f, side, (ph - off) % 1.0)
                        if not ft["ground"]: continue
                        hj = Vector((x, self.c0.y, out[i] - mid)) + R @ self.hip_off[side]
                        if (hj - ft["ankle"]).length > self.leg_len(g["knee_min"]): ok = False
                if ok: hi = mid
                else: lo = mid
            out = [v - hi for v in out]
        return out

    # ----- pose one frame
    def pose(self, g, f, ph, zc):
        P = self.P
        P.reset()
        x, R, yaw, roll = self.pelvis_at(g, ph)
        centre = Vector((x, self.c0.y + g.get("fore", 0.0) * math.cos(2 * TAU * (ph - g.get("fore_at", 0.0))), zc))
        P.set_world("root", Matrix.Translation(centre) @ R.to_4x4() @ Matrix.Translation(-self.c0) @ P.rest["root"])
        # trunk: the chest turns against the pelvis and stays nearly level; the head keeps to the walking direction
        t_yaw = -rad(g["chest_yaw"]) * math.cos(TAU * ph); t_roll = -roll * g["chest_level"] + rad(g["chest_sway"]) * math.cos(TAU * (ph - g["drop_at"]))
        dy, dr = (t_yaw - yaw) / len(self.spine), (t_roll - roll) / len(self.spine)
        lean = rad(g["lean"] - g["pelvis_lean"]) / len(self.spine)
        for b in self.spine:
            P.turn(b, Rz(dy) @ Ry(dr) @ Rx(lean))
        nod = rad(g["nod"]) * math.cos(2 * TAU * (ph - g["nod_at"])) - rad(g["lean"]) * g["head_up"]
        for b in self.neck:
            P.turn(b, Rz(-t_yaw / len(self.neck)) @ Ry(-t_roll * 0.8 / len(self.neck)) @ Rx(nod / len(self.neck)))
        # arms, against the legs: at ph = 0 the right foot lands in front, so the left arm is forward
        for side, sg, off in (("L", 1.0, 0.0), ("R", -1.0, 0.5)):
            c = math.cos(TAU * (ph - off - g["arm_lag"]))
            sw = rad(g["arm_mid"] + g["arm_swing"] * c)                         # shoulder: + = forward
            el = rad(g["elbow"] + g["elbow_swing"] * (0.5 + 0.5 * c))           # elbow bend, more on the way forward
            Rb = Rz(t_yaw) @ Ry(t_roll)
            up = Rb @ Vector((sg * g["arm_out"], -math.sin(sw), -math.cos(sw)))
            fo = Rb @ Vector((sg * (g["arm_out"] * 0.4 - g["hand_in"] * (0.5 + 0.5 * c)), -math.sin(sw + el), -math.cos(sw + el)))
            P.turn("clavicle." + side, Ry(-sg * rad(g["shrug"])) @ Rz(-sg * rad(g["shoulder_swing"]) * c))
            for b in ("upperarm01.", "upperarm02."): P.aim(b + side, up)
            for b in ("lowerarm01.", "lowerarm02."): P.aim(b + side, fo)
            P.aim("wrist." + side, (fo + Vector((0, -0.08, 0.05))).normalized())
            self.curl_fingers(side, g["curl"])
        # legs and feet
        feet = {}
        for side, off in (("R", 0.0), ("L", 0.5)):
            sg = 1.0 if side == "L" else -1.0
            ft = self.foot_at(g, f, side, (ph - off) % 1.0); feet[side] = ft
            hip = P.head("upperleg01." + side)
            dv = ft["ankle"] - hip; L = self.l1 + self.l2
            d = min(dv.length, L * 0.9995); dn = dv.normalized()
            a_ = (self.l1 ** 2 - self.l2 ** 2 + d * d) / (2 * d); h_ = math.sqrt(max(0.0, self.l1 ** 2 - a_ * a_))
            pole = Vector((sg * g["knee_out"], -1.0, 0.0)); pole = (pole - dn * dn.dot(pole)).normalized()
            knee = hip + dn * a_ + pole * h_
            for b in ("upperleg01.", "upperleg02."): P.aim(b + side, knee - hip)
            for b in ("lowerleg01.", "lowerleg02."): P.aim(b + side, hip + dn * d - knee)
            P.orient("foot." + side, Rz(ft["yaw"]) @ Rx(f["th"] + ft["pitch"]))
            for t in self.toes[side]: P.orient(t, Rz(ft["yaw"]) @ Rx(ft["toe"]))
            ft["knee"] = self.knee_of(d); ft["reach"] = dv.length / L
            ft["got"] = P.head("foot." + side); ft["hip"] = hip
        return feet

    def key(self, name, g, heels, new_action, f=None):
        f = f or self.measure_foot(heels)
        # SUB keys per frame of real time: the game plays these clips by stride phase, not by the clock, so the clip may
        # be as finely sampled as it likes. Between two keys the joints turn evenly, which lets a planted foot wander
        # off its spot by a few millimetres; finer keys keep that invisible even in the run (4 frames on the ground).
        N = g["frames"] * SUB
        z = self.solve_height(g, f, N)
        new_action(name)
        last = {}
        rows = []
        for i in range(N + 1):
            ph = (i % N) / N
            feet = self.pose(g, f, ph, z[i % N])
            self.P.apply(i + 1, last)
            if i < N and g.get("debug"):
                r = feet["R"]
                self.log("   f%02d R %s pitch %.1f toe %.1f | ankle wanted %s got %s | hip %s | reach %.4f knee %.1f" % (i, r["mode"], math.degrees(r["pitch"]), math.degrees(r["toe"]),
                    tuple(round(v, 3) for v in r["ankle"]), tuple(round(v, 3) for v in r["got"]), tuple(round(v, 3) for v in r["hip"]), r["reach"], r["knee"]))
            if i < N: rows.append((i, z[i], feet["R"]["mode"], feet["R"]["knee"], feet["L"]["mode"], feet["L"]["knee"], max(feet["R"]["reach"], feet["L"]["reach"])))
        zs = [r[1] for r in rows]
        self.log("gait: %s %d frames, stride %.2f m (authored speed %.2f m/s) | pelvis %.3f..%.3f (bob %.1f cm) | knee R %s" % (
            name, N, g["stride"], g["stride"] / (g["frames"] / 24.0), min(zs), max(zs), 100 * (max(zs) - min(zs)),
            " ".join("%s%.0f" % (r[2][0], r[3]) for r in rows[::max(1, N // 12)])))
        return f

    # ----- standing: weight on the right leg, the left knee easy, a slow sway and breath
    def key_idle(self, name, heels, new_action, frames=60):
        P = self.P
        f = self.measure_foot(heels)
        new_action(name)
        last = {}
        stand = dict(half_width=0.058)
        yh = self.c0.y + self.hip_off["L"].y
        feet = {"R": dict(ankle=Vector((-0.047, yh + 0.014, f["az"])), yaw=rad(-6.0)),         # close together, toes a little out; the left foot a little ahead
                "L": dict(ankle=Vector((0.052, yh - 0.034, f["az"])), yaw=rad(11.0))}
        for i in range(frames + 1):
            ph = (i % frames) / frames
            s = math.sin(TAU * ph); c2 = math.sin(TAU * (ph + 0.2))
            P.reset()
            x = -0.016 + 0.006 * s                                              # over the right foot, swaying a little
            roll = rad(3.2 + 0.5 * s)                                           # right hip up, left hip down
            yaw = rad(-2.0)                                                     # (the left hip a touch forward)
            # as high as the standing (right) leg allows with an easy knee
            R = Rz(yaw) @ Ry(roll)
            hj = R @ self.hip_off["R"]
            d = self.leg_len(5.0)
            hx = x + hj.x - feet["R"]["ankle"].x; hy = self.c0.y + hj.y - feet["R"]["ankle"].y
            zc = feet["R"]["ankle"].z + math.sqrt(d * d - hx * hx - hy * hy) - hj.z
            P.set_world("root", Matrix.Translation(Vector((x, self.c0.y, zc))) @ R.to_4x4() @ Matrix.Translation(-self.c0) @ P.rest["root"])
            breath = rad(0.7) * c2
            for k, b in enumerate(self.spine):
                P.turn(b, Rz(-yaw / 5) @ Ry(-roll * 0.9 / 5) @ Rx(breath * (0.3 if k < 3 else -0.5)))
            for b in self.neck:
                P.turn(b, Ry(-roll * 0.2 / 4) @ Rx(rad(-0.4) * c2 / 4) @ Rz(rad(1.2) * s / 4))
            for side, sg in (("L", 1.0), ("R", -1.0)):
                sw = rad(2.0 + 1.0 * s * sg); el = rad(9.0)
                up = Vector((sg * 0.19, -math.sin(sw), -math.cos(sw))); fo = Vector((sg * 0.10, -math.sin(sw + el), -math.cos(sw + el)))
                for b in ("upperarm01.", "upperarm02."): P.aim(b + side, up)
                for b in ("lowerarm01.", "lowerarm02."): P.aim(b + side, fo)
                self.curl_fingers(side, 16.0)
            for side, sg in (("L", 1.0), ("R", -1.0)):
                ft = feet[side]
                hip = P.head("upperleg01." + side)
                dv = ft["ankle"] - hip; L = self.l1 + self.l2
                d = min(dv.length, L * 0.9995); dn = dv.normalized()
                a_ = (self.l1 ** 2 - self.l2 ** 2 + d * d) / (2 * d); h_ = math.sqrt(max(0.0, self.l1 ** 2 - a_ * a_))
                pole = Vector((-sg * (0.30 if side == "L" else 0.55), -1.0, 0.0)); pole = (pole - dn * dn.dot(pole)).normalized()      # (knees turned a little IN: her legs close together)
                knee = hip + dn * a_ + pole * h_
                for b in ("upperleg01.", "upperleg02."): P.aim(b + side, knee - hip)
                for b in ("lowerleg01.", "lowerleg02."): P.aim(b + side, hip + dn * d - knee)
                P.orient("foot." + side, Rz(ft["yaw"]) @ Rx(f["th"]))
                for t in self.toes[side]: P.orient(t, Rz(ft["yaw"]))
            P.apply(i + 1, last)
        self.log("gait: %s %d frames, feet %.3f apart, weight on the right leg" % (name, frames, feet["L"]["ankle"].x - feet["R"]["ankle"].x))


    # ----- bored, standing about (10-02; the game plays one after she has stood still a few seconds). As Idle, with:
    #   look    she looks round to her left, to her right, then down at the ground before her; her free (left) foot taps
    #           twice, its heel on the ground
    #   tiptoe  her free foot goes back behind the other and up on its toes, the heel high (the game leaves her shoe with
    #           her toes, so her heel comes up out of it: the sole flash), and rocks there; she looks down over her shoulder
    #           at it; then it comes back to where it stood
    #   cross   the same, the free foot crossed over behind the other at the ankles, on its toes on the far side
    # free: the foot that moves ('L' as Idle, whose weight is on the right leg; 'R' shifts her weight onto the left leg first and
    # back at the end). heels: in a high heel (her feet pitched further, a thinner sole: see build's `hi`), the heel rises less.
    # Keyed every frame from smooth curves (eased in and out), one-shots that begin and end in Idle's pose.
    def key_idle_fidget(self, name, heels, new_action, kind, seconds, free="L", hi=False):
        # (10-02) "When she twists one foot behind the other it goes through her other leg": the legs as tapered bodies round
        # their bones, as far out as her skin stands from them (tools/anne2/measure.py: SHIN_E / THIGH_E, [t, outer, inner,
        # back, front]). Where the crossing leg (behind) and the standing leg are at the same height and overlap from the
        # side, the crossing one must be behind the other's back by the other's back extent plus its own front extent; the
        # crossing foot's toes must also stay behind the standing heel. legs_overlap returns by how much it is short (> 0).
        SH_E = [(0.0, 0.0194, 0.0129, 0.0281, 0.0331), (0.15, 0.0249, 0.0107, 0.0322, 0.0179), (0.3, 0.032, 0.017, 0.0053, 0.0185), (0.45, 0.0438, 0.0225, 0.0564, 0.0218),
                (0.6, 0.041, 0.0346, 0.0631, 0.0271), (0.75, 0.0524, 0.0409, 0.065, 0.0296), (0.9, 0.0516, 0.0517, 0.0581, 0.0309), (1.0, 0.05, 0.06, 0.053, 0.053)]
        TH_E = [(0.0, 0.0506, 0.0617, 0.0528, 0.0535), (0.15, 0.0515, 0.0676, 0.0537, 0.0725), (0.3, 0.0535, 0.0725, 0.0565, 0.0806), (0.45, 0.0592, 0.0774, 0.0599, 0.0894)]
        def ext(tab, t):
            for (t0, *a), (t1, *b) in zip(tab, tab[1:]):
                if t <= t1: k = (t - t0) / (t1 - t0) if t1 > t0 else 0.0; return [x + (y - x) * max(0.0, min(1.0, k)) for x, y in zip(a, b)]
            return list(tab[-1][1:])
        def samples(leg, side):                                               # points of the shin (not the knee: her knees all but meet anyway)
            hip, knee, ank = leg; sx = 1.0 if side == "L" else -1.0
            return [(ank.lerp(knee, t), ext(SH_E, t), sx) for t in (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)]      # (the knee itself may rest in the other's knee pit)
        def reach(e, sx, ux, uy):                                             # how far a leg's section reaches in the direction (ux, uy)
            ex = (e[0] if ux * sx > 0 else e[1]) or 1e-3; ey = (e[2] if uy > 0 else e[3]) or 1e-3     # (outer / inner across, back (+y) / front)
            return 1.0 / math.sqrt((ux / ex) ** 2 + (uy / ey) ** 2)
        def legs_overlap(lf, ls, Rf, pitch, margin=0.003):
            worst = -1.0; S_ = samples(ls, stand)
            for pf, ef, sf in samples(lf, free):
                for ps, es, ss in S_:
                    if abs(pf.z - ps.z) > 0.02: continue                        # (the same height)
                    dx, dy = ps.x - pf.x, ps.y - pf.y; dl = math.hypot(dx, dy)
                    if dl < 1e-6 or abs(dy) < 0.3 * dl: continue                # (side by side: that is touching, not passing through)
                    ux, uy = dx / dl, dy / dl
                    v = reach(ef, sf, ux, uy) + reach(es, ss, -ux, -uy) + margin - dl
                    if v > worst: worst = v; WHY[0] = "shins: free at %.0f mm, standing at %.0f mm high; free %+.0f / %+.0f mm from standing (x / y)" % (pf.z * 1000, ps.z * 1000, -dx * 1000, -dy * 1000)
            # the crossing foot's toes (beyond the toe joints) must not be inside the standing heel (shoe and all): about 4 cm
            # either side of the standing ankle's line, from 2 cm before the ankle to 6 cm behind it, up to 7 cm off the ground
            ank_f = lf[2]; ank_s = ls[2]
            for k in (0.0, 0.5, 1.0):                                         # the toe joints, half way, the tips
                toe = ank_f + Rf @ (Rx(pitch) @ (jv + Vector((0.0, -0.045 * k, 0.0))))
                if abs(toe.x - ank_s.x) < 0.04 and toe.z < 0.07 and ank_s.y - 0.02 < toe.y < ank_s.y + 0.06:
                    v = (ank_s.y + 0.065) - toe.y
                    if v > worst: worst = v; WHY[0] = "toes in the heel"
            return worst
        self._legs_overlap = legs_overlap
        P = self.P
        f = self.measure_foot(heels)
        new_action(name)
        last = {}
        frames = int(round(seconds * 24))
        pushed = left = 0.0                                                   # (the crossing foot: the most it was moved back, and any overlap left)
        WHY = [""]; why_left = ""
        yh = self.c0.y + self.hip_off["L"].y
        sst = lambda a, b, x: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, (x - a) / (b - a))))
        env = lambda t, a, b, c, d: sst(a, b, t) * (1.0 - sst(c, d, t))
        feet0 = {"R": dict(ankle=Vector((-0.047, yh + 0.014, f["az"])), yaw=rad(-6.0)),
                 "L": dict(ankle=Vector((0.052, yh - 0.034, f["az"])), yaw=rad(11.0))}
        stand = "R" if free == "L" else "L"
        m = 1.0 if free == "L" else -1.0                                       # (mirror sign: + when the left foot moves)
        jv = Vector(f["j"]); hv = Vector(f["h"])                              # toe joints, heel contact: from the ankle, foot flat in the shoe
        J0 = feet0[free]["ankle"] + Rz(feet0[free]["yaw"]) @ jv                # the free foot's toe joints where it stands in Idle
        SA = feet0[stand]["ankle"]
        # where the free foot's toes go, its yaw there, how high its heel rises (radians)
        if kind == "cross":
            J1 = Vector((SA.x - m * 0.034, SA.y + 0.118, J0.z)); yaw1 = rad(-30.0 * m); phi_max = 0.62 if hi else 0.86      # (10-02: was -0.058 / +0.072: her legs passed through each other)
        else:
            J1 = Vector((SA.x + m * 0.05, SA.y + 0.15, J0.z)); yaw1 = rad(-24.0 * m); phi_max = 0.66 if hi else 0.98
        go_a, go_b, back_a, back_b = 0.5, 1.7, seconds - 1.7, seconds - 0.5
        if free == "R": go_a, go_b = 0.9, 2.1                                  # (her weight goes over to the left leg first)
        for i in range(frames + 1):
            t = i / 24.0; ph = (t / 2.5) % 1.0                                # (Idle's own slow sway and breath go on underneath)
            s = math.sin(TAU * ph); c2 = math.sin(TAU * (ph + 0.2))
            P.reset()
            shift = 0.0 if free == "L" else sst(0.15, 0.95, t) * (1.0 - sst(seconds - 0.9, seconds - 0.15, t))
            x = -0.016 + 0.036 * shift + 0.006 * s
            roll = rad(3.2 - 6.4 * shift + 0.5 * s); yaw = rad(-2.0 + 4.0 * shift)
            hy_, hp_, hr_ = 0.0, 0.0, 0.0                                     # head: yaw (+ to her left), pitch (+ down), roll
            fl = {k: dict(ankle=v["ankle"].copy(), yaw=v["yaw"], pitch=0.0) for k, v in feet0.items()}
            if kind == "look":
                hy_ = 34.0 * env(t, 0.7, 1.6, 2.5, 3.3) - 32.0 * env(t, 3.0, 3.9, 4.7, 5.5)
                hp_ = 26.0 * env(t, 5.1, 5.8, 6.3, 6.95) + 6.0 * env(t, 3.0, 3.9, 4.7, 5.5)
                hr_ = 4.0 * env(t, 0.7, 1.6, 2.5, 3.3) - 3.0 * env(t, 3.0, 3.9, 4.7, 5.5)
                x += 0.008 * env(t, 1.8, 2.8, 4.6, 5.6)                      # a little more of her weight to the left, and back
                tap = env(t, 3.9, 4.1, 5.0, 5.25) * max(0.0, math.sin(TAU * 2.4 * (t - 3.9)))
                if tap > 0:                                                   # toes up, about the heel's contact
                    a = -0.30 * tap; H = feet0["L"]["ankle"] + Rz(fl["L"]["yaw"]) @ hv
                    fl["L"]["ankle"] = H + Rz(fl["L"]["yaw"]) @ (Rx(a) @ (-hv)); fl["L"]["pitch"] = a
            else:
                w = sst(go_a, go_b, t) * (1.0 - sst(back_a, back_b, t))
                u_go = min(1.0, max(0.0, (t - go_a) / (go_b - go_a))); u_back = min(1.0, max(0.0, (t - back_a) / (back_b - back_a)))
                carry = math.sin(math.pi * u_go) if t < go_b else (math.sin(math.pi * u_back) if t > back_a else 0.0)
                y0 = feet0[free]["yaw"]
                fy = y0 + (yaw1 - y0) * w + rad(7.0) * w * math.sin(TAU * (t - go_b) / 2.4)
                J = J0.lerp(J1, w); J.z += (0.045 if kind == "cross" else 0.035) * carry
                phi = (phi_max + 0.13 * math.sin(TAU * (t - go_b) / 1.9)) * w      # the heel's height, rocking
                fl[free]["ankle"] = J + Rz(fy) @ (Rx(phi) @ (-jv)); fl[free]["yaw"] = fy; fl[free]["pitch"] = phi
                x += -0.006 * w * m; roll += rad(1.2) * w * m
                hy_ = 40.0 * m * env(t, go_b + 0.7, go_b + 1.5, back_a - 1.6, back_a - 0.8); hp_ = 22.0 * env(t, go_b + 0.7, go_b + 1.5, back_a - 1.6, back_a - 0.8) + 8.0 * w
                hr_ = 6.0 * m * env(t, go_b + 0.7, go_b + 1.5, back_a - 1.6, back_a - 0.8)
            R = Rz(yaw) @ Ry(roll)
            d = self.leg_len(5.0)
            def zc_for(side):                                                 # how high her pelvis may be with this foot flat where it stands
                hj = R @ self.hip_off[side]; ank = feet0[side]["ankle"]
                hx = x + hj.x - ank.x; hy = self.c0.y + hj.y - ank.y
                return ank.z + math.sqrt(max(1e-6, d * d - hx * hx - hy * hy)) - hj.z
            zc = zc_for("R") if free == "L" else min(zc_for("R"), zc_for("L"))
            P.set_world("root", Matrix.Translation(Vector((x, self.c0.y, zc))) @ R.to_4x4() @ Matrix.Translation(-self.c0) @ P.rest["root"])
            breath = rad(0.7) * c2
            for k, b in enumerate(self.spine):
                P.turn(b, Rz(-yaw / 5 + rad(hy_) * 0.06) @ Ry(-roll * 0.9 / 5) @ Rx(breath * (0.3 if k < 3 else -0.5) + rad(hp_) * 0.03))
            for b in self.neck:
                P.turn(b, Ry(-roll * 0.2 / 4 + rad(hr_) / 4) @ Rx((rad(-0.4) * c2 + rad(hp_)) / 4) @ Rz((rad(1.2) * s + rad(hy_)) / 4))
            for side, sg in (("L", 1.0), ("R", -1.0)):
                sw = rad(2.0 + 1.0 * s * sg); el = rad(9.0)
                up = Vector((sg * 0.19, -math.sin(sw), -math.cos(sw))); fo = Vector((sg * 0.10, -math.sin(sw + el), -math.cos(sw + el)))
                for b in ("upperarm01.", "upperarm02."): P.aim(b + side, up)
                for b in ("lowerarm01.", "lowerarm02."): P.aim(b + side, fo)
                self.curl_fingers(side, 16.0)
            def solve(side):                                                  # hip, knee, ankle of one leg for its foot's ankle
                sg = 1.0 if side == "L" else -1.0
                hip = P.head("upperleg01." + side)
                dv = fl[side]["ankle"] - hip; L = self.l1 + self.l2
                dd = min(dv.length, L * 0.9995); dn = dv.normalized()
                a_ = (self.l1 ** 2 - self.l2 ** 2 + dd * dd) / (2 * dd); h_ = math.sqrt(max(0.0, self.l1 ** 2 - a_ * a_))
                kin = (-0.18 if kind == "cross" else 0.30) if side == free else 0.55      # (crossing: the free knee forward and a little OUT, so the knees stay apart)
                pole = Vector((-sg * kin, -1.0, 0.0)); pole = (pole - dn * dn.dot(pole)).normalized()
                return hip, hip + dn * a_ + pole * h_, hip + dn * dd
            if kind == "cross":                                              # never through the other leg (see legs_overlap)
                a0 = fl[free]["ankle"].copy()
                for _ in range(16):
                    pen = legs_overlap(solve(free), solve(stand), Rz(fl[free]["yaw"]), fl[free]["pitch"])
                    if pen <= 0.0 or fl[free]["ankle"].y - a0.y > 0.12: break
                    fl[free]["ankle"] = fl[free]["ankle"] + Vector((0.0, min(pen, 0.02) + 0.0015, 0.0))      # back, away from the standing leg
                pushed = max(pushed, fl[free]["ankle"].y - a0.y)
                if pen > left: left = pen; why_left = "t %.2f: %s" % (t, WHY[0])
            for side, sg in (("L", 1.0), ("R", -1.0)):
                ft = fl[side]
                hip, knee, _ank = solve(side)
                dv = ft["ankle"] - hip; L = self.l1 + self.l2
                dd = min(dv.length, L * 0.9995); dn = dv.normalized()
                for b in ("upperleg01.", "upperleg02."): P.aim(b + side, knee - hip)
                for b in ("lowerleg01.", "lowerleg02."): P.aim(b + side, hip + dn * dd - knee)
                P.orient("foot." + side, Rz(ft["yaw"]) @ Rx(f["th"] + ft.get("pitch", 0.0)))
                for tb in self.toes[side]: P.orient(tb, Rz(ft["yaw"]))       # (her toes stay flat on the ground)
            P.apply(i + 1, last)
        self.log("gait: %s %d frames (%.1f s), %s, free foot %s%s%s" % (name, frames, seconds, kind, free, ", in high heels" if hi else "",
                 ", kept clear of the other leg: moved back up to %.1f mm, overlap left %.1f mm %s" % (pushed * 1000, max(0.0, left) * 1000, why_left) if kind == "cross" else ""))

# ------------------------------------------------------------------------------------------------------- the clips
SUB = 2          # keys per 1/24 s (see Gait.key). A clip's length in the file is SUB times its real length: `frames` / 24 s.
WALK = dict(
    run=False, frames=24, stride=1.52,          # two steps of 0.76 m; the game plays the clip at speed / (stride / duration)
    stance=0.60, align=0.235,                   # share of the cycle a foot is on the ground; when the ankle is under the hip
    flat_from=0.07, heel_off=0.33,              # the foot is flat between these (as shares of the cycle)
    strike=9.0, push=24.0, toe_push=24.0,       # degrees: toes up at first contact; heel up over the toe joints; then over the toe tips
    half_width=0.038, toe_out=5.0, swing_in=-0.006,
    lift=0.050, lift_early=0.70, tuck=6.0, tuck_at=0.25, leave=0.25, land=0.35,
    knee=[(0.0, 5.0), (0.20, 16.0), (0.52, 11.0), (0.80, 13.0)], knee_until=0.80, knee_min=3.0,
    harmonics=(2, 4, 6), bob=1.0,
    hip_yaw=8.0, hip_drop=5.5, drop_at=0.20, hip_shift=0.018, shift_at=0.30, pelvis_lean=3.0, lean=4.0,
    chest_yaw=5.0, chest_level=0.6, chest_sway=0.8, nod=0.8, nod_at=0.08, head_up=0.6,
    arm_swing=22.0, arm_mid=1.0, arm_lag=0.02, elbow=14.0, elbow_swing=22.0, arm_out=0.17, hand_in=0.04, shrug=0.0, shoulder_swing=3.0, curl=18.0,
    knee_out=-0.14,                             # (< 0: the knees track a little inwards, towards each other)
)
JOG = dict(
    run=True, frames=18, stride=1.80,           # two steps of 0.90 m in 0.75 s = 2.4 m/s: her everyday pace in the game
    stance=0.40, align=0.150,
    pitch=[(0.0, 5.0), (0.30, 1.0), (0.70, 12.0), (1.0, 27.0)], toe_roll=[(0.0, 0.0), (0.65, 0.0), (1.0, 22.0)],
    half_width=0.031, toe_out=4.0, swing_in=0.0,
    lift=0.150, lift_early=0.65, tuck=10.0, tuck_at=0.30, leave=1.0, land=0.6,
    knee=[(0.0, 15.0), (0.40, 34.0), (1.0, 13.0)], knee_min=6.0,
    harmonics=(2, 4), bob=0.85, fly=1.0,
    hip_yaw=8.0, hip_drop=4.0, drop_at=0.14, hip_shift=0.012, shift_at=0.14, pelvis_lean=6.0, lean=7.0,
    chest_yaw=8.0, chest_level=0.7, chest_sway=0.5, nod=1.0, nod_at=0.05, head_up=0.7,
    arm_swing=26.0, arm_mid=-3.0, arm_lag=0.0, elbow=78.0, elbow_swing=10.0, arm_out=0.20, hand_in=0.13, shrug=2.0, shoulder_swing=5.0, curl=34.0,
    knee_out=-0.10,
)
RUN = dict(
    run=True, frames=16, stride=2.933,          # two steps of 1.47 m in 0.667 s = 4.4 m/s
    stance=0.25, align=0.115,
    pitch=[(0.0, 9.0), (0.40, 3.0), (0.75, 16.0), (1.0, 30.0)], toe_roll=[(0.0, 0.0), (0.6, 0.0), (1.0, 26.0)],
    half_width=0.030, toe_out=3.0, swing_in=0.0,
    lift=0.270, lift_early=0.62, tuck=14.0, tuck_at=0.30, leave=1.0, land=0.75,
    knee=[(0.0, 20.0), (0.45, 43.0), (1.0, 16.0)], knee_min=6.0,
    harmonics=(2, 4, 6), bob=0.9, fly=1.0,
    hip_yaw=11.0, hip_drop=5.0, drop_at=0.12, hip_shift=0.010, shift_at=0.12, pelvis_lean=9.0, lean=11.0,
    chest_yaw=10.0, chest_level=0.7, chest_sway=0.5, nod=1.2, nod_at=0.05, head_up=0.75,
    arm_swing=34.0, arm_mid=-6.0, arm_lag=0.0, elbow=84.0, elbow_swing=12.0, arm_out=0.21, hand_in=0.15, shrug=3.0, shoulder_swing=6.0, curl=38.0,
    knee_out=-0.10,
)


FIDGETS = [("IdleTiptoe", "tiptoe", "L"), ("IdleTiptoeR", "tiptoe", "R"), ("IdleCross", "cross", "L"), ("IdleCrossR", "cross", "R")]


def build(rig, shoes, TH, new_action, log=print, only=None, debug=False, hi=None):
    """hi: (shoes, theta) of the high heels: the sole flashes are made again for them, named ...Hi (the game plays those in heels,
    without its added heel pose)."""
    G = Gait(rig, shoes, TH, log)
    if debug: WALK["debug"] = JOG["debug"] = RUN["debug"] = True
    todo = only or ("Idle", "IdleBare", "Walk", "WalkBare", "Jog", "JogBare", "Run", "RunBare", "IdleLook") + tuple(n for n, _, _ in FIDGETS) + tuple(n + "Hi" for n, _, _ in FIDGETS)
    if "Idle" in todo: G.key_idle("Idle", True, new_action)
    if "IdleLook" in todo: G.key_idle_fidget("IdleLook", True, new_action, "look", 7.0)
    for n, kind, fr in FIDGETS:
        if n in todo: G.key_idle_fidget(n, True, new_action, kind, 8.0, free=fr)
    if hi and any(n + "Hi" in todo for n, _, _ in FIDGETS):
        GH = Gait(rig, hi[0], hi[1], log)
        for n, kind, fr in FIDGETS:
            if n + "Hi" in todo: GH.key_idle_fidget(n + "Hi", True, new_action, kind, 8.0, free=fr, hi=True)
        GH.P.reset()
    if "IdleBare" in todo: G.key_idle("IdleBare", False, new_action)
    fh = fb = None
    if "Walk" in todo: fh = G.key("Walk", WALK, True, new_action)
    if "Jog" in todo: fh = G.key("Jog", JOG, True, new_action, fh)
    if "Run" in todo: G.key("Run", RUN, True, new_action, fh)
    if "WalkBare" in todo: fb = G.key("WalkBare", dict(WALK, strike=14.0, push=38.0, toe_push=34.0), False, new_action)
    if "JogBare" in todo: fb = G.key("JogBare", JOG, False, new_action, fb)
    if "RunBare" in todo: G.key("RunBare", RUN, False, new_action, fb)
    G.P.reset()
    return G
