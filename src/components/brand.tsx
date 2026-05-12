import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="grid h-14 w-40 place-items-center overflow-hidden rounded bg-white p-1 shadow-sm ring-1 ring-white/30 focus-ring sm:h-16 sm:w-48" aria-label="L Driving Academy home">
      <img src="/lda-logo.jpg" alt="L Driving Academy" className="h-full w-full object-contain" />
    </Link>
  );
}
