import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider, themeScript } from "@blackfyre/ui";

// Self-hosted (next/font/local) so the build is hermetic — no fonts.googleapis.com
// fetch at build time, which was flakily ETIMEDOUT-ing CI and skipping Deploy.
const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-sans",
});

const mono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "BLACKFYRE Admin",
  description: "Operations & Intelligence Command Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Skip to content</a>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider><main id="main-content">{children}</main></AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
