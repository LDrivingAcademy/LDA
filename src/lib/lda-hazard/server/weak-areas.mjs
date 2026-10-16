import 'server-only';
// Summaries only. Never send persisted answer snapshots or timings to this menu.
export function weakAreaRecommendations(rows,catalog){
 const categories=new Map();
 for(const row of rows){
  const state=row.payload?.state;
  if(!row.finished||state?.state!=='complete')continue;
  for(const feedback of state.feedback??[]){
   for(const hazard of feedback.hazards??[]){
    if(typeof hazard.category!=='string'||!Number.isFinite(hazard.score))continue;
    const scores=categories.get(hazard.category)??[];
    if(scores.length<10)scores.push(hazard.score);
    categories.set(hazard.category,scores);
   }
  }
 }
 return [...categories].map(([category,scores])=>({category,attempted:scores.length,
  average_score:Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)),
  low_scores:scores.filter(n=>n<3).length,
  clip_ids:catalog.filter(c=>c.hazards.some(h=>(h.category||c.category||'General observation')===category)).map(c=>c.public_id)}))
  .filter(a=>a.low_scores>0&&a.clip_ids.length).sort((a,b)=>a.average_score-b.average_score||b.low_scores-a.low_scores);
}
