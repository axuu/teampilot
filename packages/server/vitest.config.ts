import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globalSetup: ["./test/setup.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./prisma/test.db",
      CAPTAIN_USERNAME: "Levin",
      CAPTAIN_PASSWORD: "change-me",
      TEAM_DEFAULT_LOCATION: "测试场地",
      TEAM_JOIN_TOKEN: "fixed-join-token-001",
      SESSION_SECRET: "test-secret",
      FEISHU_APP_ID: "test",
      FEISHU_APP_SECRET: "test",
      H5_BASE_URL: "http://localhost:5174",
    },
  },
});
