import Link from "next/link";
import { AlertTriangle, CalendarCheck, CreditCard, FileText, MessageSquareWarning, ShieldCheck, Star, TrendingUp } from "lucide-react";

type PlatformProtectionPanelProps = {
  audience: "learner" | "instructor" | "owner";
  compact?: boolean;
};

const learnerItems = [
  { icon: CreditCard, title: "Payment protection", body: "Refund reviews, payment references, and dispute evidence only apply to lessons booked and paid through LDA." },
  { icon: CalendarCheck, title: "Booking record", body: "Your lesson time, pickup area, instructor, cancellation status, and progress history stay in your dashboard." },
  { icon: MessageSquareWarning, title: "Report off-platform requests", body: "If an instructor asks for cash, bank transfer, or a private booking, report it so LDA can protect your account." }
];

const instructorItems = [
  { icon: Star, title: "Ranking depends on platform bookings", body: "Search visibility, reviews, repeat learner signals, and priority support are based on completed LDA bookings." },
  { icon: CreditCard, title: "Payout and admin records", body: "LDA bookings create cleaner payment, cancellation, tax, dispute, and learner progress records for self-employed instructors." },
  { icon: ShieldCheck, title: "Client ownership rules", body: "Learners introduced by LDA must be managed on LDA for booking, payment, cancellation, rescheduling, and progress updates." }
];

const ownerItems = [
  { icon: TrendingUp, title: "Retention moat", body: "LDA is positioned as the instructor operating system, not a one-time lead finder." },
  { icon: AlertTriangle, title: "Leakage detection", body: "Track suspicious patterns such as first-lesson-only instructors, repeated cancellations after contact, and learner reports." },
  { icon: FileText, title: "Contract enforcement", body: "Terms define LDA-introduced learners, anti-circumvention obligations, and account consequences for repeat breaches." }
];

export function PlatformProtectionPanel({ audience, compact = false }: PlatformProtectionPanelProps) {
  const items = audience === "learner" ? learnerItems : audience === "instructor" ? instructorItems : ownerItems;
  const reportHref =
    audience === "instructor"
      ? "mailto:info@ldrivingacademy.co.uk?subject=Instructor%20platform%20protection%20support"
      : "mailto:info@ldrivingacademy.co.uk?subject=Report%20off-platform%20booking%20request";

  return (
    <section className={`rounded border border-zinc-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
        <ShieldCheck size={16} /> LDA Protect
      </div>
      <h2 className={`${compact ? "mt-2 text-xl" : "mt-3 text-2xl"} font-black`}>
        Keep bookings, payments, and progress on LDA.
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
        Platform protections only work when the lesson is booked and managed inside LDA.
      </p>
      <div className={`mt-4 grid gap-3 ${compact ? "" : "md:grid-cols-3"}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded border border-zinc-200 bg-zinc-50 p-3">
              <Icon size={18} className="text-brand" />
              <h3 className="mt-2 text-sm font-black">{item.title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-zinc-600">{item.body}</p>
            </article>
          );
        })}
      </div>
      {audience === "owner" ? (
        <Link href="/terms" className="lda-pill lda-pill-sm mt-4">
          Review platform terms
        </Link>
      ) : (
        <a href={reportHref} className="lda-pill lda-pill-sm mt-4">
          {audience === "learner" ? "Report off-platform request" : "Ask about platform rules"}
        </a>
      )}
    </section>
  );
}
