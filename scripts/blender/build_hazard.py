"""Original LDA hazard scenes. Run with Blender --background --python ... -- --clip ID.

Geometry and animation are authored here; the detailed CC0 passenger car is credited
in assets/hazard-perception/CREDITS.md.
Draft scenes are not instructor-approved. Never auto-publish from this script.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
CLIPS = json.loads((ROOT / 'src/lib/hazard-clips.json').read_text(encoding='utf-8'))
FPS = 24
MAT = {}
CAR_PARTS=[]
TREE_PARTS=[]
HEDGE_PARTS=[]


def load_detailed_car():
    """CC0 Mike Pan / Morgan McGuire model, normalised to metres, front +Y."""
    source=ROOT/'assets/hazard-perception/mcguire-bmw/bmw.obj'
    if not source.exists():
        return
    bpy.ops.wm.obj_import(filepath=str(source))
    bpy.context.view_layer.update()
    parts=list(bpy.context.selected_objects)
    coords=[o.matrix_world@Vector(v) for o in parts for v in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    scale=4.4/(hi.x-lo.x)
    transform=Matrix(((0,scale,0,-(lo.y+hi.y)*scale/2),(-scale,0,0,(lo.x+hi.x)*scale/2),(0,0,scale,-lo.z*scale),(0,0,0,1)))
    remap={'TireRubber':'rubber','BlackPlastic':'trim','MatteBlack':'trim','Glass':'glass','HeadLightGlass':'glass','HeadlightGlass':'glass','Interior':'trousers','interiorRoof':'trousers','Mirror':'chrome','CarShellNew':'blue','Tailight':'redlamp','Plate':'yellow','HeadLightAngelEye':'lamp','HeadlightMatte':'trim'}
    for o in parts:
        if 'Roundel' in o.name or o.name=='MStreak':
            bpy.data.objects.remove(o,do_unlink=True)
            continue
        o.data.transform(transform@o.matrix_world)
        o.matrix_world=Matrix.Identity(4)
        for index,m in enumerate(list(o.data.materials)):
            o.data.materials[index]=MAT[remap.get(m.name,'chrome')]
        for coll in list(o.users_collection):
            coll.objects.unlink(o)
        CAR_PARTS.append(o)


def material(name, colour, rough=.6, metal=0, emission=0, texture=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*colour, 1)
    m.use_nodes = True
    n = m.node_tree.nodes
    p = n.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*colour, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = (*colour, 1)
        p.inputs['Emission Strength'].default_value = emission
    if texture:
        noise = n.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 95
        coord=n.new('ShaderNodeTexCoord')
        m.node_tree.links.new(coord.outputs['Object'],noise.inputs['Vector'])
        ramp=n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position=.18
        ramp.color_ramp.elements[0].color=(*(v*.65 for v in colour),1)
        ramp.color_ramp.elements[1].position=.82
        ramp.color_ramp.elements[1].color=(*(v*1.15 for v in colour),1)
        m.node_tree.links.new(noise.outputs['Fac'],ramp.inputs['Fac'])
        m.node_tree.links.new(ramp.outputs['Color'],p.inputs['Base Color'])
        bump = n.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .22
        bump.inputs['Distance'].default_value = .035
        m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
        if name.startswith('brick'):
            sep=n.new('ShaderNodeSeparateXYZ');comb=n.new('ShaderNodeCombineXYZ')
            add=n.new('ShaderNodeMath');add.operation='ADD'
            m.node_tree.links.new(coord.outputs['Object'],sep.inputs[0])
            m.node_tree.links.new(sep.outputs['X'],add.inputs[0]);m.node_tree.links.new(sep.outputs['Y'],add.inputs[1])
            m.node_tree.links.new(add.outputs[0],comb.inputs['X']);m.node_tree.links.new(sep.outputs['Z'],comb.inputs['Y'])
            brick=n.new('ShaderNodeTexBrick')
            brick.inputs['Scale'].default_value=1
            brick.inputs['Brick Width'].default_value=.225
            brick.inputs['Row Height'].default_value=.075
            brick.inputs['Mortar Size'].default_value=.0035
            brick.inputs['Color1'].default_value=(*(v*.75 for v in colour),1)
            brick.inputs['Color2'].default_value=(*(v*1.1 for v in colour),1)
            brick.inputs['Mortar'].default_value=(.22,.20,.16,1)
            m.node_tree.links.new(comb.outputs[0],brick.inputs['Vector'])
            m.node_tree.links.new(brick.outputs['Color'],p.inputs['Base Color'])
            m.node_tree.links.new(brick.outputs['Fac'],bump.inputs['Height'])
    MAT[name] = m
    return m


def assign(o, mat, parent=None):
    o.data.materials.append(MAT[mat] if isinstance(mat, str) else mat)
    if parent:
        o.parent = parent
    return o


def box(name, loc, size, mat, bevel=0, parent=None):
    data=bpy.data.meshes.new(name)
    data.from_pydata([(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]],[],[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)])
    data.update()
    o=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(o)
    o.location=loc
    assign(o, mat, parent)
    if bevel:
        mod = o.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return o


def ellipsoid(name, loc, size, mat, parent=None):
    template=bpy.data.meshes.get('_sphere_template')
    if template is None:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1)
        tmp=bpy.context.object
        template=tmp.data
        template.name='_sphere_template'
        template.use_fake_user=True
        bpy.data.objects.remove(tmp,do_unlink=True)
    o=bpy.data.objects.new(name,template.copy())
    bpy.context.collection.objects.link(o)
    o.location=loc
    o.scale = size
    for p in o.data.polygons:
        p.use_smooth = True
    return assign(o, mat, parent)


def rod(name, a, b, radius, mat, parent=None, vertices=12):
    a, b = Vector(a), Vector(b)
    length=(b-a).length
    coords=[(radius*math.cos(i*math.tau/vertices),radius*math.sin(i*math.tau/vertices),z*length/2) for z in (-1,1) for i in range(vertices)]
    faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    o=mesh(name,coords,faces,mat,parent)
    o.location=(a+b)/2
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return o


def mesh(name, vertices, faces, mat, parent=None, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    assign(o, mat, parent)
    if bevel:
        m = o.modifiers.new('Body panel radii', 'BEVEL')
        m.width = bevel
        m.segments = 3
        o.modifiers.new('Body normals', 'WEIGHTED_NORMAL')
    return o


def empty(name, loc=(0, 0, 0), heading=0):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler.z = heading
    return o


def key(o, t, loc=None, rotation=None):
    if loc is not None:
        o.location = loc
        o.keyframe_insert(data_path='location', frame=round(t*FPS)+1)
    if rotation is not None:
        o.rotation_euler = rotation
        o.keyframe_insert(data_path='rotation_euler', frame=round(t*FPS)+1)


def text_label(label, loc, size, mat, parent=None, rotation=(math.pi/2, 0, 0)):
    c = bpy.data.curves.new(label, 'FONT')
    c.body = label
    c.align_x = 'CENTER'
    c.size = size
    c.extrude = .001
    o = bpy.data.objects.new(label, c)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rotation
    return assign(o, mat, parent)


def vehicle(name, x, y, colour='blue', kind='car', heading=0, door=False):
    root = empty(name, (x, y, 0), heading)
    if kind=='car' and not door and CAR_PARTS:
        for template in CAR_PARTS:
            obj=template.copy()
            bpy.context.collection.objects.link(obj)
            obj.parent=root
            for slot in obj.material_slots:
                if slot.material==MAT['blue']:
                    slot.link='OBJECT'
                    slot.material=MAT[colour]
        return root,None
    van = kind in ('van', 'works', 'ambulance')
    large = kind in ('bus', 'lorry')
    w, length = (2.35, 9) if large else (1.92, 5.1) if van else (1.8, 4.4)
    # Positive Y is the vehicle's front. Side elevations taper towards the roof.
    box(name+' lower chassis', (0, 0, .57), (w, length, .57), colour, .16, root)
    if van or large:
        height = 3.6 if kind=='lorry' else 2.8 if large else 2.35
        box('Load compartment', (0, -.55, height/2+.45), (w-.05, length-1.1, height- .6), 'silver' if kind=='lorry' else colour, .07 if kind=='lorry' else .14, root)
        box('Cab', (0, length/2-1, 1.22), (w-.06, 1.8, 1.15), colour, .16, root)
        box('Windshield', (0, length/2-.11, 1.63), (w-.26, .03, .74), 'glass', .04, root)
        if kind == 'bus':
            for side in (-1, 1):
                for yy in range(-3, 4):
                    box('Passenger window', (side*(w/2+.008), yy-.15, 2.0), (.025, .82, .83), 'glass', .03, root)
            box('Bus rear window',(0,-length/2-.018,2.12),(1.8,.04,.8),'glass',.04,root)
            box('Bus rear destination display',(0,-length/2-.042,2.5),(.8,.02,.18),'trim',.01,root)
            text_label('24',(0,-length/2-.058,2.43),.16,'amber',root)
        else:
            for side in (-1, 1):
                box('Cab window', (side*(w/2-.01), length/2-.92, 1.6), (.025, 1.0, .67), 'glass', .04, root)
        box('Rear doors seam', (0, -length/2-.01, 1.5), (.022, .025, 1.65), 'trim', 0, root)
        if kind=='lorry':
            rear=-length/2-.03
            box('Full-height rear door joint',(0,rear,2.25),(.026,.025,2.9),'trim',.005,root)
            for side in (-1,1):
                xx=side*(w/2-.12)
                box('Cargo body edge extrusion',(xx,rear,2.25),(.055,.06,2.98),'chrome',.015,root)
                box('Rear reflective outline',(side*(w/2-.22),rear-.036,2.25),(.045,.02,2.75),'yellow',0,root)
                rod('Door locking bar',(side*.48,rear-.065,.93),(side*.48,rear-.065,3.5),.022,'chrome',root)
                box('Door locking handle',(side*.57,rear-.09,1.32),(.22,.06,.045),'chrome',.01,root)
                for zz in (1.1,2.2,3.35):
                    box('Rear door hinge',(side*.94,rear-.055,zz),(.25,.055,.075),'chrome',.01,root)
                for yy in (-2.8,-1.65):
                    rod('Rear tandem truck tyre',(side*1.01,yy,.48),(side*1.23,yy,.48),.48,'rubber',root,32)
                    rod('Tandem wheel rim',(side*1.231,yy,.48),(side*1.245,yy,.48),.28,'chrome',root,24)
                box('Mud flap',(side*.93,-3.38,.38),(.52,.07,.52),'rubber',.025,root)
            for zz in (.88,3.62):
                box('Rear reflective cross strip',(0,rear-.038,zz),(2,.02,.045),'yellow',0,root)
            box('Rear underrun bar',(0,rear-.17,.33),(2.22,.14,.13),'chrome',.035,root)
            for xx in (-.9,-.6,-.3,0,.3,.6,.9):
                box('Underrun reflective marking',(xx,rear-.25,.34),(.18,.01,.07),'redlamp' if round(xx*10)%2 else 'white',0,root)
            for xx in (-.8,.8):
                box('Top rear marker lamp',(xx,rear-.06,3.73),(.12,.03,.045),'redlamp',.01,root)
    else:
        verts = [(-.86,-1.38,.88),(.86,-1.38,.88),(.85,1.3,.88),(-.85,1.3,.88),(-.66,-.93,1.5),(.66,-.93,1.5),(.66,.62,1.5),(-.66,.62,1.5)]
        mesh('Cabin shell', verts, [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], colour, root, .075)
        mesh('Front windshield', [(-.64,.65,1.47),(.64,.65,1.47),(.78,1.24,.99),(-.78,1.24,.99)], [(0,1,2,3)], 'glass', root)
        mesh('Rear windshield', [(-.64,-.96,1.47),(.64,-.96,1.47),(.78,-1.36,.99),(-.78,-1.36,.99)], [(0,1,2,3)], 'glass', root)
        for side in (-1,1):
            mesh('Side windows', [(side*.867,-1.22,1.0),(side*.685,-.85,1.44),(side*.685,.53,1.44),(side*.863,1.11,1.0)], [(0,1,2,3)], 'glass', root)
            box('B pillar', (side*.78,-.24,1.22), (.09,.095,.49), 'trim', .01, root)
            box('Door handle', (side*.91,.5,.92), (.035,.19,.04), 'chrome', .01, root)
    for side in (-1,1):
        box('Wing mirror', (side*(w/2+.13), length/2-1.48, 1.19), (.28,.29,.17), colour, .06, root)
        for yy in ([length*.31] if kind=='lorry' else [-length*.31, length*.31]):
            rr = .48 if large else .34
            rod('Tyre', (side*(w/2-.13),yy,rr), (side*(w/2+.08),yy,rr), rr, 'rubber', root, 24)
            rod('Alloy rim', (side*(w/2+.081),yy,rr), (side*(w/2+.091),yy,rr), rr*.64, 'chrome', root, 20)
            rod('Hub', (side*(w/2+.092),yy,rr), (side*(w/2+.10),yy,rr), rr*.24, 'trim', root)
        box('Headlamp', (side*w*.34,length/2+.012,.78), (w*.23,.035,.18), 'lamp', .035, root)
        box('Tail lamp', (side*w*.37,-length/2-.012,.83), (w*.16,.035,.24), 'redlamp', .025, root)
    for yy in (-1,1):
        box('Bumper insert', (0,yy*(length/2+.012),.45), (w*.85,.045,.12), 'trim', .03, root)
        box('Number plate', (0,yy*(length/2+.04),.64), (.51,.022,.11), 'yellow' if yy<0 else 'white', .008, root)
    if kind in ('ambulance', 'works'):
        box('Roof beacon', (0,0,2.6), (1.1,.24,.14), 'bluelamp' if kind=='ambulance' else 'amber', .04, root)
        for side in (-1,1):
            for yy in range(-2,2):
                box('High visibility livery', (side*.966,yy*.7,1.05), (.025,.6,.36), 'yellow' if yy%2 else 'green', 0, root)
    hinge = None
    if door:
        hinge = empty('Road-facing door hinge')
        hinge.parent = root
        hinge.location = (.9,1.02,.82)
        box('Opening door panel', (0,-.53,0), (.06,1.03,.63), colour, .035, hinge)
        box('Opening door glass', (-.065,-.5,.43), (.03,.85,.45), 'glass', .025, hinge)
    return root, hinge


def person(name, x, y, child=False, coat='coat', heading=-math.pi/2):
    root = empty(name, (x,y,.15), heading)
    scale = .73 if child else 1
    root.scale = (scale,)*3
    ellipsoid('Jacket torso', (0,0,1.18), (.22,.14,.33), coat, root)
    ellipsoid('Head', (0,0,1.65), (.12,.115,.16), 'skin', root)
    ellipsoid('Hair', (0,-.025,1.735), (.125,.105,.095), 'hair', root)
    ellipsoid('Nose',(0,.112,1.64),(.027,.045,.034),'skin',root)
    for xx in (-.045,.045):
        ellipsoid('Eye',(xx,.105,1.683),(.012,.012,.011),'hair',root)
    rod('Jacket zip',(0,.14,.94),(0,.14,1.42),.006,'chrome',root)
    rod('Neck', (0,0,1.4),(0,0,1.52),.063,'skin',root)
    pivots = []
    for side in (-1,1):
        leg = empty('Leg joint')
        leg.parent = root
        leg.location = (side*.105,0,.94)
        rod('Trouser upper leg',(0,0,0),(0,0,-.38),.078,'trousers',leg)
        knee=empty('Knee joint');knee.parent=leg;knee.location=(0,0,-.38)
        rod('Trouser lower leg',(0,0,0),(0,.01,-.35),.065,'trousers',knee)
        ellipsoid('Shoe',(0,.055,-.43),(.075,.135,.06),'rubber',knee)
        arm = empty('Shoulder joint')
        arm.parent = root
        arm.location=(side*.23,0,1.38)
        rod('Sleeve',(0,0,0),(side*.035,.02,-.41),.067,coat,arm)
        ellipsoid('Hand',(side*.035,.02,-.47),(.057,.05,.07),'skin',arm)
        pivots.append((leg,arm,knee,side))
    return root,pivots


def walk(actor, limbs, start, end, a, b):
    key(actor,0,a)
    key(actor,start,a)
    key(actor,end,b)
    key(actor,end+8,b)
    for i in range(round((end-start)*8)+1):
        t=start+i/8
        fraction=min(1,(t-start)/(end-start))
        x=a[0]+(b[0]-a[0])*fraction
        y=a[1]+(b[1]-a[1])*fraction
        ground=.14 if abs(x)>4.65 else -.04
        key(actor,t,(x,y,ground))
        for leg,arm,knee,side in limbs:
            swing=math.sin((t-start)*8)*.35*side
            key(leg,t,rotation=(swing,0,0))
            key(arm,t,rotation=(-swing,0,0))
            key(knee,t,rotation=(min(0,swing)*1.6,0,0))


def tree(x,y,rng):
    root=empty('Street tree',(x,y,0),rng.random()*math.tau)
    root.scale=(rng.uniform(.85,1.15),)*3
    if not TREE_PARTS:
        trng=random.Random(719)
        trunk=rod('Tree trunk',(0,0,0),(0,0,6),.17,'bark')
        TREE_PARTS.append(trunk)
        verts=[];faces=[];colours=[]
        for branch in range(32):
            a=branch*2.39996
            h=3.8+(branch%8)*.32
            r=1.8 if branch<24 else .7
            end=Vector((math.cos(a)*r,math.sin(a)*r,h+1.2))
            TREE_PARTS.append(rod('Tree branch',(0,0,h-.9),end,.04,'bark'))
            for leaf in range(450):
                position=end+Vector((trng.uniform(-.85,.85),trng.uniform(-.85,.85),trng.uniform(-.75,.75)))
                direction=Vector((trng.uniform(-1,1),trng.uniform(-1,1),trng.uniform(-.4,.8))).normalized()
                across=direction.cross(Vector((0,0,1))).normalized()
                length=trng.uniform(.06,.12)
                width=length*.45
                base=len(verts)
                verts.extend([position+direction*length,position+direction*length*.25+across*width,position-direction*length*.6+across*width*.65,position-direction*length,position-direction*length*.6-across*width*.65,position+direction*length*.25-across*width])
                faces.append(tuple(range(base,base+6)))
                colours.append(trng.randrange(3))
        leaves=mesh('Individual leaves',verts,faces,'leaf0')
        leaves.data.materials.append(MAT['leaf1']);leaves.data.materials.append(MAT['leaf2'])
        for p,c in zip(leaves.data.polygons,colours): p.material_index=c
        TREE_PARTS.append(leaves)
        for part in TREE_PARTS:
            for coll in list(part.users_collection): coll.objects.unlink(part)
    for template in TREE_PARTS:
        part=template.copy();bpy.context.collection.objects.link(part);part.parent=root


def hedge(x,y,rng):
    """Shared leaf geometry creates a broken leafy silhouette, not a green wall."""
    root=empty('Living hedgerow',(x,y,0))
    root.scale=(rng.uniform(.95,1.06),1,rng.uniform(.94,1.05))
    if not HEDGE_PARTS:
        hr=random.Random(805)
        HEDGE_PARTS.append(box('Dark hedge interior',(0,0,1.25),(1.5,5.85,2.45),'leaf0',.32))
        verts=[];faces=[];colours=[]
        for index in range(10000):
            face=hr.choices(['side','top','end'],[.63,.25,.12])[0]
            yy=hr.uniform(-3,3);zz=hr.uniform(.14,2.55)
            if face=='side':
                pos=Vector((hr.choice([-1,1])*(.84+hr.uniform(-.10,.12)),yy,zz))
            elif face=='top':
                pos=Vector((hr.uniform(-.84,.84),yy,2.48+.10*math.sin(yy*2)+hr.uniform(-.12,.12)))
            else:
                pos=Vector((hr.uniform(-.84,.84),hr.choice([-1,1])*(2.94+hr.uniform(-.07,.07)),zz))
            direction=Vector((hr.uniform(-1,1),hr.uniform(-1,1),hr.uniform(-1,1))).normalized()
            across=direction.cross(Vector((0,0,1))).normalized()
            length=hr.uniform(.045,.095);width=length*.55;base=len(verts)
            verts.extend([pos-direction*length,pos-direction*length*.4+across*width,pos+direction*length*.5+across*width,pos+direction*length,pos+direction*length*.5-across*width,pos-direction*length*.4-across*width])
            faces.append(tuple(range(base,base+6)));colours.append(hr.randrange(3))
        leaves=mesh('Hedgerow individual leaves',verts,faces,'leaf0')
        leaves.data.materials.append(MAT['leaf1']);leaves.data.materials.append(MAT['leaf2'])
        for polygon,colour in zip(leaves.data.polygons,colours): polygon.material_index=colour
        HEDGE_PARTS.append(leaves)
        for part in HEDGE_PARTS:
            for coll in list(part.users_collection): coll.objects.unlink(part)
    for template in HEDGE_PARTS:
        part=template.copy();bpy.context.collection.objects.link(part);part.parent=root


def house(x,y,rng):
    root=empty('Brick house',(x,y,0),-math.pi/2 if x<0 else math.pi/2)
    width=7.0
    brick='brick'+str(rng.randrange(3))
    box('Brick walls',(0,0,3.2),(width,7.5,6.4),brick,.035,root)
    verts=[(-3.8,-4,6.4),(3.8,-4,6.4),(3.8,4,6.4),(-3.8,4,6.4),(0,-4,8.5),(0,4,8.5)]
    mesh('Pitched slate roof',verts,[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2)],'roof',root)
    box('Chimney',(2,1,7.7),(.65,.8,2),brick,.02,root)
    for xx in (-2,1.8):
        for zz in (1.75,4.6):
            box('Window frame',(xx,3.77,zz),(1.65,.12,1.55),'white',.02,root)
            box('Window glass',(xx,3.85,zz),(1.42,.035,1.3),'glass',.01,root)
            box('Window mullion',(xx,3.88,zz),(.045,.02,1.3),'white',0,root)
            box('Window crossbar',(xx,3.88,zz),(1.42,.02,.045),'white',0,root)
            box('Stone sill',(xx,3.9,zz-.82),(1.85,.3,.1),'stone',.02,root)
    box('Front door',(0,3.78,1.05),(.95,.12,2.1),'door',.025,root)
    box('Door glazing',(0,3.86,1.4),(.62,.015,.6),'glass',.01,root)
    for xx in (-2.3,2.3):
        box('Garden wall',(xx,6,.45),(2.45,.24,.9),brick,.015,root)
        box('Wall cap',(xx,6,.93),(2.6,.33,.1),'stone',.02,root)
    box('Garden path',(0,4.9,.015),(1.2,2.3,.03),'paving',0,root)
    return root


def environment(clip, hazard_y):
    rng=random.Random(42)
    rural=clip['kind'] in ('horse','tractor')
    motorway=clip['kind']=='lorry'
    width=7 if motorway else 6 if rural else 9
    road_y=500 if motorway else 100
    road_length=1200 if motorway else 400
    box('Ground',(0,road_y,-.16),(1200,1500,.3) if motorway else (600,700,.3),'grass')
    box('Road asphalt',(0,road_y,-.035),(width,road_length,.07),'wetroad' if clip['weather']=='wet' else 'asphalt')
    if motorway:
        box('Separated opposing carriageway',(8.5,road_y,-.035),(7,road_length,.07),'asphalt')
        for xx in (0,8.5):
            for yy in range(-70,1100,12):
                box('Lane marking',(xx,yy,.012),(.12,4,.016),'white')
        for xx in (-3.6,4.2,12):
            rod('Motorway safety rail',(xx,-80,.75),(xx,1100,.75),.10,'chrome')
        for yy in range(-70,1100,4):
            for xx in (-3.6,4.2,12):
                box('Safety barrier support',(xx,yy,.45),(.10,.10,.9),'chrome')
        for side in (-1,1):
            for yy in range(-20,1100,48):
                tree(-22 if side<0 else 30,yy+rng.uniform(-9,9),rng)
            for yy in range(0,1200,100):
                hill=ellipsoid('Distant rolling landscape',(side*130,yy,-5),(95,110,rng.uniform(12,20)),'grass')
    else:
        for yy in range(-70,290,9):
            box('Centre line',(0,yy,.012),(.11,3,.016),'white')
        for side in (-1,1):
            spans=[(-100,300)]
            if side<0 and clip['kind'] in ('cyclist','works','tractor','horse'):
                spans=[(-100,hazard_y-1 if clip['kind']!='cyclist' else hazard_y+1.5),(hazard_y+9,300)]
            for lo,hi in spans:
                if not rural:
                    box('Kerb',(side*4.55,(lo+hi)/2,.11),(.18,hi-lo,.22),'stone',.02)
                    box('Pavement',(side*5.5,(lo+hi)/2,.09),(1.8,hi-lo,.18),'paving')
            for yy in range(-50,270,2):
                if rural: continue
                if not any(lo<=yy<=hi for lo,hi in spans): continue
                box('Pavement joint',(side*5.5,yy,.186),(1.8,.015,.003),'joint')
            if rural:
                for yy in range(-40,260,6):
                    if abs(yy-hazard_y)<8:
                        continue
                    hedge(side*4.5,yy,rng)
                for yy in range(-20,250,23):
                    tree(side*12,yy,rng)
            else:
                for yy in range(-25,235,14):
                    if side<0 and clip['kind'] in ('cyclist','works') and abs(yy-hazard_y)<12:
                        continue
                    house(side*12,yy,rng)
                for yy in range(-10,240,28):
                    if side<0 and clip['kind'] in ('cyclist','works') and abs(yy-hazard_y)<12: continue
                    tree(side*7.5,yy+7,rng)
                    rod('Lamp post',(side*5.2,yy,0),(side*5.2,yy,6.2),.065,'trim')
                    rod('Lamp arm',(side*5.2,yy,6.2),(side*3.7,yy,6.2),.05,'trim')
                    box('Street lamp',(side*3.7,yy,6.18),(.65,.24,.1),'lamp',.04)
        for idx,yy in enumerate(range(-10,245,24)):
            if rural: continue
            if abs(yy-hazard_y)<14:
                continue
            vehicle('Parked vehicle',-3.65,yy,['silver','blue','red','grey'][idx%4])
            if idx%3==0:
                vehicle('Opposite parked vehicle',3.45,yy+8,'silver',heading=math.pi)
    # Ordinary opposing traffic remains in its own lane; no scored hazard here.
    for i in range(3):
        traffic_speed=20 if motorway else 7
        initial_y=650+i*280 if motorway else hazard_y+7*(clip['onset']-5+i*16)
        traffic_x=10.2 if motorway else 1.9
        car,_=vehicle('Oncoming traffic',traffic_x,initial_y,['silver','red','blue'][i],heading=math.pi)
        key(car,0,(traffic_x,initial_y,0))
        key(car,clip['duration'],(traffic_x,initial_y-clip['duration']*traffic_speed,0))
    if clip['kind'] in ('crossing','crossing-child'):
        for xx in range(-4,5):
            box('Zebra crossing stripe',(xx,hazard_y,.02),(.5,3.2,.015),'white')
        for side in (-1,1):
            for z in range(7):
                rod('Belisha pole',(side*5,hazard_y-2,z*.4),(side*5,hazard_y-2,(z+1)*.4),.055,'white' if z%2 else 'trim')
            ellipsoid('Belisha beacon',(side*5,hazard_y-2,2.9),(.18,)*3,'amber')
    if clip['kind']=='cyclist':
        # Carry the street beyond the final view instead of terminating in grass.
        box('Side road',(-126,hazard_y+5,-.01),(247,7,.025),'asphalt')
        for side in (-1,1):
            yy=hazard_y+5+side*3.6
            box('Side street kerb',(-127.25,yy,.11),(245.5,.18,.22),'stone',.02)
            box('Side street pavement',(-127.25,yy+side*.95,.09),(245.5,1.8,.18),'paving')
            for xx in range(-28,-210,-14):
                home=house(-12,0,rng)
                home.location=(xx,hazard_y+5+side*11,0)
                home.rotation_euler.z=0 if side<0 else math.pi
            for xx in range(-35,-200,-28):
                tree(xx,hazard_y+5+side*7,rng)
        for xx in range(-12,-245,-9):
            box('Side street centre line',(xx,hazard_y+5,.012),(3,.11,.016),'white')
    if clip['kind']=='braking':
        # Widen the approach into a real roundabout footprint, with the camera
        # stopping short of its give-way line for the remaining clip.
        bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=13,depth=.07,location=(0,hazard_y+28,0))
        assign(bpy.context.object,'wetroad')
        bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=6,depth=.22,location=(0,hazard_y+28,.03))
        assign(bpy.context.object,'stone')
        bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=5.6,depth=.25,location=(0,hazard_y+28,.16))
        assign(bpy.context.object,'grass')
        for xx in (-3.2,-2.5,-1.8,-1.1,-.4):
            box('Give way marking',(xx,hazard_y+14,.045),(.45,.2,.025),'white')
    if clip['kind']=='bus':
        rod('Bus stop pole',(-5.2,hazard_y+4,.2),(-5.2,hazard_y+4,3),.045,'chrome')
        box('Bus stop sign',(-5.2,hazard_y+4,2.6),(.65,.06,.7),'white',.03)
        text_label('BUS',(-5.2,hazard_y+3.96,2.55),.16,'trim')


def camera_distance(t, starts):
    # Numerically integrate a comfortable stop then continue, avoiding any collision.
    dt=.05
    total=0
    for i in range(round(t/dt)):
        u=i*dt
        speed=5.0
        for start in starts:
            d=u-start
            if 1<d<4:
                speed=min(speed,5*(1-(d-1)/3))
            elif 4<=d<10:
                speed=0
            elif 10<=d<13:
                speed=min(speed,5*(d-10)/3)
        total+=speed*dt
    return total


def motorway_camera_distance(t, onset):
    # A moving lane change requires a larger gap, not an unexplained motorway stop.
    # 20 m/s approach, a three-second 2 m/s² deceleration, then 14 m/s.
    if t<=onset:
        return 20*t
    d=t-onset
    if d<=3:
        return 20*onset+20*d-d*d
    return 20*onset+51+14*(d-3)


def build(clip):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MAT.clear()
    CAR_PARTS.clear()
    TREE_PARTS.clear()
    HEDGE_PARTS.clear()
    colours={'asphalt':(.09,.10,.115),'wetroad':(.08,.095,.115),'white':(.78,.8,.78),'stone':(.48,.47,.42),'paving':(.40,.39,.36),'joint':(.19,.18,.17),'grass':(.16,.22,.075),'trim':(.026,.03,.035),'chrome':(.44,.48,.5),'rubber':(.018,.021,.024),'glass':(.095,.18,.23),'blue':(.045,.15,.28),'silver':(.45,.49,.51),'red':(.35,.035,.035),'grey':(.12,.135,.15),'green':(.045,.24,.065),'yellow':(.83,.64,.04),'coat':(.10,.24,.34),'trousers':(.035,.045,.065),'skin':(.6,.38,.25),'hair':(.055,.038,.028),'bark':(.12,.08,.05),'leaf0':(.075,.17,.035),'leaf1':(.11,.22,.045),'leaf2':(.16,.27,.065),'brick0':(.35,.17,.095),'brick1':(.44,.28,.18),'brick2':(.42,.36,.27),'roof':(.085,.10,.12),'door':(.065,.12,.10),'lamp':(.85,.89,.75),'redlamp':(.8,.018,.008),'amber':(1,.35,.015),'bluelamp':(.005,.12,1)}
    for name,c in colours.items():
        if name=='glass': c=(.018,.027,.036)
        if name=='asphalt': c=(.038,.042,.046)
        if name.startswith('leaf'): c=tuple(v*.5 for v in c)
        material(name,c,rough=.18 if name in ('glass','wetroad') else .32 if name in ('blue','silver','red','grey') else .8,metal=.7 if name=='chrome' else .25 if name in ('glass','blue','silver','red','grey') else 0,emission=3 if name in ('lamp','amber','bluelamp') else .25 if name=='redlamp' else 0,texture=name in ('asphalt','wetroad','paving','brick0','brick1','brick2','roof','grass'))
    load_detailed_car()
    scene=bpy.context.scene
    scene.render.engine='CYCLES' if ARGS.cycles else 'BLENDER_EEVEE'
    if ARGS.cycles:
        scene.cycles.samples=24
        scene.cycles.use_denoising=True
    elif hasattr(scene,'eevee'):
        scene.eevee.taa_render_samples=32
    scene.render.resolution_x=1920
    scene.render.resolution_y=1080
    scene.render.resolution_percentage=ARGS.scale
    scene.render.fps=FPS
    scene.frame_start=1
    scene.frame_end=int(clip['duration']*FPS)
    world=bpy.data.worlds.new('UK daylight')
    world.use_nodes=True
    scene.world=world
    bg=world.node_tree.nodes.get('Background')
    if clip['weather']=='night':
        bg.inputs[0].default_value=(.055,.08,.14,1)
        bg.inputs[1].default_value=.35
    else:
        sky=world.node_tree.nodes.new('ShaderNodeTexSky')
        sky_types=sky.bl_rna.properties['sky_type'].enum_items.keys()
        sky.sky_type='NISHITA' if 'NISHITA' in sky_types else 'MULTIPLE_SCATTERING'
        sky.sun_elevation=math.radians(30)
        sky.sun_rotation=math.radians(135)
        sky.altitude=.1
        world.node_tree.links.new(sky.outputs[0],bg.inputs[0])
        bg.inputs[1].default_value=.35 if clip['weather']=='wet' else .45
    sun_data=bpy.data.lights.new('Late morning sunlight','SUN')
    sun_data.energy=.3 if clip['weather']=='night' else 1.6 if clip['weather']=='wet' else 2.4
    sun_data.angle=.15
    sun=bpy.data.objects.new('Sun',sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler=(.55,-.45,-.65)
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-.45
    onset=clip['onset']
    hy=65+18*onset if clip['kind']=='lorry' else 5*onset+30
    print('LDA building environment',clip['id'],flush=True)
    environment(clip,hy)
    print('LDA animating scenario',len(bpy.data.objects),'objects',flush=True)
    camdata=bpy.data.cameras.new('Right-hand-drive eye level')
    cam=bpy.data.objects.new('Driver camera',camdata)
    scene.collection.objects.link(cam)
    scene.camera=cam
    camdata.lens=27
    camdata.sensor_width=36
    cam.rotation_euler=(math.pi/2-.025,0,0)
    starts=[h['start'] for h in clip['hazards']]
    for i in range(clip['duration']*2+1):
        t=i/2
        distance=motorway_camera_distance(t,onset) if clip['kind']=='lorry' else camera_distance(t,starts)
        key(cam,t,(-.65,distance,1.45))
    # A shallow bonnet at the bottom of the image anchors the driver's viewpoint.
    box('Visible bonnet',(-.48,-1.30,-.72),(1.65,.13,1.5),'grey',.14,cam)
    k=clip['kind']
    if k in ('child','pedestrian','crossing','crossing-child'):
        if k in ('child','pedestrian'):
            vehicle('Occluding parked vehicle',-3.4,hy-3.9,'silver',kind='van' if k=='pedestrian' else 'car')
        actor,limbs=person('Developing hazard pedestrian',-5.15,hy,child=k in ('child','crossing-child'))
        # Animation begins behind the parked vehicle; scoring starts at emergence.
        approach=2.25 if k in ('child','pedestrian') else 0
        walk(actor,limbs,onset-approach,onset+8-approach,(-5.15,hy,.15),(5.3,hy,.15))
        if k=='crossing-child':
            adult,al=person('Accompanying adult',-5.8,hy+.6,coat='grey')
            walk(adult,al,onset+.4,onset+9,(-5.8,hy+.6,.15),(5.6,hy+.6,.15))
    elif k in ('bus','lorry','double'):
        actor,_=vehicle('Vehicle moving into lane',-4 if k!='lorry' else 1.8,hy,'yellow' if k=='bus' else 'blue',kind=k if k in ('bus','lorry') else 'car')
        startx=actor.location.x
        if k=='lorry':
            key(actor,0,(startx,65,0))
            key(actor,onset,(startx,hy,0))
            key(actor,onset+5,(-1.9,hy+90,0))
            key(actor,clip['duration'],(-1.9,65+18*clip['duration'],0))
        else:
            key(actor,0,(startx,hy,0))
            key(actor,onset,(startx,hy,0))
            key(actor,onset+5,(-1.9,hy+12,0))
            key(actor,clip['duration'],(-1.9,hy+12+(clip['duration']-onset-5)*7,0))
        for side in ([-1] if k=='lorry' else [1]):
            marker=box('Flashing indicator',(side*.8,-4.53 if k in ('bus','lorry') else -2.23,.92),(.15,.045,.11),'amber',.02,actor)
            marker.hide_render=True
            marker.keyframe_insert(data_path='hide_render',frame=1)
            for i in range(int((clip['duration']-onset+1)*2)):
                marker.hide_render=i%2==1
                marker.keyframe_insert(data_path='hide_render',frame=round((onset-1+i*.5)*FPS)+1)
        if k=='double':
            y2=camera_distance(37,starts)+30
            vehicle('Second occluding van',-3.4,y2-4,'silver',kind='van')
            p,limbs=person('Second independent hazard',-5.1,y2)
            walk(p,limbs,37,45,(-5.1,y2,.15),(5.4,y2,.15))
    elif k=='door':
        actor,hinge=vehicle('Opening door vehicle',-3.4,hy,'red',door=True)
        key(hinge,0,rotation=(0,0,0))
        key(hinge,onset,rotation=(0,0,0))
        key(hinge,onset+2,rotation=(0,0,math.radians(68)))
        key(hinge,onset+8,rotation=(0,0,math.radians(68)))
        key(hinge,onset+10,rotation=(0,0,0))
    elif k=='braking':
        actor,_=vehicle('Braking lead vehicle',-1.9,30,'red')
        for i in range(clip['duration']*2+1):
            t=i/2
            key(actor,t,(-1.6,min(hy-1,camera_distance(t,[onset-1])+25),0))
            key(cam,t,(-.65,min(hy-14,camera_distance(t,starts)),1.45))
        for side in (-1,1):
            lamp=box('Brake lights',(side*.65,-2.22,.84),(.25,.035,.25),'redlamp',.02,actor)
            lamp.data.materials.clear()
            m=material('Brake emitter '+str(side),(1,.01,.005),emission=.2)
            lamp.data.materials.append(m)
            e=m.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength']
            e.default_value=.2
            e.keyframe_insert('default_value',frame=1)
            e.keyframe_insert('default_value',frame=round(onset*FPS))
            e.default_value=7
            e.keyframe_insert('default_value',frame=round(onset*FPS)+1)
    elif k=='works':
        for yy in range(int(hy)-15,int(hy)+15,3):
            bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.21,radius2=.035,depth=.65,location=(-3,yy,.325))
            assign(bpy.context.object,'yellow')
            rod('Reflective cone band',(-3,yy,.32),(-3,yy,.42),.12,'white')
        actor,_=vehicle('Reversing works van',-5.5,hy,'yellow',kind='works',heading=math.pi/2)
        for side in (-1,1):
            box('Reversing lamp',(side*.65,-2.57,.75),(.20,.035,.14),'lamp',.02,actor)
        key(actor,0,(-5.5,hy,0))
        key(actor,onset,(-5.5,hy,0))
        key(actor,onset+4,(-1.9,hy,0))
        key(actor,onset+9,(-1.9,hy,0))
        key(actor,onset+12,(-5.5,hy,0))
    elif k=='emergency':
        vehicle('Obstruction in opposite lane',3,hy+12,'grey',kind='van',heading=math.pi)
        actor,_=vehicle('Approaching ambulance',1.9,hy+110,'yellow',kind='ambulance',heading=math.pi)
        key(actor,0,(1.9,hy+110,0))
        key(actor,onset,(1.9,hy+35,0))
        key(actor,onset+3,(.1,hy+12,0))
        key(actor,onset+6,(.1,hy-10,0))
        key(actor,onset+9,(1.9,hy-35,0))
        key(actor,clip['duration'],(1.9,-100,0))
        for i in range(clip['duration']*2+1):
            t=i/2
            pull_over=max(0,min(1,(t-onset)/3))
            return_to_lane=max(0,min(1,(t-onset-10)/3))
            key(cam,t,(-.65-2.2*(pull_over-return_to_lane),camera_distance(t,starts),1.45))
    elif k=='cyclist':
        bike=empty('Cyclist group',(-3.0,hy-8,0))
        for yy in (-.65,.65):
            bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=(0,yy,.36),rotation=(0,math.pi/2,0),major_radius=.32,minor_radius=.025)
            assign(bpy.context.object,'rubber',bike)
            for angle in range(0,180,30):
                a=math.radians(angle)
                rod('Bicycle spoke',(0,yy+math.cos(a)*.3,.36+math.sin(a)*.3),(0,yy-math.cos(a)*.3,.36-math.sin(a)*.3),.006,'chrome',bike)
        for a,b in [((0,-.65,.36),(0,0,.4)),((0,0,.4),(0,-.25,.96)),((0,-.25,.96),(0,-.65,.36)),((0,-.25,.96),(0,.4,1)),((0,.4,1),(0,0,.4)),((0,.4,1),(0,.65,.36))]:
            rod('Bicycle frame',a,b,.028,'red',bike)
        rider,rider_limbs=person('Rider',0,0)
        rider.parent=bike
        rider.location=(0,0,.15)
        rider.rotation_euler=(-.18,0,0)
        rod('Handlebar stem',(0,.4,1),(0,.55,1.2),.025,'chrome',bike)
        rod('Handlebars',(-.3,.55,1.2),(.3,.55,1.2),.025,'chrome',bike)
        for leg,arm,knee,side in rider_limbs:
            arm.rotation_euler.x=.85
            for i in range(clip['duration']*4+1):
                t=i/4
                key(leg,t,rotation=(.7+math.sin(t*5+side*math.pi/2)*.22,0,0))
                key(knee,t,rotation=(-1.1-math.sin(t*5+side*math.pi/2)*.35,0,0))
        key(bike,0,(-3,hy-onset*3,0))
        key(bike,onset,(-3,hy,0))
        key(bike,clip['duration'],(-3,hy+(clip['duration']-onset)*3,0))
        # Complete a genuine left turn only after the cyclist has cleared it.
        for i in range(clip['duration']*2+1):
            t=i/2;distance=camera_distance(t,starts);corner=hy-.75
            if distance<=corner:
                key(cam,t,(-.65,distance,1.45),rotation=(math.pi/2-.025,0,0))
                continue
            arc=min(math.pi/2,(distance-corner)/4)
            xx=-.65-4*(1-math.cos(arc))
            yy=corner+4*math.sin(arc)
            if arc>=math.pi/2: xx-=max(0,distance-corner-2*math.pi)
            key(cam,t,(max(-30,xx),yy,1.45),rotation=(math.pi/2-.025,0,arc))
    elif k=='tractor':
        actor=empty('Tractor',(-7,hy,0),-math.pi/2)
        box('Tractor engine hood',(0,.7,1.1),(1.1,2,.6),'green',.14,actor)
        box('Tractor chassis',(0,0,.65),(1.2,3,.3),'trim',.04,actor)
        box('Tractor cab',(0,-.7,1.8),(1.4,1.35,1.5),'glass',.05,actor)
        box('Tractor roof',(0,-.7,2.6),(1.6,1.6,.15),'green',.05,actor)
        rod('Tractor exhaust',(.45,.35,1.4),(.45,.35,2.4),.06,'trim',actor)
        for side in (-1,1):
            rod('Large tractor rear tyre',(side*.8,-1.1,.75),(side*1.15,-1.1,.75),.75,'rubber',actor,24)
            rod('Tractor wheel hub',(side*1.15,-1.1,.75),(side*1.16,-1.1,.75),.42,'yellow',actor,20)
            rod('Tractor front tyre',(side*.65,1.25,.45),(side*.95,1.25,.45),.45,'rubber',actor,20)
            rod('Tractor front hub',(side*.951,1.25,.45),(side*.96,1.25,.45),.26,'yellow',actor,20)
        key(actor,0,(-7,hy,0),rotation=(0,0,-math.pi/2))
        key(actor,onset,(-5.3,hy,0),rotation=(0,0,-math.pi/2))
        key(actor,onset+6,(-1.9,hy+5,0),rotation=(0,0,0))
        key(actor,clip['duration'],(-1.9,hy+5+(clip['duration']-onset-6)*3,0))
    elif k=='horse':
        actor=empty('Horse and rider',(-7,hy,0),-math.pi/2)
        ellipsoid('Horse body',(0,0,1.25),(.34,.83,.40),'bark',actor)
        rod('Horse neck',(0,.5,1.4),(0,.9,2),.2,'bark',actor)
        ellipsoid('Horse head',(0,1.05,1.94),(.17,.38,.20),'bark',actor)
        rod('Horse tail',(0,-.65,1.4),(0,-1.1,.55),.055,'hair',actor)
        for xx in (-.10,.10):
            mesh('Horse ear',[(xx-.035,.97,2.08),(xx+.035,.97,2.08),(xx,1.02,2.43)],[(0,1,2)],'bark',actor)
        for xx in (-.22,.22):
            for yy in (-.55,.55):
                leg=empty('Horse leg joint');leg.parent=actor;leg.location=(xx,yy,1.2)
                rod('Horse upper leg',(0,0,0),(0,0,-.53),.068,'bark',leg)
                joint=empty('Horse knee');joint.parent=leg;joint.location=(0,0,-.53)
                rod('Horse lower leg',(0,0,0),(0,0,-.52),.044,'bark',joint)
                ellipsoid('Hoof',(0,.025,-.58),(.075,.11,.07),'rubber',joint)
                for i in range(clip['duration']*4+1):
                    t=i/4
                    angle=.22*math.sin((t-onset)*5+(0 if xx*yy>0 else math.pi)) if t>=onset else 0
                    key(leg,t,rotation=(angle,0,0));key(joint,t,rotation=(min(0,angle)*1.2,0,0))
        rider,_=person('Horse rider',0,0)
        rider.parent=actor
        rider.location=(0,-.1,.6)
        rider.rotation_euler.z=0
        key(actor,0,(-7,hy,0),rotation=(0,0,-math.pi/2))
        key(actor,onset,(-5.4,hy,0),rotation=(0,0,-math.pi/2))
        key(actor,onset+8,(-1.9,hy+5,0),rotation=(0,0,0))
        key(actor,clip['duration'],(-1.9,hy+5+(clip['duration']-onset-8)*1.5,0))
        for i in range(clip['duration']*2+1):
            t=i/2
            if t>=onset+8:
                horse_y=hy+5+(t-onset-8)*1.5
                key(cam,t,(-.65,min(camera_distance(t,starts),horse_y-20),1.45))
    if clip['weather']=='night':
        light=bpy.data.lights.new('Driver headlamps','AREA')
        light.energy=500
        light.shape='DISK'
        light.size=1
        o=bpy.data.objects.new('Headlamp illumination',light)
        scene.collection.objects.link(o)
        o.parent=cam
        o.location=(0,-.5,-1)
    # Blender 4.4+ action slots: iterate channel bags without deprecated fcurve APIs.
    for action in bpy.data.actions:
        for layer in action.layers:
            for strip in layer.strips:
                if not hasattr(strip,'channelbags'):
                    continue
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:
                            point.interpolation='CONSTANT' if curve.data_path=='hide_render' else 'LINEAR'
    for h in clip['hazards']:
        scene.timeline_markers.new('DRAFT scoring begins: '+h['label'],frame=round(h['start']*FPS)+1)
        scene.timeline_markers.new('DRAFT scoring ends',frame=round(h['end']*FPS)+1)
    scene['LDA review status']='DRAFT - instructor and visual review required; not DVSA approved'
    scene['LDA clip id']=clip['id']
    return scene


parser=argparse.ArgumentParser()
parser.add_argument('--clip',default=CLIPS[0]['id'])
parser.add_argument('--scale',type=int,default=50)
parser.add_argument('--still',type=float,default=None)
parser.add_argument('--animate',action='store_true')
parser.add_argument('--cycles',action='store_true')
parser.add_argument('--end-frame',type=int,default=None)
parser.add_argument('--start-frame',type=int,default=None)
parser.add_argument('--output-root',type=Path,default=ROOT/'output/hazard-perception')
ARGS=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
clip=next(c for c in CLIPS if c['id']==ARGS.clip)
output_root=ARGS.output_root if ARGS.output_root.is_absolute() else ROOT/ARGS.output_root
out=output_root.resolve()/clip['id']
out.mkdir(parents=True,exist_ok=True)
scene=build(clip)
import gpu
gpu.init()
gpu_report={'backend':gpu.platform.backend_type_get(),'renderer':gpu.platform.renderer_get(),'vendor':gpu.platform.vendor_get(),'engine':scene.render.engine}
scene['LDA graphics device']=gpu_report['renderer']
(out/'render-device.json').write_text(json.dumps(gpu_report,indent=2),encoding='utf-8')
print('LDA_GPU_DEVICE',json.dumps(gpu_report),flush=True)
scene.frame_set(1)
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/'frames/frame_')
bpy.ops.wm.save_as_mainfile(filepath=str(out/(clip['id']+'.blend')))
if ARGS.still is not None:
    scene.frame_set(round(ARGS.still*FPS)+1)
    scene.render.filepath=str(out/f'preview-{ARGS.still:g}.png')
    bpy.ops.render.render(write_still=True)
if ARGS.animate:
    if ARGS.start_frame:
        scene.frame_start=ARGS.start_frame
    if ARGS.end_frame:
        scene.frame_end=ARGS.end_frame
    if hasattr(scene.render.image_settings,'media_type'):
        scene.render.image_settings.media_type='VIDEO'
    scene.render.image_settings.file_format='FFMPEG'
    scene.render.ffmpeg.format='MPEG4'
    scene.render.ffmpeg.codec='H264'
    scene.render.ffmpeg.constant_rate_factor='MEDIUM'
    scene.render.filepath=str(out/(clip['id']+'.rendering.mp4'))
    bpy.ops.render.render(animation=True)
    # Keep the last complete movie intact until Blender closes the new container.
    (out/(clip['id']+'.rendering.mp4')).replace(out/(clip['id']+'.mp4'))
print('LDA_OUTPUT',out)
