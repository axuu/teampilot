import { useEffect, useState, useRef } from "react";
import { get, post } from "../api.js";
import RobotAvatar from "../components/RobotAvatar.js";
import { Send } from "../components/icons.js";

type Msg = { role: string; content: string; createdAt: string };
const EXAMPLES = ["总结近一个月内的训练情况", "总结近一个月内队员出勤情况", "接下来的训练重点应放在哪里？"];
function renderContent(content: string) {
  try { const o = JSON.parse(content); if ((o as any).judgment) return `当前判断：${(o as any).judgment}\n判断依据：${(o as any).basis}`; } catch {}
  return content;
}
const fmtTime = (iso: string) => new Date(iso).toLocaleString("zh-CN");

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  async function load() { setMsgs(await get<Msg[]>("/api/admin/assistant/messages")); }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  async function send(question?: string) {
    const text = (question ?? q).trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setQ("");
    const askedAt = new Date().toISOString();
    setMsgs((prev) => [...prev, { role: "captain", content: text, createdAt: askedAt }]);
    try {
      const r = await post<object>("/api/admin/assistant/ask", { question: text });
      setMsgs((prev) => [...prev, { role: "ai", content: JSON.stringify(r), createdAt: new Date().toISOString() }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "ai", content: "⚠️ 生成失败，请稍后重试", createdAt: new Date().toISOString() }]);
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-176px)] max-w-chat flex-col">
      <h1 className="mb-3 text-lg font-semibold text-ink">AI 队长助理</h1>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface-card">
        {/* message list */}
        <div ref={listRef} className="flex-1 overflow-auto px-6 py-6">
          {msgs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="group mb-3"><RobotAvatar /></div>
              <p className="text-base font-medium text-ink">我是你的 AI 队长助理</p>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">问我球队的训练、出勤、复盘情况，或点下面的示例快速开始。</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {msgs.map((m, i) =>
                m.role === "ai" ? (
                  <div key={i} className="group relative max-w-[80%]">
                    <RobotAvatar className="absolute left-[18px] top-[-15px] z-[1]" />
                    <div className="whitespace-pre-wrap rounded-lg rounded-tl-md border border-brand-border bg-brand-soft px-4 pb-3 pt-5 text-base text-ink">
                      {renderContent(m.content)}
                    </div>
                    <div className="mt-1 text-xs text-ink-weak">{fmtTime(m.createdAt)}</div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-end self-end max-w-[80%]">
                    <div className="whitespace-pre-wrap rounded-lg rounded-tr-md border border-line bg-surface-soft px-4 py-3 text-base text-ink">
                      {m.content}
                    </div>
                    <div className="mt-1 text-xs text-ink-weak">{fmtTime(m.createdAt)}</div>
                  </div>
                ),
              )}
              {busy && (
                <div className="group relative max-w-[80%]">
                  <RobotAvatar className="absolute left-[18px] top-[-15px] z-[1]" />
                  <div className="rounded-lg rounded-tl-md border border-brand-border bg-brand-soft px-4 pb-3 pt-5">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* input bar */}
        <div className="border-t border-line px-6 py-4">
          <div className="mb-2.5 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                disabled={busy}
                onClick={() => void send(e)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand-border hover:bg-brand-soft hover:text-brand-hover disabled:opacity-50"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-stretch gap-2">
            <input
              aria-label="提问输入"
              className="h-11 flex-1 rounded border border-transparent bg-surface-soft px-4 text-base text-ink placeholder:text-ink-weak transition-colors focus:border-brand focus:bg-white focus:outline-none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); void send(); } }}
              placeholder="输入你的问题，按 Enter 发送"
            />
            <button
              aria-label="发送"
              className="grid h-11 w-11 shrink-0 place-items-center rounded bg-brand text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
              disabled={busy}
              onClick={() => void send()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
