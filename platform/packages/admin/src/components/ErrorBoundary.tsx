"use client";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-elevated)] border border-[var(--critical)]/30 rounded-lg p-8 max-w-md">
            <h2 className="text-[var(--critical-text)] text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded text-sm" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
