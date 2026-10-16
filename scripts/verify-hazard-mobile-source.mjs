import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const master='C:/Users/Joshu/LDA Hazard Perception Production';
const old=master+'/archives/website-release-20260912-v1';
const candidate='.tmp/lda-hazard-full-site-v1';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=(root,prefix='')=>fs.readdirSync(path.join(root,prefix),{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(root,path.join(prefix,d.name)):[path.join(prefix,d.name).replaceAll('\\','/')]);
const changed=[],added=[];
for(const base of ['src','public'])for(const relative of files(old+'/'+base)){
  const name=base+'/'+relative;assert(fs.existsSync(candidate+'/'+name),`Missing ${name}`);
  if(hash(old+'/'+name)!==hash(candidate+'/'+name))changed.push(name);
}
for(const base of ['src','public'])for(const relative of files(candidate+'/'+base))if(!fs.existsSync(old+'/'+base+'/'+relative))added.push(base+'/'+relative);
assert.deepEqual(changed,['src/components/lda-hazard-video-test.tsx']);
assert.deepEqual(added,['src/lib/lda-hazard/playback-loading.ts']);
for(const name of ['next.config.ts','package-lock.json','vercel.json'])assert.equal(hash(old+'/'+name),hash(candidate+'/'+name),name);
const report={checked_at:new Date().toISOString(),changed,added,all_scoring_and_private_metadata_unchanged:true,all_videos_unchanged:true,passed:true};
fs.writeFileSync(master+'/qc-reports/mobile-loading-source-parity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
