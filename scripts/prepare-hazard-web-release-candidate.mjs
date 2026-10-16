import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='C:/Users/Joshu/LDA Hazard Perception Production';
const out=path.join(root,'metadata/web-library-v1');
const index=JSON.parse(fs.readFileSync(path.join(root,'final-renders/web-library-v1/clip-index.json')));
if(index.length!==15)throw Error('Wait for all fifteen verified encodes');
const objects=JSON.parse(fs.readFileSync('.tmp/lda-hazard-upload-bridge-v1/objects.json'));
const catalog=index.map(v=>{
 const p=path.join(root,'metadata/private',v.clip_id+'.json'),raw=fs.readFileSync(p),m=JSON.parse(raw);
 const o=objects.find(x=>x.clip_id===v.clip_id);
 return {clip_id:v.clip_id,public_id:o.public_id,title:v.title,duration_seconds:v.duration_seconds,max_score:m.max_score,
   hazards:m.hazards,explanation:m.explanation,status:'pending-instructional-review',visual_review:'user-approved-2026-09-12',
   scoring_review:'pending',source_sha256:v.source_sha256,video_sha256:v.sha256,storage_object:o.object,
   metadata_sha256:createHash('sha256').update(raw).digest('hex'),video:v.video};
});
const ids=catalog.map(c=>c.clip_id);
const omit=['lda-night-001','lda-rural-001'];
const manifests=omit.map((id,i)=>({set_id:'set-'+(i+1),status:'pending-instructional-review',clip_ids:ids.filter(x=>x!==id),max_score:75,practice_pass_mark:44}));
for(const m of manifests){const clips=m.clip_ids.map(id=>catalog.find(c=>c.clip_id===id));if(clips.length!==14||clips.reduce((n,c)=>n+c.max_score,0)!==75||clips.filter(c=>c.hazards.length===2).length!==1)throw Error('Invalid mock composition');}
if(new Set(manifests.flatMap(m=>m.clip_ids)).size!==15)throw Error('Not all clips are covered');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'private-release-candidate.json'),JSON.stringify({release_id:'lda-web-20260912-v1',status:'pending-instructional-review',catalog,manifests},null,2),{flag:'wx'});
fs.writeFileSync(path.join(out,'README.md'),`# LDA web release candidate — private\n\nAll 15 approved-picture-quality web videos are included. Two alternate 14-clip test selections together cover the whole bank. Each selection has 13 single-hazard clips and one double-hazard clip, giving 75 possible marks. These are overlapping selections, not two independent libraries.\n\nThe videos preserve the original 60fps presentation timeline. The private scoring windows remain provisional; appearance approval is recorded separately and is not instructional sign-off. The learner release has NOT been activated.\n\nDo not place private-release-candidate.json in public GitHub, client props, public storage or learner downloads. It contains the proposed answers. Keep the approved production release unchanged until real scoring review is recorded.\n`,{flag:'wx'});
console.log('Prepared private fifteen-clip candidate and two complete 14-clip manifests; no approval flags fabricated.');
