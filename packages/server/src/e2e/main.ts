// e2e 启动器：真实 server + 注入确定性假外部服务 + 独立 e2e DB。
// 关键顺序：先设 env，再动态 import（db/client.ts 在 import 时即 new PrismaClient() 读 DATABASE_URL）。
import { execSync } from "node:child_process";

process.env.NODE_ENV = "test"; // 防止真实 ark/volc 客户端被误调用（test 下会抛错），cookie secure 仍为 false
process.env.DATABASE_URL = "file:./prisma/e2e.db";
process.env.TEAM_TZ = "Asia/Shanghai";
process.env.CAPTAIN_USERNAME = "Levin";
process.env.CAPTAIN_PASSWORD = "change-me";
process.env.TEAM_DEFAULT_LOCATION = "e2e训练基地";
process.env.TEAM_JOIN_TOKEN = "e2e-join-token";
process.env.SESSION_SECRET = "e2e-secret";
process.env.FEISHU_APP_ID = "e2e";
process.env.FEISHU_APP_SECRET = "e2e";
process.env.H5_BASE_URL = "http://localhost:5174";

// 重置并推送 e2e 库结构（prisma CLI 会加载 .env，但不覆盖已设置的 DATABASE_URL）
execSync("node_modules/.bin/prisma db push --force-reset --skip-generate", {
  cwd: process.cwd(),
  env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" },
  stdio: "inherit",
});

const { prisma } = await import("../db/client.js");
const { seed } = await import("../../prisma/seed.js");
const { resetDb } = await import("../../test/helpers/db.js");
const { createApp } = await import("../app.js");
const { fakeNotifier, fakeLLM, fakeAsr, fakeFeishuAuth } = await import("./fakes.js");

// 3 名 active 队员（seed 本身不含队员），让发布有参与人
const roster = [
  { name: "甲", feishuOpenId: "ou_e2e_jia" },
  { name: "乙", feishuOpenId: "ou_e2e_yi" },
  { name: "丙", feishuOpenId: "ou_e2e_bing" },
];

// 把库重置回确定性基线（队长 + 团队设置 + 3 名 active 队员）。启动时与每个测试前都用它，保证 spec 间隔离、与执行顺序无关。
async function reseed() {
  await resetDb();
  await seed();
  for (const m of roster) {
    await prisma.member.create({ data: { name: m.name, primaryPosition: "tekong", status: "active", feishuOpenId: m.feishuOpenId } });
  }
}

await reseed();

const app = createApp({ feishuAuth: fakeFeishuAuth, notifier: fakeNotifier, llm: fakeLLM, asr: fakeAsr });

// 仅 e2e 启动器挂载：测试隔离用的重置端点（生产 createApp 不含此路由）
app.post("/api/test/reset", async (_req, res) => {
  await reseed();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`[e2e] server on :${port}`));
