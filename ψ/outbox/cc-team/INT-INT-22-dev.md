<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-22 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":86,"completion_tokens":670,"total_tokens":756,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":609,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-12T03:50:51.611Z -->
.PHONY: build test smoke hooks health clean

build:
	npx tsc

test:
	node --test

smoke:
	node full-smoke-test.js

hooks:
	node scripts/install-hooks.js

health:
	node scripts/check-health.js

clean:
	rm -rf dist
