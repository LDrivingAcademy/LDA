import { Workflow } from "lucide-react";

type TechnicalSupportOperatingModelProps = {
  className?: string;
};

export function TechnicalSupportOperatingModel({ className = "" }: TechnicalSupportOperatingModelProps) {
  return (
    <article className={`rounded border border-zinc-800 bg-zinc-950 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
          <Workflow size={22} />
        </div>
        <div>
          <div className="text-sm font-black uppercase text-red-200">Operating model</div>
          <h2 className="mt-1 text-2xl font-black">Support team command workflow</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
            Use this structure to triage, investigate, escalate, and close technical support work consistently without giving support staff admin-level control.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RunbookCard
          title="1. Triage"
          body="Check critical cases, SLA overdue items, new AI handoffs, then repeat incidents. Confirm category, severity, priority, and owner."
        />
        <RunbookCard
          title="2. Investigate"
          body="Review transcript, AI summary, diagnostics, booking context, affected routes, and related incidents before contacting admin."
        />
        <RunbookCard
          title="3. Escalate"
          body="Send to admin only when a business decision, account change, payment action, safeguarding review, or code fix is required."
        />
        <RunbookCard
          title="4. Close"
          body="Save a customer-safe summary, internal note, resolution evidence, and handover details before marking resolved."
        />
      </div>
    </article>
  );
}

function RunbookCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-sm font-black text-white">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{body}</p>
    </div>
  );
}
