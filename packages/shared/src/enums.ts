import { z } from "zod";

export const POSITIONS = ["tekong", "feeder", "striker"] as const;
export type Position = (typeof POSITIONS)[number];

export const MEMBER_LEVELS = ["novice", "intermediate", "upper", "advanced"] as const;
export type MemberLevel = (typeof MEMBER_LEVELS)[number];

export const MEMBER_STYLES = [
  "进攻型","防守型","全能型","发球专精","技术细腻",
  "爆发力强","稳定均衡","跑动积极","战术灵活","队长领袖型",
] as const;
export type MemberStyle = (typeof MEMBER_STYLES)[number];

export const MEMBER_STATUSES = ["active", "left"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ACTIVITY_TYPES = ["training", "match"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ["draft", "published", "ended", "cancelled"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ATTENDANCE_RESPONSES = ["going", "not_going", "no_response"] as const;
export type AttendanceResponse = (typeof ATTENDANCE_RESPONSES)[number];

export const ACTUAL_ATTENDANCES = ["present", "absent", "pending"] as const;
export type ActualAttendance = (typeof ACTUAL_ATTENDANCES)[number];

export const SUMMARY_STAGES = ["none", "initial", "post_review"] as const;
export type SummaryStage = (typeof SUMMARY_STAGES)[number];

export const NOTIFICATION_TYPES = ["publish", "cancel", "reminder"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["pending", "success", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ASR_STATUSES = ["uploading", "transcribing", "succeeded", "failed"] as const;
export type AsrStatus = (typeof ASR_STATUSES)[number];

export const ASSISTANT_ROLES = ["ai", "captain"] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

// 队员资料 schema（创建/编辑/入队共用基础）
export const zMember = z.object({
  name: z.string().min(1).max(50),
  jerseyNumber: z.string().max(10).optional(),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  captainNote: z.string().max(100).optional(),
});

// H5 入队表单（无球衣号、无 captainNote、无 status）
export const zJoinForm = z.object({
  name: z.string().min(1).max(50),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
});
