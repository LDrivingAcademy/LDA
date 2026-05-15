"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, ExternalLink, MousePointerClick, RotateCcw, ShieldCheck, TrafficCone, type LucideIcon } from "lucide-react";

type ViewKey = "prepare" | "mock" | "hazard" | "book";
type MockQuestion = { question: string; answers: string[]; correctIndex: number; explanation: string };

const mockQuestions: MockQuestion[] = [
  { question: "You are driving in heavy rain. What should you do with your following distance?", answers: ["Keep the same gap", "Double it", "At least double it", "Only increase it on motorways"], correctIndex: 2, explanation: "Wet roads increase stopping distance, so leave at least double the normal gap." },
  { question: "A pedestrian is waiting at a zebra crossing. What should you do?", answers: ["Sound your horn", "Prepare to stop", "Flash your headlights", "Wave them across"], correctIndex: 1, explanation: "Approach crossings at a speed that lets you stop safely." },
  { question: "What does a red traffic light mean?", answers: ["Stop before the stop line", "Stop only if traffic is crossing", "Continue if clear", "Prepare to go"], correctIndex: 0, explanation: "Red means stop and wait behind the stop line." },
  { question: "When should you use dipped headlights in daytime?", answers: ["Only in built-up areas", "When visibility is seriously reduced", "Only in fog", "Never in daylight"], correctIndex: 1, explanation: "Dipped headlights help others see you when visibility is poor." },
  { question: "What is the main reason for checking mirrors before changing speed?", answers: ["To see what is behind and around you", "To check your hair", "To avoid signalling", "To look at passengers"], correctIndex: 0, explanation: "Mirror checks help you understand how your actions affect surrounding road users." },
  { question: "You see a triangular warning sign. What does the shape usually tell you?", answers: ["An order", "A warning", "A parking restriction", "A motorway direction"], correctIndex: 1, explanation: "Triangular signs warn you about hazards ahead." },
  { question: "Why should you avoid coasting downhill in neutral?", answers: ["It saves too much fuel", "It reduces steering control", "It reduces vehicle control", "It makes the horn louder"], correctIndex: 2, explanation: "Keeping the vehicle in gear helps maintain control, especially downhill." },
  { question: "What should you do when emergency vehicles approach with blue lights?", answers: ["Brake sharply immediately", "Find a safe place to let them pass", "Stop on a bend", "Mount the pavement"], correctIndex: 1, explanation: "Stay calm, check around you, and let emergency vehicles pass safely." },
  { question: "What should you do before opening a car door on the road side?", answers: ["Open it quickly", "Check mirrors and blind spots", "Only check the front", "Signal with your horn"], correctIndex: 1, explanation: "Check for cyclists, motorcyclists, and other traffic before opening a door." },
  { question: "What is the safest response if you feel tired while driving?", answers: ["Open a window and continue", "Stop in a safe place and rest", "Drive faster to arrive sooner", "Turn music up"], correctIndex: 1, explanation: "Tiredness seriously affects reaction time. Stop safely and rest." }
];

const knowledgeSections = [
  { title: "Highway Code essentials", points: ["Road-user hierarchy and responsibility", "Stopping distances", "Speed limits", "Signals, markings, and lane discipline"] },
  { title: "Traffic signs", points: ["Warning signs", "Orders and restrictions", "Direction signs", "Temporary roadworks signs"] },
  { title: "Crossings", points: ["Zebra crossings", "Pelican, puffin, toucan, and equestrian crossings", "School crossings", "Cyclist and pedestrian awareness"] },
  { title: "Traffic lights", points: ["Red and amber rules", "Filter arrows", "Box junctions", "Temporary traffic control"] },
  { title: "Dangers on the road", points: ["Developing hazards", "Vulnerable road users", "Weather and visibility", "Emergency vehicles"] },
  { title: "Vehicle handling and safety", points: ["Tyres and lights", "Seatbelts and child restraints", "Load security", "Breakdowns and warning lights"] }
];

const hazardHotspots = [
  { id: "child", label: "Child near crossing", left: "18%", top: "58%" },
  { id: "van", label: "Van blocking view", left: "52%", top: "45%" },
  { id: "cyclist", label: "Cyclist in blind spot", left: "76%", top: "68%" }
];

const theoryViews: Array<{ key: ViewKey; label: string; Icon: LucideIcon }> = [
  { key: "prepare", label: "Get ready for theory", Icon: BookOpenCheck },
  { key: "mock", label: "Mock test", Icon: Clock3 },
  { key: "hazard", label: "Hazard awareness", Icon: MousePointerClick },
  { key: "book", label: "Book official test", Icon: ExternalLink }
];

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function TheoryTestSuite() {
  const [activeView, setActiveView] = useState<ViewKey>("prepare");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timer, setTimer] = useState(8 * 60);
  const [submitted, setSubmitted] = useState(false);
  const [hazardsFound, setHazardsFound] = useState<string[]>([]);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    if (activeView !== "mock" || submitted || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((value) => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeView, submitted, timer]);

  useEffect(() => {
    if (timer === 0) setSubmitted(true);
  }, [timer]);

  const score = useMemo(() => mockQuestions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0), [answers]);

  function resetMock() {
    setAnswers({});
    setTimer(8 * 60);
    setSubmitted(false);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-3 md:grid-cols-4">
        {theoryViews.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => setActiveView(key)} className={`rounded border p-4 text-left font-black transition ${activeView === key ? "border-brand bg-brand text-white" : "border-zinc-200 bg-white text-black hover:ring-2 hover:ring-brand"}`}>
            <Icon className="mb-3" />
            {label}
          </button>
        ))}
      </div>

      {activeView === "prepare" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {knowledgeSections.map((section) => (
              <article key={section.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">{section.title}</h2>
                <div className="mt-4 grid gap-2">
                  {section.points.map((point) => (
                    <div key={point} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-700">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <aside className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">LDA readiness target</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-950">
              GOV.UK currently lists the car theory multiple-choice pass mark as 43 out of 50, and hazard perception as 44 out of 75. LDA recommends repeated mock scores of at least 46 out of 50 before booking.
            </p>
            <button type="button" onClick={() => setActiveView("mock")} className="lda-pill lda-pill-sm mt-5">
              Start mock test <ArrowRight size={17} />
            </button>
          </aside>
        </div>
      ) : null}

      {activeView === "mock" ? (
        <div className="mt-6 rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">LDA mock theory test</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">Original LDA practice questions. The official car test uses 50 questions in 57 minutes.</p>
            </div>
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xl font-black text-brand">{formatTimer(timer)}</div>
          </div>
          <div className="mt-6 grid gap-5">
            {mockQuestions.map((question, index) => (
              <article key={question.question} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="font-black">{index + 1}. {question.question}</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {question.answers.map((answer, answerIndex) => {
                    const isSelected = answers[index] === answerIndex;
                    const isCorrect = submitted && question.correctIndex === answerIndex;
                    const isWrong = submitted && isSelected && question.correctIndex !== answerIndex;
                    return (
                      <button key={answer} type="button" disabled={submitted} onClick={() => setAnswers((current) => ({ ...current, [index]: answerIndex }))} className={`rounded border px-3 py-3 text-left text-sm font-bold ${isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800" : isWrong ? "border-red-400 bg-red-50 text-red-800" : isSelected ? "border-brand bg-red-50 text-black" : "border-zinc-200 bg-white text-zinc-700"}`}>
                        {answer}
                      </button>
                    );
                  })}
                </div>
                {submitted ? <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{question.explanation}</p> : null}
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSubmitted(true)} className="lda-pill lda-pill-sm">Submit mock test</button>
            <button type="button" onClick={resetMock} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand"><RotateCcw className="mr-2 inline" size={16} /> Reset</button>
            {submitted ? <p className={`rounded px-4 py-2 text-sm font-black ${score >= 9 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>Score {score}/{mockQuestions.length}. {score >= 9 ? "Strong practice result." : "Revise weak areas and try again before booking."}</p> : null}
          </div>
        </div>
      ) : null}

      {activeView === "hazard" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <article className="relative min-h-[420px] overflow-hidden rounded border border-zinc-200 bg-[linear-gradient(160deg,#e5e7eb,#ffffff)] p-5 shadow-sm">
            <div className="absolute inset-x-0 bottom-0 h-32 bg-zinc-800" />
            <div className="absolute bottom-24 left-0 right-0 h-10 bg-zinc-700" />
            <div className="absolute bottom-28 left-1/2 h-28 w-10 -translate-x-1/2 bg-zinc-500" />
            <div className="absolute left-[48%] top-[42%] h-28 w-24 rounded bg-white shadow" />
            <div className="absolute left-[72%] top-[64%] h-8 w-20 rounded-full bg-brand" />
            <div className="absolute left-[15%] top-[56%] h-12 w-7 rounded-full bg-yellow-400" />
            {hazardHotspots.map((hazard) => (
              <button key={hazard.id} type="button" onClick={() => setHazardsFound((current) => (current.includes(hazard.id) ? current : [...current, hazard.id]))} style={{ left: hazard.left, top: hazard.top }} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-xs font-black shadow ${hazardsFound.includes(hazard.id) ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-red-400 bg-white text-brand"}`}>
                Click hazard
              </button>
            ))}
          </article>
          <aside className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <TrafficCone className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Hazard awareness drill</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">Tap developing hazards early. This is an LDA training exercise, not a replacement for official DVSA hazard perception material.</p>
            <div className="mt-5 grid gap-2">
              {hazardHotspots.map((hazard) => (
                <div key={hazard.id} className="flex items-center gap-2 text-sm font-bold">
                  {hazardsFound.includes(hazard.id) ? <CheckCircle2 className="text-emerald-600" size={17} /> : <AlertTriangle className="text-brand" size={17} />}
                  {hazard.label}
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {activeView === "book" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Book your official theory test</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">Use the official GOV.UK booking service when your mock results are consistently strong. You will need your UK driving licence number, email address, and payment card.</p>
            <div className="mt-5 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-700">
              <span>Official car theory test fee currently listed by GOV.UK: £23.</span>
              <span>Multiple-choice guidance: 50 questions, 57 minutes, pass mark 43.</span>
              <span>Hazard perception pass mark: 44 out of 75.</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="https://www.gov.uk/book-theory-test" target="_blank" rel="noreferrer" className="lda-pill lda-pill-sm">Open GOV.UK booking <ExternalLink size={17} /></a>
              <button type="button" onClick={() => setBooked(true)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">I have booked it</button>
            </div>
          </article>
          <aside className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="text-2xl font-black">Before you book</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-950">LDA recommends at least three mock scores above 46/50 and calm hazard perception practice before paying for the official slot.</p>
            {booked ? <p className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black leading-6 text-emerald-800">Thank you for booking your theory test through LDA. We wish you the very best of luck.</p> : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
