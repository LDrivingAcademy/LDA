import Link from "next/link";
import { ArrowLeft, RadioTower } from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";

type TrackingPageProps = {
  searchParams?: Promise<{ from?: string }>;
};

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const params = await searchParams;
  const isLearnerTracking = params?.from === "dashboard";
  const backHref = isLearnerTracking ? "/learner-dashboard" : "/";
  const backLabel = isLearnerTracking ? "Back to dashboard" : "Back to homepage";
  const badge = isLearnerTracking ? "Live tracking" : "Live tracking demo";
  const heading = isLearnerTracking
    ? "Track your instructor to your pickup point."
    : "Preview learner live tracking after booking.";
  const description = isLearnerTracking
    ? "This is the learner tracking view for accepted bookings. It shows your pickup location and the instructor's live location from roughly 15 minutes before lesson time."
    : "This public demo shows how learners will see instructor distance, estimated arrival time, and route progress before a confirmed lesson.";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <Brand />
          <div className="hidden items-center gap-6 md:flex">
            <Link href={backHref} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <ArrowLeft size={17} /> {backLabel}
            </Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <RadioTower size={17} /> {badge}
            </div>
            <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal">{heading}</h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              {description}
            </p>
          </div>
        </section>
        <LiveLessonMap mode={isLearnerTracking ? "live" : "demo"} />
      </main>
    </>
  );
}
