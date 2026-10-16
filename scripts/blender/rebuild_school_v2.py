"""First-scene realism rebuild. Isolated from the rejected 14-clip batch.

Uses the existing original geometry helpers, scanned CC0 surfaces and a CC0
MakeHuman body mesh. Saves a genuine editable Cycles/HIP scene and test render.
No animation is automatically published or copied into the learner bank.
"""
import ast
import json
import math
import random
import sys
from pathlib import Path
from types import SimpleNamespace
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'assets/hazard-perception/realism-v2'
OUT=ROOT/'output/hazard-realism-v2/school-run-child'
OUT.mkdir(parents=True,exist_ok=True)
# Load definitions only: do not execute the old batch script's export entrypoint.
helper=ROOT/'scripts/blender/build_hazard.py'
tree=ast.parse(helper.read_text(encoding='utf-8'))
definitions=[]
for node in tree.body:
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='parser' for t in node.targets): break
    definitions.append(node)
g={'__file__':str(helper),'__name__':'lda_geometry_helpers'}
exec(compile(ast.Module(body=definitions,type_ignores=[]),str(helper),'exec'),g)
g['ARGS']=SimpleNamespace(cycles=True,scale=50)
scene=g['build'](g['CLIPS'][0])
box,rod,mesh,empty,key=[g[n] for n in ('box','rod','mesh','empty','key')]
MAT=g['MAT']; rng=random.Random(9102)

def scanned(name,asset,metres,vertical=False,tint=(1,1,1,1)):
    m=MAT[name];n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
    out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled')
    l.new(p.outputs['BSDF'],out.inputs['Surface'])
    coord=n.new('ShaderNodeTexCoord');scale=n.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=1/metres
    l.new(coord.outputs['Object'],scale.inputs[0]);vector=scale.outputs[0]
    if vertical:
        sep=n.new('ShaderNodeSeparateXYZ');comb=n.new('ShaderNodeCombineXYZ');add=n.new('ShaderNodeMath');add.operation='ADD'
        l.new(vector,sep.inputs[0]);l.new(sep.outputs['X'],add.inputs[0]);l.new(sep.outputs['Y'],add.inputs[1])
        l.new(add.outputs[0],comb.inputs['X']);l.new(sep.outputs['Z'],comb.inputs['Y']);vector=comb.outputs[0]
    for suffix,target in [('diff','Base Color'),('rough','Roughness'),('nor_gl',None)]:
        tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ASSETS/f'{asset}_{suffix}_2k.jpg'),check_existing=True)
        tex.image.pack();l.new(vector,tex.inputs['Vector'])
        if suffix!='diff': tex.image.colorspace_settings.name='Non-Color'
        if suffix=='nor_gl':
            normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45
            # Box-projected/planar object coordinates: bump from texture luminance
            # is more reliable here than applying tangent normals without UVs.
            bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.014
            l.new(tex.outputs['Color'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
        elif suffix=='diff':
            mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=tint
            l.new(tex.outputs['Color'],mix.inputs[1]);l.new(mix.outputs[0],p.inputs[target])
        else: l.new(tex.outputs['Color'],p.inputs[target])

scanned('asphalt','asphalt_02',3.2,tint=(.72,.72,.72,1))
scanned('paving','concrete_pavement',2)
scanned('stone','concrete_pavement',1.4,True)
for name,tint in [('brick0',(1,.9,.82,1)),('brick1',(.72,.70,.65,1)),('brick2',(.88,.75,.62,1))]: scanned(name,'red_brick',2.3,True,tint)
scanned('roof','roof_tiles',2.2,True,tint=(.45,.49,.52,1))

# Photographic outdoor illumination and physically traced reflections/shadows.
world=scene.world;n=world.node_tree.nodes;l=world.node_tree.links;n.clear()
env=n.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ASSETS/'kloofendal_38d_partly_cloudy_puresky_2k.hdr'));env.image.pack()
bg=n.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=1.0
wo=n.new('ShaderNodeOutputWorld');l.new(env.outputs[0],bg.inputs[0]);l.new(bg.outputs[0],wo.inputs[0])
for o in scene.objects:
    if o.type=='LIGHT': o.data.energy=1.5;o.data.angle=.035
MAT['lamp'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=0
scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=8
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='HIP';prefs.refresh_devices()
selected=[]
for d in prefs.devices:
    d.use=d.type=='HIP' and '9060' in d.name
    if d.use:selected.append(d.name)
if not selected: raise RuntimeError('Expected RX 9060 XT HIP device was not available; no silent CPU fallback.')
scene.cycles.device='GPU';scene.render.resolution_percentage=50

# More architectural depth: varied frontages, gutters, drainpipes, recesses and
# interiors behind reflective glazing instead of uniformly opaque blue windows.
MAT['glass'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.045,.065,.08,1)
MAT['glass'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.14
for house in [o for o in scene.objects if o.name.startswith('Brick house')]:
    house.scale.z=rng.uniform(.91,1.04)
    for xx in (-3.6,3.6):
        rod('Rainwater downpipe',(xx,3.98,.15),(xx,3.98,6.4),.055,'trim',house)
    rod('Roof gutter',(-3.7,3.98,6.4),(3.7,3.98,6.4),.08,'trim',house)
    for xx in (-2,1.8):
        for zz in (1.75,4.6):
            box('Window reveal shadow',(xx,3.80,zz),(1.48,.18,1.35),'trim',.015,house)
            box('Window inner curtain',(xx-.45,3.91,zz),(.22,.01,1.18),'paving',.01,house)

# School boundary replaces two generic left-hand houses around the hazard.
for parent in [o for o in scene.objects if o.name.startswith('Brick house') and o.location.x<0 and 93<o.location.y<128]:
    for child in list(parent.children_recursive): bpy.data.objects.remove(child,do_unlink=True)
    bpy.data.objects.remove(parent,do_unlink=True)
school=empty('LDA fictional primary school',(-18,116,0),-math.pi/2)
box('School brick building',(0,0,2.9),(28,12,5.8),'brick1',.04,school)
box('School roof coping',(0,0,5.9),(28.3,12.3,.20),'stone',.025,school)
for xx in range(-12,13,4):
    box('School window surround',(xx,6.05,3.5),(2.6,.2,2.5),'stone',.025,school)
    box('School glazed window',(xx,6.18,3.5),(2.35,.035,2.25),'glass',.01,school)
    for dx in (-.78,0,.78):box('School window mullion',(xx+dx,6.22,3.5),(.06,.04,2.3),'white',0,school)
for yy in range(94,134,2):
    if 106<yy<113:continue
    box('School boundary wall',(-6.8,yy,.46),(.3,1.95,.92),'brick0',.025)
    box('Boundary coping',(-6.8,yy,.95),(.42,2.02,.12),'stone',.02)
    for yoff in (-.75,-.45,-.15,.15,.45,.75):rod('School rail',(-6.8,yy+yoff,1),(-6.8,yy+yoff,1.8),.022,'trim')
box('School gate entrance',(-9,110,.01),(5,5,.04),'paving')
sign=empty('School identity sign',(-6.7,114,0),-math.pi/2)
box('School signboard',(0,0,1.75),(2.4,.13,.9),'coat',.03,sign)
g['text_label']('PRIMARY SCHOOL',(0,-.08,1.75),.19,'white',sign)

# Credible kerbside detail and surface repair patches.
for yy in range(12,180,18):
    for side in (-1,1):
        box('Gully grate',(side*4.3,yy,.015),(.34,.55,.025),'trim',.02)
        for offset in (-.1,0,.1):box('Drain grate ribs',(side*4.3+offset,yy,.031),(.025,.5,.025),'chrome')
for xx,yy,sx,sy in [(-1.7,69,.8,2.1),(1.6,89,1.2,3),(-.7,104,.75,1.6)]:
    box('Asphalt repair',(xx,yy,.008),(sx,sy,.006),'asphalt',.035)

# Replace the primitive figure with a fully clothed anatomical base-mesh actor.
old=bpy.data.objects.get('Developing hazard pedestrian')
for child in list(old.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
old.rotation_euler.z=math.pi/2;old.scale=(1,1,1)
vertices=[];faces=[];group=''
for line in (ASSETS/'human-base.obj').read_text().splitlines():
    if line.startswith('v '): vertices.append(tuple(map(float,line.split()[1:4])))
    elif line.startswith('g '):group=line[2:].strip()
    elif line.startswith('f ') and group=='body':faces.append([int(v.split('/')[0])-1 for v in line.split()[1:]])
used=sorted({i for f in faces for i in f});remap={v:i for i,v in enumerate(used)}
lo=min(vertices[i][1] for i in used);hi=max(vertices[i][1] for i in used);s=1.32/(hi-lo)
coords=[Vector((vertices[i][0]*s,-vertices[i][2]*s,(vertices[i][1]-lo)*s)) for i in used]
original_coords=[p.copy() for p in coords]
for i,p in enumerate(coords):
    if abs(p.x)>.21 and .72<p.z<1.15:
        side=1 if p.x>0 else -1
        pivot=Vector((side*.18,0,1.055))
        p[:]=pivot+Matrix.Rotation(side*math.radians(42),3,'Y')@(p-pivot)
body=mesh('Clothed child anatomical mesh',coords,[[remap[i] for i in f] for f in faces],'skin',old)
for m in ('coat','trousers','rubber','hair'):body.data.materials.append(MAT[m])
for p in body.data.polygons:
    centre=sum((body.data.vertices[v].co for v in p.vertices),Vector())/len(p.vertices)
    original=sum((original_coords[v] for v in p.vertices),Vector())/len(p.vertices)
    z=centre.z
    p.material_index=0 if abs(original.x)>.40 or original.z>1.10 else 3 if z<.10 else 2 if z<.68 else 1
    p.use_smooth=True
# Loose opaque clothing covers the complete torso/pelvis and upper legs.
g['ellipsoid']('School jacket',(0,0,.88),(.18,.12,.26),'coat',old)
g['ellipsoid']('School trousers waist',(0,0,.64),(.17,.12,.13),'trousers',old)
g['ellipsoid']('Short hair',(0,0,1.25),(.13,.11,.10),'hair',old)
g['ellipsoid']('School backpack',(0,.14,.9),(.14,.085,.19),'red',old)
body.shape_key_add(name='Basis')
gait_keys=[]
for phase in range(4):
    shape=body.shape_key_add(name=f'Walk phase {phase+1}')
    for i,point in enumerate(shape.data):
        p=coords[i].copy();side=1 if p.x>0 else -1
        swing=math.sin(phase*math.pi/2)*side
        if p.z<.67:
            hip=Vector((side*.085,0,.67))
            if p.z<.34:
                knee=Vector((side*.085,0,.34))
                p=knee+Matrix.Rotation(max(0,swing)*.48,3,'X')@(p-knee)
            p=hip+Matrix.Rotation(swing*.33,3,'X')@(p-hip)
        elif abs(p.x)>.19 and p.z<1.07:
            shoulder=Vector((side*.18,0,1.055))
            p=shoulder+Matrix.Rotation(-swing*.25,3,'X')@(p-shoulder)
        point.co=p
    gait_keys.append(shape)
for tick in range(65):
    t=13.75+tick/8
    for phase,shape in enumerate(gait_keys):
        shape.value=1 if tick%4==phase and tick<64 else 0
        shape.keyframe_insert('value',frame=round(t*24)+1)
for t in (0,13.7,21.8,45):
    for shape in gait_keys:
        shape.value=0;shape.keyframe_insert('value',frame=round(t*24)+1)
body['review_note']='Four authored gait phases deform legs, knees and arms. Foot planting and close-up clothing still require visual review.'

scene.frame_set(17*24+1)
scene['LDA rebuild']='V2 school scene lighting/material/geometry test, NOT final animation'
scene['LDA graphics device']=' / '.join(selected)
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'school-v2-lighting-test.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'school-run-child-v2.blend'))
(OUT/'render-report.json').write_text(json.dumps({'status':'lighting-and-geometry-test','engine':'CYCLES','device':'HIP','gpu':selected,'samples':64,'resolution':[960,540],'fps':24,'frame':scene.frame_current,'full_animation_rendered':False},indent=2))
bpy.ops.render.render(write_still=True)
print('LDA_V2_RENDER',scene.render.filepath,flush=True)
