<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: DOC-5 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":61,"completion_tokens":2831,"total_tokens":2892,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2446,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T05:29:35.470Z -->
# Phase Completion Checklist

Before declaring any `innomcp` development phase complete, the assigned developer must rigorously verify all items in this checklist. This protocol ensures code quality, runtime stability, and long-term maintainability across all `innomcp` project milestones.

## 1. Code Quality & Compilation
- [ ] **`tsc` Clean:** Execute the TypeScript compiler. The build must yield zero compilation errors, type mismatches, or strict-mode warnings.
- [ ] **Linting:** All static analysis tools pass without unresolved warnings.

## 2. Automated Testing
- [ ] **Tests Pass:** All unit, integration, and end-to-end test suites pass successfully in both the local and CI environments.
- [ ] **Coverage:** New code maintains or improves the existing test coverage threshold.

## 3. Manual Verification
- [ ] **Browser Verified:** The user interface and core workflows have been manually tested in all target browsers.
- [ ] **Console Clean:** The browser developer console is free of unhandled exceptions, memory leaks, and unexpected network failures.

## 4. Documentation
- [ ] **Docs Updated:** The README, architectural decision records, and external API documentation accurately reflect the newly introduced changes and deprecated features.
- [ ] **Code Comments:** Complex business logic includes updated, clear inline documentation.

## 5. Version Control & Handoff
- [ ] **Commit Message Format:** Every commit strictly adheres to the Conventional Commits standard (e.g., `feat(scope): description`), featuring clear subjects and detailed bodies where necessary.
- [ ] **Branch Hygiene:** The working branch is fully rebased against the latest `main` branch with zero merge conflicts.

**Developer Sign-off:**
Checking these boxes confirms the phase is fully production-ready and prepared for formal peer review.
