<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T040 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2780,"completion_tokens":6051,"total_tokens":8831,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5037,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:00:27.703Z -->
```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Provider Registry seeding', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();

    // Remove all optional provider env vars so only mandatory seeds are present
    delete process.env.OLLAMA_REMOTE_BASE_URL;
    delete process.env.OLLAMA_REMOTE_API_KEY_REF;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GITHUB_COPILOT_TOKEN;
    delete process.env.COPILOT_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.GEMINI_API_KEY; // Truncated source, but safe to clear

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore original environment to avoid cross-test leaks
    for (const key of Object.getOwnPropertyNames(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  const importRegistry = async () => {
    const mod = await import('../src/providers/registry');
    return mod.registry as Map<string, unknown>;
  };

  it('should contain mandatory local seeds', async () => {
    const registry = await importRegistry();
    expect(registry.size).toBe(2);
    expect(registry.has('seed-local-ollama')).toBe(true);
    expect(registry.has('innova-bot')).toBe(true);
  });

  it('should include mdes seed when OLLAMA_REMOTE_BASE_URL is set', async () => {
    process.env.OLLAMA_REMOTE_BASE_URL = 'https://custom.mdes.com';
    const registry = await importRegistry();
    expect(registry.has('seed-mdes-ollama')).toBe(true);
    const mdes = registry.get('seed-mdes-ollama') as { baseUrl: string } | undefined;
    expect(mdes!.baseUrl).toBe('https://custom.mdes.com');
  });

  it('should not include mdes seed when OLLAMA_REMOTE_BASE_URL is missing', async () => {
    // env var already cleared in beforeEach
    const registry = await importRegistry();
    expect(registry.has('seed-mdes-ollama')).toBe(false);
  });

  it('should include OpenAI seeds when OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const registry = await importRegistry();
    expect(registry.has('seed-gpt-4o-mini')).toBe(true);
    expect(registry.has('seed-gpt-4o-full')).toBe(true);
    const mini = registry.get('seed-gpt-4o-mini') as { apiKeyRef: string } | undefined;
    expect(mini!.apiKeyRef).toBe('OPENAI_API_KEY');
  });

  it('should include GitHub Copilot seed when GITHUB_COPILOT_TOKEN is set', async () => {
    process.env.GITHUB_COPILOT_TOKEN = 'gh-token';
    const registry = await importRegistry();
    expect(registry.has('seed-github-copilot')).toBe(true);
  });

  it('should include Anthropic seeds when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'ant-key';
    const registry = await importRegistry();
    expect(registry.has('seed-claude-haiku')).toBe(true);
    expect(registry.has('seed-claude-sonnet')).toBe(true);
    expect(registry.has('seed-claude-opus-4.8')).toBe(true);
  });

  it('should include DeepSeek seed when DEEPSEEK_API_KEY is set', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    const registry = await importRegistry();
    expect(registry.has('seed-deepseek-r1')).toBe(true);
  });

  it('should use default baseUrl fallback for local ollama', async () => {
    const registry = await importRegistry();
    const local = registry.get('seed-local-ollama') as { baseUrl: string } | undefined;
    expect(local!.baseUrl).toBe('http://localhost:11434');
  });
});
```
