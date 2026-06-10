// agentOrchestrator.ts
// Client-side agent orchestration manager for INNOMCP
// Tracks real-time state of multiple MDES agents working in parallel.

export type AgentStatus = "queued" | "thinking" | "tool-use" | "done" | "error";

export interface AgentState {
  id: string;
  agentId: string;
  model: string;
  status: AgentStatus;
  startTime: number;
  endTime?: number;
  toolsUsed: string[];
  confidence?: number;
  summary?: string;
  error?: string;
}

export interface OrchestrationState {
  runId: string;
  phase: "routing" | "dispatching" | "executing" | "synthesizing" | "done";
  agents: AgentState[];
  primaryAgent?: string;
  startTime: number;
  endTime?: number;
  totalMs?: number;
}

export interface AgentEvent {
  type: string;
  agentId?: string;
  model?: string;
  status?: AgentStatus;
  timestamp: number;
  toolsUsed?: string[];
  confidence?: number;
  summary?: string;
  error?: string;
  runId?: string;
  primaryAgent?: string;
}

/**
 * Processes an array of AgentEvent objects to construct the final
 * OrchestrationState. Events are applied in chronological order.
 */
export function buildOrchestrationState(events: AgentEvent[]): OrchestrationState {
  // Sort events by timestamp to ensure correct ordering
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let runId = "";
  let phase: OrchestrationState["phase"] = "routing";
  let primaryAgent: string | undefined;
  let startTime = 0;
  let endTime: number | undefined;
  const agentsMap = new Map<string, AgentState>();

  for (const event of sorted) {
    // Capture run‑level metadata
    if (event.runId) runId = event.runId;
    if (event.primaryAgent) primaryAgent = event.primaryAgent;

    // Phase transitions based on known event types
    switch (event.type) {
      case "orchestration_start":
      case "routing":
        phase = "routing";
        startTime = startTime || event.timestamp;
        break;
      case "dispatching":
        phase = "dispatching";
        break;
      case "executing":
      case "execution_start":
        phase = "executing";
        break;
      case "synthesizing":
      case "synthesis_start":
        phase = "synthesizing";
        break;
      case "orchestration_done":
      case "done":
        phase = "done";
        endTime = event.timestamp;
        break;
      default:
        // Agent‑specific events are handled below
        break;
    }

    // Agent lifecycle events
    if (event.agentId) {
      // Use agentId as the unique key; model may be overwritten later
      const id = event.agentId;
      let agent = agentsMap.get(id);

      switch (event.type) {
        case "agent_queued":
        case "agent_start":
          if (!agent) {
            agent = {
              id,
              agentId: event.agentId,
              model: event.model || "",
              status: "queued",
              startTime: event.timestamp,
              toolsUsed: [],
            };
            agentsMap.set(id, agent);
          } else {
            agent.model = event.model || agent.model;
            agent.status = "queued";
            agent.startTime = event.timestamp; // may reset (edge case)
          }
          break;

        case "agent_thinking":
        case "agent_working":
          if (agent) {
            agent.status = "thinking";
            // keep existing toolsUsed etc.
          }
          break;

        case "agent_tool_use":
          if (agent) {
            agent.status = "tool-use";
            if (event.toolsUsed) {
              agent.toolsUsed = [...new Set([...agent.toolsUsed, ...event.toolsUsed])];
            }
          }
          break;

        case "agent_done":
          if (agent) {
            agent.status = "done";
            agent.endTime = event.timestamp;
            if (event.confidence !== undefined) agent.confidence = event.confidence;
            if (event.summary !== undefined) agent.summary = event.summary;
          }
          break;

        case "agent_error":
          if (agent) {
            agent.status = "error";
            agent.endTime = event.timestamp;
            agent.error = event.error || "Unknown error";
          }
          break;

        default:
          // Unrecognised event — try to treat status field directly
          if (event.status && agent) {
            agent.status = event.status;
            if (event.status === "done" || event.status === "error") {
              agent.endTime = event.timestamp;
            }
            if (event.toolsUsed) {
              agent.toolsUsed = [...new Set([...agent.toolsUsed, ...event.toolsUsed])];
            }
          }
      }
    }
  }

  const agents = Array.from(agentsMap.values());
  const totalMs = endTime ? endTime - startTime : undefined;

  return {
    runId,
    phase,
    agents,
    primaryAgent,
    startTime,
    endTime,
    totalMs,
  };
}

export class AgentOrchestrator {
  private state: OrchestrationState;

  constructor(events: AgentEvent[]) {
    this.state = buildOrchestrationState(events);
  }

  /** Returns the full computed orchestration state */
  getState(): OrchestrationState {
    return this.state;
  }

  /** Returns agents that are currently active (not done/error) */
  getActiveAgents(): AgentState[] {
    return this.state.agents.filter(
      (a) => a.status !== "done" && a.status !== "error"
    );
  }

  /** Returns the agent with the shortest duration (must be completed) */
  getFastestAgent(): AgentState | undefined {
    const completed = this.state.agents.filter(
      (a) => a.startTime !== undefined && a.endTime !== undefined
    );
    if (completed.length === 0) return undefined;

    return completed.reduce((fastest, current) => {
      const currentDuration = current.endTime! - current.startTime;
      const fastestDuration = fastest.endTime! - fastest.startTime;
      return currentDuration < fastestDuration ? current : fastest;
    });
  }

  /** Returns the agent with the longest duration (must be completed) */
  getSlowestAgent(): AgentState | undefined {
    const completed = this.state.agents.filter(
      (a) => a.startTime !== undefined && a.endTime !== undefined
    );
    if (completed.length === 0) return undefined;

    return completed.reduce((slowest, current) => {
      const currentDuration = current.endTime! - current.startTime;
      const slowestDuration = slowest.endTime! - slowest.startTime;
      return currentDuration > slowestDuration ? current : slowest;
    });
  }

  /** Returns an integer 0‑100 indicating overall orchestration progress */
  getPhaseProgress(): number {
    switch (this.state.phase) {
      case "routing":
        return 5;
      case "dispatching":
        return 20;
      case "executing":
        // Base 20 + up to 30 based on how many agents are done
        const totalAgents = this.state.agents.length;
        if (totalAgents === 0) return 50;
        const doneCount = this.state.agents.filter(
          (a) => a.status === "done" || a.status === "error"
        ).length;
        return Math.min(20 + Math.round((doneCount / totalAgents) * 30), 50);
      case "synthesizing":
        return 80;
      case "done":
        return 100;
      default:
        return 0;
    }
  }

  /** Creates a timeline of events for visualisation */
  toTimeline(): Array<{ time: number; event: string }> {
    // We do not have direct access to the original events after construction.
    // Instead, we reconstruct a timeline from the agent states.
    const entries: Array<{ time: number; event: string }> = [];

    for (const agent of this.state.agents) {
      entries.push({
        time: agent.startTime,
        event: `${agent.agentId}: queued`,
      });
      if (agent.status === "thinking" || agent.status === "tool-use") {
        entries.push({
          time: agent.startTime, // approximate
          event: `${agent.agentId}: ${agent.status}`,
        });
      }
      if (agent.endTime) {
        entries.push({
          time: agent.endTime,
          event: `${agent.agentId}: ${agent.status}`,
        });
      }
    }

    // Sort by time
    entries.sort((a, b) => a.time - b.time);
    return entries;
  }
}