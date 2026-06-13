<!-- cc-team deliverable
 group: VQA-BROWSER (Phase 3-4 browser verification)
 member: VQA-B2 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":80,"completion_tokens":659,"total_tokens":739,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":477,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T05:24:48.516Z -->
#!/bin/bash
set -u

echo "Running phase 3 backend verification..."
if node scripts/verify-backend-phase3.js; then
    echo "PASS: verify-backend-phase3.js"
    backend_result=0
else
    echo "FAIL: verify-backend-phase3.js"
    backend_result=1
fi

echo ""
echo "Running recovery verification..."
if node scripts/verify-recovery.js; then
    echo "PASS: verify-recovery.js"
    recovery_result=0
else
    echo "FAIL: verify-recovery.js"
    recovery_result=1
fi

echo ""
if [ $backend_result -eq 0 ] && [ $recovery_result -eq 0 ]; then
    echo "Both scripts passed."
    exit 0
else
    echo "One or both scripts failed."
    exit 1
fi
