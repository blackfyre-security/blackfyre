import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// SQS_ENDPOINT is used to point at LocalStack in dev/CI. In production
// the AWS SDK resolves the real endpoint from AWS_REGION + IAM creds.
const client = new SQSClient({
  endpoint: process.env.SQS_ENDPOINT,
  region: process.env.AWS_REGION ?? "ap-south-1",
});

export interface SqsJobResult {
  messageId: string;
}

export class SqsQueue<T = unknown> {
  private queueUrl: string;
  private disabled: boolean;

  constructor(queueUrl: string) {
    this.queueUrl = queueUrl;
    this.disabled = !queueUrl;
  }

  async add(jobName: string, data: T): Promise<SqsJobResult> {
    if (this.disabled) {
      throw new Error(
        `SQS queue not configured (no URL). Cannot enqueue job "${jobName}". ` +
        "Set the queue URL in environment variables.",
      );
    }
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({ jobName, data }),
      MessageAttributes: {
        JobName: { DataType: "String", StringValue: jobName },
      },
    });
    const result = await client.send(command);
    return { messageId: result.MessageId ?? "" };
  }

  get url(): string {
    return this.queueUrl;
  }
}
