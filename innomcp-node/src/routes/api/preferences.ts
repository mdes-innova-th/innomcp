/**
 * routes/api/preferences.ts — User Preferences API (Phase 6)
 *
 * GET /api/preferences → return user prefs (from store or defaults)
 * PUT /api/preferences → partial update, merge with existing
 *
 * Mounted in app.ts at: app.use("/api/preferences", generalRateLimit, preferencesRouter)
 */

import { Router, Response } from "express";
import { optionalAuth, type AuthRequest } from "../../utils/jwt";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserPreferences {
  userId: string;
  theme: "light" | "dark" | "system";
  language: "th" | "en";
  fontSize: "sm" | "md" | "lg";
  chatMode: "local" | "remote" | "hybrid";
  showTimestamps: boolean;
  compactMode: boolean;
  updatedAt: string;
}

// ─── In-memory store (same pattern as plugins/webhooks/templates) ─────────────

const store = new Map<string, UserPreferences>();

function getDefaults(userId: string): UserPreferences {
  return {
    userId,
    theme: "system",
    language: "th",
    fontSize: "md",
    chatMode: "remote",
    showTimestamps: false,
    compactMode: false,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();
router.use(optionalAuth);

function resolvePreferenceUserId(req: AuthRequest): string {
  if (req.user?.userId != null) return String(req.user.userId);
  if ((req as any).apiKeyData?.apikey_id != null) {
    return `api:${String((req as any).apiKeyData.apikey_id)}`;
  }
  return "guest";
}

// GET /api/preferences
router.get("/", (req: AuthRequest, res: Response) => {
  const userId = resolvePreferenceUserId(req);
  const key = `user:${userId}`;
  const prefs = store.get(key) ?? getDefaults(userId);
  res.json({ preferences: prefs });
});

// PUT /api/preferences
router.put("/", (req: AuthRequest, res: Response) => {
  const userId = resolvePreferenceUserId(req);
  const key = `user:${userId}`;
  const body = req.body as Partial<Omit<UserPreferences, "userId" | "updatedAt">>;

  const existing = store.get(key) ?? getDefaults(userId);

  // Validate allowed values for enum fields
  if (body.theme !== undefined && !["light", "dark", "system"].includes(body.theme)) {
    return res.status(400).json({ error: "theme must be light | dark | system" });
  }
  if (body.language !== undefined && !["th", "en"].includes(body.language)) {
    return res.status(400).json({ error: "language must be th | en" });
  }
  if (body.fontSize !== undefined && !["sm", "md", "lg"].includes(body.fontSize)) {
    return res.status(400).json({ error: "fontSize must be sm | md | lg" });
  }
  if (body.chatMode !== undefined && !["local", "remote", "hybrid"].includes(body.chatMode)) {
    return res.status(400).json({ error: "chatMode must be local | remote | hybrid" });
  }

  const updated: UserPreferences = {
    ...existing,
    ...body,
    userId,
    updatedAt: new Date().toISOString(),
  };

  store.set(key, updated);
  res.json({ preferences: updated });
});

export default router;
