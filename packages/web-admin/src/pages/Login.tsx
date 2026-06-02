import { useState } from "react";
import { post } from "../api.js";
import { Sparkle } from "../components/icons.js";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setU] = useState(""); const [password, setP] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/api/admin/login", { username, password }); onLoggedIn(); }
    catch (e) { setErr((e as Error).message || "账号或密码错误"); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="pine-card w-full max-w-[380px] animate-pop-in p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-md bg-brand text-white shadow-card">
            <Sparkle size={26} />
          </span>
          <h1 className="text-xl font-bold text-ink">Levin 的球队</h1>
          <p className="mt-1 text-sm text-ink-soft">队长后台 · 登录</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="login-user" className="field-label">账号</label>
            <input id="login-user" aria-label="账号" className="input" value={username} onChange={(e) => setU(e.target.value)} placeholder="请填写" />
          </div>
          <div>
            <label htmlFor="login-pass" className="field-label">密码</label>
            <input id="login-pass" aria-label="密码" type="password" className="input" value={password} onChange={(e) => setP(e.target.value)} placeholder="请填写" />
          </div>
          {err && <p className="rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
          <button className="btn-primary mt-1 w-full">登录</button>
        </div>
      </form>
    </div>
  );
}
