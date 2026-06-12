<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-5 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":60,"completion_tokens":3918,"total_tokens":3978,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4024,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 184s
 generated: 2026-06-12T03:51:27.952Z -->
import { Request, Response, NextFunction } from "express";

type Schema = Record<string, string>;

function checkType(value: unknown, expected: string): boolean {
  if (expected === "array") {
    return Array.isArray(value);
  }
  if (expected === "null") {
    return value === null;
  }
  if (expected === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  if (expected === "number") {
    return typeof value === "number" && !Number.isNaN(value);
  }
  return typeof value === expected;
}

export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body || {};
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const [field, expectedType] of Object.entries(schema)) {
      if (body[field] === undefined) {
        missing.push(field);
        continue;
      }
      if (!checkType(body[field], expectedType)) {
        invalid.push(field);
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      res.status(400).json({ missing, invalid });
      return;
    }

    next();
  };
}
