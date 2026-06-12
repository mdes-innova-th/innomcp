<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":92,"completion_tokens":718,"total_tokens":810,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":633,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-12T04:20:45.196Z -->
'use client';

import { useWSStatus } from '@/hooks/useWSStatus';
import WSStatusBanner from './WSStatusBanner';

interface ChatConnectionStatusProps {
  socket: WebSocket | null;
}

export default function ChatConnectionStatus({ socket }: ChatConnectionStatusProps) {
  const status = useWSStatus(socket);
  return <WSStatusBanner status={status} />;
}
