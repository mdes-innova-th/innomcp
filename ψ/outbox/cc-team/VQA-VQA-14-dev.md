<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-14 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":107,"completion_tokens":567,"total_tokens":674,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":38,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T04:21:19.028Z -->
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TESTS=(
  "node --test tests/recovery/P3A-greeting-fastpath.test.js"
  "node --test tests/recovery/P3D-smoke-suite.test.js"
  "node scripts/verify-recovery.js"
)

TOTAL=${#TESTS[@]}
PASSED=0
FAILED=0
RESULTS=()

cd "$PROJECT_ROOT"

for test_cmd in "${TESTS[@]}"; do
  test_name="$test_cmd"
  printf "\n▶ Running: %s\n" "$test_cmd"

  if eval "$test_cmd" > /tmp/recovery-test-stdout.log 2>/tmp/recovery-test-stderr.log; then
    printf "  ✅ PASS: %s\n" "$test_name"
    RESULTS+=("PASS|$test_name")
    ((PASSED++))
  else
    printf "  ❌ FAIL: %s\n" "$test_name"
    if [ -s /tmp/recovery-test-stderr.log ]; then
      printf "  --- stderr ---\n"
      cat /tmp/recovery-test-stderr.log
      printf "  --- end stderr ---\n"
    fi
    RESULTS+=("FAIL|$test_name")
    ((FAILED++))
  fi

  rm -f /tmp/recovery-test-stdout.log /tmp/recovery-test-stderr.log
done

printf "\n========================================\n"
printf "  Recovery Test Summary\n"
printf "========================================\n"

for entry in "${RESULTS[@]}"; do
  status="${entry%%|*}"
  name="${entry#*|}"
  if [ "$status" = "PASS" ]; then
    printf "  ✅ PASS  %s\n" "$name"
  else
    printf "  ❌ FAIL  %s\n" "$name"
  fi
done

printf "========================================\n"
printf "  Total: %d  |  Passed: %d  |  Failed: %d\n" "$TOTAL" "$PASSED" "$FAILED"
printf "========================================\n"

if [ "$FAILED" -eq 0 ]; then
  printf "\n🎉 All recovery tests passed.\n\n"
  exit 0
else
  printf "\n💥 %d recovery test(s) failed.\n\n" "$FAILED"
  exit 1
fi
```
