import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, BadgeCheck, BellRing, CalendarCheck, CarFront, CreditCard, FileCheck2, MapPin, Navigation, Route, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { bookingPipeline, demoInstructors, instructorJourneyStages, learnerJourneyStages, learnerSteps } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

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
              <button className="rounded bg-zinc-950 px-3 py-2 text-sm font-black text-white">Exit demo</button>
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

        {isInstructorDemo ? <InstructorDashboard /> : <LearnerSearchDashboard />}
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
          <Link href="/auth/login?role=learner" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">
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
          <Link href="/auth/login?role=learner" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">
            Continue as learner <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,areas_covered").eq("user_id", user.id).maybeSingle()
  ]);

  const roleLabels = roles?.map((role) => role.role).join(", ") || "learner";
  const isInstructor = roleLabels.includes("instructor");

  return (
    <main className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-bold text-red-200">LDA dashboard</div>
            <h1 className="text-2xl font-black">{profile?.full_name || user.email}</h1>
          </div>
          <form action={signOut}>
            <button className="rounded bg-zinc-950 px-3 py-2 text-sm font-black text-white">Sign out</button>
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

      {isInstructor ? <InstructorDashboard /> : <LearnerSearchDashboard />}
    </main>
  );
}

function LearnerSearchDashboard() {
  const selectedInstructor = demoInstructors[0];

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
      <aside className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <SlidersHorizontal size={16} /> Search filters
        </div>
        <div className="mt-5 grid gap-4">
          {[
            ["Pickup postcode", "EN5 5XY"],
            ["Distance", "Within 5 miles"],
            ["Transmission", "Automatic preferred"],
            ["Price selector", "£30-£45 per hour"],
            ["Availability", "This week"]
          ].map(([label, value]) => (
            <label key={label} className="grid gap-1">
              <span className="text-xs font-black uppercase text-zinc-400">{label}</span>
              <div className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold">{value}</div>
            </label>
          ))}
        </div>
        <div className="mt-5 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-brand">
          Before payment: confirm age 17+, valid provisional licence, pickup postcode, lesson time, cancellation window, and full price.
        </div>
        <div className="mt-5 rounded border border-zinc-800 bg-ink p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200">
            <Route size={16} /> Booking status
          </div>
          <div className="mt-3 grid gap-2">
            {bookingPipeline.map((step, index) => (
              <div key={step} className="flex items-center gap-3 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${index < 4 ? "bg-brand" : "bg-zinc-700"}`} />
                <span className={index < 4 ? "font-black text-white" : "font-bold text-zinc-400"}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="grid gap-5">
        <div className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <h2 className="text-2xl font-black">Approved instructors near you</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">The learner lands here after login: preference selector first, then instructor choice, then slot, payment, confirmation, tracking, completion.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {learnerSteps.map((step, index) => (
              <div key={step} className="rounded border border-zinc-800 bg-black p-3">
                <div className="text-xs font-black text-brand">Step {index + 1}</div>
                <div className="mt-1 text-xs font-bold leading-5">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {demoInstructors.map((instructor) => (
            <article key={instructor.name} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded bg-ink text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                  <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                </div>
                <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{instructor.bio}</p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-400">
                <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} rating</span>
                <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span>
                <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
                <div>
                  <div className="text-xs font-bold uppercase text-zinc-400">Price</div>
                  <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                </div>
                <button className="rounded bg-ink px-3 py-2 text-sm font-bold text-white">Choose</button>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <CalendarCheck size={16} /> Selected lesson
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded border border-zinc-800 bg-black p-4">
                <div className="text-xs font-black uppercase text-zinc-400">Instructor</div>
                <div className="mt-2 text-xl font-black">{selectedInstructor.name}</div>
                <div className="mt-1 text-sm text-zinc-400">{selectedInstructor.car}</div>
              </div>
              <div className="rounded border border-zinc-800 bg-black p-4">
                <div className="text-xs font-black uppercase text-zinc-400">Time and pickup</div>
                <div className="mt-2 text-xl font-black">{selectedInstructor.next}</div>
                <div className="mt-1 text-sm text-zinc-400">Barnet EN5 5XY</div>
              </div>
              <div className="rounded border border-zinc-800 bg-black p-4">
                <div className="text-xs font-black uppercase text-zinc-400">Full upfront price</div>
                <div className="mt-2 text-xl font-black">{formatMoney(selectedInstructor.price)}</div>
                <div className="mt-1 text-sm text-zinc-400">No hidden booking fee</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">
                <CreditCard size={16} /> Pay with Stripe
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded border border-zinc-800 bg-black px-4 py-3 text-sm font-black">
                Apply promo code
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded border border-zinc-800 bg-black px-4 py-3 text-sm font-black">
                Reschedule
              </button>
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-ink p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200">
              <BellRing size={16} /> Confirmation
            </div>
            <h3 className="mt-3 text-2xl font-black">Email and app notifications</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              After Stripe checkout succeeds, the backend sends the learner a thank-you email with the instructor name and creates an instructor notification in-app.
            </p>
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6">
              Thank you for booking {selectedInstructor.name}. Your lesson is confirmed once payment succeeds.
            </div>
          </section>
        </div>

        <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Navigation size={16} /> En route tracking
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {learnerJourneyStages.slice(3).map((stage) => (
              <div key={stage.title} className="rounded border border-zinc-800 bg-black p-4">
                <div className="font-black">{stage.title}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{stage.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
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
          <Link href="/instructor" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">
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
