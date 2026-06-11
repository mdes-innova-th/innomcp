#!/usr/bin/env node
/**
 * cc_lib_swarm.js — Fixed CODECOMMAND swarm library
 *
 * Fixes:
 *   Bug A: max_tokens too small for deepseek reasoning → always use ≥500 (flash) / ≥2000 (pro)
 *   Bug B: 50+ concurrent fetch overwhelms undici pool → semaphore capped at CONCURRENCY_LIMIT
 *
 * Usage:
 *   const { cc, runTasks, writeFile, extract } = require('./cc_lib_swarm');
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const CC_KEY  = process.env.CC_KEY || 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE = 'https://api.commandcode.ai/provider/v1';

// ── Model aliases ───────────────────────────────────────────────────────────
const PRO  = 'deepseek/deepseek-v4-pro';
const FAST = 'deepseek/deepseek-v4-flash';

// ── Minimum tokens per model (Bug A fix) ───────────────────────────────────
// DeepSeek V4 uses reasoning tokens before content.
// If max_tokens < reasoning budget, content comes back "".
const MIN_TOKENS = {
  [PRO]:  2000,  // PRO reasoning can use 500-1500 tokens before content
  [FAST]: 500,   // Flash reasoning is shorter
};

// ── Concurrency limiter (Bug B fix) ────────────────────────────────────────
// Node.js undici (used by native fetch) pools ~10 connections per host by default.
// 50+ concurrent requests cause socket close. Cap at 15 active at a time.
const CONCURRENCY_LIMIT = 15;

function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  return {
    async acquire() {
      if (active < limit) { active++; return; }
      await new Promise(resolve => queue.push(resolve));
      active++;
    },
    release() {
      active--;
      if (queue.length > 0) queue.shift()();
    },
  };
}

const sem = createSemaphore(CONCURRENCY_LIMIT);

// ── Core request (with retry) ───────────────────────────────────────────────
async function cc(id, model, sys, msg, maxTokens) {
  // Bug A fix: enforce minimum token budget
  const safeMax = Math.max(maxTokens || 0, MIN_TOKENS[model] || 500);

  const attempt = async () => {
    const t0 = Date.now();
    await sem.acquire();
    try {
      const resp = await fetch(`${CC_BASE}/chat/completions`, {
        method : 'POST',
        headers: { 'Authorization': `Bearer ${CC_KEY}`, 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          model,
          messages    : [{ role: 'system', content: sys }, { role: 'user', content: msg }],
          max_tokens  : safeMax,
          temperature : 0.1,
          stream      : false,
        }),
        signal: AbortSignal.timeout(360000),
      });

      const j      = await resp.json();
      const ms     = Date.now() - t0;
      const reply  = j.choices?.[0]?.message?.content || '';
      const tokens = j.usage?.total_tokens || 0;
      const finish = j.choices?.[0]?.finish_reason;

      // Bug A detection: content empty (reasoning ate all tokens)
      if (!reply || reply.trim().length < 10) {
        return { id, ok: false, ms, tokens, error: `empty-content (finish=${finish}, tokens=${safeMax})` };
      }

      return { id, ok: true, ms, tokens, reply };
    } catch(e) {
      return { id, ok: false, ms: Date.now() - t0, tokens: 0, error: e.message };
    } finally {
      sem.release();
    }
  };

  // Retry once on socket close or empty content
  let r = await attempt();
  if (!r.ok && (r.error?.includes('socket') || r.error?.includes('empty-content') || r.error?.includes('abort') || r.error?.includes('timeout'))) {
    process.stdout.write(`  ↩️  ${id} retry (${r.error?.slice(0,40)})\n`);
    await new Promise(res => setTimeout(res, 2000 + Math.random() * 3000)); // jitter
    r = await attempt();
  }

  return r;
}

// ── File writer ─────────────────────────────────────────────────────────────
function extract(reply) {
  if (!reply) return '';
  const m = reply.match(/```(?:tsx?|ts|js|javascript|json|css|md|yaml|sh|bash|sql)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : reply.trim();
}

function writeFile(rootDir, relPath, content) {
  if (content.startsWith('```')) content = extract(content);
  if (!content || content.length < 20) return false;
  const full = path.join(rootDir.replace(/\//g, path.sep), relPath.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  process.stdout.write(`  ✏️  ${path.basename(relPath)} (${Math.round(content.length/1024)}KB)\n`);
  return true;
}

// ── Batch runner ─────────────────────────────────────────────────────────────
async function runTasks(tasks, rootDir, SYS) {
  const start = Date.now();
  let totalTok = 0, ok = 0, fail = 0;
  const failed = [];

  await Promise.allSettled(tasks.map(async (t) => {
    const r = await cc(t.id, t.model, SYS, t.msg, t.max);
    totalTok += r.tokens || 0;
    if (r.ok) {
      const code = extract(r.reply);
      writeFile(rootDir, t.out, code);
      process.stdout.write(`  ✅ ${t.id.padEnd(30)} ${r.ms}ms | ${r.tokens}tok\n`);
      ok++;
    } else {
      process.stdout.write(`  ❌ ${t.id.padEnd(30)} ${r.error?.slice(0,60)}\n`);
      fail++;
      failed.push(t.id);
    }
  }));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  return { ok, fail, failed, totalTok, elapsed };
}

module.exports = { cc, runTasks, writeFile, extract, PRO, FAST, MIN_TOKENS, CONCURRENCY_LIMIT };
