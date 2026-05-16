import Link from "next/link";

type BrandSize = "home" | "page";

const brandSizes: Record<BrandSize, string> = {
  home: "h-[53px] w-[114px] sm:h-[62px] sm:w-[134px] lg:h-[64px] lg:w-[139px]",
  page: "h-[60px] w-[130px] sm:h-[70px] sm:w-[152px] lg:h-[73px] lg:w-[158px]"
};

export function Brand({ size = "page" }: { size?: BrandSize }) {
  return (
    <Link
      href="/"
      className={`flex ${brandSizes[size]} shrink-0 items-center justify-start overflow-hidden bg-black focus-ring`}
      aria-label="L Driving Academy home"
    >
      <img
        src="/lda-logo-transparent.svg"
        alt="L Driving Academy"
        width={4096}
        height={2363}
        className="h-full w-full object-contain object-left"
      />
    </Link>
  );
}
