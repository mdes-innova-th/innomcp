# Unit tests (ทั้งหมด)
cd innomcp-next && pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E tests (Playwright)
pnpm test:e2e

# E2E with custom base URL
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e

# E2E debug mode
pnpm test:e2e -- --debug