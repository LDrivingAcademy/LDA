import { OnDemandLessonStatus } from "@/components/on-demand-lesson-status";
import { PageTopBar } from "@/components/page-top-bar";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { createClient } from "@/lib/supabase/server";

export default async function InstantLessonConfirmedPage({
  searchParams
}: {
  searchParams: Promise<{
    reference?: string;
    session_id?: string;
    demo?: string;
  }>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? "LDA-PENDING";
  const sessionId = params.session_id;
  const requestedDemo = params.demo === "1";
  const supabase = await createClient();
  let isSignedIn = false;

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      isSignedIn = true;
      await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
    }
  }

  const demo = requestedDemo && !isSignedIn;

  return (
    <>
      <PageTopBar />
      <main className="min-h-screen bg-white text-black">
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <OnDemandLessonStatus reference={reference} sessionId={sessionId} demo={demo} />
        </section>
      </main>
    </>
  );
}
