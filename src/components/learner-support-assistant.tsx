"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Bot, Mail, Send } from "lucide-react";

type AssistantResponse = {
  answer: string;
  urgent: boolean;
  escalation: "skipped" | "sent-or-queued";
  mode: "demo" | "live";
};

const quickPrompts = [
  "I need to manage an existing booking",
  "My payment went through but I cannot see my lesson",
  "I need to cancel or reschedule",
  "My instructor is late or has not arrived"
];

export function LearnerSupportAssistant() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState<"standard" | "urgent">("standard");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResponse(null);

    const apiResponse = await fetch("/api/support/learner-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, bookingReference, message, urgency })
    });

    const payload = await apiResponse.json();
    setLoading(false);

    if (!apiResponse.ok) {
      setError(payload.error || "Support assistant could not respond. Please try again.");
      return;
    }

    setResponse(payload);
  }

  return (
    <section className="rounded bg-black p-5 text-white shadow-2xl sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded bg-red-500/15 text-brand">
          <Bot size={24} />
        </div>
        <div>
          <div className="text-sm font-black uppercase text-zinc-500">LDA learner assistant</div>
          <h2 className="text-2xl font-black">Ask about bookings, payments, or lesson issues.</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setMessage(prompt)}
            className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm font-bold text-zinc-200 hover:border-red-500 hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={submitSupport} className="mt-6 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="rounded bg-white px-4 py-3 font-bold text-black" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email used for booking" className="rounded bg-white px-4 py-3 font-bold text-black" />
        </div>
        <input value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} placeholder="Booking reference if you have one" className="rounded bg-white px-4 py-3 font-bold text-black" />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what you need help with" rows={5} className="rounded bg-white px-4 py-3 font-bold text-black" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-black text-zinc-300">
            <input
              type="checkbox"
              checked={urgency === "urgent"}
              onChange={(event) => setUrgency(event.target.checked ? "urgent" : "standard")}
              className="h-4 w-4 accent-red-600"
            />
            This is urgent
          </label>
          <button type="submit" disabled={loading} className="lda-pill lda-pill-sm disabled:cursor-wait disabled:opacity-70">
            {loading ? "Checking..." : "Ask assistant"} <Send size={16} />
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p>
      ) : null}

      {response ? (
        <article className="mt-5 rounded bg-white p-5 text-black">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-zinc-500">
            {response.urgent ? <AlertTriangle size={16} className="text-brand" /> : <Bot size={16} className="text-brand" />}
            {response.mode === "live" ? "AI response" : "Demo response"}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7 text-zinc-800">{response.answer}</p>
          {response.escalation === "sent-or-queued" ? (
            <div className="mt-4 flex items-start gap-3 rounded bg-red-600 p-4 text-white">
              <Mail className="mt-0.5 shrink-0" size={20} />
              <p className="text-sm font-bold leading-6">
                This was marked urgent, so LDA support has been notified if email is configured. Keep your booking reference ready.
              </p>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
