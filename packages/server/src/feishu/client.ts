import * as lark from "@larksuiteoapi/node-sdk";
import { loadConfig } from "../config/index.js";

export function createLarkClient() {
  const c = loadConfig();
  return new lark.Client({
    appId: c.feishuAppId,
    appSecret: c.feishuAppSecret,
    domain: lark.Domain.Feishu, // 飞书中国版
  });
}
