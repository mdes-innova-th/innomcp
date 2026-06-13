<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: FINAL-1 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":62,"completion_tokens":3000,"total_tokens":3062,"prompt_tokens_details":{"cached_tokens":61,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2367,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T05:29:34.810Z -->
#!/usr/bin/env bash
set -euo pipefail

GATES_DIR="innomcp-node/docs/opus-gates"
OVERALL="PASS"

if [ ! -d "$GATES_DIR" ]; then
    echo "FAIL: Directory $GATES_DIR does not exist"
    exit 1
fi

mapfile -t files < <(find "$GATES_DIR" -maxdepth 1 -type f | sort)

if [ "${#files[@]}" -eq 0 ];
