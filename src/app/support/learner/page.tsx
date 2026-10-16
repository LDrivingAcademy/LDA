import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck, CircleHelp, Clock3, CreditCard, Headphones, ListChecks, MapPin, ShieldAlert } from "lucide-react";
import { AdminTopBar } from "@/components/admin-top-bar";
import { PageTopBar } from "@/components/page-top-bar";
import { SupportAssistant } from "@/components/support-assistant";
import { SiteFooter } from "@/components/site-footer";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

const learnerActions = [
  { title: "Manage bookings", body: "Open your learner calendar to view upcoming, completed, cancelled, and rescheduled lessons or make booking changes.", href: "/learner-calendar?from=support", cta: "Open calendar", icon: ListChecks },
  { title: "Payment help", body: "View confirmations, retry failed payments, request refunds, or report a duplicate charge.", href: "/support/learner/payment-help", cta: "Open payment help", icon: CreditCard },
  { title: "Report off-platform request", body: "Report an instructor who asks you to pay or arrange lessons outside LDA so the case can be investigated.", href: "/support/learner/off-platform-report", cta: "Report request", icon: ShieldAlert },
  { title: "Contact support", body: "Tell the LDA support assistant what happened and create a support ticket if you still need help.", href: "#learner-support-assistant", cta: "Contact support", icon: Headphones }
];

const supportTopics = [
  { icon: Clock3, title: "Reschedule or cancel", body: "Use your dashboard first. If the lesson is soon, contact support with your booking reference." },
  { icon: MapPin, title: "Pickup postcode", body: "Keep pickup details accurate so instructors can confirm travel time and arrival tracking." },
  { icon: CreditCard, title: "Payment confirmation", body: "Never send card numbers or pay privately. Share only the payment email, amount, and LDA confirmation number." },
  { icon: CircleHelp, title: "Urgent issues", body: "If the lesson is today, your instructor is late, or payment is stuck, use the assistant and mark it urgent." }
];

const learnerSupportSteps = [
  { label: "1", title: "Use the fastest route", body: "Bookings and payment tools solve most issues immediately." },
  { label: "2", title: "Ask the guide", body: "The support guide reads the issue and points you to the next step." },
  { label: "3", title: "Escalate with context", body: "If needed, LDA creates a ticket with the details already attached." }
];

type LearnerSupportPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function LearnerSupportPage({ searchParams }: LearnerSupportPageProps) {
  const account = await getHeaderAccountSummary();
  if (!account) {
    redirect("/support/guest?from=role-guard");
  }

  if (account?.role === "instructor") {
    redirect("/support/instructor/dashboard?from=role-guard");
  }

  const { backHref, backLabel, fromAdmin } = await getPageBackLink(searchParams, {
    allowAdminSource: account.role === "admin"
  });

  return (
    <>
      {fromAdmin ? (
        <AdminTopBar autoSignOutOnLeave />
      ) : (
        <PageTopBar backHref={backHref} backLabel={backLabel} account={account} />
      )}

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <BookOpenCheck size={17} /> Learner support
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-normal sm:text-6xl">
                Resolve lesson, booking, and payment issues faster.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Use the right support route first, then ask the LDA support guide when you need help choosing the next step.
              </p>
            </div>
          </div>
        </section>

        <section id="learner-support-assistant" className="scroll-mt-24 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
            <div className="mb-6">
              <div className="text-sm font-black uppercase text-brand">AI learner support</div>
              <h2 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">Chat with LDA support</h2>
            </div>
            <SupportAssistant audience="learner" />
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">
            <div className="text-sm font-black uppercase text-brand">How support works</div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {learnerSupportSteps.map((step) => (
                <article key={step.title} className="flex min-h-[150px] gap-4 rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-base font-black text-white">{step.label}</span>
                  <div>
                    <h2 className="text-xl font-black">{step.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-10">
          <div>
            <div className="text-sm font-black uppercase text-brand">Support routes</div>
            <h2 className="mt-2 text-4xl font-black tracking-normal">Learner actions</h2>
            <p className="mt-3 max-w-3xl text-lg font-semibold leading-8 text-zinc-700">
              These routes handle common learner issues before a ticket is needed.
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            {learnerActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} href={action.href} className="group flex min-h-[250px] flex-col rounded border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:bg-zinc-50 hover:shadow-md">
                  <div className="grid h-14 w-14 place-items-center rounded bg-white text-brand shadow-sm">
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-black">{action.title}</h3>
                  <p className="mt-4 leading-7 text-zinc-700">{action.body}</p>
                  <span className="lda-pill lda-pill-sm mt-auto self-start">{action.cta}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-zinc-100">
          <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="grid h-11 w-11 place-items-center rounded bg-red-500/10 text-brand">
                    <Icon size={23} />
                  </div>
                  <h3 className="mt-4 text-xl font-black">{topic.title}</h3>
                  <p className="mt-3 leading-7 text-zinc-700">{topic.body}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
