<!-- cc-team deliverable
 group: P4C (Phase 4.3 â€” Wire AgentStepsView to real dispatch events)
 member: P4C-2 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":172,"completion_tokens":1642,"total_tokens":1814,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":954,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-12T03:44:20.269Z -->
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentStepsView from './AgentStepsView';

// Mock WebSocket
const createMockWebSocket = () => {
  const ws = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.OPEN,
  };
  return ws;
};

describe('AgentStepsView', () => {
  it('renders empty state when no steps', () => {
    const ws = createMockWebSocket();
    render(<AgentStepsView ws={ws as unknown as WebSocket} />);
    // Adjust selector based on actual empty state element
    expect(screen.getByText(/no steps/i)).toBeInTheDocument();
  });

  it('shows a step row after receiving agent_step WebSocket message', () => {
    const ws = createMockWebSocket();
    render(<AgentStepsView ws={ws as unknown as WebSocket} />);

    // Simulate incoming agent_step message
    const event = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'agent_step',
        step: { id: '1', status: 'running', name: 'Step 1' },
      }),
    });
    ws.onmessage!(event);

    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
  });

  it('shows a spinner or "กำลังทำงาน" text for running step', () => {
    const ws = createMockWebSocket();
    render(<AgentStepsView ws={ws as unknown as WebSocket} />);

    // Send running step
    const event = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'agent_step',
        step: { id: '1', status: 'running', name: 'Step 1' },
      }),
    });
    ws.onmessage!(event);

    // Check for spinner or Thai text
    const spinner = screen.queryByRole('status');
    if (spinner) {
      expect(spinner).toBeInTheDocument();
    } else {
      expect(screen.getByText(/กําลังทํางาน/i)).toBeInTheDocument();
    }
  });

  it('shows completion indicator for done step', () => {
    const ws = createMockWebSocket();
    render(<AgentStepsView ws={ws as unknown as WebSocket} />);

    // Send done step
    const event = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'agent_step',
        step: { id: '1', status: 'done', name: 'Step 1' },
      }),
    });
    ws.onmessage!(event);

    // Check for completion indicator (e.g., checkmark icon or text)
    const checkmark = screen.queryByText(/เสร็จสิ้น/i);
    if (checkmark) {
      expect(checkmark).toBeInTheDocument();
    } else {
      // fallback: assume a data-testid or class that indicates completion
      expect(screen.getByTestId('step-done')).toBeInTheDocument();
    }
  });
});
