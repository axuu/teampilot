import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config/index.js";

const base = {
  DATABASE_URL: "file:./x.db",
  CAPTAIN_USERNAME: "Levin",
  CAPTAIN_PASSWORD: "pw",
  TEAM_DEFAULT_LOCATION: "场地",
  TEAM_JOIN_TOKEN: "tok",
  SESSION_SECRET: "s",
  FEISHU_APP_ID: "a",
  FEISHU_APP_SECRET: "b",
  H5_BASE_URL: "http://localhost",
};

describe("loadConfig", () => {
  it("parses a valid env with TEAM_TZ default", () => {
    const c = loadConfig(base);
    expect(c.captainUsername).toBe("Levin");
    expect(c.teamTz).toBe("Asia/Shanghai");
  });
  it("throws when a required var is missing", () => {
    const { SESSION_SECRET, ...missing } = base;
    expect(() => loadConfig(missing as Record<string, string>)).toThrow();
  });
});
