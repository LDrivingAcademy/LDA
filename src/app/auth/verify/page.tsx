import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, BookOpenCheck, CarFront, CheckCircle2, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { DateOfBirthField } from "@/components/auth/date-of-birth-field";
import { InstructorApplicationDocumentPicker } from "@/components/instructor-application-document-picker";
import { completeVerification } from "@/app/auth/actions";
import { hasCompletedLearnerEligibility, latestEligibleDateOfBirth } from "@/lib/learner-eligibility";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Complete Verification | L Driving Academy",
  description: "Complete secure L Driving Academy account verification.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function VerifyAccountPage({
  searchParams
}: {
  searchParams: Promise<{ role?: string; message?: string; next?: string }>;
}) {
  const { role, message, next } = await searchParams;
  const isInstructor = role === "instructor";
  const nextPath = next?.startsWith("/") && !next.startsWith("//")
    ? next
    : isInstructor
      ? "/instructor-dashboard"
      : "/learner-dashboard?verified=1";
  const supabase = await createClient();

  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const [profileResult, rolesResult, learnerProfileResult, instructorProfileResult] = user && supabase
    ? await Promise.all([
        supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
        supabase.from("account_roles").select("role").eq("user_id", user.id),
        supabase.from("learner_profiles").select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("instructor_profiles").select("verification_status").eq("user_id", user.id).maybeSingle()
      ])
    : [
        { data: null },
        { data: [] },
        { data: null },
        { data: null }
      ];
  const roleNames = rolesResult.data?.map((accountRole) => String(accountRole.role)) ?? [];
  const learnerProfile = learnerProfileResult.data;
  const instructorProfile = instructorProfileResult.data;

  if (user && !isInstructor && roleNames.includes("learner") && hasCompletedLearnerEligibility(learnerProfile)) {
    redirect(nextPath);
  }

  if (user && isInstructor && roleNames.includes("instructor") && instructorProfile) {
    redirect(nextPath);
  }

  const savedName = String(profileResult.data?.full_name || user?.user_metadata?.full_name || "").trim();
  const [savedFirstName = "", ...savedLastNameParts] = savedName.split(" ");
  const savedLastName = savedLastNameParts.join(" ");
  const savedPhone = String(profileResult.data?.phone ?? "");
  const savedDateOfBirth = String(learnerProfile?.date_of_birth ?? "");

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/auth/login" backLabel="Back to login" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_500px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> Email verified
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Complete instructor verification." : "Complete learner verification."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              {isInstructor
                ? "Your email link is confirmed. Upload the ADI evidence LDA needs before your temporary instructor account moves into review."
                : "Your email link is confirmed. Add your learner details and LDA will check the provisional licence before opening the learner account."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Email session", "Confirmed securely"],
                ["Profile record", "Stored against your LDA profile"],
                ["Next step", isInstructor ? "Instructor onboarding" : "Learner account setup"]
              ].map(([title, body]) => (
                <article key={title} className="rounded border border-zinc-200 bg-white p-4">
                  <CheckCircle2 className="text-brand" />
                  <h2 className="mt-3 font-black">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                {isInstructor ? <CarFront size={16} /> : <BookOpenCheck size={16} />}
                {isInstructor ? "Instructor details" : "Learner details"}
              </div>
              <h2 className="mt-1 text-2xl font-black">{isInstructor ? "Submit ADI documents" : "Finish learner setup"}</h2>
            </div>

            {!hasSupabaseConfig() ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-brand">
                Secure email verification is temporarily unavailable. Please try again later.
              </div>
            ) : !user ? (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-brand">
                Your email session is missing or expired. Request a new link from the login page.
              </div>
            ) : (
              <>
                {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
                <form action={completeVerification} encType="multipart/form-data" className="grid gap-3">
                  <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                  <input type="hidden" name="next" value={nextPath} />
                  {!isInstructor ? <input type="hidden" name="termsAccepted" value="on" /> : null}
                  {!isInstructor && savedName ? <input type="hidden" name="fullName" value={savedName} /> : null}
                  {isInstructor ? (
                    <>
                      <label className="grid gap-1">
                        <span className="text-sm font-bold text-zinc-600">First name</span>
                        <input required name="firstName" defaultValue={savedFirstName} autoComplete="given-name" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="First name" />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-sm font-bold text-zinc-600">Last name</span>
                        <input required name="lastName" defaultValue={savedLastName} autoComplete="family-name" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Last name" />
                      </label>
                    </>
                  ) : null}
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Email</span>
                    <input disabled value={user.email ?? ""} className="rounded border border-zinc-300 bg-zinc-100 px-3 py-3 text-zinc-600" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Phone number <span className="font-medium text-zinc-500">(optional)</span></span>
                    <input name="phone" type="tel" autoComplete="tel" defaultValue={savedPhone} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Used for real-time lesson updates" />
                    <span className="text-xs leading-5 text-zinc-500">Add this if you want text updates for lesson changes, cancellations, and instructor arrival alerts. You can continue without it.</span>
                  </label>

                  {isInstructor ? <InstructorFields /> : <LearnerFields defaultDateOfBirth={savedDateOfBirth} />}

                  {isInstructor ? (
                    <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
                      <input required name="termsAccepted" type="checkbox" className="mt-1" />
                      <span>
                        I accept the LDA terms of use, privacy policy, cookie policy, booking rules, and live location rules for booked lessons and instructor working sessions.
                      </span>
                    </label>
                  ) : null}
                  <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
                    <input name="marketingOptIn" type="checkbox" className="mt-1" />
                    <span>Email me driving tips, exclusive offers, promo codes, and selected LDA updates.</span>
                  </label>

                  <button className="lda-pill mt-2">
                    <BadgeCheck size={18} /> {isInstructor ? "Submit for LDA review" : "Check licence and open learner account"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function LearnerFields({ defaultDateOfBirth = "" }: { defaultDateOfBirth?: string }) {
  const latestDob = latestEligibleDateOfBirth();

  return (
    <>
      <DateOfBirthField latestEligibleDate={latestDob} defaultValue={defaultDateOfBirth} />
      <label className="grid gap-2 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
        <span className="font-bold text-zinc-700">Provisional driving licence number</span>
        <input
          required
          name="provisionalLicenceNumber"
          maxLength={20}
          className="rounded border border-zinc-300 bg-white px-3 py-3 font-mono text-sm font-black uppercase text-black placeholder:text-zinc-500"
          placeholder="16-character photocard number"
        />
        <span className="text-xs font-bold leading-5 text-zinc-500">
          LDA checks the number and matches the date of birth on the licence before opening the learner account.
        </span>
      </label>
      <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
        <input required name="ageConfirmed" type="checkbox" className="mt-1" />
        <span>I confirm I am 17 or over and my date of birth is correct.</span>
      </label>
      <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
        <input required name="provisionalLicencePermission" type="checkbox" className="mt-1" />
        <span>I give LDA permission to check this provisional licence number and save the confirmation to my learner account.</span>
      </label>
    </>
  );
}

function InstructorFields() {
  return (
    <>
      <label className="grid gap-1">
        <span className="text-sm font-bold text-zinc-600">ADI number</span>
        <input required name="adiPdiNumber" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="ADI registration number" />
      </label>
      <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <h3 className="font-black">ADI verification documents</h3>
          <p className="mt-1 text-sm leading-5 text-zinc-600">
            Upload the evidence LDA needs to confirm you are a fully qualified ADI. Vehicle, insurance, availability, pricing, and learner-facing profile details unlock after approval.
          </p>
        </div>
        <InstructorApplicationDocumentPicker required name="adiPdiDocument" label="ADI badge or certificate" />
        <InstructorApplicationDocumentPicker required name="drivingLicenceDocument" label="Full UK driving licence evidence" />
      </div>
    </>
  );
}
