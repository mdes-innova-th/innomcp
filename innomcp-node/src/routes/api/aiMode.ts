import { Router, Request, Response } from "express";
import logger from "../../utils/logger";

const aiModeRouter = Router();

// Store current AI mode (can be changed dynamically)
let currentAIMode: 'local' | 'remote' | 'hybrid' = (process.env.AI_MODE || 'local') as 'local' | 'remote' | 'hybrid';

// Export function to get current AI mode
export function getCurrentAIMode(): 'local' | 'remote' | 'hybrid' {
  return currentAIMode;
}

// Dynamic import updateChatAIMode to avoid circular dependency
let updateChatAIMode: (() => void) | null = null;
setTimeout(async () => {
  try {
    const chatModule = await import('./chat');
    updateChatAIMode = (chatModule as any).updateChatAIMode;
  } catch (err) {
    logger.warn('Could not import updateChatAIMode', { error: err });
  }
}, 1000);

// GET current AI mode
aiModeRouter.get("/", (req: Request, res: Response) => {
  const hasRemoteConfig = !!process.env.REMOTE_OLLAMA_BASE_URL;
  logger.info(`[AI Mode API] 🔍 GET current mode: ${currentAIMode}`);
  logger.info(`[AI Mode API] 📊 Remote configured: ${hasRemoteConfig}`);
  logger.info(`[AI Mode API] 🌐 Local: ${process.env.LOCAL_OLLAMA_BASE_URL || 'not set'}`);
  logger.info(`[AI Mode API] ☁️  Remote: ${process.env.REMOTE_OLLAMA_BASE_URL || 'not set'}`);
  
  res.json({ 
    success: true, 
    mode: currentAIMode,
    availableModes: ['local', 'remote', 'hybrid'],
    config: {
      localUrl: process.env.LOCAL_OLLAMA_BASE_URL,
      remoteUrl: process.env.REMOTE_OLLAMA_BASE_URL,
      localModel: process.env.LOCAL_OLLAMA_MODEL,
      remoteModel: process.env.REMOTE_OLLAMA_MODEL
    }
  });
});

// POST to change AI mode
aiModeRouter.post("/", (req: Request, res: Response) => {
  const { mode } = req.body;
  
  logger.info(`[AI Mode API] 📥 POST request to change mode to: ${mode}`);
  
  if (!mode || !['local', 'remote', 'hybrid'].includes(mode)) {
    logger.error(`[AI Mode API] ❌ Invalid mode requested: ${mode}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid mode. Must be one of: local, remote, hybrid'
    });
  }
  
  // Check if remote is configured for remote/hybrid modes
  if ((mode === 'remote' || mode === 'hybrid') && !process.env.REMOTE_OLLAMA_BASE_URL) {
    logger.warn(`[AI Mode API] ⚠️  ${mode} mode requested but REMOTE_OLLAMA_BASE_URL not configured`);
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
