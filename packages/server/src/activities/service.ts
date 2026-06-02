import { prisma } from "../db/client.js";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { zActivityDraft } from "./schema.js";

type DraftInput = z.infer<typeof zActivityDraft>;

async function activeMemberIds() {
  const ms = await prisma.member.findMany({ where: { status: "active" }, select: { id: true } });
  return ms.map((m) => m.id);
}

export async function createDraft(input: DraftInput) {
  const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const participantIds = input.participantIds ?? (await activeMemberIds());
  return prisma.activity.create({
    data: {
      name: input.name, type: input.type, startTime: new Date(input.startTime),
      durationMinutes: input.durationMinutes ?? 120,
      location: input.location ?? settings?.defaultLocation ?? "",
      theme: input.theme, notes: input.notes,
      participants: { create: participantIds.map((memberId) => ({ memberId })) },
    },
  });
}

export async function updateDraft(id: string, input: DraftInput) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) return null;
  if (act.status !== "draft") throw new Error("only_draft_editable");
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.activity.update({
      where: { id },
      data: {
        name: input.name, type: input.type, startTime: new Date(input.startTime),
        durationMinutes: input.durationMinutes ?? act.durationMinutes,
        location: input.location ?? act.location, theme: input.theme, notes: input.notes,
      },
    }),
  ];
  if (input.participantIds) {
    ops.push(
      prisma.activityParticipant.deleteMany({ where: { activityId: id } }),
      prisma.activityParticipant.createMany({ data: input.participantIds.map((memberId) => ({ activityId: id, memberId })) }),
    );
  }
  await prisma.$transaction(ops);
  return prisma.activity.findUnique({ where: { id } });
}

export function getActivity(id: string) {
  return prisma.activity.findUnique({ where: { id }, include: { participants: { include: { member: true } }, review: true } });
}

export function listActivities(filter: { type?: string; status?: string }) {
  return prisma.activity.findMany({
    where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.status ? { status: filter.status } : {}) },
    include: { participants: true, review: true },
    orderBy: { startTime: "desc" },
  });
}

// 派生列（设计 F5）
export function attendanceSummary(a: { status: string; participants: { attendanceResponse: string; actualAttendance: string | null }[] }) {
  if (a.status === "cancelled") return "—";
  if (a.status === "ended") {
    const present = a.participants.filter((p) => p.actualAttendance === "present").length;
    return `${present} 实到 ｜ ${a.participants.length} 应到`;
  }
  const going = a.participants.filter((p) => p.attendanceResponse === "going").length;
  const not = a.participants.filter((p) => p.attendanceResponse === "not_going").length;
  const no = a.participants.filter((p) => p.attendanceResponse === "no_response").length;
  return `${going} 去 ｜ ${not} 不去 ｜ ${no} 未反馈`;
}

export function reviewStatus(a: { review: { rawNotes: string; aiSummary: string | null } | null }) {
  if (!a.review || !a.review.rawNotes.trim()) return "无记录";
  return a.review.aiSummary ? "已生成" : "有素材未生成";
}

const HOUR_MS = 3600 * 1000;

export function computeReminderAt(startTime: Date, now: Date): Date | null {
  const msToStart = startTime.getTime() - now.getTime();
  if (msToStart >= 24 * HOUR_MS) return new Date(startTime.getTime() - 24 * HOUR_MS);
  if (msToStart >= 2 * HOUR_MS) return new Date(startTime.getTime() - 2 * HOUR_MS);
  return null;
}

export async function publishActivity(id: string, now: Date) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) throw new Error("not_found");
  if (act.status !== "draft") throw new Error("only_draft_publishable");
  // 阶段1：仅冻结快照 + 置状态 + 计算 reminderAt；发卡片/活动总结在 Plan C/D
  return prisma.activity.update({
    where: { id },
    data: { status: "published", publishedAt: now, reminderAt: computeReminderAt(act.startTime, now) },
  });
}

export async function cancelActivity(id: string, reason: string) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) throw new Error("not_found");
  if (act.status !== "draft" && act.status !== "published") throw new Error("not_cancellable");
  return prisma.activity.update({ where: { id }, data: { status: "cancelled", cancelReason: reason } });
}
