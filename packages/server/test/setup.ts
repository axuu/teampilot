import { execSync } from "node:child_process";
export default function setup() {
  process.env.DATABASE_URL = "file:./prisma/test.db";
  execSync("node_modules/.bin/prisma db push --force-reset --skip-generate", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
    },
    stdio: "inherit",
  });
}
