import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";
import { prisma } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import request from "supertest";

const sendCard = vi.fn().mockResolvedValue({ messageId: "m" });
const app = createApp({ notifier: { sendCard } });

beforeEach(async () => { await resetDb(); await seed(); sendCard.mockClear(); });
async function login() { const a = request.agent(app); await a.post("/api/admin/login").send({ username: "Levin", password: "change-me" }); return a; }

describe("publish triggers notifications", () => {
  it("publishing a draft sends cards to active participants", async () => {
    await prisma.member.create({ data: { name: "A", primaryPosition: "tekong", status: "active", feishuOpenId: "ou_A" } });
    const agent = await login();
    const a = await agent.post("/api/admin/activities").send({ name: "训练", type: "training", startTime: new Date(Date.now()+86400000).toISOString() });
    await agent.post(`/api/admin/activities/${a.body.id}/publish`);
    expect(sendCard).toHaveBeenCalledTimes(1);
    const status = await agent.get(`/api/admin/activities/${a.body.id}/notifications`);
    expect(status.body.success).toBe(1);
  });
});
