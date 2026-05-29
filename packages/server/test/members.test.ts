import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const app = createApp();
async function login() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
  return agent;
}
async function makeMember(over: Partial<{ name: string; primaryPosition: string; status: string; openId: string }> = {}) {
  return prisma.member.create({ data: {
    name: over.name ?? "张三", primaryPosition: over.primaryPosition ?? "tekong",
    status: over.status ?? "active", feishuOpenId: over.openId ?? "ou_" + Math.random(),
  }});
}

beforeEach(async () => { await resetDb(); await seed(); });

describe("members", () => {
  it("requires login", async () => {
    expect((await request(app).get("/api/admin/members")).status).toBe(401);
  });
  it("lists and filters by status and position", async () => {
    await makeMember({ name: "A", primaryPosition: "tekong", status: "active" });
    await makeMember({ name: "B", primaryPosition: "striker", status: "left" });
    const agent = await login();
    const all = await agent.get("/api/admin/members");
    expect(all.body.length).toBe(2);
    const active = await agent.get("/api/admin/members?status=active");
    expect(active.body.length).toBe(1);
    const strikers = await agent.get("/api/admin/members?position=striker");
    expect(strikers.body.length).toBe(1);
  });
  it("updates a member; rejects captainNote > 100 chars", async () => {
    const m = await makeMember();
    const agent = await login();
    const ok = await agent.put(`/api/admin/members/${m.id}`).send({ name: "新名", primaryPosition: "feeder", status: "active", captainNote: "好球员" });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe("新名");
    const bad = await agent.put(`/api/admin/members/${m.id}`).send({ name: "x", primaryPosition: "feeder", status: "active", captainNote: "y".repeat(101) });
    expect(bad.status).toBe(400);
  });
});
