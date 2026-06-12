<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-10 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":34,"completion_tokens":2079,"total_tokens":2113,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2330,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-12T03:44:22.688Z -->
import { withPanelBoundary } from './PanelBoundary';
export default withPanelBoundary(AgentWorkspacePanel, { panelName: 'AgentWorkspace' });
