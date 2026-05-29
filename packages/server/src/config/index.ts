import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  TEAM_TZ: z.string().default("Asia/Shanghai"),
  CAPTAIN_USERNAME: z.string().min(1),
  CAPTAIN_PASSWORD: z.string().min(1),
  TEAM_DEFAULT_LOCATION: z.string().min(1),
  TEAM_JOIN_TOKEN: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  FEISHU_APP_ID: z.string().min(1),
  FEISHU_APP_SECRET: z.string().min(1),
  H5_BASE_URL: z.string().url(),
});

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const p = schema.parse(env);
  return {
    databaseUrl: p.DATABASE_URL,
    teamTz: p.TEAM_TZ,
    captainUsername: p.CAPTAIN_USERNAME,
    captainPassword: p.CAPTAIN_PASSWORD,
    teamDefaultLocation: p.TEAM_DEFAULT_LOCATION,
    teamJoinToken: p.TEAM_JOIN_TOKEN,
    sessionSecret: p.SESSION_SECRET,
    feishuAppId: p.FEISHU_APP_ID,
    feishuAppSecret: p.FEISHU_APP_SECRET,
    h5BaseUrl: p.H5_BASE_URL,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
