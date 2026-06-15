import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, FileWarning, Mail, ShieldCheck, Upload } from "lucide-react";

import { PageTopBar } from "@/components/page-top-bar";
import { uploadInstructorVerificationDocument } from "@/app/instructor-verification/actions";
import { getInstructorVerificationDisplay, getInstructorVerificationDisplayFromEvidence } from "@/lib/instructor-verification-status";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type InstructorVerificationPageProps = {
  searchParams?: PageSourceSearchParams;
};

type DocumentType =
  | "adi_pdi_badge"
  | "driving_licence"
  | "proof_of_id"
  | "insurance"
  | "dbs_check"
  | "vehicle_photo"
  | "other";

type DocumentRow = {
  id: string;
  document_type: DocumentType;
  storage_path: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
};

const requiredDocuments: Array<{ type: DocumentType; label: string; detail: string }> = [
  {
    type: "adi_pdi_badge",
    label: "ADI/PDI badge or certificate",
    detail: "Confirms the instructor registration route attached to this LDA account."
  },
  {
    type: "driving_licence",
    label: "Driving licence",
    detail: "Confirms entitlement evidence for instructor onboarding review."
  },
  {
    type: "insurance",
    label: "Insurance certificate",
    detail: "Confirms professional cover evidence before approval."
  }
];

const supportingDocuments: Array<{ type: DocumentType; label: string; detail: string }> = [
  {
    type: "proof_of_id",
    label: "Proof of ID",
    detail: "Useful if LDA support asks for identity evidence during review."
  },
  {
    type: "dbs_check",
    label: "DBS check",
    detail: "Useful supporting evidence for safeguarding and trust checks."
  },
  {
    type: "vehicle_photo",
    label: "Vehicle photo",
    detail: "Useful once the public instructor profile is prepared."
  }
];

function formatDate(value?: string | null) {
  if (!value) {
    return "Not reviewed yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function fileNameFromPath(path?: string | null) {
  return path?.split("/").pop()?.replace(/^[a-f0-9-]+-/i, "") || "Uploaded file";
}

function getLatestDocument(documents: DocumentRow[], type: DocumentType) {
  return documents.find((document) => document.document_type === type) ?? null;
}

async function getDocumentLinks(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, documents: DocumentRow[]) {
  const entries = await Promise.all(
    documents.map(async (document) => {
      try {
        const { data } = await supabase.storage.from("instructor-documents").createSignedUrl(document.storage_path, 300);
        return [document.id, data?.signedUrl ?? null] as const;
      } catch {
        return [document.id, null] as const;
      }
    })
  );

  return new Map(entries);
}

export default async function InstructorVerificationPage({ searchParams }: InstructorVerificationPageProps) {
  const resolvedSearchParams = await searchParams;
  const { backHref, backLabel } = await getPageBackLink(Promise.resolve(resolvedSearchParams));
  const flashMessage = Array.isArray(resolvedSearchParams?.message) ? resolvedSearchParams.message[0] : resolvedSearchParams?.message;
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-white text-black">
        <PageTopBar backHref={backHref} backLabel={backLabel} />
        <section className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-black">Connect Supabase to view verification.</h1>
            <p className="mt-3 text-base font-semibold leading-7 text-zinc-600">
              Instructor verification status and document records need Supabase before live account data can be shown.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase
      .from("instructor_profiles")
      .select("verification_status,rejection_reason,adi_pdi_status,adi_pdi_number,base_postcode,hourly_rate_pence,transmission,car_make,car_model,updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("instructor_documents")
      .select("id,document_type,storage_path,status,reviewed_at,created_at")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false })
  ]);
  const isInstructor = roles?.some((role) => role.role === "instructor") ?? false;

  if (!isInstructor) {
    redirect("/auth/login?role=instructor");
  }

  const uploadedDocuments = (documents ?? []) as DocumentRow[];
  const verificationDisplay = getInstructorVerificationDisplayFromEvidence(
    instructorProfile?.verification_status,
    uploadedDocuments.map((document) => document.status)
  );
  const documentLinks = await getDocumentLinks(supabase, uploadedDocuments);
  const requiredUploadedCount = requiredDocuments.filter((document) => getLatestDocument(uploadedDocuments, document.type)).length;
  const accountEmail = profile?.email ?? user.email ?? "Unknown";
  const statusRequestHref = `mailto:info@ldrivingacademy.co.uk?subject=${encodeURIComponent(
    "Instructor verification status request"
  )}&body=${encodeURIComponent(
    `Hello LDA,\n\nPlease can you send me a status update on my instructor verification process.\n\nAccount: ${accountEmail}\nCurrent status: ${verificationDisplay.label}\n\nThank you.`
  )}`;

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
            <ShieldCheck size={16} /> Instructor verification
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-5xl">Verification status</h1>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-zinc-300">
            Review the documents and account details LDA currently has for your instructor approval.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-5">
          {flashMessage ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
              {flashMessage}
            </div>
          ) : null}

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <FileCheck2 className="text-brand" />
                <h2 className="mt-4 text-2xl font-black">Current status</h2>
                <p className="mt-2 text-base font-semibold leading-7 text-zinc-600">
                  {profile?.full_name || "Instructor account"} is currently marked as{" "}
                  <span className="font-black text-black">{verificationDisplay.label}</span>.
                </p>
              </div>
              <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase ${verificationDisplay.toneClass}`}>
                {verificationDisplay.label}
              </span>
            </div>
            {instructorProfile?.rejection_reason ? (
              <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-950">
                {instructorProfile.rejection_reason}
              </div>
            ) : null}
          </article>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Required documents</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              {requiredUploadedCount} of {requiredDocuments.length} required verification documents are currently uploaded.
            </p>
            <div className="mt-5 grid gap-3">
              {requiredDocuments.map((document) => {
                const uploaded = getLatestDocument(uploadedDocuments, document.type);

                return (
                  <DocumentStatusRow
                    key={document.type}
                    documentType={document.type}
                    label={document.label}
                    detail={document.detail}
                    document={uploaded}
                    signedUrl={uploaded ? documentLinks.get(uploaded.id) ?? null : null}
                  />
                );
              })}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Supporting evidence</h2>
            <div className="mt-5 grid gap-3">
              {supportingDocuments.map((document) => {
                const uploaded = getLatestDocument(uploadedDocuments, document.type);

                return (
                  <DocumentStatusRow
                    key={document.type}
                    documentType={document.type}
                    label={document.label}
                    detail={document.detail}
                    document={uploaded}
                    signedUrl={uploaded ? documentLinks.get(uploaded.id) ?? null : null}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
            <h2 className="text-xl font-black">Profile details</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-700">
              <DetailRow label="Verification status" value={verificationDisplay.label} />
              <DetailRow label="ADI/PDI status" value={instructorProfile?.adi_pdi_status} />
              <DetailRow label="Badge number" value={instructorProfile?.adi_pdi_number} />
              <DetailRow label="Base postcode" value={instructorProfile?.base_postcode} />
              <DetailRow label="Transmission" value={instructorProfile?.transmission} />
              <DetailRow label="Vehicle" value={[instructorProfile?.car_make, instructorProfile?.car_model].filter(Boolean).join(" ")} />
              <DetailRow
                label="Hourly rate"
                value={typeof instructorProfile?.hourly_rate_pence === "number" ? `${String.fromCharCode(163)}${(instructorProfile.hourly_rate_pence / 100).toFixed(2)}/hr` : null}
              />
            </div>
          </section>

          <section className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <Mail className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Request an update</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-red-950">
              Ask LDA support to review the current verification status or confirm what still needs attention.
            </p>
            <Link href={statusRequestHref} className="lda-pill lda-pill-sm mt-5">
              Request update <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
      </section>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-black">{value || "Not added"}</span>
    </div>
  );
}

function DocumentStatusRow({
  label,
  detail,
  documentType,
  document,
  signedUrl
}: {
  label: string;
  detail: string;
  documentType: DocumentType;
  document: DocumentRow | null;
  signedUrl?: string | null;
}) {
  const isUploaded = Boolean(document);
  const documentDisplay = getInstructorVerificationDisplay(document?.status);

  return (
    <article className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isUploaded ? <CheckCircle2 className="shrink-0 text-emerald-600" size={18} /> : <FileWarning className="shrink-0 text-amber-600" size={18} />}
            <h3 className="font-black">{label}</h3>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{detail}</p>
          {document ? (
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">
              {fileNameFromPath(document.storage_path)} &middot; Uploaded {formatDate(document.created_at)}
            </p>
          ) : null}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${document ? documentDisplay.toneClass : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {document ? documentDisplay.label : "Missing"}
        </span>
      </div>
      {document ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-black">
          <span className="inline-flex items-center gap-2 text-zinc-600">
            <Clock3 size={15} /> Reviewed: {formatDate(document.reviewed_at)}
          </span>
          {signedUrl ? (
            <Link href={signedUrl} className="text-brand hover:underline" target="_blank" rel="noreferrer">
              Open file
            </Link>
          ) : null}
        </div>
      ) : null}
      <form action={uploadInstructorVerificationDocument} className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
        <input type="hidden" name="documentType" value={documentType} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-black uppercase text-zinc-800 hover:ring-2 hover:ring-brand">
            <Upload size={14} />
            Choose photo or PDF
            <input
              name="documentFile"
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              required
            />
          </label>
          <button type="submit" className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand hover:ring-2 hover:ring-brand">
            {isUploaded ? "Upload replacement" : "Upload document"}
          </button>
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
          Upload a photo or PDF under 8MB. On phones and tablets, the file picker can use the camera where the device supports it.
        </p>
      </form>
    </article>
  );
}
