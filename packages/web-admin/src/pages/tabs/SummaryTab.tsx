type Detail = { type:string; startTime:string; durationMinutes:number; location:string; theme:string|null; notes:string|null; summary:string|null };
export default function SummaryTab({ detail }: { detail: Detail }) {
  const end = new Date(new Date(detail.startTime).getTime() + detail.durationMinutes*60000);
  const fmt = (d: Date) => d.toLocaleString("zh-CN");
  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-400">{detail.type === "training" ? "训练活动" : "比赛活动"}</p>
      <p><b>时间</b> {fmt(new Date(detail.startTime))}–{end.toTimeString().slice(0,5)}</p>
      <p><b>地点</b> {detail.location}</p>
      <p><b>活动主题</b><br/>{detail.theme || "—"}</p>
      <p><b>注意事项</b><br/>{detail.notes || "—"}</p>
      {/* 训练/比赛建议区 + 活动总结区：阶段3（Plan D）补 */}
      <p className="text-gray-400">{detail.summary || "当前暂无活动总结"}</p>
    </div>
  );
}
