/**
 * Demo stack — public-facing sandbox environment at demo.blackfyre.tech.
 *
 * Single Lambda Function URL serving the synthetic Acme Bank fixture data
 * from sandbox/fake-org/scan-bundle.json (bundled into the Lambda zip).
 *
 * No DB, no VPC, no SQS, no scanners — strips everything not needed for a
 * read-only sales demo. Cost: ~$0/mo idle (Lambda free tier).
 *
 * Reserved concurrency = 100 acts as a soft DDoS cap; if traffic spikes,
 * the demo throttles instead of bleeding cost on lambda invocations.
 *
 * Deployed via `sst deploy --stage demo`.
 */

export const demoApi = new sst.aws.Function("BlackfyreDemoApi", {
  handler: "packages/api/src/demo-lambda.handler",
  timeout: "30 seconds",
  memory: "1024 MB",
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
  // CORS handled at Lambda Function URL layer. The demo-server handler detects
  // AWS_LAMBDA_FUNCTION_NAME env and skips Fastify cors registration to avoid
  // duplicate access-control-allow-origin headers (browsers reject those).
  url: {
    cors: {
      allowOrigins: [
        "http://localhost:3001",
        "http://localhost:3003",
        "https://demo.blackfyre.tech",
        "https://blackfyre-portal-demo.pages.dev",
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization"],
      allowCredentials: true,
    },
  },
  environment: {
    NODE_ENV: "production",
    BLACKFYRE_DEMO: "true",
  },
  // Reserved concurrency intentionally omitted — account-level concurrency floor
  // requires >=10 unreserved, easier to leave the demo on the shared pool.
  // Add a CloudFlare Bot Fight Mode in front if scraping becomes an issue.
});
