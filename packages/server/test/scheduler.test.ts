import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { runAutoEnd } from "../src/scheduler/index.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function makePublished(startOffsetMs: number, duration = 120) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_" + Math.random() } });
  return prisma.activity.create({ data: {
    name: "训练", type: "training", status: "published", location: "x",
    startTime: new Date(Date.now() + startOffsetMs), durationMinutes: duration,
    participants: { create: [{ memberId: m.id, attendanceResponse: "going" }] },
  }});
}

describe("runAutoEnd", () => {
  it("ends activities past start+duration and sets going->pending", async () => {
    const a = await makePublished(-3 * HOUR, 120); // 开始于3h前，时长2h => 已过结束
    await runAutoEnd(new Date());
    const updated = await prisma.activity.findUnique({ where: { id: a.id }, include: { participants: true } });
    expect(updated?.status).toBe("ended");
    expect(updated?.endedAt).toBeTruthy();
    expect(updated?.participants[0].actualAttendance).toBe("pending");
  });
  it("does not end activities still ongoing", async () => {
    const a = await makePublished(-0.5 * HOUR, 120); // 开始30分钟前，未到结束
    await runAutoEnd(new Date());
    expect((await prisma.activity.findUnique({ where: { id: a.id } }))?.status).toBe("published");
  });
  it("is idempotent (second run does not change ended)", async () => {
    const a = await makePublished(-3 * HOUR, 120);
    await runAutoEnd(new Date());
    const first = await prisma.activity.findUnique({ where: { id: a.id } });
    await runAutoEnd(new Date());
    const second = await prisma.activity.findUnique({ where: { id: a.id } });
    expect(second?.endedAt?.getTime()).toBe(first?.endedAt?.getTime());
  });
});
