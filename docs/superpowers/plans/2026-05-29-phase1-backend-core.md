# 阶段1 后端核心 API 实现计划（Plan A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭好 monorepo 基建并实现 AI 球队经理阶段1 的后端 API —— 队长登录、队员管理、队员飞书 H5 入队（接真实飞书身份）、活动创建/发布/取消、实际到场标记、活动自动结束，全部带测试。

**Architecture:** 单进程 Express 应用，Prisma + SQLite 持久化，cookie-session 做队长会话。枚举用 String 列 + shared 包的 zod/TS 联合类型约束。飞书仅用于 H5 免登（code→open_id），SDK 客户端通过依赖注入以便测试 mock。调度器为可注入时钟的纯函数 + setInterval 驱动。

**Tech Stack:** TypeScript(ESM) · pnpm workspaces · Express 4 · Prisma 6 + SQLite · zod · bcryptjs · cookie-session · @larksuiteoapi/node-sdk · Vitest + supertest

**配套设计**：`docs/superpowers/specs/2026-05-29-ai-team-manager-design.md`（数据模型见其 §5，闭环见 §6，裁决见 §11）。

---

## 文件结构（本计划新建/涉及）

```
teampilot/
  package.json                      # workspace root + 脚本
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  packages/
    shared/
      package.json  tsconfig.json
      src/enums.ts                   # 所有枚举的 String 常量数组 + 联合类型 + zod
      src/index.ts
      test/enums.test.ts
    server/
      package.json  tsconfig.json  vitest.config.ts
      prisma/schema.prisma           # 9 张表（本阶段全部建好）
      prisma/seed.ts                 # 种子 Captain + TeamSettings
      test/helpers/db.ts             # 测试用 DB reset/清理
      test/setup.ts                  # vitest globalSetup（db push）
      src/
        config/index.ts              # 环境变量 zod 校验
        db/client.ts                 # PrismaClient 单例
        auth/{service,routes,middleware}.ts
        feishu/{client,auth}.ts      # 客户端 + H5 免登 code→openId
        members/{service,routes,schema}.ts
        members/join.ts              # H5 入队四态逻辑 + 入队 token 校验
        activities/{service,routes,schema}.ts
        attendance/routes.ts
        scheduler/index.ts           # runAutoEnd(now) + tick + start()
        app.ts                       # Express app 组装
        index.ts                     # 启动 server + scheduler
      test/
        auth.test.ts  members.test.ts  join.test.ts
        activities.test.ts  attendance.test.ts  scheduler.test.ts
        config.test.ts
```

每个任务产出自包含改动。后续 Plan B（前端）消费本计划暴露的 `/api/admin/*` 与 `/api/h5/*`。

---

## Task 1: Monorepo 与工具链脚手架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`

- [ ] **Step 1: 写 workspace 根配置**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`package.json`:
```json
{
  "name": "teampilot",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev:server": "pnpm --filter @teampilot/server dev"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
*.db
*.db-journal
.env
packages/server/prisma/*.db
coverage/
```

- [ ] **Step 2: 安装并验证**

Run: `pnpm install`
Expected: 成功创建 lockfile（无 packages 时也应成功，提示 "Done")。

- [ ] **Step 3: 提交**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: monorepo scaffold (pnpm workspaces + tsconfig base)"
```

---

## Task 2: shared 包（枚举常量 + zod）

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/enums.ts`, `packages/shared/src/index.ts`, `packages/shared/test/enums.test.ts`

- [ ] **Step 1: 写包配置**

`packages/shared/package.json`:
```json
{
  "name": "@teampilot/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: 写失败测试**

`packages/shared/test/enums.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { POSITIONS, MEMBER_STATUSES, ACTIVITY_STATUSES, MEMBER_STYLES, zMember } from "../src/index.js";

describe("enums", () => {
  it("positions are the three sepak takraw roles", () => {
    expect(POSITIONS).toEqual(["tekong", "feeder", "striker"]);
  });
  it("member statuses", () => {
    expect(MEMBER_STATUSES).toEqual(["active", "left"]);
  });
  it("activity statuses", () => {
    expect(ACTIVITY_STATUSES).toEqual(["draft", "published", "ended", "cancelled"]);
  });
  it("has 10 preset styles", () => {
    expect(MEMBER_STYLES).toHaveLength(10);
  });
  it("zMember rejects captainNote over 100 chars", () => {
    const bad = { name: "A", primaryPosition: "tekong", captainNote: "x".repeat(101) };
    expect(zMember.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @teampilot/shared test`
Expected: FAIL（模块未实现）。

- [ ] **Step 4: 写实现**

`packages/shared/src/enums.ts`:
```ts
import { z } from "zod";

export const POSITIONS = ["tekong", "feeder", "striker"] as const;
export type Position = (typeof POSITIONS)[number];

export const MEMBER_LEVELS = ["novice", "intermediate", "upper", "advanced"] as const;
export type MemberLevel = (typeof MEMBER_LEVELS)[number];

export const MEMBER_STYLES = [
  "进攻型","防守型","全能型","发球专精","技术细腻",
  "爆发力强","稳定均衡","跑动积极","战术灵活","队长领袖型",
] as const;
export type MemberStyle = (typeof MEMBER_STYLES)[number];

export const MEMBER_STATUSES = ["active", "left"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ACTIVITY_TYPES = ["training", "match"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ["draft", "published", "ended", "cancelled"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ATTENDANCE_RESPONSES = ["going", "not_going", "no_response"] as const;
export type AttendanceResponse = (typeof ATTENDANCE_RESPONSES)[number];

export const ACTUAL_ATTENDANCES = ["present", "absent", "pending"] as const;
export type ActualAttendance = (typeof ACTUAL_ATTENDANCES)[number];

export const SUMMARY_STAGES = ["none", "initial", "post_review"] as const;
export type SummaryStage = (typeof SUMMARY_STAGES)[number];

export const NOTIFICATION_TYPES = ["publish", "cancel", "reminder"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["pending", "success", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ASR_STATUSES = ["uploading", "transcribing", "succeeded", "failed"] as const;
export type AsrStatus = (typeof ASR_STATUSES)[number];

export const ASSISTANT_ROLES = ["ai", "captain"] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

// 队员资料 schema（创建/编辑/入队共用基础）
export const zMember = z.object({
  name: z.string().min(1).max(50),
  jerseyNumber: z.string().max(10).optional(),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  captainNote: z.string().max(100).optional(),
});

// H5 入队表单（无球衣号、无 captainNote、无 status）
export const zJoinForm = z.object({
  name: z.string().min(1).max(50),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
});
```

`packages/shared/src/index.ts`:
```ts
export * from "./enums.js";
```

- [ ] **Step 5: 运行测试确认通过 + 提交**

Run: `pnpm --filter @teampilot/shared test`
Expected: PASS（5 passed）。
```bash
git add packages/shared
git commit -m "feat(shared): enums and member zod schemas"
```

---

## Task 3: server 脚手架 + config 模块

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/vitest.config.ts`, `packages/server/src/config/index.ts`, `packages/server/test/config.test.ts`, `packages/server/.env.example`

- [ ] **Step 1: 写包配置**

`packages/server/package.json`:
```json
{
  "name": "@teampilot/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@teampilot/shared": "workspace:*",
    "@larksuiteoapi/node-sdk": "^1.42.0",
    "@prisma/client": "^6.1.0",
    "bcryptjs": "^2.4.3",
    "cookie-session": "^2.1.0",
    "express": "^4.21.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cookie-session": "^2.0.49",
    "@types/express": "^4.17.21",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "types": ["node"] },
  "include": ["src"]
}
```

`packages/server/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
```

`packages/server/.env.example`:
```
DATABASE_URL=file:./prisma/dev.db
TEAM_TZ=Asia/Shanghai
CAPTAIN_USERNAME=Levin
CAPTAIN_PASSWORD=change-me
TEAM_DEFAULT_LOCATION=第二操场右侧训练区域
TEAM_JOIN_TOKEN=fixed-join-token-001
SESSION_SECRET=dev-session-secret
FEISHU_APP_ID=
FEISHU_APP_SECRET=
H5_BASE_URL=http://localhost:5174
```

- [ ] **Step 2: 写失败测试**

`packages/server/test/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config/index.js";

const base = {
  DATABASE_URL: "file:./x.db",
  CAPTAIN_USERNAME: "Levin",
  CAPTAIN_PASSWORD: "pw",
  TEAM_DEFAULT_LOCATION: "场地",
  TEAM_JOIN_TOKEN: "tok",
  SESSION_SECRET: "s",
  FEISHU_APP_ID: "a",
  FEISHU_APP_SECRET: "b",
  H5_BASE_URL: "http://localhost",
};

describe("loadConfig", () => {
  it("parses a valid env with TEAM_TZ default", () => {
    const c = loadConfig(base);
    expect(c.captainUsername).toBe("Levin");
    expect(c.teamTz).toBe("Asia/Shanghai");
  });
  it("throws when a required var is missing", () => {
    const { SESSION_SECRET, ...missing } = base;
    expect(() => loadConfig(missing as Record<string, string>)).toThrow();
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @teampilot/server test config`
Expected: FAIL（loadConfig 未定义）。

- [ ] **Step 4: 写实现**

`packages/server/src/config/index.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  TEAM_TZ: z.string().default("Asia/Shanghai"),
  CAPTAIN_USERNAME: z.string().min(1),
  CAPTAIN_PASSWORD: z.string().min(1),
  TEAM_DEFAULT_LOCATION: z.string().min(1),
  TEAM_JOIN_TOKEN: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  FEISHU_APP_ID: z.string().min(1),
  FEISHU_APP_SECRET: z.string().min(1),
  H5_BASE_URL: z.string().url(),
});

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const p = schema.parse(env);
  return {
    databaseUrl: p.DATABASE_URL,
    teamTz: p.TEAM_TZ,
    captainUsername: p.CAPTAIN_USERNAME,
    captainPassword: p.CAPTAIN_PASSWORD,
    teamDefaultLocation: p.TEAM_DEFAULT_LOCATION,
    teamJoinToken: p.TEAM_JOIN_TOKEN,
    sessionSecret: p.SESSION_SECRET,
    feishuAppId: p.FEISHU_APP_ID,
    feishuAppSecret: p.FEISHU_APP_SECRET,
    h5BaseUrl: p.H5_BASE_URL,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
```

- [ ] **Step 5: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test config`
Expected: PASS（2 passed）。
```bash
git add packages/server/package.json packages/server/tsconfig.json packages/server/vitest.config.ts packages/server/.env.example packages/server/src/config packages/server/test/config.test.ts
git commit -m "feat(server): scaffold + env config validation"
```

---

## Task 4: Prisma schema + client + seed

**Files:**
- Create: `packages/server/prisma/schema.prisma`, `packages/server/prisma/seed.ts`, `packages/server/src/db/client.ts`, `packages/server/test/setup.ts`, `packages/server/test/helpers/db.ts`

- [ ] **Step 1: 写 Prisma schema（9 张表，全部建好）**

`packages/server/prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model Captain {
  id           String @id @default(cuid())
  username     String @unique
  passwordHash String
  displayName  String
}

model TeamSettings {
  id              String @id @default("singleton")
  defaultLocation String
  trainingRules   String @default("")
  matchRules      String @default("")
}

model Member {
  id              String   @id @default(cuid())
  name            String
  jerseyNumber    String?
  primaryPosition String
  backupPosition  String?
  level           String?
  style           String?
  status          String   @default("active")
  captainNote     String?
  feishuOpenId    String   @unique
  createdAt       DateTime @default(now())
  participants    ActivityParticipant[]
}

model Activity {
  id               String   @id @default(cuid())
  name             String
  type             String
  startTime        DateTime
  durationMinutes  Int      @default(120)
  location         String
  theme            String?
  notes            String?
  status           String   @default("draft")
  cancelReason     String?
  summary          String?
  summaryStage     String   @default("none")
  summaryUpdatedAt DateTime?
  reminderAt       DateTime?
  publishedAt      DateTime?
  endedAt          DateTime?
  createdAt        DateTime @default(now())
  participants     ActivityParticipant[]
  review           ActivityReview?
  asrJobs          AsrJob[]
  notifications    NotificationLog[]
}

model ActivityParticipant {
  id                 String    @id @default(cuid())
  activityId         String
  memberId           String
  attendanceResponse String    @default("no_response")
  responseUpdatedAt  DateTime?
  actualAttendance   String?
  activity           Activity  @relation(fields: [activityId], references: [id])
  member             Member    @relation(fields: [memberId], references: [id])
  @@unique([activityId, memberId])
}

model ActivityReview {
  activityId         String    @id
  rawNotes           String    @default("")
  aiSummary          String?
  aiSummaryUpdatedAt DateTime?
  activity           Activity  @relation(fields: [activityId], references: [id])
}

model AsrJob {
  id         String   @id @default(cuid())
  activityId String
  fileName   String
  tosUrl     String
  volcTaskId String?
  status     String   @default("uploading")
  failReason String?
  transcript String?
  createdAt  DateTime @default(now())
  activity   Activity @relation(fields: [activityId], references: [id])
}

model NotificationLog {
  id              String    @id @default(cuid())
  activityId      String
  memberId        String
  type            String
  status          String    @default("pending")
  failReason      String?
  feishuMessageId String?
  createdAt       DateTime  @default(now())
  sentAt          DateTime?
  activity        Activity  @relation(fields: [activityId], references: [id])
  @@index([activityId, type, status])
}

model AssistantMessage {
  id        String   @id @default(cuid())
  role      String
  content   String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: 生成 client + 建库**

Run（先准备 `.env`）：
```bash
cp packages/server/.env.example packages/server/.env
cd packages/server && pnpm prisma generate && pnpm db:push
```
Expected: `prisma generate` 成功；`db:push` 输出 "Your database is now in sync"。

- [ ] **Step 3: 写 db client 单例与测试基建**

`packages/server/src/db/client.ts`:
```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

`packages/server/test/setup.ts`（vitest globalSetup：建测试库）：
```ts
import { execSync } from "node:child_process";
export default function setup() {
  process.env.DATABASE_URL = "file:./prisma/test.db";
  execSync("pnpm prisma db push --force-reset --skip-generate", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}
```

`packages/server/test/helpers/db.ts`（每个测试前清表）：
```ts
import { prisma } from "../../src/db/client.js";
export async function resetDb() {
  await prisma.notificationLog.deleteMany();
  await prisma.asrJob.deleteMany();
  await prisma.activityReview.deleteMany();
  await prisma.activityParticipant.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.member.deleteMany();
  await prisma.assistantMessage.deleteMany();
  await prisma.teamSettings.deleteMany();
  await prisma.captain.deleteMany();
}
```

- [ ] **Step 4: 写 seed + 测试**

`packages/server/prisma/seed.ts`:
```ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/db/client.js";
import { loadConfig } from "../src/config/index.js";

export async function seed() {
  const c = loadConfig();
  await prisma.captain.upsert({
    where: { username: c.captainUsername },
    update: {},
    create: {
      username: c.captainUsername,
      passwordHash: await bcrypt.hash(c.captainPassword, 10),
      displayName: c.captainUsername,
    },
  });
  await prisma.teamSettings.upsert({
    where: { id: "singleton" },
    update: { defaultLocation: c.teamDefaultLocation },
    create: { id: "singleton", defaultLocation: c.teamDefaultLocation },
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then(() => prisma.$disconnect());
}
```

`packages/server/test/db.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db/client.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";

beforeEach(resetDb);

describe("seed", () => {
  it("creates captain (hashed) and team settings", async () => {
    await seed();
    const cap = await prisma.captain.findFirst();
    const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
    expect(cap?.username).toBe("Levin");
    expect(cap?.passwordHash).not.toBe("change-me");
    expect(settings?.defaultLocation).toBeTruthy();
  });
});
```

Note: 测试用 `.env`（NODE_ENV=test 时 CAPTAIN_USERNAME 等来自 .env），`setup.ts` 已把 DATABASE_URL 指向 test.db。

- [ ] **Step 5: 运行 + 提交**

Run: `pnpm --filter @teampilot/server test db`
Expected: PASS（1 passed）。
```bash
git add packages/server/prisma packages/server/src/db packages/server/test/setup.ts packages/server/test/helpers packages/server/test/db.test.ts
git commit -m "feat(server): prisma schema (9 tables), client, seed"
```

---

## Task 5: auth 模块（登录 + 会话 + 中间件）

**Files:**
- Create: `packages/server/src/auth/service.ts`, `packages/server/src/auth/middleware.ts`, `packages/server/src/auth/routes.ts`, `packages/server/src/app.ts`, `packages/server/test/auth.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });

describe("auth", () => {
  it("logs in with correct credentials and returns me", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
    expect(login.status).toBe(200);
    const me = await agent.get("/api/admin/me");
    expect(me.status).toBe(200);
    expect(me.body.displayName).toBe("Levin");
  });
  it("rejects wrong password with unified error (no field hint)", async () => {
    const res = await request(app).post("/api/admin/login").send({ username: "Levin", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("账号或密码错误");
  });
  it("blocks /me without session", async () => {
    const res = await request(app).get("/api/admin/me");
    expect(res.status).toBe(401);
  });
  it("logout clears session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
    await agent.post("/api/admin/logout");
    const me = await agent.get("/api/admin/me");
    expect(me.status).toBe(401);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test auth`
Expected: FAIL（createApp 未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/auth/service.ts`:
```ts
import bcrypt from "bcryptjs";
import { prisma } from "../db/client.js";

export async function verifyCaptain(username: string, password: string) {
  const cap = await prisma.captain.findUnique({ where: { username } });
  if (!cap) return null;
  const ok = await bcrypt.compare(password, cap.passwordHash);
  return ok ? cap : null;
}
```

`packages/server/src/auth/middleware.ts`:
```ts
import type { Request, Response, NextFunction } from "express";

export function requireCaptain(req: Request, res: Response, next: NextFunction) {
  if (req.session?.captainId) return next();
  return res.status(401).json({ error: "未登录" });
}
```

`packages/server/src/auth/routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { verifyCaptain } from "./service.js";
import { requireCaptain } from "./middleware.js";
import { prisma } from "../db/client.js";

const zLogin = z.object({ username: z.string(), password: z.string() });

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = zLogin.safeParse(req.body);
  if (!parsed.success) return res.status(401).json({ error: "账号或密码错误" });
  const cap = await verifyCaptain(parsed.data.username, parsed.data.password);
  if (!cap) return res.status(401).json({ error: "账号或密码错误" });
  req.session!.captainId = cap.id;
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

authRouter.get("/me", requireCaptain, async (req, res) => {
  const cap = await prisma.captain.findUnique({ where: { id: req.session!.captainId } });
  if (!cap) return res.status(401).json({ error: "未登录" });
  res.json({ displayName: cap.displayName });
});
```

`packages/server/src/app.ts`:
```ts
import express from "express";
import cookieSession from "cookie-session";
import { loadConfig } from "./config/index.js";
import { authRouter } from "./auth/routes.js";

declare module "express-session" {}
declare global {
  namespace Express {
    interface Request { session: (CookieSessionInterfaces.CookieSessionObject & { captainId?: string }) | null; }
  }
}

export function createApp() {
  const config = loadConfig();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieSession({ name: "tp", secret: config.sessionSecret, httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/admin", authRouter);
  return app;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @teampilot/server test auth`
Expected: PASS（4 passed）。如类型报错 session，调整上面的 `declare global` 块（cookie-session 把 session 挂在 req.session）。

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/auth packages/server/src/app.ts packages/server/test/auth.test.ts
git commit -m "feat(server): captain auth (login/logout/me + requireCaptain)"
```

---

## Task 6: feishu 模块（客户端 + H5 免登 code→openId）

**Files:**
- Create: `packages/server/src/feishu/client.ts`, `packages/server/src/feishu/auth.ts`, `packages/server/test/feishu.test.ts`

设计：`exchangeCodeForOpenId` 接收一个"取 token + 调 authen"的客户端依赖，测试注入假客户端，无需真实网络。

- [ ] **Step 1: 写失败测试**

`packages/server/test/feishu.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { exchangeCodeForOpenId, type FeishuAuthClient } from "../src/feishu/auth.js";

const fakeOk: FeishuAuthClient = {
  async getUserOpenIdByCode(code) { return code === "good" ? "ou_123" : null; },
};

describe("exchangeCodeForOpenId", () => {
  it("returns open_id for a valid code", async () => {
    expect(await exchangeCodeForOpenId(fakeOk, "good")).toBe("ou_123");
  });
  it("returns null when feishu cannot resolve identity", async () => {
    expect(await exchangeCodeForOpenId(fakeOk, "bad")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test feishu`
Expected: FAIL（模块未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/feishu/client.ts`:
```ts
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
```

`packages/server/src/feishu/auth.ts`:
```ts
import { createLarkClient } from "./client.js";

export interface FeishuAuthClient {
  // 用 H5 免登的 code 换取用户 open_id；无法识别则返回 null
  getUserOpenIdByCode(code: string): Promise<string | null>;
}

export const larkAuthClient: FeishuAuthClient = {
  async getUserOpenIdByCode(code) {
    const client = createLarkClient();
    // 飞书 authen：用 code 换 access_token，响应含 open_id
    const resp = await client.authen.accessToken.create({ data: { grant_type: "authorization_code", code } });
    return resp?.data?.open_id ?? null;
  },
};

export async function exchangeCodeForOpenId(client: FeishuAuthClient, code: string) {
  if (!code) return null;
  try {
    return await client.getUserOpenIdByCode(code);
  } catch {
    return null;
  }
}
```

> 实现注：`client.authen.accessToken.create` 的确切方法名以所装 SDK 版本为准；若签名不同，只改 `larkAuthClient` 内部，`exchangeCodeForOpenId` 与测试不变。

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test feishu`
Expected: PASS（2 passed）。
```bash
git add packages/server/src/feishu packages/server/test/feishu.test.ts
git commit -m "feat(server): feishu client + H5 sso code->open_id (injectable)"
```

---

## Task 7: members 模块（CRUD + 筛选）

**Files:**
- Create: `packages/server/src/members/service.ts`, `packages/server/src/members/schema.ts`, `packages/server/src/members/routes.ts`, `packages/server/test/members.test.ts`
- Modify: `packages/server/src/app.ts`（挂载 membersRouter）

- [ ] **Step 1: 写失败测试**

`packages/server/test/members.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const app = createApp();
async function login() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
  return agent;
}
async function makeMember(over: Partial<{ name: string; primaryPosition: string; status: string; openId: string }> = {}) {
  return prisma.member.create({ data: {
    name: over.name ?? "张三", primaryPosition: over.primaryPosition ?? "tekong",
    status: over.status ?? "active", feishuOpenId: over.openId ?? "ou_" + Math.random(),
  }});
}

beforeEach(async () => { await resetDb(); await seed(); });

describe("members", () => {
  it("requires login", async () => {
    expect((await request(app).get("/api/admin/members")).status).toBe(401);
  });
  it("lists and filters by status and position", async () => {
    await makeMember({ name: "A", primaryPosition: "tekong", status: "active" });
    await makeMember({ name: "B", primaryPosition: "striker", status: "left" });
    const agent = await login();
    const all = await agent.get("/api/admin/members");
    expect(all.body.length).toBe(2);
    const active = await agent.get("/api/admin/members?status=active");
    expect(active.body.length).toBe(1);
    const strikers = await agent.get("/api/admin/members?position=striker");
    expect(strikers.body.length).toBe(1);
  });
  it("updates a member; rejects captainNote > 100 chars", async () => {
    const m = await makeMember();
    const agent = await login();
    const ok = await agent.put(`/api/admin/members/${m.id}`).send({ name: "新名", primaryPosition: "feeder", captainNote: "好球员" });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe("新名");
    const bad = await agent.put(`/api/admin/members/${m.id}`).send({ name: "x", primaryPosition: "feeder", captainNote: "y".repeat(101) });
    expect(bad.status).toBe(400);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test members`
Expected: FAIL（membersRouter 未挂载）。

- [ ] **Step 3: 写实现**

`packages/server/src/members/schema.ts`:
```ts
import { z } from "zod";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, MEMBER_STATUSES } from "@teampilot/shared";

export const zMemberUpdate = z.object({
  name: z.string().min(1).max(50),
  jerseyNumber: z.string().max(10).optional(),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
  status: z.enum(MEMBER_STATUSES),
  captainNote: z.string().max(100).optional(),
});
```

`packages/server/src/members/service.ts`:
```ts
import { prisma } from "../db/client.js";
import type { z } from "zod";
import type { zMemberUpdate } from "./schema.js";

export function listMembers(filter: { status?: string; position?: string }) {
  return prisma.member.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.position ? { primaryPosition: filter.position } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export function updateMember(id: string, data: z.infer<typeof zMemberUpdate>) {
  return prisma.member.update({ where: { id }, data });
}
```

`packages/server/src/members/routes.ts`:
```ts
import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { listMembers, updateMember } from "./service.js";
import { zMemberUpdate } from "./schema.js";

export const membersRouter = Router();
membersRouter.use(requireCaptain);

membersRouter.get("/", async (req, res) => {
  const members = await listMembers({ status: req.query.status as string, position: req.query.position as string });
  res.json(members);
});

membersRouter.put("/:id", async (req, res) => {
  const parsed = zMemberUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  try {
    res.json(await updateMember(req.params.id, parsed.data));
  } catch {
    res.status(404).json({ error: "队员不存在" });
  }
});
```

Modify `packages/server/src/app.ts` — 在 `app.use("/api/admin", authRouter);` 后加：
```ts
import { membersRouter } from "./members/routes.js";
// ...
app.use("/api/admin/members", membersRouter);
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test members`
Expected: PASS（3 passed）。
```bash
git add packages/server/src/members packages/server/src/app.ts packages/server/test/members.test.ts
git commit -m "feat(server): members list/filter/update"
```

---

## Task 8: H5 入队（四态逻辑 + 入队 token 校验）

**Files:**
- Create: `packages/server/src/members/join.ts`, `packages/server/test/join.test.ts`
- Modify: `packages/server/src/app.ts`（挂载 H5 路由，注入 feishu auth client）

- [ ] **Step 1: 写失败测试**

`packages/server/test/join.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import type { FeishuAuthClient } from "../src/feishu/auth.js";

// 假 feishu：code 直接当 open_id；"fail" 代表识别失败
const fakeAuth: FeishuAuthClient = {
  async getUserOpenIdByCode(code) { return code === "fail" ? null : code; },
};
const app = createApp({ feishuAuth: fakeAuth });

const token = "fixed-join-token-001"; // 来自 .env TEAM_JOIN_TOKEN
beforeEach(resetDb);

function join(body: object) { return request(app).post("/api/h5/join").send(body); }

describe("H5 join", () => {
  it("rejects invalid join token", async () => {
    const res = await join({ token: "wrong", code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("invalid_link");
  });
  it("rejects when feishu identity fails", async () => {
    const res = await join({ token, code: "fail", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("identity_failed");
  });
  it("creates an active member on first join", async () => {
    const res = await join({ token, code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("created");
    expect(await prisma.member.count()).toBe(1);
  });
  it("is idempotent: second join of same open_id => already_joined, no dup", async () => {
    await join({ token, code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    const res = await join({ token, code: "ou_a", form: { name: "甲again", primaryPosition: "feeder" } });
    expect(res.body.status).toBe("already_joined");
    expect(await prisma.member.count()).toBe(1);
  });
  it("left member reopening => contact_captain, not restored", async () => {
    await prisma.member.create({ data: { name: "乙", primaryPosition: "striker", status: "left", feishuOpenId: "ou_b" } });
    const res = await join({ token, code: "ou_b", form: { name: "乙", primaryPosition: "striker" } });
    expect(res.body.status).toBe("contact_captain");
    const m = await prisma.member.findUnique({ where: { feishuOpenId: "ou_b" } });
    expect(m?.status).toBe("left");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test join`
Expected: FAIL（createApp 不接受 options / 路由缺失）。

- [ ] **Step 3: 写实现**

`packages/server/src/members/join.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { loadConfig } from "../config/index.js";
import { zJoinForm } from "@teampilot/shared";
import { exchangeCodeForOpenId, type FeishuAuthClient } from "../feishu/auth.js";

const zBody = z.object({ token: z.string(), code: z.string(), form: zJoinForm });

export function createJoinRouter(feishuAuth: FeishuAuthClient) {
  const router = Router();
  router.post("/join", async (req, res) => {
    const parsed = zBody.safeParse(req.body);
    if (!parsed.success) return res.json({ status: "invalid_link" });
    const cfg = loadConfig();
    if (parsed.data.token !== cfg.teamJoinToken) return res.json({ status: "invalid_link" });

    const openId = await exchangeCodeForOpenId(feishuAuth, parsed.data.code);
    if (!openId) return res.json({ status: "identity_failed" });

    const existing = await prisma.member.findUnique({ where: { feishuOpenId: openId } });
    if (existing) {
      return res.json({ status: existing.status === "left" ? "contact_captain" : "already_joined" });
    }
    await prisma.member.create({ data: { ...parsed.data.form, feishuOpenId: openId, status: "active" } });
    return res.json({ status: "created" });
  });
  return router;
}
```

Modify `packages/server/src/app.ts`：
1. `createApp` 接收可选依赖：
```ts
import { larkAuthClient, type FeishuAuthClient } from "./feishu/auth.js";
import { createJoinRouter } from "./members/join.js";

export function createApp(deps: { feishuAuth?: FeishuAuthClient } = {}) {
  const feishuAuth = deps.feishuAuth ?? larkAuthClient;
  // ... 现有 app 组装 ...
  app.use("/api/h5", createJoinRouter(feishuAuth));
  return app;
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test join`
Expected: PASS（5 passed）。
```bash
git add packages/server/src/members/join.ts packages/server/src/app.ts packages/server/test/join.test.ts
git commit -m "feat(server): H5 join four-state logic + join token"
```

---

## Task 9: activities 模块（草稿创建/编辑 + 参与人选择 + 列表派生列）

**Files:**
- Create: `packages/server/src/activities/schema.ts`, `packages/server/src/activities/service.ts`, `packages/server/src/activities/routes.ts`, `packages/server/test/activities.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/activities.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const app = createApp();
async function login() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
  return agent;
}
async function mkActive(name: string) {
  return prisma.member.create({ data: { name, primaryPosition: "tekong", status: "active", feishuOpenId: "ou_" + name } });
}

beforeEach(async () => { await resetDb(); await seed(); });

describe("activities draft", () => {
  it("creates a draft: duration default 120, location defaults to team default, all active preselected", async () => {
    await mkActive("A"); await mkActive("B");
    await prisma.member.create({ data: { name: "C", primaryPosition: "feeder", status: "left", feishuOpenId: "ou_C" } });
    const agent = await login();
    const res = await agent.post("/api/admin/activities").send({ name: "周日训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    expect(res.status).toBe(200);
    expect(res.body.durationMinutes).toBe(120);
    expect(res.body.location).toBeTruthy();
    const detail = await agent.get(`/api/admin/activities/${res.body.id}`);
    expect(detail.body.participants.length).toBe(2); // 仅 active，C 离队不入
  });
  it("filters list by type and status", async () => {
    const agent = await login();
    await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    await agent.post("/api/admin/activities").send({ name: "比赛", type: "match", startTime: "2026-06-02T06:30:00.000Z" });
    const matches = await agent.get("/api/admin/activities?type=match");
    expect(matches.body.length).toBe(1);
    const drafts = await agent.get("/api/admin/activities?status=draft");
    expect(drafts.body.length).toBe(2);
  });
  it("updates participants selection", async () => {
    const a = await mkActive("A"); const b = await mkActive("B");
    const agent = await login();
    const res = await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z" });
    await agent.put(`/api/admin/activities/${res.body.id}`).send({ name: "训练", type: "training", startTime: "2026-06-01T06:30:00.000Z", participantIds: [a.id] });
    const detail = await agent.get(`/api/admin/activities/${res.body.id}`);
    expect(detail.body.participants.length).toBe(1);
    expect(detail.body.participants[0].memberId).toBe(a.id);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test activities`
Expected: FAIL（路由缺失）。

- [ ] **Step 3: 写实现**

`packages/server/src/activities/schema.ts`:
```ts
import { z } from "zod";
import { ACTIVITY_TYPES } from "@teampilot/shared";

export const zActivityDraft = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ACTIVITY_TYPES),
  startTime: z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
  location: z.string().min(1).optional(),
  theme: z.string().optional(),
  notes: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});
```

`packages/server/src/activities/service.ts`:
```ts
import { prisma } from "../db/client.js";
import type { z } from "zod";
import type { zActivityDraft } from "./schema.js";

type DraftInput = z.infer<typeof zActivityDraft>;

async function activeMemberIds() {
  const ms = await prisma.member.findMany({ where: { status: "active" }, select: { id: true } });
  return ms.map((m) => m.id);
}

export async function createDraft(input: DraftInput) {
  const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
  const participantIds = input.participantIds ?? (await activeMemberIds());
  return prisma.activity.create({
    data: {
      name: input.name, type: input.type, startTime: new Date(input.startTime),
      durationMinutes: input.durationMinutes ?? 120,
      location: input.location ?? settings?.defaultLocation ?? "",
      theme: input.theme, notes: input.notes,
      participants: { create: participantIds.map((memberId) => ({ memberId })) },
    },
  });
}

export async function updateDraft(id: string, input: DraftInput) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) return null;
  if (act.status !== "draft") throw new Error("only_draft_editable");
  await prisma.activity.update({
    where: { id },
    data: {
      name: input.name, type: input.type, startTime: new Date(input.startTime),
      durationMinutes: input.durationMinutes ?? act.durationMinutes,
      location: input.location ?? act.location, theme: input.theme, notes: input.notes,
    },
  });
  if (input.participantIds) {
    await prisma.activityParticipant.deleteMany({ where: { activityId: id } });
    await prisma.activityParticipant.createMany({ data: input.participantIds.map((memberId) => ({ activityId: id, memberId })) });
  }
  return prisma.activity.findUnique({ where: { id } });
}

export function getActivity(id: string) {
  return prisma.activity.findUnique({ where: { id }, include: { participants: true, review: true } });
}

export function listActivities(filter: { type?: string; status?: string }) {
  return prisma.activity.findMany({
    where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.status ? { status: filter.status } : {}) },
    include: { participants: true, review: true },
    orderBy: { startTime: "desc" },
  });
}

// 派生列（设计 F5）
export function attendanceSummary(a: { status: string; participants: { attendanceResponse: string; actualAttendance: string | null }[] }) {
  if (a.status === "ended") {
    const present = a.participants.filter((p) => p.actualAttendance === "present").length;
    return `实到 ${present}/应到 ${a.participants.length}`;
  }
  const going = a.participants.filter((p) => p.attendanceResponse === "going").length;
  const not = a.participants.filter((p) => p.attendanceResponse === "not_going").length;
  const no = a.participants.filter((p) => p.attendanceResponse === "no_response").length;
  return `去 ${going}/不去 ${not}/未反馈 ${no}`;
}

export function reviewStatus(a: { review: { rawNotes: string; aiSummary: string | null } | null }) {
  if (!a.review || !a.review.rawNotes.trim()) return "无记录";
  return a.review.aiSummary ? "已生成" : "有素材未生成";
}
```

`packages/server/src/activities/routes.ts`:
```ts
import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { zActivityDraft } from "./schema.js";
import { createDraft, updateDraft, getActivity, listActivities, attendanceSummary, reviewStatus } from "./service.js";

export const activitiesRouter = Router();
activitiesRouter.use(requireCaptain);

activitiesRouter.get("/", async (req, res) => {
  const list = await listActivities({ type: req.query.type as string, status: req.query.status as string });
  res.json(list.map((a) => ({
    id: a.id, name: a.name, type: a.type, startTime: a.startTime, location: a.location, status: a.status,
    attendanceSummary: attendanceSummary(a), reviewStatus: reviewStatus(a),
  })));
});

activitiesRouter.post("/", async (req, res) => {
  const parsed = zActivityDraft.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  res.json(await createDraft(parsed.data));
});

activitiesRouter.get("/:id", async (req, res) => {
  const a = await getActivity(req.params.id);
  if (!a) return res.status(404).json({ error: "活动不存在" });
  res.json(a);
});

activitiesRouter.put("/:id", async (req, res) => {
  const parsed = zActivityDraft.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "字段校验失败", issues: parsed.error.issues });
  try {
    const a = await updateDraft(req.params.id, parsed.data);
    if (!a) return res.status(404).json({ error: "活动不存在" });
    res.json(a);
  } catch (e) {
    res.status(409).json({ error: "已发布活动不可编辑" });
  }
});
```

Modify `packages/server/src/app.ts`：加 `import { activitiesRouter } from "./activities/routes.js";` 与 `app.use("/api/admin/activities", activitiesRouter);`。

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test activities`
Expected: PASS（3 passed）。
```bash
git add packages/server/src/activities packages/server/src/app.ts packages/server/test/activities.test.ts
git commit -m "feat(server): activity draft CRUD + participants + derived columns"
```

---

## Task 10: 活动生命周期（发布冻结 + reminderAt 计算 + 取消）

**Files:**
- Modify: `packages/server/src/activities/service.ts`, `packages/server/src/activities/routes.ts`
- Create: `packages/server/test/lifecycle.test.ts`

- [ ] **Step 1: 写失败测试（含 reminderAt 三种情况）**

`packages/server/test/lifecycle.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";
import { createDraft, publishActivity, cancelActivity, computeReminderAt } from "../src/activities/service.js";

beforeEach(async () => { await resetDb(); await seed(); });

const HOUR = 3600 * 1000;

describe("computeReminderAt", () => {
  const start = new Date("2026-06-10T10:00:00.000Z");
  it(">=24h before => 24h-before", () => {
    const now = new Date(start.getTime() - 30 * HOUR);
    expect(computeReminderAt(start, now)!.getTime()).toBe(start.getTime() - 24 * HOUR);
  });
  it("between 2h and 24h => 2h-before", () => {
    const now = new Date(start.getTime() - 10 * HOUR);
    expect(computeReminderAt(start, now)!.getTime()).toBe(start.getTime() - 2 * HOUR);
  });
  it("<2h => null", () => {
    const now = new Date(start.getTime() - 1 * HOUR);
    expect(computeReminderAt(start, now)).toBeNull();
  });
});

describe("publish/cancel", () => {
  it("publish freezes snapshot + sets reminderAt + published", async () => {
    await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
    const a = await createDraft({ name: "训练", type: "training", startTime: new Date(Date.now() + 30 * HOUR).toISOString() } as any);
    const now = new Date();
    const pub = await publishActivity(a.id, now);
    expect(pub.status).toBe("published");
    expect(pub.publishedAt).toBeTruthy();
    expect(pub.reminderAt).toBeTruthy();
  });
  it("cancel sets cancelled + reason", async () => {
    const a = await createDraft({ name: "训练", type: "training", startTime: new Date(Date.now() + 30 * HOUR).toISOString() } as any);
    const c = await cancelActivity(a.id, "下雨");
    expect(c.status).toBe("cancelled");
    expect(c.cancelReason).toBe("下雨");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test lifecycle`
Expected: FAIL（publishActivity/computeReminderAt 未定义）。

- [ ] **Step 3: 写实现（追加到 service.ts）**

在 `packages/server/src/activities/service.ts` 末尾追加：
```ts
const HOUR_MS = 3600 * 1000;

export function computeReminderAt(startTime: Date, now: Date): Date | null {
  const msToStart = startTime.getTime() - now.getTime();
  if (msToStart >= 24 * HOUR_MS) return new Date(startTime.getTime() - 24 * HOUR_MS);
  if (msToStart >= 2 * HOUR_MS) return new Date(startTime.getTime() - 2 * HOUR_MS);
  return null;
}

export async function publishActivity(id: string, now: Date) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) throw new Error("not_found");
  if (act.status !== "draft") throw new Error("only_draft_publishable");
  // 阶段1：仅冻结快照 + 置状态 + 计算 reminderAt；发卡片/活动总结在 Plan C/D
  return prisma.activity.update({
    where: { id },
    data: { status: "published", publishedAt: now, reminderAt: computeReminderAt(act.startTime, now) },
  });
}

export async function cancelActivity(id: string, reason: string) {
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) throw new Error("not_found");
  if (act.status !== "draft" && act.status !== "published") throw new Error("not_cancellable");
  return prisma.activity.update({ where: { id }, data: { status: "cancelled", cancelReason: reason } });
}
```

- [ ] **Step 4: 加路由 + 运行确认通过**

在 `packages/server/src/activities/routes.ts` 末尾追加：
```ts
import { publishActivity, cancelActivity } from "./service.js";

activitiesRouter.post("/:id/publish", async (req, res) => {
  try {
    res.json(await publishActivity(req.params.id, new Date()));
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

activitiesRouter.post("/:id/cancel", async (req, res) => {
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
  try {
    res.json(await cancelActivity(req.params.id, reason));
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});
```

Run: `pnpm --filter @teampilot/server test lifecycle`
Expected: PASS（5 passed）。

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/activities packages/server/test/lifecycle.test.ts
git commit -m "feat(server): activity publish (freeze+reminderAt) and cancel"
```

---

## Task 11: attendance 模块（实际到场标记）

**Files:**
- Create: `packages/server/src/attendance/routes.ts`, `packages/server/test/attendance.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/attendance.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";

const app = createApp();
async function login() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ username: "Levin", password: "change-me" });
  return agent;
}
beforeEach(async () => { await resetDb(); await seed(); });

describe("attendance marking", () => {
  it("marks present/absent for a participant", async () => {
    const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
    const act = await prisma.activity.create({ data: { name: "训练", type: "training", startTime: new Date(), location: "x", status: "ended", participants: { create: [{ memberId: m.id, actualAttendance: "pending" }] } } });
    const agent = await login();
    const res = await agent.post(`/api/admin/activities/${act.id}/participants/${m.id}/attendance`).send({ value: "present" });
    expect(res.status).toBe(200);
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: act.id, memberId: m.id } });
    expect(p?.actualAttendance).toBe("present");
  });
  it("rejects invalid value", async () => {
    const agent = await login();
    const res = await agent.post(`/api/admin/activities/x/participants/y/attendance`).send({ value: "maybe" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test attendance`
Expected: FAIL（路由缺失）。

- [ ] **Step 3: 写实现**

`packages/server/src/attendance/routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { requireCaptain } from "../auth/middleware.js";
import { prisma } from "../db/client.js";

const zMark = z.object({ value: z.enum(["present", "absent"]) });
export const attendanceRouter = Router();
attendanceRouter.use(requireCaptain);

attendanceRouter.post("/:activityId/participants/:memberId/attendance", async (req, res) => {
  const parsed = zMark.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "无效的到场值" });
  const result = await prisma.activityParticipant.updateMany({
    where: { activityId: req.params.activityId, memberId: req.params.memberId },
    data: { actualAttendance: parsed.data.value },
  });
  if (result.count === 0) return res.status(404).json({ error: "参与记录不存在" });
  res.json({ ok: true });
});
```

Modify `packages/server/src/app.ts`：加 `import { attendanceRouter } from "./attendance/routes.js";` 与（注意挂在 activities 之后，路径前缀相同）：
```ts
app.use("/api/admin/activities", attendanceRouter);
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test attendance`
Expected: PASS（2 passed）。
```bash
git add packages/server/src/attendance packages/server/src/app.ts packages/server/test/attendance.test.ts
git commit -m "feat(server): mark actual attendance"
```

---

## Task 12: scheduler（活动自动结束，可注入时钟）

**Files:**
- Create: `packages/server/src/scheduler/index.ts`, `packages/server/test/scheduler.test.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/scheduler.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { runAutoEnd } from "../src/scheduler/index.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function makePublished(startOffsetMs: number, duration = 120) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_" + Math.random() } });
  return prisma.activity.create({ data: {
    name: "训练", type: "training", status: "published", location: "x",
    startTime: new Date(Date.now() + startOffsetMs), durationMinutes: duration,
    participants: { create: [{ memberId: m.id, attendanceResponse: "going" }] },
  }});
}

describe("runAutoEnd", () => {
  it("ends activities past start+duration and sets going->pending", async () => {
    const a = await makePublished(-3 * HOUR, 120); // 开始于3h前，时长2h => 已过结束
    await runAutoEnd(new Date());
    const updated = await prisma.activity.findUnique({ where: { id: a.id }, include: { participants: true } });
    expect(updated?.status).toBe("ended");
    expect(updated?.endedAt).toBeTruthy();
    expect(updated?.participants[0].actualAttendance).toBe("pending");
  });
  it("does not end activities still ongoing", async () => {
    const a = await makePublished(-0.5 * HOUR, 120); // 开始30分钟前，未到结束
    await runAutoEnd(new Date());
    expect((await prisma.activity.findUnique({ where: { id: a.id } }))?.status).toBe("published");
  });
  it("is idempotent (second run does not change ended)", async () => {
    const a = await makePublished(-3 * HOUR, 120);
    await runAutoEnd(new Date());
    const first = await prisma.activity.findUnique({ where: { id: a.id } });
    await runAutoEnd(new Date());
    const second = await prisma.activity.findUnique({ where: { id: a.id } });
    expect(second?.endedAt?.getTime()).toBe(first?.endedAt?.getTime());
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test scheduler`
Expected: FAIL（runAutoEnd 未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/scheduler/index.ts`:
```ts
import { prisma } from "../db/client.js";

// 找出 published 且已过 start+duration 的活动，置为 ended，并把 going 的参与者初始化为 pending
export async function runAutoEnd(now: Date) {
  const candidates = await prisma.activity.findMany({ where: { status: "published" } });
  for (const a of candidates) {
    const endMs = a.startTime.getTime() + a.durationMinutes * 60 * 1000;
    if (endMs > now.getTime()) continue;
    await prisma.$transaction([
      prisma.activity.update({ where: { id: a.id }, data: { status: "ended", endedAt: now } }),
      prisma.activityParticipant.updateMany({
        where: { activityId: a.id, attendanceResponse: "going", actualAttendance: null },
        data: { actualAttendance: "pending" },
      }),
    ]);
  }
}

export async function tick(now: Date) {
  await runAutoEnd(now);
  // Plan C 追加：提醒发送；Plan D 追加：ASR 轮询
}

export function startScheduler() {
  setInterval(() => { void tick(new Date()); }, 60 * 1000);
}
```

Modify `packages/server/src/index.ts`（新建/补充）：
```ts
import { createApp } from "./app.js";
import { startScheduler } from "./scheduler/index.js";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`server on :${port}`));
startScheduler();
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test scheduler`
Expected: PASS（3 passed）。
```bash
git add packages/server/src/scheduler packages/server/src/index.ts packages/server/test/scheduler.test.ts
git commit -m "feat(server): scheduler auto-end activities (injectable clock)"
```

---

## Task 13: 全量回归 + 阶段1 后端冒烟

**Files:** 无新增（验证）

- [ ] **Step 1: 跑全部测试**

Run: `pnpm -r test`
Expected: shared + server 全部 PASS（约 27 个用例）。

- [ ] **Step 2: 类型检查**

Run: `pnpm -r build`
Expected: 无类型错误（如有 session 类型问题，按 Task 5 Step 4 提示修正 `declare global`）。

- [ ] **Step 3: 本地冒烟（可选，需真实/占位 .env）**

Run:
```bash
cd packages/server && pnpm db:push && pnpm db:seed && pnpm dev
```
另开终端：
```bash
curl -s localhost:3000/api/health
curl -s -c /tmp/c.txt -X POST localhost:3000/api/admin/login -H 'content-type: application/json' -d '{"username":"Levin","password":"change-me"}'
curl -s -b /tmp/c.txt localhost:3000/api/admin/members
```
Expected: health `{"ok":true}`；登录 `{"ok":true}`；members `[]`。

- [ ] **Step 4: 提交（如有 .env.example 等微调）**

```bash
git add -A
git commit -m "chore(server): phase-1 backend regression green" || echo "nothing to commit"
```

---

## 实现注意事项（贯穿全计划）

- **ESM 路径**：本项目 `"type":"module"`，相对 import 必须带 `.js` 后缀（即使源是 `.ts`）。测试里 import `../src/x.js`。
- **测试隔离**：`vitest.config.ts` 设 `fileParallelism:false`，配合 `beforeEach(resetDb)` 避免共享 SQLite 串扰。
- **飞书 SDK 方法名**：Task 6 的 `authen.accessToken.create` 以实际安装版本为准；封装在 `larkAuthClient` 内，变化不影响业务与测试。
- **阶段边界**：本计划 publish 不发飞书卡片、不生成 AI 总结（Plan C/D 负责）；reminderAt 已算好，提醒发送在 Plan C。
- **依赖根 CLAUDE.md**：先写失败测试再实现；改动只服务当前任务；不顺手重构无关代码。

---

## 自检（spec coverage / 占位符 / 类型一致性）

**覆盖**（对照设计 §13 阶段1）：登录✓(T5) 队员入队接真实飞书✓(T6+T8) 队员管理✓(T7) 活动创建发布✓(T9+T10) 出勤只读展示✓(派生列T9 + 反馈字段默认 no_response，阶段1 无写入口) 实际到场确认✓(T11) 活动自动结束✓(T12)。验收清单 1/2(链接展示属前端Plan B,后端 token 校验✓T8)/3/4(invalid_link✓)/5/6/7/10(后台无改反馈入口——本计划未提供反馈写接口✓)/12/21(离队不入新活动✓T9, contact_captain✓T8)。

**占位符**：无 TBD/TODO；每个改代码步骤均含完整代码与命令。

**类型一致性**：`createApp(deps?)` 在 T5 定义、T8 扩展为接收 `feishuAuth`，签名一致；`FeishuAuthClient.getUserOpenIdByCode` 在 T6 定义、T8 测试复用；`computeReminderAt(startTime, now)` 在 T10 定义并被自身测试调用；service 函数名（createDraft/updateDraft/getActivity/listActivities/publishActivity/cancelActivity/runAutoEnd）跨任务一致。
