import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-sm focus-ring">
      <div className="grid h-11 w-11 place-items-center rounded bg-brand text-base font-black text-white shadow-sm">L</div>
      <div className="leading-tight text-white">
        <div className="text-base font-black tracking-normal">LDA</div>
        <div className="text-xs font-semibold text-zinc-300">Click. Learn. Drive.</div>
      </div>
    </Link>
  );
}
