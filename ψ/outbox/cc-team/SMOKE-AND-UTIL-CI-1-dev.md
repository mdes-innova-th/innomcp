<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: CI-1 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":55,"completion_tokens":541,"total_tokens":596,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":423,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T05:29:13.142Z -->
name: Smoke Test
on:
  push:
    branches:
      - main
jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Run health check
        if: env.HEALTH_CHECK_URL != ''
        env:
          HEALTH_CHECK_URL: ${{ secrets.HEALTH_CHECK_URL }}
        run: node scripts/quick-health-check.js
