import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { handleCardAction } from "../src/feishu/events.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function scenario(status: string, startOffsetMs: number) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
  const a = await prisma.activity.create({ data: { name: "训练", type: "training", status, location: "x", startTime: new Date(Date.now()+startOffsetMs), participants: { create: [{ memberId: m.id }] } } });
  return { m, a };
}
const event = (openId: string, activityId: string, response: string) => ({ operator: { open_id: openId }, action: { value: { activityId, response } } });

describe("handleCardAction", () => {
  it("updates response when published and before start", async () => {
    const { m, a } = await scenario("published", 24 * HOUR);
    const out = await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    expect(out.text).toContain("去");
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: a.id, memberId: m.id } });
    expect(p?.attendanceResponse).toBe("going");
  });
  it("is idempotent on repeat click", async () => {
    const { a } = await scenario("published", 24 * HOUR);
    await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    const count = await prisma.activityParticipant.count({ where: { activityId: a.id } });
    expect(count).toBe(1);
  });
  it("does NOT modify after start time, only returns status", async () => {
    const { a, m } = await scenario("published", -1 * HOUR); // 已过开始
    const out = await handleCardAction(event("ou_A", a.id, "not_going") as any, new Date());
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: a.id, memberId: m.id } });
    expect(p?.attendanceResponse).toBe("no_response"); // 未被修改
    expect(out.text).toContain("已开始");
  });
  it("ended/cancelled activity only returns status", async () => {
    const { a } = await scenario("cancelled", 24 * HOUR);
    const out = await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    expect(out.text).toMatch(/已取消|不可/);
  });
});
