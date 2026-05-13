import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, BellRing, CalendarCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { LearnerBookingDashboard } from "@/components/learner-booking-dashboard";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { instructorJourneyStages } from "@/lib/marketplace-content";

export default async function DashboardPage() {
  const demoRole = (await cookies()).get("lda_demo_role")?.value;

  if (demoRole) {
    const isInstructorDemo = demoRole === "instructor";

    return (
      <main className="min-h-screen bg-black">
        <header className="border-b border-zinc-800 bg-ink text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <div className="text-sm font-bold text-red-200">LDA demo dashboard</div>
              <h1 className="text-2xl font-black">{isInstructorDemo ? "Demo Instructor" : "Demo Learner"}</h1>
            </div>
            <form action={signOut}>
              <button className="lda-pill lda-pill-sm">Exit demo</button>
            </form>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Account role</h2>
            <p className="mt-2 text-zinc-400">{demoRole}</p>
          </article>
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <CalendarCheck className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Demo mode</h2>
            <p className="mt-2 text-zinc-400">Use this to test navigation and journey flow before real accounts are configured.</p>
          </article>
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <FileCheck2 className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Verification</h2>
            <p className="mt-2 text-zinc-400">Status: <span className="font-black">{isInstructorDemo ? "pending demo approval" : "learner demo"}</span></p>
          </article>
        </section>

        {isInstructorDemo ? <InstructorDashboard /> : <LearnerBookingDashboard learnerEmail="learner@ldrivingacademy.co.uk" />}
      </main>
    );
  }

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
    return (
      <main className="min-h-screen bg-black px-4 py-10">
        <section className="mx-auto max-w-4xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <h1 className="text-3xl font-black">Sign in to search approved local instructors</h1>
          <p className="mt-3 leading-7 text-zinc-400">Your next page is the learner search dashboard: local instructors, filters, price selector, availability, and booking checks.</p>
          <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm mt-5">
            Continue as learner <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }, { data: learnerProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,areas_covered").eq("user_id", user.id).maybeSingle(),
    supabase.from("learner_profiles").select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at").eq("user_id", user.id).maybeSingle()
  ]);

  const roleLabels = roles?.map((role) => role.role).join(", ") || "learner";
  const isInstructor = roleLabels.includes("instructor");

  if (!isInstructor && !hasCompletedLearnerEligibility(learnerProfile)) {
    redirect("/auth/verify?role=learner&message=Complete learner eligibility before booking. Your date of birth must show you are 17 or over, and you must accept the terms and provisional licence checks.");
  }

  return (
    <main className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-bold text-red-200">LDA dashboard</div>
            <h1 className="text-2xl font-black">{profile?.full_name || user.email}</h1>
          </div>
          <form action={signOut}>
            <button className="lda-pill lda-pill-sm">Sign out</button>
          </form>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <ShieldCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Account role</h2>
          <p className="mt-2 text-zinc-400">{roleLabels}</p>
        </article>
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <CalendarCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Learner journey</h2>
          <p className="mt-2 text-zinc-400">Local instructors, price selector, eligibility checks, booking, payment, and reviews.</p>
        </article>
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <FileCheck2 className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Instructor verification</h2>
          <p className="mt-2 text-zinc-400">
            Status: <span className="font-black">{instructorProfile?.verification_status ?? "not started"}</span>
          </p>
        </article>
      </section>

      {isInstructor ? <InstructorDashboard /> : <LearnerBookingDashboard learnerEmail={profile?.email ?? user.email} />}
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
