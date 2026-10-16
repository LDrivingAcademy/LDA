"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BadgeCheck, FileQuestion, ShieldX, type LucideIcon } from "lucide-react";
import {
  approveInstructorVerificationAction,
  rejectInstructorVerificationAction,
  requestInstructorNewDocumentsAction
} from "@/app/admin/instructors/actions";

type InstructorAdminActionsProps = {
  instructorId: string;
  instructorName: string;
  verificationStatus: string;
  complianceStatus: string;
  availabilityPaused: boolean;
};

export function InstructorAdminActions({
  instructorId,
  instructorName,
  verificationStatus,
  complianceStatus,
  availabilityPaused
}: InstructorAdminActionsProps) {
  const [panel, setPanel] = useState<"approve" | "reject" | "request" | null>(null);
  const approvedAndLocked =
    verificationStatus === "approved" &&
    complianceStatus === "clear" &&
    availabilityPaused;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={BadgeCheck}
          label="Approve verification"
          onClick={() => setPanel(panel === "approve" ? null : "approve")}
          disabled={approvedAndLocked}
        />
        <ActionButton
          icon={FileQuestion}
          label="Request new documents"
          onClick={() => setPanel(panel === "request" ? null : "request")}
        />
        <ActionButton
          icon={ShieldX}
          label="Reject verification"
          danger
          onClick={() => setPanel(panel === "reject" ? null : "reject")}
        />
      </div>

      {panel === "approve" ? (
        <Panel title={`Approve ${instructorName}`}>
          <form
            action={approveInstructorVerificationAction}
            onSubmit={(event) => {
              if (!window.confirm(`Approve ${instructorName}'s instructor verification? Previous approved document versions will be archived where replacements are approved.`)) {
                event.preventDefault();
              }
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="instructorId" value={instructorId} />
            <textarea
              name="reviewNote"
              rows={4}
              defaultValue="LDA reviewed the required instructor verification evidence and approved the account."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
            />
            <p className="text-xs font-bold leading-5 text-zinc-500">
              This confirms the instructor verification decision, keeps private evidence in the admin-only archive, and writes an audit record.
            </p>
            <SubmitButton label="Confirm approval" />
          </form>
        </Panel>
      ) : null}

      {panel === "request" ? (
        <Panel title={`Request new documents from ${instructorName}`}>
          <form action={requestInstructorNewDocumentsAction} className="grid gap-3">
            <input type="hidden" name="instructorId" value={instructorId} />
            <textarea
              name="reason"
              rows={4}
              defaultValue="LDA needs clearer or updated evidence before this instructor account can be approved. Please upload replacement documents from the instructor verification page."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
            />
            <p className="text-xs font-bold leading-5 text-zinc-500">
              This asks the instructor for replacement evidence. Existing approved versions stay active until a replacement is approved.
            </p>
            <SubmitButton label="Request new documents" />
          </form>
        </Panel>
      ) : null}

      {panel === "reject" ? (
        <Panel title={`Reject ${instructorName}`}>
          <form
            action={rejectInstructorVerificationAction}
            onSubmit={(event) => {
              if (!window.confirm(`Reject ${instructorName}'s instructor verification? Submitted versions will be kept in the private archive for audit history.`)) {
                event.preventDefault();
              }
            }}
            className="grid gap-3"
          >
            <input type="hidden" name="instructorId" value={instructorId} />
            <textarea
              name="reason"
              rows={4}
              defaultValue="LDA could not approve this instructor account from the evidence provided."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"
            />
            <SubmitButton label="Reject verification" danger />
          </form>
        </Panel>
      ) : null}
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
        disabled
          ? "cursor-not-allowed border-zinc-800 text-zinc-600"
          : danger
            ? "border-red-500/50 bg-red-700 text-white hover:bg-red-600"
            : "border-red-500/40 bg-red-600 text-white hover:bg-red-500"
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
      className={`rounded-full px-4 py-2 text-sm font-black text-white ${danger ? "bg-red-700 hover:bg-red-600" : "bg-red-600 hover:bg-red-500"}`}
    >
      {pending ? "Working..." : label}
    </button>
  );
}
