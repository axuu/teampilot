import { z } from "zod";
import { ACTIVITY_TYPES } from "@teampilot/shared";

export const zActivityDraft = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ACTIVITY_TYPES),
  startTime: z.string().datetime(),
  durationMinutes: z.number().int().positive().optional(),
  location: z.string().min(1).optional(),
  theme: z.string().optional(),
  notes: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});
