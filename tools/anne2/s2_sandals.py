"""Anne v2, stage 2: purple sandals (in place of the pumps of s2_shoes.py), so that her feet show.

    build(ctx) adds Anne_Heel_L / Anne_Heel_R (rigged; the names are kept: the game and the other stages know her shoes
    by them), Anne_HeelProp (one loose right sandal standing on the ground) and writes build/anne2_shoes.json.

A sandal here is: a thin sole cut to the outline of her foot, a little thicker under the heel; a broad band over the
ball of the foot (behind the toe joints, so her toes stay free to move); a narrow strap over the instep; a strap round
the ankle and one up the back of the heel to it. Nothing of the foot is hidden, so no skin is set aside (the pumps
gave the skin inside them materials of its own, Anne_SkinShod, which the game hid).

Every strap is a slice of the foot itself: the convex outline of the skin in a thin slab, pushed out by the clearance
(inner face) and by clearance + thickness (outer face). The foot pitches by theta = asin(heel lift / heel-to-ball), as
with the pumps; here that is a few degrees.
"""
import bpy, bmesh, math, os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import s2_util as S
from s2_util import Body, log
import s2_shoes as SH                     # foot_points, outline, pose_in_heels

P = dict(
    PURPLE="#6a34a6", SOLE="#2a1247",
    MARGIN=0.0030,            # the sole stands this far out round the print of her foot
    GAP=0.0009,               # between her skin and the insole
    T_HEEL=0.0165, T_BALL=0.0065, T_TIP=0.0045,     # the sole's thickness under the heel, under the ball, at the tip
    BALL=0.72, BEND=(0.72, 0.86),                   # the ball of the foot; the sole bends with her toes between these
    CLEAR=0.0009, THICK=0.0018,                     # a strap: off the skin, and how thick
    TOE_BAND=(0.655, 0.019),  # the band over the ball: where (fraction of the foot length from the heel) and how wide
    INSTEP=(0.535, 0.010),    # the strap over the instep (in front of where the shin comes down)
    ANKLE_Z=0.101, ANKLE_W=0.010,                   # the strap round the ankle (above the ankle bones): height above the sole, width
    BACK_W=0.013,             # the strap up the back of the heel
    NS=52, NX=6,              # sections along the sole, quads across it
)


def resample(poly, n, closed=False):
    """n points evenly spaced along a polyline (2D or 3D)."""
    p = np.asarray(poly, float)
    if closed: p = np.vstack([p, p[:1]])
    d = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    t = np.linspace(0.0, d[-1], n + 1)[:-1] if closed else np.linspace(0.0, d[-1], n)
    return np.stack([np.interp(t, d, p[:, k]) for k in range(p.shape[1])], axis=1)


def span(H, y):
    """Where the horizontal line at height y crosses a convex polygon H (x, y): (xmin, xmax) or None."""
    xs = []; n = len(H)
    for i in range(n):
        a, b = H[i], H[(i + 1) % n]
        if (a[1] - y) * (b[1] - y) <= 0 and abs(a[1] - b[1]) > 1e-12:
            xs.append(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]))
    return (min(xs), max(xs)) if len(xs) >= 2 else None


class Mesh:
    """Vertices, faces, a material per face and a weight row per vertex, collected part by part."""
    def __init__(self, nb): self.V, self.F, self.M, self.W, self.nb = [], [], [], [], nb
    def add(self, verts, faces, mat, weights):
        b = len(self.V)
        self.V += [tuple(float(x) for x in v) for v in verts]
        self.F += [tuple(b + i for i in f) for f in faces]
        self.M += [mat] * len(faces) if isinstance(mat, int) else list(mat)
        self.W += list(weights)


def strip(inner, outer):
    """A closed strap from two layers of ribs (inner[i][k], outer[i][k]: rib i, point k): faces for the outer skin, the
    inner skin, the two long edges and the two ends. Returns (verts, faces)."""
    ni, nk = len(inner), len(inner[0]); V = []; F = []
    for layer in (inner, outer):
        for rib in layer: V += [tuple(p) for p in rib]
    I = lambda l, i, k: l * ni * nk + i * nk + k
    for i in range(ni - 1):
        for k in range(nk - 1):
            F.append((I(1, i, k), I(1, i, k + 1), I(1, i + 1, k + 1), I(1, i + 1, k)))
            F.append((I(0, i, k), I(0, i + 1, k), I(0, i + 1, k + 1), I(0, i, k + 1)))
    for k in range(nk - 1):                               # the long edges (first and last rib)
        F.append((I(0, 0, k), I(0, 0, k + 1), I(1, 0, k + 1), I(1, 0, k)))
        F.append((I(0, ni - 1, k), I(1, ni - 1, k), I(1, ni - 1, k + 1), I(0, ni - 1, k + 1)))
    for i in range(ni - 1):                               # the two ends
        F.append((I(0, i, 0), I(1, i, 0), I(1, i + 1, 0), I(0, i + 1, 0)))
        F.append((I(0, i, nk - 1), I(0, i + 1, nk - 1), I(1, i + 1, nk - 1), I(1, i, nk - 1)))
    return V, F


def ring(inner, outer):
    """A closed band round the leg from two layers of closed ribs. Returns (verts, faces)."""
    ni, nk = len(inner), len(inner[0]); V = []; F = []
    for layer in (inner, outer):
        for rib in layer: V += [tuple(p) for p in rib]
    I = lambda l, i, k: l * ni * nk + i * nk + (k % nk)
    for i in range(ni - 1):
        for k in range(nk):
            F.append((I(1, i, k), I(1, i, k + 1), I(1, i + 1, k + 1), I(1, i + 1, k)))
            F.append((I(0, i, k), I(0, i + 1, k), I(0, i + 1, k + 1), I(0, i, k + 1)))
    for k in range(nk):
        F.append((I(0, 0, k), I(0, 0, k + 1), I(1, 0, k + 1), I(1, 0, k)))
        F.append((I(0, ni - 1, k), I(1, ni - 1, k), I(1, ni - 1, k + 1), I(0, ni - 1, k + 1)))
    return V, F


# ----------------------------------------------------------------------------------------------- the styles (10-02)
# What the player may put on her feet. The FLAT ones share one sole (so they share the foot's pitch, and the clips that
# were made for it); the two with a high heel have a thin sole and a stiletto, and the game pitches her feet further for
# them (dtheta) and lifts her (lift). Every style has the same two materials in the same order (the game swaps the
# loose shoes' geometry in place).
#   straps: ("band", t, width) a band over the foot at t (fraction of its length from the heel) | ("ankle",) | ("back", width)
#           ("thong", t_end) a post between the first two toes and a V of two straps to the sole's edges at t_end
#           ("tee",) the post and one strap up the middle of the foot to the ankle strap
#           ("tbar", t) the post and one strap back to the middle of the band at t
#           ("upper",) a closed upper: toe box, low sides, heel counter; ("upper", "mule"): the toe box only, open behind
#           ("spine", t) one strap up the middle of the foot from the band at t to the ankle strap (no toe post)
#           ("xband", t_inner, t_outer, width, lift) a band over the foot on a slant (two of them cross; `lift`: the upper one)
#           style["wedge"]: under a high heel, the sole's outline carried down to the ground instead of a stiletto
STYLES = [
    dict(id="sandal", label="Strappy sandals", heel=0.0, straps=[("band", 0.655, 0.019), ("band", 0.535, 0.010), ("ankle",), ("back", 0.013)]),
    dict(id="flipflop", label="Flip-flops", heel=0.0, straps=[("thong", 0.47)]),
    dict(id="tstrap", label="T-strap sandals", heel=0.0, straps=[("ankle",), ("tee",), ("back", 0.011)]),
    dict(id="slide", label="Slides", heel=0.0, straps=[("band", 0.645, 0.042)]),
    dict(id="toeloop", label="Toe-post sandals", heel=0.0, straps=[("band", 0.615, 0.011), ("tbar", 0.615)]),      # (his photos IMG_9617-19: a band over the foot and a strap from its middle down between the first two toes)
    dict(id="heels", label="Open-toe high heels", heel=0.058, straps=[("band", 0.665, 0.024), ("ankle",), ("back", 0.020)]),
    dict(id="pumps", label="Closed-toe high heels", heel=0.058, closed=True, straps=[("upper",)]),
    # (10-03, as he asked: more kinds of shoe)
    dict(id="gladiator", label="Gladiator sandals", heel=0.0, straps=[("band", 0.675, 0.011), ("band", 0.595, 0.010), ("band", 0.515, 0.010), ("ankle",), ("spine", 0.675), ("back", 0.012)]),
    dict(id="cross", label="Crossover slides", heel=0.0, straps=[("xband", 0.70, 0.535, 0.016, 0.0), ("xband", 0.535, 0.70, 0.016, 0.0023)]),
    dict(id="wedges", label="Wedge sandals", heel=0.058, wedge=True, straps=[("band", 0.665, 0.030), ("ankle",), ("back", 0.016)]),
    dict(id="flats", label="Ballet flats", heel=0.0, closed=True, straps=[("upper",)]),
    dict(id="mules", label="Mules", heel=0.0, closed=True, straps=[("upper", "mule")]),
    # (10-04, as he asked: kimono wooden sandals) a thick rigid board on two teeth, a cloth thong
    dict(id="geta", label="Wooden geta", heel=0.0, geta=True, straps=[("thong", 0.50, 0.0125)]),
]
GETA = dict(BOARD=0.011, TOOTH=0.034, DEPTH=0.016, AT=(0.26, 0.63))      # what the board is thicker by; the teeth: height, front-to-back, where (fractions of the foot from the heel)
HEEL = dict(T=0.0048, SEAT=0.034, R_TOP=(0.019, 0.022), R_TIP=0.0052, THETA_MAX=0.6)      # the high heel: sole thickness, where the stiletto stands, its size


def build_left(U, style=None):
    style = style or STYLES[0]
    high = style["heel"] > 0
    Pts = SH.foot_points(U)
    low = Pts[Pts[:, 2] < 0.03]
    heel_y, toe_y = float(low[:, 1].max()), float(low[:, 1].min()); L = heel_y - toe_y
    names = U.names; ci = {n: names.index(n) for n in ("foot.L", "toe3-1.L", "lowerleg02.L", "lowerleg01.L")}
    foot_row = np.zeros(len(names)); foot_row[ci["foot.L"]] = 1.0
    M = Mesh(len(names))
    t_of = lambda y: (heel_y - y) / L
    z_in = -P["GAP"]                                        # the insole, just under her skin
    CL, TK = P["CLEAR"], P["THICK"]

    geta = bool(style.get("geta"))

    def thick(t):
        if high: return HEEL["T"]
        a = float(S.smoothstep(t, 0.22, 0.58)); b = float(S.smoothstep(t, 0.90, 1.02))
        if geta: return P["T_HEEL"] + (P["T_BALL"] - P["T_HEEL"]) * a + GETA["BOARD"]      # a board: as thick at its tip as under the ball
        return (P["T_HEEL"] + (P["T_BALL"] - P["T_HEEL"]) * a) * (1 - b) + P["T_TIP"] * b

    def bend_row(t):                                        # rigid with the foot behind the toe joints, with the toes in front
        if geta: return foot_row.copy()                     # (wood does not bend: her toes lift off it)
        wt = float(S.smoothstep(t, *P["BEND"])); r = foot_row * (1 - wt); r[ci["toe3-1.L"]] += wt; return r

    # ---- the sole: the print of her foot (its convex outline), a margin wider
    H = np.array(SH.outline(low[:, [0, 1]], P["MARGIN"]))
    ya, yb = H[:, 1].max(), H[:, 1].min()
    NS, NX = P["NS"], P["NX"]
    u = np.linspace(0.0, 1.0, NS + 1); ys = ya + (yb - ya) * (0.5 - 0.5 * np.cos(math.pi * u))      # closer together at both ends, where the outline turns
    top, bot = [], []
    for i, y in enumerate(ys):
        s = span(H, min(max(y, yb + 1e-5), ya - 1e-5)); xl, xr = s if s else (H[:, 0].mean(), H[:, 0].mean())
        if xr - xl < 0.004: c = (xl + xr) / 2; xl, xr = c - 0.002, c + 0.002
        t = t_of(y); th = thick(t)
        top.append([(xl + (xr - xl) * k / NX, y, z_in) for k in range(NX + 1)])
        # the under side is a little narrower than the insole (a sole with a slight bevel)
        bot.append([(xl + 0.0012 + (xr - xl - 0.0024) * k / NX, y, z_in - th) for k in range(NX + 1)])
    V = [p for r in top for p in r] + [p for r in bot for p in r]
    T = lambda i, k: i * (NX + 1) + k
    B = lambda i, k: (NS + 1) * (NX + 1) + i * (NX + 1) + k
    F, FM = [], []
    for i in range(NS):
        for k in range(NX):
            F.append((T(i, k), T(i, k + 1), T(i + 1, k + 1), T(i + 1, k))); FM.append(1)        # insole (the sole's colour, as on a flip-flop: the straps may be another)
            F.append((B(i, k), B(i + 1, k), B(i + 1, k + 1), B(i, k + 1))); FM.append(1)        # under side
        F.append((T(i, 0), T(i + 1, 0), B(i + 1, 0), B(i, 0))); FM.append(1)                    # the two sides
        F.append((T(i, NX), B(i, NX), B(i + 1, NX), T(i + 1, NX))); FM.append(1)
    for k in range(NX):                                                                         # heel end, toe end
        F.append((T(0, k), B(0, k), B(0, k + 1), T(0, k + 1))); FM.append(1)
        F.append((T(NS, k), T(NS, k + 1), B(NS, k + 1), B(NS, k))); FM.append(1)
    M.add(V, F, FM, [bend_row(t_of(p[1])) for p in V])
    nsole = len(V)

    if geta:
        # the two teeth under the board: slabs across it, their under sides level with each other (the board's under side
        # is level in the worn pose). No top faces: the game takes the lowest surface that faces up for the footbed.
        Vt, Ft = [], []
        for t0 in GETA["AT"]:
            yc = heel_y - t0 * L; b0 = len(Vt)
            for y in (yc + GETA["DEPTH"] / 2, yc - GETA["DEPTH"] / 2):
                sp = span(H, y); xl, xr = sp[0] + 0.004, sp[1] - 0.004; zb = z_in - thick(t_of(y))
                Vt += [(xl, y, zb + 0.0006), (xr, y, zb + 0.0006), (xr, y, zb - GETA["TOOTH"]), (xl, y, zb - GETA["TOOTH"])]
            q = lambda *ix: tuple(b0 + i for i in ix)
            Ft += [q(0, 1, 2, 3), q(5, 4, 7, 6), q(4, 0, 3, 7), q(1, 5, 6, 2), q(3, 2, 6, 7)]      # back, front, two sides, under
        M.add(Vt, Ft, 1, [foot_row] * len(Vt))

    # theta: the heel's lift over the distance from the heel's seat to the ball
    d_hb = (P["BALL"] - 0.10) * L
    theta = math.asin((P["T_HEEL"] - P["T_BALL"]) / d_hb)
    # ---- a high heel: the stiletto. It stands upright once the foot is pitched by th_hi (so here, with the foot flat,
    # it leans forward by that much) and is as long as it takes to reach the ground the ball of the foot stands on.
    th_hi = theta
    if high:
        seat_y = heel_y - HEEL["SEAT"]; ball_y = heel_y - P["BALL"] * L
        th_hi = math.asin(min(math.sin(HEEL["THETA_MAX"]), style["heel"] / (seat_y - ball_y)))
        length = (seat_y - ball_y) * math.sin(th_hi)
        s0 = span(H, seat_y); cx = (s0[0] + s0[1]) / 2 if s0 else float(H[:, 0].mean())
        d = np.array((0.0, -math.sin(th_hi), -math.cos(th_hi))); e1 = np.array((1.0, 0.0, 0.0)); e2 = np.cross(d, e1)
        base = np.array((cx, seat_y, z_in - HEEL["T"] + 0.0008)); NR_, NSEG = 9, 14
        rings = []
        for j in range(NR_):
            v = j / (NR_ - 1); k = v ** 0.55                                                     # (it narrows quickly under the heel, then runs slim)
            ra = HEEL["R_TOP"][0] * (1 - k) + HEEL["R_TIP"] * k; rb = HEEL["R_TOP"][1] * (1 - k) + HEEL["R_TIP"] * k
            c = base + d * length * v + np.array((0.0, HEEL["SEAT"] * 0.30 * (1 - k), 0.0))      # (its top sits back under the heel)
            rings.append([tuple(c + e1 * ra * math.cos(a) + e2 * rb * math.sin(a)) for a in np.linspace(0, 2 * math.pi, NSEG, endpoint=False)])
        Vh = [p for r in rings for p in r]; Fh = []
        for j in range(NR_ - 1):
            for k in range(NSEG):
                Fh.append((j * NSEG + k, j * NSEG + (k + 1) % NSEG, (j + 1) * NSEG + (k + 1) % NSEG, (j + 1) * NSEG + k))
        tipc = len(Vh); Vh.append(tuple(base + d * length))
        for k in range(NSEG): Fh.append(((NR_ - 1) * NSEG + k, (NR_ - 1) * NSEG + (k + 1) % NSEG, tipc))
        if style.get("wedge"):
            # (10-03) a wedge instead: the sole's own outline carried down to the ground from her heel to the ball of her foot.
            # The ground, seen from the flat foot the shoe is built on, is the plane square to the stiletto through its tip.
            tip = base + d * length; rows = []
            for i in range(NS + 1):
                sd = [float((tip - np.array(p)).dot(d)) for p in bot[i]]
                if max(sd) <= 0.0004: break                                                     # (from here on the sole itself is on the ground)
                rows.append((bot[i], [tuple(np.array(p) + d * max(0.0, q)) for p, q in zip(bot[i], sd)]))
            nw = len(rows); W = NX + 1
            Vh = [p for up, dn in rows for p in up] + [p for up, dn in rows for p in dn]; Fh = []
            Uw = lambda i, k: i * W + k
            Dw = lambda i, k: nw * W + i * W + k
            for i in range(nw - 1):
                for k in range(NX): Fh.append((Dw(i, k), Dw(i + 1, k), Dw(i + 1, k + 1), Dw(i, k + 1)))        # what stands on the ground
                Fh.append((Uw(i, 0), Uw(i + 1, 0), Dw(i + 1, 0), Dw(i, 0)))                                     # the two sides
                Fh.append((Uw(i, NX), Dw(i, NX), Dw(i + 1, NX), Uw(i + 1, NX)))
            for k in range(NX): Fh.append((Uw(0, k), Dw(0, k), Dw(0, k + 1), Uw(0, k + 1)))                    # the back of the heel
        M.add(Vh, Fh, 1, [foot_row] * len(Vh))

    # ---- straps. Every rib of a strap is read off the foot along the SAME directions from one centre, so neighbouring
    # ribs match point for point (ribs resampled by their own length did not: the straps came out torn). The radii
    # are evened out across the strap and round it, but never drawn in below what the skin needs.
    def radii(H, c, ang):
        R = SH.radial(H, np.array(c), 360)                                  # (0 = "up", turning towards +x)
        return np.array([R[int(round(math.degrees(a))) % 360] for a in ang])

    def even(R, wrap=False, straight=True):
        """A strap is a band of cloth, not a cast of the foot: across its width it runs straight (a line fitted through
        the ribs), along its length it is smooth; then the whole of it is raised until no rib needs more room."""
        R = np.asarray(R, float); n = R.shape[0]; out = R.copy()
        if straight and n > 2:
            x = np.linspace(-1.0, 1.0, n); A = np.stack([np.ones(n), x], axis=1)
            coef, *_ = np.linalg.lstsq(A, R, rcond=None); out = A @ coef
        else:
            for _ in range(3): b = out.copy(); b[1:-1] = (out[:-2] + 2 * out[1:-1] + out[2:]) / 4; out = b
        for _ in range(3):                                                                     # along the strap
            if wrap: out = (np.roll(out, 1, axis=1) + 2 * out + np.roll(out, -1, axis=1)) / 4
            else: b = out.copy(); b[:, 1:-1] = (out[:, :-2] + 2 * out[:, 1:-1] + out[:, 2:]) / 4; out = b
        return out + max(0.0, float((R - out).max()))

    low_ = Pts[Pts[:, 2] < 0.078]                                                               # (the foot, not the shin above it)
    section = lambda y: np.array(SH.outline(low_[np.abs(low_[:, 1] - y) < 0.0045][:, [0, 2]], 0.0))

    def over(tc, width, ribs=None, npt=27):
        """A strap over the foot at one place along it."""
        ribs = ribs or max(7, int(round(width / 0.0035)))
        yc = heel_y - tc * L; ys_ = [yc + width * (j / (ribs - 1) - 0.5) for j in range(ribs)]
        Hs = [section(y) for y in ys_]
        cx = float(np.mean([(H[:, 0].max() + H[:, 0].min()) / 2 for H in Hs])); cz = 0.012
        ang = np.linspace(-math.radians(97), math.radians(97), npt)                              # over the top, from her inner side to her outer side
        R = even([radii(H, (cx, cz), ang) for H in Hs])
        layers = ([], [])
        for li, extra in enumerate((CL, CL + TK)):
            for y, r in zip(ys_, R):
                pts = [(cx + (q + extra) * math.sin(a), y, cz + (q + extra) * math.cos(a)) for a, q in zip(ang, r)]
                pts = [(pts[0][0], y, z_in + 0.0004)] + pts + [(pts[-1][0], y, z_in + 0.0004)]   # and straight down to the insole at both ends
                layers[li].append(pts)
        return strip(layers[0], layers[1])

    def skin_row(p):                                       # what the skin does at p (foot and shin only)
        sk = U.weights_at(p); keep = np.zeros(len(names))
        for n in ("foot.L", "lowerleg02.L", "lowerleg01.L"): keep[ci[n]] = sk[ci[n]]
        return keep / keep.sum() if keep.sum() > 0.2 else foot_row

    def level(z, band):
        """The leg's outline at height z: where the edges of the skin cross that level, and the skin's own points
        within `band` of it. (The points alone are too few up the shin, where the mesh is coarse: a slice caught half a
        loop of vertices, and the ankle strap dived into her leg on one side and stood off it in two fins. The crossings
        alone miss what bulges between two levels.)"""
        co = U.co; out = [(p[0], p[1]) for p in Pts[np.abs(Pts[:, 2] - z) < band]]
        for poly in U.rpolys:
            n = len(poly)
            for i in range(n):
                a, b = co[poly[i]], co[poly[(i + 1) % n]]
                if a[0] < 0.02 or b[0] < 0.02 or (a[2] - z) * (b[2] - z) > 0 or abs(a[2] - b[2]) < 1e-9: continue
                t = (z - a[2]) / (b[2] - a[2]); out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        return np.array(out)

    zc, zw = P["ANKLE_Z"], P["ANKLE_W"]
    ring_info = {}

    def ankle():
        """The strap round her ankle: level slices of the leg."""
        NK = 36; nr = 5
        zs_ = [zc + zw * (j / (nr - 1) - 0.5) for j in range(nr)]
        Hs = [np.array(SH.outline(level(z, 0.0015), 0.0)) for z in zs_]
        c0 = (float(np.mean([(H[:, 0].max() + H[:, 0].min()) / 2 for H in Hs])), float(np.mean([(H[:, 1].max() + H[:, 1].min()) / 2 for H in Hs])))
        ang = np.linspace(0.0, 2 * math.pi, NK, endpoint=False)
        R = even([radii(H, c0, ang) for H in Hs], wrap=True)
        layers = ([], [])
        for li, extra in enumerate((CL, CL + TK)):
            for z, r in zip(zs_, R):
                layers[li].append([(c0[0] + (q + extra) * math.sin(a), c0[1] + (q + extra) * math.cos(a), z) for a, q in zip(ang, r)])
        Vs, Fs = ring(layers[0], layers[1])
        # one weight row per direction (the skin's own weights vary from vertex to vertex: taken as they are they tear the strap when the ankle bends)
        col_w = np.array([np.mean([skin_row(layers[0][j][k]) for j in range(nr)], axis=0) for k in range(NK)])
        for _ in range(3): col_w = (np.roll(col_w, 1, axis=0) + 2 * col_w + np.roll(col_w, -1, axis=0)) / 4
        col_w /= col_w.sum(axis=1, keepdims=True)
        M.add(Vs, Fs, 0, [col_w[i % NK] for i in range(len(Vs))])
        ring_info["w"] = col_w.mean(axis=0)
        ring_info["front"] = np.array((c0[0], c0[1] - float(np.mean(R[:, NK // 2])) - CL, zc))      # (its foremost point: towards her toes)

    def back(width):
        """The strap up the back of her heel, from the sole to just under the ankle strap."""
        nz = 12; zs_ = np.linspace(z_in + 0.0004, zc - zw * 0.5 - 0.0006, nz); nb = 5
        Hs = [np.array(SH.outline(level(z, 0.0045) if z > 0.02 else Pts[np.abs(Pts[:, 2] - max(z, 0.004)) < 0.0045][:, [0, 1]], 0.0)) for z in zs_]      # (near the sole a level cut would miss the flat of the heel: the band of points there)
        def back_y(H, x):                                      # the back of the outline at this x
            ymax = -9.0
            for i in range(len(H)):
                a, c = H[i], H[(i + 1) % len(H)]
                if (a[0] - x) * (c[0] - x) <= 0 and abs(a[0] - c[0]) > 1e-12: ymax = max(ymax, a[1] + (c[1] - a[1]) * (x - a[0]) / (c[0] - a[0]))
            return ymax if ymax > -8 else float(H[:, 1].max())
        # (its middle follows the ridge: the rearmost point of each slice, evened out up the strap)
        xb = np.array([float(H[int(np.argmax(H[:, 1])), 0]) for H in Hs])
        for _ in range(4): b = xb.copy(); b[1:-1] = (xb[:-2] + 2 * xb[1:-1] + xb[2:]) / 4; xb = b
        off = [width * (k / (nb - 1) - 0.5) for k in range(nb)]
        Y = even([[back_y(H, xc + o) for o in off] for H, xc in zip(Hs, xb)], straight=False)
        layers = ([], [])
        for li, extra in enumerate((CL, CL + TK)):
            for z, yr, xc in zip(zs_, Y, xb): layers[li].append([(xc + o, y + extra, z) for o, y in zip(off, yr)])
        Vs, Fs = strip(layers[0], layers[1])
        rw = ring_info.get("w", foot_row)
        def back_row(p):
            k = float(S.smoothstep(p[2], 0.03, zc - zw * 0.5)); r = foot_row * (1 - k) + rw * k; return r / r.sum()
        M.add(Vs, Fs, 0, [back_row(p) for p in Vs])

    # ---- a ribbon laid on her skin along a line of guide points (the thong's straps): each rib is found on the skin
    # nearest its guide, then lifted off it by the clearance
    def ribbon(guides, width, nk=4, end_down=True, row=None, rays=False):
        G = np.asarray(guides, float); n = len(G); Sx, Nx = [], []
        for g in G:
            hit = (None, None)
            if rays: hit = U.ray((g[0], g[1], 0.12), (0, 0, -1), 0.3)      # (straight down on her foot: the strap is then a straight line seen from above)
            if hit[0] is not None and hit[0][2] > 0.004: loc, nrm = hit[0], (hit[1] if hit[1][2] >= 0 else -hit[1])
            else: sd, loc, nrm, _ = U.sdist(g)
            Sx.append(loc); Nx.append(nrm)
        Sx = np.array(Sx); Nx = np.array(Nx)
        for _ in range(4 if rays else 2):
            b = Sx.copy(); b[1:-1] = (Sx[:-2] + 2 * Sx[1:-1] + Sx[2:]) / 4; Sx = b
            b = Nx.copy(); b[1:-1] = (Nx[:-2] + 2 * Nx[1:-1] + Nx[2:]) / 4; Nx = b / np.linalg.norm(b, axis=1, keepdims=True)
        layers = ([], [])
        for i in range(n):
            tg = Sx[min(n - 1, i + 1)] - Sx[max(0, i - 1)]; tg /= (np.linalg.norm(tg) + 1e-12)
            bn = np.cross(tg, Nx[i]); bn /= (np.linalg.norm(bn) + 1e-12)
            rib_in, rib_out = [], []
            for k in range(nk):
                q = Sx[i] + bn * width * (k / (nk - 1) - 0.5)
                sd, loc, nrm, _ = U.sdist(q + Nx[i] * 0.006)
                if (q + Nx[i] * 0.006 - loc).dot(nrm) < 0: nrm = -nrm
                nn = nrm * 0.5 + Nx[i] * 0.5; nn /= (np.linalg.norm(nn) + 1e-12)
                rib_in.append(tuple(loc + nn * CL)); rib_out.append(tuple(loc + nn * (CL + TK)))
            layers[0].append(rib_in); layers[1].append(rib_out)
        if end_down:                                                                            # and straight down to the insole
            for li in (0, 1): layers[li].append([(p[0], p[1], z_in + 0.0004) for p in layers[li][-1]])
        Vs, Fs = strip(layers[0], layers[1])
        M.add(Vs, Fs, 0, [(row(p) if row else bend_row(t_of(p[1]))) for p in Vs])

    def post():
        """The thong's post: between her first two toes, from the insole up to where the straps leave it."""
        B_ = U.rig.data.bones; t1 = np.array(B_["toe1-1.L"].head_local); t2 = np.array(B_["toe2-1.L"].head_local)
        yw = float((t1[1] + t2[1]) / 2) - 0.013                                                 # a little in front of the toe joints: the web
        xs = np.linspace(min(t1[0], t2[0]) - 0.004, max(t1[0], t2[0]) + 0.004, 25); zt = []
        for x in xs:
            hit, _ = U.ray((x, yw, 0.08), (0, 0, -1), 0.2); zt.append(hit[2] if hit is not None else 0.0)
        zt = np.array(zt); inner = slice(4, -4); k = int(np.argmin(zt[inner])) + 4                # the valley between the two toes
        xw, zw_ = float(xs[k]), float(zt[k])
        r = 0.0026; top_z = zw_ + 0.0035; NSEG = 8; rings = []
        for z in (z_in + 0.0004, zw_ - 0.003, top_z):
            rings.append([(xw + r * math.cos(a), yw + r * math.sin(a), z) for a in np.linspace(0, 2 * math.pi, NSEG, endpoint=False)])
        Vp = [p for rr in rings for p in rr]; Fp = []
        for j in range(2):
            for q in range(NSEG): Fp.append((j * NSEG + q, j * NSEG + (q + 1) % NSEG, (j + 1) * NSEG + (q + 1) % NSEG, (j + 1) * NSEG + q))
        c = len(Vp); Vp.append((xw, yw, top_z + 0.0012))
        for q in range(NSEG): Fp.append((2 * NSEG + q, 2 * NSEG + (q + 1) % NSEG, c))
        M.add(Vp, Fp, 0, [bend_row(t_of(yw))] * len(Vp))
        return np.array((xw, yw, top_z))

    def thong(t_end, width=0.0085):
        """A flip-flop: the post, and a strap from it to each edge of the sole."""
        T0 = post(); y_end = heel_y - t_end * L; sp = span(H, y_end)
        for x_edge in (sp[0] + P["MARGIN"] * 0.4, sp[1] - P["MARGIN"] * 0.4):
            E = np.array((x_edge, y_end, 0.012)); n = 20
            G = [T0 + (E - T0) * (i / (n - 1)) for i in range(n)]
            ribbon(G, width, rays=True)

    def tee(width=0.0075):
        """The post and one strap up the middle of her foot to the front of the ankle strap."""
        T0 = post(); Fp = ring_info["front"] + np.array((0.0, -0.002, -zw * 0.25)); n = 22
        G = [T0 + (Fp - T0) * (i / (n - 1)) + np.array((0, 0, 0.012 * math.sin(math.pi * i / (n - 1)))) for i in range(n)]
        rw = ring_info["w"]
        def row(p):
            k = float(S.smoothstep(p[2], 0.05, zc - zw * 0.5)); r = bend_row(t_of(p[1])) * (1 - k) + rw * k; return r / r.sum()
        ribbon(G, width, end_down=False, row=row)

    def tbar(t_band, width=0.0075):
        """The post and one strap back along the top of her foot to the middle of the band at t_band."""
        T0 = post(); y = heel_y - t_band * L; Hs_ = section(y); cx = (Hs_[:, 0].max() + Hs_[:, 0].min()) / 2
        E = np.array((cx + (T0[0] - cx) * 0.35, y, float(Hs_[:, 1].max()) + CL)); n = 14
        G = [T0 + (E - T0) * (i / (n - 1)) + np.array((0, 0, 0.006 * math.sin(math.pi * i / (n - 1)))) for i in range(n)]
        ribbon(G, width, end_down=False)

    def spine(t_from, width=0.0075):
        """One strap up the middle of her foot, from the top of the band at t_from to the front of the ankle strap (a
        gladiator sandal's; no post between the toes)."""
        y = heel_y - t_from * L; Hs_ = section(y); cx = (Hs_[:, 0].max() + Hs_[:, 0].min()) / 2
        T0 = np.array((cx, y, float(Hs_[:, 1].max()) + CL)); Fp = ring_info["front"] + np.array((0.0, -0.002, -zw * 0.25)); n = 22
        G = [T0 + (Fp - T0) * (i / (n - 1)) + np.array((0, 0, 0.010 * math.sin(math.pi * i / (n - 1)))) for i in range(n)]
        rw = ring_info["w"]
        def row(p):
            k = float(S.smoothstep(p[2], 0.05, zc - zw * 0.5)); r = foot_row * (1 - k) + rw * k; return r / r.sum()
        ribbon(G, width, end_down=False, row=row)

    def xover(ta, tb, width, lift=0.0, npt=27):
        """A strap over the foot on a slant: from her inner side at ta to her outer side at tb. Two of them cross; the upper
        one is given `lift` so that it passes over the other."""
        ribs = max(7, int(round(width / 0.0035)))
        ang = np.linspace(-math.radians(97), math.radians(97), npt)
        ya, yb_ = heel_y - ta * L, heel_y - tb * L
        cx = float(np.mean([(Hh[:, 0].max() + Hh[:, 0].min()) / 2 for Hh in (section(ya), section(yb_), section((ya + yb_) / 2))])); cz = 0.012
        R = np.zeros((ribs, npt)); Y = np.zeros((ribs, npt))
        for k in range(npt):
            yc = ya + (yb_ - ya) * k / (npt - 1)
            for j in range(ribs):
                Y[j, k] = yc + width * (j / (ribs - 1) - 0.5); R[j, k] = radii(section(Y[j, k]), (cx, cz), [ang[k]])[0]
        R = even(R)
        layers = ([], [])
        for li, extra in enumerate((CL + lift, CL + lift + TK)):
            for j in range(ribs):
                pts = [(cx + (R[j, k] + extra) * math.sin(ang[k]), Y[j, k], cz + (R[j, k] + extra) * math.cos(ang[k])) for k in range(npt)]
                layers[li].append([(pts[0][0], Y[j, 0], z_in + 0.0004)] + pts + [(pts[-1][0], Y[j, -1], z_in + 0.0004)])
        return strip(layers[0], layers[1])

    def upper(mule=False):
        """A closed upper (a pump): cross-sections of the foot from the back of the heel to the tips of her toes. Each is
        an arch from the insole on one side to the insole on the other, cut off at the topline: over her toes it closes,
        along the sides it stands 2.4 cm high, and it rises to 4.6 cm round the back of the heel."""
        CLu, npt, nrib, T_LAST, NOSE = 0.0024, 17, 56, 0.955, 0.075      # (the last section fitted to her toes; past it a rounded nose, this long in t)
        T_FIRST = 0.40 if mule else 0.006                                # (10-03: a mule has no sides or back behind the instep)
        ts = np.linspace(T_FIRST, T_LAST, nrib); ys_ = [heel_y - t * L for t in ts]
        Hs = [np.array(SH.outline(Pts[(np.abs(Pts[:, 1] - y) < 0.0045) & (Pts[:, 2] < 0.1)][:, [0, 2]], 0.0)) for y in ys_]
        cxs = np.array([(H[:, 0].max() + H[:, 0].min()) / 2 for H in Hs]); cz = 0.010
        for _ in range(3): b = cxs.copy(); b[1:-1] = (cxs[:-2] + 2 * cxs[1:-1] + cxs[2:]) / 4; cxs = b
        A97 = math.radians(97); dense = np.linspace(-A97, A97, 195)
        Rr = np.array([radii(H, (cx, cz), dense) for H, cx in zip(Hs, cxs)])
        Rs = Rr.copy()
        for _ in range(6):                                   # smooth along the shoe and round it, never inside the skin (a shoe is leather, not a cast of her toes)
            b = Rs.copy(); b[1:-1] = (Rs[:-2] + 2 * Rs[1:-1] + Rs[2:]) / 4; Rs = np.maximum(b, Rr)
            b = Rs.copy(); b[:, 2:-2] = (Rs[:, :-4] + Rs[:, 1:-3] + 2 * Rs[:, 2:-2] + Rs[:, 3:-1] + Rs[:, 4:]) / 6; Rs = np.maximum(b, Rr)
        # the toe box is a smooth shell, not a cast of her toes (the game does not draw her forefoot inside it: nothing can
        # poke through): from the throat forwards the sections are smoothed freely and given a little room
        Rp = Rr.copy()
        for _ in range(14):
            b = Rp.copy(); b[1:-1] = (Rp[:-2] + 2 * Rp[1:-1] + Rp[2:]) / 4; Rp = b
            b = Rp.copy(); b[:, 3:-3] = (Rp[:, :-6] + Rp[:, 1:-5] + Rp[:, 2:-4] + 2 * Rp[:, 3:-3] + Rp[:, 4:-2] + Rp[:, 5:-1] + Rp[:, 6:]) / 8; Rp = b
        for i, t in enumerate(ts):
            w = float(S.smoothstep(t, 0.60, 0.74)); Rs[i] = Rs[i] * (1 - w) + (Rp[i] + 0.0012) * w
        # the nose: the last section drawn in to a rounded point over NOSE of the foot's length
        nn = 9; ts = list(ts); ys_ = list(ys_); cxs = list(cxs); Rs = list(Rs)
        for j in range(1, nn + 1):
            v = j / nn; k = math.sqrt(max(0.0, 1.0 - v * v)) ** 0.9
            ts.append(T_LAST + NOSE * v); ys_.append(heel_y - (T_LAST + NOSE * v) * L); cxs.append(cxs[nrib - 1]); Rs.append(Rs[nrib - 1] * (0.12 + 0.88 * k))
        Rs = np.array(Rs); cxs = np.array(cxs)
        def top_h(t):                                        # the topline's height above the insole (None: closed over the foot)
            if mule:                                         # its edge climbs from the insole up over her instep in one curve
                if t >= 0.60: return None
                k = float(S.smoothstep(t, T_FIRST, 0.60)); return 0.0025 + (0.07 - 0.0025) * k ** 1.5
            if t >= 0.70: return None
            side = 0.024; backh = 0.046
            h = backh + (side - backh) * float(S.smoothstep(t, 0.02, 0.20))
            k = float(S.smoothstep(t, 0.58, 0.70))
            return h + (0.07 - h) * k * k
        layers = {-1: ([], []), 1: ([], [])}
        for i, (t, y, cx) in enumerate(zip(ts, ys_, cxs)):
            r = Rs[i]; zt = top_h(t)
            for sg in (-1, 1):
                a_top = 0.0
                if zt is not None:
                    for a in np.linspace(A97, 0.0, 98):
                        q = r[int(round((sg * a + A97) / (2 * A97) * 194))]
                        if cz + (q + CLu) * math.cos(a) >= z_in + zt: a_top = a; break
                ang = np.linspace(A97, a_top, npt)
                for li, extra in enumerate((CLu, CLu + TK)):
                    pts = []
                    for a in ang:
                        q = r[int(round((sg * a + A97) / (2 * A97) * 194))]
                        pts.append((cx + sg * (q + extra) * math.sin(a), y, cz + (q + extra) * math.cos(a)))
                    pts = [(pts[0][0], y, z_in + 0.0004)] + pts
                    layers[sg][li].append(pts)
        for sg in (-1, 1):
            inner, outer = layers[sg]
            # closed at both ends: the back of the heel and the tips of the toes
            for li, lay in enumerate((inner, outer)):
                yb_ = heel_y + CLu + (TK if li else 0.0); yt_ = ys_[-1] - 0.0015 - (TK if li else 0.0)
                if not mule: lay.insert(0, [(cxs[0], yb_, p[2] * 0.8 + 0.2 * 0.02) for p in lay[0]])      # (a mule is open behind: nothing to close)
                lay.append([(cxs[-1], yt_, cz * 0.6 + 0.4 * p[2]) for p in lay[-1]])
            Vs, Fs = strip(inner, outer)
            if sg < 0: Fs = [f[::-1] for f in Fs]
            M.add(Vs, Fs, 0, [bend_row(t_of(p[1])) for p in Vs])

    for st in style["straps"]:
        kind = st[0]
        if kind == "band":
            Vs, Fs = over(st[1], st[2]); M.add(Vs, Fs, 0, [foot_row] * len(Vs))
        elif kind == "ankle": ankle()
        elif kind == "back": back(st[1])
        elif kind == "thong": thong(st[1], *st[2:3])
        elif kind == "tee": tee()
        elif kind == "tbar": tbar(st[1])
        elif kind == "upper": upper(mule=len(st) > 1 and st[1] == "mule")
        elif kind == "spine": spine(st[1])
        elif kind == "xband":
            Vs, Fs = xover(st[1], st[2], st[3], st[4]); M.add(Vs, Fs, 0, [foot_row] * len(Vs))

    info = dict(heel_y=heel_y, toe_y=toe_y, L=float(L), theta=math.degrees(theta), theta_worn=math.degrees(th_hi), nsole=nsole)
    return np.array(M.V), M.F, M.M, np.array(M.W), info


def finish(U, name, V, F, FM, Wv, mats):
    ob = S.new_object(U, name, V, F, mats, weights=Wv, face_mats=FM)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for e in bm.edges:                                      # the sole's edges and the straps' edges stay crisp
        if len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0) > math.radians(48): e.smooth = False
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    C.shade_smooth(ob)
    return ob


def worn_pose(U, theta):
    """Her feet as they are in a shoe: pitched by theta (radians), toes flat."""
    rig = U.rig; B = rig.data.bones
    C.reset_pose(rig)
    rest = lambda n: np.array((B[n].tail_local - B[n].head_local).normalized())
    rx = lambda v, a: (v[0], v[1] * math.cos(a) - v[2] * math.sin(a), v[1] * math.sin(a) + v[2] * math.cos(a))
    for side in ("L", "R"):
        C.aim(rig, f"foot.{side}", rx(rest(f"foot.{side}"), theta))
        for b in B:
            if b.name.startswith("toe") and b.name.endswith("-1." + side):
                C.aim(rig, b.name, rest(b.name))
    bpy.context.view_layer.update()


def build(ctx):
    U = ctx.get("_U") or Body(ctx); ctx["_U"] = U
    mats = [C.make_material("Anne_HeelPurple", P["PURPLE"], rough=0.3, coat=0.4), C.make_material("Anne_HeelSole", P["SOLE"], rough=0.55)]
    U.co_heels = None
    names = U.names; swap = np.arange(len(names))
    for i, n in enumerate(names):                           # a true left <-> right permutation
        o = n[:-2] + (".R" if n.endswith(".L") else ".L") if n.endswith((".L", ".R")) else None
        if o in names: swap[i] = names.index(o)
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    foot = np.nonzero(U.isb & (U.co[:, 0] > 0.02) & (U.co[:, 2] < 0.115))[0]
    ankle_z = float(U.rig.data.bones["foot.R"].head_local[2])
    out = {}; built = []
    for st in STYLES:
        first = st is STYLES[0]
        nl, nr_, npn = ("Anne_Heel_L", "Anne_Heel_R", "Anne_HeelProp") if first else ("Anne_Shoe_%s_L" % st["id"], "Anne_Shoe_%s_R" % st["id"], "Anne_ShoeProp_%s" % st["id"])
        V, F, FM, Wv, info = build_left(U, st)
        finish(U, nl, V, F, FM, Wv, mats)
        Wr = np.zeros_like(Wv); Wr[:, swap] = Wv
        finish(U, nr_, V * np.array([-1.0, 1, 1]), [f[::-1] for f in F], FM, Wr, mats)
        if first:
            U.shoes = ctx["_shoes"] = dict(theta=info["theta"], heel_height=P["T_HEEL"] - P["T_BALL"], foot_length=info["L"], heel_y=info["heel_y"], toe_y=info["toe_y"], kind="sandal")
        # how near the skin comes to it (rest pose)
        sv = C.eval_verts(bpy.data.objects[nl]); polys = [tuple(p.vertices) for p in bpy.data.objects[nl].data.polygons]
        bvh = BVHTree.FromPolygons([tuple(v) for v in sv], polys); near = 9.9
        for i in foot:
            loc, nrm, fi, dist = bvh.find_nearest(Vector(tuple(U.co[i])), 0.02)
            if loc is not None: near = min(near, dist)
        # ---- the loose shoe: the right one as it stands on the ground; and how high it holds her ankle
        worn_pose(U, math.radians(info["theta_worn"]))
        src = bpy.data.objects[nr_]
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=False, depsgraph=dg)
        old = bpy.data.objects.get(npn)
        if old: bpy.data.objects.remove(old, do_unlink=True)
        prop = bpy.data.objects.new(npn, me); U.col.objects.link(prop)
        co = C.get_co(prop); stand = ankle_z - float(co[:, 2].min())
        co[:, 0] -= (co[:, 0].max() + co[:, 0].min()) / 2; co[:, 1] -= (co[:, 1].max() + co[:, 1].min()) / 2; co[:, 2] -= co[:, 2].min()
        C.set_co(prop, co); C.shade_smooth(prop)
        size = co.max(0) - co.min(0)
        C.reset_pose(U.rig)
        tris = sum(len(p.vertices) - 2 for p in bpy.data.objects[nl].data.polygons)
        # (a closed shoe: the game does not draw her skin and nails in front of this line of the REST pose, t = 0.715 of the foot's length, and below 7.5 cm:
        #  her toes bend in the shoe and its toe box does not bend quite as they do)
        hide = [round(-(info["heel_y"] - 0.715 * info["L"]), 4), 0.075] if st.get("closed") else None
        out[st["id"]] = dict(label=st["label"], heel=bool(st["heel"] > 0), closed=bool(st.get("closed")), theta_worn=round(info["theta_worn"], 3), stand=round(stand, 5), hide=hide,
                             prop_size=[round(float(x), 4) for x in size], nearest_skin_mm=round(near * 1e3, 2), tris=tris)
        built.append(st["id"])
        if not first:
            prop.hide_render = True                           # (the stage-3 file's check renders show her default pair only)
        log("shoes: %-9s theta worn %.2f deg, ankle %.1f mm up, tris %d, nearest skin %.2f mm, prop size %s" % (st["id"], info["theta_worn"], stand * 1e3, tris, near * 1e3, np.round(size, 3)))
        if first: first_info = info; first_near = near; first_size = size
    base = out[STYLES[0]["id"]]
    for k, v in out.items():                                  # what the game adds for this style, over the default pair's pose: more pitch at the ankle, and a lift
        v["dtheta"] = round(v["theta_worn"] - base["theta_worn"], 3); v["lift"] = round(v["stand"] - base["stand"], 5)
    os.makedirs(C.BUILD, exist_ok=True)
    with open(os.path.join(C.BUILD, "anne2_shoes.json"), "w") as f:
        json.dump(dict(U.shoes, prop_size=[round(float(x), 4) for x in first_size], nearest_skin_mm=round(first_near * 1e3, 2), styles=out, order=built), f, indent=1)
    log("sandals: theta %.2f deg, foot length %.4f, tris per sandal %d, nearest skin to a sandal %.2f mm, prop size %s" %
        (first_info["theta"], first_info["L"], base["tris"], first_near * 1e3, np.round(first_size, 3)))
    return U
