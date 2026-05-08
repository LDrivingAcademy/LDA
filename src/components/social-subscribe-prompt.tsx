"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mail, X } from "lucide-react";

type SocialSubscribePromptProps = {
  initialEmail?: string;
  initiallySubscribed?: boolean;
};

export function SocialSubscribePrompt({ initialEmail = "", initiallySubscribed = false }: SocialSubscribePromptProps) {
  const [email, setEmail] = useState(initialEmail);
  const [closed, setClosed] = useState(false);
  const [subscribed, setSubscribed] = useState(initiallySubscribed);

  useEffect(() => {
    const stored = window.localStorage.getItem("lda-social-email");
    if (stored && !initialEmail) {
      setEmail(stored);
      setSubscribed(true);
    }
  }, [initialEmail]);

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return;
    }

    window.localStorage.setItem("lda-social-email", cleanEmail);
    setSubscribed(true);
  }

  if (closed) {
    return null;
  }

  return (
    <section className="mt-6 rounded border border-red-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Mail size={16} /> Subscribe before you browse
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
            If you already have an LDA account, this will use your account email when live auth is connected. For now, enter your email below, or close this box to go straight to the social links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-300 text-zinc-700 hover:border-brand hover:text-brand"
          aria-label="Close subscribe prompt"
        >
          <X size={18} />
        </button>
      </div>

      {subscribed ? (
        <div className="mt-4 rounded bg-green-50 p-3 text-sm font-black text-green-800">
          Subscribed{email ? ` as ${email}` : ""}. You can use the social links below.
        </div>
      ) : (
        <form onSubmit={subscribe} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="min-h-12 flex-1 rounded border border-zinc-300 bg-white px-4 text-sm font-bold text-black"
          />
          <button className="lda-pill lda-pill-sm whitespace-nowrap" type="submit">
            Subscribe
          </button>
        </form>
      )}
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        TODO: Connect this to Supabase consent storage and Resend before live marketing emails are sent.
      </p>
    </section>
  );
}
