import { BarChart3, Clock3, MousePointerClick, TrendingUp, UserPlus, UsersRound, type LucideIcon } from "lucide-react";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type AnalyticsEventRow = {
  event_type: "pageview" | "click" | "engagement";
  visitor_id: string;
  visitor_ip_hash: string | null;
  session_id: string;
  path: string;
  section: string | null;
  title: string | null;
  target_label: string | null;
  target_type: string | null;
  target_href: string | null;
  duration_ms: number | null;
  created_at: string;
};

type AnalyticsVisitorRow = {
  visitor_ip_hash: string;
  first_seen_at: string;
  last_seen_at: string;
  first_path: string | null;
  last_path: string | null;
};

type ProfileCreatedRow = {
  created_at: string;
};

const londonDayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/London",
  year: "numeric"
});

const shortDayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/London"
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "Europe/London",
  year: "numeric"
});

function formatDuration(ms: number) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function titleForPath(path: string) {
  if (path === "/") return "Home";
  return path
    .split("/")
    .filter(Boolean)
    .join(" / ")
    .replaceAll("-", " ");
}

function increment(map: Map<string, number>, key: string, value = 1) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function topEntries(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function dayKey(value: Date | string) {
  return londonDayFormatter.format(new Date(value));
}

function monthKey(value: Date | string) {
  return monthFormatter.format(new Date(value));
}

function createDayBuckets(days = 30) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return {
      key: dayKey(date),
      label: shortDayFormatter.format(date),
      value: 0
    };
  });
}

function createMonthBuckets(months = 6) {
  const today = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - index - 1), 1);
    return {
      key: monthKey(date),
      label: monthFormatter.format(date),
      value: 0
    };
  });
}

function dailyTrend<T>(rows: T[], getDate: (row: T) => string, days = 30) {
  const buckets = createDayBuckets(days);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const bucket = bucketMap.get(dayKey(getDate(row)));
    if (bucket) {
      bucket.value += 1;
    }
  }

  return buckets;
}

function monthlyTrend<T>(rows: T[], getDate: (row: T) => string, months = 6) {
  const buckets = createMonthBuckets(months);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const row of rows) {
    const bucket = bucketMap.get(monthKey(getDate(row)));
    if (bucket) {
      bucket.value += 1;
    }
  }

  return buckets;
}

function trendForKey(rows: AnalyticsEventRow[], key: string, getKey: (row: AnalyticsEventRow) => string) {
  return dailyTrend(rows.filter((row) => getKey(row) === key), (row) => row.created_at);
}

export default async function AdminAnalyticsPage() {
  const { supabase } = await requireAdminDashboardClient();
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since = sinceDate.toISOString();
  const todayKey = dayKey(new Date());

  const [eventsResult, visitorsResult, profilesResult] = await Promise.all([
    supabase
      .from("site_analytics_events")
      .select("event_type,visitor_id,visitor_ip_hash,session_id,path,section,title,target_label,target_type,target_href,duration_ms,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("site_analytics_visitors")
      .select("visitor_ip_hash,first_seen_at,last_seen_at,first_path,last_path")
      .gte("first_seen_at", since)
      .order("first_seen_at", { ascending: false })
      .limit(10000),
    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000)
  ]);

  const rows = ((eventsResult.data as AnalyticsEventRow[] | null) ?? []).filter((row) => !row.path.startsWith("/admin"));
  const ipVisitors = ((visitorsResult.data as AnalyticsVisitorRow[] | null) ?? []).filter((visitor) => {
    const path = visitor.first_path || visitor.last_path || "";
    return !path.startsWith("/admin");
  });
  const profileRows = (profilesResult.data as ProfileCreatedRow[] | null) ?? [];
  const pageviews = rows.filter((row) => row.event_type === "pageview");
  const clicks = rows.filter((row) => row.event_type === "click");
  const engagements = rows.filter((row) => row.event_type === "engagement");
  const uniqueVisitorCount = visitorsResult.error ? 0 : ipVisitors.length;
  const newVisitorsToday = visitorsResult.error
    ? 0
    : ipVisitors.filter((visitor) => dayKey(visitor.first_seen_at) === todayKey).length;
  const newAccountsToday = profileRows.filter((profile) => dayKey(profile.created_at) === todayKey).length;
  const sessionIds = new Set(pageviews.map((row) => row.session_id));
  const engagedSessionIds = new Set(engagements.filter((row) => (row.duration_ms ?? 0) >= 10000).map((row) => row.session_id));
  const multiPageSessions = new Set(
    Array.from(
      pageviews.reduce((map, row) => {
        increment(map, row.session_id);
        return map;
      }, new Map<string, number>())
    ).filter(([, count]) => count > 1).map(([sessionId]) => sessionId)
  );
  const stayedSessions = new Set([...engagedSessionIds, ...multiPageSessions]);
  const totalEngagementMs = engagements.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);
  const averageEngagementMs = engagements.length ? Math.round(totalEngagementMs / engagements.length) : 0;
  const stayRate = sessionIds.size ? `${((stayedSessions.size / sessionIds.size) * 100).toFixed(1)}%` : "0.0%";
  const pathCounts = new Map<string, number>();
  const sectionCounts = new Map<string, number>();
  const clickCounts = new Map<string, number>();

  for (const pageview of pageviews) {
    increment(pathCounts, pageview.path);
    increment(sectionCounts, pageview.section || titleForPath(pageview.path));
  }

  for (const click of clicks) {
    const label = click.target_label || click.target_href || click.target_type || "Unknown click";
    const destination = click.target_href ? ` -> ${click.target_href}` : "";
    increment(clickCounts, `${label}${destination}`);
  }

  const visitorDailyTrend = visitorsResult.error ? createDayBuckets(30) : dailyTrend(ipVisitors, (row) => row.first_seen_at);
  const visitorMonthlyTrend = visitorsResult.error ? createMonthBuckets(6) : monthlyTrend(ipVisitors, (row) => row.first_seen_at);

  const tableMissing = eventsResult.error || visitorsResult.error;

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminAutoRefresh />
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Website analytics"
        title="Visitor behaviour and click points"
        description="Live first-party analytics for public website traffic. New visitors are counted by a server-side hashed IP signal, private/admin pages are excluded, and account creation is pulled from live profiles."
        right={(
          <div className="rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-200">
            Auto-refreshing live view
          </div>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {tableMissing ? (
          <div className="rounded border border-red-500/40 bg-red-600 p-5 text-sm font-black text-white">
            Analytics storage needs the latest Supabase migrations applied: `0012_site_analytics_events.sql` and `0041_site_analytics_ip_visitors.sql`.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-6">
          <Metric icon={UsersRound} label="New IP visitors" value={uniqueVisitorCount} detail={`${newVisitorsToday} today`} />
          <Metric icon={BarChart3} label="Page visits" value={pageviews.length} detail="Tracked pageviews" />
          <Metric icon={UserPlus} label="Accounts created" value={profileRows.length} detail={`${newAccountsToday} today`} />
          <Metric icon={TrendingUp} label="Stayed" value={stayedSessions.size} detail={`${stayRate} of sessions`} />
          <Metric icon={Clock3} label="Avg stay signal" value={formatDuration(averageEngagementMs)} detail="Visible engagement" />
          <Metric icon={MousePointerClick} label="Clicks" value={clicks.length} detail="Buttons and links" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TrendCard title="New visitor trend" detail="Unique hashed-IP visitors over the last 30 days." buckets={visitorDailyTrend} />
          <TrendCard title="Monthly visitor trend" detail="Highs and lows across the last six months." buckets={visitorMonthlyTrend} />
          <TrendCard title="Page visit trend" detail="Public pageviews over the last 30 days." buckets={dailyTrend(pageviews, (row) => row.created_at)} />
          <TrendCard title="Account creation trend" detail="New platform accounts created over the last 30 days." buckets={dailyTrend(profileRows, (row) => row.created_at)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AnalyticsTable
            title="Most visited pages"
            rows={topEntries(pathCounts)}
            empty="No page visits tracked yet."
            labelFormatter={titleForPath}
            trendForRow={(label) => trendForKey(pageviews, label, (row) => row.path)}
          />
          <AnalyticsTable
            title="Most visited sections"
            rows={topEntries(sectionCounts)}
            empty="No section data tracked yet."
            trendForRow={(label) => trendForKey(pageviews, label, (row) => row.section || titleForPath(row.path))}
          />
          <AnalyticsTable
            title="Most clicked buttons and links"
            rows={topEntries(clickCounts, 12)}
            empty="No click points tracked yet."
            wide
            trendForRow={(label) => trendForKey(clicks, label, (row) => {
              const currentLabel = row.target_label || row.target_href || row.target_type || "Unknown click";
              const destination = row.target_href ? ` -> ${row.target_href}` : "";
              return `${currentLabel}${destination}`;
            })}
          />
          <section className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">How the numbers work</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-zinc-400">
              <p>New visitors are counted from a one-way hash of the request IP, so the same network is not counted again just because someone logs out and back in.</p>
              <p>Raw IP addresses are not stored in the analytics tables.</p>
              <p>Account creation is pulled from live profile records, so the daily account total updates as soon as a profile is created.</p>
              <p>Graphs refresh automatically while this admin page is open.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
    </article>
  );
}

function TrendCard({ title, detail, buckets }: { title: string; detail: string; buckets: Array<{ label: string; value: number }> }) {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
        </div>
        <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-black uppercase text-zinc-400">Live</div>
      </div>
      <MiniBarChart buckets={buckets} />
    </section>
  );
}

function MiniBarChart({ buckets }: { buckets: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));

  return (
    <div className="mt-5">
      <div className="flex h-32 items-end gap-1 rounded border border-zinc-800 bg-black p-3">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t bg-brand"
              style={{ height: `${Math.max(6, (bucket.value / max) * 100)}%` }}
              title={`${bucket.label}: ${bucket.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs font-black text-zinc-500">
        <span>{buckets[0]?.label ?? "Start"}</span>
        <span>{buckets[buckets.length - 1]?.label ?? "Now"}</span>
      </div>
    </div>
  );
}

function AnalyticsTable({
  title,
  rows,
  empty,
  labelFormatter,
  trendForRow,
  wide = false
}: {
  title: string;
  rows: Array<[string, number]>;
  empty: string;
  labelFormatter?: (value: string) => string;
  trendForRow?: (value: string) => Array<{ label: string; value: number }>;
  wide?: boolean;
}) {
  return (
    <section className={`rounded border border-zinc-800 bg-zinc-950 p-5 ${wide ? "lg:col-span-1" : ""}`}>
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-4 grid gap-2">
        {rows.map(([label, count], index) => (
          <div key={label} className="rounded border border-zinc-800 bg-black p-3">
            <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
              <div className="text-sm font-black text-red-200">{index + 1}</div>
              <div className="min-w-0 truncate text-sm font-black text-zinc-100">{labelFormatter ? labelFormatter(label) : label}</div>
              <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-black text-zinc-300">{count}</div>
            </div>
            {trendForRow ? <CompactSparkline buckets={trendForRow(label)} /> : null}
          </div>
        ))}
        {rows.length ? null : <div className="rounded border border-zinc-800 bg-black p-4 text-sm font-semibold text-zinc-400">{empty}</div>}
      </div>
    </section>
  );
}

function CompactSparkline({ buckets }: { buckets: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));

  return (
    <div className="mt-3 flex h-8 items-end gap-0.5" aria-label="30 day trend">
      {buckets.map((bucket) => (
        <span
          key={bucket.label}
          className="block flex-1 rounded-t bg-red-500/70"
          style={{ height: `${Math.max(3, (bucket.value / max) * 100)}%` }}
          title={`${bucket.label}: ${bucket.value}`}
        />
      ))}
    </div>
  );
}
