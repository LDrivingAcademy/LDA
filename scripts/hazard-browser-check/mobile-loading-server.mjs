// Loopback-only real-component/real-video transport test; no learner auth bypass
// is shipped. Attempts use the canonical scoring engine with in-memory storage.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {PersistentMocks} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/persistent-mocks.mjs';
import {validatedSets,practiceSets} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/mock-tests.mjs';

const master='C:/Users/Joshu/LDA Hazard Perception Production';
const release=JSON.parse(fs.readFileSync('src/lib/lda-hazard/server/release.json'));
const videos=JSON.parse(fs.readFileSync(master+'/final-renders/web-library-v1/clip-index.json'));
const selected=videos[0];
if(createHash('sha256').update(fs.readFileSync(selected.video)).digest('hex')!==selected.sha256)throw Error('Video identity changed');
const clip=release.catalog.find(c=>c.clip_id===selected.clip_id);
const sets=[...validatedSets(release.manifests,release.catalog),...practiceSets(release.catalog)];
const folder=fs.mkdtempSync(path.resolve('.tmp/mobile-loading-check-'));
await build({entryPoints:['scripts/hazard-browser-check/entry.tsx'],bundle:true,outfile:folder+'/player.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
fs.writeFileSync(folder+'/style.css',(await postcss([tailwind()]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:path.resolve('src/app/globals.css')})).css);
class MemoryStore {
  rows=new Map();
  async get(id,owner){const r=this.rows.get(id);return r?.owner_id===owner?structuredClone(r):null;}
  async create(r,now){if([...this.rows.values()].some(x=>!x.finished&&x.expires_ms>now))return false;this.rows.set(r.id,structuredClone(r));return true;}
  async compareAndSwap(r,revision,now){const old=this.rows.get(r.id);if(!old||old.revision!==revision||old.finished||old.expires_ms<=now)return false;this.rows.set(r.id,structuredClone(r));return true;}
}
const store=new MemoryStore(),engine=new PersistentMocks({sets,store}),owner='loopback-mobile-check';
const origin='http://127.0.0.1:4390';let mbps=12,requests=[],nextChunk=0;
const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(req.headers.host!=='127.0.0.1:4390'||(req.headers.origin&&req.headers.origin!==origin))return json(403,{});
  const url=new URL(req.url,origin);
  if(url.pathname==='/') {res.writeHead(200,{'content-type':'text/html'});return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="padding:12px"><p>LOCAL TRANSPORT CHECK — NOT THE LIVE WEBSITE</p><div id="root"></div><script src="/player.js"></script></body></html>');}
  if(['/player.js','/style.css'].includes(url.pathname)){res.writeHead(200,{'content-type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});return fs.createReadStream(folder+url.pathname).pipe(res);}
  if(url.pathname==='/__fixture/network'&&req.method==='POST'){
    let raw='';for await(const c of req)raw+=c;const n=JSON.parse(raw).mbps;
    if(!Number.isFinite(n)||n<0||n>1000)return json(400,{});mbps=n;nextChunk=Date.now();requests=[];return json(200,{mbps});
  }
  if(url.pathname==='/__fixture/stats')return json(200,{mbps,requests,video_bytes:selected.bytes,duration:selected.duration_seconds});
  if(url.pathname==='/api/lda-hazard/sets')return json(200,{available:true,active_attempt_id:[...store.rows.values()].find(r=>!r.finished)?.id??null,sets:[{set_id:sets[0].set_id,title:'Mock test 1',clip_count:14}]});
  if(url.pathname==='/api/lda-hazard/practice'&&req.method==='GET')return json(200,{clips:[{clip_id:clip.public_id,title:'Practice clip 1',duration_seconds:clip.duration_seconds,max_score:clip.max_score}]});
  if(url.pathname==='/api/lda-hazard/weak-areas')return json(200,{areas:[]});
  if(url.pathname===`/media/${clip.public_id}.mp4`){
    const total=selected.bytes;let start=0,end=total-1,status=200;
    if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m)return json(416,{});start=+m[1];end=m[2]?Math.min(+m[2],end):end;if(start>end)return json(416,{});status=206;res.setHeader('content-range',`bytes ${start}-${end}/${total}`);}
    const record={start,end,status,bytes:0,started:Date.now()};requests.push(record);
    await delay(150);if(res.destroyed)return;
    res.writeHead(status,{'content-type':'video/mp4','accept-ranges':'bytes','content-length':end-start+1,'cache-control':'private,no-store'});
    const stream=fs.createReadStream(selected.video,{start,end,highWaterMark:32768});res.on('close',()=>stream.destroy());
    try {for await(const chunk of stream){
      while(mbps===0&&!res.destroyed)await delay(100);
      if(res.destroyed)break;
      nextChunk=Math.max(Date.now(),nextChunk)+chunk.length*8/(mbps*1000);
      await delay(Math.max(0,nextChunk-Date.now()));if(res.destroyed)break;
      record.bytes+=chunk.length;res.write(chunk);
    }if(!res.destroyed)res.end();}catch{res.destroy();}return;
  }
  if(req.method==='POST'&&url.pathname.startsWith('/api/lda-hazard/')){
    if(req.headers.origin!==origin)return json(403,{});
    try {
      let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw);let value;
      if(url.pathname==='/api/lda-hazard/practice')value=await engine.begin(owner,`practice-${b.clip_id}`,b.operation_id);
      else {const m=/\/mocks\/([a-f0-9]+)\/(ready|submit|abandon)$/.exec(url.pathname);if(!m)return json(404,{});value=await engine.operate(owner,m[1],m[2],b,b.operation_id);}
      return json(200,value);
    }catch(e){return json(e.status??500,{error:e.message});}
  }
  json(404,{});
});
server.listen(4390,'127.0.0.1',()=>console.log(JSON.stringify({url:origin,folder,mbps,video_bytes:selected.bytes,duration:clip.duration_seconds})));
setTimeout(()=>server.close(),30*60*1000).unref();
