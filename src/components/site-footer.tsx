import Link from "next/link";
import { complianceLinks } from "@/lib/marketplace-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-black">LDA / L Driving Academy</div>
            <div className="mt-1 text-sm text-zinc-400">Click. Learn. Drive.</div>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-semibold text-zinc-300">
            {complianceLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-4xl text-xs leading-6 text-zinc-500">
          LDA is being prepared as a UK learner-driver marketplace. Legal, privacy, cancellation, and verification wording is placeholder operational guidance until reviewed by a qualified solicitor.
        </p>
      </div>
    </footer>
  );
}
