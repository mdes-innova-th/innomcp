import { Router } from "express";
import { chatRouter } from "./chat";
import csrfRouter from "./csrf";
import { healthRouter } from "./health";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

// Health Check API route
apiRouter.use("/health", healthRouter);

// URL Stats API routes (middleware applied at app level in src/app.ts)
apiRouter.use("/chat", chatRouter);

export default apiRouter;
