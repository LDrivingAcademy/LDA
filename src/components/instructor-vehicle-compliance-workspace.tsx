"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Gauge,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Wrench
} from "lucide-react";

type ComplianceStatus = "verified" | "review" | "due" | "missing";

type ComplianceItem = {
  id: string;
  title: string;
  owner: string;
  expiry: string;
  status: ComplianceStatus;
  note: string;
};

type VehicleProfile = {
  registration: string;
  makeModel: string;
  transmission: string;
  year: string;
  keeperName: string;
  mileage: string;
};

type LicenceProfile = {
  instructorType: string;
  adiNumber: string;
  badgeNumber: string;
  badgeExpiry: string;
  drivingLicenceExpiry: string;
  dbsRenewal: string;
  standardsCheckDue: string;
};

type VehicleComplianceProfile = {
  insuranceProvider: string;
  policyNumber: string;
  insuranceExpiry: string;
  tuitionCover: string;
  motExpiry: string;
  taxExpiry: string;
  serviceDue: string;
  tyreCheck: string;
};

const initialItems: ComplianceItem[] = [
  {
    id: "adi",
    title: "ADI/PDI badge",
    owner: "Instructor",
    expiry: "12 Sep 2026",
    status: "verified",
    note: "Badge number recorded. Keep windscreen badge visible during paid lessons."
  },
  {
    id: "licence",
    title: "Driving licence",
    owner: "Instructor",
    expiry: "18 Mar 2028",
    status: "verified",
    note: "Licence expiry recorded. Notify LDA if endorsements or restrictions change."
  },
  {
    id: "dbs",
    title: "DBS renewal",
    owner: "Instructor",
    expiry: "20 Aug 2026",
    status: "due",
    note: "Renewal reminder should be sent before the four-year instructor renewal window."
  },
  {
    id: "insurance",
    title: "Motor insurance",
    owner: "Vehicle",
    expiry: "2 Nov 2026",
    status: "review",
    note: "Confirm business use and paid driving tuition cover before publishing availability."
  },
  {
    id: "mot",
    title: "MOT",
    owner: "Vehicle",
    expiry: "14 Jan 2027",
    status: "verified",
    note: "MOT recorded. Vehicle must still be roadworthy between tests."
  },
  {
    id: "tax",
    title: "Vehicle tax",
    owner: "Vehicle",
    expiry: "1 Dec 2026",
    status: "verified",
    note: "Tax status recorded from DVLA check."
  },
  {
    id: "service",
    title: "Service and safety check",
    owner: "Vehicle",
    expiry: "30 Jul 2026",
    status: "due",
    note: "Book service, tyres, brakes, lights, wipers, mirrors, and dual-control checks."
  },
  {
    id: "documents",
    title: "Document evidence",
    owner: "LDA",
    expiry: "Missing",
    status: "missing",
    note: "Upload insurance certificate, MOT/tax confirmation, and ADI/PDI proof for review."
  }
];

const statusStyles: Record<ComplianceStatus, { label: string; className: string }> = {
  verified: { label: "Verified", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  review: { label: "Review", className: "border-sky-200 bg-sky-50 text-sky-800" },
  due: { label: "Due soon", className: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { label: "Missing", className: "border-red-200 bg-red-50 text-red-800" }
};

const quickChecks = [
  { label: "Check MOT", href: "https://www.gov.uk/check-mot-status" },
  { label: "Check vehicle tax", href: "https://www.gov.uk/check-vehicle-tax" },
  { label: "Insurance guidance", href: "https://www.gov.uk/vehicle-insurance" },
  { label: "ADI steps", href: "https://www.gov.uk/become-car-driving-instructor" }
];

export function InstructorVehicleComplianceWorkspace({ instructorName }: { instructorName: string }) {
  const [vehicle, setVehicle] = useState<VehicleProfile>({
    registration: "AB12 LDA",
    makeModel: "Toyota Yaris Hybrid",
    transmission: "Automatic",
    year: "2023",
    keeperName: "Joshua M.N",
    mileage: "18420"
  });
  const [licence, setLicence] = useState<LicenceProfile>({
    instructorType: "ADI",
    adiNumber: "ADI-123456",
    badgeNumber: "GREEN-48921",
    badgeExpiry: "2026-09-12",
    drivingLicenceExpiry: "2028-03-18",
    dbsRenewal: "2026-08-20",
    standardsCheckDue: "2027-05-01"
  });
  const [vehicleCompliance, setVehicleCompliance] = useState<VehicleComplianceProfile>({
    insuranceProvider: "LDA Insurance Partner",
    policyNumber: "POL-884200",
    insuranceExpiry: "2026-11-02",
    tuitionCover: "Confirmed",
    motExpiry: "2027-01-14",
    taxExpiry: "2026-12-01",
    serviceDue: "2026-07-30",
    tyreCheck: "2026-06-17"
  });
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");

  const counts = useMemo(
    () => ({
      verified: items.filter((item) => item.status === "verified").length,
      review: items.filter((item) => item.status === "review").length,
      due: items.filter((item) => item.status === "due").length,
      missing: items.filter((item) => item.status === "missing").length
    }),
    [items]
  );

  function submitForReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Vehicle and instructor compliance details submitted for LDA review.");
    setItems((current) => current.map((item) => item.status === "missing" ? { ...item, status: "review", note: "Evidence added and awaiting LDA review." } : item));
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <CarFront size={17} /> Vehicle and compliance
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Keep licence and vehicle records up to date.</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                Track instructor eligibility, vehicle tax, MOT, insurance, servicing, and safety evidence before lessons are made available to learners.
              </p>
            </div>
            <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Signed in instructor</div>
              <div className="mt-2 text-2xl font-black">{instructorName}</div>
              <div className="mt-1 text-sm font-bold text-zinc-400">Private compliance workspace</div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <div className="grid gap-5">
          {message ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
              {message}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={CheckCircle2} label="Verified" value={String(counts.verified)} tone="green" />
            <Metric icon={ClipboardCheck} label="In review" value={String(counts.review)} tone="sky" />
            <Metric icon={CalendarClock} label="Due soon" value={String(counts.due)} tone="amber" />
            <Metric icon={TriangleAlert} label="Missing" value={String(counts.missing)} tone="red" />
          </div>

          <form onSubmit={submitForReview} className="grid gap-5">
            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase text-brand">Instructor licence</div>
                  <h2 className="mt-2 text-2xl font-black">ADI/PDI and driving licence details.</h2>
                </div>
                <FileCheck2 className="text-brand" size={30} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Instructor type">
                  <select value={licence.instructorType} onChange={(event) => setLicence({ ...licence, instructorType: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                    <option>ADI</option>
                    <option>PDI trainee licence</option>
                  </select>
                </Field>
                <Field label="ADI/PDI number">
                  <input value={licence.adiNumber} onChange={(event) => setLicence({ ...licence, adiNumber: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Badge or certificate number">
                  <input value={licence.badgeNumber} onChange={(event) => setLicence({ ...licence, badgeNumber: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="ADI/PDI badge expiry">
                  <input type="date" value={licence.badgeExpiry} onChange={(event) => setLicence({ ...licence, badgeExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Driving licence expiry">
                  <input type="date" value={licence.drivingLicenceExpiry} onChange={(event) => setLicence({ ...licence, drivingLicenceExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="DBS renewal due">
                  <input type="date" value={licence.dbsRenewal} onChange={(event) => setLicence({ ...licence, dbsRenewal: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Standards check due">
                  <input type="date" value={licence.standardsCheckDue} onChange={(event) => setLicence({ ...licence, standardsCheckDue: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
              </div>
            </section>

            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase text-brand">Training vehicle</div>
                  <h2 className="mt-2 text-2xl font-black">Car identity and safety records.</h2>
                </div>
                <Gauge className="text-brand" size={30} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Registration number">
                  <input value={vehicle.registration} onChange={(event) => setVehicle({ ...vehicle, registration: event.target.value.toUpperCase() })} className="rounded border border-zinc-300 px-3 py-3 font-bold uppercase" />
                </Field>
                <Field label="Make and model">
                  <input value={vehicle.makeModel} onChange={(event) => setVehicle({ ...vehicle, makeModel: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Transmission">
                  <select value={vehicle.transmission} onChange={(event) => setVehicle({ ...vehicle, transmission: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                    <option>Manual</option>
                    <option>Automatic</option>
                  </select>
                </Field>
                <Field label="Vehicle year">
                  <input value={vehicle.year} onChange={(event) => setVehicle({ ...vehicle, year: event.target.value })} inputMode="numeric" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Registered keeper">
                  <input value={vehicle.keeperName} onChange={(event) => setVehicle({ ...vehicle, keeperName: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Current mileage">
                  <input value={vehicle.mileage} onChange={(event) => setVehicle({ ...vehicle, mileage: event.target.value })} inputMode="numeric" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
              </div>
            </section>

            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase text-brand">Vehicle compliance</div>
                  <h2 className="mt-2 text-2xl font-black">Tax, MOT, insurance, and service dates.</h2>
                </div>
                <ShieldCheck className="text-brand" size={30} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Insurance provider">
                  <input value={vehicleCompliance.insuranceProvider} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, insuranceProvider: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Policy number">
                  <input value={vehicleCompliance.policyNumber} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, policyNumber: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Insurance expiry">
                  <input type="date" value={vehicleCompliance.insuranceExpiry} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, insuranceExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Paid tuition cover">
                  <select value={vehicleCompliance.tuitionCover} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, tuitionCover: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                    <option>Confirmed</option>
                    <option>Needs review</option>
                    <option>Not covered</option>
                  </select>
                </Field>
                <Field label="MOT expiry">
                  <input type="date" value={vehicleCompliance.motExpiry} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, motExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Vehicle tax expiry">
                  <input type="date" value={vehicleCompliance.taxExpiry} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, taxExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Service due">
                  <input type="date" value={vehicleCompliance.serviceDue} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, serviceDue: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Tyre and daily safety check">
                  <input type="date" value={vehicleCompliance.tyreCheck} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, tyreCheck: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="lda-pill lda-pill-sm bg-black text-white">
                  <Upload size={17} /> Upload evidence
                </button>
                <button type="submit" className="lda-pill lda-pill-sm">
                  <BadgeCheck size={17} /> Save for LDA review
                </button>
              </div>
            </section>
          </form>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-5">
              <div className="text-sm font-black uppercase text-brand">Compliance tracker</div>
              <h2 className="mt-2 text-2xl font-black">What LDA needs to keep current.</h2>
            </div>
            <div className="grid gap-3 p-5">
              {items.map((item) => (
                <article key={item.id} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black">{item.title}</div>
                      <div className="mt-1 text-sm font-bold text-zinc-500">{item.owner} - expires {item.expiry}</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyles[item.status].className}`}>
                      {statusStyles[item.status].label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">{item.note}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Official checks</div>
            <div className="mt-4 grid gap-3">
              {quickChecks.map((check) => (
                <a key={check.href} href={check.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-700 hover:bg-zinc-100">
                  {check.label}
                  <ExternalLink size={16} className="text-brand" />
                </a>
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
            <Wrench className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Lesson safety reminders</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-300">
              {[
                "Confirm paid tuition insurance before taking bookings.",
                "Do not use a vehicle for lessons if MOT, tax, insurance, or roadworthiness is in doubt.",
                "Log service, tyres, lights, mirrors, brakes, wipers, and dual-control checks.",
                "Tell LDA if licence, ADI/PDI status, vehicle, insurance, or keeper details change."
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm">
            <TriangleAlert />
            <h2 className="mt-3 text-2xl font-black">Blocker rules</h2>
            <p className="mt-3 text-sm font-bold leading-6">
              LDA should be able to pause learner-facing availability when required evidence is missing, expired, or under review.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      {children}
    </label>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone: "green" | "sky" | "amber" | "red" }) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700"
  }[tone];

  return (
    <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={`grid h-11 w-11 place-items-center rounded ${toneClass}`}>
        <Icon size={22} />
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm font-black uppercase text-zinc-500">{label}</div>
    </article>
  );
}
