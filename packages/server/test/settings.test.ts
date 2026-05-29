import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username:"Levin", password:"change-me" }); return a; }

describe("settings", () => {
  it("reads defaults and saves rules", async () => {
    const agent = await login();
    const r1 = await agent.get("/api/admin/settings");
    expect(r1.body.defaultLocation).toBeTruthy();
    await agent.put("/api/admin/settings").send({ trainingRules: "必含发球", matchRules: "保 Tekong" });
    const r2 = await agent.get("/api/admin/settings");
    expect(r2.body.trainingRules).toBe("必含发球");
    expect(r2.body.matchRules).toBe("保 Tekong");
  });
});
