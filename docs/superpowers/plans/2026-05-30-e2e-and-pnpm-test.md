# 修复 `pnpm test` + Playwright e2e 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `pnpm test` 一键跑通全部单测，并新增覆盖 web-admin 核心 happy path 的 Playwright e2e（真实 server + 注入确定性假外部服务 + 真实浏览器）。

**Architecture:** Part A 在根 `package.json` 声明 `pnpm.onlyBuiltDependencies` 白名单，消除企业版 pnpm `verify-deps-before-run` 因 `ERR_PNPM_IGNORED_BUILDS` 的退出码 1。Part B 给 `createApp` 补 `asr` 注入口，新增 server 端 e2e 启动器（注入 `fakeNotifier/fakeLLM/fakeAsr`、独立 e2e DB、seed + 注入 3 名队员），新增 `packages/e2e` 用 Playwright 起「e2e API server(:3000) + web-admin `vite preview`(:5173)」并驱动真实浏览器跑一条 happy path 闭环。

**Tech Stack:** pnpm workspace、Express + Prisma(SQLite)、Vite + React 19、Vitest、Playwright、tsx。

**关键事实（实现时必须遵守）:**
- `packages/server/src/db/client.ts` 在 import 时即 `new PrismaClient()`，读取 `DATABASE_URL`。**e2e 启动器必须先设 env，再动态 `import()`** 任何会拉入 prisma 的模块。
- `.env`（已 gitignore）含真实密钥且 `DATABASE_URL=file:./prisma/dev.db`。dotenv 不覆盖已设置的 env，所以启动器先设 `e2e.db` 即可隔离；prisma CLI 子进程也只会沿用我们传入的 env。
- 同一个 `LLMClient.completeJSON(system, user)` 被多个 zod schema 复用，假实现须按 `system` 关键字分支：`记录助理`→`{summary}`、`复盘助理`(+`goalDone`→训练四字段/否则比赛三字段)、`训练助理`→`{goal,plan}`、`比赛助理`→`{strategy,starting,bench}`。zod 仅校验 `z.string()`，不校验长度。
- 发布通知按「活动参与人中 status=active 的成员」逐个发卡计数（`notifyPublish`→`notificationStatus` 返回 `{success,failed}`）。取消勾选 1 人→成功数减 1，可用通知数断言参与人选择已生效。
- 仅在 web-admin only 范围内做 e2e；`/api/h5`（飞书授权）不触发，故无需注入 `feishuAuth`。

---

## 受影响文件结构

新增：
- `packages/server/src/e2e/fakes.ts` — 确定性假外部服务（notifier / llm / asr）
- `packages/server/src/e2e/main.ts` — e2e 启动器（设 env → db push → seed + 队员 → createApp → listen :3000）
- `packages/server/test/asrInjection.test.ts` — 验证 `createApp({asr})` 接线（Task 2 的失败测试）
- `packages/e2e/package.json` / `tsconfig.json` / `playwright.config.ts`
- `packages/e2e/tests/happy-path.spec.ts` — happy path 闭环
- `packages/e2e/fixtures/sample.mp3` — 上传用的占位音频（内容无关，fakeAsr 忽略字节）

修改：
- `pnpm-workspace.yaml` — 填 `allowBuilds`（修 pnpm test，Task 1）
- 根 `package.json` — 加根 `e2e` 脚本（Task 5）；安装 Playwright 后可能需在 `pnpm-workspace.yaml` 的 `allowBuilds` 追加 `playwright`（Task 5）
- `packages/server/src/app.ts` — `createApp` 增加 `asr` 注入并传给 `makeReviewsRouter`
- `packages/server/package.json` — 加 `e2e:server` 脚本
- `packages/web-admin/src/../vite.config.ts`（`packages/web-admin/vite.config.ts`）— 补 `preview.proxy`
- `packages/web-admin/package.json` — 加 `e2e:preview` 脚本
- `.gitignore` — 忽略 Playwright 产物
- `README.md` — 测试章节补 e2e 说明

---

## Task 1: Part A —— 修复 `pnpm test`

> **本任务已在审计中实测验证。** 正确修法是填 `pnpm-workspace.yaml` 的 `allowBuilds`，**不是** `package.json` 的 `pnpm.onlyBuiltDependencies`。

**根因（实测确认）:** 企业版 pnpm(11.2.2) 的 `verify-deps-before-run` 在跑任何脚本前先 `pnpm install`。`pnpm-workspace.yaml` 里有企业 wrapper 自动生成的一段 `allowBuilds:`，其值是占位串 `set this to true or false`（无效值＝「未决定」），导致 prisma/esbuild/protobufjs 等构建脚本被「忽略」并以 `ERR_PNPM_IGNORED_BUILDS` 退出码 1 失败，测试未开始。

> **坑（审计实测）:** pnpm 11 **不再读** `package.json` 的 `pnpm` 字段——填 `pnpm.onlyBuiltDependencies` 只会打印 `The "pnpm" field in package.json is no longer read by pnpm` 并被忽略，错误依旧。配置必须放 `pnpm-workspace.yaml`。

**Files:**
- Modify: `pnpm-workspace.yaml`（仓库根）

- [ ] **Step 1: 复现当前失败**

Run: `pnpm install`
Expected: 报 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @prisma/client@..., esbuild@..., prisma@..., protobufjs@...` 且以退出码 1 失败。

- [ ] **Step 2: 把 `pnpm-workspace.yaml` 的 allowBuilds 占位串填为 `true`**

把 `pnpm-workspace.yaml` 改成（保留 `packages:`，把 allowBuilds 五项的占位串改为 `true`）：

```yaml
packages:
  - "packages/*"
allowBuilds:
  '@prisma/client': true
  '@prisma/engines': true
  esbuild: true
  prisma: true
  protobufjs: true
```

- [ ] **Step 3: 验证 `pnpm test` 一键跑通**

Run: `pnpm install && pnpm test`
Expected:
- `pnpm install` 跑完全部 postinstall（esbuild/@prisma/engines/protobufjs/prisma/@prisma/client），结尾 `Done in ~5s`，无 `ERR_PNPM_IGNORED_BUILDS`。（@prisma/client 的 postinstall 会 warn「could not find Prisma schema」——无害，client 由 server 自身工具链生成，不影响测试。）
- `pnpm test` 4 个包全绿、进程退出码 0：`server` 24 文件/76、`web-admin` 10/16、`web-h5` 1/4、`shared` 1/5。

> 兜底：若企业层把 ignored-builds 升级成更硬的策略导致 `allowBuilds: true` 无效，改为在 `test` 脚本前置关闭校验：`pnpm -r --config.verify-deps-before-run=false test`；若仍不行，以「逐包 `./node_modules/.bin/vitest run`」为兜底跑法并记录到 spec。

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "fix(repo): 填写 pnpm-workspace.yaml allowBuilds 让 pnpm test 一键跑通"
```

---

## Task 2: `createApp` 增加 `asr` 注入（TDD）

**Files:**
- Test: `packages/server/test/asrInjection.test.ts`
- Modify: `packages/server/src/app.ts:30`（`makeReviewsRouter(llm)` 调用处与 `createApp` 形参）

- [ ] **Step 1: 写失败测试**

创建 `packages/server/test/asrInjection.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const fakeAsr = { transcribe: vi.fn().mockResolvedValue({ text: "注入转写文本" }) };
const fakeLLM = { completeJSON: vi.fn().mockResolvedValue(JSON.stringify({ summary: "ok" })) };
const app = createApp({ llm: fakeLLM, asr: fakeAsr });

beforeEach(async () => { await resetDb(); await seed(); fakeAsr.transcribe.mockClear(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username: "Levin", password: "change-me" }); return a; }

describe("createApp 注入 asr", () => {
  it("transcribe 路由使用注入的 asr，并把文本追加到 rawNotes", async () => {
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", status: "published", location: "x", startTime: new Date() } });
    const agent = await login();
    const res = await agent
      .post(`/api/admin/activities/${act.id}/review/transcribe?filename=rec.mp3`)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("fake-audio-bytes"));
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("注入转写文本");
    expect(fakeAsr.transcribe).toHaveBeenCalledOnce();
    const review = await prisma.activityReview.findUnique({ where: { activityId: act.id } });
    expect(review?.rawNotes).toContain("rec.mp3 转写内容");
    expect(review?.rawNotes).toContain("注入转写文本");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/server && ./node_modules/.bin/vitest run test/asrInjection.test.ts`
Expected: FAIL —— 因为当前 `createApp` 不接受 `asr`，transcribe 路由用默认 `volcAsrProvider`，在 `NODE_ENV=test` 下抛 `volcAsrProvider 不应在测试中被调用`，断言失败。

- [ ] **Step 3: 实现 —— 给 `createApp` 加 `asr` 注入并传给 reviews 路由**

在 `packages/server/src/app.ts`：

顶部 import 增加（紧跟现有 `makeReviewsRouter` 的 import）：

```ts
import { makeReviewsRouter } from "./reviews/routes.js";
import { volcAsrProvider, type AsrProvider } from "./asr/provider.js";
```

把 `createApp` 形参与 reviews 路由挂载改为：

```ts
export function createApp(deps: { feishuAuth?: FeishuAuthClient; notifier?: FeishuNotifier; llm?: LLMClient; asr?: AsrProvider } = {}) {
  const feishuAuth = deps.feishuAuth ?? larkAuthClient;
  const notifier = deps.notifier ?? larkNotifier;
  const llm = deps.llm ?? arkClient;
  const asr = deps.asr ?? volcAsrProvider;
```

并把：

```ts
  app.use("/api/admin/activities", makeReviewsRouter(llm));
```

改为：

```ts
  app.use("/api/admin/activities", makeReviewsRouter(llm, asr));
```

> 注意：`makeReviewsRouter` 已存在 `import`，不要重复 import；只新增 `asr/provider.js` 的 import。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/server && ./node_modules/.bin/vitest run test/asrInjection.test.ts`
Expected: PASS（1 passed）。

- [ ] **Step 5: 跑全量 server 测试确认无回归**

Run: `cd packages/server && ./node_modules/.bin/vitest run`
Expected: 25 文件 / 77 测试全绿（原 24/76 + 新增 1/1）。

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/app.ts packages/server/test/asrInjection.test.ts
git commit -m "feat(server): createApp 支持注入 asr（补齐 ASR 注入缝，供 e2e 用）"
```

---

## Task 3: e2e 假实现 + 启动器

**Files:**
- Create: `packages/server/src/e2e/fakes.ts`
- Create: `packages/server/src/e2e/main.ts`
- Modify: `packages/server/package.json`（加 `e2e:server` 脚本）

- [ ] **Step 1: 创建假实现 `packages/server/src/e2e/fakes.ts`**

```ts
import type { FeishuNotifier } from "../feishu/notify.js";
import type { LLMClient } from "../ai/client.js";
import type { AsrProvider } from "../asr/provider.js";

// 飞书通知：恒成功，返回固定 messageId
export const fakeNotifier: FeishuNotifier = {
  async sendCard(_openId: string, _card: object) {
    return { messageId: "e2e-msg" };
  },
};

// LLM：按 system 提示词关键字分支返回满足对应 zod schema 的固定 JSON
export const fakeLLM: LLMClient = {
  async completeJSON(system: string, _user: string) {
    if (system.includes("记录助理")) {
      return JSON.stringify({ summary: "（e2e）本次活动顺利完成。" });
    }
    if (system.includes("复盘助理")) {
      return system.includes("goalDone")
        ? JSON.stringify({ overall: "（e2e）整体表现稳定", goalDone: "（e2e）目标基本达成", problems: "（e2e）防守轮转偏慢", improvements: "（e2e）加强轮转练习" })
        : JSON.stringify({ overall: "（e2e）整体表现稳定", problems: "（e2e）失误偏多", improvements: "（e2e）减少非受迫失误" });
    }
    if (system.includes("训练助理")) {
      return JSON.stringify({ goal: "（e2e）提升传球成功率", plan: "（e2e）分组对抗30分钟" });
    }
    if (system.includes("比赛助理")) {
      return JSON.stringify({ strategy: "（e2e）稳守反击", starting: "（e2e）首发名单", bench: "（e2e）替补待命" });
    }
    return JSON.stringify({});
  },
};

// ASR：忽略音频字节，返回固定转写文本
export const fakeAsr: AsrProvider = {
  async transcribe(_bytes: Buffer, _format: string) {
    return { text: "（e2e）这是录音转写出来的复盘文本" };
  },
};
```

- [ ] **Step 2: 创建启动器 `packages/server/src/e2e/main.ts`**

```ts
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
const { createApp } = await import("../app.js");
const { fakeNotifier, fakeLLM, fakeAsr } = await import("./fakes.js");

await seed(); // 队长 Levin + 团队设置(defaultLocation=e2e训练基地)

// 注入 3 名 active 队员（seed 本身不含队员），让发布有参与人
const roster = [
  { name: "甲", feishuOpenId: "ou_e2e_jia" },
  { name: "乙", feishuOpenId: "ou_e2e_yi" },
  { name: "丙", feishuOpenId: "ou_e2e_bing" },
];
for (const m of roster) {
  await prisma.member.upsert({
    where: { feishuOpenId: m.feishuOpenId },
    update: {},
    create: { name: m.name, primaryPosition: "tekong", status: "active", feishuOpenId: m.feishuOpenId },
  });
}

const app = createApp({ notifier: fakeNotifier, llm: fakeLLM, asr: fakeAsr });
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`[e2e] server on :${port}`));
```

- [ ] **Step 3: 在 `packages/server/package.json` 的 `scripts` 加 `e2e:server`**

在 `scripts` 中新增一行（其余不变）：

```json
    "e2e:server": "tsx src/e2e/main.ts",
```

- [ ] **Step 4: 验证启动器能起、能 seed、能健康检查**

Run（后台起服务）：
```bash
cd packages/server && (pnpm e2e:server &) ; sleep 6
curl -s http://localhost:3000/api/health
```
Expected: 打印 `{"ok":true}`；启动日志含 `The SQLite database "e2e.db" ... was successfully reset.` 与 `[e2e] server on :3000`。

Run（验证登录 + 队员已 seed）：
```bash
curl -s -c /tmp/e2e.cookie -X POST http://localhost:3000/api/admin/login -H 'content-type: application/json' -d '{"username":"Levin","password":"change-me"}' -o /dev/null -w "login:%{http_code}\n"
curl -s -b /tmp/e2e.cookie 'http://localhost:3000/api/admin/members?status=active' -w "\n"
```
Expected: `login:200`；members 返回含「甲/乙/丙」3 条 active 成员的 JSON 数组。

Run（收尾，关掉后台服务）：
```bash
pkill -f "src/e2e/main.ts" || true
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/e2e/fakes.ts packages/server/src/e2e/main.ts packages/server/package.json
git commit -m "feat(server): 新增 e2e 启动器与确定性假外部服务"
```

---

## Task 4: web-admin 支持 `vite preview` 代理 + e2e:preview 脚本

**Files:**
- Modify: `packages/web-admin/vite.config.ts`
- Modify: `packages/web-admin/package.json`（加 `e2e:preview` 脚本）

- [ ] **Step 1: 给 `vite.config.ts` 补 `preview.proxy`**

把 `packages/web-admin/vite.config.ts` 改为：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  preview: { proxy: { "/api": "http://localhost:3000" } },
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], globals: true },
} as any);
```

> 原因：Vite 的 `server.proxy` 只对 dev server 生效，`vite preview` 用独立的 `preview.proxy`；不补则 preview 模式下 `/api` 不转发到 :3000，e2e 全挂。

- [ ] **Step 2: 在 `packages/web-admin/package.json` 的 `scripts` 加 `e2e:preview`**

新增一行（其余不变）：

```json
    "e2e:preview": "vite build && vite preview --port 5173 --strictPort",
```

- [ ] **Step 3: 验证 build + preview 可起且代理生效**

前置：先在另一个终端起 e2e API server：`cd packages/server && (pnpm e2e:server &) ; sleep 6`

Run：
```bash
cd packages/web-admin && (pnpm e2e:preview &) ; sleep 20
curl -s http://localhost:5173/ -o /dev/null -w "page:%{http_code}\n"
curl -s http://localhost:5173/api/health -w "\n"
```
Expected: `page:200`；`/api/health` 经 preview 代理返回 `{"ok":true}`（证明 `preview.proxy` 生效）。

Run（收尾）：
```bash
pkill -f "vite preview" || true ; pkill -f "src/e2e/main.ts" || true
```

- [ ] **Step 4: Commit**

```bash
git add packages/web-admin/vite.config.ts packages/web-admin/package.json
git commit -m "feat(web-admin): vite preview 代理 /api + e2e:preview 脚本"
```

---

## Task 5: 搭 `packages/e2e`（Playwright）骨架

**Files:**
- Create: `packages/e2e/package.json`
- Create: `packages/e2e/tsconfig.json`
- Create: `packages/e2e/playwright.config.ts`
- Modify: 根 `package.json`（加 `e2e` 脚本）
- Modify: `.gitignore`（忽略 Playwright 产物）

- [ ] **Step 1: 创建 `packages/e2e/package.json`**

```json
{
  "name": "@teampilot/e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: 创建 `packages/e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["tests", "playwright.config.ts"]
}
```

- [ ] **Step 3: 创建 `packages/e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @teampilot/server e2e:server",
      url: "http://localhost:3000/api/health",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @teampilot/web-admin e2e:preview",
      url: "http://localhost:5173",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
```

- [ ] **Step 4: 根 `package.json` 加 `e2e` 脚本**

在根 `package.json` 的 `scripts` 中新增（其余不变）：

```json
    "e2e": "pnpm --filter @teampilot/e2e e2e",
```

- [ ] **Step 5: `.gitignore` 忽略 Playwright 产物**

在 `.gitignore` 末尾追加：

```
packages/e2e/playwright-report/
packages/e2e/test-results/
packages/e2e/blob-report/
```

- [ ] **Step 6: 安装依赖与浏览器**

> **审计提醒（高）:** `@playwright/test` 依赖的 `playwright` 包带 postinstall（浏览器下载），会再次撞上 Task 1 的同一道 allowBuilds 闸——企业 wrapper 会在 `pnpm-workspace.yaml` 的 `allowBuilds` 追加 `playwright: set this to true or false` 并以 `ERR_PNPM_IGNORED_BUILDS` 报错。需把它（及任何新出现的占位项）填为 `true` 再重装。
>
> **风险（执行前先验，go/no-go）:** 引入新外部依赖 `@playwright/test` 还要过 Canva 的「supply-chain policy」校验（install 时会 `Verifying lockfile against supply-chain policies`）。若 install 因 **policy**（而非 ignored-builds）被拦，这是组织级审批闸、非代码可解——需走内部依赖审批流程。**建议执行 Task 5 前先单独 `pnpm --filter @teampilot/e2e add -D @playwright/test` 试一次**，确认能过 policy，再继续后续任务。

Run（先加依赖；若报 ignored-builds，按上面提示补 allowBuilds 后重跑 install）:
```bash
pnpm --filter @teampilot/e2e add -D @playwright/test @types/node
# 若报 ERR_PNPM_IGNORED_BUILDS 且 pnpm-workspace.yaml 新增了 playwright 占位项：
#   把该项改为 `playwright: true`（编辑 pnpm-workspace.yaml），再：
pnpm install
pnpm --filter @teampilot/e2e exec playwright install chromium
```
Expected: 依赖装上、`pnpm-workspace.yaml` 中 `playwright` 已是 `true`（若曾出现）、无 `ERR_PNPM_IGNORED_BUILDS`、chromium 下载完成。
（若 Step 1 已把 `@playwright/test` 写进 `packages/e2e/package.json`，可直接 `pnpm install` 代替 `add`，行为一致。）

Run（确认 Playwright 可用）：
```bash
pnpm --filter @teampilot/e2e exec playwright --version
```
Expected: 打印 `Version 1.49.x`。

- [ ] **Step 7: Commit**

```bash
git add packages/e2e/package.json packages/e2e/tsconfig.json packages/e2e/playwright.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore
git commit -m "chore(e2e): 搭建 packages/e2e Playwright 骨架"
```
（`pnpm-workspace.yaml` 仅在 Step 6 因 playwright 新增 allowBuilds 项时才有改动；无改动则 `git add` 会忽略它。）

---

## Task 6: happy path 闭环 spec

**Files:**
- Create: `packages/e2e/fixtures/sample.mp3`
- Create: `packages/e2e/tests/happy-path.spec.ts`

- [ ] **Step 1: 创建占位音频 fixture**

Run（内容无关紧要，fakeAsr 忽略字节；仅需 `.mp3` 扩展名通过后端格式校验）：
```bash
mkdir -p packages/e2e/fixtures && printf 'ID3e2e-fake-audio' > packages/e2e/fixtures/sample.mp3
```
Expected: 生成 `packages/e2e/fixtures/sample.mp3`（约十几字节）。

- [ ] **Step 2: 写 happy path spec `packages/e2e/tests/happy-path.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const SAMPLE_MP3 = fileURLToPath(new URL("../fixtures/sample.mp3", import.meta.url));

test.describe.configure({ mode: "serial" });

test("队长后台核心 happy path：登录→建活动→选参与人→发布→通知状态→复盘转写+AI概要", async ({ page }) => {
  // 1) 登录
  await page.goto("/");
  await page.getByLabel("账号", { exact: true }).fill("Levin");
  await page.getByLabel("密码", { exact: true }).fill("change-me");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "活动管理" })).toBeVisible();

  // 2) 创建活动：校验默认值（时长 120 / 默认场地 / active 队员全选）
  await page.getByRole("link", { name: "创建活动" }).click();
  await expect(page.getByRole("heading", { name: "创建活动" })).toBeVisible();
  await expect(page.getByLabel("预计时长")).toHaveValue("120");
  await expect(page.getByLabel("活动地点")).toHaveValue("e2e训练基地");
  await expect(page.getByLabel("参加-甲")).toBeChecked();
  await expect(page.getByLabel("参加-乙")).toBeChecked();
  await expect(page.getByLabel("参加-丙")).toBeChecked();

  // 3) 选参与人：取消勾选「丙」（最终参与人 = 甲、乙，共 2 人）
  await page.getByLabel("参加-丙").uncheck();
  await expect(page.getByLabel("参加-丙")).not.toBeChecked();

  // 填必填项
  await page.getByLabel("活动名称").fill("e2e 周日训练");
  await page.getByLabel("类型-训练").check();
  await page.getByLabel("开始时间").fill("2026-06-07T18:30");

  // 4) 发布（确认弹窗 → 确认发布）
  // 注意：getByRole 的 name 默认是「子串」匹配，"发布" 会同时命中 "确认发布"，故用 exact:true
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByText("是否要发布活动？")).toBeVisible();
  await page.getByRole("button", { name: "确认发布" }).click();

  // 落到详情页（标题 = 活动名）
  await expect(page.getByRole("heading", { name: "e2e 周日训练" })).toBeVisible();

  // 5) 活动概要 Tab（默认）：通知状态 = 成功 2 / 失败 0
  const notifBlock = page.locator("div").filter({ hasText: "通知状态" }).last();
  await expect(notifBlock).toContainText("成功 2 / 失败 0");

  // 5b) 概要页 AI 按钮：生成训练建议（走 fakeLLM 训练助理分支）
  await page.getByRole("button", { name: "生成训练建议" }).click();
  await expect(page.getByText("（e2e）提升传球成功率")).toBeVisible();

  // 6) 活动复盘 Tab
  await page.getByRole("button", { name: "活动复盘" }).click();
  const notes = page.getByRole("textbox");
  await notes.fill("队员状态不错，配合默契。");
  // onBlur 触发 PUT 保存。必须等保存完成再上传，否则与转写的「读-改-写」存在竞态：
  // 后置落地的 PUT 可能覆盖掉转写文本，导致 toHaveValue 偶发失败。用 waitForResponse 同步。
  await Promise.all([
    page.waitForResponse((r) => /\/review$/.test(new URL(r.url()).pathname) && r.request().method() === "PUT"),
    notes.blur(),
  ]);

  // 上传录音 → fakeAsr 返回固定文本，后端追加进 rawNotes，前端重拉展示
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_MP3);
  await expect(notes).toHaveValue(/（e2e）这是录音转写出来的复盘文本/);
  await expect(notes).toHaveValue(/sample\.mp3 转写内容/);

  // 生成 AI 复盘概要（走 fakeLLM 复盘助理-训练分支）
  await page.getByRole("button", { name: "生成复盘" }).click();
  await expect(page.getByText(/整体总结：（e2e）整体表现稳定/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新生成" })).toBeVisible();
});
```

- [ ] **Step 3: 跑 e2e（首跑，含起 server + build preview + 浏览器）**

Run:
```bash
pnpm e2e
```
Expected: Playwright 自动起两个 webServer（:3000 e2e API、:5173 web-admin preview），chromium 跑该 spec，结果 `1 passed`。

> 若失败：按 Playwright 报错定位。常见点：(a) 选择器文案与页面不符——以 `packages/web-admin/src` 实际文案为准修正；(b) preview 代理未生效——回查 Task 4 的 `preview.proxy`；(c) 通知数不为 2——确认 Task 3 seed 了 3 名 active 队员且 spec 取消勾选了「丙」。用 `pnpm --filter @teampilot/e2e exec playwright test --headed` 或查看 `packages/e2e/playwright-report` 调试。

- [ ] **Step 4: 复跑一次确认稳定（可重复）**

Run: `pnpm e2e`
Expected: 再次 `1 passed`（启动器每次 `--force-reset` 重置 e2e DB，幂等）。

- [ ] **Step 5: Commit**

```bash
git add packages/e2e/tests/happy-path.spec.ts packages/e2e/fixtures/sample.mp3
git commit -m "test(e2e): web-admin 核心 happy path 闭环（登录→发布→通知→复盘转写+AI）"
```

---

## Task 7: README 测试章节补 e2e 说明

**Files:**
- Modify: `README.md`（测试章节）

- [ ] **Step 1: 在 README 测试章节追加 e2e 小节**

在 `README.md` 的测试相关章节末尾追加（措辞可依现有 README 风格微调，但须包含以下信息）：

```markdown
### 端到端测试（e2e）

`packages/e2e` 用 Playwright 跑 web-admin 的浏览器全链路：真实 server（注入确定性假外部服务：飞书 / 方舟 LLM / 火山 ASR）+ web-admin 的 `vite preview` 构建产物 + 独立 e2e SQLite 库。

```bash
# 首次需安装浏览器
pnpm --filter @teampilot/e2e exec playwright install chromium
# 跑 e2e（自动起 :3000 e2e server 与 :5173 web-admin preview）
pnpm e2e
```

覆盖：登录 → 建活动（校验默认值）→ 选参与人 → 发布 → 通知状态 → 复盘填写/上传录音转写 → 生成 AI 复盘概要 / 训练建议，全程断言 UI 渲染了真实后端返回的数据。

不覆盖：真实飞书 / 方舟 / 火山外部服务；web-h5 队员加入流程；非 happy-path 分支（这些由 server API 集成测试与 web 组件测试覆盖）。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README 补充 e2e 测试章节"
```

---

## Self-Review（已完成，记录于此）

- **Spec 覆盖**：Part A → Task 1；ASR 注入缝 → Task 2；e2e 启动器/假实现 → Task 3；preview.proxy 坑 → Task 4；packages/e2e + 独立命令 → Task 5；happy path 闭环（含登录/建活动/选参与人/发布/通知/复盘转写/AI 概要）→ Task 6；README → Task 7。无遗漏。
- **占位符**：无 TBD/TODO；每个改动均给出完整代码与确切命令、预期输出。
- **类型一致**：`createApp` 新增 `asr?: AsrProvider`（Task 2）与启动器注入 `asr`（Task 3）一致；`fakeNotifier.sendCard(openId, card)` 匹配 `FeishuNotifier`；`fakeLLM.completeJSON(system, user)` 匹配 `LLMClient`；`fakeAsr.transcribe(bytes, format)` 匹配 `AsrProvider`；通知计数断言「2」与「取消勾选丙 / seed 3 人」一致。
- **范围**：聚焦两件确认过的事，单一实现计划可完成。

## 审计修订记录（两遍审计后修正，2026-05-30）

- **[已实测修正·高] Task 1 修法错误**：原写法 `package.json` 的 `pnpm.onlyBuiltDependencies` 在 pnpm 11 被忽略（实测仍报 `ERR_PNPM_IGNORED_BUILDS`）。正确修法＝填 `pnpm-workspace.yaml` 的 `allowBuilds` 五项为 `true`。已实测 `pnpm install` + `pnpm test` 4 包全绿、退出码 0。
- **[已修·高] Task 5 装 Playwright 会再触发同一道 allowBuilds 闸**：`playwright` 带 postinstall，wrapper 会新增 `playwright` 占位项并报错——需补填为 `true` 再装。另：新外部依赖须过 Canva supply-chain policy，建议执行前先单独 `add` 验证（go/no-go）。
- **[已修·中] Task 6 竞态**：复盘 `onBlur` 的 PUT 与上传转写的「读-改-写」存在竞态，后置 PUT 可能覆盖转写文本→偶发失败。改用 `waitForResponse` 等 PUT 完成再上传。
- **[已修·低] Task 6 选择器**：`getByRole` name 默认子串匹配，`发布` 会命中 `确认发布`，已加 `exact:true`。
- **[已核对·通过]**：`/api/admin/settings` 返回 `defaultLocation`（断言「e2e训练基地」成立）；`Layout` 无 textbox，复盘页 `getByRole("textbox")` 唯一命中；导航有「活动管理」链接但断言用 `getByRole("heading")` 不冲突；`db/client.ts` import 即实例化 PrismaClient → 启动器「先设 env 再动态 import」正确；`.env`（含真实密钥）已 gitignore、dotenv 不覆盖已设 env → e2e DB 隔离成立；`notifyPublish` 按 active 参与人计数 → 「成功 2」成立。
- **[备注·低] 性能**：Playwright webServer 经 `pnpm --filter` 启动会各自付一次 verify-deps + supply-chain 校验（~8s）。可选优化：webServer 命令前置 `--config.verify-deps-before-run=false` 或直接 `tsx`。不影响正确性。
