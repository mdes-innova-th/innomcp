<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: FINAL-3 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":219,"completion_tokens":871,"total_tokens":1090,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 200s
 generated: 2026-06-13T05:32:44.677Z -->
# LESSONS-LEARNED-MEGA100

*Engineering lessons from the MEGA-100 incident for any team doing LLM-powered bulk code generation.*

## Background

The MEGA-100 incident began when a single prompt — "generate 100 service modules matching this pattern" — was sent to an LLM agent with no per-file review, no type checking, and no commit isolation. The agent produced plausible-looking code, but 73 of 100 files contained silent defects: a shared imported helper had been monkey-patched mid-stream, imports were hallucinated, and exception handlers silently swallowed errors. Nothing failed loudly. Everything compiled. It shipped to staging, where it caused a 14-hour outage.

## Lesson 1: Never Generate Without Type- or Test-Gated Checkpoints

**Before:** Prompt → "produce 100 files" → write all → commit all.
**After:** Prompt → produce file 1 → run typecheck + a smoke test → commit → produce file 2 → …

Bulk generation is a *batch* process, and batches need per-item gates. Treat each generated file as an untrusted contribution from a junior who occasionally hallucinates. We now enforce a hard rule: no file may be persisted unless `tsc --noEmit` (or the language equivalent) and one targeted test pass for that file.

## Lesson 2: Pin and Verify Every Import, Especially Shared Helpers

**Before:** The agent wrote `import { fmtDate } from "./utils"` for all 100 files, then redefined `fmtDate` in 8 of them to satisfy a local edge case. Other files now imported the wrong version.
**After:** Run a post-generation import audit: every imported symbol must be exported by the target module. Fail the batch if any import is unresolvable or if a helper is redefined in more than one place. Codify this in CI, not in the prompt — prompts are not enforcement.

This was the root cause of 40 of the 73 defects. Hallucinated import paths are the single most common LLM failure mode in code generation, and the only reliable defense is a deterministic checker.

## Lesson 3: Forbid Bare `except:` and `catch {}` in Generated Code

**Before:** 19 of 100 files contained `try { ... } catch (e) {}` because the model had learned to "be safe." These silently masked every downstream error and made the outage nearly undiagnosable.
**After:** Add a static lint rule: empty catch bodies are a build failure. Generated code must either rethrow, log to a structured logger, or return a typed error. Silence is never acceptable in a path the agent authored, because we have no human who read it.

The deeper lesson: *defaults that feel defensive become anti-defensive at scale.* One swallowed exception is a bug; a hundred are a system.

## Lesson 4: Isolate Each Generation in Its Own Commit and Rollback Unit

**Before:** A single mega-commit contained all 100 files. Reverting meant reverting 40 unrelated changes. Bisection was impossible.
**After:** One commit per generated unit (file, or small logical group), each with a message linking back to the prompt and seed. This makes blame meaningful, rollback surgical, and post-incident review possible. It also forces the pipeline to make per-unit success an explicit decision point.

## Lesson 5: Cap Blast Radius, Not Just Token Count

**Before:** "100 files" was a single unbounded task. The agent was free to make architectural decisions (shared utility mutation, error-handling conventions) that compounded across the set.
**After:** Cap the *scope* of any single generation run: at most ~10 files, with a pre-declared interface contract and a pre-declared error-handling policy the agent must follow. Larger refactors are composed from multiple smaller, contract-bounded runs. Token limits protect your bill; scope limits protect your architecture.

## Closing Principle

LLM bulk generation is not a single act of authorship — it is a *manufacturing process*. Apply manufacturing discipline: per-unit inspection, statistical checks, traceability, and capped batch size. The model is fast; your review surface must stay small enough to remain trustworthy.
