// 一次性核验：用真实飞书 H5 免登 code 调真飞书 API 换 open_id。
// 用法：cd packages/server && tsx --env-file=.env scripts/verify-feishu-code.ts <CODE>
// 需 .env 中真实 FEISHU_APP_ID / FEISHU_APP_SECRET（飞书中国版 open.feishu.cn）。
// 注意：免登 code 单次有效、几分钟内过期，拿到后请尽快运行。
import { larkAuthClient } from "../src/feishu/auth.js";

const code = process.argv[2];
if (!code) {
  console.error("用法: tsx --env-file=.env scripts/verify-feishu-code.ts <code>");
  process.exit(1);
}

console.log(`[verify-feishu] 用 code(前6位=${code.slice(0, 6)}…) 调真实飞书 authen.accessToken 换 open_id …`);
try {
  const openId = await larkAuthClient.getUserOpenIdByCode(code);
  if (openId) {
    console.log("✅ 成功：真飞书返回 open_id =", openId);
  } else {
    console.log("⚠️ 调用通了但未拿到 open_id（code 已用/过期/无效，或应用权限不足）");
  }
} catch (e) {
  console.error("❌ 调用失败:", e instanceof Error ? e.message : e);
  process.exit(2);
}
