import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveLessonMap } from "@/components/live-lesson-map";

export default function TrackingPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-zinc-700 hover:text-brand">
          <ArrowLeft size={17} /> Back to LDA
        </Link>
      </section>
      <LiveLessonMap />
    </main>
  );
}
