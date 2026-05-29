import { createLarkClient } from "./client.js";

export type Act = { id: string; name: string; type: string; startTime: Date; durationMinutes: number; location: string; theme: string | null; notes: string | null; cancelReason: string | null };

const fmt = (d: Date) => d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
const typeLabel = (t: string) => (t === "training" ? "训练" : "比赛");

export function buildActivityCard(a: Act) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: `【${typeLabel(a.type)}】${a.name}` } },
    elements: [
      { tag: "div", text: { tag: "lark_md", content:
        `**时间** ${fmt(a.startTime)}（${a.durationMinutes} 分钟）\n**地点** ${a.location}\n**主题** ${a.theme ?? "—"}\n**注意事项** ${a.notes ?? "—"}` } },
      { tag: "action", actions: [
        { tag: "button", text: { tag: "plain_text", content: "去" }, type: "primary", value: { activityId: a.id, response: "going" } },
        { tag: "button", text: { tag: "plain_text", content: "不去" }, type: "default", value: { activityId: a.id, response: "not_going" } },
      ] },
    ],
  };
}

export function buildCancelCard(a: Act) {
  return {
    header: { title: { tag: "plain_text", content: `【已取消】${a.name}` } },
    elements: [{ tag: "div", text: { tag: "lark_md", content: `**原时间** ${fmt(a.startTime)}\n**原地点** ${a.location}\n**取消原因** ${a.cancelReason ?? "—"}` } }],
  };
}

export function buildReminderCard(a: Act) {
  return {
    header: { title: { tag: "plain_text", content: `活动提醒：${a.name}` } },
    elements: [{ tag: "div", text: { tag: "lark_md", content: `**时间** ${fmt(a.startTime)}\n**地点** ${a.location}` } }],
  };
}

export interface FeishuNotifier {
  sendCard(openId: string, card: object): Promise<{ messageId: string }>;
}

export const larkNotifier: FeishuNotifier = {
  async sendCard(openId, card) {
    const client = createLarkClient();
    const resp = await client.im.message.create({
      params: { receive_id_type: "open_id" },
      data: { receive_id: openId, msg_type: "interactive", content: JSON.stringify(card) },
    });
    return { messageId: resp?.data?.message_id ?? "" };
  },
};
