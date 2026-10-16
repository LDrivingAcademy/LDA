import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='https://lda-hfv8x839x-ldrivingacademys-projects.vercel.app';
const state=JSON.parse(fs.readFileSync('.tmp/lda-hazard-upload-private-v1/browser-state.json'));
const cookie=state.cookies.map(c=>c.name+'='+c.value).join('; ');
const report={origin,checked_at:new Date().toISOString(),checks:[],passed:false};
for(const pathname of ['/','/theory-test']){
 const r=await fetch(origin+pathname);assert(r.ok);const html=await r.text();assert(html.includes('LDA'));report.checks.push({path:pathname,status:r.status});
 const csp=r.headers.get('content-security-policy');assert(csp?.includes("media-src 'self' blob:"));
}
const denied=await fetch(origin+'/api/lda-hazard/sets');assert.equal(denied.status,401);report.checks.push({check:'signed-out-access-denied',status:denied.status});
const response=await fetch(origin+'/api/lda-hazard/sets',{headers:{cookie}});assert.equal(response.status,200);const sets=await response.json();
assert.equal(sets.available,true);assert.equal(sets.instructional_review_pending,true);assert.equal(sets.sets.length,2);assert(sets.sets.every(s=>s.clip_count===14));
assert(!JSON.stringify(sets).match(/hazards|score_bands|storage_object|explanation/));
report.checks.push({check:'authenticated-real-learner-sets',status:response.status,sets:sets.sets,instructional_review_pending:sets.instructional_review_pending});
report.passed=true;
fs.writeFileSync('C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-modes-production-candidate.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
