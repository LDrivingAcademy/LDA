import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="grid h-[86px] w-[270px] shrink-0 place-items-center focus-ring sm:h-[96px] sm:w-[320px]" aria-label="L Driving Academy home">
      <img src="/lda-logo-transparent.svg" alt="L Driving Academy" width={4096} height={2363} className="h-full w-full object-contain object-center" />
    </Link>
  );
}
