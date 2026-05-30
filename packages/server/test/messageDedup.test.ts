import { describe, it, expect } from "vitest";
import { createMessageDedup } from "../src/feishu/events.js";

describe("createMessageDedup", () => {
  it("returns true for a new id, false for a repeat", () => {
    const dedup = createMessageDedup();
    expect(dedup("m1")).toBe(true);
    expect(dedup("m1")).toBe(false);
    expect(dedup("m2")).toBe(true);
    expect(dedup("m1")).toBe(false);
  });
  it("evicts oldest entries past maxSize but still dedupes recent ones", () => {
    const dedup = createMessageDedup(4); // evicts down to 2 when size>4
    expect(dedup("a")).toBe(true);
    expect(dedup("b")).toBe(true);
    expect(dedup("c")).toBe(true);
    expect(dedup("d")).toBe(true);
    expect(dedup("e")).toBe(true); // size hits 5 > 4 → evict oldest 3 (a,b,c)
    // recent ones still deduped
    expect(dedup("e")).toBe(false);
    expect(dedup("d")).toBe(false);
    // evicted oldest are treated as new again (acceptable at huge cap in prod)
    expect(dedup("a")).toBe(true);
  });
});
