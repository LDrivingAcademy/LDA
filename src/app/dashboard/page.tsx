import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, BellRing, CalendarCheck, FileCheck2, Sparkles } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Brand } from "@/components/brand";
import { LearnerBookingDashboard } from "@/components/learner-booking-dashboard";
import { LearnerDashboardMenu } from "@/components/learner-dashboard-menu";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { instructorJourneyStages } from "@/lib/marketplace-content";

export default async function DashboardPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-black px-4 py-10">
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
              <div className="text-sm font-bold text-red-200">Learner account</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black">LDA Dashboard, {profile?.full_name || user.email}</h1>
              {isInstructor ? (
                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100">
                  Instructor
                </span>
              ) : (
                <Link href="/learner-plus" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                  {hasLearnerPlus ? "Learner Plus" : "Learner · Upgrade to Plus"}
                </Link>
              )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <form action={signOut}>
              <button className="lda-pill lda-pill-sm">Sign out</button>
            </form>
            {!isInstructor ? <LearnerDashboardMenu /> : null}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
        <article className="flex flex-col rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
          <CalendarCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Learner journey</h2>
          <p className="mt-2 text-zinc-600">Plan the full route from first lesson to getting on the road after passing.</p>
          <div className="mb-8 mt-3 grid gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
            <span>Theory test booking</span>
            <span>Driving lessons</span>
            <span>Practical test booking</span>
            <span>First car guidance</span>
            <span>Insurance quote support</span>
            <span>Progress and revision</span>
          </div>
          <Link href="/learner-journey" className="lda-pill lda-pill-sm mt-auto self-start">
            LDA learner journey <ArrowRight size={16} />
          </Link>
        </article>
        {isInstructor ? (
          <article className="rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
            <FileCheck2 className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Instructor verification</h2>
            <p className="mt-2 text-zinc-600">
              Status: <span className="font-black">{instructorProfile?.verification_status ?? "not started"}</span>
            </p>
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
      </section>

      {isInstructor ? <InstructorDashboard /> : <LearnerBookingDashboard learnerEmail={profile?.email ?? user.email} learnerPhone={profile?.phone} />}
    </main>
  );
}

function InstructorDashboard() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
      <div className="grid gap-5">
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <BadgeCheck className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Instructor onboarding dashboard</h2>
          <p className="mt-2 max-w-3xl text-zinc-400">Continue verification, upload documents, set price, car, areas covered, and availability. You will not appear in learner search until admin approves your profile.</p>
          <Link href="/instructor" className="lda-pill lda-pill-sm mt-5">
            Open instructor setup <ArrowRight size={16} />
          </Link>
        </article>
        <div className="grid gap-3 md:grid-cols-3">
          {instructorJourneyStages.map((stage) => (
            <article key={stage.title} className="rounded border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
              <h3 className="font-black">{stage.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{stage.detail}</p>
            </article>
          ))}
        </div>
      </div>
      <aside className="rounded border border-zinc-800 bg-ink p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200">
          <BellRing size={16} /> Notifications
        </div>
        <div className="mt-4 grid gap-3">
          {[
            "New paid booking from learner",
            "Learner pickup postcode confirmed",
            "Start en route sharing one second location updates",
            "Lesson completed - payout pending"
          ].map((item) => (
            <div key={item} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-bold leading-6">
              {item}
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
