<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-30 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":82,"completion_tokens":1972,"total_tokens":2054,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1769,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 91s
 generated: 2026-06-12T04:23:34.708Z -->
#!/bin/bash

OUTPUT=$(pnpm build 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "BUILD OK"
else
    echo "BUILD FAILED"
    echo "$OUTPUT" | head -n 30
fi

exit $EXIT_CODE
