import { Router } from "express";
import { chatRouter } from "./chat";
import csrfRouter from "./csrf";
import orchestratorRouter from "./orchestrator";
import motherScorecardRouter from "./motherScorecard";
import { getAvailableProviders } from "../../providers/router";
// QUARANTINED 2026-06-12 (Phase 1): analytics/mdesModels/thaiNLP routes were
// MEGA-100 wave hallucinations calling non-existent service methods — never functional.
// Phase 2 (cc-team) will rebuild them against the real service APIs.
import workspaceFileRouter from "./workspace";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

// Health is mounted publicly in app.ts (before apiKeyMiddleware)
// URL Stats API routes (middleware applied at app level in src/app.ts)
apiRouter.use("/chat", chatRouter);
apiRouter.use("/orchestrate", orchestratorRouter);
apiRouter.use("/mother/scorecard", motherScorecardRouter);
// QUARANTINED 2026-06-12 (Phase 1): /analytics /mdes /thai — see import note above
apiRouter.use("/workspace/files", workspaceFileRouter);

// Provider discovery — lists available providers and which are configured
apiRouter.get("/providers", (_req, res) => {
  res.json({
    available: getAvailableProviders(),
    default: "mdes-ollama",
    configured: {
      gpt: !!(process.env.OPENAI_API_KEY || process.env.GPT_API_KEY),
      githubCopilot: !!(process.env.GITHUB_COPILOT_TOKEN || process.env.COPILOT_API_KEY),
      thaiLlm: !!process.env.THAI_LLM_MODEL,
      ollamaLocal: !!(process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL),
    },
  });
});

export default apiRouter;
