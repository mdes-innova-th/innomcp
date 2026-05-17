export const A1_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export type A1PresenceStatus = "online" | "offline";

export interface A1PresenceSnapshot {
  status: A1PresenceStatus;
  lastActivityAt: number;
  idleForMs: number;
}

export function resolveA1Presence(
  now: number,
  lastActivityAt: number,
  timeoutMs = A1_IDLE_TIMEOUT_MS
): A1PresenceSnapshot {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const safeLast = Number.isFinite(lastActivityAt) ? lastActivityAt : safeNow;
  const idleForMs = Math.max(0, safeNow - safeLast);
  return {
    status: idleForMs > timeoutMs ? "offline" : "online",
    lastActivityAt: safeLast,
    idleForMs,
  };
}

export function resumeA1Presence(now: number): A1PresenceSnapshot {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  return {
    status: "online",
    lastActivityAt: safeNow,
    idleForMs: 0,
  };
}
