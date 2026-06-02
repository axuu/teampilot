import { useEffect, useState } from "react";
import { get, put, post } from "../../api.js";
import { useToast } from "../../components/Toast.js";

type Detail = { id: string; name: string; type: string; status: string };
const labelMap: Record<string, string> = { overall: "整体总结", goalDone: "目标完成情况", problems: "主要问题", improvements: "后续改进建议" };
function renderSummary(json: string | null) {
  if (!json) return null;
  try { const o = JSON.parse(json); return Object.entries(o).map(([k, v]) => `${labelMap[k] ?? k}：${v}`).join("\n"); } catch { return json; }
}

export default function ReviewTab({ detail }: { detail: Detail }) {
  const toast = useToast();
  const [rawNotes, setRaw] = useState(""); const [aiSummary, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  async function load() { const r = await get<any>(`/api/admin/activities/${detail.id}/review`); setRaw(r.rawNotes ?? ""); setAi(r.aiSummary ?? null); }
  useEffect(() => { void load(); }, [detail.id]);
  async function saveNotes() { await put(`/api/admin/activities/${detail.id}/review`, { rawNotes }); }
  async function generate() {
    setBusy(true); toast(`正在生成${detail.name}的复盘`);
    try { const r = await post<object>(`/api/admin/activities/${detail.id}/review/generate`); setAi(JSON.stringify(r)); }
    catch { toast("生成失败，请重试"); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setUploading(true); toast(`正在转写录音：${file.name}`);
    try {
      await saveNotes(); // 先把当前未失焦输入落库，后端转写在最新 rawNotes 末尾追加
      const res = await fetch(`/api/admin/activities/${detail.id}/review/transcribe?filename=${encodeURIComponent(file.name)}`, { method: "POST", credentials: "include", body: file });
      if (!res.ok) throw new Error("transcribe failed");
      await load(); // 转写文本已由后端追加到 rawNotes，重新拉取展示
      toast("转写完成");
    } catch {
      toast("转写失败，请重试");
    } finally {
      setUploading(false);
    }
  }
  const summaryText = renderSummary(aiSummary);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold mb-2">AI 复盘总结</h3>
        {!rawNotes.trim() && <p className="text-gray-400 text-sm">暂无复盘内容。在你填写复盘记录后，可以生成复盘。</p>}
        {rawNotes.trim() && !summaryText && <p className="text-sm">你可以根据"我的复盘记录"中的内容 <button className="text-blue-600" disabled={busy} onClick={() => void generate()}>生成复盘</button></p>}
        {summaryText && <><pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-3">{summaryText}</pre><button className="text-blue-600 text-sm mt-1" disabled={busy} onClick={() => void generate()}>重新生成</button></>}
      </section>
      <section>
        <h3 className="font-semibold mb-2">我的复盘记录</h3>
        <textarea className="w-full border rounded p-2 h-40" value={rawNotes} onChange={(e) => setRaw(e.target.value)} onBlur={() => void saveNotes()} placeholder="请填写" />
        <div className="mt-1">
          <label className={`text-sm ${uploading ? "text-gray-400" : "text-blue-600 cursor-pointer"}`}>
            + 转写录音
            <input type="file" accept=".mp3,.wav,.ogg,.m4a" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          </label>
        </div>
      </section>
    </div>
  );
}
