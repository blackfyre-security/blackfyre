import { secrets } from "./secrets.js";
import { vpc } from "./network.js";
import { database } from "./database.js";

export const sse = new sst.aws.Function("BlackfyreSse", {
  handler: "packages/api/src/sse-handler.handler",
  streaming: true,
  timeout: "15 minutes",
  memory: "256 MB",
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
  vpc,
  url: {
    cors: {
      // Lambda Function URL CORS rejects allowMethods entries >6 chars
      // ('OPTIONS' is 7); '*' lets AWS handle preflight automatically
      allowOrigins: ["https://app-staging.blackfyre.tech", "https://app.blackfyre.tech"],
      allowMethods: ["*"],
      allowHeaders: ["*"],
    },
  },
  environment: {
    NODE_ENV: "production",
    DATABASE_URL: database.url,
    JWT_SECRET: secrets.jwtSecret.value,
  },
  link: [secrets.dbMasterPassword, secrets.jwtSecret],
});
