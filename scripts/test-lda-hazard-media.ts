import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {currentMediaObject, validMediaRange, mediaStreamResponse} from '../src/lib/lda-hazard/media-policy';
import type {HazardRelease} from '../src/lib/lda-hazard/release-validation';
const id='a'.repeat(24), second='b'.repeat(24), owner='verified-owner';
const clip={public_id:id,video_sha256:'c'.repeat(64),storage_object:`release/${id}.mp4`};
const release={catalog:[clip]} as unknown as HazardRelease;
function row(){return {id:'attempt',owner_id:owner,finished:false,expires_ms:2000,payload:{state:{
  id:'attempt',session:owner,expires:2000,state:'loading',index:0,clips:[clip,{...clip,public_id:second}]}}};}
test('only owner current unexpired clip from matching released media is playable',()=>{
  assert.equal(currentMediaObject(row(),owner,id,release,1000),clip.storage_object);
  assert.equal(currentMediaObject(row(),'different-owner',id,release,1000),null);
  assert.equal(currentMediaObject(row(),owner,second,release,1000),null);
  assert.equal(currentMediaObject(row(),owner,id,release,2000),null);
  for(const state of ['complete','abandoned']){const r=row();r.payload.state.state=state;assert.equal(currentMediaObject(r,owner,id,release,1000),null);}
  const finished=row();finished.finished=true;assert.equal(currentMediaObject(finished,owner,id,release,1000),null);
  const corrupt=row();corrupt.payload.state.session='other';assert.equal(currentMediaObject(corrupt,owner,id,release,1000),null);
  const changed=row();changed.payload.state.clips=[{...clip,video_sha256:'d'.repeat(64)}];assert.equal(currentMediaObject(changed,owner,id,release,1000),null);
});
test('supports one standard byte range, rejects malformed/multipart/unsafe ranges',()=>{
  for(const r of [null,'bytes=0-1','bytes=100-','bytes=-100','bytes=0-0']) assert.equal(validMediaRange(r),true,r??'none');
  for(const r of ['bytes=-','bytes=-0','bytes=3-2','bytes=0-1,4-5','items=0-1','bytes=NaN-','bytes=9007199254740992-','bytes= 0-1']) assert.equal(validMediaRange(r),false,r);
});
test('streams exact bytes and only safe headers, without upstream credentials or caching',async()=>{
  const r=await mediaStreamResponse(new Response(new Uint8Array([1,2]),{status:206,headers:{
    'Content-Type':'video/mp4','Content-Length':'2','Content-Range':'bytes 0-1/20',
    'Set-Cookie':'secret','Location':'https://example.invalid/token','Cache-Control':'public'}}));
  assert.equal(r.status,206);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array([1,2]));
  assert.equal(r.headers.get('content-range'),'bytes 0-1/20');assert.equal(r.headers.get('cache-control'),'private, no-store');
  assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('location'),null);
});
test('HEAD has no body; upstream errors and non-video bodies never leak',async()=>{
  const head=await mediaStreamResponse(new Response(null,{headers:{'Content-Type':'video/mp4','Content-Length':'20'}}),true);
  assert.equal(head.body,null);assert.equal(head.headers.get('content-length'),'20');
  for(const upstream of [new Response('private error',{status:403}),new Response('<html>error</html>'),new Response('bad',{status:206,headers:{'Content-Type':'video/mp4'}})]) {
    const r=await mediaStreamResponse(upstream);assert.equal(r.status,502);assert.equal(await r.text(),'');
  }
  const range=await mediaStreamResponse(new Response('private upstream error',{status:416,headers:{'Content-Range':'bytes */20'}}));
  assert.equal(range.status,416);assert.equal(range.headers.get('content-range'),'bytes */20');assert.equal(await range.text(),'');
});

test('50 MB response remains a demand-driven stream with exact bytes, not a buffered payload',async()=>{
  const length=50_000_000,chunkSize=64*1024;let produced=0,pulls=0;
  const expected=createHash('sha256');
  const body=new ReadableStream<Uint8Array>({pull(controller){
    pulls++;
    if(produced===length){controller.close();return;}
    const bytes=new Uint8Array(Math.min(chunkSize,length-produced)).fill(pulls%251);
    expected.update(bytes);produced+=bytes.length;controller.enqueue(bytes);
  }},{highWaterMark:0});
  const upstream=new Response(body,{headers:{'Content-Type':'video/mp4','Content-Length':String(length)}});
  const result=await mediaStreamResponse(upstream);
  assert.equal(result.body,body,'Response must preserve the streaming body');
  assert.equal(produced,0,'Constructing response must not read the whole upstream video');
  assert.equal(result.headers.get('content-length'),String(length));
  const reader=result.body!.getReader(),actual=createHash('sha256');let received=0;
  while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;actual.update(value);assert.ok(value.length<=chunkSize);}
  assert.equal(received,length);assert.equal(actual.digest('hex'),expected.digest('hex'));
});

test('stopping playback cancels the original upstream stream',async()=>{
  let cancelled=false,pulls=0;
  const body=new ReadableStream<Uint8Array>({
    pull(controller){pulls++;controller.enqueue(new Uint8Array(1024));},
    cancel(){cancelled=true;}
  },{highWaterMark:0});
  const result=await mediaStreamResponse(new Response(body,{headers:{'Content-Type':'video/mp4'}}));
  const reader=result.body!.getReader();await reader.read();await reader.cancel('learner left playback');
  assert.equal(cancelled,true);assert.equal(pulls,1);
});
