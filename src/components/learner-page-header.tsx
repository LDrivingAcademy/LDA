import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";

type LearnerPageHeaderProps = {
  eyebrow: string;
  title: string;
  body: string;
  backHref?: string;
  backLabel?: string;
  brandHref?: string;
  brandLabel?: string;
  useNavigationHistory?: boolean;
};

export function LearnerPageHeader({
  eyebrow,
  title,
  body,
  backHref = "/",
  backLabel = "Back to homepage",
  brandHref = "/",
  brandLabel = "L Driving Academy home",
  useNavigationHistory = false
}: LearnerPageHeaderProps) {
  return (
    <>
      <header className="lda-universal-topbar sticky top-0 z-30 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-5 px-[15px]">
          <Brand href={brandHref} label={brandLabel} />
          <DynamicBackLink
            fallbackHref={backHref}
            fallbackLabel={backLabel}
            iconSize={17}
            useNavigationHistory={useNavigationHistory}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-white hover:text-zinc-200"
          />
        </div>
      </header>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black uppercase text-red-100">{eyebrow}</div>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">{body}</p>
        </div>
      </section>
    </>
  );
}
