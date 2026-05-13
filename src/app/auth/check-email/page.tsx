import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthHandoffPoller } from "@/components/auth/auth-handoff-poller";
import { Brand } from "@/components/brand";

export default async function CheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; role?: string; request?: string }>;
}) {
  const { email, role, request } = await searchParams;
  const safeRole = role === "instructor" ? "instructor" : "learner";

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href={`/auth/login?role=${safeRole}`} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>

        <section className="mt-10 rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
            <MailCheck size={16} /> Secure email link sent
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal">Check your email to continue.</h1>
          <p className="mt-4 text-lg leading-8 text-zinc-300">
            We sent a secure LDA sign-in link to <span className="font-black text-white">{email || "your email address"}</span>. Click that link and you will come back here to complete {safeRole === "instructor" ? "instructor verification" : "learner verification"}.
          </p>
          <div className="mt-6 rounded border border-zinc-800 bg-black p-4 text-sm leading-6 text-zinc-400">
            The link can be opened on your phone, laptop, or tablet. The device that opens the email will continue, and this original tab will also continue automatically once approval is complete.
          </div>
          <AuthHandoffPoller requestId={request} role={safeRole} />
        </section>
      </div>
    </main>
  );
}
