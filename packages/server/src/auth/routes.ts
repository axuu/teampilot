import { Router } from "express";
import { z } from "zod";
import { verifyCaptain } from "./service.js";
import { requireCaptain } from "./middleware.js";
import { prisma } from "../db/client.js";

const zLogin = z.object({ username: z.string(), password: z.string() });

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = zLogin.safeParse(req.body);
  if (!parsed.success) return res.status(401).json({ error: "账号或密码错误" });
  const cap = await verifyCaptain(parsed.data.username, parsed.data.password);
  if (!cap) return res.status(401).json({ error: "账号或密码错误" });
  req.session!.captainId = cap.id;
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

authRouter.get("/me", requireCaptain, async (req, res) => {
  const cap = await prisma.captain.findUnique({ where: { id: req.session!.captainId } });
  if (!cap) return res.status(401).json({ error: "未登录" });
  res.json({ displayName: cap.displayName });
});
