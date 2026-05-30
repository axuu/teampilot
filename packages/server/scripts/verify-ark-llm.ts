// 用真实方舟(豆包)大模型核验全部 AI 场景：真实 prompt → 真模型 → extractJsonText → zod 解析。
// 用法：cd packages/server && tsx --env-file=.env scripts/verify-ark-llm.ts
// 需 .env 中真实 ARK_API_KEY / ARK_BASE_URL / ARK_MODEL。
// 关键：不要设 NODE_ENV=test（否则 arkClient 会主动抛错）。用独立 scratch 库，不碰 dev/test/e2e。
import { execSync } from "node:child_process";

// 先设独立库（覆盖 .env 的 dev.db），再动态 import（db/client.ts import 即建 PrismaClient）
process.env.DATABASE_URL = "file:./prisma/ark-check.db";

execSync("node_modules/.bin/prisma db push --force-reset --skip-generate", {
  cwd: process.cwd(),
  env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" },
  stdio: "inherit",
});

const { prisma } = await import("../src/db/client.js");
const { seed } = await import("../prisma/seed.js");
const { arkClient } = await import("../src/ai/client.js");
const { generateTrainingAdvice, generateMatchAdvice, generateReviewSummary, generateActivitySummary } = await import("../src/ai/scenarios.js");
const { ask } = await import("../src/assistant/service.js");
const { answerMemberQuestion } = await import("../src/ai/memberBot.js");

if (process.env.NODE_ENV === "test") { console.error("NODE_ENV=test 会让 arkClient 抛错，请勿设置"); process.exit(1); }
console.log(`方舟模型: ${process.env.ARK_MODEL} @ ${process.env.ARK_BASE_URL}`);

await seed();
const mk = (name: string, openId: string, pos: string) =>
  prisma.member.create({ data: { name, primaryPosition: pos, status: "active", feishuOpenId: openId, level: "中级", style: "进攻型" } });
const a = await mk("张三", "ou_ark_a", "tekong");
const b = await mk("李四", "ou_ark_b", "feeder");
const c = await mk("王五", "ou_ark_c", "striker");

const training = await prisma.activity.create({
  data: {
    name: "周日常规训练", type: "training", status: "ended", location: "第二操场",
    startTime: new Date(Date.now() - 86400000), durationMinutes: 120, theme: "传球与配合", notes: "带好水",
    participants: { create: [a, b, c].map((m) => ({ memberId: m.id, attendanceResponse: "going", actualAttendance: "present" })) },
  },
});
await prisma.activityReview.create({
  data: { activityId: training.id, rawNotes: "今天传球配合有进步，王五扣球时机把握得好；防守轮转偏慢，下次加强二传保护。出勤齐整。" },
});
const match = await prisma.activity.create({
  data: {
    name: "周六友谊赛 vs 邻队", type: "match", status: "published", location: "市体育馆",
    startTime: new Date(Date.now() + 3 * 86400000), durationMinutes: 120, theme: "友谊赛", notes: "对手快攻见长", publishedAt: new Date(),
    participants: { create: [a, b, c].map((m) => ({ memberId: m.id, attendanceResponse: "going" })) },
  },
});

const now = new Date();
let pass = 0, fail = 0;
async function check(label: string, schemaHint: string, fn: () => Promise<unknown>) {
  process.stdout.write(`\n[${label}]（${schemaHint}）调真实方舟 …\n`);
  try {
    const out = await fn();
    pass++;
    console.log(`✅ 通过。真模型结构化输出: ${JSON.stringify(out).slice(0, 500)}`);
  } catch (e) {
    fail++;
    console.log(`❌ 失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

await check("训练建议", "zTrainingAdvice {goal,plan}", () => generateTrainingAdvice(training.id, arkClient, now));
await check("比赛建议", "zMatchAdvice {strategy,starting,bench}", () => generateMatchAdvice(match.id, arkClient, now));
await check("活动总结(时机A)", "zActivitySummary {summary}", () => generateActivitySummary(match.id, arkClient, now));
await check("复盘总结(+时机B总结)", "zReviewTraining {overall,goalDone,problems,improvements}", () => generateReviewSummary(training.id, arkClient, arkClient, now));
await check("队长AI助理", "zAssistant {judgment,basis}", () => ask("最近几次训练出勤怎么样？有什么建议？", arkClient, now));
await check("队员Bot", "zMemberBot {answer}", () => answerMemberQuestion("ou_ark_a", "下一场活动是什么时候？我要去吗？", arkClient, now));

console.log(`\n==== 真方舟核验结果: ${pass} 通过 / ${fail} 失败（共 6 个 AI 场景）====`);
await prisma.$disconnect();
process.exit(fail > 0 ? 2 : 0);
