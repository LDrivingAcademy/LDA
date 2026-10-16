import 'server-only';
// SERVER ONLY. Never import into or copy to server/public or a browser bundle.
export function patternReason(clicks){
 // LDA practice heuristic, not DVSA's unpublished algorithm. A handful of
 // mistaken clicks is allowed; high-volume irregular clicking is not.
 if(clicks.length>=20)return 'Excessive clicking throughout the clip';
 for(let i=0;i+8<=clicks.length;i++){
  const sample=clicks.slice(i,i+8),gaps=sample.slice(1).map((t,j)=>t-sample[j]);
  if(gaps.every(g=>g<.25))return 'Sustained rapid clicking';
  const mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;
  if(mean>=.25&&mean<=2&&gaps.every(g=>Math.abs(g-mean)<.06))return 'Repeated regular clicking pattern';
 }
 return null;
}
export function validHazardTiming(h){
 if(!h||!Number.isFinite(h.start)||!Number.isFinite(h.end)||h.start<0||h.end<=h.start)return false;
 if(h.score_bands===undefined)return true; // Existing equal-band practice windows remain supported.
 return Array.isArray(h.score_bands)&&h.score_bands.length===5&&h.score_bands.every((b,i)=>
  b&&Number.isFinite(b.start)&&Number.isFinite(b.end)&&b.end>b.start&&b.score===5-i&&
  b.start===(i===0?h.start:h.score_bands[i-1].end)&&b.end<=h.end)&&h.score_bands[4].end===h.end;
}
export function hazardScore(t,h){
 if(!validHazardTiming(h))throw Error('Invalid hazard scoring configuration');
 if(!Number.isFinite(t)||!(h.end>h.start)||t<h.start||t>=h.end)return 0;
 if(h.score_bands!==undefined)return h.score_bands.find(b=>t>=b.start&&t<b.end)?.score??0;
 return Math.max(1,5-Math.floor((t-h.start)/(h.end-h.start)*5+1e-10));
}
export function scoreSubmission(clip,input){
 if(!Array.isArray(clip.hazards)||!clip.hazards.every(h=>validHazardTiming(h)&&h.end<=clip.duration_seconds))throw Error('Invalid hazard scoring configuration');
 if(!Array.isArray(input)||input.length>1000||input.some((t,i)=>typeof t!=='number'||!Number.isFinite(t)||t<0||t>=clip.duration_seconds||(i>0&&t<input[i-1])))throw Error('Invalid clicks');
 const reason=patternReason(input);
 const scores=clip.hazards.map(h=>reason?0:hazardScore(input.find(t=>t>=h.start&&t<h.end),h));
 return {score:scores.reduce((a,b)=>a+b,0),max_score:clip.hazards.length*5,invalidated:Boolean(reason),reason,explanation:clip.explanation};
}
// Answer-bearing feedback is returned only by the completed-attempt branch.
export function completedClipFeedback(clip,input){
 const summary=scoreSubmission(clip,input);
 return {clip_id:clip.public_id,title:clip.title||'Completed practice clip',category:clip.category||'General observation',
  hazards:clip.hazards.map((h,i)=>({label:h.label||h.description||`Developing hazard ${i+1}`,
   category:h.category||clip.category||'General observation',start:h.start,end:h.end,
   score:summary.invalidated?0:hazardScore(input.find(t=>t>=h.start&&t<h.end),h),max_score:5,
   score_bands:h.score_bands??Array.from({length:5},(_,i)=>({start:h.start+(h.end-h.start)*i/5,end:i===4?h.end:h.start+(h.end-h.start)*(i+1)/5,score:5-i})),
   teaching_note:h.teaching_note||h.explanation||clip.explanation}))};
}
// Whitelist rather than omission: new private fields can never accidentally leak.
export function publicClip(clip,number){return {clip_id:clip.public_id,title:`Practice clip ${number}`,duration_seconds:clip.duration_seconds,video_url:`/media/${clip.public_id}.mp4`};}
