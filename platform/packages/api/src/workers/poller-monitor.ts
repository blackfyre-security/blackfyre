import { handler } from "./monitor-worker.js";
import { runPoller } from "./poll-runner.js";

await runPoller({
  name: "monitor-worker",
  handler,
  queueUrl: process.env.MONITOR_QUEUE_URL ?? "",
});
