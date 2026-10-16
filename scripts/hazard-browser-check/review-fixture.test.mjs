import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadReviewFixture} from './review-fixture.mjs';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(){
 const master=fs.mkdtempSync(path.join(os.tmpdir(),'lda-review-loader-test-'));
 const write=(relative,value)=>{const file=path.join(master,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));return file;};
 const ids=Array.from({length:14},(_,i)=>`fixture-${i}`),clips=[];
 write('production-scope.json',{absolute_deadline_utc:new Date(Date.now()+3600000).toISOString(),release_id:'fixture',clip_ids:ids,mock_test_directory:'mock-tests/release-15'});
 for(const [i,id] of ids.entries()){
  const scene=write(`source-blender/${id}.blend`,'NOT A BLENDER FILE '+i),video=write(`final-renders/candidates/${id}/candidate.mp4`,'NOT A VIDEO '+i);
  const hazards=i===13?[{start:18,end:22},{start:30,end:34}]:[{start:18,end:22}];
  const meta={clip_id:id,duration_seconds:45,hazards,max_score:i===13?10:5,status:'not-approved',blender_file_path:path.relative(master,scene),candidate_file_path:path.relative(master,video)};
  const metadata_file=write(`metadata/private/${id}.json`,meta);
  clips.push({clip_id:id,job_id:id,duration_seconds:45,hazards,video,metadata_file,metadata_sha256:hash(metadata_file),scene_sha256:hash(scene),video_sha256:hash(video)});
 }
 const packFile=write('qc-reports/instructional-review/test/private-review-forms.json',{private:true,not_learner_content:true,quality_approved:false,clips});
 const setFile=write('mock-tests/release-15/set-1.json',{release_id:'fixture',clip_ids:ids,max_score:75,practice_pass_mark:44,status:'planned-not-playable'});
 return {master,packFile,setFile,packHash:hash(packFile)};
}
test('loads 14 distinct private fixture identities without approving source manifest',()=>{
 const f=fixture(),before=hash(f.setFile),r=loadReviewFixture(f);
 assert.equal(r.catalog.length,14);assert.equal(r.evidence.quality_approved,false);assert.equal(hash(f.setFile),before);
 assert.equal(JSON.parse(fs.readFileSync(f.setFile)).status,'planned-not-playable');
});
test('rejects changed pack hash',()=>{const f=fixture();assert.throws(()=>loadReviewFixture({...f,packHash:'0'.repeat(64)}),/Review pack changed/);});
test('rejects changed private scoring metadata',()=>{const f=fixture();fs.appendFileSync(path.join(f.master,'metadata/private/fixture-0.json'),' ');assert.throws(()=>loadReviewFixture(f),/Private metadata changed/);});
test('rejects video identity mutation',()=>{const f=fixture();fs.appendFileSync(path.join(f.master,'final-renders/candidates/fixture-0/candidate.mp4'),' changed');assert.throws(()=>loadReviewFixture(f),/Video changed/);});
test('rejects manifest outside approved local test folder',()=>{const f=fixture();assert.throws(()=>loadReviewFixture({...f,setFile:f.packFile}),/outside expected folder/);});
test('supports older source-bound metadata without a candidate path field',()=>{
 const f=fixture(),pack=JSON.parse(fs.readFileSync(f.packFile));
 const row=pack.clips[0],meta=JSON.parse(fs.readFileSync(row.metadata_file));delete meta.candidate_file_path;
 fs.writeFileSync(row.metadata_file,JSON.stringify(meta));row.metadata_sha256=hash(row.metadata_file);
 fs.writeFileSync(f.packFile,JSON.stringify(pack));f.packHash=hash(f.packFile);
 assert.equal(loadReviewFixture(f).catalog.length,14);
});
test('rejects a pack whose video does not match its canonical candidate job',()=>{
 const f=fixture(),pack=JSON.parse(fs.readFileSync(f.packFile));pack.clips[0].job_id=pack.clips[1].job_id;
 fs.writeFileSync(f.packFile,JSON.stringify(pack));f.packHash=hash(f.packFile);
 assert.throws(()=>loadReviewFixture(f),/Wrong review job video/);
});
