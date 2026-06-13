<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-01 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":2592,"total_tokens":2662,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1922,"image_tokens":0},"cache_creation_input_tokens":0} | 76s
 generated: 2026-06-13T05:26:06.265Z -->
// health-monitor.js
// Polls /api/health every 30 seconds, logs status & provider, warns on unhealthy transitions
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ENDPOINT = process.env.HEALTH_ENDPOINT || 'http://localhost:3000/api/health';
const POLL_INTERVAL_MS = 30000;
let previousStatus = null;
let timer;

function pollHealth() {
  const url = new URL(ENDPOINT);
  const transport = url.protocol === 'https:' ? https : http;
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    timeout: 5000,
  };

  const req = transport.request(options, (res) => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      let status = 'unknown';
      let provider = 'N/A';
      try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.status) status = parsed.status;
        if (parsed && parsed.provider) provider = parsed.provider;
        else if (parsed && parsed.service) provider = parsed.service;
        // fallback: you can log additional fields if needed
      } catch (err) {
        status = 'parse_error';
        provider = data.slice(0, 100); // truncated raw data
      }

      const ts = new Date().toISOString();
      console.log(`[${ts}] Status: ${status}, Provider: ${provider}`);

      if (status === 'unhealthy' || status === 'unreachable' || status === 'parse_error') {
        if (previousStatus !== status) {
          console.log(`WARNING: Health status changed to ${status}`);
        }
      }
      previousStatus = status;
    });
  });

  req.on('error', (err) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] Error fetching health: ${err.message}`);
    const status = 'unreachable';
    if (previousStatus !== status) {
      console.log(`WARNING: Health status changed to ${status}`);
    }
    previousStatus = status;
  });

  req.on('timeout', () => {
    req.destroy();
    const ts = new Date().toISOString();
    console.log(`[${ts}] Health check timed out`);
    const status = 'timeout';
    if (previousStatus !== status) {
      console.log(`WARNING: Health status changed to ${status}`);
    }
    previousStatus = status;
  });

  req.end();
}

// Initial poll
pollHealth();
timer = setInterval(pollHealth, POLL_INTERVAL_MS);

// Graceful shutdown on SIGINT
process.on('SIGINT', () => {
  clearInterval(timer);
  console.log('Health monitor shutting down.');
  process.exit(0);
});
