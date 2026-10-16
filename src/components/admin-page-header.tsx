import type { ReactNode } from "react";
import { DynamicBackLink } from "@/components/dynamic-back-link";

type AdminPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
};

export function AdminPageHeader({ eyebrow, title, description, right }: AdminPageHeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-ink px-4 py-7 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="text-sm font-black uppercase text-red-200">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">{title}</h1>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{description}</p>
            ) : null}
          </div>
          <div className="order-1 flex w-full min-w-0 flex-col items-start gap-3 sm:items-end lg:order-2 lg:w-auto lg:min-w-[220px]">
            <AdminBackToDashboardLink />
            {right ? <div className="w-full sm:w-auto">{right}</div> : null}
          </div>
        </div>
      </section>
    </header>
  );
}

export function AdminBackToDashboardLink({ className = "" }: { className?: string }) {
  return (
    <DynamicBackLink
      fallbackHref="/admin"
      fallbackLabel="Back to admin dashboard"
      className={`inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-zinc-800 bg-black px-4 py-3 text-sm font-black text-white shadow-sm transition hover:border-red-500 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-ink sm:px-5 ${className}`}
    />
  );
}
