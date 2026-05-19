import Link from "next/link";

type BrandSize = "home" | "page";

const brandSizes: Record<BrandSize, string> = {
  home: "h-[62px] w-[108px] sm:h-[72px] sm:w-[125px] lg:h-[78px] lg:w-[135px]",
  page: "h-[70px] w-[121px] sm:h-[82px] sm:w-[142px] lg:h-[88px] lg:w-[153px]"
};

export function Brand({ size = "page" }: { size?: BrandSize }) {
  return (
    <Link
      href="/"
      className={`flex ${brandSizes[size]} shrink-0 items-center justify-start overflow-hidden bg-black focus-ring`}
      aria-label="L Driving Academy home"
    >
      <img
        src="/lda-logo-520.svg"
        alt="L Driving Academy"
        width={520}
        height={300}
        className="h-full w-full object-contain object-left"
      />
    </Link>
  );
}
