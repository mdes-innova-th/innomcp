# INNOMCP Agent Orchestration Overview

> This document is loaded into the runtime RAG (`ColdRetriever`) and may surface in user-facing answers when relevant.

## What is the INNOMCP agent system?

INNOMCP is operated by an orchestrator (Claude, the conversation you are talking to) plus 10 specialized sub-agents that handle different aspects of the work. Each agent has a focused role and a model tier appropriate to its task complexity.

## The 10 specialists

- **innomcp-dev** — implements code changes across the 3-service stack
- **innomcp-planner** — produces phased TODO plans with risks and rollback paths
- **innomcp-designer** — owns UI/UX polish and the design skill family (adapt, animate, polish, etc.)
- **innomcp-tester** — runs the release gate (59/59 full system + 61/61 browser signoff) and triages failures
- **innomcp-reviewer** — reviews code for correctness, security, and project-rule adherence before commit
- **innomcp-system-analyst** — designs architecture, writes ADRs, plans schema changes
- **innomcp-program-analyst** — measures the codebase: hotspots, complexity, dead code, coverage
- **innomcp-search** — fast lookup specialist; returns file:line citations only
- **innomcp-connector** — owns integrations to external APIs: TMD, NWP, Detect DB, OpenWeather, Anthropic, Ollama, Image Gen Gateway
- **innomcp-hermes** — the messenger; persists outcomes to memory and RAG, retrieves prior context

## How they collaborate

A typical multi-step task flows from `planner` → `system-analyst` → `dev` → `connector` (if external API) → `tester` → `reviewer` → `hermes`. Single-question tasks go straight to `search`. The orchestrator decides which path applies based on task shape.

## Where to find more

- Agent definitions: `.claude/agents/<agent-name>.md`
- Orchestration README: `.claude/agents/README.md`
- Canonical worklist: `docs/reports/MASTER_REVIEW.md`
- Release gate reference: `docs/reports/phase10_release_gate.md`

## Why this matters for users

The system is Thai-first and operates under a strict release gate. Every change touches the same persistent memory + worklist, so the platform's behavior remains consistent across sessions and across team members.
