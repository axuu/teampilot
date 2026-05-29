import { prisma } from "../db/client.js";
import type { z } from "zod";
import type { zMemberUpdate } from "./schema.js";

export function listMembers(filter: { status?: string; position?: string }) {
  return prisma.member.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.position ? { primaryPosition: filter.position } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export function updateMember(id: string, data: z.infer<typeof zMemberUpdate>) {
  return prisma.member.update({ where: { id }, data });
}
