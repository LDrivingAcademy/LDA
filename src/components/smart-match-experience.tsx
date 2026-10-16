"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock3,
  CreditCard,
  LockKeyhole,
  MapPin,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Star
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { SmartMatchInput } from "@/lib/smart-match";
import type { SmartMatchHandoffContext } from "@/lib/smart-match-handoff";
import {
  SMART_MATCH_HANDOFF_KEY,
  SMART_MATCH_LEGACY_DRAFT_KEY,
  SMART_MATCH_SESSION_DRAFT_KEY,
  availabilityForSmartMatchPath,
  defaultSmartMatchPreferences,
  normaliseSmartMatchPreferences
} from "@/lib/smart-match-preferences";

type BookingPath = "on-demand" | "book-lesson" | "schedule-lesson";
type SmartMatchMode = "guest" | "account";
type SaveStatus = "idle" | "saving" | "saved" | "error" | "migration";

type SmartMatchResult = {
  summary: string;
  learnerPlan: string[];
  accessibilityPlan?: string[];
  ldaExclusive: string[];
  plan: string[];
  matches: Array<{
    id: string;
    name: string;
    badge: string;
    pricePence: number;
    transmission: string;
    distanceMiles: number;
    rating: number;
    reviewCount: number;
    car: string;
    nextSlot: string;
    strengths: string[];
    qualifications: string[];
    lessonAdaptations: string[];
    postPassTags: string[];
    teachingStyle: string;
    verifiedBadges?: string[];
    onDemandAvailable?: boolean;
    todaySlots?: string[];
    matchScore: number;
    reasons: string[];
  }>;
};

type DraftState = {
  input?: SmartMatchInput;
  selectedPath?: BookingPath;
  step?: number;
  authGatePath?: BookingPath | null;
};

const accessibilityOptions = [
  { value: "calm support", label: "Calm support", body: "A steady pace and reassurance when things feel busy." },
  { value: "extra processing time", label: "Extra time to process", body: "More pause time before decisions or new tasks." },
  { value: "one instruction at a time", label: "One instruction at a time", body: "Clear single steps instead of stacked instructions." },
  { value: "low distraction", label: "Low-distraction start", body: "Start on calmer routes before building complexity." },
  { value: "accessible pickup planning", label: "Accessible pickup planning", body: "Extra care around pickup, mobility, or route setup." },
  { value: "confidence support", label: "Confidence support", body: "Support for nerves, hesitation, or rebuilding trust." }
];

const learningOptions = [
  { value: "step-by-step", label: "Step by step" },
  { value: "visual examples", label: "Visual examples" },
  { value: "written recap", label: "Written recap" },
  { value: "predictable lesson structure", label: "Predictable structure" },
  { value: "quiet explanations", label: "Quiet explanations" },
  { value: "practice notes", label: "Practice notes" }
];

const communicationOptions = [
  { value: "clear verbal instructions", label: "Clear verbal instructions" },
  { value: "agree a pause signal", label: "Agree a pause signal" },
  { value: "check understanding", label: "Check understanding" },
  { value: "short debrief", label: "Short debrief" },
  { value: "sign language support", label: "Sign language" },
  { value: "written or visual directions", label: "Written or visual directions" }
];

const goalOptions = [
  { value: "parking", label: "Parking" },
  { value: "roundabouts", label: "Roundabouts" },
  { value: "test route confidence", label: "Test confidence" },
  { value: "motorway", label: "Motorway" },
  { value: "night driving", label: "Night driving" },
  { value: "refresher", label: "Refresher" }
];

const routeOptions: Array<{
  value: BookingPath;
  label: string;
  body: string;
  icon: typeof CarFront;
  accountRequired: boolean;
}> = [
  {
    value: "on-demand",
    label: "Book On Demand",
    body: "Request a live instructor now. Guests and signed-in learners can use this route.",
    icon: CarFront,
    accountRequired: false
  },
  {
    value: "book-lesson",
    label: "Book Lesson",
    body: "Choose a matching instructor and go straight into the existing lesson booking flow.",
    icon: CreditCard,
    accountRequired: true
  },
  {
    value: "schedule-lesson",
    label: "Schedule Lesson",
    body: "Choose a matching instructor, pick a later calendar slot, then continue to checkout.",
    icon: CalendarDays,
    accountRequired: true
  }
];

const steps = [
  "Area",
  "Transmission",
  "Confidence",
  "Learn",
  "Support",
  "Communication",
  "Goals",
  "Budget",
  "Private note",
  "Route"
];

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toggleValue(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function normaliseBookingPath(value: unknown): BookingPath | null {
  return value === "on-demand" || value === "book-lesson" || value === "schedule-lesson" ? value : null;
}

function smartMatchContext(
  input: SmartMatchInput,
  selectedPath: BookingPath,
  match?: SmartMatchResult["matches"][number]
): SmartMatchHandoffContext {
  return {
    source: "smart-match",
    selectedPath,
    postcode: input.postcode ?? "",
    budgetPence: input.budgetPence,
    transmission: input.transmission,
    availability: availabilityForSmartMatchPath(selectedPath),
    bookingPath: selectedPath,
    confidence: input.confidence,
    lessonStage: input.lessonStage,
    instructorId: match?.id,
    instructorName: match?.name,
    matchScore: match?.matchScore,
    reasons: match?.reasons.slice(0, 4) ?? [],
    accessibilityNeeds: input.accessibilityNeeds ?? [],
    learningPreferences: input.learningPreferences ?? [],
    communicationPreferences: input.communicationPreferences ?? [],
    environmentPreferences: input.environmentPreferences ?? [],
    lessonSupport: input.lessonSupport ?? [],
    goals: input.goals ?? [],
    privateNote: input.privateNote ?? "",
    disclosureConsent: Boolean(input.disclosureConsent),
    savedAt: new Date().toISOString()
  };
}

function rememberSmartMatchHandoff(input: SmartMatchInput, selectedPath: BookingPath, match?: SmartMatchResult["matches"][number]) {
  try {
    window.sessionStorage.setItem(SMART_MATCH_HANDOFF_KEY, JSON.stringify(smartMatchContext(input, selectedPath, match)));
  } catch {
    // Booking can continue without browser storage.
  }
}

function readDraft(): DraftState | null {
  try {
    const stored = window.sessionStorage.getItem(SMART_MATCH_SESSION_DRAFT_KEY) ?? window.sessionStorage.getItem(SMART_MATCH_LEGACY_DRAFT_KEY);
    return stored ? (JSON.parse(stored) as DraftState) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: DraftState) {
  try {
    window.sessionStorage.setItem(SMART_MATCH_SESSION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Guest mode is still usable without browser storage.
  }
}

function bookingHref(input: SmartMatchInput, selectedPath: BookingPath, match?: SmartMatchResult["matches"][number]) {
  const params = new URLSearchParams({
    from: "smart-match",
    smartMatch: "1",
    transmission: String(input.transmission ?? match?.transmission ?? "automatic")
  });

  if (input.postcode) params.set("postcode", input.postcode);
  if (match?.id) params.set("instructor", match.id);
  if (match?.name) params.set("instructorName", match.name);

  if (selectedPath === "on-demand") return `/lesson-now?${params.toString()}`;

  if (selectedPath === "book-lesson") {
    params.set("section", "driving-lessons");
    params.set("date", addDaysIso(0));
    return `/learner-dashboard?${params.toString()}#driving-lessons-booking`;
  }

  params.set("date", addDaysIso(2));
  return `/scheduled-lessons?${params.toString()}#scheduled-lessons-booking`;
}

function learnerLoginHref() {
  return `/auth/login?role=learner&next=${encodeURIComponent("/smart-match?continue=booking")}`;
}

function learnerSignupHref() {
  return `/auth/sign-up?role=learner&next=${encodeURIComponent("/smart-match?continue=booking")}`;
}

export function SmartMatchExperience() {
  const [mode, setMode] = useState<SmartMatchMode>("guest");
  const [step, setStep] = useState(0);
  const [selectedPath, setSelectedPath] = useState<BookingPath>("book-lesson");
  const [authGatePath, setAuthGatePath] = useState<BookingPath | null>(null);
  const [input, setInput] = useState<SmartMatchInput>(() => defaultSmartMatchPreferences());
  const [result, setResult] = useState<SmartMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const draft = readDraft();
      const returningFromAuth = window.location.search.includes("continue=booking");
      const restoredInput = draft?.input ? normaliseSmartMatchPreferences(draft.input) : null;
      const restoredSelectedPath = normaliseBookingPath(draft?.selectedPath);
      const pendingAuthPath = normaliseBookingPath(draft?.authGatePath);

      if (restoredInput) {
        setInput(restoredInput);
        if (restoredSelectedPath) setSelectedPath(restoredSelectedPath);
        if (typeof draft?.step === "number") setStep(Math.min(Math.max(draft.step, 0), steps.length - 1));
        if (pendingAuthPath && !returningFromAuth) setAuthGatePath(pendingAuthPath);
      }

      try {
        const response = await fetch("/api/smart-match/preferences", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = (await response.json().catch(() => null)) as {
          mode?: SmartMatchMode;
          preferences?: SmartMatchInput | null;
          error?: string;
        } | null;

        if (!active) return;

        if (response.status === 401) {
          setMode("guest");
          if (returningFromAuth && pendingAuthPath) setAuthGatePath(pendingAuthPath);
          return;
        }

        if (response.status === 503) {
          setMode("account");
          setSaveStatus("migration");
          setAccountMessage(payload?.error ?? "Smart Match account preferences are not available yet.");
          return;
        }

        if (response.ok) {
          setMode("account");
          if (returningFromAuth && pendingAuthPath && restoredInput) {
            const nextInput = normaliseSmartMatchPreferences({
              ...restoredInput,
              availability: availabilityForSmartMatchPath(pendingAuthPath),
              bookingPath: pendingAuthPath
            });

            setInput(nextInput);
            setSelectedPath(pendingAuthPath);
            setAuthGatePath(null);
            setStep(steps.length - 1);
            writeDraft({ input: nextInput, selectedPath: pendingAuthPath, step: steps.length - 1, authGatePath: null });
            setLoading(true);

            try {
              await fetch("/api/smart-match/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ preferences: nextInput })
              });

              const matchResponse = await fetch("/api/smart-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nextInput)
              });
              const data = (await matchResponse.json()) as SmartMatchResult;
              if (active) {
                setResult(data);
                setSaveStatus("saved");
                setAccountMessage("Smart Match preferences saved to your account.");
              }
            } finally {
              if (active) setLoading(false);
            }
            return;
          }

          if (payload?.preferences && (!draft?.input || !returningFromAuth)) {
            setInput(normaliseSmartMatchPreferences(payload.preferences));
          }
        }
      } finally {
        if (active) setDraftLoaded(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    writeDraft({ input, selectedPath, step, authGatePath });
  }, [authGatePath, draftLoaded, input, selectedPath, step]);

  const pathInput = useMemo(
    () =>
      normaliseSmartMatchPreferences({
        ...input,
        availability: availabilityForSmartMatchPath(selectedPath),
        bookingPath: selectedPath
      }),
    [input, selectedPath]
  );

  const visibleMatches = useMemo(() => {
    if (!result) return [];
    if (selectedPath === "on-demand") return result.matches.filter((match) => match.onDemandAvailable);
    if (selectedPath === "book-lesson") return result.matches.filter((match) => (match.todaySlots ?? []).length > 0);
    return result.matches;
  }, [result, selectedPath]);

  async function saveAccountPreferences(nextInput = pathInput) {
    if (mode !== "account") return true;
    if (saveStatus === "migration") return false;

    setSaveStatus("saving");
    setAccountMessage("");
    try {
      const response = await fetch("/api/smart-match/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ preferences: nextInput })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setSaveStatus(response.status === 503 ? "migration" : "error");
        setAccountMessage(payload?.error ?? "Smart Match preferences could not be saved.");
        return false;
      }
      setSaveStatus("saved");
      setAccountMessage("Smart Match preferences saved to your account.");
      return true;
    } catch {
      setSaveStatus("error");
      setAccountMessage("Smart Match preferences could not be saved.");
      return false;
    }
  }

  async function runMatch(nextPath = selectedPath) {
    const requestInput = normaliseSmartMatchPreferences({
      ...input,
      availability: availabilityForSmartMatchPath(nextPath),
      bookingPath: nextPath
    });

    setLoading(true);
    try {
      await saveAccountPreferences(requestInput);
      const response = await fetch("/api/smart-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestInput)
      });
      const data = (await response.json()) as SmartMatchResult;
      setResult(data);
      setAuthGatePath(null);
      setStep(steps.length - 1);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    if (selectedPath !== "on-demand" && mode === "guest") {
      setAuthGatePath(selectedPath);
      void saveAccountPreferences(pathInput);
      return;
    }

    void runMatch(selectedPath);
  }

  function resetDraft() {
    const defaults = defaultSmartMatchPreferences();
    setInput(defaults);
    setSelectedPath("book-lesson");
    setAuthGatePath(null);
    setResult(null);
    setStep(0);
    try {
      window.sessionStorage.removeItem(SMART_MATCH_SESSION_DRAFT_KEY);
      window.sessionStorage.removeItem(SMART_MATCH_LEGACY_DRAFT_KEY);
      window.sessionStorage.removeItem(SMART_MATCH_HANDOFF_KEY);
    } catch {
      // Ignore browser storage failures.
    }
  }

  const progressPercent = Math.round(((step + 1) / steps.length) * 100);

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["1", "One question at a time", "Plain English choices with large buttons and no diagnosis labels."],
          ["2", "Guest or account mode", "Guests keep answers for this session. Signed-in learners can save and reuse them."],
          ["3", "Same booking engine", "Smart Match hands into LDA on-demand, checkout, dashboards, maps, and notifications."]
        ].map(([number, title, body]) => (
          <article key={number} className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-brand text-base font-black">{number}</div>
            <h2 className="mt-4 text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{body}</p>
          </article>
        ))}
      </div>

      <section className="rounded border border-zinc-800 bg-zinc-950 text-white shadow-sm">
        <div className="border-b border-zinc-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                <Sparkles size={16} /> {mode === "account" ? "Account Smart Match" : "Guest Smart Match"}
              </div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">Smart Match wizard</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-400">
                {mode === "account"
                  ? "Your saved preferences are loaded when available. Edit them here, then LDA will save updates to your account."
                  : "You can complete the full journey as a guest. Your choices stay in this browser session only."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetDraft}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-700 bg-black px-5 py-2 text-sm font-black text-white hover:border-red-500"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
          {accountMessage ? (
            <p className={`mt-4 rounded border p-3 text-sm font-black leading-6 ${saveStatus === "saved" ? "border-emerald-400 bg-emerald-950 text-emerald-100" : "border-red-500/50 bg-red-950/60 text-red-100"}`}>
              {accountMessage}
            </p>
          ) : null}
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-h-[420px] rounded border border-zinc-800 bg-black p-5">
            {authGatePath ? (
              <AuthGate
                selectedPath={authGatePath}
                onBack={() => {
                  setAuthGatePath(null);
                  setStep(steps.length - 1);
                }}
              />
            ) : result ? (
              <ResultsPanel
                input={pathInput}
                selectedPath={selectedPath}
                result={result}
                visibleMatches={visibleMatches}
                mode={mode}
              />
            ) : (
              <WizardQuestion
                step={step}
                input={input}
                selectedPath={selectedPath}
                setInput={setInput}
                setSelectedPath={(path) => {
                  setSelectedPath(path);
                  setInput((current) => ({
                    ...current,
                    availability: availabilityForSmartMatchPath(path),
                    bookingPath: path
                  }));
                }}
              />
            )}
          </div>

          <aside className="rounded border border-zinc-800 bg-black p-5">
            <div className="text-xs font-black uppercase text-zinc-500">Step {step + 1} of {steps.length}</div>
            <h3 className="mt-2 text-2xl font-black">{steps[step]}</h3>
            <div className="mt-5 grid gap-2">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setAuthGatePath(null);
                    setStep(index);
                  }}
                  className={`min-h-10 rounded border px-3 text-left text-sm font-black ${
                    index === step ? "border-brand bg-red-500/10 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-400"
                  }`}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
            <div className="mt-5 rounded border border-zinc-800 bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-400">
              <LockKeyhole className="mb-2 text-brand" size={18} />
              Private notes are prepared only for the instructor you book. Guest answers are not permanently saved.
            </div>
          </aside>
        </div>

        {!result && !authGatePath ? (
          <div className="flex flex-wrap justify-between gap-3 border-t border-zinc-800 p-5">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-700 bg-black px-5 py-2 text-sm font-black text-white hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={next} disabled={loading} className="lda-pill min-w-52 justify-center">
              {step === steps.length - 1 ? (
                <>
                  {loading ? "Finding matches..." : selectedPath !== "on-demand" && mode === "guest" ? "Sign in to continue" : "Show my route"} <ArrowRight size={16} />
                </>
              ) : (
                <>
                  Continue <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function WizardQuestion({
  step,
  input,
  selectedPath,
  setInput,
  setSelectedPath
}: {
  step: number;
  input: SmartMatchInput;
  selectedPath: BookingPath;
  setInput: (input: SmartMatchInput) => void;
  setSelectedPath: (path: BookingPath) => void;
}) {
  if (step === 0) {
    return (
      <QuestionShell eyebrow="Location" title="Where should LDA search for instructors?">
        <label className="grid max-w-xl gap-2">
          <span className="text-sm font-black uppercase text-zinc-400">Area or postcode</span>
          <input
            value={input.postcode ?? ""}
            onChange={(event) => setInput({ ...input, postcode: event.target.value.toUpperCase() })}
            className="min-h-16 rounded border border-zinc-700 bg-zinc-950 px-4 text-2xl font-black text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            autoComplete="postal-code"
            placeholder="Example: EN5"
          />
        </label>
      </QuestionShell>
    );
  }

  if (step === 1) {
    return (
      <QuestionShell eyebrow="Car type" title="Which transmission do you want?">
        <OptionGrid>
          {(["automatic", "manual"] as const).map((transmission) => (
            <ChoiceButton
              key={transmission}
              selected={input.transmission === transmission}
              title={transmission === "automatic" ? "Automatic" : "Manual"}
              body={transmission === "automatic" ? "Match with automatic instructors only." : "Match with manual instructors only."}
              onClick={() => setInput({ ...input, transmission })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 2) {
    return (
      <QuestionShell eyebrow="Confidence" title="How are you feeling about driving right now?">
        <OptionGrid>
          {[
            ["nervous", "Nervous", "I want calm support and a steady start."],
            ["some", "Some confidence", "I can drive, but I want guidance and structure."],
            ["confident", "Confident", "I want to progress quickly with clear targets."]
          ].map(([value, title, body]) => (
            <ChoiceButton
              key={value}
              selected={input.confidence === value}
              title={title}
              body={body}
              onClick={() => setInput({ ...input, confidence: value as SmartMatchInput["confidence"] })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 3) {
    return (
      <QuestionShell eyebrow="Learning preferences" title="How do you learn best?">
        <OptionGrid>
          {learningOptions.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={input.learningPreferences?.includes(option.value)}
              title={option.label}
              onClick={() => setInput({ ...input, learningPreferences: toggleValue(input.learningPreferences, option.value) })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 4) {
    return (
      <QuestionShell eyebrow="Accessibility first" title="What would make lessons easier to follow?">
        <OptionGrid>
          {accessibilityOptions.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={input.accessibilityNeeds?.includes(option.value)}
              title={option.label}
              body={option.body}
              onClick={() => setInput({ ...input, accessibilityNeeds: toggleValue(input.accessibilityNeeds, option.value) })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 5) {
    return (
      <QuestionShell eyebrow="Communication" title="How should the instructor communicate during lessons?">
        <OptionGrid>
          {communicationOptions.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={input.communicationPreferences?.includes(option.value)}
              title={option.label}
              onClick={() => setInput({ ...input, communicationPreferences: toggleValue(input.communicationPreferences, option.value) })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 6) {
    return (
      <QuestionShell eyebrow="Lesson goals" title="What do you want help with first?">
        <OptionGrid>
          {goalOptions.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={input.goals?.includes(option.value)}
              title={option.label}
              onClick={() => setInput({ ...input, goals: toggleValue(input.goals, option.value) })}
            />
          ))}
        </OptionGrid>
      </QuestionShell>
    );
  }

  if (step === 7) {
    return (
      <QuestionShell eyebrow="Budget" title={`What is your preferred hourly lesson price?`}>
        <div className="max-w-2xl rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="text-5xl font-black">{formatMoney(input.budgetPence ?? 4200)}</div>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-400">Smart Match uses this to rank suitable instructors while keeping quality and availability in the score.</p>
          <input
            type="range"
            min="3000"
            max="6000"
            step="100"
            value={input.budgetPence ?? 4200}
            onChange={(event) => setInput({ ...input, budgetPence: Number(event.target.value) })}
            className="mt-6 min-h-11 w-full accent-red-600"
          />
        </div>
      </QuestionShell>
    );
  }

  if (step === 8) {
    return (
      <QuestionShell eyebrow="Private note" title="Anything you want the booked instructor to know?">
        <label className="grid max-w-3xl gap-2">
          <span className="text-sm font-black uppercase text-zinc-400">Optional note</span>
          <textarea
            value={input.privateNote ?? ""}
            onChange={(event) => setInput({ ...input, privateNote: event.target.value })}
            rows={6}
            maxLength={700}
            className="rounded border border-zinc-700 bg-zinc-950 px-4 py-4 text-base font-bold leading-7 text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Example: I prefer quiet explanations, extra time at junctions, or a written recap after lessons."
          />
        </label>
        <label className="mt-4 flex max-w-3xl items-start gap-3 rounded border border-zinc-800 bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-300">
          <input
            checked={Boolean(input.disclosureConsent)}
            onChange={(event) => setInput({ ...input, disclosureConsent: event.target.checked })}
            type="checkbox"
            className="mt-1 min-h-4 min-w-4"
          />
          Share my selected preferences and private note with the instructor I book. If unticked, LDA can still use the selected preferences for matching, but the private note is not sent to instructors.
        </label>
      </QuestionShell>
    );
  }

  return (
    <QuestionShell eyebrow="Booking route" title="What do you want to do next?">
      <OptionGrid>
        {routeOptions.map((route) => {
          const Icon = route.icon;
          return (
            <button
              key={route.value}
              type="button"
              onClick={() => setSelectedPath(route.value)}
              className={`min-h-44 rounded border p-5 text-left transition ${
                selectedPath === route.value ? "border-brand bg-red-500/10 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-red-500"
              }`}
            >
              <Icon className={selectedPath === route.value ? "text-brand" : "text-zinc-500"} size={28} />
              <span className="mt-4 block text-2xl font-black">{route.label}</span>
              <span className="mt-2 block text-sm font-bold leading-6 text-zinc-400">{route.body}</span>
              {route.accountRequired ? (
                <span className="mt-4 inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs font-black uppercase text-zinc-300">Learner account required</span>
              ) : null}
            </button>
          );
        })}
      </OptionGrid>
    </QuestionShell>
  );
}

function QuestionShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="text-sm font-black uppercase text-brand">{eyebrow}</div>
      <h3 className="mt-2 max-w-4xl text-4xl font-black tracking-normal sm:text-5xl">{title}</h3>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function OptionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function ChoiceButton({ selected, title, body, onClick }: { selected?: boolean; title: string; body?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 rounded border p-4 text-left transition ${
        selected ? "border-brand bg-red-500/10 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-red-500"
      }`}
    >
      <span className="flex items-center gap-2 text-lg font-black">
        {selected ? <CheckCircle2 size={18} className="text-brand" /> : null}
        {title}
      </span>
      {body ? <span className="mt-2 block text-sm font-bold leading-6 text-zinc-400">{body}</span> : null}
    </button>
  );
}

function AuthGate({ selectedPath, onBack }: { selectedPath: BookingPath; onBack: () => void }) {
  const label = selectedPath === "schedule-lesson" ? "schedule a lesson" : "book a lesson";

  return (
    <section className="grid min-h-[380px] place-items-center">
      <div className="max-w-2xl text-center">
        <LockKeyhole className="mx-auto text-brand" size={36} />
        <div className="mt-4 text-sm font-black uppercase text-brand">Learner account required</div>
        <h3 className="mt-2 text-4xl font-black tracking-normal">Sign in to continue</h3>
        <p className="mt-3 text-base font-semibold leading-7 text-zinc-300">
          LDA has kept your Smart Match answers in this browser. Sign in or create a learner account, then you will return here with your route ready to continue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={learnerLoginHref()} className="lda-pill">
            Sign in to {label} <ArrowRight size={16} />
          </Link>
          <Link href={learnerSignupHref()} className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-700 bg-black px-6 py-3 text-sm font-black text-white hover:border-red-500">
            Create learner account
          </Link>
          <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-700 bg-black px-6 py-3 text-sm font-black text-white hover:border-red-500">
            Choose a different route
          </button>
        </div>
      </div>
    </section>
  );
}

function ResultsPanel({
  input,
  selectedPath,
  result,
  visibleMatches,
  mode
}: {
  input: SmartMatchInput;
  selectedPath: BookingPath;
  result: SmartMatchResult;
  visibleMatches: SmartMatchResult["matches"];
  mode: SmartMatchMode;
}) {
  if (selectedPath === "on-demand") {
    return (
      <section>
        <div className="text-sm font-black uppercase text-brand">Book On Demand</div>
        <h3 className="mt-2 max-w-4xl text-4xl font-black tracking-normal">Your requirements are ready for the live booking flow.</h3>
        <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-zinc-300">
          LDA will attach these preferences to the existing on-demand request and then use the normal waiting screen, dispatch process, dashboards, maps, notifications and tracking page.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            "Guest and signed-in learners can continue.",
            "On-demand dispatch considers accessibility requirements.",
            "The instructor who accepts sees the relevant private note."
          ].map((item) => (
            <div key={item} className="rounded border border-zinc-800 bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-300">
              <CheckCircle2 className="mb-2 text-brand" size={18} /> {item}
            </div>
          ))}
        </div>
        <Link
          href={bookingHref(input, selectedPath)}
          onClick={() => rememberSmartMatchHandoff(input, selectedPath)}
          className="lda-pill mt-6 w-full justify-center sm:w-fit"
        >
          Continue to on-demand booking <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div>
        <div className="text-sm font-black uppercase text-brand">Recommended matches</div>
        <h3 className="mt-2 text-3xl font-black tracking-normal">{result.summary}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
          {mode === "account" ? "Choose an instructor and LDA will send your saved preferences into the existing booking flow." : "Sign in to continue with a learner account."}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {visibleMatches.length ? (
          visibleMatches.map((match) => {
            const href = bookingHref(input, selectedPath, match);
            return (
              <article key={match.id} className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100">
                      <Sparkles size={14} /> {match.matchScore}% compatibility
                    </div>
                    <h4 className="mt-3 text-2xl font-black">{match.name}</h4>
                    <p className="mt-1 text-sm font-bold text-zinc-400">
                      {match.transmission} | {formatMoney(match.pricePence)}/hr | {match.distanceMiles} miles
                    </p>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded bg-black text-brand ring-1 ring-zinc-800">
                    <Star size={24} />
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-zinc-300">{match.teachingStyle}</p>
                <div className="mt-4 grid gap-2">
                  {match.reasons.slice(0, 4).map((reason) => (
                    <div key={reason} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-300">
                      <CheckCircle2 className="mt-1 shrink-0 text-brand" size={16} /> {reason}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(match.verifiedBadges ?? [`Verified ${match.badge}`, "LDA approved"]).slice(0, 4).map((badge) => (
                    <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-black text-zinc-300">
                      <BadgeCheck size={13} className="text-brand" /> {badge}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 rounded border border-zinc-800 bg-black p-3 text-sm font-bold text-zinc-300">
                  <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-brand" /> Next visible slot: {match.nextSlot}</span>
                  <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {match.car}</span>
                  <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-brand" /> Private note unlocks only after booking</span>
                </div>
                <Link
                  href={href}
                  onClick={() => rememberSmartMatchHandoff(input, selectedPath, match)}
                  className="lda-pill mt-5 w-full justify-center"
                >
                  {selectedPath === "schedule-lesson" ? "Schedule with this instructor" : "Book with this instructor"} <ArrowRight size={16} />
                </Link>
              </article>
            );
          })
        ) : (
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
            <MapPin className="text-brand" />
            <h4 className="mt-4 text-2xl font-black">No matches for that route yet.</h4>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
              Try a different timing route, widen the price range, or change transmission.
            </p>
          </article>
        )}
      </div>
      <article className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <Save size={16} /> What LDA carries forward
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(result.accessibilityPlan ?? result.learnerPlan ?? []).map((item) => (
            <div key={item} className="rounded border border-zinc-800 bg-black p-3 text-sm font-bold leading-6 text-zinc-300">
              {item}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
