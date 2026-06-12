<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-15 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":101,"completion_tokens":594,"total_tokens":695,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":447,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-12T04:21:17.226Z -->
name: Recovery Verify

on:
  push:
    branches:
      - pending-commits
      - main

jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: innomcp-node
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: innomcp-node/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: node scripts/verify-recovery.js
