import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import type { SQSEvent, SQSRecord, Context } from "aws-lambda";

/**
 * SQS long-poll runner used by every container worker. Wraps the existing
 * Lambda-style `(event: SQSEvent) => Promise<void>` handlers so the same
 * code path runs on Fargate without touching business logic.
 *
 * Behavior:
 *   - Long-polls the queue for up to 20s per call (max for SQS).
 *   - Receives up to maxBatch messages (default 5).
 *   - SECURITY FIX (BLACKFYRE audit 2026-06-05): per-message ack — each message
 *     is handed to the handler in its own single-record SQSEvent and DELETED only
 *     on its own success. Previously the whole batch was synthesised into one
 *     SQSEvent and, if the handler threw on ANY record, the ENTIRE batch was made
 *     visible again, so already-processed messages were redelivered. That caused
 *     duplicate side effects (re-runs of completed scans, double-charged jobs,
 *     duplicate notifications) and could be abused to amplify work. Now only the
 *     failing message(s) return to the queue; SQS redrives just those and DLQs
 *     them after maxReceiveCount.
 *   - On SIGTERM/SIGINT, finishes the in-flight batch and exits cleanly.
 */
export interface PollRunnerOptions {
  /** Logical worker name for log lines (e.g. "scan-worker"). */
  name: string;
  /** Lambda-style SQS handler from src/workers/<x>-worker.ts. */
  handler: (event: SQSEvent, context?: Context) => Promise<void> | void;
  /** Required: queue URL to poll. */
  queueUrl: string;
  /** Max messages per receive (1..10). Default 5. */
  maxBatch?: number;
  /** SQS endpoint override (for LocalStack in dev). */
  endpoint?: string;
}

export async function runPoller(opts: PollRunnerOptions): Promise<void> {
  const {
    name,
    handler,
    queueUrl,
    maxBatch = 5,
    endpoint = process.env.SQS_ENDPOINT,
  } = opts;

  if (!queueUrl) {
    console.error(`[${name}] queue URL not set — exiting`);
    process.exit(1);
  }

  const client = new SQSClient({
    endpoint,
    region: process.env.AWS_REGION ?? "ap-south-1",
  });

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[${name}] received ${signal}; finishing in-flight batch`);
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));

  console.log(`[${name}] poller started — queueUrl=${queueUrl} endpoint=${endpoint ?? "default"}`);

  while (!stopping) {
    let messages;
    try {
      const res = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: maxBatch,
          WaitTimeSeconds: 20,
          MessageAttributeNames: ["All"],
          AttributeNames: ["All"],
        }),
      );
      messages = res.Messages ?? [];
    } catch (err) {
      console.error(`[${name}] receive error — sleeping 5s before retry:`, err);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (messages.length === 0) continue;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): process each message independently so a
    // failure on one record can never cause an already-succeeded record to be redelivered.
    let succeeded = 0;
    let failed = 0;

    for (const m of messages) {
      // Build a Lambda-shaped, SINGLE-record SQSEvent for this message only.
      const event: SQSEvent = {
        Records: [
          {
            messageId: m.MessageId ?? "",
            receiptHandle: m.ReceiptHandle ?? "",
            body: m.Body ?? "",
            attributes: (m.Attributes as any) ?? {
              ApproximateReceiveCount: "1",
              SentTimestamp: "0",
              SenderId: "",
              ApproximateFirstReceiveTimestamp: "0",
            },
            messageAttributes: (m.MessageAttributes as any) ?? {},
            md5OfBody: m.MD5OfBody ?? "",
            eventSource: "aws:sqs",
            eventSourceARN: queueUrl,
            awsRegion: process.env.AWS_REGION ?? "ap-south-1",
          } satisfies SQSRecord,
        ],
      };

      try {
        await handler(event);
        // Per-message success → delete THIS message so it is never redelivered.
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: m.ReceiptHandle!,
          }),
        );
        succeeded++;
      } catch (err) {
        failed++;
        // Only THIS failed message returns to the queue. Make it immediately visible
        // again (skip the visibility timeout) so the next poll can retry; SQS will
        // DLQ it once maxReceiveCount is exhausted. Other messages are untouched.
        console.error(
          `[${name}] handler error on messageId=${m.MessageId ?? "unknown"} — releasing this message for redrive:`,
          err,
        );
        await client
          .send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: m.ReceiptHandle!,
              VisibilityTimeout: 0,
            }),
          )
          .catch((visErr) =>
            console.error(
              `[${name}] failed to reset visibility for messageId=${m.MessageId ?? "unknown"}:`,
              visErr,
            ),
          );
      }
    }

    console.log(`[${name}] batch done — processed=${succeeded} failed=${failed} of ${messages.length}`);
  }

  console.log(`[${name}] poller stopped`);
  process.exit(0);
}
