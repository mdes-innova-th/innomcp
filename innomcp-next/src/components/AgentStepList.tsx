'use client';

import React, { useRef, useEffect } from 'react';
import { AgentEvent } from '../lib/agentEvents';

const LABELS: Record<string, string> = {
  plan: 'แผน',
  tool_call: 'เรียกใช้เครื่องมือ',
  tool_result: 'ผลลัพธ์',
  message: 'ข้อความ',
  artifact: 'ไฟล์',
  done: 'เสร็จสิ้น',
};

const ICONS: Record<string, string> = {
  plan: '📋',
  tool_call: '🔧',
  tool_result: '',
  message: '💬',
  artifact: '📎',
  done: '🏁',
};

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ToolCallSummary({ event }: { event: AgentEvent }) {
  if (event.type !== 'tool_call') return null;
  const { name, args } = event as any;
  return (
    <details className="group cursor-pointer">
      <summary className="font-medium text-sm text-gray-900 dark:text-gray-100">
        {name ?? 'unknown'}
      </summary>
      <pre className="mt-1 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded p-2">
        {args ? JSON.stringify(args, null, 2) : '—'}
      </pre>
    </details>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const icon = ICONS[event.type] ?? '•';
  const label = LABELS[event.type] ?? event.type;
  const timestamp = formatTimestamp((event as any).timestamp);

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {/* Icon column */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-base leading-none select-none">
        {event.type === 'tool_result'
          ? (event as any).success
            ? '✅'
            : '❌'
          : icon}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {label}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{timestamp}</span>
          )}
        </div>

        {/* Conditional content based on type */}
        {event.type === 'plan' && (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {(event as any).content ?? ''}
          </p>
        )}

        {event.type === 'tool_call' && <ToolCallSummary event={event} />}

        {event.type === 'tool_result' && (
          <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {(event as any).result ?? ''}
          </div>
        )}

        {event.type === 'message' && (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {(event as any).content ?? ''}
          </p>
        )}

        {event.type === 'artifact' && (
          <div className="text-sm">
            <a
              href={(event as any).url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>📎</span>
              <span>{(event as any).filename ?? 'ไฟล์แนบ'}</span>
            </a>
            {(event as any).mimeType && (
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                ({(event as any).mimeType})
              </span>
            )}
          </div>
        )}

        {event.type === 'done' && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            เสร็จสิ้น
          </p>
        )}
      </div>
    </div>
  );
}

interface AgentStepListProps {
  events: AgentEvent[];
  running: boolean;
}

export default function AgentStepList({ events, running }: AgentStepListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(events.length);

  useEffect(() => {
    if (events.length > prevLengthRef.current) {
      // new event added, scroll to bottom
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 space-y-1 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700"
    >
      {events.length === 0 && !running && (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
          รอคำสั่ง...
        </div>
      )}

      {events.map((event, idx) => (
        <EventRow key={idx} event={event} />
      ))}

      {running && (
        <div className="flex items-center gap-2 py-3 px-3 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          กำลังดำเนินการ...
        </div>
      )}
    </div>
  );
}
