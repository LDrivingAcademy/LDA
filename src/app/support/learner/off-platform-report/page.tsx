import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { submitOffPlatformReport } from "@/app/support/learner/off-platform-report/actions";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Report an off-platform request | L Driving Academy",
  robots: { index: false, follow: false }
};

type OffPlatformReportPageProps = {
  searchParams?: Promise<{ message?: string; submitted?: string }>;
};

export default async function OffPlatformReportPage({ searchParams }: OffPlatformReportPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?role=learner&next=/support/learner/off-platform-report");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=learner&next=/support/learner/off-platform-report");
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (roleState.effectiveRole !== "learner") {
    redirect(roleState.effectiveRole === "instructor" ? "/support/instructor/dashboard" : "/learner-dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const learnerName = String(profile?.full_name ?? user.user_metadata?.full_name ?? "").trim();

  return (
    <>
      <PageTopBar backHref="/support/learner" backLabel="Back to learner support" />
      <main className="min-h-[calc(100vh-160px)] bg-zinc-100 text-black">
        <section className="border-b border-zinc-800 bg-black text-white">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-red-200">
              <ShieldAlert size={18} /> Learner safety report
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">Report an off-platform request</h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-zinc-300">
              Use this form if an instructor asks you to pay, book, or communicate outside LDA. Do not make the payment. LDA will save the report and open an investigation.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {params?.submitted ? (
            <article className="rounded border border-emerald-300 bg-emerald-50 p-6">
              <CheckCircle2 className="text-emerald-700" size={30} />
              <h2 className="mt-3 text-2xl font-black text-emerald-950">Your report has been submitted</h2>
              <p className="mt-2 font-semibold leading-7 text-emerald-900">
                LDA has opened an investigation under reference <strong>{params.submitted}</strong>. A confirmation has been sent to the email on your learner account.
              </p>
              <Link href="/support/learner" className="lda-pill mt-5">Back to learner support</Link>
            </article>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <form action={submitOffPlatformReport} className="grid gap-5 rounded border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                {params?.message ? (
                  <div className="rounded border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-900" role="alert">
                    {params.message}
                  </div>
                ) : null}

                <label className="grid gap-2">
                  <span className="text-sm font-black text-zinc-800">Your name</span>
                  <input
                    required
                    name="learnerName"
                    defaultValue={learnerName}
                    maxLength={120}
                    autoComplete="name"
                    className="rounded border border-zinc-300 bg-white px-4 py-3 font-semibold text-black"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-zinc-800">Instructor&apos;s name</span>
                  <input
                    required
                    name="instructorName"
                    maxLength={120}
                    className="rounded border border-zinc-300 bg-white px-4 py-3 font-semibold text-black"
                    placeholder="Enter the instructor's name"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-zinc-800">Date the request happened</span>
                  <input
                    required
                    name="incidentDate"
                    type="date"
                    className="rounded border border-zinc-300 bg-white px-4 py-3 font-semibold text-black"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-zinc-800">Other relevant dates <span className="font-semibold text-zinc-500">(optional)</span></span>
                  <input
                    name="additionalDates"
                    maxLength={500}
                    className="rounded border border-zinc-300 bg-white px-4 py-3 font-semibold text-black"
                    placeholder="For example, lesson dates or follow-up message dates"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-zinc-800">What did the instructor ask you to do?</span>
                  <textarea
                    required
                    name="details"
                    minLength={20}
                    maxLength={2800}
                    rows={7}
                    className="resize-y rounded border border-zinc-300 bg-white px-4 py-3 font-semibold text-black"
                    placeholder="Include the exact request where possible. Do not include card, bank, password, or security-code details."
                  />
                </label>

                <button type="submit" className="lda-pill w-full justify-center">
                  <Send size={18} /> Submit report
                </button>
              </form>

              <aside className="self-start rounded border border-red-200 bg-red-50 p-5">
                <CalendarDays className="text-brand" size={26} />
                <h2 className="mt-3 text-xl font-black">What happens next</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
                  Your report is placed in the LDA technical support and admin investigation queues. The team can add internal investigation notes and update the case status.
                </p>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
                  Keep any messages or screenshots available. LDA support will contact you by email if more information is needed.
                </p>
              </aside>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
