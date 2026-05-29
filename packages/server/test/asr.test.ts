import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { createAsrJob, pollAsrJobs } from "../src/asr/service.js";
import type { AsrProvider } from "../src/asr/provider.js";

beforeEach(resetDb);

describe("asr", () => {
  it("creates a transcribing job after upload+submit", async () => {
    const act = await prisma.activity.create({ data: { name:"训练", type:"training", status:"ended", location:"x", startTime:new Date() } });
    const provider: AsrProvider = { uploadAndSubmit: vi.fn().mockResolvedValue({ tosUrl:"tos://a.wav", taskId:"t1" }), queryResult: vi.fn() };
    const job = await createAsrJob(act.id, "周日训练.wav", Buffer.from("x"), provider);
    expect(job.status).toBe("transcribing");
    expect(job.volcTaskId).toBe("t1");
  });
  it("poll appends transcript to rawNotes with title line on success", async () => {
    const act = await prisma.activity.create({ data: { name:"训练", type:"training", status:"ended", location:"x", startTime:new Date() } });
    await prisma.activityReview.create({ data: { activityId: act.id, rawNotes: "已有内容" } });
    const job = await prisma.asrJob.create({ data: { activityId: act.id, fileName: "周日训练.wav", tosUrl:"tos://a", volcTaskId:"t1", status:"transcribing" } });
    const provider: AsrProvider = { uploadAndSubmit: vi.fn(), queryResult: vi.fn().mockResolvedValue({ done:true, text:"转写正文文本" }) };
    await pollAsrJobs(provider);
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.rawNotes).toContain("已有内容");
    expect(review?.rawNotes).toContain("周日训练.wav 转写内容");
    expect(review?.rawNotes).toContain("转写正文文本");
    expect((await prisma.asrJob.findUnique({ where: { id: job.id } }))?.status).toBe("succeeded");
  });
});
