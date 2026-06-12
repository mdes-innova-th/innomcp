<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":245,"completion_tokens":1636,"total_tokens":1881,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1198,"image_tokens":0},"cache_creation_input_tokens":0} | 137s
 generated: 2026-06-12T03:45:46.638Z -->
import React from 'react';

interface PanelErrorBoundaryProps {
  children: React.ReactNode;
  panelName: string;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<PanelErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.panelName}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { panelName } = this.props;
      const { error } = this.state;
      const errorMessage = error?.message ?? 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
      const truncatedMessage =
        errorMessage.length > 100
          ? errorMessage.substring(0, 100) + '...'
          : errorMessage;

      return (
        <div className="border border-red-500 rounded-lg p-4 bg-white shadow-md">
          <h2 className="text-lg font-semibold text-red-600 mb-2">
            แผง {panelName} เกิดข้อผิดพลาด
          </h2>
          <p className="text-sm text-gray-700 mb-4">{truncatedMessage}</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
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
