import { prisma } from "../db/client.js";
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
  await prisma.activity.update({
    where: { id },
    data: {
      name: input.name, type: input.type, startTime: new Date(input.startTime),
      durationMinutes: input.durationMinutes ?? act.durationMinutes,
      location: input.location ?? act.location, theme: input.theme, notes: input.notes,
    },
  });
  if (input.participantIds) {
    await prisma.activityParticipant.deleteMany({ where: { activityId: id } });
    await prisma.activityParticipant.createMany({ data: input.participantIds.map((memberId) => ({ activityId: id, memberId })) });
  }
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
  if (a.status === "ended") {
    const present = a.participants.filter((p) => p.actualAttendance === "present").length;
    return `实到 ${present}/应到 ${a.participants.length}`;
  }
  const going = a.participants.filter((p) => p.attendanceResponse === "going").length;
  const not = a.participants.filter((p) => p.attendanceResponse === "not_going").length;
  const no = a.participants.filter((p) => p.attendanceResponse === "no_response").length;
  return `去 ${going}/不去 ${not}/未反馈 ${no}`;
}

export function reviewStatus(a: { review: { rawNotes: string; aiSummary: string | null } | null }) {
  if (!a.review || !a.review.rawNotes.trim()) return "无记录";
  return a.review.aiSummary ? "已生成" : "有素材未生成";
}
