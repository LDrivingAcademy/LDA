import type { ReactNode } from "react";
import { AdminBackToDashboardLink } from "@/components/admin-page-header";

type TechnicalSupportPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  containerClassName?: string;
  right?: ReactNode;
  showAdminBack?: boolean;
};

export function TechnicalSupportPageHeader({
  eyebrow,
  title,
  containerClassName = "max-w-7xl",
  description,
  right,
  showAdminBack = false
}: TechnicalSupportPageHeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-ink px-4 py-7 sm:py-8">
      <section className={`mx-auto ${containerClassName}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="order-2 min-w-0 lg:order-1">
            <div className="text-sm font-black uppercase text-red-200">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-5xl">{title}</h1>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-zinc-300">{description}</p>
            ) : null}
          </div>
          {(showAdminBack || right) ? (
            <div className="order-1 flex w-full min-w-0 flex-col items-start gap-3 sm:items-end lg:order-2 lg:w-auto lg:min-w-[220px]">
              {showAdminBack ? <AdminBackToDashboardLink /> : null}
              {right ? <div className="w-full sm:w-auto">{right}</div> : null}
            </div>
          ) : null}
        </div>
      </section>
    </header>
  );
}
