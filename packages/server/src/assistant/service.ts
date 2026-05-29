import { prisma } from "../db/client.js";
import type { LLMClient } from "../ai/client.js";
import { recentSummaries, activeMembersForAI, memberLine, historyBlock } from "../ai/context.js";
import { zAssistant } from "../ai/schemas.js";

const TEN_MIN = 10 * 60000;

export async function sessionContext(now: Date) {
  return prisma.assistantMessage.findMany({ where: { createdAt: { gte: new Date(now.getTime() - TEN_MIN) } }, orderBy: { createdAt: "asc" } });
}

export async function ask(question: string, llm: LLMClient, now: Date) {
  const history = await sessionContext(now);
  const members = await activeMembersForAI();
  const summaries = await recentSummaries(now);
  const recentActs = await prisma.activity.findMany({ where: { status: { in: ["published","ended"] }, startTime: { gte: new Date(now.getTime()-60*86400000) } }, include: { participants: true }, orderBy: { startTime: "desc" }, take: 8 });
  const attendance = recentActs.map((a)=>{ const g=a.participants.filter(p=>p.attendanceResponse==="going").length; const n=a.participants.filter(p=>p.attendanceResponse==="not_going").length; const u=a.participants.filter(p=>p.attendanceResponse==="no_response").length; return `${a.startTime.toLocaleDateString("zh-CN")} ${a.name}：去${g}/不去${n}/未反馈${u}`; }).join("\n");
  const system = "你是队长的内部分析助理。只引用系统中真实数据，数据不足要明说，不编造。输出 JSON：{judgment(50-300字), basis(50-200字)}。";
  const convo = history.map((m)=>`${m.role==="ai"?"AI":"我"}：${m.content}`).join("\n");
  const user = `【对话上下文(10分钟内)】\n${convo || "（新会话）"}\n【当前问题】${question}\n【全部正常队员】\n${members.map((m)=>memberLine(m)).join("\n")}\n【近2月活动摘要】\n${historyBlock(summaries)}\n【近2月出勤概况】\n${attendance || "（无）"}`;
  const raw = await llm.completeJSON(system, user);
  const parsed = zAssistant.parse(JSON.parse(raw));
  await prisma.$transaction([
    prisma.assistantMessage.create({ data: { role: "captain", content: question, createdAt: now } }),
    prisma.assistantMessage.create({ data: { role: "ai", content: JSON.stringify(parsed), createdAt: new Date(now.getTime()+1) } }),
  ]);
  return parsed;
}

export function listMessages() { return prisma.assistantMessage.findMany({ orderBy: { createdAt: "asc" } }); }
