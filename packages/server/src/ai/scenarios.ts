import { prisma } from "../db/client.js";
import type { LLMClient } from "./client.js";
import { recentSummaries, memberLine, historyBlock, OUTPUT_GUARD } from "./context.js";
import { zTrainingAdvice, zMatchAdvice, zReviewTraining, zReviewMatch, zActivitySummary } from "./schemas.js";

async function parse<T>(llm: LLMClient, system: string, user: string, schema: { parse: (x: unknown) => T }): Promise<T> {
  const raw = await llm.completeJSON(system, user);
  return schema.parse(JSON.parse(raw));
}

async function goingOrAllMembers(activityId: string) {
  const ps = await prisma.activityParticipant.findMany({ where: { activityId }, include: { member: true } });
  const going = ps.filter((p) => p.attendanceResponse === "going");
  return (going.length ? going : ps).map((p) => p.member);
}

// 场景1
export async function generateTrainingAdvice(activityId: string, llm: LLMClient, now: Date) {
  const a = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!a) throw new Error("not_found");
  const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const members = await goingOrAllMembers(activityId);
  const history = await recentSummaries(now);
  const system = "你是藤球队的训练助理。只依据给定数据生成训练建议，缺数据要说明，不编造。输出 JSON：{goal, plan}。goal 50-150字，plan 100-400字。不安排未在名单中的队员。";
  const rules = settings?.trainingRules?.trim() ? `\n【队长训练规则，优先参考】\n${settings.trainingRules}` : "";
  const user = `【活动】${a.name} / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} / ${a.durationMinutes}分钟 / ${a.location}\n【主题】${a.theme ?? "未填写"}\n【注意事项】${a.notes ?? "未填写"}\n【参加人员】\n${members.map((m)=>memberLine(m)).join("\n")}\n【近2月历史摘要】\n${historyBlock(history)}${rules}`;
  return parse(llm, system, user, zTrainingAdvice);
}

// 场景2
export async function generateMatchAdvice(activityId: string, llm: LLMClient, now: Date) {
  const a = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!a) throw new Error("not_found");
  const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const members = await goingOrAllMembers(activityId);
  const history = await recentSummaries(now);
  const system = "你是藤球队的比赛助理。基于给定数据给比赛建议，用'建议/可考虑'措辞，不强制阵容。不得把未出现在参加人员名单中的队员排入首发或替补。输出 JSON：{strategy(50-200字), starting(50-200字), bench(50-150字)}。" + OUTPUT_GUARD;
  const rules = settings?.matchRules?.trim() ? `\n【队长比赛规则，优先参考】\n${settings.matchRules}` : "";
  const user = `【比赛】${a.name} / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} / ${a.location}\n【活动类型：比赛】\n【预计时长：${a.durationMinutes}分钟】\n【主题】${a.theme ?? "未填写"}\n【注意事项(含对手/赛制)】${a.notes ?? "未填写"}\n【参加人员】（以下名单为已反馈"去"的队员；如果无人反馈"去"，系统会传入本次活动全部参加人员）\n${members.map((m)=>memberLine(m)).join("\n")}\n【近2月历史摘要】\n${historyBlock(history)}${rules}`;
  return parse(llm, system, user, zMatchAdvice);
}

// 场景3 + 触发场景4 时机B
export async function generateReviewSummary(activityId: string, reviewLLM: LLMClient, summaryLLM: LLMClient, now: Date) {
  const a = await prisma.activity.findUnique({ where: { id: activityId } });
  const review = await prisma.activityReview.findUnique({ where: { activityId } });
  if (!a || !review) throw new Error("not_found");
  const present = (await prisma.activityParticipant.findMany({ where: { activityId, actualAttendance: "present" }, include: { member: true } })).map((p)=>p.member);
  const history = await recentSummaries(now);
  const isTraining = a.type === "training";
  const fields = isTraining ? "{overall(80-200字), goalDone(50-150字), problems(50-150字), improvements(50-150字)}" : "{overall(80-200字), problems(50-150字), improvements(50-150字)}";
  const system = `你是藤球队复盘助理。只基于"我的复盘记录"生成结构化复盘，不编造，不评价未到场队员，不做个人评价/比较，信息不足写"未提供"。复盘摘要面向全体队员公开可见，不得输出队长备注原文、复盘原文、录音转写原文或不适合公开的内部内容。输出 JSON：${fields}。` + OUTPUT_GUARD;
  const user = `【活动】${a.name} / ${isTraining?"训练":"比赛"} / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}\n【主题】${a.theme ?? "未填写"}\n【注意事项】${a.notes ?? "未填写"}\n【实际到场】\n${present.map((m)=>memberLine(m, false)).join("\n") || "（无）"}\n【我的复盘记录】\n${review.rawNotes}\n【近2月历史摘要】\n${historyBlock(history)}`;
  const parsed = isTraining ? await parse(reviewLLM, system, user, zReviewTraining) : await parse(reviewLLM, system, user, zReviewMatch);
  const aiSummary = JSON.stringify(parsed);
  await prisma.activityReview.update({ where: { activityId }, data: { aiSummary, aiSummaryUpdatedAt: now } });
  // 时机B：活动总结追加复盘要点
  await generateActivitySummary(activityId, summaryLLM, now);
  return parsed;
}

// 场景4（时机A：发布后；时机B：复盘更新后）
export async function generateActivitySummary(activityId: string, llm: LLMClient, now: Date) {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, include: { review: true, participants: true } });
  if (!a) throw new Error("not_found");
  const hasReview = !!a.review?.aiSummary;
  const presentCount = a.participants.filter((p)=>p.actualAttendance === "present").length;
  const system = "你是藤球队记录助理。生成面向全员的活动精简总结，不含内部评价/队长备注。输出 JSON：{summary}（50-500字）。时机A只描述安排与参与；时机B在基础上追加核心复盘要点。";
  const user = `【活动】${a.name} / ${a.type === "training" ? "训练" : "比赛"} / ${a.startTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} / ${a.location}\n【主题】${a.theme ?? "（无）"}\n【注意事项】${a.notes ?? "（无）"}\n【参加人数】${a.participants.length}` + (hasReview ? `\n【实际到场人数】${presentCount}\n【AI复盘总结】${a.review!.aiSummary}` : "");
  const parsed = await parse(llm, system, user, zActivitySummary);
  await prisma.activity.update({ where: { id: activityId }, data: { summary: parsed.summary, summaryStage: hasReview ? "post_review" : "initial", summaryUpdatedAt: now } });
  return parsed;
}
