"""Anne v2: the story's pose clips (camp, gestures, and the poses the forest's capture gags hold her in).

    build(rig, body, shoes, suit, TH, new_action, log, only=None)     called by s3_finish.py and by poses_dev.py

Everything is posed with gait.Pose (forward kinematics, no dependency graph per bone), in armature space: +Z up, she
faces -Y, +X is her left. A pose is written in her BODY frame (as if she stood upright) and carried into place by the
root's orientation, so the same words ("spine bends forward", "arm points ahead") work lying down. What must touch
the ground is measured on the meshes and the root is moved so that it does.

In the game a clip is placed with her origin on the ground at the spot the story names, facing the story's yaw:
  seated and lying poses   her seat (or her middle) is over the origin
  standing gestures        the feet stand where Idle's feet stand

  CampSleep     asleep on her left side, knees drawn up a little, barefoot, hat off (the game      loop, breathing
                lays her hat and her shoes beside her)
  CampSit       sitting up, knees drawn up, arms round them, barefoot                                loop
  CampWake      from CampSleep to CampSit: she rolls onto her back and pushes herself up             one-shot
  CampLie       from CampSit back down to CampSleep                                                  one-shot
  Startle       a flinch: arms up, weight back                                                       one-shot
  Point         her right arm out at what she sees                                                   loop (held)
  Cast          a spell thrown with the right hand                                                   one-shot
  VineHeld      sitting back on her hands, both legs held up in front of her, feet bare: she laughs  loop
  VineHeldShod  the same before the shoes are off: she tugs at what holds her ankles                 loop
  HeldBack      on her back, propped on her elbows, legs held high, feet bare                        loop
  HeldProne     on her front, propped on her elbows, shins up, feet bare                             loop
  SitFlat       sitting, legs out flat on the ground, leaning on her hands, feet bare                loop
  LaughFit      on her knees, doubled up with laughing                                               loop
  HoleIdle      in the hole trap to her waist, arms pinned inside it, legs hanging free below; shod    loop
  HoleKick      the same, kicking to get out; shod                                                      loop
  HoleTease     shoes off: one foot jerks away from a touch, then the other                             loop
  HoleTickled   laughing, her knees bending in turn, her toes scrunching                                 loop
  HoleBound     her legs wound together from knee to ankle: only her feet can answer                    loop
  HoleKickout   both knees up, then a kick that sends everything flying                                 one-shot
  IvyLegUp, IvyLegUpTickled, IvyWorship, MycHeld, MycHeldOut, AlrHeld, AlrHeldTickled: the 2D capture sheets, pose for pose (key_ivy, key_myc, key_alr)
  PumpkinSeat   on the pumpkin fiend's mound of roots, feet on the ground, one ankle held: she tugs       loop
  PumpkinHeld   on the mound, her legs held out level and together, feet bare: she laughs               loop
  PumpkinHigh   tipped back on her arms, her legs held up high and together                              loop
  ThiefIdle     (the thief's, not hers) standing, right hand on her hip, weight on her right leg        loop
  StuckFlat         in the log, ankles tied: legs out straight behind, feet resting on the ground,  loop, breathing
                    soles up (the upper body as StuckIdle of s3_finish.py)
  StuckFlatTickled  the same, laughing: her toes scrunch and splay, her feet cannot kick             loop
  StuckFlatStrain   the same, straining at the ties: both feet lift a little together                loop
"""
import bpy, math
from mathutils import Vector, Matrix
import gait
from gait import Rx, Ry, Rz, rad, TAU, smooth


def verts(o):
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); me = ev.to_mesh()
    pts = [o.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear(); return pts


class Poser:
    def __init__(self, rig, body, shoes, suit, TH, new_action, log=print):
        self.rig, self.body, self.shoes, self.suit, self.TH, self.new_action, self.log = rig, body, shoes, suit, TH, new_action, log
        self.G = gait.Gait(rig, shoes, TH, log); self.P = self.G.P
        self.c0 = self.G.c0
        self.Rb = Matrix.Identity(3)
        self.report = {}

    # ----- the root: the middle of the pelvis at `centre`, the body turned by R (3x3, from upright facing -Y)
    def root(self, centre, R):
        self.Rb = R.copy()
        self.P.set_world("root", Matrix.Translation(Vector(centre)) @ R.to_4x4() @ Matrix.Translation(-self.c0) @ self.P.rest["root"])

    def lift(self, dz):
        W = self.P.world("root").copy(); W.translation.z += dz; self.P.set_world("root", W)

    def shift(self, dv):
        W = self.P.world("root").copy(); W.translation += Vector(dv); self.P.set_world("root", W)

    # ----- body-frame helpers
    def b(self, v): return self.Rb @ Vector(v)                              # a body-frame direction in armature space
    def bturn(self, n, R): self.P.turn(n, self.Rb @ R @ self.Rb.inverted())    # turn bone n about a body-frame rotation
    def baim(self, names, v):
        for n in names: self.P.aim(n, self.b(v))

    def spine(self, pitch=0.0, roll=0.0, yaw=0.0, upper=1.0):
        """Degrees over the five spine bones: pitch + bends her forward, roll + tips her to her left, yaw + turns her left."""
        n = len(self.G.spine)
        for k, bn in enumerate(self.G.spine):
            w = (upper if k >= 2 else 1.0) / n
            self.bturn(bn, Rz(rad(yaw) * w) @ Ry(rad(roll) * w) @ Rx(rad(pitch) * w))

    def head(self, pitch=0.0, yaw=0.0, roll=0.0):
        """Degrees over neck and head: pitch + nods forward (chin down), yaw + turns to her left, roll + tips to her left."""
        for bn in self.G.neck:
            self.bturn(bn, Rz(rad(yaw) / 4) @ Ry(rad(roll) / 4) @ Rx(rad(pitch) / 4))

    # ----- two-bone IK: the end of `lower` goes to `target` (armature space), the middle joint towards `pole`
    def two(self, upper, lower, target, pole, slack=0.999):
        P = self.P
        o = P.head(upper[0]); l1 = sum(P.B[n].length for n in upper); l2 = sum(P.B[n].length for n in lower)
        dv = Vector(target) - o; d = min(dv.length, (l1 + l2) * slack); dn = dv.normalized()
        a_ = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h_ = math.sqrt(max(0.0, l1 * l1 - a_ * a_))
        pl = Vector(pole); pl = pl - dn * dn.dot(pl)
        pl = pl.normalized() if pl.length > 1e-6 else Vector((0, 0, 1))
        mid = o + dn * a_ + pl * h_
        for n in upper: P.aim(n, mid - o)
        for n in lower: P.aim(n, o + dn * d - mid)
        return dv.length <= (l1 + l2) * slack

    def leg(self, side, ankle, pole=(0, -1, 0)):
        return self.two(("upperleg01." + side, "upperleg02." + side), ("lowerleg01." + side, "lowerleg02." + side), ankle, pole)

    def arm(self, side, wrist, pole, slack=0.999):
        return self.two(("upperarm01." + side, "upperarm02." + side), ("lowerarm01." + side, "lowerarm02." + side), wrist, pole, slack)

    def legdir(self, side, thigh, shin):
        """Both leg segments along body-frame directions."""
        self.baim(("upperleg01." + side, "upperleg02." + side), thigh)
        self.baim(("lowerleg01." + side, "lowerleg02." + side), shin)

    def armdir(self, side, upper, fore, hand=None):
        self.baim(("upperarm01." + side, "upperarm02." + side), upper)
        self.baim(("lowerarm01." + side, "lowerarm02." + side), fore)
        self.baim(("wrist." + side,), hand if hand is not None else fore)

    # ----- the foot. After the leg is posed it sits square to the shin (as standing flat); then:
    #   flex   radians at the ankle, + points the toes away (as on tiptoe), - pulls them up towards the shin
    #   curl   radians at the toes, + curls them to the sole, - spreads them back
    #   shod   the foot as it sits in its shoe (pitched by TH, toes flat on the sole): flex and curl are added to that
    def foot(self, side, flex=0.0, curl=0.0, shod=False, toes=None):
        P = self.P; shin = "lowerleg02." + side
        ax = (P.world(shin).to_3x3() @ P.rest[shin].to_3x3().inverted() @ Vector((1, 0, 0))).normalized()     # her left-right axis, carried by the shin
        base, tb = (self.TH, -self.TH) if shod else (0.0, 0.0)
        P.turn("foot." + side, Matrix.Rotation(base + flex, 3, ax))
        for i, t in enumerate(sorted(self.G.toes[side])):
            c = curl if toes is None else curl + toes[i]
            P.turn(t, Matrix.Rotation(tb + c, 3, ax))

    def unfoot(self, side):
        """The foot and toes back square to the shin (foot() turns them from where they are: call this before posing a foot again)."""
        for n in ["foot." + side] + list(self.G.toes[side]):
            self.P.basis[n] = Matrix.Identity(4); self.P._dirty(n)

    def hands(self, curl=16.0):
        for s in "LR": self.G.curl_fingers(s, curl)

    def hand(self, side, curl, point=False):
        """Fingers bent towards the palm by `curl` degrees; point: the index finger stays straight."""
        if not point: return self.G.curl_fingers(side, curl)
        G, P = self.G, self.P; ch = G.fingers[side]
        if not ch[2]: return
        w = P.head("wrist." + side); u = (P.tail(ch[2][-1]) - w).normalized()
        across = (P.head(ch[4][0]) - P.head(ch[1][0])).normalized(); n = u.cross(across).normalized()
        if n.dot(P.tail(ch[0][-1]) - w) < 0: n = -n
        for k, chain in enumerate(ch):
            for j, bn in enumerate(chain):
                d = P.direction(bn); axis = d.cross(n)
                if axis.length < 1e-6: continue
                a = rad(4.0 if k == 1 else curl) * (0.5 if k == 0 else (0.8 + 0.1 * k)) * (1.0, 1.15, 0.8)[min(j, 2)]
                P.turn(bn, Matrix.Rotation(a, 3, axis.normalized()))

    # ----- the ground
    def lowest(self, objs, where=None):
        if self.rig.animation_data: self.rig.animation_data.action = None
        self.P.write()
        zs = [p.z for o in objs for p in verts(o) if (where is None or where(p))]
        return min(zs) if zs else 0.0

    def ground(self, objs, where=None, sink=0.0):
        z = self.lowest(objs, where); self.lift(-z - sink); return z

    def solid(self, shod):
        return [o for o in ([self.body, self.suit] + (self.shoes if shod else [])) if o]

    # ----- a clip: keys = [(frame, pose function)], each function builds the whole pose from rest
    def clip(self, name, keys):
        if self.rig.animation_data: self.rig.animation_data.action = None
        shots = []
        for frame, fn in keys:
            self.P.reset(); self.Rb = Matrix.Identity(3); fn()
            shots.append((frame, {n: m.copy() for n, m in self.P.basis.items()}))
        self.new_action(name); last = {}
        for frame, basis in shots:
            self.P.basis = basis; self.P._w = {}; self.P.apply(frame, last)
        self.P.reset(); self.Rb = Matrix.Identity(3)
        self.log("poses: %s keys %s" % (name, " ".join(str(f) for f, _ in keys)))

    # =============================================================================================== standing
    def stand(self, f, x=-0.016, roll=3.2, yaw=-2.0, knee=5.0, back=0.0, lean=0.0):
        """Idle's stance (gait.key_idle): the feet where Idle's feet are, the weight on the right leg. `back` moves the
        pelvis backwards (metres), `knee` is the standing knee's bend, `lean` pitches the pelvis forward (degrees)."""
        P, G = self.P, self.G
        yh = self.c0.y + G.hip_off["L"].y
        feet = {"R": dict(ankle=Vector((-0.047, yh + 0.014, f["az"])), yaw=rad(-6.0)), "L": dict(ankle=Vector((0.052, yh - 0.034, f["az"])), yaw=rad(11.0))}
        R = Rz(rad(yaw)) @ Ry(rad(roll)) @ Rx(rad(lean))
        hj = R @ G.hip_off["R"]; d = G.leg_len(knee)
        hx = x + hj.x - feet["R"]["ankle"].x; hy = self.c0.y + back + hj.y - feet["R"]["ankle"].y
        zc = feet["R"]["ankle"].z + math.sqrt(max(1e-6, d * d - hx * hx - hy * hy)) - hj.z
        self.root((x, self.c0.y + back, zc), R)
        for side, sg in (("L", 1.0), ("R", -1.0)):
            ft = feet[side]
            self.leg(side, ft["ankle"], (sg * (0.10 if side == "L" else 0.02), -1.0, 0.0))
            P.orient("foot." + side, Rz(ft["yaw"]) @ Rx(f["th"]))
            for t in G.toes[side]: P.orient(t, Rz(ft["yaw"]))
        return R

    def hang(self, side, sw=2.0, el=9.0, out=0.19):
        """An arm hanging as in Idle (armature space: it does not follow the trunk's lean)."""
        sg = 1.0 if side == "L" else -1.0; P = self.P
        up = Vector((sg * out, -math.sin(rad(sw)), -math.cos(rad(sw)))); fo = Vector((sg * out * 0.53, -math.sin(rad(sw + el)), -math.cos(rad(sw + el))))
        for bn in ("upperarm01.", "upperarm02."): P.aim(bn + side, up)
        for bn in ("lowerarm01.", "lowerarm02."): P.aim(bn + side, fo)
        self.G.curl_fingers(side, 16.0)

    def key_gestures(self, only):
        G, P = self.G, self.P
        f = G.measure_foot(True)

        def idle():
            R = self.stand(f)
            for bn in G.spine: P.turn(bn, Rz(rad(2.0) / 5) @ Ry(rad(-3.2 * 0.9) / 5))
            for bn in G.neck: P.turn(bn, Ry(rad(-3.2 * 0.2) / 4))
            self.hang("L"); self.hang("R")

        if "Startle" in only:
            def peak(k):
                def fn():
                    self.stand(f, knee=5.0 + 13.0 * k, back=0.035 * k, lean=-4.0 * k)
                    self.spine(pitch=-9.0 * k, yaw=2.0)
                    self.head(pitch=-7.0 * k)
                    for side, sg in (("L", 1.0), ("R", -1.0)):          # the hands fly up in front of her chest, elbows out
                        sh = P.head("upperarm01." + side)
                        w = Vector((sg * (0.19 - 0.04 * k), sh.y - 0.05 - 0.21 * k, sh.z - 0.40 + 0.33 * k))
                        self.arm(side, w, (sg * 1.0, 0.35, -0.35))
                        P.aim("wrist." + side, (-sg * 0.25 * k, -0.35, 0.9 * k - 0.5 * (1 - k)))
                        self.G.curl_fingers(side, 16.0 - 10.0 * k)
                return fn
            self.clip("Startle", [(1, idle), (4, peak(1.0)), (7, peak(0.86)), (11, peak(0.55)), (17, idle)])

        if "Point" in only:
            def point(s):
                def fn():
                    self.stand(f, x=-0.016 + 0.004 * s, lean=2.0)
                    self.spine(pitch=3.0, yaw=-7.0 + 1.0 * s, roll=-2.5)
                    self.head(pitch=-2.0, yaw=5.0)
                    sh = P.head("upperarm01.R")
                    d = Vector((0.05, -1.0, 0.07 + 0.012 * s)).normalized()
                    self.arm("R", sh + d * 0.415, (-0.5, 0.1, -1.0))
                    P.aim("wrist.R", d); self.hand("R", 62.0, point=True)
                    self.hang("L", sw=-4.0, el=20.0)
                return fn
            self.clip("Point", [(1, point(0.0)), (20, point(1.0)), (40, point(0.0))])

        if "Cast" in only:
            def cast(k, up):
                """k: 0 idle .. 1 the arm thrown out; up: the wind-up (the hand drawn back by her shoulder)."""
                def fn():
                    self.stand(f, knee=5.0 + 6.0 * k, lean=5.0 * k - 3.0 * up)
                    self.spine(pitch=6.0 * k - 4.0 * up, yaw=-12.0 * k + 14.0 * up)
                    self.head(pitch=-3.0 * k, yaw=6.0 * k - 6.0 * up)
                    sh = P.head("upperarm01.R")
                    out = sh + Vector((-0.02, -0.40, 0.10)); back = sh + Vector((-0.16, 0.05, 0.02)); rest = sh + Vector((-0.06, -0.03, -0.41))
                    w = rest.lerp(back, up).lerp(out, k)
                    self.arm("R", w, (-0.7, 0.4, -0.7))
                    P.aim("wrist.R", (0.1 * k, -1.0 * k - 0.1, 0.55 * k - 0.9 * (1 - k) * (1 - up) + 0.4 * up))
                    self.G.curl_fingers("R", 16.0 - 12.0 * k + 30.0 * up)
                    self.hang("L", sw=-6.0 * k + 6.0 * up, el=9.0 + 20.0 * k, out=0.19 + 0.05 * k)
                return fn
            self.clip("Cast", [(1, idle), (4, cast(0.0, 1.0)), (7, cast(1.0, 0.0)), (12, cast(0.92, 0.0)), (20, idle)])

    # ================================================================================================= sitting
    def sitting(self, lean, lifts, flex, curl, shod, sway=0.0, spine=10.0, head=(0.0, 0.0, 0.0), spread=0.0, bend=0.08, hands=0.31, toes=None):
        """Sitting on the ground leaning back on her hands, the legs out in front.
        lean    degrees the trunk leans back        lifts   (R, L) degrees each leg is raised above level
        flex, curl   (R, L) ankle and toe angles (radians, see foot)     bend   how far the knees give (radians)
        spread  how far each leg points outwards (0 = straight ahead)    hands  how far behind the hips the hands rest"""
        P = self.P
        self.root((sway, 0.0, 0.6), Rx(rad(-lean)))
        self.spine(pitch=spine)
        for i, (side, sg) in enumerate((("R", -1.0), ("L", 1.0))):
            e = rad(lifts[i])
            for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (sg * spread, -math.cos(e + bend * 0.5), math.sin(e + bend * 0.5)))
            for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * spread * 0.6, -math.cos(e - bend * 0.5), math.sin(e - bend * 0.5)))
            self.foot(side, flex[i], curl[i], shod, toes)
        hip_y = P.head("upperleg01.L").y
        self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)             # her seat on the ground
        for side, sg in (("L", 1.0), ("R", -1.0)):                              # hands flat on the ground behind her, fingers pointing back and out
            sh = P.head("upperarm01." + side)
            self.arm(side, (sh.x + sg * 0.10, sh.y + 0.07 + (hands - 0.31), 0.066), (sg * 0.5, 1.0, 0.4), slack=0.985)
            P.aim("wrist." + side, (sg * 0.35, 0.93, -0.03)); self.G.curl_fingers(side, 6.0)
        self.head(*head)

    def key_sitting(self, only):
        # the legs are held a little apart: each ankle in its own coil of vine
        if "VineHeld" in only:
            rows = [(1, 0), (7, 1), (13, 0), (19, 1), (25, 0)]
            def held(a):
                R = (27.0, 0.30, 0.50) if a else (22.0, -0.22, -0.28); Lg = (22.0, -0.22, -0.28) if a else (27.0, 0.30, 0.50)
                return lambda: self.sitting(38.0 + 3.0 * a, (R[0], Lg[0]), (R[1], Lg[1]), (R[2], Lg[2]), False, sway=0.012 if a else -0.012,
                                            head=(18.0 - 30.0 * a, 9.0 if a else -9.0, 5.0 if a else -5.0), bend=0.14)      # she looks at her feet, then throws her head back
            self.clip("VineHeld", [(fr, held(a)) for fr, a in rows])
        if "VineHeldShod" in only:
            def tug(a):
                return lambda: self.sitting(33.0 + 3.0 * a, (25.0 if a else 20.0, 20.0 if a else 25.0), (0.0, 0.0), (0.0, 0.0), True, sway=0.015 if a else -0.015,
                                            head=(6.0, 4.0 if a else -4.0, 0.0), bend=0.26 if a else 0.12)
            self.clip("VineHeldShod", [(1, tug(0)), (9, tug(1)), (17, tug(0)), (25, tug(1)), (33, tug(0))])
        if "SitFlat" in only:
            def flat(a):
                R = (3.0, 0.16, 0.42) if a else (1.5, -0.14, -0.2); Lg = (1.5, -0.14, -0.2) if a else (3.0, 0.16, 0.42)
                return lambda: self.sitting(24.0 + 2.0 * a, (R[0], Lg[0]), (R[1], Lg[1]), (R[2], Lg[2]), False, sway=0.008 if a else -0.008,
                                            head=(-14.0 + 6.0 * a, 7.0 if a else -7.0, 4.0 if a else -4.0), bend=0.05, spread=0.03)
            self.clip("SitFlat", [(1, flat(0)), (8, flat(1)), (15, flat(0)), (22, flat(1)), (29, flat(0))])

    # ---------------------------------------------------------------------------------------------- by the fire
    def key_camp(self, only):
        """Her night by the fire, barefoot (her shoes and her hat lie beside her, as on the 2D sprite). Her pelvis stays
        over the origin. Asleep she lies on her LEFT side, her head at +Y, her feet towards -Y (the fire), her front to
        +X; sitting she faces -Y. CampWake takes her from the one to the other the way people get up: she rolls onto
        her back, pushes herself up on her hands and draws her knees up. CampLie is the same, backwards."""
        P = self.P
        if not any(n in only for n in ("CampSleep", "CampSit", "CampWake", "CampLie")): return
        az = self.G.measure_foot(False)["az"]

        def trunk(rho, theta, pitch, roll=0.0, sink=0.0):
            """rho: 90 on her left side .. 0 on her back; theta: 0 lying .. 90 upright; pitch, roll: how the spine bends."""
            self.root((0.0, 0.0, 0.6), Rx(rad(-90.0 + theta)) @ Rz(rad(rho)))
            self.spine(pitch=pitch, roll=roll)
            self.ground([self.suit] if self.suit else [self.body]); self.lift(sink)

        def legs(L, R, planted=False, flex=(0.5, 0.5), curl=(0.2, 0.2)):
            """L, R: ((x, y from the hip, z) of the ankle, pole). planted: the soles flat on the ground."""
            for side, (ank, pole), i in (("L", L, 1), ("R", R, 0)):
                hp = P.head("upperleg01." + side)
                self.leg(side, (ank[0], hp.y + ank[1], ank[2]), pole)
                self.unfoot(side)
                if planted:
                    P.orient("foot." + side, Rx(0.0))
                    for t in self.G.toes[side]: P.orient(t, Rx(0.0))
                else: self.foot(side, flex[i], curl[i], False)

        def sleep(s):
            def fn():
                trunk(90.0, 0.0, 22.0 + 1.5 * s, roll=-4.0, sink=0.012)
                legs(((0.10, -0.75, 0.052), (1.0, 0.0, 0.1)), ((0.23, -0.62, 0.115), (1.0, 0.2, -0.35)))     # knees drawn up a little, the upper one ahead
                hd = P.head("head"); sy = P.head("upperarm01.L").y
                self.arm("L", (hd.x + 0.07, hd.y + 0.03, 0.03), (1.0, -0.4, 0.15))                            # the under arm: bent, its hand under her cheek
                P.aim("wrist.L", (0.3, 1.0, 0.0))
                self.arm("R", (0.33, sy - 0.14, 0.05), (0.3, -0.5, 1.0))                                      # the upper arm: its hand on the ground in front of her
                P.aim("wrist.R", (0.9, 0.3, -0.1))
                self.hands(26.0)
                self.head(pitch=10.0, roll=13.0)
            return fn

        def stir():                                                                   # she lifts her head, her upper hand pushes at the ground
            trunk(64.0, 5.0, 16.0, roll=-2.0, sink=0.008)
            legs(((0.10, -0.76, 0.06), (1.0, 0.0, 0.4)), ((0.16, -0.66, 0.14), (0.8, 0.1, 0.5)))
            sy = P.head("upperarm01.L").y; sh = P.head("upperarm01.L")
            self.arm("L", (sh.x + 0.22, sy + 0.10, 0.04), (0.6, -1.0, 0.1)); P.aim("wrist.L", (0.6, 0.8, 0.0))
            self.arm("R", (0.34, sy - 0.10, 0.05), (0.1, -0.4, 1.0)); P.aim("wrist.R", (0.8, 0.5, -0.2))
            self.hands(18.0); self.head(pitch=2.0, roll=0.0, yaw=-8.0)

        def propped():                                                                # on her back, up on both hands, knees coming up
            trunk(16.0, 34.0, 20.0, sink=0.004)
            legs(((0.11, -0.63, az), (0.3, -0.3, 1.0)), ((-0.07, -0.62, az), (-0.1, -0.3, 1.0)), planted=True)
            for side, sg in (("L", 1.0), ("R", -1.0)):
                sh = P.head("upperarm01." + side)
                self.arm(side, (sh.x + sg * 0.13, sh.y + 0.03, 0.055), (sg * 0.5, 1.0, 0.3), slack=0.985); P.aim("wrist." + side, (sg * 0.4, 0.9, -0.05))
            self.hands(8.0); self.head(pitch=22.0)

        def pushing():                                                                # nearly up: her hands behind her hips
            trunk(4.0, 64.0, 18.0)
            legs(((0.11, -0.47, az), (0.15, -0.3, 1.0)), ((-0.11, -0.47, az), (-0.15, -0.3, 1.0)), planted=True)
            hp = P.head("upperleg01.L")
            for side, sg in (("L", 1.0), ("R", -1.0)):
                self.arm(side, (sg * 0.27, hp.y + 0.24, 0.055), (sg * 0.6, 1.0, 0.3), slack=0.985); P.aim("wrist." + side, (sg * 0.45, 0.88, -0.05))
            self.hands(8.0); self.head(pitch=10.0, yaw=4.0)

        def upright():                                                                # sitting: her hands come round to her knees
            trunk(0.0, 90.0, 14.0)
            legs(((0.11, -0.37, az), (0.1, -0.2, 1.0)), ((-0.11, -0.37, az), (-0.1, -0.2, 1.0)), planted=True)
            for side, sg in (("L", 1.0), ("R", -1.0)):
                kn = P.head("lowerleg01." + side)
                self.arm(side, (kn.x + sg * 0.07, kn.y + 0.05, kn.z - 0.03), (sg * 1.0, 0.3, -0.4)); P.aim("wrist." + side, (-sg * 0.5, -0.8, -0.2))
            self.hands(20.0); self.head(pitch=-2.0, yaw=5.0)

        def sit(s):
            def fn():
                trunk(0.0, 94.0 + 1.0 * s, 16.0 + 2.0 * s)                            # sitting up, a little forward over her knees
                legs(((0.11, -0.33, az), (0.1, -0.2, 1.0)), ((-0.11, -0.33, az), (-0.1, -0.2, 1.0)), planted=True)
                for side, sg in (("L", 1.0), ("R", -1.0)):                             # arms round her knees, the hands meeting in front of the shins
                    kn = P.head("lowerleg01." + side)
                    self.arm(side, (kn.x * 0.2 + sg * 0.015, kn.y - 0.085, kn.z - 0.13 - (0.025 if side == "R" else 0.0)), (sg * 1.0, -0.2, -0.5))
                    P.aim("wrist." + side, (-sg * 1.0, -0.1, -0.1)); self.G.curl_fingers(side, 34.0)
                self.head(pitch=-8.0 + 2.0 * s, yaw=6.0)
            return fn

        if "CampSit" in only: self.clip("CampSit", [(1, sit(0.0)), (30, sit(1.0)), (60, sit(0.0))])
        if "CampSleep" in only: self.clip("CampSleep", [(1, sleep(0.0)), (36, sleep(1.0)), (72, sleep(0.0))])
        if "CampWake" in only: self.clip("CampWake", [(1, sleep(0.0)), (9, stir), (19, propped), (28, pushing), (36, upright), (43, sit(0.0))])
        if "CampLie" in only: self.clip("CampLie", [(1, sit(0.0)), (8, upright), (16, pushing), (25, propped), (35, stir), (43, sleep(0.0))])

    # ------------------------------------------------------------------------------------------------ captured
    def key_held(self, only):
        P = self.P
        if "HeldBack" in only:
            def back(a):
                def fn():
                    lean = 73.0 + 2.0 * a
                    self.root((0.012 if a else -0.012, 0.0, 0.6), Rx(rad(-lean)))
                    self.spine(pitch=10.0, upper=1.6)                                  # her shoulders curl up off the ground a little
                    for i, (side, sg) in enumerate((("R", -1.0), ("L", 1.0))):
                        up = (a == i)
                        e = rad(50.0 + (5.0 if up else 0.0)); bend = 0.20 if up else 0.10
                        for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (0.0, -math.cos(e + bend * 0.5), math.sin(e + bend * 0.5)))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (0.0, -math.cos(e - bend * 0.5), math.sin(e - bend * 0.5)))
                        self.foot(side, 0.28 if up else -0.2, 0.5 if up else -0.28, False)
                    hip_y = P.head("upperleg01.L").y
                    self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)
                    for side, sg in (("L", 1.0), ("R", -1.0)):                         # propped on her elbows: forearms flat on the ground, pointing ahead
                        sh = P.head("upperarm01." + side); la = P.B["upperarm01." + side].length + P.B["upperarm02." + side].length
                        drop = min(la * 0.98, max(0.02, sh.z - 0.045)); h = math.sqrt(max(1e-6, la * la - drop * drop))
                        el = Vector((sg * 0.55, 0.83, 0.0)).normalized() * h + Vector((0, 0, -drop))
                        for bn in ("upperarm01.", "upperarm02."): P.aim(bn + side, el)
                        for bn in ("lowerarm01.", "lowerarm02."): P.aim(bn + side, (sg * 0.30, -0.95, -0.03))
                        P.aim("wrist." + side, (sg * 0.2, -0.97, -0.08)); self.G.curl_fingers(side, 22.0)
                    self.head(pitch=44.0 - 30.0 * a, yaw=8.0 if a else -8.0, roll=5.0 if a else -5.0)      # she lifts her head to look, then lets it drop back
                return fn
            self.clip("HeldBack", [(1, back(0)), (7, back(1)), (13, back(0)), (19, back(1)), (25, back(0))])
        if "HeldProne" in only:
            def prone(bl, br, al, ar, cl, cr, arch=1.0, hd=(0.0, 0.0), sway=0.0):
                """bl, br: how far each shin is raised (radians, pi/2 = straight up); al, ar: ankles; cl, cr: toes."""
                def fn():
                    self.root((sway, 0.0, 0.6), Rx(rad(90.0)))
                    for side, sg, bnd in (("L", 1.0, bl), ("R", -1.0, br)):
                        for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (sg * 0.035, 1.0, -0.03))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.02, math.cos(bnd), math.sin(bnd)))
                    for bn, z in (("spine04", 0.06), ("spine03", 0.28), ("spine02", 0.52), ("spine01", 0.70)):
                        zz = min(0.95, z * arch); P.aim(bn, (0, -math.sqrt(1 - zz * zz), zz))
                    for bn, z in (("neck01", 0.86), ("neck02", 0.94), ("neck03", 0.985)):
                        zz = min(0.995, z * (0.75 + 0.25 * arch)); P.aim(bn, (hd[0] * 0.4, -math.sqrt(1 - zz * zz), zz))
                    P.aim("head", (hd[0], hd[1], 1.0))
                    self.foot("L", al, cl, False); self.foot("R", ar, cr, False)
                    hip_y = P.head("upperleg01.L").y
                    self.ground([self.suit] if self.suit else [self.body], lambda p: p.y < hip_y + 0.05)       # her front on the ground (the suit: the arms still hang in their rest pose)
                    for side, sg in (("L", 1.0), ("R", -1.0)):                         # elbows under her shoulders, forearms ahead
                        sh = P.head("upperarm01." + side); la = P.B["upperarm01." + side].length + P.B["upperarm02." + side].length
                        drop = min(la * 0.98, max(0.02, sh.z - 0.045)); h = math.sqrt(max(1e-6, la * la - drop * drop))
                        el = Vector((sg * 0.5, -0.87, 0.0)).normalized() * h + Vector((0, 0, -drop))
                        for bn in ("upperarm01.", "upperarm02."): P.aim(bn + side, el)
                        for bn in ("lowerarm01.", "lowerarm02."): P.aim(bn + side, (-sg * 0.12, -0.99, -0.03))
                        P.aim("wrist." + side, (-sg * 0.1, -1.0, -0.06)); self.G.curl_fingers(side, 26.0)
                return fn
            self.clip("HeldProne", [(1, prone(1.34, 1.22, -0.2, 0.3, -0.28, 0.5, 1.06, (0.10, 0.26), 0.012)), (7, prone(1.22, 1.34, 0.3, -0.2, 0.5, -0.28, 0.96, (-0.08, 0.04), -0.012)),
                                    (13, prone(1.34, 1.22, -0.2, 0.3, -0.28, 0.5, 1.06, (0.12, 0.30), 0.012)), (19, prone(1.22, 1.34, 0.3, -0.2, 0.5, -0.28, 0.96, (-0.10, 0.06), -0.012)),
                                    (25, prone(1.34, 1.22, -0.2, 0.3, -0.28, 0.5, 1.06, (0.10, 0.26), 0.012))])
        if "Hogtie" in only or "HogtieTickled" in only:
            # (10-02, the epilogue: Boudicca's interrogation) on her front, her wrists crossed at the small of her back, her
            # shins up and together (her ankles tied, and roped to her wrists), soles to the sky; she lifts her head and
            # shoulders to look ahead or back over a shoulder. Tickled: her head tosses, her hips squirm, her shins jerk.
            def hog(sh, hd=(0.0, 0.3), sway=0.0, lift=1.0, twist=0.0):
                def fn():
                    self.root((sway, 0.0, 0.6), Rx(rad(90.0)) @ Ry(rad(twist)))
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (sg * 0.03, 1.0, -0.03))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.004, math.cos(sh), math.sin(sh)))
                    for bn, z in (("spine04", 0.05), ("spine03", 0.22 * lift), ("spine02", 0.42 * lift), ("spine01", 0.56 * lift)):
                        P.aim(bn, (0, -math.sqrt(1 - z * z), z))
                    for bn, z in (("neck01", 0.80 * lift), ("neck02", 0.90 * lift), ("neck03", 0.96 * lift)):
                        z = min(0.99, z); P.aim(bn, (hd[0] * 0.5, -math.sqrt(1 - z * z), z))
                    P.aim("head", (hd[0], -0.25 + hd[1] * 0.25, 1.0))
                    self.foot("L", 0.15, 0.25, False); self.foot("R", 0.15, 0.25, False)
                    hip_y = P.head("upperleg01.L").y
                    self.ground([self.suit] if self.suit else [self.body], lambda p: p.y < hip_y + 0.05)
                    # her hands: wrists crossed over the small of her back, a hand's breadth up off it
                    sp = P.head("spine04"); up = Vector((0.0, 0.0, 1.0)); ax = (P.head("spine02") - P.head("spine04")).normalized()      # (spine04: the small of her back; spine01 is up between her shoulders)
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        tgt = sp + up * 0.11 + ax * 0.02 + Vector((-sg * 0.035, 0.0, 0.0))
                        self.arm(side, tgt, (sg * 1.0, 0.25, 0.55), slack=0.995)
                        P.aim("wrist." + side, (-sg * 0.8, ax.y * -0.3, 0.2)); self.G.curl_fingers(side, 34.0)
                return fn
            if "Hogtie" in only:
                self.clip("Hogtie", [(1, hog(1.32, (0.0, 0.3), 0.004)), (9, hog(1.28, (0.30, 0.1), -0.004, 0.97)), (17, hog(1.34, (-0.12, 0.35), 0.006, 1.03)), (25, hog(1.32, (0.0, 0.3), 0.004))])
            if "HogtieTickled" in only:
                # (10-05, as he said: "both shake way too violently") This was four jerks in half a second (keys three frames apart):
                # her feet went 12 cm to and fro nearly four times a second, at 0.9 m/s, and Boudicca's hands with them. Now six
                # moves in a second and a half, no two alike, her shins swinging half as far: she squirms. The game plays it a
                # little faster for the hardest tickling (story_edge.js `stage`, A.clipSpeed).
                self.clip("HogtieTickled", [(1, hog(1.27, (0.26, 0.46), 0.008, 1.06, 2.0)), (7, hog(1.38, (-0.22, 0.12), -0.008, 0.94, -2.0)), (13, hog(1.25, (0.14, 0.50), 0.010, 1.07, 1.6)),
                                            (19, hog(1.39, (-0.28, 0.16), -0.010, 0.93, -2.2)), (25, hog(1.29, (0.22, 0.40), 0.006, 1.05, 1.4)), (31, hog(1.36, (-0.14, 0.22), -0.006, 0.96, -1.2)),
                                            (37, hog(1.27, (0.26, 0.46), 0.008, 1.06, 2.0))])
        if "KneelSit" in only:
            # (the epilogue: Boudicca, not Anne) kneeling, sat back on her heels, upright and a little forward; her arms
            # are the game's (thief.js aims them at Anne's soles)
            def kneel(k):
                def fn():
                    self.root((0.0, 0.0, 0.6), Rx(rad(-8.0 - 3.0 * k)))
                    self.spine(pitch=10.0 + 4.0 * k, roll=1.0 - 2.0 * k)
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        self.baim(("upperleg01." + side, "upperleg02." + side), (sg * 0.13, -0.93, -0.36))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.03, 0.99, -0.12))
                        self.foot(side, 0.55, 0.0, True)
                    self.ground(self.solid(True))
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        th = P.head("lowerleg01." + side)
                        self.arm(side, (th.x - sg * 0.02, th.y - 0.05, th.z + 0.08), (sg * 1.0, 0.2, -0.3)); P.aim("wrist." + side, (-sg * 0.2, -0.9, -0.3)); self.G.curl_fingers(side, 22.0)
                    self.head(pitch=12.0 + 6.0 * k, yaw=4.0 - 8.0 * k, roll=2.0)
                return fn
            self.clip("KneelSit", [(1, kneel(0.0)), (13, kneel(1.0)), (25, kneel(0.0))])
        if any(n in only for n in ("ChairBound", "ChairBare", "ChairTickled")):
            # (10-02, the opening: the haunted library) sitting up in a high-backed chair, held there by Lilith's magic:
            # her wrists on the armrests, her legs out straight on a low footstool, her soles to whoever kneels at her
            # feet. Bound: a slow tug at the bands, her head turning (shod: in her heels). Tickled: barefoot, her toes
            # curling and spreading, her feet twisting, her head tossing back.
            SEAT = 0.47
            def chair(k, shod, tk=0.0, ph=0.0):
                def fn():
                    sp, cp = math.sin(ph), math.cos(ph)
                    self.root((0.0, 0.0, 0.6), Rx(rad(-9.0 + 4.0 * tk * sp)) @ Ry(rad(3.0 * tk * cp)))
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (sg * 0.05, -1.0, 0.04))
                    hip_y = P.head("upperleg01.L").y
                    self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)
                    self.lift(SEAT)
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        tw = 0.08 * tk * math.sin(ph + (0.0 if side == "L" else 1.7))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.03 + tw * 0.3, -0.93, -0.36 + 0.06 * tk * math.sin(ph * 2 + sg)))
                        w = math.sin(ph * 1.7 + sg)
                        self.foot(side, flex=0.1 + 0.25 * tk * math.sin(ph + sg), curl=0.35 * tk * max(0.0, w) - 0.15 * tk * max(0.0, -w), shod=shod)
                    self.spine(pitch=2.0 - 6.0 * tk * max(0.0, sp), roll=4.0 * tk * cp + 2.0 * k, yaw=3.0 * k)
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        sh = P.head("upperarm01." + side)
                        self.arm(side, (sh.x + sg * 0.12, sh.y - 0.22, SEAT + 0.21 + 0.02 * k), (sg * 1.0, 0.5, -0.3), slack=0.99)
                        P.aim("wrist." + side, (sg * 0.05, -1.0, -0.12)); self.G.curl_fingers(side, 26.0 + 30.0 * k + 20.0 * tk)
                    self.head(pitch=8.0 - 22.0 * tk * max(0.0, sp), yaw=14.0 * sp * tk + (-20.0 + 40.0 * k) * (1.0 - tk), roll=4.0 * tk * cp)
                return fn
            if "ChairBound" in only: self.clip("ChairBound", [(1, chair(0.0, True)), (31, chair(1.0, True)), (61, chair(0.0, True))])
            if "ChairBare" in only: self.clip("ChairBare", [(1, chair(0.0, False)), (31, chair(1.0, False)), (61, chair(0.0, False))])
            if "ChairTickled" in only: self.clip("ChairTickled", [(1, chair(0.3, False, 1.0, 0.0)), (4, chair(0.3, False, 1.0, math.pi / 2)), (7, chair(0.3, False, 1.0, math.pi)), (10, chair(0.3, False, 1.0, 1.5 * math.pi)), (13, chair(0.3, False, 1.0, 0.0))])
        if "LaughFit" in only:
            def fit(k):
                def fn():
                    self.root((0.0, 0.0, 0.6), Rx(rad(16.0 + 12.0 * k)))               # on her knees, doubled over
                    self.spine(pitch=30.0 + 14.0 * k, roll=3.0 - 6.0 * k)
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        self.baim(("upperleg01." + side, "upperleg02." + side), (sg * 0.10, -0.22, -0.97))
                        for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.02, 0.985, -0.17))
                        self.foot(side, 0.35, 0.0, True)
                    self.ground(self.solid(True))
                    for side, sg in (("L", 1.0), ("R", -1.0)):                         # she hugs her sides
                        sh = P.head("upperarm01." + side); c = P.head("spine03")
                        self.arm(side, (c.x - sg * 0.07, c.y - 0.17, c.z + 0.02 - (0.04 if side == "L" else 0.0)), (sg * 1.0, 0.3, -0.2))
                        P.aim("wrist." + side, (-sg * 1.0, -0.15, 0.1)); self.G.curl_fingers(side, 30.0)
                    self.head(pitch=-26.0 + 30.0 * k, yaw=6.0 - 12.0 * k, roll=4.0)
                return fn
            self.clip("LaughFit", [(1, fit(0.0)), (5, fit(1.0)), (9, fit(0.15)), (13, fit(0.9)), (17, fit(0.0))])

    # ------------------------------------------------------------------------------------------------ in the log
    def key_log(self, only):
        """Stuck in the hollow log with her ankles tied. On her front, propped on her forearms outside the front mouth
        (the upper body of StuckIdle in s3_finish.py), her legs out straight behind, sloping down from the back mouth,
        ankles together, her feet resting on the ground on their toes, soles up and back. The game pins her hips in
        the log (Marker_Chest), so only the pose matters, not where the root is."""
        P = self.P; LOG_FLOOR = 0.08; CLOSE = 0.040
        if not any(n in only for n in ("StuckFlat", "StuckFlatTickled", "StuckFlatStrain")): return
        LEG = lambda side: sum(P.B[b + side].length for b in ("upperleg01.", "upperleg02.", "lowerleg01.", "lowerleg02."))

        def flat(flex=(1.18, 1.18), curl=(0.0, 0.0), toes=(None, None), lift=0.0, arch=1.0, hd=(0.0, 0.0), arm_spread=0.0, sway=0.0):
            """flex, curl, toes: (R, L) as in foot(). lift: how far both feet are raised off the ground (metres)."""
            def fn():
                self.root((sway, 0.0, 0.6), Rx(rad(90.0)))
                for side, sg in (("L", 1.0), ("R", -1.0)):                         # (legs straight back while the trunk is measured)
                    for bn in ("upperleg01.", "upperleg02.", "lowerleg01.", "lowerleg02."): P.aim(bn + side, (0.0, 1.0, -0.1))
                for bn, z in (("spine04", 0.06), ("spine03", 0.28), ("spine02", 0.52), ("spine01", 0.70)):
                    zz = min(0.95, z * arch); P.aim(bn, (0, -math.sqrt(1 - zz * zz), zz))
                for bn, z in (("neck01", 0.86), ("neck02", 0.94), ("neck03", 0.985)):
                    zz = min(0.995, z * (0.75 + 0.25 * arch)); P.aim(bn, (hd[0] * 0.4, -math.sqrt(1 - zz * zz), zz))
                P.aim("head", (hd[0], hd[1], 1.0))
                hy = P.head("upperleg01.L").y
                belly = self.lowest([o for o in (self.suit, self.body) if o], lambda p: hy - 0.30 < p.y < hy + 0.40 and abs(p.x) < 0.3)
                ground = belly - (LOG_FLOOR + 0.004)                                # the ground outside the log
                for side, sg in (("L", 1.0), ("R", -1.0)):                         # forearms on the ground in front of the log (as s3_finish.prone)
                    sh = P.head("upperarm01." + side); lu = P.B["upperarm01." + side].length + P.B["upperarm02." + side].length
                    c = max(0.25, min(0.96, (sh.z - ground - 0.05) / lu)); rem = math.sqrt(1 - c * c)
                    for bn in ("upperarm01.", "upperarm02."): P.aim(bn + side, (sg * (0.10 + 0.25 * rem + arm_spread), -rem, -c))
                    el = P.head("lowerarm01." + side); lf = P.B["lowerarm01." + side].length + P.B["lowerarm02." + side].length
                    sl = max(-0.6, min(0.0, -(el.z - ground - 0.035) / lf))
                    for bn in ("lowerarm01.", "lowerarm02."): P.aim(bn + side, (sg * -0.10, -math.sqrt(1 - sl * sl), sl))
                    P.aim("wrist." + side, (sg * -0.05, -1.0, 0.0)); self.G.curl_fingers(side, 14.0)

                def legs(h):                                                        # ankles together, `h` above the ground, legs all but straight
                    for i, (side, sg) in enumerate((("R", -1.0), ("L", 1.0))):
                        hp = P.head("upperleg01." + side); L = LEG(side) * 0.997
                        dz = ground + h - hp.z; dx = sg * CLOSE - hp.x
                        y = hp.y + math.sqrt(max(1e-6, L * L - dz * dz - dx * dx))
                        self.leg(side, (sg * CLOSE, y, ground + h), (0.0, 0.0, -1.0))
                        self.unfoot(side); self.foot(side, flex[i], curl[i], False, toes[i])
                h = 0.09; legs(h)
                for _ in range(2):                                                  # settle: the lowest point of her shins and feet 3 mm off the ground
                    h += 0.003 - (self.lowest([self.body], lambda p: p.y > hy + 0.55) - ground); legs(h)
                if lift: legs(h + lift)
                self.lift(-ground)                                                  # (the clip's own floor is the ground outside the log)
            return fn

        T = lambda a, b, c, d, e: (a, b, c, d, e)                                   # per-toe offsets, big toe first
        if "StuckFlat" in only:
            self.clip("StuckFlat", [(1, flat(hd=(0.00, 0.05))), (30, flat(flex=(1.22, 1.16), curl=(0.08, 0.0), arch=0.95, hd=(0.10, 0.00))), (60, flat(hd=(0.00, 0.05)))])
        if "StuckFlatTickled" in only:
            # a two-second laugh in beats of six frames: each beat is held and then snaps to the next; the feet answer the
            # tickling in turn (one scrunches while the other splays), the ties keep them where they are
            scr, spl = 0.62, -0.30
            fan = T(-0.10, 0.0, 0.06, 0.12, 0.2)
            K = [
                (1,  flat(flex=(1.30, 1.14), curl=(scr, spl), toes=(None, fan), arch=1.08, hd=(0.12, 0.30), sway=0.012)),
                (7,  flat(flex=(1.14, 1.30), curl=(spl, scr), toes=(fan, None), arch=0.95, hd=(-0.08, 0.02), sway=-0.012)),
                (13, flat(flex=(1.32, 1.22), curl=(scr, scr * 0.7), arch=1.10, hd=(0.20, 0.34), sway=0.008, arm_spread=0.03)),
                (19, flat(flex=(1.16, 1.12), curl=(spl, spl), toes=(fan, fan), arch=0.92, hd=(0.02, -0.06), sway=-0.006)),
                (25, flat(flex=(1.12, 1.32), curl=(spl * 0.6, scr), toes=(fan, None), arch=1.06, hd=(-0.16, 0.30), sway=-0.012)),
                (31, flat(flex=(1.30, 1.16), curl=(scr, spl), toes=(None, fan), arch=0.96, hd=(0.06, 0.04), sway=0.010)),
                (37, flat(flex=(1.24, 1.30), curl=(scr * 0.8, scr), arch=1.10, hd=(-0.10, 0.36), sway=0.0, arm_spread=0.03)),
                (43, flat(flex=(1.14, 1.14), curl=(spl, spl * 0.5), toes=(fan, fan), arch=0.94, hd=(0.04, -0.04), sway=0.006)),
            ]
            self.clip("StuckFlatTickled", K + [(49, K[0][1])])
        if "StuckFlatStrain" in only:
            pull = lambda k, sw: flat(flex=(1.26, 1.26), curl=(0.5, 0.5), lift=0.07 * k, arch=1.0 + 0.08 * k, hd=(0.2 * sw, 0.12 - 0.2 * k), sway=0.012 * sw, arm_spread=0.04 * k)
            self.clip("StuckFlatStrain", [(1, pull(1.0, 1.0)), (6, pull(0.9, 1.0)), (10, pull(0.0, 0.0)), (14, pull(1.0, -1.0)), (19, pull(0.9, -1.0)), (23, pull(0.0, 0.0)), (27, pull(1.0, 1.0))])

    # ---------------------------------------------------------------------------------------------- the hole trap
    def key_hole(self, only):
        """Caught in the hole trap: in the ground to her waist, her arms pinned at her sides inside the hole, her legs
        hanging free in the hollow underneath. The origin is the middle of the hole at ground level; she faces -Y."""
        P = self.P; WAIST = 0.13                                  # the ground is this far above the middle of her pelvis
        names = ("HoleIdle", "HoleKick", "HoleTease", "HoleTickled", "HoleBound", "HoleKickout")
        if not any(n in only for n in names): return
        FAN = (-0.12, 0.0, 0.07, 0.14, 0.22)                      # toes spread: the big toe back, the little ones wide

        def hang(L, R, shod=False, lean=0.0, twist=0.0, roll=0.0, sway=(0.0, 0.0), spine=(0.0, 0.0, 0.0), hd=(0.0, 0.0, 0.0), drop=0.0, shrug=0.0):
            """L, R: (hip flexion, knee flexion, outwards: degrees; ankle flex, toe curl: radians; fan: toes spread)."""
            def fn():
                self.root((sway[0], sway[1], -WAIST - drop), Rz(rad(twist)) @ Ry(rad(roll)) @ Rx(rad(lean)))
                self.spine(pitch=spine[0], roll=spine[1], yaw=spine[2]); self.head(*hd)
                for side, sg, leg in (("L", 1.0, L), ("R", -1.0, R)):
                    hf, kf, out, flex, curl = leg[:5]; fan = leg[5] if len(leg) > 5 else False
                    a = rad(hf); b = rad(hf - kf); o = math.sin(rad(out))
                    self.legdir(side, (sg * o, -math.sin(a), -math.cos(a)), (sg * o * 0.4, -math.sin(b), -math.cos(b)))
                    self.unfoot(side); self.foot(side, flex, curl, shod, FAN if fan else None)
                for side, sg in (("L", 1.0), ("R", -1.0)):          # arms pinned at her sides, her hands below the rim by her hips
                    self.armdir(side, (sg * (0.15 + 0.05 * shrug), 0.04, -1.0), (sg * 0.06, -0.10, -1.0), (sg * 0.28, -0.12, -1.0)); self.G.curl_fingers(side, 10.0 + 30.0 * shrug)
            return fn

        if "HoleIdle" in only:
            a = hang((10, 14, 2, 0.12, 0), (5, 9, 2, 0.08, 0), True, sway=(0.005, 0), hd=(4, 9, 0), spine=(2, 0, 3))
            b = hang((5, 9, 2, 0.08, 0), (11, 15, 2, 0.12, 0), True, sway=(-0.005, 0), hd=(1, -11, 0), spine=(2, 0, -3))
            self.clip("HoleIdle", [(1, a), (31, b), (61, a)])
        if "HoleKick" in only:
            k1 = hang((40, 22, 5, 0.1, 0), (-10, 58, 5, 0.25, 0), True, lean=4, twist=7, roll=3, hd=(-6, -8, 4), spine=(4, 3, 5), shrug=1.0)
            k0 = hang((12, 30, 4, 0.1, 0), (12, 30, 4, 0.1, 0), True, lean=1, hd=(8, 0, 0), shrug=0.6)
            k2 = hang((-10, 58, 5, 0.25, 0), (40, 22, 5, 0.1, 0), True, lean=4, twist=-7, roll=-3, hd=(-6, 8, -4), spine=(4, -3, -5), shrug=1.0)
            self.clip("HoleKick", [(1, k1), (7, k0), (13, k2), (19, k0), (25, k1)])
        rest = (7, 11, 2, 0.55, 0.12)
        if "HoleTease" in only:
            n0 = hang(rest, (5, 9, 2, 0.5, 0.1), hd=(6, 5, 0))
            jr = hang(rest, (34, 74, 4, 0.2, 0.62), lean=-2, twist=-4, hd=(-4, -10, 0), spine=(-2, 0, -4), shrug=0.7)
            jl = hang((32, 70, 4, 0.2, 0.62), (5, 9, 2, 0.5, 0.1), lean=-2, twist=4, hd=(-4, 10, 0), spine=(-2, 0, 4), shrug=0.7)
            self.clip("HoleTease", [(1, n0), (4, jr), (10, jr), (14, n0), (19, n0), (22, jl), (28, jl), (32, n0), (37, n0)])
        def laugh(k, a):                                              # one beat of the laugh: k -1 forward .. 1 thrown back; a: which foot scrunches
            scr = (0.25 if a else 0.7); 
            R = ((24 if a else 9), (50 if a else 20), 4, (0.85 if a else 0.3), (0.65 if a else -0.3), not a)
            Lg = ((9 if a else 24), (20 if a else 50), 4, (0.3 if a else 0.85), (-0.3 if a else 0.65), bool(a))
            return hang(Lg, R, lean=-5.0 * k, twist=7.0 if a else -7.0, roll=3.0 if a else -3.0, sway=(0.008 if a else -0.008, 0), spine=(-6.0 * k, 3.0 if a else -3.0, 0),
                        hd=(-26.0 * k if k > 0 else -14.0 * k, 9.0 if a else -9.0, 5.0 if a else -5.0), shrug=0.5 + 0.5 * abs(k))
        if "HoleTickled" in only:
            K = [(1, laugh(1.0, 1)), (7, laugh(-0.8, 0)), (13, laugh(0.8, 1)), (19, laugh(-1.0, 0)), (25, laugh(1.0, 0)), (31, laugh(-0.6, 1)), (37, laugh(0.9, 0)), (43, laugh(-0.9, 1))]
            self.clip("HoleTickled", K + [(49, K[0][1])])
        def bound(k, a, sw):                                          # legs wound together: they swing as one; the feet take turns
            hf = 6 + 3 * sw; kf = 9 + 4 * abs(sw)
            R = (hf, kf, -2.6, 0.8 if a else 0.35, 0.65 if a else -0.3, not a); Lg = (hf, kf, -2.6, 0.35 if a else 0.8, -0.3 if a else 0.65, bool(a))
            return hang(Lg, R, lean=-2.5 * k, twist=4.0 * sw, roll=1.5 * sw, sway=(0.006 * sw, 0), spine=(-8.0 * k, 3.0 * sw, 0),
                        hd=(-26.0 * k if k > 0 else -14.0 * k, 9.0 * sw, 5.0 * sw), shrug=0.5 + 0.5 * abs(k))
        if "HoleBound" in only:
            K = [(1, bound(1.0, 1, 1)), (7, bound(-0.8, 0, 0.3)), (13, bound(0.8, 1, -1)), (19, bound(-1.0, 0, -0.3)), (25, bound(1.0, 0, 1)), (31, bound(-0.6, 1, 0.3)), (37, bound(0.9, 0, -1)), (43, bound(-0.9, 1, -0.3))]
            self.clip("HoleBound", K + [(49, K[0][1])])
        if "HoleKickout" in only:
            n0 = hang(rest, (5, 9, 2, 0.5, 0.1), hd=(6, 5, 0))
            up = hang((62, 104, 6, 0.1, 0.5), (58, 100, 6, 0.1, 0.5), lean=6, hd=(14, 0, 0), spine=(8, 0, 0), shrug=1.0)
            out = hang((24, 4, 8, 0.9, -0.2, True), (20, 4, 8, 0.9, -0.2, True), lean=-6, hd=(-12, 0, 0), spine=(-6, 0, 0), shrug=1.0)
            back = hang((2, 14, 4, 0.5, 0.1), (0, 12, 4, 0.5, 0.1), lean=-2, hd=(-4, 0, 0))
            self.clip("HoleKickout", [(1, n0), (5, up), (8, out), (11, out), (15, back), (21, n0)])

    # ---------------------------------------------------------------------------------- the 2D sheets, pose for pose
    def elbows(self, sides="LR", fore=(0.30, -0.95, -0.03), hand=(0.2, -0.97, -0.08), out=0.55, back=0.83, curl=22.0):
        """Propped on her elbows (as HeldBack): the upper arm down to the ground from the shoulder, the forearm flat."""
        P = self.P
        for side in sides:
            sg = 1.0 if side == "L" else -1.0
            sh = P.head("upperarm01." + side); la = P.B["upperarm01." + side].length + P.B["upperarm02." + side].length
            drop = min(la * 0.98, max(0.02, sh.z - 0.045)); h = math.sqrt(max(1e-6, la * la - drop * drop))
            el = Vector((sg * out, back, 0.0)).normalized() * h + Vector((0, 0, -drop))
            for bn in ("upperarm01.", "upperarm02."): P.aim(bn + side, el)
            for bn in ("lowerarm01.", "lowerarm02."): P.aim(bn + side, (sg * fore[0], fore[1], fore[2]))
            P.aim("wrist." + side, (sg * hand[0], hand[1], hand[2])); self.G.curl_fingers(side, curl)

    def key_ivy(self, only):
        """Caught by the Ivy Maidens as the 2D sheet anne-ivymaidens-1 has it (CAPTURE1): on her back, propped on her
        elbows; her RIGHT leg held straight up by a vine wound round it, that foot between the maidens' two heads; her
        LEFT leg bent out on the ground beside her, its ankle held too. The origin is her seat; she faces -Y (her head
        lies towards +Y); the sheet sees her from her left. Feet as the clip leaves them: the game takes her sandals off.
          IvyLegUp          held: she tugs at the vine and looks up at her foot                       loop
          IvyLegUpTickled   the heads lick her sole: she laughs, her toes scrunch and spread           loop
          IvyWorship        the sheet's worship sets: sitting back on her hands, both legs up together,   loop
                            at her ease (it is she who has won)"""
        P, G = self.P, self.G
        FAN = (-0.12, 0.0, 0.07, 0.14, 0.22); ANKLE_BARE = G.measure_foot(False)["az"] + 0.002
        def up(a, k, laugh):
            def fn():
                self.root((0.008 if a else -0.008, 0.0, 0.6), Rx(rad(-(62.0 + 3.0 * k))))
                self.spine(pitch=12.0, upper=1.5, roll=2.5 if a else -2.5)
                e = rad(84.0 + (2.5 if a else -1.5))                              # right leg: straight up
                for bn in ("upperleg01.R", "upperleg02.R"): P.aim(bn, (-0.02, -math.cos(e + 0.03), math.sin(e + 0.03)))
                for bn in ("lowerleg01.R", "lowerleg02.R"): P.aim(bn, (-0.02, -math.cos(e - 0.03), math.sin(e - 0.03)))
                if laugh: self.foot("R", 0.32 if a else -0.16, 0.6 if a else -0.28, False, None if a else FAN)
                else: self.foot("R", 0.12 if a else -0.05, 0.25 if a else -0.1, False)
                for bn in ("upperleg01.L", "upperleg02.L", "lowerleg01.L", "lowerleg02.L"): P.aim(bn, (0.5, -0.8, 0.3))      # (out of the way: what is measured next is her seat)
                hip_y = P.head("upperleg01.L").y
                self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)
                hip = P.head("upperleg01.L")                                      # left leg: bent out beside her, the foot on the ground
                self.leg("L", Vector((hip.x + 0.27, hip.y - 0.27 + (0.03 if a else 0.0), ANKLE_BARE)), (0.55, -0.45, 1.0))
                P.orient("foot.L", Rz(rad(38.0)))                                 # flat on the ground, turned out
                for t in G.toes["L"]: P.orient(t, Rz(rad(38.0)) @ Rx(0.12 if a else 0.0))
                self.elbows()
                if laugh: self.head(pitch=40.0 - 36.0 * k, yaw=8.0 if a else -8.0, roll=5.0 if a else -5.0)
                else: self.head(pitch=44.0 - 6.0 * k, yaw=5.0 if a else -3.0, roll=0.0)
            return fn
        if "IvyLegUp" in only:
            self.clip("IvyLegUp", [(1, up(0, 0.0, False)), (10, up(1, 1.0, False)), (16, up(0, 0.4, False)), (24, up(1, 0.8, False)), (37, up(0, 0.0, False))])
        if "IvyLegUpTickled" in only:
            K = [(1, up(0, 0.0, True)), (7, up(1, 1.0, True)), (13, up(0, 0.3, True)), (19, up(1, 0.0, True)), (25, up(0, 1.0, True)), (31, up(1, 0.3, True))]
            self.clip("IvyLegUpTickled", K + [(37, K[0][1])])
        if "IvyWorship" in only:
            def ease(a):
                R = (56.0, 0.25, 0.35) if a else (53.0, -0.1, -0.15); Lg = (53.0, -0.1, -0.15) if a else (56.0, 0.25, 0.35)
                return lambda: self.sitting(40.0, (R[0], Lg[0]), (R[1], Lg[1]), (R[2], Lg[2]), False, sway=0.006 if a else -0.006, spine=12.0,
                                            head=(10.0, 6.0 if a else -6.0, 3.0 if a else -3.0), bend=0.10, spread=-0.085, hands=0.33)
            self.clip("IvyWorship", [(1, ease(0)), (16, ease(1)), (31, ease(0)), (46, ease(1)), (61, ease(0))])

    def key_myc(self, only):
        """Held by the Myconids as the 2D sheet anne-myconid-1 has it (its first two rows). The lady stands behind her
        and has her round the waist; her wrists are held together before her chest. She faces -Y, barefoot.
          MycHeld       the sheet's tease: on the toes of her right foot, her left leg drawn up (a child is at that foot)   loop
          MycHeldOut    tickle: lifted off the ground, her left leg held out level to a second lady, her right knee up     loop"""
        P, G = self.P, self.G
        if not any(n in only for n in ("MycHeld", "MycHeldOut")): return
        f = G.measure_foot(False)
        FAN = (-0.12, 0.0, 0.07, 0.14, 0.22)
        def held(a, k, out):
            def fn():
                yh = self.c0.y + G.hip_off["L"].y
                R = Rz(rad(3.0 if a else -3.0)) @ Rx(rad(-(9.0 + 7.0 * out + 3.0 * k)))
                self.root((0.0, self.c0.y + 0.03 + 0.05 * out, self.c0.z + 0.012 + 0.10 * out), R)
                self.spine(pitch=-4.0 + 8.0 * k, roll=2.5 if a else -2.5, yaw=4.0 if a else -4.0)
                if out:                                                             # lifted: her right knee drawn up, the foot hanging
                    self.legdir("R", (-0.10, -0.62 - 0.05 * a, -0.78), (-0.04, 0.42, -0.90))
                    self.unfoot("R"); self.foot("R", 0.55, 0.5 if a else -0.2, False, None if a else FAN)
                    self.legdir("L", (0.07, -1.0, 0.10 + 0.03 * a), (0.05, -1.0, 0.03 + 0.03 * a))                   # her left leg out level
                    self.unfoot("L"); self.foot("L", -0.12 if a else 0.3, -0.25 if a else 0.55, False, FAN if a else None)
                else:                                                               # on the toes of her right foot
                    self.leg("R", Vector((-0.065, yh + 0.035, f["az"] + 0.072)), (-0.05, -1.0, 0.0))
                    P.orient("foot.R", Rz(rad(-8.0)) @ Rx(0.62))
                    for t in G.toes["R"]: P.orient(t, Rz(rad(-8.0)))
                    self.legdir("L", (0.12, -0.95, 0.24 + 0.06 * a), (0.06, -0.12 + 0.1 * a, -0.99))                # her left leg drawn up, the shin hanging
                    self.unfoot("L"); self.foot("L", 0.45 if a else 0.2, 0.5 if a else -0.15, False, None if a else FAN)
                st = P.head("spine01")
                for side, sg in (("L", 1.0), ("R", -1.0)):                         # wrists together before her chest, elbows down
                    self.arm(side, (sg * 0.036, st.y - 0.205, st.z + 0.075 + 0.02 * k), (sg * 0.9, 0.25, -0.6))
                    P.aim("wrist." + side, (-sg * 0.25, -0.35, 0.9)); G.curl_fingers(side, 42.0)
                self.head(pitch=8.0 - 30.0 * k, yaw=10.0 if a else -10.0, roll=5.0 if a else -5.0)
            return fn
        for name, out in (("MycHeld", 0), ("MycHeldOut", 1)):
            if name in only:
                K = [(1, held(0, 0.0, out)), (7, held(1, 1.0, out)), (13, held(0, 0.3, out)), (19, held(1, 0.0, out)), (25, held(0, 1.0, out)), (31, held(1, 0.3, out))]
                self.clip(name, K + [(37, K[0][1])])

    def key_alr(self, only):
        """Held by Alraune as the 2D sheet alraune-capture-11 has it: lying on her back in the air, level, wound in vines
        with her arms at her sides, her feet towards Alraune. The origin is under her hips, at the height her back lies
        at (the game lifts her to Alraune's hands). She faces -Y (her feet point that way), barefoot, hat off.
          AlrHeld          held: she squirms a little, looks at what Alraune is doing     loop
          AlrHeldTickled   laughing, her toes scrunching in turn                           loop"""
        P, G = self.P, self.G
        FAN = (-0.12, 0.0, 0.07, 0.14, 0.22)
        def level(a, k, laugh):
            def fn():
                self.root((0.006 if a else -0.006, 0.0, 0.6), Rx(rad(-(80.0 - 4.0 * k))) @ Rz(rad(2.0 if a else -2.0)))
                self.spine(pitch=10.0 + 6.0 * k, roll=2.0 if a else -2.0)
                for i, (side, sg) in enumerate((("R", -1.0), ("L", 1.0))):
                    upf = (a == i); e = rad(7.0 + (5.0 if upf else 0.0)); bend = 0.16 if upf else 0.08
                    for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (-sg * 0.085, -math.cos(e + bend * 0.5), math.sin(e + bend * 0.5)))
                    for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (-sg * 0.05, -math.cos(e - bend * 0.5), math.sin(e - bend * 0.5)))
                    if laugh: self.foot(side, 0.3 if upf else -0.18, 0.55 if upf else -0.28, False, None if upf else FAN)
                    else: self.foot(side, 0.1 if upf else -0.05, 0.2 if upf else -0.08, False)
                hip_y = P.head("upperleg01.L").y
                self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)
                for side, sg in (("L", 1.0), ("R", -1.0)):                         # her arms along her sides (the vines have them)
                    hp = P.head("upperleg01." + side)
                    self.arm(side, (hp.x + sg * 0.085, hp.y + 0.05, hp.z + 0.02), (sg * 1.0, 0.2, 0.3))
                    P.aim("wrist." + side, (sg * 0.1, -1.0, -0.05)); G.curl_fingers(side, 30.0 + 20.0 * k)
                if laugh: self.head(pitch=30.0 - 44.0 * k, yaw=9.0 if a else -9.0, roll=5.0 if a else -5.0)
                else: self.head(pitch=34.0 - 8.0 * k, yaw=4.0 if a else -4.0, roll=0.0)
            return fn
        if "AlrHeld" in only:
            self.clip("AlrHeld", [(1, level(0, 0.0, False)), (12, level(1, 1.0, False)), (20, level(0, 0.4, False)), (30, level(1, 0.7, False)), (43, level(0, 0.0, False))])
        if "AlrHeldTickled" in only:
            K = [(1, level(0, 0.0, True)), (7, level(1, 1.0, True)), (13, level(0, 0.3, True)), (19, level(1, 0.0, True)), (25, level(0, 1.0, True)), (31, level(1, 0.3, True))]
            self.clip("AlrHeldTickled", K + [(37, K[0][1])])

    # --------------------------------------------------------------------------------------- the toenail chooser
    def key_nails(self, only):
        """NailShow: for the start screen's toenail colour chooser. She lies back propped on her hands and holds her legs
        up before her, together and all but straight, her bare feet side by side with the toes pointed away. The
        chooser's camera is close in front of her toes and above them: it looks down along her legs, the tops of her toes
        (her nails) fill the lower half of the picture, and she looks up at it over her knees. A slow loop: her feet rock
        a little in turn, her toes spread and close once."""
        if "NailShow" not in only: return
        P, G = self.P, self.G
        FAN = (-0.10, 0.0, 0.06, 0.12, 0.18)
        def show(a, k):
            def fn():
                self.root((0.0, 0.0, 0.6), Rx(rad(-68.0)))
                self.spine(pitch=16.0, upper=1.5, roll=1.5 if a else -1.5)
                for i, (side, sg) in enumerate((("R", -1.0), ("L", 1.0))):
                    up = (a == i); th = rad(46.0 + (1.2 if up else 0.0)); sh = rad(-7.0 + (1.6 if up else 0.0))
                    for bn in ("upperleg01.", "upperleg02."): P.aim(bn + side, (-sg * 0.11, -math.cos(th), math.sin(th)))      # knees together
                    for bn in ("lowerleg01.", "lowerleg02."): P.aim(bn + side, (sg * 0.015, -math.cos(sh), math.sin(sh)))       # her feet side by side
                    self.foot(side, 1.13, 0.10 + 0.2 * k, False, FAN if k < 0.5 else None)
                hip_y = P.head("upperleg01.L").y
                self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)
                for side, sg in (("L", 1.0), ("R", -1.0)):                               # propped on her hands: flat on the ground beside her, the elbows bent back
                    sh_ = P.head("upperarm01." + side)
                    self.arm(side, (sh_.x + sg * 0.12, sh_.y + 0.13, 0.066), (sg * 0.55, 1.0, 0.35))
                    P.aim("wrist." + side, (sg * 0.5, 0.86, -0.02)); G.curl_fingers(side, 4.0)
                self.head(pitch=30.0, yaw=3.0 if a else -3.0, roll=4.0 if a else -2.0)
            return fn
        self.clip("NailShow", [(1, show(0, 0.0)), (25, show(1, 0.0)), (49, show(0, 0.0)), (58, show(0, 1.0)), (66, show(0, 0.0)), (73, show(0, 0.0))])

    # ------------------------------------------------------------------------------------------- the pumpkin fiend
    def key_pumpkin(self, only):
        """Caught by the pumpkin fiend (2D sheet anne-pumpkin-fiend-1). The origin is her seat: the game puts it on top of
        the mound of roots that has come up under her (PUMPKIN_SEAT above the ground). She faces -Y, bare-footed.
          PumpkinSeat   the sheet's tease1: leaning back on her hands, knees up, both feet on the ground in front of the
                        mound; the vine has her left ankle, and that foot tugs at it
          PumpkinHeld   lickle1: her legs held out level and together; she laughs, her toes scrunch in turn
          PumpkinHigh   lickle2: tipped far back on her arms, her legs held up high and together"""
        P, G = self.P, self.G
        if not any(n in only for n in ("PumpkinSeat", "PumpkinHeld", "PumpkinHigh")): return
        if "PumpkinSeat" in only:
            f = G.measure_foot(False)
            def seat(tug, look):
                """tug 0..1: the held foot pulls up and back; look -1 at her ankle .. 1 over her shoulder at the pumpkin."""
                def fn():
                    self.root((0.0, 0.0, 0.6), Rx(rad(-37.0 - 3.0 * tug)))
                    self.spine(pitch=10.0 - 2.0 * tug, yaw=-7.0 * max(0.0, look))
                    for side in "LR":                                                    # (thighs out of the way first: what is measured below is her seat)
                        for bn in ("upperleg01.", "upperleg02.", "lowerleg01.", "lowerleg02."): P.aim(bn + side, (0.0, -0.94, 0.34))
                    hip_y = P.head("upperleg01.L").y
                    self.ground(self.solid(False), lambda p: p.y > hip_y - 0.12 and abs(p.x) < 0.2)             # her seat at the origin's height
                    for side, sg in (("L", 1.0), ("R", -1.0)):
                        hip = P.head("upperleg01." + side); up = tug if side == "L" else 0.0
                        ankle = Vector((sg * (0.10 if side == "L" else 0.125), hip.y - (0.33 if side == "L" else 0.47) + 0.05 * up, -PUMPKIN_SEAT + f["az"] + 0.05 * up))      # the held (left) foot nearer, its knee higher
                        self.leg(side, ankle, (sg * (0.10 if side == "L" else 0.22), -0.25, 1.0))
                        yaw = rad(7.0 if side == "L" else -16.0); P.orient("foot." + side, Rz(yaw) @ Rx(0.34 * up))
                        for t in G.toes[side]: P.orient(t, Rz(yaw) @ Rx(0.34 * up - 0.3 * up))
                    for side, sg in (("L", 1.0), ("R", -1.0)):                          # her hands on the mound behind her
                        sh = P.head("upperarm01." + side)
                        self.arm(side, (sh.x + sg * 0.10, sh.y + 0.07, 0.066), (sg * 0.5, 1.0, 0.4), slack=0.985)
                        P.aim("wrist." + side, (sg * 0.35, 0.93, -0.03)); G.curl_fingers(side, 6.0)
                    self.head(pitch=26.0 if look < 0 else 4.0, yaw=8.0 if look < 0 else -52.0 * look, roll=0.0)
                return fn
            self.clip("PumpkinSeat", [(1, seat(0.0, -1.0)), (8, seat(1.0, -1.0)), (14, seat(0.2, -1.0)), (20, seat(1.0, -1.0)), (28, seat(0.0, 1.0)), (44, seat(0.0, 1.0)), (52, seat(0.6, -1.0)), (61, seat(0.0, -1.0))])
        if "PumpkinHeld" in only:
            def held(a, k):
                R = (9.0, 0.34, 0.55) if a else (6.0, -0.2, -0.28); Lg = (6.0, -0.2, -0.28) if a else (9.0, 0.34, 0.55)
                return lambda: self.sitting(33.0 + 3.0 * k, (R[0], Lg[0]), (R[1], Lg[1]), (R[2], Lg[2]), False, sway=0.01 if a else -0.01,
                                            head=(16.0 - 34.0 * k, 8.0 if a else -8.0, 5.0 if a else -5.0), bend=0.10, spread=-0.085)
            self.clip("PumpkinHeld", [(1, held(0, 0.0)), (7, held(1, 1.0)), (13, held(0, 0.3)), (19, held(1, 0.0)), (25, held(0, 1.0)), (31, held(1, 0.3)), (37, held(0, 0.0))])
        if "PumpkinHigh" in only:
            def high(a, k):
                R = (58.0, 0.36, 0.6) if a else (55.0, -0.18, -0.3); Lg = (55.0, -0.18, -0.3) if a else (58.0, 0.36, 0.6)
                return lambda: self.sitting(48.0 + 3.0 * k, (R[0], Lg[0]), (R[1], Lg[1]), (R[2], Lg[2]), False, sway=0.01 if a else -0.01, spine=16.0,
                                            head=(20.0 - 40.0 * k, 9.0 if a else -9.0, 5.0 if a else -5.0), bend=0.10, spread=-0.085, hands=0.36)
            self.clip("PumpkinHigh", [(1, high(0, 0.0)), (7, high(1, 1.0)), (13, high(0, 0.3)), (19, high(1, 0.0)), (25, high(0, 1.0)), (31, high(1, 0.3)), (37, high(0, 0.0))])

    # ------------------------------------------------------------------------------------------------- the thief
    def key_thief(self, only):
        """Not Anne's: the stance of the thief of the hole trap (the game dresses a second copy of this figure as her).
        As on the 2D sheet (aurelia-tickler-1): her weight on her right leg, her right hand on that hip, her head turned
        to her left, where her other hand works. Her left arm hangs easy: the game aims it (and her fingers) itself."""
        if "ThiefIdle" not in only: return
        G, P = self.G, self.P
        f = G.measure_foot(True)

        def pose(s, c):
            def fn():
                roll = 5.2 + 0.6 * s
                self.stand(f, x=-0.02 + 0.005 * s, roll=roll, yaw=-5.0, knee=4.0)
                for k, bn in enumerate(G.spine): P.turn(bn, Rz(rad(5.0 + 1.5 * s) / 5) @ Ry(rad(-roll * 1.05) / 5) @ Rx(rad(0.7 * c) * (0.3 if k < 3 else -0.5)))
                for bn in G.neck: P.turn(bn, Ry(rad(roll * 0.6 - 2.0) / 4) @ Rz(rad(9.0 + 2.5 * s) / 4) @ Rx(rad(-3.0) / 4))
                hip = P.head("upperleg01.R")                           # the heel of her right hand on her hip (the one she stands on), elbow out and back
                self.arm("R", hip + Vector(THIEF_HIP), (-1.0, 0.75, 0.15))
                P.aim("wrist.R", THIEF_HAND); G.curl_fingers("R", 18.0)
                self.hang("L", sw=10.0 + 2.0 * s, el=26.0, out=0.2)
            return fn
        self.clip("ThiefIdle", [(1, pose(0.0, 0.0)), (16, pose(1.0, 1.0)), (31, pose(0.0, 0.3)), (46, pose(-1.0, -1.0)), (61, pose(0.0, 0.0))])


    # ---------------------------------------------------------------------------------------------- the feather (10-03)
    def key_feather(self, only):
        """The 2D's feather by the fire (CE170 SceneAnne, sheet anne-solo-play-12, clothed): she sits on the ground leaning
        back a little, her left leg out, her right knee drawn up and out so that foot is held up in front of her chest
        with its sole turned to her. Her left hand steadies that ankle; her right holds the feather (the game draws it
        from that hand to her sole). FeatherSit: holding it ready (she chuckles); FeatherTickle: the stroke, her toes
        curling and flaring (she giggles); FeatherTickleHard: faster, and she squirms and laughs."""
        P = self.P
        if not any(n in only for n in ("FeatherSit", "FeatherTickle", "FeatherTickleHard")): return
        def sole_to_her(side, toes, facing, curl):
            """The foot turned so its toes point along `toes` and its sole faces `facing` (armature space), toes curled by `curl`."""
            t = Vector(toes).normalized(); n = Vector(facing); n = (n - t * t.dot(n)).normalized(); x = t.cross(n)
            R = Matrix((x, t, n)).transposed() @ Matrix(((1.0, 0.0, 0.0), (0.0, -1.0, 0.0), (0.0, 0.0, -1.0))).transposed()      # rest: toes -Y, sole facing -Z
            P.orient("foot." + side, R)
            for tn in self.G.toes[side]:
                P.orient(tn, R); P.turn(tn, Matrix.Rotation(curl, 3, x))
        def pose(stroke=0.0, sq=0.0, curl=0.0, lean=14.0, head=(0.0, 0.0, 0.0)):
            def fn():
                self.root((0.012 * sq, 0.0, 0.6), Rx(rad(-lean)))
                self.spine(pitch=12.0 + 5.0 * abs(sq), roll=5.0 * sq, yaw=-10.0)
                self.ground([self.suit] if self.suit else [self.body])
                hl = P.head("upperleg01.L")                                      # the left leg out in front, the knee soft, the heel on the ground
                self.leg("L", (hl.x + 0.07, hl.y - 0.70, 0.088), (0.2, -0.2, 1.0)); self.unfoot("L"); self.foot("L", 0.45, 0.12)
                hr = P.head("upperleg01.R")                                      # the right foot up before her face, the knee out to her right
                self.leg("R", (hr.x - 0.07, hr.y - FE_FWD, FE_UP + 0.015 * sq), (-1.0, -0.3, -0.15))
                sole_to_her("R", (0.2, -0.15, 1.0), (0.25, 1.0, 0.3), curl)     # toes up, the sole turned to her face
                ar = P.head("foot.R")
                self.arm("L", (ar.x + 0.06, ar.y + 0.03, ar.z - 0.03), (1.0, -0.2, -0.6), slack=0.985); P.aim("wrist.L", (-0.75, -0.45, 0.2)); self.G.curl_fingers("L", 34.0)
                self.arm("R", (ar.x + 0.06, ar.y + 0.21, ar.z - 0.01 + 0.08 * stroke), (-1.0, 0.25, -0.7), slack=0.985); P.aim("wrist.R", (0.0, -0.85, 0.5)); self.G.curl_fingers("R", 42.0)
                self.head(pitch=8.0 + head[0], yaw=-20.0 + head[1], roll=head[2])
            return fn
        if "FeatherSit" in only: self.clip("FeatherSit", [(1, pose(0.3, 0.0, 0.0)), (30, pose(0.45, 0.2, 0.08, head=(-3.0, 4.0, 3.0))), (60, pose(0.3, 0.0, 0.0))])
        if "FeatherTickle" in only:                                              # one stroke up the sole and back down: toes curl, then flare
            self.clip("FeatherTickle", [(1, pose(0.0, -0.4, 0.45, head=(0.0, -4.0, -4.0))), (7, pose(1.0, 0.4, -0.35, head=(-8.0, 6.0, 6.0))), (13, pose(0.0, -0.4, 0.45, head=(0.0, -4.0, -4.0)))])
        if "FeatherTickleHard" in only:                                          # faster, and she rocks back laughing
            self.clip("FeatherTickleHard", [(1, pose(0.0, -1.0, 0.6, lean=18.0, head=(-12.0, -8.0, -7.0))), (5, pose(1.0, 1.0, -0.45, lean=22.0, head=(-20.0, 9.0, 8.0))), (9, pose(0.0, -1.0, 0.6, lean=18.0, head=(-12.0, -8.0, -7.0)))])


PUMPKIN_SEAT = 0.30                        # the mound of roots she is sat on: its top above the ground (traps.js builds it so)
FE_FWD, FE_UP, FE_FLEX = 0.43, 0.5, -0.25        # (10-03) the feather pose: how far in front of her right hip and how high that ankle is held, and its flex
THIEF_HIP = (-0.105, 0.012, 0.085)         # her right wrist from her right hip joint (armature space, metres)
THIEF_HAND = (0.45, -0.62, -0.64)          # the way that hand points

ALL = ("CampSleep", "CampSit", "CampWake", "CampLie", "Startle", "Point", "Cast", "VineHeld", "VineHeldShod", "SitFlat", "HeldBack", "HeldProne", "LaughFit",
       "StuckFlat", "StuckFlatTickled", "StuckFlatStrain",
       "HoleIdle", "HoleKick", "HoleTease", "HoleTickled", "HoleBound", "HoleKickout", "ThiefIdle",
       "PumpkinSeat", "PumpkinHeld", "PumpkinHigh",
       "IvyLegUp", "IvyLegUpTickled", "IvyWorship", "MycHeld", "MycHeldOut", "AlrHeld", "AlrHeldTickled", "NailShow",
       "Hogtie", "HogtieTickled", "KneelSit", "ChairBound", "ChairBare", "ChairTickled", "FeatherSit", "FeatherTickle", "FeatherTickleHard")
HATLESS = ("CampSleep", "CampSit", "CampWake", "CampLie", "HeldBack", "AlrHeld", "AlrHeldTickled", "Hogtie", "HogtieTickled")          # the game hides her hat in these (it would lie in the ground)


def build(rig, body, shoes, suit, TH, new_action, log=print, only=None):
    S = Poser(rig, body, shoes, suit, TH, new_action, log)
    todo = tuple(only) if only else ALL
    S.key_gestures(todo); S.key_camp(todo); S.key_sitting(todo); S.key_held(todo); S.key_log(todo); S.key_hole(todo); S.key_thief(todo); S.key_pumpkin(todo); S.key_ivy(todo); S.key_myc(todo); S.key_alr(todo); S.key_nails(todo); S.key_feather(todo)
    S.P.reset()
    return S
