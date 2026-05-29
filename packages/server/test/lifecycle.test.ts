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
