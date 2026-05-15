import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="grid h-[60px] w-[104px] shrink-0 place-items-center overflow-hidden rounded bg-black p-1 shadow-sm ring-1 ring-white/20 focus-ring sm:h-[75px] sm:w-[130px]" aria-label="L Driving Academy home">
      <img src="/lda-logo.jpg" alt="L Driving Academy" width={520} height={300} className="h-full w-full object-contain object-center" />
    </Link>
  );
}
