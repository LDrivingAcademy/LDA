import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="grid h-14 w-36 place-items-center overflow-hidden rounded-sm bg-black focus-ring sm:h-16 sm:w-44" aria-label="L Driving Academy home">
      <img src="/lda-logo.jpg" alt="L Driving Academy" className="h-full w-full object-contain" />
    </Link>
  );
}
