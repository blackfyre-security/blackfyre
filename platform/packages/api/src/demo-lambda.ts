/**
 * Lambda handler for the demo API.
 *
 * Imports scan-bundle.json statically — esbuild bundles it inline at deploy time
 * (~1.4MB, well under the 250MB Lambda limit). At Lambda cold start the JSON is
 * already in memory, no filesystem reads.
 *
 * Deployed via SST stage `demo`. See platform/infra/demo.ts.
 */

import awsLambdaFastify from "@fastify/aws-lambda";
import { buildDemoApp, type DemoBundle } from "./demo-server.js";
// @ts-expect-error — esbuild bundles JSON imports at build time; tsc doesn't resolve relative paths outside rootDir
import bundle from "../../../../sandbox/fake-org/scan-bundle.json";

const app = await buildDemoApp(bundle as DemoBundle);

export const handler = awsLambdaFastify(app, {
  serializeLambdaArguments: false,
});
