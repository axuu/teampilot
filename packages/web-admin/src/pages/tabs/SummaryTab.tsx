import { useEffect, useState } from "react";
import { get, post } from "../../api.js";
import DocBody, { type DocSection } from "../../components/DocBody.js";
import { Sparkle } from "../../components/icons.js";

type Detail = { id: string; status: string; type: string; startTime: string; durationMinutes: number; location: string; theme: string | null; notes: string | null; summary: string | null; advice?: string | null };

function parseAdvice(raw: string | null | undefined) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
// Chinese keys become chapter headings; opaque keys (goal/plan…) render as plain paragraphs.
function adviceSections(advice: Record<string, unknown>): DocSection[] {
  return Object.entries(advice)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => ({ heading: /[一-龥]/.test(k) ? k : undefined, body: String(v) }));
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-md border border-line bg-surface-soft/60 p-4">{children}</section>
);
const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2.5 flex items-center gap-1.5 text-base font-semibold text-ink"><Sparkle size={16} className="text-brand" />{children}</h3>
);

export default function SummaryTab({ detail }: { detail: Detail }) {
  const end = new Date(new Date(detail.startTime).getTime() + detail.durationMinutes * 60000);
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
    <div className="max-w-doc space-y-5">
      <dl className="space-y-1 text-base text-ink">
        <p><span className="text-ink-soft">类型：</span>{detail.type === "training" ? "训练活动" : "比赛活动"}</p>
        <p><span className="text-ink-soft">时间：</span>{fmt(new Date(detail.startTime))}–{end.toTimeString().slice(0, 5)}</p>
        <p><span className="text-ink-soft">地点：</span>{detail.location}</p>
        <p><span className="text-ink-soft">活动主题：</span>{detail.theme || "—"}</p>
        <p><span className="text-ink-soft">注意事项：</span>{detail.notes || "—"}</p>
      </dl>

      <Card>
        <CardTitle>{adviceLabel}</CardTitle>
        {!advice && <button className="btn-link" disabled={adviceBusy} onClick={() => void genAdvice()}>{adviceBusy ? "生成中…" : `生成${adviceLabel}`}</button>}
        {advice && <><DocBody sections={adviceSections(advice)} /><button className="btn-link mt-2 inline-block" onClick={() => void genAdvice()}>重新生成</button></>}
      </Card>

      <Card>
        <CardTitle>活动总结</CardTitle>
        {detail.summary
          ? <DocBody sections={[{ body: detail.summary }]} />
          : <p className="text-base text-ink-weak">当前暂无活动总结</p>}
      </Card>

      {notif && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-ink">
          <span className="text-ink-soft">通知状态：</span>{notif.success} 成功 ｜ {notif.failed} 失败
          {notif.failed > 0 && (
            <button className="btn-link" onClick={async () => { const r = await post<{ success: number; failed: number }>(`/api/admin/activities/${detail.id}/notifications/retry`); setNotif(r); }}>重试失败通知</button>
          )}
        </div>
      )}
    </div>
  );
}
