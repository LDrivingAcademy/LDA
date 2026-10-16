import { ArrowRight, BadgeCheck, CarFront, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { InstructorApplicationDocumentPicker } from "@/components/instructor-application-document-picker";
import { PageTopBar } from "@/components/page-top-bar";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { instructorTransferDocumentFields, instructorTransferDocumentTypes } from "@/lib/instructor-transfer-documents";
import { createClient } from "@/lib/supabase/server";
import { requestInstructorTransfer } from "./actions";

type DraftTransferDocument = {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
};

export default async function InstructorTransferPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; from?: string; mode?: string }>;
}) {
  const { message, from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const roles = supabase && user ? await getMarketplaceRolesForUser(supabase, user.id) : [];
  const isLearnerTransfer = Boolean(user && roles.includes("learner") && !roles.includes("instructor"));
  const isInstructorAccount = Boolean(user && roles.includes("instructor"));
  const existingTransferResult =
    supabase && user
      ? await supabase
          .from("account_role_transfer_requests")
          .select("status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
  const existingTransfer = existingTransferResult.data as { status?: string | null; created_at?: string | null } | null;
  const transferAlreadyOpen = Boolean(existingTransfer?.status && ["requested", "approved"].includes(existingTransfer.status));
  const draftDocumentsResult =
    supabase && user
      ? await supabase
          .from("instructor_documents")
          .select("id,document_type,status,created_at")
          .eq("instructor_id", user.id)
          .eq("status", "draft")
          .in("document_type", instructorTransferDocumentTypes)
          .order("created_at", { ascending: false })
      : { data: [] };
  const draftDocuments = (draftDocumentsResult.data ?? []) as DraftTransferDocument[];
  const getDraftDocument = (documentType: string) => {
    const document = draftDocuments.find((draftDocument) => draftDocument.document_type === documentType);

    return document
      ? {
          id: document.id,
          documentType: document.document_type,
          createdAt: document.created_at,
          previewHref: `/api/account/instructor-transfer/draft-documents/${document.id}/preview`
        }
      : null;
  };

  const pageTitle = isLearnerTransfer ? "Apply to become an LDA instructor from your learner account." : "Apply to become an LDA instructor.";
  const pageBody = isLearnerTransfer
    ? "You are already signed in as a learner, so LDA already has your email, password, and saved account details. Upload your ADI evidence below and your account will move into the in-progress instructor review stage."
    : "Guests need to create and confirm an instructor account first. After email confirmation, LDA will ask for ADI evidence and hold the profile in progress until review is complete.";
  const backHref = from === "home" ? "/" : isLearnerTransfer ? "/learner-dashboard" : "/";
  const backLabel = from === "home" ? "Back to homepage" : isLearnerTransfer ? "Back to learner dashboard" : "Back to homepage";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <ShieldCheck size={16} /> {isLearnerTransfer ? "Learner to instructor" : "Become LDA instructor"}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-6xl">{pageTitle}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700">{pageBody}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["No new learner login", "Learners keep the same email and password. LDA changes the account pathway after ADI evidence is submitted."],
              ["In-progress review", "The account can sign in and view status, but instructor tools and learner search visibility stay locked."],
              ["Approval unlocks tools", "Once LDA approves the ADI documents, LDA sends the approval email and unlocks the full instructor dashboard."]
            ].map(([title, body]) => (
              <article key={title} className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
                <BadgeCheck className="text-brand" />
                <h2 className="mt-3 font-black">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-zinc-600">{body}</p>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded border border-red-200 bg-red-50 p-5">
            <FileUp className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">What happens after submission?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-red-950">
              LDA emails you to confirm your instructor application is under review. Your account moves to in progress, then changes to a full instructor account only after the ADI documents are approved.
            </p>
          </section>
        </div>

        <aside className="min-w-0 rounded border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
            <CarFront size={16} /> Instructor application
          </div>
          {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
          {transferAlreadyOpen ? (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
              You already have an instructor application marked {existingTransfer?.status}. LDA review must finish before another request can be opened.
            </div>
          ) : null}

          {isLearnerTransfer ? (
            <form action={requestInstructorTransfer} encType="multipart/form-data" className="grid min-w-0 gap-3 [&_input]:min-w-0 [&_input]:w-full [&_label]:min-w-0 [&_textarea]:min-w-0 [&_textarea]:w-full">
              <div className="grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
                <div>Account details: <span className="text-emerald-700">Already saved</span></div>
                <div>Email and password: <span className="text-emerald-700">No new account needed</span></div>
                <div>Next status: <span className="text-brand">In progress after ADI evidence is submitted</span></div>
              </div>

              <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                <div>
                  <h3 className="font-black">Instructor verification documents</h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Upload the evidence LDA needs to confirm your instructor authority, DBS status, lesson vehicle, and paid tuition insurance. Documents save as drafts against your account, so you can go back to the homepage and return later before submitting.
                  </p>
                </div>
                <div className="grid gap-3">
                  {instructorTransferDocumentFields.map((field) => (
                    <div key={field.documentType} className="rounded border border-zinc-200 bg-white p-3">
                      <InstructorApplicationDocumentPicker
                        disabled={transferAlreadyOpen}
                        name={field.fieldName}
                        label={field.label}
                        draftDocumentType={field.documentType}
                        initialDraftDocument={getDraftDocument(field.documentType)}
                      />
                      <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">{field.detail}</p>
                    </div>
                  ))}
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Application note for LDA review</span>
                  <textarea name="notes" rows={4} placeholder="Optional note for LDA review" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" />
                </label>
              </div>

              <button disabled={transferAlreadyOpen} className="lda-pill mt-2 disabled:cursor-not-allowed disabled:opacity-50">
                Submit ADI documents <ArrowRight size={18} />
              </button>
            </form>
          ) : isInstructorAccount ? (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
              This account is already in the instructor pathway. Open your dashboard to view the current status or continue setup.
              <Link href="/instructor-dashboard" className="lda-pill mt-4 w-full justify-center">
                Open instructor dashboard <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="grid min-w-0 gap-3">
              <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                <div>
                  <h3 className="font-black">Guest instructor sign-up</h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Start by creating your instructor login. LDA will send the email confirmation first, then ask for ADI documents before the account enters review.
                  </p>
                </div>
                {["Create email and password", "Confirm your email", "Upload ADI evidence", "Wait for LDA review"].map((label) => (
                  <div key={label} className="rounded border border-zinc-200 bg-white p-3 text-sm font-black text-zinc-800">
                    {label}
                  </div>
                ))}
              </div>
              <Link href="/auth/sign-up?role=instructor" className="lda-pill mt-2">
                Start instructor sign up <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
