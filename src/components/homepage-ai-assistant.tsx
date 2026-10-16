"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bot, CalendarDays, CarFront, Headphones, MessageSquare, Minimize2, Search, Send, Sparkles } from "lucide-react";
import { getEnglishMessage } from "@/lib/i18n/messages";
import { ldaAiGreeting } from "@/lib/lda-ai-conversation-rules";

type HomeMessage = {
  role: "assistant" | "user";
  text: string;
  actions?: HomeAction[];
  supportOnly?: boolean;
};

type HomeAction = {
  label: string;
  href: string;
  icon: typeof Search;
};

const primaryActions: HomeAction[] = [
  { label: "Find Instructor", href: "/auth/login?role=learner&next=%2Flearner-dashboard%3Fsection%3Ddriving-lessons%26from%3Dhome-chat%23driving-lessons-booking", icon: Search },
  { label: "Book On Demand", href: "/lesson-now?from=home-chat", icon: CarFront },
  { label: "Smart Match", href: "/smart-match?from=home-chat", icon: Sparkles }
];

const supportAction: HomeAction = {
  label: getEnglishMessage("ai.homepage.supportCta"),
  href: "/support?from=home-ai",
  icon: Headphones
};

const starterMessage: HomeMessage = {
  role: "assistant",
  text: ldaAiGreeting
};

function shouldMoveToSupport(message: string, turnCount: number) {
  const text = message.toLowerCase();
  return (
    turnCount >= 4 ||
    message.length > 220 ||
    /\b(error|broken|not working|failed|refund|duplicate charge|payment missing|missing lesson|complaint|late|unsafe|accident|password|account locked|hacked|technical|ticket|human|support team|more help|deep support|contact support)\b/.test(text)
  );
}

function buildShortGuidance(message: string, turnCount: number): HomeMessage {
  if (shouldMoveToSupport(message, turnCount)) {
    return {
      role: "assistant",
      text: "This needs the full Support AI so it can ask the right follow-up questions and keep the details together. Open Support AI and continue there.",
      actions: [supportAction],
      supportOnly: true
    };
  }

  const text = message.toLowerCase();

  if (/\b(on demand|right now|urgent lesson|lesson now|today)\b/.test(text)) {
    return {
      role: "assistant",
      text: "For a lesson as soon as possible, use Book On Demand. LDA will take you through the existing on-demand booking route.",
      actions: [{ label: "Book On Demand", href: "/lesson-now?from=home-chat", icon: CarFront }, supportAction]
    };
  }

  if (/\b(smart ?match|match|best instructor|learning style|preference)\b/.test(text)) {
    return {
      role: "assistant",
      text: "Use Smart Match when you want LDA to guide you toward instructors that fit your learning style, availability, and lesson needs.",
      actions: [{ label: "Open Smart Match", href: "/smart-match?from=home-chat", icon: Sparkles }, supportAction]
    };
  }

  if (/\b(find|instructor|teacher|tutor|local)\b/.test(text)) {
    return {
      role: "assistant",
      text: "To find instructors, open Find Instructor. If you are not signed in, LDA will take you to learner sign in or account setup first.",
      actions: [{ label: "Find Instructor", href: primaryActions[0].href, icon: Search }, supportAction]
    };
  }

  if (/\b(book|schedule|calendar|planned|slot|availability)\b/.test(text)) {
    return {
      role: "assistant",
      text: "For planned lessons, sign in as a learner and use the booking or calendar route. For an immediate lesson, use Book On Demand.",
      actions: [
        { label: "Schedule Lesson", href: "/auth/login?role=learner&next=%2Fscheduled-lessons%3Ffrom%3Dhome-chat%23scheduled-lessons-booking", icon: CalendarDays },
        { label: "Book On Demand", href: "/lesson-now?from=home-chat", icon: CarFront }
      ]
    };
  }

  if (/\b(sign in|login|log in|account|create account|register|sign up)\b/.test(text)) {
    return {
      role: "assistant",
      text: "Use learner sign in to book lessons or instructor sign up if you want to work with LDA as an instructor.",
      actions: [
        { label: "Learner Sign In", href: "/auth/login?role=learner&from=home-chat", icon: ArrowRight },
        { label: "Become Instructor", href: "/instructor?from=home-chat", icon: ArrowRight }
      ]
    };
  }

  if (/\b(help|support|contact|question)\b/.test(text)) {
    return {
      role: "assistant",
      text: "For quick route questions, I can help here. For booking, payment, account, or technical issues, use the full Support AI.",
      actions: [supportAction],
      supportOnly: true
    };
  }

  return {
    role: "assistant",
    text: getEnglishMessage("ai.homepage.routeQuestion")
  };
}

function ActionLinks({ actions }: { actions: HomeAction[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={`${action.label}-${action.href}`}
            href={action.href}
            className="group flex min-h-11 items-center justify-between gap-3 rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-black text-black shadow-sm transition hover:border-red-300 hover:bg-zinc-50"
          >
            <span className="inline-flex items-center gap-2">
              <Icon size={17} className="text-brand" />
              {action.label}
            </span>
            <ArrowRight size={15} className="text-zinc-400 group-hover:text-brand" />
          </Link>
        );
      })}
    </div>
  );
}

export function HomepageAiAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<HomeMessage[]>([starterMessage]);

  const isHomepage = pathname === "/";
  const userTurnCount = useMemo(() => messages.filter((item) => item.role === "user").length, [messages]);
  const canSend = Boolean(message.trim());

  useEffect(() => {
    if (!isHomepage) return;

    const routes = ["/support?from=home-ai", "/support/guest?from=home-ai", "/smart-match?from=home-chat", "/lesson-now?from=home-chat"];
    routes.forEach((route) => {
      try {
        router.prefetch(route);
      } catch {
        // Prefetch is only a speed boost; links still work normally.
      }
    });
  }, [isHomepage, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  }, [message]);

  if (!isHomepage) {
    return null;
  }

  function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const submitted = message.trim();
    if (!submitted) return;

    setMessages((current) => [
      ...current,
      { role: "user" as const, text: submitted },
      buildShortGuidance(submitted, userTurnCount + 1)
    ].slice(-8));
    setMessage("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitMessage();
  }

  function openAssistant() {
    setIsOpen(true);
    try {
      router.prefetch("/support?from=home-ai");
    } catch {
      // Navigation still works if prefetch is unavailable.
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-[calc(100vw-2rem)]">
        <button
          type="button"
          onPointerEnter={() => router.prefetch("/support?from=home-ai")}
          onFocus={() => router.prefetch("/support?from=home-ai")}
          onClick={openAssistant}
          className="inline-flex max-w-full items-center gap-0 rounded-full bg-white p-2 text-left text-base font-bold text-black shadow-2xl ring-1 ring-zinc-200 transition hover:ring-brand active:scale-[0.99] sm:gap-4 sm:px-5 sm:py-3"
          aria-label="Open LDA homepage helper"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-lg shadow-red-600/20">
            <MessageSquare size={22} />
          </span>
          <span className="sr-only whitespace-nowrap sm:not-sr-only">Chat</span>
        </button>
      </div>
    );
  }

  return (
    <section className="fixed bottom-5 right-5 z-50 flex h-[min(72vh,560px)] w-[min(calc(100vw-2rem),390px)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded border border-zinc-200 bg-white text-black shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-black px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-white">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-red-200">LDA quick helper</div>
            <h2 className="truncate text-base font-black">{getEnglishMessage("ai.homepage.helperTitle")}</h2>
          </div>
        </div>
        <button
          type="button"
          aria-label="Minimise LDA homepage helper"
          onClick={() => setIsOpen(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded border border-white/20 text-zinc-200 hover:border-red-400 hover:text-white"
        >
          <Minimize2 size={17} />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-zinc-50 p-4" aria-live="polite">
        <div className="grid gap-3">
          {messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                item.role === "user"
                  ? "ml-auto rounded-tr-sm bg-red-600 text-white"
                  : "mr-auto rounded-tl-sm border border-zinc-200 bg-white text-zinc-800"
              }`}
            >
              <div className={`mb-1 text-xs font-black uppercase ${item.role === "user" ? "text-red-100" : "text-zinc-500"}`}>
                {item.role === "user" ? "You" : "LDA"}
              </div>
              <p>{item.text}</p>
              {item.actions?.length ? <ActionLinks actions={item.actions} /> : null}
              {item.supportOnly ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">Full troubleshooting continues on the Support AI page.</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submitMessage} className="border-t border-zinc-200 bg-white p-4">
        <label className="sr-only" htmlFor="lda-homepage-helper-message">Ask the LDA homepage helper</label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <textarea
            ref={inputRef}
            id="lda-homepage-helper-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={500}
            placeholder="Ask where to go..."
            className="max-h-24 min-h-12 resize-none overflow-y-auto rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold leading-6 text-black outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </section>
  );
}
