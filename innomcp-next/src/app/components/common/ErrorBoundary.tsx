"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; componentName?: string; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }

  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.componentName}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-4 text-[12px] text-rose-600 dark:text-rose-400">
          <p className="font-medium mb-1">⚠️ Component Error{this.props.componentName ? `: ${this.props.componentName}` : ""}</p>
          <p className="text-[10.5px] text-rose-500/70">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-2 text-[10.5px] underline hover:no-underline">
            ลองใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
