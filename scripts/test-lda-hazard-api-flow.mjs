// Runs the actual API/sequencing/scoring/media code with explicitly isolated adapters.
// No network, real account, credential, database, release activation or deployment.
import assert from 'node:assert/strict';
import {test, beforeEach, after} from 'node:test';
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Portable CI defaults to synthetic bytes; an explicit hash-bound local MP4 can
// exercise the same route with real media. Neither mode needs external services.
const media=process.env.LDA_HAZARD_TEST_VIDEO??null;
const suppliedHash=process.env.LDA_HAZARD_TEST_VIDEO_SHA256;
if(media)assert.match(suppliedHash??'',/^[a-f0-9]{64}$/,'Explicit local MP4 requires its expected SHA256');
else assert.equal(suppliedHash,undefined,'A media hash requires an explicit media path');
const length=media?fs.statSync(media).size:50_000_000;
assert.ok(length>4_500_000,'Exercise response larger than the usual buffered function limit');
function mediaStream(start,end){
 if(media)return fs.createReadStream(media,{start,end,highWaterMark:65536});
 return Readable.from((function*(){for(let p=start;p<=end;p+=65536)yield Buffer.alloc(Math.min(65536,end-p+1));})());
}
const expectedDigest=createHash('sha256');for await(const chunk of mediaStream(0,length-1))expectedDigest.update(chunk);
const mediaHash=expectedDigest.digest('hex');if(media)assert.equal(mediaHash,suppliedHash,'Exact previously decoded local MP4 required');
const productionRelease=fs.readFileSync(path.join(root,'src/lib/lda-hazard/server/release.json'));
const origin='https://lda-test.invalid',storageOrigin='https://storage-test.invalid';
const catalog=Array.from({length:15},(_,i)=>({clip_id:`lda-fixture-${i}`,public_id:(i+1).toString(16).padStart(24,'0'),
 duration_seconds:45,max_score:i===13?10:5,hazards:i===13?[{start:18,end:22},{start:35,end:39}]:[{start:18,end:22}],
 explanation:'PRIVATE TEST EXPLANATION',status:'verified-final',visual_review:'approved',scoring_review:'approved',
 source_sha256:String(i%10).repeat(64),video_sha256:mediaHash,storage_object:`test-only/${(i+1).toString(16).padStart(24,'0')}.mp4`}));
const fixtureRelease={status:'verified-playable',release_id:'test-only',catalog,
 manifests:[{set_id:'set-1',status:'verified-playable',clip_ids:catalog.slice(0,14).map(c=>c.clip_id),max_score:75,practice_pass_mark:44}]};
let state;
const originalFetch=globalThis.fetch,originalNow=Date.now;
Date.now=()=>state?.now??originalNow();

class Query {
 constructor(){this.filters=[];this.operation='select';}
 select(){return this;}
 order(){return this;}
 limit(){return this;}
 eq(key,value){this.filters.push(r=>r[key]===value);return this;}
 gt(key,value){this.filters.push(r=>r[key]>value);return this;}
 lte(key,value){this.filters.push(r=>r[key]<=value);return this;}
 update(value){this.operation='update';this.value=value;return this;}
 insert(value){this.operation='insert';this.value=value;return this;}
 run(){
  if(state.databaseError)return {data:null,error:{code:'TEST_FAILURE',message:'PRIVATE DATABASE ERROR'}};
  if(this.operation==='insert'){
   if(state.rows.has(this.value.id)||[...state.rows.values()].some(r=>r.owner_id===this.value.owner_id&&!r.finished))return {data:null,error:{code:'23505'}};
   state.rows.set(this.value.id,structuredClone(this.value));return {data:null,error:null};
  }
  const rows=[...state.rows.values()].filter(r=>this.filters.every(f=>f(r)));
  if(this.operation==='update')for(const row of rows)Object.assign(row,structuredClone(this.value));
  return {data:structuredClone(rows),error:null};
 }
 then(resolve,reject){return Promise.resolve(this.run()).then(resolve,reject);}
 maybeSingle(){const r=this.run();return Promise.resolve({...r,data:r.data?.[0]??null});}
}
function reset(){
 state={now:1_000_000,rows:new Map(),actor:{id:'test-owner-a'},role:'learner',adminRole:false,
  databaseError:false,signError:false,wrongSignOrigin:false,signCalls:[],fetchCalls:[],upstreamFailure:false,throttled:false};
 globalThis.__LDA_HAZARD_FLOW_TEST__={
  client:{auth:{getUser:async()=>({data:{user:state.actor},error:null})}},
  roles:()=>({isAdmin:state.adminRole,effectiveRole:state.role}),
  throttled:()=>state.throttled,
  admin:{from(table){assert.equal(table,'lda_hazard_mock_attempts');return new Query();},storage:{from(bucket){
   assert.equal(bucket,'lda-hazard-clips');return {async createSignedUrl(object,seconds){
    assert.equal(seconds,90);state.signCalls.push(object);
    return state.signError?{error:{message:'PRIVATE SIGN ERROR'},data:null}:{error:null,data:{signedUrl:`${state.wrongSignOrigin?'https://wrong.invalid':storageOrigin}/storage/v1/object/sign/${bucket}/${object}?token=TEST_ONLY`}};
   }};
  }}}
 };
}
reset();
globalThis.fetch=async(input,options={})=>{
 const url=new URL(input);assert.equal(url.origin,storageOrigin,'Test may never make external network requests');
 assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
 state.fetchCalls.push({method:options.method,range:options.headers?.Range??null});
 if(state.upstreamFailure)return new Response('PRIVATE UPSTREAM ERROR',{status:403});
 let start=0,end=length-1,status=200;
 const range=options.headers?.Range;
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);assert.ok(match);
  if(!match[1])start=Math.max(0,length-Number(match[2]));
  else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(start>=length)return new Response('PRIVATE RANGE ERROR',{status:416,headers:{'Content-Range':`bytes */${length}`}});
  status=206;
 }
 const headers={'Content-Type':'video/mp4','Content-Length':String(end-start+1),'Cache-Control':'public','Set-Cookie':'TEST_ONLY','Location':'https://wrong.invalid/TEST_ONLY'};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${length}`;
 const body=options.method==='HEAD'?null:Readable.toWeb(mediaStream(start,end));
 return new Response(body,{status,headers});
};

async function loadApi(release){
 const stubs={
  'server-only':'export {};',
  '@/lib/supabase/server':'export const createClient=async()=>globalThis.__LDA_HAZARD_FLOW_TEST__.client;',
  '@/lib/supabase/admin':'export const createAdminClient=()=>globalThis.__LDA_HAZARD_FLOW_TEST__.admin;',
  '@/lib/account-route-guard':'export const getMarketplaceRoleState=async()=>globalThis.__LDA_HAZARD_FLOW_TEST__.roles();',
  '@/lib/supabase/config':`export const supabaseUrl=${JSON.stringify(storageOrigin)};`,
  '@/lib/security':`export const isRateLimited=()=>globalThis.__LDA_HAZARD_FLOW_TEST__.throttled();export const jsonNoStore=(value,init={})=>Response.json(value,{...init,headers:{...init.headers,'Cache-Control':'no-store'}});`
 };
 const result=await build({absWorkingDir:root,entryPoints:['src/app/api/lda-hazard/[...segments]/route.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node22',plugins:[{name:'isolated-test-adapters',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(args.path in stubs)return {path:args.path,namespace:'test-adapter'};
   if(args.path==='./release.json'&&args.importer.endsWith('api.ts'))return {path:'release',namespace:'test-adapter'};
  });
  b.onLoad({filter:/.*/,namespace:'test-adapter'},args=>({contents:args.path==='release'?`export default ${JSON.stringify(release)}`:stubs[args.path],loader:'js'}));
 }}]});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const api=await loadApi(fixtureRelease),unreleased=await loadApi({status:'unreleased',catalog:[],manifests:[]});
const calibratedRelease=structuredClone(fixtureRelease);
for(const clip of calibratedRelease.catalog)for(const hazard of clip.hazards){
 const edges=[hazard.start,hazard.start+.25,hazard.start+1,hazard.start+2.5,hazard.start+3.75,hazard.end];
 hazard.score_bands=edges.slice(0,5).map((start,i)=>({start,end:edges[i+1],score:5-i}));
}
const calibratedApi=await loadApi(calibratedRelease);
beforeEach(reset);
after(()=>{
 globalThis.fetch=originalFetch;Date.now=originalNow;delete globalThis.__LDA_HAZARD_FLOW_TEST__;
 assert.deepEqual(fs.readFileSync(path.join(root,'src/lib/lda-hazard/server/release.json')),productionRelease,'Test must never enable production release');
});
const op=i=>i.toString(16).padStart(32,'0');
async function call(segments,{method='GET',body,headers={},handler=api}={}){
 const request=new Request(`${origin}/api/lda-hazard/${segments.join('/')}`,{method,
  headers:method==='POST'?{'Origin':origin,'Content-Type':'application/json','X-LDA-Hazard-Request':'1',...headers}:headers,
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 return handler[method](request,{params:Promise.resolve({segments})});
}
async function json(response,status){assert.equal(response.status,status,await response.clone().text());return response.json();}
function privateFree(value){
 const text=JSON.stringify(value);for(const word of ['PRIVATE','hazards','score_bands','explanation','max_score','scoring_window','owner_id','payload','storage_object','TEST_ONLY'])assert.ok(!text.includes(word),word);
}
async function begin(index=1){return json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(index)}}),201);}

test('real handler denies unauthenticated, anonymous and wrong-role users; unreleased remains closed',async()=>{
 for(const actor of [null,{id:'test-owner-a',is_anonymous:true}]){state.actor=actor;await json(await call(['sets']),401);}
 state.actor={id:'test-owner-a'};state.role='instructor';await json(await call(['sets']),403);
 state.role='learner';assert.deepEqual(await json(await call(['sets'],{handler:unreleased}),200),{available:false,active_attempt_id:null,instructional_review_pending:false,sets:[]});
 await json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(1)},handler:unreleased}),503);
 assert.equal(state.rows.size,0);assert.equal(state.signCalls.length,0);
});
test('sets/start expose only public values and ignore client-supplied ownership',async()=>{
 privateFree(await json(await call(['sets']),200));
 const current=await json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(1),owner_id:'attacker'}}),201);
 privateFree(current);assert.match(current.clip.video_url,/^\/api\/lda-hazard\/media\/[a-f0-9]{24}$/);
 assert.equal([...state.rows.values()][0].owner_id,'test-owner-a');
 assert.deepEqual(await begin(),current,'Lost start response retry must recover same attempt');
});
test(`${media?'real MP4':'synthetic 50 MB body'} and byte ranges pass through the actual owner-gated API with exact hashes`,async()=>{
 const current=await begin(),segments=['media',current.clip.clip_id];
 const full=await call(segments);assert.equal(full.status,200);assert.equal(full.headers.get('content-length'),String(length));
 assert.equal(full.headers.get('cache-control'),'private, no-store');assert.equal(full.headers.get('set-cookie'),null);assert.equal(full.headers.get('location'),null);
 const digest=createHash('sha256');let received=0;for await(const chunk of full.body){received+=chunk.length;digest.update(chunk);}
 assert.equal(received,length);assert.equal(digest.digest('hex'),mediaHash);
 const head=await call(segments,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,null);
 const range=await call(segments,{headers:{Range:'bytes=1024-2047'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 1024-2047/${length}`);
 const expected=Buffer.alloc(1024);
 if(media){const fd=fs.openSync(media,'r');try{fs.readSync(fd,expected,0,1024,1024);}finally{fs.closeSync(fd);}}
 assert.deepEqual(Buffer.from(await range.arrayBuffer()),expected);
 assert.equal((await call(segments,{headers:{Range:`bytes=${length}-`}})).status,416);
 assert.equal(state.signCalls.length,4);
});
test('other owners, future clips, expired state and malformed ranges never reach signing',async()=>{
 const current=await begin(),segments=['media',current.clip.clip_id];
 state.actor={id:'test-owner-b'};await json(await call(segments),404);state.actor={id:'test-owner-a'};
 await json(await call(['media',catalog[1].public_id]),404);
 await json(await call(segments,{headers:{Range:'bytes=0-1,3-4'}}),416);
 state.now+=2_700_001;await json(await call(segments),404);assert.equal(state.signCalls.length,0);
});
test('signing/redirect/storage failures return safe errors, never signed URLs or private messages',async()=>{
 const current=await begin(),segments=['media',current.clip.clip_id];
 state.wrongSignOrigin=true;privateFree(await json(await call(segments),503));assert.equal(state.fetchCalls.length,0);
 state.wrongSignOrigin=false;state.signError=true;privateFree(await json(await call(segments),503));
 state.signError=false;state.upstreamFailure=true;const response=await call(segments);assert.equal(response.status,502);assert.equal(await response.text(),'');
 state.databaseError=true;privateFree(await json(await call(['sets']),503));
});
test('same-origin request checks and supplementary throttling reject before attempt mutation',async()=>{
 await json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(1)},headers:{Origin:'https://other.invalid'}}),403);
 await json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(1)},headers:{'X-LDA-Hazard-Request':'0'}}),403);
 state.throttled=true;await json(await call(['sets']),429);assert.equal(state.rows.size,0);
});
test('14 clips run through actual API/store adapter/scoring; retries are idempotent and answers wait until the end',async()=>{
 let current=await begin();const id=current.attempt_id;
 for(let i=0;i<14;i++){
  privateFree(current);
  await json(await call(['mocks',id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(10+i*2)}}),200);
  const payload={clip_token:current.clip_token,clicks:i===13?[18.1,35.1]:[18.1],operation_id:op(11+i*2)};
  if(i===0)await json(await call(['mocks',id,'submit'],{method:'POST',body:payload}),409);
  state.now+=45_000;
  current=await json(await call(['mocks',id,'submit'],{method:'POST',body:payload}),200);
  assert.deepEqual(await json(await call(['mocks',id,'submit'],{method:'POST',body:payload}),200),current);
 }
 assert.equal(current.complete,true);assert.equal(current.result.score,75);assert.equal(current.result.practice_passed,true);assert.equal(current.result.clips.length,14);
 assert.equal([...state.rows.values()][0].finished,true);
 await json(await call(['media',catalog[13].public_id]),404);
});
test('zero clicks score zero and abandoning makes subsequent media inaccessible',async()=>{
 const current=await begin(),id=current.attempt_id;
 await json(await call(['mocks',id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(2)}}),200);state.now+=45_000;
 const next=await json(await call(['mocks',id,'submit'],{method:'POST',body:{clip_token:current.clip_token,clicks:[],operation_id:op(3)}}),200);privateFree(next);
 assert.equal([...state.rows.values()][0].payload.state.results[0].score,0);
 await json(await call(['mocks',id,'abandon'],{method:'POST',body:{operation_id:op(4)}}),200);
 await json(await call(['media',next.clip.clip_id]),404);
});
test('over-clicking invalidates that clip through the route, not an otherwise passing whole mock',async()=>{
 let current=await begin();const id=current.attempt_id;
 for(let i=0;i<14;i++){
  await json(await call(['mocks',id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(40+i*2)}}),200);
  state.now+=45_000;
  const clicks=i===0?Array.from({length:8},(_,j)=>18+j*.1):i===13?[18.1,35.1]:[18.1];
  current=await json(await call(['mocks',id,'submit'],{method:'POST',body:{clip_token:current.clip_token,clicks,operation_id:op(41+i*2)}}),200);
  if(i<13)privateFree(current);
 }
 assert.equal(current.result.clips[0].invalidated,true);assert.equal(current.result.clips[0].score,0);
 assert.equal(current.result.score,70);assert.equal(current.result.practice_passed,true);
});

test('reviewed unequal bands survive the actual14-clip API flow without leaking timing',async()=>{
 const handler=calibratedApi;
 let current=await json(await call(['mocks'],{method:'POST',body:{set_id:'set-1',operation_id:op(1)},handler}),201);
 const id=current.attempt_id;
 for(let i=0;i<14;i++){
  privateFree(current);
  await json(await call(['mocks',id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(100+i*2)},handler}),200);
  state.now+=45_000;
  const clicks=i===13?[18.5,35.1]:[18.5];
  current=await json(await call(['mocks',id,'submit'],{method:'POST',body:{clip_token:current.clip_token,clicks,operation_id:op(101+i*2)},handler}),200);
 }
 assert.equal(current.complete,true);assert.equal(current.result.score,61);
 assert.deepEqual(current.result.clips.map(c=>c.score),[...Array(13).fill(4),9]);
 assert.equal(current.result.feedback.length,14,'Timing feedback is permitted only after full completion');
 assert.deepEqual(current.result.feedback[0].hazards[0].score_bands,calibratedRelease.catalog[0].hazards[0].score_bands);
});

test('standalone single/double clips use the real authenticated API and disclose feedback only after completion',async()=>{
 for(const index of [0,13]){
  const choice=catalog[index];
  const menu=await json(await call(['practice']),200);
  assert.equal(menu.clips.length,15);assert.equal(menu.clips[index].max_score,choice.hazards.length*5);
  for(const word of ['PRIVATE','hazards','score_bands','explanation','category','storage_object'])assert(!JSON.stringify(menu).includes(word));
  let current=await json(await call(['practice'],{method:'POST',body:{clip_id:choice.public_id,operation_id:op(300+index)}}),201);
  assert.equal(current.clip_count,1);privateFree(current);
  await json(await call(['weak-areas']),409);await json(await call(['practice']),409);
  const id=current.attempt_id,token=current.clip_token;
  await json(await call(['mocks',id,'ready'],{method:'POST',body:{clip_token:token,operation_id:op(400+index)}}),200);
  const submit={clip_token:token,clicks:choice.hazards.map(h=>h.start),operation_id:op(500+index)};
  privateFree(await json(await call(['mocks',id,'submit'],{method:'POST',body:submit}),409));
  state.now+=45_000;
  current=await json(await call(['mocks',id,'submit'],{method:'POST',body:submit}),200);
  assert.equal(current.complete,true);assert.equal(current.result.mode,'practice');assert.equal(current.result.max_score,choice.hazards.length*5);assert.equal(current.result.score,current.result.max_score);
  assert.equal(current.result.practice_pass_mark,undefined);assert.equal(current.result.feedback[0].hazards.length,choice.hazards.length);
  assert.equal(current.result.feedback[0].hazards[0].start,18);
  assert.deepEqual(await json(await call(['mocks',id,'submit'],{method:'POST',body:submit}),200),current);
  await json(await call(['media',choice.public_id]),404);
 }
});

test('practice namespaces cannot shorten a mock; restart creates a new attempt; weak history is owner scoped',async()=>{
 const clip=catalog[0];
 await json(await call(['mocks'],{method:'POST',body:{set_id:`practice-${clip.public_id}`,operation_id:op(1)}}),404);
 const current=await json(await call(['practice'],{method:'POST',body:{clip_id:clip.public_id,operation_id:op(2)}}),201);
 state.actor={id:'other-owner'};
 await json(await call(['mocks',current.attempt_id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(3)}}),404);
 assert.deepEqual((await json(await call(['weak-areas']),200)).areas,[]);
 state.actor={id:'test-owner-a'};
 await json(await call(['mocks',current.attempt_id,'ready'],{method:'POST',body:{clip_token:current.clip_token,operation_id:op(4)}}),200);
 state.now+=45_000;
 await json(await call(['mocks',current.attempt_id,'submit'],{method:'POST',body:{clip_token:current.clip_token,clicks:[],operation_id:op(5)}}),200);
 const weak=await json(await call(['weak-areas']),200);assert.equal(weak.areas[0].average_score,0);assert(weak.areas[0].clip_ids.includes(clip.public_id));
 for(const word of ['start','end','score_bands','teaching_note','PRIVATE'])assert(!JSON.stringify(weak).includes(word));
 const restarted=await json(await call(['practice'],{method:'POST',body:{clip_id:clip.public_id,operation_id:op(6)}}),201);assert.notEqual(restarted.attempt_id,current.attempt_id);privateFree(restarted);
});
