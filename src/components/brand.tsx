import Link from "next/link";

type BrandSize = "home" | "page";

const brandSizes: Record<BrandSize, string> = {
  home: "h-[52px] w-[90px] sm:h-[72px] sm:w-[125px] lg:h-[78px] lg:w-[135px]",
  page: "h-[54px] w-[94px] sm:h-[82px] sm:w-[142px] lg:h-[88px] lg:w-[153px]"
};

export function Brand({ size = "page" }: { size?: BrandSize }) {
  return (
    <Link
      href="/"
      className={`flex ${brandSizes[size]} shrink-0 items-center justify-start overflow-hidden bg-black focus-ring`}
      aria-label="L Driving Academy home"
      data-logo-slot="lda-brand"
    >
      <img
        src="/lda-banner-logo.svg"
        alt="L Driving Academy"
        width={2860}
        height={1120}
        className="h-full w-full object-contain object-left"
      />
    </Link>
  );
}
