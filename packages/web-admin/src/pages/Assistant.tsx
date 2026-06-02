import { useEffect, useState, useRef } from "react";
import { get, post } from "../api.js";

type Msg = { role: string; content: string; createdAt: string };
const EXAMPLES = ["总结近一个月内的训练情况","总结近一个月内队员出勤情况","接下来的训练重点应放在哪里？"];
function renderContent(content: string) {
  try { const o = JSON.parse(content); if ((o as any).judgment) return `当前判断：${(o as any).judgment}\n判断依据：${(o as any).basis}`; } catch {}
  return content;
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  async function load() { setMsgs(await get<Msg[]>("/api/admin/assistant/messages")); }
  useEffect(() => { void load(); }, []);
  async function send(question?: string) {
    const text = (question ?? q).trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await post<object>("/api/admin/assistant/ask", { question: text });
      setQ("");
      const nowIso = new Date().toISOString();
      setMsgs((prev) => [...prev, { role: "captain", content: text, createdAt: nowIso }, { role: "ai", content: JSON.stringify(r), createdAt: nowIso }]);
    } finally { busyRef.current = false; setBusy(false); }
  }
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-3">AI 队长助理</h1>
      <div className="flex gap-2 mb-3 flex-wrap">{EXAMPLES.map((e)=><button key={e} className="text-xs border rounded px-2 py-1 text-gray-600 disabled:opacity-50" disabled={busy} onClick={()=>void send(e)}>{e}</button>)}</div>
      <div className="bg-white rounded border p-4 space-y-3 min-h-[300px] mb-3">
        {msgs.map((m,i)=>(
          <div key={i}>
            <div className="text-xs text-gray-400">{m.role==="ai"?"AI":"我"} {new Date(m.createdAt).toLocaleString("zh-CN")}</div>
            <div className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-2">{renderContent(m.content)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input aria-label="提问输入" className="flex-1 border rounded px-2 py-1" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(ev)=>{ if(ev.key==="Enter"){ ev.preventDefault(); void send(); } }} placeholder="请填写" />
        <button className="bg-blue-600 text-white rounded px-4 disabled:opacity-50" disabled={busy} onClick={()=>void send()}>发送</button>
      </div>
    </div>
  );
}
