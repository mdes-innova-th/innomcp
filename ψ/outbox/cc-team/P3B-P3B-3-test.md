<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-3 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":137,"completion_tokens":884,"total_tokens":1021,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":455,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-12T03:42:11.581Z -->
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WSStatusBanner from './WSStatusBanner';

describe('WSStatusBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when status=connected', () => {
    const { container } = render(<WSStatusBanner status="connected" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders yellow banner with Thai text when status=connecting', () => {
    render(<WSStatusBanner status="connecting" />);
    const banner = screen.getByText(/กำลังเชื่อมต่อ/);
    expect(banner).toBeInTheDocument();
    // Expect the banner to have a yellow background class (e.g., bg-yellow-500)
    expect(banner.closest('[class*="yellow"]') || banner.closest('[class*="bg-yellow"]')).toBeTruthy();
  });

  it('renders disconnected banner when status=disconnected', () => {
    render(<WSStatusBanner status="disconnected" />);
    const banner = screen.getByText(/การเชื่อมต่อขาด/);
    expect(banner).toBeInTheDocument();
    // Optionally check for a non-yellow background or specific class
  });

  it('shows retryCount text when retryCount=3', () => {
    render(<WSStatusBanner status="disconnected" retryCount={3} />);
    const retryText = screen.getByText(/ครั้งที่ 3/); // adjust Thai pattern as needed
    expect(retryText).toBeInTheDocument();
  });

  it('no infinite spinner element when status=disconnected (assert no animate-spin class)', () => {
    const { container } = render(<WSStatusBanner status="disconnected" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });
});
