'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  panelName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class PanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary:${this.props.panelName}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-4 m-2 rounded-lg border-2 border-red-400 bg-red-50 min-h-[120px]">
          <p className="text-red-700 font-semibold text-sm mb-1">
            แผง {this.props.panelName} เกิดข้อผิดพลาด
          </p>
          <p className="text-red-500 text-xs mb-3 max-w-xs text-center truncate">
            {this.state.error?.message?.slice(0, 100)}
          </p>
          <button
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            รีเซ็ต
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default PanelErrorBoundary;
