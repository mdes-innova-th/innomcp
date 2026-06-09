#!/usr/bin/env node
/**
 * pick-provider.js — Provider-balanced task router for innomcp overnight loop
 *
 * Usage: node pick-provider.js <task-type>
 *   task-type: "code"     → commandcode (TypeScript, lint, build, test)
 *              "thai"     → ollama-local (Thai QA, routine review)
 *              "arch"     → claude (architecture decisions, security review)
 *              (omit)     → auto-select cheapest healthy provider
 *
 * Output: JSON { provider, model, reason }
 * Side effect: increments .claude/provider-balance.json usage counter
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────
const INNOMCP_BASE  = process.env.INNOMCP_BASE || 'http://localhost:3000';
const BALANCE_FILE  = path.join(__dirname, '..', '.claude', 'provider-balance.json');
const TASK_TYPE     = process.argv[2] || 'auto';

// Provider priority table: lower cost = higher preference for auto-select
const PROVIDERS = [
  {
    id:       'ollama-local',
    name:     'Ollama MDES (local)',
    model:    process.env.OLLAMA_LOCAL_DEFAULT_MODEL || 'minimax-m2.5:cloud',
    tasks:    ['thai', 'review', 'routine'],
    cost:     0,     // free / local
    limit:    null,  // no quota
  },
  {
    id:       'commandcode',
    name:     'CommandCode API',
    model:    'deepseek/deepseek-v4-flash',
    tasks:    ['code', 'lint', 'build', 'test', 'auto'],
    cost:     1,     // tokens remaining — prefer over Claude
    limit:    null,
  },
  {
    id:       'claude',
    name:     'Claude (Anthropic)',
    model:    'claude-sonnet-4-6',
    tasks:    ['arch', 'security'],
    cost:     10,    // near limit — last resort
    limit:    50,    // soft cap per overnight session
  },
];

// ── Load/save balance log ─────────────────────────────────────────────────
function loadBalance() {
  try {
    return JSON.parse(fs.readFileSync(BALANCE_FILE, 'utf8'));
  } catch {
    return { session: new Date().toISOString().slice(0, 10), counts: {}, history: [] };
  }
}

function saveBalance(bal) {
  const dir = path.dirname(BALANCE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BALANCE_FILE, JSON.stringify(bal, null, 2));
}

// ── Health check via innomcp /api/health ──────────────────────────────────
function fetchHealth() {
  return new Promise((resolve) => {
    const url = new URL('/api/health', INNOMCP_BASE);
    const req = http.get(url.toString(), (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.setTimeout(3000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// ── Provider health inference from /api/health response ──────────────────
function inferProviderHealth(healthData) {
  // /api/health doesn't expose per-provider status yet — infer from overall status.
  // If the server is up, assume local Ollama is reachable (same host).
  // commandcode and claude reachability is best-effort; assume OK unless flagged.
  // If innomcp server is unreachable, Ollama and CommandCode are still independently
  // usable (they don't require the innomcp process to be running).
  if (!healthData) return { 'ollama-local': true, commandcode: true, claude: true };
  const up = healthData.status === 'ok' || healthData.status === 'healthy';
  return {
    'ollama-local': up,
    commandcode:    up,
    claude:         up,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const health  = await fetchHealth();
  const alive   = inferProviderHealth(health);
  const bal     = loadBalance();
  bal.counts    = bal.counts || {};

  // Find candidates: healthy + handles this task type
  const candidates = PROVIDERS.filter(p => {
    if (!alive[p.id]) return false;
    if (TASK_TYPE === 'auto') return true;
    return p.tasks.includes(TASK_TYPE);
  });

  if (!candidates.length) {
    // Fallback: any alive provider
    const any = PROVIDERS.find(p => alive[p.id]);
    if (!any) {
      process.stderr.write('ERROR: no healthy providers available\n');
      process.exit(1);
    }
    candidates.push(any);
  }

  // Enforce soft cap on claude
  const filtered = candidates.filter(p => {
    if (p.limit === null) return true;
    return (bal.counts[p.id] || 0) < p.limit;
  });
  const pool = filtered.length ? filtered : candidates; // if all capped, still continue

  // Pick cheapest (lowest cost), break ties by lowest usage count
  pool.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return (bal.counts[a.id] || 0) - (bal.counts[b.id] || 0);
  });
  const chosen = pool[0];

  // Log usage
  bal.counts[chosen.id] = (bal.counts[chosen.id] || 0) + 1;
  bal.history = bal.history || [];
  bal.history.push({ ts: new Date().toISOString(), provider: chosen.id, task: TASK_TYPE });
  if (bal.history.length > 500) bal.history = bal.history.slice(-500);
  saveBalance(bal);

  const result = {
    provider: chosen.id,
    model:    chosen.model,
    reason:   `task=${TASK_TYPE} cost=${chosen.cost} usage=${bal.counts[chosen.id]}`,
    counts:   bal.counts,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
