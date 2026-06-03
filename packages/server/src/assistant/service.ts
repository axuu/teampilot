import { prisma } from "../db/client.js";
import type { LLMClient } from "../ai/client.js";
import { activeMembersForAI, memberLine, positionBreakdown, futurePublishedActivities, recentEndedDetailed, memberAttendanceStats, OUTPUT_GUARD, type AttendanceStat } from "../ai/context.js";
import { zAssistant } from "../ai/schemas.js";

const TEN_MIN = 10 * 60000;

export async function sessionContext(now: Date) {
  return prisma.assistantMessage.findMany({ where: { createdAt: { gte: new Date(now.getTime() - TEN_MIN) } }, orderBy: { createdAt: "asc" } });
}

function futureBlock(acts: Awaited<ReturnType<typeof futurePublishedActivities>>) {
  if (!acts.length) return "（暂无未来已发布活动）";
  return acts.map((a) => {
    const going = a.participants.filter((p) => p.attendanceResponse === "going");
    const not = a.participants.filter((p) => p.attendanceResponse === "not_going").length;
    const no = a.participants.filter((p) => p.attendanceResponse === "no_response");
    const goNames = going.map((p) => p.member.name).join("、") || "无";
    const noNames = no.map((p) => p.member.name).join("、") || "无";
    return `- ${a.name}（${a.type === "training" ? "训练" : "比赛"}） / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} / ${a.durationMinutes}分钟 / ${a.location} / 主题:${a.theme ?? "无"} / 注意:${a.notes ?? "无"} / 去${going.length}·不去${not}·未反馈${no.length} / 已反馈去:${goNames} / 未反馈:${noNames}`;
  }).join("\n");
}

function endedBlock(acts: Awaited<ReturnType<typeof recentEndedDetailed>>) {
  if (!acts.length) return "（暂无近2月已结束活动）";
  return acts.map((a) => `- ${a.startTime.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} ${a.name}（${a.type === "training" ? "训练" : "比赛"}） 主题:${a.theme ?? "无"} 注意:${a.notes ?? "无"} 摘要:${a.review?.aiSummary ?? a.summary ?? "暂无"}`).join("\n");
}

function statsBlock(stats: AttendanceStat[]) {
  if (!stats.length) return "（暂无）";
  return stats.map((s) => `${s.name}：反馈去${s.going}·未反馈${s.noResponse}·实到${s.present}·缺席${s.absent}·出勤率${s.rate}%`).join("\n");
}

export async function ask(question: string, llm: LLMClient, now: Date) {
  const history = await sessionContext(now);
  const members = await activeMembersForAI();
  const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const future = await futurePublishedActivities(now);
  const ended = await recentEndedDetailed(now);
  const stats30 = await memberAttendanceStats(now, 30);
  const stats60 = await memberAttendanceStats(now, 60);

  const system = "你是队长的球队管理与训练分析助理。你可以帮助队长分析球队管理、训练安排、比赛策略、队员资料、阵容搭配、出勤趋势、复盘总结、长期改进和队长规则沉淀相关问题。请优先使用系统提供的队长规则、队员资料、活动安排、出勤记录和复盘摘要；数据不足时明确说明缺少什么，并基于已有信息给出保守、可执行的建议。不要虚构具体活动、队员、出勤或复盘事实。输出 JSON：{judgment(50-300字), basis(50-200字)}。" + OUTPUT_GUARD;

  const convo = history.map((m) => `${m.role === "ai" ? "AI" : "我"}：${m.content}`).join("\n");
  const user = [
    `【当前日期】\n${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    `【对话上下文(10分钟内)】\n${convo || "（新会话）"}`,
    `【当前问题】\n${question}`,
    `【队长规则】\n训练规则：${settings?.trainingRules?.trim() || "暂无"}\n比赛规则：${settings?.matchRules?.trim() || "暂无"}\n默认地点：${settings?.defaultLocation || "暂无"}`,
    `【队员资料】（姓名、主位、备位、水平、风格、队长备注）\n${members.map((m) => memberLine(m)).join("\n") || "（无）"}`,
    `【队伍位置概况】\n${positionBreakdown(members)}`,
    `【未来已发布活动】\n${futureBlock(future)}`,
    `【近2月活动摘要】\n${endedBlock(ended)}`,
    `【近30天队员出勤统计】\n${statsBlock(stats30)}`,
    `【近60天队员出勤统计】\n${statsBlock(stats60)}`,
  ].join("\n\n");

  const raw = await llm.completeJSON(system, user);
  const parsed = zAssistant.parse(JSON.parse(raw));
  await prisma.$transaction([
    prisma.assistantMessage.create({ data: { role: "captain", content: question, createdAt: now } }),
    prisma.assistantMessage.create({ data: { role: "ai", content: JSON.stringify(parsed), createdAt: new Date(now.getTime() + 1) } }),
  ]);
  return parsed;
}

export function listMessages() { return prisma.assistantMessage.findMany({ orderBy: { createdAt: "asc" } }); }
