import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config/index.js";
import { authRouter } from "./auth/routes.js";

declare global {
  namespace Express {
    interface Request { session: (CookieSessionInterfaces.CookieSessionObject & { captainId?: string }) | null; }
  }
}

export function createApp() {
  const config = loadConfig();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieSession({ name: "tp", secret: config.sessionSecret, httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/admin", authRouter);
  return app;
}
