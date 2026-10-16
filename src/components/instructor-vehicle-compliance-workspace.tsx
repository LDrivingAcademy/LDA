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

export type ComplianceStatus = "verified" | "review" | "due" | "missing";

export type ComplianceItem = {
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
  adiNumber: string;
  badgeNumber: string;
  badgeExpiry: string;
  fullLicenceHeldSince: string;
  drivingLicenceExpiry: string;
  dbsRenewal: string;
  standardsCheckDue: string;
  dvsaStatusChecked: string;
};

type VehicleComplianceProfile = {
  insuranceProvider: string;
  policyNumber: string;
  insuranceExpiry: string;
  tuitionCover: string;
  publicLiabilityExpiry: string;
  motExpiry: string;
  taxExpiry: string;
  serviceDue: string;
  tyreCheck: string;
  tyreTreadDepth: string;
  lightsVisibilityCheck: string;
  brakesSteeringCheck: string;
  dualControlsCheck: string;
};

type ComplianceBlocker = {
  label: string;
  detail: string;
};

type ComplianceSection = "licence" | "vehicle" | "compliance";

const complianceSections: Array<{
  id: ComplianceSection;
  label: string;
  title: string;
  description: string;
  icon: typeof FileCheck2;
}> = [
  {
    id: "licence",
    label: "Licence",
    title: "Instructor licence",
    description: "ADI authority, driving licence, DBS renewal, standards check, and DVSA status evidence.",
    icon: FileCheck2
  },
  {
    id: "vehicle",
    label: "Vehicle",
    title: "Training vehicle",
    description: "Registration, keeper authority, transmission, mileage, and vehicle identity.",
    icon: Gauge
  },
  {
    id: "compliance",
    label: "Compliance",
    title: "Insurance and safety",
    description: "Paid tuition cover, MOT, tax, service dates, roadworthiness, and daily safety checks.",
    icon: ShieldCheck
  }
];

const fallbackItems: ComplianceItem[] = [
  {
    id: "adi",
    title: "ADI badge",
    owner: "Instructor",
    expiry: "12 Sep 2026",
    status: "verified",
    note: "ADI badge recorded. The correct green ADI badge must be displayed in the windscreen during paid lessons."
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
    id: "standards",
    title: "DVSA standards check",
    owner: "Instructor",
    expiry: "1 May 2027",
    status: "verified",
    note: "ADI standards check due date recorded. ADI registration, standards check, and DBS renewal cadence should be reviewed every 4 years."
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
    id: "liability",
    title: "Business/public liability cover",
    owner: "Instructor",
    expiry: "2 Nov 2026",
    status: "review",
    note: "Not a substitute for motor insurance. Record any LDA-required business or public liability cover for learner-facing work."
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
    note: "Book service, tyres, brakes, lights, wipers, mirrors, warning lights, emissions, and dual-control checks."
  },
  {
    id: "documents",
    title: "Document evidence",
    owner: "LDA",
    expiry: "Missing",
    status: "missing",
    note: "Upload ADI authority, driving licence, DBS/standards evidence, insurance certificate, MOT/tax confirmation, service record, and roadworthiness evidence for review."
  }
];

const statusStyles: Record<ComplianceStatus, { label: string; className: string }> = {
  verified: { label: "Verified", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  review: { label: "Review", className: "border-sky-200 bg-sky-50 text-sky-800" },
  due: { label: "Due soon", className: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { label: "Missing", className: "border-red-200 bg-red-50 text-red-800" }
};

const quickChecks = [
  { label: "Check instructor status", href: "https://www.gov.uk/find-driving-schools-and-lessons" },
  { label: "Check MOT", href: "https://www.gov.uk/check-mot-status" },
  { label: "Check vehicle tax", href: "https://www.gov.uk/check-vehicle-tax" },
  { label: "Insurance guidance", href: "https://www.gov.uk/vehicle-insurance" },
  { label: "Highway Code maintenance", href: "https://www.gov.uk/guidance/the-highway-code/annex-6-vehicle-maintenance-safety-and-security" },
  { label: "ADI register guidance", href: "https://www.gov.uk/become-car-driving-instructor" }
];

function isPastDate(value: string) {
  if (!value) return true;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return date < today;
}

function isFutureOrInvalidDate(value: string) {
  if (!value) return true;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return date > today;
}

function isOlderThanDays(value: string, days: number) {
  if (!value) return true;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

export function InstructorVehicleComplianceWorkspace({
  instructorName,
  initialComplianceItems
}: {
  instructorName: string;
  initialComplianceItems?: ComplianceItem[];
}) {
  const [activeSection, setActiveSection] = useState<ComplianceSection>("licence");
  const [vehicle, setVehicle] = useState<VehicleProfile>({
    registration: "AB12 LDA",
    makeModel: "Toyota Yaris Hybrid",
    transmission: "Automatic",
    year: "2023",
    keeperName: "Joshua M.N",
    mileage: "18420"
  });
  const [licence, setLicence] = useState<LicenceProfile>({
    adiNumber: "ADI-123456",
    badgeNumber: "GREEN-48921",
    badgeExpiry: "2026-09-12",
    fullLicenceHeldSince: "2020-06-01",
    drivingLicenceExpiry: "2028-03-18",
    dbsRenewal: "2026-08-20",
    standardsCheckDue: "2027-05-01",
    dvsaStatusChecked: "2026-06-17"
  });
  const [vehicleCompliance, setVehicleCompliance] = useState<VehicleComplianceProfile>({
    insuranceProvider: "LDA Insurance Partner",
    policyNumber: "POL-884200",
    insuranceExpiry: "2026-11-02",
    tuitionCover: "Confirmed",
    publicLiabilityExpiry: "2026-11-02",
    motExpiry: "2027-01-14",
    taxExpiry: "2026-12-01",
    serviceDue: "2026-07-30",
    tyreCheck: "2026-06-17",
    tyreTreadDepth: "3.2",
    lightsVisibilityCheck: "2026-06-17",
    brakesSteeringCheck: "2026-06-17",
    dualControlsCheck: "2026-06-17"
  });
  const [items, setItems] = useState(initialComplianceItems?.length ? initialComplianceItems : fallbackItems);
  const [message, setMessage] = useState("");
  const activeSectionMeta = complianceSections.find((section) => section.id === activeSection) ?? complianceSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;

  const counts = useMemo(
    () => ({
      verified: items.filter((item) => item.status === "verified").length,
      review: items.filter((item) => item.status === "review").length,
      due: items.filter((item) => item.status === "due").length,
      missing: items.filter((item) => item.status === "missing").length
    }),
    [items]
  );

  const blockerReasons = useMemo<ComplianceBlocker[]>(() => {
    const statusBlockers = items
      .filter((item) => item.status === "missing" || item.status === "review")
      .map((item) => ({
        label: item.title,
        detail: item.status === "missing" ? "Required evidence is missing." : "Evidence is under LDA review."
      }));

    const expiryBlockers = [
      { label: "ADI badge", value: licence.badgeExpiry },
      { label: "Driving licence", value: licence.drivingLicenceExpiry },
      { label: "DBS renewal", value: licence.dbsRenewal },
      { label: "DVSA standards check", value: licence.standardsCheckDue },
      { label: "Insurance", value: vehicleCompliance.insuranceExpiry },
      { label: "Business/public liability cover", value: vehicleCompliance.publicLiabilityExpiry },
      { label: "MOT", value: vehicleCompliance.motExpiry },
      { label: "Vehicle tax", value: vehicleCompliance.taxExpiry },
      { label: "Service and safety check", value: vehicleCompliance.serviceDue },
      { label: "Tyre check", value: vehicleCompliance.tyreCheck },
      { label: "Lights, glass, mirrors, wipers, and visibility check", value: vehicleCompliance.lightsVisibilityCheck },
      { label: "Brakes, steering, horn, seat belts, and warning lights check", value: vehicleCompliance.brakesSteeringCheck },
      { label: "Dual controls / safety equipment check", value: vehicleCompliance.dualControlsCheck }
    ]
      .filter((item) => isPastDate(item.value))
      .map((item) => ({
        label: item.label,
        detail: "Expiry date is missing, invalid, or already passed."
      }));

    const instructorEligibilityBlockers = [
      ...(isFutureOrInvalidDate(licence.fullLicenceHeldSince)
        ? [
            {
              label: "Full driving licence held since",
              detail: "Record a valid historic date for when the instructor first held a full car licence."
            }
          ]
        : []),
      ...(isOlderThanDays(licence.dvsaStatusChecked, 90)
        ? [
            {
              label: "DVSA instructor status check",
              detail: "Refresh the DVSA instructor status check before learner-facing availability is approved."
            }
          ]
        : [])
    ];

    const tyreTreadDepth = Number.parseFloat(vehicleCompliance.tyreTreadDepth);
    const tyreBlockers =
      Number.isFinite(tyreTreadDepth) && tyreTreadDepth >= 1.6
        ? []
        : [
            {
              label: "Tyre tread depth",
              detail: "Cars used for lessons must record at least the legal 1.6mm minimum across the central three-quarters of the tread."
            }
          ];

    const tuitionCoverBlockers =
      vehicleCompliance.tuitionCover === "Confirmed"
        ? []
        : [
            {
              label: "Paid tuition cover",
              detail: "Paid driving tuition insurance must be confirmed before learner bookings reopen."
            }
          ];

    return [...statusBlockers, ...expiryBlockers, ...instructorEligibilityBlockers, ...tyreBlockers, ...tuitionCoverBlockers];
  }, [
    items,
    licence.badgeExpiry,
    licence.dbsRenewal,
    licence.drivingLicenceExpiry,
    licence.dvsaStatusChecked,
    licence.fullLicenceHeldSince,
    vehicleCompliance.insuranceExpiry,
    licence.standardsCheckDue,
    vehicleCompliance.brakesSteeringCheck,
    vehicleCompliance.dualControlsCheck,
    vehicleCompliance.lightsVisibilityCheck,
    vehicleCompliance.motExpiry,
    vehicleCompliance.publicLiabilityExpiry,
    vehicleCompliance.serviceDue,
    vehicleCompliance.taxExpiry,
    vehicleCompliance.tuitionCover,
    vehicleCompliance.tyreCheck,
    vehicleCompliance.tyreTreadDepth
  ]);
  const learnerAvailabilityBlocked = blockerReasons.length > 0;

  function submitForReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      learnerAvailabilityBlocked
        ? "Compliance details submitted. Learner-facing availability stays paused until every blocker is cleared and approved."
        : "Vehicle and instructor compliance details submitted for LDA review."
    );
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

          <section className={`rounded border p-5 shadow-sm ${learnerAvailabilityBlocked ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase">{learnerAvailabilityBlocked ? "Learner availability paused" : "Learner availability clear"}</div>
                <h2 className="mt-2 text-2xl font-black">
                  {learnerAvailabilityBlocked ? "This instructor must not appear for new learner bookings." : "Required compliance evidence is clear for learner-facing availability."}
                </h2>
                <p className="mt-2 text-sm font-bold leading-6">
                  {learnerAvailabilityBlocked
                    ? "LDA blocks learner-facing search, slot visibility, and new checkout until missing, expired, or under-review evidence is resolved."
                    : "LDA can keep this instructor visible to learners while the evidence remains valid."}
                </p>
              </div>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase ${learnerAvailabilityBlocked ? "bg-red-900 text-white" : "bg-emerald-900 text-white"}`}>
                {learnerAvailabilityBlocked ? "Blocked" : "Bookable"}
              </span>
            </div>
            {learnerAvailabilityBlocked ? (
              <div className="mt-4 grid gap-2">
                {blockerReasons.slice(0, 4).map((blocker) => (
                  <div key={`${blocker.label}-${blocker.detail}`} className="rounded border border-red-200 bg-white/70 p-3 text-sm font-bold">
                    <span className="font-black">{blocker.label}:</span> {blocker.detail}
                  </div>
                ))}
                {blockerReasons.length > 4 ? (
                  <div className="text-sm font-black">+ {blockerReasons.length - 4} more blocker{blockerReasons.length - 4 === 1 ? "" : "s"} to clear.</div>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={CheckCircle2} label="Verified" value={String(counts.verified)} tone="green" />
            <Metric icon={ClipboardCheck} label="In review" value={String(counts.review)} tone="sky" />
            <Metric icon={CalendarClock} label="Due soon" value={String(counts.due)} tone="amber" />
            <Metric icon={TriangleAlert} label="Missing" value={String(counts.missing)} tone="red" />
          </div>

          <form onSubmit={submitForReview} className="grid gap-5">
            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase text-brand">Compliance workspace</div>
                  <h2 className="mt-2 text-2xl font-black">Update one area at a time.</h2>
                  <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
                    Keep the same compliance evidence on record without making instructors scroll through every field at once.
                  </p>
                </div>
                <ActiveSectionIcon className="text-brand" size={30} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {complianceSections.map((section) => {
                  const SectionIcon = section.icon;
                  const active = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`rounded border p-4 text-left transition ${
                        active
                          ? "border-black bg-black text-white"
                          : "border-zinc-300 bg-white text-black hover:border-brand"
                      }`}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-black uppercase ${active ? "text-red-200" : "text-brand"}`}>{section.label}</span>
                        <SectionIcon size={19} />
                      </div>
                      <div className="mt-2 text-lg font-black">{section.title}</div>
                      <p className={`mt-2 text-xs font-bold leading-5 ${active ? "text-zinc-300" : "text-zinc-600"}`}>
                        {section.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {activeSection === "licence" ? (
            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase text-brand">Instructor licence</div>
                  <h2 className="mt-2 text-2xl font-black">ADI and driving licence details.</h2>
                </div>
                <FileCheck2 className="text-brand" size={30} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="ADI number">
                  <input value={licence.adiNumber} onChange={(event) => setLicence({ ...licence, adiNumber: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="ADI badge or certificate number">
                  <input value={licence.badgeNumber} onChange={(event) => setLicence({ ...licence, badgeNumber: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="ADI badge expiry">
                  <input type="date" value={licence.badgeExpiry} onChange={(event) => setLicence({ ...licence, badgeExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Full car licence held since">
                  <input type="date" value={licence.fullLicenceHeldSince} onChange={(event) => setLicence({ ...licence, fullLicenceHeldSince: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
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
                <Field label="DVSA instructor status checked">
                  <input type="date" value={licence.dvsaStatusChecked} onChange={(event) => setLicence({ ...licence, dvsaStatusChecked: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
              </div>
              <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-600">
                LDA only accepts fully qualified approved driving instructors. Keep the ADI badge, ADI number, driving licence, DVSA status check, DBS renewal, and standards-check cadence current before learner-facing availability is approved.
              </p>
            </section>
            ) : null}

            {activeSection === "vehicle" ? (
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
              <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-600">
                Registration, keeper authority, transmission, and vehicle identity must match the car being used for learner lessons and any insurance, MOT, tax, service, and safety evidence uploaded to LDA.
              </p>
            </section>
            ) : null}

            {activeSection === "compliance" ? (
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
                <Field label="Business / public liability cover expiry">
                  <input type="date" value={vehicleCompliance.publicLiabilityExpiry} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, publicLiabilityExpiry: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
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
                <Field label="Lowest tyre tread recorded (mm)">
                  <input value={vehicleCompliance.tyreTreadDepth} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, tyreTreadDepth: event.target.value })} inputMode="decimal" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Lights, glass, mirrors, wipers checked">
                  <input type="date" value={vehicleCompliance.lightsVisibilityCheck} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, lightsVisibilityCheck: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Brakes, steering, horn, belts, warning lights checked">
                  <input type="date" value={vehicleCompliance.brakesSteeringCheck} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, brakesSteeringCheck: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
                <Field label="Dual controls / safety equipment checked">
                  <input type="date" value={vehicleCompliance.dualControlsCheck} onChange={(event) => setVehicleCompliance({ ...vehicleCompliance, dualControlsCheck: event.target.value })} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                </Field>
              </div>
              <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-600">
                A current MOT, tax, and insurance record is not enough by itself. The vehicle must remain roadworthy between checks, including tyres, lights, brakes, steering, glass, mirrors, wipers, washers, demisters, seat belts, warning lights, emissions, and any dual controls or safety equipment used for lessons.
              </p>
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-900">
                Daily roadworthiness is a standing instructor agreement obligation. By operating on LDA, every instructor must make sure their vehicle is safe, legal, and roadworthy before every lesson. Failure to do so can be treated as a breach of contract and may lead to learner-facing availability being paused or account action.
              </p>
            </section>
            ) : null}

            <section className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 bg-white p-4 shadow-sm">
              <div>
                <div className="text-sm font-black uppercase text-brand">Ready to submit</div>
                <p className="mt-1 text-sm font-bold leading-6 text-zinc-600">
                  Upload evidence where needed, then save the current compliance profile for LDA review.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/instructor-verification?from=dashboard" className="lda-pill lda-pill-sm bg-black text-white">
                  <Upload size={17} /> Upload evidence
                </a>
                <button type="submit" className="lda-pill lda-pill-sm">
                  <BadgeCheck size={17} /> Save for LDA review
                </button>
              </div>
            </section>
          </form>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-5">
              <div className="text-sm font-black uppercase text-brand">Compliance tracker</div>
              <h2 className="mt-2 text-2xl font-black">Current evidence snapshot.</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
                A compact view of the records LDA needs to keep current before learner-facing availability stays open.
              </p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
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
                  <p className="mt-3 text-xs font-bold leading-5 text-zinc-700">{item.note}</p>
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
                "Tell LDA if ADI status, licence, vehicle, insurance, or keeper details change."
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
              LDA automatically pauses learner-facing availability when required evidence is missing, expired, under review, or paid tuition cover is not confirmed.
            </p>
            <div className="mt-4 rounded border border-red-200 bg-white p-3 text-sm font-black">
              Current enforcement: {learnerAvailabilityBlocked ? "paused until blockers are cleared." : "clear for learner-facing availability."}
            </div>
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
