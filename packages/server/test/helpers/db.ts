import { prisma } from "../../src/db/client.js";
export async function resetDb() {
  await prisma.notificationLog.deleteMany();
  await prisma.asrJob.deleteMany();
  await prisma.activityReview.deleteMany();
  await prisma.activityParticipant.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.member.deleteMany();
  await prisma.assistantMessage.deleteMany();
  await prisma.teamSettings.deleteMany();
  await prisma.captain.deleteMany();
}
