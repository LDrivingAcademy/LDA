import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin='https://lda-7myb3irwk-ldrivingacademys-projects.vercel.app';
const file='C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-practice-ui-v2.json';
assert(!fs.existsSync(file));
const cli='C:/Users/Joshu/AppData/Local/npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const raw=(args,input)=>execFileSync(cli,['--session','lda-hazard-release',...args],{input,encoding:'utf8',timeout:55000,windowsHide:true,maxBuffer:4e6}).trim();
const evaluate=code=>JSON.parse(raw(['eval','--stdin'],code));
function button(label,prefix=false){const snap=raw(['snapshot','-i']);const line=snap.split('\n').find(l=>l.includes(`button "${label}${prefix?'':'"'}`)&&!l.includes('[disabled'));assert(line,`Missing ${label}: ${snap}`);raw(['click','@'+line.match(/\[ref=(e\d+)\]/)[1]]);}
async function until(expression,maxSeconds=100){const deadline=Date.now()+maxSeconds*1000;while(Date.now()<deadline){if(evaluate(`new Promise(resolve=>{const end=performance.now()+8000;const check=()=>{if(${expression})return resolve(true);if(performance.now()>=end)return resolve(false);setTimeout(check,50);};check();})`))return;}throw Error('Wait failed '+expression);}
const report={origin,started_at:new Date().toISOString(),steps:[],passed:false};
try{
 assert.equal(evaluate('location.origin'),origin);
 if(raw(['snapshot','-i']).includes('button "Reject All"'))button('Reject All');
 button('Hazard awareness');
 await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Practice Mode')`);
 evaluate(`(()=>{window.__ldaPracticeAudit={requests:[],events:[],errors:[]};const a=window.__ldaPracticeAudit;window.addEventListener('error',e=>a.errors.push(e.message));const original=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await original(...args);if(String(args[0]).includes('/api/lda-hazard/')&&r.headers.get('content-type')?.includes('application/json'))a.requests.push({url:String(args[0]),body:args[1]?.body??null,status:r.status,response:await r.clone().json()});return r;};for(const type of ['playing','ended','seeking','ratechange','error'])document.addEventListener(type,e=>{if(e.target instanceof HTMLVideoElement)a.events.push({type,time:e.target.currentTime,rate:e.target.playbackRate,width:e.target.videoWidth,height:e.target.videoHeight});},true);return true;})()`);
 button('Practice Mode');
 assert.equal(evaluate(`Array.from(document.querySelectorAll('button')).filter(b=>/^Practice clip [0-9]+/.test(b.textContent)).length`),15);
 for(const [index,choice,clicks,expected,max] of [[0,'Practice clip 15 ',[],0,5],[1,'Restart clip',[5,18.2,19.4,24],5,5],[2,'Practice clip 2 ',[16.2,39.2],10,10]]){
  if(index===2){button('Choose another test');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Practice Mode')`);button('Practice Mode');}
  button(choice,index!==1);
  await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Play clip'&&!b.disabled)`,150);
  const before=evaluate(`({text:document.body.innerText,width:document.querySelector('video').videoWidth,height:document.querySelector('video').videoHeight,duration:document.querySelector('video').duration})`);
  assert(before.text.includes('Clip 1 of 1'));assert(!before.text.includes('Review answers and timing · Clip'));assert(!before.text.includes('Developing-hazard window:'));assert.equal(before.width,1920);assert.equal(before.height,1080);
  const starts=evaluate(`window.__ldaPracticeAudit.requests.filter(r=>r.url==='/api/lda-hazard/practice'&&r.status===201)`);const start=starts.at(-1);
  assert(start);assert(!JSON.stringify(start.response).match(/hazards|score_bands|teaching_note|"start"|"end"|label/));
  button('Play clip');
  for(const t of clicks){await until(`document.querySelector('video')?.currentTime>=${t}`,75);button('Record a developing hazard');}
  await until(`window.__ldaPracticeAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.status===200).length>=${index+1}`,100);
  const submitted=evaluate(`window.__ldaPracticeAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.status===200)[${index}]`);
  const result=submitted.response.result;assert.equal(result.mode,'practice');assert.equal(result.score,expected);assert.equal(result.max_score,max);assert.equal(result.practice_pass_mark,undefined);assert(result.feedback[0].hazards.every(h=>h.score_bands.length===5));
  assert(evaluate('document.body.innerText').includes(`${expected}/${max}`));
  report.steps.push({clip_id:start.response.clip.clip_id,attempt_id:start.response.attempt_id,duration:before.duration,score:result.score,max_score:result.max_score,recorded_clicks:JSON.parse(submitted.body).clicks,feedback_revealed_after_end:true});
  raw(['screenshot',file.replace('.json',`-${index}.png`)]);
  console.log(JSON.stringify({practice:index+1,expected_score:`${expected}/${max}`,passed:true}));
 }
 assert.notEqual(report.steps[0].attempt_id,report.steps[1].attempt_id);
 button('Choose another test');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Weak Area Mode')`);button('Weak Area Mode');
 assert(evaluate('document.body.innerText').includes('Night visibility'));
 assert(evaluate('document.body.innerText').includes('Practise practice clip 15'));
 assert(!evaluate('document.body.innerText').includes('Developing-hazard window:'));
 report.weak_area_ui=raw(['snapshot','-i']);raw(['screenshot',file.replace('.json','-weak.png')]);
 report.audit=evaluate('window.__ldaPracticeAudit');assert.equal(report.audit.errors.length,0);assert.equal(report.audit.events.filter(e=>['seeking','ratechange','error'].includes(e.type)).length,0);assert.equal(report.audit.events.filter(e=>e.type==='ended'&&e.rate===1).length,3);
 report.passed=true;
}catch(e){report.error=String(e.stack||e);try{report.ui=raw(['snapshot','-i']);report.audit=evaluate('window.__ldaPracticeAudit');}catch{}}
finally{report.finished_at=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify({report:file,passed:report.passed,error:report.error}));}
if(!report.passed)process.exitCode=1;
