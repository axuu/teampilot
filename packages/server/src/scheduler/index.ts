import { prisma } from "../db/client.js";
import { sendReminder } from "../notifications/service.js";
import { larkNotifier, type FeishuNotifier } from "../feishu/notify.js";

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
    const already = await prisma.notificationLog.count({ where: { activityId: a.id, type: "reminder" } });
    if (already > 0) continue;
    await sendReminder(a.id, notifier);
  }
}

export async function tick(now: Date) {
  try {
    await runAutoEnd(now);
    await runReminders(now, larkNotifier);
    // Plan D 追加：ASR 轮询（放在此 try 内，保证调度循环不被单次异常打断）
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  }
}

export function startScheduler() {
  setInterval(() => { void tick(new Date()); }, 60 * 1000);
}
