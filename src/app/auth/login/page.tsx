import Link from "next/link";
import { ArrowLeft, CarFront, GraduationCap, MailCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { demoSignIn } from "../actions";
import { sendMagicLink, sendPhoneOtp } from "../handoff-actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";
  const nextPath = "/dashboard";

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to homepage
          </Link>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> LDA secure access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor
                ? "Sign in to continue instructor onboarding."
                : "Sign in to find local instructors and book lessons."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              {isInstructor
                ? "Instructor accounts move through verification, profile setup, availability, and admin approval before appearing in learner search."
                : "Learners go from login to local approved instructors, then compare distance, price, rating, car, availability, and cancellation terms before payment."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/auth/login?role=learner" className={`rounded border p-4 ${!isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <GraduationCap className="mb-3 text-brand" />
                <div className="font-black">Learner</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Search, compare, book, pay, and review.</p>
              </Link>
              <Link href="/auth/login?role=instructor" className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <CarFront className="mb-3 text-brand" />
                <div className="font-black">Instructor</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Verify, publish availability, manage bookings.</p>
              </Link>
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor access" : "Learner access"}</div>
              <h2 className="mt-1 text-2xl font-black">Email link login</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{message}</div> : null}
            <form action={sendMagicLink} className="grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="next" value={nextPath} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Full name</span>
                <input name="fullName" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Your name" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Email</span>
                <input required name="email" type="email" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <button className="lda-pill mt-2">
                <MailCheck size={18} /> Send secure email link
              </button>
            </form>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              No password is needed. Click the link in your email to return to LDA, complete verification, and continue into booking or instructor onboarding.
            </p>
            <div className="mt-5 border-t border-zinc-800 pt-5">
              <div className="mb-3">
                <div className="text-sm font-black uppercase text-brand">No email access?</div>
                <h3 className="mt-1 text-xl font-black">Use a text-message code</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  We can send a one-time code to your mobile number. On iPhone it arrives in Messages, and on Android it arrives in your normal SMS app.
                </p>
              </div>
              <form action={sendPhoneOtp} className="grid gap-3">
                <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                <input type="hidden" name="next" value={nextPath} />
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">Full name</span>
                  <input name="fullName" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Your name" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">Mobile number</span>
                  <input required name="phone" type="tel" autoComplete="tel" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="07123 456789" />
                </label>
                <button className="lda-pill mt-2">
                  <MessageSquareText size={18} /> Send text code
                </button>
              </form>
            </div>
            <div className="mt-5 border-t border-zinc-800 pt-5">
              <div className="text-sm font-black uppercase text-brand">Test logins</div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Use these visible demo credentials while you are shaping the learner and instructor pages. The quick buttons below open the demo dashboards without needing Supabase users.</p>
              <div className="mt-3 grid gap-2 rounded bg-black p-3 text-xs font-bold leading-5 text-zinc-300">
                <div><span className="text-white">Learner:</span> learner@ldrivingacademy.co.uk / LDAlearner123!</div>
                <div><span className="text-white">Instructor:</span> instructor@ldrivingacademy.co.uk / LDAinstructor123!</div>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  ["learner", "Demo learner"],
                  ["instructor", "Demo instructor"]
                ].map(([roleValue, label]) => (
                  <form key={roleValue} action={demoSignIn}>
                    <input type="hidden" name="demoRole" value={roleValue} />
                    <button className="lda-pill lda-pill-sm lda-pill-wide">
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
