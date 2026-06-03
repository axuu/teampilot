import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { recentSummaries, positionBreakdown, memberAttendanceStats } from "../src/ai/context.js";

beforeEach(resetDb);
const DAY = 86400000;

async function ended(name: string, daysAgo: number, opts: { aiSummary?: string; summary?: string }) {
  const a = await prisma.activity.create({ data: { name, type: "training", status: "ended", location: "x", startTime: new Date(Date.now() - daysAgo*DAY), summary: opts.summary ?? null } });
  if (opts.aiSummary !== undefined) await prisma.activityReview.create({ data: { activityId: a.id, rawNotes: "r", aiSummary: opts.aiSummary } });
  return a;
}

describe("positionBreakdown", () => {
  it("counts active members by primary position with Chinese labels", () => {
    const out = positionBreakdown([
      { primaryPosition: "tekong" }, { primaryPosition: "tekong" }, { primaryPosition: "feeder" }, { primaryPosition: "striker" },
    ]);
    expect(out).toBe("发球手 2 人，二传手 1 人，攻球手 1 人");
  });
});

describe("memberAttendanceStats", () => {
  it("computes present rate over ended activities within window", async () => {
    const m = await prisma.member.create({ data: { name: "甲", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_stat" } });
    const a = await prisma.activity.create({ data: { name: "上次训练", type: "training", status: "ended", location: "x", startTime: new Date(Date.now() - 3 * DAY) } });
    await prisma.activityParticipant.create({ data: { activityId: a.id, memberId: m.id, attendanceResponse: "going", actualAttendance: "present" } });
    const stats = await memberAttendanceStats(new Date(), 30);
    const s = stats.find((x) => x.name === "甲")!;
    expect(s.going).toBe(1);
    expect(s.present).toBe(1);
    expect(s.rate).toBe(100);
  });
});

describe("recentSummaries", () => {
  it("prefers aiSummary, falls back to activity summary", async () => {
    await ended("有复盘", 1, { aiSummary: "AI总结A", summary: "活动总结A" });
    await ended("无复盘", 2, { summary: "活动总结B" });
    const out = await recentSummaries(new Date());
    expect(out[0].content).toBe("AI总结A"); // 倒序，最近优先
    expect(out[1].content).toBe("活动总结B"); // fallback
  });
  it("only includes ended activities within 2 months, max 8, desc", async () => {
    for (let i = 0; i < 10; i++) await ended("A"+i, i+1, { summary: "s"+i });
    await ended("太久", 70, { summary: "old" }); // >2月，排除
    const out = await recentSummaries(new Date());
    expect(out.length).toBe(8);
    expect(out.find(o=>o.content==="old")).toBeUndefined();
  });
});
