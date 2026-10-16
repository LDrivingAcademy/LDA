import Link from "next/link";
import type { Metadata } from "next";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Public Sitemap | L Driving Academy",
  description: "Public L Driving Academy links for learners, instructors, support, and policies.",
  robots: {
    index: false,
    follow: true,
    nocache: true
  }
};

const sitemapLinks = [
  { href: "/", label: "Home" },
  { href: "/lesson-now?from=sitemap", label: "Book on demand" },
  { href: "/planned-lessons?from=sitemap", label: "Schedule lessons" },
  { href: "/smart-match?from=sitemap", label: "Smart Match" },
  { href: "/instructor?from=sitemap", label: "Become an instructor" },
  { href: "/social?from=sitemap", label: "Driving tips and offers" },
  { href: "/about?from=sitemap", label: "About" },
  { href: "/contact?from=sitemap", label: "Help" },
  { href: "/safety", label: "Safety" },
  { href: "/roadworthy?from=sitemap", label: "Driving tips & refresher" },
  { href: "/privacy?from=sitemap", label: "Privacy Policy" },
  { href: "/terms?from=sitemap", label: "Terms of Use" },
  { href: "/cookies?from=sitemap", label: "Cookie Policy" },
  { href: "/accessibility?from=sitemap", label: "Accessibility" }
];

export default function SitemapPage() {
  return (
    <>
      <PageTopBar backHref="/" backLabel="Back to homepage" />
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-5xl font-black tracking-normal">Sitemap</h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              Quick links to LDA public pages for guests, learners, instructors, support, and policy information.
            </p>
          </div>
        </section>
        <section className="mx-auto grid max-w-5xl gap-3 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:px-8">
          {sitemapLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded bg-zinc-100 p-4 font-black hover:bg-zinc-200">
              {link.label}
            </Link>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
