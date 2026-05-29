import { prisma } from "../db/client.js";
import { buildActivityCard, buildCancelCard, buildReminderCard, type FeishuNotifier } from "../feishu/notify.js";

async function activeParticipantMembers(activityId: string) {
  const ps = await prisma.activityParticipant.findMany({ where: { activityId }, include: { member: true } });
  return ps.filter((p) => p.member.status === "active");
}

async function sendOne(notifier: FeishuNotifier, activityId: string, memberId: string, openId: string, type: string, card: object) {
  const log = await prisma.notificationLog.create({ data: { activityId, memberId, type, status: "pending" } });
  try {
    const { messageId } = await notifier.sendCard(openId, card);
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "success", feishuMessageId: messageId, sentAt: new Date() } });
  } catch (e) {
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "failed", failReason: (e as Error).message } });
  }
}

export async function notifyPublish(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildActivityCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "publish", card);
  }
}

export async function notifyCancel(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildCancelCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "cancel", card);
  }
}

export async function sendReminder(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildReminderCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "reminder", card);
  }
}

// 只补发失败对象（同 activity、同 type 的最新一条 failed）
export async function retryFailed(activityId: string, notifier: FeishuNotifier) {
  const failed = await prisma.notificationLog.findMany({ where: { activityId, status: "failed" }, include: { activity: true } });
  for (const log of failed) {
    const member = await prisma.member.findUnique({ where: { id: log.memberId } });
    if (!member) continue;
    const card = log.type === "cancel" ? buildCancelCard(log.activity as any) : log.type === "reminder" ? buildReminderCard(log.activity as any) : buildActivityCard(log.activity as any);
    try {
      const { messageId } = await notifier.sendCard(member.feishuOpenId, card);
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "success", feishuMessageId: messageId, sentAt: new Date(), failReason: null } });
    } catch (e) {
      await prisma.notificationLog.update({ where: { id: log.id }, data: { failReason: (e as Error).message } });
    }
  }
}

export async function notificationStatus(activityId: string) {
  const logs = await prisma.notificationLog.findMany({ where: { activityId } });
  return { success: logs.filter(l=>l.status==="success").length, failed: logs.filter(l=>l.status==="failed").length };
}
