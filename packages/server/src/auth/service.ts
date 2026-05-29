import bcrypt from "bcryptjs";
import { prisma } from "../db/client.js";

export async function verifyCaptain(username: string, password: string) {
  const cap = await prisma.captain.findUnique({ where: { username } });
  if (!cap) return null;
  const ok = await bcrypt.compare(password, cap.passwordHash);
  return ok ? cap : null;
}
