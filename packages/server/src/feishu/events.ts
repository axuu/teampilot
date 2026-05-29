import { prisma } from "../db/client.js";
import * as lark from "@larksuiteoapi/node-sdk";
import { loadConfig } from "../config/index.js";

type CardEvent = { operator: { open_id: string }; action: { value: { activityId: string; response: string } } };
const respLabel: Record<string, string> = { going: "去", not_going: "不去", no_response: "未反馈" };
const label = (r: string) => respLabel[r] ?? r;

// 返回给飞书的提示文本；同时按规则更新或拒绝
export async function handleCardAction(event: CardEvent, now: Date): Promise<{ text: string }> {
  const openId = event.operator.open_id;
  const { activityId, response } = event.action.value;
  const member = await prisma.member.findUnique({ where: { feishuOpenId: openId } });
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!member || !act) return { text: "操作无效" };
  if (act.status === "cancelled") return { text: "活动已取消，无法反馈" };
  if (act.status === "ended") return { text: "活动已结束，无法反馈" };
  if (act.status !== "published" || act.startTime.getTime() <= now.getTime()) {
    const p = await prisma.activityParticipant.findFirst({ where: { activityId, memberId: member.id } });
    return { text: `活动已开始或不可修改，当前反馈：${label(p?.attendanceResponse ?? "no_response")}` };
  }
  await prisma.activityParticipant.updateMany({
    where: { activityId, memberId: member.id },
    data: { attendanceResponse: response, responseUpdatedAt: now },
  });
  return { text: `已记录：${label(response)}` };
}

export function startLongConnection() {
  const cfg = loadConfig();
  const wsClient = new lark.WSClient({ appId: cfg.feishuAppId, appSecret: cfg.feishuAppSecret });
  const dispatcher = new lark.EventDispatcher({}).register({
    "card.action.trigger": async (data: CardEvent) => {
      const out = await handleCardAction(data, new Date());
      return { toast: { type: "info", content: out.text } };
    },
  });
  wsClient.start({ eventDispatcher: dispatcher });
}
