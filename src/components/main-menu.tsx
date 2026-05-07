import Link from "next/link";
import { Menu } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";

const menuLinks = [
  { href: "/auth/login?role=learner", label: "Learner login" },
  { href: "/auth/login?role=instructor", label: "Instructor login" },
  { href: "/auth/login?role=admin&next=/admin", label: "Admin login" },
  { href: "/instructor", label: "Become an instructor" },
  { href: "/contact", label: "Support" }
];

export function MainMenu() {
  return (
    <details className="group relative">
      <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded border border-zinc-700 bg-zinc-950 text-white hover:border-red-500 focus-ring [&::-webkit-details-marker]:hidden" aria-label="Open menu">
        <Menu size={24} />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded border border-zinc-800 bg-zinc-950 py-2 text-white shadow-2xl">
        <div className="border-b border-zinc-800 px-4 py-3">
          <LanguageSelector />
        </div>
        {menuLinks.map((link) => (
          <Link key={link.href} href={link.href} className="block px-4 py-3 text-sm font-black hover:bg-red-500/10 hover:text-brand">
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
