import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { prisma } from "../src/db/client.js";
import type { FeishuAuthClient } from "../src/feishu/auth.js";

// 假 feishu：code 直接当 open_id；"fail" 代表识别失败
const fakeAuth: FeishuAuthClient = {
  async getUserOpenIdByCode(code) { return code === "fail" ? null : code; },
};
const app = createApp({ feishuAuth: fakeAuth });

const token = "fixed-join-token-001"; // 来自 vitest test.env TEAM_JOIN_TOKEN
beforeEach(resetDb);

function join(body: object) { return request(app).post("/api/h5/join").send(body); }

describe("H5 join", () => {
  it("rejects invalid join token", async () => {
    const res = await join({ token: "wrong", code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("invalid_link");
  });
  it("rejects when feishu identity fails", async () => {
    const res = await join({ token, code: "fail", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("identity_failed");
  });
  it("creates an active member on first join", async () => {
    const res = await join({ token, code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    expect(res.body.status).toBe("created");
    expect(await prisma.member.count()).toBe(1);
  });
  it("is idempotent: second join of same open_id => already_joined, no dup", async () => {
    await join({ token, code: "ou_a", form: { name: "甲", primaryPosition: "tekong" } });
    const res = await join({ token, code: "ou_a", form: { name: "甲again", primaryPosition: "feeder" } });
    expect(res.body.status).toBe("already_joined");
    expect(await prisma.member.count()).toBe(1);
  });
  it("left member reopening => contact_captain, not restored", async () => {
    await prisma.member.create({ data: { name: "乙", primaryPosition: "striker", status: "left", feishuOpenId: "ou_b" } });
    const res = await join({ token, code: "ou_b", form: { name: "乙", primaryPosition: "striker" } });
    expect(res.body.status).toBe("contact_captain");
    const m = await prisma.member.findUnique({ where: { feishuOpenId: "ou_b" } });
    expect(m?.status).toBe("left");
  });
});
