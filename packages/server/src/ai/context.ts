import { prisma } from "../db/client.js";

const TWO_MONTHS = 60 * 86400000;

export type HistorySummary = { name: string; date: Date; type: string; content: string };

// 已结束活动、近2月、倒序、≤8；每条 aiSummary 优先否则 summary；都无则跳过
export async function recentSummaries(now: Date): Promise<HistorySummary[]> {
  const since = new Date(now.getTime() - TWO_MONTHS);
  const acts = await prisma.activity.findMany({
    where: { status: "ended", startTime: { gte: since } },
    include: { review: true },
    orderBy: { startTime: "desc" },
    take: 8,
  });
  const out: HistorySummary[] = [];
  for (const a of acts) {
    const content = a.review?.aiSummary ?? a.summary ?? null;
    if (content) out.push({ name: a.name, date: a.startTime, type: a.type, content });
  }
  return out;
}

export async function activeMembersForAI() {
  return prisma.member.findMany({ where: { status: "active" }, orderBy: { createdAt: "asc" } });
}

export function memberLine(m: { name: string; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; captainNote: string | null }, includeNote = true) {
  const parts = [`${m.name}（主位 ${m.primaryPosition}`];
  if (m.backupPosition) parts.push(`备位 ${m.backupPosition}`);
  if (m.level) parts.push(`水平 ${m.level}`);
  if (m.style) parts.push(`风格 ${m.style}`);
  if (includeNote && m.captainNote) parts.push(`备注 ${m.captainNote}`);
  return parts.join("，") + "）";
}

export function historyBlock(items: HistorySummary[]) {
  if (items.length === 0) return "暂无历史摘要";
  return items.map((i) => `- ${i.date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} ${i.name}（${i.type === "training" ? "训练" : "比赛"}）：${i.content}`).join("\n");
}
