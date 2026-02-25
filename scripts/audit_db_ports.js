#!/usr/bin/env node

/*
  DB Port Audit (3306 vs 3308)
  - Prints ONLY hostnames/ports (no usernames/passwords/db names).
  - Reads repo-tracked configs:
    - mariadb/docker-compose.yml
    - innomcp-node/.env
    - innomcp-server-node/.env
    - innomcp-next/.env
    - *-service docker-compose.yml overrides
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readText(relPath) {
  const abs = path.resolve(__dirname, '..', relPath);
  return fs.readFileSync(abs, 'utf8');
}

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function extractFirstPortMapping(composeText) {
  // Matches: - "3308:3306" or - '3308:3306'
  const m = composeText.match(/[-]\s*["'](\d+)\s*:\s*(\d+)["']/);
  if (!m) return null;
  return { hostPort: Number(m[1]), containerPort: Number(m[2]) };
}

function extractComposeEnvOverrides(composeText) {
  // Very small parser for lines like: - DB_HOST=mariadb
  const overrides = {};
  for (const rawLine of composeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^[-]\s*(DB_HOST|DB_PORT|DETECT_DB_HOST|DETECT_DB_PORT|EVIDENCE_DB_HOST|EVIDENCE_DB_PORT)\s*=\s*(.+)\s*$/);
    if (m) overrides[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return overrides;
}

function safeHostKind(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return 'unset';
  if (h === 'localhost' || h === '127.0.0.1') return 'localhost';
  if (h === 'mariadb') return 'docker-service';
  return 'custom';
}

function safePortNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveDetectPort(env, appPort) {
  // Mirrors the shared fallback behavior in code: Detect/Evidence port may fall back to DB_PORT.
  const explicit = env.DETECT_DB_PORT || env.EVIDENCE_DB_PORT;
  return safePortNumber(explicit) ?? appPort;
}

function main() {
  const mariadbCompose = readText('mariadb/docker-compose.yml');
  const mapping = extractFirstPortMapping(mariadbCompose);

  const nodeEnv = parseEnv(readText('innomcp-node/.env'));
  const serverEnv = parseEnv(readText('innomcp-server-node/.env'));
  const nextEnv = parseEnv(readText('innomcp-next/.env'));

  const nodeCompose = readText('innomcp-node/docker-compose.yml');
  const serverCompose = readText('innomcp-server-node/docker-compose.yml');
  const nextCompose = readText('innomcp-next/docker-compose.yml');

  const nodeOverrides = extractComposeEnvOverrides(nodeCompose);
  const serverOverrides = extractComposeEnvOverrides(serverCompose);
  const nextOverrides = extractComposeEnvOverrides(nextCompose);

  const nodeAppPort = safePortNumber(nodeEnv.DB_PORT);
  const serverAppPort = safePortNumber(serverEnv.DB_PORT);
  const nextAppPort = safePortNumber(nextEnv.DB_PORT);

  const nodeDetectPort = resolveDetectPort(nodeEnv, nodeAppPort);
  const serverDetectPort = resolveDetectPort(serverEnv, serverAppPort);
  const nextDetectPort = resolveDetectPort(nextEnv, nextAppPort);

  console.log('DB_PORT_AUDIT');
  if (mapping) {
    console.log(`mariadb.compose.ports host=${mapping.hostPort} container=${mapping.containerPort}`);
  } else {
    console.log('mariadb.compose.ports host=? container=?');
  }

  console.log(`innomcp-node.hostMode dbHostKind=${safeHostKind(nodeEnv.DB_HOST)} appDbPort=${nodeAppPort ?? '?'} detectDbPort=${nodeDetectPort ?? '?'}`);
  console.log(`innomcp-server-node.hostMode dbHostKind=${safeHostKind(serverEnv.DB_HOST)} appDbPort=${serverAppPort ?? '?'} detectDbPort=${serverDetectPort ?? '?'}`);
  console.log(`innomcp-next.hostMode dbHostKind=${safeHostKind(nextEnv.DB_HOST)} appDbPort=${nextAppPort ?? '?'} detectDbPort=${nextDetectPort ?? '?'}`);

  console.log(`innomcp-node.containerMode dbHostKind=${safeHostKind(nodeOverrides.DB_HOST)} appDbPort=${safePortNumber(nodeOverrides.DB_PORT) ?? '?'} (overrides)`);
  console.log(`innomcp-server-node.containerMode dbHostKind=${safeHostKind(serverOverrides.DB_HOST)} appDbPort=${safePortNumber(serverOverrides.DB_PORT) ?? '?'} (overrides)`);
  console.log(`innomcp-next.containerMode dbHostKind=${safeHostKind(nextOverrides.DB_HOST)} appDbPort=${safePortNumber(nextOverrides.DB_PORT) ?? '?'} (overrides)`);
}

main();
