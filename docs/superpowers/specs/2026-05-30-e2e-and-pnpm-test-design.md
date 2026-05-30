# 设计：修复 `pnpm test` + 引入 Playwright e2e

- 日期：2026-05-30
- 状态：已与用户确认，待转入实现计划
- 范围：两部分独立工作，A 先于 B

## 背景

仓库为 pnpm workspace，含 4 个可测包：`server`（24 文件 / 76 测试，supertest API 集成测试 + 注入假外部服务）、`web-admin`（10 / 16，组件测试 + mock fetch）、`web-h5`（1 / 4）、`shared`（1 / 5）。当前共 36 文件 / 101 测试，逐包用本地 vitest 跑全部通过。

两个已确认的缺口：

1. **`pnpm test` 跑不起来**：企业版 pnpm 的 `verify-deps-before-run` 在执行任何脚本前先 `pnpm install`，install 因构建脚本未获批准抛 `ERR_PNPM_IGNORED_BUILDS` 退出码 1，测试根本没机会开始。
2. **无真正的端到端 e2e**：后端测的是注入假外部的 API 契约，前端测的是 mock fetch 的 UI 逻辑——前端 ↔ 真实后端的浏览器全链路（真实请求路径、cookie 鉴权、字段对接、构建产物）从未被任何自动化覆盖。

## Part A —— 修复 `pnpm test`

### 根因
`verify-deps-before-run` → `pnpm install` → `@prisma/client` / `prisma` / `esbuild` / `protobufjs` 等构建脚本未获批准 → `ERR_PNPM_IGNORED_BUILDS` 退出码 1。

### 方案（推荐）
在根 `package.json` 声明构建脚本白名单：

```json
"pnpm": {
  "onlyBuiltDependencies": ["@prisma/client", "prisma", "esbuild", "protobufjs"]
}
```

pnpm 官方机制，等价于 `pnpm approve-builds` 的非交互版本，提交到版本库后人人 clone 即可 `pnpm test`。

### 备选
关闭 `verify-deps-before-run`（治标；且企业策略可能不允许）。仅当白名单方案无法消掉退出码 1 时退到此方案。

### 验收
改完后 `pnpm test` 能一次跑完 4 个包 / 101 测试，全绿。实现时实测确认退出码 1 消失；若企业层把 ignored-builds 升级成了更硬的策略导致白名单无效，退到备选方案并在 spec 记录。

## Part B —— Playwright e2e

### 已确认决策
- 外部服务：**注入确定性假实现**（飞书 / 方舟 LLM / 火山 ASR 全部用假，可无密钥、离线、进 CI）
- 覆盖范围：**核心 happy path 闭环**
- 前端范围：**仅 web-admin**
- 位置/运行：**独立 `packages/e2e` 包 + 独立命令 `pnpm e2e`**，不纳入 `pnpm test`
- web-admin serve 方式：**`vite preview`**（先 `vite build` 再起，额外覆盖「构建产物」，补上之前点名的缺口）

### 架构
新包 `packages/e2e`（Playwright + TS）。真实 server（注入假外部）+ 真实 web-admin（真浏览器）+ 真实 SQLite（独立 e2e DB 文件，不碰单测的 `test.db`）。三个进程由 Playwright 的 `webServer`（数组）拉起：

1. **e2e API server**（端口 3000）：e2e 启动器，注入 `fakeNotifier / fakeLLM / fakeAsr`，启动时 reset + seed e2e DB。
2. **web-admin**（端口 5173，`/api` 代理到 3000）：`vite build && vite preview --port 5173`。

`baseURL = http://localhost:5173`。

> **坑（必须处理）**：Vite 的 `server.proxy` 只对 dev server 生效，`vite preview` 用的是独立的 `preview.proxy`。当前 `web-admin/vite.config.ts` 只配了 `server.proxy`，preview 模式下 `/api` 不会被代理到 :3000，e2e 会全挂。需在 `vite.config.ts` 补 `preview: { proxy: { "/api": "http://localhost:3000" } }`（镜像 server.proxy）。

### server 侧改动
1. **补注入缝**：`createApp` 增加可选 `asr?: AsrProvider`，传给 `makeReviewsRouter(llm, asr)`。这是当前唯一缺口（ASR 还没经 `createApp` 暴露）。默认仍为 `volcAsrProvider`，不影响现有调用与测试。
2. **e2e 启动器** `packages/server/src/e2e/main.ts`（需 import `createApp` / `prisma` / `seed`，故置于 server 包）：
   - 设 e2e 环境变量：`DATABASE_URL=file:./prisma/e2e.db`、`CAPTAIN_USERNAME=Levin`、`CAPTAIN_PASSWORD=change-me`、`TEAM_DEFAULT_LOCATION`、`TEAM_JOIN_TOKEN`、`SESSION_SECRET`、`FEISHU_APP_ID/SECRET`、`H5_BASE_URL` 等（对齐 `vitest.config.ts` 的 env）。
   - `prisma db push --force-reset --skip-generate` 重置 e2e DB。
   - seed：调用现有 `seed()`（队长 + 团队设置）**再注入 2~3 个 active 队员**（让发布有参与人；seed 本身不含队员）。
   - `createApp({ notifier, llm, asr })` → `listen(3000)`。
3. **假实现** `packages/server/src/e2e/fakes.ts`（复用现有测试形状）：
   - `notifier.sendCard` → 返回固定 `{ messageId }`
   - `llm.completeJSON` → 返回固定 JSON（概要 / 建议的确定文本）
   - `asr.transcribe` → 返回固定转写文本

> `packages/e2e` 只放 Playwright 测试 + 配置；启动器与假实现留在 server 包内（避免 e2e 包反向依赖 server 内部）。Playwright 用 `tsx packages/server/src/e2e/main.ts` 起 API server。

### happy path 闭环（一条串行 spec）
seed 后：队长 Levin + 团队设置 + 2~3 个 active 队员。

1. 访问 `/` → 登录页输 `Levin/change-me` → 进活动列表
2. 「创建活动」→ 填名称/类型/时间 → 断言默认时长 120 / 默认场地 / active 队员全选 → 存草稿
3. 编辑参与人（取消一个）→ 保存 → 断言只剩 N-1
4. 发布 → 确认弹窗 → 成功
5. 通知状态：断言 `success=N, failed=0`
6. 复盘 Tab：填 rawNotes 保存 → 上传录音文件（fakeAsr 返回固定文本，rawNotes 追加）→ 点「生成 AI 概要」（fakeLLM 返回固定概要）→ 断言页面显示概要

每步都断言 **UI 渲染了真实后端返回的数据**——即组件测 + API 测的拼接处。

### DB 生命周期
启动器 reset + seed 一次；Playwright `workers: 1` 串行执行；spec 自己建活动（不依赖预置活动），重复跑稳定。更强隔离（仅 e2e 环境启用的 `/api/test/reset` 端点）先 YAGNI 不做。

### 运行方式
- `packages/e2e`：`pnpm e2e`（playwright test）、`pnpm e2e:ui`（调试）。
- 根 `package.json`：`"e2e": "pnpm --filter @teampilot/e2e e2e"`。
- 首次需 `npx playwright install chromium`。
- README 测试章节补一节（如何跑、覆盖什么、不覆盖什么）。

### 不覆盖（诚实声明）
- 真实飞书 / 方舟 / 火山（确定性优先，用假实现）
- web-h5 队员加入流程
- 非 happy-path 分支（校验失败 / 发布 409 / 通知失败重试——已有 API & 组件测试覆盖，e2e 不重复）

## 受影响文件清单

新增：
- `packages/e2e/`（package.json、playwright.config.ts、tests/happy-path.spec.ts、tsconfig）
- `packages/server/src/e2e/main.ts`（e2e 启动器）
- `packages/server/src/e2e/fakes.ts`（假实现）
- `docs/superpowers/specs/2026-05-30-e2e-and-pnpm-test-design.md`（本文档）

修改：
- 根 `package.json`（`pnpm.onlyBuiltDependencies` + `e2e` 脚本）
- `packages/server/src/app.ts`（`createApp` 增加 `asr` 注入并传给 `makeReviewsRouter`）
- `packages/web-admin/vite.config.ts`（补 `preview.proxy`，镜像 `server.proxy`）
- `README.md`（测试章节补 e2e 说明）
- `.gitignore`（忽略 `packages/server/prisma/e2e.db`、`packages/e2e/playwright-report`、`test-results`）
