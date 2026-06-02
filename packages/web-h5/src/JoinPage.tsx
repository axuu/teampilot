import { useEffect, useState } from "react";
import { post } from "./api.js";
import { getJoinToken, type FeishuBridge } from "./feishu.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, positionLabel, levelLabel } from "@teampilot/shared";

type View = "loading" | "identity_failed" | "invalid_link" | "form" | "joined" | "contact_captain";

export default function JoinPage({ bridge }: { bridge: FeishuBridge }) {
  const [view, setView] = useState<View>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", primaryPosition: "", backupPosition: "", level: "", style: "" });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const token = getJoinToken();

  useEffect(() => {
    if (!token) { setView("invalid_link"); return; }
    void bridge.getCode().then((c) => { if (!c) setView("identity_failed"); else { setCode(c); setView("form"); } });
  }, []);

  async function submit() {
    setSubmitting(true); setErr("");
    try {
      const res = await post<{ status: string }>("/api/h5/join", { token, code, form: { name: f.name, primaryPosition: f.primaryPosition, backupPosition: f.backupPosition || undefined, level: f.level || undefined, style: f.style || undefined } });
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

  if (view === "loading") return <Center><p className="text-base text-ink-soft">加载中…</p></Center>;
  if (view === "identity_failed") return <Center><Hint>请在飞书内打开</Hint></Center>;
  if (view === "invalid_link") return <Center><Hint>链接无效，请联系队长获取正确链接</Hint></Center>;
  if (view === "contact_captain") return <Center><Hint>请联系队长处理</Hint></Center>;
  if (view === "joined")
    return (
      <Center>
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
        <p className="mb-1.5 text-lg font-bold text-ink">已加入球队</p>
        <p className="text-sm leading-relaxed text-ink-soft">请在飞书搜索并打开球队 Bot 会话一次，否则收不到活动通知。</p>
      </Center>
    );

  return (
    <div className="flex min-h-screen items-start justify-center p-4 sm:items-center">
      <div className="pine-card w-full max-w-md animate-pop-in p-6">
        <div className="mb-5 text-center">
          <h1 className="text-xl font-bold text-ink">加入球队</h1>
          <p className="mt-1 text-sm text-ink-soft">填写信息，提交后由队长确认</p>
        </div>
        <div className="space-y-[18px]">
          <div>
            <label className="field-label"><Req /> 姓名</label>
            <input aria-label="姓名" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="请填写" />
          </div>
          <div>
            <label className="field-label"><Req /> 擅长位置</label>
            <select aria-label="擅长位置" className="select-native" value={f.primaryPosition} onChange={(e) => set("primaryPosition", e.target.value)}>
              <option value="">请选择</option>{POSITIONS.map((p) => <option key={p} value={p}>{positionLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">备选位置</label>
            <select aria-label="备选位置" className="select-native" value={f.backupPosition} onChange={(e) => set("backupPosition", e.target.value)}>
              <option value="">请选择</option>{POSITIONS.map((p) => <option key={p} value={p}>{positionLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">水平</label>
            <select aria-label="水平" className="select-native" value={f.level} onChange={(e) => set("level", e.target.value)}>
              <option value="">请选择</option>{MEMBER_LEVELS.map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">风格</label>
            <select aria-label="风格" className="select-native" value={f.style} onChange={(e) => set("style", e.target.value)}>
              <option value="">请选择</option>{MEMBER_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {err && <p className="rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
          <button className="btn-primary" disabled={submitting || !f.name || !f.primaryPosition} onClick={() => void submit()}>{submitting ? "提交中…" : "申请加入球队"}</button>
        </div>
      </div>
    </div>
  );
}

const Req = () => <span className="text-danger">*</span>;

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-ink">{children}</p>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="pine-card flex max-w-sm animate-pop-in flex-col items-center px-7 py-9 text-center">{children}</div>
    </div>
  );
}
