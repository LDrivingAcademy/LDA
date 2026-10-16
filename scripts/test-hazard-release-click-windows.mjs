import fs from 'node:fs';
import assert from 'node:assert/strict';
import {scoreSubmission,hazardScore} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/scoring.mjs';
const root='C:/Users/Joshu/LDA Hazard Perception Production';
const release=JSON.parse(fs.readFileSync(root+'/metadata/web-library-v1/owner-authorised-release.json'));
const report={release_id:release.release_id,checked_at:new Date().toISOString(),checks:[],passed:false,scope:'Software timing rules, not independent instructional calibration.'};
for(const clip of release.catalog){
 assert.equal(scoreSubmission(clip,[]).score,0);
 for(const h of clip.hazards){
  assert.equal(hazardScore(h.start-.001,h),0);
  assert.equal(hazardScore(h.end,h),0);
  assert.equal(hazardScore(h.end+.001,h),0);
  for(let i=0;i<5;i++)assert.equal(hazardScore(h.start+(i+.5)*(h.end-h.start)/5,h),5-i);
 }
 // Sample the entire clip: no isolated click outside all hazard windows scores.
 let outsideChecks=0;
 for(let t=0;t<clip.duration_seconds;t+=.05){if(clip.hazards.every(h=>t<h.start||t>=h.end)){assert.equal(scoreSubmission(clip,[t]).score,0);outsideChecks++;}}
 const burst=scoreSubmission(clip,Array.from({length:8},(_,i)=>clip.hazards[0].start+i*.1));
 assert.equal(burst.score,0);assert.equal(burst.invalidated,true);
 const regular=scoreSubmission(clip,Array.from({length:8},(_,i)=>1+i));assert.equal(regular.score,0);assert.equal(regular.invalidated,true);
 report.checks.push({clip_id:clip.clip_id,hazards:clip.hazards.length,outside_window_samples:outsideChecks,no_click_zero:true,five_descending_score_bands:true,rapid_and_patterned_clicks_zero:true});
}
report.passed=true;fs.writeFileSync(root+'/qc-reports/web-library-v1-click-window-tests.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({clips:report.checks.length,hazards:report.checks.reduce((s,c)=>s+c.hazards,0),outside_window_checks:report.checks.reduce((s,c)=>s+c.outside_window_samples,0),passed:true}));
