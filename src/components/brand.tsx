import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="grid h-12 w-40 shrink-0 place-items-center overflow-hidden rounded bg-black shadow-sm ring-1 ring-white/20 focus-ring sm:h-14 sm:w-44" aria-label="L Driving Academy home">
      <img src="/lda-logo.jpg" alt="L Driving Academy" className="h-full w-full object-cover object-center" />
    </Link>
  );
}
