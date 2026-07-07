import { vpc } from "./network.js";
import { database } from "./database.js";
import { secrets } from "./secrets.js";

/**
 * Migration Lambda — runs DATABASE_URL migrations from inside the VPC.
 *
 * Invoked manually after `sst deploy --stage <stage>`:
 *   aws lambda invoke --function-name <Outputs.migrateLambdaName> \
 *     --region ap-south-1 /tmp/out.json
 *
 * The SQL files in packages/api/src/migrations are bundled into the Lambda
 * deployment package via copyFiles.
 */

export const migrateLambda = new sst.aws.Function("MigrateLambda", {
  handler: "packages/api/src/db/migrate-lambda.handler",
  timeout: "5 minutes",
  memory: "512 MB",
  vpc,
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
  environment: {
    NODE_ENV: "production",
    DATABASE_URL: database.url,
    // SST stage passed through so the migrate Lambda can decide whether to
    // run the dev-only seed migrations (003_seed_data, 018_seed_blackfyre_admin).
    // Without this, NODE_ENV=production tells us nothing — every Lambda runs
    // with that. SST_STAGE='prod' is the truth.
    SST_STAGE: $app.stage,
  },
  link: [secrets.dbMasterPassword],
  copyFiles: [
    { from: "packages/api/src/migrations", to: "migrations" },
  ],
});
