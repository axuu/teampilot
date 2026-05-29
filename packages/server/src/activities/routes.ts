import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { zActivityDraft } from "./schema.js";
import { createDraft, updateDraft, getActivity, listActivities, attendanceSummary, reviewStatus } from "./service.js";

export const activitiesRouter = Router();
activitiesRouter.use(requireCaptain);

activitiesRouter.get("/", async (req, res) => {
  const list = await listActivities({ type: req.query.type as string, status: req.query.status as string });
  res.json(list.map((a) => ({
    id: a.id, name: a.name, type: a.type, startTime: a.startTime, location: a.location, status: a.status,
    attendanceSummary: attendanceSummary(a), reviewStatus: reviewStatus(a),
  })));
});

activitiesRouter.post("/", async (req, res) => {
  const parsed = zActivityDraft.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  res.json(await createDraft(parsed.data));
});

activitiesRouter.get("/:id", async (req, res) => {
  const a = await getActivity(req.params.id);
  if (!a) return res.status(404).json({ error: "活动不存在" });
  res.json(a);
});

activitiesRouter.put("/:id", async (req, res) => {
  const parsed = zActivityDraft.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  try {
    const a = await updateDraft(req.params.id, parsed.data);
    if (!a) return res.status(404).json({ error: "活动不存在" });
    res.json(a);
  } catch (e) {
    if (e instanceof Error && e.message === "only_draft_editable") {
      return res.status(409).json({ error: "已发布活动不可编辑" });
    }
    console.error("更新活动失败:", e);
    res.status(500).json({ error: "服务器错误" });
  }
});
