import { z } from "zod";
export const zTrainingAdvice = z.object({ goal: z.string(), plan: z.string() });
export const zMatchAdvice = z.object({ strategy: z.string(), starting: z.string(), bench: z.string() });
export const zReviewTraining = z.object({ overall: z.string(), goalDone: z.string(), problems: z.string(), improvements: z.string() });
export const zReviewMatch = z.object({ overall: z.string(), problems: z.string(), improvements: z.string() });
export const zActivitySummary = z.object({ summary: z.string() });
export const zAssistant = z.object({ judgment: z.string(), basis: z.string() });
export const zMemberBot = z.object({ answer: z.string() });
