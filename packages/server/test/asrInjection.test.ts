import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const fakeAsr = { transcribe: vi.fn().mockResolvedValue({ text: "注入转写文本" }) };
const app = createApp({ asr: fakeAsr });

beforeEach(async () => { await resetDb(); await seed(); fakeAsr.transcribe.mockClear(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username: "Levin", password: "change-me" }); return a; }

describe("createApp 注入 asr", () => {
  it("transcribe 路由使用注入的 asr，并把文本追加到 rawNotes", async () => {
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", status: "published", location: "x", startTime: new Date() } });
    const agent = await login();
    const res = await agent
      .post(`/api/admin/activities/${act.id}/review/transcribe?filename=rec.mp3`)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("fake-audio-bytes"));
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("注入转写文本");
    expect(fakeAsr.transcribe).toHaveBeenCalledOnce();
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.rawNotes).toContain("rec.mp3 转写内容");
    expect(review?.rawNotes).toContain("注入转写文本");
  });
});
