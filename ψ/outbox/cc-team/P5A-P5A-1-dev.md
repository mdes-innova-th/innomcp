<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":241,"completion_tokens":993,"total_tokens":1234,"prompt_tokens_details":{"cached_tokens":128,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":715,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-12T03:46:55.169Z -->
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
