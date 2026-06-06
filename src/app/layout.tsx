import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import { PageTranslator } from "@/components/page-translator";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ldrivingacademy.co.uk"),
  title: "L Driving Academy",
  applicationName: "L Driving Academy",
  description: "A UK learner-driver marketplace for verified driving instructors, transparent pricing, booking, and online payments.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/lda-logo-transparent.svg", type: "image/svg+xml", sizes: "4096x2363" }
    ],
    shortcut: "/favicon.svg",
    apple: "/lda-logo-transparent.svg"
  },
  openGraph: {
    title: "L Driving Academy",
    description: "A UK learner-driver marketplace for verified driving instructors, transparent pricing, booking, and online payments.",
    siteName: "L Driving Academy",
    images: [{ url: "/lda-logo-transparent.svg", width: 4096, height: 2363, alt: "L Driving Academy" }],
    type: "website"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://checkout.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://checkout.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
      </head>
      <body>
        {children}
        <RoutePrefetcher />
        <CookieConsent />
        <PageTranslator />
      </body>
    </html>
  );
}
