/**
 * routes/api/motherIntentLeaders.ts — Best provider per intent type
 *
 * GET /api/mother/intent-leaders
 *
 * Returns which provider wins most often for each intent type.
 * Useful for showing "Best for Thai", "Best for Code", etc.
 *
 * Response:
 *   { leaders: IntentLeader[], intents: string[], timestamp: string }
 */

import { Router, Request, Response } from "express";
import { getIntentWinsSnapshot } from "../../services/leaderboardMetrics";

const router = Router();

const INTENT_LABELS: Record<string, string> = {
  "greeting":       "Greetings",
  "knowledge":      "Knowledge",
  "code":           "Code",
  "weather":        "Weather",
  "geo":            "Geography",
  "planning-broad": "Planning",
  "general":        "General",
  "thinking":       "Deep Think",
};

interface IntentLeader {
  intent: string;
  intentLabel: string;
  leaderId: string;
  wins: number;
  totalContenders: number;
}

router.get("/", (_req: Request, res: Response): void => {
  const snapshot = getIntentWinsSnapshot(); // Map<intent, Map<providerId, wins>>

  const leaders: IntentLeader[] = [];

  for (const [intent, providerMap] of snapshot.entries()) {
    let topId = "";
    let topWins = 0;
    for (const [pid, w] of providerMap.entries()) {
      if (w > topWins) { topWins = w; topId = pid; }
    }
    if (topId) {
      leaders.push({
        intent,
        intentLabel: INTENT_LABELS[intent] ?? intent,
        leaderId: topId,
        wins: topWins,
        totalContenders: providerMap.size,
      });
    }
  }

  leaders.sort((a, b) => b.wins - a.wins);

  res.json({
    leaders,
    intents: leaders.map((l) => l.intent),
    timestamp: new Date().toISOString(),
  });
});

export default router;
