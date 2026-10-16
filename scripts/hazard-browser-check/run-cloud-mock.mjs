// Real authenticated preview, real private media and durable cloud scoring.
// Never seeks, changes playback rate, changes clocks or substitutes API results.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {scoreSubmission} from 'file:///C:/Users/Joshu/LDA%20Hazard%20Perception%20Production/server/scoring.mjs';
const [origin,reportFile,resumeReport]=process.argv.slice(2);
const perfect=process.argv.includes('--perfect');
assert(/^https:\/\/lda-[a-z0-9]+-ldrivingacademys-projects\.vercel\.app$/.test(origin));
assert(reportFile&&!fs.existsSync(reportFile));
const release=JSON.parse(fs.readFileSync('.tmp/lda-hazard-full-site-v1/src/lib/lda-hazard/server/release.json'));
const clips=release.manifests[0].clip_ids.map(id=>release.catalog.find(c=>c.clip_id===id));
const cli='C:/Users/Joshu/AppData/Local/npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const raw=(args,input)=>execFileSync(cli,['--session','lda-hazard-release',...args],{input,encoding:'utf8',timeout:55000,windowsHide:true,maxBuffer:4e6}).trim();
const evaluate=code=>JSON.parse(raw(['eval','--stdin'],code));
function button(label){const snap=raw(['snapshot','-i']);const line=snap.split('\n').find(l=>l.includes(`button "${label}"`)&&!l.includes('[disabled'));assert(line,`Missing enabled ${label}: ${snap}`);raw(['click','@'+line.match(/\[ref=(e\d+)\]/)[1]]);}
async function until(expression,maxSeconds=100){const deadline=Date.now()+maxSeconds*1000;while(Date.now()<deadline){if(evaluate(`new Promise(resolve=>{const end=performance.now()+8000;const check=()=>{if(${expression})return resolve(true);if(performance.now()>=end)return resolve(false);setTimeout(check,50);};check();})`))return;}throw Error('UI wait expired: '+expression);}
const report={started_at:new Date().toISOString(),origin,release_id:release.release_id,steps:[],passed:false,limitations:['Scoring timings remain provisional, not instructor approval.','Rapid burst uses synthetic pointer events; other clicks are browser pointer input.','Desktop Chromium flow, not exhaustive device compatibility.']};
try{
 assert.equal(evaluate('location.origin'),origin);
 let firstIndex=0;
 if(resumeReport&&!perfect){
  const previous=JSON.parse(fs.readFileSync(resumeReport));
  assert.equal(previous.origin,origin);assert.equal(previous.steps.length,2);assert.equal(previous.passed,false);
  const audit=evaluate('window.__ldaMockAudit');
  const submitted=audit.requests.filter(r=>r.url.endsWith('/submit'));
  assert.equal(submitted.length,3);assert.equal(submitted[1].status,401);assert.equal(submitted[2].status,200);assert.equal(submitted[1].body,submitted[2].body,'Only identical saved request retry is permitted');
  report.recovery={previous_report:resumeReport,note:'Transient authentication check returned 401. The existing UI retry succeeded without changing authentication, replaying footage or changing clicks.',same_request_retried:true};
  report.steps=previous.steps;
  const step=report.steps[1],response=submitted[2];step.submitted_clicks=JSON.parse(response.body).clicks;step.expected=scoreSubmission(clips[1],step.submitted_clicks);step.response=response.response;
  step.ended=audit.events.filter(e=>e.type==='ended'&&e.url===step.before.url).at(-1);assert(step.ended?.ended&&step.ended.rate===1);assert.equal(step.expected.score,10);assert.equal(response.response.clip_number,3);firstIndex=2;
 }else{
  if(raw(['snapshot','-i']).includes('button "Reject All"'))button('Reject All');
  if(!raw(['snapshot','-i']).includes('region "LDA video hazard perception test"'))button('Hazard awareness');
  await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Mock Test Mode'||b.textContent.trim()==='Mock test 1 · 14 clips')`);
  if(raw(['snapshot','-i']).includes('button "Mock Test Mode"'))button('Mock Test Mode');
 evaluate(`(()=>{window.__ldaMockAudit={requests:[],events:[],errors:[]};const a=window.__ldaMockAudit;window.addEventListener('error',e=>a.errors.push(e.message));window.addEventListener('unhandledrejection',e=>a.errors.push(String(e.reason)));const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);const url=String(args[0]);if(url.includes('/api/lda-hazard/')&&!url.includes('/media/')){const entry={url,body:args[1]?.body??null,status:response.status,at:performance.now()};a.requests.push(entry);if(response.headers.get('content-type')?.includes('application/json'))entry.response=await response.clone().json();}return response;};for(const type of ['playing','ended','waiting','seeking','ratechange','error','pointerdown'])document.addEventListener(type,e=>{const v=document.querySelector('video');if(e.target instanceof HTMLVideoElement||e.target?.getAttribute?.('aria-label')==='Record a developing hazard')a.events.push({type,url:v?.currentSrc,time:v?.currentTime,rate:v?.playbackRate,trusted:e.isTrusted,ended:v?.ended,dropped:v?.getVideoPlaybackQuality?.().droppedVideoFrames,at:performance.now()});},true);return true;})()`);
 button('Mock test 1 · 14 clips');
 }
 for(let index=firstIndex;index<14;index++){
  const clip=clips[index];
  await until(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Play clip'&&!b.disabled)`,150);
  const before=evaluate(`(()=>{const v=document.querySelector('video');return {url:v?.currentSrc,duration:v?.duration,width:v?.videoWidth,height:v?.videoHeight,rate:v?.playbackRate,text:document.body.innerText};})()`);
  assert(before.text.includes(`Clip ${index+1} of 14`));assert(before.url.startsWith('blob:'+origin));assert.equal(before.duration,clip.duration_seconds);assert.equal(before.width,1920);assert.equal(before.height,1080);assert.equal(before.rate,1);
  const mode=perfect?'valid':['no-click','both-hazards','early-click','synthetic-rapid-burst','late-click'][index]??'valid';
  const step={clip_number:index+1,clip_id:clip.clip_id,mode,before:{...before,text:undefined},inputs:[]};report.steps.push(step);
  button('Play clip');
  await until(`!!document.querySelector('button[aria-label="Record a developing hazard"]')&&!document.querySelector('video').paused`,20);
  const waitTime=async t=>until(`(document.querySelector('video')?.currentTime??-1)>=${t}`,75);
  const clickAt=async t=>{await waitTime(t);button('Record a developing hazard');step.inputs.push(evaluate(`({time:document.querySelector('video').currentTime,flags:document.querySelector('[aria-label$="responses recorded"]')?.getAttribute('aria-label')})`));};
  if(mode==='early-click')await clickAt(clip.hazards[0].start-1.5);
  else if(mode==='late-click')await clickAt(clip.hazards[0].end+1);
  else if(mode==='synthetic-rapid-burst'){
   await waitTime(clip.hazards[0].start+.2);
   step.inputs.push(evaluate(`new Promise(resolve=>{const button=document.querySelector('button[aria-label="Record a developing hazard"]');let n=0;const fire=()=>{button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse',isPrimary:true}));if(++n===8)return resolve({synthetic:true,count:n,time:document.querySelector('video').currentTime});setTimeout(fire,100);};fire();})`));
  }else if(mode!=='no-click')for(const h of clip.hazards)await clickAt(h.start+.15);
  await until(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.status===200&&r.response).length>=${index+1}||Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry the same request'&&!b.disabled)`,100);
  if(raw(['snapshot','-i']).includes('button "Retry the same request"')){
   const failed=evaluate(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit')).at(-1)`);
   assert([401,503].includes(failed.status),'Only a transient auth/service failure may use the saved retry');
   step.transport_retry_status=failed.status;button('Retry the same request');
   await until(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.status===200&&r.response).length>=${index+1}`,30);
  }
  const response=evaluate(`window.__ldaMockAudit.requests.filter(r=>r.url.endsWith('/submit')&&r.status===200)[${index}]`);
  assert.equal(response.status,200);const body=JSON.parse(response.body);step.submitted_clicks=body.clicks;
  step.expected=scoreSubmission(clip,body.clicks);step.response=response.response;
  step.ended=evaluate(`window.__ldaMockAudit.events.filter(e=>e.type==='ended'&&e.url===${JSON.stringify(before.url)}).at(-1)`);
  assert(step.ended?.ended&&step.ended.rate===1,'Native normal-speed end required');
  if(index<13){assert.equal(response.response.complete,false);assert(!JSON.stringify(response.response).match(/"(?:score|hazards|explanation|start|end|score_bands|max_score)"/),'Private answer leaked before completion');}
  if(!perfect&&[0,2,4].includes(index)){assert.equal(step.expected.score,0);assert.equal(step.expected.invalidated,false);}
  else if(!perfect&&index===3){assert.equal(body.clicks.length,8);assert.equal(step.expected.invalidated,true);assert.equal(step.expected.score,0);}
  else {assert(step.expected.score>0);assert.equal(step.expected.invalidated,false);}
  fs.writeFileSync(reportFile+'.progress.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({clip:index+1,mode,clicks:body.clicks.length,expected_score:step.expected.score,normal_speed_ended:true}));
 }
 report.browser_audit=evaluate('window.__ldaMockAudit');report.final_result=report.steps.at(-1).response.result;
 const expected=report.steps.reduce((n,s)=>n+s.expected.score,0);
 if(perfect)assert.equal(expected,75,'All earliest valid responses must earn the full 75 available marks');
 assert.equal(report.steps.at(-1).response.complete,true);assert.equal(report.final_result.score,expected);assert.equal(report.final_result.max_score,75);assert.equal(report.final_result.clips.length,14);assert.equal(report.final_result.practice_passed,expected>=44);
 for(const [i,result]of report.final_result.clips.entries())assert.deepEqual(result,{clip_number:i+1,...report.steps[i].expected});
 assert.equal(report.browser_audit.errors.length,0);assert.equal(report.browser_audit.events.filter(e=>['seeking','ratechange','error'].includes(e.type)).length,0);
 report.final_ui=raw(['snapshot','-i']);raw(['screenshot',reportFile.replace(/\.json$/,'.png')]);assert(evaluate('document.body.innerText').includes(`${expected}/75`));report.passed=true;
}catch(error){report.error=String(error.stack??error);try{report.failure_ui=raw(['snapshot','-i']);raw(['screenshot',reportFile.replace(/\.json$/,'-failure.png')]);report.browser_audit=evaluate('window.__ldaMockAudit');}catch{}}
finally{report.finished_at=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({report:reportFile,passed:report.passed,error:report.error,score:report.final_result?.score}));}
if(!report.passed)process.exitCode=1;
