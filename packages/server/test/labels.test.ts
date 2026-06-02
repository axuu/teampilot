import { describe, it, expect } from "vitest";
import { positionLabel, levelLabel } from "@teampilot/shared";
import { memberLine } from "../src/ai/context.js";

describe("enum labels", () => {
  it("maps positions to Chinese", () => {
    expect(positionLabel("tekong")).toBe("发球手");
    expect(positionLabel("feeder")).toBe("二传手");
    expect(positionLabel("striker")).toBe("攻球手");
  });
  it("maps levels to Chinese", () => {
    expect(levelLabel("novice")).toBe("新手");
    expect(levelLabel("intermediate")).toBe("中等");
    expect(levelLabel("upper")).toBe("中上");
    expect(levelLabel("advanced")).toBe("高水平");
  });
  it("returns empty string for nullish and passes through unknown", () => {
    expect(positionLabel(null)).toBe("");
    expect(levelLabel(undefined)).toBe("");
    expect(positionLabel("unknown")).toBe("unknown");
  });
});

describe("memberLine §9.6 Chinese labels", () => {
  it("renders position/level as Chinese labels", () => {
    const m = { name: "甲", primaryPosition: "tekong", backupPosition: "feeder", level: "advanced", style: null, captainNote: null };
    expect(memberLine(m)).toBe("甲（主位 发球手，备位 二传手，水平 高水平）");
  });
});
