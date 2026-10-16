import { NotificationHubPanel } from "@/components/notification-hub-panel";
import { PageTopBar } from "@/components/page-top-bar";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";

type NotificationHubPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function NotificationHubPage({ searchParams }: NotificationHubPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);
  const { supabase, user } = await requireSignedInPage("Sign in before managing notifications.");
  const account = await getHeaderAccountSummary();
  const roleState = await getMarketplaceRoleState(supabase, user.id);
  const isInstructor = roleState.effectiveRole === "instructor";
  const isLearner = roleState.effectiveRole === "learner";
  const safeBackHref =
    isInstructor && backHref.includes("learner")
      ? "/instructor-dashboard"
      : isLearner && backHref.includes("instructor")
        ? "/learner-dashboard"
        : backHref;
  const safeBackLabel =
    isInstructor && backHref.includes("learner")
      ? "Back to instructor dashboard"
      : isLearner && backHref.includes("instructor")
        ? "Back to learner dashboard"
        : backLabel;
  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id,notification_type,title,body,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={safeBackHref} backLabel={safeBackLabel} account={account} />
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            Notification hub
          </div>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
            Choose the LDA alerts you want.
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            Control booking, cancellation, instructor arrival, after-lesson, and promotional notifications from one focused page.
          </p>
        </div>
      </section>
      <NotificationHubPanel
        initialNotifications={notifications ?? []}
        loadError={notificationError ? "LDA could not load saved account notifications yet." : null}
      />
    </main>
  );
}
