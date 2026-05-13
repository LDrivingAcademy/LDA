import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmailCallbackClient } from "@/components/auth/email-callback-client";
import { Brand } from "@/components/brand";

function safeRole(value: string | undefined) {
  return value === "instructor" ? "instructor" : "learner";
}

function safeNextPath(value: string | undefined, role: string) {
  const fallback = `/auth/verify?role=${role}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export default async function AuthCallbackPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; role?: string; next?: string; error_description?: string; error?: string }>;
}) {
  const params = await searchParams;
  const role = safeRole(params.role);

  if (params.error_description || params.error) {
    redirect(`/auth/login?role=${role}&message=${encodeURIComponent(params.error_description || params.error || "The email link could not be confirmed.")}`);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href={`/auth/login?role=${role}`} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>
        <div className="mt-10">
          <Suspense fallback={<CallbackFallback />}>
            <EmailCallbackClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function CallbackFallback() {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
      <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
        Secure email confirmation
      </div>
      <h1 className="mt-5 text-4xl font-black tracking-normal">Confirming your LDA login.</h1>
      <p className="mt-4 text-lg leading-8 text-zinc-300">Please wait while LDA confirms your secure email link.</p>
    </section>
  );
}
