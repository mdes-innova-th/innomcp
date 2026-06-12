<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-5 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":1826,"total_tokens":1891,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1743,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-12T03:42:05.541Z -->
const GREETING_TOKENS = new Set(["hi","hello","hey","yo","test","ping","สวัสดี","ดี","เฮ้","หวัดดี","howdy","sup","morning","evening","good day","สวัสดีครับ","สวัสดีค่ะ","สบายดีไหม","ยินดีที่ได้รู้จัก","ไหว้"]);
