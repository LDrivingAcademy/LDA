import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const origin=process.argv[2];
assert(['https://lda-oxd9ga9vv-ldrivingacademys-projects.vercel.app','https://ldrivingacademy.co.uk'].includes(origin));
const page=await fetch(origin+'/theory-test');assert.equal(page.status,200);
const html=await page.text();
const scripts=[...new Set([...html.matchAll(/<script[^>]+src="([^\"]+)"/g)].map(m=>m[1]))];
// Include the lazy-loaded player chunk observed after opening Hazard awareness.
const cli='C:/Users/Joshu/AppData/Local/npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const observed=JSON.parse(execFileSync(cli,['--session','lda-mobile-candidate','eval','--stdin'],{input:`({origin:location.origin,resources:performance.getEntriesByType('resource').map(r=>r.name).filter(s=>s.startsWith(location.origin+'/_next/static/')&&s.endsWith('.js'))})`,encoding:'utf8',windowsHide:true}));
assert.equal(observed.origin,origin);scripts.push(...observed.resources.map(s=>new URL(s).pathname));
const chunks=await Promise.all(scripts.map(async src=>{const url=new URL(src,origin);assert.equal(url.origin,origin);const r=await fetch(url);assert(r.ok);return r.text();}));
const source=chunks.join('\n');
for(const marker of ['Preparing smooth playback','Unreliable connection? Download fully first','wakeLock','buffered'])assert(source.includes(marker),`Missing ${marker}`);
const anonymous=await fetch(origin+'/api/lda-hazard/media/c1dc50f775ad80ec142b2f9e');assert.equal(anonymous.status,401);
const data=await anonymous.json();assert(!JSON.stringify(data).includes('storage/'));
const report={url:origin+'/theory-test',checked_at:new Date().toISOString(),updated_client_bundle:true,anonymous_media_denied:true,actual_authenticated_mobile_playback:false,passed:true};
fs.writeFileSync('C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/mobile-loading-'+(origin.includes('vercel.app')?'candidate':'live')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
