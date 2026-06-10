"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

export interface MDESErrorBoundaryProps {
  componentName?: string;
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  severity?: "minor" | "major";
}

interface MDESErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * MDES-branded error boundary for INNOMCP.
 * Provides Thai error messages, recovery actions, and logging to /api/logs/error for severe errors.
 */
export class MDESErrorBoundary extends Component<
  MDESErrorBoundaryProps,
  MDESErrorBoundaryState
> {
  constructor(props: MDESErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(): Partial<MDESErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });

    // Always log to console in development
    console.error(
      `[MDES Error Boundary${this.props.componentName ? ` - ${this.props.componentName}` : ""}]`,
      error,
      errorInfo,
    );

    // Invoke custom handler if provided
    this.props.onError?.(error, errorInfo);

    // If severity is not explicitly "minor", treat as severe and send to log endpoint
    const isSevere = this.props.severity !== "minor";
    if (isSevere) {
      this.postError(error, this.props.componentName);
    }
  }

  componentDidUpdate(prevProps: MDESErrorBoundaryProps): void {
    // Reset error state when relevant props change and resetOnPropsChange is true
    if (this.props.resetOnPropsChange && this.state.hasError) {
      if (
        prevProps.children !== this.props.children ||
        prevProps.componentName !== this.props.componentName ||
        prevProps.severity !== this.props.severity
      ) {
        this.resetError();
      }
    }
  }

  private resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private postError(error: Error, componentName?: string) {
    const payload = {
      message: error.message,
      stack: error.stack ?? "",
      componentName: componentName ?? "unknown",
      timestamp: new Date().toISOString(),
    };

    fetch("/api/logs/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail if logging endpoint is unavailable
    });
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const severity = this.props.severity || "major";
      const isDev = process.env.NODE_ENV === "development";

      return (
        <ErrorDisplay
          severity={severity}
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          componentName={this.props.componentName}
          onRetry={this.resetError}
          onReport={() => {
            if (this.state.error) {
              this.postError(this.state.error, this.props.componentName);
            }
          }}
          isDev={isDev}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Error Display Components ─────────────────────────────────────────────────

interface ErrorDisplayProps {
  severity: "minor" | "major";
  error: Error | null;
  errorInfo: ErrorInfo | null;
  componentName?: string;
  onRetry: () => void;
  onReport: () => void;
  isDev: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  severity,
  error,
  errorInfo,
  componentName,
  onRetry,
  onReport,
  isDev,
}) => {
  if (severity === "minor") {
    return (
      <div
        role="alert"
        className="inline-flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 border border-yellow-200"
      >
        <svg
          className="h-4 w-4 text-yellow-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21.5 12c0 5-4.03 9-9 9s-9-4-9-9 4.03-9 9-9 9 4 9 9z"
          />
        </svg>
        <span>เกิดข้อผิดพลาด — กด </span>
        <button
          onClick={onRetry}
          className="font-semibold underline hover:no-underline"
        >
          รีเฟรช
        </button>
      </div>
    );
  }

  // ─── Major Error Card ──────────────────────────────────────────────────────
  return (
    <div
      role="alert"
      className="mx-auto my-4 max-w-lg rounded-xl bg-white shadow-lg ring-1 ring-black/5 border border-red-200"
    >
      {/* MDES Branding Header */}
      <div className="flex items-center justify-center gap-3 rounded-t-xl bg-[#003B71] px-6 py-3">
        <svg
          className="h-6 w-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <span className="text-lg font-semibold text-white">
          MDES INNOMCP
        </span>
      </div>

      {/* Error Content */}
      <div className="p-6 text-center">
        <h3 className="mb-2 text-xl font-bold text-gray-900">
          เกิดข้อผิดพลาด
        </h3>
        <p className="mb-4 text-sm text-gray-600">
          {componentName
            ? `ไม่สามารถแสดงผล "${componentName}" ได้ในขณะนี้`
            : "ไม่สามารถดำเนินการตามคำขอได้ในขณะนี้"}
        </p>

        {/* Technical details in development */}
        {isDev && error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-left text-sm text-red-800">
            <p className="font-semibold">{error.message}</p>
            {error.stack && (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-red-600">
                {error.stack}
              </pre>
            )}
            {errorInfo?.componentStack && (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-red-500">
                {errorInfo.componentStack}
              </pre>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-md bg-[#003B71] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#002D5A] focus:outline-none focus:ring-2 focus:ring-[#003B71] focus:ring-offset-2"
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            ลองอีกครั้ง
          </button>
          <button
            onClick={onReport}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003B71] focus:ring-offset-2"
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            รายงานปัญหา
          </button>
        </div>
      </div>
    </div>
  );
};

export default MDESErrorBoundary;