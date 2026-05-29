import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db/client.js";
import { resetDb } from "./helpers/db.js";
import { seed } from "../prisma/seed.js";

beforeEach(resetDb);

describe("seed", () => {
  it("creates captain (hashed) and team settings", async () => {
    await seed();
    const cap = await prisma.captain.findFirst();
    const settings = await prisma.teamSettings.findUnique({ where: { id: "singleton" } });
    expect(cap?.username).toBe("Levin");
    expect(cap?.passwordHash).not.toBe("change-me");
    expect(settings?.defaultLocation).toBeTruthy();
  });
});
