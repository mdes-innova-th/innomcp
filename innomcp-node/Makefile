




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
