"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0C0C0D] px-6">
          <div className="glass-card max-w-md rounded-xl border border-[#2A2A2E] p-10 text-center">
            <div className="mb-4 text-4xl">&#9888;</div>
            <h1 className="mb-3 text-2xl font-bold text-[#ECECEF]">
              Something went wrong
            </h1>
            <p className="mb-8 text-sm text-[#A0A0A8]">
              An unexpected error occurred. Please try again or return to the
              homepage.
            </p>
            <a
              href="/"
              className="inline-block rounded-lg bg-[#3ECFB4] px-6 py-3 font-semibold text-[#0C0C0D] transition-colors hover:bg-[#5DDBC6]"
            >
              Return to homepage
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
