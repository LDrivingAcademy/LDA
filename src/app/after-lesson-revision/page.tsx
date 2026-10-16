import Link from "next/link";
import { BookOpenCheck, CheckCircle2, ClipboardCheck, Video } from "lucide-react";
import { LearnerPageHeader } from "@/components/learner-page-header";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink, type PageSourceSearchParams, withDashboardSource } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";
import type { LessonProgressRecord } from "@/components/learner-progress-records";

const revisionItems = [
  "Read your instructor's end-of-lesson notes",
  "Revise the skills your instructor ticked off",
  "Use recommended videos or links before your next booking",
  "Check the next-lesson focus so you arrive prepared"
];

type AfterLessonRevisionPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function AfterLessonRevisionPage({ searchParams }: AfterLessonRevisionPageProps) {
  const { backHref, backLabel, fromDashboard } = await getPageBackLink(searchParams);
  const { supabase, user } = await requireSignedInPage("Sign in before viewing lesson revision notes.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");

  const { data } = await supabase
    .from("lesson_progress_records")
    .select("id,instructor_name,lesson_reference,completed_skills,instructor_notes,next_lesson_focus,recommended_videos,sent_at")
    .eq("learner_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(12);
  const lessonRecords = (data ?? []) as LessonProgressRecord[];

  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="After lesson revision"
        title="Revise what your instructor covered."
        body="This page is focused only on post-lesson notes, completed skills, and videos your instructor wants you to review before the next lesson."
        backHref={backHref}
        backLabel={backLabel}
      />
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-4">
          {lessonRecords.length ? (
            lessonRecords.map((record) => (
              <article key={record.id} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                      <ClipboardCheck size={16} /> Sent by {record.instructor_name}
                    </div>
                    <h2 className="mt-2 text-2xl font-black">After-lesson revision notes</h2>
                    <p className="mt-1 text-sm font-bold text-zinc-500">
                      {record.lesson_reference || "No lesson reference"} - {new Date(record.sent_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">Instructor sent</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <section className="rounded bg-zinc-100 p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                      <CheckCircle2 size={16} /> Covered this lesson
                    </div>
                    <ul className="mt-3 grid gap-2">
                      {(record.completed_skills?.length ? record.completed_skills : ["No checklist items were ticked for this lesson."]).map((skill) => (
                        <li key={skill} className="rounded bg-white p-3 text-sm font-bold">{skill}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded bg-zinc-100 p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                      <BookOpenCheck size={16} /> Next lesson focus
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                      {record.next_lesson_focus || "Your instructor has not added the next focus yet."}
                    </p>
                  </section>
                </div>

                <section className="mt-4 rounded bg-zinc-100 p-4">
                  <div className="text-sm font-black uppercase text-zinc-500">Instructor notes</div>
                  <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                    {record.instructor_notes || "Your instructor has not added written notes yet."}
                  </p>
                </section>

                <section className="mt-4 rounded bg-zinc-100 p-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                    <Video size={16} /> Recommended revision
                  </div>
                  <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                    {record.recommended_videos || "No videos or links were added for this lesson."}
                  </p>
                </section>
              </article>
            ))
          ) : (
            <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                <ClipboardCheck size={16} /> No revision notes yet
              </div>
              <h2 className="mt-3 text-2xl font-black">Your instructor has not sent an after-lesson record yet.</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
                After each lesson, your instructor can tick off what was covered, add notes, and send revision links. Those updates will appear here and in your learner progress tracker.
              </p>
            </article>
          )}
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
          <Link href={withDashboardSource("/roadworthy", fromDashboard)} className="lda-pill lda-pill-sm mt-5">
            <Video size={17} /> Open tips directory
          </Link>
        </aside>
      </section>
    </main>
  );
}
