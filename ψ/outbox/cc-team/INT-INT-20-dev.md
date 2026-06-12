<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-20 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":63,"completion_tokens":501,"total_tokens":564,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":98,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-12T03:50:39.275Z -->
const http = require('node:http');

const options = {
  hostname: 'localhost',
  port: 3012,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const health = JSON.parse(data);

      console.log('Status: ' + health.status);

      if (health.providers && typeof health.providers === 'object') {
        const configured = health.providers.configured || health.providers;
        if (typeof configured === 'object' && configured !== null) {
          const map = Object.entries(configured)
            .map(([key, val]) => `${key}=${typeof val === 'object' ? JSON.stringify(val) : val}`)
            .join(', ');
          console.log('Providers Configured: { ' + map + ' }');
        } else {
          console.log('Providers Configured: ' + configured);
        }
      }

      if (health.build && health.build.version) {
        console.log('Build Version: ' + health.build.version);
      } else if (health.version) {
        console.log('Build Version: ' + health.version);
      }

      if (health.status !== 'healthy' && health.status !== 'degraded') {
        process.exit(1);
      }
    } catch (err) {
      console.error('Failed to parse health response: ' + err.message);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Health check request failed: ' + err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check request timed out');
  req.destroy();
  process.exit(1);
});

req.end();
