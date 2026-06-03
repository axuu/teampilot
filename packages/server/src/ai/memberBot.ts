import { prisma } from "../db/client.js";
import type { LLMClient } from "./client.js";
import { zMemberBot } from "./schemas.js";
import { OUTPUT_GUARD, positionBreakdown, futurePublishedActivities, recentEndedDetailed } from "./context.js";
import { positionLabel, levelLabel } from "@teampilot/shared";

const respLabel: Record<string, string> = { going: "去", not_going: "不去", no_response: "未反馈" };

export async function answerMemberQuestion(openId: string, question: string, llm: LLMClient, now: Date): Promise<string> {
  const member = await prisma.member.findUnique({ where: { feishuOpenId: openId } });
  if (!member || member.status !== "active") return "你当前不是活跃队员，请联系队长处理。";

  const activeMembers = await prisma.member.findMany({ where: { status: "active" } });
  const future = await futurePublishedActivities(now);
  const ended = await recentEndedDetailed(now);

  const myResp = (a: typeof future[number]) => a.participants.find((p) => p.memberId === member.id)?.attendanceResponse ?? "no_response";
  const fLine = (a: typeof future[number]) => {
    const going = a.participants.filter((p) => p.attendanceResponse === "going");
    const not = a.participants.filter((p) => p.attendanceResponse === "not_going").length;
    const no = a.participants.filter((p) => p.attendanceResponse === "no_response").length;
    return `${a.name}（${a.type === "training" ? "训练" : "比赛"}） / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} / ${a.durationMinutes}分钟 / ${a.location} / 主题:${a.theme ?? "无"} / 注意:${a.notes ?? "无"} / 你的反馈:${respLabel[myResp(a)]} / 去${going.length}·不去${not}·未反馈${no} / 已反馈去:${going.map((p) => p.member.name).join("、") || "无"}`;
  };
  const next = future[0];
  const unResponded = future.filter((a) => myResp(a) === "no_response");
  const publicSummary = ended.map((a) => a.review?.aiSummary ?? a.summary).find((s): s is string => !!s) ?? "暂无";

  const system = "你是球队飞书 Bot，面向已加入队员回答球队公开信息和个人相关信息。你可以回答：已发布活动信息、自己的活动反馈和个人资料、全队公开出勤概况、公开复盘摘要、训练准备建议、近期训练重点和球队公开提醒。请区分系统事实和训练建议；活动时间、地点、报名人数、队员资料等事实必须来自系统数据，系统没有的数据说暂无或请联系队长。如果是训练准备类问题，可以结合队员位置、活动主题、注意事项和近期公开复盘摘要给出建议。已发布活动的报名名单和反馈状态可以作为全队公开信息回答。输出 JSON：{answer}。" + OUTPUT_GUARD;

  const user = [
    `【当前日期】\n${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    `【你】\n姓名：${member.name}\n主要位置：${positionLabel(member.primaryPosition)}\n备选位置：${member.backupPosition ? positionLabel(member.backupPosition) : "暂无"}\n水平：${levelLabel(member.level) || "暂无"}\n风格：${member.style || "暂无"}`,
    `【未来已发布活动】\n${future.length ? future.map((a) => "- " + fLine(a)).join("\n") : "（暂无）"}`,
    `【下一场活动】\n${next ? fLine(next) : "暂无已发布的下一场活动"}`,
    `【你尚未反馈的活动】\n${unResponded.length ? unResponded.map((a) => `- ${a.name}（${a.type === "training" ? "训练" : "比赛"}） / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`).join("\n") : "（无）"}`,
    `【最近已结束活动】\n${ended.length ? ended.map((a) => `- ${a.startTime.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} ${a.name}（${a.type === "training" ? "训练" : "比赛"}） 主题:${a.theme ?? "无"} 摘要:${a.review?.aiSummary ?? a.summary ?? "暂无"}`).join("\n") : "（暂无）"}`,
    `【最近公开复盘摘要】\n${publicSummary}`,
    `【队伍位置概况】\n${positionBreakdown(activeMembers)}`,
    `【问题】\n${question}`,
  ].join("\n\n");

  const raw = await llm.completeJSON(system, user);
  return zMemberBot.parse(JSON.parse(raw)).answer;
}
