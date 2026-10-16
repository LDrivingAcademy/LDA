import Link from "next/link";
import { BarChart3, Cookie, Megaphone, ShieldCheck } from "lucide-react";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
import { TechnicalSupportPageHeader } from "@/components/technical-support-page-header";
import { TechnicalSupportTopBar } from "@/components/technical-support-top-bar";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function CookieConsentOperationsPage() {
  const { supabase, accessRole } = await requireTechnicalSupportClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [allResult, recentResult, analyticsResult, advertisingResult, essentialOnlyResult] = await Promise.all([
    supabase.from("cookie_consent_events").select("id", { count: "exact", head: true }),
    supabase.from("cookie_consent_events").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabase.from("cookie_consent_events").select("id", { count: "exact", head: true }).eq("analytics_enabled", true),
    supabase.from("cookie_consent_events").select("id", { count: "exact", head: true }).eq("targeted_advertising_enabled", true),
    supabase
      .from("cookie_consent_events")
      .select("id", { count: "exact", head: true })
      .eq("analytics_enabled", false)
      .eq("targeted_advertising_enabled", false)
  ]);

  const metrics = [
    {
      label: "Choices recorded",
      value: allResult.count ?? 0,
      detail: `${recentResult.count ?? 0} recorded in the last 30 days`,
      icon: Cookie
    },
    {
      label: "Analytics enabled",
      value: analyticsResult.count ?? 0,
      detail: "Allows anonymous page, click, and engagement reporting",
      icon: BarChart3
    },
    {
      label: "Advertising enabled",
      value: advertisingResult.count ?? 0,
      detail: "Allows campaign measurement and future approved advertising tools",
      icon: Megaphone
    },
    {
      label: "Essential only",
      value: essentialOnlyResult.count ?? 0,
      detail: "Optional analytics and advertising remain disabled",
      icon: ShieldCheck
    }
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminAutoRefresh />
      <TechnicalSupportTopBar canAccessAdmin={accessRole === "admin"} />

      <TechnicalSupportPageHeader
        eyebrow="Privacy operations"
        title="Cookie consent"
        description="Anonymous totals for cookie choices. This view does not display names, email addresses, raw IP addresses, or individual browser identifiers."
        showAdminBack={accessRole === "admin"}
        right={(
          <Link href="/technical-support" className="inline-flex justify-center rounded border border-zinc-700 px-4 py-3 text-sm font-black text-white hover:border-red-500">
            Back to TOC
          </Link>
        )}
      />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <Icon size={22} className="text-brand" />
              <h2 className="mt-4 text-sm font-black uppercase text-zinc-400">{metric.label}</h2>
              <div className="mt-2 text-4xl font-black">{metric.value}</div>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">{metric.detail}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
