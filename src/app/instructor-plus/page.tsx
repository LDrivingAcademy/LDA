import { BadgeCheck } from "lucide-react";

import { InstructorPackageCard } from "@/components/instructor-package-card";
import { PageTopBar } from "@/components/page-top-bar";
import { instructorPackages } from "@/lib/instructor-packages";

export default function InstructorPlusPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/instructor-dashboard" backLabel="Back to instructor dashboard" />
      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase text-brand">
            <BadgeCheck size={18} />
            Instructor packages
          </div>
          <h1 className="mt-8 max-w-4xl text-5xl font-black leading-tight tracking-tight text-black sm:text-6xl">
            Choose your LDA instructor package.
          </h1>
          <p className="mt-6 max-w-4xl text-xl font-medium leading-9 text-neutral-600">
            Your current package is Instructor. Each tile opens a full breakdown, and paid package
            buttons are wired to Stripe subscription Checkout once the monthly and yearly Price IDs
            are added in Vercel.
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {instructorPackages.map((instructorPackage) => (
              <InstructorPackageCard key={instructorPackage.id} instructorPackage={instructorPackage} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
