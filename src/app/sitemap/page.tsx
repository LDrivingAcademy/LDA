import Link from "next/link";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";

const sitemapLinks = [
  { href: "/", label: "Home" },
  { href: "/auth/login?role=learner", label: "Learner login" },
  { href: "/instructor", label: "Instructor" },
  { href: "/lesson-now", label: "Lesson Now" },
  { href: "/tracking", label: "Live Tracking" },
  { href: "/progress-tracker", label: "Progress Tracker" },
  { href: "/roadworthy", label: "Tips directory" },
  { href: "/social", label: "Subscribe & Socials" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Help" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/cookies", label: "Cookie Policy" }
];

export default function SitemapPage() {
  return (
    <>
      <PageTopBar />
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-5xl font-black tracking-normal">Sitemap</h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              Quick links to the main learner, instructor, support, and policy pages.
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
