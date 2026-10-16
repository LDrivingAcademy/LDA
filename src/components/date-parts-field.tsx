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

function buildDate(year: string, month: string, day: string) {
  return year && month && day ? `${year}-${month}-${day}` : "";
}

type DatePartsFieldProps = {
  helperText: string;
  label: string;
  name: string;
  required?: boolean;
  yearStart?: number;
};

export function DatePartsField({ helperText, label, name, required = false, yearStart = 1950 }: DatePartsFieldProps) {
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - yearStart + 1 }, (_, index) => String(currentYear - index));
  }, [yearStart]);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const dateValue = buildDate(year, month, day);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold text-zinc-600">{label}</span>
      <input type="hidden" name={name} value={dateValue} />
      <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1.25fr_1fr]">
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Day</span>
          <select
            required={required}
            value={day}
            onChange={(event) => setDay(event.target.value)}
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
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Month</span>
          <select
            required={required}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
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
        <label className="grid min-w-0 gap-1">
          <span className="text-xs font-bold uppercase text-zinc-500">Year</span>
          <select
            required={required}
            value={year}
            onChange={(event) => setYear(event.target.value)}
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
      <span className="text-xs leading-5 text-zinc-500">{helperText}</span>
    </div>
  );
}
