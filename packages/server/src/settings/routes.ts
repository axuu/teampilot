import { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

const zRules = z.object({ trainingRules: z.string().max(5000), matchRules: z.string().max(5000) });
export const settingsRouter = Router();
settingsRouter.use(requireCaptain);

settingsRouter.get("/", async (_req, res) => {
  const s = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  res.json({ defaultLocation: s?.defaultLocation ?? "", trainingRules: s?.trainingRules ?? "", matchRules: s?.matchRules ?? "" });
});

settingsRouter.put("/", async (req, res) => {
  const parsed = zRules.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  await prisma.teamSettings.update({ where: { id: "singleton" }, data: parsed.data });
  res.json({ ok: true });
});
