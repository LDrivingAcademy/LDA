import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Video } from "lucide-react";
import { LearnerPageHeader } from "@/components/learner-page-header";

const revisionItems = [
  "Instructor notes from completed lessons",
  "Skills already covered so you do not repeat paid lesson time",
  "Videos and reading links to review before your next booking",
  "Next-lesson focus areas agreed with your instructor"
];

const lessonNotes = [
  { title: "Clutch control and moving off", status: "Completed", note: "Review biting point control and smooth stops before the next manual lesson." },
  { title: "Mirror signal manoeuvre", status: "Needs practice", note: "Watch the observation routine video before roundabout practice." },
  { title: "Meeting traffic", status: "Next focus", note: "Prepare for judgement gaps and parked-car priority decisions." }
];

export default function AfterLessonRevisionPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="After lesson revision"
        title="Revise what your instructor covered."
        body="This page is focused only on post-lesson notes, completed skills, and videos your instructor wants you to review before the next lesson."
      />
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-4">
          {lessonNotes.map((item) => (
            <article key={item.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black">{item.title}</h2>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">{item.status}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">{item.note}</p>
            </article>
          ))}
        </div>
        <aside className="rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
          <BookOpenCheck className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Before your next lesson</h2>
          <div className="mt-4 grid gap-3">
            {revisionItems.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-700">
                <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                {item}
              </div>
            ))}
          </div>
          <Link href="/roadworthy" className="lda-pill lda-pill-sm mt-5">
            <Video size={17} /> Open tips directory
          </Link>
        </aside>
      </section>
    </main>
  );
}
