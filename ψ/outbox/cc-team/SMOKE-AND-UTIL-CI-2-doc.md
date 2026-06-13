<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: CI-2 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":61,"completion_tokens":2498,"total_tokens":2559,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2107,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T05:29:58.501Z -->
# InnoMCP CI/CD Pipeline

This document outlines the Continuous Integration and Deployment workflow for the InnoMCP project.

## Triggers: PR vs. Push to Main
**Pull Requests (PR):** Opening or updating a PR triggers the validation suite. This includes code linting, static analysis, unit tests, integration tests, and dependency vulnerability scans.

**Push to `main`:** Merging to `main` triggers the full deployment pipeline. This runs all PR checks plus end-to-end (E2E) tests, Docker image building, registry publishing, and automated deployment to the staging environment.

## Required Checks
Before a PR can be merged, the following status checks must pass:
* `lint-and-format`
* `unit-tests`
* `integration-tests`
* `security-scan`

## Fixing Failing Tests
If your PR fails a check:
1. Review the detailed execution logs in the CI dashboard.
2. Reproduce the failure locally using `make test`.
3. Fix the underlying application code or update the test assertions.
4. Push a new commit to automatically re-trigger the pipeline.

## Escalation for Pre-existing Failures
Occasionally, a test may fail due to a pre-existing infrastructure or codebase issue unrelated to your changes. To verify this, check the **`motherPipeline`** (the scheduled nightly build on `main`).

* If `motherPipeline` is **green**, the failure is caused by your PR. Investigate and fix it.
* If `motherPipeline` is **red** with the exact same failure, it is a pre-existing issue. Comment on your PR with a link to the failing `motherPipeline` run, tag the `@platform-team` in Slack, and request a temporary bypass or wait for the platform team to resolve the upstream blocker.
