import { prisma } from "../db/client.js";
import { positionLabel, levelLabel } from "@teampilot/shared";

const TWO_MONTHS = 60 * 86400000;

// §9.2 全局 LLM 输出约束：所有调用豆包 Mini2.0 的场景统一追加到 system prompt
export const OUTPUT_GUARD = "【输出格式要求】只返回 JSON 对象，不要输出 Markdown 代码块、解释文字、自然语言前缀或后缀；字段名必须严格匹配 schema，不新增、不改名、不漏字段。";

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
  const parts = [`${m.name}（主位 ${positionLabel(m.primaryPosition)}`];
  if (m.backupPosition) parts.push(`备位 ${positionLabel(m.backupPosition)}`);
  if (m.level) parts.push(`水平 ${levelLabel(m.level)}`);
  if (m.style) parts.push(`风格 ${m.style}`);
  if (includeNote && m.captainNote) parts.push(`备注 ${m.captainNote}`);
  return parts.join("，") + "）";
}

export function historyBlock(items: HistorySummary[]) {
  if (items.length === 0) return "暂无历史摘要";
  return items.map((i) => `- ${i.date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} ${i.name}（${i.type === "training" ? "训练" : "比赛"}）：${i.content}`).join("\n");
}

const DAY = 86400000;

export function positionBreakdown(members: { primaryPosition: string }[]) {
  const c: Record<string, number> = { tekong: 0, feeder: 0, striker: 0 };
  for (const m of members) if (m.primaryPosition in c) c[m.primaryPosition]++;
  return `发球手 ${c.tekong} 人，二传手 ${c.feeder} 人，攻球手 ${c.striker} 人`;
}

export function futurePublishedActivities(now: Date, takeN = 5, days = 30) {
  const until = new Date(now.getTime() + days * DAY);
  return prisma.activity.findMany({
    where: { status: "published", startTime: { gte: now, lte: until } },
    include: { participants: { include: { member: true } } },
    orderBy: { startTime: "asc" },
    take: takeN,
  });
}

export function recentEndedDetailed(now: Date, takeN = 8) {
  const since = new Date(now.getTime() - TWO_MONTHS);
  return prisma.activity.findMany({
    where: { status: "ended", startTime: { gte: since } },
    include: { review: true },
    orderBy: { startTime: "desc" },
    take: takeN,
  });
}

export type AttendanceStat = { name: string; going: number; noResponse: number; present: number; absent: number; rate: number };

export async function memberAttendanceStats(now: Date, days: number): Promise<AttendanceStat[]> {
  const since = new Date(now.getTime() - days * DAY);
  const members = await prisma.member.findMany({ where: { status: "active" }, orderBy: { createdAt: "asc" } });
  const acts = await prisma.activity.findMany({
    where: { startTime: { gte: since }, status: { in: ["published", "ended"] } },
    include: { participants: true },
  });
  return members.map((m) => {
    let going = 0, noResponse = 0, present = 0, absent = 0, endedCount = 0;
    for (const a of acts) {
      const p = a.participants.find((x) => x.memberId === m.id);
      if (!p) continue;
      if (p.attendanceResponse === "going") going++;
      if (p.attendanceResponse === "no_response") noResponse++;
      if (a.status === "ended") { endedCount++; if (p.actualAttendance === "present") present++; if (p.actualAttendance === "absent") absent++; }
    }
    const rate = endedCount ? Math.round((present / endedCount) * 100) : 0;
    return { name: m.name, going, noResponse, present, absent, rate };
  });
}
