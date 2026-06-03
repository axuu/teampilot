import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { ask, sessionContext } from "../src/assistant/service.js";
import type { LLMClient } from "../src/ai/client.js";

beforeEach(resetDb);

describe("assistant session", () => {
  it("includes only messages within 10 minutes", async () => {
    const now = new Date();
    await prisma.assistantMessage.create({ data: { role:"captain", content:"很久以前", createdAt: new Date(now.getTime()-20*60000) } });
    await prisma.assistantMessage.create({ data: { role:"captain", content:"最近问题", createdAt: new Date(now.getTime()-2*60000) } });
    const ctx = await sessionContext(now);
    expect(ctx.map(m=>m.content)).toContain("最近问题");
    expect(ctx.map(m=>m.content)).not.toContain("很久以前");
  });
  it("ask stores user+ai messages and returns judgment/basis", async () => {
    const llm: LLMClient = { completeJSON: vi.fn().mockResolvedValue(JSON.stringify({ judgment:"判断".repeat(20), basis:"依据".repeat(20) })) };
    const out = await ask("近一月训练情况？", llm, new Date());
    expect(out.judgment).toContain("判断");
    expect(await prisma.assistantMessage.count()).toBe(2);
  });
  it("ask system prompt declares analysis-assistant role and JSON guard", async () => {
    const completeJSON = vi.fn().mockResolvedValue(JSON.stringify({ judgment: "判断".repeat(20), basis: "依据".repeat(20) }));
    await ask("近一月？", { completeJSON } as any, new Date());
    const [system] = (completeJSON as any).mock.calls.at(-1);
    expect(system).toContain("球队管理与训练分析助理");
    expect(system).toContain("judgment");
    expect(system).toContain("只返回 JSON 对象");
  });
  it("ask user prompt carries rules, future activities w/ signup, position & attendance stats", async () => {
    await prisma.teamSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", defaultLocation: "主场", trainingRules: "先热身", matchRules: "稳守" }, update: { trainingRules: "先热身", matchRules: "稳守" } });
    const m = await prisma.member.create({ data: { name: "张三", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_z" } });
    await prisma.activity.create({ data: { name: "下周训练", type: "training", status: "published", location: "主场", startTime: new Date(Date.now() + 3 * 86400000), durationMinutes: 90, participants: { create: [{ memberId: m.id, attendanceResponse: "going" }] } } });
    const completeJSON = vi.fn().mockResolvedValue(JSON.stringify({ judgment: "判断".repeat(20), basis: "依据".repeat(20) }));
    await ask("下一场有多少人去？", { completeJSON } as any, new Date());
    const [, user] = (completeJSON as any).mock.calls.at(-1);
    expect(user).toContain("先热身");
    expect(user).toContain("稳守");
    expect(user).toContain("下周训练");
    expect(user).toContain("已反馈去:张三");
    expect(user).toContain("发球手");
    expect(user).toContain("出勤率");
  });
});
