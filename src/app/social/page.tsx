import type { Metadata } from "next";
import { Facebook, Instagram, Mail, Music2, Play } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SocialSubscribePrompt } from "@/components/social-subscribe-prompt";
import { getHeaderAccountSummary } from "@/lib/current-account";

export const metadata: Metadata = {
  title: "Follow LDA | L Driving Academy",
  description: "Join L Driving Academy for practical driving tips, learner updates, exclusive offers, promo codes, and official LDA social channels.",
  alternates: {
    canonical: "/social"
  },
  robots: {
    index: true,
    follow: true,
    nocache: false
  },
  openGraph: {
    title: "Follow LDA | L Driving Academy",
    description: "Join L Driving Academy for practical driving tips, learner updates, exclusive offers, promo codes, and official LDA social channels.",
    url: "/social",
    type: "website"
  }
};

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
    handle: "@LDrivingAcademy-LDA",
    href: "https://www.youtube.com/@LDrivingAcademy-LDA",
    icon: Play
  },
  {
    name: "Facebook",
    handle: "LDrivingAcademy",
    href: "https://www.facebook.com/share/18673vj1tW/?mibextid=wwXIfr",
    icon: Facebook
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
  const account = await getHeaderAccountSummary();
  const isInstructorAccount = account?.role === "instructor";
  const initialEmail = account?.email || email || "";
  const initiallySubscribed = Boolean(account?.marketingOptIn || subscribed);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/" backLabel="Back to homepage" account={account} />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded bg-zinc-100 p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-black text-brand">
            <Mail size={16} /> Follow LDA
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-6xl">
            Follow LDA.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
            {isInstructorAccount
              ? "Follow LDA on our official social media channels for platform updates, instructor news, safety content, and launch announcements."
              : subscribed
              ? `You are subscribed to LDA updates${email ? ` as ${email}` : ""}.`
              : "Join the LDA mailing list for practical learner guidance, selected platform updates, promotional offers, and discount codes. Official social links are available below."}
          </p>
          {isInstructorAccount ? null : (
            <SocialSubscribePrompt
              initialEmail={initialEmail}
              initiallySubscribed={initiallySubscribed}
              isSignedIn={Boolean(account)}
            />
          )}
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {socialLinks.map((link) => {
            const Icon = link.icon;

            return (
              <a
                key={link.name}
                href={link.href}
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
