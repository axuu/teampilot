import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { answerMemberQuestion } from "../src/ai/memberBot.js";
import type { LLMClient } from "../src/ai/client.js";

beforeEach(resetDb);
const llm: LLMClient = { completeJSON: vi.fn().mockResolvedValue(JSON.stringify({ answer: "下一场是周日训练" })) };

describe("answerMemberQuestion", () => {
  it("rejects non-member / left member", async () => {
    const out = await answerMemberQuestion("ou_unknown", "下一场什么时候", llm, new Date());
    expect(out).toMatch(/联系队长/);
  });
  it("answers active member with public context (no captainNote leaked)", async () => {
    const m = await prisma.member.create({ data: { name:"甲", primaryPosition:"tekong", status:"active", feishuOpenId:"ou_a", captainNote:"内部备注秘密" } });
    await prisma.activity.create({ data: { name:"周日训练", type:"training", status:"published", location:"二操场", startTime:new Date(Date.now()+86400000), participants:{ create:[{ memberId:m.id, attendanceResponse:"going" }] } } });
    const out = await answerMemberQuestion("ou_a", "下一场什么时候", llm, new Date());
    expect(out).toContain("周日训练");
    const userArg = (llm.completeJSON as any).mock.calls.at(-1)[1] as string;
    expect(userArg).not.toContain("内部备注秘密");
  });
  it("falls back to activity.summary when no review aiSummary", async () => {
    await prisma.member.create({ data: { name: "丙", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_fb" } });
    await prisma.activity.create({ data: { name: "旧训练", type: "training", status: "ended", location: "x", startTime: new Date(Date.now()-86400000), summary: "上次活动的公开总结" } });
    await answerMemberQuestion("ou_fb", "上次复盘", llm, new Date());
    const userArg = (llm.completeJSON as any).mock.calls.at(-1)[1] as string;
    expect(userArg).toContain("上次活动的公开总结");
  });
  it("prefers review.aiSummary over activity.summary", async () => {
    await prisma.member.create({ data: { name: "丁", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_pref" } });
    const a = await prisma.activity.create({ data: { name: "旧训练2", type: "training", status: "ended", location: "x", startTime: new Date(Date.now()-86400000), summary: "活动总结X" } });
    await prisma.activityReview.create({ data: { activityId: a.id, rawNotes: "r", aiSummary: "AI复盘摘要Y" } });
    await answerMemberQuestion("ou_pref", "上次复盘", llm, new Date());
    const userArg = (llm.completeJSON as any).mock.calls.at(-1)[1] as string;
    expect(userArg).toContain("AI复盘摘要Y");
    expect(userArg).not.toContain("活动总结X");
  });
  it("uses Chinese position label and rich next-activity fields", async () => {
    const m = await prisma.member.create({ data: { name: "小李", primaryPosition: "feeder", level: "intermediate", status: "active", feishuOpenId: "ou_li" } });
    await prisma.activity.create({ data: { name: "周三训练", type: "training", status: "published", location: "体育馆", startTime: new Date(Date.now() + 2 * 86400000), durationMinutes: 100, theme: "二传配合", notes: "带护膝", participants: { create: [{ memberId: m.id, attendanceResponse: "no_response" }] } } });
    await answerMemberQuestion("ou_li", "下一场预计多久", llm, new Date());
    const userArg = (llm.completeJSON as any).mock.calls.at(-1)[1] as string;
    expect(userArg).toContain("主要位置：二传手");
    expect(userArg).toContain("100分钟");
    expect(userArg).toContain("二传配合");
    expect(userArg).toContain("带护膝");
    expect(userArg).toContain("发球手");
  });
  it("lists unresponded activities and public going roster", async () => {
    const me = await prisma.member.create({ data: { name: "我", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_me" } });
    const mate = await prisma.member.create({ data: { name: "队友A", primaryPosition: "striker", status: "active", feishuOpenId: "ou_t" } });
    await prisma.activity.create({ data: { name: "待反馈赛", type: "match", status: "published", location: "x", startTime: new Date(Date.now() + 86400000), participants: { create: [{ memberId: me.id, attendanceResponse: "no_response" }, { memberId: mate.id, attendanceResponse: "going" }] } } });
    await answerMemberQuestion("ou_me", "这次有哪些人去", llm, new Date());
    const userArg = (llm.completeJSON as any).mock.calls.at(-1)[1] as string;
    expect(userArg).toContain("已反馈去:队友A");
    expect(userArg).toContain("你尚未反馈的活动");
    expect(userArg).toContain("待反馈赛");
  });
  it("system prompt allows public signup roster + JSON guard", async () => {
    await prisma.member.create({ data: { name: "甲", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_sys" } });
    await answerMemberQuestion("ou_sys", "随便问", llm, new Date());
    const [system] = (llm.completeJSON as any).mock.calls.at(-1);
    expect(system).toContain("报名名单");
    expect(system).toContain("只返回 JSON 对象");
  });
});
