import { handler } from "./ai-worker.js";
import { runPoller } from "./poll-runner.js";

await runPoller({
  name: "ai-worker",
  handler,
  queueUrl: process.env.AI_QUEUE_URL ?? "",
});
