
import bpy, os
def export_anne(path="/Users/harrisontoppenryan/Documents/AmirianCamp3D/anne.glb"):
    rig = bpy.data.objects["Anne_Rig"]; body = bpy.data.objects["Anne_Body"]; exp = bpy.data.objects["Anne_Body_Export"]
    sc = bpy.context.scene
    rig.animation_data.action = None
    for tr in rig.animation_data.nla_tracks: tr.mute = False
    for pb in rig.pose.bones: pb.location = (0,0,0); pb.rotation_quaternion = (1,0,0,0); pb.scale = (1,1,1)
    for o in rig.children_recursive:
        if o.type == 'MESH' and o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks: k.value = 0.0
    sc.frame_set(1)
    exp.hide_viewport = False; exp.hide_render = False; exp.hide_set(False)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    sel = [rig] + [o for o in rig.children_recursive if o is not body and (o.type == 'MESH' or o.name.startswith("Marker_"))]
    for o in sel:
        o.hide_set(False); o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    r = bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True, export_morph=True,
        export_morph_normal=False, export_yup=True, export_force_sampling=True, export_def_bones=False,
        export_extras=False, export_image_format='AUTO')
    exp.hide_viewport = True; exp.hide_render = True
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    return r, round(os.path.getsize(path) / 1e6, 2), [o.name for o in sel]
