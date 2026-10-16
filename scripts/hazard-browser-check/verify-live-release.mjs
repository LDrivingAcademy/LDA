import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const cli='C:/Users/Joshu/AppData/Local/npm-cache/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser-win32-x64.exe';
const raw=(args,input)=>execFileSync(cli,['--session','lda-hazard-release',...args],{input,encoding:'utf8',timeout:55000,windowsHide:true,maxBuffer:4e6}).trim();
const evaluate=code=>JSON.parse(raw(['eval','--stdin'],code));
function button(label,prefix=false){const snap=raw(['snapshot','-i']);const line=snap.split('\n').find(l=>l.includes(`button "${label}${prefix?'':'"'}`)&&!l.includes('[disabled'));assert(line,`Missing ${label}: ${snap}`);raw(['click','@'+line.match(/\[ref=(e\d+)\]/)[1]]);}
async function until(expression,maxSeconds=100){const deadline=Date.now()+maxSeconds*1000;while(Date.now()<deadline){if(evaluate(`new Promise(resolve=>{const end=performance.now()+8000;const check=()=>{if(${expression})return resolve(true);if(performance.now()>=end)return resolve(false);setTimeout(check,50);};check();})`))return;}throw Error('Wait failed '+expression);}
const report={url:'https://ldrivingacademy.co.uk/theory-test',deployment:'dpl_CtBjwG5AfykhoF3Lhoc94v1fxp3K',checked_at:new Date().toISOString(),passed:false};
assert.equal(evaluate('location.href'),report.url);
if(raw(['snapshot','-i']).includes('button "Reject All"'))button('Reject All');
button('Hazard awareness');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Practice Mode')`);
assert(evaluate(`Array.from(document.querySelectorAll('h2')).some(h=>h.textContent==='Hazard Perception Test')`));
report.heading='Hazard Perception Test';report.mock_menu=raw(['snapshot','-i']);
button('Practice Mode');report.practice_menu=raw(['snapshot','-i']);assert.equal(evaluate(`Array.from(document.querySelectorAll('button')).filter(b=>/^Practice clip [0-9]+/.test(b.textContent)).length`),15);
raw(['screenshot','C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-live-menu.png']);
button('Practice clip 1 ',true);await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Play clip'&&!b.disabled)`,150);button('Play clip');
await until(`document.querySelector('video')?.currentTime>=2`,20);
report.playback=evaluate(`({time:document.querySelector('video').currentTime,rate:document.querySelector('video').playbackRate,width:document.querySelector('video').videoWidth,height:document.querySelector('video').videoHeight,paused:document.querySelector('video').paused})`);
assert.equal(report.playback.rate,1);assert.equal(report.playback.width,1920);assert.equal(report.playback.height,1080);assert.equal(report.playback.paused,false);
button('End this practice');await until(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Practice Mode')`);
report.temporary_live_attempt_abandoned=true;report.passed=true;
fs.writeFileSync('C:/Users/Joshu/LDA Hazard Perception Production/qc-reports/web-library-v1-live-release.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({live:report.url,heading:report.heading,clips:15,playback:report.playback,passed:true}));
