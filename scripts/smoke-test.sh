#!/bin/bash

# -----------------------------------------------------------------------------
# INNOMCP Smoke Test Script
# Tests health endpoints, web title, and WebSocket port reachability.
# Prints PASS/FAIL summary table; exits non-zero on any failure.
# -----------------------------------------------------------------------------

set -o pipefail

# ---------- Configuration ----------
HOST=${HOST:-"localhost"}
WEB_PORT=${WEB_PORT:-3000}
API_PORT=${API_PORT:-3015}
TIMEOUT=${TIMEOUT:-5}
USER_AGENT="INNOMCP-SmokeTest/1.0"

# ---------- helper functions ----------
pass_count=0
fail_count=0
declare -a test_names
declare -a test_results

# Check dependencies
check_deps() {
    local deps=("curl" "jq" "sed" "grep")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo "Error: Dependency '$dep' not found. Please install it." >&2
            exit 1
        fi
    done
}

record_result() {
    local description="$1"
    local result="$2"   # "PASS" or "FAIL"
    test_names+=("$description")
    test_results+=("$result")
    if [[ "$result" == "PASS" ]]; then
        ((pass_count++))
    else
        ((fail_count++))
    fi
}

run_test() {
    local description="$1"
    shift
    local cmd_output
    cmd_output=$(eval "$@" 2>&1)
    local rc=$?
    if [[ $rc -eq 0 ]]; then
        record_result "$description" "PASS"
    else
        record_result "$description" "FAIL"
        [[ -n "$cmd_output" ]] && echo "  -> $cmd_output" >&2
    fi
}

check_http_status() {
    local url="$1"
    local expected_http="$2"
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" \
        --user-agent "$USER_AGENT" \
        --connect-timeout "$TIMEOUT" \
        --max-time 10 2>/dev/null)
    if [[ "$http_code" -eq "$expected_http" ]]; then
        return 0
    else
        echo "Expected HTTP $expected_http, got $http_code from $url"
        return 1
    fi
}

check_json_status() {
    local url="$1"
    local json
    json=$(curl -s "$url" \
        --user-agent "$USER_AGENT" \
        --connect-timeout "$TIMEOUT" \
        --max-time 10 2>/dev/null)
    if echo "$json" | jq -e '.status == "ok"' >/dev/null 2>&1; then
        return 0
    else
        echo "JSON status field missing or not 'ok' in response from $url. Response: $(echo "$json" | head -c 100)..."
        return 1
    fi
}

extract_title() {
    local url="$1"
    local html
    html=$(curl -s "$url" \
        --user-agent "$USER_AGENT" \
        --connect-timeout "$TIMEOUT" \
        --max-time 10 2>/dev/null)
    if [[ -z "$html" ]]; then
        echo "Failed to fetch HTML from $url"
        return 1
    fi
    local title
    title=$(echo "$html" | grep -ioP '(?<=<title>).*?(?=</title>)' | head -n 1)
    if echo "$title" | grep -q "INNOMCP"; then
        return 0
    else
        echo "Web title does not contain 'INNOMCP' (found: '$title')"
        return 1
    fi
}

check_port() {
    local host="$1"
    local port="$2"
    timeout "$TIMEOUT" bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
    local rc=$?
    if [[ $rc -eq 0 ]]; then
        return 0
    else
        echo "Port $host:$port not reachable"
        return 1
    fi
}

# ---------- Execution ----------
check_deps

echo "-------------------------------------------------------------------"
echo "INNOMCP Smoke Test"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Target: $HOST (Web: $WEB_PORT, API: $API_PORT)"
echo "User-Agent: $USER_AGENT"
echo "-------------------------------------------------------------------"

# 0. Basic Reachability
run_test "Host $HOST reachable (Port $API_PORT)" \
    "check_port $HOST $API_PORT"

# API Tests
run_test "Health endpoint HTTP 200" \
    "check_http_status http://$HOST:$API_PORT/api/health 200"

run_test "Health endpoint JSON status field" \
    "check_json_status http://$HOST:$API_PORT/api/health"

# Web Tests
run_test "Web endpoint HTTP 200" \
    "check_http_status http://$HOST:$WEB_PORT 200"

run_test "Web title contains INNOMCP" \
    "extract_title http://$HOST:$WEB_PORT"

# Port Tests
run_test "WS port $API_PORT reachable" \
    "check_port $HOST $API_PORT"

# ---------- Summary table ----------
echo ""
echo "Summary"
echo "-------"
printf "%-45s %s\n" "Test" "Result"
printf "%-45s %s\n" "----" "------"
for i in "${!test_names[@]}"; do
    printf "%-45s %s\n" "${test_names[$i]}" "${test_results[$i]}"
done
echo ""
echo "TOTAL PASS: $pass_count  FAIL: $fail_count"

if [[ $fail_count -gt 0 ]]; then
    echo "Result: FAILED"
    exit 1
fi
echo "Result: SUCCESS"
exit 0
