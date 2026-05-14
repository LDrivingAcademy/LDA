import Link from "next/link";
import { ArrowLeft, BadgePoundSterling, CalendarClock, CarFront, Clock3, MapPin, Star } from "lucide-react";
import { InstantLessonBooking } from "@/components/instant-lesson-booking";
import { demoInstructors } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

const closestInstructor = demoInstructors[0];
const instantLessonPricePence = Number(process.env.LDA_INSTANT_LESSON_PRICE_PENCE ?? 6500);
const standardPricePence = closestInstructor.price;
const demandPremiumPence = Math.max(0, instantLessonPricePence - standardPricePence);

export default function LessonNowPage() {
  const lessonSummary = `Instant LDA lesson with ${closestInstructor.name}, ${closestInstructor.next}, pickup confirmed after payment.`;

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-zinc-700 hover:text-brand">
          <ArrowLeft size={17} /> Back to homepage
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_460px] lg:items-start">
          <section>
            <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand">
              <Clock3 size={16} /> Lesson now
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
              Closest available instructor, booked as a guest.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
              No LDA account needed. Because this is a demand-based instant booking, the price is higher than the standard listed hourly rate.
            </p>

            <div className="mt-6 rounded bg-red-50 p-5 text-black ring-1 ring-red-100">
              <h2 className="text-2xl font-black">How Lesson Now works</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  "Enter your name, email, pickup details, and provisional licence number.",
                  "LDA checks the booking details and shows the closest available instructor.",
                  "Choose a payment option and continue to secure Stripe Checkout.",
                  "After payment, you get a unique confirmation number and tracking access."
                ].map((step, index) => (
                  <div key={step} className="rounded bg-white p-4 text-sm font-bold leading-6 text-zinc-800">
                    <div className="mb-2 text-xl font-black text-brand">{index + 1}</div>
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <article className="mt-8 rounded bg-zinc-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded bg-black text-2xl font-black text-white">
                    {closestInstructor.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="inline-flex rounded bg-white px-2 py-1 text-xs font-black text-brand">Closest verified {closestInstructor.type}</div>
                    <h2 className="mt-2 text-3xl font-black">{closestInstructor.name}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-700">{closestInstructor.bio}</p>
                  </div>
                </div>
                <Link href="/learner-dashboard#tracking" className="lda-pill lda-pill-sm">Track after booking</Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><MapPin size={16} /> Distance</div>
                  <div className="mt-1 text-xl font-black">{closestInstructor.distance}</div>
                </div>
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CalendarClock size={16} /> Availability</div>
                  <div className="mt-1 text-xl font-black">{closestInstructor.next}</div>
                </div>
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><Star size={16} /> Rating</div>
                  <div className="mt-1 text-xl font-black">{closestInstructor.rating}</div>
                </div>
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CarFront size={16} /> Car</div>
                  <div className="mt-1 text-xl font-black">{closestInstructor.car}</div>
                </div>
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><BadgePoundSterling size={16} /> Standard rate</div>
                  <div className="mt-1 text-xl font-black">{formatMoney(standardPricePence)}/hr</div>
                </div>
                <div className="rounded bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><Clock3 size={16} /> Instant total</div>
                  <div className="mt-1 text-xl font-black">{formatMoney(instantLessonPricePence)}</div>
                  <div className="mt-1 text-xs font-bold text-brand">Includes {formatMoney(demandPremiumPence)} demand premium</div>
                </div>
              </div>
            </article>

            <div className="mt-8 rounded bg-black p-5 text-white">
              <h2 className="text-2xl font-black">What happens after payment?</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  "Stripe confirms your payment securely.",
                  "LDA gives you a unique confirmation reference.",
                  "A professional booking email is sent to the address you provide."
                ].map((item) => (
                  <div key={item} className="rounded bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <InstantLessonBooking
            instructorName={closestInstructor.name}
            instructorEmail="amelia.instructor@example.com"
            lessonSummary={lessonSummary}
            amountPence={instantLessonPricePence}
          />
        </div>
      </section>
    </main>
  );
}
