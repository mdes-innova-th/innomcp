<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: SMOKE-2 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":72,"completion_tokens":1520,"total_tokens":1592,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1109,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T05:27:57.829Z -->
#!/bin/bash

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Smoke testing API routes..."

# Test 1: GET /api/health
url="$BASE_URL/api/health"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$http_code" -eq 200 ]; then
    echo "PASS: GET /api/health"
else
    echo "FAIL: GET /api/health (HTTP $http_code)"
fi

# Test 2: GET /api/analytics/stats
url="$BASE_URL/api/analytics/stats"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$http_code" -eq 200 ]; then
    echo "PASS: GET /api/analytics/stats"
else
    echo "FAIL: GET /api/analytics/stats (HTTP $http_code)"
fi

# Test 3: GET /api/mdes/models
url="$BASE_URL/api/mdes/models"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$http_code" -eq 200 ]; then
    echo "PASS: GET /api/mdes/models"
else
    echo "FAIL: GET /api/mdes/models (HTTP $http_code)"
fi

# Test 4: GET /api/thai/check?text=hello
url="$BASE_URL/api/thai/check?text=hello"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
if [ "$http_code" -eq 200 ]; then
    echo "PASS: GET /api/thai/check?text=hello"
else
    echo "FAIL: GET /api/thai/check?text=hello (HTTP $http_code)"
fi

echo "Done."
