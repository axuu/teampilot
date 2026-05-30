# TeamPilot · 藤球队 AI 管理助手

队长用的球队管理系统：成员/活动管理、飞书通知与出勤反馈、AI 训练/比赛建议与复盘、录音转写、AI 队长助理、队员 Bot 问询。

- **后端**：Express + Prisma(SQLite) + 飞书长连接 + 进程内 scheduler
- **前端**：React + Vite + Tailwind（队长后台 `web-admin`、队员 H5 入队 `web-h5`）
- **外部服务**：飞书（中国版，长连接）· 火山方舟豆包 LLM · 豆包录音识别 2.0 极速版 ASR

> 详尽产品/架构设计见 `docs/superpowers/specs/`，分阶段实现计划见 `docs/superpowers/plans/`。

---

## 仓库结构（pnpm workspaces monorepo）

```
packages/
  server/      # Express + Prisma + 飞书长连接 + scheduler + ai/asr/notifications
  web-admin/   # 队长后台 SPA（桌面）
  web-h5/      # 队员入队 H5（飞书内打开、免登）
  shared/      # 跨端共享类型/常量
docs/
  feishu-app-setup.md     # 飞书自建应用配置 + card.action.trigger 排错
  volc-asr-setup.md       # 火山豆包 ASR(极速版) + 方舟 LLM 配置与排错
  superpowers/specs/      # 产品规格 + 架构设计（含裁决记录）
  superpowers/plans/      # Plan A/B/C/D 分阶段实现计划（含 checkbox 进度）
```

## 已交付（4 个阶段，均合并到 main + 真机验收通过）

| 阶段 | 内容 | 状态 |
|---|---|---|
| Plan A 后端核心 | 鉴权、成员、活动生命周期、出勤、scheduler 自动结束 | ✅ |
| Plan B 前端 | 队长后台（登录/成员/活动/详情）+ 队员入队 H5 | ✅ |
| Plan C 飞书通知 | 发布/取消发卡片、去/不去经长连接实时回写、24h/2h 提醒、失败重试 | ✅ 真机 |
| Plan D AI | 训练/比赛建议、AI 复盘、活动总结(A/B)、队长助理、队员 Bot、录音转写(ASR) | ✅ 真机 |

测试：`server` / `web-admin` / `web-h5` 全绿；三包 `tsc` 干净。

---

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

> ⚠️ **本机 pnpm 供应链策略坑（重要）**：本环境的 pnpm 启用了 `minimumReleaseAge`，会拦截「发布过新」的依赖（如 `electron-to-chromium`/`hasown` 这类频繁发版的传递依赖），导致 `pnpm install` / `pnpm test` / `pnpm run` / `pnpm exec` 失败。应对：
> - 安装：`pnpm install --config.minimumReleaseAge=0`（CLI flag 才覆盖得了，`.npmrc`/env 无效）
> - 跑测试 / 起服务：**直接用各包的二进制，绕过 pnpm 的运行前校验**（见下）

### 2) 配置环境变量

```bash
cp packages/server/.env.example packages/server/.env   # 然后填真实值
```
凭证获取与排错：
- 飞书 → [`docs/feishu-app-setup.md`](docs/feishu-app-setup.md)
- 火山方舟 LLM + 豆包录音识别 ASR → [`docs/volc-asr-setup.md`](docs/volc-asr-setup.md)

需要的 key（详见 `.env.example`）：`DATABASE_URL` `TEAM_TZ` `CAPTAIN_USERNAME/PASSWORD` `TEAM_DEFAULT_LOCATION` `TEAM_JOIN_TOKEN` `SESSION_SECRET` `FEISHU_APP_ID/SECRET` `H5_BASE_URL` `ARK_API_KEY/BASE_URL/MODEL` `VOLC_ASR_APP_ID/ACCESS_TOKEN`。

### 3) 初始化 + 起服务（server）

```bash
cd packages/server
./node_modules/.bin/prisma db push        # 建表（dev.db）
./node_modules/.bin/tsx --env-file=.env prisma/seed.ts   # 种子：队长 + 球队设置
./node_modules/.bin/tsx --env-file=.env src/index.ts     # 起服务（:3000 + 飞书长连接 + scheduler）
# 看到 `server on :3000` 和 `ws client ready` 即就绪
```
前端：`pnpm --filter @teampilot/web-admin dev`（:5173）、`pnpm --filter @teampilot/web-h5 dev`（:5174）。
（若 pnpm dev 被供应链策略拦，用各包的 `./node_modules/.bin/vite` 直接起。）

### 4) 跑测试 / 类型检查（绕过 pnpm 运行前校验）

```bash
# 测试：每个包用直连 vitest 二进制
( cd packages/server   && ./node_modules/.bin/vitest run )
( cd packages/web-admin && ./node_modules/.bin/vitest run )
( cd packages/web-h5   && ./node_modules/.bin/vitest run )
# 类型检查
( cd packages/server   && ./node_modules/.bin/tsc -p tsconfig.json --noEmit )
( cd packages/web-admin && ./node_modules/.bin/tsc --noEmit )
```
> 单测**零网络**：LLM/ASR/飞书全部走可注入接口 + 假实现；外部 SDK 适配层靠真机验收。
> `arkClient`/`volcAsrProvider` 带 `NODE_ENV==="test"` 守卫，测试中绝不会发真实调用。

### 5) 端到端测试（e2e）

`packages/e2e` 使用 **Playwright** 对 web-admin 跑完整浏览器流程：真实 Express server（飞书 / 方舟 LLM / 火山 ASR 均由确定性假实现替代）+ web-admin `vite preview` 构建产物 + 隔离的 e2e SQLite 数据库。

**覆盖范围**：登录 → 建活动（校验默认值）→ 选参与人 → 发布 → 通知状态 → 复盘填写/上传录音转写 → 生成 AI 复盘概要 / 训练建议，全程断言 UI 渲染了真实后端返回的数据。

**不覆盖**：真实飞书 / 方舟 / 火山外部服务；web-h5 队员加入流程；非 happy-path 分支（由 server API 集成测试与 web 组件测试覆盖）。

**运行方式**：

```bash
# 首次：安装 Chromium
pnpm --filter @teampilot/e2e exec playwright install chromium

# 跑 e2e（自动启动 :3000 e2e server 和 :5173 web-admin preview）
pnpm e2e
```

---

## 关键约定

- **TDD**：先写失败测试再实现；只改服务当前任务的代码。
- **可注入外部依赖**：`FeishuNotifier`（飞书）、`LLMClient`（方舟）、`AsrProvider`（火山 ASR）都是注入式接口，便于零网络单测。
- **飞书长连接**：`lark.WSClient` 同时接 `card.action.trigger`（卡片去/不去回调）和 `im.message.receive_v1`（队员 Bot）；事件按 message_id 去重（防重复投递重复回复）。
- **ASR**：豆包录音识别极速版 `recognize/flash` + 内联 base64 同步转写，无需 TOS/URL/对象存储（见 `docs/volc-asr-setup.md`）。
- **AI 输出**：方舟部分模型不支持 `response_format=json_object`，`arkClient` 改为去掉它 + 健壮 JSON 提取后再 zod 校验。

## 文档索引

| 文档 | 用途 |
|---|---|
| [docs/feishu-app-setup.md](docs/feishu-app-setup.md) | 飞书自建应用配置（机器人/权限/长连接订阅/发版）+ 卡片回调 200340 排错 |
| [docs/volc-asr-setup.md](docs/volc-asr-setup.md) | 火山豆包 ASR(极速版) + 方舟 LLM 配置、接口、排错 |
| [docs/superpowers/specs/](docs/superpowers/specs/) | 产品规格 + 架构设计（数据模型、数据流、裁决记录） |
| [docs/superpowers/plans/](docs/superpowers/plans/) | Plan A/B/C/D 分阶段实现计划 |
