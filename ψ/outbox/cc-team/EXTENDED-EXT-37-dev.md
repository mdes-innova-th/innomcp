<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-37 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":2886,"total_tokens":2950,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2565,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T05:27:32.776Z -->
name: Health Check

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    if: ${{ secrets.HEALTH_CHECK_URL != '' }}
    steps:
      - name: Ping Health Endpoint
        id: ping
        run: |
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${{ secrets.HEALTH_CHECK_URL }}")
          if [ "$HTTP_STATUS" != "200" ]; then
            echo "unhealthy=true" >> $GITHUB_OUTPUT
            echo "Health check failed with HTTP status: $HTTP_STATUS"
          else
            echo "unhealthy=false" >> $GITHUB_OUTPUT
            echo "Health check passed with HTTP status: $HTTP_STATUS"
          fi
        continue-on-error: true

      - name: Notify on Failure
        if: steps.ping.outputs.unhealthy == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Health Check Failed',
              body: 'The scheduled health check failed to return a 200 OK status. Please investigate the deployment immediately.',
              labels: ['bug', 'operations']
            })
