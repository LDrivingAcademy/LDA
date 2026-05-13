import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpenCheck, CarFront, CheckCircle2, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { completeVerification } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function VerifyAccountPage({
  searchParams
}: {
  searchParams: Promise<{ role?: string; message?: string }>;
}) {
  const { role, message } = await searchParams;
  const isInstructor = role === "instructor";
  const supabase = await createClient();

  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_500px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> Email verified
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Complete instructor verification." : "Complete learner verification."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              {isInstructor
                ? "Your email link is confirmed. Add the details LDA needs before your instructor account can move into admin review."
                : "Your email link is confirmed. Confirm the learner details needed before booking with approved local instructors."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Email session", "Confirmed through Supabase Auth"],
                ["Database record", "Stored against your LDA profile"],
                ["Next step", isInstructor ? "Instructor onboarding" : "Booking dashboard"]
              ].map(([title, body]) => (
                <article key={title} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                  <CheckCircle2 className="text-brand" />
                  <h2 className="mt-3 font-black">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-zinc-400">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                {isInstructor ? <CarFront size={16} /> : <BookOpenCheck size={16} />}
                {isInstructor ? "Instructor details" : "Learner details"}
              </div>
              <h2 className="mt-1 text-2xl font-black">{isInstructor ? "Finish account setup" : "Verify, then start booking"}</h2>
            </div>

            {!hasSupabaseConfig() ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
                Supabase is not configured yet. Add the Supabase URL and publishable key in Vercel before real email-link verification can run.
              </div>
            ) : !user ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
                Your email session is missing or expired. Request a new link from the login page.
              </div>
            ) : (
              <>
                {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{message}</div> : null}
                <form action={completeVerification} className="grid gap-3">
                  <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-400">Full name</span>
                    <input required name="fullName" defaultValue={String(user.user_metadata?.full_name ?? "")} className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Your full name" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-400">Email</span>
                    <input disabled value={user.email ?? ""} className="rounded border border-zinc-800 bg-zinc-900 px-3 py-3 text-zinc-400" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-400">Phone number <span className="font-medium text-zinc-500">(optional)</span></span>
                    <input name="phone" type="tel" autoComplete="tel" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Used for real-time lesson updates" />
                    <span className="text-xs leading-5 text-zinc-500">Add this if you want text updates for lesson changes, cancellations, and instructor arrival alerts. You can continue without it.</span>
                  </label>

                  {isInstructor ? <InstructorFields /> : <LearnerFields />}

                  <label className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-300">
                    <input required name="termsAccepted" type="checkbox" className="mt-1" />
                    <span>I accept the LDA terms, privacy notice, cookie policy, and booking rules. Final solicitor-reviewed wording must be confirmed before live paid bookings.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-300">
                    <input name="marketingOptIn" type="checkbox" className="mt-1" />
                    <span>Email me learner tips, launch offers, free trials, and LDA updates. I can unsubscribe later.</span>
                  </label>

                  <button className="lda-pill mt-2">
                    <BadgeCheck size={18} /> {isInstructor ? "Submit for verification" : "Continue to learner booking"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function LearnerFields() {
  return (
    <>
      <label className="grid gap-1">
        <span className="text-sm font-bold text-zinc-400">Date of birth</span>
        <input required name="dateOfBirth" type="date" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white" />
      </label>
      <label className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-300">
        <input required name="ageConfirmed" type="checkbox" className="mt-1" />
        <span>I confirm I am 17 or over and my date of birth is correct.</span>
      </label>
      <label className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-300">
        <input required name="provisionalLicenceConfirmed" type="checkbox" className="mt-1" />
        <span>I confirm I hold a valid UK provisional licence before booking a paid lesson.</span>
      </label>
    </>
  );
}

function InstructorFields() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">ADI/PDI status</span>
          <select name="adiPdiStatus" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white">
            <option value="ADI">ADI</option>
            <option value="PDI">PDI</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">ADI/PDI number</span>
          <input required name="adiPdiNumber" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Registration number" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">Base postcode</span>
          <input required name="basePostcode" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="EN5 5XY" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">Hourly price</span>
          <input required name="hourlyRate" type="number" min="0" step="1" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="40" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">Car make</span>
          <input name="carMake" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Toyota" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold text-zinc-400">Car model</span>
          <input name="carModel" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Yaris" />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-sm font-bold text-zinc-400">Transmission</span>
        <select name="transmission" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white">
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-bold text-zinc-400">Areas covered</span>
        <input required name="areasCovered" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Barnet, Enfield, Finchley" />
      </label>
    </>
  );
}
