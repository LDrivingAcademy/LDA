import { KeyRound, ShieldCheck } from "lucide-react";
import { signIn } from "@/app/auth/actions";
import { AdminAccessTopBar } from "@/components/admin-access-top-bar";
import { PasswordInput } from "@/components/password-input";

type AdminAccessPanelProps = {
  forgotPasswordHref?: string;
  hasPrivateLauncherEntry: boolean;
  identifier?: string;
  message?: string;
  topBarHref?: string;
};

export function AdminAccessPanel({
  forgotPasswordHref = "/admin-access/forgot-password",
  hasPrivateLauncherEntry,
  identifier = "",
  message,
  topBarHref = "/admin-access"
}: AdminAccessPanelProps) {
  return (
    <main className="min-h-screen bg-white text-black">
      <AdminAccessTopBar href={topBarHref} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA admin access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              Sign in to the admin dashboard.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              This access point is reserved for authorised L Driving Academy admin accounts and provides access to protected admin dashboards after password and authenticator verification.
            </p>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">Admin sign in</div>
              <h2 className="mt-1 text-2xl font-black">Protected access</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            {!hasPrivateLauncherEntry ? (
              <div className="mb-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
                Use your approved admin email, password, and authenticator code. Protected dashboards remain locked until admin verification is complete.
              </div>
            ) : null}
            <form action={signIn} className="grid gap-3" autoComplete="on">
              <input type="hidden" name="accountIntent" value="admin" />
              <input type="hidden" name="next" value="/admin-mfa" />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Email or mobile number</span>
                <input required name="username" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={identifier} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="admin@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Password</span>
                <PasswordInput required name="password" autoComplete="current-password" className="w-full rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Your password" />
              </label>
              <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
                Admin access is never treated as a remembered-device shortcut. You will still need password and authenticator verification for admin sign-in.
              </div>
              <button className="lda-pill mt-2">
                <KeyRound size={18} /> Continue to protected dashboards
              </button>
            </form>
            <a href={forgotPasswordHref} className="mt-4 inline-flex text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4 hover:text-brand">
              Forgot admin password?
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
