
import { Router } from "express";
import { getGodTierRouter } from "../../utils/mcp/godTierRouter";
import { detectEmotion } from "../../utils/emotionDetector";
import logger from "../../utils/logger";

const router = Router();

// POST /api/debug/selection
// Test the GodTierRouter selection logic
router.post("/selection", async (req, res) => {
  try {
    const { text, history = [] } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    // 1. Emotion Detection
    const emotionResult = detectEmotion(text);

    // 2. GodTier Router
    const godTierRouter = getGodTierRouter();
    const startTime = Date.now();
    
    // Mock clients map if needed (GodTierRouter uses it for some internal checks, but route() mainly uses LLM)
    // Actually getGodTierRouter returns the singleton which should be initialized.
    
    const routingResult = await godTierRouter.route(text, history);
    const latency = Date.now() - startTime;

    res.json({
      input: text,
      emotion: emotionResult,
      router: {
        category: routingResult.category,
        confidence: routingResult.confidence,
        reasoning: routingResult.reasoning,
        isAmbiguous: routingResult.isAmbiguous,
        matchedKeywords: routingResult.matchedKeywords,
        keywordScore: routingResult.keywordScore,
        semanticScore: routingResult.semanticScore,
        latencyMs: latency
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error(`Debug selection error: ${error.message}`);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;
