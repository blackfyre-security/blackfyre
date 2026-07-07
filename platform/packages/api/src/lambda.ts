import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = buildApp(config);

export const handler = awsLambdaFastify(await app, {
  serializeLambdaArguments: false,
});
