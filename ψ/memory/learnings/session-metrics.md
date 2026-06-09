# Oracle Session Metrics

Rule (parent CLAUDE.md §"Self-Evaluation Loop"): same friction 3 sessions → fix root cause, not another workaround.

| when | session | done | stuck | win | friction | error |
|---|---|---|---|---|---|---|
| 2026-06-07 21:02 | unknown | P0-1 DB/Redis, P0-2 OLLAMA config, push 3 commits | release gate timed out | planning-broad 11-agent dispatch working after OLLAMA config fix | curl UTF-8 unreliable on Windows for Thai text testing | spent 15min on Thai encoding hypothesis before checking ollama list |
| 2026-06-07 22:03 | c517c48c | git-add hygiene commit (0f9a682, 455 files), origin/main state diagnosis | push (designer P0 + origin/main gone — out of scope) | caught real OLLAMA_API_KEY in .env before staging, no secrets leaked | CRLF warnings spam from git add -A on Windows | led recap with "316 ahead of main" overstating real push state; should have led with "origin/main deleted" |
