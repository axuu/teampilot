import express, { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import { prisma } from "../db/client.js";
import type { LLMClient } from "../ai/client.js";
import { generateTrainingAdvice, generateMatchAdvice, generateReviewSummary } from "../ai/scenarios.js";
import { volcAsrProvider, type AsrProvider } from "../asr/provider.js";
import { transcribeToReview } from "../asr/service.js";

const zNotes = z.object({ rawNotes: z.string().max(50000) });

export function makeReviewsRouter(llm: LLMClient, asr: AsrProvider = volcAsrProvider) {
  const r = Router();
  r.use(requireCaptain);

  r.get("/:id/review", async (req, res) => {
    const review = await prisma.activityReview.findUnique({ where: { activityId: req.params.id } });
    res.json(review ?? { activityId: req.params.id, rawNotes: "", aiSummary: null });
  });

  r.put("/:id/review", async (req, res) => {
    const parsed = zNotes.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "校验失败" });
    const review = await prisma.activityReview.upsert({ where: { activityId: req.params.id }, update: { rawNotes: parsed.data.rawNotes }, create: { activityId: req.params.id, rawNotes: parsed.data.rawNotes } });
    res.json(review);
  });

  r.post("/:id/review/generate", async (req, res) => {
    const review = await prisma.activityReview.findUnique({ where: { activityId: req.params.id } });
    if (!review) return res.status(404).json({ error: "请先保存复盘记录" });
    try { res.json(await generateReviewSummary(req.params.id, llm, llm, new Date())); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  r.post("/:id/advice", async (req, res) => {
    const act = await prisma.activity.findUnique({ where: { id: req.params.id } });
    if (!act) return res.status(404).json({ error: "活动不存在" });
    try {
      const out = act.type === "training" ? await generateTrainingAdvice(act.id, llm, new Date()) : await generateMatchAdvice(act.id, llm, new Date());
      res.json(out);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  r.post("/:id/review/transcribe", express.raw({ type: "*/*", limit: "60mb" }), async (req, res) => {
    const fileName = String(req.query.filename ?? "audio.mp3");
    try {
      const text = await transcribeToReview(req.params.id, fileName, req.body as Buffer, asr);
      res.json({ text });
    } catch (e) {
      const m = (e as Error).message;
      res.status(400).json({ error: m === "unsupported_format" ? "仅支持 mp3/wav/ogg/m4a" : "转写失败，请重试" });
    }
  });

  return r;
}
