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
