import "express-async-errors";
import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config/index.js";
import { authRouter } from "./auth/routes.js";
import { membersRouter } from "./members/routes.js";
import { makeActivitiesRouter } from "./activities/routes.js";
import { attendanceRouter } from "./attendance/routes.js";
import { larkAuthClient, type FeishuAuthClient } from "./feishu/auth.js";
import { larkNotifier, type FeishuNotifier } from "./feishu/notify.js";
import { createJoinRouter } from "./members/join.js";
import { settingsRouter } from "./settings/routes.js";
import { arkClient, type LLMClient } from "./ai/client.js";
import { makeReviewsRouter } from "./reviews/routes.js";
import { volcAsrProvider, type AsrProvider } from "./asr/provider.js";
import { makeAssistantRouter } from "./assistant/routes.js";

declare global {
  namespace Express {
    interface Request { session: (CookieSessionInterfaces.CookieSessionObject & { captainId?: string }) | null; }
  }
}

export function createApp(deps: { feishuAuth?: FeishuAuthClient; notifier?: FeishuNotifier; llm?: LLMClient; asr?: AsrProvider } = {}) {
  const feishuAuth = deps.feishuAuth ?? larkAuthClient;
  const notifier = deps.notifier ?? larkNotifier;
  const llm = deps.llm ?? arkClient;
  const asr = deps.asr ?? volcAsrProvider;
  const config = loadConfig();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieSession({ name: "tp", secret: config.sessionSecret, httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000, secure: process.env.NODE_ENV === "production" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/admin", authRouter);
  app.use("/api/admin/members", membersRouter);
  app.use("/api/admin/activities", makeActivitiesRouter(notifier, llm));
  app.use("/api/admin/activities", attendanceRouter);
  app.use("/api/admin/activities", makeReviewsRouter(llm, asr));
  app.use("/api/admin/settings", settingsRouter);
  app.use("/api/admin/assistant", makeAssistantRouter(llm));
  app.use("/api/h5", createJoinRouter(feishuAuth));
  app.use((err: unknown, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
    console.error("未处理错误:", err);
    res.status(500).json({ error: "服务器错误" });
  });
  return app;
}
