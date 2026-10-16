// Drives the real React UI against an explicitly private loopback fixture.
// Normal-speed playback only. No API shortcuts, clock changes or approval writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {scoreSubmission} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/scoring.mjs';
const [session,folder,reportFile,resumeReport]=process.argv.slice(2);
assert(/^lda-[a-z0-9-]+$/.test(session??''));assert(folder&&reportFile&&!fs.existsSync(reportFile));
const fixture=JSON.parse(fs.readFileSync(path.join(folder,'private-fixture.json')));
const master='C:/Users/Joshu/LDA Hazard Perception Production';
const scope=JSON.parse(fs.readFileSync(path.join(master,'production-scope.json')));
assert(Date.now()+25*60e3<Date.parse(scope.absolute_deadline_utc));
const cli='C:/Users/Joshu/AppData/Local/npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const raw=(args,input)=>execFileSync(cli,['--session',session,...args],{input,encoding:'utf8',timeout:55000,windowsHide:true,maxBuffer:4e6}).trim();
const evaluate=code=>JSON.parse(raw(['eval','--stdin'],code));
function button(label){const snap=raw(['snapshot','-i']);const line=snap.split('\n').find(l=>l.includes(`button "${label}"`)&&!l.includes('[disabled'));assert(line,`Missing enabled ${label}: ${snap}`);const ref=line.match(/\[ref=(e\d+)\]/)?.[1];assert(ref);raw(['click','@'+ref]);}
async function until(expression,maxSeconds=85){
 const deadline=Date.now()+maxSeconds*1000;
 while(Date.now()<deadline){
  const ok=evaluate(`new Promise(resolve=>{const end=performance.now()+10000;const check=()=>{if(${expression})return resolve(true);if(performance.now()>=end)return resolve(false);setTimeout(check,50);};check();})`);
  if(ok)return;
 }
 throw Error('UI/media wait expired: '+expression);
}
const report={started_at_utc:new Date().toISOString(),test_only:true,quality_approved:false,scoring_calibration_approved:false,fixture_evidence:fixture.evidence,steps:[],passed:false,limitations:['Private in-memory fixture, not live authentication or cloud persistence.','Draft scoring windows are test inputs, not instructor-approved recognition boundaries.','Rapid-click check dispatches synthetic pointer events; other recorded hazard clicks use browser pointer input.','Normal-speed telemetry is not manual every-frame visual review or mobile compatibility.']};
try{
 assert.equal(evaluate('location.origin'),'http://127.0.0.1:4387');
 let firstIndex=0;
 if(resumeReport){
  const previous=JSON.parse(fs.readFileSync(resumeReport));
  assert(previous.passed===false&&previous.error?.includes('os error 10060')&&previous.steps.length===1,'Only the observed first-clip controller timeout may resume');
  assert.deepEqual(previous.fixture_evidence,fixture.evidence);
  const audit=evaluate('window.__ldaMockAudit'),submissions=audit.requests.filter(r=>r.url.endsWith('/submit'));
  assert.equal(submissions.length,1);assert.equal(submissions[0].status,200);assert.equal(submissions[0].response.clip_number,2);
  const step=previous.steps[0],clip=fixture.catalog[0];step.submitted_clicks=JSON.parse(submissions[0].body).clicks;
  assert.deepEqual(step.submitted_clicks,[]);step.expected_from_observed_clicks=scoreSubmission(clip,step.submitted_clicks);step.response=submissions[0].response;
  step.ended=audit.events.filter(e=>e.type==='ended'&&e.url.endsWith('/'+clip.public_id+'.mp4')).at(-1);
  assert(step.ended?.ended&&step.ended.rate===1);assert.equal(step.expected_from_observed_clicks.score,0);
  report.steps.push(step);report.resumed_observation={prior_report:resumeReport,prior_started_at:previous.started_at_utc,note:'Same live browser attempt; first no-click video finished during controller observation timeout. No replay, seeking or server-state reset.'};firstIndex=1;
 }else{
  evaluate(`(()=>{window.__ldaMockAudit={requests:[],events:[],errors:[]};const a=window.__ldaMockAudit;window.addEventListener('error',e=>a.errors.push(e.message));window.addEventListener('unhandledrejection',e=>a.errors.push(String(e.reason)));const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);const url=String(args[0]);if(url.includes('/api/lda-hazard/')){const entry={url,body:args[1]?.body??null,status:response.status,at:performance.now()};a.requests.push(entry);try{entry.response=await response.clone().json();}catch(e){entry.error=String(e);} }return response;};for(const type of ['playing','ended','waiting','seeking','ratechange','error','pointerdown'])document.addEventListener(type,e=>{const v=document.querySelector('video');if(e.target instanceof HTMLVideoElement||e.target?.getAttribute?.('aria-label')==='Record a developing hazard')a.events.push({type,url:v?.currentSrc,time:v?.currentTime,rate:v?.playbackRate,trusted:e.isTrusted,ended:v?.ended,dropped:v?.getVideoPlaybackQuality?.().droppedVideoFrames,at:performance.now()});},true);return true;})()`);
  button('Mock test 1 · 14 clips');
 }
 for(let index=firstIndex;index<14;index++){
  const clip=fixture.catalog[index];
  await until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Play clip'&&!b.disabled)`,20);
  const before=evaluate(`(()=>{const v=document.querySelector('video');return {url:v?.currentSrc,duration:v?.duration,width:v?.videoWidth,height:v?.videoHeight,rate:v?.playbackRate,text:document.body.innerText};})()`);
  assert(before.text.includes(`Clip ${index+1} of 14`));assert(before.url.endsWith('/'+clip.public_id+'.mp4'));assert.equal(before.duration,clip.duration_seconds);assert.equal(before.width,1920);assert.equal(before.height,1080);assert.equal(before.rate,1);
  const mode=['no-click','early-click','late-click','synthetic-rapid-burst'][index]??(index===13?'both-hazards':index===4?'multiple-valid-no-stacking':'valid');
  const step={clip_number:index+1,clip_id:clip.clip_id,video_sha256:clip.video_sha256,mode,before:{...before,text:undefined},inputs:[]};report.steps.push(step);
  button('Play clip');
  await until(`!!document.querySelector('button[aria-label="Record a developing hazard"]')&&!document.querySelector('video').paused`,10);
  const waitTime=async t=>{await until(`(document.querySelector('video')?.currentTime??-1)>=${JSON.stringify(t)}`,70);};
  const clickAt=async t=>{await waitTime(t);button('Record a developing hazard');step.inputs.push(evaluate(`({time:document.querySelector('video').currentTime,flags:document.querySelector('[aria-label$="responses recorded"]')?.getAttribute('aria-label')})`));};
  if(mode==='early-click')await clickAt(clip.hazards[0].start-1.5);
  else if(mode==='late-click')await clickAt(clip.hazards[0].end+1);
  else if(mode==='synthetic-rapid-burst'){
   await waitTime(clip.hazards[0].start+.2);
   step.inputs.push(evaluate(`new Promise(resolve=>{const button=document.querySelector('button[aria-label="Record a developing hazard"]');let n=0;const fire=()=>{button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse',isPrimary:true}));if(++n===8)return resolve({synthetic:true,count:n,time:document.querySelector('video').currentTime,flags:document.querySelector('[aria-label$="responses recorded"]')?.getAttribute('aria-label')});setTimeout(fire,100);};fire();})`));
  }else if(mode!=='no-click'){
   for(const h of clip.hazards)await clickAt(h.start+.15);
   if(mode==='multiple-valid-no-stacking')await clickAt(clip.hazards[0].start+1.5);
  }
  await until(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.response).length>=${index+1}`,85);
  const response=evaluate(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit'))[${index}]`);
  assert.equal(response.status,200);const body=JSON.parse(response.body);step.submitted_clicks=body.clicks;
  step.expected_from_observed_clicks=scoreSubmission(clip,body.clicks);step.response=response.response;
  const endEvent=evaluate(`window.__ldaMockAudit.events.filter(e=>e.type==='ended'&&e.url.endsWith('/${clip.public_id}.mp4')).at(-1)`);
  assert(endEvent?.ended&&endEvent.rate===1,'Native normal-speed ended event required');step.ended=endEvent;
  if(index<13){assert.equal(response.response.complete,false);assert(!JSON.stringify(response.response).match(/"(?:score|hazards|explanation|start|end|score_bands|max_score)"/),'Private answer leaked before completion');}
  if(index<3){assert.equal(body.clicks.length,index===0?0:1);assert.equal(step.expected_from_observed_clicks.score,0);assert.equal(step.expected_from_observed_clicks.invalidated,false);}
  else if(index===3){assert.equal(body.clicks.length,8);assert.equal(step.expected_from_observed_clicks.invalidated,true);assert.equal(step.expected_from_observed_clicks.score,0);}
  else {assert(step.expected_from_observed_clicks.score>0);assert.equal(step.expected_from_observed_clicks.invalidated,false);}
  console.log(JSON.stringify({clip:index+1,mode,recorded_clicks:body.clicks.length,expected_score:step.expected_from_observed_clicks.score,normal_speed_ended:true}));
 }
 report.browser_audit=evaluate('window.__ldaMockAudit');
 report.final_result=report.steps.at(-1).response.result;
 const expected=report.steps.reduce((n,s)=>n+s.expected_from_observed_clicks.score,0);
 assert.equal(report.steps.at(-1).response.complete,true);assert.equal(report.final_result.score,expected);assert.equal(report.final_result.max_score,75);assert.equal(report.final_result.clips.length,14);assert.equal(report.final_result.practice_passed,expected>=44);
 for(const [i,result]of report.final_result.clips.entries())assert.deepEqual(result,{clip_number:i+1,...report.steps[i].expected_from_observed_clicks});
 assert.equal(report.browser_audit.errors.length,0);
 assert.equal(report.browser_audit.events.filter(e=>e.type==='seeking'||e.type==='ratechange'||e.type==='error').length,0);
 report.final_ui=raw(['snapshot','-i']);raw(['screenshot',reportFile.replace(/\.json$/,'.png')]);
 assert(evaluate('document.body.innerText').includes(`${expected}/75`));
 for(const clip of fixture.catalog)assert.equal(createHash('sha256').update(fs.readFileSync(clip.video)).digest('hex'),clip.video_sha256);
 report.passed=true;
}catch(error){report.error=String(error.stack??error);try{report.failure_ui=raw(['snapshot','-i']);raw(['screenshot',reportFile.replace(/\.json$/,'-failure.png')]);report.browser_audit=evaluate('window.__ldaMockAudit');}catch{}}
finally{report.finished_at_utc=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({report:reportFile,passed:report.passed,error:report.error,score:report.final_result?.score}));}
if(!report.passed)process.exitCode=1;
