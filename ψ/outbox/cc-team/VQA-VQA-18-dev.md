<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-18 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":93,"completion_tokens":3000,"total_tokens":3093,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2714,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-12T04:21:47.963Z -->
type Status = 'online' | 'offline' | 'degraded' | 'unknown';

interface StatusBadgeProps {
  status: Status
