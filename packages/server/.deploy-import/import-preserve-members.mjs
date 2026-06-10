#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PRESERVE_MEMBER_NAMES = ["张大壮", "啊拓"];

const POSITIONS = ["tekong", "feeder", "striker"];
const MEMBER_LEVELS = ["novice", "intermediate", "upper", "advanced"];
const MEMBER_STYLES = [
  "进攻型",
  "防守型",
  "全能型",
  "发球专精",
  "技术细腻",
  "爆发力强",
  "稳定均衡",
  "跑动积极",
  "战术灵活",
  "队长领袖型",
];
const MEMBER_STATUSES = ["active", "left"];
const ACTIVITY_TYPES = ["training", "match"];
const ACTIVITY_STATUSES = ["draft", "published", "ended", "cancelled"];
const ATTENDANCE_RESPONSES = ["going", "not_going", "no_response"];
const ACTUAL_ATTENDANCES = ["present", "absent", "pending"];
const SUMMARY_STAGES = ["none", "initial", "post_review"];
const NOTIFICATION_TYPES = ["publish", "cancel", "reminder"];
const NOTIFICATION_STATUSES = ["pending", "success", "failed"];

const positionMap = enumMap(POSITIONS, {
  "发球手": "tekong",
  Tekong: "tekong",
  "二传手": "feeder",
  Feeder: "feeder",
  "攻球手": "striker",
  Striker: "striker",
});
const levelMap = enumMap(MEMBER_LEVELS, {
  "新手": "novice",
  "中等": "intermediate",
  "中上": "upper",
  "高水平": "advanced",
});
const memberStatusMap = enumMap(MEMBER_STATUSES, { "正常": "active", "离队": "left" });
const activityTypeMap = enumMap(ACTIVITY_TYPES, { "训练": "training", "比赛": "match" });
const activityStatusMap = enumMap(ACTIVITY_STATUSES, {
  "草稿": "draft",
  "已发布": "published",
  "已结束": "ended",
  "已取消": "cancelled",
  canceled: "cancelled",
});
const attendanceMap = enumMap(ATTENDANCE_RESPONSES, {
  "去": "going",
  "不去": "not_going",
  "未反馈": "no_response",
});
const actualMap = enumMap(ACTUAL_ATTENDANCES, {
  "已到场": "present",
  "未到场": "absent",
  "待确认": "pending",
});
const notificationStatusMap = enumMap(NOTIFICATION_STATUSES, {
  "成功": "success",
  "失败": "failed",
  "未发送": "pending",
});
const notificationTypeMap = enumMap(NOTIFICATION_TYPES, {});
const summaryStageMap = enumMap(SUMMARY_STAGES, {});

function enumMap(values, extras) {
  return Object.fromEntries([...values.map((value) => [value, value]), ...Object.entries(extras)]);
}

function fail(pathName, message) {
  throw new Error(`${pathName}: ${message}`);
}

function objectAt(value, pathName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(pathName, "必须是对象");
  return value;
}

function arrayAt(value, pathName) {
  if (!Array.isArray(value)) fail(pathName, "必须是数组");
  return value;
}

function text(value, pathName, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.required) fail(pathName, "不能为空");
    return options.fallback ?? null;
  }
  const out = String(value).trim();
  if (!out && options.required) fail(pathName, "不能为空");
  if (options.max && out.length > options.max) fail(pathName, `不能超过 ${options.max} 字`);
  return out || (options.fallback ?? null);
}

function numberAt(value, pathName, fallback) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    fail(pathName, "不能为空");
  }
  const out = Number(value);
  if (!Number.isInteger(out) || out <= 0) fail(pathName, "必须是正整数");
  return out;
}

function normalize(value, pathName, map, options = {}) {
  const raw = text(value, pathName, { required: options.required });
  if (raw === null) return null;
  const out = map[raw];
  if (!out) fail(pathName, `无法识别的值 "${raw}"`);
  return out;
}

function dateAt(value, pathName, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.fallbackNow) return new Date();
    if (options.required) fail(pathName, "不能为空");
    return null;
  }
  const out = new Date(String(value));
  if (Number.isNaN(out.getTime())) fail(pathName, "必须是可识别的 ISO 时间");
  return out;
}

function jsonString(value, pathName) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    fail(pathName, "必须是 JSON 对象或字符串");
  }
}

function assertUnique(values, pathName) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(pathName, `存在重复值 "${value}"`);
    seen.add(value);
  }
}

export function normalizeMockImport(raw) {
  const root = objectAt(raw, "$");
  if (root.schemaVersion !== "teampilot.mock-import.v1") fail("$.schemaVersion", "必须是 teampilot.mock-import.v1");

  const warnings = [];
  const importMode = normalize(root.importMode ?? "upsert", "$.importMode", { reset: "reset", upsert: "upsert" }, { required: true });
  const settingsRaw = objectAt(root.teamSettings ?? root.config, "$.teamSettings");
  const membersRaw = arrayAt(root.members ?? root.players, "$.members");
  const activitiesRaw = arrayAt(root.activities, "$.activities");

  const teamSettings = {
    defaultLocation: text(settingsRaw.defaultLocation, "$.teamSettings.defaultLocation", { required: true }),
    trainingRules: text(settingsRaw.trainingRules, "$.teamSettings.trainingRules", { fallback: "" }),
    matchRules: text(settingsRaw.matchRules, "$.teamSettings.matchRules", { fallback: "" }),
  };

  const members = membersRaw.map((value, index) => {
    const item = objectAt(value, `$.members[${index}]`);
    const id = text(item.id, `$.members[${index}].id`, { required: true });
    const feishuOpenId = text(item.feishuOpenId ?? item.feishuUserId, `$.members[${index}].feishuOpenId`, {
      required: true,
    });
    if (feishuOpenId.startsWith("mock_")) warnings.push(`队员 ${id} 使用 mock 飞书 open_id，不能用于真实飞书通知。`);
    return {
      id,
      name: text(item.name, `$.members[${index}].name`, { required: true, max: 50 }),
      jerseyNumber: text(item.jerseyNumber, `$.members[${index}].jerseyNumber`, { max: 10 }),
      primaryPosition: normalize(item.primaryPosition, `$.members[${index}].primaryPosition`, positionMap, { required: true }),
      backupPosition: normalize(item.backupPosition, `$.members[${index}].backupPosition`, positionMap),
      level: normalize(item.level, `$.members[${index}].level`, levelMap),
      style: normalize(item.style, `$.members[${index}].style`, enumMap(MEMBER_STYLES, {})),
      status: normalize(item.status ?? "active", `$.members[${index}].status`, memberStatusMap, { required: true }),
      captainNote: text(item.captainNote, `$.members[${index}].captainNote`, { max: 100 }),
      feishuOpenId,
      createdAt: dateAt(item.createdAt ?? item.joinedAt, `$.members[${index}].createdAt`, { fallbackNow: true }),
    };
  });

  assertUnique(members.map((member) => member.id), "$.members[].id");
  assertUnique(members.map((member) => member.feishuOpenId), "$.members[].feishuOpenId");
  const memberIds = new Set(members.map((member) => member.id));

  const activities = activitiesRaw.map((value, index) => {
    const item = objectAt(value, `$.activities[${index}]`);
    const id = text(item.id, `$.activities[${index}].id`, { required: true });
    const participantsRaw = arrayAt(item.participants ?? [], `$.activities[${index}].participants`);
    const notificationLogsRaw = arrayAt(item.notificationLogs ?? [], `$.activities[${index}].notificationLogs`);
    const participants = participantsRaw.map((pValue, pIndex) => {
      const participant = objectAt(pValue, `$.activities[${index}].participants[${pIndex}]`);
      const memberId = text(participant.memberId, `$.activities[${index}].participants[${pIndex}].memberId`, {
        required: true,
      });
      if (!memberIds.has(memberId)) fail(`$.activities[${index}].participants[${pIndex}].memberId`, `找不到队员 ${memberId}`);
      return {
        memberId,
        attendanceResponse: normalize(
          participant.attendanceResponse ?? "no_response",
          `$.activities[${index}].participants[${pIndex}].attendanceResponse`,
          attendanceMap,
          { required: true },
        ),
        responseUpdatedAt: dateAt(participant.responseUpdatedAt, `$.activities[${index}].participants[${pIndex}].responseUpdatedAt`),
        actualAttendance: normalize(participant.actualAttendance, `$.activities[${index}].participants[${pIndex}].actualAttendance`, actualMap),
      };
    });
    assertUnique(participants.map((participant) => participant.memberId), `$.activities[${index}].participants[].memberId`);

    const reviewRaw = item.review ? objectAt(item.review, `$.activities[${index}].review`) : null;
    const review = reviewRaw
      ? {
          rawNotes: text(reviewRaw.rawNotes ?? reviewRaw.manualText ?? reviewRaw.transcript, `$.activities[${index}].review.rawNotes`, {
            fallback: "",
          }),
          aiSummary: jsonString(reviewRaw.aiSummary, `$.activities[${index}].review.aiSummary`),
          aiSummaryUpdatedAt: dateAt(reviewRaw.aiSummaryUpdatedAt, `$.activities[${index}].review.aiSummaryUpdatedAt`),
        }
      : null;

    const notificationLogs = notificationLogsRaw.map((logValue, logIndex) => {
      const log = objectAt(logValue, `$.activities[${index}].notificationLogs[${logIndex}]`);
      const memberId = text(log.memberId, `$.activities[${index}].notificationLogs[${logIndex}].memberId`, { required: true });
      if (!memberIds.has(memberId)) fail(`$.activities[${index}].notificationLogs[${logIndex}].memberId`, `找不到队员 ${memberId}`);
      return {
        memberId,
        type: normalize(log.type ?? "publish", `$.activities[${index}].notificationLogs[${logIndex}].type`, notificationTypeMap, {
          required: true,
        }),
        status: normalize(log.status ?? "pending", `$.activities[${index}].notificationLogs[${logIndex}].status`, notificationStatusMap, {
          required: true,
        }),
        failReason: text(log.failReason, `$.activities[${index}].notificationLogs[${logIndex}].failReason`),
        feishuMessageId: text(log.feishuMessageId, `$.activities[${index}].notificationLogs[${logIndex}].feishuMessageId`),
        createdAt: dateAt(log.createdAt, `$.activities[${index}].notificationLogs[${logIndex}].createdAt`, { fallbackNow: true }),
        sentAt: dateAt(log.sentAt, `$.activities[${index}].notificationLogs[${logIndex}].sentAt`),
      };
    });

    const status = normalize(item.status ?? "draft", `$.activities[${index}].status`, activityStatusMap, { required: true });
    for (const participant of participants) {
      if (status !== "ended" && participant.actualAttendance !== null) {
        warnings.push(`活动 ${id} 不是已结束状态，但包含实际到场记录。`);
      }
    }

    return {
      id,
      name: text(item.name ?? item.title, `$.activities[${index}].name`, { required: true, max: 100 }),
      type: normalize(item.type, `$.activities[${index}].type`, activityTypeMap, { required: true }),
      startTime: dateAt(item.startTime, `$.activities[${index}].startTime`, { required: true }),
      durationMinutes: numberAt(item.durationMinutes ?? item.duration, `$.activities[${index}].durationMinutes`, 120),
      location: text(item.location, `$.activities[${index}].location`, { required: true }),
      theme: text(item.theme, `$.activities[${index}].theme`),
      notes: text(item.notes, `$.activities[${index}].notes`),
      status,
      cancelReason: text(item.cancelReason, `$.activities[${index}].cancelReason`),
      summary: text(item.summary ?? item.publicSummary, `$.activities[${index}].summary`),
      summaryStage: normalize(item.summaryStage ?? (item.summary ? "initial" : "none"), `$.activities[${index}].summaryStage`, summaryStageMap, {
        required: true,
      }),
      summaryUpdatedAt: dateAt(item.summaryUpdatedAt, `$.activities[${index}].summaryUpdatedAt`),
      advice: jsonString(item.advice, `$.activities[${index}].advice`),
      adviceUpdatedAt: dateAt(item.adviceUpdatedAt, `$.activities[${index}].adviceUpdatedAt`),
      reminderAt: dateAt(item.reminderAt, `$.activities[${index}].reminderAt`),
      publishedAt: dateAt(item.publishedAt, `$.activities[${index}].publishedAt`),
      endedAt: dateAt(item.endedAt, `$.activities[${index}].endedAt`),
      createdAt: dateAt(item.createdAt, `$.activities[${index}].createdAt`, { fallbackNow: true }),
      participants,
      review,
      notificationLogs,
    };
  });

  assertUnique(activities.map((activity) => activity.id), "$.activities[].id");
  return { schemaVersion: "teampilot.mock-import.v1", importMode, teamSettings, members, activities, warnings };
}

export function sourceCounts(data) {
  return {
    members: data.members.length,
    activities: data.activities.length,
    participants: data.activities.reduce((sum, activity) => sum + activity.participants.length, 0),
    reviews: data.activities.filter((activity) => activity.review).length,
    notificationLogs: data.activities.reduce((sum, activity) => sum + activity.notificationLogs.length, 0),
  };
}

export function buildPreserveResetPlan(data, options) {
  const preserveNames = options.preserveNames ?? DEFAULT_PRESERVE_MEMBER_NAMES;
  const currentMembers = options.currentMembers ?? [];
  const currentCounts = options.currentCounts ?? {
    members: currentMembers.length,
    activities: 0,
    participants: 0,
    reviews: 0,
    notificationLogs: 0,
    assistantMessages: 0,
  };
  const warnings = [...data.warnings];
  const preservedMembers = preserveNames.flatMap((name) => currentMembers.filter((member) => member.name === name));

  for (const name of preserveNames) {
    const matches = currentMembers.filter((member) => member.name === name);
    if (matches.length === 0) fail("preserve", `当前数据库里找不到要保留的队员「${name}」`);
    if (matches.length > 1) warnings.push(`当前数据库里有 ${matches.length} 个名为「${name}」的队员，本脚本会全部保留。`);
  }

  const preservedIds = new Set(preservedMembers.map((member) => member.id));
  const preservedOpenIds = new Set(preservedMembers.map((member) => member.feishuOpenId).filter(Boolean));
  const importMemberIds = new Set(data.members.map((member) => member.id));
  const importOpenIds = new Set(data.members.map((member) => member.feishuOpenId));
  const importNames = new Set(data.members.map((member) => member.name));

  for (const member of preservedMembers) {
    if (importMemberIds.has(member.id)) fail("preserve", `保留队员 ID 与导入文件冲突：${member.name} / ${member.id}`);
    if (member.feishuOpenId && importOpenIds.has(member.feishuOpenId)) {
      fail("preserve", `保留队员 feishuOpenId 与导入文件冲突：${member.name}`);
    }
  }

  for (const name of preserveNames) {
    if (importNames.has(name)) fail("preserve", `导入文件里也包含保留队员姓名「${name}」，请先改名或移除。`);
  }

  const deleteMemberIds = currentMembers.filter((member) => !preservedIds.has(member.id)).map((member) => member.id);
  const finalMemberCount = preservedMembers.length + data.members.length;

  return {
    mode: "reset-preserve-members",
    preserveNames,
    preservedMembers,
    deleteMemberIds,
    finalMemberCount,
    currentCounts,
    sourceCounts: sourceCounts(data),
    destructiveDeletes: {
      activities: currentCounts.activities,
      participants: currentCounts.participants,
      reviews: currentCounts.reviews,
      notificationLogs: currentCounts.notificationLogs,
      assistantMessages: currentCounts.assistantMessages,
      membersExceptPreserved: deleteMemberIds.length,
    },
    warnings,
  };
}

async function getCurrentSnapshot(prisma) {
  const [members, activities, participants, reviews, notificationLogs, assistantMessages] = await Promise.all([
    prisma.member.findMany({ select: { id: true, name: true, feishuOpenId: true }, orderBy: { name: "asc" } }),
    prisma.activity.count(),
    prisma.activityParticipant.count(),
    prisma.activityReview.count(),
    prisma.notificationLog.count(),
    prisma.assistantMessage.count(),
  ]);
  return {
    currentMembers: members,
    currentCounts: {
      members: members.length,
      activities,
      participants,
      reviews,
      notificationLogs,
      assistantMessages,
    },
  };
}

function resolveSqliteFile(databaseUrl, cwd = process.cwd()) {
  if (!databaseUrl?.startsWith("file:")) return null;
  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath.includes("?")) return null;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
}

function backupSqliteDatabase(databaseUrl, backupDir, cwd = process.cwd()) {
  const dbPath = resolveSqliteFile(databaseUrl, cwd);
  if (!dbPath || !existsSync(dbPath)) return null;
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `teampilot-${stamp}.db`);
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

async function applyPreserveReset(prisma, data, plan) {
  const preserveIds = plan.preservedMembers.map((member) => member.id);
  await prisma.$transaction(async (tx) => {
    await tx.notificationLog.deleteMany();
    await tx.activityReview.deleteMany();
    await tx.activityParticipant.deleteMany();
    await tx.activity.deleteMany();
    await tx.assistantMessage.deleteMany();
    await tx.member.deleteMany({ where: { id: { notIn: preserveIds } } });

    await tx.teamSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data.teamSettings },
      update: data.teamSettings,
    });

    for (const member of data.members) {
      await tx.member.create({ data: member });
    }

    for (const activity of data.activities) {
      const { id, participants, review, notificationLogs, ...activityData } = activity;
      await tx.activity.create({ data: { id, ...activityData } });
      if (participants.length) {
        await tx.activityParticipant.createMany({
          data: participants.map((participant) => ({ ...participant, activityId: id })),
        });
      }
      if (review) {
        await tx.activityReview.create({ data: { activityId: id, ...review } });
      }
      if (notificationLogs.length) {
        await tx.notificationLog.createMany({
          data: notificationLogs.map((log) => ({ ...log, activityId: id })),
        });
      }
    }
  });
}

function usage() {
  console.log(`TeamPilot 本地保留队员导入工具

默认只预览，不写入数据库。默认保留队员：${DEFAULT_PRESERVE_MEMBER_NAMES.join("、")}

用法：
  node .local-db-import/import-preserve-members.mjs <file> [--dry-run]
  node .local-db-import/import-preserve-members.mjs <file> --source-only
  node .local-db-import/import-preserve-members.mjs <file> --apply --target local --confirm-preserve-reset
  node .local-db-import/import-preserve-members.mjs <file> --apply --target production --confirm-preserve-reset --confirm-prod-import

参数：
  --dry-run                         预览数据库影响，不写库（默认）
  --source-only                     只校验导入 JSON，不连接数据库
  --apply                           真正写入数据库
  --target <local|staging|production>
  --preserve-member-name <name>      额外保留指定姓名的旧队员，可重复
  --confirm-preserve-reset           写库时必须显式添加
  --confirm-prod-import              生产写入时必须显式添加
  --backup-dir <dir>                 备份目录，默认 .local-db-import/backups
  --database-url <url>               临时覆盖 DATABASE_URL
`);
}

function parseArgs(argv) {
  const args = {
    apply: false,
    sourceOnly: false,
    target: "local",
    preserveNames: [...DEFAULT_PRESERVE_MEMBER_NAMES],
    confirmPreserveReset: false,
    confirmProdImport: false,
    backupDir: ".local-db-import/backups",
  };
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (item === "--dry-run") args.apply = false;
    else if (item === "--source-only") args.sourceOnly = true;
    else if (item === "--apply") args.apply = true;
    else if (item === "--confirm-preserve-reset") args.confirmPreserveReset = true;
    else if (item === "--confirm-prod-import") args.confirmProdImport = true;
    else if (item === "--target") {
      const target = argv[++index];
      if (!["local", "staging", "production"].includes(target)) throw new Error("target 必须是 local、staging 或 production");
      args.target = target;
    } else if (item === "--preserve-member-name") {
      const name = argv[++index];
      if (!name) throw new Error("--preserve-member-name 需要姓名");
      if (!args.preserveNames.includes(name)) args.preserveNames.push(name);
    } else if (item === "--backup-dir") {
      args.backupDir = argv[++index] || fail("args", "--backup-dir 需要目录");
    } else if (item === "--database-url") {
      args.databaseUrl = argv[++index] || fail("args", "--database-url 需要值");
    } else if (item === "--help" || item === "-h") {
      args.help = true;
    } else if (item.startsWith("--")) {
      throw new Error(`未知参数：${item}`);
    } else if (!args.file) {
      args.file = item;
    } else {
      throw new Error(`多余参数：${item}`);
    }
  }
  return args;
}

function assertExecutionAllowed(args) {
  if (args.sourceOnly && args.apply) throw new Error("--source-only 不能和 --apply 同时使用");
  if (!args.apply) return;
  if (!args.confirmPreserveReset) throw new Error("写库必须添加 --confirm-preserve-reset");
  if (args.target === "production" && !args.confirmProdImport) throw new Error("生产写库必须添加 --confirm-prod-import");
}

function printSourceOnly(data) {
  const counts = sourceCounts(data);
  console.log("\nTeamPilot 导入文件校验");
  console.log("----------------------");
  console.log(`导入模式：${data.importMode}`);
  console.log(`队员：${counts.members}`);
  console.log(`活动：${counts.activities}`);
  console.log(`参与记录：${counts.participants}`);
  console.log(`复盘：${counts.reviews}`);
  console.log(`通知日志：${counts.notificationLogs}`);
  if (data.warnings.length) {
    console.log("\n提醒：");
    for (const warning of data.warnings) console.log(`- ${warning}`);
  }
}

function printPlan(plan, args) {
  console.log("\nTeamPilot 保留队员导入预览");
  console.log("--------------------------");
  console.log(`目标环境：${args.target}`);
  console.log(`本次动作：${args.apply ? "写入数据库" : "只预览，不写入"}`);
  console.log(`保留队员：${plan.preserveNames.join("、")}`);
  console.log("\n当前库里会保留：");
  for (const member of plan.preservedMembers) console.log(`- ${member.name} (${member.id})`);
  console.log("\n当前库里会清理：");
  console.log(`- 旧队员：${plan.destructiveDeletes.membersExceptPreserved}`);
  console.log(`- 活动：${plan.destructiveDeletes.activities}`);
  console.log(`- 参与记录：${plan.destructiveDeletes.participants}`);
  console.log(`- 复盘：${plan.destructiveDeletes.reviews}`);
  console.log(`- 通知日志：${plan.destructiveDeletes.notificationLogs}`);
  console.log(`- AI 对话：${plan.destructiveDeletes.assistantMessages}`);
  console.log("\n导入文件包含：");
  console.log(`- 队员：${plan.sourceCounts.members}`);
  console.log(`- 活动：${plan.sourceCounts.activities}`);
  console.log(`- 参与记录：${plan.sourceCounts.participants}`);
  console.log(`- 复盘：${plan.sourceCounts.reviews}`);
  console.log(`- 通知日志：${plan.sourceCounts.notificationLogs}`);
  console.log(`\n导入后队员总数预计：${plan.finalMemberCount}`);
  if (plan.warnings.length) {
    console.log("\n提醒：");
    for (const warning of plan.warnings) console.log(`- ${warning}`);
  }
}

async function loadPrisma() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    return new PrismaClient();
  } catch (error) {
    throw new Error(`无法加载 @prisma/client。请先在项目里安装依赖并生成 Prisma Client。原始错误：${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  assertExecutionAllowed(args);
  if (args.databaseUrl) process.env.DATABASE_URL = args.databaseUrl;

  const filePath = path.resolve(args.file);
  const data = normalizeMockImport(JSON.parse(readFileSync(filePath, "utf8")));

  if (args.sourceOnly) {
    printSourceOnly(data);
    console.log("\n结果：导入文件校验完成，没有连接数据库。");
    return;
  }

  const prisma = await loadPrisma();
  try {
    const snapshot = await getCurrentSnapshot(prisma);
    const plan = buildPreserveResetPlan(data, {
      preserveNames: args.preserveNames,
      currentMembers: snapshot.currentMembers,
      currentCounts: snapshot.currentCounts,
    });
    printPlan(plan, args);

    if (!args.apply) {
      console.log("\n结果：预览完成，数据库没有被修改。");
      return;
    }

    const backupPath = backupSqliteDatabase(process.env.DATABASE_URL ?? "", args.backupDir);
    if (backupPath) console.log(`\n已备份数据库：${backupPath}`);
    else console.log("\n未生成数据库备份：当前 DATABASE_URL 不是可直接复制的 SQLite 文件，或文件尚不存在。");

    await applyPreserveReset(prisma, data, plan);
    console.log("\n结果：导入完成。");
  } finally {
    await prisma.$disconnect();
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error("\n导入失败：");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
