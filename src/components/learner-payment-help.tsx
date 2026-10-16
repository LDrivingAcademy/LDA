"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clipboard,
  CreditCard,
  ExternalLink,
  FileText,
  LifeBuoy,
  ReceiptText,
  RefreshCw,
  Search
} from "lucide-react";
import { submitPaymentSupportRequest } from "@/app/support/learner/payment-help/actions";
import type { FailedPayment, PaymentConfirmation, PaymentHelpData } from "@/lib/learner-payment-help";

type PaymentHelpSection = "confirmations" | "failed" | "refunds" | "support";

type LearnerPaymentHelpProps = PaymentHelpData & {
  message?: string;
  submitted?: string;
};

const sections: Array<{
  id: PaymentHelpSection;
  title: string;
  body: string;
  icon: typeof CreditCard;
}> = [
  { id: "confirmations", title: "Payment confirmation", body: "Find receipts, invoices, references, and the booking linked to a payment.", icon: ReceiptText },
  { id: "failed", title: "Failed payments", body: "See why a payment stopped and retry safely through the existing secure checkout.", icon: RefreshCw },
  { id: "refunds", title: "Request a refund", body: "Use the booking cancellation route first, then ask support to review exceptions.", icon: CreditCard },
  { id: "support", title: "Charge or payment issue", body: "Report a duplicate charge or send an unresolved payment problem to LDA.", icon: LifeBuoy }
];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const lessonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatDate(value: string, lessonOnly = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return (lessonOnly ? lessonDateFormatter : dateFormatter).format(date);
}

function formatAmount(amountPence: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountPence / 100);
  } catch {
    return `£${(amountPence / 100).toFixed(2)}`;
  }
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
      <ReceiptText className="mx-auto text-zinc-400" size={34} />
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl leading-7 text-zinc-600">{body}</p>
    </div>
  );
}

function PaymentActions({ payment }: { payment: PaymentConfirmation }) {
  const [copied, setCopied] = useState(false);
  const copyReference = async () => {
    await navigator.clipboard.writeText(payment.confirmationReference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" onClick={copyReference} className="inline-flex min-h-11 items-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-black hover:bg-zinc-100">
        {copied ? <Check size={17} /> : <Clipboard size={17} />}
        {copied ? "Copied" : "Copy reference"}
      </button>
      {payment.receiptUrl ? (
        <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-black hover:bg-zinc-100">
          <ReceiptText size={17} /> Download receipt
        </a>
      ) : null}
      {payment.invoiceUrl || payment.invoicePdfUrl ? (
        <a href={payment.invoiceUrl || payment.invoicePdfUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-black hover:bg-zinc-100">
          <FileText size={17} /> View invoice
        </a>
      ) : null}
      <Link href={payment.bookingHref} className="inline-flex min-h-11 items-center gap-2 rounded border border-zinc-300 bg-white px-4 text-sm font-black text-black hover:bg-zinc-100">
        Open booking <ExternalLink size={16} />
      </Link>
      {payment.confirmBookingUrl ? (
        <a href={payment.confirmBookingUrl} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand px-4 text-sm font-black text-white hover:bg-red-700">
          Confirm paid booking <Check size={17} />
        </a>
      ) : null}
    </div>
  );
}

function ConfirmationHistory({ payments }: { payments: PaymentConfirmation[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) =>
      [
        payment.confirmationReference,
        payment.bookingLabel,
        payment.tutor,
        payment.paymentMethod,
        payment.status,
        ...payment.bookingReferences
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [payments, search]);

  return (
    <section aria-labelledby="payment-confirmations-heading">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-black uppercase text-brand">Payment history</div>
          <h2 id="payment-confirmations-heading" className="mt-1 text-3xl font-black tracking-normal">Payment confirmations</h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-600">Only payments connected to your signed-in learner account are shown.</p>
        </div>
        <label className="relative block w-full md:max-w-sm">
          <span className="sr-only">Search payment history</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 text-zinc-500" size={19} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search booking, tutor, or reference"
            className="h-12 w-full rounded border border-zinc-300 bg-white pl-10 pr-3 font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-red-100"
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length ? filtered.map((payment) => (
          <article key={payment.id} className="border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-black uppercase text-green-800">{payment.status}</span>
                  <span className="text-sm font-bold text-zinc-500">{payment.confirmationReference}</span>
                </div>
                <h3 className="mt-3 text-2xl font-black">{payment.bookingLabel}</h3>
                <p className="mt-1 font-semibold text-zinc-600">{payment.tutor}</p>
              </div>
              <div className="text-left md:text-right">
                <div className="text-2xl font-black">{formatAmount(payment.amountPence, payment.currency)}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-500">{payment.currency}</div>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-y border-zinc-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs font-black uppercase text-zinc-500">Lesson date</dt><dd className="mt-1 font-bold">{payment.lessonDate ? formatDate(payment.lessonDate, true) : "Date pending"}</dd></div>
              <div><dt className="text-xs font-black uppercase text-zinc-500">Payment date</dt><dd className="mt-1 font-bold">{formatDate(payment.paymentDate)}</dd></div>
              <div><dt className="text-xs font-black uppercase text-zinc-500">Payment method</dt><dd className="mt-1 font-bold">{payment.paymentMethod}</dd></div>
              <div><dt className="text-xs font-black uppercase text-zinc-500">Lessons</dt><dd className="mt-1 font-bold">{payment.bookingReferences.length}</dd></div>
            </dl>
            <PaymentActions payment={payment} />
          </article>
        )) : (
          <EmptyState
            title={payments.length ? "No matching payments" : "No payment confirmations yet"}
            body={payments.length ? "Try another booking reference, tutor name, or payment detail." : "Payments will appear here after an LDA lesson checkout is connected to your learner account."}
          />
        )}
      </div>
    </section>
  );
}

function FailedPaymentHistory({ failures, onContact }: { failures: FailedPayment[]; onContact: () => void }) {
  return (
    <section aria-labelledby="failed-payments-heading">
      <div className="border-b border-zinc-200 pb-6">
        <div className="text-sm font-black uppercase text-brand">Automatic recovery</div>
        <h2 id="failed-payments-heading" className="mt-1 text-3xl font-black tracking-normal">Failed payments</h2>
        <p className="mt-2 max-w-2xl leading-7 text-zinc-600">Retry an eligible checkout without creating a second booking or payment flow.</p>
      </div>
      <div className="mt-6 space-y-4">
        {failures.length ? failures.map((failure) => (
          <article key={failure.id} className="border border-red-200 bg-red-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-brand" size={23} />
              <div className="min-w-0">
                <div className="text-sm font-black uppercase text-brand">{failure.bookingReference}</div>
                <h3 className="mt-1 text-xl font-black">{failure.bookingLabel}</h3>
                <p className="mt-3 leading-7 text-zinc-700">{failure.failureReason}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs font-black uppercase text-zinc-500">Payment status</dt><dd className="mt-1 font-bold capitalize">{failure.stripeError}</dd></div>
                  <div><dt className="text-xs font-black uppercase text-zinc-500">Attempted</dt><dd className="mt-1 font-bold">{formatDate(failure.attemptedAt)}</dd></div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {failure.retryUrl ? (
                    <a href={failure.retryUrl} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand px-4 text-sm font-black text-white hover:bg-red-700">
                      Retry payment <RefreshCw size={17} />
                    </a>
                  ) : (
                    <button type="button" onClick={onContact} className="inline-flex min-h-11 items-center gap-2 rounded bg-black px-4 text-sm font-black text-white hover:bg-zinc-800">
                      Contact support <LifeBuoy size={17} />
                    </button>
                  )}
                  <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded border border-zinc-300 bg-white px-4 text-sm font-black hover:bg-zinc-100">
                    Change lesson or instructor
                  </Link>
                </div>
              </div>
            </div>
          </article>
        )) : (
          <EmptyState title="No failed payments found" body="There are no incomplete payment attempts linked to this learner account." />
        )}
      </div>
    </section>
  );
}

function BookingOptions({ payments, failures = [] }: { payments: PaymentConfirmation[]; failures?: FailedPayment[] }) {
  return (
    <>
      <option value="">Choose a booking</option>
      {payments.flatMap((payment) =>
        payment.bookingReferences.map((reference) => (
          <option key={reference} value={reference}>{reference} - {payment.tutor}</option>
        ))
      )}
      {failures.map((failure) => (
        <option key={failure.id} value={failure.supportValue}>{failure.bookingReference} - failed checkout</option>
      ))}
    </>
  );
}

function SupportForm({
  payments,
  failures = [],
  requestType,
  title,
  body,
  submitLabel
}: {
  payments: PaymentConfirmation[];
  failures?: FailedPayment[];
  requestType: "refund" | "duplicate" | "other";
  title: string;
  body: string;
  submitLabel: string;
}) {
  return (
    <form id={requestType === "other" ? "payment-support-form" : undefined} action={submitPaymentSupportRequest} className="border border-zinc-200 bg-zinc-50 p-5 sm:p-6">
      <input type="hidden" name="requestType" value={requestType} />
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-2 max-w-2xl leading-7 text-zinc-600">{body}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="font-black">
          Booking
          <select name="paymentContext" required className="mt-2 h-12 w-full rounded border border-zinc-300 bg-white px-3 font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-red-100">
            <BookingOptions payments={payments} failures={failures} />
          </select>
        </label>
        <label className="font-black">
          Payment date, if known
          <input type="date" name="paymentDate" className="mt-2 h-12 w-full rounded border border-zinc-300 bg-white px-3 font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-red-100" />
        </label>
        <label className="font-black sm:col-span-2">
          Amount shown, if relevant
          <input name="amount" inputMode="decimal" maxLength={30} placeholder="For example, £42.00" className="mt-2 h-12 w-full rounded border border-zinc-300 bg-white px-3 font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-red-100" />
        </label>
        <label className="font-black sm:col-span-2">
          What happened?
          <textarea name="details" required minLength={15} maxLength={2200} rows={5} placeholder="Explain what you expected and what the payment or booking showed." className="mt-2 w-full rounded border border-zinc-300 bg-white p-3 font-semibold leading-7 outline-none focus:border-brand focus:ring-2 focus:ring-red-100" />
        </label>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-zinc-600">Do not enter a full card number, security code, password, or bank details.</p>
      <button type="submit" disabled={!payments.length && !failures.length} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded bg-brand px-5 font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-400">
        {submitLabel} <ExternalLink size={17} />
      </button>
    </form>
  );
}

export function LearnerPaymentHelp({ confirmations, failedPayments, stripeAvailable, message, submitted }: LearnerPaymentHelpProps) {
  const [section, setSection] = useState<PaymentHelpSection>("confirmations");
  const openSupportForm = () => {
    setSection("support");
    window.setTimeout(() => document.getElementById("payment-support-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <>
      {submitted ? (
        <div role="status" className="mb-6 border border-green-300 bg-green-50 px-5 py-4 font-bold text-green-900">
          Your request has been sent to LDA support. Reference: {submitted}
        </div>
      ) : null}
      {message ? <div role="alert" className="mb-6 border border-red-300 bg-red-50 px-5 py-4 font-bold text-red-900">{message}</div> : null}
      {!stripeAvailable ? (
        <div role="status" className="mb-6 border border-amber-300 bg-amber-50 px-5 py-4 font-bold text-amber-950">
          Live payment details are temporarily unavailable. Your saved LDA booking references are still shown and support requests remain available.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Payment help sections">
        {sections.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSection(item.id)}
              className={`min-h-[178px] rounded border p-5 text-left transition ${active ? "border-brand bg-red-50 shadow-sm" : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"}`}
            >
              <Icon className={active ? "text-brand" : "text-zinc-500"} size={27} />
              <span className="mt-5 block text-xl font-black">{item.title}</span>
              <span className="mt-2 block leading-6 text-zinc-600">{item.body}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-10">
        {section === "confirmations" ? <ConfirmationHistory payments={confirmations} /> : null}
        {section === "failed" ? <FailedPaymentHistory failures={failedPayments} onContact={openSupportForm} /> : null}
        {section === "refunds" ? (
          <section aria-labelledby="refund-request-heading">
            <div className="border-b border-zinc-200 pb-6">
              <div className="text-sm font-black uppercase text-brand">Existing refund workflow</div>
              <h2 id="refund-request-heading" className="mt-1 text-3xl font-black tracking-normal">Request a refund</h2>
              <p className="mt-2 max-w-3xl leading-7 text-zinc-600">For an upcoming lesson, use booking cancellation first. LDA will calculate the policy outcome and handle an eligible refund through the existing payment record.</p>
              <Link href="/booking-history?from=support" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded border border-black bg-white px-5 font-black text-black hover:bg-zinc-100">
                Booking history <ExternalLink size={17} />
              </Link>
            </div>
            <div className="mt-6">
              <SupportForm
                payments={confirmations}
                requestType="refund"
                title="Refund review"
                body="Use this only when the booking cancellation route cannot resolve the refund, or the lesson has already taken place."
                submitLabel="Send refund request"
              />
            </div>
          </section>
        ) : null}
        {section === "support" ? (
          <section aria-labelledby="payment-support-heading">
            <div className="border-b border-zinc-200 pb-6">
              <div className="text-sm font-black uppercase text-brand">Support escalation</div>
              <h2 id="payment-support-heading" className="mt-1 text-3xl font-black tracking-normal">Charge or payment issue</h2>
              <p className="mt-2 max-w-3xl leading-7 text-zinc-600">Duplicate charges are marked urgent. LDA support receives the booking and payment context automatically.</p>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <SupportForm
                payments={confirmations}
                requestType="duplicate"
                title="Report a duplicate charge"
                body="Tell us which payment appears more than once and when each charge was shown."
                submitLabel="Report duplicate charge"
              />
              <SupportForm
                payments={confirmations}
                failures={failedPayments}
                requestType="other"
                title="Contact payment support"
                body="Send an unresolved payment or booking-charge problem after the automatic options have not fixed it."
                submitLabel="Create support ticket"
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
