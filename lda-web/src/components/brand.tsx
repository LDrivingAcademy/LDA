import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 focus-ring rounded-sm">
      <div className="grid h-10 w-10 place-items-center rounded bg-brand text-base font-black text-white">L</div>
      <div className="leading-tight">
        <div className="text-base font-black tracking-normal">LDA</div>
        <div className="text-xs font-semibold text-muted">Click. Learn. Drive.</div>
      </div>
    </Link>
  );
}
