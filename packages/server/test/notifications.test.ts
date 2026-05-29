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
