import { useEffect, useState } from "react";
import { post } from "./api.js";
import { getJoinToken, type FeishuBridge } from "./feishu.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES } from "@teampilot/shared";

type View = "loading" | "identity_failed" | "invalid_link" | "form" | "joined" | "contact_captain";

export default function JoinPage({ bridge }: { bridge: FeishuBridge }) {
  const [view, setView] = useState<View>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", primaryPosition: "", backupPosition: "", level: "", style: "" });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((p)=>({ ...p, [k]: v }));
  const token = getJoinToken();

  useEffect(() => {
    if (!token) { setView("invalid_link"); return; }
    void bridge.getCode().then((c) => { if (!c) setView("identity_failed"); else { setCode(c); setView("form"); } });
  }, []);

  async function submit() {
    setSubmitting(true); setErr("");
    try {
      const res = await post<{ status: string }>("/api/h5/join", { token, code, form: { name: f.name, primaryPosition: f.primaryPosition, backupPosition: f.backupPosition||undefined, level: f.level||undefined, style: f.style||undefined } });
      if (res.status === "created" || res.status === "already_joined") setView("joined");
      else if (res.status === "contact_captain") setView("contact_captain");
      else if (res.status === "identity_failed") setView("identity_failed");
      else setView("invalid_link");
    } catch {
      setErr("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "loading") return <Center>加载中…</Center>;
  if (view === "identity_failed") return <Center>请在飞书内打开</Center>;
  if (view === "invalid_link") return <Center>链接无效，请联系队长获取正确链接</Center>;
  if (view === "contact_captain") return <Center>请联系队长处理</Center>;
  if (view === "joined") return <Center><p className="font-bold mb-2">已加入球队</p><p className="text-sm text-gray-500">请在飞书搜索并打开球队 Bot 会话一次，否则收不到活动通知。</p></Center>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-card p-4 max-w-md mx-auto space-y-3 text-sm">
        <h1 className="text-lg font-bold">加入球队</h1>
        <div><label><span className="text-red-600">*</span> 姓名</label><input aria-label="姓名" className="block w-full border rounded px-2 py-1" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="请填写" /></div>
        <div><label><span className="text-red-600">*</span> 擅长位置</label>
          <select aria-label="擅长位置" className="block w-full border rounded px-2 py-1" value={f.primaryPosition} onChange={(e)=>set("primaryPosition",e.target.value)}><option value="">请选择</option>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><label>备选位置</label><select aria-label="备选位置" className="block w-full border rounded px-2 py-1" value={f.backupPosition} onChange={(e)=>set("backupPosition",e.target.value)}><option value="">请选择</option>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><label>水平</label><select aria-label="水平" className="block w-full border rounded px-2 py-1" value={f.level} onChange={(e)=>set("level",e.target.value)}><option value="">请选择</option>{MEMBER_LEVELS.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
        <div><label>风格</label><select aria-label="风格" className="block w-full border rounded px-2 py-1" value={f.style} onChange={(e)=>set("style",e.target.value)}><option value="">请选择</option>{MEMBER_STYLES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50" disabled={submitting || !f.name || !f.primaryPosition} onClick={()=>void submit()}>{submitting ? "提交中…" : "申请加入球队"}</button>
      </div>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-center p-6">{children}</div>;
}
