import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {readHazardRequest} from '../src/lib/lda-hazard/request-boundary';
import {validateHazardRelease} from '../src/lib/lda-hazard/release-validation';

const origin = 'https://ldrivingacademy.co.uk';
function request(body: string, headers: Record<string,string> = {}) {
  return new Request(`${origin}/api/lda-hazard/mocks`, {method:'POST',body,headers:{origin,'content-type':'application/json','x-lda-hazard-request':'1',...headers}});
}
test('same-origin JSON only, bounded even without declared length', async () => {
  assert.deepEqual(await readHazardRequest(request('{"clicks":[]}')), {clicks:[]});
  for (const headers of [{origin:'https://attacker.example'}, {origin:''}, {'x-lda-hazard-request':''}, {'sec-fetch-site':'cross-site'}])
    await assert.rejects(readHazardRequest(request('{}', headers)), {status:403});
  await assert.rejects(readHazardRequest(request('{}', {'content-type':'text/plain'})), {status:415});
  await assert.rejects(readHazardRequest(request('x'.repeat(32769))), {status:413});
  await assert.rejects(readHazardRequest(request('{}', {'content-length':'999999'})), {status:413});
  for (const body of ['null','[]','"text"','{bad']) await assert.rejects(readHazardRequest(request(body)), {status:400});
});
function fixture() {
  const catalog = Array.from({length:15}, (_,i) => ({clip_id:`lda-fixture-${i}`,public_id:i.toString(16).padStart(24,'0'),duration_seconds:45,
    hazards:i===14?[{start:10,end:14},{start:30,end:34}]:[{start:10,end:14}],max_score:i===14?10:5,
    status:'verified-final',visual_review:'approved',scoring_review:'approved',explanation:'Synthetic software test, not training footage.',
    source_sha256:'a'.repeat(64),video_sha256:'b'.repeat(64),storage_object:`synthetic-only/${i.toString(16).padStart(24,'0')}.mp4`}));
  return {status:'verified-playable',release_id:'synthetic-only',catalog,manifests:[{set_id:'set-1',status:'verified-playable',clip_ids:[...catalog.slice(0,13),catalog[14]].map(c=>c.clip_id),max_score:75,practice_pass_mark:44}]};
}
test('release fails closed for drafts, missing media evidence, timing and incorrect mock composition', () => {
  assert.ok(validateHazardRelease(fixture()));
  const mutations = [
    (r:ReturnType<typeof fixture>)=>{r.status='planned'},
    (r:ReturnType<typeof fixture>)=>{r.catalog[0].visual_review='pending'},
    (r:ReturnType<typeof fixture>)=>{r.catalog[0].video_sha256=''},
    (r:ReturnType<typeof fixture>)=>{r.catalog[0].storage_object='../secret'},
    (r:ReturnType<typeof fixture>)=>{r.catalog[0].hazards[0].end=46},
    (r:ReturnType<typeof fixture>)=>{r.catalog[14].hazards[1].start=11},
    (r:ReturnType<typeof fixture>)=>{r.manifests[0].clip_ids[13]=r.catalog[13].clip_id},
    (r:ReturnType<typeof fixture>)=>{r.manifests[0].clip_ids[1]=r.manifests[0].clip_ids[0]},
    (r:ReturnType<typeof fixture>)=>{r.manifests[0].practice_pass_mark=0},
  ];
  for (const mutate of mutations) {const r=fixture();mutate(r);assert.equal(validateHazardRelease(r),null);}
  assert.equal(validateHazardRelease({status:'unreleased',catalog:[],manifests:[]}),null);
});
test('website server engine is the tested production engine plus server-only boundary', () => {
  const master = 'C:/Users/Joshu/LDA Hazard Perception Production/server/';
  for (const name of ['scoring.mjs','mock-tests.mjs','persistent-mocks.mjs']) {
    const canonical = readFileSync(master+name,'utf8').replaceAll('\r\n','\n').trim();
    const port = readFileSync('src/lib/lda-hazard/server/'+name,'utf8').replaceAll('\r\n','\n').trim();
    assert.equal(port, "import 'server-only';\n"+canonical);
  }
});

test('provisional practice needs explicit owner authorisation and never claims instructional approval',()=>{
  const r={...fixture(),review_policy:'owner-authorised-provisional',owner_authorised:true,instructional_review:'pending'};
  for(const c of r.catalog){c.status='verified-media';c.scoring_review='provisional';}
  assert.ok(validateHazardRelease(r));
  assert.equal(validateHazardRelease({...r,owner_authorised:false}),null);
  assert.equal(validateHazardRelease({...r,instructional_review:'approved'}),null);
  assert.equal(validateHazardRelease({...r,review_policy:undefined}),null);
  const draft=structuredClone(r);draft.catalog[0].scoring_review='pending';assert.equal(validateHazardRelease(draft),null);
});

test('release accepts reviewed unequal score bands and rejects malformed bands', () => {
  const bands=[{start:10,end:10.25,score:5},{start:10.25,end:11,score:4},{start:11,end:12.5,score:3},
    {start:12.5,end:13.75,score:2},{start:13.75,end:14,score:1}];
  const good=fixture();Object.assign(good.catalog[0].hazards[0],{score_bands:bands});
  assert.ok(validateHazardRelease(good));
  const bad:unknown[]=[null,[],bands.slice(1),bands.map((b,i)=>i===1?{...b,start:10.3}:b),
    bands.map((b,i)=>i===1?{...b,start:10.2}:b),bands.map((b,i)=>i===4?{...b,end:13.9}:b),
    bands.map((b,i)=>i===2?{...b,score:5}:b),bands.map((b,i)=>i===2?null:b),
    bands.map((b,i)=>i===0?{...b,end:NaN}:b),bands.map((b,i)=>i===0?{...b,start:9}:b),
    bands.map((b,i)=>i===0?{...b,end:10}:b),bands.map((b,i)=>i===1?{...b,score:'4'}:b)];
  for(const score_bands of bad){const r=fixture();Object.assign(r.catalog[0].hazards[0],{score_bands});assert.equal(validateHazardRelease(r),null);}
});
