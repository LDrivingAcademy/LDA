import Link from "next/link";
import { BadgeCheck, Mail } from "lucide-react";
import { InstantConfirmationEmail } from "@/components/instant-confirmation-email";
import { PageTopBar } from "@/components/page-top-bar";

export default async function InstantLessonConfirmedPage({
  searchParams
}: {
  searchParams: Promise<{
    reference?: string;
    email?: string;
    phone?: string;
    name?: string;
    instructor?: string;
    summary?: string;
  }>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? "LDA-PENDING";
  const learnerEmail = params.email ?? "";
  const learnerPhone = params.phone ?? "";
  const learnerName = params.name ?? "Learner";
  const instructorName = params.instructor ?? "your LDA instructor";
  const lessonSummary = params.summary ?? `Instant lesson with ${instructorName}`;

  return (
    <>
      <PageTopBar />
      <main className="min-h-screen bg-white text-black">
        <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mt-8 rounded bg-zinc-100 p-6 text-center sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-brand">
            <BadgeCheck size={34} />
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
            Thank you for booking with L Driving Academy.
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-700">
            Keep this unique confirmation number ready so your instructor can match the booking to you.
          </p>

          <div className="mx-auto mt-6 max-w-md rounded bg-black p-5 text-white">
            <div className="text-sm font-black uppercase text-red-200">Confirmation number</div>
            <div className="mt-2 break-all font-mono text-3xl font-black">{reference}</div>
          </div>

          <div className="mt-6 rounded bg-white p-4 text-left">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 text-brand" size={22} />
              <div>
                <div className="font-black">Confirmation email</div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  A professional confirmation email with this reference number will be sent to {learnerEmail || "the email address provided"}. If a phone number was provided, LDA will also send a text confirmation.
                </p>
              </div>
            </div>
            {learnerEmail ? (
              <InstantConfirmationEmail
                reference={reference}
                learnerEmail={learnerEmail}
                learnerPhone={learnerPhone}
                learnerName={learnerName}
                instructorName={instructorName}
                lessonSummary={lessonSummary}
              />
            ) : null}
          </div>

          <Link href="/learner-dashboard#tracking" className="lda-pill mt-8">
            Open live tracking preview
          </Link>
        </div>
        </section>
      </main>
    </>
  );
}
