<!-- cc-team deliverable
 group: P5B (Phase 5.3 â€” Wave policy doc + overall recovery summary)
 member: P5B-3 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":104,"completion_tokens":645,"total_tokens":749,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":191,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-12T03:47:01.432Z -->
```markdown
# Phase 5 Exit Criteria Verification

This document defines the mandatory checks to confirm that Phase 5 gates are operational and the project meets the required standards.

## 1. Fence Hook Test

- **Action**: Create a file whose first line is exactly three backticks (```` ``` ````).  
  Example:  
  `echo '```' > test_fence.md`
- **Attempt to commit**: `git add test_fence.md && git commit -m "test fence"`
- **Expected result**: The commit is **rejected** by the pre-commit hook with a clear error message indicating that files starting with a code fence are not allowed.

## 2. TypeScript Compiler Gate (tsc gate) Test

- **Action**: Introduce a deliberate type error in any `.ts` file under `src/`.  
  Example: change `const x: number = 5;` to `const x: string = 5;` and save.
- **Attempt to commit**: `git add src/ && git commit -m "test tsc gate"`
- **Expected result**: The commit is **rejected** by the pre-commit hook, with error output from `tsc` showing the type error.

## 3. WAVE-POLICY.md Existence and Structure

- **Check**: File `WAVE-POLICY.md` exists in the repository root.
- **Check**: It contains **at least 5 distinct sections** (Markdown headings – `#`, `##`, etc.).  
  Count may be verified with:  
  `grep -c '^##' WAVE-POLICY.md` or `grep -c '^#' WAVE-POLICY.md`.
- **Expected result**: File present and section count >= 5.

## 4. Recovery Hook Test Script

- **Action**: Execute the recovery test script:  
  `bash tests/recovery/P5A-hook-test.sh`
- **Expected result**: Script exits with status 0 and prints `PASS` (or equivalent success message).

---

**All four criteria must be satisfied before Phase 5 can be considered complete.**
```
