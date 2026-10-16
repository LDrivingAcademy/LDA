import { Clock3 } from "lucide-react";
import { InstantLessonBooking } from "@/components/instant-lesson-booking";
import { PageTopBar } from "@/components/page-top-bar";

export const revalidate = 300;

export const metadata = {
  title: "Book An On-Demand Driving Lesson Near You",
  description:
    "Need a driving lesson right now? Use LDA to request an on-demand driving lesson, verify your provisional licence, pay securely, and wait for a suitable local instructor.",
  keywords: [
    "on-demand driving lesson",
    "need a driving lesson right now",
    "get a driving lesson",
    "book a driving lesson",
    "driving lessons near me",
    "book driving lessons near me"
  ],
  alternates: {
    canonical: "/lesson-now"
  },
  openGraph: {
    title: "Book An On-Demand Driving Lesson Near You | LDA",
    description:
      "Request a short-notice driving lesson through LDA with licence verification, secure checkout, and instructor assignment after payment.",
    url: "/lesson-now",
    type: "website"
  }
};

const instantLessonPricePence = Number(process.env.LDA_INSTANT_LESSON_PRICE_PENCE ?? 6500);

export default function LessonNowPage() {
  return (
    <>
      <PageTopBar />
      <main className="min-h-screen bg-white text-black">
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-8">
            <section>
              <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand">
                <Clock3 size={16} /> On-demand lesson
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
                Closest instructors available, booked fast.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
                Use guest checkout for a short-notice lesson, or sign in as a learner so LDA can fill your saved details after the page opens.
              </p>

              <div className="mt-6 rounded bg-red-50 p-5 text-black ring-1 ring-red-100">
                <h2 className="text-2xl font-black">An on-demand lesson in three steps.</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    "Confirm your saved learner details, or enter guest contact details.",
                    "Choose your booking preferences and continue to secure Stripe checkout.",
                    "After payment, LDA assigns the closest suitable instructor availability to get your lesson on the way."
                  ].map((step, index) => (
                    <div key={step} className="rounded bg-white p-4 text-sm font-bold leading-6 text-zinc-800">
                      <div className="mb-2 text-xl font-black text-brand">{index + 1}</div>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <InstantLessonBooking
              amountPence={instantLessonPricePence}
              initialLearnerDetails={null}
            />

            <section className="rounded bg-black p-5 text-white">
              <h2 className="text-2xl font-black">What happens after payment?</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  "Stripe confirms your payment securely.",
                  "LDA opens a waiting screen while the closest suitable instructor is matched.",
                  "You can cancel for a refund before an instructor accepts. Once accepted, automatic refund cancellation is locked."
                ].map((item) => (
                  <div key={item} className="rounded bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-200">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
