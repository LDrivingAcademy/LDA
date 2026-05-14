"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const completedLessons = [
  "Marcus Reed - 8 May 2026 at 15:00",
  "Amelia Khan - 2 May 2026 at 10:30"
];

export function RateInstructorPanel() {
  const [selectedLesson, setSelectedLesson] = useState(completedLessons[0]);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <form
        className="rounded border border-zinc-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <h2 className="text-2xl font-black">Rate your instructor</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
          Reviews are only for instructors after completed lessons. Learners are not reviewed on LDA.
        </p>
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-black uppercase text-zinc-600">Completed lesson</span>
          <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black">
            {completedLessons.map((lesson) => (
              <option key={lesson}>{lesson}</option>
            ))}
          </select>
        </label>
        <div className="mt-5">
          <div className="text-xs font-black uppercase text-zinc-600">Rating</div>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRating(item)}
                className={item <= rating ? "text-brand" : "text-zinc-300"}
                aria-label={`${item} star review`}
              >
                <Star size={28} fill="currentColor" />
              </button>
            ))}
          </div>
        </div>
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-black uppercase text-zinc-600">Written review</span>
          <textarea
            value={review}
            onChange={(event) => setReview(event.target.value)}
            placeholder="Write an optional review about your completed lesson"
            className="min-h-36 rounded border border-zinc-300 bg-white p-3 text-sm font-bold text-black"
          />
        </label>
        <button type="submit" className="lda-pill lda-pill-sm mt-5">
          Save review
        </button>
        {saved ? <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">Review saved for the selected completed lesson.</p> : null}
      </form>
    </section>
  );
}
