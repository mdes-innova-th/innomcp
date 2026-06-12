<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-4 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":124,"completion_tokens":1195,"total_tokens":1319,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":704,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-12T03:44:02.045Z -->
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import PanelErrorBoundary from './PanelErrorBoundary';

let shouldThrow = true;

function ChildThatThrows(): null {
  if (shouldThrow) {
    throw new Error('Test error from child');
  }
  return null;
}

function NormalChild() {
  return <div>Normal Child Content</div>;
}

describe('PanelErrorBoundary', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    shouldThrow = true;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children normally when no error', () => {
    render(
      <PanelErrorBoundary panelName="TestPanel">
        <NormalChild />
      </PanelErrorBoundary>
    );

    expect(screen.getByText('Normal Child Content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <PanelErrorBoundary panelName="TestPanel">
        <ChildThatThrows />
      </PanelErrorBoundary>
    );

    expect(screen.queryByText('Normal Child Content')).not.toBeInTheDocument();
    const resetButton = screen.getByRole('button');
    expect(resetButton).toBeInTheDocument();
  });

  it('fallback contains panelName', () => {
    render(
      <PanelErrorBoundary panelName="MySpecialPanel">
        <ChildThatThrows />
      </PanelErrorBoundary>
    );

    expect(screen.getByText(/MySpecialPanel/i)).toBeInTheDocument();
  });

  it('reset button clears the error state and children re-render', () => {
    render(
      <PanelErrorBoundary panelName="TestPanel">
        <ChildThatThrows />
      </PanelErrorBoundary>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();

    shouldThrow = false;

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
