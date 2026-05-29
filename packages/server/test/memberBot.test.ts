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
});
