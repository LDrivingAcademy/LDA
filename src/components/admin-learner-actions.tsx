"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Mail, ShieldOff, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import {
  sendLearnerCampaignAction,
  sendLearnerPromoAction,
  sendLearnerWarningAction,
  suspendLearnerAccountAction,
  upgradeLearnerTierAction
} from "@/app/admin/learners/actions";

type LearnerAdminActionsProps = {
  learnerId: string;
  learnerName: string;
  marketingOptIn: boolean;
  currentPackage: string;
};

export function LearnerCampaignAction({ learnerIds }: { learnerIds: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-black hover:border-red-500 hover:text-brand"
      >
        Send campaign to all consented learners
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,28rem)] rounded border border-zinc-800 bg-black p-4 shadow-2xl">
          <form action={sendLearnerCampaignAction} className="grid gap-3">
            <input type="hidden" name="learnerIds" value={learnerIds.join(",")} />
            <p className="text-xs font-semibold leading-5 text-zinc-400">
              Sends email to consented learner accounts and Follow LDA subscribers. Learner accounts also receive a notification.
            </p>
            <label className="grid gap-1 text-sm font-bold text-zinc-300">
              Subject
              <input name="subject" defaultValue="LDA learner update" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-zinc-300">
              Message
              <textarea name="body" rows={4} defaultValue="A new L Driving Academy learner update is available." className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
            </label>
            <PromoCodeFields defaultMaxRedemptions={Math.max(1, learnerIds.length)} />
            <button type="submit" className="rounded-full border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500 lda-red-pill">
              Send to {learnerIds.length} consented learner{learnerIds.length === 1 ? "" : "s"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function LearnerAdminActions({ learnerId, learnerName, marketingOptIn, currentPackage }: LearnerAdminActionsProps) {
  const [panel, setPanel] = useState<"upgrade" | "promo" | "warning" | "suspend" | null>(null);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <ActionButton icon={Sparkles} label="Upgrade tier for free" onClick={() => setPanel(panel === "upgrade" ? null : "upgrade")} />
        <ActionButton
          icon={Mail}
          label={marketingOptIn ? "Send selected promo" : "Promo blocked: no consent"}
          onClick={() => marketingOptIn && setPanel(panel === "promo" ? null : "promo")}
          disabled={!marketingOptIn}
        />
        <ActionButton icon={TriangleAlert} label="Send warning" onClick={() => setPanel(panel === "warning" ? null : "warning")} />
        <ActionButton icon={ShieldOff} label="Revoke / suspend account" danger onClick={() => setPanel(panel === "suspend" ? null : "suspend")} />
      </div>

      {panel === "upgrade" ? (
        <Panel title={`Upgrade ${learnerName}`}>
          <form action={upgradeLearnerTierAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="learnerId" value={learnerId} />
            <select name="package" defaultValue={currentPackage || "learner-plus"} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white">
              <option value="learner">Learner</option>
              <option value="learner-plus">Learner Plus</option>
              <option value="learner-pro">Learner Pro</option>
            </select>
            <SubmitButton label="Apply tier" />
          </form>
        </Panel>
      ) : null}

      {panel === "promo" ? (
        <Panel title={`Promo for ${learnerName}`}>
          <form action={sendLearnerPromoAction} className="grid gap-3">
            <input type="hidden" name="learnerId" value={learnerId} />
            <input name="subject" defaultValue="LDA learner offer" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
            <textarea name="body" rows={3} defaultValue="A selected L Driving Academy offer is available on your learner account." className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
            <PromoCodeFields defaultMaxRedemptions={1} forceGenerate />
            <SubmitButton label="Send promo" />
          </form>
        </Panel>
      ) : null}

      {panel === "warning" ? (
        <Panel title={`Warning for ${learnerName}`}>
          <form action={sendLearnerWarningAction} className="grid gap-3">
            <input type="hidden" name="learnerId" value={learnerId} />
            <label className="grid gap-1 text-sm font-bold text-zinc-300">
              Warning subject
              <input name="subject" defaultValue="Important update about your LDA account" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
            </label>
            <label className="grid gap-1 text-sm font-bold text-zinc-300">
              Warning reason
              <textarea
                name="body"
                rows={4}
                defaultValue="Following a review of recent account activity, we have identified booking, cancellation, refund, or account-use patterns that may not meet LDA platform standards. Please review your recent activity and ensure future bookings, cancellations, and refund requests are made in line with LDA policy. Continued activity outside these standards may result in temporary account restrictions or suspension of learner booking access."
                className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
              />
            </label>
            <SubmitButton label="Send warning" />
          </form>
        </Panel>
      ) : null}

      {panel === "suspend" ? (
        <Panel title={`Suspend ${learnerName}`}>
          <form
            action={suspendLearnerAccountAction}
            onSubmit={(event) => {
              if (!window.confirm(`Are you sure you want to suspend ${learnerName}?`)) {
                event.preventDefault();
              }
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="learnerId" value={learnerId} />
            <select name="duration" defaultValue="2-months" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white">
              <option value="7-days">Suspend for 7 days</option>
              <option value="2-months">Suspend for 2 months</option>
              <option value="1-year">Suspend for 1 year</option>
              <option value="indefinite">Suspend indefinitely</option>
            </select>
            <textarea
              name="reason"
              rows={4}
              defaultValue="Account suspended by LDA admin for policy or fraud review."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
            />
            <SubmitButton label="Confirm suspension" danger />
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

function PromoCodeFields({
  defaultMaxRedemptions,
  forceGenerate = false
}: {
  defaultMaxRedemptions: number;
  forceGenerate?: boolean;
}) {
  return (
    <div className="grid gap-3 rounded border border-zinc-800 bg-black/40 p-3">
      <label className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-300">
        <input
          name="generateStripePromo"
          type="checkbox"
          value="on"
          defaultChecked
          disabled={forceGenerate}
          className="mt-1 accent-red-600"
        />
        <span>
          Generate Stripe promo code
          <span className="block text-xs font-semibold text-zinc-500">
            Users enter this code inside Stripe Checkout. Stripe enforces expiry and redemption limits.
          </span>
        </span>
      </label>
      {forceGenerate ? <input type="hidden" name="generateStripePromo" value="on" /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Code optional
          <input name="promoCode" placeholder="Auto if blank" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white placeholder:text-zinc-500" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Discount type
          <select name="promoDiscountType" defaultValue="percent" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white">
            <option value="percent">Percent off</option>
            <option value="amount">Pounds off</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Percent off
          <input name="promoPercentOff" type="number" min={1} max={95} defaultValue={10} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Pounds off
          <input name="promoAmountOffPounds" type="number" min={1} max={1000} step="0.01" defaultValue={5} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Valid days
          <input name="promoValidDays" type="number" min={1} max={365} defaultValue={30} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Max redemptions
          <input name="promoMaxRedemptions" type="number" min={1} max={100000} defaultValue={defaultMaxRedemptions} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Discount duration
          <select name="promoDuration" defaultValue="once" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white">
            <option value="once">One checkout / first invoice</option>
            <option value="forever">Ongoing subscription discount</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500">
          <input name="promoNoRedemptionLimit" type="checkbox" className="accent-red-600" />
          No redemption limit
        </label>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${
        danger
          ? "border-red-500/50 bg-red-600 text-white hover:bg-red-500 lda-red-pill"
          : disabled
            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500"
            : "border-zinc-300 bg-white text-black hover:border-red-500 hover:text-brand"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-4">
      <h4 className="text-sm font-black uppercase text-red-200">{title}</h4>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SubmitButton({ label, danger = false }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-full px-4 py-2 text-sm font-black ${
        danger
          ? "border border-red-500/50 bg-red-700 text-white hover:bg-red-600 lda-red-pill"
          : "border border-zinc-300 bg-white text-black hover:border-red-500 hover:text-brand"
      }`}
    >
      {pending ? "Working..." : label}
    </button>
  );
}
