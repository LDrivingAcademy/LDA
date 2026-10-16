import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTermsStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_LABEL } from "@/lib/terms-version";
import { acceptCurrentTerms } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Updated Terms and Conditions | L Driving Academy",
  description: "Review and accept the latest LDA Terms and Conditions before continuing.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type TermsUpdatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function safeNextPath(value?: string | null) {
  const nextPath = String(value || "/dashboard");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
}

export default async function TermsUpdatePage({ searchParams }: TermsUpdatePageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = safeNextPath(getSearchParam(resolvedSearchParams, "next"));
  const message = getSearchParam(resolvedSearchParams, "message");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?message=Authentication is not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?message=${encodeURIComponent("Sign in before accepting the updated LDA terms.")}`);
  }

  const termsStatus = await getCurrentTermsStatus(supabase, user.id);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={nextPath} backLabel="Back" />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-black uppercase text-brand">
          <FileText size={17} /> Terms update
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-5xl">
          Review the latest LDA Terms and Conditions.
        </h1>
        <p className="mt-5 text-lg font-semibold leading-8 text-zinc-700">
          {CURRENT_TERMS_LABEL}. This update includes how live location is used during active lessons, learner tracking, and instructor work sessions.
        </p>

        {message ? (
          <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
            {message}
          </div>
        ) : null}

        <article className="mt-7 rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
          <h2 className="text-2xl font-black">What changes for your account</h2>
          <p className="mt-3 text-base font-semibold leading-7 text-zinc-700">
            LDA may activate live location during active bookings, learner lesson tracking, and instructor work periods so lessons can be managed safely and support can respond if needed. You can read the full terms before accepting.
          </p>
          <Link href="/terms" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand hover:text-red-800">
            Read full Terms and Conditions <ArrowRight size={16} />
          </Link>
        </article>

        {termsStatus.accepted ? (
          <div className="mt-7 rounded border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold leading-6 text-emerald-950">
            You have already accepted the latest terms. You can continue using LDA.
            <div>
              <Link href={nextPath} className="lda-pill lda-pill-sm mt-4">
                Continue <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <form action={acceptCurrentTerms} className="mt-7 rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="next" value={nextPath} />
            <label className="flex gap-3 text-sm font-bold leading-6 text-zinc-800">
              <input name="acceptCurrentTerms" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-red-600" />
              <span>I have read and accept the updated LDA Terms and Conditions, including live location and lesson tracking terms.</span>
            </label>
            <button type="submit" className="lda-pill mt-5">
              Accept and continue <ArrowRight size={17} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
