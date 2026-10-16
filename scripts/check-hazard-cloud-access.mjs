import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://lda-n7skozvtf-ldrivingacademys-projects.vercel.app';
const state=JSON.parse(fs.readFileSync('.tmp/lda-hazard-upload-private-v1/browser-state.json'));
const cookie=state.cookies.map(c=>c.name+'='+c.value).join('; ');
const checks=[];
for(const [name,url,headers,wanted] of [
 ['signed-out-media','/api/lda-hazard/media/c1dc50f775ad80ec142b2f9e',{},401],
 ['completed-clip-replay','/api/lda-hazard/media/c1dc50f775ad80ec142b2f9e',{cookie},404],
 ['unselected-night-clip','/api/lda-hazard/media/b1ba8445a7d88ef1714d274f',{cookie},404],
 ['malformed-media-id','/api/lda-hazard/media/not-a-clip',{cookie},404]
 ]){const r=await fetch(origin+url,{method:'HEAD',headers});assert.equal(r.status,wanted,name);checks.push({name,status:r.status});}
fs.writeFileSync('C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-cloud-access.json',JSON.stringify({checked_at:new Date().toISOString(),checks,passed:true},null,2));
console.log(JSON.stringify({checks,passed:true}));
