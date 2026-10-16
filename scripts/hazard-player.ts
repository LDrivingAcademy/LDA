import { scoreClip, type HazardClip } from "../src/lib/hazard-perception";

declare global { interface Window { LDA_CLIPS: HazardClip[] } }
const clips = window.LDA_CLIPS;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>("video");
const stage = $("stage");
const results = $("results");
const bank = $("bank");
let index = 0;
let clicks: number[] = [];
let saved: Record<string, number[]> = {};
let mode: "practice" | "test" | "review" = "practice";
let ended = false;
let buffering = true;
let metadataValid = false;
let expectedTime = 0;
let lastSeekAllowed = false;
const clip = () => clips[index];

function message(text: string) { $("status").textContent = text; }
function renderBank() {
  bank.replaceChildren();
  clips.forEach((c, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode === "test" ? `Clip ${i + 1}` : `${String(i + 1).padStart(2, "0")}  ${c.title}`;
    button.disabled = mode === "test";
    button.className = index === i ? "selected" : "";
    button.setAttribute("aria-pressed", String(index === i));
    button.onclick = () => load(i);
    bank.append(button);
  });
}
function controls() {
  $<HTMLButtonElement>("play").disabled = !metadataValid || ended;
  $<HTMLButtonElement>("pause").hidden = mode !== "practice" || ended;
  $<HTMLButtonElement>("restart").hidden = mode !== "practice";
  $<HTMLButtonElement>("answer").hidden = !ended || mode === "test";
  $<HTMLButtonElement>("next").hidden = !ended || mode !== "test";
  $<HTMLButtonElement>("fulltest").disabled = mode === "test" || clips.length !== 14;
  $("review-controls").hidden = mode !== "review" && !ended;
  $("heading").textContent = mode === "test" ? `Clip ${index + 1} of ${clips.length}` : clip().title;
  $("count").textContent = `${clicks.length} click${clicks.length === 1 ? "" : "s"}`;
  $("play").textContent = video.currentTime > 0 ? "Resume clip" : "Start clip";
}
function flags() {
  const holder = $("flags");
  holder.replaceChildren();
  clicks.forEach((time, i) => {
    const flag = document.createElement("span");
    flag.className = "flag";
    flag.textContent = "⚑";
    flag.style.left = `${time / clip().duration * 100}%`;
    flag.title = `Click ${i + 1}: ${time.toFixed(2)} seconds`;
    holder.append(flag);
  });
}
function showAnswers() {
  if (!ended || mode === "test") return;
  const result = scoreClip(clip(), clicks);
  results.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = result.reason
    ? `Clip invalidated: 0 / ${result.max}`
    : `Practice result: ${result.total} / ${result.max}`;
  results.append(heading);
  if (result.reason) {
    const warning = document.createElement("p");
    warning.textContent = `${result.reason}: this clip scores zero. A few considered follow-up clicks do not automatically invalidate a clip. This is LDA's practice detection rule, not the official detection algorithm.`;
    results.append(warning);
  }
  if (!result.reason) {
    const feedback = document.createElement('p');
    feedback.textContent = result.total > 0
      ? 'You registered a developing hazard inside a scoring window. Review the individual scores below; a single clip has no official pass mark.'
      : 'No click registered inside a scoring window. Review when the hazard developed, then try again.';
    results.append(feedback);
  }
  result.hazards.forEach(({ hazard, time, score }) => {
    const card = document.createElement("article");
    for (const [tag, text] of [["h3", hazard.label], ["p", `Score ${score}/5 · ${time === undefined ? "No scoring click" : `First scoring click ${time.toFixed(2)}s`}`], ["p", hazard.clue], ["p", hazard.response], ["small", `Draft scoring window: ${hazard.start.toFixed(2)}–${hazard.end.toFixed(2)}s. Instructor validation required.`]]) {
      const el = document.createElement(tag); el.textContent = text; card.append(el);
    }
    const replay = document.createElement("button");
    replay.textContent = "Replay this development";
    replay.onclick = () => {
      lastSeekAllowed = true;
      video.currentTime = Math.max(0, hazard.start - 4);
      play();
    };
    card.append(replay); results.append(card);
  });
}
function load(i: number) {
  video.pause();
  index = i;
  clicks = mode === "review" ? [...(saved[clip().id] ?? [])] : [];
  ended = mode === "review";
  buffering = true; metadataValid = false; expectedTime = 0; lastSeekAllowed = true;
  results.replaceChildren();
  video.src = `${clip().id}/${clip().id}.mp4`;
  video.poster = `${clip().id}/poster.jpg`;
  video.load();
  renderBank(); flags(); controls(); message("Loading video…");
  if (mode === "review") showAnswers();
}
async function play() {
  if (!metadataValid) { message("Wait for the video to load, or retry if a file is missing."); return; }
  try { await video.play(); }
  catch { message("Playback could not start. Press Start/Resume again, or check the video file is available."); }
}
function record() {
  if (ended || mode === "review" || video.paused || video.ended || video.seeking || buffering || video.readyState < 3 || !metadataValid) return;
  // Read media time at the actual input event. Never increment a separate timer.
  if (clicks.length < 1000) clicks.push(video.currentTime);
  flags(); controls();
  $("flash").classList.remove("pulse");
  void $("flash").offsetWidth;
  $("flash").classList.add("pulse");
}
stage.addEventListener("pointerdown", (event) => { if (event.button === 0) { stage.focus(); record(); } });
stage.addEventListener("keydown", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && !event.repeat) { event.preventDefault(); record(); }
});
video.addEventListener("loadedmetadata", () => {
  metadataValid = Number.isFinite(video.duration) && Math.abs(video.duration - clip().duration) <= 0.15;
  message(metadataValid ? "Ready. Start the clip, then click, tap, or press Space when a hazard develops." : "Video length does not match its scoring data. This clip is disabled until the export is corrected.");
  controls();
});
video.addEventListener("waiting", () => { buffering = true; message("Buffering — clicks are paused until the video continues."); });
video.addEventListener("playing", () => { buffering = false; message(mode === "review" || ended ? "Review playback — no new clicks recorded." : "Watch the whole road. Click when a hazard develops."); controls(); });
video.addEventListener("pause", () => { if (!video.ended) message("Paused — no clicks are recorded. Press Resume to continue."); controls(); });
video.addEventListener("error", () => { metadataValid = false; buffering = true; message("Video unavailable. Check that the clip folder and MP4 are beside this player, then choose Retry."); controls(); });
video.addEventListener("seeking", () => {
  if (mode !== "review" && !ended && !lastSeekAllowed && Math.abs(video.currentTime - expectedTime) > 0.3) video.currentTime = expectedTime;
});
video.addEventListener("seeked", () => { lastSeekAllowed = false; });
video.addEventListener("timeupdate", () => {
  if (!video.seeking) expectedTime = video.currentTime;
  $("elapsed").textContent = `${video.currentTime.toFixed(1)}s / ${clip().duration}s`;
  $<HTMLProgressElement>("progress").value = video.currentTime / clip().duration;
  $<HTMLInputElement>("scrub").value = String(video.currentTime / clip().duration * 100);
});
video.addEventListener("ended", () => {
  if (mode === "review") { message("Review clip ended."); return; }
  ended = true;
  saved[clip().id] = [...clicks];
  if (mode === "test" && index === clips.length - 1) {
    mode = "review";
    const total = clips.reduce((sum, c) => sum + scoreClip(c, saved[c.id] ?? []).total, 0);
    message(`Full practice test complete: ${total}/75. ${total >= 44 ? "Practice pass." : "Keep practising."} This is not a prediction or certification of official-test readiness.`);
    renderBank(); showAnswers();
  } else if (mode === "test") message("Clip complete. Select Next clip when you are ready. Answers remain hidden until the test ends.");
  else { message("Clip complete. Review your clicks and the developing hazard below."); showAnswers(); }
  controls();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); });
$("play").onclick = play;
$("pause").onclick = () => video.pause();
$("restart").onclick = () => load(index);
$("retry").onclick = () => {
  if (clicks.length && !confirm("Retry restarts this clip and clears its current clicks. Continue?")) return;
  load(index);
};
$("answer").onclick = showAnswers;
$("next").onclick = () => { if (mode === "test" && ended && index < clips.length - 1) load(index + 1); };
$("fulltest").onclick = () => { mode = "test"; saved = {}; load(0); };
$("practice").onclick = () => {
  if (mode === "test" && !confirm("Leave this test? Your unfinished test will be discarded.")) return;
  mode = "practice"; saved = {}; load(0);
};
$("replay").onclick = () => { lastSeekAllowed = true; video.currentTime = 0; play(); };
$("scrub").addEventListener("input", (event) => {
  if (!ended && mode !== "review") return;
  lastSeekAllowed = true;
  video.currentTime = Number((event.target as HTMLInputElement).value) / 100 * clip().duration;
});
if (clips.length) load(0);
else { message("No complete rendered clips have been packaged yet."); $("controls").hidden = true; }
