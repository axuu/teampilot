export interface AsrProvider {
  // 上传到 TOS 并向火山提交识别任务，返回 tosUrl + taskId
  uploadAndSubmit(fileName: string, bytes: Buffer): Promise<{ tosUrl: string; taskId: string }>;
  // 查询任务；done=false 表示仍在转写
  queryResult(taskId: string): Promise<{ done: boolean; text?: string; failed?: boolean; reason?: string }>;
}

// 真实实现：火山 TOS 上传 + 大模型录音文件识别（提交/查询）。具体 SDK 调用按火山文档实现。
export const volcAsrProvider: AsrProvider = {
  async uploadAndSubmit() { throw new Error("接入火山 TOS + 录音文件识别后实现"); },
  async queryResult() { throw new Error("接入火山录音文件识别后实现"); },
};
