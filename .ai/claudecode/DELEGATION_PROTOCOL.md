# Claude ↔ ClaudeCode Delegation Protocol

## Overview

```
Claude      = Brain (GitHub Copilot) — PM, orchestrator
ClaudeCode  = Deep Analyst (kimi-k2.5:cloud via claude CLI) — FREE TIER FIRST
Hermes      = Fast Executor (qwen2.5-coder:7b via local Ollama)
Channel A   = mcp_innovabot_ask_local_ai (Hermes/qwen)
Channel B   = claude -p --model kimi-k2.5:cloud (ClaudeCode/kimi)
```

**Model tiers:**
| Agent | Model | Cost | Channel |
|-------|-------|------|---------|
| ClaudeCode (test) | `kimi-k2.5:cloud` | 🟢 Free/cheap | `claude -p` |
| ClaudeCode (prod) | `opus[1m]` / Opus 4.7 | 🔴 Paid Team | `claude -p` |
| Hermes | `qwen2.5-coder:7b` | 🟢 Free local | `ask_local_ai` |

**When to use ClaudeCode vs Hermes:**

| Use ClaudeCode (kimi-k2.5:cloud)          | Use Hermes (qwen2.5-coder:7b)               |
|-------------------------------------------|---------------------------------------------|
| Architecture decisions                    | Write a function/file                       |
| Complex multi-file refactoring            | Fix a bug with clear cause                  |
| Security audit                            | Add a route / endpoint                      |
| API contract design                       | Write unit tests                            |
| Thai NLP domain logic analysis            | Simple data transformation                  |
| Ambiguous requirements needing reasoning  | Clear-cut feature addition                  |

---

## How It Works

### Step 1 — User Intent Arrives at Claude
User message → Claude reads + decides: Hermes (fast) or ClaudeCode (complex)?

### Step 2 — Claude Structures CLAUDECODE_TASK
```
CLAUDECODE_TASK:
  type: arch_review | refactor | security_audit | api_design | analysis
  files_to_review: [path1, path2]
  requirement: <what needs to happen>
  constraints: <must not change X, must follow Y pattern>
  context: <relevant existing code / business rules>
  output_format: full_file | analysis_only | decision_tree | patch
  priority: p0 | p1 | p2
  ask_for_tradeoffs: true | false
```

### Step 3A — Claude sends via ClaudeCode (claude CLI — kimi)
```powershell
# Via run_in_terminal (SA agent can call this directly):
claude -p --model kimi-k2.5:cloud --dangerously-skip-permissions `
  --system-prompt "[CLAUDECODE SYSTEM PROMPT]" `
  "CLAUDECODE_TASK: ..."

# Via delegation wrapper:
& "C:\Users\USER-NT\DEV\innomcp\scripts\hermes-delegate.ps1" `
  -Task "CLAUDECODE_TASK: ..." `
  -Model "kimi-k2.5:cloud"

# Via innova-bot ask_local_ai (when ASK_LOCAL_AI_CMD is set in .env):
mcp_innovabot_ask_local_ai(
  model="kimi-k2.5:cloud",
  system="[CLAUDECODE SYSTEM PROMPT]",
  prompt="CLAUDECODE_TASK: ..."
)
```

### Auth requirement
```powershell
# ONE-TIME setup — set in terminal or $PROFILE:
$env:ANTHROPIC_API_KEY = "your-kimi-or-anthropic-key"
# OR run: set-claudecode-kimi (from scripts/agent-profile.ps1)
```

### Step 3B — Claude sends via Hermes (ask_local_ai — qwen)
```python
mcp_innovabot_ask_local_ai(
  model="qwen2.5-coder:7b",
  system="[HERMES SYSTEM PROMPT]",
  prompt="HERMES_TASK: ...",
  max_tokens=4000,
  temperature=0.1
)
```

### Step 4 — ClaudeCode / Hermes Executes
ClaudeCode returns one of:
- **Full file** — if output_format=full_file
- **Analysis** — problem breakdown, root cause, recommended solution
- **Decision tree** — multiple approach options with trade-offs
- **Patch** — targeted changes with explanation

### Step 5 — Claude Reviews
- If output is code → verify correctness → apply via replace_string_in_file / create_file
- If output is analysis → incorporate into plan → proceed with Hermes or directly
- If fundamentally off → Claude takes over directly (1 retry max)

### Step 6 — Report to User
Claude summarizes outcome in 2-3 sentences.

---

## CLAUDECODE SYSTEM PROMPT TEMPLATE

```
You are ClaudeCode — architecture and analysis agent for the innomcp project.
Claude (GitHub Copilot) is your orchestration brain.

STACK: TypeScript, Node.js, Express, Next.js 15, MariaDB
PROJECT: innomcp — Thai AI assistant platform (78% complete)

RULES:
1. Output FULL file contents when writing code — no snippets, no "...existing code..."
2. For architecture tasks — reason first, then recommend, then code
3. State trade-offs for every design decision
4. Flag ALL breaking changes and security risks explicitly
5. Follow existing patterns — do not redesign without explicit request
6. Be thorough in analysis, surgical in code changes

OUTPUT FORMAT:
- Architecture analysis: CLAUDECODE_ANALYSIS → ... → CLAUDECODE_DONE
- Code output: // FILE: path/to/file.ts → [full content] → CLAUDECODE_DONE
- Decision: CLAUDECODE_DECISION → [options with trade-offs] → CLAUDECODE_DONE

DELIVER: Always end with CLAUDECODE_DONE
```

---

## Quick Reference

### Invoke ClaudeCode for arch review:
```
mcp_innovabot_ask_local_ai(
  model="kimi-k2.5:cloud",
  system="You are ClaudeCode — architecture and analysis agent...[see template above]",
  prompt="CLAUDECODE_TASK: type=arch_review, files=[src/routes/api/chat.ts], requirement=Review routing performance, output_format=analysis_only"
)
```

### Invoke Hermes for fast coding:
```
mcp_innovabot_ask_local_ai(
  model="qwen2.5-coder:7b",
  system="You are Hermes — coding executor...[see hermes/DELEGATION_PROTOCOL.md]",
  prompt="HERMES_TASK: requirement=Add Thai holiday detection to temporalParser, output_format=full_file"
)
```
