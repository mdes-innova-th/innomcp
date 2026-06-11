"use client";

import { useMemo } from "react";

// ------------------------------------------------------------------ Types
export type AgentStatus = "active" | "idle" | "error" | "offline";

export interface AgentEvent {
  agentId: string;
  status: AgentStatus;
  timestamp: number;
  name?: string;
}

export interface AgentCountSummary {
  total: number;
  active: number;
  idle: number;
  error: number;
  offline: number;
  byId: Map<string, AgentStatus>;
}

// ------------------------------------------------------------------ Helpers

/**
 * Reduces an array of AgentEvents to a Map of the latest status per agentId.
 * The latest event is determined by the highest timestamp.
 * Events with identical agentId and timestamp keep the last one encountered.
 */
function reduceToLatestStatusMap(events: AgentEvent[]): Map<string, AgentStatus> {
  const statusMap = new Map<string, AgentStatus>();
  const timestampMap = new Map<string, number>();

  for (const event of events) {
    const { agentId, status, timestamp } = event;
    const existingTimestamp = timestampMap.get(agentId);

    if (existingTimestamp === undefined || timestamp >= existingTimestamp) {
      statusMap.set(agentId, status);
      timestampMap.set(agentId, timestamp);
    }
  }

  return statusMap;
}

function countStatuses(statusMap: Map<string, AgentStatus>): Omit<AgentCountSummary, "byId"> {
  let total = 0;
  let active = 0;
  let idle = 0;
  let error = 0;
  let offline = 0;

  for (const status of statusMap.values()) {
    total++;
    switch (status) {
      case "active":
        active++;
        break;
      case "idle":
        idle++;
        break;
      case "error":
        error++;
        break;
      case "offline":
        offline++;
        break;
      default:
        // Exhaustive check – never reached in practice
        const _exhaustive: never = status;
        throw new Error(`Unknown status: ${_exhaustive}`);
    }
  }

  return { total, active, idle, error, offline };
}

// ------------------------------------------------------------------ Hooks

/**
 * Given an array of AgentEvents, returns a summary of the current agent statuses.
 * The latest event per agentId is determined by the highest timestamp.
 * The result is memoized.
 */
export function useAgentCount(events: AgentEvent[]): AgentCountSummary {
  return useMemo<AgentCountSummary>(() => {
    const byId = reduceToLatestStatusMap(events);
    const counts = countStatuses(byId);

    return {
      ...counts,
      byId,
    };
  }, [events]);
}

/**
 * Given an array of AgentEvents, returns an array of agentIds that have an 'active' status.
 * The result is memoized.
 */
export function useActiveAgentIds(events: AgentEvent[]): string[] {
  return useMemo<string[]>(() => {
    const statusMap = reduceToLatestStatusMap(events);
    const activeIds: string[] = [];

    for (const [agentId, status] of statusMap) {
      if (status === "active") {
        activeIds.push(agentId);
      }
    }

    return activeIds;
  }, [events]);
}
