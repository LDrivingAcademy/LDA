import { redirect } from "next/navigation";
import Image from "next/image";
import { CalendarDays, CheckCircle2, CreditCard, Hash, Mail, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { ReceiptPrintButton } from "@/components/receipt-print-button";
import { SiteFooter } from "@/components/site-footer";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { LDA_WEB_LOGO } from "@/lib/brand-assets";
import { getLearnerPaymentHelpData, type PaymentConfirmation } from "@/lib/learner-payment-help";
import { requireSignedInPage } from "@/lib/page-auth";
import { getStripeRuntimeMode } from "@/lib/stripe-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Payment receipt | L Driving Academy",
  robots: {
    index: false,
    follow: false
  }
};

type PaymentReceiptPageProps = {
  params: Promise<{ paymentId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const lessonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

function formatDate(value: string | null, lessonOnly = false) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return (lessonOnly ? lessonDateFormatter : dateFormatter).format(date);
}

function formatAmount(amountPence: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountPence / 100);
  } catch {
    return `${currency.toUpperCase()} ${(amountPence / 100).toFixed(2)}`;
  }
}

function Detail({
  icon: Icon,
  label,
  value,
  multiline = false
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex min-h-[122px] gap-4 border-b border-zinc-200 p-5 sm:p-6">
      <Icon className="mt-1 shrink-0 text-brand" size={30} strokeWidth={2.2} />
      <div className="min-w-0">
        <dt className="text-xs font-black uppercase text-zinc-700 sm:text-sm">{label}</dt>
        <dd className={`mt-2 break-words text-base font-bold leading-relaxed text-zinc-950 sm:text-lg ${multiline ? "font-semibold" : ""}`}>{value}</dd>
      </div>
    </div>
  );
}

function ReceiptCard({ payment, isSandbox }: { payment: PaymentConfirmation; isSandbox: boolean }) {
  const amount = formatAmount(payment.amountPence, payment.currency);
  const payerName = payment.tutor && payment.tutor !== "LDA instructor" ? payment.tutor : "your instructor";
  const bookingDescription =
    payment.bookingLabel || `Your LDA lesson has been confirmed${payerName ? ` with ${payerName}` : ""}.`;

  return (
    <article className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl shadow-black/10 print:shadow-none">
      <header className="flex flex-col gap-8 bg-black px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-11 sm:py-10">
        <Image
          src={LDA_WEB_LOGO.src}
          alt="L Driving Academy"
          width={LDA_WEB_LOGO.width}
          height={LDA_WEB_LOGO.height}
          priority
          className="h-16 w-auto object-contain sm:h-20"
        />
        <div className="text-left sm:text-right">
          <p className="text-3xl font-black tracking-normal sm:text-4xl">Payment Receipt</p>
          {isSandbox ? <p className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-white/60">Sandbox preview</p> : null}
        </div>
      </header>

      <div className="px-6 py-9 sm:px-11 sm:py-11">
        <section className="grid gap-8 sm:grid-cols-[1fr_292px] sm:items-start">
          <div className="flex min-h-[210px] flex-col justify-center">
            <h1 className="text-3xl font-black tracking-normal text-zinc-950 sm:text-4xl">Thank you</h1>
            <p className="mt-4 max-w-xl text-lg font-medium leading-relaxed text-zinc-950">
              Your payment has been received and your lesson is confirmed.
            </p>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-black uppercase text-zinc-600">Amount paid</p>
            <p className="mt-4 text-5xl font-black tracking-tight text-black sm:text-6xl">{amount}</p>
            <p className="mt-2 text-lg font-bold uppercase text-zinc-500">{payment.currency}</p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-base font-black text-green-700">
              <CheckCircle2 size={20} /> {payment.status}
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center gap-4 pb-5">
            <ReceiptText className="text-brand" size={32} />
            <h2 className="text-xl font-black uppercase tracking-normal text-zinc-950">Receipt details</h2>
          </div>

          <dl className="grid border-t border-zinc-200 sm:grid-cols-2">
            <Detail icon={Hash} label="Confirmation reference" value={payment.confirmationReference} />
            <Detail icon={CalendarDays} label="Payment date" value={formatDate(payment.paymentDate)} />
            <Detail icon={CalendarDays} label="Lesson date" value={formatDate(payment.lessonDate, true)} />
            <Detail icon={UserRound} label="Instructor" value={payment.tutor} />
            <Detail icon={CreditCard} label="Payment method" value={payment.paymentMethod} />
            <Detail icon={ReceiptText} label="Booking" value={bookingDescription} multiline />
          </dl>
        </section>

        <div className="mt-8 rounded-md border border-zinc-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-black uppercase text-zinc-600">Booking reference{payment.bookingReferences.length > 1 ? "s" : ""}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {payment.bookingReferences.map((reference) => (
              <span key={reference} className="text-lg font-black text-zinc-950">
                {reference}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-md border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <ShieldCheck className="shrink-0 text-brand" size={38} />
            <p className="text-base font-medium leading-relaxed text-zinc-950">
              If you need help with this payment, please visit our payment help page.
            </p>
          </div>
          <p className="text-base font-semibold text-zinc-950">www.ldrivingacademy.co.uk</p>
        </div>
      </div>

      <div className="grid bg-brand text-white print:hidden sm:grid-cols-2">
        <ReceiptPrintButton className="inline-flex min-h-20 items-center justify-center gap-3 px-5 text-base font-black text-white hover:bg-red-700" />
        <a href="/support/learner/payment-help" className="inline-flex min-h-20 items-center justify-center gap-3 border-t border-white/40 px-5 text-base font-black text-white hover:bg-red-700 sm:border-l sm:border-t-0">
          <Mail size={24} /> Back to payment help
        </a>
      </div>

      <footer className="border-t border-zinc-200 px-6 py-5 text-center text-base font-medium text-zinc-500 sm:px-11">
        L Driving Academy <span className="px-3">|</span> Thank you for choosing LDA.
        <p className="mt-2 font-semibold text-zinc-600">Thank you for your custom.</p>
      </footer>
      <div className="hidden print:block px-6 pb-6 text-center text-base font-semibold text-zinc-950">
        Thank you for your custom.
      </div>
    </article>
  );
}

export default async function PaymentReceiptPage({ params }: PaymentReceiptPageProps) {
  const { paymentId } = await params;
  const { supabase, user } = await requireSignedInPage("Sign in to view your LDA receipt.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");

  const paymentData = await getLearnerPaymentHelpData(supabase, user.id);
  const payment = paymentData.confirmations.find((confirmation) => confirmation.id === paymentId);

  if (!payment) {
    redirect("/support/learner/payment-help?message=That receipt could not be found for this learner account.");
  }

  return (
    <>
      <PageTopBar backHref="/support/learner/payment-help" backLabel="Back to payment help" />
      <main className="min-h-screen bg-zinc-100 px-4 py-8 text-black sm:px-6 lg:px-8">
        <ReceiptCard payment={payment} isSandbox={getStripeRuntimeMode() === "test"} />
      </main>
      <SiteFooter />
    </>
  );
}
