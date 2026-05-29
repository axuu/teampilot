import OpenAI from "openai";

export interface LLMClient {
  // 强制返回 JSON 文本（调用方用 zod 校验）
  completeJSON(system: string, user: string): Promise<string>;
}

export const arkClient: LLMClient = {
  async completeJSON(system, user) {
    const client = new OpenAI({ apiKey: process.env.ARK_API_KEY!, baseURL: process.env.ARK_BASE_URL });
    const resp = await client.chat.completions.create({
      model: process.env.ARK_MODEL!,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    });
    return resp.choices[0]?.message?.content ?? "{}";
  },
};
