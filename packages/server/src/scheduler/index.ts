import { prisma } from "../db/client.js";
import { sendReminder } from "../notifications/service.js";
import { larkNotifier, type FeishuNotifier } from "../feishu/notify.js";
import { pollAsrJobs } from "../asr/service.js";
import { volcAsrProvider } from "../asr/provider.js";

// 找出 published 且已过 start+duration 的活动，置为 ended，并把 going 的参与者初始化为 pending
export async function runAutoEnd(now: Date) {
  const candidates = await prisma.activity.findMany({ where: { status: "published" } });
  for (const a of candidates) {
    const endMs = a.startTime.getTime() + a.durationMinutes * 60 * 1000;
    if (endMs > now.getTime()) continue;
    await prisma.$transaction([
      prisma.activity.update({ where: { id: a.id }, data: { status: "ended", endedAt: now } }),
      prisma.activityParticipant.updateMany({
        where: { activityId: a.id, attendanceResponse: "going", actualAttendance: null },
        data: { actualAttendance: "pending" },
      }),
    ]);
  }
}

export async function runReminders(now: Date, notifier: FeishuNotifier) {
  const due = await prisma.activity.findMany({
    where: { status: "published", reminderAt: { not: null, lte: now } },
  });
  for (const a of due) {
    // 幂等：sendReminder 即使失败也会写日志，故 >0 表示本活动已尝试过提醒（失败补发走概要 Tab 手动重试）
    const already = await prisma.notificationLog.count({ where: { activityId: a.id, type: "reminder" } });
    if (already > 0) continue;
    await sendReminder(a.id, notifier);
  }
}

export async function tick(now: Date) {
  try {
    await runAutoEnd(now);
    await runReminders(now, larkNotifier);
    await pollAsrJobs(volcAsrProvider);
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  }
}

export function startScheduler() {
  setInterval(() => { void tick(new Date()); }, 60 * 1000);
}
