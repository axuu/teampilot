import bcrypt from "bcryptjs";
import { prisma } from "../src/db/client.js";
import { loadConfig } from "../src/config/index.js";

export async function seed() {
  const c = loadConfig();
  await prisma.captain.upsert({
    where: { username: c.captainUsername },
    update: {},
    create: {
      username: c.captainUsername,
      passwordHash: await bcrypt.hash(c.captainPassword, 10),
      displayName: c.captainUsername,
    },
  });
  await prisma.teamSettings.upsert({
    where: { id: "singleton" },
    update: { defaultLocation: c.teamDefaultLocation },
    create: { id: "singleton", defaultLocation: c.teamDefaultLocation },
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then(() => prisma.$disconnect());
}
