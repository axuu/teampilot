import { describe, it, expect } from "vitest";
import { positionLabel, levelLabel } from "@teampilot/shared";

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
