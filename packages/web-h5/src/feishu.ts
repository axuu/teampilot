// 在飞书内通过 JSSDK 获取免登授权 code。可被测试注入替换。
export interface FeishuBridge { getCode(): Promise<string | null>; }

export const realFeishuBridge: FeishuBridge = {
  async getCode() {
    // 生产：经飞书网页应用免登流程拿 code（重定向授权或 JSSDK）。
    // 此处约定从 URL 参数 ?code= 读取（由免登重定向带回），无则视为非飞书环境。
    return new URLSearchParams(location.search).get("code");
  },
};

export function getJoinToken(): string {
  return new URLSearchParams(location.search).get("t") ?? "";
}
