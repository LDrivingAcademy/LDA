import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const built=await build({stdin:{contents:`export * from './src/lib/lda-hazard/server/scoring.mjs'; export * from './src/lib/lda-hazard/server/mock-tests.mjs'; export * from './src/lib/lda-hazard/server/weak-areas.mjs';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'server-only-test',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export {};'}));}}]});
const {scoreSubmission,hazardScore,MockTests,validatedSets,practiceSets,weakAreaRecommendations}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const hazard=(start=10,category='Pedestrians')=>({label:'Private developing hazard',category,start,end:start+5,teaching_note:'Private teaching note'});
const clip=(count=1,index=0)=>({clip_id:`lda-test-${index}`,public_id:index.toString(16).padStart(24,'0'),title:'Private clip title',category:'Pedestrians',duration_seconds:45,max_score:count*5,hazards:Array.from({length:count},(_,i)=>hazard(10+i*20,i?'Cyclists':'Pedestrians')),explanation:'Private explanation'});
for(const count of [1,2])test(`${count}-hazard practice derives max ${count*5} and independent hazard scores`,()=>{
 const c=clip(count);assert.equal(scoreSubmission(c,[]).max_score,count*5);assert.equal(scoreSubmission(c,[]).score,0);
 assert.equal(scoreSubmission({...c,max_score:999},c.hazards.map(h=>h.start)).max_score,count*5);
 assert.equal(scoreSubmission(c,c.hazards.map(h=>h.start)).score,count*5);
 if(count===2){assert.equal(scoreSubmission(c,[10,32.1]).score,8);assert.equal(scoreSubmission(c,[10]).score,5);}
});
test('five timing bands, inclusive starts and exclusive ends',()=>{
 const h=hazard();assert.equal(hazardScore(10,h),5);
 for(let band=0;band<5;band++){assert.equal(hazardScore(10+band,h),5-band);assert.equal(hazardScore(10+band+.9,h),5-band);}
 for(const t of [0,9.999,15,15.001,44])assert.equal(hazardScore(t,h),0);
});
test('first valid response wins; extra and wrong clicks neither stack nor subtract',()=>{
 const c=clip();assert.equal(scoreSubmission(c,[2,11.2,12.8,13.9,20]).score,4);
 assert.equal(scoreSubmission(c,[11.2]).score,4);
 assert.equal(scoreSubmission(c,[10,10.1,11.6]).score,5);
 assert.throws(()=>scoreSubmission(c,[12,10]),/Invalid clicks/);
});
test('rapid, regular and high-volume irregular spam invalidate the entire two-hazard clip',()=>{
 for(const clicks of [Array.from({length:8},(_,i)=>10+i*.1),Array.from({length:8},(_,i)=>9+i),[.1,1.5,3.3,4,6.8,8,10,10.9,12.4,15,17.1,19.3,21,24,26.4,28.1,30,33,37.7,41]]){
  const result=scoreSubmission(clip(2),clicks);assert.equal(result.score,0);assert.equal(result.invalidated,true);assert.equal(result.max_score,10);
 }
});
function privateFree(value){assert(!JSON.stringify(value).match(/Private|score_bands|teaching_note|hazards|"start"|"end"|feedback/));}
test('practice is one clip, no early feedback, no early submission, feedback after end and independent restart',()=>{
 let now=0;const c=clip(2),sets=practiceSets([c]),engine=new MockTests(sets,{now:()=>now});
 const first=engine.begin('owner',sets[0].set_id);assert.equal(first.clip_count,1);privateFree(first);
 engine.ready('owner',first.attempt_id,first.clip_token);
 assert.throws(()=>engine.submit('owner',first.attempt_id,{clip_token:first.clip_token,clicks:[10,30]}),/not finished/);
 now=45000;const done=engine.submit('owner',first.attempt_id,{clip_token:first.clip_token,clicks:[10,30]});
 assert.equal(done.result.mode,'practice');assert.equal(done.result.score,10);assert.equal(done.result.max_score,10);assert.equal(done.result.practice_pass_mark,undefined);
 assert.equal(done.result.feedback[0].hazards[0].label,'Private developing hazard');assert.equal(done.result.feedback[0].hazards[0].score_bands.length,5);
 const restarted=engine.begin('owner',sets[0].set_id);assert.notEqual(restarted.attempt_id,first.attempt_id);privateFree(restarted);
});
test('mock validates 14 clips/15 hazards/75 marks, totals clip scores, pass threshold 44 and no early disclosure',()=>{
 const catalog=Array.from({length:14},(_,i)=>clip(i===13?2:1,i));
 const manifest={set_id:'set-1',status:'verified-playable',clip_ids:catalog.map(c=>c.clip_id),max_score:75,practice_pass_mark:44};
 const sets=validatedSets([manifest],catalog);assert.equal(sets.length,1);assert.equal(sets[0].clips.length,14);assert.equal(sets[0].clips.reduce((n,c)=>n+c.hazards.length,0),15);
 for(const mutation of [{...manifest,clip_ids:manifest.clip_ids.slice(1)},{...manifest,max_score:70},{...manifest,practice_pass_mark:43}])assert.equal(validatedSets([mutation],catalog).length,0);
 for(const wanted of [0,43,44,75]){
  let now=0,remaining=wanted;const engine=new MockTests(sets,{now:()=>now});let current=engine.begin('owner','set-1');const id=current.attempt_id;
  for(const c of catalog){privateFree(current);engine.ready('owner',id,current.clip_token);now+=45000;
   const clicks=[];for(const h of c.hazards){const score=Math.min(5,remaining);remaining-=score;if(score)clicks.push(h.start+5-score+.1);}
   current=engine.submit('owner',id,{clip_token:current.clip_token,clicks});
  }
  assert.equal(current.result.score,wanted);assert.equal(current.result.max_score,75);assert.equal(current.result.practice_pass_mark,44);assert.equal(current.result.practice_passed,wanted>=44);assert.equal(current.result.clips.length,14);assert.equal(current.result.feedback.length,14);assert.equal(current.result.clips.reduce((n,c)=>n+c.score,0),wanted);
 }
});
test('weak areas use completed hazard-level results, exclude unfinished attempts and do not expose answers',()=>{
 const catalog=[clip(1,1),clip(2,2)];
 const finished={finished:true,payload:{state:{state:'complete',feedback:[{hazards:[{category:'Pedestrians',score:1},{category:'Cyclists',score:5}]}]}}};
 const active={finished:false,payload:{state:{state:'playing',feedback:[{hazards:[{category:'Cyclists',score:0}]}]}}};
 const result=weakAreaRecommendations([active,finished],catalog);assert.equal(result.length,1);assert.equal(result[0].category,'Pedestrians');assert.equal(result[0].average_score,1);assert.equal(result[0].clip_ids.length,2);privateFree(result);
});
