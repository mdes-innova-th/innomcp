<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: SMOKE-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":554,"total_tokens":612,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":433,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T05:27:50.754Z -->
const http = require('http');

const url = 'http://localhost:3012/api/health';

http.get(url, (res) => {
  const { statusCode } = res;
  // Consume response data to free up memory
  res.resume();

  if (statusCode === 200) {
    console.log('healthy');
    process.exit(0);
  } else {
    console.log('unhealthy');
    process.exit(1);
  }
}).on('error', (err) => {
  console.log('unhealthy');
  process.exit(1);
});
