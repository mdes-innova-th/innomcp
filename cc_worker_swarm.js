/**
 * cc_worker_swarm.js — CommandCode direct worker
 * ยิง parallel tasks ไปที่ CommandCode API โดยตรง
 * แต่ละ task ทำงานจริง: analyze, debug, fix
 */
const CC_KEY = process.env.COMMANDCODE_API_KEY || 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE = 'https://api.commandcode.ai/provider/v1';
const MODEL = 'deepseek/deepseek-v4-pro'; // 4x credit stretch!

async function askCC(taskId, systemPrompt, userMsg) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${CC_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CC_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(120000)
    });
    const data = await res.json();
    const ms = Date.now() - t0;
    if (data.choices?.[0]?.message?.content) {
      return { taskId, ok: true, ms, reply: data.choices[0].message.content, tokens: data.usage?.total_tokens };
    }
    return { taskId, ok: false, ms, error: JSON.stringify(data).slice(0, 200) };
  } catch(e) {
    return { taskId, ok: false, ms: Date.now()-t0, error: e.message };
  }
}

const fs = require('fs');
const path = require('path');

// อ่านไฟล์จริงจาก system
function readFileIfExists(fp) {
  try { return fs.readFileSync(fp, 'utf8').slice(0, 3000); } catch { return '[not found]'; }
}

const JIT = 'C:/Users/USER-NT/Jit';
const INNOMCP = 'C:/Users/USER-NT/DEV/innomcp';
const INNOVA = 'C:/Users/USER-NT/DEV/innova-bot-template';
const MAW = 'C:/Users/USER-NT/DEV/maw-js';

// --- TASKS ที่ต้องทำจริงๆ ---
const tasks = [
  {
    id: 'T01-hermes-fix',
    sys: 'You are a senior Node.js/TypeScript architect debugging a multi-agent message bus system.',
    msg: `Analyze this Jit hermes.json and propose exact fix for 25 stuck messages:\n\n${readFileIfExists(JIT+'/hermes.json')}\n\nBus state: agent=hermes, status=queued, pending=25, last_execution=2026-05-26 (2 weeks stale).\n\nProvide: 1) Root cause 2) Exact commands to drain queue 3) How to restart consumer 4) Prevention`
  },
  {
    id: 'T02-maw-locate-fix',
    sys: 'You are a debugging expert for distributed agent systems using maw-js CLI.',
    msg: `maw locate times out for: jit, innomcp, innova-bot-template (60s timeout each).\n\nJit remotes config:\n${readFileIfExists(JIT+'/.jit-remotes.json')}\n\nmaw config:\n${readFileIfExists(MAW+'/src/config.ts').slice(0,2000)}\n\nProvide exact steps to fix maw locate timeout and register all 3 agents.`
  },
  {
    id: 'T03-docker-compose-fix',
    sys: 'You are a Docker infrastructure expert.',
    msg: `Fix this docker-compose.yml to:\n1. Add CODEX_API_KEY and COMMANDCODE_BASE_URL to api service\n2. Add JWT_SECRET env var\n3. Add restart: unless-stopped to redis services\n4. Fix API port from 3011 to work with smoke tests on 3015\n\nCurrent docker-compose.yml:\n${readFileIfExists(INNOMCP+'/docker-compose.yml')}\n\nReturn ONLY the complete fixed docker-compose.yml file.`
  },
  {
    id: 'T04-oracle-architecture',
    sys: 'You are an AI system architect analyzing a multi-agent orchestration system.',
    msg: `Analyze this Jit consciousness.yaml and CLAUDE.md to understand Oracle architecture:\n\n${readFileIfExists(JIT+'/consciousness.yaml')}\n\n---CLAUDE.md---\n${readFileIfExists(JIT+'/CLAUDE.md').slice(0,3000)}\n\nIdentify: 1) Oracle memory gaps 2) Missing maw.js integration 3) How to connect Oracle to maw properly`
  },
  {
    id: 'T05-innomcp-api-fix',
    sys: 'You are a full-stack TypeScript/Node.js engineer fixing an API server.',
    msg: `The innomcp API server (innomcp-node) is not running in Docker.\n\nSmoke test results - ALL FAIL:\nHTTP#1-6: Unable to connect to localhost:3015\n\nDocker shows: api container NOT in docker ps\nPort in compose: 3011\n\nApp entry:\n${readFileIfExists(INNOMCP+'/innomcp-node/src/index.ts').slice(0,2000)}\n\nProvide: 1) Why container is not running 2) Steps to build & start 3) Fix port mismatch 3015 vs 3011`
  },
  {
    id: 'T06-redis-persistence',
    sys: 'You are a Redis and Docker expert.',
    msg: `Redis containers keep stopping (Exited 20h ago).\n\nCurrent docker-compose has no restart policy for redis.\n\nProvide:\n1. docker-compose snippet to add restart:unless-stopped to both redis services\n2. How to make redis data persist across restarts\n3. Health check command to verify redis is working after restart`
  },
  {
    id: 'T07-commandcode-innomcp-integration',
    sys: 'You are a senior engineer integrating CommandCode AI gateway into an existing system.',
    msg: `CommandCode is seeded in registry.ts using CODEX_API_KEY but docker-compose.yml doesn't pass this env var to the container.\n\nRegistry expects:\n- CODEX_API_KEY (for CommandCode providers: 7 models seeded)\n- COMMANDCODE_BASE_URL=https://api.commandcode.ai/provider/v1\n\nCurrent docker-compose api service environment:\n${readFileIfExists(INNOMCP+'/docker-compose.yml')}\n\nProvide the exact environment section to add to docker-compose.yml api service to enable all CommandCode providers.`
  },
  {
    id: 'T08-jwt-security-fix',
    sys: 'You are a security engineer reviewing JWT implementation.',
    msg: `JWT implementation uses insecure default:\nconst JWT_SECRET = process.env.JWT_SECRET || 'innomcp-secret-key-change-in-production';\n\nThis default is hardcoded and weak.\n\nProvide:\n1. How to generate a secure 64-char JWT_SECRET\n2. Where to add it in docker-compose.yml\n3. Startup guard code to throw error if JWT_SECRET is default or < 32 chars\n4. The startup guard TypeScript code snippet`
  },
  {
    id: 'T09-smoke-test-fix',
    sys: 'You are a QA/test engineer debugging smoke tests.',
    msg: `Smoke tests fail because HTTP_URI=http://localhost:3015/api/chat but API runs on port 3011.\n\nSmoke results:\nHTTP_URI=http://localhost:3015/api/chat\nAll 12 tests: Unable to connect\n\nProvide:\n1. Quick fix: how to update smoke test port\n2. Whether to map 3015->3011 in docker-compose or fix the test script\n3. The exact powershell/bash command to run smoke tests correctly`
  },
  {
    id: 'T10-innova-web-frontend-debug',
    sys: 'You are a Next.js expert debugging a multi-agent chat frontend.',
    msg: `innomcp-next (Next.js web frontend) is not running (container not in docker ps).\n\nFrom TODO.md context:\n- Phase 10.16 completed with tsc PASS\n- MultiAgentPanel.tsx, ChatPage.tsx were last modified\n- NEXT_PUBLIC_BACKEND_URL=http://api:3011 in docker-compose\n\nKey files modified:\n- ChatPage.tsx (MDES bridge to chat bubble)\n- MultiAgentPanel.tsx (streaming, model badges)\n- parallelDispatch.ts (multi-agent dispatch)\n\nProvide:\n1. Steps to build innomcp-next with docker\n2. How to verify MDES streaming works\n3. Common Next.js build failures to check`
  },
  {
    id: 'T11-nwp-weather-fix',
    sys: 'You are a backend engineer fixing JWT scope issues in a weather API.',
    msg: `NWP (National Weather Provider) fails with NWP_UNAVAILABLE because JWT scopes are empty.\n\nFrom TODO: CN1, CN2 = NWP_UNAVAILABLE (JWT scopes empty in weather provider) [P3]\n\nJWT payload structure:\n{ userId, userEmail, userRoleId, userDispName, jti, iat, exp }\n\nProvide:\n1. What scope field NWP likely expects (e.g., 'weather:read')\n2. How to add scope to JWT payload in generateAccessToken()\n3. How to verify scope in weather route middleware\n4. Quick TypeScript patch for jwt.ts to add scope support`
  },
  {
    id: 'T12-arra-office-frontend',
    sys: 'You are a full-stack developer analyzing a web application system.',
    msg: `Looking for ARRA Office web frontend in innomcp system.\n\nKnown services in docker-compose:\n- mariadb (DB)\n- api (innomcp-node on 3011)\n- web (innomcp-next on 3000)\n\nAlso found directories: webd-api, detect-evidence-api, innomcp-server-node\n\nARRA likely = arra-office-backend or detect-evidence-api\n\nProvide:\n1. What ARRA Office likely is (evidence management system?)\n2. How webd-api and detect-evidence-api relate\n3. Architecture recommendation for ARRA frontend integration with innomcp\n4. Port assignment suggestions`
  },
  {
    id: 'T13-jit-memory-architecture',
    sys: 'You are an AI memory systems architect.',
    msg: `Jit brain/ directory contains only:\n- debug-mantra.md\n- reasoning.md\n\nThis is minimal. The system has 44+ agents in the bus.\n\nMemory issues found:\n- Oracle memory: maw locate timeout = cannot access\n- Redis: was down 20h (now fixed)\n- MariaDB: container was in Created state (now started)\n\nProvide:\n1. What memory architecture Jit Oracle should have\n2. Which files/databases store agent state\n3. How to audit memory health\n4. Recommendations for brain/ directory structure`
  },
  {
    id: 'T14-hermes-bus-consumer',
    sys: 'You are a Node.js message queue expert.',
    msg: `Hermes message bus has 25 stuck messages since 2026-05-26.\n\nBus structure:\n- Bus root: C:/tmp/manusat-bus/\n- Legacy inbox: C:/Users/USER-NT/Jit/network/inbox/jit/ (31 .json files)\n- Message format: hermes-cheam-{correlationId}.json\n\nAgents with pending=3 stuck: chamu, karn, lak, neta, netra, pada, pran, rupa, sayanprasathan, soma, vaja\n\nProvide:\n1. How maw bus consumer should work (file watch? polling?)\n2. Script to drain/acknowledge all 25 pending messages\n3. How to restart the consumer process\n4. PowerShell script to list and clear stuck messages`
  },
  {
    id: 'T15-parallel-mdes-agents',
    sys: 'You are an expert in multi-agent AI systems and MDES (Multi-Dispatch Expert System).',
    msg: `PARALLEL_AGENTS=0 in .env means parallel MDES dispatch is disabled.\n\nFrom TODO.md: Phase 10.16 implemented parallelDispatch.ts for every query dispatching to >=2 MDES agents.\n\nParallelDispatch file:\n${readFileIfExists(INNOMCP+'/innomcp-node/src/agents/parallelDispatch.ts').slice(0,2000)}\n\nProvide:\n1. When should PARALLEL_AGENTS be set to 1?\n2. What are the risks of enabling it?\n3. What MDES agents are in the roster?\n4. Recommendation: enable or keep disabled for stability?`
  }
];

async function runAll() {
  console.log(`\n🚀 CommandCode Swarm — ${tasks.length} tasks @ ${MODEL}`);
  console.log(`💰 4x credit stretch on DeepSeek V4 Pro!\n`);
  
  const results = [];
  
  // Run all tasks in parallel
  const promises = tasks.map(t => askCC(t.id, t.sys, t.msg));
  
  for (let i = 0; i < promises.length; i++) {
    const r = await promises[i];
    results.push(r);
    const status = r.ok ? '✅' : '❌';
    console.log(`${status} ${r.taskId} | ${r.ms}ms | tokens=${r.tokens||'?'}`);
    if (r.ok) {
      console.log(`   └─ ${r.reply.slice(0,150).replace(/\n/g,' ')}...\n`);
    } else {
      console.log(`   └─ ERROR: ${r.error}\n`);
    }
  }
  
  // Save results
  const outPath = `${INNOVA}/logs/cc_swarm_results_${Date.now()}.json`;
  try {
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved: ${outPath}`);
  } catch(e) {
    console.log('(could not save to innova logs)');
  }
  
  const ok = results.filter(r=>r.ok).length;
  const totalTokens = results.reduce((s,r)=>s+(r.tokens||0),0);
  console.log(`\n🏁 Done: ${ok}/${results.length} OK | ~${totalTokens} tokens used`);
}

runAll().catch(console.error);
