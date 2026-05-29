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
});
