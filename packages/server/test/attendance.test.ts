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
beforeEach(async () => { await resetDb(); await seed(); });

describe("attendance marking", () => {
  it("marks present/absent for a participant", async () => {
    const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", startTime: new Date(), location: "x", status: "ended", participants: { create: [{ memberId: m.id, actualAttendance: "pending" }] } } });
    const agent = await login();
    const res = await agent.post(`/api/admin/activities/${act.id}/participants/${m.id}/attendance`).send({ value: "present" });
    expect(res.status).toBe(200);
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: act.id, memberId: m.id } });
    expect(p?.actualAttendance).toBe("present");
  });
  it("rejects invalid value", async () => {
    const agent = await login();
    const res = await agent.post(`/api/admin/activities/x/participants/y/attendance`).send({ value: "maybe" });
    expect(res.status).toBe(400);
  });
  it("rejects marking attendance on a non-ended activity with 409", async () => {
    const m = await prisma.member.create({ data: { name: "B", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_B" } });
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", startTime: new Date(), location: "x", status: "published", participants: { create: [{ memberId: m.id }] } } });
    const agent = await login();
    const res = await agent.post(`/api/admin/activities/${act.id}/participants/${m.id}/attendance`).send({ value: "present" });
    expect(res.status).toBe(409);
  });
});
