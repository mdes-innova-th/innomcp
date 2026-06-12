#!/usr/bin/env bash

REPO_ROOT=$(git rev-parse --show-toplevel)

STAGED_NODE=$(git diff --cached --name-only | grep -E '^innomcp-node/src/.*\.(ts|tsx)$')
STAGED_NEXT=$(git diff --cached --name-only | grep -E '^innomcp-next/src/.*\.(ts|tsx)$')

if [ -z "$STAGED_NODE" ] && [ -z "$STAGED_NEXT" ]; then
    exit 0
fi

if [ -n "$STAGED_NODE" ]; then
    TSC_OUTPUT=$(cd "$REPO_ROOT/innomcp-node" && npx tsc --noEmit 2>&1)
    TSC_EXIT=$?
    if [ "$TSC_EXIT" -ne 0 ]; then
        echo "TSC GATE FAILED (innomcp-node) — fix TypeScript errors before committing"
        echo "$TSC_OUTPUT" | head -n 20
        exit 1
    fi
    echo "✓ tsc gate passed (innomcp-node)"
fi

if [ -n "$STAGED_NEXT" ]; then
    TSC_OUTPUT=$(cd "$REPO_ROOT/innomcp-next" && npx tsc --noEmit 2>&1)
    TSC_EXIT=$?
    if [ "$TSC_EXIT" -ne 0 ]; then
        echo "TSC GATE FAILED (innomcp-next) — fix TypeScript errors before committing"
        echo "$TSC_OUTPUT" | head -n 20
        exit 1
    fi
    echo "✓ tsc gate passed (innomcp-next)"
fi

exit 0
