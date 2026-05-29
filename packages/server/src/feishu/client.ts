import * as lark from "@larksuiteoapi/node-sdk";
import { loadConfig } from "../config/index.js";

let cached: lark.Client | null = null;

export function createLarkClient() {
  if (cached) return cached;
  const c = loadConfig();
  cached = new lark.Client({
    appId: c.feishuAppId,
    appSecret: c.feishuAppSecret,
    domain: lark.Domain.Feishu, // 飞书中国版
  });
  return cached;
}
