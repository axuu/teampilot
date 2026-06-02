import { useEffect, useState } from "react";
import { get, post } from "../../api.js";

type Detail = { id: string; status: string; type:string; startTime:string; durationMinutes:number; location:string; theme:string|null; notes:string|null; summary:string|null; advice?:string|null };
function parseAdvice(raw: string | null | undefined) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export default function SummaryTab({ detail }: { detail: Detail }) {
  const end = new Date(new Date(detail.startTime).getTime() + detail.durationMinutes*60000);
  const fmt = (d: Date) => d.toLocaleString("zh-CN");

  const [notif, setNotif] = useState<{ success: number; failed: number } | null>(null);
  const [advice, setAdvice] = useState<any>(parseAdvice(detail.advice)); const [adviceBusy, setAdviceBusy] = useState(false);
  const adviceLabel = detail.type === "training" ? "训练建议" : "比赛建议";
  async function genAdvice() { setAdviceBusy(true); try { setAdvice(await post(`/api/admin/activities/${detail.id}/advice`)); } catch { /* ignore */ } finally { setAdviceBusy(false); } }
  useEffect(() => {
    if (detail.status === "draft") return;
    void get<{ success: number; failed: number }>(`/api/admin/activities/${detail.id}/notifications`).then(setNotif);
  }, [detail.id, detail.status]);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-400">{detail.type === "training" ? "训练活动" : "比赛活动"}</p>
      <p><b>时间</b> {fmt(new Date(detail.startTime))}–{end.toTimeString().slice(0,5)}</p>
      <p><b>地点</b> {detail.location}</p>
      <p><b>活动主题</b><br/>{detail.theme || "—"}</p>
      <p><b>注意事项</b><br/>{detail.notes || "—"}</p>
      <div className="border-t pt-3">
        <p className="font-semibold">🤖 {adviceLabel}</p>
        {!advice && <button className="text-blue-600 text-sm" disabled={adviceBusy} onClick={() => void genAdvice()}>{adviceBusy ? "生成中…" : `生成${adviceLabel}`}</button>}
        {advice && <><pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-2">{Object.values(advice).join("\n\n")}</pre><button className="text-blue-600 text-sm" onClick={() => void genAdvice()}>重新生成</button></>}
      </div>
      <div className="border-t pt-3"><p className="font-semibold">🤖 活动总结</p><p className="text-sm whitespace-pre-wrap">{detail.summary || <span className="text-gray-400">当前暂无活动总结</span>}</p></div>
      {notif && (
        <div className="border-t pt-3 mt-3 text-sm">
          <span className="text-gray-500">通知状态：</span>成功 {notif.success} / 失败 {notif.failed}
          {notif.failed > 0 && (
            <button className="ml-3 text-blue-600" onClick={async () => { const r = await post<{ success: number; failed: number }>(`/api/admin/activities/${detail.id}/notifications/retry`); setNotif(r); }}>重试失败通知</button>
          )}
        </div>
      )}
    </div>
  );
}
