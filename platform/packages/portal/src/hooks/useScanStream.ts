"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  SseEvent,
  NewFindingEvent,
  ScanProgressEvent,
  ScanCompleteEvent,
  ScanFailedEvent,
} from "@blackfyre/shared";

type ConnectionState = "connecting" | "live" | "reconnecting" | "closed";

interface ScanStreamState {
  progress: number;
  currentCategory: string;
  status: "running" | "completed" | "completed_partial" | "failed" | null;
  findings: NewFindingEvent["finding"][];
  error: string | null;
  connectionState: ConnectionState;
  totalFindings: number;
}

const SSE_URL = process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:3002";

const initialState: ScanStreamState = {
  progress: 0,
  currentCategory: "",
  status: null,
  findings: [],
  error: null,
  connectionState: "connecting",
  totalFindings: 0,
};

export function useScanStream(scanId: string, token: string): ScanStreamState {
  const [state, setState] = useState<ScanStreamState>(initialState);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!scanId || !token) return;

    setState((prev) => ({ ...prev, connectionState: "connecting" }));

    const url = `${SSE_URL}?scanId=${encodeURIComponent(scanId)}&token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      setState((prev) => ({ ...prev, connectionState: "live", status: prev.status ?? "running" }));
    };

    source.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SseEvent;

        switch (data.type) {
          case "scan_progress":
            setState((prev) => ({
              ...prev,
              progress: (data as ScanProgressEvent).progress,
              currentCategory: (data as ScanProgressEvent).currentCategory,
              status: prev.status === null ? "running" : prev.status,
            }));
            break;

          case "new_finding":
            setState((prev) => ({
              ...prev,
              findings: [...prev.findings, (data as NewFindingEvent).finding],
              status: prev.status === null ? "running" : prev.status,
            }));
            break;

          case "scan_complete": {
            const completeData = data as ScanCompleteEvent;
            setState((prev) => ({
              ...prev,
              status: completeData.status,
              totalFindings: completeData.totalFindings,
              progress: 100,
              connectionState: "closed",
            }));
            source.close();
            break;
          }

          case "scan_failed": {
            const failedData = data as ScanFailedEvent;
            setState((prev) => ({
              ...prev,
              status: "failed",
              error: failedData.error,
              totalFindings: failedData.findingsBeforeFailure,
              connectionState: "closed",
            }));
            source.close();
            break;
          }
        }
      } catch {
        // Ignore malformed JSON
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects on error.
      // Only set reconnecting if the connection is not already closed.
      setState((prev) => {
        if (prev.connectionState === "closed") return prev;
        return { ...prev, connectionState: "reconnecting" };
      });
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [scanId, token]);

  return state;
}
