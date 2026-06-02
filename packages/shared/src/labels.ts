import type { Position, MemberLevel } from "./enums.js";

export const POSITION_LABELS: Record<Position, string> = { tekong: "发球手", feeder: "二传手", striker: "攻球手" };
export const LEVEL_LABELS: Record<MemberLevel, string> = { novice: "新手", intermediate: "中等", upper: "中上", advanced: "高水平" };

export const positionLabel = (v: string | null | undefined): string => (v ? (POSITION_LABELS[v as Position] ?? v) : "");
export const levelLabel = (v: string | null | undefined): string => (v ? (LEVEL_LABELS[v as MemberLevel] ?? v) : "");
