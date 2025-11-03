import { Router } from "express";
import urlStatsRouter from "./urlstats";
import csrfRouter from "./csrf";
import urlGambleRouter from "./urlgamble";
import urlSearchRouter from "./urlsearch";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

// URL Stats API routes (middleware applied at app level in src/app.ts)
apiRouter.use("/urlstats", urlStatsRouter);

// URL fetch gamble list API route
apiRouter.use("/urlgamble", urlGambleRouter);

// URL search endpoint
apiRouter.use("/urlsearch", urlSearchRouter);

export default apiRouter;
