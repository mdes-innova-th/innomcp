<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-21 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":936,"total_tokens":1001,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":148,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-12T03:50:50.342Z -->
# Testing Guide for innomcp-node

This document outlines the testing strategy and procedures for the `innomcp-node` package. Tests are organized into three categories: unit, integration, and end-to-end (E2E). All test commands assume you are in the project root directory with dependencies installed.

## Unit Tests

Unit tests verify individual functions, classes, and modules in isolation. They are written using the built-in [`node:test`](https://nodejs.org/api/test.html) runner (Node.js 18+). No external test frameworks are required.

```bash
# Run all unit tests
node --test

# Run a specific test file
node --test test/unit/mcp-client.test.js
```

Tests are located in `test/unit/` and follow the naming convention `*.test.js`. Mocking is done with `node:test` mock functions or external libraries (e.g., `sinon`) when necessary, but external dependencies are minimal to keep tests fast.

## Integration Tests

Integration tests validate the interaction between `innomcp-node` and real external services (e.g., an MCP server, local filesystem, or a test database). They require a running service endpoint defined in a `.env.integration` file.

```bash
# Run integration tests (requires service to be up)
INTEGRATION=true node --test test/integration/
```

Tests are in `test/integration/` and typically use `node:test` alongside environment-specific setup/teardown hooks. They do not mock network calls; instead they connect to a local or staged service instance.

## End-to-End (E2E) Tests with Playwright

E2E tests simulate real user workflows through the CLI or browser-based UI (if applicable) using [Playwright](https://playwright.dev/). These tests verify the complete stack from user input to output.

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run E2E tests
npx playwright test

# Run a specific E2E test file
npx playwright test e2e/client-workflow.spec.js
```

E2E test files reside in `e2e/` and use Playwright's `test` and `expect` API. A test server is automatically started and stopped by the Playwright global setup fixture.

## Coverage Goals

We aim for the following coverage thresholds (measured by `c8` or `node --experimental-test-coverage`):

- **Unit tests**: >= 90% line coverage, >= 85% branch coverage.
- **Integration tests**: >= 80% line coverage on critical paths (transport, error handling).
- **E2E tests**: >= 95% of core user flows (connect, list tools, call tool, error recovery).

Coverage reports are generated automatically and can be viewed locally:

```bash
# Generate coverage report
node --experimental-test-coverage --test
# HTML report will be in ./coverage/
```

## CI Pipeline Integration

All test categories execute on every pull request and merge to `main` via the following CI pipeline (configured in `.github/workflows/ci.yml`):

1. **Unit tests** run first (fast) – block if they fail.
2. **Integration tests** run after unit tests pass – require a separate CI service container (e.g., a mock MCP server).
3. **E2E tests** run last, using Playwright’s Docker image – they use the built artifact from the same pipeline.
4. **Coverage** is uploaded to Codecov and enforced via status checks.

Each test command is defined with the exact flags shown above. CI secrets hold any required test credentials. Failures in any category cause the pipeline to fail, preventing deployment.
