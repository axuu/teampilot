import { useState } from "react";
import { post } from "../api.js";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setU] = useState(""); const [password, setP] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await post("/api/admin/login", { username, password }); onLoggedIn(); }
    catch (e) { setErr((e as Error).message || "账号或密码错误"); }
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-card border p-8 w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">Levin 的球队</h1>
        <label className="block text-sm">账号
          <input aria-label="账号" className="mt-1 w-full border rounded px-2 py-1" value={username} onChange={(e)=>setU(e.target.value)} placeholder="请填写" />
        </label>
        <label className="block text-sm">密码
          <input aria-label="密码" type="password" className="mt-1 w-full border rounded px-2 py-1" value={password} onChange={(e)=>setP(e.target.value)} placeholder="请填写" />
        </label>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full bg-blue-600 text-white rounded py-1.5">登录</button>
      </form>
    </div>
  );
}
