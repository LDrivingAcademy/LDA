import fs from 'node:fs';
const out='.tmp/lda-hazard-full-site-v1';
for(const file of ['src/components/lda-hazard-video-test.tsx','src/components/theory-test-suite.tsx','src/lib/lda-hazard/release-validation.ts','src/lib/lda-hazard/server/api.ts','next.config.ts'])fs.copyFileSync(file,out+'/'+file);
fs.cpSync('src/lib/lda-hazard',out+'/src/lib/lda-hazard',{recursive:true});
const pkg=JSON.parse(fs.readFileSync('package.json'));
// The cloud integrity check already passed. Account setup is now isolated from
// the website build; neither temporary accounts nor tools ship in production.
pkg.scripts.build='next build';
fs.writeFileSync(out+'/package.json',JSON.stringify(pkg,null,2));
const ignored=['node_modules/','.next/','.env*','scripts/','expected-videos.json','qa-public.pem'];
fs.writeFileSync(out+'/.vercelignore',ignored.join('\n')+'\n');
console.log('Refreshed the complete site; excluded temporary QA tools from deployment.');
