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