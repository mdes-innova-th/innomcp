<!-- cc-team deliverable
 group: P4C (Phase 4.3 â€” Wire AgentStepsView to real dispatch events)
 member: P4C-4 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":51,"completion_tokens":511,"total_tokens":562,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":390,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-12T03:44:28.969Z -->
export interface AgentStartEvent {
  type: "agent:start";
  agentId?: string;
  message?: string;
  timestamp?: number;
}

export interface AgentStepEvent {
  type: "agent:step";
  step: number;
  thought?: string;
  action?: string;
  observation?: string;
  timestamp?: number;
}

export interface AgentCompleteEvent {
  type: "agent:complete";
  result?: string;
  success: boolean;
  timestamp?: number;
}

export type AgentWSEvent = AgentStartEvent | AgentStepEvent | AgentCompleteEvent;
