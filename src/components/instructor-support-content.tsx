import Link from "next/link";
import { BadgeCheck, CalendarClock, CircleHelp, CreditCard, FileCheck2, Mail, ShieldCheck, UserCog } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";

const instructorActions = [
  { title: "Verification support", body: "ADI/PDI status, licence evidence, insurance documents, rejected applications, and approval status.", href: "mailto:info@ldrivingacademy.co.uk?subject=Instructor%20verification%20support", cta: "Email verification", icon: FileCheck2 },
  { title: "Calendar and bookings", body: "Availability, accepted bookings, declined bookings, auto-accept settings, and learner pickup notes.", href: "/instructor", cta: "Instructor area", icon: CalendarClock },
  { title: "Earnings and payouts", body: "Stripe Connect onboarding, payout status, commission questions, refunds, and dispute references.", href: "mailto:info@ldrivingacademy.co.uk?subject=Instructor%20payout%20support", cta: "Payout support", icon: CreditCard }
];

const checklist = [
  "Account email and full name",
  "ADI/PDI status and number",
  "Application or booking reference",
  "Clear description of the issue",
  "Screenshots of errors where useful"
];

export function InstructorSupportContent({ entry }: { entry: "public" | "dashboard" }) {
  const instructorAreaHref = entry === "dashboard" ? "/instructor-calendar" : "/instructor";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-4 px-[15px] py-4">
          <div className="flex min-w-0 items-center gap-7">
            <Brand />
            {entry === "public" ? (
              <nav className="hidden items-center gap-7 lg:flex">
                <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learner</Link>
                <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white ring-2 ring-brand">Instructor</Link>
                <Link href="/#discover" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
                <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">About</Link>
              </nav>
            ) : null}
          </div>
          {entry === "public" ? (
            <div className="hidden items-center gap-6 md:flex">
              <LanguageSelector />
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                <CircleHelp size={17} /> Help
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white hover:text-white hover:ring-2 hover:ring-brand"
            >
              <span aria-hidden="true">{"<-"}</span> Back to dashboard
            </Link>
          )}
          <div className={entry === "public" ? "md:hidden" : "hidden"}>
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <BadgeCheck size={17} /> Instructor support
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                Professional support for instructors on LDA.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Get help with onboarding, ADI/PDI verification, documents, profile settings, availability, bookings, earnings, and payouts.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={instructorAreaHref} className="lda-pill">
                  <UserCog size={20} /> Instructor area
                </Link>
                <a href="mailto:info@ldrivingacademy.co.uk?subject=Instructor%20support%20request" className="lda-pill">
                  <Mail size={20} /> Email support
                </a>
              </div>
            </div>

            <aside className="rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <div className="text-sm font-black uppercase text-zinc-500">Before contacting support</div>
              <h2 className="mt-2 text-3xl font-black text-white">Send the right details.</h2>
              <div className="mt-5 grid gap-3">
                {checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded bg-white/5 p-3 text-sm font-bold text-zinc-200">
                    <ShieldCheck className="mt-0.5 shrink-0 text-brand" size={17} />
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black tracking-normal">Instructor help options</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {instructorActions.map((action) => {
              const Icon = action.icon;
              const href = action.cta === "Instructor area" ? instructorAreaHref : action.href;
              return (
                <Link key={action.title} href={href} className="group flex min-h-[260px] flex-col rounded bg-zinc-100 p-6 hover:bg-zinc-200">
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
      </main>
      <SiteFooter />
    </>
  );
}
