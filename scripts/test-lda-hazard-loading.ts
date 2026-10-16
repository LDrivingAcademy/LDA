import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  initialBufferedSeconds,
  readyForPracticePlayback,
  readyForProgressivePlayback,
  shouldFallbackToFullDownload,
  shouldUseFullDownloadFirst,
  downloadHazardVideo
} from '../src/lib/lda-hazard/playback-loading';

test('startup needs real headroom and an eight-second lead, not just canplay',()=>{
  assert.equal(readyForProgressivePlayback(60,2,1),false);
  assert.equal(readyForProgressivePlayback(60,8,4),true);
  assert.equal(readyForProgressivePlayback(60,8,10),false);
  assert.equal(readyForProgressivePlayback(60,59,70),false);
  assert.equal(readyForProgressivePlayback(60,59.95,75),true);
  assert.equal(readyForProgressivePlayback(60,8,0.2),false);
  for(const args of [[NaN,8,2],[60,Infinity,2],[0,8,2],[60,-1,2]])assert.equal(readyForProgressivePlayback(...args as [number,number,number]),false);
});
test('buffered gaps and future-only data do not count as a head start',()=>{
  const ranges=(pairs:number[][])=>({length:pairs.length,start:(i:number)=>pairs[i][0],end:(i:number)=>pairs[i][1]});
  assert.equal(initialBufferedSeconds(ranges([])),0);
  assert.equal(initialBufferedSeconds(ranges([[10,60]])),0);
  assert.equal(initialBufferedSeconds(ranges([[0,2],[10,60]])),2);
  assert.equal(initialBufferedSeconds(ranges([[0,4],[4,10]])),10);
});
test('practice mode can start sooner than a scored mock',()=>{
  assert.equal(readyForPracticePlayback(60,2.5,5),false);
  assert.equal(readyForPracticePlayback(60,3,0.4),false);
  assert.equal(readyForPracticePlayback(60,3,0.5),true);
  assert.equal(readyForPracticePlayback(60,59.95,40),true);
  assert.equal(readyForProgressivePlayback(60,3,15),false);
});
test('full download is reserved for slow links or stalled scored mocks',()=>{
  assert.equal(shouldUseFullDownloadFirst({coarsePointer:true,maxTouchPoints:5,effectiveType:'4g',downlink:20}),false);
  assert.equal(shouldUseFullDownloadFirst({effectiveType:'3g',downlink:20}),true);
  assert.equal(shouldUseFullDownloadFirst({effectiveType:'4g',downlink:2.5}),true);
  assert.equal(shouldFallbackToFullDownload(0.05,7.9,false),false);
  assert.equal(shouldFallbackToFullDownload(0.05,8,false),true);
  assert.equal(shouldFallbackToFullDownload(0.5,20,false),false);
  assert.equal(shouldFallbackToFullDownload(0.05,20,true),false);
});
test('optional full download reports progress and preserves bytes',async()=>{
  const bytes=new Uint8Array(64).fill(22),updates:Array<number|null>=[];
  const stream=new ReadableStream({start(c){c.enqueue(bytes.slice(0,32));c.enqueue(bytes.slice(32));c.close();}});
  const blob=await downloadHazardVideo(new Response(stream,{headers:{'content-type':'video/mp4','content-length':'64'}}),new AbortController().signal,p=>updates.push(p));
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes);
  assert.deepEqual(updates,[0.5,1,1]);
});
test('full download rejects failed, oversized and truncated media',async()=>{
  for(const response of [new Response('',{status:401}),new Response('html'),
    new Response(new Uint8Array(32),{headers:{'content-type':'video/mp4','content-length':'64'}}),
    new Response(new Uint8Array(32),{headers:{'content-type':'video/mp4','content-length':'50000000'}})]){
    await assert.rejects(downloadHazardVideo(response,new AbortController().signal,()=>{}));
  }
  const controller=new AbortController();controller.abort();
  await assert.rejects(downloadHazardVideo(new Response(new Uint8Array(64),{headers:{'content-type':'video/mp4'}}),controller.signal,()=>{}));
});
