import { prisma } from "../db/client.js";
import type { AsrProvider } from "./provider.js";

const ALLOWED = ["mp3", "wav", "ogg", "m4a"];

// 同步转写一个上传的音频文件，并把转写文本追加到该活动的复盘记录(rawNotes)。返回转写文本。
export async function transcribeToReview(activityId: string, fileName: string, bytes: Buffer, provider: AsrProvider): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext)) throw new Error("unsupported_format");
  const { text } = await provider.transcribe(bytes, ext);
  // 原子追加：读 rawNotes、拼接（标题行 + 正文）、写回
  await prisma.$transaction(async (tx) => {
    const review = await tx.activityReview.upsert({
      where: { activityId },
      update: {},
      create: { activityId, rawNotes: "" },
    });
    const block = `${review.rawNotes ? review.rawNotes + "\n\n" : ""}${fileName} 转写内容\n${text}`;
    await tx.activityReview.update({ where: { activityId }, data: { rawNotes: block } });
  });
  return text;
}
