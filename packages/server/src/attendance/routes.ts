import { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

const zMark = z.object({ value: z.enum(["present", "absent"]) });
export const attendanceRouter = Router();
attendanceRouter.use(requireCaptain);

attendanceRouter.post("/:activityId/participants/:memberId/attendance", async (req, res) => {
  const parsed = zMark.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "无效的到场值" });
  const result = await prisma.activityParticipant.updateMany({
    where: { activityId: req.params.activityId, memberId: req.params.memberId },
    data: { actualAttendance: parsed.data.value },
  });
  if (result.count === 0) return res.status(404).json({ error: "参与记录不存在" });
  res.json({ ok: true });
});
