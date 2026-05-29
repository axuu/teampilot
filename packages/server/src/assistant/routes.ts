import { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import type { LLMClient } from "../ai/client.js";
import { ask, listMessages } from "./service.js";

export function makeAssistantRouter(llm: LLMClient) {
  const r = Router();
  r.use(requireCaptain);
  r.get("/messages", async (_req, res) => res.json(await listMessages()));
  r.post("/ask", async (req, res) => {
    const parsed = z.object({ question: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "问题不能为空" });
    try { res.json(await ask(parsed.data.question, llm, new Date())); }
    catch (e) { res.status(500).json({ error: "生成失败，请重试" }); }
  });
  return r;
}
