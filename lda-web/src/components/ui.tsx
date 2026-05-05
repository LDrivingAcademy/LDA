export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded border border-border bg-card p-5 ${className}`}>{children}</section>;
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-border bg-card p-4">
      <div className="text-sm font-semibold text-muted">{label}</div>
      <div className="mt-2 text-2xl font-black text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted">{detail}</div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-800"
  };
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export const buttonClass = "inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong focus-ring";
export const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded border border-border bg-white px-4 py-2 text-sm font-bold text-foreground hover:bg-background focus-ring";
