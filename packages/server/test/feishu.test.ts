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
