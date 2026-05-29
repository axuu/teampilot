import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { loadConfig } from "../config/index.js";
import { zJoinForm } from "@teampilot/shared";
import { exchangeCodeForOpenId, type FeishuAuthClient } from "../feishu/auth.js";

const zBody = z.object({ token: z.string(), code: z.string(), form: zJoinForm });

export function createJoinRouter(feishuAuth: FeishuAuthClient) {
  const router = Router();
  router.post("/join", async (req, res) => {
    const parsed = zBody.safeParse(req.body);
    if (!parsed.success) return res.json({ status: "invalid_link" });
    const cfg = loadConfig();
    if (parsed.data.token !== cfg.teamJoinToken) return res.json({ status: "invalid_link" });

    const openId = await exchangeCodeForOpenId(feishuAuth, parsed.data.code);
    if (!openId) return res.json({ status: "identity_failed" });

    const existing = await prisma.member.findUnique({ where: { feishuOpenId: openId } });
    if (existing) {
      return res.json({ status: existing.status === "left" ? "contact_captain" : "already_joined" });
    }
    await prisma.member.create({ data: { ...parsed.data.form, feishuOpenId: openId, status: "active" } });
    return res.json({ status: "created" });
  });
  return router;
}
