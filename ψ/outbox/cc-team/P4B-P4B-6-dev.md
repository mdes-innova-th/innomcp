<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-6 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":45,"completion_tokens":366,"total_tokens":411,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":334,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-12T03:43:50.571Z -->
import PanelErrorBoundary from './PanelErrorBoundary';
export default PanelErrorBoundary(ActivityPanel, { panelName: 'Activity' });
