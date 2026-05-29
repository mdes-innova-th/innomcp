import express from "express";
import request from "supertest";

import { generateAccessToken } from "../../src/utils/jwt";
import preferencesRouter from "../../src/routes/api/preferences";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/preferences", preferencesRouter);
  return app;
}

describe("preferences route user scoping", () => {
  it("keeps guest preferences separate from authenticated user preferences", async () => {
    const app = makeApp();
    const user1Token = generateAccessToken({
      userId: 101,
      userEmail: "user1@example.com",
      userRoleId: 2,
      userDispName: "User One",
    });
    const user2Token = generateAccessToken({
      userId: 202,
      userEmail: "user2@example.com",
      userRoleId: 2,
      userDispName: "User Two",
    });

    const guestBefore = await request(app).get("/api/preferences");
    expect(guestBefore.status).toBe(200);
    expect(guestBefore.body.preferences.userId).toBe("guest");
    expect(guestBefore.body.preferences.theme).toBe("system");

    const updateUser1 = await request(app)
      .put("/api/preferences")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({ theme: "dark", compactMode: true });

    expect(updateUser1.status).toBe(200);
    expect(updateUser1.body.preferences.userId).toBe("101");
    expect(updateUser1.body.preferences.theme).toBe("dark");
    expect(updateUser1.body.preferences.compactMode).toBe(true);

    const fetchUser1 = await request(app)
      .get("/api/preferences")
      .set("Authorization", `Bearer ${user1Token}`);
    expect(fetchUser1.status).toBe(200);
    expect(fetchUser1.body.preferences.userId).toBe("101");
    expect(fetchUser1.body.preferences.theme).toBe("dark");

    const fetchUser2 = await request(app)
      .get("/api/preferences")
      .set("Authorization", `Bearer ${user2Token}`);
    expect(fetchUser2.status).toBe(200);
    expect(fetchUser2.body.preferences.userId).toBe("202");
    expect(fetchUser2.body.preferences.theme).toBe("system");

    const guestAfter = await request(app).get("/api/preferences");
    expect(guestAfter.status).toBe(200);
    expect(guestAfter.body.preferences.userId).toBe("guest");
    expect(guestAfter.body.preferences.theme).toBe("system");
  });
});
