/**
 * routes/api/motherHandoff.ts — Session handoff document
 *
 * GET /api/mother/handoff
 *
 * Generates a Markdown session handoff document summarizing the current
 * mother dispatch session state. Useful for hand-off to next session.
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";
import { getProviderStats } from "../../services/leaderboardMetrics";
import { getDisabledProviders } from "../../services/motherProviderToggle";

const router = Router();

router.get("/", (_req: Request, res: Response): void => {
  const runs = getHistory(10);
  const stats = getProviderStats();
  const disabled = getDisabledProviders();

  const totalWins = Array.from(stats.values()).reduce((s, v) => s + v.wins, 0);
  const topProvider = Array.from(stats.entries())
    .filter(([, s]) => s.wins > 0)
    .sort((a, b) => b[1].wins - a[1].wins)[0];

  const markdown = `# Mother Dispatch Session Handoff

Generated: ${new Date().toISOString()}

## Summary
- Total dispatches this session: ${runs.length}
- Total provider wins: ${totalWins}
- Top provider: ${topProvider ? `${topProvider[0]} (${topProvider[1].wins} wins)` : "none yet"}
- Disabled providers: ${disabled.length > 0 ? disabled.join(", ") : "none"}
- Active providers with data: ${stats.size}/14

## Recent Runs (last 5)
${runs.slice(0, 5).map(r =>
  `- ${r.timestamp.slice(0, 19)} | ${r.fastestProvider} won | ${r.successCount}/${r.totalProviders} responded | query: "${r.query.slice(0, 50)}"`
).join("\n") || "No runs yet"}

## Provider Standings
${Array.from(stats.entries())
  .sort((a, b) => b[1].wins - a[1].wins)
  .slice(0, 5)
  .map(([id, s]) => `- ${id}: ${s.requests} req, ${s.wins} wins, ${s.successRate}% success, ${s.avgLatency}ms avg`)
  .join("\n") || "No provider data yet"}

## Next Session Priorities
- Push ${runs.length > 0 ? "recent" : "pending"} commits to remote
- Verify innova-oracle gateway (port 8000)
- Continue developing innomcp Manus-like features
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(markdown);
});

export default router;
