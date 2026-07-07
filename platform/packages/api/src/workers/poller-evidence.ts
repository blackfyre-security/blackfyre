import { handler } from "./evidence-worker.js";
import { runPoller } from "./poll-runner.js";

await runPoller({
  name: "evidence-worker",
  handler,
  queueUrl: process.env.EVIDENCE_QUEUE_URL ?? "",
});
