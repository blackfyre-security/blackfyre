import { queues } from "./queues.js";
import { secrets } from "./secrets.js";
import { storage } from "./storage.js";
import { vpc } from "./network.js";
import { database } from "./database.js";

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set for prod deploys (Cloudflare custom domain)`);
  return v;
};

export const api = new sst.aws.Function("BlackfyreApi", {
  handler: "packages/api/src/lambda.handler",
  timeout: "30 seconds",
  memory: "1024 MB",
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
  // @node-rs/argon2 ships .node binaries via optional deps per platform.
  // esbuild can't bundle .node files; tell SST to install fresh in the
  // Lambda package using Linux x64 platform targeting.
  nodejs: {
    // SST runs npm install on the host OS (Windows), so optionalDependencies
    // for other platforms don't get pulled. Force install the linux x64 binary
    // subpackage explicitly so it's present in the Lambda zip.
    install: ["@node-rs/argon2", "@node-rs/argon2-linux-x64-gnu"],
  },
  // CORS handled at Lambda Function URL layer; app.ts skips Fastify cors in Lambda
  // to avoid duplicate access-control-allow-origin headers.
  url: {
    cors: {
      allowOrigins: $app.stage === "prod"
        ? [
            "https://app.blackfyre.tech",
            "https://admin.blackfyre.tech",
            "https://blackfyre.tech",
            "https://www.blackfyre.tech",
          ]
        : [
            "https://app-staging.blackfyre.tech",
            "https://admin-staging.blackfyre.tech",
            "https://staging.blackfyre.tech",
            "https://blackfyre-portal.pages.dev",
            "https://staging.blackfyre-portal.pages.dev",
            "https://blackfyre-admin.pages.dev",
            "https://staging.blackfyre-admin.pages.dev",
            "https://blackfyre-staging.pages.dev",
            "http://localhost:3001",
            "http://localhost:3003",
          ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID", "X-CSRF-Token"],
      exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
      allowCredentials: true,
      maxAge: "1 day",
    },
  },
  vpc,
  environment: {
    NODE_ENV: "production",
    DATABASE_URL: database.url,
    JWT_SECRET: secrets.jwtSecret.value,
    SCAN_QUEUE_URL: queues.scanQueue.url,
    MONITOR_QUEUE_URL: queues.monitorQueue.url,
    AI_QUEUE_URL: queues.aiQueue.url,
    EVIDENCE_QUEUE_URL: queues.evidenceQueue.url,
    // CORS_ORIGINS is read by Fastify's cors plugin, but in Lambda we skip
    // Fastify cors entirely. Kept for local dev (npm run dev) only.
    CORS_ORIGINS: "http://localhost:3001,http://localhost:3003",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_USER: "noreply@blackfyre.tech",
    SMTP_PASS: secrets.smtpPass.value,
    SMTP_FROM: "noreply@blackfyre.tech",
    EVIDENCE_BUCKET: storage.evidenceBucket.name,
    ANTHROPIC_API_KEY: secrets.anthropicApiKey.value,
    // AWS_REGION is reserved by the Lambda runtime — set automatically
    // Razorpay
    RAZORPAY_KEY_ID: secrets.razorpayKeyId.value,
    RAZORPAY_KEY_SECRET: secrets.razorpayKeySecret.value,
    RAZORPAY_WEBHOOK_SECRET: secrets.razorpayWebhookSecret.value,
    // Google OAuth
    GOOGLE_CLIENT_ID: secrets.googleClientId.value,
    GOOGLE_CLIENT_SECRET: secrets.googleClientSecret.value,
    GOOGLE_REDIRECT_URI: "https://app.blackfyre.tech/api/auth/sso",
    // Encryption
    ENCRYPTION_MASTER_KEY: secrets.encryptionMasterKey.value,
    // Webhooks
    WEBHOOK_SIGNING_SECRET: secrets.webhookSigningSecret.value,
    // LLM provider — when ANTHROPIC_API_KEY is empty/placeholder the API
    // falls back to AWS Bedrock. us-east-1 has the broadest Claude model
    // availability; override per-stage if you need ap-south-1 / eu-west-1.
    // See docs/LLM_PROVIDER.md for the env-var contract.
    BEDROCK_REGION: "us-east-1",
    // SAML SP — pinned explicitly so our deployed stages keep today's values
    // now that the code-level zod defaults (packages/api/src/config.ts) have
    // been genericized to localhost for the open-source release.
    SAML_SP_ENTITY_ID: "https://app.blackfyre.tech",
    SAML_ACS_URL: "https://app.blackfyre.tech/api/auth/saml/acs",
  },
  // Allow the Lambda to invoke any Claude model on Bedrock (foundation
  // models + cross-region inference profiles). Scoped down to anthropic.*
  // patterns to avoid granting access to non-Anthropic models we don't use.
  // Model access still has to be enabled in the AWS console (Bedrock →
  // Model access) per-region before the first call succeeds.
  permissions: [
    {
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        "arn:aws:bedrock:*::foundation-model/anthropic.*",
        "arn:aws:bedrock:*:*:inference-profile/*anthropic.*",
      ],
    },
  ],
  link: [
    secrets.dbMasterPassword, secrets.jwtSecret, secrets.smtpPass, secrets.anthropicApiKey,
    secrets.razorpayKeyId, secrets.razorpayKeySecret, secrets.razorpayWebhookSecret,
    secrets.googleClientId, secrets.googleClientSecret,
    secrets.encryptionMasterKey, secrets.webhookSigningSecret,
    queues.scanQueue, queues.monitorQueue, queues.aiQueue, queues.evidenceQueue,
    storage.evidenceBucket,
  ],
});

// Stable custom domain in front of the api Function URL via CloudFront.
// Lambda Function URLs have no native custom-domain/cert support, so a bare
// CNAME to *.lambda-url fails TLS for a custom host. Front it with CloudFront:
// SST provisions the distribution + an ACM cert (us-east-1, per CloudFront),
// validated through Cloudflare DNS, and points api[-staging].blackfyre.tech at
// the distribution. DNS-only CNAME is fine — CloudFront serves the cert for the
// custom host (no Cloudflare proxy / SSL-mode dependency). Frontends target
// this stable domain instead of the auto-generated *.lambda-url host, which
// changes if the function is recreated.
// REAL IMPL (BLACKFYRE 2026-06): the Cloudflare-backed custom domain is prod-only. On
// staging/demo the Router uses its default *.cloudfront.net URL, so the deploy needs no
// Cloudflare provider / CLOUDFLARE_API_TOKEN (the ternary below means sst.cloudflare.dns()
// is only evaluated for prod). Re-enable a staging custom domain by adding "staging" to the
// check here AND to the cloudflare provider in sst.config.ts once the token is wired.
export const apiRouter = new sst.aws.Router("BlackfyreApiRouter", {
  ...($app.stage === "prod"
    ? {
        domain: {
          name: "api.blackfyre.tech",
          // Pass the zone id explicitly: the CLOUDFLARE_API_TOKEN has Zone:DNS:Edit
          // (write records) but not Zone:Read (enumerate zones), so SST's automatic
          // ZoneLookup fails with "Could not find hosted zone". The id skips it.
          // Sourced from CLOUDFLARE_ZONE_ID (set as a GitHub Actions repo variable)
          // rather than hardcoded, since the zone id is account-specific.
          dns: sst.cloudflare.dns({ zone: requireEnv("CLOUDFLARE_ZONE_ID") }),
        },
      }
    : {}),
  routes: { "/*": api.url },
});
