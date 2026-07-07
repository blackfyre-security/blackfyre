/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "blackfyre",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "ap-south-1",
          // Cost-allocation tags applied to EVERY taggable AWS resource via the
          // provider (RDS, NAT instances, SQS, S3, Lambdas, log groups, etc.) so
          // Cost Explorer can break spend down by project/stage. Activate these
          // keys as cost-allocation tags in Billing → Cost allocation tags for
          // them to show up in CE reports.
          defaultTags: {
            tags: {
              Project: "Blackfyre",
              Environment: input?.stage ?? "unknown",
              ManagedBy: "sst",
              Repo: "<ORG>/blackfyre",
            },
          },
        },
        // Cloudflare manages blackfyre.tech DNS — needed for the api custom
        // domain (sst.cloudflare.dns()) to create the CNAME + ACM validation
        // records. Reads CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from env.
        // REAL IMPL (BLACKFYRE 2026-06): load the Cloudflare provider ONLY for prod (it backs
        // the api custom domain). staging/demo deploy the API on the bare Lambda Function URL,
        // so `sst secret set` / `sst deploy` don't require a working CLOUDFLARE_API_TOKEN —
        // loading it for staging re-breaks `sst secret set` with "Cloudflare API not
        // initialized" because the token available to the job doesn't initialize the provider.
        // The one orphaned api-staging.blackfyre.tech DnsRecord left in staging state by the
        // earlier all-stages commits is dropped via `sst state remove` (see deploy runbook),
        // NOT by re-loading the provider here.
        // To give staging a real custom domain later, wire a working token into the staging
        // Environment AND add "staging" both here and in infra/api.ts.
        ...(input?.stage === "prod" ? { cloudflare: "6.15.0" } : {}),
      },
    };
  },
  async run() {
    // Stage `demo` ships only the public sandbox Lambda — no DB, no VPC, no SQS, no scanners.
    // staging/prod deploy the full stack (RDS + VPC + queues + workers + scanners).
    if ($app.stage === "demo") {
      const { demoApi } = await import("./infra/demo.js");
      return { demoApiUrl: demoApi.url };
    }

    // Foundation
    await import("./infra/secrets.js");
    await import("./infra/network.js");
    await import("./infra/database.js");
    await import("./infra/storage.js");
    await import("./infra/queues.js");
    await import("./infra/budgets.js");

    // Compute
    const { api } = await import("./infra/api.js");
    const { sse } = await import("./infra/sse.js");
    const { scanners } = await import("./infra/scanners.js");
    const { queues } = await import("./infra/queues.js");
    const { database } = await import("./infra/database.js");
    const { migrateLambda } = await import("./infra/migrations.js");

    // Frontend (portal + admin) deploys to Cloudflare Pages — see .github/workflows/deploy.yml
    return {
      apiUrl: api.url,
      sseUrl: sse.url,
      dbEndpoint: database.instance.endpoint,
      scanQueueUrl: queues.scanQueue.url,
      monitorQueueUrl: queues.monitorQueue.url,
      aiQueueUrl: queues.aiQueue.url,
      evidenceQueueUrl: queues.evidenceQueue.url,
      prowlerScannerArn: scanners.prowlerScanner.arn,
      iacScannerArn: scanners.iacScanner.arn,
      migrateLambdaName: migrateLambda.name,
    };
  },
});
