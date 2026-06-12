<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-5 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":92,"completion_tokens":2201,"total_tokens":2293,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2075,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-12T04:21:15.739Z -->
.mdes-brand-header {
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Override any ancestor overflow:hidden that breaks sticky positioning */
html,
body,
main,
#__next,
.overflow-hidden:has(.mdes-brand-header),
[class*="overflow-hidden"]:has(.mdes-brand-header),
[style*="overflow: hidden"]:has(.mdes-brand-header),
[style*="overflow:hidden"]:has(.mdes-brand-header) {
  overflow: visible !important;
}
