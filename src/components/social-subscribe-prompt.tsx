"use client";

import { FormEvent, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { subscribeToFollowLdaAction } from "@/app/social/actions";

type SocialSubscribePromptProps = {
  initialEmail?: string;
  initiallySubscribed?: boolean;
  isSignedIn?: boolean;
};

export function SocialSubscribePrompt({
  initialEmail = "",
  initiallySubscribed = false,
  isSignedIn = false
}: SocialSubscribePromptProps) {
  const [email, setEmail] = useState(initialEmail);
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await subscribeToFollowLdaAction(cleanEmail);
        setMessage(result.message);

        if (result.ok) {
          setEmail(result.email);
          setSubscribed(true);
        }
      } catch {
        setMessage("We could not complete your subscription just now. Please try again.");
      }
    });
  }

  return (
    <section className="mt-6 rounded border border-red-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Mail size={16} /> Driving tips and exclusive offers
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
            Enter your email to receive practical learner guidance, selected LDA updates, exclusive offers, and promo codes when they are released.
          </p>
        </div>
      </div>

      {subscribed ? (
        <div className="mt-4 rounded bg-green-50 p-3 text-sm font-black text-green-800">
          Thank you for subscribing to LDA.
        </div>
      ) : (
        <form onSubmit={subscribe} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            readOnly={isSignedIn}
            aria-label={isSignedIn ? "Your account email" : "Email address"}
            placeholder="you@example.com"
            className="min-h-12 flex-1 rounded border border-zinc-300 bg-white px-4 text-sm font-bold text-black read-only:bg-zinc-100 read-only:text-zinc-600"
          />
          <button className="lda-pill lda-pill-sm whitespace-nowrap" type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Subscribe"}
          </button>
        </form>
      )}
      {message && !subscribed ? (
        <p className="mt-3 text-sm font-bold text-brand">{message}</p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        We will only use your email for LDA learner communications, promotional offers, and launch updates. You can opt out at any time.
      </p>
    </section>
  );
}
