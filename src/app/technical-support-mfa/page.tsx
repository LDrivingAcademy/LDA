import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KeyRound, LockKeyhole, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { Brand } from "@/components/brand";
import { hasApprovedTechnicalSupportRole } from "@/lib/technical-support-access";
import {
  hasValidTechnicalSupportEntry,
  technicalSupportEntryCookieName
} from "@/lib/technical-support-entry";
import { createClient } from "@/lib/supabase/server";
import { verifyTechnicalSupportMfa } from "./actions";

type MfaFactor = {
  id: string;
  factor_type: string;
  status: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Technical support verification | L Driving Academy",
  robots: { index: false, follow: false, nocache: true }
};

export default async function TechnicalSupportMfaPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const cookieStore = await cookies();

  if (
    !hasValidTechnicalSupportEntry(
      cookieStore.get(technicalSupportEntryCookieName)?.value
    )
  ) {
    redirect("/technical-support-access");
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect("/technical-support-access?message=Technical support authentication is temporarily unavailable.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !(await hasApprovedTechnicalSupportRole(supabase, user))) {
    redirect("/technical-support-access?message=This account is not authorised for technical support.");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect("/technical-support");
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) {
    redirect(`/technical-support-access?message=${encodeURIComponent(factorsError.message)}`);
  }

  const verifiedTotp = ((factors?.totp ?? []) as MfaFactor[]).find(
    (factor) => factor.status === "verified"
  );
  let setupFactorId = "";
  let setupQrCode = "";
  let setupSecret = "";
  let setupUri = "";
  let setupError = "";

  if (!verifiedTotp) {
    const unverifiedFactors = (factors?.all ?? []).filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified"
    );
    for (const factor of unverifiedFactors) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data: enrollment, error: enrollmentError } =
      await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "LDA Technical Support Authenticator"
      });

    if (enrollmentError) {
      setupError = enrollmentError.message;
    } else if (enrollment) {
      setupFactorId = enrollment.id;
      setupQrCode = enrollment.totp.qr_code;
      setupSecret = enrollment.totp.secret;
      setupUri = enrollment.totp.uri;
    }
  }

  const factorId = verifiedTotp?.id || setupFactorId;

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-800 bg-black text-white">
        <div className="lda-universal-topbar-inner mx-auto flex max-w-6xl items-center justify-between px-4">
          <Brand size="home" href="/technical-support-access" label="LDA technical support access" />
          <Link href="/technical-support-access" className="text-sm font-black text-zinc-300 hover:text-white">
            Back to sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> Technical support MFA
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              Confirm it is really you.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              Your password has been accepted. Complete the authenticator check to open
              the technical support workspace.
            </p>
            <div className="mt-6 grid max-w-2xl gap-3">
              <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                <KeyRound className="mt-1 shrink-0 text-brand" size={20} />
                <div>
                  <div className="font-black">Password accepted</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    The first security check is complete.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                <Smartphone className="mt-1 shrink-0 text-brand" size={20} />
                <div>
                  <div className="font-black">Authenticator required</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Enter the current six-digit code from the registered authenticator app.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">
                {verifiedTotp ? "Authenticator check" : "Set up authenticator"}
              </div>
              <h2 className="mt-1 text-2xl font-black">
                {verifiedTotp ? "Enter your 6-digit code" : "Register this support account"}
              </h2>
            </div>
            {message ? (
              <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">
                {message}
              </div>
            ) : null}
            {!verifiedTotp && setupError ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">
                {setupError}
              </div>
            ) : (
              <>
                {!verifiedTotp ? (
                  <div className="mb-4 rounded border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-600">
                      <QrCode size={16} /> Scan code
                    </div>
                    {setupQrCode ? (
                      <img
                        src={setupQrCode}
                        alt={setupUri || "LDA technical support MFA QR code"}
                        className="mx-auto mt-4 size-56 rounded bg-white p-3"
                      />
                    ) : null}
                    {setupSecret ? (
                      <div className="mt-4 rounded border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-black uppercase text-zinc-500">Manual setup key</div>
                        <div className="mt-1 break-all font-mono text-sm font-black">{setupSecret}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <form action={verifyTechnicalSupportMfa} className="grid gap-3">
                  <input type="hidden" name="factorId" value={factorId} />
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Authenticator code</span>
                    <input
                      required
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className="rounded border border-zinc-300 bg-white px-3 py-3 text-center text-2xl font-black tracking-[0.3em] text-black placeholder:text-zinc-500"
                      placeholder="000000"
                    />
                  </label>
                  <button className="lda-pill mt-2">
                    <LockKeyhole size={18} /> Verify and open support
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
