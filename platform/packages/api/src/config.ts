import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgres://blackfyre:blackfyre@localhost:5432/blackfyre"),
  SCAN_QUEUE_URL: z.string().default(""),
  MONITOR_QUEUE_URL: z.string().default(""),
  AI_QUEUE_URL: z.string().default(""),
  EVIDENCE_QUEUE_URL: z.string().default(""),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32).default("dev-only-secret-replace-in-production!!"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // REAL IMPL (BLACKFYRE 2026-06): CORS allowlist. Comma-separated list of exact
  // origins (scheme + host + optional port), e.g.
  //   "https://example.com,https://soc.acme-corp.com".
  // Genuinely optional (no baked default) so it is `undefined` when unset. app.ts
  // then applies an ENVIRONMENT-AWARE safe default — localhost dev origins in
  // development/test, a built-in production default otherwise — and builds the
  // request-validated allowlist from it. A baked prod-origin default here would
  // override the dev localhost default and CORS-reject local cross-port requests
  // (localhost:3001 -> :4000). Enterprise custom domains are added here so they
  // are no longer CORS-rejected (was: single hardcoded prod origin).
  CORS_ORIGINS: z.string().optional(),

  // SMTP / Email — leave SMTP_HOST empty to disable email sending
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("noreply@blackfyre.com"),

  // Webhook signing — leave empty to send unsigned webhooks (not recommended in production)
  WEBHOOK_SIGNING_SECRET: z.string().default(""),

  // REAL IMPL (BLACKFYRE 2026-06): Twilio SMS — leave any of these unset to disable
  // SMS-channel alert delivery. When all three are present the NotificationDispatcher
  // sends real SMS via the Twilio REST API; otherwise it logs a warn and no-ops.
  // Optional (no default) so they are `undefined` when unset.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  // Google OAuth SSO — leave GOOGLE_CLIENT_ID empty to disable Google SSO
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3001/auth/callback"),

  // S3 Evidence Bucket — set by SST infra at deploy time
  EVIDENCE_BUCKET: z.string().default(""),
  AWS_REGION: z.string().default("ap-south-1"),
  ANTHROPIC_API_KEY: z.string().default(""),

  // LLM provider selection.
  //   - ANTHROPIC_API_KEY set & not a placeholder → use Anthropic direct API.
  //   - Otherwise → AWS Bedrock (IAM auto-auth, no key required).
  // BEDROCK_REGION defaults to us-east-1 (broadest Claude model availability);
  // override to apac/eu when your data-residency / latency rules demand.
  // BEDROCK_MODEL_ID, when set, replaces the automatic Anthropic→Bedrock model
  // mapping. Use this to force a specific inference profile.
  BEDROCK_REGION: z.string().default("us-east-1"),
  BEDROCK_MODEL_ID: z.string().default(""),

  // Prowler + IaC Scanner — set by SST infra at deploy time
  SCAN_ARTIFACTS_BUCKET: z.string().default(""),
  PROWLER_SCANNER_ARN: z.string().default(""),
  IAC_SCANNER_ARN: z.string().default(""),

  // Platform-admin API — OFF by default.
  //
  // These routes are the multi-tenant OPERATOR surface for a hosted Blackfyre
  // service: cross-tenant reads, tenant provisioning, billing, the marketing
  // contact inbox. A self-hosted install is a single tenant and never needs
  // them, so they are not registered unless this is explicitly set to "true".
  //
  // Leaving them off also means `users.is_platform_admin` grants nothing over
  // HTTP, and the zero-leakage plugin has no exempt path prefix.
  PLATFORM_ADMIN_API: z.enum(["true", "false"]).default("false"),

  // Razorpay — leave empty to disable payment processing
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // Stripe — leave empty to disable Stripe payment processing (non-India enterprises)
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),

  // SAML SP — Service Provider settings for enterprise SSO
  SAML_SP_ENTITY_ID: z.string().default("http://localhost:3000"),
  SAML_ACS_URL: z.string().default("http://localhost:3000/api/auth/saml/acs"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  const config = result.data;

  // In production, JWT_SECRET and DATABASE_URL must be explicitly set (not defaults)
  if (config.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET must be explicitly set in production");
      process.exit(1);
    }
    if (process.env.JWT_SECRET.includes("dev-") || process.env.JWT_SECRET.includes("change-in-production")) {
      console.error("JWT_SECRET contains a development placeholder — set a real secret in production");
      process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL must be explicitly set in production");
      process.exit(1);
    }
  }

  return config;
}
