import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { recentSummaries } from "../src/ai/context.js";

beforeEach(resetDb);
const DAY = 86400000;

async function ended(name: string, daysAgo: number, opts: { aiSummary?: string; summary?: string }) {
  const a = await prisma.activity.create({ data: { name, type: "training", status: "ended", location: "x", startTime: new Date(Date.now() - daysAgo*DAY), summary: opts.summary ?? null } });
  if (opts.aiSummary !== undefined) await prisma.activityReview.create({ data: { activityId: a.id, rawNotes: "r", aiSummary: opts.aiSummary } });
  return a;
}

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
