import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import { runReminders } from "../src/scheduler/index.js";
import type { FeishuNotifier } from "../src/feishu/notify.js";

beforeEach(resetDb);
const HOUR = 3600 * 1000;

async function published(withReminder: boolean) {
  const m = await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
  const start = new Date(Date.now() + 5 * HOUR);
  return prisma.activity.create({ data: { name: "训练", type: "training", status: "published", location: "x", startTime: start,
    reminderAt: withReminder ? new Date(Date.now() - 1000) : null, // 已到点
    participants: { create: [{ memberId: m.id }] } } });
}

describe("runReminders", () => {
  it("sends reminder when reminderAt<=now and not already sent", async () => {
    const a = await published(true);
    const notifier: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "m" }) };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).toHaveBeenCalledTimes(1);
    const logs = await prisma.notificationLog.findMany({ where: { activityId: a.id, type: "reminder" } });
    expect(logs).toHaveLength(1);
  });
  it("does not resend if a reminder log already exists (idempotent)", async () => {
    const a = await published(true);
    await prisma.notificationLog.create({ data: { activityId: a.id, memberId: (await prisma.member.findFirst())!.id, type: "reminder", status: "success" } });
    const notifier: FeishuNotifier = { sendCard: vi.fn().mockResolvedValue({ messageId: "m" }) };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).not.toHaveBeenCalled();
  });
  it("skips when reminderAt is null", async () => {
    await published(false);
    const notifier: FeishuNotifier = { sendCard: vi.fn() };
    await runReminders(new Date(), notifier);
    expect((notifier.sendCard as any)).not.toHaveBeenCalled();
  });
});
