---
name: ollama-model-must-match-local-inventory
description: OLLAMA_MODEL must reference a model that exists in `ollama list`; OLLAMA_HOST must point to the actual Ollama endpoint. Mismatch causes all MDES agents to fail with "fetch failed".
date: 2026-06-07
source: rrr: innomcp
concepts: [ollama, mdes, config, model-availability, fetch-failed]
---

# OLLAMA Config Must Match Local Model Inventory

The #1 cause of MDES agent "fetch failed" errors is a model name in `.env` that doesn't exist in `ollama list`. The second cause is `OLLAMA_HOST` pointing to a stale IP.

**Rule**: Before debugging any agent dispatch failure, run `ollama list` and compare against `OLLAMA_MODEL` and `AGENT_MODEL_MDES` values. If the model isn't listed, it can't be called.

**Evidence**: `gemma3:4b` was configured but not installed locally → all local MDES agents failed → planning-broad fell back to generic answers. Switching to `qwen2.5-coder:7b` (which exists) fixed the entire multi-agent chain.

**Also**: `OLLAMA_HOST=http://172.22.64.1:11434` (WSL IP) was stale; `localhost:11434` works because Docker Desktop forwards ports natively.

See [[project_known_issues]] for SQL injection and other known issues.