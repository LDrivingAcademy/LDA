import { MailCheck } from "lucide-react";
import { AuthHandoffPoller } from "@/components/auth/auth-handoff-poller";
import { PageTopBar } from "@/components/page-top-bar";

export default async function CheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; role?: string; request?: string }>;
}) {
  const { email, role, request } = await searchParams;
  const safeRole = role === "instructor" ? "instructor" : "learner";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={`/auth/login?role=${safeRole}`} backLabel="Back to login" />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <section className="mt-10 rounded border border-zinc-200 bg-white p-6 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <MailCheck size={16} /> Secure email link sent
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal">Check your email to continue.</h1>
          <p className="mt-4 text-lg leading-8 text-zinc-700">
            We sent a secure LDA sign-in link to <span className="font-black text-black">{email || "your email address"}</span>. Click that link and you will come back here to complete {safeRole === "instructor" ? "instructor verification" : "learner verification"}.
          </p>
          <div className="mt-6 rounded border border-zinc-300 bg-white p-4 text-sm leading-6 text-zinc-600">
            {request
              ? "The link can be opened on your phone, laptop, or tablet. The device that opens the email will continue, and this original tab will also continue automatically once approval is complete."
              : "Open the email on this device or another device, then continue to the secure LDA verification page from that link."}
          </div>
          {request ? <AuthHandoffPoller requestId={request} role={safeRole} /> : null}
        </section>
      </div>
    </main>
  );
}
