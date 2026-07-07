import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/halo/ThemeProvider";
import CookieConsentBanner from "@/components/CookieConsentBanner";
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
  title: "BLACKFYRE — AI-Powered Security Platform",
  description:
    "Enterprise-grade autonomous security platform. Compliance automation, multi-cloud scanning, AI-powered remediation, and professional security services. Built for Indian enterprises.",
  keywords: [
    "cybersecurity",
    "compliance automation",
    "SOC 2",
    "ISO 27001",
    "VAPT",
    "vCISO",
    "DPDPA",
    "security platform",
    "India",
  ],
  authors: [{ name: "BLACKFYRE" }],
  openGraph: {
    title: "BLACKFYRE — AI-Powered Security Platform",
    description:
      "Autonomous security for enterprises. Connect your infrastructure → complete security report in 10 minutes → stay continuously protected.",
    url: "https://blackfyre.tech",
    siteName: "BLACKFYRE",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "BLACKFYRE — AI-Powered Security Platform",
    description:
      "Enterprise-grade autonomous security. Compliance, scanning, remediation — one platform.",
  },
  robots: { index: true, follow: true },
};

// Runs before hydration to apply the saved theme so the page paints correctly.
// Also sets the .no-transitions class for the first tick so theme swaps after
// hydration don't flash.
const themeInit = `
(function() {
  try {
    var saved = localStorage.getItem('bfy-theme');
    var d = document.documentElement;
    d.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
    d.setAttribute('data-accent', 'tangerine');
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
          <ThemeProvider>
            <main id="main-content">{children}</main>
            <CookieConsentBanner />
          </ThemeProvider>
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
              "@type": "Organization",
              name: "BLACKFYRE",
              alternateName: "Blackfyre Consulting",
              url: "https://blackfyre.tech",
              email: "founder@blackfyre.tech",
              description:
                "AI-powered autonomous security platform with compliance automation, multi-cloud scanning, and professional security services.",
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
