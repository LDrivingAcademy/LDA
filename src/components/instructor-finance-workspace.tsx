"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgePoundSterling,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Wallet
} from "lucide-react";

export type InstructorFinanceWorkspaceMode = "workspace" | "setup-payout" | "setup-tax";

type PayoutProfile = {
  payeeName: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
  schedule: string;
};

type TaxProfile = {
  tradingStatus: string;
  utr: string;
  nationalInsurance: string;
  taxCode: string;
  vatStatus: string;
  vatNumber: string;
};

type SavedPayoutProfile = {
  payeeName: string;
  bankName: string;
  accountEnding: string;
  sortCodeEnding: string;
  schedule: string;
  verificationStatus: string;
  savedAt: string;
};

type SavedTaxProfile = {
  tradingStatus: string;
  utrEnding: string;
  nationalInsuranceEnding: string;
  taxCode?: string;
  vatStatus: string;
  vatNumberEnding?: string;
  utrCheckStatus: string;
  nationalInsuranceCheckStatus: string;
  hmrcCheckStatus: string;
  savedAt: string;
};

const earningsRows = [
  { date: "8 Jun 2026", reference: "LDA-MIA-0900", pupil: "Mia Thompson", gross: "GBP 54.00", fee: "GBP 5.40", net: "GBP 48.60", status: "Ready" },
  { date: "10 Jun 2026", reference: "LDA-AAL-1600", pupil: "Aaliyah Grant", gross: "GBP 72.00", fee: "GBP 7.20", net: "GBP 64.80", status: "Pending" },
  { date: "15 Jun 2026", reference: "LDA-NOA-1300", pupil: "Noah Evans", gross: "GBP 54.00", fee: "GBP 5.40", net: "GBP 48.60", status: "Scheduled" }
];

const payoutRows = [
  { date: "7 Jun 2026", amount: "GBP 216.00", destination: "Barclays ending 1184", status: "Paid" },
  { date: "14 Jun 2026", amount: "GBP 113.40", destination: "Barclays ending 1184", status: "Scheduled" }
];

function maskEnding(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `ending ${digits.slice(-4).padStart(4, "*")}` : "not set";
}

function formatHourlyRate(value?: number | null) {
  return typeof value === "number" && value > 0 ? `£${(value / 100).toFixed(2)}/hr` : "Not set yet";
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Wallet; label: string; value: string; detail: string }) {
  return (
    <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
        <Icon size={24} />
      </div>
      <div className="mt-5 text-sm font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">{detail}</p>
    </article>
  );
}

export function InstructorFinanceWorkspace({
  mode = "workspace",
  initialMessage = ""
}: {
  mode?: InstructorFinanceWorkspaceMode;
  initialMessage?: string;
}) {
  const isWorkspace = mode === "workspace";
  const isPayoutStep = mode === "setup-payout";
  const isTaxStep = mode === "setup-tax";
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile>({
    payeeName: "",
    bankName: "",
    sortCode: "",
    accountNumber: "",
    schedule: "Weekly"
  });
  const [taxProfile, setTaxProfile] = useState<TaxProfile>({
    tradingStatus: "Sole trader",
    utr: "",
    nationalInsurance: "",
    taxCode: "",
    vatStatus: "Not VAT registered",
    vatNumber: ""
  });
  const [savedPayout, setSavedPayout] = useState<SavedPayoutProfile | null>(null);
  const [savedTax, setSavedTax] = useState<SavedTaxProfile | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");
  const [savedHourlyRatePence, setSavedHourlyRatePence] = useState<number | null>(null);
  const [savingPayout, setSavingPayout] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingHourlyRate, setSavingHourlyRate] = useState(false);
  const [statementMonth, setStatementMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");

  const payoutDestination = useMemo(
    () =>
      savedPayout
        ? `${savedPayout.bankName || "Bank"} ${savedPayout.accountEnding}`
        : `${payoutProfile.bankName || "Bank"} ${maskEnding(payoutProfile.accountNumber)}`,
    [payoutProfile.accountNumber, payoutProfile.bankName, savedPayout]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFinanceProfile() {
      try {
        const response = await fetch("/api/instructor-finance/profile", { cache: "no-store" });
        const result = await response.json();
        if (!cancelled && response.ok) {
          setSavedPayout(result.payout ?? null);
          setSavedTax(result.tax ?? null);
          setSavedHourlyRatePence(typeof result.hourlyRatePence === "number" ? result.hourlyRatePence : null);
          if (typeof result.hourlyRatePence === "number" && result.hourlyRatePence > 0) {
            setHourlyRate((result.hourlyRatePence / 100).toFixed(2));
          }
          if (result.payout) {
            setPayoutProfile((current) => ({
              ...current,
              payeeName: result.payout.payeeName ?? "",
              bankName: result.payout.bankName ?? "",
              schedule: result.payout.schedule ?? "Weekly"
            }));
          }
          if (result.tax) {
            setTaxProfile((current) => ({
              ...current,
              tradingStatus: result.tax.tradingStatus ?? "Sole trader",
              taxCode: result.tax.taxCode ?? "",
              vatStatus: result.tax.vatStatus ?? "Not VAT registered"
            }));
          }
        }
      } catch {
        if (!cancelled) {
          setError("Finance profile could not be loaded. Try refreshing the page.");
        }
      }
    }

    loadFinanceProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayout(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/instructor-finance/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payoutProfile)
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Payout details could not be saved.");
        return;
      }

      setSavedPayout(result.payout);
      setPayoutProfile((current) => ({ ...current, sortCode: "", accountNumber: "" }));
      setMessage(result.message ?? "Payout details verified and saved.");
      if (isPayoutStep) {
        window.location.assign(
          `/instructor-setup/tax?message=${encodeURIComponent("Step 2 saved to your finance profile. Continue with your tax profile.")}`
        );
      }
    } finally {
      setSavingPayout(false);
    }
  }

  async function saveTax(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTax(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/instructor-finance/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taxProfile)
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Tax profile could not be saved.");
        return;
      }

      setSavedTax(result.tax);
      setTaxProfile((current) => ({ ...current, utr: "", nationalInsurance: "", vatNumber: "" }));
      setMessage(result.message ?? "Tax profile checked and saved.");
      if (isTaxStep) {
        const destination = result.setupComplete
          ? "/instructor-dashboard?setup=complete"
          : `/instructor-setup?message=${encodeURIComponent("Step 3 saved to your instructor profile. Review any remaining setup items.")}`;
        window.location.assign(destination);
      }
    } finally {
      setSavingTax(false);
    }
  }

  async function saveHourlyRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingHourlyRate(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/instructor-finance/hourly-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Hourly rate could not be saved.");
        return;
      }

      setSavedHourlyRatePence(result.hourlyRatePence);
      setHourlyRate((result.hourlyRatePence / 100).toFixed(2));
      setMessage(result.message ?? "Hourly rate saved.");
    } finally {
      setSavingHourlyRate(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <BadgePoundSterling size={17} /> {isPayoutStep ? "Step 2 of 3" : isTaxStep ? "Step 3 of 3" : "Instructor finance"}
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
            {isPayoutStep
              ? "Set up finance and payouts."
              : isTaxStep
                ? "Complete your tax profile."
                : "Earnings, payouts, and tax profile."}
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            {isPayoutStep
              ? "Save the verified payout destination used for cleared lesson earnings. These details also appear in your normal finance workspace for later updates."
              : isTaxStep
                ? "Save the tax information used for instructor finance records. It remains available in your normal finance workspace for later updates."
                : "Review lesson earnings, manage the payout account, keep tax details ready, and download finance records from one professional workspace."}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {!isWorkspace ? (
          <nav aria-label="Instructor setup progress" className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Step 1", detail: "Instructor profile", href: "/instructor-setup", active: false },
              { label: "Step 2", detail: "Finance and payouts", href: "/instructor-setup/finance", active: isPayoutStep },
              { label: "Step 3", detail: "Tax profile", href: "/instructor-setup/tax", active: isTaxStep }
            ].map((step) => (
              <Link
                key={step.label}
                href={step.href}
                aria-current={step.active ? "step" : undefined}
                className={`rounded border p-4 ${
                  step.active ? "border-brand bg-red-50 ring-1 ring-brand" : "border-zinc-200 bg-white hover:border-zinc-400"
                }`}
              >
                <span className={`text-xs font-black uppercase ${step.active ? "text-brand" : "text-zinc-500"}`}>{step.label}</span>
                <span className="mt-1 block text-sm font-black text-black">{step.detail}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">
            {error}
          </div>
        ) : null}

        {isWorkspace ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Wallet} label="Ready for payout" value="GBP 48.60" detail="Cleared lesson earnings awaiting the next payout run." />
            <SummaryCard icon={CalendarClock} label="Next payout" value="14 Jun" detail={`${payoutProfile.schedule} payout to ${payoutDestination}.`} />
            <SummaryCard icon={ReceiptText} label="This week" value="GBP 178.20" detail="Net earnings after current platform service fees." />
            <SummaryCard icon={ShieldCheck} label="Hourly rate" value={formatHourlyRate(savedHourlyRatePence)} detail="The lesson price learners see on your instructor profile." />
          </div>
        ) : null}

        {isWorkspace ? (
          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-brand">Set hourly rate</div>
              <h2 className="mt-2 text-2xl font-black">Choose what learners pay per hour.</h2>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
                This rate appears on your instructor profile and is used when learners compare instructors before checkout. You control the price, and you can update it whenever your business needs change.
              </p>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-700">
              Current rate: <span className="text-black">{formatHourlyRate(savedHourlyRatePence)}</span>
            </div>
          </div>
          <form onSubmit={saveHourlyRate} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,280px)_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-black">
              Hourly rate
              <span className="flex overflow-hidden rounded border border-zinc-300 bg-white">
                <span className="grid w-12 place-items-center border-r border-zinc-300 bg-zinc-50 text-lg font-black text-zinc-500">£</span>
                <input
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="45.00"
                  className="min-w-0 flex-1 px-3 py-3 font-bold outline-none"
                />
              </span>
            </label>
            <button type="submit" className="lda-pill lda-pill-sm self-end">
              {savingHourlyRate ? "Saving hourly rate..." : savedHourlyRatePence ? "Update hourly rate" : "Save hourly rate"}
            </button>
          </form>
          </section>
        ) : null}

        <div className={`grid gap-6 ${isWorkspace ? "lg:grid-cols-[1fr_1fr]" : "mx-auto w-full max-w-3xl"}`}>
          {isWorkspace || isPayoutStep ? (
            <section className="flex h-full flex-col rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase text-brand">Payout account</div>
                <h2 className="mt-2 text-2xl font-black">Where LDA pays you.</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
                <Building2 size={24} />
              </div>
            </div>
            <div className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
              Current destination: <span className="font-black text-black">{savedPayout ? payoutDestination : "Not saved yet"}</span>. Full account details stay masked after saving.
              {savedPayout ? (
                <>
                  <span className="mt-2 block text-xs uppercase text-emerald-700">
                    Saved {new Date(savedPayout.savedAt).toLocaleDateString("en-GB")} - Stripe status: {savedPayout.verificationStatus}
                  </span>
                  <span className="mt-2 block text-xs text-zinc-600">
                    Payee, bank, and schedule are filled from your profile. Enter the full sort code and account number only when replacing the saved destination.
                  </span>
                </>
              ) : null}
            </div>
            {isPayoutStep && savedPayout ? (
              <Link href="/instructor-setup/tax" className="lda-pill lda-pill-sm mt-5 self-start">
                Continue with saved details <ArrowRight size={17} />
              </Link>
            ) : null}
            <form onSubmit={savePayout} className="mt-5 flex flex-1 flex-col gap-4">
              <label className="grid gap-2 text-sm font-black">
                Payee name
                <input value={payoutProfile.payeeName} onChange={(event) => setPayoutProfile({ ...payoutProfile, payeeName: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Bank name
                <input value={payoutProfile.bankName} onChange={(event) => setPayoutProfile({ ...payoutProfile, bankName: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black">
                  Sort code
                  <input
                    value={payoutProfile.sortCode}
                    onChange={(event) => setPayoutProfile({ ...payoutProfile, sortCode: event.target.value })}
                    inputMode="numeric"
                    placeholder={savedPayout ? `Saved ${savedPayout.sortCodeEnding}` : "6 digits"}
                    className="rounded border border-zinc-300 px-3 py-3 font-bold"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black">
                  Account number
                  <input
                    value={payoutProfile.accountNumber}
                    onChange={(event) => setPayoutProfile({ ...payoutProfile, accountNumber: event.target.value })}
                    inputMode="numeric"
                    placeholder={savedPayout ? `Saved ${savedPayout.accountEnding}` : "8 digits"}
                    className="rounded border border-zinc-300 px-3 py-3 font-bold"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black">
                Payout schedule
                <select value={payoutProfile.schedule} onChange={(event) => setPayoutProfile({ ...payoutProfile, schedule: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                  <option>Weekly</option>
                  <option>Fortnightly</option>
                  <option>Monthly</option>
                </select>
              </label>
              <button type="submit" className="lda-pill lda-pill-sm mt-auto self-start">
                {savingPayout
                  ? "Checking payout details..."
                  : isPayoutStep
                    ? savedPayout
                      ? "Replace payout details and continue"
                      : "Save and continue to Step 3"
                    : savedPayout
                      ? "Edit payout details"
                      : "Save payout details"}
              </button>
            </form>
          </section>
          ) : null}

          {isWorkspace || isTaxStep ? (
            <section className="flex h-full flex-col rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase text-brand">Tax profile</div>
                <h2 className="mt-2 text-2xl font-black">Self-employed finance details.</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
                <FileText size={24} />
              </div>
            </div>
            <p className="mt-4 text-sm font-bold leading-6 text-zinc-600">
              LDA checks the official UTR and National Insurance formats before saving. HMRC live-number validation is used only when a configured HMRC validation connector is available; otherwise the profile is saved for manual evidence review.
            </p>
            {savedTax ? (
              <div className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
                Saved tax profile: UTR {savedTax.utrEnding}, NI {savedTax.nationalInsuranceEnding}. HMRC status:{" "}
                <span className="font-black text-black">{savedTax.hmrcCheckStatus}</span>.
                <span className="mt-2 block text-xs text-zinc-600">
                  Trading, tax code, and VAT status are filled from your profile. Enter complete protected identifiers only when replacing the saved values.
                </span>
              </div>
            ) : null}
            {isTaxStep && savedTax ? (
              <Link
                href="/instructor-setup?message=Your%20saved%20tax%20profile%20is%20unchanged.%20Review%20any%20remaining%20setup%20items."
                className="lda-pill lda-pill-sm mt-5 self-start"
              >
                Finish with saved details <ArrowRight size={17} />
              </Link>
            ) : null}
            <form onSubmit={saveTax} className="mt-5 flex flex-1 flex-col gap-4">
              <label className="grid gap-2 text-sm font-black">
                Trading status
                <select value={taxProfile.tradingStatus} onChange={(event) => setTaxProfile({ ...taxProfile, tradingStatus: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                  <option>Sole trader</option>
                  <option>Limited company</option>
                  <option>Partnership</option>
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black">
                  UTR
                  <input
                    value={taxProfile.utr}
                    onChange={(event) => setTaxProfile({ ...taxProfile, utr: event.target.value })}
                    placeholder={savedTax ? `Saved ${savedTax.utrEnding}` : "10-digit HMRC reference"}
                    className="rounded border border-zinc-300 px-3 py-3 font-bold"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black">
                  National Insurance
                  <input
                    value={taxProfile.nationalInsurance}
                    onChange={(event) => setTaxProfile({ ...taxProfile, nationalInsurance: event.target.value })}
                    placeholder={savedTax ? `Saved ${savedTax.nationalInsuranceEnding}` : "AB123456C"}
                    className="rounded border border-zinc-300 px-3 py-3 font-bold"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black">
                Tax code, optional
                <input value={taxProfile.taxCode} onChange={(event) => setTaxProfile({ ...taxProfile, taxCode: event.target.value })} placeholder="Only if applicable" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black">
                  VAT status
                  <select value={taxProfile.vatStatus} onChange={(event) => setTaxProfile({ ...taxProfile, vatStatus: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                    <option>Not VAT registered</option>
                    <option>VAT registered</option>
                    <option>Registration pending</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black">
                  VAT number
                  <input
                    value={taxProfile.vatNumber}
                    onChange={(event) => setTaxProfile({ ...taxProfile, vatNumber: event.target.value })}
                    placeholder={savedTax?.vatNumberEnding ? `Saved ${savedTax.vatNumberEnding}` : "If VAT registered"}
                    className="rounded border border-zinc-300 px-3 py-3 font-bold"
                  />
                </label>
              </div>
              <div className="grid gap-2 text-sm font-black">
                Accounting method
                <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-3 font-bold text-zinc-700">
                  Traditional accounting
                </div>
              </div>
              <button type="submit" className="lda-pill lda-pill-sm mt-auto self-start">
                {savingTax
                  ? "Checking tax profile..."
                  : isTaxStep
                    ? savedTax
                      ? "Replace tax details and finish"
                      : "Save Step 3 and finish"
                    : savedTax
                      ? "Edit tax profile"
                      : "Save tax profile"}
              </button>
            </form>
          </section>
          ) : null}
        </div>

        {isWorkspace ? (
          <>
            <section className="rounded border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-5">
            <div>
              <div className="text-sm font-black uppercase text-brand">Earnings</div>
              <h2 className="mt-2 text-2xl font-black">Lesson earnings and statements.</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                value={statementMonth}
                onChange={(event) => setStatementMonth(event.target.value)}
                className="rounded border border-zinc-300 px-3 py-2 text-sm font-black"
                aria-label="Statement month"
              />
              <a href={`/api/instructor-finance/statement?month=${encodeURIComponent(statementMonth)}`} className="lda-pill lda-pill-sm">
                <Download size={17} /> Download statement
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-zinc-50 text-xs font-black uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Reference</th>
                  <th className="px-5 py-4">Pupil</th>
                  <th className="px-5 py-4">Gross</th>
                  <th className="px-5 py-4">LDA fee</th>
                  <th className="px-5 py-4">Net</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm font-bold text-zinc-700">
                {earningsRows.map((row) => (
                  <tr key={row.reference} className="hover:bg-zinc-50">
                    <td className="px-5 py-4">{row.date}</td>
                    <td className="px-5 py-4 font-mono text-xs">{row.reference}</td>
                    <td className="px-5 py-4 font-black text-black">{row.pupil}</td>
                    <td className="px-5 py-4">{row.gross}</td>
                    <td className="px-5 py-4">{row.fee}</td>
                    <td className="px-5 py-4 font-black text-black">{row.net}</td>
                    <td className="px-5 py-4">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Payout history</div>
            <div className="mt-4 grid gap-3">
              {payoutRows.map((row) => (
                <div key={`${row.date}-${row.amount}`} className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold">
                  <div>
                    <div className="font-black text-black">{row.amount}</div>
                    <div className="mt-1 text-zinc-600">{row.date} to {row.destination}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-zinc-700 ring-1 ring-zinc-200">{row.status}</span>
                </div>
              ))}
            </div>
              </section>

              <section className="rounded border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
            <LockKeyhole className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Finance compliance controls.</h2>
            <div className="mt-5 grid gap-3 text-sm font-bold leading-6 text-zinc-300">
              {[
                "Only masked bank details should be displayed after saving.",
                "Payout account changes should trigger re-verification before money moves.",
                "Instructor tax details are stored for payout records, not tax advice.",
                "Statements should be downloadable for self-assessment records.",
                "VAT status should be reviewed when turnover approaches the registration threshold."
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                  {item}
                </div>
              ))}
            </div>
              </section>
            </div>
          </>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 border-t border-zinc-200 pt-5">
            <Link href={isTaxStep ? "/instructor-setup/finance" : "/instructor-setup"} className="inline-flex items-center gap-2 text-sm font-black text-zinc-700 hover:text-brand">
              <ArrowLeft size={17} /> Back to {isTaxStep ? "Step 2" : "Step 1"}
            </Link>
            <Link href="/instructor-finance?from=setup" className="text-sm font-black text-brand hover:text-red-700">
              Open full finance workspace
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
