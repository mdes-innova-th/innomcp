<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-10 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":60,"completion_tokens":869,"total_tokens":929,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":719,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-12T03:46:41.952Z -->
name: TSC Gate

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run TypeScript compiler
        run: npx tsc --noEmit
