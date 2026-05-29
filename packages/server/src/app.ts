import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config/index.js";
import { authRouter } from "./auth/routes.js";
import { membersRouter } from "./members/routes.js";
import { larkAuthClient, type FeishuAuthClient } from "./feishu/auth.js";
import { createJoinRouter } from "./members/join.js";

declare global {
  namespace Express {
    interface Request { session: (CookieSessionInterfaces.CookieSessionObject & { captainId?: string }) | null; }
  }
}

export function createApp(deps: { feishuAuth?: FeishuAuthClient } = {}) {
  const feishuAuth = deps.feishuAuth ?? larkAuthClient;
  const config = loadConfig();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieSession({ name: "tp", secret: config.sessionSecret, httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000, secureProxy: process.env.NODE_ENV === "production" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/admin", authRouter);
  app.use("/api/admin/members", membersRouter);
  app.use("/api/h5", createJoinRouter(feishuAuth));
  return app;
}
