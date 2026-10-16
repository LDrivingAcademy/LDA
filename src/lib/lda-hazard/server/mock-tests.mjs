import 'server-only';
// Server-only sequencing and aggregate scoring. Never expose clip answers early.
import {randomBytes} from 'node:crypto';
import {scoreSubmission,publicClip,validHazardTiming,completedClipFeedback} from './scoring.mjs';
export class MockError extends Error{constructor(status,message){super(message);this.status=status;}}
export function validatedSets(manifests,catalog){
 const clips=new Map(catalog.map(c=>[c.clip_id,c]));
 return manifests.filter(m=>{
  if(m.status!=='verified-playable'||!Array.isArray(m.clip_ids)||m.clip_ids.length!==14||new Set(m.clip_ids).size!==14)return false;
  const selected=m.clip_ids.map(id=>clips.get(id));
  return selected.every(c=>c&&Array.isArray(c.hazards)&&c.hazards.every((h,i)=>validHazardTiming(h)&&h.end<=c.duration_seconds&&(i===0||h.start>=c.hazards[i-1].end)))&&selected.filter(c=>c.hazards.length===1&&c.max_score===5).length===13&&selected.filter(c=>c.hazards.length===2&&c.max_score===10).length===1&&m.max_score===75&&m.practice_pass_mark===44;
 }).map(m=>({...m,clips:m.clip_ids.map(id=>clips.get(id))}));
}
export function practiceSets(catalog){
 return catalog.filter(c=>Array.isArray(c.hazards)&&[1,2].includes(c.hazards.length)&&c.hazards.every(h=>validHazardTiming(h)&&h.end<=c.duration_seconds))
  .map(c=>({set_id:`practice-${c.public_id}`,mode:'practice',clips:[c]}));
}
export class MockTests{
 constructor(sets,{now=()=>Date.now()}={}){this.sets=new Map(sets.map(s=>[s.set_id,s]));this.attempts=new Map();this.now=now;}
 list(){return [...this.sets.values()].map((s,i)=>({set_id:s.set_id,title:`Mock test ${i+1}`,clip_count:14}));}
 sweep(){for(const[id,a]of this.attempts)if(a.expires<this.now())this.attempts.delete(id);}
 begin(session,setId){
  this.sweep();const set=this.sets.get(setId);if(!set)throw new MockError(404,'Mock test unavailable');
  if([...this.attempts.values()].some(a=>a.session===session&&!['complete','abandoned'].includes(a.state)))throw new MockError(409,'Finish or end the current mock test first');
  if(this.attempts.size>=2000)throw new MockError(429,'Mock test capacity reached');
  const id=randomBytes(24).toString('hex');
  const attempt={id,session,mode:set.mode==='practice'?'practice':'mock',clips:structuredClone(set.clips),index:0,results:[],feedback:[],state:'loading',token:randomBytes(24).toString('hex'),expires:this.now()+2700000};
  this.attempts.set(id,attempt);return this.current(attempt);
 }
 get(session,id){const a=this.attempts.get(id);if(!a||a.session!==session||a.expires<this.now())throw new MockError(404,'Mock attempt unavailable');return a;}
 current(a){return {attempt_id:a.id,clip_number:a.index+1,clip_count:a.clips.length,clip_token:a.token,clip:publicClip(a.clips[a.index],a.index+1)};}
 abandon(session,id){const a=this.get(session,id);if(a.state==='complete')throw new MockError(409,'Mock already complete');a.state='abandoned';a.token=null;return {abandoned:true};}
 ready(session,id,token){
  const a=this.get(session,id);if(a.state!=='loading'||a.token!==token)throw new MockError(409,'Clip is not ready to start');
  a.state='playing';a.started=this.now();return {accepted:true};
 }
 submit(session,id,{clip_token,clicks}){
  const a=this.get(session,id);if(a.state!=='playing'||a.token!==clip_token)throw new MockError(409,'Clip already submitted or out of sequence');
  const clip=a.clips[a.index];if(this.now()-a.started<clip.duration_seconds*1000)throw new MockError(409,'Clip has not finished');
  let score;try{score=scoreSubmission(clip,clicks);}catch{throw new MockError(400,'Invalid clicks');}
  a.results.push({clip_number:a.index+1,...score});(a.feedback??=[]).push(completedClipFeedback(clip,clicks));a.index++;
  if(a.index===a.clips.length){
   a.state='complete';a.token=null;
   const total=a.results.reduce((sum,r)=>sum+r.score,0);
   if(a.mode==='practice')return {complete:true,result:{mode:'practice',score:total,max_score:clip.hazards.length*5,clips:a.results,feedback:a.feedback,notice:'LDA individual practice result. Review the developing hazards below, then restart when ready.'}};
   return {complete:true,result:{score:total,max_score:75,practice_pass_mark:44,practice_passed:total>=44,clips:a.results,feedback:a.feedback,notice:'LDA practice result, not an official test result or guarantee of a pass.'}};
  }
  a.state='loading';a.token=randomBytes(24).toString('hex');
  // No interim score, explanation, maximum per clip or hazard count is returned.
  return {complete:false,...this.current(a)};
 }
}
