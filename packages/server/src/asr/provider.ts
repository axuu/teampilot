import { randomUUID } from "node:crypto";

// 同步转写：传音频字节 + 格式，返回转写文本
export interface AsrProvider {
  transcribe(bytes: Buffer, format: string): Promise<{ text: string }>;
}

const ENDPOINT = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const RESOURCE_ID = process.env.VOLC_ASR_RESOURCE_ID ?? "volc.bigasr.auc_turbo";

// 真实实现：豆包录音识别2.0 极速版 flash（内联 base64，同步）
export const volcAsrProvider: AsrProvider = {
  async transcribe(bytes, format) {
    if (process.env.NODE_ENV === "test") throw new Error("volcAsrProvider 不应在测试中被调用，请注入假的 AsrProvider");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Key": process.env.VOLC_ASR_APP_ID ?? "",
        "X-Api-Access-Key": process.env.VOLC_ASR_ACCESS_TOKEN ?? "",
        "X-Api-Resource-Id": RESOURCE_ID,
        "X-Api-Request-Id": randomUUID(),
        "X-Api-Sequence": "-1",
      },
      body: JSON.stringify({
        user: { uid: "teampilot" },
        audio: { data: bytes.toString("base64"), format },
        request: { model_name: "bigmodel", enable_itn: true, enable_punc: true },
      }),
    });
    const statusCode = res.headers.get("X-Api-Status-Code");
    if (statusCode !== "20000000") {
      throw new Error(`ASR 失败 (code ${statusCode}): ${res.headers.get("X-Api-Message") ?? ""}`);
    }
    const data = (await res.json()) as { result?: { text?: string } };
    return { text: data.result?.text ?? "" };
  },
};
