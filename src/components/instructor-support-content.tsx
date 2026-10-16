import Link from "next/link";
import { BadgeCheck, CalendarClock, CheckCircle2, CreditCard, FileCheck2, Mail, ShieldCheck, UserCog } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { SupportAssistant } from "@/components/support-assistant";

const instructorActions = [
  { title: "Verification support", body: "ADI/PDI status, licence evidence, insurance documents, rejected applications, and approval status.", href: "mailto:info@ldrivingacademy.co.uk?subject=Instructor%20verification%20support", cta: "Email verification", icon: FileCheck2 },
  { title: "Calendar and bookings", body: "Availability, accepted bookings, declined bookings, auto-accept settings, and learner pickup notes.", href: "/instructor-calendar", cta: "Instructor area", icon: CalendarClock },
  { title: "Earnings and payouts", body: "Payout setup, payout status, service-fee questions, refunds, and dispute references.", href: "mailto:info@ldrivingacademy.co.uk?subject=Instructor%20payout%20support", cta: "Payout support", icon: CreditCard }
];

const supportSteps = [
  "Describe the issue with any booking reference",
  "Get an immediate AI-guided next step",
  "Create a ticket only when the team is needed"
];

export function InstructorSupportContent({ entry }: { entry: "public" | "dashboard" }) {
  const instructorAreaHref = "/instructor-calendar";

  return (
    <>
      <PageTopBar
        backHref={entry === "public" ? "/" : "/dashboard"}
        backLabel={entry === "public" ? "Back to homepage" : "Back to dashboard"}
      />

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <BadgeCheck size={17} /> Instructor support
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-normal sm:text-6xl">
                Professional support for your LDA instructor account.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Get routed help for verification, documents, availability, learner bookings, calendar issues, earnings, payouts, and account access.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {supportSteps.map((step, index) => (
                  <div key={step} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs font-black uppercase text-red-200">Step {index + 1}</div>
                    <p className="mt-2 text-sm font-bold leading-6 text-zinc-300">{step}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={instructorAreaHref} className="lda-pill">
                  <UserCog size={20} /> Instructor area
                </Link>
                <a href="mailto:info@ldrivingacademy.co.uk?subject=Instructor%20support%20request" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:border-red-500 hover:text-red-100">
                  <Mail size={20} /> Email support
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="instructor-support-assistant" className="scroll-mt-24 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
            <div className="mb-6">
              <div className="text-sm font-black uppercase text-brand">Instructor support</div>
              <h2 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">Chat with LDA support</h2>
            </div>
            <SupportAssistant audience="instructor" />
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-black uppercase text-brand">Support routes</div>
              <h2 className="mt-2 text-4xl font-black tracking-normal">Instructor help options</h2>
              <p className="mt-3 max-w-3xl text-lg font-semibold leading-8 text-zinc-700">
                Start with the route closest to the issue. The support guide can still create a ticket with the full context if the automatic route does not solve it.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
              <ShieldCheck size={18} /> Account context included when signed in
            </div>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {instructorActions.map((action) => {
              const Icon = action.icon;
              const href = action.cta === "Instructor area" ? instructorAreaHref : action.href;
              return (
                <Link key={action.title} href={href} className="group flex min-h-[260px] flex-col rounded border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:bg-zinc-50 hover:shadow-md">
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
          <div className="mt-8 rounded border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 shrink-0 text-emerald-700" size={22} />
              <p className="font-semibold leading-7 text-zinc-700">
                For urgent same-day learner issues, include the booking reference, learner name, planned start time, and the action you already tried. Do not send private bank details or identity-document images through support chat.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
