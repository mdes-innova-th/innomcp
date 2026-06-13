<!-- cc-team deliverable
 group: VQA-BROWSER (Phase 3-4 browser verification)
 member: VQA-B1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":172,"completion_tokens":3000,"total_tokens":3172,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2288,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T05:25:10.592Z -->
const http = require('node:http');
const assert = require('node:assert');

const HOST = 'localhost';
const PORT = 3012;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTest(name, testFn) {
  try {
    await testFn();
    console.log(`PASS: ${name}`);
    return true;
  } catch (err) {
    console.log(`FAIL: ${name} - ${err.message}`);
    return false;
  }
}

async function main() {
  let allPass = true;

  // 1. GET /api/health
  allPass =
    (await runTest('GET /api/health returns 200 with providers and build', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.providers !== undefined, 'missing providers');
      assert.ok(json.build !== undefined, 'missing build');
    })) && allPass;

  // 2. GET /api/analytics/stats
  allPass =
    (await runTest('GET /api/analytics/stats returns 200', async () => {
      const res = await request('GET', '/api/analytics/stats');
      assert.strictEqual(res.statusCode, 200);
    })) && allPass;

  // 3. GET /api/mdes/models
  allPass =
    (await runTest('GET /api/mdes/models returns 200', async () => {
      const res = await request('GET', '/api/mdes/models');
      assert.strictEqual(res.statusCode, 200);
    })) && allPass;

  // 4. POST /api/thai/detect
  allPass =
    (await runTest('POST /api/thai/detect with {text:"สวัสดี"} returns 200', async () => {
      const res = await request('POST', '/api/thai/detect', JSON.stringify({ text: 'สวัสดี' }));
      assert.strictEqual(res.statusCode, 200);
    })) && allPass;

  // 5. POST chat message 'hello' (assume /api/chat) and check no forbidden phrase
  allPass =
    (await runTest('POST /api/chat with message "hello" and no forbidden phrase', async () => {
      const res = await request('POST', '/api/chat', JSON.stringify({ message: 'hello' }));
      assert.strictEqual(res.statusCode, 200);
     
