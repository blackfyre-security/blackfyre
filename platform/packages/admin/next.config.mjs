import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@blackfyre/shared", "@blackfyre/ui"],
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: "blackfyre",
      project: "admin",
    })
  : nextConfig;
