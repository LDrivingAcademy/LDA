import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAreaLinks } from "@/components/admin-area-links";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { PlatformProtectionPanel } from "@/components/platform-protection-panel";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

export default async function OwnerDashboardPage() {
  const cookieStore = await cookies();
  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const privilegedSessionRole = getValidPrivilegedSessionRole(cookieStore.get(privilegedSessionCookieName)?.value);

  if (!hasAdminEntry && privilegedSessionRole !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  if (!supabase) {
    redirect(hasAdminEntry ? "/admin-access?message=Supabase is required before owner analytics can open." : "/");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(hasAdminEntry ? "/admin-access?message=Sign in before opening owner analytics." : "/");
  }

  if (!(await hasApprovedAdminRole(supabase, user))) {
    redirect(hasAdminEntry ? "/admin-access?message=This account is not authorised for LDA admin access." : "/");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    redirect("/admin-mfa");
  }

  const activeSession = await requireActiveLdaAuthSession({
    adminClient: createAdminClient(),
    cookieStore,
    headers: await headers(),
    userId: user.id,
    role: "admin",
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(hasAdminEntry
      ? "/admin-access?message=Admin access expired. Sign in again and complete authenticator verification."
      : "/");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Owner analytics"
        title="Live LDA dashboard for colleagues."
        description="This view uses the same protected admin entry, signed-in admin role, and authenticator check as the main admin dashboard. Headline KPI cards are hidden until the production analytics pipeline is fully trusted."
      />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section>
          <AdminAreaLinks compact />
        </section>

        <section className="mt-6">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">What colleagues can review</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-300 sm:grid-cols-2">
              {[
                "Monthly and calendar-year platform revenue",
                "Year-to-date revenue and gross lesson value",
                "Drivers and learners on the platform",
                "Booking volume, conversion, cancellation, refund, and dispute indicators",
                "Instructor ratings and review quality",
                "Payout setup and live payment status once payments are configured"
              ].map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-black p-4">{item}</div>
              ))}
            </div>
            <Link href="/admin" className="lda-pill lda-pill-sm mt-5">
              Open protected admin route
            </Link>
          </article>
        </section>
        <section className="mt-6">
          <PlatformProtectionPanel audience="owner" />
        </section>
      </section>
    </main>
  );
}
