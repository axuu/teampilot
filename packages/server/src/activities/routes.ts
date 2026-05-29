import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { zActivityDraft } from "./schema.js";
import { createDraft, updateDraft, getActivity, listActivities, attendanceSummary, reviewStatus, publishActivity, cancelActivity } from "./service.js";
import { notifyPublish, notifyCancel, retryFailed, notificationStatus } from "../notifications/service.js";
import type { FeishuNotifier } from "../feishu/notify.js";
import type { LLMClient } from "../ai/client.js";
import { generateActivitySummary } from "../ai/scenarios.js";

export function makeActivitiesRouter(notifier: FeishuNotifier, llm: LLMClient) {
  const r = Router();
  r.use(requireCaptain);

  r.get("/", async (req, res) => {
    const list = await listActivities({ type: req.query.type as string, status: req.query.status as string });
    res.json(list.map((a) => ({
      id: a.id, name: a.name, type: a.type, startTime: a.startTime, location: a.location, status: a.status,
      attendanceSummary: attendanceSummary(a), reviewStatus: reviewStatus(a),
    })));
  });

  r.post("/", async (req, res) => {
    const parsed = zActivityDraft.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
    res.json(await createDraft(parsed.data));
  });

  r.get("/:id", async (req, res) => {
    const a = await getActivity(req.params.id);
    if (!a) return res.status(404).json({ error: "活动不存在" });
    res.json(a);
  });

  r.put("/:id", async (req, res) => {
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

  r.post("/:id/publish", async (req, res) => {
    let act;
    try {
      act = await publishActivity(req.params.id, new Date());
    } catch (e) {
      if (e instanceof Error && e.message === "not_found") return res.status(404).json({ error: "活动不存在" });
      return res.status(409).json({ error: (e as Error).message });
    }
    await notifyPublish(act.id, notifier); // 通知阶段异常交全局错误处理（500），不误判为发布失败
    void generateActivitySummary(act.id, llm, new Date()).catch((e) => { console.error("[时机A] 活动总结生成失败:", e); }); // 发布后异步生成活动总结，失败不阻塞发布
    res.json(act);
  });

  r.post("/:id/cancel", async (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    let act;
    try {
      act = await cancelActivity(req.params.id, reason);
    } catch (e) {
      if (e instanceof Error && e.message === "not_found") return res.status(404).json({ error: "活动不存在" });
      return res.status(409).json({ error: (e as Error).message });
    }
    await notifyCancel(act.id, notifier);
    res.json(act);
  });

  r.get("/:id/notifications", async (req, res) => res.json(await notificationStatus(req.params.id)));
  r.post("/:id/notifications/retry", async (req, res) => {
    await retryFailed(req.params.id, notifier);
    res.json(await notificationStatus(req.params.id));
  });

  return r;
}
