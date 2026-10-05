
import bpy
from mathutils import Vector, Matrix
def aim(rig, bname, d):
    pb = rig.pose.bones[bname]; bpy.context.view_layer.update()
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(Vector(d).normalized())
    M = pb.matrix.copy(); h = M.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()
def reset(rig):
    for pb in rig.pose.bones:
        pb.location = (0,0,0); pb.rotation_quaternion = (1,0,0,0); pb.rotation_euler = (0,0,0); pb.scale = (1,1,1)
    bpy.context.view_layer.update()
