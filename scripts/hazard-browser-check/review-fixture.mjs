// Private, loopback-only fixture loading. Never approves or edits release files.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function contained(base,file){
 const root=fs.realpathSync(base),actual=fs.realpathSync(file),relative=path.relative(root,actual);
 assert(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'Fixture path outside expected folder');
 return actual;
}
export function loadReviewFixture({master,packFile,packHash,setFile}){
 assert(/^[a-f0-9]{64}$/.test(packHash??''),'Explicit review pack hash required');
 packFile=contained(path.join(master,'qc-reports/instructional-review'),packFile);
 assert.equal(digest(packFile),packHash,'Review pack changed');
 const scope=read(path.join(master,'production-scope.json'));
 assert(Date.now()+30*60e3<Date.parse(scope.absolute_deadline_utc),'Deadline reserve for real-media mock');
 const pack=read(packFile);
 assert(pack.private===true&&pack.not_learner_content===true&&pack.quality_approved===false,'Only unapproved private review fixture');
 setFile=contained(path.join(master,scope.mock_test_directory),setFile);
 const manifest=read(setFile);
 assert.equal(manifest.release_id,scope.release_id);
 assert.equal(manifest.clip_ids.length,14);
 assert.equal(new Set(manifest.clip_ids).size,14);
 const catalog=manifest.clip_ids.map((id,index)=>{
  assert(scope.clip_ids.includes(id),'Clip outside active scope');
  const row=pack.clips.find(c=>c.clip_id===id);assert(row,'Missing reviewed candidate identity');
  const metadataFile=contained(path.join(master,'metadata/private'),row.metadata_file);
  assert.equal(digest(metadataFile),row.metadata_sha256,'Private metadata changed');
  const meta=read(metadataFile);assert.equal(meta.clip_id,id);
  const scene=contained(path.join(master,'source-blender'),path.join(master,meta.blender_file_path));
  const video=contained(path.join(master,'final-renders/candidates'),row.video);
  assert(/^[a-z0-9-]+$/.test(row.job_id??''),'Explicit source-bound candidate job required');
  assert.equal(fs.realpathSync(path.join(master,'final-renders/candidates',row.job_id,'candidate.mp4')),video,'Wrong review job video');
  if(meta.candidate_file_path)assert.equal(fs.realpathSync(path.join(master,meta.candidate_file_path)),video,'Wrong selected candidate');
  assert.equal(digest(scene),row.scene_sha256,'Scene changed');
  assert.equal(digest(video),row.video_sha256,'Video changed');
  assert(meta.duration_seconds>=45&&meta.duration_seconds<=60,'Unexpected duration');
  assert.equal(meta.duration_seconds,row.duration_seconds);
  assert.deepEqual(meta.hazards,row.hazards);
  return {...meta,public_id:createHash('sha256').update('local-review-fixture:'+index+':'+row.video_sha256).digest('hex').slice(0,24),video,video_sha256:row.video_sha256};
 });
 assert.equal(catalog.filter(c=>c.hazards.length===1&&c.max_score===5).length,13);
 assert.equal(catalog.filter(c=>c.hazards.length===2&&c.max_score===10).length,1);
 assert.equal(manifest.max_score,75);assert.equal(manifest.practice_pass_mark,44);
 assert.equal(new Set(catalog.map(c=>c.video_sha256)).size,14,'Distinct real videos required');
 return {catalog,sets:[{set_id:'set-1',clips:catalog}],evidence:{packFile,packHash,setFile,manifest_sha256:digest(setFile),clip_ids:catalog.map(c=>c.clip_id),quality_approved:false}};
}
