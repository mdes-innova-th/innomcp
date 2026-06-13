<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: SMOKE-5 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":36,"completion_tokens":852,"total_tokens":888,"prompt_tokens_details":{"cached_tokens":35,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":779,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T05:28:00.823Z -->
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running recovery verification..."
echo "----------------------------------------"

node "$PROJECT_DIR/scripts/verify-recovery.js"
EXIT_CODE=$?

echo "----------------------------------------"
echo "Recovery Verification Summary"
echo "----------------------------------------"

if [ $EXIT_CODE -eq 0 ]; then
    echo "Result: SUCCESS - Recovery is complete and verified."
else
    echo "Result: FAILED - Recovery verification encountered errors (Exit Code: $EXIT_CODE)."
fi

echo "----------------------------------------"

exit $EXIT_CODE
