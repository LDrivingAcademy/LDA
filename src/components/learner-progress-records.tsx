import { BookOpenCheck, CheckCircle2, ClipboardCheck, Video } from "lucide-react";

export type LessonProgressRecord = {
  id: string;
  instructor_name: string;
  lesson_reference: string | null;
  completed_skills: string[] | null;
  instructor_notes: string | null;
  next_lesson_focus: string | null;
  recommended_videos: string | null;
  sent_at: string;
};

export function LearnerProgressRecords({ records }: { records: LessonProgressRecord[] }) {
  return (
    <section className="grid gap-4">
      <div className="rounded bg-white p-5 text-black shadow-2xl ring-1 ring-zinc-200">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <ClipboardCheck size={16} /> Learner progress records
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-normal">Your instructor feedback.</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          These records are sent by your instructor. They are view-only for learners so the lesson record stays accurate.
        </p>
      </div>

      {records.length ? (
        records.map((record) => (
          <article key={record.id} className="rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase text-brand">{record.instructor_name}</div>
                <h3 className="mt-1 text-2xl font-black">Lesson progress update</h3>
                <p className="mt-1 text-sm font-bold text-zinc-500">
                  {record.lesson_reference || "No lesson reference"} · {new Date(record.sent_at).toLocaleString("en-GB")}
                </p>
              </div>
              <div className="rounded bg-zinc-100 px-3 py-2 text-xs font-black uppercase text-zinc-600">View only</div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded bg-zinc-100 p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                  <CheckCircle2 size={16} /> Completed skills
                </div>
                <ul className="mt-3 grid gap-2">
                  {(record.completed_skills?.length ? record.completed_skills : ["No skills marked complete yet."]).map((skill) => (
                    <li key={skill} className="rounded bg-white p-3 text-sm font-bold">{skill}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded bg-zinc-100 p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                  <BookOpenCheck size={16} /> Next lesson focus
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                  {record.next_lesson_focus || "No next-lesson focus added."}
                </p>
              </section>
            </div>

            <section className="mt-4 rounded bg-zinc-100 p-4">
              <div className="text-sm font-black uppercase text-zinc-500">Instructor notes</div>
              <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                {record.instructor_notes || "No notes added."}
              </p>
            </section>

            <section className="mt-4 rounded bg-zinc-100 p-4">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
                <Video size={16} /> Recommended videos or links
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded bg-white p-3 text-sm font-bold leading-6">
                {record.recommended_videos || "No videos added."}
              </p>
            </section>
          </article>
        ))
      ) : (
        <div className="rounded border border-zinc-200 bg-white p-5 text-sm font-bold text-zinc-600">
          No progress records have been sent to you yet.
        </div>
      )}
    </section>
  );
}
