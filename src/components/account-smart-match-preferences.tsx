"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw, Save, Sparkles } from "lucide-react";
import {
  defaultSmartMatchPreferences,
  normaliseSmartMatchPreferences
} from "@/lib/smart-match-preferences";
import type { SmartMatchInput } from "@/lib/smart-match";

const learningOptions = ["step-by-step", "visual examples", "written recap", "predictable lesson structure", "quiet explanations", "practice notes"];
const supportOptions = ["calm support", "extra processing time", "one instruction at a time", "low distraction", "accessible pickup planning", "confidence support"];

function toggle(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AccountSmartMatchPreferences() {
  const [preferences, setPreferences] = useState<SmartMatchInput>(() => defaultSmartMatchPreferences());
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error" | "migration">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      try {
        const response = await fetch("/api/smart-match/preferences", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const result = (await response.json().catch(() => null)) as { preferences?: SmartMatchInput | null; error?: string } | null;
        if (!active) return;

        if (response.status === 503) {
          setStatus("migration");
          setMessage(result?.error ?? "Smart Match account preferences are temporarily unavailable.");
          return;
        }

        if (!response.ok) {
          setStatus("idle");
          return;
        }

        if (result?.preferences) {
          setPreferences(normaliseSmartMatchPreferences(result.preferences));
        }
        setStatus("idle");
      } catch {
        if (!active) return;
        setStatus("error");
        setMessage("Smart Match preferences could not be loaded.");
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/smart-match/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ preferences })
      });
      const result = (await response.json().catch(() => null)) as { preferences?: SmartMatchInput; error?: string } | null;
      if (!response.ok) {
        setStatus(response.status === 503 ? "migration" : "error");
        setMessage(result?.error ?? "Smart Match preferences could not be saved.");
        return;
      }
      setPreferences(normaliseSmartMatchPreferences(result?.preferences ?? preferences));
      setStatus("saved");
      setMessage("Smart Match preferences saved.");
    } catch {
      setStatus("error");
      setMessage("Smart Match preferences could not be saved.");
    }
  }

  async function reset() {
    setStatus("saving");
    setMessage("");
    try {
      await fetch("/api/smart-match/preferences", {
        method: "DELETE",
        credentials: "same-origin"
      });
      setPreferences(defaultSmartMatchPreferences());
      setStatus("saved");
      setMessage("Smart Match preferences reset.");
    } catch {
      setStatus("error");
      setMessage("Smart Match preferences could not be reset.");
    }
  }

  return (
    <div className="flex h-full flex-col rounded border border-zinc-200 bg-zinc-50 p-4">
      <Sparkles className="text-brand" />
      <h3 className="mt-3 text-xl font-black">Smart Match preferences</h3>
      <p className="mt-2 text-sm font-bold leading-5 text-zinc-700">
        Save how you learn best so Smart Match can prefill the journey and filter instructors faster next time.
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase text-zinc-500">Postcode or area</span>
          <input
            value={preferences.postcode ?? ""}
            onChange={(event) => setPreferences({ ...preferences, postcode: event.target.value.toUpperCase() })}
            className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-black text-black outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Example: EN5"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-500">Transmission</span>
            <select
              value={preferences.transmission}
              onChange={(event) => setPreferences({ ...preferences, transmission: event.target.value as SmartMatchInput["transmission"] })}
              className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-black text-black outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-500">Max price</span>
            <input
              type="number"
              min={30}
              max={60}
              value={Math.round((preferences.budgetPence ?? 4200) / 100)}
              onChange={(event) => setPreferences({ ...preferences, budgetPence: Number(event.target.value) * 100 })}
              className="min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm font-black text-black outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>
        <PreferencePills
          title="Learning"
          values={learningOptions}
          selected={preferences.learningPreferences}
          onToggle={(value) => setPreferences({ ...preferences, learningPreferences: toggle(preferences.learningPreferences, value) })}
        />
        <PreferencePills
          title="Support"
          values={supportOptions}
          selected={preferences.accessibilityNeeds}
          onToggle={(value) => setPreferences({ ...preferences, accessibilityNeeds: toggle(preferences.accessibilityNeeds, value) })}
        />
      </div>

      {message ? (
        <p className={`mt-4 rounded border p-3 text-sm font-black leading-6 ${status === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-white text-red-950"}`}>
          {message}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-3 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={status === "loading" || status === "saving" || status === "migration"}
          className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} /> {status === "saving" ? "Saving..." : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={status === "loading" || status === "saving" || status === "migration"}
          className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-black text-zinc-800 hover:ring-2 hover:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw size={16} className="mr-1 inline" /> Reset
        </button>
        <Link href="/smart-match?from=account" className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-black text-zinc-800 hover:ring-2 hover:ring-zinc-300">
          Open Smart Match
        </Link>
      </div>
    </div>
  );
}

function PreferencePills({
  title,
  values,
  selected,
  onToggle
}: {
  title: string;
  values: string[];
  selected?: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => {
          const isSelected = selected?.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                isSelected ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-brand"
              }`}
            >
              {titleCase(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
