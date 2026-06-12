# Contributing to innomcp-node

Thank you for your interest in contributing to `innomcp-node`! This guide outlines our development standards, tooling, and workflows to ensure high-quality, maintainable code across the repository.

## Environment Setup

To get started, ensure you have Node.js (v18 or higher) and pnpm installed on your local machine.

1. Fork the repository and clone it locally.
2. Navigate to the project root directory.
3. Install all required dependencies by running `pnpm install`.
4. Build the initial project state with `pnpm build` to generate necessary local types.

## Running Pre-commit Hooks

We enforce code quality, formatting, and consistency using automated pre-commit hooks. Before making your very first commit, you must install these hooks locally to prevent CI failures.

Run the following command from the root directory:


node scripts/install-hooks.js


This script configures Git to run our linters automatically before every commit. If a commit is rejected, address the reported issues and try again.

## Bulk Code Generation Policy

When generating multiple files, scaffolding endpoints, or creating bulk boilerplate, manual creation is highly error-prone. Our strict policy requires that all bulk code generation must be executed using our dedicated internal tooling.

Always use `cc-team-run.cjs` for these tasks. Furthermore, you must provide **real API context** to the script. Do not use mocked, placeholder, or hallucinated schemas during generation. The tool relies on live, accurate API definitions to ensure the generated TypeScript interfaces and client methods perfectly match the production environment.

## TypeScript Strictness Rules

`innomcp-node` is written in TypeScript with strict mode enabled. We prioritize absolute type safety.

* **No `@ts-nocheck` or `@ts-ignore`:** Disabling the type checker is strictly prohibited. If you encounter type errors, resolve them by fixing the underlying logic, refining generics, or updating the type definitions.
* **No Fence Markers:** Do not use visual fence markers (such as `// ---`, `// ===`, or `// ***`) to separate code blocks or functions. Rely on proper code organization, distinct modules, and standard JSDoc comments for readability.
* Ensure all public APIs are fully typed and properly exported.

## Testing Requirements Before Submitting a PR

No pull request will be reviewed or merged without passing our comprehensive test suite. Before submitting your PR, you must verify your changes locally.

1. Run the full test suite using `pnpm test`.
2. Ensure all unit and integration tests pass without warnings.
3. If you are adding new features or fixing bugs, you must include corresponding test cases to prevent future regressions.
4. Check your code coverage using `pnpm test:coverage` to ensure you meet our minimum coverage thresholds.

Once your tests pass and your code adheres to the guidelines above, push your branch and open a Pull Request.
