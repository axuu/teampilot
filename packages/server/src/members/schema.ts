import { z } from "zod";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, MEMBER_STATUSES } from "@teampilot/shared";

export const zMemberUpdate = z.object({
  name: z.string().min(1).max(50),
  jerseyNumber: z.string().max(10).optional(),
  primaryPosition: z.enum(POSITIONS),
  backupPosition: z.enum(POSITIONS).optional(),
  level: z.enum(MEMBER_LEVELS).optional(),
  style: z.enum(MEMBER_STYLES).optional(),
  status: z.enum(MEMBER_STATUSES),
  captainNote: z.string().max(100).optional(),
});
