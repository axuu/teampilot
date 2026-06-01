import { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import { prisma } from "../db/client.js";
import { loadConfig } from "../config/index.js";

const zRules = z.object({ trainingRules: z.string().max(5000), matchRules: z.string().max(5000) });
export const settingsRouter = Router();
settingsRouter.use(requireCaptain);

function buildFeishuAuthLink(appId: string, h5BaseUrl: string, joinToken: string) {
  const redirectUri = new URL(h5BaseUrl);
  redirectUri.search = "";
  redirectUri.hash = "";

  const authUrl = new URL("https://open.feishu.cn/open-apis/authen/v1/index");
  authUrl.searchParams.set("app_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri.toString());
  authUrl.searchParams.set("state", joinToken);
  return authUrl.toString();
}

settingsRouter.get("/", async (_req, res) => {
  const s = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const cfg = loadConfig();
  const joinLink = buildFeishuAuthLink(cfg.feishuAppId, cfg.h5BaseUrl, cfg.teamJoinToken);
  res.json({ defaultLocation: s?.defaultLocation ?? "", trainingRules: s?.trainingRules ?? "", matchRules: s?.matchRules ?? "", joinLink });
});

settingsRouter.put("/", async (req, res) => {
  const parsed = zRules.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  await prisma.teamSettings.update({ where: { id: "singleton" }, data: parsed.data });
  res.json({ ok: true });
});
