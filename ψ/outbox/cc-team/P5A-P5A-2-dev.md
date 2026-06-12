<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-2 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":191,"completion_tokens":3011,"total_tokens":3202,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2852,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-12T03:46:29.242Z -->
#!/usr/bin/env bash

STAGED=$(git diff --cached --name-only | grep -E '^innomcp-node/src/.*\.(ts|tsx)$')

if [ -z "$STAGED" ]; then
    exit 0
fi

cd innomcp-node || exit 1

TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT_CODE=$?

if [ "$TSC_EXIT_CODE" -ne 0 ]; then
    echo "TSC GATE FAILED — fix TypeScript errors before committing"
    echo "$TSC_OUTPUT" | head -n 20
    exit 1
fi

echo "✓ tsc gate passed"
exit 0
