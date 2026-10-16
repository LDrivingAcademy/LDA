import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const cli='C:/Users/Joshu/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const before='dpl_4Ja75krcm1wRv9E4CnRVo5GUpYfi',after='dpl_CtBjwG5AfykhoF3Lhoc94v1fxp3K';
function files(id){
 const tree=JSON.parse(execFileSync(process.execPath,[cli,'api',`/v6/deployments/${id}/files?teamId=team_tKtLsQdt8Omu58bqTcpTCt8r`,'--raw'],{encoding:'utf8',windowsHide:true,maxBuffer:10e6}));
 const result=new Map();
 function walk(nodes,prefix=''){for(const n of nodes){const p=prefix?prefix+'/'+n.name:n.name;if(n.children)walk(n.children,p);else if(n.type==='file')result.set(p.replace(/^src\//,''),n.uid);}}
 walk(tree);return result;
}
const a=files(before),b=files(after),changed=[...new Set([...a.keys(),...b.keys()])].filter(k=>a.get(k)!==b.get(k));
assert.deepEqual(changed,['src/components/lda-hazard-video-test.tsx']);
const report={before,after,changed,changes:['Requested heading','Discard stale menu refresh when starting an attempt'],scoring_and_private_catalog_unchanged:true,checked_at:new Date().toISOString(),passed:true};
fs.writeFileSync('C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-final-component-source-diff.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
