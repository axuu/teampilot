import { createLarkClient } from "./client.js";

export interface FeishuAuthClient {
  // 用 H5 免登的 code 换取用户 open_id；无法识别则返回 null
  getUserOpenIdByCode(code: string): Promise<string | null>;
}

export const larkAuthClient: FeishuAuthClient = {
  async getUserOpenIdByCode(code) {
    const client = createLarkClient();
    // 飞书 authen：用 code 换 access_token，响应含 open_id
    const resp = await client.authen.accessToken.create({ data: { grant_type: "authorization_code", code } });
    return resp?.data?.open_id ?? null;
  },
};

export async function exchangeCodeForOpenId(client: FeishuAuthClient, code: string) {
  if (!code) return null;
  try {
    return await client.getUserOpenIdByCode(code);
  } catch {
    return null;
  }
}
