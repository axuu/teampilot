import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { transcribeToReview } from "../src/asr/service.js";
import type { AsrProvider } from "../src/asr/provider.js";

beforeEach(resetDb);

describe("transcribeToReview", () => {
  it("transcribes and appends to rawNotes with a title line", async () => {
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", status: "ended", location: "x", startTime: new Date() } });
    await prisma.activityReview.create({ data: { activityId: act.id, rawNotes: "已有内容" } });
    const provider: AsrProvider = { transcribe: vi.fn().mockResolvedValue({ text: "转写正文文本" }) };
    const text = await transcribeToReview(act.id, "周日训练.mp3", Buffer.from("x"), provider);
    expect(text).toBe("转写正文文本");
    expect((provider.transcribe as any)).toHaveBeenCalledWith(expect.any(Buffer), "mp3");
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.rawNotes).toContain("已有内容");
    expect(review?.rawNotes).toContain("周日训练.mp3 转写内容");
    expect(review?.rawNotes).toContain("转写正文文本");
  });
  it("creates the review row if missing and appends", async () => {
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", status: "ended", location: "x", startTime: new Date() } });
    const provider: AsrProvider = { transcribe: vi.fn().mockResolvedValue({ text: "首段转写" }) };
    await transcribeToReview(act.id, "a.wav", Buffer.from("x"), provider);
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.rawNotes).toContain("a.wav 转写内容");
    expect(review?.rawNotes).toContain("首段转写");
  });
  it("rejects unsupported format", async () => {
    const provider: AsrProvider = { transcribe: vi.fn() };
    await expect(transcribeToReview("any", "note.txt", Buffer.from("x"), provider)).rejects.toThrow("unsupported_format");
    expect((provider.transcribe as any)).not.toHaveBeenCalled();
  });
});
