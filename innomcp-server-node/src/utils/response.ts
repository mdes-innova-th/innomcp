import { Response } from "express";

// Utility function for sending successful responses
export function sendResponse(res: Response, status: number = 200, data: any = {}) {
  return res.status(status).json({
    success: true,
    data
  });
}

// Utility function for sending error responses
export function sendErrorResponse(res: Response, status: number = 500, message: string = "An error occurred") {
  return res.status(status).json({
    success: false,
    error: message
  });
}