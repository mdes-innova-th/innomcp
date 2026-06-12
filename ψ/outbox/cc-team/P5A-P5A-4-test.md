<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-4 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":165,"completion_tokens":2349,"total_tokens":2514,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1876,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-12T03:45:58.384Z -->
```bash
#!/bin/bash
# P5A-hook-test.sh - Tests fence detection hook

# Get script directory and fence check script path
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FENCE_CHECK="$SCRIPT_DIR/../../scripts/pre-commit-fence-check.sh"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

result1=1
result2=1

# Test 1: File with fence
echo "Test 1: Fence detection..."
TEST_FILE1="$TEMP_DIR/test-fence.ts"
echo '```typescript' > "$TEST_FILE1"
STAGED="$TEST_FILE1" bash "$FENCE_CHECK"
exit_code=$?
if [ "$exit_code" -eq 1 ]; then
    echo -e "${GREEN}PASS${NC} (exit code 1 as expected)"
    result1=0
else
    echo -e "${RED}FAIL${NC} (expected exit code 1, got $exit_code)"
fi

# Test 2: Clean file without fences
echo "Test 2: Clean file..."
TEST_FILE2="$TEMP_DIR/test-clean.ts"
echo "const x = 1;" > "$TEST_FILE2"
STAGED="$TEST_FILE2" bash "$FENCE_CHECK"
exit_code=$?
if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC} (exit code 0 as expected)"
    result2=0
else
    echo -e "${RED}FAIL${NC} (expected exit code 0, got $exit_code)"
fi

# Cleanup already via trap

# Final verdict
if [ "$result1" -eq 0 ] && [ "$result2" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC} All tests passed."
    exit 0
else
    echo -e "${RED}FAIL${NC} Some tests failed."
    exit 1
fi
```
