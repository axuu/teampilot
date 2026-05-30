import type { FeishuNotifier } from "../feishu/notify.js";
import type { LLMClient } from "../ai/client.js";
import type { AsrProvider } from "../asr/provider.js";

// 飞书通知：恒成功，返回固定 messageId
export const fakeNotifier: FeishuNotifier = {
  async sendCard(_openId: string, _card: object) {
    return { messageId: "e2e-msg" };
  },
};

// LLM：按 system 提示词关键字分支返回满足对应 zod schema 的固定 JSON
export const fakeLLM: LLMClient = {
  async completeJSON(system: string, _user: string) {
    if (system.includes("记录助理")) {
      return JSON.stringify({ summary: "（e2e）本次活动顺利完成。" });
    }
    if (system.includes("复盘助理")) {
      return system.includes("goalDone")
        ? JSON.stringify({ overall: "（e2e）整体表现稳定", goalDone: "（e2e）目标基本达成", problems: "（e2e）防守轮转偏慢", improvements: "（e2e）加强轮转练习" })
        : JSON.stringify({ overall: "（e2e）整体表现稳定", problems: "（e2e）失误偏多", improvements: "（e2e）减少非受迫失误" });
    }
    if (system.includes("训练助理")) {
      return JSON.stringify({ goal: "（e2e）提升传球成功率", plan: "（e2e）分组对抗30分钟" });
    }
    if (system.includes("比赛助理")) {
      return JSON.stringify({ strategy: "（e2e）稳守反击", starting: "（e2e）首发名单", bench: "（e2e）替补待命" });
    }
    console.warn(`[fakeLLM] 未匹配的 system 提示词，返回空对象（assistant/memberBot 等未覆盖）: ${system.slice(0, 60)}`);
    return JSON.stringify({});
  },
};

// ASR：忽略音频字节，返回固定转写文本
export const fakeAsr: AsrProvider = {
  async transcribe(_bytes: Buffer, _format: string) {
    return { text: "（e2e）这是录音转写出来的复盘文本" };
  },
};
