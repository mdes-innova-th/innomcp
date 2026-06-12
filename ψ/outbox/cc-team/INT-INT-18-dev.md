<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-18 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":93,"completion_tokens":2134,"total_tokens":2227,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1800,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-12T03:50:37.107Z -->
#!/bin/bash
BASE_URL="${BASE_URL:-http://localhost:8080}"
fail=0

http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/analytics/stats")
if [ "$http_code" -eq 200 ]; then echo "PASS"; else echo "FAIL"; fail=1; fi

http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/mdes/models")
if [ "$http_code" -eq 200 ]; then echo "PASS"; else echo "FAIL"; fail=1; fi

http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/mdes/best/thai")
if [ "$http_code" -eq 200 ]; then echo "PASS"; else echo "FAIL"; fail=1; fi

thai_text="สวัสดี"
http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: text/plain" -d "$thai_text" "${BASE_URL}/api/thai/detect")
if [ "$http_code" -eq 200 ]; then echo "PASS"; else echo "FAIL"; fail=1; fi

http_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health")
if [ "$http_code" -eq 200 ]; then echo "PASS"; else echo "FAIL"; fail=1; fi

exit $fail
