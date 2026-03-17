import { Router } from "express";
import { chatRouter } from "./chat";
import csrfRouter from "./csrf";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

// Health is mounted publicly in app.ts (before apiKeyMiddleware)
// URL Stats API routes (middleware applied at app level in src/app.ts)
apiRouter.use("/chat", chatRouter);

export default apiRouter;
