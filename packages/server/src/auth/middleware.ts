import type { Request, Response, NextFunction } from "express";

export function requireCaptain(req: Request, res: Response, next: NextFunction) {
  if (req.session?.captainId) return next();
  return res.status(401).json({ error: "未登录" });
}
