import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'output/hazard-perception');
const ffmpeg = path.join(root, '.tmp/ad-tools/node_modules/ffmpeg-static/ffmpeg.exe');
const clips = JSON.parse(fs.readFileSync(path.join(root,'src/lib/hazard-clips.json'),'utf8'));
const complete = [];
for (const clip of clips) {
  const folder = path.join(out,clip.id), video = path.join(folder,`${clip.id}.mp4`);
  if (!fs.existsSync(video)) continue;
  const probe = spawnSync(ffmpeg,['-hide_banner','-i',video],{encoding:'utf8'}).stderr ?? '';
  const match = probe.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const duration = match ? +match[1]*3600 + +match[2]*60 + +match[3] : 0;
  if (Math.abs(duration-clip.duration)>.15) { console.log(`Not packaging incomplete clip: ${clip.id} (${duration}s)`); continue; }
  // Move metadata to the start of the file for reliable progressive playback.
  const temp = path.join(folder,'stream-ready.mp4');
  const remux = spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',video,'-c','copy','-movflags','+faststart',temp],{encoding:'utf8'});
  if (remux.status !== 0) throw new Error(remux.stderr);
  fs.renameSync(temp,video);
  const poster = spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss','0','-i',video,'-frames:v','1','-q:v','3',path.join(folder,'poster.jpg')],{encoding:'utf8'});
  if (poster.status !== 0) throw new Error(poster.stderr);
  complete.push(clip);
}
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(root,'scripts/hazard-player.html'),path.join(out,'Open Hazard Perception.html'));
fs.copyFileSync(path.join(root,'assets/hazard-perception/CREDITS.md'),path.join(out,'CREDITS.md'));
fs.writeFileSync(path.join(out,'clips.js'),`window.LDA_CLIPS=${JSON.stringify(complete)};\n`);
fs.writeFileSync(path.join(out,'scoring-manifest.json'),JSON.stringify(complete,null,2));
buildSync({entryPoints:[path.join(root,'scripts/hazard-player.ts')],bundle:true,platform:'browser',format:'iife',target:'es2020',outfile:path.join(out,'player.js')});
console.log(`Packaged ${complete.length}/${clips.length} complete clips. All retain their draft review status.`);
