import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });

describe("auth", () => {
  it("logs in with correct credentials and returns me", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
    expect(login.status).toBe(200);
    const me = await agent.get("/api/admin/me");
    expect(me.status).toBe(200);
    expect(me.body.displayName).toBe("Levin");
  });
  it("rejects wrong password with unified error (no field hint)", async () => {
    const res = await request(app).post("/api/admin/login").send({ username: "Levin", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("账号或密码错误");
  });
  it("blocks /me without session", async () => {
    const res = await request(app).get("/api/admin/me");
    expect(res.status).toBe(401);
  });
  it("logout clears session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
    await agent.post("/api/admin/logout");
    const me = await agent.get("/api/admin/me");
    expect(me.status).toBe(401);
  });
});
