import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, CarFront, FileUp, MapPinned, ShieldCheck, WalletCards } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { instructorJourneyStages } from "@/lib/marketplace-content";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

export const metadata = {
  title: "Become A Driving Instructor With LDA",
  description:
    "Apply to join LDA as a verified driving instructor, publish availability, manage learner bookings, and receive driving lesson requests through the platform.",
  keywords: [
    "become a driving instructor",
    "driving instructor sign up",
    "join driving instructor platform",
    "ADI instructor bookings",
    "LDA instructor"
  ],
  alternates: {
    canonical: "/instructor"
  },
  openGraph: {
    title: "Become A Driving Instructor With LDA",
    description:
      "Verified ADI instructors can apply to join LDA, publish availability, and manage learner driving lesson bookings.",
    url: "/instructor",
    type: "website"
  }
};

const onboardingBlocks = [
  { title: "Verification", detail: "ADI status, badge number, ID, driving licence, insurance, and supporting evidence.", icon: FileUp },
  { title: "Profile", detail: "Bio, photo, car, transmission, covered areas, base postcode, hourly price, and auto-accept preference.", icon: CarFront },
  { title: "Availability", detail: "Publish lesson slots, block unavailable time, manage accepted bookings, and update learner notes.", icon: CalendarDays },
  { title: "Payouts", detail: "Secure payout setup, gross lesson value, LDA service fee, net earnings, and payout status.", icon: WalletCards }
];

const instructorOperatingTools = [
  {
    title: "Client pipeline",
    detail: "Turn local learner demand into verified bookings, repeat lessons, progress history, and review-backed reputation."
  },
  {
    title: "Availability engine",
    detail: "Open free slots, protect unavailable time, see checkout holds, and keep confirmed bookings system-controlled."
  },
  {
    title: "Progress workspace",
    detail: "Record lesson focus, skills, notes, recommended videos, and next-step plans that learners can view after sign-in."
  },
  {
    title: "Growth signals",
    detail: "Use platform completion, cancellation, review, retention, and support signals to improve future search visibility."
  }
];

type InstructorPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function InstructorPage({ searchParams }: InstructorPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);
  const account = await getHeaderAccountSummary();
  const instructorAccountHref =
    account?.role === "instructor" && account.subscriptionLabel === "In progress"
      ? account.subscriptionHref
      : account?.dashboardHref;

  return (
    <>
      <PageTopBar backHref={backHref} backLabel={backLabel} account={account} />
      <main className="min-h-screen bg-white text-black">
        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
                  <ShieldCheck size={16} /> Instructor onboarding
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Join LDA as a verified driving instructor.</h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
                  Instructors have a separate route from learners. Submit verification, set your profile and pricing, publish availability, then wait for LDA review before appearing in search.
                </p>
              </div>
              <InstructorEntryPanel accountRole={account?.role ?? null} instructorAccountHref={instructorAccountHref} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="text-sm font-black uppercase text-brand">Driver-style journey</div>
            <h2 className="mt-2 text-3xl font-black">From sign-in to accepted lesson</h2>
          </div>
          <div className="mb-10 grid gap-3 md:grid-cols-3">
            {instructorJourneyStages.map((stage, index) => (
              <article key={stage.title} className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-black text-brand">Stage {index + 1}</div>
                <h3 className="mt-2 font-black">{stage.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{stage.detail}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {onboardingBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <article key={block.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                  <Icon className="text-brand" />
                  <h2 className="mt-4 text-xl font-black">{block.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{block.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                <BadgeCheck size={16} /> Instructor business OS
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-normal">More than leads. A daily system for building clientele.</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
                LDA should make an instructor's working week easier to run on-platform than off-platform: booking, learner history, availability, payouts, progress and trust in one place.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {instructorOperatingTools.map((tool) => (
                <article key={tool.title} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="font-black">{tool.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{tool.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
                <BadgeCheck size={16} /> Search visibility
              </div>
              <h2 className="mt-4 text-3xl font-black">No approval, no listing.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                This protects learners and keeps the platform professional. LDA reviews each instructor before they appear in postcode search or receive bookings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["Verification pending", "Approved profile", "Live availability"].map((item) => (
                <div key={item} className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
                  <MapPinned className="mb-3 text-brand" size={20} />
                  <div className="font-black">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function InstructorEntryPanel({
  accountRole,
  instructorAccountHref
}: {
  accountRole: "learner" | "instructor" | "admin" | "support" | null;
  instructorAccountHref?: string;
}) {
  if (accountRole === "instructor" || accountRole === "admin") {
    return (
      <aside className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
        <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
          <CarFront size={16} /> Instructor account
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
          This account is already in the instructor pathway. Open your dashboard to view your current status or continue setup.
          <Link href={instructorAccountHref ?? "/instructor-dashboard"} className="lda-pill mt-4 w-full justify-center">
            {accountRole === "admin" ? "Preview instructor dashboard" : "Open instructor dashboard"} <ArrowRight size={18} />
          </Link>
        </div>
      </aside>
    );
  }

  if (accountRole === "support") {
    return (
      <aside className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
        <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
          <CarFront size={16} /> Technical support account
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
          This signed-in account is reserved for Technical Operations Centre work, so instructor onboarding is not available from this session.
          <Link href="/technical-support" className="lda-pill mt-4 w-full justify-center">
            Open Technical Operations Centre <ArrowRight size={18} />
          </Link>
        </div>
      </aside>
    );
  }

  if (accountRole === "learner") {
    return (
      <aside className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
        <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
          <CarFront size={16} /> Instructor transfer
        </div>
        <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
          <h3 className="font-black">Learner to instructor request</h3>
          <p className="text-sm font-semibold leading-6 text-zinc-600">
            Request to move this learner account into the instructor pathway. LDA will ask for ADI evidence and keep instructor tools locked until review is complete.
          </p>
          {["Keep your saved learner account details", "Submit ADI evidence", "Wait for LDA review"].map((label) => (
            <div key={label} className="rounded border border-zinc-200 bg-white p-3 text-sm font-black text-zinc-800">
              {label}
            </div>
          ))}
        </div>
        <Link href="/account/instructor-transfer?mode=signup&from=instructor" className="lda-pill mt-4 w-full justify-center">
          Request instructor transfer <ArrowRight size={18} />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
      <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
        <CarFront size={16} /> Instructor sign-up
      </div>
      <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <h3 className="font-black">Create your instructor account</h3>
          <p className="mt-1 text-sm leading-5 text-zinc-600">
            Start by creating your instructor login. LDA will send the email confirmation first, then ask for ADI documents before the account enters review.
          </p>
        </div>
        {["Create email and password", "Confirm your email", "Upload ADI evidence", "Wait for LDA review"].map((label) => (
          <div key={label} className="rounded border border-zinc-200 bg-white p-3 text-sm font-black text-zinc-800">
            {label}
          </div>
        ))}
      </div>
      <Link href="/auth/sign-up?role=instructor&entry=guest-instructor" className="lda-pill mt-4 w-full justify-center">
        Start instructor sign up <ArrowRight size={18} />
      </Link>
    </aside>
  );
}
