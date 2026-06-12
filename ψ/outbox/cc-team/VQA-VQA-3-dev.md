<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-3 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":141,"completion_tokens":661,"total_tokens":802,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":362,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-12T04:20:43.659Z -->
#!/bin/bash

# Start the dev server in background
pnpm dev --port 3001 &
SERVER_PID=$!

# Wait up to 15 seconds for the server to be ready
echo "Waiting for server to be ready..."
for i in $(seq 1 15); do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo "Server is ready."
        break
    fi
    sleep 1
done

# Check if server is up, if not, kill it and exit
if ! curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "Server failed to start within 15 seconds."
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Run the audit script
echo "Running audit..."
npx tsx scripts/playwright-audit.ts
AUDIT_EXIT=$?

# Kill the dev server
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

# Print audit results if report exists
if [ -f "qa/audit-report.json" ]; then
    echo "Audit report:"
    cat qa/audit-report.json
else
    echo "No audit report found at qa/audit-report.json"
fi

exit $AUDIT_EXIT
