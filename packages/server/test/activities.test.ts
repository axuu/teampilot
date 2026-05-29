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
async function mkActive(name: string) {
  return prisma.member.create({ data: { name, primaryPosition: "tekong", status: "active", feishuOpenId: "ou_" + name } });
}

beforeEach(async () => { await resetDb(); await seed(); });

describe("activities draft", () => {
  it("creates a draft: duration default 120, location defaults to team default, all active preselected", async () => {
    await mkActive("A"); await mkActive("B");
    await prisma.member.create({ data: { name: "C", primaryPosition: "feeder", status: "left", feishuOpenId: "ou_C" } });
    const agent = await login();
    const res = await agent.post("/api/admin/activities").send({ name: "周日训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.durationMinutes).toBe(120);
    expect(res.body.location).toBeTruthy();
    const detail = await agent.get(`/api/admin/activities/${res.body.id}`);
    expect(detail.body.participants.length).toBe(2); // 仅 active，C 离队不入
  });
  it("filters list by type and status", async () => {
    const agent = await login();
    await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    await agent.post("/api/admin/activities").send({ name: "比赛", type: "match", startTime: "2026-06-02T06:30:00.000Z" });
    const matches = await agent.get("/api/admin/activities?type=match");
    expect(matches.body.length).toBe(1);
    const drafts = await agent.get("/api/admin/activities?status=draft");
    expect(drafts.body.length).toBe(2);
  });
  it("updates participants selection", async () => {
    const a = await mkActive("A"); const b = await mkActive("B");
    const agent = await login();
    const res = await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    await agent.put(`/api/admin/activities/${res.body.id}`).send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z", participantIds: [a.id] });
    const detail = await agent.get(`/api/admin/activities/${res.body.id}`);
    expect(detail.body.participants.length).toBe(1);
    expect(detail.body.participants[0].memberId).toBe(a.id);
  });
  it("rejects editing a non-draft activity with 409", async () => {
    const agent = await login();
    const res = await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    await prisma.activity.update({ where: { id: res.body.id }, data: { status: "published" } });
    const put = await agent.put(`/api/admin/activities/${res.body.id}`).send({ name: "改", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    expect(put.status).toBe(409);
  });
});
