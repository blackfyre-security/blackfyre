import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import ErrorBoundary from "@/components/ErrorBoundary";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { SITE } from "@/data/site";
import "./globals.css";

// Self-hosted (next/font/local) so the build is hermetic — no fonts.googleapis.com
// fetch at build time, which was flakily ETIMEDOUT-ing CI and skipping Deploy.
const display = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display",
});

const mono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.hostedUrl),
  title: "Blackfyre — Open-source multi-cloud compliance & security platform",
  description:
    "Open-source, self-hostable multi-cloud compliance & security platform — 40+ SDK auditors, 9 frameworks, 678 controls across AWS, Azure, GCP and on-prem. Apache-2.0.",
  keywords: [
    "open source security",
    "compliance automation",
    "multi-cloud security",
    "cloud security posture",
    "AWS",
    "Azure",
    "GCP",
    "self-hosted",
    "SOC 2",
    "ISO 27001",
    "Apache-2.0",
  ],
  authors: [{ name: SITE.name }],
  openGraph: {
    title: "Blackfyre — Open-source multi-cloud compliance & security platform",
    description:
      "Self-hostable, Apache-2.0 compliance & security scanning: 40+ SDK auditors, 9 frameworks, 678 controls, hash-verified evidence, and database-enforced multi-tenancy.",
    url: SITE.hostedUrl,
    siteName: SITE.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blackfyre — Open-source multi-cloud compliance & security platform",
    description:
      "Open-source multi-cloud compliance & security. 40+ SDK auditors · 9 frameworks · 678 controls · AWS/Azure/GCP + on-prem. Self-host free under Apache-2.0.",
  },
  robots: { index: true, follow: true },
};

// Runs before hydration to apply the saved theme so the page paints correctly.
// Also sets the .no-transitions class for the first tick so theme swaps after
// hydration don't flash.
const themeInit = `
(function() {
  try {
    var d = document.documentElement;
    d.setAttribute('data-theme', 'dark');
    d.setAttribute('data-accent', 'chartreuse');
    d.classList.add('no-transitions');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { d.classList.remove('no-transitions'); });
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <noscript><style>{`.opacity-0 { opacity: 1 !important; transform: none !important; }`}</style></noscript>
      </head>
      <body className="font-sans antialiased bg-bg text-text">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-surface focus:text-text">Skip to content</a>
        <ErrorBoundary>
          <main id="main-content">{children}</main>
          <CookieConsentBanner />
        </ErrorBoundary>
        <Script
          defer
          data-domain="blackfyre.tech"
          src="https://plausible.io/js/script.js"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Blackfyre",
              applicationCategory: "SecurityApplication",
              operatingSystem: "Cloud, self-hosted (AWS)",
              license: "https://www.apache.org/licenses/LICENSE-2.0",
              url: "https://blackfyre.tech",
              email: "founder@blackfyre.tech",
              description:
                "Open-source multi-cloud compliance & security platform. Scan AWS, Azure and GCP against 678 controls across 9 frameworks with 40+ SDK auditors, AI-assisted analysis and a hash-verified evidence vault. Apache-2.0 — self-host free.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              address: {
                "@type": "PostalAddress",
                addressLocality: "Chennai",
                addressCountry: "IN",
              },
              founder: { "@type": "Organization", name: "BLACKFYRE Team" },
              sameAs: [
                "https://www.linkedin.com/company/blackfyre-technologies/",
                "https://x.com/blackfyretech",
                "https://www.instagram.com/blackfyre_technologies/",
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
