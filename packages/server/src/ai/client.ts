import OpenAI from "openai";

export interface LLMClient {
  // 返回 JSON 文本（调用方用 zod 校验）
  completeJSON(system: string, user: string): Promise<string>;
}

// 从模型输出中健壮提取 JSON 文本：剥离 ```json/``` 围栏，截取首个 { 到末个 } 的片段。
// 部分豆包接入点不支持 response_format=json_object，靠 system prompt 指示 + 此提取保证可被 JSON.parse。
export function extractJsonText(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : content).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export const arkClient: LLMClient = {
  async completeJSON(system, user) {
    if (process.env.NODE_ENV === "test") throw new Error("arkClient 不应在测试中被调用，请为该路径注入假的 LLMClient");
    const client = new OpenAI({ apiKey: process.env.ARK_API_KEY!, baseURL: process.env.ARK_BASE_URL });
    const resp = await client.chat.completions.create({
      model: process.env.ARK_MODEL!,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    return extractJsonText(resp.choices[0]?.message?.content ?? "{}");
  },
};
