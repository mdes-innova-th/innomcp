export default {
  testDir: '.',
  timeout: 90000,
  testMatch: [
    '*.spec.ts',
    'tests/**/*.spec.ts',
    'testlist/**/*.spec.ts',
    'tmd/**/*.spec.ts',
  ],
  testIgnore: [
    '**/node_modules/**',
    '**/test_todo_req*/**',
    '**/*.bak',
    '**/*.spec.ts.bak',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/results/**',
  ],
  use: {
    baseURL: process.env.CHAT_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
};
