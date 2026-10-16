import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import { I18nQaMode } from "@/components/i18n-qa-mode";
import { PageTranslator } from "@/components/page-translator";
import { RoutePrefetcher } from "@/components/route-prefetcher";
import { LogoutStateSync } from "@/components/logout-state-sync";
import { SiteAnalyticsTracker } from "@/components/site-analytics-tracker";
import { TermsAcceptanceGlobalBanner } from "@/components/terms-acceptance-global-banner";
import {
  LDA_APP_ICON,
  LDA_APPLE_ICON,
  LDA_OFFICIAL_ICON_192,
  LDA_OFFICIAL_ICON_512,
  LDA_FAVICON_48,
  LDA_SEARCH_PREVIEW,
  LDA_TAB_ICON_16,
  LDA_TAB_ICON_32,
  LDA_TAB_ICON_48,
  LDA_TAB_ICON_64
} from "@/lib/brand-assets";
import { customLocaleCookieName, localeCookieName } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const brandDescription =
  "L Driving Academy helps learners find verified instructors, schedule or book on demand lessons, manage secure payments and track lesson progress in one place.";

const brandAlternateNames = [
  "LDA",
  "LD Academy",
  "L Driving Academy",
  "LDrivingAcademy",
  "ldrivingacademy",
  "L Drving Academy",
  "L Drivng Academy",
  "L Driiving Academy",
  "L Drivving Academy",
  "L Driveing Academy",
  "L Driving Acadamy",
  "L Driving Acadmey",
  "L Driving Acadmy",
  "LDRVING Academy",
  "LDRIVING Academy"
];

const highIntentSearchPhrases = [
  "driving lessons near me",
  "book driving lessons near me",
  "book a driving lesson",
  "get a driving lesson",
  "need a driving lesson right now",
  "on-demand driving lesson",
  "driving instructors near me",
  "find driving instructors",
  "automatic driving lessons",
  "manual driving lessons",
  "learner driver lessons",
  "become a driving instructor",
  "driving instructor sign up"
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ldrivingacademy.co.uk/#organization",
      name: "L Driving Academy",
      alternateName: brandAlternateNames,
      url: "https://ldrivingacademy.co.uk/",
      logo: LDA_OFFICIAL_ICON_512.absoluteSrc,
      description: brandDescription,
      keywords: highIntentSearchPhrases.join(", "),
      sameAs: [
        "https://www.instagram.com/ldrivingacademy",
        "https://www.tiktok.com/@ldrivingacademy",
        "https://www.youtube.com/@LDrivingAcademy-LDA",
        "https://www.facebook.com/share/18673vj1tW/?mibextid=wwXIfr"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://ldrivingacademy.co.uk/#website",
      name: "L Driving Academy",
      alternateName: brandAlternateNames,
      url: "https://ldrivingacademy.co.uk/",
      publisher: { "@id": "https://ldrivingacademy.co.uk/#organization" },
      inLanguage: "en-GB",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://ldrivingacademy.co.uk/smart-match?query={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Service",
      "@id": "https://ldrivingacademy.co.uk/#book-driving-lessons",
      name: "Book driving lessons near you",
      serviceType: "Driving lesson booking",
      provider: { "@id": "https://ldrivingacademy.co.uk/#organization" },
      url: "https://ldrivingacademy.co.uk/smart-match",
      description: "Search for local driving instructors, compare lesson options, and start the public LDA SmartMatch route."
    },
    {
      "@type": "Service",
      "@id": "https://ldrivingacademy.co.uk/#on-demand-driving-lessons",
      name: "On-demand driving lessons",
      serviceType: "Short-notice driving lesson booking",
      provider: { "@id": "https://ldrivingacademy.co.uk/#organization" },
      url: "https://ldrivingacademy.co.uk/lesson-now",
      description: "Request a short-notice driving lesson and let LDA assign a suitable local instructor after secure checkout."
    },
    {
      "@type": "Service",
      "@id": "https://ldrivingacademy.co.uk/#instructor-onboarding",
      name: "Become a driving instructor with LDA",
      serviceType: "Driving instructor onboarding",
      provider: { "@id": "https://ldrivingacademy.co.uk/#organization" },
      url: "https://ldrivingacademy.co.uk/instructor",
      description: "Verified driving instructors can apply to join LDA, publish availability, and receive learner bookings."
    }
  ]
};

const languageBootstrapScript = `
(function(){
  try {
    function readCookie(name) {
      var match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[2]) : "";
    }
    var selected = window.localStorage.getItem("lda-language") || readCookie("${localeCookieName}") || "en-GB";
    var custom = window.localStorage.getItem("lda-custom-language") || readCookie("${customLocaleCookieName}") || "";
    var language = selected === "custom" && custom ? custom : selected;
    var rtl = /^(ar|arc|ckb|dv|fa|ha|he|khw|ks|ku|ps|sd|ug|ur|yi)(-|$)/i.test(language);
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-lda-locale", language);
  } catch (error) {}
})();
`;

const browserCompatibilityBootstrapScript = `
(function(){
  try {
    var root = document.documentElement;
    var supportsCss = !!(window.CSS && CSS.supports && CSS.supports("display", "grid") && CSS.supports("position", "sticky"));
    var supportsSvg = !!(document.createElementNS && document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect);
    var supportsCore =
      !!(window.Promise &&
      window.fetch &&
      window.URL &&
      window.URLSearchParams &&
      document.querySelector &&
      window.addEventListener &&
      "className" in root);

    if (!(supportsCss && supportsSvg && supportsCore)) {
      root.className = (root.className ? root.className + " " : "") + "lda-legacy-browser";
    }
  } catch (error) {
    document.documentElement.className = (document.documentElement.className ? document.documentElement.className + " " : "") + "lda-legacy-browser";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://ldrivingacademy.co.uk"),
  title: {
    default: "L Driving Academy",
    template: "%s | LDA"
  },
  applicationName: "L Driving Academy",
  description: brandDescription,
  keywords: [
    "LDA",
    "LD Academy",
    "L Driving Academy",
    "LDrivingAcademy",
    "ldrivingacademy",
    "L Drving Academy",
    "L Drivng Academy",
    "L Driving Acadamy",
    "L Driving Acadmey",
    "LDRVING Academy",
    "LDRIVING Academy",
    "driving lessons UK",
    "learner driver platform",
    "learner driver lessons",
    ...highIntentSearchPhrases
  ],
  alternates: {
    canonical: "/"
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: LDA_FAVICON_48.src, type: LDA_FAVICON_48.type, sizes: `${LDA_FAVICON_48.width}x${LDA_FAVICON_48.height}` },
      { url: LDA_APP_ICON.src, type: LDA_APP_ICON.type, sizes: `${LDA_APP_ICON.width}x${LDA_APP_ICON.height}` },
      { url: "/favicon.ico?v=lda-20261010-sized", type: "image/x-icon", sizes: "any" },
      { url: LDA_TAB_ICON_16.src, type: LDA_TAB_ICON_16.type, sizes: `${LDA_TAB_ICON_16.width}x${LDA_TAB_ICON_16.height}` },
      { url: LDA_TAB_ICON_32.src, type: LDA_TAB_ICON_32.type, sizes: `${LDA_TAB_ICON_32.width}x${LDA_TAB_ICON_32.height}` },
      { url: LDA_TAB_ICON_48.src, type: LDA_TAB_ICON_48.type, sizes: `${LDA_TAB_ICON_48.width}x${LDA_TAB_ICON_48.height}` },
      { url: LDA_TAB_ICON_64.src, type: LDA_TAB_ICON_64.type, sizes: `${LDA_TAB_ICON_64.width}x${LDA_TAB_ICON_64.height}` },
      { url: LDA_OFFICIAL_ICON_192.src, type: LDA_OFFICIAL_ICON_192.type, sizes: `${LDA_OFFICIAL_ICON_192.width}x${LDA_OFFICIAL_ICON_192.height}` },
      { url: LDA_OFFICIAL_ICON_512.src, type: LDA_OFFICIAL_ICON_512.type, sizes: `${LDA_OFFICIAL_ICON_512.width}x${LDA_OFFICIAL_ICON_512.height}` }
    ],
    shortcut: "/favicon.ico?v=lda-20261010-sized",
    apple: [{ url: LDA_APPLE_ICON.src, type: LDA_APPLE_ICON.type, sizes: `${LDA_APPLE_ICON.width}x${LDA_APPLE_ICON.height}` }]
  },
  openGraph: {
    title: "L Driving Academy",
    description: brandDescription,
    siteName: "L Driving Academy",
    images: [{ url: LDA_SEARCH_PREVIEW.src, width: LDA_SEARCH_PREVIEW.width, height: LDA_SEARCH_PREVIEW.height, alt: LDA_SEARCH_PREVIEW.alt }],
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "L Driving Academy",
    description: brandDescription,
    images: [{ url: LDA_SEARCH_PREVIEW.src, width: LDA_SEARCH_PREVIEW.width, height: LDA_SEARCH_PREVIEW.height, alt: LDA_SEARCH_PREVIEW.alt }]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-title" content="LDA" />
        <link rel="shortcut icon" href="/favicon.ico?v=lda-20261010-sized" />
        <link rel="icon" type={LDA_FAVICON_48.type} sizes="48x48" href={LDA_FAVICON_48.src} />
        <link rel="icon" type={LDA_APP_ICON.type} sizes="512x512" href={LDA_APP_ICON.src} />
        <link rel="icon" type={LDA_TAB_ICON_16.type} sizes="16x16" href={LDA_TAB_ICON_16.src} />
        <link rel="icon" type={LDA_TAB_ICON_32.type} sizes="32x32" href={LDA_TAB_ICON_32.src} />
        <link rel="icon" type={LDA_TAB_ICON_48.type} sizes="48x48" href={LDA_TAB_ICON_48.src} />
        <link rel="icon" type={LDA_TAB_ICON_64.type} sizes="64x64" href={LDA_TAB_ICON_64.src} />
        <link rel="apple-touch-icon" sizes="512x512" href={LDA_APPLE_ICON.src} />
        <link rel="preconnect" href="https://checkout.stripe.com" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://checkout.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script dangerouslySetInnerHTML={{ __html: browserCompatibilityBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: languageBootstrapScript }} />
      </head>
      <body>
        <noscript>
          <div className="lda-browser-compatibility-card">
            <div className="lda-browser-compatibility-brand">L Driving Academy</div>
            <h1>JavaScript is required for secure LDA features.</h1>
            <p>
              LDA uses secure sign-in, booking, payments, live maps, and support tools that need JavaScript enabled.
              Please turn JavaScript on or open LDA in an up-to-date browser.
            </p>
            <div className="lda-browser-compatibility-actions">
              <a href="/">Open homepage</a>
              <a href="/support/guest">Contact support</a>
            </div>
          </div>
        </noscript>
        <div id="lda-browser-compatibility-fallback" role="status" aria-live="polite">
          <div className="lda-browser-compatibility-card">
            <div className="lda-browser-compatibility-brand">L Driving Academy</div>
            <h1>This browser is too old for the secure LDA website.</h1>
            <p>
              Please open LDA in a current browser so booking, payments, maps, account access, icons, and support tools
              can work correctly.
            </p>
            <p>
              Very old phones and computers may still open basic pages, but secure interactive features need a modern browser.
            </p>
            <div className="lda-browser-compatibility-actions">
              <a href="/">Open homepage</a>
              <a href="/support/guest">Contact support</a>
            </div>
          </div>
        </div>
        <TermsAcceptanceGlobalBanner />
        {children}
        <RoutePrefetcher />
        <LogoutStateSync />
        <CookieConsent />
        <PageTranslator />
        <I18nQaMode />
        <SiteAnalyticsTracker />
      </body>
    </html>
  );
}
