import type { AgentEvent } from "../app/components/chat/useAgentEventStream";
import type { Plan, PlanPhase } from "../app/components/chat/PlanViewer";

export function buildPlanFromEvents(events: AgentEvent[], runId: string): Plan | null {
  if (events.length === 0) return null;

  // Map SSE events to plan phases
  const phaseMap = new Map<string, PlanPhase>();
  const phaseOrder: string[] = [];

  events.forEach((ev) => {
    if (ev.type === "route_selected") {
      const id = "route";
      if (!phaseMap.has(id)) {
        phaseOrder.push(id);
        phaseMap.set(id, { id, title: "วิเคราะห์คำถาม", status: "completed", agentId: ev.agentId, completedAt: Date.now() });
      }
    }
    if (ev.type === "agent_started") {
      const id = `agent-${ev.agentId}`;
      if (!phaseMap.has(id)) {
        phaseOrder.push(id);
        phaseMap.set(id, {
          id, title: `${ev.agentId ?? "Agent"} กำลังทำงาน`,
          status: "running", agentId: ev.agentId, startedAt: Date.now(),
          description: ev.publicSummary,
        });
      }
    }
    if (ev.type === "agent_finished") {
      const id = `agent-${ev.agentId}`;
      const p = phaseMap.get(id);
      if (p) phaseMap.set(id, { ...p, status: "completed", completedAt: Date.now(), output: ev.publicSummary });
    }
    if (ev.type === "tool_call_started") {
      const id = `tool-${ev.toolName}-${Date.now()}`;
      phaseOrder.push(id);
      phaseMap.set(id, {
        id, title: `เรียกใช้ ${ev.toolName ?? "Tool"}`,
        status: "running", toolsUsed: [ev.toolName ?? ""], startedAt: Date.now(),
        description: ev.publicSummary,
      });
    }
    if (ev.type === "tool_call_finished") {
      // Mark last running tool as completed
      const lastToolId = [...phaseOrder].reverse().find(k => k.startsWith("tool-") && phaseMap.get(k)?.status === "running");
      if (lastToolId) {
        const p = phaseMap.get(lastToolId)!;
        phaseMap.set(lastToolId, { ...p, status: "completed", completedAt: Date.now(), output: ev.publicSummary });
      }
    }
    if (ev.type === "final_answer") {
      const id = "final";
      if (!phaseMap.has(id)) {
        phaseOrder.push(id);
        phaseMap.set(id, { id, title: "สรุปคำตอบ", status: "completed", completedAt: Date.now() });
      }
    }
  });

  if (phaseOrder.length === 0) return null;

  const phases = phaseOrder.map(id => phaseMap.get(id)!).filter(Boolean);
  const isComplete = phases.every(p => p.status === "completed");

  return {
    id: runId,
    title: "แผนการทำงาน",
    phases,
    createdAt: Date.now(),
    status: isComplete ? "completed" : "running",
  };
}
