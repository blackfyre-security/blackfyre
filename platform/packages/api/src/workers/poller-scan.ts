import { handler } from "./scan-worker.js";
import { runPoller } from "./poll-runner.js";

await runPoller({
  name: "scan-worker",
  handler,
  queueUrl: process.env.SCAN_QUEUE_URL ?? "",
});
