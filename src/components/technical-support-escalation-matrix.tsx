import { AlertTriangle, Clock3, FileCheck2, ShieldCheck } from "lucide-react";

type TechnicalSupportEscalationMatrixProps = {
  className?: string;
};

const severityRows = [
  {
    severity: "SEV1 critical",
    trigger: "Payments, auth, live tracking, booking acceptance, or broad site access is failing for multiple users.",
    response: "Immediate triage",
    route: "Link affected tickets, open or update an incident, and send to admin if a supplier, payment, account, or code decision is needed."
  },
  {
    severity: "SEV2 high",
    trigger: "A key journey is degraded, blocked for one confirmed user, or repeatedly reported.",
    response: "Same shift",
    route: "Assign an owner, capture reproduction steps, add diagnostics, and escalate if customer/account action is outside support authority."
  },
  {
    severity: "SEV3 standard",
    trigger: "Single-user help, navigation, account guidance, unclear booking/payment status, or non-urgent support request.",
    response: "Working day",
    route: "Use the transcript, page path, account role, and booking context to guide the customer or route cleanly."
  },
  {
    severity: "SEV4 low",
    trigger: "Product feedback, wording issues, small visual defects, or improvement ideas without customer impact.",
    response: "Backlog review",
    route: "Summarise the signal, group repeat reports, and send to admin only when a product or policy decision is required."
  }
];

const checklist = [
  "Owner assigned",
  "Customer-safe summary saved",
  "Issue category, priority, and severity checked",
  "Affected route, device, and time recorded where available",
  "Related incident linked when repeat or service-wide",
  "Next customer update or admin action is clear"
];

export function TechnicalSupportEscalationMatrix({ className = "" }: TechnicalSupportEscalationMatrixProps) {
  return (
    <section className={`grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] ${className}`}>
      <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
            <Clock3 size={22} />
          </div>
          <div>
            <div className="text-sm font-black uppercase text-red-200">Severity and SLA matrix</div>
            <h2 className="mt-1 text-2xl font-black">How support work is prioritised</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
              Use the same severity language on tickets, incidents, admin escalations, and shift handovers so the next operator understands impact immediately.
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto rounded border border-zinc-800">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[150px_minmax(240px,1fr)_130px_minmax(260px,1fr)] bg-black px-4 py-3 text-xs font-black uppercase text-zinc-500">
              <div>Severity</div>
              <div>When to use it</div>
              <div>Response</div>
              <div>Route</div>
            </div>
            {severityRows.map((row) => (
              <div key={row.severity} className="grid grid-cols-[150px_minmax(240px,1fr)_130px_minmax(260px,1fr)] border-t border-zinc-800 px-4 py-4 text-sm">
                <div className="font-black text-white">{row.severity}</div>
                <div className="font-semibold leading-6 text-zinc-300">{row.trigger}</div>
                <div className="font-black text-red-100">{row.response}</div>
                <div className="font-semibold leading-6 text-zinc-400">{row.route}</div>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-sm font-black uppercase text-red-200">Escalation guardrails</div>
            <h2 className="mt-1 text-2xl font-black">What support can and cannot do</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <RuleCard
            icon={FileCheck2}
            title="Support handles"
            body="Triage, diagnosis, customer-safe updates, incident linking, evidence capture, knowledge gaps, and clean handoff notes."
          />
          <RuleCard
            icon={AlertTriangle}
            title="Admin approval required"
            body="Refunds, payment changes, booking amendments, account changes, instructor approvals, safeguarding decisions, policy exceptions, and supplier changes."
          />
          <RuleCard
            icon={ShieldCheck}
            title="Data limits"
            body="Never store card details, passwords, security codes, private documents, raw personal data, or internal-only diagnostics in customer-facing notes."
          />
        </div>

        <div className="mt-5 rounded border border-zinc-800 bg-black p-4">
          <div className="text-xs font-black uppercase text-zinc-500">Before resolve or handoff</div>
          <ul className="mt-3 grid gap-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm font-semibold leading-6 text-zinc-300">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}

function RuleCard({
  icon: Icon,
  title,
  body
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <Icon className="text-brand" size={20} />
      <div className="mt-3 text-sm font-black text-white">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{body}</p>
    </div>
  );
}
