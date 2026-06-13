<!-- cc-team deliverable
 group: VQA-BROWSER (Phase 3-4 browser verification)
 member: VQA-B3 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":159,"completion_tokens":4325,"total_tokens":4484,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3435,"image_tokens":0},"cache_creation_input_tokens":0} | 82s
 generated: 2026-06-13T05:26:40.390Z -->
import { test } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import * as net from 'node:net';

const PORT = 3012;

async function isPortReachable(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

function request(options: http.RequestOptions, body?: string): Promise<{ status: number; data: any; raw: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let rawData = '';
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', () => {
                let parsedData: any;
                try {
                    parsedData = JSON.parse(rawData);
                } catch {
                    parsedData = rawData;
                }
                resolve({ status: res.statusCode || 0, data: parsedData, raw: rawData });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const serverUp = await isPortReachable(PORT);
const skipMessage = serverUp ? false : 'Port 3012 is not reachable (skipAudit equivalent)';

test('GET /api/health returns providers, build, status', { skip: skipMessage }, async () => {
    const res = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/health', method: 'GET' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.providers !== undefined, 'missing providers');
    assert.ok(res.data.build !== undefined, 'missing build');
    assert.ok(res.data.status !== undefined, 'missing status');
});

test('POST /api/chat with hello does not return ห้ามเดาโว้ย', { skip: skipMessage }, async () => {
    const body = JSON.stringify({ message: 'hello' });
    const res = await request({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    assert.strictEqual(res.status, 200);
    const responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    assert.ok(!responseText.includes('ห้ามเดาโว้ย'), 'Response should not be ห้ามเดาโว้ย');
});

test('GET /api/analytics/stats is 200', { skip: skipMessage }, async () => {
    const res = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/analytics/stats', method: 'GET' });
    assert.strictEqual(res.status, 200);
});

test('GET /api/thai/check?text=สวัสดี returns isThai:true', { skip: skipMessage }, async () => {
    const path = '/api/thai/check?text=' + encodeURIComponent('สวัสดี');
    const res = await request({ hostname: '127.0.0.1', port: PORT, path, method: 'GET' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.isThai, true);
});
