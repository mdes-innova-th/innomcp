'use client';

import React, { useState, useMemo } from 'react';

// ==================== Types (should match your real imports) ====================
interface AgentEvent {
  id: string;
  type: string;       // e.g. 'routing', 'agent', 'tool', 'synthesis'
  label: string;
  model?: string;
  status: 'waiting' | 'active' | 'done' | 'error';
  summary?: string;
  toolName?: string;
  elapsed?: number;
  timestamp: string;  // ISO string (or number)
}

interface AgentStepsViewProps {
  events: AgentEvent[];
  isStreaming: boolean;
  className?: string;
}

// ==================== Helper constants ====================
const GROUP_ORDER: Record<string, number> = {
  routing: 0,
  agent: 1,
  tool: 2,
  synthesis: 3,
};

const GROUP_LABELS: Record<string, string> = {
  routing: 'การนำทาง (Routing)',
  agent: 'ตัวแทน (Agent)',
  tool: 'เครื่องมือ (Tool)',
  synthesis: 'การสังเคราะห์ (Synthesis)',
};

// ==================== Component ====================
export default function AgentStepsView({
  events,
  isStreaming,
  className = '',
}: AgentStepsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Group events by type, preserving order
  const groups = useMemo(() => {
    const map = new Map<string, AgentEvent[]>();
    events.forEach((e) => {
      const type = e.type || 'unknown';
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(e);
    });

    // Sort groups by defined order
    const sortedTypes = Array.from(map.keys()).sort(
      (a, b) => (GROUP_ORDER[a] ?? 99) - (GROUP_ORDER[b] ?? 99)
    );

    return sortedTypes.map((type) => ({
      type,
      label: GROUP_LABELS[type] ?? type,
      items: map.get(type)!,
    }));
  }, [events]);

  // Global step index across all events
  let globalIndex = 0;

  // Calculate summary bar info
  const totalSteps = events.length;
  const isComplete =
    !isStreaming &&
    events.length > 0 &&
    events.every((e) => e.status === 'done' || e.status === 'error');

  const totalElapsed = useMemo(() => {
    if (events.length === 0) return 0;
    const timestamps = events.map((e) => new Date(e.timestamp).getTime());
    const min = Math.min(...timestamps);
    const max = isStreaming ? Date.now() : Math.max(...timestamps);
    return (max - min) / 1000; // seconds
  }, [events, isStreaming]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Format elapsed seconds
  const formatElapsed = (s: number): string => {
    if (s < 60) return `${s.toFixed(1)} วินาที`;
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min} นาที ${sec} วินาที`;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Summary bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        {totalSteps === 0 ? (
          <p className="text-sm text-gray-400">กำลังเตรียมการ...</p>
        ) : isComplete ? (
          <p className="text-sm font-medium text-green-700">
            เสร็จแล้วใน {formatElapsed(totalElapsed)}
          </p>
        ) : (
          <p className="text-sm font-medium text-indigo-700">
            MDES AI กำลังวิเคราะห์ {totalSteps} ขั้นตอน
          </p>
        )}
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {/* Custom keyframe for slide-in animation */}
        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .slide-in-step {
            animation: slideInUp 0.35s ease-out both;
          }
        `}</style>

        {groups.map((group) => (
          <div key={group.type} className="mb-4">
            {/* Group header */}
            <div className="flex items-center mb-2 pl-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </span>
            </div>

            {/* Steps of this group */}
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

              {group.items.map((event, idxInGroup) => {
                const currentIndex = globalIndex++;
                const isExpanded = expandedIds.has(event.id);
                const isActive = event.status === 'active';
                const isDone = event.status === 'done';
                const isError = event.status === 'error';

                return (
                  <div
                    key={event.id}
                    className="slide-in-step flex items-start mb-4 relative"
                    style={{ animationDelay: `${currentIndex * 0.06}s` }}
                  >
                    {/* Circle indicator */}
                    <div className="relative z-10 flex-shrink-0">
                      {isActive ? (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse ring-4 ring-indigo-100" />
                      ) : isDone ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : isError ? (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                      ) : (
                        // Waiting
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className="ml-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => event.summary && toggleExpand(event.id)}
                      title={event.summary ? 'คลิกเพื่อดูรายละเอียด' : undefined}
                    >
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {currentIndex + 1}. {event.label}
                        </span>
                        {event.model && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {event.model}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-xs text-indigo-600 animate-pulse">
                            กำลังทำงาน...
                          </span>
                        )}
                        {event.elapsed !== undefined && event.status !== 'active' && (
                          <span className="text-xs text-gray-400 ml-auto">
                            {event.elapsed.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Expandable summary */}
                      {event.summary && (
                        <div className="mt-1 text-sm text-gray-600">
                          {isExpanded ? (
                            <p className="whitespace-pre-wrap">{event.summary}</p>
                          ) : (
                            <p className="line-clamp-2">{event.summary}</p>
                          )}
                        </div>
                      )}

                      {/* Tool name badge if exists */}
                      {event.toolName && (
                        <div className="mt-1 inline-flex items-center text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          🔧 {event.toolName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {events.length === 0 && isStreaming && (
          <p className="text-center text-gray-400 mt-8">กำลังรอขั้นตอนแรก...</p>
        )}
      </div>
    </div>
  );
}