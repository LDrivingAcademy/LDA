"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Mail,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { ldaAiGreeting } from "@/lib/lda-ai-conversation-rules";
import { isNaturalUnresolvedSupportMessage } from "@/lib/support-conversation-signals";
import type { SupportAudience } from "@/lib/support-guidance";

type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

type GuideResponse = {
  sessionId?: string;
  answer: string;
  mode: "ai" | "guided";
  category: string;
  categoryLabel: string;
  priority: "standard" | "urgent" | "critical";
  requiredDetails: string[];
  actions: Array<{ label: string; href: string }>;
  navigation?: Array<{ label: string; href: string }>;
  suggestedReplies?: string[];
  canCreateTicket?: boolean;
  needsEmail: boolean;
  callbackAvailable: false;
};

type EmailUpdatesPreference = "accepted" | "declined" | "unknown";

type TicketResponse = {
  ok: true;
  sessionId?: string;
  answer: string;
  ticket: {
    id?: string;
    reference: string;
    status: "new";
  };
  callbackAvailable: false;
};

const audienceLabels: Record<SupportAudience, string> = {
  guest: "Guest support",
  learner: "Learner support",
  instructor: "Instructor support"
};

const firstAssistantMessage: Record<SupportAudience, string> = {
  guest: ldaAiGreeting,
  learner: ldaAiGreeting,
  instructor: ldaAiGreeting
};

function extractBookingReference(text: string) {
  const match = text.toUpperCase().match(/\bLDA[-A-Z0-9]{6,}\b/);
  return match?.[0] ?? "";
}

function shouldAutoEscalate(input: {
  guide: GuideResponse;
  message: string;
  previousConversationLength: number;
}) {
  if (!input.guide.canCreateTicket) return false;

  const saysStillBroken = isNaturalUnresolvedSupportMessage(input.message);
  const highRisk = input.guide.priority === "critical" || input.guide.category === "off_platform" || input.guide.category === "safety";
  const enoughContext = input.guide.requiredDetails.filter((detail) => !/email/i.test(detail)).length === 0;
  const repeatedSupportAttempt = input.previousConversationLength >= 4 && /help|support|problem|issue|error|missing|payment|booking/i.test(input.message);

  return (saysStillBroken && enoughContext) || (highRisk && enoughContext) || (repeatedSupportAttempt && enoughContext && !input.guide.actions.length);
}

function actionIcon(action: { label: string; href: string }) {
  const value = `${action.label} ${action.href}`.toLowerCase();
  if (value.includes("payment") || value.includes("receipt") || value.includes("checkout")) return CreditCard;
  if (value.includes("dashboard")) return LayoutDashboard;
  if (value.includes("calendar") || value.includes("book lesson") || value.includes("booking")) return CalendarDays;
  if (value.includes("demand") || value.includes("lesson-now")) return CarFront;
  if (value.includes("smart")) return Sparkles;
  return ArrowRight;
}

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SupportAssistant({ audience }: { audience: SupportAudience }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [guide, setGuide] = useState<GuideResponse | null>(null);
  const [ticket, setTicket] = useState<TicketResponse["ticket"] | null>(null);
  const [loading, setLoading] = useState<"guide" | "ticket" | null>(null);
  const [error, setError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [escalationPrompt, setEscalationPrompt] = useState<"hidden" | "choice" | "email">("hidden");
  const [pendingEscalation, setPendingEscalation] = useState<{ message: string; conversation: ConversationMessage[] } | null>(null);

  const latestActions = useMemo(() => {
    const source = guide ? [...guide.actions, ...(guide.navigation ?? [])] : [];
    return source.filter(
      (action, index, links) => links.findIndex((candidate) => candidate.href === action.href) === index
    ).slice(0, 6);
  }, [guide]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation, guide, ticket, loading, error, escalationPrompt]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [message]);

  function rememberSession(nextSessionId?: string) {
    if (nextSessionId) setSessionId(nextSessionId);
  }

  async function postSupportRequest(
    action: "guide" | "escalate",
    submittedMessage: string,
    overrideConversation?: ConversationMessage[],
    emailUpdates: EmailUpdatesPreference = "unknown",
    overrideEmail = email
  ) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/support/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            sessionId,
            message: submittedMessage,
            email: overrideEmail,
            emailUpdates,
            bookingReference: extractBookingReference(submittedMessage),
            currentPath: pathname,
            conversation: overrideConversation ?? conversation
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          if (response.status >= 500 && attempt === 0) {
            await wait(350);
            continue;
          }
          throw new Error(payload.error || "LDA support could not complete that request.");
        }

        return payload;
      } catch (caught) {
        lastError = caught;
        if (attempt === 0) await wait(350);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("LDA support could not complete that request.");
  }

  async function requestSupport(
    action: "guide" | "escalate",
    overrideMessage?: string,
    overrideConversation?: ConversationMessage[],
    emailUpdates: EmailUpdatesPreference = "unknown",
    overrideEmail?: string
  ) {
    const submittedMessage = (overrideMessage ?? message).trim();
    if (!submittedMessage) {
      setError("Type a message for LDA support.");
      return;
    }
    if (loading) return;

    setLoading(action === "escalate" ? "ticket" : "guide");
    setError("");
    setRetryMessage("");

    try {
      const minimumThinkingTime = action === "guide" ? 850 : 450;
      const [payload] = await Promise.all([
        postSupportRequest(action, submittedMessage, overrideConversation, emailUpdates, overrideEmail ?? email),
        wait(minimumThinkingTime)
      ]);
      setLoading(null);

      if (action === "escalate") {
        const ticketPayload = payload as TicketResponse;
        rememberSession(ticketPayload.sessionId);
        setTicket(ticketPayload.ticket);
        setEscalationPrompt("hidden");
        setPendingEscalation(null);
        setConversation((current) => [
          ...current,
          { role: "assistant" as const, text: ticketPayload.answer }
        ].slice(-18));
        return;
      }

      const guidePayload = payload as GuideResponse;
      rememberSession(guidePayload.sessionId);
      setGuide(guidePayload);
      setTicket(null);
      const nextConversation = [
        ...conversation,
        { role: "user" as const, text: submittedMessage },
        { role: "assistant" as const, text: guidePayload.answer }
      ].slice(-18);
      setConversation(nextConversation);
      setMessage("");

      const shouldEscalate = shouldAutoEscalate({
        guide: guidePayload,
        message: submittedMessage,
        previousConversationLength: conversation.length
      });

      if (shouldEscalate) {
        const escalationMessage =
          "I haven’t been able to resolve this. I can create a ticket for the LDA support team. Would you like updates by email?";
        setPendingEscalation({ message: submittedMessage, conversation: nextConversation });
        setEscalationPrompt("choice");
        setConversation((current) => [
          ...current,
          { role: "assistant" as const, text: escalationMessage }
        ].slice(-18));
        return;
      }
    } catch (caught) {
      setLoading(null);
      setRetryMessage(submittedMessage);
      setError(caught instanceof Error ? caught.message : "LDA support could not complete that request. Please try again.");
    }
  }

  async function submitQuestion(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await requestSupport("guide");
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void submitQuestion();
  }

  async function escalateWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingEscalation) return;

    if (!email.trim()) {
      setError("Add an email address for updates, or continue without email updates.");
      return;
    }

    const emailConversation = [
      ...pendingEscalation.conversation,
      { role: "user" as const, text: "Yes, send email updates" },
      { role: "assistant" as const, text: "Thanks. I’ll create the ticket and send confirmation by email." }
    ].slice(-18);
    setConversation(emailConversation);
    await requestSupport("escalate", pendingEscalation.message, emailConversation, "accepted", email);
  }

  async function escalateWithoutEmail() {
    if (!pendingEscalation || loading) return;

    const declineConversation = [
      ...pendingEscalation.conversation,
      { role: "user" as const, text: "No email updates" },
      { role: "assistant" as const, text: "No problem. I’ll create the ticket without email updates." }
    ].slice(-18);
    setConversation(declineConversation);
    await requestSupport("escalate", pendingEscalation.message, declineConversation, "declined", "");
  }

  function reset() {
    setSessionId("");
    setMessage("");
    setConversation([]);
    setGuide(null);
    setTicket(null);
    setError("");
    setRetryMessage("");
    setEscalationPrompt("hidden");
    setPendingEscalation(null);
  }

  return (
    <section className="flex h-[min(82vh,880px)] min-h-[620px] flex-col overflow-hidden rounded border border-zinc-200 bg-white text-black shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-600 text-white">
            <Bot size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-brand">{audienceLabels[audience]} assistant</div>
            <p className="hidden text-sm font-semibold leading-6 text-zinc-600 sm:block">
              Fresh session. Solves first, escalates only when needed.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black uppercase text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Online
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white p-4 sm:p-6" aria-live="polite">
        <div className="grid gap-3">
          <div className="mr-auto max-w-[94%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 shadow-sm sm:max-w-[88%]">
            <div className="mb-1 text-xs font-black uppercase text-zinc-500">LDA support</div>
            <p>{firstAssistantMessage[audience]}</p>
          </div>

          {conversation.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm sm:max-w-[84%] ${
                item.role === "user"
                  ? "ml-auto rounded-tr-sm bg-red-600 text-white"
                  : "mr-auto rounded-tl-sm border border-zinc-200 bg-zinc-50 text-zinc-800"
              }`}
            >
              <div className={`mb-1 text-xs font-black uppercase ${item.role === "user" ? "text-red-100" : "text-zinc-500"}`}>
                {item.role === "user" ? "You" : "LDA support"}
              </div>
              <p className="whitespace-pre-wrap">{item.text}</p>
            </div>
          ))}

          {loading === "guide" ? (
            <div className="mr-auto max-w-[94%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm sm:max-w-[84%]">
              <span className="sr-only">LDA support is typing.</span>
              <span className="inline-flex items-center gap-2">
                LDA support is typing
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:240ms]" />
                </span>
              </span>
            </div>
          ) : null}

          {guide && !ticket ? (
            <div className="mr-auto max-w-[96%]">
              {latestActions.length ? (
                <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {latestActions.map((action) => {
                    const Icon = actionIcon(action);
                    return (
                      <Link key={action.href} href={action.href} className="group rounded border border-zinc-200 bg-white p-3 text-sm font-black text-black shadow-sm transition hover:border-red-300 hover:bg-zinc-50">
                        <Icon size={18} className="mb-2 text-brand" />
                        <span className="flex items-center justify-between gap-2">
                          {action.label}
                          <ArrowRight size={15} className="text-zinc-400 group-hover:text-brand" />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

            </div>
          ) : null}

          {false ? (
            <div className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-950 shadow-sm">
              <TriangleAlert size={19} className="mb-2 text-amber-600" />
              I can escalate this with the conversation attached, but I need an email address for updates first. Add it below, then tell me “continue”.
            </div>
          ) : null}

          {escalationPrompt === "choice" && !ticket ? (
            <div className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 shadow-sm">
              <TriangleAlert size={19} className="mb-3 text-brand" />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEscalationPrompt("email")}
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-black uppercase text-white shadow-sm hover:bg-red-700"
                >
                  Yes, send email updates
                </button>
                <button
                  type="button"
                  onClick={escalateWithoutEmail}
                  disabled={loading === "ticket"}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-black uppercase text-zinc-800 shadow-sm hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  No, create without email
                </button>
              </div>
            </div>
          ) : null}

          {escalationPrompt === "email" && !ticket ? (
            <div className="mr-auto max-w-[88%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 shadow-sm">
              <form onSubmit={escalateWithEmail} className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-zinc-500">Email for ticket updates</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={loading === "ticket"}
                    className="rounded-full bg-red-600 px-4 py-2 text-xs font-black uppercase text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create ticket
                  </button>
                  <button
                    type="button"
                    onClick={escalateWithoutEmail}
                    disabled={loading === "ticket"}
                    className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-black uppercase text-zinc-800 shadow-sm hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue without email
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {ticket ? (
            <article className="mr-auto max-w-[96%] rounded-2xl rounded-tl-sm border border-emerald-200 bg-emerald-50 p-4 text-sm text-zinc-900 shadow-sm">
              <CheckCircle2 className="text-emerald-500" size={30} />
              <h3 className="mt-3 text-2xl font-black">Escalated to LDA support</h3>
              <p className="mt-2 font-semibold leading-6 text-zinc-700">
                I have sent the support team the chat, likely issue, what has already been tried, and account-safe context. You do not need to repeat it.
              </p>
              <div className="mt-4 rounded border border-emerald-200 bg-white p-4">
                <div className="text-xs font-black uppercase text-zinc-500">Reference</div>
                <div className="mt-1 text-2xl font-black tracking-normal">{ticket.reference}</div>
              </div>
              <button type="button" onClick={reset} className="mt-4 inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-black text-zinc-700 shadow-sm hover:border-red-300">
                <RotateCcw size={16} /> Start fresh
              </button>
            </article>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="mx-4 mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800 sm:mx-5">
          <p>{error}</p>
          {retryMessage ? (
            <button type="button" onClick={() => requestSupport("guide", retryMessage)} className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-200">
              Retry message <RotateCcw size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={submitQuestion} className="border-t border-zinc-200 bg-white p-3 sm:p-4">
        <label className="sr-only" htmlFor={`${audience}-support-message`}>Message LDA support</label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <textarea
            ref={inputRef}
            id={`${audience}-support-message`}
            maxLength={4000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleMessageKeyDown}
            placeholder="Message LDA support..."
            rows={1}
            className="max-h-36 min-h-14 resize-none overflow-y-auto rounded-2xl border border-zinc-300 bg-white px-4 py-4 font-bold leading-6 text-black outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
          />
          <button type="submit" disabled={!message.trim()} className="lda-pill lda-pill-sm min-h-14 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {loading === "guide" ? "Sending..." : "Send"} <Send size={16} />
          </button>
        </div>
        <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-zinc-500">
          <Mail className="mt-0.5 shrink-0" size={14} />
          Press Enter to send. Keep passwords, security codes, full card or bank details, and identity-document images out of chat.
        </p>
      </form>
    </section>
  );
}
