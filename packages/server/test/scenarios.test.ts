import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { generateTrainingAdvice, generateMatchAdvice, generateReviewSummary, generateActivitySummary } from "../src/ai/scenarios.js";
import type { LLMClient } from "../src/ai/client.js";

beforeEach(resetDb);
function fakeLLM(json: object): LLMClient { return { completeJSON: vi.fn().mockResolvedValue(JSON.stringify(json)) }; }

async function actWithParticipants(type: string, going: number) {
  const a = await prisma.activity.create({ data: { name: "活动", type, status: "published", location: "x", startTime: new Date(), durationMinutes: 120 } });
  for (let i=0;i<going;i++){ const m = await prisma.member.create({ data: { name:"G"+i, primaryPosition:"tekong", status:"active", feishuOpenId:"ou_"+type+i } }); await prisma.activityParticipant.create({ data: { activityId: a.id, memberId: m.id, attendanceResponse: "going" } }); }
  return a;
}

describe("scenarios", () => {
  it("training advice validates and returns fields", async () => {
    const a = await actWithParticipants("training", 2);
    const llm = fakeLLM({ goal: "目标".repeat(30), plan: "安排".repeat(60) });
    const out = await generateTrainingAdvice(a.id, llm, new Date());
    expect(out.goal).toContain("目标"); expect(out.plan).toContain("安排");
  });
  it("match advice returns strategy/starting/bench", async () => {
    const a = await actWithParticipants("match", 3);
    const llm = fakeLLM({ strategy: "策略".repeat(30), starting: "首发".repeat(30), bench: "替补".repeat(30) });
    const out = await generateMatchAdvice(a.id, llm, new Date());
    expect(out.strategy && out.starting && out.bench).toBeTruthy();
  });
  it("review summary persists aiSummary and bumps activity summary stage (时机B)", async () => {
    const a = await actWithParticipants("training", 1);
    await prisma.activity.update({ where: { id: a.id }, data: { status: "ended" } });
    await prisma.activityReview.create({ data: { activityId: a.id, rawNotes: "今天发球不错" } });
    const reviewLLM = fakeLLM({ overall: "总结".repeat(40), goalDone: "完成".repeat(30), problems: "问题".repeat(30), improvements: "改进".repeat(30) });
    const summaryLLM = fakeLLM({ summary: "精简总结".repeat(20) });
    await generateReviewSummary(a.id, reviewLLM, summaryLLM, new Date());
    const review = await prisma.activityReview.findUnique({ where: { activityId: a.id } });
    const act = await prisma.activity.findUnique({ where: { id: a.id } });
    expect(review?.aiSummary).toBeTruthy();
    expect(act?.summaryStage).toBe("post_review");
    expect(act?.summary).toBeTruthy();
  });
  it("activity summary 时机A sets initial stage", async () => {
    const a = await actWithParticipants("training", 2);
    const llm = fakeLLM({ summary: "发布后总结".repeat(10) });
    await generateActivitySummary(a.id, llm, new Date());
    const act = await prisma.activity.findUnique({ where: { id: a.id } });
    expect(act?.summaryStage).toBe("initial");
  });
});
