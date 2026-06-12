<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-9 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":43,"completion_tokens":2968,"total_tokens":3011,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2657,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 114s
 generated: 2026-06-12T03:48:23.598Z -->
# Contributing to innomcp-node

Thank you for your interest in contributing to `innomcp-node`! This document outlines the core guidelines for contributing to the project. Please read them carefully before submitting a pull request.

## Setup

To get started, ensure you have Node.js (v18 or later) installed on your system. Fork and clone the repository, then install the project dependencies:

```bash
npm install
```

After installation, build the project to verify your environment is configured correctly:

```bash
npm run build
```

If the project requires specific environment variables for local testing, copy the `.env.example` file to `.env` and populate the necessary values before running the development server.

## Pre-commit Hooks

We utilize `husky` and `lint-staged` to enforce code quality standards automatically. Pre-commit hooks are installed during the `npm install` process. These hooks will automatically run ESLint and Prettier on your staged files before allowing a commit to proceed.

If a hook fails, the commit will be aborted. Do not bypass these hooks using `--no-verify` unless you have an extremely compelling reason. If you must bypass a hook, you are still responsible for ensuring the code passes CI checks manually.

## Bulk Gen Policy

We acknowledge the utility of AI coding assistants, but we enforce a strict "No Blind Bulk Generation" policy. While you may use AI tools to assist in writing code, you are entirely responsible for every line of code you submit.

Bulk-generated PRs that introduce untested boilerplate, redundant abstractions, or security vulnerabilities will be immediately rejected. All generated code must be thoroughly reviewed, understood, and manually refined by the contributor to ensure it aligns with the project's architecture and MCP protocol compliance. If you cannot explain the purpose and function of every line in your PR, it is not ready for submission.

## TypeScript Rules

`innomcp-node` is a strict TypeScript project. Adhere to the following rules:

- **Strict Mode:** The `strict` flag is enabled in `tsconfig.json`. All code must comply without exceptions.
- **No `any`:** Avoid the `any` type. Use `unknown` and appropriate type guards instead.
- **Explicit Returns:** All exported functions and MCP interface definitions must have explicit return types.
- **Runtime Validation:** Use `Zod` schemas for validating any external inputs, configuration payloads, or incoming MCP messages.
- **No `ts-ignore`:** Do not use `@ts-ignore`. If a type issue is genuinely unresolvable, use `@ts-expect-error` and include a detailed comment explaining the exception.

## Test Requirements

All new features, bug fixes, and MCP handlers must include corresponding tests. We use `Vitest` for our testing framework.

- **Unit Tests:** Required for all utility functions and pure logic.
- **Integration Tests:** Required for server/client interactions and transport layers. Use the provided MCP mock utilities to simulate server contexts.
- **Coverage:** Aim for meaningful test coverage. We prioritize testing edge cases and error paths over simple line coverage metrics.
- **Local Verification:** Always run `npm test` locally before pushing your changes. PRs that fail CI checks or lack appropriate tests will not be merged.
