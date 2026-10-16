"use client";

import {useEffect, useRef, useState} from 'react';
import {Flag, Play, RotateCcw} from 'lucide-react';
import type { LearnerPackageId } from '@/lib/learner-packages';
import { consumePracticeAllowance, getPracticeAllowanceSnapshot } from '@/lib/client-practice-allowances';
import { learnerPackageIncludesFeature } from '@/lib/subscription-tier-entitlements';
import {
  downloadHazardVideo,
  initialBufferedSeconds,
  readyForPracticePlayback,
  readyForProgressivePlayback,
  shouldFallbackToFullDownload,
  shouldUseFullDownloadFirst
} from '@/lib/lda-hazard/playback-loading';

type SetChoice = {set_id:string; title:string; clip_count:number};
type PracticeChoice = {clip_id:string; title:string; duration_seconds:number; max_score:number};
type WeakArea = {category:string; attempted:number; average_score:number; low_scores:number; clip_ids:string[]};
type Feedback = {clip_id:string; title:string; category:string; hazards:Array<{label:string; category:string; start:number; end:number; score:number; max_score:number; teaching_note?:string; score_bands:Array<{start:number; end:number; score:number}>}>};
type Current = {attempt_id:string; clip_token:string; clip_number:number; clip_count:number;
  clip:{clip_id:string; title:string; duration_seconds:number; video_url:string}};
type Result = {mode?:'practice'; score:number; max_score:number; practice_pass_mark?:number; practice_passed?:boolean; notice:string; feedback?:Feedback[];
  clips:Array<{clip_number:number; score:number; max_score:number; invalidated:boolean; reason:string|null; explanation:string}>};
type Phase = 'loading'|'menu'|'ready'|'playing'|'submitting'|'result'|'interrupted';
type Pending = {path:string; body:Record<string,unknown>; kind:'begin'|'ready'|'submit'|'abandon'};
const operationId = () => crypto.randomUUID().replaceAll('-','');
const buttonStyle = 'inline-flex items-center justify-center rounded-full border-2 border-brand bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-brand hover:ring-2 hover:ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand disabled:hover:text-white disabled:hover:ring-0';
const compactButtonStyle = 'inline-flex items-center justify-center rounded-full border-2 border-brand bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-white hover:text-brand hover:ring-2 hover:ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand disabled:hover:text-white disabled:hover:ring-0';
const modeButtonStyle = 'inline-flex items-center justify-center rounded-full border-2 border-brand bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-brand hover:ring-2 hover:ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand disabled:hover:text-white disabled:hover:ring-0';
const activeModeButtonStyle = `${modeButtonStyle} ring-2 ring-red-200`;
const practiceCardButtonStyle = 'rounded border-2 border-brand bg-brand p-4 text-left text-white transition hover:bg-white hover:text-brand hover:ring-2 hover:ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand disabled:hover:text-white disabled:hover:ring-0';

export function LdaHazardVideoTest({
  currentLearnerPackageId = 'learner',
  onAllowanceConsumed
}: {
  currentLearnerPackageId?: LearnerPackageId;
  onAllowanceConsumed?: () => void;
}) {
  const [sets,setSets] = useState<SetChoice[]>([]);
  const [mode,setMode] = useState<'mock'|'practice'|'weak'>('mock');
  const [practiceClips,setPracticeClips] = useState<PracticeChoice[]>([]);
  const [weakAreas,setWeakAreas] = useState<WeakArea[]>([]);
  const [lastPracticeId,setLastPracticeId] = useState<string|null>(null);
  const [phase,setPhase] = useState<Phase>('loading');
  const [current,setCurrent] = useState<Current|null>(null);
  const [result,setResult] = useState<Result|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [buffering,setBuffering] = useState(false);
  const [flagCount,setFlagCount] = useState(0);
  const [recoveryId,setRecoveryId] = useState<string|null>(null);
  const [available,setAvailable] = useState(false);
  const [provisional,setProvisional] = useState(false);
  const [mediaSrc,setMediaSrc] = useState<{token:string;url:string}|null>(null);
  const [fullDownload,setFullDownload] = useState(false);
  const [loadProgress,setLoadProgress] = useState<number|null>(0);
  const [slowLoading,setSlowLoading] = useState(false);
  const [screenAwake,setScreenAwake] = useState(false);
  const [allowanceMessage,setAllowanceMessage] = useState('');
  const mediaLoadStarted = useRef(0);
  const fullDownloadPreferred = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const hazardButton = useRef<HTMLButtonElement>(null);
  const clicks = useRef<number[]>([]);
  const playbackStarted = useRef(false);
  const phaseRef = useRef<Phase>('loading');
  const currentRef = useRef<Current|null>(null);
  const pending = useRef<Pending|null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const availabilityRequest = useRef(0);
  const setStage = (next:Phase) => {phaseRef.current=next;setPhase(next);};
  const canUseWeakAreaMode = learnerPackageIncludesFeature(currentLearnerPackageId, 'learner-plus');

  async function loadSets() {
    const requestNumber=++availabilityRequest.current;
    setError('');
    try {
      const response = await fetch('/api/lda-hazard/sets',{cache:'no-store',credentials:'same-origin'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Practice service is unavailable');
      if (!alive.current || availabilityRequest.current!==requestNumber) return;
      setSets(data.sets);setAvailable(data.available);setRecoveryId(data.active_attempt_id);setProvisional(data.instructional_review_pending===true);
      if(data.available&&!data.active_attempt_id){
        const menuUrls=canUseWeakAreaMode?['/api/lda-hazard/practice','/api/lda-hazard/weak-areas']:['/api/lda-hazard/practice'];
        const responses=await Promise.all(menuUrls.map(url=>fetch(url,{cache:'no-store',credentials:'same-origin'})));
        const menus=await Promise.all(responses.map(r=>r.json()));
        if(!alive.current||availabilityRequest.current!==requestNumber)return;
        if(responses.some(r=>!r.ok))throw new Error('Unable to load practice choices. Refresh availability to retry.');
        setPracticeClips(menus[0].clips);setWeakAreas(canUseWeakAreaMode?menus[1].areas:[]);
      }
      setStage(data.active_attempt_id?'interrupted':'menu');
    } catch (e) {if(alive.current && availabilityRequest.current===requestNumber){setError(e instanceof Error?e.message:'Unable to load tests');setStage('menu');}}
  }
  useEffect(() => {
    alive.current=true;void loadSets();
    const connection = (navigator as Navigator & {connection?: {effectiveType?: string; downlink?: number}}).connection;
    fullDownloadPreferred.current = shouldUseFullDownloadFirst({
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink
    });
    if (fullDownloadPreferred.current) setFullDownload(true);
    return () => {alive.current=false;availabilityRequest.current++;video.current?.pause();};
    // Initial fetch only; no answer metadata or timers are loaded in this client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if(!current){setMediaSrc(null);return;}
    const controller=new AbortController();let objectUrl:string|null=null;
    setMediaSrc(null);setLoaded(false);setLoadProgress(0);setSlowLoading(false);
    mediaLoadStarted.current=performance.now();
    const slowTimer=window.setTimeout(()=>setSlowLoading(true),8_000);
    // Native HTTP range playback can start before the entire MP4 downloads.
    // Phones often throttle paused media buffering, so they use the full
    // authenticated download path automatically before Play is enabled.
    if(!fullDownload)return()=>window.clearTimeout(slowTimer);
    void (async()=>{
      try {
        const response=await fetch(current.clip.video_url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        const blob=await downloadHazardVideo(response,controller.signal,p=>{if(!controller.signal.aborted)setLoadProgress(p);});
        if(controller.signal.aborted)return;
        objectUrl=URL.createObjectURL(blob);setMediaSrc({token:current.clip_token,url:objectUrl});
      }catch(e){if(!controller.signal.aborted)interrupt(e instanceof Error?e.message:'Unable to load this clip.');}
    })();
    return ()=>{window.clearTimeout(slowTimer);controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
    // A new attempt can select the same clip, so its token is part of identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[current?.clip_token,current?.clip.video_url,fullDownload]);

  function updateReadiness() {
    const player=video.current;
    if(!player||phaseRef.current!=='ready'||!currentRef.current)return;
    const duration=currentRef.current.clip.duration_seconds;
    if(!Number.isFinite(player.duration)||Math.abs(player.duration-duration)>0.15)return;
    const buffered=initialBufferedSeconds(player.buffered);
    const elapsed=(performance.now()-mediaLoadStarted.current)/1000;
    const progress=Math.min(1,buffered/duration);
    const progressiveReady = mode === 'practice'
      ? readyForPracticePlayback(duration,buffered,elapsed)
      : readyForProgressivePlayback(duration,buffered,elapsed);
    if(!fullDownload)setLoadProgress(progress);
    if(!fullDownload && mode!=='practice' && shouldFallbackToFullDownload(progress,elapsed,loaded)) {
      setFullDownload(true);setSlowLoading(true);return;
    }
    if(player.readyState>=3 && (fullDownload
      ? mediaSrc?.token===currentRef.current.clip_token
      : progressiveReady)) {
      setLoaded(true);setBuffering(false);
    }
  }
  useEffect(()=>{
    if(phase!=='ready')return;
    const timer=window.setInterval(updateReadiness,250);
    return()=>window.clearInterval(timer);
    // Sample paused-video buffers too; some mobile browsers coalesce events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase,current?.clip_token,fullDownload,mediaSrc,mode]);

  const needsAwake=Boolean(current)&&['ready','playing','submitting'].includes(phase);
  useEffect(()=>{
    if(!needsAwake||!('wakeLock' in navigator))return;
    let disposed=false;let lock:WakeLockSentinel|null=null;let requesting=false;
    const acquire=async()=>{
      if(disposed||document.hidden||requesting||(lock&&!lock.released))return;
      requesting=true;
      try {
        const next=await navigator.wakeLock.request('screen');
        if(disposed){await next.release();return;}
        lock=next;setScreenAwake(true);
        next.addEventListener('release',()=>{if(!disposed)setScreenAwake(false);},{once:true});
      }catch{/* Unsupported settings/low power must never prevent practice. */}
      finally{requesting=false;}
    };
    void acquire();document.addEventListener('visibilitychange',acquire);
    return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);setScreenAwake(false);void lock?.release().catch(()=>{});};
  },[needsAwake]);

  function installClip(data:Current) {
    currentRef.current=data;setCurrent(data);clicks.current=[];playbackStarted.current=false;setFlagCount(0);setLoaded(false);setBuffering(false);
    if(fullDownloadPreferred.current)setFullDownload(true);
    setStage('ready');
  }
  function interrupt(message:string) {
    if (!currentRef.current || !['playing','ready'].includes(phaseRef.current)) return;
    setStage('interrupted');video.current?.pause();setError(message);setRecoveryId(currentRef.current.attempt_id);
  }
  function handleWaiting() {
    setBuffering(true);
    // Accurate media timestamps alone do not stop a frozen hazard from giving
    // extra thinking time. Initial loading is allowed; in-test buffering is not.
    if(phaseRef.current==='playing'&&playbackStarted.current&&mode==='mock') {
      interrupt('Playback buffered after the clip started. This attempt cannot be scored fairly. End this attempt and retry when your connection is stable.');
    }
  }
  useEffect(() => {
    const hidden = () => {if(document.hidden && phaseRef.current==='playing')interrupt('The test was interrupted. End this attempt before starting again.');};
    document.addEventListener('visibilitychange',hidden);
    return () => document.removeEventListener('visibilitychange',hidden);
  }, []);
  useEffect(() => {
    if(phase==='playing')hazardButton.current?.focus({preventScroll:true});
  }, [phase]);

  async function perform(command:Pending) {
    if(inFlight.current) return;
    inFlight.current=true;setBusy(true);setError('');pending.current=command;
    try {
      const response = await fetch('/api/lda-hazard/'+command.path, {method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json','x-lda-hazard-request':'1'},body:JSON.stringify(command.body)});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || 'Unable to save the request');
      pending.current=null;
      if(!alive.current)return;
      if(command.kind==='begin') installClip(data);
      if(command.kind==='submit') {
        if(data.complete){setResult(data.result);setStage('result');currentRef.current=null;setCurrent(null);}
        else installClip(data);
      }
      if(command.kind==='abandon') {setCurrent(null);currentRef.current=null;setRecoveryId(null);await loadSets();}
      if(command.kind==='ready') {
        // A media error/visibility change can occur while the server request is
        // pending. Its late response must never revive an interrupted attempt.
        if(phaseRef.current!=='ready'||currentRef.current?.clip_token!==command.body.clip_token)return;
        const player=video.current;
        if(!player)throw new Error('Video player unavailable');
        if(document.hidden||player.seeking||!Number.isFinite(player.currentTime)||player.currentTime>0.05||player.playbackRate!==1){
          interrupt('Playback was interrupted before it could start. End this attempt and try again.');return;
        }
        if(player.readyState<3){interrupt('The connection changed before playback could start. End this attempt and use Download fully first when retrying.');return;}
        // Clicks use the media clock. Once playback starts, buffering interrupts
        // the attempt instead of providing additional time to inspect a hazard.
        playbackStarted.current=false;
        setStage('playing');
        try {await player.play();}
        catch {interrupt('Playback could not start. End this attempt and retry after checking your browser.');}
      }
    } catch(e) {if(alive.current)setError(e instanceof Error?e.message:'Connection lost. Retry to safely recover the same request.');}
    finally {inFlight.current=false;if(alive.current)setBusy(false);}
  }
  function start(setId:string) {
    const allowance=getPracticeAllowanceSnapshot(currentLearnerPackageId,'fullHazardMocksPerWeek');
    if(!allowance.allowed){setAllowanceMessage(`You have used this week's ${allowance.limit} full hazard mock allowance for this plan. The allowance resets Monday at 00:00 UK time.`);return;}
    consumePracticeAllowance(currentLearnerPackageId,'fullHazardMocksPerWeek');onAllowanceConsumed?.();setAllowanceMessage('');
    availabilityRequest.current++;setResult(null);setMode('mock');setLastPracticeId(null);void perform({kind:'begin',path:'mocks',body:{set_id:setId,operation_id:operationId()}});
  }
  function startPractice(clipId:string) {
    const allowance=getPracticeAllowanceSnapshot(currentLearnerPackageId,'individualHazardClipsPerDay');
    if(!allowance.allowed){setAllowanceMessage(`You have used today's ${allowance.limit} individual hazard clip allowance for this plan. The allowance resets at 00:00 UK time.`);return;}
    consumePracticeAllowance(currentLearnerPackageId,'individualHazardClipsPerDay');onAllowanceConsumed?.();setAllowanceMessage('');
    availabilityRequest.current++;setResult(null);setMode('practice');setLastPracticeId(clipId);void perform({kind:'begin',path:'practice',body:{clip_id:clipId,operation_id:operationId()}});
  }
  function play() {
    if(!current || !loaded || phase!=='ready')return;
    if(document.hidden){interrupt('Keep this test visible while starting playback. End this attempt and try again.');return;}
    void perform({kind:'ready',path:`mocks/${current.attempt_id}/ready`,body:{clip_token:current.clip_token,operation_id:operationId()}});
  }
  function recordClick() {
    const player=video.current;
    if(phaseRef.current!=='playing'||!player||player.paused||player.ended||player.seeking||player.readyState<3)return;
    const t=player.currentTime;
    if(!Number.isFinite(t)||t<0||t>=(currentRef.current?.clip.duration_seconds??0)||clicks.current.length>=1000)return;
    clicks.current.push(t);setFlagCount(clicks.current.length);
  }
  function finishClip() {
    const active=currentRef.current;
    if(!active||phaseRef.current!=='playing')return;
    setStage('submitting');
    void perform({kind:'submit',path:`mocks/${active.attempt_id}/submit`,body:{clip_token:active.clip_token,clicks:[...clicks.current],operation_id:operationId()}});
  }
  function abandon() {
    const id=currentRef.current?.attempt_id??recoveryId;
    if(!id)return;
    setStage('interrupted');video.current?.pause();
    void perform({kind:'abandon',path:`mocks/${id}/abandon`,body:{operation_id:operationId()}});
  }

  return <section className="mt-6 rounded border border-zinc-200 bg-white p-5 shadow-sm" aria-label="LDA video hazard perception test">
    <h2 className="text-2xl font-black">Hazard Perception Test</h2>
    <p className="mt-3 text-sm leading-6 text-zinc-700">Practise one clip at a time, or take a full mock with 14 clips, 15 developing hazards and 75 available marks. Click or tap anywhere on the video when you spot a developing hazard. You do not need to click directly on it.</p>
    <p className="mt-2 text-sm leading-6 text-zinc-700">A developing hazard would make you change speed or direction. Your first valid response in its scoring window earns 5 to 1 marks. Early, late or missing responses earn zero; extra clicks do not add marks. Continuous, patterned or excessive random clicking invalidates the whole clip.</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500">Original LDA practice clips. Not official DVSA content or endorsed by DVSA.</p>
    {provisional?<p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Practice scores only. Scoring timings are provisional and have not yet been independently reviewed. Results do not predict your official test result.</p>:null}
    {error?<div role="alert" className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-950">
      <p>{error}</p>
      {pending.current?<button type="button" className="mt-3 font-bold underline" disabled={busy} onClick={()=>{if(pending.current)void perform(pending.current);}}>Retry the same request</button>:null}
    </div>:null}
    {allowanceMessage?<div role="alert" className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm font-black leading-6 text-red-950">{allowanceMessage}</div>:null}
    {phase==='loading'?<p role="status" className="mt-5">Loading practice tests…</p>:null}
    {phase==='menu'?<div className="mt-5">
      <div className="mb-5 flex flex-wrap gap-3" aria-label="Hazard practice modes">
        {([['mock','Mock Test Mode'],['practice','Practice Mode'],['weak','Weak Area Mode']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={mode===key} disabled={busy} className={mode===key?activeModeButtonStyle:modeButtonStyle} onClick={()=>setMode(key)}>{label}</button>)}
      </div>
      {!available?<p className="text-sm">The new video library is not available yet.</p>:mode==='mock'?<>
        <p className="mb-4 text-sm">Mock Hazard Perception Test: 14 clips, 75 marks, practice pass mark 44. Scores and answers appear only after the whole mock. The two selections share clips.</p>
        <div className="flex flex-wrap gap-3">{sets.map(s=><button key={s.set_id} type="button" className={buttonStyle} disabled={busy||Boolean(pending.current)} onClick={()=>start(s.set_id)}>{s.title} · {s.clip_count} clips</button>)}</div>
      </>:mode==='practice'?<>
        <p className="mb-4 text-sm">Clip Bank: complete one clip for a score out of 5, or out of 10 for a two-hazard clip. Review answers and timing after it ends, then restart if you wish.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{practiceClips.map(c=><button key={c.clip_id} type="button" className={practiceCardButtonStyle} disabled={busy||Boolean(pending.current)} onClick={()=>startPractice(c.clip_id)}><span className="font-bold">{c.title}</span><span className="mt-1 block text-sm">{c.duration_seconds} seconds · {c.max_score} marks</span></button>)}</div>
      </>:!canUseWeakAreaMode?<div className="rounded border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-black text-red-950">Weak Area Mode is included with Learner Plus and Learner Pro.</p>
        <p className="mt-2 text-sm leading-6 text-red-950">Upgrade to unlock recommendations based on missed or low-scored hazard categories.</p>
        <a href="/learner-plus/learner-plus?from=theory-test" className={buttonStyle+' mt-4 inline-block'}>Upgrade to Learner Plus</a>
      </div>:<>
        <p className="mb-4 text-sm">Recommendations use missed or low-scored hazard categories from your completed attempts. No hints appear while a clip plays.</p>
        {!weakAreas.length?<p className="text-sm">Complete some practice or a mock test to build your weak-area recommendations. No low-scored categories are recorded yet.</p>:weakAreas.map(area=><section key={area.category} className="mb-4 rounded border p-4"><h3 className="font-bold">{area.category}</h3><p className="mt-1 text-sm">Average {area.average_score}/5 across {area.attempted} recent hazards · {area.low_scores} scored below 3.</p><div className="mt-3 flex flex-wrap gap-2">{area.clip_ids.map(id=>{const c=practiceClips.find(c=>c.clip_id===id);return c?<button key={id} className={buttonStyle} disabled={busy||Boolean(pending.current)} onClick={()=>startPractice(id)}>Practise {c.title.toLowerCase()}</button>:null;})}</div></section>)}
      </>}
      <button type="button" className={`${compactButtonStyle} mt-4`} disabled={busy} onClick={()=>void loadSets()}>Refresh availability</button>
    </div>:null}
    {current && ['ready','playing','submitting'].includes(phase)?<div className="mt-5">
      <div className="mb-3 flex items-center justify-between text-sm font-bold"><span>Clip {current.clip_number} of {current.clip_count}</span><span>{phase==='submitting'?'Saving responses…':phase==='ready'?(loaded?'Ready when you are':'Preparing video…'):buffering?'Buffering…':'Watch for developing hazards'}</span></div>
      <div className="relative aspect-video overflow-hidden rounded bg-black">
        <video key={current.clip_token+(fullDownload?'-download':'-stream')} ref={video} src={fullDownload?(mediaSrc?.token===current.clip_token?mediaSrc.url:undefined):current.clip.video_url} playsInline muted preload="auto" controls={false}
          disablePictureInPicture disableRemotePlayback controlsList="nodownload noplaybackrate noremoteplayback"
          className="h-full w-full object-contain" aria-label={`Driving footage, clip ${current.clip_number}`}
          onCanPlay={updateReadiness} onCanPlayThrough={updateReadiness} onProgress={updateReadiness}
          onLoadedMetadata={()=>{const p=video.current;if(p&&Math.abs(p.duration-current.clip.duration_seconds)>0.15)interrupt('The video duration did not match this attempt. Please end the attempt.');}}
          onWaiting={handleWaiting} onPlaying={()=>{if(phaseRef.current==='playing')playbackStarted.current=true;setBuffering(false);}} onEnded={finishClip}
          onPause={()=>{if(phaseRef.current==='playing'&&!video.current?.ended&&mode==='mock')interrupt('Playback was paused. End this attempt before starting again.');}}
          onSeeking={()=>{if(phaseRef.current==='playing')interrupt('Seeking is not available during a mock test. End this attempt to try again.');}}
          onRateChange={()=>{if(video.current&&video.current.playbackRate!==1)interrupt('Mock tests must play at normal speed. End this attempt to try again.');}}
          onError={()=>interrupt('This video could not load. End the attempt and check your connection before retrying.')}/>
        {phase==='playing'?<button ref={hazardButton} type="button" aria-label="Record a developing hazard" className="absolute inset-0 touch-manipulation cursor-crosshair focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-red-500"
          onPointerDown={e=>{if(e.button===0){e.preventDefault();recordClick();}}}
          onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();recordClick();}}}/>:null}
      </div>
      {phase==='ready'&&!loaded?<div className="mt-3 rounded bg-zinc-100 p-3 text-sm" role="status">
        <p>{fullDownload?'Downloading the full clip for reliable phone playback':'Preparing smooth playback'}{loadProgress===null?'…':` · ${Math.floor(loadProgress*100)}% ${fullDownload?'downloaded':'buffered'}`}</p>
        <progress className="mt-2 h-2 w-full" max={1} value={loadProgress??undefined} aria-label="Video loading progress"/>
        <p className="mt-1 text-xs">Your test timer starts only when you press Play. Picture quality and playback speed are unchanged.</p>
        {slowLoading?<p className="mt-2 text-xs">Still preparing. Slow connections can take longer. {screenAwake?'The screen is being kept awake.':'Keep this page open; your phone may still lock if battery or browser settings prevent keeping it awake.'}</p>:null}
      </div>:null}
      <div className="mt-2 flex min-h-9 items-center gap-1 rounded bg-zinc-950 px-3 py-2" aria-label={`${flagCount} responses recorded`}>
        {Array.from({length:Math.min(flagCount,30)},(_,i)=><Flag key={i} size={16} aria-hidden="true" className="fill-red-600 text-red-600"/>)}
        {flagCount>30?<span className="text-xs text-white">+{flagCount-30}</span>:null}
      </div>
      {phase==='ready'?<button type="button" onClick={play} disabled={!loaded||busy||Boolean(pending.current)} className={buttonStyle+' mt-4'}><Play size={16} className="mr-2 inline"/>{loaded?'Play clip':'Loading video…'}</button>:null}
      {phase==='ready'&&!fullDownload?<button type="button" disabled={busy||Boolean(pending.current)} onClick={()=>{setLoaded(false);setBuffering(false);setFullDownload(true);}} className="ml-4 mt-4 text-sm underline">Unreliable connection? Download fully first</button>:null}
      <button type="button" disabled={busy||Boolean(pending.current)} onClick={abandon} className="ml-4 mt-4 text-sm font-bold underline">{current.clip_count===1?'End this practice':'End this mock'}</button>
    </div>:null}
    {phase==='interrupted'?<div className="mt-5"><p className="text-sm">An unfinished attempt exists. End it before starting a new practice clip or mock.</p><button type="button" disabled={busy||Boolean(pending.current)} onClick={abandon} className={buttonStyle+' mt-4'}>End unfinished attempt</button></div>:null}
    {phase==='result'&&result?<div className="mt-6">
      <h3 className="text-3xl font-black">{result.score}/{result.max_score}</h3>
      {result.mode==='practice'?<p className="mt-2 font-bold">Individual clip result</p>:<p className="mt-2 font-bold">{result.practice_passed?'Practice pass mark reached':'Keep practising'} · Practice pass mark {result.practice_pass_mark}</p>}
      <p className="mt-2 text-sm text-zinc-600">{result.notice}</p>
      <div className="mt-5 grid gap-3">{result.clips.map(c=><details key={c.clip_number} className="rounded border p-4"><summary className="cursor-pointer font-bold">Clip {c.clip_number}: {c.score}/{c.max_score}{c.invalidated?' — responses invalidated':''}</summary><p className="mt-3 text-sm">{c.reason?`${c.reason}. `:''}{c.explanation}</p></details>)}</div>
      {result.feedback?.map((clip,i)=><details key={clip.clip_id} className="mt-3 rounded border p-4"><summary className="cursor-pointer font-bold">Review answers and timing · Clip {i+1}</summary><h4 className="mt-3 font-bold">{clip.title}</h4>{clip.hazards.map((h,j)=><div key={j} className="mt-3 text-sm"><p className="font-bold">{h.label} · {h.score}/5</p><p>{h.category} · Developing-hazard window: {h.start.toFixed(2)}–{h.end.toFixed(2)} seconds</p><p>{h.teaching_note}</p><ul className="mt-2 list-disc pl-5">{h.score_bands.map(b=><li key={b.score}>{b.score} marks: {b.start.toFixed(2)}–{b.end.toFixed(2)} seconds (end excluded)</li>)}</ul></div>)}</details>)}
      {result.mode==='practice'&&lastPracticeId?<button type="button" className={buttonStyle+' mt-5 mr-3'} disabled={busy||Boolean(pending.current)} onClick={()=>startPractice(lastPracticeId)}>Restart clip</button>:null}
      <button type="button" className={buttonStyle+' mt-5'} onClick={()=>{setResult(null);void loadSets();}}><RotateCcw size={16} className="mr-2 inline"/>Choose another test</button>
    </div>:null}
  </section>;
}
