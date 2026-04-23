# Claude ↔ Hermes Delegation Protocol

## Overview

```
Claude = Brain (GitHub Copilot)
Hermes = Hands (qwen2.5-coder:7b via Ollama local)
Channel = mcp_innovabot_ask_local_ai
```

Claude orchestrates. Hermes implements. User saves tokens.

---

## How It Works

### Step 1 — User Intent Arrives at Claude
User message → Claude reads + decomposes into task spec

### Step 2 — Claude Structures HERMES_TASK
Claude creates a structured prompt:
```
HERMES_TASK:
  files_to_edit: [path1, path2]
  requirement: <what needs to happen>
  constraints: <must not change X, must follow Y pattern>
  context: <relevant existing code snippet>
  output_format: full_file | patch | function_only
  priority: p0 | p1 | p2
```

### Step 3 — Claude Sends to Hermes
```python
# Claude calls this tool:
mcp_innovabot_ask_local_ai(
  model="qwen2.5-coder:7b",
  system="[HERMES SYSTEM PROMPT — see hermes.role.md + relevant skills]",
  prompt="HERMES_TASK: ...",
  max_tokens=4000,
  temperature=0.1  # low temp for code
)
```

### Step 4 — Hermes Executes
Hermes returns full file contents or patch.

### Step 5 — Claude Reviews
Claude reads Hermes output:
- If correct → applies the code (uses replace_string_in_file or create_file)
- If needs fix → sends correction back to Hermes (1 retry max)
- If fundamentally wrong → Claude takes over

### Step 6 — Report to User
Claude summarizes what was done in 2-3 sentences.

---

## HERMES SYSTEM PROMPT TEMPLATE

```
You are Hermes — coding executor for the innomcp project.
Claude (GitHub Copilot) is your orchestration brain.

STACK: TypeScript, Node.js, Express, ts-node
PROJECT: innomcp (Thai AI assistant platform)

RULES:
1. Output FULL file contents — no snippets, no "...existing code..."
2. Follow existing architecture EXACTLY  
3. No new features unless explicitly requested
4. Minimal changes — surgical edits only
5. Comment any security or breaking change risk

SKILLS ACTIVE: TypeScript, innomcp Architecture, Thai Query Routing, MCP Tool Pattern, Testing Patterns

DELIVER:
- File path on first line: `// FILE: path/to/file.ts`
- Then full file content
- Then: HERMES_DONE
```

---

## Task Priority Levels

| Priority | Meaning | Example |
|----------|---------|---------|
| P0 | Blocker — fix NOW | Production error, test failure |
| P1 | High — next task | Feature incomplete, integration needed |
| P2 | Normal — planned | Enhancement, refactor |
| P3 | Low — when free | Docs, cleanup |

---

## Auto-Delegation Rules (Claude decides when to use Hermes)

| Task Type | Use Hermes? | Reason |
|-----------|-------------|--------|
| Write full file from scratch | ✅ Yes | Hermes is fast at this |
| Fix a specific bug | ✅ Yes | Give context + file |
| Add test cases | ✅ Yes | Pattern-based work |
| Architectural decision | ❌ Claude | Needs reasoning |
| Security review | ❌ Claude | Needs judgment |
| Planning/decomposition | ❌ Claude | Needs user intent parsing |
| Code review | ❌ Claude | Needs quality judgment |
| Simple 1-line fix | ❌ Claude | Overhead not worth it |

---

## Communication Log

All Claude↔Hermes exchanges are logged in:
`.ai/hermes/conversation_log.jsonl`

Format:
```json
{"ts":"2026-04-23T10:00:00Z","from":"claude","to":"hermes","task":"...","tokens_sent":200}
{"ts":"2026-04-23T10:00:05Z","from":"hermes","to":"claude","result":"done","tokens_received":800}
```

---

## Token Efficiency Estimates

| Approach | Estimated Tokens | Cost |
|----------|-----------------|------|
| Claude does everything | 2000-8000/task | High |
| Claude plans → Hermes executes | 800-1500/task | Low (Hermes is free) |
| **Savings per session** | **~60-70%** | **Free local compute** |
