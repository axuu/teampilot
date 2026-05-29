import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { listMembers, updateMember } from "./service.js";
import { zMemberUpdate } from "./schema.js";

export const membersRouter = Router();
membersRouter.use(requireCaptain);

membersRouter.get("/", async (req, res) => {
  const members = await listMembers({ status: req.query.status as string, position: req.query.position as string });
  res.json(members);
});

membersRouter.put("/:id", async (req, res) => {
  const parsed = zMemberUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  try {
    res.json(await updateMember(req.params.id, parsed.data));
  } catch {
    res.status(404).json({ error: "队员不存在" });
  }
});
