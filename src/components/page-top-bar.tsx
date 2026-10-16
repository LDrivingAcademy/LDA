import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { MainMenu } from "@/components/main-menu";
import type { HeaderAccountSummary } from "@/lib/current-account";

export type PageTopBarProps = {
  backHref?: string;
  backLabel?: string;
  brandHref?: string;
  brandLabel?: string;
  useNavigationHistory?: boolean;
  hideMenu?: boolean;
  account?: HeaderAccountSummary | null;
};

export function PageTopBar({
  backHref = "/",
  backLabel = "Back to homepage",
  brandHref = "/",
  brandLabel = "L Driving Academy home",
  useNavigationHistory = false,
  hideMenu = false,
  account
}: PageTopBarProps) {
  return (
    <header className="lda-universal-topbar w-full bg-black text-white">
      <div className="lda-universal-topbar-inner mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-3 sm:px-6 lg:px-10">
        <Brand size="home" href={brandHref} label={brandLabel} />
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <DynamicBackLink
            fallbackHref={backHref}
            fallbackLabel={backLabel}
            useNavigationHistory={useNavigationHistory}
            className="hidden max-w-[52vw] min-w-0 items-center gap-2 truncate rounded-full px-3 py-2 text-sm font-bold text-white hover:text-white min-[481px]:inline-flex"
          />
          {hideMenu ? null : <MainMenu account={account} />}
        </div>
      </div>
    </header>
  );
}
