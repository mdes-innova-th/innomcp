import { Router, Request, Response } from "express";
import logger from "../../utils/logger";

const aiModeRouter = Router();
const validAIModes = new Set(["local", "remote", "hybrid"]);

function resolveLocalUrl(): string | undefined {
  return process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || undefined;
}

function resolveRemoteUrl(): string | undefined {
  // OLLAMA_URL is the canonical MDES remote endpoint configured for the
  // multi-agent dispatch — reuse it so the AI-mode toggle picks up the same
  // remote without requiring duplicate env keys.
  return process.env.REMOTE_OLLAMA_BASE_URL
    || process.env.OLLAMA_REMOTE_URL
    || process.env.OLLAMA_URL
    || undefined;
}

function resolveLocalModel(): string | undefined {
  return process.env.LOCAL_OLLAMA_MODEL || process.env.OLLAMA_MODEL || process.env.AI_MODEL || undefined;
}

function resolveRemoteModel(): string | undefined {
  return process.env.REMOTE_OLLAMA_MODEL || undefined;
}

// Store current AI mode (can be changed dynamically)
let currentAIMode: 'local' | 'remote' | 'hybrid' = (process.env.AI_MODE || 'local') as 'local' | 'remote' | 'hybrid';

// Export function to get current AI mode
export function getCurrentAIMode(): 'local' | 'remote' | 'hybrid' {
  return currentAIMode;
}

// Dynamic import updateChatAIMode to avoid circular dependency
let updateChatAIMode: (() => void) | null = null;
if (process.env.NODE_ENV !== "test") {
  const warmUpdateChatAIModeTimer = setTimeout(async () => {
    try {
      const chatModule = await import('./chat');
      updateChatAIMode = (chatModule as any).updateChatAIMode;
    } catch (err) {
      logger.warn('Could not import updateChatAIMode', { error: err });
    }
  }, 1000);
  warmUpdateChatAIModeTimer.unref?.();
}

// GET current AI mode
aiModeRouter.get("/", (req: Request, res: Response) => {
  const localUrl = resolveLocalUrl();
  const remoteUrl = resolveRemoteUrl();
  logger.debug("[AI Mode API] GET current mode", {
    mode: currentAIMode,
    localConfigured: Boolean(localUrl),
    remoteConfigured: Boolean(remoteUrl),
  });
  
  res.json({ 
    success: true, 
    mode: currentAIMode,
    availableModes: ['local', 'remote', 'hybrid'],
    config: {
      localUrl,
      remoteUrl,
      localModel: resolveLocalModel(),
      remoteModel: resolveRemoteModel()
    }
  });
});

// POST to change AI mode
aiModeRouter.post("/", (req: Request, res: Response) => {
  const { mode } = req.body;
  
  logger.info(`[AI Mode API] 📥 POST request to change mode to: ${mode}`);
  
  if (!mode || !validAIModes.has(mode)) {
    logger.error(`[AI Mode API] ❌ Invalid mode requested: ${mode}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid mode. Must be one of: local, remote, hybrid'
    });
  }
  
  // Check if remote is configured for remote/hybrid modes
  if ((mode === 'remote' || mode === 'hybrid') && !resolveRemoteUrl()) {
    logger.warn(`[AI Mode API] ⚠️  ${mode} mode requested but remote Ollama URL is not configured`);
  }
  
  const previousMode = currentAIMode;
  currentAIMode = mode;
  
  logger.info(`[AI Mode API] 🔄 Mode change: ${previousMode} → ${currentAIMode}`);
  logger.info(`[AI Mode API] 📍 New mode: ${currentAIMode}`);
  
  // Update chat AI mode dynamically
  if (updateChatAIMode) {
    logger.info(`[AI Mode API] 🔗 Calling updateChatAIMode()`);
    updateChatAIMode();
    logger.info(`[AI Mode API] ✅ updateChatAIMode() completed`);
  } else {
    logger.warn('[AI Mode API] ⚠️  updateChatAIMode not available yet');
  }
  
  res.json({
    success: true,
    mode: currentAIMode,
    previousMode: previousMode,
    message: `AI mode changed to ${currentAIMode}. Next chat will use this mode.`
  });
});

export default aiModeRouter;
