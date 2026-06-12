<!-- cc-team deliverable
 group: P3D (Phase 3.4 â€” Smoke suite: hello round-trip + WS reconnect + provider-select)
 member: P3D-3 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":180,"completion_tokens":991,"total_tokens":1171,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":554,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-12T03:42:46.688Z -->
```bash
#!/usr/bin/env bash
set -u

BASE_URL="http://localhost:3012"
BAD_STRING='à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢'
ALL_PASS=0

echo "Phase 3 Smoke Tests"
echo "-------------------"

# Test 1: POST /api/chat, ensure response does not contain bad string
echo -n "Test 1 (POST /api/chat): "
response=$(curl -s -X POST "${BASE_URL}/api/chat" \
    -H 'Content-Type: application/json' \
    -d '{"message":"hello"}')
if [[ "$response" != *"$BAD_STRING"* ]]; then
    echo "PASS"
else
    echo "FAIL"
    ALL_PASS=1
fi

# Test 2: GET /api/health, assert JSON contains 'providers'
echo -n "Test 2 (GET /api/health): "
health_response=$(curl -s "${BASE_URL}/api/health")
if echo "$health_response" | jq -e '.providers' > /dev/null 2>&1; then
    echo "PASS"
else
    echo "FAIL"
    ALL_PASS=1
fi

# Test 3: GET /api/analytics/stats, expect HTTP 200
echo -n "Test 3 (GET /api/analytics/stats): "
http_code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/analytics/stats")
if [ "$http_code" -eq 200 ]; then
    echo "PASS"
else
    echo "FAIL (HTTP $http_code)"
    ALL_PASS=1
fi

echo ""
if [ $ALL_PASS -eq 0 ]; then
    echo "All tests passed."
    exit 0
else
    echo "Some tests failed."
    exit 1
fi
```
