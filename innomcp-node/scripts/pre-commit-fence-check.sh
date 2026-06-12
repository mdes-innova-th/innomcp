#!/bin/bash

# Pre-commit hook: Check for markdown fences in staged TypeScript files

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')

if [ -z "$STAGED" ]; then
    exit 0
fi

EXIT_CODE=0

for f in $STAGED; do
    if [ ! -f "$f" ]; then
        continue
    fi

    FIRST_CODE=$(grep -m1 -v '^\s*$\|^\s*//' "$f")
    if [[ "$FIRST_CODE" =~ ^\`\`\` ]]; then
        echo "ERROR: $f starts with a markdown fence — likely CODECOMMAND raw output. Remove the fence before committing."
        EXIT_CODE=1
    fi

    if [[ "$f" =~ \.ts$ ]]; then
        FENCE_LINES=$(grep -n '```' "$f")
        if [ -n "$FENCE_LINES" ]; then
            echo "WARNING: $f contains markdown fences (triple backticks):"
            echo "$FENCE_LINES"
            echo ""
        fi
    fi
done

exit $EXIT_CODE
