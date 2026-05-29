# AI 球队经理 MVP — 技术设计文档

- **日期**：2026-05-29
- **配套产品规格**：[`2026-05-29-ai-team-manager-product-spec.md`](./2026-05-29-ai-team-manager-product-spec.md)（同目录）
- **文档边界**：本文档只描述"怎么实现"。产品"是什么/为什么/页面与文案"以产品规格为准；两者冲突时，产品规格优先，本文档第 11 节列出已识别的冲突及裁决。

---

## 0. 平台与技术决策（已确认）

| 维度 | 决策 | 备注 |
|---|---|---|
| 技术栈 | TypeScript 全栈，前后端分离 | 后端 Node + Express + Prisma；前端 React + Vite + Tailwind |
| 目标平台 | **飞书（中国版，open.feishu.cn）**，企业自建应用**待创建** | 实现计划需含"建应用 + 配置"前置步骤（见第 9 节） |
| LLM | **豆包 / 火山方舟（Volcengine Ark）** | OpenAI 兼容接口，用 `openai` npm 包，`base_url=https://ark.cn-beijing.volces.com/api/v3` |
| ASR | **火山引擎 大模型录音文件识别** | 异步：提交任务（音频 URL）→ 查询结果 / 回调 |
| 对象存储 | **火山 TOS** | 存放复盘录音，提供给 ASR 拉取的 URL |
| 数据库 | **SQLite + Prisma** | 单队小数据量；切 Postgres 仅改 datasource + 枚举改原生 enum |
| 部署形态 | **单进程单体 + 飞书长连接（WebSocket）+ TOS** | 见第 1 节 |

**关键架构红利**：飞书官方 Node SDK（`@larksuiteoapi/node-sdk`）支持**长连接模式**接收事件/卡片回调，服务端主动外连飞书开放平台，**不需要公网入站、不需要配置回调 URL 与加解密验签**。这消除了飞书接入里最大的一块基建与调试成本。唯一需要公网可达的是 **Web 层**（H5 要能被飞书客户端加载、前端要能调 API）。

---

## 1. 整体架构与进程模型

单个 Node/Express 进程，启动时拉起四个子系统，共享同一个 Prisma(SQLite) 连接与业务模块：

```
┌──────────────────────── Node 进程 (Express) ────────────────────────┐
│  REST API (/api/*)         静态托管 (队长后台 /admin、队员 H5 /h5)     │
│  飞书长连接 (lark.WSClient + EventDispatcher)   进程内 Scheduler(1min) │
└───────────┬────────────────────────┬───────────────────┬────────────┘
            │ Prisma                  │ openai→火山方舟      │ 火山 ASR + TOS
        SQLite 文件             豆包 LLM (场景1/2/3/4/5a/5b)  录音异步转写
```

- **入站只有 Web 层**；飞书事件/卡片回调走长连接主动外连。
- **Scheduler** 每分钟 tick，三件事，全部**幂等**（靠 DB 状态判重，进程重启不重复执行）：① 自动结束到期活动 ② 发 24h/2h 活动前提醒 ③ 轮询未完成的 ASR 任务。
- 进程内运行，无 Redis、无消息队列。单实例规模匹配"单队、几十人、每周几场"。

**为什么单进程**：MVP 规模极小；长连接需要一个常驻进程承载；进程内 cron 足够。未来要扩展：长连接换 Webhook、SQLite 换 Postgres、cron 换队列，均为局部替换，不动业务逻辑。

---

## 2. 仓库结构（pnpm workspaces monorepo）

```
teampilot/
  pnpm-workspace.yaml
  package.json                  # workspace root
  packages/
    shared/                     # 枚举常量 + zod schema + API DTO 类型（前后端共享）
      src/enums.ts  src/dto.ts  src/index.ts
    server/                     # Express + Prisma + 飞书长连接 + scheduler + ai/asr
      prisma/schema.prisma
      src/
        config/    db/    auth/    members/    activities/    attendance/
        reviews/   feishu/   ai/   asr/   scheduler/   notifications/   assistant/
        app.ts     index.ts
    web-admin/                  # React + Vite + Tailwind，队长后台 SPA（桌面）
    web-h5/                     # React + Vite + Tailwind，队员入队 H5（移动端，飞书内）
  docs/superpowers/specs/
```

- **开发态**：两个 Vite dev server，把 `/api` 代理到 Express（`localhost`）。
- **生产态**：`web-admin`、`web-h5` 构建产物由 Express 静态托管（如 `/admin/*`、`/h5/*`），API 在 `/api/*`。
- **shared 包**：枚举（String 联合类型）、zod 校验 schema、请求/响应 DTO 类型，前后端单一真相源。

---

## 3. 后端模块划分

每个模块职责单一、对外暴露明确接口、可独立测试。

| 模块 | 职责 | 主要依赖 |
|---|---|---|
| `config` | 读取/校验环境变量（飞书 appId/secret/encryptKey、方舟 key+endpoint、火山 ASR/TOS 凭证、队长种子账号、TEAM_TZ、DB url） | — |
| `db` | Prisma client 单例 | config |
| `auth` | 队长账号密码登录、会话 cookie、`requireCaptain` 中间件 | db |
| `members` | 队员 CRUD、筛选；H5 入队（飞书身份 → 创建/查重/离队判定） | db, feishu |
| `activities` | 活动 CRUD、草稿/发布/取消生命周期、参与范围选择与发布快照、列表派生列 | db, feishu, notifications, ai |
| `attendance` | 实际到场标记；活动前反馈对后台只读 | db |
| `reviews` | 复盘记录读写、触发 AI 复盘、录音上传入口 | db, ai, asr |
| `feishu` | SDK 客户端、tenant_access_token（SDK 托管）、发卡片、H5 免登、长连接事件分发 | config |
| `ai` | 方舟 LLM 客户端、LLM 场景 prompt 模板（1/2/3/4/5a/5b）、上下文组装（含历史 fallback）、结构化输出 zod 校验 | db, config |
| `asr` | TOS 上传、火山录音识别提交/查询、回填转写文本 | db, config |
| `scheduler` | 每分钟 tick：自动结束、提醒、ASR 轮询 | db, feishu, ai, asr, notifications |
| `notifications` | 通知日志 + 发送 + 失败重试（只补发失败对象） | db, feishu |
| `assistant` | 队长助理对话（10 分钟会话窗口） | db, ai |

---

## 4. 前端应用

### 4.1 `web-admin`（队长后台 SPA）
- **登录态**：cookie 会话；未登录跳登录页；登录后默认落地"活动管理页"。
- **布局**：固定顶部栏（左"Levin 的球队" / 右"Levin" + ⚙设置 + 退出）+ 左侧导航（队员管理、活动管理、AI 队长助理）+ 内容区。
- **页面**：登录页、配置页（⚙）、队员管理（含邀请弹框）、活动管理（列表+筛选）、创建/编辑草稿活动、活动详情（概要/出勤/复盘 三 Tab）、AI 队长助理。
- **AI 输出**：呈现为"可审阅的工作结果"分节卡片，非聊天玩具。
- **轮询**：复盘 ASR 转写、AI 生成进行中状态用轮询/SSE（MVP 用轮询）驱动 Toast。

### 4.2 `web-h5`（队员入队 H5，飞书内）
- **身份**：页面加载 → 飞书免登（见 5.2）拿 open_id → 后端判定状态（未入队/已入队/已离队/身份失败/链接无效）→ 渲染对应结果页。
- **表单字段**：姓名*、擅长位置*、备选位置、水平、风格（无球衣号）。
- **提交成功页**：见第 11 节裁决 F2（"已加入球队" + 引导打开 Bot 一行）。
- 移动端布局，无后台任何信息泄露入口。

---

## 5. 数据模型（Prisma / SQLite）

**SQLite 约束**：Prisma 在 SQLite 下不支持原生 `enum`。所有枚举用 `String` 列存储，取值与校验由 `shared` 包的 TS 联合类型 + zod 统一约束。切 Postgres 时把这些 String 升级为原生 enum 即可。

### 5.1 枚举（shared/enums.ts，String 取值）

| 枚举 | 取值 |
|---|---|
| `Position` | `tekong` / `feeder` / `striker` |
| `MemberLevel` | `novice`(新手) / `intermediate`(中等) / `upper`(中上) / `advanced`(高水平) |
| `MemberStyle` | 进攻型/防守型/全能型/发球专精/技术细腻/爆发力强/稳定均衡/跑动积极/战术灵活/队长领袖型（10 个预设） |
| `MemberStatus` | `active`(正常) / `left`(离队) |
| `ActivityType` | `training`(训练) / `match`(比赛) |
| `ActivityStatus` | `draft` / `published` / `ended` / `cancelled` |
| `AttendanceResponse` | `going` / `not_going` / `no_response` |
| `ActualAttendance` | `present`(已到场) / `absent`(未到场) / `pending`(待确认) |
| `SummaryStage` | `none` / `initial`(时机A) / `post_review`(时机B) |
| `NotificationType` | `publish` / `cancel` / `reminder` |
| `NotificationStatus` | `pending` / `success` / `failed` |
| `AsrStatus` | `uploading` / `transcribing` / `succeeded` / `failed` |
| `AssistantRole` | `ai` / `captain` |

### 5.2 实体（9 张表）

```prisma
model Captain {            // 种子单行，不开放注册
  id           String  @id @default(cuid())
  username     String  @unique
  passwordHash String
  displayName  String          // "Levin"
}

model TeamSettings {       // 单例行
  id              String @id @default("singleton")
  defaultLocation String          // 创建活动时地点默认值（种子/env 预置，配置页不暴露 — F4）
  trainingRules   String @default("")   // 配置页：训练规则（注入场景1）
  matchRules      String @default("")   // 配置页：比赛规则（注入场景2）
}

model Member {
  id             String   @id @default(cuid())
  name           String
  jerseyNumber   String?         // H5 不采集，队长后台补填
  primaryPosition String         // Position
  backupPosition String?         // Position
  level          String?         // MemberLevel
  style          String?         // MemberStyle
  status         String   @default("active")   // MemberStatus
  captainNote    String?         // ≤100 字，内部，不对队员展示
  feishuOpenId   String   @unique // 飞书身份；一人一记录
  createdAt      DateTime @default(now())
  participants   ActivityParticipant[]
}

model Activity {
  id              String   @id @default(cuid())
  name            String
  type            String          // ActivityType
  startTime       DateTime
  durationMinutes Int      @default(120)
  location        String
  theme           String?         // 活动主题
  notes           String?         // 注意事项
  status          String   @default("draft")    // ActivityStatus
  cancelReason    String?
  summary         String?         // 活动总结（场景4 输出）
  summaryStage    String   @default("none")     // SummaryStage
  summaryUpdatedAt DateTime?
  reminderAt      DateTime?       // 发布时按 24h/2h 规则算好；null=不提醒（F9）
  publishedAt     DateTime?
  endedAt         DateTime?
  createdAt       DateTime @default(now())
  participants    ActivityParticipant[]
  review          ActivityReview?
  asrJobs         AsrJob[]
  notifications   NotificationLog[]
}

model ActivityParticipant {  // 参与范围；草稿即存所选集合，发布时冻结快照
  id                 String   @id @default(cuid())
  activityId         String
  memberId           String
  attendanceResponse String   @default("no_response")  // AttendanceResponse
  responseUpdatedAt  DateTime?
  actualAttendance   String?         // ActualAttendance；活动结束后 going→pending
  activity           Activity @relation(fields: [activityId], references: [id])
  member             Member   @relation(fields: [memberId], references: [id])
  @@unique([activityId, memberId])
}

model ActivityReview {       // 与活动一对一
  activityId       String   @id
  rawNotes         String   @default("")   // 我的复盘记录 = 手输 + 转写拼接原文
  aiSummary        String?         // AI 复盘总结（场景3 输出，公开物）
  aiSummaryUpdatedAt DateTime?
  activity         Activity @relation(fields: [activityId], references: [id])
}

model AsrJob {
  id          String   @id @default(cuid())
  activityId  String
  fileName    String
  tosUrl      String
  volcTaskId  String?
  status      String   @default("uploading")  // AsrStatus
  failReason  String?
  transcript  String?
  createdAt   DateTime @default(now())
  activity    Activity @relation(fields: [activityId], references: [id])
}

model NotificationLog {
  id              String   @id @default(cuid())
  activityId      String
  memberId        String
  type            String          // NotificationType
  status          String   @default("pending")  // NotificationStatus
  failReason      String?
  feishuMessageId String?
  createdAt       DateTime @default(now())
  sentAt          DateTime?
  activity        Activity @relation(fields: [activityId], references: [id])
  @@index([activityId, type, status])
}

model AssistantMessage {    // 队长助理；按 createdAt 算 10 分钟会话窗口，无独立 session 表
  id        String   @id @default(cuid())
  role      String          // AssistantRole
  content   String
  createdAt DateTime @default(now())
}
```

### 5.3 关键建模决定

1. **Member 永不物理删除**，"离队" = `status=left`；历史活动通过 `ActivityParticipant` FK 引用 Member，离队不破坏历史（满足规格 8.1 / 5.3）。
2. **"发布快照"语义** = 参与队员**集合**在发布后冻结、新队员不自动加入（`activities.publish` 后不再增删 participant）；队员**属性**（姓名/位置等）读实时值——AI 生成时用当前资料，历史摘要本身已是冻结文本，无需快照属性。
3. **"活动总结"(场景4)** 存 `Activity.summary`；**"AI 复盘总结"(场景3)** 存 `ActivityReview.aiSummary`——两者不同物（前者在概要 Tab、后者在复盘 Tab；后者更新触发前者进入 `post_review` 阶段）。
4. **固定注册链接**是一条常量路由（单球队，如 `/h5/join`），无 per-link 表；H5 对非法路径返回"链接无效"。
5. **队员 Bot 问询(场景5b) 单轮无状态**，不持久化对话。
6. **时间**统一存 UTC，按 `TEAM_TZ`（默认 `Asia/Shanghai`）展示（F15）。

---

## 6. 核心数据流

### 6.1 入队闭环
```
队长在队员管理页"邀请队员"→ 复制固定链接 → 队员在飞书内打开 /h5/join
→ H5 飞书免登拿 open_id → POST /api/h5/join {open_id, 表单}
→ members 模块判定：
     无记录            → 创建 Member(active) → 成功页（已加入 + 引导打开 Bot, F2）
     已存在 active     → "已加入球队"
     已存在 left       → "请联系队长处理"，不恢复（规格 9）
     身份失败/外部浏览器 → "请在飞书内打开"，不返回任何球队信息
```

### 6.2 活动组织闭环
```
创建草稿(选参与人，默认全选 active) → [发布] 确认弹框
→ activities.publish 事务（F12）：
     冻结参与快照 + status=published + 计算 reminderAt(24h/2h/null)
     + 异步：notifications 给每个 active 参与者发卡片(写 NotificationLog)
     + 异步：ai 生成活动总结(场景4 时机A) → Activity.summary, summaryStage=initial
→ 队员卡片点"去/不去"（长连接 card.action）→ 更新 ActivityParticipant.attendanceResponse（幂等）
   仅当 status=published 且 now<startTime 才可改；否则只回当前状态（F6 / 规格6.1）
→ Scheduler: startTime+duration<=now → status=ended，going 的参与者 actualAttendance=pending
→ 队长在"出勤情况"Tab 标记 present/absent
→ 队长在"活动复盘"Tab 填写/上传录音(ASR) → [生成复盘](场景3) → ActivityReview.aiSummary
   → 触发活动总结(场景4 时机B) → 覆盖 Activity.summary, summaryStage=post_review
→ 后续活动的建议/Bot 问询复用 aiSummary（无则 summary fallback）
```

### 6.3 飞书集成数据流
- **长连接事件**：`lark.WSClient` + `EventDispatcher.register`：
  - `im.message.receive_v1`（队员单聊发消息）→ 场景5b 队员 Bot 问询。
  - `card.action.trigger`（卡片"去/不去"按钮）→ 更新反馈，返回当前状态文本。
  - SDK 内置解密，无需手写验签。
- **发消息/卡片**：走 SDK 的 HTTP API（`im.v1.message.create`，`receive_id_type=open_id`），tenant_access_token 由 SDK 托管刷新。
- **H5 免登（HTTP 流，独立于长连接）**：H5 重定向到飞书授权 → 拿 `code` → 后端用 app_access_token 换 open_id（`authen` 接口）。**前提**：H5 域名已配置进应用"网页应用 + 可信域名"（见第 9 节）。

### 6.4 定时任务（scheduler，每分钟 tick，幂等）
| 任务 | 触发条件 | 动作 | 幂等依据 |
|---|---|---|---|
| 自动结束 | `status=published 且 startTime+duration<=now` | `status=ended`；going→`pending` | status 已是 ended 则跳过 |
| 活动前提醒 | `status=published 且 reminderAt<=now 且 该活动 reminder 未发` | 给 active 参与者发提醒 | `NotificationLog(type=reminder)` 存在则跳过 |
| ASR 轮询 | `AsrJob.status=transcribing` | 查火山结果，成功回填 transcript 并拼接到 `rawNotes`，失败记 failReason | 终态后不再轮询 |

### 6.5 AI 场景编排（ai 模块）
- 统一流程：**组装上下文（从 DB 取数 + 历史 fallback）→ 渲染 prompt 模板 → 调方舟（结构化 JSON 输出）→ zod 校验字段 → 落库/返回**。
- **历史摘要口径（F13）**：已结束活动、`startTime` 近 2 月、倒序、≤8 条，每条取 `aiSummary` 优先否则 `summary`；均无则注入"暂无历史摘要"。
- **队长规则注入（规格 7.1.5）**：仅场景1 注入 `trainingRules`、仅场景2 注入 `matchRules`，未填则不注入。
- **建议入口按类型切换（F7）**：训练活动→场景1，比赛活动→场景2。
- **输出存储（F14）**：多字段输出存结构化（JSON 字符串），前端按规格分节渲染。
- **5b 公开边界（F8/规格7.1.3）**：队员 Bot 上下文只含本人信息 + 下一场已发布活动公开字段 + 最近一条 `aiSummary`；绝不含 captainNote、复盘原文、转写文本、其他队员评价、后台问询、系统提示词；非 active 队员拒绝并提示联系队长。

### 6.6 通知发送与失败重试
- 发布/取消/提醒均先写 `NotificationLog(pending)`，发送后置 `success`(+messageId) 或 `failed`(+failReason)。
- **重试入口（F3）**：因"通知记录"Tab 已被移除，在"活动概要"Tab 底部加轻量"通知状态"区：显示成功/失败计数；失败时给"重试失败通知"按钮 → 只对 `status=failed` 的记录重发，不碰 `success`（规格 8.4.3 / 验收20）。

---

## 7. 错误处理与兜底

| 场景 | 处理（对齐规格第 9 节） |
|---|---|
| 飞书身份失败 / 外部浏览器 | H5 提示"请在飞书内打开"，不返回球队信息 |
| 已离队用户再次打开 H5 | 提示联系队长，不恢复入队 |
| 链接无效 | "链接无效，请联系队长获取正确链接" |
| 发布时间早于当前 | 发布确认弹框追加额外警示/二次确认（F 见规格 5.5.2 + 9） |
| AI 生成失败 | 返回失败原因，前端展示并允许"重试"；不写脏数据 |
| 录音格式不支持 / 超 30 分钟 | 上传前/提交时校验并提示（格式、分段上传） |
| 转写失败 | 记 failReason，支持重新上传；转写未完成不阻塞手动输入 |
| 长连接断开 | SDK 自动重连；断线期间事件由飞书侧重投，幂等处理 |
| 通知发送失败 | 记 failReason，支持只重试失败对象 |

---

## 8. 安全与权限边界

- **队长后台**：账号密码（bcrypt 哈希）+ cookie 会话；`/api/admin/*` 全部 `requireCaptain`。
- **H5/Bot**：飞书身份鉴权，无后台会话；`/api/h5/*` 校验飞书 open_id；Bot 校验发送者为 active 队员。
- **隐私矩阵**（规格 8.5）：captainNote、复盘原文、转写文本、AI 建议、后台问询**仅队长**；队员经 Bot 只能拿公开复盘摘要与公开活动字段。
- **密钥**：飞书/方舟/ASR/TOS 凭证全部走环境变量，不进配置页、不进前端、不进库。

---

## 9. 外部服务前置配置清单（实现计划阶段执行）

1. **飞书自建应用**（待创建）：
   - 启用机器人能力（单聊收发消息）。
   - 事件订阅用**长连接模式**：订阅 `im.message.receive_v1`、`card.action.trigger`；记录 App ID / App Secret / Encrypt Key / Verification Token。
   - 配置**网页应用**：H5 主页/移动端 URL + 可信域名（H5 免登所需）。
   - 申请权限 scope：发送单聊消息、读取用户 open_id（免登 authen）等。
2. **火山方舟**：开通、创建豆包模型推理接入点、获取 API Key 与 endpoint id。
3. **火山引擎大模型录音文件识别**：开通、获取 AppID/Token（或 AK/SK）。
4. **火山 TOS**：创建 bucket，配置 AK/SK 与可被 ASR 拉取的对象 URL 策略。

> 上线运营动作（规格 6.0）：引导每位队员在飞书搜索并打开球队 Bot 一次，否则主动消息无法送达。

---

## 10. 配置与环境变量（`config` 模块校验）

```
DATABASE_URL=file:./data/app.db
TEAM_TZ=Asia/Shanghai
CAPTAIN_USERNAME=...           # 种子队长
CAPTAIN_PASSWORD=...           # 首次启动哈希入库
TEAM_DEFAULT_LOCATION=...      # TeamSettings.defaultLocation 种子
SESSION_SECRET=...
FEISHU_APP_ID=...  FEISHU_APP_SECRET=...  FEISHU_ENCRYPT_KEY=...  FEISHU_VERIFICATION_TOKEN=...
H5_BASE_URL=...                # 已登记可信域名
ARK_API_KEY=...  ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3  ARK_MODEL=doubao-...
VOLC_ASR_APP_ID=...  VOLC_ASR_TOKEN=...
TOS_ENDPOINT=...  TOS_REGION=...  TOS_BUCKET=...  TOS_AK=...  TOS_SK=...
```

---

## 11. 审计结论与规格澄清（裁决记录）

> 两轮自我审计的产物。以下裁决在本文档生效；若与产品规格字面冲突，以此处为准，并已注明理由。

**第一轮（产品规格内部）**
- **F1 矛盾**：活动总结生成时机"创建后"(5.6.1) vs "发布后"(场景4时机A)。→ **以场景4为准：发布后生成**；草稿阶段概要 Tab 显示"暂无活动总结"。
- **F2 矛盾·重要**：入队成功页"仅展示已加入"(5.8) vs "增加引导打开 Bot 提示"(6.0)。→ **采纳 6.0，覆盖 5.8**：成功页 = "已加入球队" + 一行引导打开 Bot 的提示。理由：队员不先打开 Bot 单聊则收不到任何活动通知，核心闭环会静默失效。（如最终坚持极简，可在 review 时推翻。）
- **F3 缺口·重要**：验收20/8.4.3 要求重试失败通知，但 5.6 移除了"通知记录"Tab。→ 在"活动概要"Tab 底部加轻量"通知状态"区 + "重试失败通知"按钮。
- **F4 缺口**：5.5 引用"球队默认训练地点"但配置页无该项。→ `TeamSettings.defaultLocation` 由种子/env 预置，MVP 不在配置页暴露。
- **F5 歧义**：列表"出勤概况/复盘状态"取值未定义。→ 出勤概况：发布后"去X/不去Y/未反馈Z"，已结束"实到X/应到N"；复盘状态：无记录 / 有素材未生成 / 已生成。
- **F6 歧义**：反馈可改时间边界。→ 卡片可改反馈 = `status=published 且 now<startTime`；否则只回当前状态。
- **F7 歧义**：5.6.1 只写"训练建议"。→ 建议入口按类型切换：训练→场景1，比赛→场景2。
- **F8 歧义·隐私**：场景5b"公开复盘摘要"具体指哪条。→ 最近一条已结束活动的 `aiSummary`，不使用活动总结 fallback，避免泄露内部上下文。

**第二轮（技术设计）**
- **F9**：提醒规则在发布时确定 → `Activity.reminderAt` 字段 + 调度器幂等发送。
- **F10/F11**：飞书应用待创建 + 方舟/ASR/TOS 需开通 → 第 9 节前置清单。
- **F12**：发布是复合动作 → 冻结快照 + 计算 reminderAt + 异步发卡片 + 异步生成活动总结。
- **F13**：历史摘要口径统一（已结束、近2月、倒序≤8、aiSummary 优先否则 summary）。
- **F14**：AI 多字段输出以结构化 JSON + zod 校验存储与渲染。
- **F15**：固定 `TEAM_TZ`（默认 Asia/Shanghai），存 UTC 展示本地。

---

## 12. 测试策略

- **单元测试（重点，纯函数/可注入时钟）**：
  - `ai` 上下文组装与历史 fallback 选取、prompt 渲染、输出 zod 校验（mock 方舟）。
  - `scheduler` 三个任务的触发与幂等（注入固定时钟）。
  - `activities` 生命周期状态机（合法/非法跃迁）、发布快照冻结。
  - `members` 入队四态判定（新建/已入队/离队/身份失败）。
  - `notifications` 失败重试只补发 failed。
  - 反馈幂等与时间边界（F6）。
- **集成测试**：API 路由 + 真实 SQLite（临时库），飞书/方舟/ASR/TOS 在 client 边界 mock。
- **端到端（按阶段验收）**：接真实飞书的入队、卡片反馈、提醒、取消，按规格第 10 节阶段验收标准人工/脚本核验。
- **测试纪律**：先写复现/验收测试再实现（对齐根 CLAUDE.md 第 4 条）。

---

## 13. 阶段交付映射（驱动实现计划）

| 阶段（规格第10节） | 涉及模块/前端 | 主要前置 |
|---|---|---|
| **阶段1 后台核心闭环** | shared, db, config, auth, members, activities, attendance, scheduler(自动结束), web-admin(登录/队员/活动/出勤), web-h5(入队), feishu(免登) | 飞书应用 + 网页应用/可信域名 |
| **阶段2 飞书通知与卡片反馈** | feishu(长连接+发卡片), notifications, scheduler(提醒) | 飞书事件订阅(长连接) + 机器人能力 |
| **阶段3 AI 能力** | ai(场景1-5), asr(场景6), reviews, assistant, web-admin(建议/复盘/助理) | 方舟 + 火山 ASR + TOS |

> 最终交付为三阶段全部完成的完整产品（规格第10节明确要求），不交付部分演示版本。

---

## 14. 假设与未决

- **假设**：单队、单队长、单时区；队员规模数十、活动每周数场（决定了 SQLite + 单进程 + 进程内 cron 足够）。
- **假设**：球衣号唯一性不强制（规格未要求），仅作展示字段。
- **未决（不阻塞实现，留待运营/后续）**：飞书组织是否已授权机器人主动消息权限（影响是否必须逐个引导队员开 Bot）；TOS 对象是用公共读还是签名 URL 提供给 ASR（实现时按火山 ASR 拉取要求二选一）。
