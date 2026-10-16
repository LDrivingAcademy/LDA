import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BellRing, KeyRound, LockKeyhole, QrCode, ShieldAlert, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import { AdminAccessTopBar } from "@/components/admin-access-top-bar";
import { AdminTopBar } from "@/components/admin-top-bar";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminMfa } from "./actions";

type MfaFactor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
};

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

export default async function AdminMfaPage({
  searchParams
}: {
  searchParams: Promise<{ manage?: string; message?: string; setup?: string }>;
}) {
  const { manage, message, setup } = await searchParams;
  const isManageMode = manage === "1";
  const isAddDirectorSetup = isManageMode && setup === "add";
  const cookieStore = await cookies();

  if (!hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value)) {
    redirect("/admin-access?message=Sign in before completing admin MFA.");
  }

  const supabase = await createClient();

  if (!supabase) {
    return <AdminMfaMessage title="Supabase not configured" body="Add Supabase env vars in Vercel to enable admin MFA." />;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin-access?message=Sign in before completing admin MFA.");
  }

  if (!(await hasApprovedAdminRole(supabase, user))) {
    redirect("/admin-access?message=This account is not authorised for LDA admin access.");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const hasVerifiedAdminMfaSession = aal?.currentLevel === "aal2";
  if (hasVerifiedAdminMfaSession && !isManageMode) {
    redirect("/admin");
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) {
    return <AdminMfaMessage title="MFA could not load" body={factorsError.message} />;
  }

  const verifiedTotpFactors = ((factors?.totp ?? []) as MfaFactor[]).filter((factor) => factor.status === "verified");
  const verifiedTotp = verifiedTotpFactors[0];
  let setupFactorId = "";
  let setupQrCode = "";
  let setupSecret = "";
  let setupUri = "";
  let setupError = "";

  if (!verifiedTotp || isAddDirectorSetup) {
    const unverifiedTotpFactors = (factors?.all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");

    for (const factor of unverifiedTotpFactors) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: isAddDirectorSetup ? `LDA Director Authenticator ${verifiedTotpFactors.length + 1}` : "LDA Admin Authenticator"
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

  if (isManageMode && !hasVerifiedAdminMfaSession) {
    return (
      <main className="min-h-screen bg-white text-black">
        <AdminAccessTopBar />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <ShieldAlert className="text-brand" />
            <h1 className="mt-4 text-3xl font-black">Verify before managing MFA</h1>
            <p className="mt-3 text-base font-semibold leading-7 text-zinc-600">
              Director authenticator management is only available after the current admin session has passed the six-digit authenticator check.
            </p>
            <Link href="/admin-mfa" className="lda-pill lda-pill-sm mt-5">
              Complete MFA check
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (isManageMode) {
    return (
      <main className="min-h-screen bg-white text-black">
        <AdminTopBar />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
            <section>
              <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
                <UsersRound size={16} /> Director authenticator access
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
                Manage director MFA devices.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
                Add authenticator access for approved directors without changing the admin password or weakening the private admin URL gate. This page only opens after the current admin session is already MFA verified.
              </p>
              <div className="mt-6 grid max-w-2xl gap-3">
                <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                  <ShieldCheck className="mt-1 shrink-0 text-emerald-700" size={20} />
                  <div>
                    <div className="font-black">{verifiedTotpFactors.length} verified authenticator {verifiedTotpFactors.length === 1 ? "factor" : "factors"}</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Each verified factor can approve admin login after the password and private URL gate have been passed.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded border border-zinc-200 bg-white p-4">
                  <QrCode className="mt-1 shrink-0 text-brand" size={20} />
                  <div>
                    <div className="font-black">Shared setup option</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      If you want all three directors to see the same six-digit code, generate one setup QR and scan that same QR into each director&apos;s authenticator app before pressing Finish setup.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                  <Smartphone className="mt-1 shrink-0 text-brand" size={20} />
                  <div>
                    <div className="font-black">Separate-device option</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      You can also add separate authenticator factors for each director. Their apps may show different codes, but each code verifies that director&apos;s admin access.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
              <div className="mb-5">
                <div className="text-sm font-black uppercase text-brand">Secure setup link</div>
                <h2 className="mt-1 text-2xl font-black">
                  {isAddDirectorSetup ? "Scan the new director QR" : "Add another authenticator"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {isAddDirectorSetup
                    ? "Scan this QR into the director authenticator app, then enter the six-digit code to activate it."
                    : "Use this only while the director is present and ready to scan the QR code. The QR setup is protected behind the current verified admin session."}
                </p>
              </div>
              {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
              {!isAddDirectorSetup ? (
                <Link href="/admin-mfa?manage=1&setup=add" className="lda-pill">
                  <QrCode size={18} /> Create director setup QR
                </Link>
              ) : setupError ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{setupError}</div>
              ) : (
                <>
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-600">
                      <QrCode size={16} /> Scan code
                    </div>
                    {setupQrCode ? (
                      <img src={setupQrCode} alt={setupUri || "LDA director MFA QR code"} className="mx-auto mt-4 size-56 rounded bg-white p-3" />
                    ) : null}
                    {setupSecret ? (
                      <div className="mt-4 rounded border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-black uppercase text-zinc-500">Manual setup key</div>
                        <div className="mt-1 break-all font-mono text-sm font-black">{setupSecret}</div>
                      </div>
                    ) : null}
                  </div>
                  <form action={verifyAdminMfa} className="mt-4 grid gap-3">
                    <input type="hidden" name="factorId" value={setupFactorId} />
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
                      <LockKeyhole size={18} /> Finish director setup
                    </button>
                  </form>
                </>
              )}
              <Link href="/admin" className="mt-5 inline-flex text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4">
                Back to admin dashboard
              </Link>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <AdminAccessTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> Admin MFA
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              Confirm it is really you.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              LDA admin access requires your password and a second approved verification step before the dashboard can open.
            </p>
            <div className="mt-6 grid max-w-2xl gap-3">
              <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                <KeyRound className="mt-1 shrink-0 text-brand" size={20} />
                <div>
                  <div className="font-black">Step one complete</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">Your admin password has been accepted.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                <Smartphone className="mt-1 shrink-0 text-brand" size={20} />
                <div>
                  <div className="font-black">Step two required</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">Use Microsoft Authenticator, Google Authenticator, 1Password, iCloud Passwords, or another app that supports 6-digit TOTP codes.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded border border-zinc-200 bg-white p-4">
                <BellRing className="mt-1 shrink-0 text-zinc-500" size={20} />
                <div>
                  <div className="font-black">Number matching approval</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    Authenticator push approval with number matching requires Microsoft Entra admin sign-in. Until that identity-provider integration is connected, use the 6-digit authenticator code below.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {verifiedTotp ? (
            <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
              <div className="mb-5">
                <div className="text-sm font-black uppercase text-brand">Authenticator check</div>
                <h2 className="mt-1 text-2xl font-black">Enter your 6-digit code</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Open your registered authenticator app and enter the current LDA admin code.
                </p>
              </div>
              {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
              <form action={verifyAdminMfa} className="grid gap-3">
                <input type="hidden" name="factorId" value={verifiedTotp.id} />
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
                  <LockKeyhole size={18} /> Verify and open admin
                </button>
              </form>
            </section>
          ) : (
            <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
              <div className="mb-5">
                <div className="text-sm font-black uppercase text-brand">Set up authenticator</div>
                <h2 className="mt-1 text-2xl font-black">Register this admin account</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Scan the QR code once, then enter the 6-digit code your app generates.
                </p>
              </div>
              {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
              {setupError ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{setupError}</div>
              ) : (
                <>
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-600">
                      <QrCode size={16} /> Scan code
                    </div>
                    {setupQrCode ? (
                      <img src={setupQrCode} alt={setupUri || "LDA admin MFA QR code"} className="mx-auto mt-4 size-56 rounded bg-white p-3" />
                    ) : null}
                    {setupSecret ? (
                      <div className="mt-4 rounded border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-black uppercase text-zinc-500">Manual setup key</div>
                        <div className="mt-1 break-all font-mono text-sm font-black">{setupSecret}</div>
                      </div>
                    ) : null}
                  </div>
                  <form action={verifyAdminMfa} className="mt-4 grid gap-3">
                    <input type="hidden" name="factorId" value={setupFactorId} />
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
                      <LockKeyhole size={18} /> Finish setup
                    </button>
                  </form>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function AdminMfaMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-white text-black">
      <AdminAccessTopBar />
      <section className="mx-auto mt-10 max-w-3xl rounded border border-zinc-200 bg-white p-6 shadow-sm">
        <ShieldAlert className="text-brand" />
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <p className="mt-3 leading-7 text-zinc-600">{body}</p>
        <Link href="/admin-access" className="lda-pill lda-pill-sm mt-5">Go to admin login</Link>
      </section>
    </main>
  );
}
