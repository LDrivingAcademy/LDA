import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, CheckCircle2, FileCheck2, RadioTower, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { FastSignOutButton } from "@/components/fast-sign-out-button";
import { InstructorLessonPingMap } from "@/components/instructor-lesson-ping-map";
import { InstructorDashboardMenu } from "@/components/instructor-dashboard-menu";
import { LearnerBookingDashboard } from "@/components/learner-booking-dashboard";
import { LearnerDashboardMenu } from "@/components/learner-dashboard-menu";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";

const learnerCommandItems = [
  "Next lesson and pickup details",
  "Progress and weak-skill focus",
  "SmartMatch and protected booking tools"
];

const instructorCommandItems = [
  "Today’s availability and booked slots",
  "Learner progress records",
  "Verification, payout, and support visibility"
];

export default async function DashboardPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <h1 className="text-3xl font-black">Connect Supabase to unlock live dashboards</h1>
          <p className="mt-3 leading-7 text-zinc-400">
            The learner journey is ready. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel so login can open real user dashboards.
          </p>
          <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm mt-5">
            Open login <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=learner");
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }, { data: learnerProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,areas_covered").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("learner_profiles")
      .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at,learner_plus_active,learner_plus_started_at,learner_plus_expires_at")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const roleLabels = roles?.map((role) => role.role).join(", ") || "learner";
  const isInstructor = roleLabels.includes("instructor");
  const hasLearnerPlus =
    !isInstructor &&
    Boolean(learnerProfile?.learner_plus_active) &&
    (!learnerProfile?.learner_plus_expires_at || new Date(learnerProfile.learner_plus_expires_at).getTime() > Date.now());
  const displayName = profile?.full_name || user.email || "Learner";
  const verificationStatus = instructorProfile?.verification_status ?? "not started";
  const commandItems = isInstructor ? instructorCommandItems : learnerCommandItems;
  const statusRequestHref = `mailto:info@ldrivingacademy.co.uk?subject=${encodeURIComponent(
    "Instructor verification status request"
  )}&body=${encodeURIComponent(
    `Hello LDA,\n\nPlease can you send me a status update on my instructor verification process.\n\nAccount: ${profile?.email ?? user.email ?? "Unknown"}\nCurrent status: ${verificationStatus}\n\nThank you.`
  )}`;

  if (!isInstructor && !hasCompletedLearnerEligibility(learnerProfile)) {
    redirect("/auth/verify?role=learner&message=Complete learner eligibility before booking. Your date of birth must show you are 17 or over, and you must accept the terms and provisional licence checks.");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-zinc-800 bg-ink text-white">
        <div className="flex w-full items-center justify-between gap-4 px-[15px] py-4">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-red-200">{isInstructor ? "Instructor Account" : "Learner account"}</div>
              <div className="mt-1 truncate text-xl font-black">{displayName}</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {isInstructor ? (
                  <Link href="/instructor-plus?from=dashboard" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                    Instructor
                  </Link>
                ) : (
                  <>
                    <Link href="/learner-plus?from=dashboard" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                      {hasLearnerPlus ? "Learner Plus" : "Learner"}
                    </Link>
                    {!hasLearnerPlus ? (
                      <Link href="/learner-plus?from=dashboard" className="rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                        Upgrade to Plus
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FastSignOutButton />
            {isInstructor ? <InstructorDashboardMenu /> : <LearnerDashboardMenu />}
          </div>
        </div>
      </header>

      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <RadioTower size={16} /> {isInstructor ? "Instructor command centre" : "Learner command centre"}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Run your LDA day with clarity." : "Your lesson journey, clear and protected."}
            </h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-zinc-300">
              {isInstructor
                ? "Keep availability, learners, progress, verification, and support actions in one professional workspace."
                : "See what is booked, what needs attention, how you are progressing, and where LDA can support your next step."}
            </p>
          </div>
          <div className="grid gap-3">
            {commandItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-950 p-4 text-sm font-black text-zinc-100">
                <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
        <article className="flex flex-col rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
          <CalendarCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">{isInstructor ? "Plan your working day" : "Plan your learning route"}</h2>
          <p className="mt-2 text-zinc-600">
            {isInstructor
              ? "Move from verification into live availability, confirmed lessons, learner records, and payout-ready booking evidence."
              : "Move from eligibility to lessons, theory, practical test readiness, first car guidance, and stored progress."}
          </p>
          <div className="mb-8 mt-3 grid gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
            {isInstructor ? (
              <>
                <span>ADI/PDI verification</span>
                <span>Profile setup</span>
                <span>Vehicle and pricing</span>
                <span>Areas covered</span>
                <span>Availability publishing</span>
                <span>Bookings and payouts</span>
              </>
            ) : (
              <>
                <span>Theory test booking</span>
                <span>Driving lessons</span>
                <span>Practical test booking</span>
                <span>First car guidance</span>
                <span>Insurance quote support</span>
                <span>Progress and revision</span>
              </>
            )}
          </div>
          <Link href={isInstructor ? "/instructor?from=dashboard" : "/learner-journey?from=dashboard"} className="lda-pill lda-pill-sm mt-auto self-start">
            {isInstructor ? "Open instructor route" : "Open learner route"} <ArrowRight size={16} />
          </Link>
        </article>
        {isInstructor ? (
          <article className="flex flex-col rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
            <FileCheck2 className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Verification status</h2>
            <p className="mt-2 text-zinc-600">
              Current status: <span className="font-black">{verificationStatus}</span>
            </p>
            <Link href={statusRequestHref} className="lda-pill lda-pill-sm mt-auto self-start">
              Request update <ArrowRight size={16} />
            </Link>
          </article>
        ) : (
          <article className="flex flex-col rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
            <Sparkles className="text-brand" />
            <h2 className="mt-4 text-xl font-black">LDA SmartMatch</h2>
            <p className="mt-2 text-zinc-600">
              Compare instructor skills, support needs, availability, price, reviews, and lesson goals.
            </p>
            <Link href="/smart-match?from=dashboard" className="lda-pill lda-pill-sm mt-auto self-start">
              Open SmartMatch <ArrowRight size={16} />
            </Link>
          </article>
        )}
        <article className="flex flex-col rounded border border-zinc-200 bg-zinc-50 p-5 text-black shadow-sm">
          <ShieldCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Protected LDA record</h2>
          <p className="mt-2 text-zinc-600">
            Keep booking references, progress notes, support requests, cancellation evidence, and platform actions inside LDA.
          </p>
          <Link href={isInstructor ? "/instructor-support-dashboard?from=dashboard" : "/support/learner?from=dashboard"} className="lda-pill lda-pill-sm mt-auto self-start">
            Open support <ArrowRight size={16} />
          </Link>
        </article>
      </section>

      {isInstructor ? <InstructorDashboard /> : <LearnerBookingDashboard learnerEmail={profile?.email ?? user.email} learnerPhone={profile?.phone} />}
    </main>
  );
}

function InstructorDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <InstructorLessonPingMap />
    </section>
  );
}
