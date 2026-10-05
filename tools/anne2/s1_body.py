"""Anne v2, stage 1: stylised body, face, eyes and painted skin (see ANNE2_SPEC.md).

One headless run rebuilds everything from nothing:

    /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/anne2/s1_body.py
        -> build/anne2_s1.blend, build/anne2_s1.json, build/renders/s1_*.png, tex/anne2_eye.png

Options after '--' (for tuning; the defaults make the shipped result):
    --views face,eyes,body,feet,preview,compare   which check renders to make (default: all; 'none' = no renders)
    --out DIR                              write renders (and the eye texture) to DIR instead of the project
    --tag T                                file prefix (default s1) -> DIR/T_face_front.png ...
    --nosave                               do not write the .blend / .json
    --set NAME=VALUE ...                   override a tunable in P (python literal), e.g. --set EYE_SCALE=1.5
                                           T:<category/target>=w sets a target weight, M:<key>=v a macro value

Method: MakeHuman base mesh + macro + detail targets (weights may exceed 1), baked; then direct deformation of
the baked basis with smooth fields (the helper geometry and joint cubes move with the skin, so the rig and the fitted
eyes/teeth follow): eyelid slide over the eyeball, eye-region scale, face simplification, head scale, leg stretch,
foot scale; then rig, eyes, teeth, painted skin (colour attribute Col), region groups and check renders.
"""
import bpy, os, sys, math, json, ast
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

# =====================================================================================================================
#                                                    TUNABLES
# =====================================================================================================================
MACRO = {'gender': 0.0, 'age': 0.5, 'muscle': 0.35, 'weight': 0.46,      # (weight was 0.38: "a little too skinny")
          'proportions': 1.0, 'height': 0.5,
         'cupsize': 0.72, 'firmness': 0.75, 'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}}      # (10-02: was asian 0.35 / caucasian 0.65: "look more white, less Asian, closer to the character design")

# MakeHuman detail targets: (category/name, weight). "l-"/"r-" pairs are written once with "?-" and expanded.
TARGETS = [
    # --- head and face shape
    ("head/head-round", 0.0),
    ("head/head-oval", 0.5),                        # (10-02: 0.35 -> 0.5, a narrower oval as in her portraits)
    ("head/head-invertedtriangular", 0.45),         # (0.5 made the lower face a hard wedge: "her jawbone is way too sharp"; 10-03: 0.3 -> 0.45 with the padding off: "too puffy")
    ("head/head-age-decr", 0.1),
    ("head/head-fat-incr", 0.0),                    # (10-03: 0.15 -> 0: the padding along the jaw read as puffy cheeks; jaw width 0.81 -> 0.72 of the face)
    ("forehead/forehead-scale-vert-decr", 0.4),
    ("cheek/?-cheek-volume-incr", 0.0),             # (10-02: 0.3 -> 0.05, less round; 10-03: off)
    ("cheek/?-cheek-volume-decr", 0.35),            # (10-03: slimmer, softer cheeks: "more feminine and soft")
    ("cheek/?-cheek-bones-incr", 0.35),             # (10-02: 0.15 -> 0.35, higher cheekbones)
    ("chin/chin-width-decr", 0.95),                 # (10-03: 0.75 -> 0.95)
    ("chin/chin-height-decr", 0.12),                # (10-03: a little shorter; more than ~0.15 rounds the lower face again)
    ("chin/chin-bones-decr", 0.6),
    ("chin/chin-triangle", 0.3),                    # (0.6 drew the chin out into a point)
    ("chin/chin-prominent-incr", 0.1),              # the chin level with the lower lip, not in front of it
    # --- nose: small, short, soft, turned up
    ("nose/nose-scale-horiz-decr", 0.7),            # (10-03: 0.5 -> 0.7, with the four below: a narrower, finer nose)
    ("nose/nose-volume-decr", 0.4),
    ("nose/nose-point-width-decr", 0.45),
    ("nose/nose-scale-vert-decr", 0.35),
    ("nose/nose-trans-down", 0.35),
    ("nose/nose-point-up", 0.0),
    ("nose/nose-point-down", 0.2),
    ("nose/nose-base-down", 0.7),
    ("nose/nose-septumangle-decr", 0.4),
    ("nose/nose-nostrils-angle-down", 0.3),
    ("nose/nose-curve-concave", 0.25),              # (10-02: 0.55 -> 0.25; with the four below: a straight nose with a bridge, as drawn)
    ("nose/nose-scale-depth-decr", 0.0),
    ("nose/nose-trans-backward", 0.0),
    ("nose/nose-nostrils-width-decr", 1.0),
    ("nose/nose-hump-decr", 0.5),
    ("nose/nose-flaring-decr", 1.0),
    ("nose/nose-greek-decr", 0.0),
    # --- mouth: small, full
    ("mouth/mouth-lowerlip-volume-incr", 0.15),
    ("mouth/mouth-scale-depth-decr", 0.6),
    ("mouth/mouth-angles-up", 0.6),
    ("mouth/mouth-trans-up", 0.15),
    ("mouth/mouth-trans-backward", 0.8),
    # --- eyes: bags off (size, shape and position are done by the custom eye operators below)
    ("eyes/?-eye-bag-decr", 1.0),
    # --- ears
    ("ears/?-ear-scale-decr", 0.5),
    # --- neck
    ("neck/neck-scale-horiz-decr", 0.4),
    ("neck/neck-scale-depth-decr", 0.4),
    # --- body
    ("breast/breast-point-decr", 1.0),
    ("breast/nipple-point-decr", 1.0),
    ("breast/nipple-size-decr", 1.0),
    ("torso/measure-waist-circ-decr", 0.85),
    ("torso/measure-shoulder-dist-decr", 0.5),
    ("torso/measure-hips-circ-incr", 0.35),
    ("torso/measure-bust-circ-incr", 0.3),
    ("torso/measure-underbust-circ-decr", 0.5),
    ("torso/torso-vshape-decr", 0.4),
    ("arms/?-upperarm-fat-decr", 0.28),
    ("arms/?-lowerarm-fat-decr", 0.4),
    ("arms/?-upperarm-muscle-decr", 0.5),
    ("arms/?-lowerarm-muscle-decr", 0.5),
    ("legs/?-lowerleg-muscle-decr", 0.3),
    ("legs/?-upperleg-muscle-decr", 0.18),
    ("legs/?-upperleg-fat-incr", 0.5),             # fuller thighs: they meet below the groin (10-02: "her legs are too wide apart from the groin down")
    ("feet/?-foot-scale-horiz-decr", 0.4),
    ("feet/measure-ankle-circ-decr", 0.32),            # (10-02: her ankles were a little too thin: 0.7 -> 0.32)
]

P = dict(
    # ---- proportions (solved at build time)
    LEGS_IN=0.012,                                  # her legs (and hip joints) are moved this far towards the middle, each
    HEIGHT=1.70,              # metres
    HEAD_RATIO=1 / 7.2,       # (chin to crown) / height
    CROTCH_RATIO=0.51,        # crotch height / height
    FOOT_RATIO=0.126,         # foot length / height
    FOOT_WIDE=0.50, FOOT_HIGH=0.35,   # how much of the solved foot lengthening also goes into width / height
    TOE_LEN=(0.76, 0.59, 0.59, 0.61, 0.65),   # toe length factors, big toe first
    TOE_FAT=(1.03, 1.08, 1.08, 1.08, 1.08),   # toe width factors
    TOE_THICK=(1.05, 1.14, 1.14, 1.14, 1.12), # toe thickness (vertical) factors
    HEAD_XYZ=(0.91, 1.0, 1.0),  # head widening / depth / height (eye regions stay round), before the uniform head scale (10-02: 0.94 -> 0.91)
    # ---- eyes (angles in degrees, lengths in eyeball radii of the unscaled MakeHuman eye)
    IRIS_FRAC=0.52,           # iris diameter / eye width (corner to corner)
    PUPIL_FRAC=0.46,          # pupil radius / iris radius
    LID_COVER=0.30,           # share of the iris height hidden by the upper lid at rest
    LID_LOW_GAP=-0.08,         # lower lid position below the iris bottom, in iris radii (0 = just touching)
    LID_OUT_UP=9.0,           # outer corner raised by (degrees of elevation)
    LID_IN_UP=-1.5,           # inner corner raised by
    LID_REACH_UP=42.0,        # how far above the lid edge the skin follows the upper lid (degrees)
    LID_REACH_LOW=36.0,
    EYE_SCALE=1.34,           # eye-region scale (lids and eyeball together), about the front pole of the eyeball (10-02: 1.42 -> 1.34)
    EYE_T0=(0.95, 0.62),      # seen from the front: the ellipse (half width, half height, in eyeball radii) that grows rigidly
    EYE_T1=(1.95, 3.2, 1.7, 2.0),   # how far the skin gives way: towards the nose, the temple, the brow, the cheek
    EYE_BLEND=0.45,           # width of the zone where the lid ellipse blends into the sliding skin (ellipse radii)
    EYE_DEPTH_SCALE=1.42,      # depth scale of the lids (less than EYE_SCALE = a flatter eye on a bigger eyeball)
    EYE_R2_K=1.0,             # fine tuning of the eyeball radius that follows from the two scales
    LID_THICK=0.4,            # how far the lid edge stands off the eyeball, relative to MakeHuman
    LID_RIM=0.5,              # width of the flat lid rim, relative to MakeHuman
    EYE_DEPTH0=2.2, EYE_DEPTH1=4.5,   # fade of the whole operator towards the back of the head (radii behind the pole)
    EYE_BROW_FLAT=0.3,         # how much of the brow / cheek overhang in front of the eye is pressed back (0..1) (10-02: 0.85 -> 0.3: deeper-set eyes)
    EYE_OUT=0.0055,           # eye moved outwards / down / back, metres (in MakeHuman head size, before head scale)
    EYE_DOWN=0.0020,
    EYE_BACK=0.003,           # (10-02: 0.001 -> 0.003)
    EYE_BALL_K=0.985,         # final eyeball radius / scaled helper radius
    EYE_CONVERGE_DEG=2.0,     # each eye turned inwards
    EYE_CAP_DEG=75.0,         # the eye mesh is a cap of the eyeball sphere up to this angle from its axis
    # ---- face simplification (Laplacian smoothing strength per region, 0 = off)
    SMOOTH_FACE=0.6, SMOOTH_FACE_IT=40, SMOOTH_BODY=0.3,
    ARMHOLE_TOP_IN=0.040, ARMHOLE_PIT_IN=0.034, ARMHOLE_PIT_DOWN=0.080,   # sleeveless armhole plane, metres from the shoulder joint
    CHOKER_T=(0.30, 0.66),    # choker band along the neck (0 = neck base, 1 = skull base)
    NECKLINE_T=0.20,          # suit neckline, same scale
    HEM_BELOW_CROTCH=0.065,   # leg hem of the suit below the crotch (metres at MakeHuman size)
    LIP_OVERLAP=0.0003,       # how far the closed lips overlap after one subdivision (metres, MakeHuman head size)
    LIP_THIN=(0.50, 0.68),    # vertical scale of the upper / lower lip about the mouth line (1 = MakeHuman lips)
    LIP_WIDE=0.93,            # horizontal scale of the mouth
    # ---- skin colours (sRGB hex)
    SKIN="#fde9e3", BLUSH="#f0a6a0", LIP="#d95a82", SOCKET="#eab4a8",      # (10-02: paler, pinker porcelain skin; was #fce3d8 / #f0a08f / #e7b097)
    LASH="#2e1812", NAIL="#5a2d91",
    SUIT="#f2a516", GLOVE="#5a2d91", MOUTH_IN="#5a1a26",
)

# =====================================================================================================================
#                                    fixed facts about the MakeHuman hm08 base mesh
# =====================================================================================================================
BODY_N = 13380                       # vertices 0..13379 are the body, the rest helpers and joint cubes
HELP_EYE_L = np.arange(14598, 14670)   # eyeball helper sphere (the eye asset is fitted to it)
HELP_EYE_R = np.arange(14670, 14742)
# left eyelid margin loop, starting at the top centre and running outwards (her left, +X), round the outer corner,
# along the lower lid to the inner corner and back up
EYE_LOOP_L = [6785, 6784, 6790, 6793, 6796, 6799, 6802, 6805, 6808, 6811, 11693, 6814, 6817, 6820, 6825, 6828, 6831,
              6834, 11695, 6837, 6856, 6853, 6850, 6847, 6886, 6844, 6841, 6838]
LOOP_OUTER, LOOP_INNER, LOOP_TOP, LOOP_BOTTOM = 7, 21, 0, 15       # positions in EYE_LOOP_L
LM = dict(crown=881, nasion=136, nose_tip=5054, subnasale=5072, lip_top=362, lip_up=455, stomion=520, lip_low=495,
          lip_bottom=5337, chin=5162, menton=732, neck_front=803, nape=934, crotch=4372, mouth_corner_l=7302,
          forehead=5320, glabella=227)
ORAL_SEED = 656                      # a vertex inside the mouth cavity
# the eye texture keeps the island centres of the MakeHuman eye layout (her left eye, her right eye)
EYE_UV_C = {1: (0.2910, 0.3196), -1: (0.7078, 0.7208)}
EYE_UV_R = 0.262                     # island radius
EYE_UV_FRONT = (40.0, 0.62)          # the front cap (up to 40 degrees) takes 62 percent of the island radius
EYE_UV_MAX = 125.0


# =====================================================================================================================
#                                                    helpers
# =====================================================================================================================
def parse_args():
    a = C.argv()
    o = dict(views="face,eyes,body,feet,preview,compare", out=None, tag="s1", nosave=False)
    i = 0
    while i < len(a):
        if a[i] == "--views": o["views"] = a[i + 1]; i += 2
        elif a[i] == "--out": o["out"] = a[i + 1]; i += 2
        elif a[i] == "--tag": o["tag"] = a[i + 1]; i += 2
        elif a[i] == "--nosave": o["nosave"] = True; i += 1
        elif a[i] == "--set":
            i += 1
            while i < len(a) and not a[i].startswith("--"):
                k, v = a[i].split("=", 1)
                try: v = ast.literal_eval(v)
                except Exception: pass
                if k.startswith("T:"):
                    name = k[2:]
                    hit = [j for j, (n, _) in enumerate(TARGETS) if n == name]
                    if hit: TARGETS[hit[0]] = (name, v)
                    else: TARGETS.append((name, v))
                elif k.startswith("M:"): MACRO[k[2:]] = v
                else:
                    assert k in P, "unknown tunable " + k
                    P[k] = v
                i += 1
        else:
            raise SystemExit("unknown argument " + a[i])
    return o


def log(*a):
    print("S1 |", *a)
    sys.stdout.flush()


class Mesh:
    """Topology tables of the base mesh that the deformation and paint operators need."""

    def __init__(self, body, SYS):
        me = body.data
        self.n = len(me.vertices)
        polys = np.empty(len(me.polygons) * 4, dtype=np.int32)
        me.polygons.foreach_get("vertices", polys)
        self.polys = polys.reshape(-1, 4)
        e = np.empty(len(me.edges) * 2, dtype=np.int32)
        me.edges.foreach_get("vertices", e)
        self.edges = e.reshape(-1, 2)
        self.deg = np.bincount(self.edges.ravel(), minlength=self.n).astype(float)
        self.nbr = [[] for _ in range(self.n)]
        for a, b in self.edges:
            self.nbr[a].append(int(b)); self.nbr[b].append(int(a))
        self.mirror = np.arange(self.n)
        with open(os.path.join(SYS, "mesh_metadata", "hm08.mirror")) as f:
            for line in f:
                a, b, _ = line.split()
                self.mirror[int(a)] = int(b)
        self.body = np.arange(self.n) < BODY_N
        self.groups = {}
        self._obj = body
        self.vfaces = [[] for _ in range(self.n)]
        for fi, vs in enumerate(self.polys):
            for v in vs:
                self.vfaces[v].append(fi)

    def edge_loop(self, a, b, maxn=400):
        """Walk the edge loop that starts with the edge a -> b (straight on through every 4-valent vertex).
        Returns (vertices, closed)."""
        def share(u, v):
            return {f for f in self.vfaces[u] if v in self.polys[f]}
        loop = [a, b]
        while len(loop) < maxn:
            u, v = loop[-2], loop[-1]
            fs = share(u, v)
            cand = [w for w in self.nbr[v] if w != u and not (share(v, w) & fs)]
            if len(cand) != 1:
                return loop, False
            if cand[0] == loop[0]:
                return loop, True
            loop.append(cand[0])
        return loop, False

    def ring_loops(self, co, zone, axis_p, axis_d):
        """All closed edge loops inside zone that go round the axis (point axis_p, unit direction axis_d).
        Returns a list of (mean position along the axis, vertex array)."""
        found = {}
        for a in np.nonzero(zone)[0]:
            for b in self.nbr[a]:
                if not zone[b] or b < a:
                    continue
                lp, closed = self.edge_loop(int(a), int(b), 160)
                if not closed or len(lp) < 8 or not zone[lp].all():
                    continue
                key = tuple(sorted(lp))
                if key in found:
                    continue
                pts = co[lp] - axis_p
                rad = pts - np.outer(pts @ axis_d, axis_d)
                ang = np.unwrap(np.arctan2(rad @ self._perp(axis_d)[1], rad @ self._perp(axis_d)[0]))
                turns = abs(ang[-1] - ang[0] + (ang[1] - ang[0]))            # ~ 2 pi if the loop goes round the axis
                if turns > 5.0 and np.ptp(pts @ axis_d) < 0.5 * np.linalg.norm(rad, axis=1).mean() * 2 + 0.04:
                    found[key] = (float((pts @ axis_d).mean()), np.array(lp))
        return sorted(found.values(), key=lambda x: x[0])

    @staticmethod
    def _perp(d):
        a = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 else np.array([0, 1.0, 0])
        u = np.cross(d, a); u /= np.linalg.norm(u)
        return u, np.cross(d, u)

    def group(self, name):
        if name not in self.groups:
            self.groups[name] = C.vg_mask(self._obj, name, 0.5)
        return self.groups[name]

    def neighbours_avg(self, a):
        s = np.zeros_like(a)
        np.add.at(s, self.edges[:, 0], a[self.edges[:, 1]])
        np.add.at(s, self.edges[:, 1], a[self.edges[:, 0]])
        d = np.maximum(self.deg, 1)
        return s / (d[:, None] if a.ndim == 2 else d)

    def smooth(self, co, mask, iterations=10, lam=0.5, keep_volume=False):
        """Laplacian smoothing weighted by a per-vertex mask (0..1). keep_volume: Taubin (no shrinking)."""
        co = co.copy()
        m = (mask * self.body)[:, None]
        for _ in range(iterations):
            co += m * lam * (self.neighbours_avg(co) - co)
            if keep_volume:
                co -= m * (lam + 0.03) * (self.neighbours_avg(co) - co)
        return co

    def blur(self, f, iterations=1, only=None):
        """Smooth a per-vertex scalar field over the mesh."""
        f = f.astype(float).copy()
        for _ in range(iterations):
            g = 0.5 * f + 0.5 * self.neighbours_avg(f)
            f = g if only is None else np.where(only, g, f)
        return f

    def grow(self, mask, steps=1):
        m = mask.copy()
        for _ in range(steps):
            n = m.copy()
            n[self.edges[:, 0]] |= m[self.edges[:, 1]]
            n[self.edges[:, 1]] |= m[self.edges[:, 0]]
            m = n
        return m

    def depth_from(self, seeds, within, maxd=12):
        """Breadth-first edge distance from the seed vertices, walking only through 'within'; -1 = not reached."""
        d = np.full(self.n, -1)
        front = [int(i) for i in np.nonzero(seeds)[0]]
        for i in front: d[i] = 0
        k = 0
        while front and k < maxd:
            k += 1; nf = []
            for u in front:
                for v in self.nbr[u]:
                    if d[v] < 0 and within[v]:
                        d[v] = k; nf.append(v)
            front = nf
        return d

    def component(self, seed, allowed):
        seen = {seed}; st = [seed]
        while st:
            u = st.pop()
            for v in self.nbr[u]:
                if allowed[v] and v not in seen:
                    seen.add(v); st.append(v)
        m = np.zeros(self.n, bool); m[list(seen)] = True
        return m

    def symmetrise(self, co):
        f = co[self.mirror] * np.array([-1.0, 1.0, 1.0])
        out = 0.5 * (co + f)
        mid = self.mirror == np.arange(self.n)
        out[mid, 0] = 0.0
        return out

    def normals(self, co):
        """Area-weighted vertex normals for the given positions."""
        p = co[self.polys]
        fn = np.cross(p[:, 2] - p[:, 0], p[:, 3] - p[:, 1])
        vn = np.zeros_like(co)
        for k in range(4):
            np.add.at(vn, self.polys[:, k], fn)
        return vn / np.maximum(np.linalg.norm(vn, axis=1), 1e-12)[:, None]

    def lid_rings(self, co, side, depth=6):
        """(skin, pocket): ring index of each vertex counted from the eyelid margin loop outwards over the skin
        (0 = the loop itself) and inwards into the eye pocket; -1 elsewhere."""
        loop = np.array(EYE_LOOP_L) if side > 0 else self.mirror[EYE_LOOP_L]
        ce, R = eye_frame(co, side)
        rho = np.hypot(co[:, 0] - ce[0], co[:, 2] - ce[2])
        skin = np.full(self.n, -1); pocket = np.full(self.n, -1)
        skin[loop] = 0; pocket[loop] = 0
        fs, fp = [], []
        for u in loop:
            for v in self.nbr[u]:
                if v < BODY_N and skin[v] < 0 and pocket[v] < 0:
                    if rho[v] > rho[u]: skin[v] = 1; fs.append(v)
                    else: pocket[v] = 1; fp.append(v)
        for arr, front in ((skin, fs), (pocket, fp)):
            other = pocket if arr is skin else skin
            for k in range(2, depth + 1):
                nf = []
                for u in front:
                    for v in self.nbr[u]:
                        if v < BODY_N and arr[v] < 0 and other[v] < 0:
                            arr[v] = k; nf.append(v)
                front = nf
        return skin, pocket


def falloff(d, r0, r1):
    """1 inside r0, 0 beyond r1, smooth in between."""
    return 1.0 - C.smoothstep(d, r0, r1)


# =====================================================================================================================
#                                           deformation operators
# =====================================================================================================================
def eye_frame(co, side):
    """Centre and radius of the eyeball helper of one side (side = +1 her left, -1 her right)."""
    h = co[HELP_EYE_L if side > 0 else HELP_EYE_R]
    c = h.mean(0)
    return c, float(np.linalg.norm(h - c, axis=1).mean())


def lid_slide(M, co, side):
    """Slide the eyelids over the eyeball (keeping each vertex at its own distance from the eye centre) so that at rest
    the lower lid touches the bottom of the iris and the upper lid hides LID_COVER of its height."""
    S = np.array([side, 1.0, 1.0])
    X = co * S                                              # work in a frame where this eye is on +X
    loop = np.array(EYE_LOOP_L) if side > 0 else M.mirror[EYE_LOOP_L]
    ce, R = eye_frame(co, side); ce = ce * S
    v = X - ce
    d = np.linalg.norm(v, axis=1) + 1e-12
    az = np.arctan2(v[:, 0], -v[:, 1])                      # 0 = straight ahead, + = outwards
    el = np.arcsin(np.clip(v[:, 2] / d, -1, 1))
    n = len(loop)
    up_idx = [(LOOP_INNER + k) % n for k in range((LOOP_OUTER - LOOP_INNER) % n + 1)]    # inner -> top -> outer
    lo_idx = [(LOOP_INNER - k) % n for k in range((LOOP_INNER - LOOP_OUTER) % n + 1)]    # inner -> bottom -> outer
    def curve(idx):
        a, e, dd = az[loop[idx]], el[loop[idx]], d[loop[idx]]
        o = np.argsort(a)
        return a[o], e[o], dd[o]
    ua, ue, ud = curve(up_idx)
    la, le, ld = curve(lo_idx)
    a_in, a_out = az[loop[LOOP_INNER]], az[loop[LOOP_OUTER]]
    e_in, e_out = el[loop[LOOP_INNER]], el[loop[LOOP_OUTER]]
    d_in, d_out = math.radians(P["LID_IN_UP"]), math.radians(P["LID_OUT_UP"])
    t_of = lambda a: np.clip((a - a_in) / (a_out - a_in), 0, 1)
    chord0 = lambda a: e_in + (e_out - e_in) * t_of(a)                         # corner-to-corner line now
    chord1 = lambda a: (e_in + d_in) + (e_out + d_out - e_in - d_in) * t_of(a)   # and wanted
    # wanted lid heights at the pupil meridian (azimuth 0), as z / R
    eye_w = X[loop][:, 0].max() - X[loop][:, 0].min()
    sin_iris = min(0.95, P["IRIS_FRAC"] * eye_w / (2.0 * R * P["EYE_BALL_K"]))
    P["IRIS_DEG"] = math.degrees(math.asin(sin_iris))            # used by the texture painter
    s_iris = sin_iris * P["EYE_BALL_K"]
    z_up = s_iris * (1 - 2 * P["LID_COVER"])
    z_lo = -s_iris * (1 + P["LID_LOW_GAP"])
    eu0 = np.interp(0.0, ua, ue); el0 = np.interp(0.0, la, le)
    du0 = np.interp(0.0, ua, ud) / R; dl0 = np.interp(0.0, la, ld) / R
    eu1 = math.asin(z_up / du0); el1 = math.asin(z_lo / dl0)
    ku = (eu1 - chord1(0.0)) / (eu0 - chord0(0.0))
    kl = (el1 - chord1(0.0)) / (el0 - chord0(0.0))
    up0 = lambda a: np.interp(a, ua, ue)
    lo0 = lambda a: np.interp(a, la, le)
    up1 = lambda a: chord1(a) + ku * (up0(a) - chord0(a))
    lo1 = lambda a: chord1(a) + kl * (lo0(a) - chord0(a))
    def corner_fade(a):
        return np.where(a < a_in, falloff(a_in - a, 0.0, math.radians(40)), np.where(a > a_out, falloff(a - a_out, 0.0, math.radians(40)), 1.0))
    ac = np.clip(az, a_in, a_out)
    dU = (up1(ac) - up0(ac)) * corner_fade(az)
    dL = (lo1(ac) - lo0(ac)) * corner_fade(az)
    u0, l0 = up0(ac), lo0(ac)
    t = np.clip((el - l0) / np.maximum(u0 - l0, 1e-6), 0, 1)
    shift = dL + (dU - dL) * t                                                  # inside the opening / the pocket
    above = el > u0
    below = el < l0
    shift = np.where(above, dU * falloff(el - u0, 0.0, math.radians(P["LID_REACH_UP"])), shift)
    shift = np.where(below, dL * falloff(l0 - el, 0.0, math.radians(P["LID_REACH_LOW"])), shift)
    shift *= falloff(d, 1.6 * R, 2.6 * R)                                       # only near the eye
    shift *= (v[:, 1] < 0.6 * R)                                                # not behind the eyeball
    fixed = np.zeros(M.n, bool)
    fixed[HELP_EYE_L] = True; fixed[HELP_EYE_R] = True
    fixed |= M.group("JointCubes")
    shift[fixed] = 0.0
    e2 = el + shift
    rho = d * np.cos(e2)
    out = np.stack([ce[0] + rho * np.sin(az), ce[1] - rho * np.cos(az), ce[2] + d * np.sin(e2)], axis=1)
    moved = np.abs(shift) > 1e-9
    res = X.copy(); res[moved] = out[moved]
    info = dict(up_deg=math.degrees(eu1), low_deg=math.degrees(el1), ku=ku, kl=kl, up0_deg=math.degrees(eu0), low0_deg=math.degrees(el0))
    return res * S, info


def radial_map(rho, r0, r1, s):
    """Monotone radial map for enlarging a disc: rho -> s * rho inside r0, identity beyond r1, and in between a
    monotone cubic that squeezes the ring [r0, r1] into [s * r0, r1] (needs s * r0 < r1). r0, r1 may be arrays."""
    r0 = np.broadcast_to(np.asarray(r0, float), rho.shape); r1 = np.broadcast_to(np.asarray(r1, float), rho.shape)
    assert np.all(s * r0 < r1), "eye scale leaves no room: raise EYE_T1"
    L = r1 - r0
    delta = (r1 - s * r0) / L
    m0, m1 = np.minimum(s, 3.0 * delta), np.minimum(1.0, 3.0 * delta)
    t = np.clip((rho - r0) / L, 0.0, 1.0)
    h00 = 2 * t ** 3 - 3 * t ** 2 + 1; h10 = t ** 3 - 2 * t ** 2 + t
    h01 = -2 * t ** 3 + 3 * t ** 2; h11 = t ** 3 - t ** 2
    mid = h00 * s * r0 + h10 * L * m0 + h01 * r1 + h11 * L * m1
    return np.where(rho <= r0, s * rho, np.where(rho >= r1, rho, mid))


def eye_region_scale(M, co):
    """Enlarge the eyes. Seen from the front, an ellipse round each eye axis (EYE_T0: the lids, pocket, eyeball
    helper, eye joints) grows rigidly about the FRONT POLE of the eyeball: EYE_SCALE sideways and vertically,
    EYE_DEPTH_SCALE in depth. The skin out to EYE_T1 (different towards the nose, the temple, the brow and the
    cheek) makes room by sliding ALONG THE ORIGINAL FACE SURFACE, so the brow ridge, the nose and the cheeks keep
    their place and their relief instead of being pushed away or squeezed into ridges.
    Returns (co, ring mask for a light smoothing afterwards)."""
    s, sd = P["EYE_SCALE"], P["EYE_DEPTH_SCALE"]
    a0, b0 = P["EYE_T0"]
    t_nasal, t_temple, t_up, t_down = P["EYE_T1"]
    parts = []
    for side in (1, -1):
        ce, R = eye_frame(co, side)
        Q = ce + np.array([0.0, -R, 0.0])
        v = co - Q
        rho = np.hypot(v[:, 0], v[:, 2])
        c = v[:, 0] * side / np.maximum(rho, 1e-9); sn = v[:, 2] / np.maximum(rho, 1e-9)      # c > 0 = towards the temple
        r0 = R / np.sqrt((c / a0) ** 2 + (sn / b0) ** 2 + 1e-12)
        A1 = np.where(c > 0, t_temple, t_nasal); B1 = np.where(sn > 0, t_up, t_down)
        r1 = R / np.sqrt((c / A1) ** 2 + (sn / B1) ** 2 + 1e-12)
        dm = falloff(v[:, 1], P["EYE_DEPTH0"] * R, P["EYE_DEPTH1"] * R)
        f = radial_map(rho, r0, r1, s)
        u = np.clip((f - rho) / np.maximum((s - 1.0) * rho, 1e-9), 0.0, 1.0) * dm      # 1 in the rigid disc .. 0 outside
        u = np.where(rho < 1e-9, 1.0, u)
        q = rho / r0
        g = falloff(q, 1.0, 1.0 + P["EYE_BLEND"]) * dm                                 # rigid depth -> sliding depth
        parts.append([side, Q, R, v, rho, u, g, q, rho / r1])
    uL, uR = parts[0][5], parts[1][5]
    den = np.maximum(1.0 - uL * uR, 1e-9)
    parts[0].append(uL * (1.0 - uR) / den); parts[1].append(uR * (1.0 - uL) / den)   # the eyes share the midline zone
    tang = np.zeros_like(co); rigid_y = np.zeros(M.n); gsum = np.zeros(M.n)
    press = np.zeros(M.n); pole_y = np.zeros(M.n)
    ann = np.zeros(M.n)
    for side, Q, R, v, rho, u, g, q, q1, w in parts:
        T = np.array([side * P["EYE_OUT"], P["EYE_BACK"], -P["EYE_DOWN"]])
        tang[:, 0] += v[:, 0] * w * (s - 1.0) + w * T[0]
        tang[:, 2] += v[:, 2] * w * (s - 1.0) + w * T[2]
        behind = np.maximum(v[:, 1], 0.0); front = np.minimum(v[:, 1], 0.0)
        rigid_y += g * (behind * (sd - 1.0) - front * P["EYE_BROW_FLAT"] + T[1])
        gsum = np.maximum(gsum, g)
        depth_ok = falloff(v[:, 1], P["EYE_DEPTH0"] * R, P["EYE_DEPTH1"] * R)
        wb = falloff(q1, 0.35, 1.0) * depth_ok
        mine = wb > press
        press = np.where(mine, wb, press); pole_y = np.where(mine, Q[1] + T[1], pole_y)
        ann = np.maximum(ann, C.smoothstep(q, 1.0, 1.15) * falloff(q1, 1.0, 1.35) * falloff(v[:, 1], 2.5 * R, 5.0 * R))
    # the sliding skin: move sideways, then drop onto the nearest point of the ORIGINAL face surface; near the eyes the
    # brow / cheek that stands in front of the eye plane is pressed back by EYE_BROW_FLAT (a shallower eye socket)
    faces = [tuple(int(i) for i in f) for f in M.polys if f.max() < BODY_N]
    bvh = BVHTree.FromPolygons([tuple(pt) for pt in co[:BODY_N]], faces)
    out = co.copy()
    out[:, 0] += tang[:, 0]; out[:, 2] += tang[:, 2]
    out[:, 1] += rigid_y
    moving = np.nonzero((np.abs(tang).sum(axis=1) > 1e-7) & (gsum < 0.999) & M.body)[0]
    for i in moving:
        loc = bvh.find_nearest(Vector((co[i, 0] + tang[i, 0], co[i, 1], co[i, 2] + tang[i, 2])))[0]
        if loc is None:
            continue
        sl = np.array(loc)
        if sl[1] < pole_y[i]:
            sl[1] += P["EYE_BROW_FLAT"] * press[i] * (pole_y[i] - sl[1])
        out[i] = gsum[i] * out[i] + (1.0 - gsum[i]) * sl
    # the eyeball helper and the eye joints: rigid
    for side, Q, R, v, rho, u, g, q, q1, w in parts:
        T = np.array([side * P["EYE_OUT"], P["EYE_BACK"], -P["EYE_DOWN"]])
        tag = "l" if side > 0 else "r"
        rigid = np.zeros(M.n, bool)
        rigid[HELP_EYE_L if side > 0 else HELP_EYE_R] = True
        for gname in ("joint-%s-eye" % tag, "joint-%s-eye-target" % tag, "joint-%s-upperlid" % tag, "joint-%s-lowerlid" % tag):
            rigid |= M.group(gname)
        out[rigid] = co[rigid] + v[rigid] * (np.array([s, sd, s]) - 1.0) + T
    return out, ann


def eye_sphere(M, co, pre):
    """After eye_region_scale the eyeball helper is an ellipsoid (flatter in depth than wide). Replace it by the
    sphere that has the same front pole and fits the scaled lids: a bigger, flatter eyeball further back in the head.
    The eye joints follow, and the lid rings are wrapped onto the new sphere at their MakeHuman stand-off (times
    LID_THICK). pre: per side (centre, radius, ratio, skin ring, pocket ring) measured before the scale."""
    out = co.copy()
    s, sd = P["EYE_SCALE"], P["EYE_DEPTH_SCALE"]
    for side in (1, -1):
        ce0, R0, ratio0, skin, pocket, hv = pre[side]
        T = np.array([side * P["EYE_OUT"], P["EYE_BACK"], -P["EYE_DOWN"]])
        pole = ce0 + np.array([0.0, -R0, 0.0]) + T
        R2 = R0 * (0.36 * s * s + 0.04 * sd * sd) / (0.4 * sd) * P["EYE_R2_K"]
        c2 = pole + np.array([0.0, R2, 0.0])
        helper = HELP_EYE_L if side > 0 else HELP_EYE_R
        out[helper] = c2 + hv * R2                                # hv: helper directions on the MakeHuman sphere
        tag = "l" if side > 0 else "r"
        def put(group, centre):
            m = M.group(group)
            out[m] += centre - out[m].mean(0)
        put("joint-%s-eye" % tag, c2)
        put("joint-%s-eye-target" % tag, c2 + np.array([0.0, -(R2 + 0.035), 0.0]))
        a = math.radians(22)
        put("joint-%s-upperlid" % tag, c2 + 1.2 * R2 * np.array([0.0, -math.cos(a), math.sin(a)]))
        put("joint-%s-lowerlid" % tag, c2 + 1.2 * R2 * np.array([0.0, -math.cos(a), -math.sin(a)]))
        # wrap the lid rings onto the sphere
        ring_w = np.zeros(M.n)
        for k, w in ((0, 1.0), (1, 1.0), (2, 0.75), (3, 0.45), (4, 0.2)):
            ring_w[skin == k] = w
        ring_w[pocket >= 1] = 1.0
        idx = np.nonzero(ring_w > 0)[0]
        v = out[idx] - c2
        d = np.linalg.norm(v, axis=1)
        target = R2 * (1.0 + (ratio0[idx] - 1.0) * np.where(ratio0[idx] > 1.0, P["LID_THICK"], 1.0))
        newd = d + ring_w[idx] * (target - d)
        out[idx] = c2 + v / d[:, None] * newd[:, None]
        # a narrower lid rim: the inner edge of the rim (first pocket ring) moves towards the lid edge
        loop = np.array(EYE_LOOP_L) if side > 0 else M.mirror[EYE_LOOP_L]
        inloop = np.zeros(M.n, bool); inloop[loop] = True
        for i in np.nonzero(pocket == 1)[0]:
            nb = [j for j in M.nbr[i] if inloop[j]]
            if nb:
                tgt = out[nb].mean(axis=0)
                q = out[i] + (1.0 - P["LID_RIM"]) * (tgt - out[i])
                dq = q - c2
                out[i] = c2 + dq / np.linalg.norm(dq) * np.linalg.norm(out[i] - c2)
    return out


def lid_clearance(M, co, gap=0.0004, cover=0.0016):
    """Keep the eyeball under the skin: (1) lid-edge vertices that ended up inside the final eyeball go out to its
    surface plus a small gap; (2) all other skin inside the cone of the eyeball cap (EYE_CAP_DEG) is lifted to at
    least 'cover' above the ball, so the big eyeball cannot show through next to the eye corners."""
    out = co.copy(); n_fixed = 0; n_cover = 0
    for side in (1, -1):
        ce, R = eye_frame(co, side)
        rb = R * P["EYE_BALL_K"]
        skin, pocket = M.lid_rings(co, side, depth=30)
        ring = ((skin >= 0) & (skin <= 1)) | (pocket == 1)
        v = out - ce; d = np.linalg.norm(v, axis=1)
        bad = ring & (d < rb + gap)
        out[bad] = ce + v[bad] / d[bad][:, None] * (rb + gap)
        n_fixed += int(bad.sum())
        th = np.degrees(np.arccos(np.clip(-v[:, 1] / np.maximum(d, 1e-9), -1, 1)))
        want = rb + cover * np.clip((skin - 1) / 3.0, 0, 1)            # the cover grows over the first rings of lid skin
        low = M.body & (pocket < 0) & (skin != 0) & (skin != 1) & (th < P["EYE_CAP_DEG"] + 6) & (d < want)
        out[low] = ce + v[low] / d[low][:, None] * want[low][:, None]
        n_cover += int(low.sum())
    return out, (n_fixed, n_cover)


def head_weight(co, lm):
    """0 below the neck, 1 for the head: ramp across the upper neck, along a plane through chin bottom and nape."""
    F = lm["menton"]; B = lm["nape"]
    k = (B[2] - F[2]) / (B[1] - F[1])
    t = co[:, 2] - k * (co[:, 1] - F[1]) - F[2]
    return C.smoothstep(t, -0.050, 0.004), k


def head_shape(M, co, s_xyz):
    """Non-uniform head scale (wider, rounder) that keeps the eye regions rigid, so the eyeballs stay spheres."""
    L = {k: co[i] for k, i in LM.items()}
    w, _ = head_weight(co, L)
    piv = np.array([0.0, 0.5 * (L["nasion"][1] + L["nape"][1]), L["nasion"][2]])
    S = np.array(s_xyz) - 1.0
    D = (co - piv) * S * w[:, None]
    for side in (1, -1):
        ce, R = eye_frame(co, side)
        we = falloff(np.linalg.norm(co - ce, axis=1), 1.35 * R, 2.7 * R)
        Dc = (ce - piv) * S
        D = D + we[:, None] * (Dc - D)
        tag = "l" if side > 0 else "r"
        for g in ("joint-%s-eye" % tag, "joint-%s-eye-target" % tag, "joint-%s-upperlid" % tag, "joint-%s-lowerlid" % tag):
            D[M.group(g)] = Dc
    return co + D


def head_scale(co, lm, s):
    """Uniform head scale about the top of the neck."""
    w, k = head_weight(co, lm)
    F = lm["menton"]; B = lm["nape"]
    piv = np.array([0.0, 0.5 * (F[1] + B[1]) + 0.01, 0.5 * (F[2] + B[2]) - 0.012])
    return piv + (co - piv) * (1.0 + w[:, None] * (s - 1.0))


def stretch_z(co, z0, z1, s, soft=0.03):
    """Lengthen the part between heights z0 and z1 by factor s; everything above moves up."""
    zs = np.linspace(-0.2, 2.6, 5601)
    u = C.smoothstep(zs, z0 - soft, z0 + soft) * (1.0 - C.smoothstep(zs, z1 - soft, z1 + soft))
    g = np.cumsum(u) * (zs[1] - zs[0])
    out = co.copy()
    out[:, 2] = co[:, 2] + (s - 1.0) * np.interp(co[:, 2], zs, g)
    return out


def foot_scale(M, co, s_len, s_wid, s_high, ankle_z):
    """Scale each foot about a point on the ground under the ankle: length and width below the ankle only (the ankle
    and shin keep their girth), height as a stretch that lifts everything above."""
    out = co.copy()
    for side, tag in ((1, "l"), (-1, "r")):
        a = co[M.group("joint-%s-ankle" % tag)].mean(0)
        piv = np.array([a[0], a[1], 0.0])
        sel = (co[:, 0] * side > 0.02)
        w = falloff(co[:, 2], ankle_z * 0.55, ankle_z * 1.25) * sel
        s = 1.0 + w[:, None] * (np.array([s_wid, s_len, 1.0]) - 1.0)
        out = np.where(sel[:, None], piv + (out - piv) * s, out)
    return stretch_z(out, 0.0, ankle_z * 0.8, s_high, soft=ankle_z * 0.2)


def toe_shape(M, co):
    """Shorter, slightly plumper toes: scale every toe along its own axis about its base joint (TOE_LEN) and a little
    across (TOE_FAT). The toe joint cubes move with the toes."""
    out = co.copy()
    for side, tag in ((1, "l"), (-1, "r")):
        axes = []
        for t in range(1, 6):
            base = co[M.group("joint-%s-toe-%d-1" % (tag, t))].mean(0)
            tip = co[M.group("joint-%s-toe-%d-%d" % (tag, t, 3 if t == 1 else 4))].mean(0)
            axes.append((base, tip))
        foot = (co[:, 0] * side > 0.02) & (co[:, 2] < 0.06)
        idx = np.nonzero(foot)[0]
        p = co[idx]
        best_d = np.full(len(idx), 1e9); best = np.zeros(len(idx), int); best_t = np.zeros(len(idx))
        for k, (base, tip) in enumerate(axes):
            ax = (tip - base); L = np.linalg.norm(ax); ax = ax / L
            t = (p - base) @ ax
            perp = (p - base) - np.outer(t, ax)
            d = np.linalg.norm(perp, axis=1)
            d = np.where(t < -0.012, 1e9, d)
            better = d < best_d
            best_d = np.where(better, d, best_d); best = np.where(better, k, best); best_t = np.where(better, t, best_t)
        for k, (base, tip) in enumerate(axes):
            ax = (tip - base); L = np.linalg.norm(ax); ax = ax / L
            m = (best == k) & (best_d < 0.022)
            q = p[m]
            t = (q - base) @ ax
            perp = (q - base) - np.outer(t, ax)
            g = C.smoothstep(t, 0.0, 0.010) * falloff(best_d[m], 0.013, 0.022)
            kl = 1.0 + (P["TOE_LEN"][k] - 1.0) * g
            kf = 1.0 + (P["TOE_FAT"][k] - 1.0) * g
            kt = 1.0 + (P["TOE_THICK"][k] - 1.0) * g
            perp = perp * kf[:, None]
            perp[:, 2] *= kt / kf
            out[idx[m]] = base + np.outer(np.where(t > 0, t * kl, t), ax) + perp
    return out


def simplify_face(M, co, eye_ann):
    """Blend the zone around the enlarged eyes back into the face."""
    if P["SMOOTH_FACE"] > 0:
        co = M.smooth(co, np.clip(eye_ann * P["SMOOTH_FACE"], 0, 1), iterations=P["SMOOTH_FACE_IT"], lam=0.5)
    return co


def subdivided(M, co, idx):
    """Where the vertices idx end up after one Catmull-Clark subdivision (all-quad mesh, interior vertices)."""
    fc = co[M.polys].mean(axis=1)
    fsum = np.zeros_like(co); cnt = np.zeros(M.n)
    for k in range(4):
        np.add.at(fsum, M.polys[:, k], fc); np.add.at(cnt, M.polys[:, k], 1.0)
    F = fsum / np.maximum(cnt, 1)[:, None]
    Rm = 0.5 * (co + M.neighbours_avg(co))                      # average of the edge midpoints
    n = M.deg[:, None]
    out = (F + 2.0 * Rm + (n - 3.0) * co) / n
    return out[idx]


def lip_tables(M, co):
    """(depth, upper): ring index of every lip vertex counted from the outer lip border (0) to the inner border (10,
    the contact line is ring 7), and whether it belongs to the upper lip."""
    lips = M.group("lips")
    oral = M.component(ORAL_SEED, M.body & ~lips)
    border = lips & M.grow(M.body & ~lips & ~oral, 1)
    depth = M.depth_from(border, lips, 14)
    ring7 = np.nonzero(depth == 7)[0]
    zmid = np.median(co[ring7, 2])
    upper = np.zeros(M.n, bool)
    for v in np.nonzero(lips)[0]:
        u = int(v)
        for d in range(int(depth[v]), 0, -1):
            u = next(w for w in M.nbr[u] if depth[w] == d - 1)
        upper[v] = co[u, 2] > zmid
    return depth, upper, oral


def relax_into(M, disp, fixed, rings=8, iterations=60):
    """Spread a displacement that is given on the 'fixed' vertices smoothly into the surrounding skin (a few rings)."""
    zone = M.grow(fixed, rings) & M.body & ~fixed
    d = disp.copy()
    d[~fixed] = 0.0
    edge = M.depth_from(fixed, zone | fixed, rings).astype(float)
    fade = np.where(fixed, 1.0, np.clip(1.0 - (edge - 1) / float(rings), 0, 1))
    for _ in range(iterations):
        avg = M.neighbours_avg(d)
        d[zone] = avg[zone]
    return d * fade[:, None]


def lip_shape(M, co):
    """Thinner lips: scale the upper and the lower lip vertically about the mouth line, the skin around follows."""
    ku, kl = P["LIP_THIN"]
    lips = M.group("lips")
    depth, upper, oral = lip_tables(M, co)
    ring7 = np.nonzero((depth == 7) & upper)[0]
    o = np.argsort(np.abs(co[ring7, 0]))
    xs, zs = np.abs(co[ring7, 0])[o], co[ring7, 2][o]
    zline = np.interp(np.abs(co[:, 0]), xs, zs)
    disp = np.zeros_like(co)
    vis = lips & (depth <= 7)
    k = np.where(upper, ku, kl)
    disp[vis, 2] = ((co[:, 2] - zline) * (k - 1.0))[vis]
    xc = P["LIP_WIDE"] - 1.0
    disp[lips | oral, 0] += co[lips | oral, 0] * xc
    fixed = lips | oral
    d = relax_into(M, disp, fixed, rings=7)
    d[oral] = disp[oral]
    # the teeth helpers follow the sideways scale only
    return co + d


def seal_lips(M, co, overlap):
    """Close the mouth line: Catmull-Clark subdivision rounds the lip edges and would leave the lips parted (teeth
    showing). Move the contact rings of the upper lip down and of the lower lip up until, after one subdivision, the
    contact lines overlap slightly."""
    lips = M.group("lips")
    oral = M.component(ORAL_SEED, M.body & ~lips)
    border = lips & M.grow(M.body & ~lips & ~oral, 1)
    depth = M.depth_from(border, lips, 14)
    ring7 = np.nonzero(depth == 7)[0]
    zmid = np.median(co[ring7, 2])
    # upper / lower halves of the contact ring by following each vertex outwards to ring 0
    def is_upper(v):
        u = v
        for d in range(int(depth[v]), 0, -1):
            u = next(w for w in M.nbr[u] if depth[w] == d - 1)
        return co[u, 2] > zmid
    up7 = np.array([v for v in ring7 if is_upper(v)]); lo7 = np.array([v for v in ring7 if not is_upper(v)])
    # pair every upper contact vertex with the nearest lower one in x
    pair = np.array([lo7[np.argmin(np.abs(co[lo7, 0] - co[u, 0]) + 0.3 * np.abs(co[lo7, 1] - co[u, 1]))] for u in up7])
    wd = {5: 0.25, 6: 0.65, 7: 1.0, 8: 0.65, 9: 0.25}
    out = co.copy()
    # column of each lip vertex: the ring-7 vertex reached by walking through the rings
    col_of = {}
    for v7 in ring7:
        col_of[int(v7)] = int(v7)
        for direction in (-1, 1):
            u = int(v7)
            for d in range(7 + direction, 4 if direction < 0 else 10, direction):
                nx = [w for w in M.nbr[u] if depth[w] == d and lips[w]]
                if not nx: break
                u = nx[0]; col_of[u] = int(v7)
    members = {}
    for v, c in col_of.items():
        members.setdefault(c, []).append(v)
    for it in range(12):
        sub_u = subdivided(M, out, up7); sub_l = subdivided(M, out, pair)
        gap = sub_u[:, 2] - sub_l[:, 2] + overlap                   # > 0: still open
        if gap.max() < 1e-5:
            break
        for u, l, g in zip(up7, pair, gap):
            if g <= 0: continue
            for c, sign in ((int(u), -1.0), (int(l), 1.0)):
                for v in members[c]:
                    out[v, 2] += sign * 0.5 * g * wd.get(int(depth[v]), 0.0) * 0.9
    return out, float(gap.max())


def legs_in(M, co, dx):
    """Her legs closer together: everything from the hip joints down (the joints themselves too, so the rig follows) is
    moved towards the middle by dx, fading in over the 6.5 cm round the hip joints' height. What lies near the middle
    plane moves less (nothing crosses it)."""
    zj = float(co[M.group("joint-l-upper-leg")].mean(0)[2])
    w = 1.0 - np.clip((co[:, 2] - (zj - 0.03)) / 0.065, 0.0, 1.0); w = w * w * (3 - 2 * w)
    ax = np.abs(co[:, 0]); near = np.clip(ax / 0.03, 0.0, 1.0)
    out = co.copy(); out[:, 0] -= np.sign(co[:, 0]) * dx * w * near
    return out, zj


def soften_body(M, co):
    """Simplify the body surface: a light volume-keeping smoothing of the limbs and trunk (no veins, tendons or sharp
    bone landmarks), and a strong smoothing of the anatomy that the suit covers (it is deleted before export; the
    painted suit and the stage-2 suit are built on it, so it has to be a plain, soft form)."""
    out = co
    L = {k: co[i] for k, i in LM.items()}
    hw, _ = head_weight(co, L)
    hands = np.zeros(M.n)
    for tag in ("l", "r"):
        h = co[M.group("joint-%s-hand" % tag)].mean(0)
        hands = np.maximum(hands, falloff(np.linalg.norm(co - h, axis=1), 0.03, 0.07))
    ankle = co[M.group("joint-l-ankle")].mean(0)[2]
    feet = falloff(co[:, 2], ankle * 0.8, ankle * 1.6)
    mask = (1.0 - hw) * (1.0 - hands) * (1.0 - feet)
    if P["SMOOTH_BODY"] > 0:
        out = M.smooth(out, mask * P["SMOOTH_BODY"], iterations=12, lam=0.5, keep_volume=True)
    # under the suit: nipples, navel, crotch
    plain = M.blur(M.grow(M.group("nipple"), 5).astype(float), 3)
    cr = L["crotch"]
    plain = np.maximum(plain, falloff(np.linalg.norm((out - cr) * np.array([1.0, 0.7, 1.0]), axis=1), 0.05, 0.10) * (out[:, 2] > cr[2] - 0.03))
    navel = M.body & (np.abs(co[:, 0]) < 0.035) & (co[:, 1] < 0) & (np.abs(co[:, 2] - (cr[2] + 0.62 * (co[M.group("joint-spine-1")].mean(0)[2] - cr[2]))) < 0.12)
    plain = np.maximum(plain, M.blur(navel.astype(float), 3) * 0.8)
    out = M.smooth(out, np.clip(plain, 0, 1), iterations=40, lam=0.5)
    return out


# =====================================================================================================================
#                                                     eyes
# =====================================================================================================================
def eye_uv_radius(theta):
    """UV distance from the island centre for an angle from the eye's forward axis (radians)."""
    tf, kf = math.radians(EYE_UV_FRONT[0]), EYE_UV_FRONT[1]
    tm = math.radians(EYE_UV_MAX)
    th = np.clip(theta, 0, tm)
    return EYE_UV_R * np.where(th <= tf, kf * th / tf, kf + (1 - kf) * (th - tf) / (tm - tf))


def eye_uv_theta(rho):
    tf, kf = math.radians(EYE_UV_FRONT[0]), EYE_UV_FRONT[1]
    tm = math.radians(EYE_UV_MAX)
    q = np.clip(rho / EYE_UV_R, 0, 1)
    return np.where(q <= kf, q / kf * tf, tf + (q - kf) / (1 - kf) * (tm - tf))


def eye_colour(dirs):
    """sRGB colour of the eyeball surface for unit directions (N, 3) from the eye centre (eye looking along -Y).
    Painted: warm off-white sclera that darkens towards the top (lid shadow), a large blue iris with a darker rim and
    lighter rays towards a large pupil, one soft catch-light at the viewer's upper left of the pupil."""
    x, y, z = dirs[:, 0], dirs[:, 1], dirs[:, 2]
    th = np.arccos(np.clip(-y, -1, 1))
    ti = math.radians(P["IRIS_DEG"])
    r = th / ti                                        # 0 centre .. 1 iris edge
    phi = np.arctan2(z, x)
    aa = 0.012                                         # edge softness (in iris radii)
    # ---- sclera
    scl = np.array([0.962, 0.935, 0.915])
    shade_top = C.smoothstep(z, -0.12, 0.42)           # lid shadow
    shade_low = C.smoothstep(-z, 0.36, 0.62)
    shade_rim = C.smoothstep(th, math.radians(42), math.radians(85))
    k = 1.0 - 0.24 * shade_top - 0.08 * shade_low - 0.16 * shade_rim
    tint = np.array([0.80, 0.78, 0.86])                # cool shadow
    col = scl[None, :] * (k[:, None] + (1 - k[:, None]) * tint[None, :] * 0.55)
    col += np.array([0.02, -0.01, -0.015])[None, :] * shade_rim[:, None]      # a little warmth near the corners
    # ---- iris
    c_in = np.array([0.42, 0.80, 0.99]); c_mid = np.array([0.13, 0.47, 0.90]); c_rim = np.array([0.04, 0.13, 0.40])
    pf = P["PUPIL_FRAC"]
    t = np.clip((r - pf) / (1 - pf), 0, 1)
    iris = c_in[None, :] + (c_mid - c_in)[None, :] * C.smoothstep(t, 0.0, 0.55)[:, None]
    iris = iris + (c_rim[None, :] - iris) * (C.smoothstep(t, 0.55, 1.0) ** 1.5)[:, None]
    rng = np.random.RandomState(7)
    rays = np.zeros_like(r)
    for f, a in ((23, 0.5), (37, 0.4), (61, 0.3), (97, 0.2), (11, 0.35)):
        rays += a * np.sin(f * phi + rng.uniform(0, 6.283) + 2.5 * np.sin(3 * phi + rng.uniform(0, 6.283)))
    rays = rays / 1.75
    ray_amp = 0.085 * (1.0 - C.smoothstep(t, 0.15, 0.95))
    iris = iris * (1.0 + ray_amp * rays)[:, None]
    # lighter crescent at the bottom, shadow from the lid at the top
    zi = z / math.sin(ti)                              # -1 bottom of iris .. 1 top
    iris = iris * (1.0 - 0.38 * C.smoothstep(zi, -0.15, 0.95))[:, None]
    glow = C.smoothstep(-zi, 0.15, 0.85) * C.smoothstep(t, 0.05, 0.5) * (1 - C.smoothstep(t, 0.78, 1.0))
    iris = iris + (np.array([0.50, 0.90, 1.0])[None, :] - iris) * (0.42 * glow)[:, None]
    # limbal ring
    ring = C.smoothstep(r, 0.86, 0.985)
    iris = iris * (1.0 - 0.55 * ring)[:, None]
    m_iris = 1.0 - C.smoothstep(r, 1.0 - 2.5 * aa, 1.0 + 2.5 * aa)
    col = col * (1 - m_iris[:, None]) + iris * m_iris[:, None]
    # soft dark halo just outside the iris
    halo = (1.0 - C.smoothstep(r, 1.0, 1.10)) * (1 - m_iris)
    col = col * (1.0 - 0.10 * halo)[:, None]
    # ---- pupil
    m_pup = 1.0 - C.smoothstep(r, pf - 2 * aa, pf + 2 * aa)
    col = col * (1 - m_pup[:, None]) + np.array([0.025, 0.02, 0.05])[None, :] * m_pup[:, None]
    # ---- catch-light: viewer's upper left = her right (-X), up (+Z)
    hx, hz, hr = -0.40 * math.sin(ti), 0.42 * math.sin(ti), 0.215 * math.sin(ti)
    dh = np.hypot(x - hx, z - hz) / hr
    m_hi = (1.0 - C.smoothstep(dh, 0.72, 1.0)) * (y < 0)
    col = col * (1 - m_hi[:, None]) + m_hi[:, None]
    return np.clip(col, 0, 1)


def paint_eye_texture(size=1024):
    """The eye texture as a float image (rows bottom-up, sRGB values): two islands at the MakeHuman eye-layout centres,
    each an azimuthal map of the eyeball (see eye_uv_radius), painted with eye_colour()."""
    S = size
    img = np.zeros((S, S, 4), dtype=np.float32)
    back = eye_colour(np.array([[0.0, 1.0, 0.0]]))[0]
    img[:, :, :3] = back; img[:, :, 3] = 1.0
    ys, xs = np.mgrid[0:S, 0:S]
    u = (xs + 0.5) / S; v = (ys + 0.5) / S
    for side in (1, -1):
        cu, cv = EYE_UV_C[side]
        du, dv = u - cu, v - cv
        rho = np.hypot(du, dv)
        m = rho < EYE_UV_R * 1.06
        th = eye_uv_theta(rho[m]); ph = np.arctan2(dv[m], du[m])
        dirs = np.stack([np.sin(th) * np.cos(ph), -np.cos(th), np.sin(th) * np.sin(ph)], axis=1)
        img[m, :3] = eye_colour(dirs)
    return img


def finish_eyes(st, opt):
    """Keep only the inner eyeball of the MakeHuman eye mesh, make it an exact sphere centred on the eye bone, map and
    paint its texture, turn each eye inwards (EYE_CONVERGE_DEG) and give it the final material."""
    import bmesh
    eyes, rig, co_b = st["eyes"], st["rig"], st["co"]
    me = eyes.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    kill = [v for v in bm.verts if v.index < 256 or 532 <= v.index < 788]     # the two outer (cornea) shells
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    assert len(me.vertices) == 552
    co = C.get_co(eyes)
    dirs = np.zeros_like(co)
    st["eye_centre"] = {}; st["eye_radius"] = {}
    side_of = np.ones(552)
    for side, sl, bone in ((1, slice(0, 276), "eye.L"), (-1, slice(276, 552), "eye.R")):
        c = np.array(rig.data.bones[bone].head_local)
        _, Rh = eye_frame(co_b, side)
        R = Rh * P["EYE_BALL_K"]
        v = co[sl] - c
        dirs[sl] = v / np.linalg.norm(v, axis=1)[:, None]
        side_of[sl] = side
        a = math.radians(-side * P["EYE_CONVERGE_DEG"])
        rot = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
        co[sl] = c + (dirs[sl] @ rot.T) * R
        st["eye_centre"][side] = c; st["eye_radius"][side] = R
    C.set_co(eyes, co)
    for g in list(eyes.vertex_groups):
        eyes.vertex_groups.remove(g)
    eyes.vertex_groups.new(name="eye.L").add(list(range(0, 276)), 1.0, 'REPLACE')
    eyes.vertex_groups.new(name="eye.R").add(list(range(276, 552)), 1.0, 'REPLACE')
    # the eyeball is much bigger than the eye opening: keep only a front cap, and cut away whatever would come
    # through the skin of the temples (faces of the eyelids and the eye pocket do not count: that is the eye opening)
    M = st["M"]
    th_all = np.degrees(np.arccos(np.clip(-dirs[:, 1], -1, 1)))
    lidzone = np.zeros(M.n, bool)
    for side in (1, -1):
        skin, pocket = M.lid_rings(co_b, side, depth=30)
        lidzone |= ((skin >= 0) & (skin <= 9)) | (pocket >= 0)
    faces = [f for f in M.polys if f.max() < BODY_N]
    face_lid = np.array([lidzone[f].any() for f in faces])
    bvh = BVHTree.FromPolygons([tuple(v) for v in co_b[:BODY_N]], [tuple(int(i) for i in f) for f in faces])
    bad = th_all > P["EYE_CAP_DEG"]
    poke = np.zeros(len(co), bool)
    # A vertex of the ball "comes through" when skin other than the lids lies at or inside the ball along its radius
    # (lid_clearance keeps 1.6 mm of skin over the ball, so this only happens beyond the cap's cone, at the temples).
    for i, q in enumerate(co):
        if bad[i] or th_all[i] < 20:
            continue
        sd = 1 if side_of[i] > 0 else -1
        c = Vector(st["eye_centre"][sd]); R = st["eye_radius"][sd]
        d = (Vector(q) - c).normalized(); t0 = 0.55 * R
        for _ in range(5):
            hit = bvh.ray_cast(c + d * t0, d, R + 0.0006 - t0)
            if hit[0] is None:
                break
            if not face_lid[hit[2]]:
                poke[i] = True; break
            t0 += hit[3] + 1e-5
    if poke.any() and os.environ.get("ANNE_EYE_DEBUG"):
        rings = {1: M.lid_rings(co_b, 1, depth=30), -1: M.lid_rings(co_b, -1, depth=30)}
        for i in np.nonzero(poke)[0][:14]:
            q = co[i]; loc, nrm, fi, dist = bvh.find_nearest(Vector(q)); f = faces[fi]; sd = int(side_of[i])
            ce = st["eye_centre"][sd]
            log("  poke v%d side %d az %.0f el %.0f | signed %.4f | face verts %s skin %s pocket %s | skin d-R (mm) %s" % (
                i, sd, math.degrees(math.atan2(dirs[i, 0] * sd, -dirs[i, 1])), math.degrees(math.asin(dirs[i, 2])), (Vector(q) - loc).dot(nrm),
                list(map(int, f)), [int(rings[sd][0][v]) for v in f], [int(rings[sd][1][v]) for v in f],
                [round(1000 * (float(np.linalg.norm(co_b[v] - ce)) - st["eye_radius"][sd]), 2) for v in f]))
    if poke.any():                                   # where the eyeball comes through: + azimuth = towards the temple
        azp = np.degrees(np.arctan2(dirs[poke, 0] * side_of[poke], -dirs[poke, 1])); elp = np.degrees(np.arcsin(dirs[poke, 2]))
        log("eye cap: %d vertices come through the skin: azimuth %.0f..%.0f, elevation %.0f..%.0f (deg)" % (poke.sum(), azp.min(), azp.max(), elp.min(), elp.max()),
            "| by quadrant (temple-up, temple-down, nose-up, nose-down):", int(((azp > 0) & (elp > 0)).sum()), int(((azp > 0) & (elp <= 0)).sum()), int(((azp <= 0) & (elp > 0)).sum()), int(((azp <= 0) & (elp <= 0)).sum()))
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    grow = set()
    for v in bm.verts:
        if poke[v.index]:
            grow.add(v.index)
            for e in v.link_edges:
                grow.add(e.other_vert(v).index)
    kill = [v for v in bm.verts if bad[v.index] or v.index in grow]
    keep = np.ones(len(co), bool); keep[[v.index for v in kill]] = False
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    dirs = dirs[keep]; side_of = side_of[keep]
    az = np.degrees(np.arctan2(dirs[:, 0] * side_of, -dirs[:, 1]))          # + = towards the temple
    el0 = np.abs(np.degrees(np.arcsin(dirs[:, 2]))) < 12
    st["eye_cap"] = dict(verts=int(keep.sum()), poked=int(poke.sum()), outer_deg=float(az[el0].max()), inner_deg=float(-az[el0].min()))
    for g, sd in (("eye.L", 1), ("eye.R", -1)):
        eyes.vertex_groups[g].add([int(i) for i in np.nonzero(side_of == sd)[0]], 1.0, 'REPLACE')
    # UVs: azimuthal map of the direction from the eye centre, at the MakeHuman island centres
    nl = len(me.loops)
    lv = np.empty(nl, dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
    d = dirs[lv]
    th = np.arccos(np.clip(-d[:, 1], -1, 1)); ph = np.arctan2(d[:, 2], d[:, 0])
    rho = eye_uv_radius(th)
    cu = np.where(side_of[lv] > 0, EYE_UV_C[1][0], EYE_UV_C[-1][0]); cv = np.where(side_of[lv] > 0, EYE_UV_C[1][1], EYE_UV_C[-1][1])
    uv = np.stack([cu + rho * np.cos(ph), cv + rho * np.sin(ph)], axis=1)
    me.uv_layers[0].data.foreach_set("uv", uv.astype(np.float32).ravel())
    tex_path = C.EYE_TEX if not opt["out"] else os.path.join(opt["out"], "anne2_eye.png")
    os.makedirs(os.path.dirname(tex_path), exist_ok=True)
    C.save_pixels(tex_path, paint_eye_texture(1024))
    image = bpy.data.images.load(tex_path, check_existing=False)
    image.name = "anne2_eye.png"
    image.pack()
    mat = C.make_material("Anne_Eye", (1, 1, 1), rough=0.22, spec=0.6)
    nt = mat.node_tree; b = nt.nodes["BSDF"]
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.name = "EyeTex"; tx.image = image; tx.location = (-350, 0)
    nt.links.new(tx.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(tx.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 0.22          # the eyes never go dull in shadow
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0
    C.shade_smooth(eyes)
    log("eyes: radius %.4f centre L %s converge %.1f deg, cap %s" % (
        st["eye_radius"][1], np.round(st["eye_centre"][1], 4), P["EYE_CONVERGE_DEG"], st["eye_cap"]))


def finish_teeth(st):
    """Flat materials for the teeth mesh: clean off-white teeth (Anne_Teeth) and pink gums (Anne_Gum), chosen per face
    from the MakeHuman teeth texture."""
    teeth = st["teeth"]; me = teeth.data
    img = None
    for m in me.materials:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image: img = n.image
    gum = np.zeros(len(me.polygons), bool)
    if img is not None:
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
        nl = len(me.loops)
        uv = np.empty(nl * 2, dtype=np.float32); me.uv_layers[0].data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
        for p in me.polygons:
            c = uv[p.loop_start:p.loop_start + p.loop_total].mean(0)
            t = px[min(int(c[1] * h), h - 1), min(int(c[0] * w), w - 1)]
            gum[p.index] = t[0] > 1.35 * max(t[1], 0.02)
    t_mat = C.make_material("Anne_Teeth", "#f6f1ea", rough=0.25, spec=0.5)
    g_mat = C.make_material("Anne_Gum", "#d5707f", rough=0.4)
    me.materials.clear(); me.materials.append(t_mat); me.materials.append(g_mat)
    me.polygons.foreach_set("material_index", gum.astype(np.int32))
    me.update()
    log("teeth faces", int((~gum).sum()), "gum faces", int(gum.sum()))


# =====================================================================================================================
#                                                  skin paint
# =====================================================================================================================
def paint_skin(st):
    """Paint the colour attribute Col (face corners, linear RGB): base skin, blush, cavities, eye sockets, under-chin,
    lips with a crisp edge on the lip loops, dark mouth interior, upper lash line."""
    body, M, co, rig = st["body"], st["M"], st["co"], st["rig"]
    B = rig.data.bones
    n = M.n
    nrm = M.normals(co)
    lin = lambda h: np.array(C.hex_lin(h)[:3])
    col = np.tile(lin(P["SKIN"]), (n, 1))
    def blend(mask, colour, strength=1.0):
        nonlocal col
        m = np.clip(np.asarray(mask, float) * strength, 0, 1)[:, None]
        col = col * (1 - m) + (lin(colour) if isinstance(colour, str) else colour) * m
    hs = st["solved"]["head_scale"] * st["solved"]["uniform"]          # head size relative to MakeHuman
    bs = st["solved"]["uniform"]
    L = face_landmarks(M, co)
    spot = lambda c, r: falloff(np.linalg.norm(co - np.asarray(c), axis=1), 0.3 * r, r)

    # ---- cavities: a warmer, darker tone where the surface is concave (between toes, ear folds, nostrils, creases)
    lap = M.neighbours_avg(co) - co
    el_ = np.linalg.norm(co[M.edges[:, 0]] - co[M.edges[:, 1]], axis=1)
    elen = np.zeros(n); np.add.at(elen, M.edges[:, 0], el_); np.add.at(elen, M.edges[:, 1], el_)
    elen = elen / np.maximum(M.deg, 1) + 1e-9
    cav = M.blur(np.sum(lap * nrm, axis=1) / elen, 2)
    nose_zone = spot(L["nose_tip"], 0.034 * hs)                      # (the nostrils stay light: her 2D nose is a hint, not two dark holes)
    blend(C.smoothstep(cav, 0.04, 0.40) * M.body * (1 - 0.8 * nose_zone), "#d0806c", 0.45)

    # ---- eye sockets and lids
    for side in (1, -1):
        ce, R = eye_frame(co, side)
        d = np.linalg.norm(co - ce, axis=1)
        above = C.smoothstep(co[:, 2] - ce[2], -0.25 * R, 0.45 * R)
        blend(falloff(d, 1.10 * R, 1.95 * R) * (co[:, 1] < ce[1] + 0.5 * R) * (0.25 + 0.75 * above), P["SOCKET"], 0.50)
        up = falloff(d, 1.05 * R, 1.50 * R) * C.smoothstep(co[:, 2] - ce[2], 0.1 * R, 0.5 * R)
        blend(up, "#dd9f8e", 0.30)                                                   # upper lid a touch rosier

    # ---- under the chin and jaw
    # (soft and wide: a tighter, stronger tone drew a line along the jawbone)
    under = C.smoothstep(-nrm[:, 2], 0.30, 1.0) * (co[:, 2] < L["chin"][2] + 0.01) * (co[:, 2] > B["neck01"].head_local.z) * (np.abs(co[:, 0]) < 0.09)
    blend(M.blur(under, 5), "#e2ab90", 0.4)

    # ---- blush
    eyeL, RL = eye_frame(co, 1)
    eye_w = co[EYE_LOOP_L][:, 0].max() - co[EYE_LOOP_L][:, 0].min()
    low_lid = co[EYE_LOOP_L[LOOP_BOTTOM]]
    cz = 0.55 * low_lid[2] + 0.45 * L["subnasale"][2]
    for side in (1, -1):
        cx = side * (eyeL[0] + 0.10 * eye_w)
        cand = M.body & (np.abs(co[:, 0] - cx) < 0.012) & (np.abs(co[:, 2] - cz) < 0.012) & (co[:, 1] < eyeL[1] + 0.02)
        cy = co[cand][:, 1].min() if cand.any() else eyeL[1]
        blend(spot((cx, cy, cz), 0.62 * eye_w), P["BLUSH"], 0.42)
    blend(spot(L["nose_tip"], 0.017 * hs), P["BLUSH"], 0.26)
    blend(spot(L["chin"], 0.020 * hs), P["BLUSH"], 0.15)
    ears = M.group("ears")
    ear_x = np.abs(co[ears][:, 0])
    blend(M.blur(ears.astype(float), 1) * C.smoothstep(np.abs(co[:, 0]), ear_x.min(), ear_x.max()), P["BLUSH"], 0.6)
    for side, s in (("L", 1), ("R", -1)):
        sh = np.array(B["upperarm01." + side].head_local); elb = np.array(B["lowerarm01." + side].head_local)
        kn = np.array(B["lowerleg01." + side].head_local); an = np.array(B["foot." + side].head_local)
        blend(spot(sh + np.array([s * 0.025, 0.0, 0.035]) * bs, 0.085 * bs), P["BLUSH"], 0.38)        # shoulder cap
        blend(spot(elb + np.array([0.0, 0.03, 0.0]) * bs, 0.055 * bs), P["BLUSH"], 0.45)              # elbow
        blend(spot(kn + np.array([0.0, -0.05, 0.0]) * bs, 0.075 * bs), P["BLUSH"], 0.42)              # knee
        foot = M.body & (co[:, 0] * s > 0) & (co[:, 2] < an[2] * 1.2)
        fy0, fy1 = co[foot][:, 1].min(), co[foot][:, 1].max(); flen = fy1 - fy0
        down = C.smoothstep(-nrm[:, 2], 0.2, 0.8) * foot
        blend(down, P["BLUSH"], 0.22)                                                                     # whole sole a little rosy
        blend(C.smoothstep(co[:, 1], fy1 - 0.24 * flen, fy1 - 0.08 * flen) * foot * (co[:, 2] < an[2] * 0.75), P["BLUSH"], 0.50)   # heel
        ball = falloff(np.abs(co[:, 1] - (fy0 + 0.30 * flen)), 0.02 * flen, 0.13 * flen) * down
        blend(ball, P["BLUSH"], 0.50)                                                                     # ball of the foot
        toes = falloff(co[:, 1] - fy0, 0.03 * flen, 0.17 * flen) * foot
        blend(toes, P["BLUSH"], 0.50)                                                                     # toe tips
        wr = np.array(B["wrist." + side].head_local)
        hand = M.body & (co[:, 0] * s > 0) & (np.linalg.norm(co - wr, axis=1) < 0.26 * bs)
        tips = M.blur(M.grow(M.group("fingernails"), 2).astype(float), 2) * hand
        blend(tips, P["BLUSH"], 0.45)                                                                     # finger tips

    # ---- lash line on the upper lid edge (and a faint one below)
    for side in (1, -1):
        loop = np.array(EYE_LOOP_L) if side > 0 else M.mirror[EYE_LOOP_L]
        skin, pocket = M.lid_rings(co, side, depth=3)
        nl = len(loop)
        up_pos = [(LOOP_INNER + k) % nl for k in range((LOOP_OUTER - LOOP_INNER) % nl + 1)]
        tt = np.zeros(n); uu = np.zeros(n, bool)                     # 0 at the inner corner .. 1 at the outer corner
        for k, pos in enumerate(up_pos):
            tt[loop[pos]] = k / (len(up_pos) - 1); uu[loop[pos]] = True
        near = np.nonzero(((skin > 0) | (pocket > 0)))[0]
        for ring_k in (1, 2, 3):                                     # spread the flag and parameter ring by ring
            for v in near:
                kk = skin[v] if skin[v] > 0 else pocket[v]
                if kk != ring_k or uu[v]:
                    continue
                arr = skin if skin[v] > 0 else pocket
                nb = [w for w in M.nbr[v] if uu[w] and arr[w] == ring_k - 1]
                if nb:
                    tt[v] = float(np.mean([tt[w] for w in nb])); uu[v] = True
        taper = 0.45 + 0.55 * C.smoothstep(tt, 0.0, 0.35)
        wing = C.smoothstep(tt, 0.62, 1.0)
        line = np.zeros(n)
        line[uu & (skin == 0)] = 1.0
        line[uu & (pocket == 1)] = 1.0
        line[uu & (skin == 1)] = 0.75
        m2 = uu & (skin == 2); line[m2] = 0.75 * wing[m2]
        m3 = uu & (skin == 3); line[m3] = 0.35 * wing[m3]
        blend(line * taper, P["LASH"], 1.0)
        low = (skin == 0) & ~uu
        blend(low.astype(float), "#9a5a4a", 0.35)

    # ---- per face corner: lips (crisp edge on the lip loops) and the inside of the mouth
    me = body.data
    nloops = len(me.loops)
    lv = np.empty(nloops, dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
    ccol = col[lv]
    lips = M.group("lips")
    oral = M.component(ORAL_SEED, M.body & ~lips)
    blendv = lambda base, colour, m: base * (1 - m[:, None]) + lin(colour) * m[:, None]
    border = lips & M.grow(M.body & ~lips & ~oral, 1)               # lip vertices on the outer (skin) border
    depth = M.depth_from(border, lips, 14).astype(float)
    depth[depth < 0] = 14
    lipc = np.tile(lin(P["LIP"]), (n, 1))
    lower = co[:, 2] < L["stomion"][2]
    hi = falloff(np.abs(co[:, 0]), 0.004 * hs, 0.016 * hs) * lower * falloff(np.abs(depth - 3.0), 0.5, 2.5)
    lipc = blendv(lipc, "#ec93a3", 0.45 * hi)                       # soft highlight on the lower lip
    lipc = blendv(lipc, "#c24e6b", 0.5 * (~lower))                  # upper lip a little deeper (it faces down)
    lipc = blendv(lipc, "#7a2338", C.smoothstep(depth, 5.6, 7.4))   # the mouth line (ring 7) and the inside
    lipc[oral] = lin(P["MOUTH_IN"])
    fl = np.all(lips[M.polys], axis=1)                              # faces wholly inside the lip group
    fo = np.all((lips | oral)[M.polys], axis=1) & ~fl
    pl = np.repeat(fl | fo, 4)                                      # all faces are quads: loops are in face order
    ccol[pl] = lipc[lv[pl]]
    st["lip_faces"] = fl

    ca = me.color_attributes.get("Col") or me.color_attributes.new("Col", 'FLOAT_COLOR', 'CORNER')
    rgba = np.concatenate([ccol, np.ones((nloops, 1))], axis=1)
    ca.data.foreach_set("color", rgba.astype(np.float32).ravel())
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = me.color_attributes.find("Col")
    me.update()


# =====================================================================================================================
#                                          regions, materials, modifiers
# =====================================================================================================================
def make_regions(st):
    """Vertex groups suit / gloves / choker (weight 1) for stage 2. Every outline is a closed edge loop of the mesh,
    so the hems are clean: glove tops at the middle of the upper arm, armholes at the top of the arm, a round neckline
    under the choker, leg hems below the crotch."""
    body, M, co, rig = st["body"], st["M"], st["co"], st["rig"]
    B = rig.data.bones
    k = st["solved"]["uniform"]
    names, W = C.bone_weights(body, rig)
    dom = np.array(names)[np.argmax(W, axis=1)]
    has = W.sum(axis=1) > 0.1
    starts = lambda *p: np.array([d.startswith(p) for d in dom]) & has & M.body

    def cut(loops, target, seed):
        """Pick the loop nearest target along the axis; return (loop mask, mask of the side that holds seed)."""
        pos, lp = min(loops, key=lambda x: abs(x[0] - target))
        lm = np.zeros(M.n, bool); lm[lp] = True
        far = M.component(int(seed), M.body & ~lm)
        return lm, far, pos

    cuts = {}
    gloves = np.zeros(M.n, bool); off = np.zeros(M.n, bool)
    cutf = np.full(M.n, 0.05)
    for side, sg in (("L", 1), ("R", -1)):
        S = np.array(B["upperarm01." + side].head_local); E = np.array(B["lowerarm01." + side].head_local)
        d = E - S; Ln = np.linalg.norm(d); d = d / Ln
        sidem = M.body & (co[:, 0] * sg > 0)
        t = (co - S) @ d / Ln
        zone = sidem & starts("upperarm", "shoulder", "clavicle", "lowerarm") & (t > -0.6) & (t < 1.0)
        loops = [(pos / Ln, lp) for pos, lp in M.ring_loops(co, zone, S, d)]
        tip = int(np.argmax(co[:, 0] * sg * sidem))                       # a fingertip
        lm, far, pg = cut(loops, 0.5, tip)
        gloves |= far | lm
        lm, far, pa = cut(loops, 0.0, tip)                                 # the innermost clean ring round the arm
        off |= far
        cuts["glove_top_t_" + side] = pg; cuts["arm_ring_t_" + side] = pa
        # sleeveless armhole: a plane (parallel to Y) through a point on the shoulder and the armpit; it does not
        # follow the mesh, so the signed distance is kept per vertex (attribute suit_cut, > 0 = under the suit)
        top = S + np.array([-sg * P["ARMHOLE_TOP_IN"], 0.0, 0.05]) * k
        pit = S + np.array([-sg * P["ARMHOLE_PIT_IN"], 0.0, -P["ARMHOLE_PIT_DOWN"]]) * k
        dx, dz = top[0] - pit[0], top[2] - pit[2]; ln = math.hypot(dx, dz)
        dist = -(((co[:, 0] - pit[0]) * dz - (co[:, 2] - pit[2]) * dx) * sg) / ln      # > 0 on the body side
        dist = np.maximum(dist, pit[2] - co[:, 2])                           # everything below the armpit is covered
        cutf = np.where(sidem, np.minimum(cutf, dist), cutf)
        cuts["armhole_plane_" + side] = dict(top=top.tolist(), pit=pit.tolist(), note="plane through top and pit, parallel to Y")
    # neck
    neck0 = np.array(B["neck01"].head_local); head0 = np.array(B["head"].head_local)
    axis = head0 - neck0; nlen = np.linalg.norm(axis); axis = axis / nlen
    tn = (co - neck0) @ axis / nlen                                        # 0 at the neck base .. 1 at the skull base
    zone = M.body & (tn > -0.5) & (tn < 1.3) & (np.abs(co[:, 0]) < 0.12 * k) & starts("neck", "spine01", "clavicle", "head", "jaw", "spine02")
    loops = [(pos / nlen, lp) for pos, lp in M.ring_loops(co, zone, neck0, axis)]
    crown = LM["crown"]
    lm_n, far_n, pn = cut(loops, P["NECKLINE_T"], crown)
    off |= far_n
    lm0, far0, p0 = cut(loops, P["CHOKER_T"][0], crown)
    lm1, far1, p1 = cut(loops, P["CHOKER_T"][1], crown)
    choker = (far0 | lm0) & ~far1
    cuts.update(neckline_t=pn, choker_t=[p0, p1])
    # legs
    hem_z = co[LM["crotch"], 2] - P["HEM_BELOW_CROTCH"] * k
    for side, sg in (("L", 1), ("R", -1)):
        H = np.array(B["upperleg01." + side].head_local); Kn = np.array(B["lowerleg01." + side].head_local)
        d = Kn - H; Ln = np.linalg.norm(d); d = d / Ln
        sidem = M.body & (co[:, 0] * sg > 0)
        zone = sidem & starts("upperleg", "lowerleg")
        loops = [(float(co[lp][:, 2].mean()), lp) for pos, lp in M.ring_loops(co, zone, H, d)]
        toe = int(np.argmin(np.where(sidem, co[:, 1] + co[:, 2], 1e9)))
        lm, far, ph = cut(loops, hem_z, toe)
        off |= far
        cuts["hem_z_" + side] = ph
    cutf = np.clip(np.where(off, -0.05, cutf), -0.05, 0.05)
    suit = M.body & ~off & (cutf >= 0)
    att = body.data.attributes.get("suit_cut") or body.data.attributes.new("suit_cut", 'FLOAT', 'POINT')
    att.data.foreach_set("value", cutf.astype(np.float32))
    for nm, m in (("suit", suit), ("gloves", gloves), ("choker", choker)):
        C.set_vg(body, nm, m)
    st["regions"] = dict(suit=suit, gloves=gloves, choker=choker, off=off)
    st["cuts"] = cuts
    log("regions: suit %d gloves %d choker %d verts; cuts %s" % (suit.sum(), gloves.sum(), choker.sum(),
        {kk: (round(v, 3) if isinstance(v, float) else v) for kk, v in cuts.items() if not isinstance(v, dict)}))


def make_materials(st):
    """Anne_Skin (uses Col), Anne_Nail, and flat 'paint' materials on the suit / glove / choker regions so that every
    check render shows her dressed (stage 2 replaces them with real garments)."""
    body, M = st["body"], st["M"]
    me = body.data
    skin = C.make_material("Anne_Skin", P["SKIN"], rough=0.46, sss=0.30, sss_radius=(1.0, 0.35, 0.2), sss_scale=0.006, vcol="Col")
    nail = C.make_material("Anne_Nail", P["NAIL"], rough=0.12, coat=1.0)
    suitm = C.make_material("Anne_SuitPaint", P["SUIT"], rough=0.6)
    nt = suitm.node_tree; bs = nt.nodes["BSDF"]                 # suit colour where suit_cut > 0, painted skin elsewhere
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "suit_cut"; at.location = (-700, 150)
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.0; gt.location = (-500, 150)
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"; vc.location = (-500, -80)
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = 'RGBA'; mx.location = (-280, 60)
    nt.links.new(at.outputs["Fac"], gt.inputs[0]); nt.links.new(gt.outputs[0], mx.inputs[0])
    nt.links.new(vc.outputs["Color"], mx.inputs[6]); mx.inputs[7].default_value = C.hex_lin(P["SUIT"])
    nt.links.new(mx.outputs[2], bs.inputs["Base Color"])
    glovem = C.make_material("Anne_GlovePaint", P["GLOVE"], rough=0.38, sheen=0.3)
    me.materials.clear()
    for m in (skin, nail, suitm, glovem):
        me.materials.append(m)
    R = st["regions"]
    nails = M.group("toenails") | M.group("fingernails")
    idx = np.zeros(len(M.polys), dtype=np.int32)
    allin = lambda m: np.all(m[M.polys], axis=1)
    idx[allin(nails)] = 1
    idx[np.any(R["suit"][M.polys], axis=1) & ~np.any(R["off"][M.polys], axis=1)] = 2
    idx[allin(R["gloves"]) | allin(R["choker"])] = 3
    me.polygons.foreach_set("material_index", idx)
    me.update()
    st["face_material"] = idx
    log("body modifiers", [(m.name, m.type) for m in body.modifiers], "materials", [m.name for m in me.materials],
        "faces nail/suit/purple", int((idx == 1).sum()), int((idx == 2).sum()), int((idx == 3).sum()))


# =====================================================================================================================
#                                                     build
# =====================================================================================================================
def build(opt):
    HumanService, TargetService, LocationService = C.enable_mpfb()
    sc = C.new_file()
    sc.name = C.SCENE
    C.use_collection(C.COLLECTION, sc)
    SYS, USR = C.mpfb_paths()

    # ---------------------------------------------------------------- base mesh, macro targets
    body = HumanService.create_human(macro_detail_dict=MACRO, scale=0.1, feet_on_ground=True)
    body.name = C.BODY
    with C.override(body):
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    M = Mesh(body, SYS)
    co_macro = C.get_co(body)                      # MakeHuman shape before any stylisation (expression targets refer to it)

    # ---------------------------------------------------------------- detail targets
    used = []
    for name, wgt in TARGETS:
        for nm in ([name.replace("?-", "l-"), name.replace("?-", "r-")] if "?-" in name else [name]):
            path = os.path.join(SYS, "targets", nm + ".target.gz")
            assert os.path.exists(path), "missing target " + nm
            if abs(wgt) < 1e-6:
                continue
            k = TargetService.load_target(body, path, weight=0.0)
            k.slider_max = 10.0; k.slider_min = -10.0
            k.value = wgt
            used.append((nm, wgt))
    if body.data.shape_keys:
        with C.override(body):
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    co = C.get_co(body)
    log("targets", len(used), "moved verts", int((np.linalg.norm(co - co_macro, axis=1) > 1e-6).sum()))

    # ---------------------------------------------------------------- eyes: lids, head shape, region scale
    co = head_shape(M, co, P["HEAD_XYZ"])
    pre = {}
    for side in (1, -1):
        ce0, R0 = eye_frame(co, side)
        skin, pocket = M.lid_rings(co, side, depth=8)
        hv = co[HELP_EYE_L if side > 0 else HELP_EYE_R] - ce0
        pre[side] = (ce0, R0, np.linalg.norm(co - ce0, axis=1) / R0, skin, pocket, hv / np.linalg.norm(hv, axis=1)[:, None])
    co, eye_ann = eye_region_scale(M, co)
    co = eye_sphere(M, co, pre)
    lid_info = {}
    for side in (1, -1):
        co, lid_info[side] = lid_slide(M, co, side)
    log("lid slide", {k: round(v, 3) for k, v in lid_info[1].items()}, "iris deg %.1f" % P["IRIS_DEG"],
        "eyeball radius x MakeHuman %.2f" % (eye_frame(co, 1)[1] / pre[1][1]))
    co, nfix = lid_clearance(M, co)
    co = simplify_face(M, co, eye_ann)
    co, nfix2 = lid_clearance(M, co)
    log("lid clearance (edge fixed, skin lifted over the eyeball): before smoothing %s, after %s" % (nfix, nfix2))
    co = M.symmetrise(co)
    co = lip_shape(M, co)
    co, lgap = seal_lips(M, co, P["LIP_OVERLAP"])
    log("lip seal: remaining gap after subdivision %.5f" % lgap)

    # ---------------------------------------------------------------- proportions: head, legs, feet, height
    co = M.symmetrise(co)
    co = toe_shape(M, co)
    base = co.copy()
    sH, sL, sF = 1.4, 1.3, 1.25
    for it in range(7):
        co = base.copy()
        L0 = {k: co[i].copy() for k, i in LM.items()}
        co = head_scale(co, L0, sH)
        ankle_z = co[M.group("joint-l-ankle")].mean(0)[2]
        crotch_z = co[LM["crotch"], 2]
        co = stretch_z(co, ankle_z + 0.02, crotch_z - 0.01, sL)
        co = foot_scale(M, co, sF, 1.0 + (sF - 1.0) * P["FOOT_WIDE"], 1.0 + (sF - 1.0) * P["FOOT_HIGH"], ankle_z)
        zmin = co[M.body][:, 2].min()
        co[:, 2] -= zmin
        H = co[M.body][:, 2].max()
        head_h = co[LM["crown"], 2] - co[LM["menton"], 2]
        crotch = co[LM["crotch"], 2]
        foot = co[M.body & (co[:, 2] < ankle_z * 1.2) & (co[:, 0] > 0)]
        foot_len = foot[:, 1].max() - foot[:, 1].min()
        r_head, r_crotch, r_foot = head_h / H, crotch / H, foot_len / H
        if it == 6:
            break
        sH *= P["HEAD_RATIO"] / r_head
        sL *= (P["CROTCH_RATIO"] / r_crotch) ** 1.6
        sF *= P["FOOT_RATIO"] / r_foot
    k = P["HEIGHT"] / H
    co *= k
    log("solved head scale %.3f leg stretch %.3f foot scale %.3f uniform %.3f | ratios head 1/%.2f crotch %.3f foot %.3f" %
        (sH, sL, sF, k, 1 / r_head, r_crotch, r_foot))
    co = M.symmetrise(co)
    co = soften_body(M, co)
    co, zj = legs_in(M, co, P["LEGS_IN"])
    log("legs moved in by %.3f m below the hip joints (z %.3f)" % (P["LEGS_IN"], zj))
    co = M.symmetrise(co)
    co[:, 2] -= co[M.body][:, 2].min()
    C.set_co(body, co)

    # the unstylised MakeHuman shape, kept for retargeting expression targets (see common.py)
    att = body.data.attributes.new("mh_rest", 'FLOAT_VECTOR', 'POINT')
    att.data.foreach_set("vector", co_macro.astype(np.float32).ravel())

    # ---------------------------------------------------------------- rig, eyes, teeth
    HumanService.add_builtin_rig(body, "default")
    rig = body.parent
    rig.name = C.RIG; rig.data.name = C.RIG
    eyes = HumanService.add_mhclo_asset(os.path.join(USR, "eyes/high-poly/high-poly.mhclo"), body, asset_type="Eyes",
                                        subdiv_levels=0, material_type="MAKESKIN")
    teeth = HumanService.add_mhclo_asset(os.path.join(USR, "teeth/teeth_base/teeth_base.mhclo"), body, asset_type="Teeth",
                                         subdiv_levels=0, material_type="MAKESKIN")
    eyes.name = C.EYES; teeth.name = C.TEETH
    eyes.data.name = C.EYES; teeth.data.name = C.TEETH; body.data.name = C.BODY
    if body.data.shape_keys:
        with C.override(body):
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for o in (body, eyes, teeth):
        C.shade_smooth(o)

    st = dict(sc=sc, body=body, rig=rig, eyes=eyes, teeth=teeth, M=M, co=co, used=used, lid=lid_info,
              solved=dict(head_scale=sH, leg_stretch=sL, foot_scale=sF, uniform=k), SYS=SYS, USR=USR)
    finish_eyes(st, opt)
    finish_teeth(st)
    paint_skin(st)
    make_regions(st)
    make_materials(st)
    measure(st)
    return st


def face_landmarks(M, co):
    """Landmarks by vertex id, with the nose points found geometrically on the midline profile (the eye operator
    slides the skin of nose and brow, so their vertex ids no longer mark the anatomical points)."""
    lmk = {k: co[i].copy() for k, i in LM.items()}
    eye_z = 0.5 * (co[EYE_LOOP_L[LOOP_TOP], 2] + co[EYE_LOOP_L[LOOP_BOTTOM], 2])
    strip = M.body & (np.abs(co[:, 0]) < 0.004) & (co[:, 1] < lmk["lip_up"][1] + 0.03)
    nose = strip & (co[:, 2] > lmk["lip_top"][2] + 0.004) & (co[:, 2] < eye_z)
    i_tip = np.nonzero(nose)[0][np.argmin(co[nose][:, 1])]
    lmk["nose_tip"] = co[i_tip].copy()
    below = strip & (co[:, 2] > lmk["lip_top"][2] + 0.002) & (co[:, 2] < lmk["nose_tip"][2] - 0.002)
    if below.any():
        lmk["subnasale"] = co[np.nonzero(below)[0][np.argmax(co[below][:, 1])]].copy()
    above = strip & (co[:, 2] > lmk["nose_tip"][2] + 0.004) & (co[:, 2] < eye_z + 0.03)
    if above.any():
        lmk["nasion"] = co[np.nonzero(above)[0][np.argmax(co[above][:, 1])]].copy()
    brow = strip & (co[:, 2] > lmk["nasion"][2] + 0.004) & (co[:, 2] < lmk["nasion"][2] + 0.05)
    if brow.any():
        lmk["glabella"] = co[np.nonzero(brow)[0][np.argmin(co[brow][:, 1])]].copy()
    return lmk


def measure(st):
    """Print and collect the proportions the spec asks for."""
    co, M, rig = st["co"], st["M"], st["rig"]
    B = rig.data.bones
    lmk = face_landmarks(M, co)
    H = co[M.body][:, 2].max()
    head_h = lmk["crown"][2] - lmk["menton"][2]
    loopL = np.array(EYE_LOOP_L)
    eye_w = co[loopL][:, 0].max() - co[loopL][:, 0].min()
    eye_h = co[loopL[0], 2] - co[loopL[15], 2]
    inner_gap = 2 * co[loopL][:, 0].min()
    ez = 0.5 * (co[loopL[0], 2] + co[loopL[15], 2])
    ears = M.group("ears")
    band = M.body & ~ears & (np.abs(co[:, 2] - ez) < 0.012)
    face_w = 2 * np.abs(co[band][:, 0]).max()
    cheek_w = 2 * np.abs(co[M.body & ~ears & (np.abs(co[:, 2] - lmk["subnasale"][2]) < 0.01)][:, 0]).max()
    jaw_w = 2 * np.abs(co[M.body & ~ears & (np.abs(co[:, 2] - lmk["stomion"][2]) < 0.008)][:, 0]).max()
    lips = M.group("lips")
    mouth_w = co[lips][:, 0].max() - co[lips][:, 0].min()
    head = M.body & ~ears & (co[:, 2] > lmk["menton"][2])
    head_w = 2 * np.abs(co[head][:, 0]).max()
    hd = M.body & (co[:, 2] > lmk["stomion"][2])
    head_d = co[hd][:, 1].max() - co[hd][:, 1].min()
    nz = 0.5 * (lmk["menton"][2] + B["neck01"].head_local.z)
    neck = M.body & (np.abs(co[:, 2] - nz) < 0.008) & (np.abs(co[:, 0]) < 0.12)
    neck_w = 2 * np.abs(co[neck][:, 0]).max()
    sh = B["upperarm01.L"].head_local
    foot = M.body & (co[:, 2] < B["foot.L"].head_local.z * 1.15) & (co[:, 0] > 0)
    fy0, fy1 = co[foot][:, 1].min(), co[foot][:, 1].max()
    fx0, fx1 = co[foot][:, 0].min(), co[foot][:, 0].max()
    ref_y = lmk["glabella"][1]
    hipz = B["upperleg01.L"].head_local.z
    def width_at(z, tol=0.01, xmax=0.30):
        m = M.body & (np.abs(co[:, 2] - z) < tol) & (np.abs(co[:, 0]) < xmax)
        return 2 * np.abs(co[m][:, 0]).max()
    waist_z = B["spine03"].head_local.z
    r = dict(
        height=H, head_height=head_h, head_ratio=H / head_h, head_width=head_w, head_depth=head_d,
        head_w_over_h=head_w / head_h,
        crotch_z=lmk["crotch"][2], crotch_ratio=lmk["crotch"][2] / H,
        eye_line_from_chin=(ez - lmk["menton"][2]) / head_h,
        eye_width=eye_w, eye_height=eye_h, eye_h_over_w=eye_h / eye_w, face_width_at_eyes=face_w,
        eye_w_over_face_w=eye_w / face_w, inner_gap_over_eye_w=inner_gap / eye_w,
        nose_tip_from_chin=(lmk["nose_tip"][2] - lmk["menton"][2]) / head_h,
        subnasale_from_chin=(lmk["subnasale"][2] - lmk["menton"][2]) / head_h,
        mouth_from_chin=(lmk["stomion"][2] - lmk["menton"][2]) / head_h,
        mouth_w=mouth_w, mouth_w_over_eye_w=mouth_w / eye_w, cheek_w_over_face_w=cheek_w / face_w, jaw_w_over_face_w=jaw_w / face_w,
        prof_nasion=lmk["nasion"][1] - ref_y, prof_nose_tip=lmk["nose_tip"][1] - ref_y, prof_subnasale=lmk["subnasale"][1] - ref_y,
        prof_lip_up=lmk["lip_up"][1] - ref_y, prof_lip_low=lmk["lip_low"][1] - ref_y, prof_chin=lmk["chin"][1] - ref_y,
        prof_forehead=lmk["forehead"][1] - ref_y,
        neck_width=neck_w, neck_w_over_head_w=neck_w / head_w,
        shoulder_z=sh.z, shoulder_joint_width=2 * sh.x, shoulder_w_over_head_w=2 * sh.x / head_w,
        waist_w=width_at(waist_z, xmax=0.2), hip_w=width_at(hipz, xmax=0.26),
        foot_length=fy1 - fy0, foot_width=fx1 - fx0, foot_ratio=(fy1 - fy0) / H,
    )
    st["ratios"] = r
    log("MEASURE " + "  ".join("%s=%.3f" % (k, v) for k, v in r.items()))
    info = dict(
        height=H, head_top_z=lmk["crown"][2], chin_z=lmk["menton"][2], head_height=head_h,
        eye_centre_L=list(B["eye.L"].head_local), eye_centre_R=list(B["eye.R"].head_local),
        eye_radius=st.get("eye_radius", {}).get(1), neck_base_z=B["neck01"].head_local.z, shoulder_z=sh.z, shoulder_x=sh.x,
        crotch_z=lmk["crotch"][2], knee_z=B["lowerleg01.L"].head_local.z, ankle_z=B["foot.L"].head_local.z,
        foot_length=fy1 - fy0, heel_y=fy1, toe_y=fy0, foot_width=fx1 - fx0,
        ratios=r, macro=MACRO, targets=[[n, w] for n, w in st["used"]], params={k: v for k, v in P.items()},
        solved=st["solved"], landmarks={k: list(v) for k, v in lmk.items()}, landmark_vertices=LM,
        eye_loop_L=[int(i) for i in EYE_LOOP_L], eye_loop_R=[int(i) for i in M.mirror[EYE_LOOP_L]],
        eye_loop_note="eyelid margin loop: index 0 = top centre, then outwards, outer corner at 7, bottom centre 15, inner corner 21",
    )
    def clean(o):
        if isinstance(o, dict): return {str(k): clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)): return [clean(v) for v in o]
        if isinstance(o, np.ndarray): return [clean(v) for v in o.tolist()]
        if isinstance(o, (np.floating, float)): return round(float(o), 5)
        if isinstance(o, (np.integer,)): return int(o)
        return o
    st["info"] = clean(info)


# =====================================================================================================================
#                                  check renders (and render-only preview dressing)
# =====================================================================================================================
def brow_points(st, n=22):
    """Brow design in the front view (units of one eye width from the centre of the eye opening), projected on the
    face. Returns for her left brow three rows of points (lower edge, centre line, upper edge) lying on the skin."""
    co, M = st["co"], st["M"]
    loop = np.array(EYE_LOOP_L)
    W = co[loop][:, 0].max() - co[loop][:, 0].min()
    xc = 0.5 * (co[loop][:, 0].max() + co[loop][:, 0].min())
    zc = 0.5 * (co[loop[LOOP_TOP], 2] + co[loop[LOOP_BOTTOM], 2])
    # (x, z, thickness) at the inner end, the peak and the tail
    key = np.array([[-0.58, 0.40, 0.125], [0.20, 0.57, 0.095], [0.76, 0.43, 0.02]])
    t = np.linspace(0, 1, n)
    tp = 0.6                                           # the curve passes through the peak at t = 0.6
    ctrl = (key[1] - (1 - tp) ** 2 * key[0] - tp ** 2 * key[2]) / (2 * tp * (1 - tp))
    cur = ((1 - t) ** 2)[:, None] * key[0] + (2 * t * (1 - t))[:, None] * ctrl + (t ** 2)[:, None] * key[2]
    polys = [tuple(int(i) for i in p) for p in M.polys if p.max() < BODY_N]
    bvh = BVHTree.FromPolygons([tuple(v) for v in co[:BODY_N]], polys)
    rows = []
    for off in (-0.5, 0.0, 0.5):
        pts = []
        for x, z, th in cur:
            X = xc + x * W; Z = zc + (z + off * th) * W
            hit = bvh.ray_cast(Vector((X, -1.0, Z)), Vector((0, 1, 0)))
            if hit[0] is not None and (not pts or abs(hit[0][1] - pts[-1][0][1]) < 0.012):
                pts.append((np.array(hit[0]), np.array(hit[1])))
            else:
                py = pts[-1][0][1] + 0.004 if pts else co[loop[0], 1]
                pts.append((np.array([X, py, Z]), pts[-1][1] if pts else np.array([0.0, -1.0, 0.0])))
        rows.append(pts)
    return rows


def preview_dressing(st):
    """Render-only stand-ins for what stage 2 builds (brows, a hair cap), so the face can be judged. Never saved."""
    co, M, sc = st["co"], st["M"], st["sc"]
    coll = bpy.data.collections.new("S1_Preview"); sc.collection.children.link(coll)
    objs = []
    rows = brow_points(st)
    verts, faces = [], []
    for side in (1, -1):
        base = len(verts)
        n = len(rows[0])
        for r in rows:
            for pt, nr in r:
                q = pt + nr * 0.0016
                verts.append((q[0] * side, q[1], q[2]))
        for r in range(2):
            for i in range(n - 1):
                a = base + r * n + i
                f = (a, a + 1, a + n + 1, a + n)
                faces.append(f if side > 0 else f[::-1])
    me = bpy.data.meshes.new("S1_PreviewBrows"); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new("S1_PreviewBrows", me); coll.objects.link(ob)
    me.materials.append(C.make_material("S1_PreviewBrow", "#8a3f1c", rough=0.7))
    C.shade_smooth(ob)
    objs.append(ob)
    # hair cap from the scalp group, pushed out
    scalp = M.group("scalp")
    nrm = M.normals(co)
    fsel = np.all(scalp[M.polys], axis=1)
    used = np.unique(M.polys[fsel])
    remap = {int(v): i for i, v in enumerate(used)}
    hs = st["solved"]["head_scale"] * st["solved"]["uniform"]
    edge = M.depth_from(scalp & M.grow(M.body & ~scalp, 1), scalp, 6)
    lift = 0.004 + 0.010 * C.smoothstep(edge[used].astype(float), 0, 3)
    hv = co[used] + nrm[used] * (lift * hs)[:, None]
    hf = [tuple(remap[int(v)] for v in f) for f in M.polys[fsel]]
    hm = bpy.data.meshes.new("S1_PreviewHair"); hm.from_pydata([tuple(v) for v in hv], [], hf); hm.update()
    ho = bpy.data.objects.new("S1_PreviewHair", hm); coll.objects.link(ho)
    hm.materials.append(C.make_material("S1_PreviewHairMat", "#d9682a", rough=0.5))
    C.shade_smooth(ho); C.add_subsurf(ho, 2)
    objs.append(ho)
    return objs


def resize_bilinear(a, w, h):
    H, W = a.shape[:2]
    ys = (np.arange(h) + 0.5) * H / h - 0.5; xs = (np.arange(w) + 0.5) * W / w - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, H - 1); x0 = np.clip(np.floor(xs).astype(int), 0, W - 1)
    y1 = np.clip(y0 + 1, 0, H - 1); x1 = np.clip(x0 + 1, 0, W - 1)
    fy = np.clip(ys - y0, 0, 1)[:, None, None]; fx = np.clip(xs - x0, 0, 1)[None, :, None]
    return (a[y0][:, x0] * (1 - fy) * (1 - fx) + a[y0][:, x1] * (1 - fy) * fx + a[y1][:, x0] * fy * (1 - fx) + a[y1][:, x1] * fy * fx)


def renders(st, opt):
    out = opt["out"] or C.RENDERS
    tag = opt["tag"]
    views = [v for v in opt["views"].split(",") if v and v != "none"]
    if not views:
        return
    sc, body, rig, co = st["sc"], st["body"], st["rig"], st["co"]
    C.setup_stage(sc)
    C.add_subsurf(body, 1)
    crown = co[LM["crown"]]; chin = co[LM["menton"]]
    cz = 0.5 * (crown[2] + chin[2]) - 0.01
    fy = co[LM["nose_tip"], 1]
    p = lambda name: os.path.join(out, "%s_%s.png" % (tag, name))
    def face_views(suffix=""):
        C.shot(p("face_front" + suffix), (0.0, fy - 2.2, cz), (0, fy, cz), lens=140, res=(640, 720))
        C.shot(p("face_34" + suffix), (1.35, fy - 1.75, cz + 0.05), (0, fy + 0.07, cz), lens=140, res=(640, 720))
        C.shot(p("face_side" + suffix), (2.2, fy + 0.09, cz), (0, fy + 0.09, cz), lens=140, res=(640, 720))
    if "face" in views:
        face_views()
    if "eyes" in views:
        ez = 0.5 * (co[EYE_LOOP_L[0], 2] + co[EYE_LOOP_L[15], 2])
        C.shot(p("eyes"), (0.0, fy - 1.6, ez), (0, fy, ez), lens=260, res=(800, 360))
    if "detail" in views:
        ec = st["eye_centre"][1]; er = st["eye_radius"][1]
        m = co[LM["stomion"]]; nt = co[LM["nose_tip"]]
        C.shot(p("detail_eye_front"), (ec[0], ec[1] - 1.2, ec[2]), tuple(ec), lens=600, res=(640, 480))
        C.shot(p("detail_eye_34"), (ec[0] + 0.75, ec[1] - 0.95, ec[2] + 0.12), (ec[0], ec[1] - er, ec[2]), lens=560, res=(640, 480))
        C.shot(p("detail_eye_side"), (ec[0] + 1.2, ec[1] - 0.25, ec[2] + 0.02), (ec[0], ec[1] - er, ec[2]), lens=600, res=(640, 480))
        C.shot(p("detail_mouth_front"), (0.0, m[1] - 1.2, m[2] + 0.01), (0, m[1], m[2] + 0.012), lens=420, res=(640, 480))
        C.shot(p("detail_mouth_34"), (0.8, m[1] - 0.95, m[2] + 0.05), (0, m[1] + 0.01, m[2] + 0.012), lens=420, res=(640, 480))
        C.shot(p("detail_ear"), (1.2, ec[1] + 0.35, ec[2]), (0.09, ec[1] + 0.12, ec[2] - 0.02), lens=420, res=(640, 480))
    if "body" in views:
        H = P["HEIGHT"]
        C.shot(p("body_front"), (0.0, -6.2, H * 0.52), (0, 0, H * 0.5), lens=85, res=(480, 760))
        C.shot(p("body_side"), (6.2, 0.0, H * 0.52), (0, 0, H * 0.5), lens=85, res=(480, 760))
        C.shot(p("body_back"), (0.0, 6.2, H * 0.52), (0, 0, H * 0.5), lens=85, res=(480, 760))
    if "feet" in views:
        B = rig.data.bones
        a = np.array(B["foot.L"].head_local)
        fx = a[0]; fyc = 0.5 * (st["info"]["heel_y"] + st["info"]["toe_y"])
        C.shot(p("feet_34"), (0.62, -0.95, 0.50), (0.0, fyc - 0.02, 0.05), lens=95, res=(720, 480))
        C.shot(p("feet_front"), (0.0, -1.3, 0.22), (0.0, fyc, 0.045), lens=85, res=(720, 400))
        C.shot(p("feet_side"), (1.4, fyc, 0.10), (0.0, fyc, 0.06), lens=115, res=(720, 400))
        C.shot(p("foot_top"), (fx + 0.22, fyc - 0.42, 0.50), (fx, fyc - 0.03, 0.03), lens=110, res=(560, 480))
        C.shot(p("foot_inner"), (fx - 0.55, fyc - 0.25, 0.16), (fx, fyc, 0.045), lens=110, res=(640, 400))
        # soles seen from behind in the cut-scene pose (lying face down, shins up)
        C.test_pose(rig, "d")
        ev = C.eval_verts(body)
        foot = st["M"].body & (st["co"][:, 2] < a[2] * 1.2)
        c = 0.5 * (ev[foot].min(0) + ev[foot].max(0))
        n = np.array([0.0, 0.64, 0.77])                               # the soles face back and up in this pose
        C.shot(p("soles_behind"), tuple(c + n * 1.5), tuple(c), lens=105, res=(760, 440))
        fm = foot & (st["co"][:, 0] > 0)
        fl = 0.5 * (ev[fm].min(0) + ev[fm].max(0))
        C.shot(p("sole_close"), tuple(fl + (n + np.array([0.12, 0, 0])) * 0.9), tuple(fl), lens=150, res=(460, 600))
        C.shot(p("prone_side"), (2.6, 0.2, 0.9), (0.0, 0.1, 0.25), lens=60, res=(760, 480))
        C.test_pose(rig, "rest")
    if "preview" in views or "compare" in views:
        extra = preview_dressing(st)
        face_views("_preview")
        if "compare" in views:
            compare_sheet(st, opt, p)
        for o in extra:
            bpy.data.objects.remove(o, do_unlink=True)


def compare_sheet(st, opt, p):
    """Side by side: the player's reference face, Anne with the render-only preview brows and hair cap, Anne bare."""
    import glob
    found = glob.glob("/Users/harrisontoppenryan/Documents/Elektratouch/Screenshot 2026-09-29 at 9.04.26*PM.png")
    ref = found[0] if found else ""
    tiles = []
    if os.path.exists(ref):
        a = C.load_pixels(ref)                                # rows bottom-up
        H, W = a.shape[:2]
        x0, x1, ytop, ybot = int(0.10 * W), int(0.58 * W), int(0.015 * H), int(0.32 * H)
        tiles.append(a[H - ybot:H - ytop, x0:x1, :])
    for name in ("face_34_preview", "face_front_preview", "face_front", "face_34"):
        f = p(name)
        if os.path.exists(f):
            tiles.append(C.load_pixels(f))
    th = 600
    rs = [resize_bilinear(t, int(t.shape[1] * th / t.shape[0]), th) for t in tiles]
    W = sum(t.shape[1] for t in rs) + 6 * (len(rs) + 1)
    sheet = np.ones((th + 12, W, 4), dtype=np.float32) * np.array([0.15, 0.15, 0.17, 1.0], dtype=np.float32)
    x = 6
    for t in rs:
        sheet[6:6 + th, x:x + t.shape[1], :] = t
        x += t.shape[1] + 6
    C.save_pixels(p("compare"), sheet)


if __name__ == "__main__":
    opt = parse_args()
    st = build(opt)
    if not opt["nosave"]:
        os.makedirs(C.BUILD, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=C.S1_BLEND)
        with open(C.S1_JSON, "w") as f:
            json.dump(st["info"], f, indent=1)
    renders(st, opt)
    log("done")
