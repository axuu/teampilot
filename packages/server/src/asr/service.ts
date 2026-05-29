import { prisma } from "../db/client.js";
import type { AsrProvider } from "./provider.js";

const ALLOWED = ["mp3", "wav", "m4a"];

export async function createAsrJob(activityId: string, fileName: string, bytes: Buffer, provider: AsrProvider) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext)) throw new Error("unsupported_format");
  const { tosUrl, taskId } = await provider.uploadAndSubmit(fileName, bytes);
  return prisma.asrJob.create({ data: { activityId, fileName, tosUrl, volcTaskId: taskId, status: "transcribing" } });
}

export async function pollAsrJobs(provider: AsrProvider) {
  const jobs = await prisma.asrJob.findMany({ where: { status: "transcribing" } });
  for (const job of jobs) {
    if (!job.volcTaskId) continue;
    const r = await provider.queryResult(job.volcTaskId);
    if (r.failed) { await prisma.asrJob.update({ where: { id: job.id }, data: { status: "failed", failReason: r.reason ?? "转写失败" } }); continue; }
    if (!r.done) continue;
    // 原子追加：读 rawNotes、拼接、写回、置 succeeded 都在一个事务内，
    // 避免事务失败后 job 仍 transcribing、下轮重复追加同一段转写。
    await prisma.$transaction(async (tx) => {
      const review = await tx.activityReview.upsert({ where: { activityId: job.activityId }, update: {}, create: { activityId: job.activityId, rawNotes: "" } });
      const block = `${review.rawNotes ? review.rawNotes + "\n\n" : ""}${job.fileName} 转写内容\n${r.text ?? ""}`;
      await tx.activityReview.update({ where: { activityId: job.activityId }, data: { rawNotes: block } });
      await tx.asrJob.update({ where: { id: job.id }, data: { status: "succeeded", transcript: r.text ?? "" } });
    });
  }
}
