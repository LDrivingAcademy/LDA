// Loopback-only integration harness. Synthetic colour bars, no login bypass in
// the website, no real learner data, no cloud writes, never production assets.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import {PersistentMocks} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/persistent-mocks.mjs';
import {loadReviewFixture} from './review-fixture.mjs';
const project=process.cwd();
const reviewPack=process.env.LDA_HAZARD_TEST_REVIEW_PACK;
if(reviewPack&&process.env.LDA_HAZARD_TEST_VIDEO)throw Error('Choose one explicit fixture mode');
const reviewFixture=reviewPack?loadReviewFixture({master:'C:/Users/Joshu/LDA Hazard Perception Production',packFile:reviewPack,packHash:process.env.LDA_HAZARD_TEST_REVIEW_PACK_SHA256,setFile:process.env.LDA_HAZARD_TEST_SET}):null;
const suppliedVideo=process.env.LDA_HAZARD_TEST_VIDEO;
const suppliedHash=process.env.LDA_HAZARD_TEST_VIDEO_SHA256;
if(suppliedVideo){
 if(!/^[a-f0-9]{64}$/.test(suppliedHash??''))throw Error('Explicit real media requires its checked SHA256');
 const actual=createHash('sha256').update(fs.readFileSync(suppliedVideo)).digest('hex');
 if(actual!==suppliedHash)throw Error('Real media identity changed');
}else if(suppliedHash)throw Error('Hash requires explicit media');
const duration=suppliedVideo?45:10;
const temporaryBase=path.join(project,'.tmp');fs.mkdirSync(temporaryBase,{recursive:true});
const folder=(suppliedVideo||reviewFixture)?fs.mkdtempSync(path.join(temporaryBase,'hazard-real-media-check-')):path.join(temporaryBase,'hazard-react-check');fs.mkdirSync(folder,{recursive:true});
const bundle=path.join(folder,'player.js');
await build({entryPoints:[path.join(project,'scripts/hazard-browser-check/entry.tsx')],bundle:true,outfile:bundle,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const video=suppliedVideo??'C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/codec-diagnostic-vg1xh8/synthetic-test-not-a-clip.mp4';
const css=path.join(folder,'style.css');
const stylesheet=await postcss([tailwind()]).process(fs.readFileSync(path.join(project,'src/app/globals.css'),'utf8'),{from:path.join(project,'src/app/globals.css'),to:css});
fs.writeFileSync(css,stylesheet.css);
const windows=suppliedVideo?[{start:18,end:22},{start:35,end:39}]:[{start:2,end:4},{start:6,end:8}];
const catalog=reviewFixture?.catalog??Array.from({length:14},(_,i)=>({clip_id:`synthetic-${i}`,public_id:i.toString(16).padStart(24,'0'),duration_seconds:duration,max_score:i===13?10:5,hazards:i===13?windows:windows.slice(0,1),explanation:'Synthetic software check only — these are not approved training scores.',video}));
const sets=[{set_id:'set-1',clips:catalog}];
const media=new Map(catalog.map(c=>[c.public_id,c.video]));
const auditFile=path.join(folder,'server-audit.jsonl');
const audit=record=>fs.appendFileSync(auditFile,JSON.stringify({at:new Date().toISOString(),test_only:true,...record})+'\n');
if(reviewFixture)fs.writeFileSync(path.join(folder,'private-fixture.json'),JSON.stringify({evidence:reviewFixture.evidence,catalog},null,2),{flag:'wx'});
const owner='synthetic-owner-no-real-user';
class MemoryStore {
 rows=new Map();
 async get(id,user){const row=this.rows.get(id);return row?.owner_id===user?structuredClone(row):null;}
 async create(row,now){if([...this.rows.values()].some(r=>r.owner_id===row.owner_id&&!r.finished&&r.expires_ms>now))return false;this.rows.set(row.id,structuredClone(row));return true;}
 async compareAndSwap(row,revision,now){const old=this.rows.get(row.id);if(!old||old.owner_id!==row.owner_id||old.revision!==revision||old.finished||old.expires_ms<=now)return false;this.rows.set(row.id,structuredClone(row));return true;}
}
const store=new MemoryStore();
const origin='http://127.0.0.1:4387';
const failures=new Set();
const label=reviewFixture?'LOCAL SOFTWARE CHECK — 14 DISTINCT CANDIDATES, UNAPPROVED DRAFT SCORING, NOT A LEARNER RELEASE':suppliedVideo?'LOCAL SOFTWARE CHECK — REAL CANDIDATE VIDEO, SYNTHETIC SCORES, NOT AN APPROVED TEST':'SYNTHETIC SOFTWARE CHECK — NOT TRAINING FOOTAGE';
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LDA player — isolated software check</title><link rel="stylesheet" href="/style.css"></head><body style="font-family:system-ui;max-width:1100px;margin:24px auto;padding:16px"><h1 style="color:#b00000;font-weight:bold">${label}</h1><div id="root"></div><script src="/player.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(req.headers.host!=='127.0.0.1:4387'||(req.headers.origin&&req.headers.origin!==origin))return json(403,{error:'Loopback fixture only'});
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
 const files={'/player.js':[bundle,'text/javascript'],'/style.css':[css,'text/css']};
 if(req.method==='GET'&&files[url.pathname]){res.writeHead(200,{'content-type':files[url.pathname][1]});const stream=fs.createReadStream(files[url.pathname][0]);stream.on('error',()=>res.destroy());stream.pipe(res);return;}
 if(req.method==='GET'&&url.pathname==='/api/lda-hazard/sets')return json(200,{available:true,active_attempt_id:[...store.rows.values()].find(r=>!r.finished&&r.expires_ms>Date.now())?.id??null,sets:[{set_id:'set-1',title:'Mock test 1',clip_count:14}]});
 if(req.method==='GET'&&/^\/media\/[a-f0-9]{24}\.mp4$/.test(url.pathname)) {
  const selectedVideo=media.get(url.pathname.slice(7,-4));
  if(!selectedVideo)return json(404,{error:'Unknown fixture media'});
  const total=fs.statSync(selectedVideo).size;let start=0,end=total-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match)return json(416,{error:'Invalid range'});start=+match[1];end=match[2]?+match[2]:end;if(start>end||end>=total)return json(416,{error:'Invalid range'});status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${total}`);}
  audit({event:'media',public_id:url.pathname.slice(7,-4),file:selectedVideo,start,end,status});
  res.writeHead(status,{'content-type':'video/mp4','accept-ranges':'bytes','content-length':end-start+1});fs.createReadStream(selectedVideo,{start,end}).pipe(res);return;
 }
 if(req.method==='POST'&&url.pathname.startsWith('/api/lda-hazard/')) {
  if(req.headers.origin!==origin||req.headers['x-lda-hazard-request']!=='1')return json(403,{error:'Request rejected'});
  try {
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>32768)return json(413,{error:'Too large'});}
   const body=JSON.parse(raw);const engine=new PersistentMocks({sets,store});let result;
   if(url.pathname==='/api/lda-hazard/mocks')result=await engine.begin(owner,body.set_id,body.operation_id);
   else {const m=/^\/api\/lda-hazard\/mocks\/([a-f0-9]{48})\/(ready|submit|abandon)$/.exec(url.pathname);if(!m)return json(404,{error:'Missing fixture route'});result=await engine.operate(owner,m[1],m[2],body,body.operation_id);
    if(m[2]==='submit')audit({event:'submitted',clicks:body.clicks,stored_results:store.rows.get(m[1])?.payload?.state?.results,response:result});
   }
   // Explicit opt-in synthetic lost-response simulation. State commits first.
   if(req.headers['x-fixture-drop-once']==='1'&&!failures.has(body.operation_id)){failures.add(body.operation_id);return json(503,{error:'Synthetic lost response; retry the same operation.'});}
   return json(200,result);
  }catch(e){return json(e.status??500,{error:e.message});}
 }
 json(404,{error:'Not found'});
});
server.listen(4387,'127.0.0.1',()=>console.log(JSON.stringify({test_only:true,pid:process.pid,url:origin,real_media:Boolean(suppliedVideo||reviewFixture),distinct_review_videos:reviewFixture?14:0,expected_duration:reviewFixture?catalog.map(c=>c.duration_seconds):duration,media_sha256:suppliedHash??null,bundle_directory:folder,server_audit:auditFile})));
setTimeout(()=>server.close(),45*60*1000).unref();
