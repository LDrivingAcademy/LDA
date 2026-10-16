import fs from 'node:fs';
const root='C:/Users/Joshu/LDA Hazard Perception Production';
const file=root+'/metadata/web-library-v1/owner-authorised-release.json';
const release=JSON.parse(fs.readFileSync(file));
const categories={rural:'Country roads',double:'Vehicles moving off','side-road':'Junctions',merge:'Lane changes',child:'Pedestrians',bus:'Large vehicles',braking:'Braking and following distance',works:'Roadworks',door:'Parked vehicles',pedestrian:'Pedestrians',crossing:'Pedestrian crossings',cyclist:'Cyclists',motorcycle:'Motorcyclists',emergency:'Emergency vehicles',night:'Night visibility'};
for(const c of release.catalog){
 const source=JSON.parse(fs.readFileSync(root+'/metadata/private/'+c.clip_id+'.json'));
 c.title=source.title;c.category=categories[c.clip_id.replace(/^lda-/,'').replace(/-001$/,'')];
 if(!c.category)throw Error('Missing category for '+c.clip_id);
 c.max_score=c.hazards.length*5;
 c.hazards=c.hazards.map((h,i)=>({...h,label:h.description||`Developing hazard ${i+1}`,
  category:c.clip_id==='lda-double-001'&&i===1?'Pedestrians':c.category,
  teaching_note:h.explanation||c.explanation,
  score_bands:h.score_bands??Array.from({length:5},(_,i)=>({start:h.start+(h.end-h.start)*i/5,end:i===4?h.end:h.start+(h.end-h.start)*(i+1)/5,score:5-i}))}));
}
const backup=file+'.pre-practice.json';if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
const data=JSON.stringify(release,null,2);
fs.writeFileSync(file,data);
fs.writeFileSync('src/lib/lda-hazard/server/release.json',data);
fs.writeFileSync('.tmp/lda-hazard-full-site-v1/src/lib/lda-hazard/server/release.json',data);
console.log('Added private clip titles, categories, teaching notes and explicit five-band scoring without changing any window or video.');
