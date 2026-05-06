import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-sm focus-ring">
      <div className="grid h-12 w-28 place-items-center overflow-hidden rounded border border-zinc-700 bg-black shadow-sm sm:w-32">
        <img src="/lda-logo.jpg" alt="" className="h-full w-full object-contain" />
      </div>
      <div className="leading-tight text-white">
        <div className="text-base font-black tracking-normal sm:text-lg">LDrivingAcademy</div>
        <div className="text-xs font-semibold text-zinc-300">Click. Learn. Drive.</div>
      </div>
    </Link>
  );
}
