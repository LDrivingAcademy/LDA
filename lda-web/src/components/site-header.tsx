import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/learner/search" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white hover:text-foreground focus-ring">Find an instructor</Link>
          <Link href="/instructor/onboarding" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white hover:text-foreground focus-ring">Become an instructor</Link>
          <Link href="/admin" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white hover:text-foreground focus-ring">Admin</Link>
        </nav>
        <Link href="/learner/search" className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-strong focus-ring">
          <ShieldCheck size={16} aria-hidden="true" /> Start <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
