#!/usr/bin/env bash

STAGED=$(git diff --cached --name-only | grep -E '^innomcp-node/src/.*\.(ts|tsx)$')

if [ -z "$STAGED" ]; then
    exit 0
fi

cd innomcp-node || exit 1

TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT_CODE=$?

if [ "$TSC_EXIT_CODE" -ne 0 ]; then
    echo "TSC GATE FAILED — fix TypeScript errors before committing"
    echo "$TSC_OUTPUT" | head -n 20
    exit 1
fi

echo "✓ tsc gate passed"
exit 0
