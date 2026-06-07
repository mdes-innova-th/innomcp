// innomcp-node/src/middleware/globalErrorHandler.ts
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Global Error Handler Middleware for Express.
 * This should be the last middleware added to the app.
 */
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_SERVER_ERROR";

  // Log the error with full stack trace
  logger.error(`[Global Error] ${message}`, {
    url: req.originalUrl,
    method: req.method,
    status,
    code,
    stack: err.stack,
  });

  // Respond with standardized JSON error
  res.status(status).json({
    error: {
      message,
      code,
      status,
    },
  });
};
