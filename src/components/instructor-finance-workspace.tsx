"use client";

import { FormEvent, useMemo, useState } from "react";
import {
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
  accountingMethod: string;
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

export function InstructorFinanceWorkspace() {
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile>({
    payeeName: "Joshua M.N",
    bankName: "Barclays",
    sortCode: "12-34-56",
    accountNumber: "00001184",
    schedule: "Weekly"
  });
  const [taxProfile, setTaxProfile] = useState<TaxProfile>({
    tradingStatus: "Sole trader",
    utr: "12345 67890",
    nationalInsurance: "QQ 12 34 56 C",
    taxCode: "",
    vatStatus: "Not VAT registered",
    vatNumber: "",
    accountingMethod: "Cash basis"
  });
  const [message, setMessage] = useState("");

  const payoutDestination = useMemo(
    () => `${payoutProfile.bankName || "Bank"} ${maskEnding(payoutProfile.accountNumber)}`,
    [payoutProfile.accountNumber, payoutProfile.bankName]
  );

  function savePayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Payout details updated for secure review.");
  }

  function saveTax(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Tax profile updated for secure review.");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <BadgePoundSterling size={17} /> Instructor finance
          </div>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Earnings, payouts, and tax profile.</h1>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            Review lesson earnings, manage the payout account, keep tax details ready, and download finance records from one professional workspace.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Wallet} label="Ready for payout" value="GBP 48.60" detail="Cleared lesson earnings awaiting the next payout run." />
          <SummaryCard icon={CalendarClock} label="Next payout" value="14 Jun" detail={`${payoutProfile.schedule} payout to ${payoutDestination}.`} />
          <SummaryCard icon={ReceiptText} label="This week" value="GBP 178.20" detail="Net earnings after current platform service fees." />
          <SummaryCard icon={ShieldCheck} label="Compliance" value="Review" detail="Tax, VAT, and payout identity details should stay current." />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
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
              Current destination: <span className="font-black text-black">{payoutDestination}</span>. Full account details stay masked after saving.
            </div>
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
                  <input value={payoutProfile.sortCode} onChange={(event) => setPayoutProfile({ ...payoutProfile, sortCode: event.target.value })} inputMode="numeric" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </label>
                <label className="grid gap-2 text-sm font-black">
                  Account number
                  <input value={payoutProfile.accountNumber} onChange={(event) => setPayoutProfile({ ...payoutProfile, accountNumber: event.target.value })} inputMode="numeric" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
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
                Save payout details
              </button>
            </form>
          </section>

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
              For UK self-employed instructors, UTR, National Insurance, VAT status, and accounting method are usually more relevant than a PAYE tax code. A tax code field is still available where needed.
            </p>
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
                  <input value={taxProfile.utr} onChange={(event) => setTaxProfile({ ...taxProfile, utr: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </label>
                <label className="grid gap-2 text-sm font-black">
                  National Insurance
                  <input value={taxProfile.nationalInsurance} onChange={(event) => setTaxProfile({ ...taxProfile, nationalInsurance: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
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
                  <input value={taxProfile.vatNumber} onChange={(event) => setTaxProfile({ ...taxProfile, vatNumber: event.target.value })} placeholder="If VAT registered" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black">
                Accounting method
                <select value={taxProfile.accountingMethod} onChange={(event) => setTaxProfile({ ...taxProfile, accountingMethod: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                  <option>Cash basis</option>
                  <option>Traditional accounting</option>
                </select>
              </label>
              <button type="submit" className="lda-pill lda-pill-sm mt-auto self-start">
                Save tax profile
              </button>
            </form>
          </section>
        </div>

        <section className="rounded border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-5">
            <div>
              <div className="text-sm font-black uppercase text-brand">Earnings</div>
              <h2 className="mt-2 text-2xl font-black">Lesson earnings and statements.</h2>
            </div>
            <button type="button" className="lda-pill lda-pill-sm">
              <Download size={17} /> Download statement
            </button>
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
      </section>
    </main>
  );
}
