"use client";
import React, { useState, useEffect } from 'react';

interface AgentStep {
  stepId: string;
  agentName: string;
  status: 'running' | 'done' | 'error';
  output?: string;
}

interface AgentEvent {
  type?: string;
  agentName?: string;
  status?: string;
  output?: string;
}

interface AgentStepsViewProps {
  socket?: WebSocket | null;
  events?: AgentEvent[];
  isStreaming?: boolean;
  className?: string;
}

const AgentStepsView: React.FC<AgentStepsViewProps> = ({ socket: propSocket, events: propEvents, className }) => {
  const [steps, setSteps] = useState<AgentStep[]>([]);

  useEffect(() => {
    const socket =
      propSocket ??
      (typeof window !== 'undefined' ? (window as any).__chatSocket : null);

    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_step') {
          const { stepId, agentName, status, output } = data;
          setSteps(prev => {
            const existingIndex = prev.findIndex(s => s.stepId === stepId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                agentName: agentName ?? updated[existingIndex].agentName,
                status: status ?? updated[existingIndex].status,
                output: output !== undefined ? output : updated[existingIndex].output,
              };
              return updated;
            }
            return [...prev, { stepId, agentName, status, output }];
          });
        }
      } catch {
        // ignore non‑JSON messages
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [propSocket]); // re‑attach if the socket reference changes

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return '#3B82F6';
      case 'done': return '#10B981';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Merge WS-accumulated steps with prop-passed events (legacy callers)
  const displaySteps = steps.length > 0 ? steps : (propEvents?.map((e, i) => ({
    stepId: String(i),
    agentName: e.agentName ?? 'Agent',
    status: (e.status as 'running' | 'done' | 'error') ?? 'running',
    output: e.output,
  })) ?? []);

  return (
    <div className={`agent-steps-view space-y-2 ${className ?? ''}`}>
      {displaySteps.length === 0 && (
        <p className="text-gray-500">No agent steps yet.</p>
      )}
      {displaySteps.map(step => (
        <div key={step.stepId} className="flex items-start gap-2 p-2 border rounded bg-white shadow-sm">
          <div className="font-medium">{step.agentName}</div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: statusColor(step.status) }}
          >
            {step.status}
          </span>
          {step.output && (
            <div
              className="text-sm text-gray-700 ml-auto truncate max-w-xs"
              title={step.output}
            >
              {step.output.length > 50 ? `${step.output.substring(0, 50)}...` : step.output}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AgentStepsView;
