import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT/'assets/hazard-perception/creomoto-car.blend')) as (a,b):
    b.objects=[n for n in a.objects if n in ('Cube','Cylinder')]
for o in b.objects:
    bpy.context.collection.objects.link(o)
    print('ASSET',o.name, [(m.name,[(n.type,tuple(n.inputs['Color'].default_value)) for n in m.node_tree.nodes if 'Color' in n.inputs]) for m in o.data.materials],flush=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1000
scene.render.resolution_y=700
scene.render.resolution_percentage=100
world=bpy.data.worlds.new('World'); world.use_nodes=True;scene.world=world
world.node_tree.nodes.get('Background').inputs[0].default_value=(.4,.4,.4,1)
ld=bpy.data.lights.new('Sun','SUN');ld.energy=3
sun=bpy.data.objects.new('Sun',ld);scene.collection.objects.link(sun);sun.rotation_euler=(.5,-.3,-.8)
bpy.ops.object.camera_add(location=(10,-13,8))
cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.5))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.filepath=str(ROOT/'output/hazard-perception/asset-car-preview.png')
bpy.ops.render.render(write_still=True)
