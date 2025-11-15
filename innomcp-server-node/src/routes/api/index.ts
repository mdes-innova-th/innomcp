import { Router } from "express";
import csrfRouter from "./csrf";

const apiRouter = Router();
const apiCsrfRouter = Router();

// CSRF Token API route
apiCsrfRouter.use("/csrf", csrfRouter);

export default apiRouter;
