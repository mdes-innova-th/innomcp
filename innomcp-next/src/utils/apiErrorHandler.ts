// innomcp-next/src/utils/apiErrorHandler.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "./serverLogger";

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Wrapper for Next.js App Router API routes to provide global error handling.
 * It catches all thrown errors, logs them via serverLogger, and returns a
 * standardized JSON error response.
 */
export function withErrorHandler(handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (error: any) {
      const status = error.status || 500;
      const message = error.message || "Internal Server Error";
      const code = error.code || "INTERNAL_SERVER_ERROR";

      // Log the error with full stack trace via serverLogger
      logger.error(`API Route Error: ${message}`, {
        url: req.url,
        method: req.method,
        status,
        code,
        error,
      });

      return NextResponse.json(
        {
          error: {
            message,
            code,
            status,
          },
        },
        { status }
      );
    }
  };
}
