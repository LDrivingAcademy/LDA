import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ExternalLink, GraduationCap } from "lucide-react";
import { RoadworthyGuide } from "@/components/roadworthy-guide";

const researchLinks = [
  {
    label: "Official Highway Code updates",
    href: "https://www.gov.uk/guidance/the-highway-code/updates"
  },
  {
    label: "2022 Highway Code changes",
    href: "https://www.gov.uk/government/news/the-highway-code-8-changes-you-need-to-know-from-29-january-2022"
  },
  {
    label: "Skill decay overview",
    href: "https://journals.sagepub.com/doi/10.1177/10648046241236519"
  },
  {
    label: "Driving inactivity and lane control",
    href: "https://www.sciencedirect.com/science/article/abs/pii/S1369847817301808"
  },
  {
    label: "Driving inactivity and hazard response",
    href: "https://www.sciencedirect.com/science/article/pii/S1369847817305673"
  },
  {
    label: "Hazard perception in driving",
    href: "https://journals.sagepub.com/doi/10.1177/0963721416663186"
  }
];

export default function RoadworthyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900 px-4 py-6">
        <section className="mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
            <ArrowLeft size={16} /> Back to homepage
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-red-100">
                <GraduationCap size={16} /> LDA top tips to pass
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
                Roadworthy refresh for learners and returning drivers.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
                Choose how long you have been away from driving, then use the skill-fade planner to find the right Highway Code refresh, hazard practice, and video topics before you book.
              </p>
            </div>
            <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <BookOpenCheck className="text-brand" />
              <h2 className="mt-4 text-2xl font-black">Built from research, not guesswork.</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Skill fade is strongest when a task is complex, safety critical, and not practised. For driving, that means rebuilding judgement and observation as well as basic control.
              </p>
            </aside>
          </div>
        </section>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <RoadworthyGuide />

        <section className="mt-8 rounded border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-2xl font-black">Research and official rule sources</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            These links are used to shape the refresh recommendations. The final LDA education library can later replace video-search links with approved instructor-made lessons.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {researchLinks.map((link) => (
              <a key={link.href} href={link.href} className="rounded border border-zinc-800 bg-black p-4 text-sm font-black text-white hover:border-red-500" rel="noreferrer" target="_blank">
                {link.label} <ExternalLink className="mt-3 text-brand" size={16} />
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
