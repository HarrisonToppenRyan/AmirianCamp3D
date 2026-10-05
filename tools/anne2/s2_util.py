"""Helpers shared by the stage-2 builders (s2_outfit.py, s2_hair.py, s2_shoes.py). See ANNE2_SPEC.md.

Everything works on the rest pose of build/anne2_s1.blend: 1 unit = 1 m, +Z up, Anne faces -Y, her left is +X.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from collections import defaultdict
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C


def log(*a):
    print("S2 |", *a)
    sys.stdout.flush()


class Body:
    """Rest-pose snapshot of Anne_Body: positions, real-body faces, a BVH for distance queries, bone weights."""

    def __init__(self, ctx):
        self.obj = body = ctx["body"]; self.rig = rig = ctx["rig"]
        self.info = ctx.get("info") or ctx.get("s1_json") or {}
        self.col = rig.users_collection[0]
        assert np.allclose(np.array(body.matrix_world), np.eye(4), atol=1e-5), "the body must sit at the origin"
        rig.data.pose_position = 'REST'; bpy.context.view_layer.update()
        self.co = C.get_co(body)
        self.isb = C.body_mask(body)
        me = body.data
        self.polys = [tuple(p.vertices) for p in me.polygons]
        self.mat = np.array([p.material_index for p in me.polygons])
        self.real = [i for i, p in enumerate(self.polys) if all(self.isb[v] for v in p)]
        self.rpolys = [self.polys[i] for i in self.real]
        self.rebuild()
        self.names, self.W = C.bone_weights(body, rig)
        self.slot = {s.material.name: i for i, s in enumerate(body.material_slots)}
        self.bones = rig.data.bones
        nb = defaultdict(set)
        for p in self.rpolys:
            n = len(p)
            for i in range(n):
                a, b = p[i], p[(i + 1) % n]; nb[a].add(b); nb[b].add(a)
        self.nb = nb
        rig.data.pose_position = 'POSE'; bpy.context.view_layer.update()

    def rebuild(self):
        """Call after changing self.co (the body's rest shape)."""
        self.bvh = BVHTree.FromPolygons([tuple(v) for v in self.co], self.rpolys)
        self._collide()

    def add_collider(self, V, F):
        """A garment that later parts (hair) must rest on, not cut into. Faces must be wound outwards."""
        self.colliders = getattr(self, "colliders", []) + [(np.asarray(V, float), [tuple(f) for f in F])]
        self._collide()

    def _collide(self):
        verts = [tuple(v) for v in self.co]; polys = list(self.rpolys)
        for V, F in getattr(self, "colliders", []):
            base = len(verts); verts += [tuple(v) for v in V]; polys += [tuple(i + base for i in f) for f in F]
        self.cbvh = BVHTree.FromPolygons(verts, polys) if getattr(self, "colliders", None) else self.bvh

    def sdist(self, p):
        """(signed distance, nearest point, outward normal there): negative inside the body."""
        v = Vector((float(p[0]), float(p[1]), float(p[2])))
        loc, nrm, idx, dist = self.cbvh.find_nearest(v)           # the skin and any garment already on her
        s = (v - loc).dot(nrm)
        return (dist if s >= 0 else -dist), np.array(loc), np.array(nrm), idx

    def push_out(self, p, clear):
        """The point moved (if needed) so that it is at least `clear` outside the skin."""
        sd, loc, nrm, _ = self.sdist(p)
        if sd >= clear:
            return np.asarray(p, float)
        return loc + nrm * clear

    def ray(self, origin, direction, dist=10.0):
        hit = self.bvh.ray_cast(Vector(tuple(float(x) for x in origin)), Vector(tuple(float(x) for x in direction)), dist)
        return (None, None) if hit[0] is None else (np.array(hit[0]), np.array(hit[1]))

    def weights_at(self, p):
        """Skin weights (row over self.names) at the skin point nearest to p."""
        v = Vector((float(p[0]), float(p[1]), float(p[2])))
        loc, nrm, idx, dist = self.bvh.find_nearest(v)
        vs = list(self.rpolys[idx])
        d = np.array([(Vector(tuple(self.co[i])) - loc).length for i in vs]) + 1e-5
        k = 1.0 / d; k /= k.sum()
        return (self.W[vs] * k[:, None]).sum(0)

    def bone_row(self, **kw):
        """A weight row from bone=weight pairs, e.g. bone_row(head=1.0)."""
        r = np.zeros(len(self.names))
        for n, w in kw.items():
            r[self.names.index(n)] = w
        return r

    def grow(self, verts, rings):
        s = set(verts)
        for _ in range(rings):
            s |= {b for a in s for b in self.nb[a]}
        return s

    def bone_dir(self, name):
        b = self.bones[name]
        return np.array((b.tail_local - b.head_local).normalized())


def set_weights(obj, names, Wv, limit=4, min_w=0.02):
    """Write an (N, n_bones) weight array as vertex groups (the `limit` strongest per vertex, normalised)."""
    groups = {}
    for vi in range(Wv.shape[0]):
        w = Wv[vi]
        idx = [int(j) for j in np.argsort(w)[::-1][:limit] if w[j] > min_w]
        tot = float(sum(w[j] for j in idx))
        if tot <= 0:
            continue
        for j in idx:
            g = groups.get(j)
            if g is None:
                g = groups[j] = obj.vertex_groups.get(names[j]) or obj.vertex_groups.new(name=names[j])
            g.add([vi], float(w[j]) / tot, 'REPLACE')


def new_object(U, name, verts, faces, materials, colors=None, weights=None, face_mats=None, smooth=True):
    """A mesh object in Anne's collection, parented to the rig with an Armature modifier.
    colors: (N, 3) linear RGB per vertex -> colour attribute 'Col'. weights: (N, n_bones) over U.names."""
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(float(x) for x in v) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    ob = bpy.data.objects.new(name, me); U.col.objects.link(ob)
    for m in (materials if isinstance(materials, (list, tuple)) else [materials]):
        me.materials.append(m)
    if face_mats is not None:
        me.polygons.foreach_set("material_index", [int(i) for i in face_mats])
    if colors is not None:
        ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
        c = np.ones((len(verts), 4), dtype=np.float32); c[:, :3] = np.asarray(colors, dtype=np.float32)[:, :3]
        ca.data.foreach_set("color", c.ravel())
        me.color_attributes.active_color = ca
        try: me.color_attributes.render_color_index = me.color_attributes.find("Col")
        except Exception: pass
    if smooth:
        C.shade_smooth(ob)
    ob.parent = U.rig
    ob.modifiers.new("Armature", "ARMATURE").object = U.rig
    if weights is not None:
        set_weights(ob, U.names, np.asarray(weights))
    return ob


def boundary_loops(faces):
    """Ordered vertex loops along the open edges of a face list."""
    cnt = defaultdict(int)
    for f in faces:
        n = len(f)
        for i in range(n):
            a, b = f[i], f[(i + 1) % n]
            cnt[(min(a, b), max(a, b))] += 1
    adj = defaultdict(list)
    for (a, b), c in cnt.items():
        if c == 1:
            adj[a].append(b); adj[b].append(a)
    loops, seen = [], set()
    for s in sorted(adj):
        if s in seen:
            continue
        loop = [s]; seen.add(s); prev, cur = None, s
        while True:
            nxt = [v for v in adj[cur] if v != prev and v not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]; loop.append(cur); seen.add(cur)
        loops.append(loop)
    return loops


def vertex_normals(V, F):
    N = np.zeros_like(V)
    for f in F:
        p = V[list(f)]
        n = np.zeros(3)
        for i in range(len(f)):
            a, b = p[i], p[(i + 1) % len(f)]
            n += np.cross(a, b)
        for i in f:
            N[i] += n
    ln = np.linalg.norm(N, axis=1); ln[ln < 1e-12] = 1.0
    return N / ln[:, None]


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def tube(points, normals, radius, sides=6, closed=True, offset=0.0, squash=1.0, radii=None):
    """A tube along a polyline. Returns (verts, faces, station index per vertex). normals: the 'up' of each station
    (the tube centre is shifted along it by offset; squash scales the tube across it)."""
    P = np.asarray(points, float); n = len(P)
    V, F, S = [], [], []
    for i in range(n):
        a = P[(i - 1) % n] if (closed or i > 0) else P[i]
        b = P[(i + 1) % n] if (closed or i < n - 1) else P[i]
        t = unit(b - a)
        nn = unit(normals[i] - t * np.dot(normals[i], t)); bb = np.cross(t, nn)
        r = radius if radii is None else radii[i]
        for j in range(sides):
            ang = 2 * math.pi * j / sides
            V.append(P[i] + nn * (offset + r * math.cos(ang)) + bb * (r * squash * math.sin(ang))); S.append(i)
    for i in range(n if closed else n - 1):
        i2 = (i + 1) % n
        for j in range(sides):
            j2 = (j + 1) % sides
            F.append((i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2))
    return V, F, S


def smoothstep(x, lo, hi):
    return C.smoothstep(x, lo, hi)


def hull2d(pts):
    """Convex hull of 2D points (counter-clockwise), Andrew's monotone chain."""
    pts = sorted(set((round(float(x), 6), round(float(y), 6)) for x, y in pts))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def apply_modifier(ob, mod):
    with C.override(ob):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def mesh_arrays(ob):
    """(V, F) of an object's mesh as numpy / tuples."""
    return C.get_co(ob), [tuple(p.vertices) for p in ob.data.polygons]


def group_rows(ob, names):
    """Bone weights of an object as an (N, len(names)) array."""
    col = {ob.vertex_groups[n].index: i for i, n in enumerate(names) if n in ob.vertex_groups}
    Wv = np.zeros((len(ob.data.vertices), len(names)))
    for v in ob.data.vertices:
        for ge in v.groups:
            c = col.get(ge.group)
            if c is not None:
                Wv[v.index, c] = ge.weight
    return Wv
