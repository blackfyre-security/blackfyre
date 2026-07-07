import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@blackfyre/shared", "@blackfyre/ui"],
  output: "export",
  images: { unoptimized: true }, // static export can't run the runtime image optimizer
  trailingSlash: false,
};

// Sentry is only wired when a DSN is set, so dev/local builds without Sentry
// don't have to install + configure it. Static-export portal still works.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: "blackfyre",
      project: "portal",
    })
  : nextConfig;
