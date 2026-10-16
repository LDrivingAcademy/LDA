"use client";

import { useMemo, useState } from "react";

const months = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"]
] as const;

function splitDate(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

function padDay(value: string) {
  return value ? value.padStart(2, "0") : "";
}

function buildDate(year: string, month: string, day: string) {
  return year && month && day ? `${year}-${month}-${padDay(day)}` : "";
}

export function DateOfBirthField({ latestEligibleDate: _latestEligibleDate, defaultValue = "" }: { latestEligibleDate: string; defaultValue?: string }) {
  const defaultDate = splitDate(defaultValue);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1920 + 1 }, (_, index) => String(currentYear - index));
  }, []);
  const [day, setDay] = useState(defaultDate.day);
  const [month, setMonth] = useState(defaultDate.month);
  const [year, setYear] = useState(defaultDate.year);
  const dateValue = buildDate(year, month, day);

  function updateDate(next: { year?: string; month?: string; day?: string }) {
    if (typeof next.day === "string") {
      setDay(next.day);
    }

    if (typeof next.month === "string") {
      setMonth(next.month);
    }

    if (typeof next.year === "string") {
      setYear(next.year);
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold text-zinc-600">Date of birth</span>
      <input type="hidden" name="dateOfBirth" value={dateValue} />
      <div className="grid gap-2 sm:grid-cols-[1fr_1.25fr_1fr]">
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Day</span>
          <select
            required
            name="dateOfBirthDay"
            value={day}
            onChange={(event) => updateDate({ day: event.target.value })}
            className="rounded border border-zinc-300 bg-white px-3 py-3 text-black"
          >
            <option value="">DD</option>
            {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Month</span>
          <select
            required
            name="dateOfBirthMonth"
            value={month}
            onChange={(event) => updateDate({ month: event.target.value })}
            className="rounded border border-zinc-300 bg-white px-3 py-3 text-black"
          >
            <option value="">Month</option>
            {months.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Year</span>
          <select
            required
            name="dateOfBirthYear"
            value={year}
            onChange={(event) => updateDate({ year: event.target.value })}
            className="rounded border border-zinc-300 bg-white px-3 py-3 text-black"
          >
            <option value="">YYYY</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <span className="text-xs leading-5 text-zinc-500">
        Choose your day, month, and year. LDA checks the date before booking can continue.
      </span>
    </div>
  );
}
