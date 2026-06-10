#!/usr/bin/env node
/**
 * cc_mega_swarm.js — CommandCode 50-task Mega Swarm
 * ยิง 50+ งานพร้อมกันไปที่ CommandCode API (deepseek-v4-pro: 4x stretch!)
 * ครอบคลุม: Jit | innova-bot | innomcp
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CC_KEY = 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE = 'https://api.commandcode.ai/provider/v1';
const PRO = 'deepseek/deepseek-v4-pro';   // 4x credit stretch
const FAST = 'deepseek/deepseek-v4-flash'; // quick tasks

const JIT     = 'C:/Users/USER-NT/Jit';
const INNOMCP = 'C:/Users/USER-NT/DEV/innomcp';
const INNOVA  = 'C:/Users/USER-NT/DEV/innova-bot-template';
const MAW     = 'C:/Users/USER-NT/DEV/maw-js';

function slurp(fp, maxChars = 4000) {
  try { return fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '').slice(0, maxChars); }
  catch { return `[NOT FOUND: ${fp}]`; }
}
function slurpDir(dp, ext = '.ts', max = 20) {
  try {
    const files = fs.readdirSync(dp).filter(f => f.endsWith(ext)).slice(0, max);
    return files.map(f => `${f}:\n${slurp(path.join(dp, f), 800)}`).join('\n---\n');
  } catch { return `[DIR NOT FOUND: ${dp}]`; }
}

async function cc(taskId, model, systemPrompt, userMsg, maxTokens = 3000) {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${CC_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
        temperature: 0.2,
        stream: false
      }),
      signal: AbortSignal.timeout(180000)
    });
    const j = await resp.json();
    const ms = Date.now() - t0;
    const reply = j.choices?.[0]?.message?.content || '';
    const tokens = j.usage?.total_tokens || 0;
    if (!reply) return { taskId, ok: false, ms, tokens, error: JSON.stringify(j).slice(0, 200) };
    return { taskId, ok: true, ms, tokens, reply };
  } catch(e) {
    return { taskId, ok: false, ms: Date.now()-t0, tokens: 0, error: e.message };
  }
}

// =============================================
// CONTEXT SNAPSHOT (อ่านก่อน spawn)
// =============================================
const CTX = {
  dockerCompose:     slurp(`${INNOMCP}/docker-compose.yml`),
  parallelDispatch:  slurp(`${INNOMCP}/innomcp-node/src/agents/parallelDispatch.ts`),
  conductor:         slurp(`${INNOMCP}/innomcp-node/src/agents/conductor.ts`),
  motherDispatch:    slurp(`${INNOMCP}/innomcp-node/src/agents/motherDispatch.ts`, 3000),
  jwtTs:             slurp(`${INNOMCP}/innomcp-node/src/utils/jwt.ts`),
  providerRegistry:  slurp(`${INNOMCP}/innomcp-node/src/providers/registry.ts`, 2000),
  consciousness:     slurp(`${JIT}/consciousness.yaml`),
  hermesJson:        slurp(`${JIT}/hermes.json`),
  jitRemotes:        slurp(`${JIT}/.jit-remotes.json`),
  progressMd:        slurp(`${JIT}/progress.md`, 3000),
  skillRegistry:     slurp(`${INNOVA}/skill_registry.yaml`),
  continueHere:      slurp(`${INNOVA}/.continue-here.md`, 3000),
  envInnova:         slurp(`${INNOVA}/.env`, 1000),
  antiGravityProbe:  slurp(`${JIT}/eval/antigravity-probe.js`, 2000),
  appTs:             slurp(`${INNOMCP}/innomcp-node/src/app.ts`, 2000),
  indexTs:           slurp(`${INNOMCP}/innomcp-node/src/index.ts`, 2000),
  weatherRoute:      slurp(`${INNOMCP}/innomcp-node/src/routes/api/weather.ts`, 2000) ||
                     slurp(`${INNOMCP}/innomcp-node/src/routes/api/nwp.ts`, 2000),
  motherConfig:      slurp(`${INNOMCP}/innomcp-node/src/routes/api/motherConfig.ts`, 2000),
  smokeScript:       slurp(`${INNOMCP}/status-check.ps1`, 2000),
  webd:              slurpDir(`${INNOMCP}/webd-api/src`, '.ts', 10),
  detectEvidence:    slurpDir(`${INNOMCP}/detect-evidence-api/src`, '.ts', 10),
  organs:            slurp(`${JIT}/organs/heart.sh`) + '\n' + slurp(`${JIT}/organs/nerve.sh`),
  todoSa:            slurp(`${INNOVA}/TODO-SA.md`, 3000),
};

console.log('\n💥 CC MEGA SWARM — 50 tasks launching NOW...');
console.log(`📡 Provider: deepseek-v4-pro (4x stretch) + deepseek-v4-flash`);
console.log(`📋 Context loaded: ${Object.keys(CTX).length} files\n`);

// =============================================
// 50 TASKS DEFINITION
// =============================================
const TASKS = [

// =================== JIT ZONE (15 tasks) ===================

{ id:'JIT-01', model:PRO, max:3500,
  sys:'You are a senior DevOps/Node.js engineer. Output actionable fixes only.',
  msg:`FIX: antigravity-probe.js crashes with BOM/JSON parse error.
Error: SyntaxError: Unexpected token '﻿' at JSON.parse
File: ${CTX.antiGravityProbe}
Provide: 1) Exact line causing BOM issue 2) Fixed readJson function that strips BOM 3) Full corrected code block` },

{ id:'JIT-02', model:PRO, max:3000,
  sys:'You are a distributed systems expert. Give concrete PowerShell and Node.js commands.',
  msg:`FIX: Hermes message bus has 25 STUCK messages since 2026-05-26 (2 weeks stale).
hermes.json: ${CTX.hermesJson}
.jit-remotes.json: ${CTX.jitRemotes}
Bus root: C:/tmp/manusat-bus/, legacy inbox: C:/Users/USER-NT/Jit/network/inbox/jit/ (31 json files)
Provide: 1) Why messages are stuck 2) PowerShell commands to drain queue 3) How to restart Hermes consumer process 4) How to prevent future stale queue` },

{ id:'JIT-03', model:FAST, max:2000,
  sys:'You are a shell script expert. Give exact bash/sh improvements.',
  msg:`IMPROVE: Jit organs are all shell scripts. Current organs:\nheart.sh:\n${CTX.organs}
Propose: 1) Add health check return codes 2) Add logging format 3) Add timeout handling 4) Improved heart.sh that integrates with maw bus` },

{ id:'JIT-04', model:PRO, max:3000,
  sys:'You are an AI consciousness/agent architect.',
  msg:`ANALYZE + FIX: consciousness.yaml defines innova agent but Oracle is unreachable.
consciousness.yaml:\n${CTX.consciousness}
Issues: oracle URL http://localhost:47778 (not running), maw locate times out for all agents
Provide: 1) Fixed consciousness.yaml with fallback paths 2) How to start Oracle on port 47778 3) How maw should register this agent` },

{ id:'JIT-05', model:FAST, max:2000,
  sys:'You are a Node.js eval test engineer.',
  msg:`WRITE: A new Jit eval script 'eval/cc-swarm-health.js' that:
1. Tests CommandCode API at https://api.commandcode.ai/provider/v1
2. Tests MDES Ollama at https://ollama.mdes-innova.online
3. Tests innova-bot MCP at http://localhost:7010/mcp/health
4. Tests Oracle at http://localhost:47778/api/health
5. Outputs a status table
Use dotenv, no external deps beyond axios or node fetch. Full working code.` },

{ id:'JIT-06', model:PRO, max:3000,
  sys:'You are a multi-agent system architect specializing in message routing.',
  msg:`DESIGN: Jit has 44 agents in bus. 13 agents have pending=3 (stuck): chamu, karn, lak, neta, netra, pada, pran, rupa, sayanprasathan, soma, vaja.
progress.md snippet:\n${CTX.progressMd.slice(0,2000)}
Design: 1) Agent roster file format (YAML/JSON) for all 44 agents 2) Which agents are real vs placeholder 3) Bus consumer architecture 4) PowerShell script to list all agent inbox files` },

{ id:'JIT-07', model:FAST, max:2000,
  sys:'You are a process management expert on Windows.',
  msg:`WRITE: PowerShell script 'scripts/restart-bus-consumer.ps1' that:
1. Finds and kills any existing maw/hermes process
2. Starts maw listener for jit inbox at C:/tmp/manusat-bus/jit/
3. Monitors for new messages every 30 seconds
4. Logs to C:/Users/USER-NT/Jit/logs/bus-consumer.log
5. Sends status to innova-bot-template/.innova/hermes-jit/inbox/
Full working PowerShell script.` },

{ id:'JIT-08', model:PRO, max:3000,
  sys:'You are a senior TypeScript architect reviewing a model routing system.',
  msg:`IMPROVE: Jit model-validate.js fails because:
1. Copilot CLI → wrong quote format
2. GPT-5.5 → FAIL verdict
progressMd: ${CTX.progressMd.slice(0,1500)}
Provide: 1) Fix for Copilot CLI quoting (exact command) 2) Why GPT-5.5 might fail model validation 3) Suggested --skip-copilot flag in model-validate.js` },

{ id:'JIT-09', model:FAST, max:2000,
  sys:'You are a CI/CD and testing expert.',
  msg:`CREATE: eval/jit-smoke-full.js - A comprehensive smoke test that:
1. Checks all 4 providers (CC, MDES, ThaiLLM, Ollama)
2. Sends a Thai language test message to each
3. Verifies response is in Thai
4. Checks maw bus connectivity
5. Outputs pass/fail table with latencies
Full working Node.js code using only built-in fetch + fs.` },

{ id:'JIT-10', model:PRO, max:2500,
  msg:`GENERATE: Complete TODO list for Jit project based on:
${CTX.progressMd}
Output format: Markdown checklist grouped by: P0-Critical, P1-High, P2-Medium, P3-Low
Be specific with file names and exact actions needed.`,
  sys:'You are a senior project manager for AI systems.' },

{ id:'JIT-11', model:FAST, max:2000,
  sys:'You are a YAML configuration expert.',
  msg:`IMPROVE: Jit consciousness.yaml is missing critical sections.
Current:\n${CTX.consciousness}
Add these missing sections:
1. commandcode provider config
2. agent_bus registration info
3. maw locate hints
4. fallback_providers list
5. health_endpoints section
Output full improved consciousness.yaml` },

{ id:'JIT-12', model:PRO, max:3000,
  sys:'You are a maw-js expert and distributed agent systems engineer.',
  msg:`FIX: maw locate times out (60s) for all 3 agents: jit, innomcp, innova-bot-template.
.jit-remotes.json: ${CTX.jitRemotes}
Maw src structure has: src/commands/, src/config.ts, src/api/federation.ts
If federation.ts exists, it likely handles locate.
Provide:
1) What 'maw locate' does (federated lookup or local registry scan?)
2) What files/config it needs to find an agent
3) Exact fix: PowerShell commands to register all 3 agents
4) Write a 'register-agents.ps1' script` },

{ id:'JIT-13', model:FAST, max:1500,
  sys:'You are a Node.js expert.',
  msg:`CREATE: eval/health-dashboard.js - Real-time dashboard that:
1. Shows colored status for: Oracle, MAW, Hermes, Redis, MariaDB, CommandCode, MDES
2. Auto-refreshes every 10 seconds
3. Shows last check time and latency
4. Alerts if any service is down
Output full working code (no external deps beyond node built-ins).` },

{ id:'JIT-14', model:PRO, max:3000,
  sys:'You are a senior DevOps engineer specializing in multi-agent systems.',
  msg:`ARCHITECT: Create a complete startup sequence for the Jit ecosystem:
1. Order: Redis → MariaDB → innomcp-api → innomcp-web → Oracle → maw → Hermes
2. Health check between each step
3. PowerShell master startup script 'scripts/start-all.ps1'
4. Rollback on failure
5. Status report at end
Full working PowerShell script with error handling.` },

{ id:'JIT-15', model:FAST, max:2000,
  sys:'You are a documentation writer for AI agent systems.',
  msg:`WRITE: Concise AGENTS.md update for Jit that covers:
1. Current agent roster (44 agents in bus)
2. CommandCode integration status
3. maw locate issue and workaround
4. How to add a new agent to the bus
5. Startup sequence
Output clean markdown.` },

// =================== INNOMCP ZONE (20 tasks) ===================

{ id:'INN-01', model:PRO, max:4000,
  sys:'You are a Docker/Docker Compose expert. Output only the complete fixed file.',
  msg:`FIX docker-compose.yml. Current version:\n${CTX.dockerCompose}\n
Required changes:
1. Add to api service environment: CODEX_API_KEY, COMMANDCODE_BASE_URL=https://api.commandcode.ai/provider/v1, JWT_SECRET
2. Add restart: unless-stopped to all services
3. Add redis service with restart policy and healthcheck
4. Map api port 3015:3011 (smoke tests use 3015)
5. Add PARALLEL_AGENTS=1 to api environment
Output ONLY the complete corrected docker-compose.yml` },

{ id:'INN-02', model:PRO, max:3000,
  sys:'You are a security engineer and TypeScript expert.',
  msg:`FIX JWT security in innomcp.
jwt.ts:\n${CTX.jwtTs}\n
Fixes needed:
1. Add startup guard: if JWT_SECRET is default or < 32 chars, throw Error and exit
2. Add scope field to JWTPayload interface: scope?: string[]
3. Update generateAccessToken to accept scope parameter
4. Add requireScope middleware function
Output: 1) Updated JWTPayload interface 2) Startup guard code 3) generateAccessToken with scope 4) requireScope middleware` },

{ id:'INN-03', model:FAST, max:2000,
  sys:'You are a Node.js/Express expert.',
  msg:`FIX: Smoke tests hit localhost:3015 but API is on 3011.
status-check.ps1:\n${CTX.smokeScript.slice(0,1000)}
Provide:
1) Updated PowerShell one-liner to fix port in smoke tests
2) Updated docker-compose port mapping (3015:3011)
3) Curl commands to test all 6 smoke endpoints manually` },

{ id:'INN-04', model:PRO, max:3500,
  sys:'You are a multi-agent orchestration expert.',
  msg:`IMPROVE: parallelDispatch.ts - currently dispatches to MDES agents.
${CTX.parallelDispatch.slice(0,3000)}
Improvements needed:
1. Add CommandCode (deepseek-v4-pro) as an additional dispatch target
2. Add retry logic on provider failure
3. Add cost tracking per dispatch
4. Ensure graceful fallback: CC → MDES → ThaiLLM → Ollama
Output the improved parallelDispatch.ts` },

{ id:'INN-05', model:PRO, max:3500,
  sys:'You are a conductor/orchestrator expert for AI systems.',
  msg:`IMPROVE: conductor.ts - orchestrates agent routing.
${CTX.conductor.slice(0,3000)}
Improvements needed:
1. Add CommandCode provider routing case
2. Add 'greeting' intent fast path check
3. Add metrics: response time per provider
4. Add circuit breaker: skip provider if 3 consecutive failures
Output improved conductor.ts` },

{ id:'INN-06', model:PRO, max:3000,
  sys:'You are a weather API and JWT expert.',
  msg:`FIX: NWP (National Weather Provider) fails - CN1, CN2 tests fail with NWP_UNAVAILABLE.
weatherRoute:\n${CTX.weatherRoute}
JWT payload: { userId, userEmail, userRoleId, userDispName, jti }
Fix:
1) Add scope:['weather:read'] to JWT when user logs in
2) Add scope check in weather route middleware
3) If no scope, return graceful 403 with message
4) Update test to include scope in JWT
Output: 1) JWT change 2) Weather middleware fix 3) Test JWT generation` },

{ id:'INN-07', model:FAST, max:2000,
  sys:'You are a Docker expert.',
  msg:`WRITE: docker-compose.override.yml for development that:
1. Mounts innomcp-node/src for hot reload
2. Sets NODE_ENV=development
3. Adds all secret env vars (CODEX_API_KEY, JWT_SECRET, OLLAMA_API_KEY)
4. Adds Redis with persistence
5. Maps additional debug ports
Output complete override file.` },

{ id:'INN-08', model:PRO, max:3000,
  sys:'You are a full-stack architect analyzing a multi-service system.',
  msg:`ANALYZE: webd-api directory.
${CTX.webd}
And detect-evidence-api:
${CTX.detectEvidence}
Provide:
1) What each service does
2) How they relate to innomcp-node and innomcp-next
3) Are they ARRA Office components?
4) Should they be in docker-compose.yml?
5) Recommended integration architecture` },

{ id:'INN-09', model:PRO, max:3500,
  sys:'You are a Node.js/Express performance expert.',
  msg:`IMPROVE: motherDispatch.ts - main agent dispatch loop.
${CTX.motherDispatch}
Improvements:
1. Add CommandCode as dispatch target with model selection
2. Add dispatch queue with priority ordering
3. Add dead letter queue for failed dispatches
4. Add telemetry: tokens, cost, latency per dispatch
5. Output improved motherDispatch.ts` },

{ id:'INN-10', model:FAST, max:2000,
  sys:'You are a startup/init engineer for Node.js services.',
  msg:`WRITE: innomcp-node/src/startup.ts that:
1. Checks JWT_SECRET is set and >= 32 chars (throw if not)
2. Checks DB connectivity (MariaDB)
3. Checks Redis connectivity
4. Warms up CommandCode providers (sends ping)
5. Logs startup checklist with ✅/❌
6. Exported as startupChecks() async function
Full TypeScript code.` },

{ id:'INN-11', model:PRO, max:3000,
  sys:'You are a database expert specializing in MariaDB and TypeORM/Knex.',
  msg:`ANALYZE: innomcp MariaDB setup.
docker-compose:\n${CTX.dockerCompose.slice(0,1000)}
appTs:\n${CTX.appTs}
identify:
1) What ORM/query builder is used (check imports in app.ts/index.ts)
2) Where are migration files?
3) How is DB connection string formed?
4) Write DB health check function in TypeScript
5) Write initial schema migration for core tables` },

{ id:'INN-12', model:FAST, max:2000,
  sys:'You are a Next.js 14/15 expert.',
  msg:`DIAGNOSE: innomcp-next is not running in Docker.
docker-compose web service: builds from ./innomcp-next, port 3000:3000, env NEXT_PUBLIC_BACKEND_URL=http://api:3011
Common Next.js Docker build failures:
1) Missing .env.local
2) API routes failing during build
3) Missing node_modules
Provide:
1) Dockerfile checklist for innomcp-next
2) Commands to build and test locally
3) next.config.js settings for Docker
4) How to debug NEXT_PUBLIC_BACKEND_URL in Docker network` },

{ id:'INN-13', model:PRO, max:3000,
  sys:'You are a provider health monitoring expert.',
  msg:`WRITE: providerHealthCheck.ts improvements.
Current registry has providers: MDES Ollama, Local Ollama, CommandCode (7 models), OpenAI, Claude, DeepSeek, Groq, Together, ThaiLLM.
providerRegistry snippet:\n${CTX.providerRegistry}
Write:
1) Background health check loop (every 5 min)
2) Update healthStatus for each provider
3) Alert if priority provider goes down
4) Fallback chain: CC → MDES → ThaiLLM → Local
5) Full TypeScript code` },

{ id:'INN-14', model:FAST, max:2000,
  sys:'You are a Redis expert.',
  msg:`WRITE: Redis setup guide and TypeScript client for innomcp:
1) docker-compose redis service with persistence (AOF + RDB)
2) TypeScript Redis client module using ioredis
3) Key prefix strategy for innomcp
4) Session storage schema
5) Cache invalidation strategy
6) Fallback to in-memory if Redis down
Full code.` },

{ id:'INN-15', model:PRO, max:3000,
  sys:'You are a full-stack TypeScript engineer.',
  msg:`IMPROVE: app.ts and index.ts startup flow.
app.ts:\n${CTX.appTs}
index.ts:\n${CTX.indexTs}
Improvements:
1) Add startup checklist before listening
2) Add graceful shutdown handler
3) Add CORS configuration for innomcp-next
4) Add request logging middleware
5) Add 404 handler
Output improved index.ts with all additions` },

{ id:'INN-16', model:FAST, max:2000,
  sys:'You are a monitoring and observability expert.',
  msg:`WRITE: eval/innomcp-health.js - health check script for innomcp:
1) Check api at http://localhost:3011/api/health
2) Check web at http://localhost:3000
3) Check Redis at localhost:6379
4) Check MariaDB at localhost:3308
5) Check providers via /api/providers endpoint
6) Output colored terminal report
Full Node.js code.` },

{ id:'INN-17', model:PRO, max:3000,
  sys:'You are a TypeScript API expert.',
  msg:`WRITE: Missing API route for ARRA Office integration.
Based on detect-evidence-api:\n${CTX.detectEvidence.slice(0,1000)}
Create: innomcp-node/src/routes/api/arra.ts that:
1) GET /api/arra/cases - list evidence cases
2) POST /api/arra/analyze - send to AI for analysis
3) GET /api/arra/status - service health
4) Integrates with detect-evidence-api
5) Requires JWT auth
Full TypeScript route code.` },

{ id:'INN-18', model:FAST, max:2000,
  sys:'You are a CI/CD automation expert.',
  msg:`WRITE: scripts/docker-rebuild.ps1 - PowerShell script that:
1) Stops all innomcp containers
2) Removes old images
3) Rebuilds api and web
4) Starts in correct order (mariadb → redis → api → web)
5) Waits for health checks
6) Runs smoke tests
7) Reports final status
Full working PowerShell script.` },

{ id:'INN-19', model:PRO, max:3000,
  sys:'You are a multi-agent AI routing expert.',
  msg:`IMPROVE: motherConfig.ts routing configuration.
motherConfig:\n${CTX.motherConfig}
Improvements:
1) Add CommandCode as routing target with model priorities
2) Add Thai language detection → ThaiLLM priority
3) Add code/technical queries → DeepSeek priority
4) Add complex reasoning → Claude priority
5) Add cost-aware routing (use cheaper models when budget is low)
Output improved motherConfig.ts` },

{ id:'INN-20', model:FAST, max:2000,
  sys:'You are a documentation engineer.',
  msg:`WRITE: INNOMCP_SETUP.md covering:
1) Quick start (3 commands to get running)
2) Environment variables required
3) Docker setup (correct port mappings)
4) Smoke test how-to
5) Provider configuration (MDES, CommandCode, ThaiLLM)
6) Troubleshooting common issues
Clean markdown, practical guide.` },

// =================== INNOVA ZONE (15 tasks) ===================

{ id:'INV-01', model:PRO, max:3000,
  sys:'You are a Python AI scripting expert.',
  msg:`FIX: ASK_LOCAL_AI_CMD is set to: powershell -c "echo 'LIMIT'"
This placeholder returns LIMIT instead of AI responses.
Real script should be: python /workspace/devtools/innova-bot/scripts/ask_ollama_cli.py
skill_registry.yaml:\n${CTX.skillRegistry}
Provide:
1) Correct ASK_LOCAL_AI_CMD value
2) Fix for .env file
3) Test to verify ask_local_ai MCP tool works
4) Fallback: if Ollama not available, use CommandCode API` },

{ id:'INV-02', model:PRO, max:3500,
  sys:'You are an innova-bot MCP server expert.',
  msg:`ANALYZE: innova-bot MCP tool chain issues.
skill_registry.yaml:\n${CTX.skillRegistry}
.continue-here.md:\n${CTX.continueHere}
environment issues:
- ASK_LOCAL_AI_CMD=echo 'LIMIT' (broken)
- ASK_LOCAL_AI_URL=http://localhost:11434 (Ollama may be local only)
Provide:
1) Full list of innova-bot MCP tools and their status
2) Which tools depend on ASK_LOCAL_AI_CMD
3) Fix for all broken tools
4) Update skill_registry.yaml` },

{ id:'INV-03', model:PRO, max:3000,
  sys:'You are a project management AI for software systems.',
  msg:`ANALYZE: .continue-here.md - continuation notes.
${CTX.continueHere}
Extract:
1) What was last working on
2) Immediate next 5 actions needed
3) What's blocking progress
4) What can be done without manual intervention
5) Write an updated .continue-here.md with clearer action items` },

{ id:'INV-04', model:FAST, max:2000,
  sys:'You are a Jarvis/guardian process expert.',
  msg:`ANALYZE: Jarvis runs every 120s (cycle 572+), triggers auto-run-multiagent at cycle 572.
Last log: [MULTI] Triggering auto-run-multiagent (cycle 572)
What is auto-run-multiagent? Design:
1) What it should do
2) How it connects to innomcp API
3) Script to implement auto-run-multiagent properly
4) How to log results back to Jarvis` },

{ id:'INV-05', model:PRO, max:3000,
  sys:'You are a Discord bot and multi-agent system expert.',
  msg:`DESIGN: Hermes Discord bot integration with Jit.
Configuration:
- DISCORD_TOKEN: set
- HERMES_JIT_INBOX: C:/Users/USER-NT/DEV/innova-bot-template/.innova/hermes-jit/inbox
- HERMES_JIT_OUTBOX: C:/Users/USER-NT/DEV/innova-bot-template/.innova/hermes-jit/outbox
Hermes has 25 stuck messages in Jit bus.
Design:
1) How Hermes should process messages from the inbox folder
2) Message format for Jit→Hermes→Discord flow
3) How to drain the 25 stuck messages through Discord
4) PowerShell script to manually inject a test message` },

{ id:'INV-06', model:FAST, max:2000,
  sys:'You are a YAML configuration expert.',
  msg:`IMPROVE: skill_registry.yaml for innova-bot.
${CTX.skillRegistry}
Add missing skills:
1) commandcode_chat - direct CommandCode API skill
2) innomcp_query - query innomcp API
3) jit_inbox_check - check Jit inbox
4) docker_manage - manage Docker containers
5) redis_cache - Redis cache operations
Output complete improved skill_registry.yaml` },

{ id:'INV-07', model:PRO, max:3000,
  sys:'You are a Python scripting and AI integration expert.',
  msg:`WRITE: devtools/innova-bot/scripts/ask_commandcode_cli.py
A Python script that:
1) Accepts prompt from stdin or --prompt arg
2) Calls CommandCode API with deepseek-v4-pro
3) Streams response to stdout
4) Falls back to Ollama if CC fails
5) Has --model flag for model selection
CC Key: user_63Pe... (read from env CC_KEY)
Full Python code using only requests library.` },

{ id:'INV-08', model:FAST, max:2000,
  sys:'You are a monitoring and health check expert.',
  msg:`WRITE: scripts/health-full-check.ps1 - Complete health check for innova system:
1) innova-bot MCP server (localhost:7010)
2) innomcp API (localhost:3011)
3) Oracle (localhost:47778)
4) Redis (localhost:6379)
5) MariaDB (localhost:3308)
6) CommandCode API
7) MDES Ollama
Output colored pass/fail table. Full PowerShell script.` },

{ id:'INV-09', model:PRO, max:3000,
  sys:'You are a skill/tool framework expert for AI agents.',
  msg:`CREATE: New innova-bot skill 'commandcode-direct'.
The skill should:
1) Accept any prompt
2) Route to CommandCode API using deepseek-v4-pro (4x credit stretch)
3) Handle streaming responses
4) Log token usage
5) Return structured response
Write: skills/commandcode-direct/SKILL.md (skill definition) + implementation` },

{ id:'INV-10', model:FAST, max:2000,
  sys:'You are a memory and state management expert.',
  msg:`DESIGN: Innova-bot memory architecture.
Current state: Redis was down, MariaDB available
Design:
1) What should go in Redis (sessions, rate limits, cache)
2) What should go in MariaDB (long-term memory, conversations)
3) What should go in filesystem (agent state, logs)
4) Memory hierarchy: hot (Redis) → warm (MariaDB) → cold (filesystem)
5) TypeScript interfaces for each memory tier` },

{ id:'INV-11', model:PRO, max:3000,
  sys:'You are a DevOps expert for containerized AI systems.',
  msg:`WRITE: docker-compose.innova-bot.yml - Standalone Docker compose for innova-bot:
1) innova-bot service (MCP server on 7010)
2) Redis for session caching
3) Environment: OLLAMA_URL, COMMANDCODE_API_KEY, DISCORD_TOKEN
4) Healthcheck for innova-bot
5) Volume for data persistence
6) Network to connect with innomcp
Full docker-compose.yml` },

{ id:'INV-12', model:FAST, max:2000,
  sys:'You are a TODO management AI.',
  msg:`ANALYZE: TODO-SA.md for innova-bot.
${CTX.todoSa}
Extract and prioritize:
1) P0 items (blocking right now)
2) P1 items (this week)
3) What was 90% done but not completed
4) Quick wins (< 30 min each)
5) Create a clean updated TODO.md` },

{ id:'INV-13', model:PRO, max:3000,
  sys:'You are a Python AI assistant development expert.',
  msg:`WRITE: devtools/innova-bot/scripts/cc_batch_processor.py
A Python script that:
1) Reads tasks from a JSON file (tasks.json)
2) Sends each task to CommandCode API in parallel (asyncio)
3) Model: deepseek/deepseek-v4-pro
4) Saves results to results.json
5) Reports tokens used and cost estimate
6) Max 20 parallel requests
Full asyncio Python code using aiohttp.` },

{ id:'INV-14', model:FAST, max:2000,
  sys:'You are an AI agent workflow designer.',
  msg:`DESIGN: Auto-healing workflow for innova system.
Current issues that repeat:
1) Redis stops → needs docker start
2) Hermes messages get stuck → needs queue drain
3) maw locate timeout → needs agent registration
4) ASK_LOCAL_AI_CMD broken → needs env fix
Design: A Jarvis cycle that automatically:
1) Detects each of these issues
2) Applies the fix
3) Logs the recovery action
4) Reports to Discord via Hermes
Pseudocode + PowerShell implementation.` },

{ id:'INV-15', model:PRO, max:3000,
  sys:'You are the lead architect for Innova-bot system.',
  msg:`WRITE: Comprehensive PHASE_6_PLAN.md covering:
1) What was achieved in Phase 5 (from context)
2) Phase 6 goals: CommandCode full integration, Redis stable, API server running
3) 10 concrete tasks for Phase 6
4) Success criteria for each task
5) Timeline estimate
6) Dependencies between tasks
continueHere:\n${CTX.continueHere.slice(0,2000)}
Output professional markdown.` },

];

console.log(`📊 Total tasks: ${TASKS.length}`);
console.log(`🔥 Launching all in parallel...\n`);

async function runSwarm() {
  const start = Date.now();
  
  // Fire ALL tasks simultaneously
  const promises = TASKS.map(t => cc(t.id, t.model, t.sys, t.msg, t.max));
  
  let done = 0;
  const results = [];
  
  // Process as they complete
  const settled = await Promise.allSettled(promises);
  
  for (const s of settled) {
    const r = s.status === 'fulfilled' ? s.value : { taskId:'?', ok:false, ms:0, tokens:0, error: String(s.reason) };
    results.push(r);
    done++;
    const icon = r.ok ? '✅' : '❌';
    process.stdout.write(`${icon} ${r.taskId} | ${r.ms}ms | ${r.tokens}tok\n`);
    if (r.ok) {
      process.stdout.write(`   └─ ${r.reply.replace(/\n/g,' ').slice(0,120)}...\n\n`);
    } else {
      process.stdout.write(`   └─ ERR: ${r.error}\n\n`);
    }
  }
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const ok = results.filter(r => r.ok).length;
  const totalTok = results.reduce((s,r) => s + (r.tokens||0), 0);
  
  // Save all results
  const ts = Date.now();
  const outDir = 'C:/Users/USER-NT/DEV/innova-bot-template/logs';
  const outFile = `${outDir}/cc_swarm_${ts}.json`;
  const summaryFile = `${outDir}/cc_swarm_${ts}_summary.md`;
  
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
    
    // Write markdown summary
    let md = `# CommandCode Swarm Results — ${new Date().toISOString()}\n\n`;
    md += `**Tasks:** ${TASKS.length} | **OK:** ${ok} | **Tokens:** ${totalTok.toLocaleString()} | **Time:** ${elapsed}s\n\n`;
    md += `## Results\n\n`;
    for (const r of results) {
      md += `### ${r.ok ? '✅' : '❌'} ${r.taskId}\n`;
      md += `- Time: ${r.ms}ms | Tokens: ${r.tokens}\n`;
      if (r.ok) md += `\n${r.reply}\n\n`;
      else md += `- Error: ${r.error}\n\n`;
    }
    fs.writeFileSync(summaryFile, md, 'utf8');
    console.log(`\n📁 Results: ${outFile}`);
    console.log(`📝 Summary: ${summaryFile}`);
  } catch(e) {
    console.log('(could not write results:', e.message, ')');
  }
  
  console.log(`\n🏁 SWARM COMPLETE`);
  console.log(`   ✅ ${ok}/${TASKS.length} tasks succeeded`);
  console.log(`   🪙 ~${totalTok.toLocaleString()} total tokens`);
  console.log(`   ⏱  ${elapsed}s elapsed`);
  console.log(`   💰 With 4x stretch on DeepSeek V4 Pro, effective tokens ~${(totalTok*4).toLocaleString()}`);
}

runSwarm().catch(e => { console.error('FATAL:', e); process.exit(1); });
