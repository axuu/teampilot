import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";
import { createApp } from "../src/app.js";

const completeJSON = vi.fn();
const llm = { completeJSON };
const app = createApp({ llm }); // 注入假 LLM
beforeEach(async () => { await resetDb(); await seed(); completeJSON.mockReset(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username:"Levin", password:"change-me" }); return a; }

describe("reviews", () => {
  it("saves rawNotes and generates review summary", async () => {
    const act = await prisma.activity.create({ data: { name:"训练", type:"training", status:"ended", location:"x", startTime:new Date() } });
    const agent = await login();
    await agent.put(`/api/admin/activities/${act.id}/review`).send({ rawNotes: "发球进步明显" });
    completeJSON
      .mockResolvedValueOnce(JSON.stringify({ overall:"总结".repeat(40), goalDone:"完成".repeat(30), problems:"问题".repeat(30), improvements:"改进".repeat(30) }))
      .mockResolvedValueOnce(JSON.stringify({ summary:"活动精简总结".repeat(10) }));
    const res = await agent.post(`/api/admin/activities/${act.id}/review/generate`);
    expect(res.status).toBe(200);
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.aiSummary).toBeTruthy();
  });
  it("generates training advice via endpoint", async () => {
    const act = await prisma.activity.create({ data: { name:"训练", type:"training", status:"published", location:"x", startTime:new Date() } });
    const agent = await login();
    completeJSON.mockResolvedValueOnce(JSON.stringify({ goal:"目标".repeat(30), plan:"安排".repeat(60) }));
    const res = await agent.post(`/api/admin/activities/${act.id}/advice`);
    expect(res.status).toBe(200);
    expect(res.body.goal).toContain("目标");
  });
  it("persists advice and returns it on detail; regenerate replaces", async () => {
    const act = await prisma.activity.create({ data: { name:"训练", type:"training", status:"published", location:"x", startTime:new Date() } });
    const agent = await login();
    completeJSON.mockResolvedValueOnce(JSON.stringify({ goal:"目标A".repeat(20), plan:"安排A".repeat(40) }));
    await agent.post(`/api/admin/activities/${act.id}/advice`);
    let detail = await agent.get(`/api/admin/activities/${act.id}`);
    expect(detail.body.advice).toContain("目标A");
    expect(detail.body.adviceUpdatedAt).toBeTruthy();
    completeJSON.mockResolvedValueOnce(JSON.stringify({ goal:"目标B".repeat(20), plan:"安排B".repeat(40) }));
    await agent.post(`/api/admin/activities/${act.id}/advice`);
    detail = await agent.get(`/api/admin/activities/${act.id}`);
    expect(detail.body.advice).toContain("目标B");
    expect(detail.body.advice).not.toContain("目标A");
  });
});
