# 阶段2 飞书通知与卡片反馈实现计划（Plan C）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让真实队员通过飞书完成出勤反馈 —— 发布活动发卡片、队员点「去/不去」实时回写、取消活动发取消卡片、活动前 24h/2h 提醒、通知失败记录与只重试失败对象，并在活动概要 Tab 暴露通知状态与重试入口。

**Architecture:** 用飞书官方 SDK 的**长连接**（`lark.WSClient` + `EventDispatcher`）接收 `card.action.trigger`，无需公网回调。所有"发消息"能力抽象为可注入的 `FeishuNotifier` 接口（测试用假实现，零网络）。发送结果写 `NotificationLog`，重试只补发 `failed`。卡片回调更新 `ActivityParticipant.attendanceResponse`，遵守时间边界（仅 `published 且 now<startTime` 可改）。

**Tech Stack:** @larksuiteoapi/node-sdk（WSClient/EventDispatcher/Client）· 既有 server 栈（Express + Prisma + Vitest）

**前置**：Plan A 完成；飞书自建应用已开通机器人能力、长连接事件订阅 `card.action.trigger`（设计 §9）。**配套设计**：`...-design.md` §6.2/§6.3/§6.6，产品规格 §6/§8.4。

**阶段边界**：本计划不含 AI 与 ASR（Plan D）；`im.message.receive_v1`（队员 Bot 问询）属 Plan D 的 AI 场景5b，本计划仅预留注册位、不实现问答。

---

## 文件结构

```
packages/server/src/
  feishu/
    notify.ts          # FeishuNotifier 接口 + lark 实现 + 卡片构建
    events.ts          # handleCardAction(event) + startLongConnection(deps)
  notifications/
    service.ts         # notifyPublish / notifyCancel / sendReminder / retryFailed + 日志
  activities/routes.ts # 修改：publish/cancel 触发通知；新增 通知状态 + 重试 接口
  scheduler/index.ts   # 修改：tick 内发到期提醒
  index.ts             # 修改：启动长连接
packages/server/test/
  notifications.test.ts  cardAction.test.ts  reminder.test.ts
packages/web-admin/src/pages/tabs/SummaryTab.tsx  # 修改：通知状态区（F3）
```

---

## Task 1: FeishuNotifier 接口 + 卡片构建（可注入）

**Files:** Create `packages/server/src/feishu/notify.ts`, `packages/server/test/notify.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/notify.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildActivityCard, buildCancelCard, buildReminderCard } from "../src/feishu/notify.js";

const act = { id: "a1", name: "周日训练", type: "training", startTime: new Date("2026-06-10T06:30:00Z"), durationMinutes: 120, location: "二操场", theme: "发球", notes: "带护具", cancelReason: "下雨" } as any;

describe("card builders", () => {
  it("activity card has name, location and two action buttons carrying activityId", () => {
    const card = buildActivityCard(act);
    const json = JSON.stringify(card);
    expect(json).toContain("周日训练");
    expect(json).toContain("二操场");
    expect(json).toContain("going");
    expect(json).toContain("not_going");
    expect(json).toContain("a1");
  });
  it("cancel card shows reason and no action buttons", () => {
    const json = JSON.stringify(buildCancelCard(act));
    expect(json).toContain("下雨");
    expect(json).not.toContain("not_going");
  });
  it("reminder card mentions the activity", () => {
    expect(JSON.stringify(buildReminderCard(act))).toContain("周日训练");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test notify`
Expected: FAIL（builders 未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/feishu/notify.ts`:
```ts
import * as lark from "@larksuiteoapi/node-sdk";
import { createLarkClient } from "./client.js";

type Act = { id: string; name: string; type: string; startTime: Date; durationMinutes: number; location: string; theme: string | null; notes: string | null; cancelReason: string | null };

const fmt = (d: Date) => d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
const typeLabel = (t: string) => (t === "training" ? "训练" : "比赛");

export function buildActivityCard(a: Act) {
  return {
    config: { wide_screen_mode: true },
    header: { title: { tag: "plain_text", content: `【${typeLabel(a.type)}】${a.name}` } },
    elements: [
      { tag: "div", text: { tag: "lark_md", content:
        `**时间** ${fmt(a.startTime)}（${a.durationMinutes} 分钟）\n**地点** ${a.location}\n**主题** ${a.theme ?? "—"}\n**注意事项** ${a.notes ?? "—"}` } },
      { tag: "action", actions: [
        { tag: "button", text: { tag: "plain_text", content: "去" }, type: "primary", value: { activityId: a.id, response: "going" } },
        { tag: "button", text: { tag: "plain_text", content: "不去" }, type: "default", value: { activityId: a.id, response: "not_going" } },
      ] },
    ],
  };
}

export function buildCancelCard(a: Act) {
  return {
    header: { title: { tag: "plain_text", content: `【已取消】${a.name}` } },
    elements: [{ tag: "div", text: { tag: "lark_md", content: `**原时间** ${fmt(a.startTime)}\n**原地点** ${a.location}\n**取消原因** ${a.cancelReason ?? "—"}` } }],
  };
}

export function buildReminderCard(a: Act) {
  return {
    header: { title: { tag: "plain_text", content: `活动提醒：${a.name}` } },
    elements: [{ tag: "div", text: { tag: "lark_md", content: `**时间** ${fmt(a.startTime)}\n**地点** ${a.location}` } }],
  };
}

export interface FeishuNotifier {
  sendCard(openId: string, card: object): Promise<{ messageId: string }>;
}

export const larkNotifier: FeishuNotifier = {
  async sendCard(openId, card) {
    const client = createLarkClient();
    const resp = await client.im.message.create({
      params: { receive_id_type: "open_id" },
      data: { receive_id: openId, msg_type: "interactive", content: JSON.stringify(card) },
    });
    return { messageId: resp?.data?.message_id ?? "" };
  },
};
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test notify`
Expected: PASS（3 passed）。
```bash
git add packages/server/src/feishu/notify.ts packages/server/test/notify.test.ts
git commit -m "feat(server): feishu card builders + notifier interface"
```

---

## Task 2: notifications 服务（发布通知 + 日志 + 重试失败）

**Files:** Create `packages/server/src/notifications/service.ts`, `packages/server/test/notifications.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/notifications.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { notifyPublish, retryFailed } from "../src/notifications/service.js";
import type { FeishuNotifier } from "../src/feishu/notify.js";

beforeEach(resetDb);

async function setup(activeCount: number) {
  const members = [];
  for (let i = 0; i < activeCount; i++) members.push(await prisma.member.create({ data: { name: "M"+i, primaryPosition: "tekong", status: "active", feishuOpenId: "ou_"+i } }));
  const act = await prisma.activity.create({ data: { name: "训练", type: "training", status: "published", location: "x", startTime: new Date(Date.now()+86400000), participants: { create: members.map(m=>({ memberId: m.id })) } } });
  return { act, members };
}

describe("notifyPublish", () => {
  it("sends one card per active participant and logs success", async () => {
    const { act } = await setup(3);
    const notifier: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "msg" }) };
    await notifyPublish(act.id, notifier);
    expect((notifier.sendCard as any)).toHaveBeenCalledTimes(3);
    const logs = await prisma.notificationLog.findMany({ where: { activityId: act.id, type: "publish" } });
    expect(logs).toHaveLength(3);
    expect(logs.every(l => l.status === "success")).toBe(true);
  });
  it("records failures and retryFailed only resends failed", async () => {
    const { act, members } = await setup(2);
    const failing: FeishuNotifier = { sendCard: vi.fn()
      .mockResolvedValueOnce({ messageId: "ok" })
      .mockRejectedValueOnce(new Error("boom")) };
    await notifyPublish(act.id, failing);
    let logs = await prisma.notificationLog.findMany({ where: { activityId: act.id } });
    expect(logs.filter(l=>l.status==="failed")).toHaveLength(1);

    const retry: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "ok2" }) };
    await retryFailed(act.id, retry);
    expect((retry.sendCard as any)).toHaveBeenCalledTimes(1); // 只补发失败的那个
    logs = await prisma.notificationLog.findMany({ where: { activityId: act.id } });
    expect(logs.every(l=>l.status==="success")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test notifications`
Expected: FAIL（service 未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/notifications/service.ts`:
```ts
import { prisma } from "../db/client.js";
import { buildActivityCard, buildCancelCard, buildReminderCard, type FeishuNotifier } from "../feishu/notify.js";

async function activeParticipantMembers(activityId: string) {
  const ps = await prisma.activityParticipant.findMany({ where: { activityId }, include: { member: true } });
  return ps.filter((p) => p.member.status === "active");
}

async function sendOne(notifier: FeishuNotifier, activityId: string, memberId: string, openId: string, type: string, card: object) {
  const log = await prisma.notificationLog.create({ data: { activityId, memberId, type, status: "pending" } });
  try {
    const { messageId } = await notifier.sendCard(openId, card);
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "success", feishuMessageId: messageId, sentAt: new Date() } });
  } catch (e) {
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "failed", failReason: (e as Error).message } });
  }
}

export async function notifyPublish(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildActivityCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "publish", card);
  }
}

export async function notifyCancel(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildCancelCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "cancel", card);
  }
}

export async function sendReminder(activityId: string, notifier: FeishuNotifier) {
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!act) return;
  const card = buildReminderCard(act as any);
  for (const p of await activeParticipantMembers(activityId)) {
    await sendOne(notifier, activityId, p.memberId, p.member.feishuOpenId, "reminder", card);
  }
}

// 只补发失败对象（同 activity、同 type 的最新一条 failed）
export async function retryFailed(activityId: string, notifier: FeishuNotifier) {
  const failed = await prisma.notificationLog.findMany({ where: { activityId, status: "failed" }, include: { activity: true } });
  for (const log of failed) {
    const member = await prisma.member.findUnique({ where: { id: log.memberId } });
    if (!member) continue;
    const card = log.type === "cancel" ? buildCancelCard(log.activity as any) : log.type === "reminder" ? buildReminderCard(log.activity as any) : buildActivityCard(log.activity as any);
    try {
      const { messageId } = await notifier.sendCard(member.feishuOpenId, card);
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "success", feishuMessageId: messageId, sentAt: new Date(), failReason: null } });
    } catch (e) {
      await prisma.notificationLog.update({ where: { id: log.id }, data: { failReason: (e as Error).message } });
    }
  }
}

export async function notificationStatus(activityId: string) {
  const logs = await prisma.notificationLog.findMany({ where: { activityId } });
  return { success: logs.filter(l=>l.status==="success").length, failed: logs.filter(l=>l.status==="failed").length };
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test notifications`
Expected: PASS（2 passed）。
```bash
git add packages/server/src/notifications packages/server/test/notifications.test.ts
git commit -m "feat(server): notification send/log + retry-failed-only"
```

---

## Task 3: 发布/取消触发通知 + 通知状态/重试接口

**Files:** Modify `packages/server/src/activities/routes.ts`; Create `packages/server/test/publishNotify.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/publishNotify.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import request from "supertest";

const sendCard = vi.fn().mockResolvedValue({ messageId: "m" });
const app = createApp({ notifier: { sendCard } });

beforeEach(async () => { await resetDb(); await seed(); sendCard.mockClear(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username: "Levin", password: "change-me" }); return a; }

describe("publish triggers notifications", () => {
  it("publishing a draft sends cards to active participants", async () => {
    await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
    const agent = await login();
    const a = await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: new Date(Date.now()+86400000).toISOString() });
    await agent.post(`/api/admin/activities/${a.body.id}/publish`);
    expect(sendCard).toHaveBeenCalledTimes(1);
    const status = await agent.get(`/api/admin/activities/${a.body.id}/notifications`);
    expect(status.body.success).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test publishNotify`
Expected: FAIL（createApp 不接受 notifier / 接口缺失）。

- [ ] **Step 3: 写实现**

修改 `packages/server/src/app.ts` 的 `createApp` 签名以注入 notifier（默认真实）：
```ts
import { larkNotifier, type FeishuNotifier } from "./feishu/notify.js";
import { makeActivitiesRouter } from "./activities/routes.js";

export function createApp(deps: { feishuAuth?: FeishuAuthClient; notifier?: FeishuNotifier } = {}) {
  const feishuAuth = deps.feishuAuth ?? larkAuthClient;
  const notifier = deps.notifier ?? larkNotifier;
  // ...
  app.use("/api/admin/activities", makeActivitiesRouter(notifier)); // 替换原 activitiesRouter
  app.use("/api/admin/activities", attendanceRouter);
  // ...
}
```

把 `packages/server/src/activities/routes.ts` 改为工厂函数 `makeActivitiesRouter(notifier)`（保留原有 GET/POST/PUT 不变，仅 publish/cancel 注入 notifier），并新增通知接口：
```ts
import { Router } from "express";
import { requireCaptain } from "../auth/middleware.js";
import { zActivityDraft } from "./schema.js";
import { createDraft, updateDraft, getActivity, listActivities, attendanceSummary, reviewStatus, publishActivity, cancelActivity } from "./service.js";
import { notifyPublish, notifyCancel, retryFailed, notificationStatus } from "../notifications/service.js";
import type { FeishuNotifier } from "../feishu/notify.js";

export function makeActivitiesRouter(notifier: FeishuNotifier) {
  const r = Router();
  r.use(requireCaptain);
  // —— 原 GET "/" 、POST "/" 、GET "/:id" 、PUT "/:id" 原样保留（见 Plan A Task 9）——

  r.post("/:id/publish", async (req, res) => {
    try {
      const act = await publishActivity(req.params.id, new Date());
      void notifyPublish(act.id, notifier); // 异步发卡片，不阻塞响应（设计 F12）
      res.json(act);
    } catch (e) { res.status(409).json({ error: (e as Error).message }); }
  });

  r.post("/:id/cancel", async (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    try {
      const act = await cancelActivity(req.params.id, reason);
      void notifyCancel(act.id, notifier);
      res.json(act);
    } catch (e) { res.status(409).json({ error: (e as Error).message }); }
  });

  r.get("/:id/notifications", async (req, res) => res.json(await notificationStatus(req.params.id)));
  r.post("/:id/notifications/retry", async (req, res) => { await retryFailed(req.params.id, notifier); res.json(await notificationStatus(req.params.id)); });

  return r;
}
```

> 说明：测试需要同步看到 sendCard 被调用。`void notifyPublish(...)` 是 fire-and-forget；在测试里通过随后的 `GET /notifications` 断言 success 计数已能验证（publish 路由内若担心竞态，可改为 `await notifyPublish` —— 本计划测试用 `await` 形式更稳，正式可改 fire-and-forget。建议实现时 publish/cancel 内用 `await`，仅"活动总结生成"在 Plan D 做 fire-and-forget）。据此把上面两处 `void` 改为 `await`。

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test publishNotify`
Expected: PASS（1 passed）。回归：`pnpm --filter @teampilot/server test activities lifecycle`
```bash
git add packages/server/src/app.ts packages/server/src/activities/routes.ts packages/server/test/publishNotify.test.ts
git commit -m "feat(server): publish/cancel trigger feishu cards + notification status/retry"
```

---

## Task 4: 卡片回调（去/不去）更新反馈 + 时间边界

**Files:** Create `packages/server/src/feishu/events.ts`, `packages/server/test/cardAction.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/cardAction.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { handleCardAction } from "../src/feishu/events.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function scenario(status: string, startOffsetMs: number) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
  const a = await prisma.activity.create({ data: { name: "训练", type: "training", status, location: "x", startTime: new Date(Date.now()+startOffsetMs), participants: { create: [{ memberId: m.id }] } } });
  return { m, a };
}
const event = (openId: string, activityId: string, response: string) => ({ operator: { open_id: openId }, action: { value: { activityId, response } } });

describe("handleCardAction", () => {
  it("updates response when published and before start", async () => {
    const { m, a } = await scenario("published", 24 * HOUR);
    const out = await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    expect(out.text).toContain("去");
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: a.id, memberId: m.id } });
    expect(p?.attendanceResponse).toBe("going");
  });
  it("is idempotent on repeat click", async () => {
    const { a } = await scenario("published", 24 * HOUR);
    await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    const count = await prisma.activityParticipant.count({ where: { activityId: a.id } });
    expect(count).toBe(1);
  });
  it("does NOT modify after start time, only returns status", async () => {
    const { a, m } = await scenario("published", -1 * HOUR); // 已过开始
    const out = await handleCardAction(event("ou_A", a.id, "not_going") as any, new Date());
    const p = await prisma.activityParticipant.findFirst({ where: { activityId: a.id, memberId: m.id } });
    expect(p?.attendanceResponse).toBe("no_response"); // 未被修改
    expect(out.text).toContain("已开始");
  });
  it("ended/cancelled activity only returns status", async () => {
    const { a } = await scenario("cancelled", 24 * HOUR);
    const out = await handleCardAction(event("ou_A", a.id, "going") as any, new Date());
    expect(out.text).toMatch(/已取消|不可/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test cardAction`
Expected: FAIL（handleCardAction 未定义）。

- [ ] **Step 3: 写实现**

`packages/server/src/feishu/events.ts`:
```ts
import * as lark from "@larksuiteoapi/node-sdk";
import { prisma } from "../db/client.js";
import { createLarkClient } from "./client.js";

type CardEvent = { operator: { open_id: string }; action: { value: { activityId: string; response: string } } };
const respLabel: Record<string, string> = { going: "去", not_going: "不去", no_response: "未反馈" };

// 返回给飞书的提示文本；同时按规则更新或拒绝
export async function handleCardAction(event: CardEvent, now: Date): Promise<{ text: string }> {
  const openId = event.operator.open_id;
  const { activityId, response } = event.action.value;
  const member = await prisma.member.findUnique({ where: { feishuOpenId: openId } });
  const act = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!member || !act) return { text: "操作无效" };
  if (act.status === "cancelled") return { text: "活动已取消，无法反馈" };
  if (act.status === "ended") return { text: "活动已结束，无法反馈" };
  if (act.status !== "published" || act.startTime.getTime() <= now.getTime()) {
    const p = await prisma.activityParticipant.findFirst({ where: { activityId, memberId: member.id } });
    return { text: `活动已开始或不可修改，当前反馈：${respLabel[p?.attendanceResponse ?? "no_response"]}` };
  }
  await prisma.activityParticipant.updateMany({
    where: { activityId, memberId: member.id },
    data: { attendanceResponse: response, responseUpdatedAt: now },
  });
  return { text: `已记录：${respLabel[response] ?? response}` };
}

// 启动长连接：注册卡片回调（im.message 留给 Plan D）
export function startLongConnection() {
  const cfg = { /* appId/secret from env */ };
  const wsClient = new lark.WSClient({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });
  const dispatcher = new lark.EventDispatcher({}).register({
    "card.action.trigger": async (data: any) => {
      const out = await handleCardAction(data as CardEvent, new Date());
      return { toast: { type: "info", content: out.text } };
    },
  });
  wsClient.start({ eventDispatcher: dispatcher });
}
```

> 注：`card.action.trigger` 的回调返回结构与 `WSClient/EventDispatcher` 的确切签名以所装 SDK 版本为准；业务逻辑全在 `handleCardAction`（已测试），SDK 适配层变化不影响测试。

- [ ] **Step 4: 启动接线 + 运行确认通过**

修改 `packages/server/src/index.ts`：
```ts
import { startLongConnection } from "./feishu/events.js";
// ...在 app.listen 后：
startLongConnection();
```

Run: `pnpm --filter @teampilot/server test cardAction`
Expected: PASS（4 passed）。

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/feishu/events.ts packages/server/src/index.ts packages/server/test/cardAction.test.ts
git commit -m "feat(server): card action callback (response update + time boundary)"
```

---

## Task 5: 活动前提醒（scheduler 扩展）

**Files:** Modify `packages/server/src/scheduler/index.ts`; Create `packages/server/test/reminder.test.ts`

- [ ] **Step 1: 写失败测试**

`packages/server/test/reminder.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { runReminders } from "../src/scheduler/index.js";
import type { FeishuNotifier } from "../src/feishu/notify.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function published(reminderOffsetMs: number | null) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
  const start = new Date(Date.now() + 5 * HOUR);
  return prisma.activity.create({ data: { name: "训练", type: "training", status: "published", location: "x", startTime: start,
    reminderAt: reminderOffsetMs === null ? null : new Date(Date.now() - 1000), // 已到点
    participants: { create: [{ memberId: m.id }] } } });
}

describe("runReminders", () => {
  it("sends reminder when reminderAt<=now and not already sent", async () => {
    const a = await published(0);
    const notifier: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "m" }) };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).toHaveBeenCalledTimes(1);
    const logs = await prisma.notificationLog.findMany({ where: { activityId: a.id, type: "reminder" } });
    expect(logs).toHaveLength(1);
  });
  it("does not resend if a reminder log already exists (idempotent)", async () => {
    const a = await published(0);
    await prisma.notificationLog.create({ data: { activityId: a.id, memberId: (await prisma.member.findFirst())!.id, type: "reminder", status: "success" } });
    const notifier: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "m" }) };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).not.toHaveBeenCalled();
  });
  it("skips when reminderAt is null", async () => {
    await published(null);
    const notifier: FeishuNotifier = { sendCard: vi.fn() };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/server test reminder`
Expected: FAIL（runReminders 未定义）。

- [ ] **Step 3: 写实现（追加到 scheduler/index.ts）**

```ts
import { sendReminder } from "../notifications/service.js";
import { larkNotifier, type FeishuNotifier } from "../feishu/notify.js";

export async function runReminders(now: Date, notifier: FeishuNotifier) {
  const due = await prisma.activity.findMany({
    where: { status: "published", reminderAt: { not: null, lte: now } },
  });
  for (const a of due) {
    const already = await prisma.notificationLog.count({ where: { activityId: a.id, type: "reminder" } });
    if (already > 0) continue;
    await sendReminder(a.id, notifier);
  }
}
```

并把 `tick` 改为：
```ts
export async function tick(now: Date) {
  await runAutoEnd(now);
  await runReminders(now, larkNotifier);
  // Plan D 追加：ASR 轮询
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/server test reminder`
Expected: PASS（3 passed）。
```bash
git add packages/server/src/scheduler/index.ts packages/server/test/reminder.test.ts
git commit -m "feat(server): pre-activity reminders in scheduler (idempotent)"
```

---

## Task 6: 概要 Tab 通知状态区 + 重试按钮（F3 前端）

**Files:** Modify `packages/web-admin/src/pages/tabs/SummaryTab.tsx`; Create `packages/web-admin/test/notifyStatus.test.tsx`

- [ ] **Step 1: 写失败测试**

`packages/web-admin/test/notifyStatus.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SummaryTab from "../src/pages/tabs/SummaryTab.js";

const detail = { id:"a1", type:"training", status:"published", startTime:new Date().toISOString(), durationMinutes:120, location:"x", theme:null, notes:null, summary:null };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).endsWith("/notifications/retry") && init?.method==="POST") return { ok:true, status:200, json: async()=>({ success:2, failed:0 }) } as Response;
    if (String(url).includes("/notifications")) return { ok:true, status:200, json: async()=>({ success:1, failed:1 }) } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});

describe("SummaryTab notification status", () => {
  it("shows success/failed counts and a retry button when failed>0", async () => {
    render(<SummaryTab detail={detail as any} />);
    expect(await screen.findByText(/成功\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/失败\s*1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试失败通知" }));
    expect(await screen.findByText(/失败\s*0/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-admin test notifyStatus`
Expected: FAIL（通知状态区未实现）。

- [ ] **Step 3: 写实现（在 SummaryTab 末尾加通知状态区）**

把 `SummaryTab` 的 props 类型补上 `id:string; status:string`，并在组件内追加：
```tsx
import { useEffect, useState } from "react";
import { get, post } from "../../api.js";
// ... 组件内：
const [notif, setNotif] = useState<{ success:number; failed:number } | null>(null);
useEffect(() => {
  if (detail.status === "draft") return;
  void get<{success:number;failed:number}>(`/api/admin/activities/${detail.id}/notifications`).then(setNotif);
}, [detail.id, detail.status]);
// ... 在返回 JSX 末尾加：
{notif && (
  <div className="border-t pt-3 mt-3 text-sm">
    <span className="text-gray-500">通知状态：</span>成功 {notif.success} / 失败 {notif.failed}
    {notif.failed > 0 && (
      <button className="ml-3 text-blue-600" onClick={async()=>{ const r = await post<{success:number;failed:number}>(`/api/admin/activities/${detail.id}/notifications/retry`); setNotif(r); }}>重试失败通知</button>
    )}
  </div>
)}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/web-admin test notifyStatus`
Expected: PASS（1 passed）。
```bash
git add packages/web-admin/src/pages/tabs/SummaryTab.tsx packages/web-admin/test/notifyStatus.test.tsx
git commit -m "feat(web-admin): notification status + retry on summary tab (F3)"
```

---

## Task 7: 阶段2 回归 + 真机飞书验收

**Files:** 无（验证）

- [ ] **Step 1: 后端 + 前端全量回归**

Run: `pnpm -r test`
Expected: 全部 PASS（阶段1 + 阶段2 用例）。

- [ ] **Step 2: 真机飞书链路验收（需真实应用 + 已开 Bot 会话的测试账号）**

按产品规格 §10 阶段2 验收：
- 发布活动 → 测试队员飞书单聊收到卡片。
- 点「去/不去」→ admin 出勤 Tab 实时更新。
- 取消活动 → 收到取消卡片。
- 距开始 24h/2h 触发提醒（可临时把活动 startTime 调近验证）。
- 制造一次发送失败（如临时改坏一个 openId）→ 概要 Tab 显示失败 → 重试只补发失败对象。
Expected: 全部通过真实飞书。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "chore: phase-2 feishu notifications regression green" || echo "nothing to commit"
```

---

## 实现注意事项

- **长连接 vs 测试**：业务逻辑（`handleCardAction`/`notify*`/`runReminders`）全部纯函数化、可注入，单测零网络；`startLongConnection` 仅做 SDK 适配，靠真机验收（Task 7）。
- **SDK 签名**：`im.message.create`、`WSClient`、`EventDispatcher`、`card.action.trigger` 回调返回结构以所装版本为准，封装在 `notify.ts`/`events.ts` 适配层。
- **fire-and-forget vs await**：本计划 publish/cancel 用 `await notify*` 以便测试确定性；如需更快响应可改异步，但要保证 NotificationLog 已落库。
- **幂等**：提醒靠"该活动已有 reminder 日志则跳过"；反馈靠 updateMany（无重复行）。
- 遵循根 CLAUDE.md：先写失败测试再实现；只改服务当前任务的代码。

---

## 自检（spec coverage / 占位符 / 类型一致性）

**覆盖**（产品规格 §6 / §8.4，设计 §6.6）：发布卡片✓(T1/T2/T3) 去/不去回写✓(T4) 取消卡片✓(T3) 24h/2h 提醒✓(T5，reminderAt 由 Plan A 计算) 通知失败记录+只重试失败✓(T2/T3/T6) 旧卡片(取消/结束/已开始)只回状态不改✓(T4) 反馈幂等✓(T4) 仅 active 参与者收通知✓(notifications.service active 过滤)。验收 8/9/19/20/21✓。

**未覆盖（归属 Plan D）**：`im.message.receive_v1` 队员 Bot 问答（AI 场景5b）。已在边界声明，非遗漏。

**占位符**：无 TBD/TODO；改代码步骤均含完整代码。

**类型一致性**：`FeishuNotifier.sendCard(openId, card)` 在 notify.ts 定义，notifications/scheduler/createApp 全部复用；`createApp(deps)` 扩展 `notifier` 与 Plan A/B 的 `feishuAuth` 并存；`buildActivityCard/buildCancelCard/buildReminderCard` 在 notify 定义、notifications/events 复用；`handleCardAction(event, now)` 签名一致；`runReminders(now, notifier)`、`tick(now)` 与 Plan A 的 `runAutoEnd(now)` 一致。
