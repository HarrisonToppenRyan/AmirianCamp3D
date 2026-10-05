"""Anne v2, stage 2: jumpsuit with piping, glove cuffs, choker and witch hat (see ANNE2_SPEC.md).

    build(ctx) adds Anne_Suit, Anne_SuitTrim, Anne_Cuffs, Anne_Choker, Anne_Hat, Anne_HatBand to the open stage-1 scene
    and marks the skin the suit hides (vertex group 'hidden' on Anne_Body).

The gloves stay painted on the skin (material Anne_GlovePaint): only their cuffs are real geometry. The suit is the
body surface under it, smoothed until no anatomy shows, kept a few millimetres clear of the skin and subdivided once.
"""
import bpy, bmesh, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import s2_util as S
from s2_util import Body, log, unit

P = dict(
    SUIT="#f2a516", TRIM="#d39a1c", GLOVE="#5a2d91", CHOKER="#5a2d91", HAT="#6b3bab", HAT_UNDER="#5a35a0", BAND="#e6a91f",
    SUIT_GAP=0.0036,          # how far the cloth stays off the skin
    SUIT_SMOOTH=22,           # smoothing passes (each followed by a push back outside the skin)
    BODY_SMOOTH=45, BUST_SMOOTH=2, BUST_SIGMA=0.014, CLOTH_SIGMA=0.011,           # smoothing passes on the (hidden) skin under the suit
    HEM_SMOOTH=14,            # extra smoothing passes along the hems only
    SUIT_RIM=0.0050,          # hems turn in this far (cloth thickness)
    PIPE_R=0.0030,            # radius of the bead along the hems
    CHOKER_H=0.020, CHOKER_S=0.033,   # height of the choker band, and how far above the base of the neck it starts
    HAT_Z=1.640, HAT_TILT=-4.0, HAT_CLEAR=0.017, BRIM=0.180, CONE_H=0.41,
)


def make_materials():
    M = {}
    M["suit"] = C.make_material("Anne_Suit", P["SUIT"], rough=0.55, sheen=0.3)
    M["trim"] = C.make_material("Anne_Trim", P["TRIM"], rough=0.35, metallic=0.4)
    M["glove"] = C.make_material("Anne_Glove", P["GLOVE"], rough=0.38, sheen=0.4)
    M["choker"] = C.make_material("Anne_Choker", P["CHOKER"], rough=0.4, sheen=0.3)
    M["hat"] = C.make_material("Anne_Hat", P["HAT"], rough=0.6, sheen=0.4, vcol="Col")
    M["band"] = C.make_material("Anne_HatBand", P["BAND"], rough=0.3, metallic=0.5)
    return M


# --------------------------------------------------------------------------------------------------------- jumpsuit
def soften_under_suit(U, used, border):
    """The skin under the suit is never seen: smooth it (Taubin, so it does not shrink) until the bust is one soft
    shape and nothing anatomical is left for the cloth to trace. Two rings of skin next to each opening stay as they are."""
    free = np.array(sorted(set(used) - U.grow(border, 2)))
    if len(free) == 0:
        return
    nbl = {v: np.array(sorted(U.nb[v])) for v in free}
    co = U.co
    for it in range(P["BODY_SMOOTH"]):
        for k in (0.5, -0.53):
            d = np.array([co[nbl[v]].mean(0) - co[v] for v in free])
            co[free] += k * d
    # the bust becomes one soft, rounded shape: smoothing by distance (the mesh is very dense at the tips of the
    # breasts, where smoothing along edges hardly moves anything)
    from mathutils.kdtree import KDTree
    m = np.array([float(S.smoothstep(-co[v][1], 0.03, 0.07) * S.smoothstep(co[v][2], 1.15, 1.19) * (1 - S.smoothstep(co[v][2], 1.31, 1.35))) for v in free])
    act = np.nonzero(m > 0.01)[0]; sig = P["BUST_SIGMA"]
    for it in range(P["BUST_SMOOTH"]):
        kd = KDTree(len(free))
        for k, v in enumerate(free): kd.insert(tuple(co[v]), k)
        kd.balance()
        new = co[free].copy()
        for k in act:
            acc = np.zeros(3); wsum = 0.0
            for (pos, j, dist) in kd.find_range(tuple(co[free[k]]), 2.5 * sig):
                w = math.exp(-dist * dist / (2 * sig * sig)); acc += w * np.array(pos); wsum += w
            new[k] = co[free[k]] + m[k] * (acc / wsum - co[free[k]])
        co[free] = new
    C.set_co(U.obj, co)
    U.rebuild()


def weld(V, F, Wt, mask, dist):
    """Merge the vertices (among those in mask) that lie closer together than dist: the body mesh has very dense
    spots that would stay as hard little bumps in the cloth."""
    from mathutils.kdtree import KDTree
    from collections import defaultdict
    idx = [int(i) for i in np.nonzero(mask)[0]]
    kd = KDTree(len(idx))
    for i in idx: kd.insert(tuple(V[i]), i)
    kd.balance()
    parent = list(range(len(V)))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for i in idx:
        for (pos, j, d) in kd.find_range(tuple(V[i]), dist):
            ra, rb = find(i), find(j)
            if ra != rb: parent[rb] = ra
    groups = defaultdict(list)
    for i in range(len(V)): groups[find(i)].append(i)
    roots = sorted(groups); new_i = {r: k for k, r in enumerate(roots)}
    V2 = np.array([V[groups[r]].mean(0) for r in roots]); W2 = np.array([Wt[groups[r]].mean(0) for r in roots])
    F2, seen = [], set()
    for f in F:
        g = []
        for v in f:
            k = new_i[find(v)]
            if k not in g: g.append(k)
        key = tuple(sorted(g))
        if len(g) >= 3 and key not in seen:
            seen.add(key); F2.append(tuple(g))
    return V2, F2, W2


def build_suit(U, M):
    si = U.slot["Anne_SuitPaint"]
    fsel = [i for i in U.real if U.mat[i] == si]
    used = sorted({v for i in fsel for v in U.polys[i]})
    other0 = {v for i in U.real if U.mat[i] != si for v in U.polys[i]}
    soften_under_suit(U, used, set(used) & other0)
    remap = {v: k for k, v in enumerate(used)}
    V = U.co[used].copy()
    F = [tuple(remap[v] for v in U.polys[i]) for i in fsel]
    Wt = U.W[used]
    n0 = len(V)
    V, F, Wt = weld(V, F, Wt, (V[:, 1] < -0.085) & (V[:, 2] > 1.18) & (V[:, 2] < 1.30), 0.006)
    log("suit: welded", n0 - len(V), "crowded vertices on the chest")
    loops = S.boundary_loops(F)
    nb = [set() for _ in V]
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]; nb[a].add(b); nb[b].add(a)
    nbl = [np.array(sorted(s)) for s in nb]
    along = {}
    for l in loops:
        for i, v in enumerate(l):
            along[v] = (l[i - 1], l[(i + 1) % len(l)])
    # taut cloth: smooth, then push every vertex back to at least SUIT_GAP outside the skin
    Pn = V + S.vertex_normals(V, F) * P["SUIT_GAP"]
    for it in range(P["SUIT_SMOOTH"]):
        Q = Pn.copy()
        for v in range(len(Pn)):
            if v in along:
                a, b = along[v]; Q[v] = Pn[v] + 0.45 * ((Pn[a] + Pn[b]) / 2 - Pn[v])
            else:
                Q[v] = Pn[v] + 0.5 * (Pn[nbl[v]].mean(0) - Pn[v])
        Pn = np.array([U.push_out(q, P["SUIT_GAP"]) for q in Q])
    for it in range(P["HEM_SMOOTH"]):                      # the hems alone, once more: no kinks where an opening turns a corner
        Q = Pn.copy()
        for v, (a_, b_) in along.items():
            Q[v] = Pn[v] + 0.5 * ((Pn[a_] + Pn[b_]) / 2 - Pn[v])
        for v in along:
            Pn[v] = U.push_out(Q[v], P["SUIT_GAP"])
    lift = np.array([U.sdist(p)[0] for p in Pn])
    log("suit: faces", len(F), "verts", len(V), "hem loops", [len(l) for l in loops],
        "| clearance mm min %.1f mean %.1f max %.1f" % (lift.min() * 1e3, lift.mean() * 1e3, lift.max() * 1e3))
    ob = S.new_object(U, "Anne_Suit", Pn, F, M["suit"], weights=Wt)
    arm = ob.modifiers["Armature"]; ob.modifiers.remove(arm)
    sub = ob.modifiers.new("Sub", "SUBSURF"); sub.levels = 1; sub.render_levels = 1
    S.apply_modifier(ob, sub)
    V2, F2 = S.mesh_arrays(ob)
    V2 = np.array([U.push_out(p, P["SUIT_GAP"] * 0.8) for p in V2])
    # the front of the chest and the seat end as single soft shapes: smooth the cloth itself by distance there
    # (nothing can show through: the skin under the suit is removed at export)
    from mathutils.kdtree import KDTree
    z, y = V2[:, 2], V2[:, 1]
    m = np.maximum(S.smoothstep(-y, 0.03, 0.07) * S.smoothstep(z, 1.15, 1.19) * (1 - S.smoothstep(z, 1.31, 1.35)),
                   0.8 * S.smoothstep(y, 0.0, 0.04) * S.smoothstep(z, 0.84, 0.88) * (1 - S.smoothstep(z, 0.99, 1.04)))
    edge = KDTree(sum(len(l) for l in S.boundary_loops(F2)))    # ... but not near the hems, where skin is still under the cloth
    for l in S.boundary_loops(F2):
        for v in l: edge.insert(tuple(V2[v]), v)
    edge.balance()
    m = m * np.array([float(S.smoothstep(edge.find(tuple(p))[2], 0.022, 0.05)) for p in V2])
    act = np.nonzero(m > 0.01)[0]; sig = P["CLOTH_SIGMA"]
    for it in range(2):
        kd = KDTree(len(V2))
        for k in range(len(V2)): kd.insert(tuple(V2[k]), k)
        kd.balance()
        new = V2.copy()
        for k in act:
            acc = np.zeros(3); wsum = 0.0
            for (pos, j, dist) in kd.find_range(tuple(V2[k]), 2.5 * sig):
                w = math.exp(-dist * dist / (2 * sig * sig)); acc += w * np.array(pos); wsum += w
            new[k] = V2[k] + m[k] * (acc / wsum - V2[k])
        V2 = new
    C.set_co(ob, V2)
    W2 = S.group_rows(ob, U.names)
    N2 = S.vertex_normals(V2, F2)
    c0 = V2.mean(0)
    if sum(np.dot(N2[i], V2[i] - c0) for i in range(0, len(V2), 7)) < 0:
        N2 = -N2
    loops2 = S.boundary_loops(F2)
    # hems turn inwards: visible cloth thickness, and no gap to look into
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    key = lambda co: (round(co[0], 6), round(co[1], 6), round(co[2], 6))
    nmap = {key(V2[v]): N2[v] for l in loops2 for v in l}
    edges = [e for e in bm.edges if e.is_boundary]
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for g in ret["geom"]:
        if isinstance(g, bmesh.types.BMVert):
            n = nmap.get(key(g.co))
            if n is not None:
                g.co.x -= n[0] * P["SUIT_RIM"]; g.co.y -= n[1] * P["SUIT_RIM"]; g.co.z -= n[2] * P["SUIT_RIM"]
    bm.normal_update()
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    C.shade_smooth(ob)
    ob.modifiers.new("Armature", "ARMATURE").object = U.rig
    # piping along every hem
    TV, TF, TW = [], [], []
    for l in loops2:
        v, f, st = S.tube(V2[l], N2[l], P["PIPE_R"], sides=6, closed=True, offset=0.0006)
        base = len(TV); TV += v; TF += [tuple(i + base for i in q) for q in f]; TW += [W2[l[s]] for s in st]
    S.new_object(U, "Anne_SuitTrim", TV, TF, M["trim"], weights=np.array(TW))
    # the skin the suit hides (all but one ring of faces next to each opening)
    suit_v = set(used)
    other = {v for i in U.real if U.mat[i] != si for v in U.polys[i]}
    margin = U.grow(suit_v & other, 1)
    hidden = np.zeros(len(U.co)); hidden[sorted(suit_v - margin)] = 1.0
    C.set_vg(U.obj, "hidden", hidden)
    skin = U.slot["Anne_Skin"]                           # what is left of the painted suit shows as skin under the hems
    for i in fsel:
        U.obj.data.polygons[i].material_index = skin
    log("suit: subdivided verts", len(V2), "tris", 2 * len(F2), "| trim tris", 2 * len(TF), "| hidden skin verts", int(hidden.sum()))
    out = sum(np.dot(N2[i], V2[i] - c0) for i in range(0, len(V2), 7)) >= 0      # hair lies on the suit, not in it
    U.add_collider(V2, F2 if out else [f[::-1] for f in F2])
    return ob


# --------------------------------------------------------------------------------------------------------- choker
def build_choker(U, M):
    ch = C.vg_mask(U.obj, "choker", 0.5) & U.isb
    pts = U.co[ch]
    b1, b2 = U.bones["neck01"], U.bones["neck02"]
    A0 = np.array(b1.head_local); a = unit(np.array(b2.tail_local) - A0)
    s = (pts - A0) @ a
    hh = P["CHOKER_H"] / 2; s0 = max(s.min() - 0.004, P["CHOKER_S"]) + hh      # a band on the neck, clear of collar and jaw
    e1 = unit(np.array([1.0, 0, 0]) - a * a[0]); e2 = np.cross(a, e1)
    rows = [(-1.0, 0.0004), (-0.95, 0.0024), (-0.6, 0.0034), (0.0, 0.0036), (0.6, 0.0034), (0.95, 0.0024), (1.0, 0.0004)]
    K = 48; V, F, Wt = [], [], []; prev = None
    for sr, off in rows:
        o = A0 + a * (s0 + sr * hh)
        dirs, rad = [], []
        for k in range(K):
            th = 2 * math.pi * k / K
            d = e1 * math.cos(th) + e2 * math.sin(th)
            hit, _ = U.ray(o, d, 0.2)
            dirs.append(d); rad.append(0.045 if hit is None else float(np.linalg.norm(hit - o)))
        rad = np.minimum(np.array(rad), np.median(rad) * 1.3)    # (a ray that slips under the jaw must not drag the band out)
        if prev is not None:
            rad = np.minimum(rad, prev + 0.0025)
        prev = rad
        for d, r in zip(dirs, rad):
            hit = o + d * r
            V.append(U.push_out(hit + d * off, off)); Wt.append(U.weights_at(hit))
    for r in range(len(rows) - 1):
        for k in range(K):
            k2 = (k + 1) % K
            F.append((r * K + k, r * K + k2, (r + 1) * K + k2, (r + 1) * K + k))
    V = np.array(V)
    N = S.vertex_normals(V, F)
    if sum(np.dot(N[i], V[i] - (A0 + a * s0)) for i in range(len(V))) < 0:
        F = [f[::-1] for f in F]
    ob = S.new_object(U, "Anne_Choker", V, F, M["choker"], weights=np.array(Wt))
    gi, skin = U.slot["Anne_GlovePaint"], U.slot["Anne_Skin"]         # the painted band under it becomes skin again
    n = 0
    for i in U.real:
        if U.mat[i] == gi and abs(U.co[list(U.polys[i])][:, 0]).max() < 0.12 and U.co[list(U.polys[i])][:, 2].min() > 1.38:
            U.obj.data.polygons[i].material_index = skin; U.mat[i] = skin; n += 1
    ca = U.obj.data.color_attributes.get("Col")          # ... and so does the colour painted into the skin there
    if ca is not None and ca.domain == 'CORNER':
        me = U.obj.data
        col = np.empty(len(me.loops) * 4, dtype=np.float32); ca.data.foreach_get("color", col); col = col.reshape(-1, 4)
        lv = np.empty(len(me.loops), dtype=np.int32); me.loops.foreach_get("vertex_index", lv)
        z = U.co[lv, 2]; x = np.abs(U.co[lv, 0])
        purple = np.array(C.hex_lin(P["CHOKER"])[:3])
        neck = U.isb[lv] & (z > 1.38) & (z < 1.53) & (x < 0.12)
        is_p = neck & (np.linalg.norm(col[:, :3] - purple, axis=1) < 0.25)
        ref = neck & ~is_p & (z > 1.40) & (z < 1.47)
        if is_p.any() and ref.any():
            col[is_p, :3] = np.median(col[ref, :3], axis=0)
            ca.data.foreach_set("color", col.ravel()); me.update()
        log("choker: painted faces returned to skin", n, "| purple corners repainted", int(is_p.sum()))
    else:
        log("choker: painted faces returned to skin", n)
    log("choker: band height mm %.1f" % (2 * hh * 1e3), "tris", 2 * len(F))
    return ob


# --------------------------------------------------------------------------------------------------------- glove cuffs
def build_cuffs(U, M):
    gi = U.slot["Anne_GlovePaint"]
    gf = [U.polys[i] for i in U.real if U.mat[i] == gi]
    loops = []
    for l in S.boundary_loops(gf):
        mx = abs(U.co[l][:, 0].mean())
        if len(l) >= 12 and 0.15 < mx < 0.31:
            loops.append(l)
    V, F, Wt, TV, TF, TW = [], [], [], [], [], []
    prof = [(0.026, 0.0008), (0.021, 0.0030), (0.006, 0.0042), (-0.007, 0.0072), (-0.009, 0.0052), (-0.006, 0.0022)]
    for l in loops:
        pts = U.co[l]; c = pts.mean(0)
        side = "L" if c[0] > 0 else "R"
        a = U.bone_dir("upperarm02." + side)
        rad = [unit((p - c) - a * np.dot(p - c, a)) for p in pts]
        e1 = rad[0]; e2 = np.cross(a, e1)                  # stations evenly round the arm, counter-clockwise about its axis
        K = 28; base = len(V); rings = []
        for sh, off in prof:
            ring = []
            for k in range(K):
                th = 2 * math.pi * k / K
                d = e1 * math.cos(th) + e2 * math.sin(th)
                o = c + a * sh
                hit, _ = U.ray(o, d, 0.2)
                if hit is None:
                    hit = o + d * 0.04
                ring.append(hit + d * off); Wt.append(U.weights_at(hit))
            rings.append(ring); V += ring
        for r in range(len(prof) - 1):
            for k in range(K):
                k2 = (k + 1) % K
                F.append((base + r * K + k, base + (r + 1) * K + k, base + (r + 1) * K + k2, base + r * K + k2))
        top = np.array(rings[3])
        tn = [unit((p - c) - a * np.dot(p - c, a)) for p in top]
        v, f, st = S.tube(top, tn, 0.0026, sides=6, closed=True, offset=0.0004)
        tb = len(TV); TV += v; TF += [tuple(i + tb for i in q) for q in f]
        wrow = [U.weights_at(p) for p in top]; TW += [wrow[s] for s in st]
    V = np.array(V)
    if len(V) == 0:
        log("cuffs: no glove edge found"); return None
    S.new_object(U, "Anne_Cuffs", V, F, M["glove"], weights=np.array(Wt))
    S.new_object(U, "Anne_CuffTrim", TV, TF, M["trim"], weights=np.array(TW))
    log("cuffs: loops", [len(l) for l in loops], "tris", 2 * len(F) + 2 * len(TF))


# --------------------------------------------------------------------------------------------------------- hat
def build_hat(U, M):
    al = math.radians(P["HAT_TILT"])
    R = np.array([[1, 0, 0], [0, math.cos(al), -math.sin(al)], [0, math.sin(al), math.cos(al)]])
    head = U.isb & (U.co[:, 2] > 1.50)
    Hd = U.co[head]
    P0 = np.array([0.0, -0.045, P["HAT_Z"]])
    for _ in range(4):
        q = (Hd - P0) @ R                                  # head in hat space
        band = np.abs(q[:, 2]) < 0.008
        y0 = (q[band, 1].max() + q[band, 1].min()) / 2
        P0 = P0 + R @ np.array([0, y0, 0])
    q = (Hd - P0) @ R; band = np.abs(q[:, 2]) < 0.008
    a = np.abs(q[band, 0]).max(); b = (q[band, 1].max() - q[band, 1].min()) / 2
    A, B = a + P["HAT_CLEAR"], b + P["HAT_CLEAR"]
    to_world = lambda pts: np.asarray(pts) @ R.T + P0
    # ---- the cone's spine: straight up, leaning back more and more, with a curl at the tip
    NS = 240; H = P["CONE_H"]
    sp = np.zeros((NS + 1, 3)); ang = np.zeros(NS + 1)
    for i in range(1, NS + 1):
        s = (i - 0.5) / NS
        ph = math.radians(46) * s ** 1.5 + (math.radians(100) * ((s - 0.76) / 0.24) ** 2 if s > 0.76 else 0.0)
        sp[i] = sp[i - 1] + np.array([0.0, math.sin(ph), math.cos(ph)]) * (H / NS)
        ang[i] = ph
    ang[0] = 0.0

    def cone_ring(s, extra=0.0, K=36):
        i = min(NS, max(0, s * NS)); i0 = int(math.floor(i)); i1 = min(NS, i0 + 1); f = i - i0
        c = sp[i0] * (1 - f) + sp[i1] * f; ph = ang[i0] * (1 - f) + ang[i1] * f
        ex = np.array([1.0, 0, 0]); ey = np.array([0.0, math.cos(ph), -math.sin(ph)])
        k = max(0.0, 1.0 - s) ** 1.12
        round_ = S.smoothstep(s, 0.0, 0.5)                 # the oval of the head becomes a circle higher up
        ra = (A + 0.002) * (1 - round_) + (A + B + 0.004) / 2 * round_
        rb = (B + 0.002) * (1 - round_) + (A + B + 0.004) / 2 * round_
        out = []
        for j in range(K):
            th = 2 * math.pi * j / K
            wob = 1.0 + 0.045 * math.sin(9.0 * s + 2 * th + 0.7) * min(1.0, 4 * s * (1 - s)) * 1.0
            out.append(c + ex * ((ra * k * wob + extra) * math.cos(th)) + ey * ((rb * k * wob + extra) * math.sin(th)))
        return out

    K = 36; V, F, col = [], [], []
    hat_c = np.array(C.hex_lin(P["HAT"])[:3]); under_c = np.array(C.hex_lin(P["HAT_UNDER"])[:3])
    ss = [0.0] + [((i / 26) ** 1.0) for i in range(1, 26)]
    for s in ss:
        V += cone_ring(s); col += [hat_c * (1.0 - 0.18 * s)] * K
    nr = len(ss)
    for r in range(nr - 1):
        for j in range(K):
            j2 = (j + 1) % K
            F.append((r * K + j, r * K + j2, (r + 1) * K + j2, (r + 1) * K + j))
    tip = len(V); V.append(sp[NS]); col.append(hat_c * 0.8)
    for j in range(K):
        F.append(((nr - 1) * K + j, (nr - 1) * K + (j + 1) % K, tip))
    # ---- the brim: a wide oval, gently waved, the front turned up, the sides and back drooping a little
    NR = 9; KB = 48; brim = P["BRIM"]

    def brim_pt(u, th, under=False):
        x = (A + 0.002 + brim * u) * math.cos(th); y = (B + 0.002 + brim * u) * math.sin(th)
        front = max(0.0, -math.sin(th)) ** 2
        z = -0.034 * u ** 1.5 * (1 - 0.9 * front) + 0.008 * u * u * front + 0.011 * u * math.sin(3 * th + 0.6)
        if under:
            z -= 0.0055 * (1 - 0.55 * u)
        return np.array([x, y, z])

    b0 = len(V)
    for r in range(NR + 1):
        u = r / NR
        for k in range(KB):
            V.append(brim_pt(u, 2 * math.pi * k / KB)); col.append(hat_c * (0.93 + 0.12 * u))
    for r in range(NR):
        for k in range(KB):
            k2 = (k + 1) % KB
            F.append((b0 + r * KB + k, b0 + (r + 1) * KB + k, b0 + (r + 1) * KB + k2, b0 + r * KB + k2))
    e0 = len(V)                                            # rounded edge
    for k in range(KB):
        th = 2 * math.pi * k / KB
        p = (brim_pt(1.0, th) + brim_pt(1.0, th, True)) / 2
        p[:2] *= 1.0 + 0.003 / max(1e-6, np.linalg.norm(p[:2]))
        V.append(p); col.append(hat_c * 0.9)
    u0 = len(V)
    for r in range(NR + 1):
        u = 1.0 - r / NR
        for k in range(KB):
            V.append(brim_pt(u, 2 * math.pi * k / KB, True)); col.append(under_c * (0.8 + 0.3 * u))
    for k in range(KB):
        k2 = (k + 1) % KB
        F.append((b0 + NR * KB + k, e0 + k, e0 + k2, b0 + NR * KB + k2))
        F.append((e0 + k, u0 + k, u0 + k2, e0 + k2))
    for r in range(NR):
        for k in range(KB):
            k2 = (k + 1) % KB
            F.append((u0 + r * KB + k, u0 + (r + 1) * KB + k, u0 + (r + 1) * KB + k2, u0 + r * KB + k2))
    Vw = to_world(np.array(V))
    Wh = np.tile(U.bone_row(head=1.0), (len(Vw), 1))
    S.new_object(U, "Anne_Hat", Vw, F, M["hat"], colors=np.array(col), weights=Wh)
    # ---- the gold band round the foot of the cone
    BV, BF = [], []
    prof = [(0.006, 0.0008), (0.012, 0.0034), (0.065, 0.0040), (0.118, 0.0034), (0.124, 0.0008)]
    for s, off in prof:
        BV += cone_ring(s, off)
    for r in range(len(prof) - 1):
        for j in range(K):
            j2 = (j + 1) % K
            BF.append((r * K + j, r * K + j2, (r + 1) * K + j2, (r + 1) * K + j))
    S.new_object(U, "Anne_HatBand", to_world(np.array(BV)), BF, M["band"], weights=np.tile(U.bone_row(head=1.0), (len(BV), 1)))
    log("hat: head oval at the band %.3f x %.3f, opening %.3f x %.3f, centre %s, tris %d" %
        (a, b, A, B, np.round(P0, 3), 2 * len(F) + 2 * len(BF)))
    U.hat = dict(P0=P0, R=R, A=A, B=B)


# ------------------------------------------------------------------------------------------- skirts and a belt (10-04)
# (As he asked: several outfits to choose from.) Loose pieces that go over her suit; all are in the model at once and the
# game shows what the chosen outfit has (anne_next.js setParts). A ring of rays from her body's own axis finds her waist
# and her hips; a skirt hangs from the waist ring, flares out below the hips in soft folds and is kept off her thighs;
# every point takes the skin weights of the skin nearest to it (in the middle, of both thighs alike), so the hem follows
# her thighs when she walks, sits or lies.
def body_ring(U, z, K=64, band=0.012, x_lim=0.26, z2=None):
    """Her outline at height z (or over the heights z..z2) as cloth spans it: the convex outline of her skin there, seen
    from above (rays from her middle would fall into the gap between her thighs). (origin, K directions (0 = her front),
    K radii)."""
    lo, hi = (z - band, z + band) if z2 is None else (min(z, z2), max(z, z2))
    sel = U.isb & (U.co[:, 2] > lo) & (U.co[:, 2] < hi) & (np.abs(U.co[:, 0]) < x_lim)
    H = np.array(S.hull2d(U.co[sel][:, :2])); n = len(H)
    o2 = np.array([0.0, (H[:, 1].min() + H[:, 1].max()) / 2])
    dirs, rad = [], []
    for k in range(K):
        th = 2 * math.pi * k / K; d = np.array([math.sin(th), -math.cos(th)]); best = None
        for i in range(n):
            a = H[i] - o2; e = H[(i + 1) % n] - H[i]
            den = d[0] * e[1] - d[1] * e[0]
            if abs(den) < 1e-12: continue
            t = (a[0] * e[1] - a[1] * e[0]) / den; q = (a[0] * d[1] - a[1] * d[0]) / den
            if t > 0 and -1e-9 <= q <= 1 + 1e-9: best = t if best is None else max(best, t)
        dirs.append(np.array([d[0], d[1], 0.0])); rad.append(0.12 if best is None else best)
    rad = np.array(rad)
    for _ in range(2):
        rad = (np.roll(rad, 1) + 2 * rad + np.roll(rad, -1)) / 4
    return np.array([o2[0], o2[1], z]), np.array(dirs), rad


def waist_height(U):
    """Where her torso is narrowest between her hips and her ribs."""
    best, zb = 9.0, 1.06
    for z in np.arange(1.0, 1.18, 0.01):
        _, _, r = body_ring(U, z, K=24)
        if r.mean() < best: best, zb = r.mean(), float(z)
    return zb


def hip_height(U):
    """Where she is widest between the top of her thighs and her waist."""
    best, zb = 0.0, 0.94
    for z in np.arange(0.86, 1.02, 0.01):
        m = U.isb & (np.abs(U.co[:, 2] - z) < 0.012) & (np.abs(U.co[:, 0]) < 0.26)
        w = float(np.abs(U.co[m][:, 0]).max()) if m.any() else 0.0
        if w > best: best, zb = w, float(z)
    return zb


def band_mesh(rings):
    K = len(rings[0]); V = [p for r in rings for p in r]; F = []
    for r in range(len(rings) - 1):
        for k in range(K):
            k2 = (k + 1) % K
            F.append((r * K + k, r * K + k2, (r + 1) * K + k2, (r + 1) * K + k))
    return np.array(V), F


def outward(V, F):
    """The faces wound so that their normals point away from her own axis."""
    N = S.vertex_normals(V, F)
    c = V.mean(0)
    s = sum(np.dot(N[i][:2], (V[i] - c)[:2]) for i in range(0, len(V), 5))
    return F if s >= 0 else [f[::-1] for f in F]


def cloth_weights(U, V, K, mid=0.07, passes=3):
    """Skin weights for a ring-built cloth: the nearest skin's, shared between her two sides near her middle, then evened out."""
    W = []
    for p in V:
        w = U.weights_at(p); s = float(S.smoothstep(abs(p[0]), 0.0, mid))
        if s < 0.999:
            w = w * (0.5 + 0.5 * s) + U.weights_at(np.array([-p[0], p[1], p[2]])) * (0.5 - 0.5 * s)
        W.append(w)
    W = np.array(W).reshape(len(V) // K, K, -1)
    for _ in range(passes):
        A = (np.roll(W, 1, axis=1) + np.roll(W, -1, axis=1) + 2 * W) / 4
        A[1:-1] = (A[1:-1] * 2 + A[:-2] + A[2:]) / 4
        W = A
    return W.reshape(len(V), -1)


def in_windows(k, K, windows):
    """Whether direction k of K (0 = her front, turning to her left) lies in one of the (centre, half width) windows, degrees."""
    if not windows: return True
    a = 360.0 * k / K
    return any(abs((a - c + 180.0) % 360.0 - 180.0) <= hw for c, hw in windows)


def build_skirt(U, M, name, hem_z, flare, folds=14, K=112, fold_amp=0.045, zh=None, windows=None, extra=0.0, mat="skirt", trim=True):
    """A skirt (or, with `windows`, panels of one: an apron, a loincloth). zh: where it leaves her body (default: her
    hips at their widest); extra: metres further out than a plain skirt (what lies over another)."""
    zw = waist_height(U); zh = hip_height(U) if zh is None else zh    # her waist, and her hips at their widest
    zlo = min(zh, hip_height(U)) - 0.11
    oh, dh, rh = body_ring(U, zh, K, z2=zlo)                      # ... and all of her from there down to the top of her thighs
    o1, d1, r1 = body_ring(U, zh, K)                              # ... and her hips alone: the cloth lies on these, and only below
    rings = []                                                    # them widens to what her thighs need (or her belly looks round under a gown)
    for t in np.linspace(0.0, 1.0, 5):                           # waist to hips: on her, a little off the suit
        z = zw + (zh - zw) * t
        o, d, r = (o1, d1, r1) if t == 1.0 else body_ring(U, z, K)
        off = 0.0065 + 0.008 * t + extra
        ring = []
        for k in range(K):
            p = o + d[k] * (r[k] + off); p[2] = z
            ring.append(U.push_out(p, off))
        rings.append(ring)
    drop = zh - hem_z; n = max(3, int(round(drop / 0.03)))
    for i in range(1, n + 1):                                    # below the hips: down and out in folds; never into her legs
        t = i / n; z = zh - drop * t
        ring = []
        for k in range(K):
            fold = 1 + fold_amp * t * math.cos(2 * math.pi * folds * k / K) if folds else 1.0
            kb = float(S.smoothstep(zh - z, 0.0, 0.09))            # from her hips' own outline to the wider one over her thighs
            c0 = o1 * (1 - kb) + oh * kb
            base = (o1 + d1[k] * (r1[k] + 0.0145 + extra)) * (1 - kb) + (oh + dh[k] * (rh[k] + 0.0145 + extra)) * kb
            p = c0 + (base - c0) * ((1 + flare * t) * fold); p[2] = z
            ring.append(U.push_out(p, 0.007 + extra))
        rings.append(ring)
    V, F = band_mesh(rings); F = outward(V, F)
    Wt = cloth_weights(U, V, K)
    hem = list(range(len(V) - K, len(V))); N = S.vertex_normals(V, F)
    lift = np.array([U.sdist(p)[0] for p in V]); rr = np.hypot(V[:, 0], V[:, 1] - oh[1]).reshape(-1, K).mean(1)
    if windows:                                                  # only the panels: the faces between directions inside a window
        nr = len(rings); keep = []
        for r in range(nr - 1):
            for k in range(K):
                if in_windows(k, K, windows) and in_windows((k + 1) % K, K, windows): keep.append(r * K + k)
        F = [F[i] for i in keep]
        used = sorted({v for f in F for v in f}); re = {v: i for i, v in enumerate(used)}
        V2 = V[used]; F2 = [tuple(re[v] for v in f) for f in F]; W2 = Wt[used]
        ob = S.new_object(U, name, V2, F2, M[mat], weights=W2)
        if trim:                                                 # a bead down each side and along the hem of every panel
            tv, tf, tw = [], [], []
            runs = []; run = []
            for k in range(K + 1):
                kk = k % K
                if in_windows(kk, K, windows) and k < K: run.append(kk)
                elif run: runs.append(run); run = []
            if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] == K - 1: runs[0] = runs.pop() + runs[0]      # (a window across direction 0)
            for run in runs:
                path = [r * K + run[0] for r in range(nr)] + [(nr - 1) * K + k for k in run[1:]] + [r * K + run[-1] for r in range(nr - 2, -1, -1)]
                v_, f_, st = S.tube(V[path], N[path], 0.0026, sides=6, closed=False, offset=0.0)
                b0 = len(tv); tv += v_; tf += [tuple(i + b0 for i in q) for q in f_]; tw += [Wt[path[s_]] for s_ in st]
            S.new_object(U, name + "Trim", tv, tf, M["trim"], weights=np.array(tw))
    else:
        ob = S.new_object(U, name, V, F, M[mat], weights=Wt)
        if trim:
            tv, tf, st = S.tube(V[hem], N[hem], 0.0034, sides=6, closed=True, offset=0.0)
            S.new_object(U, name + "Trim", tv, tf, M["trim"], weights=np.array([Wt[hem[s]] for s in st]))
    log("%s: waist z %.3f leaves her at z %.3f hem z %.3f tris %d | clearance mm min %.1f | ring radii %s" % (name, zw, zh, hem_z, 2 * len(F), lift.min() * 1e3, " ".join("%.3f" % x for x in rr)))
    return ob, zw


def build_cape(U, M, K=96, top_z=1.425, hem_z=1.02, open_half=52.0):
    """A short cape: over her shoulders and down her back to her waist, open at the front. Ring-built like a skirt, from
    the convex outline of her shoulders and upper arms; it stands well off her back, so that long hair lies under it."""
    n = max(4, int(round((top_z - hem_z) / 0.028))); rings = []
    for i in range(n + 1):
        t = i / n; z = top_z + (hem_z - top_z) * t
        o, d, r = body_ring(U, z, K, band=0.016, x_lim=0.235)
        off = 0.010 + 0.030 * float(S.smoothstep(t, 0.05, 0.6))
        ring = []
        for k in range(K):
            back = 0.5 - 0.5 * math.cos(2 * math.pi * k / K)      # 0 at her front, 1 at her back
            p = o + d[k] * ((r[k] + off) * (1 + 0.10 * t * back)); p[2] = z
            ring.append(U.push_out(p, 0.008))
        rings.append(ring)
    # the widest ring so far carries on downwards: a cape hangs from her shoulders, it does not follow her waist in
    R = np.array(rings)                                           # (rings, K, 3)
    for i in range(1, n + 1):
        ri = np.hypot(R[i, :, 0], R[i, :, 1] - R[i, :, 1].mean()); rp = np.hypot(R[i - 1, :, 0], R[i - 1, :, 1] - R[i - 1, :, 1].mean())
        small = ri < rp * 0.97
        cy = R[i, :, 1].mean()
        for k in np.nonzero(small)[0]:
            s_ = rp[k] * 0.97 / max(ri[k], 1e-6)
            R[i, k, 0] *= s_; R[i, k, 1] = cy + (R[i, k, 1] - cy) * s_
    V, F = band_mesh([list(r) for r in R]); F = outward(V, F)
    Wt = np.array([U.weights_at(p) for p in V]).reshape(n + 1, K, -1)
    for _ in range(3):                                            # evened out along and down
        A = (np.roll(Wt, 1, axis=1) + np.roll(Wt, -1, axis=1) + 2 * Wt) / 4
        A[1:-1] = (A[1:-1] * 2 + A[:-2] + A[2:]) / 4; Wt = A
    Wt = Wt.reshape(len(V), -1)
    win = [(180.0, 180.0 - open_half)]
    keep = [r * K + k for r in range(n) for k in range(K) if in_windows(k, K, win) and in_windows((k + 1) % K, K, win)]
    N = S.vertex_normals(V, F)
    F = [F[i] for i in keep]
    used = sorted({v for f in F for v in f}); re = {v: i for i, v in enumerate(used)}
    S.new_object(U, "Anne_Cape", V[used], [tuple(re[v] for v in f) for f in F], M["cape"], weights=Wt[used])
    run = [k for k in range(K) if in_windows(k, K, win)]
    path = [r * K + run[0] for r in range(n + 1)] + [n * K + k for k in run[1:]] + [r * K + run[-1] for r in range(n - 1, -1, -1)]
    tv, tf, st = S.tube(V[path], N[path], 0.003, sides=6, closed=False, offset=0.0)
    S.new_object(U, "Anne_CapeTrim", tv, tf, M["trim"], weights=np.array([Wt[path[s_]] for s_ in st]))
    log("Anne_Cape: z %.3f..%.3f tris %d" % (top_z, hem_z, 2 * len(F)))


def build_belt(U, M, zw, K=64):
    rings = []
    for dz, off in ((0.019, 0.0058), (0.016, 0.0092), (0.0, 0.0102), (-0.016, 0.0092), (-0.019, 0.0058)):
        o, d, r = body_ring(U, zw + dz, K, band=0.008)
        rings.append([U.push_out(o + d[k] * (r[k] + off), off) for k in range(K)])
    V, F = band_mesh(rings); F = outward(V, F)
    fm = [0] * len(F)
    c = np.array(rings[2][0]); n = np.array([0.0, -1.0, 0.0]); ex = np.array([1.0, 0.0, 0.0]); ez = np.array([0.0, 0.0, 1.0])
    b0 = len(V); box = []                                         # the buckle: a small plate at her front
    for dn in (-0.002, 0.0055):
        for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            box.append(c + n * dn + ex * sx * 0.019 + ez * sz * 0.0235)
    V = np.vstack([V, np.array(box)])
    for q in ((4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        F.append(tuple(b0 + i for i in q)); fm.append(1)
    Wt = np.array([U.weights_at(p) for p in V])
    S.new_object(U, "Anne_Belt", V, F, [M["belt"], M["buckle"]], weights=Wt, face_mats=fm)
    log("Anne_Belt: z %.3f tris %d" % (zw, 2 * len(F)))


def build(ctx):
    U = ctx.get("_U") or Body(ctx); ctx["_U"] = U
    M = make_materials()
    build_suit(U, M)
    build_choker(U, M)
    build_cuffs(U, M)
    build_hat(U, M)
    M["skirt"] = C.make_material("Anne_Skirt", P["SUIT"], rough=0.6); M["belt"] = C.make_material("Anne_Belt", "#6a4a2e", rough=0.5)
    M["buckle"] = C.make_material("Anne_Buckle", P["TRIM"], rough=0.3, metallic=0.5)
    M["apron"] = C.make_material("Anne_Apron", "#f4f1ea", rough=0.6); M["cape"] = C.make_material("Anne_Cape", "#5a2d91", rough=0.6)
    _, zw = build_skirt(U, M, "Anne_Skirt", 0.725, 0.36)                  # a short flared skirt (the suit's legs end at 0.80)
    build_skirt(U, M, "Anne_SkirtLong", 0.565, 0.34, folds=12)             # to just above her knees
    build_belt(U, M, zw)
    # (10-04, batch 22: the shapes his list of outfits needs)
    build_skirt(U, M, "Anne_SkirtTube", 0.735, -0.02, folds=0)             # a straight short skirt (a towel, a miniskirt)
    build_skirt(U, M, "Anne_SkirtPencil", 0.56, -0.07, folds=0)            # a straight skirt to just above her knees
    build_skirt(U, M, "Anne_SkirtMaxi", 0.115, 0.52, folds=16, fold_amp=0.05)      # a gown, to her ankles
    build_skirt(U, M, "Anne_Tutu", 0.845, 0.95, folds=24, fold_amp=0.07, zh=zw - 0.05)      # a short skirt that stands out from her waist
    build_skirt(U, M, "Anne_Panels", 0.52, 0.04, folds=0, windows=[(0.0, 19.0), (180.0, 21.0)])      # a cloth down the front and one down the back
    build_skirt(U, M, "Anne_Apron", 0.75, 0.36, folds=0, windows=[(0.0, 50.0)], extra=0.006, mat="apron")      # over the short skirt
    build_cape(U, M)
    # the painted garments on the skin get their final look too
    for name, hexc, kw in (("Anne_SuitPaint", P["SUIT"], dict(rough=0.55)), ("Anne_GlovePaint", P["GLOVE"], dict(rough=0.38, sheen=0.4))):
        if bpy.data.materials.get(name):
            C.make_material(name, hexc, **kw)
    return U
