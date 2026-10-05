"""Anne v2, stage 2: purple pumps built round her real feet, the loose shoe, and the skin the shoes hide.

    build(ctx) adds Anne_Heel_L / Anne_Heel_R (rigged), Anne_HeelProp (one loose right shoe standing on the ground),
    gives the skin inside the shoes its own materials (Anne_SkinShod, Anne_NailShod: the game hides them while the
    shoes are on, so nothing can ever poke through) and writes build/anne2_shoes.json.

Method: cross-sections of the foot every few millimetres from heel to toe; each section's convex hull, pushed out by
the clearance, is one ring of the shoe. The rings are cut open along the topline (high at the back of the heel, low
under the ankle, closing over the toes), run on past the toes into an almond tip, and bend at the toe joint.
The stiletto is pre-tilted so that it stands upright once the foot is pitched by theta = asin(heel height / heel-to-ball).
"""
import bpy, bmesh, math, os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import s2_util as S
from s2_util import Body, log, unit

P = dict(
    PURPLE="#5a2d91", SOLE="#2a1247",
    HEEL_H=0.065, NSEC=40, MU=8, ML=8,    # sections along the foot; points above / below the widest point of each side
    CLEAR=0.0019,             # between skin and the inside of the shoe
    THICK=0.0020,             # wall thickness
    EXT=0.006,                # the sole runs this far past the longest toe
    OPEN=(0.79, 0.84),        # open toe: the upper ends between these fractions of the foot length; in front only a low rim
    KEEP_SKIN=0.015,          # the skin stays visible this far below the topline, inside the shoe
    RIM=0.4,                  # height of that rim, as a share of the way from the sole to the widest point of the toes
    TIP_FROM=0.955,           # the last section that is fitted to the toes
    ALMOND_FROM=0.80, ALMOND_P=2.0, ALMOND_Q=0.95,   # the almond outline of the toe: where it starts, and its fullness
    BACK=0.050, SIDE=0.033, WAIST=0.027,   # topline height at the back of the heel, under the ankle, at the throat
    THROAT=(0.62, 0.72),      # the vamp closes over the foot between these fractions of the foot length
    BEND=(0.72, 0.86),        # the sole bends here: weights go from the foot bone to the toe bone
    SEAT=0.034,               # the stiletto stands this far in front of the back of the heel
    BALL=0.72,                # the ball of the foot, as a fraction of the foot length
)
NR = 72                       # angular samples of each cross-section


def radial(hull, c, n=NR):
    """Distance from c to the convex outline along n directions (0 = up, increasing towards +x)."""
    hx = np.array(hull); m = len(hx); out = np.zeros(n)
    for k in range(n):
        th = 2 * math.pi * k / n; d = (math.sin(th), math.cos(th)); best = 0.0
        for i in range(m):
            a = hx[i] - c; e = hx[(i + 1) % m] - hx[i]
            den = d[0] * e[1] - d[1] * e[0]
            if abs(den) < 1e-12: continue
            tt = (a[0] * e[1] - a[1] * e[0]) / den; ss = (a[0] * d[1] - a[1] * d[0]) / den
            if tt > 0 and -1e-6 <= ss <= 1 + 1e-6: best = max(best, tt)
        out[k] = best
    return out


def blur(a, passes=2):
    a = np.array(a, float)
    for _ in range(passes):
        b = a.copy(); b[1:-1] = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4; a = b
    return a


def foot_points(U):
    co = U.co
    sel = U.isb & (co[:, 0] > 0.02) & (co[:, 2] < 0.115)
    ss = set(int(i) for i in np.nonzero(sel)[0])
    pts = [co[i] for i in ss]
    for p in U.rpolys:
        if all(v in ss for v in p):
            q = co[list(p)]; pts.append(q.mean(0))
            for i in range(len(p)):
                pts.append((q[i] + q[(i + 1) % len(p)]) / 2)
    # The shoe is worn with the foot pitched down, and round the ankle the skin does not turn rigidly with the foot
    # bone: fitted to the rest pose alone, the skin came through the upper along the topline (a ragged edge in every
    # close-up of her feet). So the foot as it is IN the shoe counts too: behind the toe joints, the same skin where
    # standing in heels puts it, seen from the foot bone (heels_points).
    ch = getattr(U, "co_heels", None)
    if ch is not None:
        rear = set(int(i) for i in np.nonzero(sel & (co[:, 1] > U.heels_from))[0])
        pts += [ch[i] for i in rear]
        for p in U.rpolys:
            if all(v in rear for v in p):
                q = ch[list(p)]; pts.append(q.mean(0))
                for i in range(len(p)):
                    pts.append((q[i] + q[(i + 1) % len(p)]) / 2)
    return np.array(pts)


def heels_points(U, theta, info):
    """Where the body's vertices are when the left foot is pitched as in the shoe, expressed in the foot bone's rest
    frame (so skin that turns rigidly with the foot comes back to its rest position, and the rest shows how it shifts)."""
    rig = U.rig; B = rig.data.bones
    C.reset_pose(rig)
    rest = lambda n: np.array((B[n].tail_local - B[n].head_local).normalized())
    rx = lambda v, a: (v[0], v[1] * math.cos(a) - v[2] * math.sin(a), v[1] * math.sin(a) + v[2] * math.cos(a))
    C.aim(rig, "foot.L", rx(rest("foot.L"), theta))
    for b in B:
        if b.name.startswith("toe") and b.name.endswith("-1.L"): C.aim(rig, b.name, rest(b.name))
    bc = C.eval_verts(U.obj)
    rel = np.array(rig.pose.bones["foot.L"].matrix @ B["foot.L"].matrix_local.inverted())
    inv = np.linalg.inv(rel)
    back = (inv[:3, :3] @ bc.T).T + inv[:3, 3]
    C.reset_pose(rig)
    U.co_heels = back; U.heels_from = info["heel_y"] - 0.62 * info["L"]
    moved = np.linalg.norm(back - U.co, axis=1)[U.isb & (U.co[:, 0] > 0.02) & (U.co[:, 2] < 0.115) & (U.co[:, 1] > U.heels_from)]
    log("shoes: in the heels pose the skin behind the toe joints shifts against the foot bone by up to %.1f mm (mean %.1f)" % (1000 * moved.max(), 1000 * moved.mean()))


def outline(pts2d, clear):
    """The convex outline of a foot section, pushed out by the clearance (counter-clockwise, x right, z up)."""
    h = S.hull2d(pts2d)
    if len(h) < 3:
        m = np.mean(pts2d, axis=0) if len(pts2d) else np.zeros(2)
        h = [(m[0] - 0.003, m[1] - 0.003), (m[0] + 0.003, m[1] - 0.003), (m[0] + 0.003, m[1] + 0.003), (m[0] - 0.003, m[1] + 0.003)]
    ext = [(x + clear * math.cos(a * math.pi / 8), z + clear * math.sin(a * math.pi / 8)) for x, z in h for a in range(16)]
    return np.array(S.hull2d(ext))


NU, NL = 2.2, 4.0             # roundness of a section above / below its widest point (2 = ellipse, higher = boxier)


def fit_section(pts2d, zo):
    """One cross-section of the shoe as a smooth analytic outline that just contains the foot section:
    centre cx, sole height zb, height of the widest point zw, and per side (her outer side +x, inner side -x) the
    half width and the height of the top. Only the foot below the topline counts, so the shoe hugs it there."""
    H = outline(pts2d, P["CLEAR"]); xs, zs = H[:, 0], H[:, 1]
    cx = (xs.max() + xs.min()) / 2
    zb_h, zt_h = zs.min(), zs.max()
    zw = (zs[np.argmax(xs)] + zs[np.argmin(xs)]) / 2
    zw = min(max(zw, zb_h + 0.008), max(zb_h + 0.009, min(zt_h, zo) - 0.006))
    zb = zb_h - 0.0025
    side = []
    for sgn in (1, -1):
        dx = (xs - cx) * sgn; m = dx > 1e-6
        wx = dx.max()
        for x, z in zip(dx[m & (zs < zw)], zs[m & (zs < zw)]):
            q = 1 - ((zw - z) / (zw - zb)) ** NL
            if q > 1e-6: wx = max(wx, x / q ** (1 / NL))
        wx += 0.0002
        zt = zw + 0.004
        for x, z in zip(dx[m & (zs >= zw)], zs[m & (zs >= zw)]):
            q = 1 - min(1.0, x / wx) ** NU
            if q > 1e-4: zt = max(zt, zw + (z - zw) / q ** (1 / NU))
        side.append((wx, min(zt, zw + 0.12)))
    return [cx, zb, zw, side[0][0], side[0][1], side[1][0], side[1][1]]


def section_ring(par, zo, MU, ML):
    """The points of one section: outer wall from the topline down to the widest point, round under the sole, and up
    the inner wall to the topline. With the topline above the top the section is closed (first point = last point)."""
    cx, zb, zw, wR, ztR, wL, ztL = par
    def upper(w, zt, sgn):
        r = (zo - zw) / max(1e-6, zt - zw)
        ph0 = math.pi / 2 if r >= 1 else math.asin(max(0.0, r) ** (NU / 2))
        return [(cx + sgn * w * math.cos(ph0 * (1 - k / MU)) ** (2 / NU), zw + (zt - zw) * math.sin(ph0 * (1 - k / MU)) ** (2 / NU)) for k in range(MU + 1)]
    def lower(w, sgn):
        return [(cx + sgn * w * math.cos(math.pi / 2 * k / ML) ** (2 / NL), zw - (zw - zb) * math.sin(math.pi / 2 * k / ML) ** (2 / NL)) for k in range(1, ML + 1)]
    return np.array(upper(wR, ztR, 1) + lower(wR, 1) + lower(wL, -1)[-2::-1] + upper(wL, ztL, -1)[::-1])


def build_left(U):
    """Geometry of the left shoe in the rest pose: (verts, faces, face materials, weight rows, info)."""
    Pts = foot_points(U)
    low = Pts[Pts[:, 2] < 0.03]
    heel_y, toe_y = low[:, 1].max(), low[:, 1].min(); L = heel_y - toe_y
    NS, MU, ML = P["NSEC"], P["MU"], P["ML"]; K = 2 * (MU + ML)
    y0, y1 = heel_y - 0.0015, toe_y - P["EXT"]
    ys = np.array([y0 + (y1 - y0) * i / NS for i in range(NS + 1)]); ts = (heel_y - ys) / L
    i_tip = int(np.argmin(np.abs(ts - P["TIP_FROM"])))
    band = [Pts[np.abs(Pts[:, 1] - y) < 0.0045] for y in ys]
    zmin = np.array([b[:, 2].min() if len(b) else 0.0 for b in band])
    t0, t1 = P["THROAT"]

    def topline(t):                        # the open part: high at the back of the heel, low under the ankle
        if t < 0.10: return P["BACK"]
        if t < 0.30: return P["BACK"] + (P["SIDE"] - P["BACK"]) * float(S.smoothstep(t, 0.10, 0.30))
        return P["SIDE"] + (P["WAIST"] - P["SIDE"]) * float(S.smoothstep(t, 0.30, t0))

    par = np.zeros((NS + 1, 7)); hulls = []
    for i in range(i_tip + 1):
        t = ts[i]
        cut = topline(t) + 0.003 if t < t0 else 0.115            # in front of the throat the whole foot section counts
        b = band[i]; b = b[b[:, 2] < cut]
        hulls.append(outline(b[:, [0, 2]], P["CLEAR"]))
        par[i] = fit_section(b[:, [0, 2]], topline(t) if t < t0 else 1.0)
    for i in range(i_tip + 1):                                    # one top for both sides: the back of the heel and
        top = max(par[i][4], par[i][6])                           # the vamp must close symmetrically
        k = max(float(S.smoothstep(ts[i], t0 - 0.12, t0)), 1 - float(S.smoothstep(ts[i], 0.10, 0.22)))
        par[i][4] += (top - par[i][4]) * k; par[i][6] += (top - par[i][6]) * k
    for c in range(7):
        par[1:i_tip + 1, c] = blur(par[:i_tip + 1, c], 2)[1:]
    # smoothing must not let a local bump of the foot (ankle bone, the base of the little toe) through the wall
    need = np.zeros((i_tip + 1, 2))
    for i in range(i_tip + 1):
        H = hulls[i]; cx, zb, zw = par[i][0], par[i][1], par[i][2]
        for j, sgn in ((0, 1), (1, -1)):
            zt = par[i][4 + 2 * j]; w = 0.0
            for x, z in zip((H[:, 0] - cx) * sgn, H[:, 1]):
                if x <= 0: continue
                if z < zw:
                    q = 1 - min(0.999, (zw - z) / max(1e-6, zw - zb)) ** NL; w = max(w, x / q ** (1 / NL))
                elif z < zt - 1e-4:
                    q = 1 - ((z - zw) / (zt - zw)) ** NU; w = max(w, min(x / q ** (1 / NU), x * 1.5))
            need[i, j] = w
    for j in range(2):
        w = np.maximum(par[:i_tip + 1, 3 + 2 * j], need[:, j])
        w = np.maximum(blur(w, 1), need[:, j]) + 0.0003
        par[:i_tip + 1, 3 + 2 * j] = w
    # ---- the toe: from the ball forwards the outline is an almond that ends in a point just in front of the big and
    # second toe; wherever a toe needs more room than the almond gives, the toe wins
    ia = int(np.argmin(np.abs(ts - P["ALMOND_FROM"]))); t_end = ts[NS]
    big = Pts[np.argmin(Pts[:, 1])][0]; xt = 0.62 * big + 0.38 * par[ia][0]
    xl0, xr0 = par[ia][0] - par[ia][5], par[ia][0] + par[ia][3]
    pa = par[i_tip].copy(); xl_t, xr_t = pa[0] - pa[5], pa[0] + pa[3]
    XL, XR = np.zeros(NS + 1), np.zeros(NS + 1); fitL, fitR = np.full(NS + 1, 9.0), np.full(NS + 1, -9.0)
    for i in range(ia, NS + 1):
        s_ = (ts[i] - ts[ia]) / (t_end - ts[ia])
        g = max(0.0, 1 - s_ ** P["ALMOND_P"]) ** P["ALMOND_Q"]
        XL[i], XR[i] = xt + (xl0 - xt) * g, xt + (xr0 - xt) * g
        if i <= i_tip:
            fitL[i], fitR[i] = par[i][0] - par[i][5], par[i][0] + par[i][3]
        else:
            s2 = (i - i_tip) / (NS - i_tip)
            g2 = max(0.0, 1 - s2 ** 2.2) ** 0.55; fh = max(0.06, max(0.0, 1 - s2 * s2) ** 0.5 * (1 - 0.22 * s2))
            XL[i] = min(XL[i], xt + (xl_t - xt) * g2); XR[i] = max(XR[i], xt + (xr_t - xt) * g2)
            zt = pa[1] + (max(pa[4], pa[6]) - pa[1]) * fh; zw = pa[1] + (pa[2] - pa[1]) * fh
            b = band[i]
            if len(b) > 3:                                        # the tip of the big toe reaches past the last fitted section
                f = fit_section(b[:, [0, 2]], 1.0)
                fitL[i], fitR[i] = f[0] - f[5], f[0] + f[3]; zt = max(zt, f[4], f[6])
            par[i] = [0.0, pa[1], zw, 0.0, zt, 0.0, zt]
        XL[i], XR[i] = min(XL[i], fitL[i]), max(XR[i], fitR[i])
    for _ in range(2):                                            # one smooth outline (never tighter than the toes need)
        XL[ia + 1:NS] = (XL[ia:NS - 1] + 2 * XL[ia + 1:NS] + XL[ia + 2:NS + 1]) / 4
        XR[ia + 1:NS] = (XR[ia:NS - 1] + 2 * XR[ia + 1:NS] + XR[ia + 2:NS + 1]) / 4
        XL[ia:] = np.minimum(XL[ia:], fitL[ia:]); XR[ia:] = np.maximum(XR[ia:], fitR[ia:])
    for i in range(ia, NS + 1):
        w = max(0.0012, (XR[i] - XL[i]) / 2)
        par[i][0] = (XR[i] + XL[i]) / 2; par[i][3] = par[i][5] = w
    par[ia:, 4] = par[ia:, 6] = np.maximum(par[ia:, 4], par[ia:, 6])
    zo = np.zeros(NS + 1)
    for i in range(NS + 1):
        t = ts[i]; top = max(par[i][4], par[i][6])
        zo[i] = topline(t) if t < t0 else P["WAIST"] + (top + 0.003 - P["WAIST"]) * float(S.smoothstep(t, t0, t1)) ** 0.9
        if t >= t1: zo[i] = 1.0
        o0, o1 = P["OPEN"]                                       # open toe: the band ends, the toes stay bare
        if t >= o0:
            par[i][2] = par[i][1] + (par[i][2] - par[i][1]) * (1 - (1 - P["RIM"]) * float(S.smoothstep(t, o0, o1)))
            zo[i] = par[i][2] + (top + 0.003 - par[i][2]) * (1 - float(S.smoothstep(t, o0, o1)))
    V, F, FM, tv = [], [], [], []
    for i in range(NS + 1):
        for x, z in section_ring(par[i], zo[i], MU, ML):
            V.append((x, ys[i], z)); tv.append(ts[i])
    sole0, sole1 = MU + int(ML * 0.55), MU + 2 * ML - int(ML * 0.55)
    for i in range(NS):
        for k in range(K):
            a = i * (K + 1) + k
            F.append((a, a + 1, a + K + 2, a + K + 1)); FM.append(1 if sole0 <= k < sole1 else 0)
    # ---- round off the back of the heel and close the tip
    def cap(i, dy, shrink, at_top=False):
        top = min(max(par[i][4], par[i][6]), zo[i])
        b0 = i * (K + 1); c = np.array([par[i][0], ys[i], top if at_top else (par[i][1] + top) / 2])
        mid = len(V)
        for k in range(K + 1):
            p = c + (np.array(V[b0 + k]) - c) * shrink; p[1] = ys[i] + dy * 0.7
            V.append(tuple(p)); tv.append(ts[i])
        cv = len(V); V.append((c[0], ys[i] + dy, c[2])); tv.append(ts[i])
        for k in range(K):
            F.append((b0 + k, mid + k, mid + k + 1, b0 + k + 1)); FM.append(0)
            F.append((mid + k, cv, mid + k + 1)); FM.append(0)
    cap(0, P["CLEAR"] + 0.0025, 0.55, at_top=True)            # the back of the counter, closed up to the topline
    cap(NS, -0.0012, 0.5)
    V = np.array(V); nshell = len(V)
    # ---- the stiletto
    i4 = int(np.argmin(np.abs((heel_y - ys) - P["SEAT"])))
    Hc = np.array([par[i4][0], heel_y - P["SEAT"], par[i4][1] + 0.0008])
    Bp = np.array([par[i4][0], heel_y - P["BALL"] * L, 0.0])
    d = Hc[1] - Bp[1]; theta = math.asin(P["HEEL_H"] / d)
    Tp = Bp + np.array([0.0, d * math.cos(theta) ** 2, -d * math.cos(theta) * math.sin(theta)])
    # The foot does not turn about the ball on the ground: it pitches about the ankle and the toes lie flat again from
    # their joints, which lifts the heel seat more than the simple picture above. Put the tip of the stiletto where
    # the ground really is in that pose (level with the sole under the toes), straight below the seat.
    Aj = np.array(U.bones["foot.L"].head_local)
    toe_heads = [np.array(b.head_local) for b in U.bones if b.name.startswith("toe") and b.name.endswith("-1.L")]
    Jt = np.mean(toe_heads, axis=0)
    cth, sth = math.cos(theta), math.sin(theta)
    pitch = lambda v: np.array([v[0], v[1] * cth - v[2] * sth, v[1] * sth + v[2] * cth])          # the rotation of rotx(v, theta)
    unpitch = lambda v: np.array([v[0], v[1] * cth + v[2] * sth, -v[1] * sth + v[2] * cth])
    front = np.array([V[i] for i in range(nshell) if tv[i] >= P["BEND"][1]])
    z_sole = float(front[:, 2].min())
    ground = (Aj + pitch(Jt - Aj))[2] + (z_sole - Jt[2])
    seat_p = Aj + pitch(Hc - Aj)
    Tp = Aj + unpitch(np.array([seat_p[0], seat_p[1], ground]) - Aj)
    log("shoes: stiletto %.3f m long (seat to tip), tip at the ground in the standing pose" % float(np.linalg.norm(Tp - Hc)))
    axis = unit(Tp - Hc); ux = unit(np.array([1.0, 0, 0]) - axis * axis[0]); wy = np.cross(axis, ux)
    HS = 10; us = [0.0, 0.10, 0.25, 0.45, 0.68, 0.88, 1.0]; hv = []
    for u in us:
        c0 = Hc + (Tp - Hc) * u; k = (1 - u) ** 2.3
        hw, hd = 0.0042 + (0.0185 - 0.0042) * k, 0.0050 + (0.0215 - 0.0050) * k
        for a in range(HS):
            ang = 2 * math.pi * a / HS
            hv.append(c0 + ux * hw * math.cos(ang) + wy * hd * math.sin(ang))
    hb = len(V); V = np.vstack([V, np.array(hv)]); tv += [0.0] * len(hv)
    for lv in range(len(us) - 1):
        for a in range(HS):
            a2 = (a + 1) % HS
            F.append((hb + lv * HS + a, hb + lv * HS + a2, hb + (lv + 1) * HS + a2, hb + (lv + 1) * HS + a)); FM.append(0)
    F.append(tuple(hb + (len(us) - 1) * HS + a for a in range(HS))[::-1]); FM.append(1)
    F.append(tuple(hb + a for a in range(HS))); FM.append(0)
    # ---- weights: rigid with the foot behind the toe joint, with the toes in front of it; the counter follows the skin
    names = U.names; ci = {n: names.index(n) for n in ("foot.L", "toe3-1.L", "lowerleg02.L", "lowerleg01.L")}
    Wv = np.zeros((len(V), len(names)))
    b0, b1 = P["BEND"]
    for vi in range(len(V)):
        if vi >= nshell:
            Wv[vi, ci["foot.L"]] = 1.0; continue
        t = tv[vi]; wt = float(S.smoothstep(t, b0, b1))
        row = np.zeros(len(names)); row[ci["foot.L"]] = 1.0
        if t < 0.45 and V[vi][2] > 0.022:
            sk = U.weights_at(V[vi]); keep = np.zeros(len(names))
            for n in ("foot.L", "lowerleg02.L", "lowerleg01.L"): keep[ci[n]] = sk[ci[n]]
            if keep.sum() > 0.2:
                sblend = float(S.smoothstep(V[vi][2], 0.022, 0.040)) * (1 - float(S.smoothstep(t, 0.25, 0.45)))
                row = row * (1 - sblend) + keep / keep.sum() * sblend
        row = row * (1 - wt); row[ci["toe3-1.L"]] += wt
        Wv[vi] = row
    # The skin's weights differ from one vertex to the next, and taken as they are they made the topline ragged as
    # soon as the ankle bent (every close-up of her feet in their heels showed it): even them out over the shell's grid.
    G = Wv[:nshell_grid].reshape(NS + 1, K + 1, len(names)).copy() if (nshell_grid := (NS + 1) * (K + 1)) <= len(V) else None
    if G is not None:
        zone = np.array([[1.0 if (tv[i * (K + 1) + k] < 0.52 and V[i * (K + 1) + k][2] > 0.016) else 0.0 for k in range(K + 1)] for i in range(NS + 1)])
        for _ in range(12):
            N = G.copy()
            N[1:-1] += 0.5 * (G[:-2] + G[2:]); N[:, 1:-1] += 0.5 * (G[:, :-2] + G[:, 2:])
            cnt = np.ones((NS + 1, K + 1)); cnt[1:-1] += 1.0; cnt[:, 1:-1] += 1.0
            N /= cnt[:, :, None]
            G = G + (N - G) * zone[:, :, None]
        G /= np.maximum(G.sum(axis=2, keepdims=True), 1e-9)
        Wv[:nshell_grid] = G.reshape(nshell_grid, len(names))
    info = dict(heel_y=float(heel_y), toe_y=float(toe_y), L=float(L), theta=math.degrees(theta), ys=ys, ts=ts, zo=zo, zmin=zmin,
                nshell=nshell, seat=Hc, ball=Bp, tip=Tp, par=par)
    return V, F, FM, Wv, info


def finish_shoe(U, name, V, F, FM, Wv, M):
    ob = S.new_object(U, name, V, F, [M["purple"], M["sole"]], weights=Wv, face_mats=FM)
    ob.modifiers.remove(ob.modifiers["Armature"])
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    c = sum((v.co for v in bm.verts), bm.verts[0].co * 0) / len(bm.verts)
    if sum(f.normal.dot(f.calc_center_median() - c) for f in bm.faces) < 0:
        for f in bm.faces: f.normal_flip()
    bm.normal_update()
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    sd = ob.modifiers.new("Solid", "SOLIDIFY"); sd.thickness = P["THICK"]; sd.offset = 1.0; sd.use_rim = True; sd.use_even_offset = True
    S.apply_modifier(ob, sd)
    C.shade_smooth(ob)
    ob.modifiers.new("Armature", "ARMATURE").object = U.rig
    return ob


def mark_covered(U, info):
    """Skin that sits inside the shoes gets its own materials, so the game can hide it while the shoes are on."""
    body = U.obj; me = body.data
    def slot(name, src):
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials[src].copy(); m.name = name
        if name not in [s.material.name for s in body.material_slots]:
            me.materials.append(m)
        return [s.material.name for s in body.material_slots].index(name)
    skin, nail = U.slot["Anne_Skin"], U.slot["Anne_Nail"]
    skin_s, nail_s = slot("Anne_SkinShod", "Anne_Skin"), slot("Anne_NailShod", "Anne_Nail")
    co = U.co; ts, zo = info["ts"], info["zo"]
    t = (info["heel_y"] - co[:, 1]) / info["L"]
    zo_v = np.interp(t, ts, np.minimum(zo, 0.2))
    # (how far below the topline the skin stays: with only 4 mm, a camera looking down into the shoe saw the ragged edge
    # of the hidden skin and the shoe's lining through it; the shoe is now fitted to the foot as it stands in it, so
    # more skin can stay without coming through the upper)
    cov = U.isb & (co[:, 2] < 0.085) & (np.abs(co[:, 0]) > 0.02) & (t < P["OPEN"][0] - 0.015) & ((t >= P["THROAT"][1] - 0.01) | (co[:, 2] < zo_v - P["KEEP_SKIN"]))
    n = 0
    for i in U.real:
        p = U.polys[i]
        if all(cov[v] for v in p):
            mi = me.polygons[i].material_index
            if mi == skin: me.polygons[i].material_index = skin_s; n += 1
            elif mi == nail: me.polygons[i].material_index = nail_s; n += 1
    U.mat = np.array([p.material_index for p in me.polygons])
    shod = {skin_s, nail_s}; keepv = set(); allv = set()
    for i in U.real:
        (allv if U.mat[i] in shod else keepv).update(U.polys[i])
    g = np.zeros(len(co)); g[sorted(allv - keepv)] = 1.0
    C.set_vg(body, "shod", g)
    return n, cov


def pose_in_heels(ctx, reset=True):
    """Stand her in her shoes: feet pitched by theta, toes flat, the lowest point of the shoes on the ground."""
    rig = ctx["rig"]; th = math.radians(ctx["_shoes"]["theta"]); B = rig.data.bones
    if reset:
        C.reset_pose(rig)
    rest = lambda n: np.array((B[n].tail_local - B[n].head_local).normalized())
    rx = lambda v, a: (v[0], v[1] * math.cos(a) - v[2] * math.sin(a), v[1] * math.sin(a) + v[2] * math.cos(a))
    for side in ("L", "R"):
        C.aim(rig, f"foot.{side}", rx(rest(f"foot.{side}"), th))
        for b in B:
            if b.name.startswith("toe") and b.name.endswith("-1." + side):
                C.aim(rig, b.name, rest(b.name))
    z = min(C.eval_verts(bpy.data.objects[n])[:, 2].min() for n in ("Anne_Heel_L", "Anne_Heel_R"))
    C.move_root(rig, offset=(0, 0, -z))


def fit_report(U, cov):
    """Clearance between the visible skin and the shoes, at rest and standing in heels (negative = skin pokes out)."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    out = {}
    body = U.obj
    foot = U.isb & (U.co[:, 2] < 0.10) & ~cov
    idx = np.nonzero(foot)[0]
    for label in ("rest", "heels"):
        if label == "heels": pose_in_heels({"rig": U.rig, "_shoes": U.shoes})
        else: C.reset_pose(U.rig)
        bc = C.eval_verts(body)
        worst = 9.9; npoke = 0
        for sname, sx in (("Anne_Heel_L", 1), ("Anne_Heel_R", -1)):
            sh = bpy.data.objects[sname]
            sv = C.eval_verts(sh); polys = [tuple(p.vertices) for p in sh.data.polygons]
            bvh = BVHTree.FromPolygons([tuple(v) for v in sv], polys)
            for i in idx:
                if U.co[i][0] * sx < 0: continue
                loc, nrm, fi, dist = bvh.find_nearest(Vector(tuple(bc[i])), 0.03)
                if loc is None: continue
                # inside the wall = between the two skins of the solidified shell: measure against the nearest surface
                s = (Vector(tuple(bc[i])) - loc).dot(nrm)
                if dist < worst: worst = dist
                if dist < 0.0008: npoke += 1
        out[label] = (round(worst * 1e3, 2), npoke)
    C.reset_pose(U.rig)
    return out


def build(ctx):
    U = ctx.get("_U") or Body(ctx); ctx["_U"] = U
    M = dict(purple=C.make_material("Anne_HeelPurple", P["PURPLE"], rough=0.22, coat=0.6),
             sole=C.make_material("Anne_HeelSole", P["SOLE"], rough=0.5))
    U.co_heels = None
    V, F, FM, Wv, info = build_left(U)                            # a first pass gives the pitch of the foot in the shoe ...
    heels_points(U, math.radians(info["theta"]), info)
    V, F, FM, Wv, info = build_left(U)                            # ... the second fits the shoe to the foot as it stands in it
    finish_shoe(U, "Anne_Heel_L", V, F, FM, Wv, M)
    # the right shoe is the mirror image
    names = U.names; swap = np.arange(len(names))
    for i, n in enumerate(names):                                # a true left <-> right permutation
        o = n[:-2] + (".R" if n.endswith(".L") else ".L") if n.endswith((".L", ".R")) else None
        if o in names: swap[i] = names.index(o)
    Wr = np.zeros_like(Wv); Wr[:, swap] = Wv
    Vr = V * np.array([-1.0, 1, 1])
    finish_shoe(U, "Anne_Heel_R", Vr, [f[::-1] for f in F], FM, Wr, M)
    ncov, cov = mark_covered(U, info)
    U.shoes = ctx["_shoes"] = dict(theta=info["theta"], heel_height=P["HEEL_H"], foot_length=info["L"],
                                   heel_y=info["heel_y"], toe_y=info["toe_y"])
    # ---- the loose shoe: the right one as it stands on the ground
    pose_in_heels(ctx)
    src = bpy.data.objects["Anne_Heel_R"]
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=False, depsgraph=dg)
    old = bpy.data.objects.get("Anne_HeelProp")
    if old: bpy.data.objects.remove(old, do_unlink=True)
    prop = bpy.data.objects.new("Anne_HeelProp", me); U.col.objects.link(prop)
    # (do not clear the copy's vertex groups: in this Blender that also empties the groups of the shoe it was made from)
    co = C.get_co(prop)
    co[:, 0] -= (co[:, 0].max() + co[:, 0].min()) / 2; co[:, 1] -= (co[:, 1].max() + co[:, 1].min()) / 2; co[:, 2] -= co[:, 2].min()
    C.set_co(prop, co); C.shade_smooth(prop)
    size = co.max(0) - co.min(0)
    C.reset_pose(U.rig)
    fit = fit_report(U, cov)
    os.makedirs(C.BUILD, exist_ok=True)
    with open(os.path.join(C.BUILD, "anne2_shoes.json"), "w") as f:
        json.dump(dict(U.shoes, prop_size=[round(float(x), 4) for x in size], fit=fit), f, indent=1)
    log("shoes: theta %.2f deg, foot length %.4f, tris per shoe %d, covered skin faces %d, prop size %s" %
        (info["theta"], info["L"], sum(len(p.vertices) - 2 for p in bpy.data.objects["Anne_Heel_L"].data.polygons), ncov, np.round(size, 3)))
    log("shoes: nearest visible skin to a shoe surface (mm), verts touching: ", fit)
    return U
