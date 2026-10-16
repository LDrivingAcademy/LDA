"""A short motion/visibility test, never a final learner clip."""
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/hazard-realism-v2/school-run-child'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'school-run-child-v2.blend'))
p=bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type='HIP';p.refresh_devices()
for d in p.devices:d.use=d.type=='HIP' and '9060' in d.name
if not any(d.use for d in p.devices):raise RuntimeError('Expected HIP device missing')
s=bpy.context.scene;s.cycles.device='GPU';s.cycles.samples=24
s.render.use_persistent_data=True
s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=50
s.frame_start=361;s.frame_end=456
s.render.image_settings.media_type='VIDEO';s.render.image_settings.file_format='FFMPEG'
s.render.ffmpeg.format='MPEG4';s.render.ffmpeg.codec='H264';s.render.ffmpeg.constant_rate_factor='HIGH'
s.render.filepath=str(OUT/'school-v2-motion-preview.rendering.mp4')
bpy.ops.render.render(animation=True)
(OUT/'school-v2-motion-preview.rendering.mp4').replace(OUT/'school-v2-motion-preview.mp4')
print('Completed 4-second motion test, source seconds 15-19; not final quality.')
