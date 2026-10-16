import fs from 'node:fs';
import path from 'node:path';
const master='C:/Users/Joshu/LDA Hazard Perception Production';
const out='.tmp/lda-hazard-full-site-v1';
if(fs.existsSync(out))throw Error('Deployment directory already exists');
const index=JSON.parse(fs.readFileSync(path.join(master,'final-renders/web-library-v1/clip-index.json')));
const uploads=JSON.parse(fs.readFileSync(path.join(master,'final-renders/web-library-v1/upload-index.json')));
if(index.length!==15||uploads.length!==15)throw Error('All fifteen encodes and uploads are required');
const objects=JSON.parse(fs.readFileSync('.tmp/lda-hazard-upload-bridge-v1/objects.json'));
const catalog=index.map(v=>{
 const m=JSON.parse(fs.readFileSync(path.join(master,'metadata/private',v.clip_id+'.json'))),o=objects.find(x=>x.clip_id===v.clip_id);
 const upload=uploads.find(x=>x.clip_id===v.clip_id);if(upload.sha256!==v.sha256||upload.object!==o.object)throw Error('Mismatched upload');
 // Preserve authored timing as provisional. Appearance approval is separate.
 return {clip_id:v.clip_id,public_id:o.public_id,duration_seconds:v.duration_seconds,max_score:m.max_score,hazards:m.hazards,
   explanation:m.explanation,status:'verified-media',visual_review:'approved',scoring_review:'provisional',
   source_sha256:v.source_sha256,video_sha256:v.sha256,storage_object:o.object};
});
const ids=catalog.map(c=>c.clip_id);
const release={status:'verified-playable',release_id:'lda-web-20260912-v1',review_policy:'owner-authorised-provisional',
 owner_authorised:true,instructional_review:'pending',owner_authorisation_note:'User explicitly authorised implementation before an instructor review on 2026-09-12.',
 catalog,manifests:['lda-night-001','lda-rural-001'].map((omit,i)=>({set_id:'set-'+(i+1),status:'verified-playable',clip_ids:ids.filter(id=>id!==omit),max_score:75,practice_pass_mark:44}))};
fs.mkdirSync(out,{recursive:true});
for(const dir of ['src','public'])fs.cpSync(dir,path.join(out,dir),{recursive:true,errorOnExist:true});
for(const file of ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','postcss.config.mjs','vercel.json'])if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,file));
fs.mkdirSync(path.join(out,'.vercel'));
fs.copyFileSync('.tmp/lda-hazard-upload-bridge-v1/.vercel/project.json',path.join(out,'.vercel/project.json'));
fs.writeFileSync(path.join(out,'src/lib/lda-hazard/server/release.json'),JSON.stringify(release,null,2));
fs.mkdirSync(path.join(out,'scripts'),{recursive:true});
fs.copyFileSync('scripts/verify-hazard-cloud-library.mjs',path.join(out,'scripts/verify-hazard-cloud-library.mjs'));
fs.copyFileSync('scripts/create-hazard-qa-cloud.mjs',path.join(out,'scripts/create-hazard-qa-cloud.mjs'));
fs.copyFileSync('.tmp/lda-hazard-upload-bridge-v1/upload-public.pem',path.join(out,'qa-public.pem'));
fs.writeFileSync(path.join(out,'expected-videos.json'),JSON.stringify(uploads.map(v=>({object:v.object,public_id:v.public_id,sha256:v.sha256,bytes:v.bytes}))));
const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json')));
pkg.scripts.build='node scripts/verify-hazard-cloud-library.mjs && next build && node scripts/create-hazard-qa-cloud.mjs';
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify(pkg,null,2));
fs.writeFileSync(path.join(out,'.vercelignore'),'node_modules/\n.next/\n.env*\n');
fs.mkdirSync(path.join(master,'metadata/web-library-v1'),{recursive:true});
fs.writeFileSync(path.join(master,'metadata/web-library-v1/owner-authorised-release.json'),JSON.stringify(release,null,2));
console.log('Prepared the complete LDA website with a private owner-authorised provisional practice release.');
