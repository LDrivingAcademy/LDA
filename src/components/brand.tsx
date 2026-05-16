import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="flex h-[48px] w-[104px] shrink-0 items-center justify-start overflow-hidden bg-black focus-ring sm:h-[56px] sm:w-[122px] lg:h-[58px] lg:w-[126px]"
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
