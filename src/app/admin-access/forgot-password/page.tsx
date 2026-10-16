import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { AdminAccessTopBar } from "@/components/admin-access-top-bar";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default async function AdminForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; email?: string }>;
}) {
  const { message, email } = await searchParams;

  return (
    <main className="min-h-screen bg-white text-black">
      <AdminAccessTopBar />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> Admin recovery
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              Reset an admin password securely.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              A reset link is sent only for allowlisted LDA admin emails, and dashboard access still requires
              password, admin role, and authenticator verification.
            </p>
            <div className="mt-6 grid max-w-2xl gap-3">
              <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <div className="font-black">No account details are revealed</div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  The page uses a generic response so unauthorised users cannot confirm which emails are admin accounts.
                </p>
              </div>
              <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <div className="font-black">Authenticator still required</div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Changing the password does not bypass MFA or the protected admin session checks.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                <KeyRound size={16} /> Password recovery
              </div>
              <h2 className="mt-1 text-2xl font-black">Send secure reset link</h2>
            </div>
            {message ? (
              <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold leading-6 text-brand">
                <MailCheck className="mr-1 inline-block" size={16} /> {message}
              </div>
            ) : null}
            <form action="/api/auth/password-reset" method="post" className="grid gap-3" autoComplete="on">
              <input type="hidden" name="accountIntent" value="admin" />
              <input type="hidden" name="returnTo" value="/admin-access/forgot-password" />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Admin email</span>
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  defaultValue={email ?? ""}
                  className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600"
                  placeholder="admin@example.com"
                />
              </label>
              <button className="lda-pill mt-2">
                <MailCheck size={18} /> Send admin reset email
              </button>
            </form>
            <Link href="/admin-access" className="mt-4 inline-flex text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4 hover:text-brand">
              Back to admin sign in
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
