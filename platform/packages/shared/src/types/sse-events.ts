/**
 * SSE event types for real-time scan progress streaming.
 *
 * The SSE Lambda emits these events over a text/event-stream connection
 * so the browser's EventSource can render live scan progress.
 */

export interface ScanProgressEvent {
  type: "scan_progress";
  /** 0-100 percentage of scan completion */
  progress: number;
  /** Current scanning category, e.g. "iam", "s3", "ec2" */
  currentCategory: string;
}

export interface NewFindingEvent {
  type: "new_finding";
  finding: {
    id: string;
    title: string;
    severity: string;
    category: string;
    resourceId: string | null;
    controlMappings: Array<{ framework: string; controlId: string }>;
  };
}

export interface ScanCompleteEvent {
  type: "scan_complete";
  status: "completed" | "completed_partial";
  totalFindings: number;
  /** ISO-8601 timestamp */
  completedAt: string;
}

export interface ScanFailedEvent {
  type: "scan_failed";
  error: string;
  findingsBeforeFailure: number;
}

export type SseEvent =
  | ScanProgressEvent
  | NewFindingEvent
  | ScanCompleteEvent
  | ScanFailedEvent;
