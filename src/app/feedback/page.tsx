import type { Metadata } from "next";
import { MessageSquareText } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";
import { PageTopBar } from "@/components/page-top-bar";
import { isSignedInAdmin } from "@/lib/account-package-state";

export const metadata: Metadata = {
  title: "Feedback | L Driving Academy",
  description: "Send product feedback to L Driving Academy."
};

function getBackTarget(from: string | undefined, allowAdminSource: boolean) {
  switch (from) {
    case "admin":
      return allowAdminSource ? { href: "/admin", label: "Back to dashboard" } : { href: "/", label: "Back to homepage" };
    case "instructor":
      return { href: "/instructor-dashboard", label: "Back to dashboard" };
    case "learner":
      return { href: "/learner-dashboard", label: "Back to dashboard" };
    case "dashboard":
      return { href: "/dashboard", label: "Back to dashboard" };
    default:
      return { href: "/", label: "Back to homepage" };
  }
}

export default async function FeedbackPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backTarget = getBackTarget(from, await isSignedInAdmin());

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backTarget.href} backLabel={backTarget.label} />
      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-brand">
            <MessageSquareText size={16} /> LDA feedback
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-6xl">Tell us what to improve.</h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-700">
            Send a clear note about anything broken, confusing, slow, missing, or worth improving. LDA sends this to be reviewed so it can be triaged properly.
          </p>
          <div className="mt-8 grid gap-3 text-sm font-bold leading-6 text-zinc-700">
            <p>Include the page you were on, what you expected to happen, and what actually happened.</p>
            <p>Do not include card numbers, passwords, licence numbers, or other sensitive information in this feedback box.</p>
          </div>
        </div>
        <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <FeedbackForm />
        </section>
      </section>
    </main>
  );
}
