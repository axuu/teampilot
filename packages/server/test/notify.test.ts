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
