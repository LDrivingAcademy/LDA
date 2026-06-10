import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import { PageTranslator } from "@/components/page-translator";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import { VehicleAiAssistant } from "@/components/vehicle-ai-assistant";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ldrivingacademy.co.uk"),
  title: "L Driving Academy",
  applicationName: "L Driving Academy",
  description: "A UK learner-driver marketplace for verified driving instructors, transparent pricing, booking, and online payments.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/lda-icon-l.svg", type: "image/svg+xml", sizes: "96x96" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "96x96" }
    ],
    shortcut: "/lda-icon-l.svg",
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml", sizes: "180x180" }]
  },
  openGraph: {
    title: "L Driving Academy",
    description: "A UK learner-driver marketplace for verified driving instructors, transparent pricing, booking, and online payments.",
    siteName: "L Driving Academy",
    images: [{ url: "/lda-search-preview.svg", width: 1200, height: 1200, alt: "L Driving Academy" }],
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "L Driving Academy",
    description: "A UK learner-driver marketplace for verified driving instructors, transparent pricing, booking, and online payments.",
    images: [{ url: "/lda-search-preview.svg", width: 1200, height: 1200, alt: "L Driving Academy" }]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-title" content="L Driving Academy" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#e30613" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
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
        <VehicleAiAssistant />
      </body>
    </html>
  );
}
