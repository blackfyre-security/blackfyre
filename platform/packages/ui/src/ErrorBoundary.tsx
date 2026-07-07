"use client";

import { Component, type ReactNode } from "react";
import React from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in"
          role="alert"
          aria-live="assertive"
        >
          <div
            className="w-14 h-14 flex items-center justify-center mb-4"
            style={{ background: "var(--critical-bg)", borderRadius: 6 }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--critical-text)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Something went wrong
          </h2>
          <p
            className="text-sm mt-1 max-w-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            An unexpected error occurred. Please try again or contact support if
            the problem persists.
          </p>
          <button
            onClick={this.handleRetry}
            className="btn btn-primary btn-sm mt-5"
            aria-label="Retry rendering"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
