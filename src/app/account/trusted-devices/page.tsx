import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ArrowLeft, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { revokeTrustedDevice } from "@/app/account/trusted-devices/actions";
import { Brand } from "@/components/brand";
import { getTrustedDeviceSessions, syncCurrentRememberedDeviceSession } from "@/lib/auth-sessions";
import { requireSignedInPage } from "@/lib/page-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Trusted Devices | L Driving Academy",
  description: "View and revoke remembered LDA account devices.",
  robots: {
    index: false,
    follow: false
  }
};

type TrustedDevicesPageProps = {
  searchParams?: Promise<{ message?: string }>;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default async function TrustedDevicesPage({ searchParams }: TrustedDevicesPageProps) {
  const params = await searchParams;
  const { user, roleState } = await requireSignedInPage("Sign in before managing trusted devices.");
  const isMarketplaceAccount = roleState.isLearner || roleState.isInstructor;
  const isPrivilegedAccount = roleState.isAdmin || roleState.isSupport;
  const isInstructorAccount = roleState.effectiveRole === "instructor";
  const roleLabel = isInstructorAccount ? "instructor" : "learner";

  if (!isMarketplaceAccount || isPrivilegedAccount) {
    return (
      <main className="min-h-screen bg-white text-black">
        <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
          <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
            <div className="flex min-w-0 items-center gap-5">
              <Brand size="home" href="/account" label="LDA account centre" />
              <div className="min-w-0">
                <div className="text-sm font-black uppercase text-red-200">Account Centre</div>
                <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">Trusted devices</h1>
              </div>
            </div>
            <Link href="/account" className="inline-flex items-center gap-2 text-sm font-black text-white">
              <ArrowLeft size={16} /> Back to account
            </Link>
          </div>
        </header>
        <section className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded border border-red-200 bg-red-50 p-5 text-red-950">
            <div className="flex items-center gap-2 text-sm font-black uppercase">
              <ShieldCheck size={17} /> Restricted security area
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-normal">Trusted devices are not available for this account.</h1>
            <p className="mt-2 text-sm font-semibold leading-6">
              Admin and technical support sessions always close with the browser and must fully re-authenticate on the next visit.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const adminClient = createAdminClient();
  const cookieStore = await cookies();
  let deviceLoadWarning = "";
  let devices: Awaited<ReturnType<typeof getTrustedDeviceSessions>> = [];

  try {
    await syncCurrentRememberedDeviceSession({
      adminClient,
      cookieStore,
      headers: await headers(),
      userId: user.id,
      writeCookies: false
    });
    devices = await getTrustedDeviceSessions({
      adminClient,
      cookieStore,
      userId: user.id
    });
  } catch (error) {
    console.warn("[trusted-devices] page load failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error)
    });
    deviceLoadWarning = "Trusted devices are temporarily unavailable. Your account is still protected, and LDA has logged this for review.";
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" href="/account" label="LDA account centre" />
            <div className="min-w-0">
              <div className="text-sm font-black uppercase text-red-200">Account Centre</div>
              <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">Trusted devices</h1>
            </div>
          </div>
          <Link href="/account" className="inline-flex items-center gap-2 text-sm font-black text-white">
            <ArrowLeft size={16} /> Back to account
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
          <ShieldCheck size={16} /> Account security
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-normal">Trusted devices</h1>
        <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-zinc-700">
          Devices shown here were remembered for your {roleLabel} account access. Revoke anything you do not recognise. Passwords are never shown or stored here.
        </p>

        {params?.message ? (
          <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-950">
            {params.message}
          </div>
        ) : null}
        {deviceLoadWarning ? (
          <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm font-black leading-6 text-red-950">
            {deviceLoadWarning}
          </div>
        ) : null}

        <div className="mt-7 grid gap-4">
          {devices.length === 0 ? (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-5">
              <MonitorSmartphone className="text-brand" />
              <h2 className="mt-3 text-2xl font-black">No trusted devices yet</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                Tick Remember Me the next time you log in to your {roleLabel} account to create a trusted device session.
              </p>
            </div>
          ) : null}

          {devices.map((device) => (
            <article key={device.id} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MonitorSmartphone className="text-brand" size={20} />
                    <h2 className="text-xl font-black">{device.deviceLabel} - {device.browserName}</h2>
                    {device.isCurrent ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-950">
                        Current device
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-1 text-sm font-semibold leading-6 text-zinc-700">
                    <span>Last seen: {formatDate(device.lastSeenAt)}</span>
                    <span>First trusted: {formatDate(device.createdAt)}</span>
                    <span>Expires: {formatDate(device.expiresAt)}</span>
                    <span>Approximate location: {device.approximateLocation}</span>
                    <span>IP address: {device.ipAddress || "Unavailable"}</span>
                  </div>
                </div>
                <form action={revokeTrustedDevice}>
                  <input type="hidden" name="sessionId" value={device.id} />
                  <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-950 hover:bg-red-100">
                    <Trash2 size={16} /> Revoke
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
