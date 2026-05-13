"use client";

import { useEffect, useState } from "react";
import { type EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function safeRole(value: string | null) {
  return value === "instructor" ? "instructor" : "learner";
}

function safeNextPath(value: string | null, role: string) {
  const fallback = `/auth/verify?role=${role}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function EmailCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirming your secure LDA email link...");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const role = safeRole(searchParams.get("role"));
    const nextPath = safeNextPath(searchParams.get("next"), role);

    if (!supabase) {
      setError("Supabase environment variables are not configured yet.");
      return;
    }

    const supabaseClient = supabase;

    async function finishCallback() {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const otpType = searchParams.get("type");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") || hashParams.get("error");

      if (hashError) {
        setError(hashError.replace(/\+/g, " "));
        return;
      }

      if (code) {
        const { error: codeError } = await supabaseClient.auth.exchangeCodeForSession(code);

        if (codeError) {
          setError(codeError.message);
          return;
        }
      } else if (tokenHash && otpType) {
        const { error: otpError } = await supabaseClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as EmailOtpType
        });

        if (otpError) {
          setError(otpError.message);
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabaseClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }
      }

      const {
        data: { session },
        error: sessionLookupError
      } = await supabaseClient.auth.getSession();

      if (sessionLookupError) {
        setError(sessionLookupError.message);
        return;
      }

      if (!session) {
        setError("The email link is invalid or has expired. Request a fresh secure link.");
        return;
      }

      setMessage("Email confirmed. Taking you to the next step...");
      router.replace(nextPath);
    }

    void finishCallback();
  }, [router, searchParams]);

  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl">
      <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
        <MailCheck size={16} /> Secure email confirmation
      </div>
      <h1 className="mt-5 text-4xl font-black tracking-normal">Confirming your LDA login.</h1>
      <p className="mt-4 text-lg leading-8 text-zinc-300">{error || message}</p>
      {error ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm">
            Request learner link
          </Link>
          <Link href="/auth/login?role=instructor" className="lda-pill lda-pill-sm">
            Request instructor link
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-3 text-sm font-bold text-zinc-400">
          <Loader2 className="animate-spin text-brand" size={18} /> Please wait
        </div>
      )}
    </section>
  );
}
