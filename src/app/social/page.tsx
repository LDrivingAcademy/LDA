import Link from "next/link";
import { ArrowLeft, Facebook, Instagram, Linkedin, Mail, Music2, Play, Twitter } from "lucide-react";

const socialLinks = [
  {
    name: "Instagram",
    handle: "@ldrivingacademy",
    href: "https://www.instagram.com/ldrivingacademy",
    icon: Instagram
  },
  {
    name: "TikTok",
    handle: "@ldrivingacademy",
    href: "https://www.tiktok.com/@ldrivingacademy",
    icon: Music2
  },
  {
    name: "YouTube",
    handle: "@ldrivingacademy",
    href: "https://www.youtube.com/@ldrivingacademy",
    icon: Play
  },
  {
    name: "Facebook",
    handle: "LDrivingAcademy",
    href: "https://www.facebook.com/ldrivingacademy",
    icon: Facebook
  },
  {
    name: "X",
    handle: "@ldrivingacademy",
    href: "https://x.com/ldrivingacademy",
    icon: Twitter
  },
  {
    name: "LinkedIn",
    handle: "LDrivingAcademy",
    href: "https://www.linkedin.com/company/ldrivingacademy",
    icon: Linkedin
  }
];

export default async function SocialPage({
  searchParams
}: {
  searchParams: Promise<{ subscribed?: string; email?: string }>;
}) {
  const params = await searchParams;
  const subscribed = params.subscribed === "1";
  const email = params.email;

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-zinc-700 hover:text-brand">
          <ArrowLeft size={17} /> Back to LDA
        </Link>

        <div className="mt-8 rounded bg-zinc-100 p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-black text-brand">
            <Mail size={16} /> LDA updates
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-6xl">
            Follow LDA for deals, free trials, and learner-driver tips.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
            {subscribed
              ? `You're on the LDA updates list${email ? ` as ${email}` : ""}.`
              : "Join the LDA updates list from the homepage, then use these links to follow the academy online."}
          </p>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {socialLinks.map((link) => {
            const Icon = link.icon;

            return (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded bg-zinc-100 p-5 text-black hover:bg-zinc-200"
              >
                <span className="grid h-14 w-14 place-items-center rounded bg-white text-brand">
                  <Icon size={26} />
                </span>
                <span>
                  <span className="block text-xl font-black">{link.name}</span>
                  <span className="mt-1 block text-sm font-bold text-zinc-600">{link.handle}</span>
                </span>
                <span className="lda-pill lda-pill-sm ml-auto">Open</span>
              </a>
            );
          })}
        </section>
      </section>
    </main>
  );
}
