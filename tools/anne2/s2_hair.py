"""Anne v2, stage 2: hair, eyebrows, eyelashes (see ANNE2_SPEC.md).

    build(ctx) adds Anne_Hair (a scalp cap plus chunky tapered locks, coloured through the attribute 'Col'),
    Anne_Brows and Anne_Lashes to the open stage-1 scene.

The look follows her 2D sprite: long, straight, caramel-ginger hair, a few strands falling over the forehead from
under the hat, a lock in front of each ear down to the chest, the rest down her back. The locks are hung on her by a
tiny drape simulation (fall, rest on the skin, slide), so they lie on the shoulders, back and chest without cutting in.
"""
import bpy, bmesh, math, os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import s2_util as S
from s2_util import Body, log, unit

P = dict(
    BASE="#a9571f", DARK="#74360f", LIGHT="#cf8440", BROW="#6a3414", LASH="#2a130c",
    YC=-0.045,                # the head's centre line (front-back), for azimuths
    CAP_EDGE=0.0035, CAP_LIFT=0.0105,
    STEP=0.013,               # distance between the points of a lock
)


# (10-04, as he asked: several hairstyles to choose from at the start of the game.) Each is one mesh of the same make (the
# scalp cap, locks hung on her, a fringe); all are in the model at once and the game shows one (anne_next.js setHairStyle).
# The first keeps the name Anne_Hair, the others are Anne_Hair_<id>. hat: whether it goes under her witch's hat (the game
# takes the hat off for one that does not). The table goes to build/anne2_hair.json, and from there to anne2.json.
STYLES = [
    dict(id="long", label="Long and straight", hat=True, fringe="std"),
    dict(id="wavy", label="Long waves", hat=True, fringe="std"),
    dict(id="curls", label="Curls", hat=True, fringe="std"),
    dict(id="bob", label="Bob", hat=True, fringe="bangs"),
    dict(id="pixie", label="Short crop", hat=True, fringe="side"),
    dict(id="ponytail", label="Ponytail", hat=True, fringe="side"),
    dict(id="twintails", label="Twin tails", hat=True, fringe="std"),
    dict(id="braids", label="Braids", hat=True, fringe="none"),
    dict(id="bun", label="Bun", hat=True, fringe="side"),
    dict(id="afro", label="Afro", hat=False, fringe="none", puff=0.072),
]


class Geo:
    def __init__(self):
        self.V, self.F, self.C = [], [], []


def lin(h):
    return np.array(C.hex_lin(h)[:3])


# ------------------------------------------------------------------------------------------------------- scalp cap
def build_cap(U, G, puff=0.0):
    """The scalp's own faces lifted off it: a smooth cap under every style. puff > 0 (an afro): lifted that far, rounded
    out from the middle of her head, cut twice as fine and roughened into a cloud of tight curls."""
    scalp = C.vg_mask(U.obj, "scalp", 0.5) & U.isb
    faces = [p for p in U.rpolys if all(scalp[v] for v in p)]
    used = sorted({v for p in faces for v in p}); remap = {v: i for i, v in enumerate(used)}
    V = U.co[used]; F = [tuple(remap[v] for v in p) for p in faces]
    N = S.vertex_normals(V, F)
    centre = np.array([0.0, P["YC"], 1.60])
    if sum(np.dot(N[i], V[i] - centre) for i in range(len(V))) < 0:
        N = -N; F = [f[::-1] for f in F]
    nb = [set() for _ in V]
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]; nb[a].add(b); nb[b].add(a)
    depth = np.full(len(V), 99.0)
    front = {v for l in S.boundary_loops(F) for v in l}
    for v in front: depth[v] = 0
    d = 0
    while front and d < 5:
        d += 1
        nxt = {b for a in front for b in nb[a] if depth[b] > d}
        for v in nxt: depth[v] = d
        front = nxt
    lift = P["CAP_EDGE"] + ((puff or P["CAP_LIFT"]) - P["CAP_EDGE"]) * S.smoothstep(depth, 0, 2.4 if puff else 3)
    Vs = V.copy()                                         # the hairline follows mesh edges: relax it into a smooth curve
    loops = S.boundary_loops(F)
    for _ in range(10):
        Q = Vs.copy()
        for l in loops:
            for i, v in enumerate(l):
                Q[v] = Vs[v] + 0.5 * ((Vs[l[i - 1]] + Vs[l[(i + 1) % len(l)]]) / 2 - Vs[v])
        for v in range(len(Vs)):
            if depth[v] == 1:
                Q[v] = Vs[v] + 0.3 * (Vs[sorted(nb[v])].mean(0) - Vs[v])
        Vs = Q
    for v in range(len(Vs)):
        if depth[v] <= 1:
            sd, loc, nrm, _ = U.sdist(Vs[v]); Vs[v] = loc; N[v] = nrm
    if puff:                                              # out from the middle of her head as much as off the skin: a round cloud
        out = np.array([unit(v - centre) for v in Vs]); N = np.array([unit(n * 0.45 + o * 0.55) for n, o in zip(N, out)])
    V2 = Vs + N * lift[:, None]
    bm = bmesh.new()
    bv = [bm.verts.new(tuple(v)) for v in V2]
    for f in F:
        bm.faces.new([bv[i] for i in f])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=1.0)
    if puff:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=1.0)
    bm.verts.index_update()
    base = len(G.V)
    root = lin(P["BASE"]) * 0.86
    for v in bm.verts:
        p = np.array(v.co)
        if puff:                                          # tight curls: small bumps all over, darker between them
            d = p - centre; r = float(np.linalg.norm(d)); k = float(S.smoothstep(r, 0.105, 0.14))
            n = math.sin(61 * p[0] + 1.3) * math.sin(57 * p[1] + 0.7) * math.sin(59 * p[2] + 2.1) + 0.5 * math.sin(113 * p[0]) * math.sin(127 * p[2] + 1.0)
            G.V.append(p + unit(d) * (0.0075 * k * n)); G.C.append(lin(P["BASE"]) * (0.80 + 0.22 * n * k))
            continue
        G.V.append(p); G.C.append(root)
    for f in bm.faces:
        G.F.append(tuple(base + v.index for v in f.verts))
    bm.free()
    log("hair cap: scalp faces", len(F), "-> verts", len(G.V) - base)


# ------------------------------------------------------------------------------------------------------- locks
def hang(U, root, length, clear, bias):
    """A lock's centre line: from the root it falls, rests on the skin (never closer than `clear`) and slides along it,
    drifting towards `bias` once it is below the chin."""
    step = P["STEP"]
    g = np.array([0.0, 0.0, -1.0]); b = np.array(bias, float)
    p = np.array(root, float); pts = [p]; L = 0.0; guard = 0
    while L < length and guard < 500:
        guard += 1
        sd, loc, nrm, _ = U.sdist(p)
        d = g.copy()
        if sd < clear + 0.003:
            if p[2] < 1.45:
                d = d + b
            d = d - nrm * min(0.0, float(np.dot(d, nrm)))          # do not push into her
            if np.linalg.norm(d) < 0.12:
                d = b - nrm * float(np.dot(b, nrm)) + g * 0.1
        q = U.push_out(p + unit(d) * step, clear)
        if np.linalg.norm(q - p) < step * 0.3:                     # stuck on a ledge: step along the bias
            q = U.push_out(p + unit(b - nrm * float(np.dot(b, nrm)) + g * 0.3) * step, clear)
        L += float(np.linalg.norm(q - p)); p = q; pts.append(p)
    return np.array(pts)


def smooth_path(U, pts, clear, passes=3):
    for _ in range(passes):
        q = pts.copy(); q[1:-1] = (pts[:-2] + 2 * pts[1:-1] + pts[2:]) / 4
        pts = np.array([pts[0]] + [U.push_out(p, clear) for p in q[1:]])
    return pts


def wave_path(U, pts, clear, amp, lam, phase, curl=0.0):
    """Waves along a hung lock: sideways by amp with wavelength lam (curl: and out from her as well, a spiral), none at its
    root; it stays off her."""
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); s = np.concatenate([[0.0], np.cumsum(seg)])
    out = pts.copy()
    for i in range(1, len(pts)):
        t = unit(pts[min(len(pts) - 1, i + 1)] - pts[max(0, i - 1)])
        sd, loc, nrm, _ = U.sdist(pts[i])
        side = np.cross(t, nrm)
        if np.linalg.norm(side) < 1e-6: continue
        side = unit(side); env = float(S.smoothstep(s[i], 0.02, 0.09)); a = 2 * math.pi * s[i] / lam + phase
        out[i] = U.push_out(pts[i] + side * (amp * env * math.sin(a)) + nrm * (curl * amp * env * (0.5 + 0.5 * math.cos(a))), clear)
    return out


def profile(u, taper):
    r = 0.70 + 0.30 * float(S.smoothstep(u, 0.0, 0.12))
    if u > 1 - taper:
        r *= max(0.0, 1 - ((u - (1 - taper)) / taper) ** 1.7) ** 0.8
    return max(r, 0.04)


def add_lock(U, G, pts, W, H, tint, taper=0.35, sides=8, bead=None):
    """A tapered, flattened tube along pts (the last point is the tip), lying flat on whatever is under it.
    bead = (length, depth): pinched in every `length` metres (the turns of a braid)."""
    n = len(pts)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    total = max(1e-9, seg.sum())
    u = np.concatenate([[0.0], np.cumsum(seg)]) / total
    nr = []
    for p in pts:
        sd, loc, nrm, _ = U.sdist(p)
        radial = unit(np.array([p[0], p[1] - P["YC"], 0.0]))
        k = float(S.smoothstep(sd, 0.02, 0.06))
        nr.append(unit(nrm * (1 - k) + radial * k))
    nr = np.array(nr)
    for _ in range(4):
        nr[1:-1] = (nr[:-2] + 2 * nr[1:-1] + nr[2:]) / 4
    base = len(G.V); rings = n - 1
    for i in range(rings):
        t = unit(pts[min(n - 1, i + 1)] - pts[max(0, i - 1)])
        nn = unit(nr[i] - t * float(np.dot(nr[i], t))); ss = np.cross(t, nn)
        f = profile(u[i], taper)
        grad = 0.80 + 0.26 * float(S.smoothstep(u[i], 0.0, 0.45)) + 0.07 * u[i]
        if bead:
            w = 0.5 + 0.5 * math.cos(2 * math.pi * u[i] * total / bead[0]); f *= 1 - bead[1] * w; grad *= 1 - 0.30 * w
        for j in range(sides):
            a = 2 * math.pi * j / sides; ca, sa = math.cos(a), math.sin(a)
            G.V.append(pts[i] + ss * (W * f / 2 * ca) + nn * (H * f / 2 * (sa if sa > 0 else 0.6 * sa)))
            shade = 0.82 + 0.18 * max(0.0, sa) - 0.10 * abs(ca) ** 3
            G.C.append(tint * shade * grad)
    tip = len(G.V); G.V.append(pts[-1]); G.C.append(tint * 1.08)
    for i in range(rings - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            G.F.append((base + i * sides + j, base + (i + 1) * sides + j, base + (i + 1) * sides + j2, base + i * sides + j2))
    for j in range(sides):
        G.F.append((base + (rings - 1) * sides + j, tip, base + (rings - 1) * sides + (j + 1) % sides))
    G.F.append(tuple(base + j for j in range(sides)))


def build_locks(U, G, style="long"):
    rng = np.random.RandomState(11)
    yc = P["YC"]; base, dark, light = lin(P["BASE"]), lin(P["DARK"]), lin(P["LIGHT"])

    def root_at(az_deg, z):
        az = math.radians(az_deg); d = np.array([math.sin(az), math.cos(az), 0.0])      # 0 = straight back, 90 = her left
        return U.ray(np.array([0, yc, z]) + d * 0.5, -d, 1.0)

    def lock(az_deg, z, W, H, length, bias, tint, taper=0.35, wave=None, start=None, sides=8, bead=None):
        clear = H / 2 + 0.0015
        if start is None:
            hit, nrm = root_at(az_deg, z); start = hit + nrm * clear
        pts = smooth_path(U, hang(U, start, length, clear, bias), clear)
        if wave:
            pts = wave_path(U, pts, clear, *wave)
        add_lock(U, G, pts, W, H, tint, taper, sides, bead)
        return pts

    def knot(az_deg, z, out=0.030, r=0.024, tint=None):
        """Where a tail is gathered: a short stub standing off her head; returns its far end and the way it points."""
        hit, nrm = root_at(az_deg, z)
        pts = np.array([hit + nrm * 0.004, hit + nrm * (out * 0.5), hit + nrm * out, hit + nrm * (out + 0.006)])
        add_lock(U, G, pts, r * 2, r * 2, base * 0.72 if tint is None else tint, taper=0.0, sides=10)
        return hit + nrm * out, nrm

    if style == "long" or style == "wavy":
        wav = (lambda i: (0.014, 0.125, 0.9 * i, 0.3)) if style == "wavy" else (lambda i: None)
        low = []
        for i, az in enumerate(np.linspace(-67, 67, 12)):                    # the outer layer
            c = 1 - abs(az) / 67
            tint = base * (0.95 + 0.10 * rng.rand())
            if i in (2, 6, 9):
                tint = base * 0.6 + light * 0.4
            low.append(lock(az + rng.uniform(-1.5, 1.5), 1.620 + 0.008 * rng.rand(), 0.041, 0.017,
                            0.47 + 0.11 * c + 0.03 * rng.rand(), (0, 0.5, 0), tint, wave=wav(i))[-1][2])
        front = []
        for sg in (1, -1):                                                   # in front of each ear, down to the chest
            front.append(lock(sg * 111, 1.630, 0.040, 0.017, 0.43 + 0.02 * rng.rand(), (0, -0.6, 0), base * 1.03, wave=wav(3))[-1][2])
            front.append(lock(sg * 123, 1.642, 0.028, 0.013, 0.35 + 0.02 * rng.rand(), (0, -0.6, 0), base * 0.55 + light * 0.45, wave=wav(5))[-1][2])
        log("hair locks: back tips z %.2f..%.2f, front tips z %.2f..%.2f" % (min(low), max(low), min(front), max(front)))
    elif style == "curls":                                                   # shoulder-length ringlets all round
        for i, az in enumerate(np.linspace(-100, 100, 15)):
            tint = base * (0.92 + 0.14 * rng.rand()) if i % 4 else base * 0.62 + light * 0.38
            lock(az + rng.uniform(-2, 2), 1.620 + 0.010 * rng.rand(), 0.040, 0.021, 0.26 + 0.05 * rng.rand(), (0, 0.3, 0), tint, taper=0.30,
                 wave=(0.013, 0.058, 1.7 * i, 0.9))
        for sg in (1, -1):
            lock(sg * 116, 1.636, 0.034, 0.019, 0.21, (0, -0.4, 0), base * 1.02, taper=0.3, wave=(0.012, 0.055, 0.4, 0.9))
            lock(sg * 127, 1.644, 0.026, 0.015, 0.17, (0, -0.4, 0), base * 0.6 + light * 0.4, taper=0.3, wave=(0.011, 0.052, 2.0, 0.9))
    elif style == "bob":                                                     # to her jaw, blunt
        for i, az in enumerate(np.linspace(-98, 98, 15)):
            c = 1 - abs(az) / 98
            tint = base * (0.95 + 0.10 * rng.rand()) if i % 5 != 2 else base * 0.62 + light * 0.38
            lock(az + rng.uniform(-1.5, 1.5), 1.620 + 0.008 * rng.rand(), 0.047, 0.019, 0.19 + 0.035 * c + 0.01 * rng.rand(), (0, 0.25, 0), tint, taper=0.20)
        for sg in (1, -1):
            lock(sg * 111, 1.630, 0.044, 0.018, 0.185, (0, -0.3, 0), base * 1.03, taper=0.20)
            lock(sg * 124, 1.642, 0.032, 0.014, 0.165, (0, -0.3, 0), base * 0.6 + light * 0.4, taper=0.22)
    elif style == "pixie":                                                   # short all round: tufts from under the hat line
        for i, az in enumerate(np.linspace(-142, 142, 22)):
            tint = base * (0.92 + 0.14 * rng.rand()) if i % 4 else base * 0.62 + light * 0.38
            lock(az + rng.uniform(-3, 3), 1.618 + 0.014 * rng.rand(), 0.036, 0.014, 0.075 + 0.035 * rng.rand(), (0, 0.2, 0), tint, taper=0.55)
        for i, az in enumerate(np.linspace(-58, 58, 8)):                     # and the nape
            lock(az + rng.uniform(-3, 3), 1.566 + 0.008 * rng.rand(), 0.032, 0.012, 0.055 + 0.02 * rng.rand(), (0, 0.2, 0), base * (0.9 + 0.1 * rng.rand()), taper=0.55)
    elif style == "ponytail":                                                # gathered at the back of her head, down her back
        end, nrm = knot(0, 1.588)
        for i in range(8):
            a = 2 * math.pi * i / 8; off = np.array([math.cos(a) * 0.011, 0.004, math.sin(a) * 0.009])
            tint = base * (0.94 + 0.12 * rng.rand()) if i % 3 else base * 0.62 + light * 0.38
            lock(0, 0, 0.032, 0.020, 0.40 + 0.08 * rng.rand(), (0, 0.5, 0), tint, taper=0.40, start=end + off)
        for sg in (1, -1):                                                   # a wisp in front of each ear
            lock(sg * 120, 1.640, 0.022, 0.011, 0.19 + 0.02 * rng.rand(), (0, -0.5, 0), base * 0.6 + light * 0.4, taper=0.45)
    elif style == "twintails":                                               # one tail behind each ear, over her shoulders
        for sg in (1, -1):
            end, nrm = knot(sg * 106, 1.598, out=0.026, r=0.021)
            for i in range(6):
                a = 2 * math.pi * i / 6; off = np.array([sg * 0.004, math.cos(a) * 0.009, math.sin(a) * 0.008])
                tint = base * (0.94 + 0.12 * rng.rand()) if i % 3 else base * 0.62 + light * 0.38
                lock(0, 0, 0.030, 0.019, 0.40 + 0.07 * rng.rand(), (sg * 0.15, -0.25, 0), tint, taper=0.40, start=end + off, wave=(0.008, 0.16, 1.1 * i, 0.2))
            lock(sg * 124, 1.642, 0.024, 0.012, 0.20, (0, -0.5, 0), base * 0.6 + light * 0.4, taper=0.45)
    elif style == "braids":                                                  # many thin braids all round, to her chest and back
        for i, az in enumerate(np.linspace(-128, 128, 26)):
            c = 1 - abs(az) / 128
            tint = base * (0.90 + 0.16 * rng.rand())
            lock(az + rng.uniform(-1.5, 1.5), 1.618 + 0.012 * rng.rand(), 0.0135, 0.0135, 0.36 + 0.13 * c + 0.04 * rng.rand(),
                 (0, 0.5 if abs(az) < 95 else -0.5, 0), tint, taper=0.10, sides=6, bead=(0.021, 0.22))
        for sg in (1, -1):                                                   # and two in front of each ear (none across her face)
            for az, ln in ((134, 0.27), (140, 0.24)):
                lock(sg * az, 1.648, 0.012, 0.012, ln + 0.02 * rng.rand(), (sg * 0.25, -0.2, 0), base * (0.92 + 0.1 * rng.rand()), taper=0.10, sides=6, bead=(0.021, 0.22))
    elif style == "bun":                                                     # a knot low at the back of her head
        hit, nrm = root_at(0, 1.578)
        cen = hit + nrm * 0.036; R = 0.047; base_i = len(G.V); rings, segs = 9, 16
        tx = unit(np.cross(nrm, np.array([0.0, 0.0, 1.0]))); tz = np.cross(tx, nrm)
        for i in range(1, rings):
            th = math.pi * i / rings
            for j in range(segs):
                ph = 2 * math.pi * j / segs
                d = tx * (math.sin(th) * math.cos(ph)) + tz * (math.sin(th) * math.sin(ph)) + nrm * (math.cos(th) * 0.82)
                swirl = 0.5 + 0.5 * math.sin(3 * ph + 5 * th)
                G.V.append(cen + d * R * (1 + 0.035 * swirl)); G.C.append(base * (0.78 + 0.22 * swirl))
        top = len(G.V); G.V.append(cen + nrm * R * 0.82); G.C.append(base * 0.95)
        bot = len(G.V); G.V.append(cen - nrm * R * 0.82); G.C.append(base * 0.8)
        for i in range(rings - 2):
            for j in range(segs):
                j2 = (j + 1) % segs
                G.F.append((base_i + i * segs + j, base_i + i * segs + j2, base_i + (i + 1) * segs + j2, base_i + (i + 1) * segs + j))
        for j in range(segs):
            j2 = (j + 1) % segs
            G.F.append((top, base_i + j2, base_i + j)); G.F.append((bot, base_i + (rings - 2) * segs + j, base_i + (rings - 2) * segs + j2))
        for sg in (1, -1):                                                   # a wisp in front of each ear
            lock(sg * 118, 1.640, 0.024, 0.012, 0.20 + 0.02 * rng.rand(), (0, -0.5, 0), base * 0.6 + light * 0.4, taper=0.45)
    # (an afro has no locks: it is the cap itself)


def build_fringe(U, G, kind="std"):
    """Strands that fall over the forehead from under the hat, drawn in the front view and laid on the skin.
    kind: std (three a side, parted in the middle) | bangs (a straight row to her brows) | side (the two outer ones) | none."""
    if kind == "none":
        return
    base, light = lin(P["BASE"]), lin(P["LIGHT"])
    strands = [  # front-view points (x, z) for her left side, width, thickness, tint
        ([(0.004, 1.674), (0.009, 1.652), (0.014, 1.632), (0.019, 1.614)], 0.013, 0.006, base * 1.02),
        ([(0.008, 1.674), (0.030, 1.657), (0.052, 1.634), (0.066, 1.608)], 0.027, 0.009, base * 0.6 + light * 0.4),
        ([(0.013, 1.674), (0.048, 1.666), (0.076, 1.644), (0.091, 1.610), (0.096, 1.574)], 0.038, 0.011, base * 0.97),
    ]
    if kind == "side":
        strands = strands[1:]
    if kind == "bangs":
        strands = [([(x, 1.674), (x * 1.04, 1.655), (x * 1.07, 1.634), (x * 1.09, 1.612 + 0.004 * (i % 2))], 0.021, 0.008,
                    base * (1.0 if i % 3 else 0.8) + light * (0.0 if i % 3 else 0.2)) for i, x in enumerate([0.006, 0.024, 0.042, 0.060, 0.077])]
        strands.append(([(0.086, 1.672), (0.094, 1.650), (0.098, 1.620), (0.099, 1.590)], 0.030, 0.010, base * 0.97))
    for sg in (1, -1):
        for ctrl, W, H, tint in strands:
            ctrl = np.array(ctrl); n = 14
            # Catmull-Rom through the control points
            pad = np.vstack([2 * ctrl[0] - ctrl[1], ctrl, 2 * ctrl[-1] - ctrl[-2]])
            cur = []
            for k in range(n):
                s = k / (n - 1) * (len(ctrl) - 1); i = min(int(s), len(ctrl) - 2); t = s - i
                p0, p1, p2, p3 = pad[i], pad[i + 1], pad[i + 2], pad[i + 3]
                cur.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
            pts = []
            c0 = np.array([0.0, P["YC"], 1.60]); R = 0.118              # the points are projected from the head's centre
            for x, z in cur:
                x = x * sg * (1.0 if sg > 0 else 0.94)                   # a little asymmetry
                d = unit(np.array([x, -math.sqrt(max(0.0004, R * R - x * x - (z - 1.60) ** 2)), z - 1.60]))
                hit, nrm = U.ray(c0 + d * 0.5, -d, 1.0)
                pts.append(hit + nrm * (H / 2 + 0.0015))
            add_lock(U, G, np.array(pts), W, H, tint, taper=0.45, sides=8)


def hair_weights(U, V):
    """Above the chin the hair follows the head; below it hands over to the neck and then down the spine, so it lies
    along her back and chest when she bends instead of sticking out like a board."""
    J = [1.136, 1.27, 1.41, 1.495]; bones = ["spine03", "spine02", "spine01", "neck02", "head"]; half = 0.035
    z = V[:, 2]
    s = [S.smoothstep(z, j - half, j + half) for j in J]
    Wv = np.zeros((len(V), len(U.names)))
    for k, b in enumerate(bones):
        lo = s[k - 1] if k > 0 else np.ones_like(z)
        hi = s[k] if k < len(J) else np.zeros_like(z)
        Wv[:, U.names.index(b)] = lo * (1 - hi)
    return Wv


# ------------------------------------------------------------------------------------------------------- brows, lashes
def build_brows(U, M):
    loop = np.array(U.info["eye_loop_L"]); lp = U.co[loop]
    Wd = lp[:, 0].max() - lp[:, 0].min(); xc = (lp[:, 0].max() + lp[:, 0].min()) / 2; zc = (lp[0, 2] + lp[15, 2]) / 2
    # (x, z, thickness) in eye widths: low over the eye at the nose, rising outwards, a thin tail that stays up (her 2D brows)
    key = np.array([[-0.62, 0.33, 0.085], [0.28, 0.49, 0.062], [0.86, 0.43, 0.018]])
    n = 20; t = np.linspace(0, 1, n); tp = 0.6
    ctrl = (key[1] - (1 - tp) ** 2 * key[0] - tp ** 2 * key[2]) / (2 * tp * (1 - tp))
    cur = ((1 - t) ** 2)[:, None] * key[0] + (2 * t * (1 - t))[:, None] * ctrl + (t ** 2)[:, None] * key[2]
    V, F = [], []
    prof = ((-0.5, 0.0003), (-0.27, 0.0015), (0.0, 0.0021), (0.27, 0.0015), (0.5, 0.0003))
    for side in (1, -1):
        base = len(V)
        for off, lift in prof:
            last = None
            for i, (x, z, th) in enumerate(cur):
                th = th * (0.5 + 0.5 * float(S.smoothstep(t[i], 0.0, 0.10)))
                X = xc + x * Wd; Z = zc + (z + off * th) * Wd
                hit, nrm = U.ray((X, -1.0, Z), (0, 1, 0), 2.0)
                if hit is None or (last is not None and abs(hit[1] - last[1]) > 0.012):
                    sd, hit, nrm, _ = U.sdist((X, (last[1] if last is not None else -0.15), Z))
                last = hit
                q = hit + nrm * lift
                V.append((q[0] * side, q[1], q[2]))
        for r in range(len(prof) - 1):
            for i in range(n - 1):
                a = base + r * n + i
                f = (a, a + 1, a + n + 1, a + n)
                F.append(f if side > 0 else f[::-1])
    S.new_object(U, "Anne_Brows", V, F, M["brow"], weights=np.tile(U.bone_row(head=1.0), (len(V), 1)))
    log("brows: verts", len(V), "| inner end x %.3f z %.3f" % (xc + key[0][0] * Wd, zc + key[0][1] * Wd))


def build_lashes(U, M):
    V, F = [], []
    order = [21, 22, 23, 24, 25, 26, 27, 0, 1, 2, 3, 4, 5, 6, 7]         # upper lid: inner corner -> top -> outer corner
    up = np.array([0.0, 0.0, 1.0])
    for loopname, ckey in (("eye_loop_L", "eye_centre_L"), ("eye_loop_R", "eye_centre_R")):
        loop = U.info[loopname]; ce = np.array(U.info[ckey])
        pts = U.co[[loop[i] for i in order]]; n = len(pts)
        rows = {"C": [], "A": [], "B": []}
        for k in range(n):
            p = pts[k]; r = unit(p - ce)
            t = unit(pts[min(n - 1, k + 1)] - pts[max(0, k - 1)])
            u = unit(np.cross(t, r))
            if u[2] < 0: u = -u
            f = k / (n - 1)
            ln = 0.0012 + 0.0046 * f ** 1.3; liner = 0.0013 + 0.0025 * f       # a dark, heavy upper lash line that thickens outwards
            if k == 0: ln *= 0.4; liner *= 0.5
            rows["C"].append(p + u * liner + r * 0.0008)
            rows["A"].append(p - u * 0.0006 + r * 0.0005)
            rows["B"].append(p + (r * 0.80 + u * 0.55) * ln + r * 0.0005)
        d = unit(pts[-1] - pts[-3]); r = unit(pts[-1] - ce)
        w1 = pts[-1] + d * 0.004 + up * 0.0016 + r * 0.0010
        tip = pts[-1] + d * 0.0095 + up * 0.0050 + r * 0.0016
        rows["C"] += [w1 + up * 0.0014, tip]; rows["A"] += [w1 - up * 0.0009, tip]; rows["B"] += [w1 + r * 0.0030 + up * 0.0012, tip]
        base = len(V); m = n + 2
        V += rows["C"] + rows["A"] + rows["B"]
        for k in range(m - 1):
            F.append((base + k, base + m + k, base + m + k + 1, base + k + 1))
            F.append((base + m + k, base + 2 * m + k, base + 2 * m + k + 1, base + m + k + 1))
    S.new_object(U, "Anne_Lashes", V, F, M["lash"], weights=np.tile(U.bone_row(head=1.0), (len(V), 1)))
    log("lashes: verts", len(V))


def build(ctx):
    U = ctx.get("_U") or Body(ctx); ctx["_U"] = U
    M = dict(hair=C.make_material("Anne_Hair", P["BASE"], rough=0.42, vcol="Col", sheen=0.2),
             brow=C.make_material("Anne_Brow", P["BROW"], rough=0.6),
             lash=C.make_material("Anne_Lash", P["LASH"], rough=0.5))
    only = [x for x in os.environ.get("ANNE_HAIR", "").split(",") if x]      # (a quick build: ANNE_HAIR=long,bob; the first style is always built)
    order, info = [], {}
    for k, st in enumerate(STYLES):
        if only and k and st["id"] not in only:
            continue
        G = Geo()
        build_cap(U, G, st.get("puff", 0.0))
        build_locks(U, G, st["id"])
        build_fringe(U, G, st.get("fringe", "std"))
        V = np.array(G.V); tris = sum(len(f) - 2 for f in G.F)
        S.new_object(U, "Anne_Hair" if k == 0 else "Anne_Hair_" + st["id"], V, G.F, M["hair"], colors=np.clip(np.array(G.C), 0, 1), weights=hair_weights(U, V))
        log("hair %s: verts %d tris %d" % (st["id"], len(V), tris))
        order.append(st["id"]); info[st["id"]] = dict(label=st["label"], hat=bool(st["hat"]), tris=tris)
    with open(os.path.join(C.BUILD, "anne2_hair.json"), "w") as f:
        json.dump(dict(order=order, styles=info), f, indent=1)
    build_brows(U, M)
    build_lashes(U, M)
    return U
