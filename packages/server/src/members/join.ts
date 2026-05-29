import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
    try {
      await prisma.member.create({ data: { ...parsed.data.form, feishuOpenId: openId, status: "active" } });
      return res.json({ status: "created" });
    } catch (e) {
      // 并发/双击：唯一约束冲突说明已被另一请求创建 → 视为已加入
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return res.json({ status: "already_joined" });
      }
      console.error("入队创建失败:", e);
      return res.status(500).json({ status: "error" });
    }
  });
  return router;
}
