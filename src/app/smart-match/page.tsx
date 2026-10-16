import { Sparkles } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { SmartMatchAccountGuard } from "@/components/smart-match-account-guard";
import { SmartMatchExperience } from "@/components/smart-match-experience";

export const revalidate = 300;

export const metadata = {
  title: "Find Driving Instructors Near You With SmartMatch",
  description:
    "Use LDA SmartMatch to find verified driving instructors by area, transmission, learning preferences, availability, price, and learner goals.",
  keywords: [
    "driving instructors near me",
    "find driving instructors",
    "automatic driving instructor near me",
    "manual driving instructor near me",
    "local driving instructor",
    "driving lessons near me"
  ],
  alternates: {
    canonical: "/smart-match"
  },
  openGraph: {
    title: "Find Driving Instructors Near You | LDA SmartMatch",
    description:
      "Compare local instructor matches by availability, transmission, learning preferences, pricing, and verified teaching strengths.",
    url: "/smart-match",
    type: "website"
  }
};

export default function SmartMatchPage() {
  return (
    <>
      <SmartMatchAccountGuard />
      <PageTopBar />
      <main className="min-h-screen bg-black text-white">
        <section className="border-b border-zinc-800 bg-black">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <Sparkles size={17} /> LDA SmartMatch
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
              An intelligent matching system that starts with how you learn best.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Build a private learning preference profile, compare verified instructor strengths, and move straight into the right booking journey.
            </p>
          </div>
        </section>
        <SmartMatchExperience />
      </main>
      <SiteFooter />
    </>
  );
}
