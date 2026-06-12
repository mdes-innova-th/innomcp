#!/usr/bin/env node
'use strict';

const WebSocket = require('ws');

const port = process.env.SMOKE_PORT || '3012';
const httpBase = (process.env.INNOMCP_SMOKE_BASE || `http://localhost:${port}`).replace(/\/$/, '');
const wsUrl = process.env.INNOMCP_SMOKE_WS || httpBase.replace(/^http/i, 'ws') + '/chat';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 25000);
const badHelloText = '\u0e2b\u0e49\u0e32\u0e21\u0e40\u0e14\u0e32\u0e42\u0e27\u0e49\u0e22';
const greetingText = '\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35';

const results = [];

function pass(name, evidence) {
  results.push({ name, ok: true, evidence });
}

function fail(name, error, evidence) {
  results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error), evidence });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(name, route) {
  const started = Date.now();
  const response = await fetch(httpBase + route, {
    headers: { Accept: 'application/json', 'x-smoke-run': '1' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${name} returned non-JSON: ${text.slice(0, 120)}`);
  }
  return { status: response.status, body, elapsedMs: Date.now() - started };
}

async function wsExchange(name, payload, options = {}) {
  return await new Promise((resolve, reject) => {
    const started = Date.now();
    const events = [];
    let finalText = '';
    let doneCount = 0;
    let settled = false;
    const ws = new WebSocket(wsUrl, {
      headers: {
        Origin: 'http://localhost:3000',
        'User-Agent': 'innomcp-phase3-smoke/1.0',
        'X-Session-Id': `phase3-${name}-${Date.now()}`,
      },
    });

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.terminate(); } catch {}
      resolve(value);
    };

    const timer = setTimeout(() => {
      try { ws.terminate(); } catch {}
      reject(new Error(`${name} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on('open', () => {
      if (options.raw) {
        ws.send(String(payload));
        return;
      }
      ws.send(JSON.stringify({
        text: payload,
        messageId: `phase3-${name}-${Date.now()}`,
        messages: [],
        uiMode: 'auto',
      }));
    });

    ws.on('message', (buf) => {
      const raw = buf.toString();
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        msg = { type: 'raw', text: raw };
      }
      events.push({
        type: msg.type || 'unknown',
        text: msg.text || msg.message || msg.error || '',
        sender: msg.sender,
        toolsUsed: msg.toolsUsed,
      });
      if ((msg.type === 'message' || msg.type === 'chunk' || msg.type === 'final_answer') && (msg.text || msg.message)) {
        finalText += String(msg.text || msg.message);
      }
      if (msg.type === 'done') {
        doneCount += 1;
        finish({ events, finalText, doneCount, elapsedMs: Date.now() - started });
      }
    });

    ws.on('error', (err) => {
      try { ws.terminate(); } catch {}
      reject(err);
    });
    ws.on('close', () => {
      if (!settled && options.allowClose) {
        finish({ events, finalText, doneCount, elapsedMs: Date.now() - started });
      }
    });
  });
}

async function runCase(name, fn) {
  try {
    const evidence = await fn();
    pass(name, evidence);
  } catch (err) {
    fail(name, err);
  }
}

(async () => {
  await runCase('root-health-provider-build', async () => {
    const { status, body, elapsedMs } = await getJson('root health', '/health');
    assert(status === 200, `expected HTTP 200, got ${status}`);
    assert(body.status === 'ok', `expected status=ok, got ${body.status}`);
    assert(body.providers && typeof body.providers === 'object', 'missing providers object');
    assert(typeof body.providers.primary === 'string' && body.providers.primary.length > 0, 'missing providers.primary');
    assert(body.build && typeof body.build === 'object', 'missing build object');
    return { status, elapsedMs, primary: body.providers.primary, build: body.build };
  });

  await runCase('api-health-provider-build', async () => {
    const { status, body, elapsedMs } = await getJson('api health', '/api/health');
    assert(status === 200, `expected HTTP 200, got ${status}`);
    assert(['healthy', 'degraded', 'ok'].includes(String(body.status)), `unexpected status ${body.status}`);
    assert(body.providers && typeof body.providers === 'object', 'missing providers object');
    assert(body.build && typeof body.build === 'object', 'missing build object');
    return {
      status,
      elapsedMs,
      appStatus: body.status,
      mcpStatus: body.mcp_status,
      totalTools: body.total_tools,
      primary: body.providers.primary,
    };
  });

  await runCase('ws-hello-quality', async () => {
    const out = await wsExchange('hello', 'hello');
    assert(out.doneCount >= 1, 'missing done event');
    assert(out.finalText.includes(greetingText), `expected greeting, got ${out.finalText}`);
    assert(!out.finalText.includes(badHelloText), 'bad hello fallback returned');
    return out;
  });

  await runCase('ws-deterministic-tool-like', async () => {
    const out = await wsExchange('math', '2+2');
    assert(out.doneCount >= 1, 'missing done event');
    assert(/\b4\b/.test(out.finalText), `expected calculator answer 4, got ${out.finalText}`);
    return out;
  });

  await runCase('ws-invalid-json-closes-lifecycle', async () => {
    const out = await wsExchange('invalid-json', '{not-json', { raw: true });
    assert(out.doneCount >= 1, 'missing done event after invalid JSON');
    assert(out.events.some((event) => event.type === 'error'), 'missing error event after invalid JSON');
    return out;
  });

  await runCase('ws-reconnect-hello', async () => {
    const first = await wsExchange('reconnect-a', 'hello');
    const second = await wsExchange('reconnect-b', 'hello');
    assert(first.doneCount >= 1 && second.doneCount >= 1, 'missing done event on reconnect exchange');
    assert(second.finalText.includes(greetingText), `expected greeting after reconnect, got ${second.finalText}`);
    return {
      firstElapsedMs: first.elapsedMs,
      secondElapsedMs: second.elapsedMs,
      secondText: second.finalText,
    };
  });

  const ok = results.filter((result) => result.ok).length;
  const failCount = results.length - ok;
  console.log(JSON.stringify({
    ok: failCount === 0,
    httpBase,
    wsUrl,
    pass: ok,
    fail: failCount,
    results,
  }, null, 2));
  process.exitCode = failCount === 0 ? 0 : 1;
})();
