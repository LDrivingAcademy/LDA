import Link from "next/link";
import { ArrowLeft, MessageSquareText, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { verifyPhoneOtp } from "@/app/auth/handoff-actions";

export default async function VerifyPhonePage({
  searchParams
}: {
  searchParams: Promise<{ phone?: string; role?: string; message?: string; name?: string }>;
}) {
  const { phone, role, message, name } = await searchParams;
  const safeRole = role === "instructor" ? "instructor" : "learner";

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href={`/auth/login?role=${safeRole}`} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> LDA phone access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal">Enter the code from your phone.</h1>
            <p className="mt-4 text-lg leading-8 text-zinc-300">
              We sent a one-time LDA code to <span className="font-black text-white">{phone || "your mobile number"}</span>. Enter it here on this device, or open this page on your phone and continue there.
            </p>
            <div className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-400">
              This is the same authentication route for learners and instructors. After the code is confirmed, learners complete booking eligibility checks and instructors continue onboarding.
            </div>
          </div>

          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <MessageSquareText size={16} /> {safeRole === "instructor" ? "Instructor text login" : "Learner text login"}
            </div>
            <h2 className="mt-1 text-2xl font-black">Verify text code</h2>
            {message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{message}</div> : null}
            <form action={verifyPhoneOtp} className="mt-5 grid gap-3">
              <input type="hidden" name="accountIntent" value={safeRole} />
              <input type="hidden" name="phone" value={phone ?? ""} />
              <input type="hidden" name="fullName" value={name ?? ""} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">One-time code</span>
                <input required name="token" inputMode="numeric" autoComplete="one-time-code" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="123456" />
              </label>
              <button className="lda-pill mt-2">
                <ShieldCheck size={18} /> Verify and continue
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
