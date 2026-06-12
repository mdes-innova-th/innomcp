#!/bin/bash

OUTPUT=$(pnpm build 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "BUILD OK"
else
    echo "BUILD FAILED"
    echo "$OUTPUT" | head -n 30
fi

exit $EXIT_CODE