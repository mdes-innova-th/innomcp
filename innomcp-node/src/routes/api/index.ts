import { Router } from "express";
import urlStatsRouter from "./urlstats";
import csrfRouter from "./csrf";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

// URL Stats API routes (middleware applied at app level in src/app.ts)
apiRouter.use("/urlstats", urlStatsRouter);

export default apiRouter;
