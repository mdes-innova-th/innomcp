import {
  A1_IDLE_TIMEOUT_MS,
  resolveA1Presence,
  resumeA1Presence,
} from "../../../innomcp-next/src/app/components/chat/agentPresence";

describe("chat agent A1 presence helper", () => {
  test("keeps A1 online at exactly 15 minutes idle", () => {
    const now = 1_000_000;
    const snapshot = resolveA1Presence(now, now - A1_IDLE_TIMEOUT_MS);

    expect(snapshot.status).toBe("online");
    expect(snapshot.idleForMs).toBe(A1_IDLE_TIMEOUT_MS);
  });

  test("marks A1 offline after more than 15 minutes idle", () => {
    const now = 1_000_000;
    const snapshot = resolveA1Presence(now, now - A1_IDLE_TIMEOUT_MS - 1);

    expect(snapshot.status).toBe("offline");
    expect(snapshot.idleForMs).toBe(A1_IDLE_TIMEOUT_MS + 1);
  });

  test("resumes A1 online on user interaction", () => {
    const snapshot = resumeA1Presence(2_000_000);

    expect(snapshot.status).toBe("online");
    expect(snapshot.lastActivityAt).toBe(2_000_000);
    expect(snapshot.idleForMs).toBe(0);
  });
});
