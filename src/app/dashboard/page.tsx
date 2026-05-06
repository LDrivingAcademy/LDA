import Link from "next/link";
import { ArrowRight, BadgeCheck, BellRing, CalendarCheck, CarFront, CreditCard, FileCheck2, MapPin, Navigation, Route, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { bookingPipeline, demoInstructors, instructorJourneyStages, learnerJourneyStages, learnerSteps } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return <DashboardMessage title="Connect Supabase to unlock live dashboards" body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel so login can open real user dashboards." />;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <DashboardMessage title="Sign in to continue" body="Learners land on local instructors. Instructors land on onboarding, jobs, notifications, and payouts." />;
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,areas_covered").eq("user_id", user.id).maybeSingle()
  ]);

  const roleLabels = roles?.map((role) => role.role).join(", ") || "learner";
  const isInstructor = roleLabels.includes("instructor");

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-bold text-red-200">LDA dashboard</div>
            <h1 className="text-2xl font-black">{profile?.full_name || user.email}</h1>
          </div>
          <form action={signOut}><button className="rounded bg-white px-3 py-2 text-sm font-black text-ink">Sign out</button></form>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <StatusCard icon={ShieldCheck} title="Account role" body={roleLabels} />
        <StatusCard icon={CalendarCheck} title="Learner flow" body="Preferences, instructor selection, booking, Stripe, confirmation, tracking, review." />
        <StatusCard icon={FileCheck2} title="Instructor verification" body={`Status: ${instructorProfile?.verification_status ?? "not started"}`} />
      </section>

      {isInstructor ? <InstructorDashboard /> : <LearnerDashboard />}
    </main>
  );
}

function LearnerDashboard() {
  const selectedInstructor = demoInstructors[0];

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
      <aside className="rounded border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand"><SlidersHorizontal size={16} /> Preferences</div>
        <div className="mt-5 grid gap-4">
          {[["Pickup postcode", "EN5 5XY"], ["Distance", "Within 5 miles"], ["Transmission", "Automatic preferred"], ["Price selector", "£30-£45 per hour"], ["Availability", "This week"]].map(([label, value]) => (
            <div key={label} className="grid gap-1"><span className="text-xs font-black uppercase text-muted">{label}</span><div className="rounded border border-border bg-background px-3 py-3 text-sm font-bold">{value}</div></div>
          ))}
        </div>
        <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm leading-6 text-brand">Before payment: confirm age 17+, valid provisional licence, pickup postcode, lesson time, cancellation window, and full price.</div>
        <div className="mt-5 rounded border border-border bg-ink p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200"><Route size={16} /> Booking status</div>
          <div className="mt-3 grid gap-2">
            {bookingPipeline.map((step, index) => <div key={step} className="flex items-center gap-3 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${index < 4 ? "bg-brand" : "bg-zinc-700"}`} /><span className={index < 4 ? "font-black text-white" : "font-bold text-zinc-400"}>{step}</span></div>)}
          </div>
        </div>
      </aside>

      <div className="grid gap-5">
        <section className="rounded border border-border bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black">Approved instructors near you</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {learnerSteps.map((step, index) => <div key={step} className="rounded border border-border bg-background p-3"><div className="text-xs font-black text-brand">Step {index + 1}</div><div className="mt-1 text-xs font-bold leading-5">{step}</div></div>)}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          {demoInstructors.map((instructor) => (
            <article key={instructor.name} className="rounded border border-border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><div className="grid h-12 w-12 place-items-center rounded bg-ink text-lg font-black text-white">{instructor.name.slice(0, 1)}</div><h3 className="mt-4 text-xl font-black">{instructor.name}</h3></div><span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span></div>
              <p className="mt-2 text-sm leading-6 text-muted">{instructor.bio}</p>
              <div className="mt-4 grid gap-2 text-sm text-muted"><span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} rating</span><span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span><span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span></div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><div><div className="text-xs font-bold uppercase text-muted">Price</div><div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div></div><button className="rounded bg-ink px-3 py-2 text-sm font-bold text-white">Choose</button></div>
            </article>
          ))}
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand"><CalendarCheck size={16} /> Selected lesson</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <InfoBox label="Instructor" value={selectedInstructor.name} detail={selectedInstructor.car} />
              <InfoBox label="Time and pickup" value={selectedInstructor.next} detail="Barnet EN5 5XY" />
              <InfoBox label="Full upfront price" value={formatMoney(selectedInstructor.price)} detail="No hidden booking fee" />
            </div>
            <button className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white"><CreditCard size={16} /> Pay with Stripe</button>
          </div>
          <div className="rounded border border-border bg-ink p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200"><BellRing size={16} /> Confirmation</div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">After Stripe succeeds, the backend sends the learner a thank-you email and creates an instructor in-app notification.</p>
          </div>
        </section>

        <section className="rounded border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand"><Navigation size={16} /> En route tracking</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{learnerJourneyStages.slice(3).map((stage) => <div key={stage.title} className="rounded border border-border bg-background p-4"><div className="font-black">{stage.title}</div><p className="mt-2 text-sm leading-6 text-muted">{stage.detail}</p></div>)}</div>
        </section>
      </div>
    </section>
  );
}

function InstructorDashboard() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
      <div className="grid gap-5">
        <article className="rounded border border-border bg-white p-5 shadow-sm"><BadgeCheck className="text-brand" /><h2 className="mt-4 text-2xl font-black">Instructor onboarding dashboard</h2><p className="mt-2 max-w-3xl text-muted">Continue verification, upload documents, set price, car, areas covered, and availability. You will not appear in learner search until admin approves your profile.</p><Link href="/instructor" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">Open instructor setup <ArrowRight size={16} /></Link></article>
        <div className="grid gap-3 md:grid-cols-3">{instructorJourneyStages.map((stage) => <article key={stage.title} className="rounded border border-border bg-white p-4 shadow-sm"><h3 className="font-black">{stage.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{stage.detail}</p></article>)}</div>
      </div>
      <aside className="rounded border border-border bg-ink p-5 text-white shadow-sm"><div className="flex items-center gap-2 text-sm font-black uppercase text-red-200"><BellRing size={16} /> Notifications</div><div className="mt-4 grid gap-3">{["New paid booking from learner", "Learner pickup postcode confirmed", "Start en route sharing one second location updates", "Lesson completed - payout pending"].map((item) => <div key={item} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-bold leading-6">{item}</div>)}</div></aside>
    </section>
  );
}

function DashboardMessage({ title, body }: { title: string; body: string }) {
  return <main className="min-h-screen bg-background px-4 py-10"><section className="mx-auto max-w-4xl rounded border border-border bg-white p-6 shadow-sm"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 leading-7 text-muted">{body}</p><Link href="/auth/login?role=learner" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">Open login <ArrowRight size={16} /></Link></section></main>;
}

function StatusCard({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return <article className="rounded border border-border bg-white p-5 shadow-sm"><Icon className="text-brand" /><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 text-muted">{body}</p></article>;
}

function InfoBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded border border-border bg-background p-4"><div className="text-xs font-black uppercase text-muted">{label}</div><div className="mt-2 text-xl font-black">{value}</div><div className="mt-1 text-sm text-muted">{detail}</div></div>;
}
