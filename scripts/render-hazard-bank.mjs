import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'output/hazard-perception');
const blender='C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const ffmpeg=path.join(root,'.tmp/ad-tools/node_modules/ffmpeg-static/ffmpeg.exe');
const usb='D:/Hazard Perception/LDA Blender Review - 2026-09-09';
const clips=JSON.parse(fs.readFileSync(path.join(root,'src/lib/hazard-clips.json'),'utf8'));
const revisionsFile=path.join(root,'docs/hazard-render-revisions.json');
const revisions=fs.existsSync(revisionsFile)?JSON.parse(fs.readFileSync(revisionsFile,'utf8')):{revisions:[]};
const state={startedAt:new Date().toISOString(),status:'running',current:null,completed:[],error:null};
const stateFile=path.join(output,'render-progress.json');
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
const hash=(p)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);if(hash(from)!==hash(to))throw new Error(`USB verification failed: ${to}`);};
function checkUsb(){
  const check=spawnSync('powershell.exe',['-NoProfile','-Command',"$v=Get-Volume -DriveLetter D -ErrorAction Stop; if ($v.FileSystemLabel -ne 'MKEY' -or $v.DriveType -ne 'Removable') { exit 2 }; if ($v.SizeRemaining -lt 1000000000) { exit 3 }"],{encoding:'utf8',windowsHide:true});
  if(check.status!==0)throw new Error('USB drive D: is absent, is no longer MKEY, or has less than 1 GB free. No alternate drive will be used.');
}
function duration(file){
  if(!fs.existsSync(file))return 0;
  const result=spawnSync(ffmpeg,['-hide_banner','-i',file],{encoding:'utf8'});
  const m=(result.stderr??'').match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  return m?+m[1]*3600 + +m[2]*60 + +m[3]:0;
}
async function run(command,args,log){
  const stream=fs.createWriteStream(log);
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:root,windowsHide:true});
    child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
    child.on('error',reject);
    child.on('close',(code)=>{stream.end();code===0?resolve():reject(new Error(`${path.basename(command)} exited ${code}; see ${log}`));});
  });
}
try{
  fs.mkdirSync(output,{recursive:true});checkUsb();save();
  for(const clip of clips){
    state.current=clip.id;save();
    const folder=path.join(output,clip.id),movie=path.join(folder,`${clip.id}.mp4`);
    fs.mkdirSync(folder,{recursive:true});
    const revision=revisions.revisions.find(item=>item.id===clip.id && ['pending-render','rendering'].includes(item.status));
    if(Math.abs(duration(movie)-clip.duration)>.15 || revision){
      if(revision){revision.status='rendering';fs.writeFileSync(revisionsFile,JSON.stringify(revisions,null,2));}
      console.log(`Rendering ${clip.id} at 1080p, 24 fps.`);
      await run(blender,['--background','--disable-autoexec','--factory-startup','--python-exit-code','1','--python',path.join(root,'scripts/blender/build_hazard.py'),'--','--clip',clip.id,'--scale','100','--still',String(clip.onset),'--animate'],path.join(folder,'render.log'));
    }
    if(Math.abs(duration(movie)-clip.duration)>.15)throw new Error(`Duration mismatch: ${clip.id}`);
    await run(ffmpeg,['-hide_banner','-v','error','-i',movie,'-f','null','-'],path.join(folder,'decode-check.log'));
    const interval=clip.duration/9;
    await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',movie,'-vf',`select=not(mod(n\\,${Math.round(interval*24)})),scale=480:-1,tile=3x3`,'-frames:v','1','-q:v','3',path.join(folder,'review-sheet.jpg')],path.join(folder,'review-sheet.log'));
    const packaged=spawnSync(process.execPath,[path.join(root,'scripts/package-hazard-review.mjs')],{cwd:root,encoding:'utf8',windowsHide:true});
    if(packaged.status!==0)throw new Error(packaged.stderr);
    checkUsb();
    for(const filename of [`${clip.id}.blend`,`${clip.id}.mp4`,'poster.jpg','review-sheet.jpg'])copy(path.join(folder,filename),path.join(usb,clip.id,filename));
    for(const filename of ['Open Hazard Perception.html','player.js','clips.js','scoring-manifest.json','CREDITS.md'])copy(path.join(output,filename),path.join(usb,filename));
    copy(path.join(root,'docs/hazard-perception-production.md'),path.join(usb,'READ ME - Draft status and review.md'));
    state.completed.push({id:clip.id,sha256:hash(movie),duration:clip.duration,reviewStatus:'draft',usbVerified:true});save();
    if(revision){revision.status='rendered-awaiting-visual-review';revision.sha256=hash(movie);fs.writeFileSync(revisionsFile,JSON.stringify(revisions,null,2));}
    copy(stateFile,path.join(usb,'render-progress.json'));
    console.log(`Saved and verified on MKEY: ${clip.id} (${state.completed.length}/14).`);
  }
  const sources=['scripts/blender/build_hazard.py','scripts/hazard-player.ts','scripts/hazard-player.html','scripts/package-hazard-review.mjs','scripts/render-hazard-bank.mjs','scripts/test-hazard-perception.ts','src/lib/hazard-clips.json','src/lib/hazard-perception.ts','docs/hazard-render-revisions.json','assets/hazard-perception/CREDITS.md','assets/hazard-perception/mcguire-bmw/bmw.obj','assets/hazard-perception/mcguire-bmw/bmw.mtl'];
  for(const file of sources)copy(path.join(root,file),path.join(usb,'Source',file));
  state.status='rendered-awaiting-review';state.current=null;state.finishedAt=new Date().toISOString();save();copy(stateFile,path.join(usb,'render-progress.json'));
  console.log('All 14 draft exports copied and verified. Instructor and visual review remain required.');
}catch(error){state.status='failed';state.error=String(error);save();console.error(error);process.exitCode=1;}
