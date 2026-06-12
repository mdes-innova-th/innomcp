import { checkDatabaseConnection } from './config/database';
import { isWebSocketServerReady } from './config/websocket';
import { analyticsService } from './services/analytics';
import { mdesModelCache } from './services/mdes-model-cache';
import { checkOllamaHealth } from './services/ollama';
import { sessionService } from './services/session';

type WarmupStatus = {
  service: string;
  status: 'success' | 'warning' | 'error';
  message: string;
};

type WarmupResult = {
  success: boolean;
  details: WarmupStatus[];
  timestamp: Date;
};

/**
 * Pre‑warm all services at server startup.
 * Logs progress with emojis and returns a detailed result object.
 */
export async function warmupServer(): Promise<WarmupResult> {
  console.log('🔥 Warming up...');
  const details: WarmupStatus[] = [];
  let overallSuccess = true;

  // Helper to run a step and handle its outcome
  const runStep = async (
    service: string,
    critical: boolean,
    action: () => Promise<void>,
    successMessage: string,
    warningMessage?: string,
  ) => {
    try {
      await action();
      const msg = successMessage;
      details.push({ service, status: 'success', message: msg });
      console.log(msg);
    } catch (error: unknown) {
      // Critical failures are logged as error and break overall success
      if (critical) {
        const msg = `❌ ${service} error: ${error instanceof Error ? error.message : String(error)}`;
        details.push({ service, status: 'error', message: msg });
        console.error(msg);
        overallSuccess = false;
      } else {
        const msg = warningMessage || `⚠️  ${service} warning: ${error instanceof Error ? error.message : String(error)}`;
        details.push({ service, status: 'warning', message: msg });
        console.warn(msg);
        // Non‑critical warnings do not affect overallSuccess
      }
    }
  };

  // 1. MDES Ollama health check (non‑critical – we log a warning if down)
  await runStep(
    'MDES Ollama health',
    false,
    async () => {
      const health = await checkOllamaHealth();
      if (!health) throw new Error('Ollama health check returned false');
    },
    '✅ MDES Ollama healthy',
    '⚠️  MDES Ollama not responding',
  );

  // 2. Database connection (critical)
  await runStep(
    'Database connection',
    true,
    async () => {
      const connected = await checkDatabaseConnection();
      if (!connected) throw new Error('Could not establish database connection');
    },
    '✅ Database connected',
  );

  // 3. WebSocket server readiness (non‑critical)
  await runStep(
    'WebSocket readiness',
    false,
    async () => {
      const ready = isWebSocketServerReady();
      if (!ready) throw new Error('WebSocket server not ready');
    },
    '✅ WebSocket server ready',
    '⚠️  WebSocket server not ready',
  );

  // 4. MDES model cache warm‑up (critical)
  await runStep(
    'MDES model cache',
    true,
    async () => {
      const modelCount = await mdesModelCache.warmUp();
      // The success message carries the number of loaded models
      if (modelCount !== undefined && modelCount >= 0) {
        // Update the last entry's message in details
        if (details.length > 0) {
          const last = details[details.length - 1];
          if (last.service === 'MDES model cache' && last.status === 'success') {
            last.message = `✅ MDES models loaded (${modelCount} models)`;
            console.log(last.message);
          }
        }
      }
    },
    '✅ MDES models loaded',
  );

  // 5. Analytics service reset (non‑critical – we only warn)
  await runStep(
    'Analytics service reset',
    false,
    async () => {
      await analyticsService.reset();
    },
    '✅ Analytics service reset',
    '⚠️  Analytics service reset failed',
  );

  // 6. Session service cleanup (non‑critical)
  await runStep(
    'Session service cleanup',
    false,
    async () => {
      await sessionService.cleanup();
    },
    '✅ Session service cleaned up',
    '⚠️  Session cleanup incomplete',
  );

  return {
    success: overallSuccess,
    details,
    timestamp: new Date(),
  };
}