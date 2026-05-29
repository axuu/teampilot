# 阶段1 前端实现计划（Plan B：队长后台 + 队员 H5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现阶段1 的两个前端 —— 队长后台 SPA（登录、布局、队员管理、活动管理、创建/编辑草稿、活动详情的概要与出勤 Tab）和队员入队 H5（表单 + 五种结果态）。消费 Plan A 的后端 API。

**Architecture:** 两个独立 Vite + React + Tailwind 应用。`web-admin` 用 react-router 做页面路由、一个薄 `api` fetch 封装、cookie 会话（`credentials:"include"`）。`web-h5` 单页、移动端、通过可注入的 `getFeishuCode()` 拿免登 code。组件测试用 Vitest + @testing-library/react + jsdom，API 用 fetch mock。

**Tech Stack:** React 19 · Vite 7 · TypeScript · TailwindCSS 3 · react-router-dom 6 · Vitest + @testing-library/react + jsdom

**前置**：Plan A 已完成（后端 API 可用）。**配套设计**：`docs/superpowers/specs/2026-05-29-ai-team-manager-design.md`（页面规格见 `...-product-spec.md` §5）。

**阶段边界**：本计划不含 配置页(⚙设置)、AI 队长助理 导航、活动详情"活动复盘"Tab 与 AI 建议区——这些依赖阶段3 后端，归 Plan D。本计划左侧导航只有「队员管理」「活动管理」。

---

## 文件结构

```
packages/
  web-admin/
    package.json  tsconfig.json  vite.config.ts  index.html
    tailwind.config.js  postcss.config.js  src/index.css
    src/
      main.tsx  App.tsx           # 路由 + 受保护布局
      api.ts                      # fetch 封装（credentials:include）
      auth/useAuth.tsx            # 登录态 context
      components/{Layout,Modal,Field,Toast}.tsx
      pages/{Login,Members,Activities,ActivityForm,ActivityDetail}.tsx
      pages/tabs/{SummaryTab,AttendanceTab}.tsx
    test/{login,members,activityForm,attendance}.test.tsx
  web-h5/
    package.json  tsconfig.json  vite.config.ts  index.html
    tailwind.config.js  postcss.config.js  src/index.css
    src/
      main.tsx  App.tsx
      api.ts  feishu.ts            # getFeishuCode()（可注入）
      JoinPage.tsx
    test/join.test.tsx
```

---

## Task 1: web-admin 脚手架（Vite + Tailwind + 路由 + 测试）

**Files:** Create `packages/web-admin/{package.json,tsconfig.json,vite.config.ts,index.html,tailwind.config.js,postcss.config.js}`, `packages/web-admin/src/{index.css,main.tsx,App.tsx,api.ts}`

- [ ] **Step 1: 写包与构建配置**

`packages/web-admin/package.json`:
```json
{
  "name": "@teampilot/web-admin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@teampilot/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/web-admin/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], globals: true },
} as any);
```

`packages/web-admin/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022","DOM","DOM.Iterable"], "types": ["node","vitest/globals","@testing-library/jest-dom"], "noEmit": true },
  "include": ["src","test"]
}
```

`packages/web-admin/tailwind.config.js`:
```js
export default { content: ["./index.html","./src/**/*.{ts,tsx}"], theme: { extend: { borderRadius: { card: "8px" } } }, plugins: [] };
```

`packages/web-admin/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`packages/web-admin/index.html`:
```html
<!doctype html><html lang="zh"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Levin 的球队</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```

`packages/web-admin/src/index.css`:
```css
@tailwind base; @tailwind components; @tailwind utilities;
body { @apply bg-gray-100 text-gray-900; }
```

- [ ] **Step 2: 写 api 封装与入口**

`packages/web-admin/src/api.ts`:
```ts
export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "content-type": "application/json", ...(opts.headers ?? {}) }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as any).error ?? "请求失败"), { status: res.status, body });
  return body as T;
}
export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, data?: unknown) => api<T>(p, { method: "POST", body: JSON.stringify(data ?? {}) });
export const put = <T>(p: string, data?: unknown) => api<T>(p, { method: "PUT", body: JSON.stringify(data ?? {}) });
```

`packages/web-admin/src/main.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import "./index.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
```

`packages/web-admin/src/App.tsx`（占位，Task 2 替换）:
```tsx
export default function App() { return <div>loading</div>; }
```

`packages/web-admin/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: 安装并验证构建**

Run: `pnpm install && pnpm --filter @teampilot/web-admin build`
Expected: 构建成功（产出 dist）。

- [ ] **Step 4: 提交**

```bash
git add packages/web-admin
git commit -m "chore(web-admin): scaffold vite+react+tailwind+router"
```

---

## Task 2: 登录页 + 登录态（useAuth）+ 受保护路由

**Files:** Create `packages/web-admin/src/auth/useAuth.tsx`, `packages/web-admin/src/pages/Login.tsx`, `packages/web-admin/test/login.test.tsx`; Modify `packages/web-admin/src/App.tsx`

- [ ] **Step 1: 写失败测试**

`packages/web-admin/test/login.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../src/pages/Login.js";

beforeEach(() => { vi.restoreAllMocks(); });

function mockFetch(status: number, body: object) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: status < 400, status, json: async () => body } as Response);
}

describe("Login", () => {
  it("shows unified error on failed login", async () => {
    mockFetch(401, { error: "账号或密码错误" });
    render(<MemoryRouter><Login onLoggedIn={() => {}} /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("账号"), "Levin");
    await userEvent.type(screen.getByLabelText("密码"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("账号或密码错误")).toBeInTheDocument();
  });
  it("calls onLoggedIn on success", async () => {
    mockFetch(200, { ok: true });
    const onLoggedIn = vi.fn();
    render(<MemoryRouter><Login onLoggedIn={onLoggedIn} /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("账号"), "Levin");
    await userEvent.type(screen.getByLabelText("密码"), "change-me");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(onLoggedIn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-admin test login`
Expected: FAIL（Login 未实现）。

- [ ] **Step 3: 写实现**

`packages/web-admin/src/pages/Login.tsx`:
```tsx
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
```

`packages/web-admin/src/auth/useAuth.tsx`:
```tsx
import { createContext, useContext, useEffect, useState } from "react";
import { get, post } from "../api.js";

type AuthState = { me: { displayName: string } | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<{ displayName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  async function refresh() { try { setMe(await get("/api/admin/me")); } catch { setMe(null); } finally { setLoading(false); } }
  async function logout() { await post("/api/admin/logout"); setMe(null); }
  useEffect(() => { void refresh(); }, []);
  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
```

`packages/web-admin/src/App.tsx`:
```tsx
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/useAuth.js";
import Login from "./pages/Login.js";
import Layout from "./components/Layout.js";
import Members from "./pages/Members.js";
import Activities from "./pages/Activities.js";
import ActivityForm from "./pages/ActivityForm.js";
import ActivityDetail from "./pages/ActivityDetail.js";

function Shell() {
  const { me, loading, refresh } = useAuth();
  const nav = useNavigate();
  if (loading) return <div className="p-8">加载中…</div>;
  if (!me) return <Login onLoggedIn={() => { void refresh().then(() => nav("/activities")); }} />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/activities" replace />} />
        <Route path="/members" element={<Members />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/new" element={<ActivityForm />} />
        <Route path="/activities/:id/edit" element={<ActivityForm />} />
        <Route path="/activities/:id" element={<ActivityDetail />} />
      </Routes>
    </Layout>
  );
}
export default function App() { return <AuthProvider><Shell /></AuthProvider>; }
```

- [ ] **Step 4: 运行确认通过（Login 测试）+ 提交**

Run: `pnpm --filter @teampilot/web-admin test login`
Expected: PASS（2 passed）。后续页面组件在下一任务建立，App 此刻可能因缺少页面文件无法构建——下个任务补齐。
```bash
git add packages/web-admin/src/auth packages/web-admin/src/pages/Login.tsx packages/web-admin/src/App.tsx packages/web-admin/test/login.test.tsx
git commit -m "feat(web-admin): login page + auth context + protected routes"
```

---

## Task 3: 布局组件（顶部栏 + 左导航）+ 通用 Modal/Toast

**Files:** Create `packages/web-admin/src/components/{Layout,Modal,Toast}.tsx`

- [ ] **Step 1: 写实现（纯展示，手动视觉校验）**

`packages/web-admin/src/components/Layout.tsx`:
```tsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const link = (to: string, label: string) => (
    <NavLink to={to} className={({ isActive }) => `block px-4 py-2 rounded ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}>{label}</NavLink>
  );
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 bg-white border-b flex items-center justify-between px-6">
        <span className="font-bold">Levin 的球队</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{me?.displayName}</span>
          <button onClick={() => void logout()} className="text-gray-500">退出登录</button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-48 bg-white border-r p-2 space-y-1">
          {link("/members", "队员管理")}
          {link("/activities", "活动管理")}
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

`packages/web-admin/src/components/Modal.tsx`:
```tsx
export default function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-card w-[560px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
```

`packages/web-admin/src/components/Toast.tsx`:
```tsx
import { createContext, useContext, useState, useCallback } from "react";
const Ctx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2000); }, []);
  return <Ctx.Provider value={show}>{children}{msg && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded text-sm">{msg}</div>}</Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
```

在 `App.tsx` 用 `ToastProvider` 包住 `AuthProvider`：
```tsx
import { ToastProvider } from "./components/Toast.js";
export default function App() { return <ToastProvider><AuthProvider><Shell /></AuthProvider></ToastProvider>; }
```

- [ ] **Step 2: 手动视觉校验**

Run: `pnpm --filter @teampilot/web-admin dev`（需后端在 :3000 + 已 seed）
Expected: 登录后见顶部栏「Levin 的球队 / Levin / 退出登录」+ 左导航「队员管理 / 活动管理」，默认落地 /activities。

- [ ] **Step 3: 提交**

```bash
git add packages/web-admin/src/components packages/web-admin/src/App.tsx
git commit -m "feat(web-admin): layout shell, modal, toast"
```

---

## Task 4: 队员管理页（列表 + 筛选 + 邀请弹框 + 编辑弹框）

**Files:** Create `packages/web-admin/src/pages/Members.tsx`, `packages/web-admin/test/members.test.tsx`

- [ ] **Step 1: 写失败测试**

`packages/web-admin/test/members.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Members from "../src/pages/Members.js";
import { ToastProvider } from "../src/components/Toast.js";

const members = [
  { id: "m1", name: "甲", jerseyNumber: "7", primaryPosition: "tekong", backupPosition: null, level: "advanced", style: "进攻型", status: "active", captainNote: "" },
];
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).includes("/api/admin/members")) return { ok: true, status: 200, json: async () => members } as Response;
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

function renderPage() { return render(<ToastProvider><MemoryRouter><Members /></MemoryRouter></ToastProvider>); }

describe("Members", () => {
  it("renders members and the invite button", async () => {
    renderPage();
    expect(await screen.findByText("甲")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "邀请队员" })).toBeInTheDocument();
  });
  it("invite modal copies the fixed link", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "邀请队员" }));
    await userEvent.click(screen.getByRole("button", { name: "复制链接" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
  it("edit modal shows captainNote remaining counter", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const note = screen.getByLabelText("队长备注");
    await userEvent.type(note, "好");
    expect(within(screen.getByTestId("note-field")).getByText(/剩余\s*99/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-admin test members`
Expected: FAIL（Members 未实现）。

- [ ] **Step 3: 写实现**

`packages/web-admin/src/pages/Members.tsx`:
```tsx
import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import Modal from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, MEMBER_STATUSES } from "@teampilot/shared";

type Member = { id: string; name: string; jerseyNumber: string | null; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; status: string; captainNote: string | null };
const JOIN_LINK = `${location.origin.replace(":5173", ":5174")}/?t=fixed-join-token-001`; // 与后端 TEAM_JOIN_TOKEN 一致

export default function Members() {
  const toast = useToast();
  const [rows, setRows] = useState<Member[]>([]);
  const [status, setStatus] = useState(""); const [position, setPosition] = useState("");
  const [invite, setInvite] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  async function load() {
    const q = new URLSearchParams(); if (status) q.set("status", status); if (position) q.set("position", position);
    setRows(await get(`/api/admin/members?${q}`));
  }
  useEffect(() => { void load(); }, [status, position]);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">队员管理</h1>
        <button className="bg-blue-600 text-white rounded px-3 py-1.5" onClick={() => setInvite(true)}>邀请队员</button>
      </div>
      <div className="flex gap-3 mb-3 text-sm">
        <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">全部状态</option>{MEMBER_STATUSES.map((s)=><option key={s} value={s}>{s==="active"?"正常":"离队"}</option>)}
        </select>
        <select className="border rounded px-2 py-1" value={position} onChange={(e)=>setPosition(e.target.value)}>
          <option value="">全部位置</option>{POSITIONS.map((p)=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["姓名","球衣号","主要位置","备选位置","水平","风格","状态","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((m)=>(
          <tr key={m.id} className="border-b">
            <td className="p-2">{m.name}</td><td className="p-2">{m.jerseyNumber ?? "-"}</td><td className="p-2">{m.primaryPosition}</td>
            <td className="p-2">{m.backupPosition ?? "-"}</td><td className="p-2">{m.level ?? "-"}</td><td className="p-2">{m.style ?? "-"}</td>
            <td className="p-2">{m.status==="active"?"正常":"离队"}</td>
            <td className="p-2"><button className="text-blue-600" onClick={()=>setEditing(m)}>编辑</button></td>
          </tr>))}
        </tbody>
      </table>

      {invite && (
        <Modal title="邀请队员入队" onClose={()=>setInvite(false)}
          footer={<><button className="border rounded px-3 py-1" onClick={()=>setInvite(false)}>关闭</button>
            <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={async()=>{await navigator.clipboard.writeText(JOIN_LINK); toast("已复制链接");}}>复制链接</button></>}>
          <p className="text-sm text-gray-600">请将以下链接在飞书中发给同学。同学可在此页面填写信息并申请入队：</p>
          <code className="block bg-gray-100 p-2 rounded text-xs break-all">{JOIN_LINK}</code>
        </Modal>
      )}

      {editing && <EditMember m={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); void load(); toast("已保存");}} />}
    </div>
  );
}

function EditMember({ m, onClose, onSaved }: { m: Member; onClose: ()=>void; onSaved: ()=>void }) {
  const [f, setF] = useState({ ...m, jerseyNumber: m.jerseyNumber ?? "", backupPosition: m.backupPosition ?? "", level: m.level ?? "", style: m.style ?? "", captainNote: m.captainNote ?? "" });
  const set = (k: string, v: string) => setF((p)=>({ ...p, [k]: v }));
  async function save() {
    await put(`/api/admin/members/${m.id}`, {
      name: f.name, jerseyNumber: f.jerseyNumber || undefined, primaryPosition: f.primaryPosition,
      backupPosition: f.backupPosition || undefined, level: f.level || undefined, style: f.style || undefined,
      status: f.status, captainNote: f.captainNote || undefined,
    });
    onSaved();
  }
  return (
    <Modal title="编辑队员" onClose={onClose}
      footer={<><button className="border rounded px-3 py-1" onClick={onClose}>取消</button><button className="bg-blue-600 text-white rounded px-3 py-1" onClick={()=>void save()}>保存</button></>}>
      <input aria-label="姓名" className="w-full border rounded px-2 py-1" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="请填写" />
      <input aria-label="球衣号" className="w-full border rounded px-2 py-1" value={f.jerseyNumber} onChange={(e)=>set("jerseyNumber",e.target.value)} placeholder="请填写" />
      <select aria-label="主要位置" className="w-full border rounded px-2 py-1" value={f.primaryPosition} onChange={(e)=>set("primaryPosition",e.target.value)}>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
      <select aria-label="备选位置" className="w-full border rounded px-2 py-1" value={f.backupPosition} onChange={(e)=>set("backupPosition",e.target.value)}><option value="">请选择</option>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
      <select aria-label="水平" className="w-full border rounded px-2 py-1" value={f.level} onChange={(e)=>set("level",e.target.value)}><option value="">请选择</option>{MEMBER_LEVELS.map(l=><option key={l} value={l}>{l}</option>)}</select>
      <select aria-label="风格" className="w-full border rounded px-2 py-1" value={f.style} onChange={(e)=>set("style",e.target.value)}><option value="">请选择</option>{MEMBER_STYLES.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select aria-label="状态" className="w-full border rounded px-2 py-1" value={f.status} onChange={(e)=>set("status",e.target.value)}>{MEMBER_STATUSES.map(s=><option key={s} value={s}>{s==="active"?"正常":"离队"}</option>)}</select>
      <div data-testid="note-field">
        <label className="block text-sm">队长备注</label>
        <textarea aria-label="队长备注" maxLength={100} className="w-full border rounded px-2 py-1" value={f.captainNote} onChange={(e)=>set("captainNote",e.target.value)} placeholder="请填写" />
        <span className="text-xs text-gray-400">剩余 {100 - f.captainNote.length}</span>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/web-admin test members`
Expected: PASS（3 passed）。
```bash
git add packages/web-admin/src/pages/Members.tsx packages/web-admin/test/members.test.tsx
git commit -m "feat(web-admin): members page (list/filter/invite/edit)"
```

---

## Task 5: 活动管理页（列表 + 筛选 + 派生列）

**Files:** Create `packages/web-admin/src/pages/Activities.tsx`

- [ ] **Step 1: 写实现（消费后端派生列 attendanceSummary/reviewStatus）**

`packages/web-admin/src/pages/Activities.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api.js";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES } from "@teampilot/shared";

type Row = { id: string; name: string; type: string; startTime: string; location: string; status: string; attendanceSummary: string; reviewStatus: string };
const typeLabel = (t: string) => (t === "training" ? "训练" : "比赛");
const statusLabel: Record<string,string> = { draft:"草稿", published:"已发布", ended:"已结束", cancelled:"已取消" };

export default function Activities() {
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState(""); const [status, setStatus] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(); if (type) q.set("type", type); if (status) q.set("status", status);
    void get<Row[]>(`/api/admin/activities?${q}`).then(setRows);
  }, [type, status]);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">活动管理</h1>
        <Link to="/activities/new" className="bg-blue-600 text-white rounded px-3 py-1.5">创建活动</Link>
      </div>
      <div className="flex gap-3 mb-3 text-sm">
        <select className="border rounded px-2 py-1" value={type} onChange={(e)=>setType(e.target.value)}><option value="">全部类型</option>{ACTIVITY_TYPES.map(t=><option key={t} value={t}>{typeLabel(t)}</option>)}</select>
        <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">全部状态</option>{ACTIVITY_STATUSES.map(s=><option key={s} value={s}>{statusLabel[s]}</option>)}</select>
      </div>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["活动名称","类型","时间","地点","状态","出勤概况","复盘状态","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((a)=>(
          <tr key={a.id} className="border-b">
            <td className="p-2">{a.name}</td><td className="p-2">{typeLabel(a.type)}</td>
            <td className="p-2">{new Date(a.startTime).toLocaleString("zh-CN")}</td><td className="p-2">{a.location}</td>
            <td className="p-2">{statusLabel[a.status]}</td><td className="p-2">{a.attendanceSummary}</td><td className="p-2">{a.reviewStatus}</td>
            <td className="p-2"><Link className="text-blue-600" to={`/activities/${a.id}`}>详情</Link></td>
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 手动视觉校验 + 提交**

Run: `pnpm --filter @teampilot/web-admin dev` → 访问 /activities，确认筛选与列展示。
```bash
git add packages/web-admin/src/pages/Activities.tsx
git commit -m "feat(web-admin): activities list with filters + derived columns"
```

---

## Task 6: 创建/编辑草稿活动页（信息表单 + 参与人 + 发布确认）

**Files:** Create `packages/web-admin/src/pages/ActivityForm.tsx`, `packages/web-admin/test/activityForm.test.tsx`

- [ ] **Step 1: 写失败测试**

`packages/web-admin/test/activityForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ActivityForm from "../src/pages/ActivityForm.js";
import { ToastProvider } from "../src/components/Toast.js";

const activeMembers = [{ id:"m1", name:"甲", jerseyNumber:"7", primaryPosition:"tekong", backupPosition:null, level:null, style:null, status:"active" }];
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.includes("/api/admin/members")) return { ok:true, status:200, json: async()=>activeMembers } as Response;
    if (u.endsWith("/api/admin/activities") && init?.method==="POST") return { ok:true, status:200, json: async()=>({ id:"a1" }) } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});
function renderNew() {
  return render(<ToastProvider><MemoryRouter initialEntries={["/activities/new"]}><Routes><Route path="/activities/new" element={<ActivityForm />} /><Route path="/activities/:id" element={<div>详情页</div>} /></Routes></MemoryRouter></ToastProvider>);
}

describe("ActivityForm", () => {
  it("preselects all active members", async () => {
    renderNew();
    expect(await screen.findByLabelText("参加-甲")).toBeChecked();
  });
  it("publish opens confirm dialog requiring required fields", async () => {
    renderNew();
    await userEvent.type(screen.getByLabelText("活动名称"), "周日训练");
    await userEvent.click(screen.getByLabelText("类型-训练"));
    await userEvent.type(screen.getByLabelText("开始时间"), "2026-06-01T14:30");
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("是否要发布活动？")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-admin test activityForm`
Expected: FAIL（ActivityForm 未实现）。

- [ ] **Step 3: 写实现**

`packages/web-admin/src/pages/ActivityForm.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, put } from "../api.js";
import Modal from "../components/Modal.js";
import { useToast } from "../components/Toast.js";

type Member = { id:string; name:string; jerseyNumber:string|null; primaryPosition:string; backupPosition:string|null; level:string|null; style:string|null; status:string };

export default function ActivityForm() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast();
  const [name,setName]=useState(""); const [type,setType]=useState(""); const [startTime,setStart]=useState("");
  const [duration,setDuration]=useState(120); const [location,setLocation]=useState(""); const [theme,setTheme]=useState(""); const [notes,setNotes]=useState("");
  const [members,setMembers]=useState<Member[]>([]); const [selected,setSelected]=useState<Set<string>>(new Set());
  const [confirm,setConfirm]=useState(false); const [err,setErr]=useState("");

  useEffect(() => {
    void get<Member[]>("/api/admin/members?status=active").then((ms)=>{ setMembers(ms); if(!id) setSelected(new Set(ms.map(m=>m.id))); });
    void get<any>("/api/admin/settings").then((s)=>{ if(!id && s?.defaultLocation) setLocation(s.defaultLocation); }).catch(()=>{});
  }, [id]);

  const payload = () => ({ name, type, startTime: startTime ? new Date(startTime).toISOString() : "", durationMinutes: duration, location, theme: theme||undefined, notes: notes||undefined, participantIds: [...selected] });
  const requiredOk = name && type && startTime && duration && location;
  const past = startTime && new Date(startTime).getTime() < Date.now();

  async function saveDraft() {
    const res = id ? await put<any>(`/api/admin/activities/${id}`, payload()) : await post<any>("/api/admin/activities", payload());
    toast("已保存草稿"); nav(`/activities/${id ?? res.id}`);
  }
  async function doPublish() {
    const res = id ? { id } : await post<any>("/api/admin/activities", payload());
    await post(`/api/admin/activities/${res.id}/publish`);
    setConfirm(false); nav(`/activities/${res.id}`);
  }
  function onPublishClick() { if(!requiredOk){ setErr("请填写所有必填项"); return; } setErr(""); setConfirm(true); }

  const toggle = (mid:string) => setSelected((p)=>{ const n=new Set(p); n.has(mid)?n.delete(mid):n.add(mid); return n; });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">{id ? "编辑活动" : "创建活动"}</h1>
      <h2 className="font-semibold border-b pb-1 mb-3">活动信息</h2>
      <div className="space-y-3 text-sm">
        <div><label><span className="text-red-600">*</span> 活动名称</label><input aria-label="活动名称" className="block w-80 border rounded px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="请填写" /></div>
        <div><label><span className="text-red-600">*</span> 活动类型</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-1"><input aria-label="类型-训练" type="radio" name="type" checked={type==="training"} onChange={()=>setType("training")} />训练</label>
            <label className="flex items-center gap-1"><input aria-label="类型-比赛" type="radio" name="type" checked={type==="match"} onChange={()=>setType("match")} />比赛</label>
          </div>
        </div>
        <div><label><span className="text-red-600">*</span> 开始时间</label><input aria-label="开始时间" type="datetime-local" className="block w-64 border rounded px-2 py-1" value={startTime} onChange={(e)=>setStart(e.target.value)} /></div>
        <div><label><span className="text-red-600">*</span> 预计时长（分钟）</label><input aria-label="预计时长" type="number" className="block w-40 border rounded px-2 py-1" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} /></div>
        <div><label><span className="text-red-600">*</span> 活动地点</label><input aria-label="活动地点" className="block w-80 border rounded px-2 py-1" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="请填写" /></div>
        <div><label>活动主题</label><textarea className="block w-full border rounded px-2 py-1 h-24" value={theme} onChange={(e)=>setTheme(e.target.value)} placeholder="请填写" /></div>
        <div><label>注意事项</label><textarea className="block w-full border rounded px-2 py-1 h-24" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="请填写" /></div>
      </div>

      <h2 className="font-semibold border-b pb-1 mt-6 mb-3">参加人员</h2>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["选","姓名","球衣号","主要位置","备选位置","水平","风格","状态"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{members.map((m)=>(
          <tr key={m.id} className="border-b">
            <td className="p-2"><input aria-label={`参加-${m.name}`} type="checkbox" checked={selected.has(m.id)} onChange={()=>toggle(m.id)} /></td>
            <td className="p-2">{m.name}</td><td className="p-2">{m.jerseyNumber ?? "-"}</td><td className="p-2">{m.primaryPosition}</td>
            <td className="p-2">{m.backupPosition ?? "-"}</td><td className="p-2">{m.level ?? "-"}</td><td className="p-2">{m.style ?? "-"}</td><td className="p-2">正常</td>
          </tr>))}
        </tbody>
      </table>

      {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      <div className="mt-6 flex gap-2">
        <button className="border rounded px-3 py-1" onClick={()=>nav(-1)}>取消</button>
        <button className="border rounded px-3 py-1" onClick={()=>void saveDraft()}>保存草稿</button>
        <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={onPublishClick}>发布</button>
      </div>

      {confirm && (
        <Modal title="是否要发布活动？" onClose={()=>setConfirm(false)}
          footer={<><button className="border rounded px-3 py-1" onClick={()=>setConfirm(false)}>取消</button><button className="bg-blue-600 text-white rounded px-3 py-1" onClick={()=>void doPublish()}>确认发布</button></>}>
          <p className="text-sm text-gray-600">发布活动后，受邀请的队员将收到飞书通知。</p>
          {past && <p className="text-sm text-orange-600">注意：开始时间早于当前时间，确认仍要发布？</p>}
        </Modal>
      )}
    </div>
  );
}
```

> 注：`/api/admin/settings` 在 Plan A 未实现（配置/默认地点读取）。本任务对其做了 `.catch(()=>{})` 容错；地点默认值最终在 Plan D 的配置接口补齐，阶段1 队长手填地点即可。

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/web-admin test activityForm`
Expected: PASS（2 passed）。
```bash
git add packages/web-admin/src/pages/ActivityForm.tsx packages/web-admin/test/activityForm.test.tsx
git commit -m "feat(web-admin): create/edit draft activity + publish confirm"
```

---

## Task 7: 活动详情页（概要 Tab + 出勤 Tab + 操作按钮）

**Files:** Create `packages/web-admin/src/pages/ActivityDetail.tsx`, `packages/web-admin/src/pages/tabs/{SummaryTab,AttendanceTab}.tsx`, `packages/web-admin/test/attendance.test.tsx`

- [ ] **Step 1: 写失败测试（出勤标记）**

`packages/web-admin/test/attendance.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttendanceTab from "../src/pages/tabs/AttendanceTab.js";

const detail = {
  id:"a1", name:"训练", status:"ended",
  participants:[{ memberId:"m1", attendanceResponse:"going", actualAttendance:"pending", member:{ name:"甲", jerseyNumber:"7", primaryPosition:"tekong", backupPosition:null, level:null, style:null, status:"active", captainNote:"" } }],
};
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, status:200, json: async()=>({ ok:true }) } as Response);
});

describe("AttendanceTab", () => {
  it("marks a participant present", async () => {
    const onChanged = vi.fn();
    render(<AttendanceTab detail={detail as any} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "标记已到场" }));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/participants/m1/attendance"), expect.objectContaining({ method: "POST" }));
    expect(onChanged).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-admin test attendance`
Expected: FAIL（AttendanceTab 未实现）。

- [ ] **Step 3: 写实现**

`packages/web-admin/src/pages/tabs/SummaryTab.tsx`:
```tsx
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
```

`packages/web-admin/src/pages/tabs/AttendanceTab.tsx`:
```tsx
import { post } from "../../api.js";
type P = { memberId:string; attendanceResponse:string; actualAttendance:string|null; member:{ name:string; jerseyNumber:string|null; primaryPosition:string; backupPosition:string|null; level:string|null; style:string|null; status:string; captainNote:string|null } };
type Detail = { id:string; participants:P[] };
const resp: Record<string,string> = { going:"去", not_going:"不去", no_response:"未反馈" };
const act: Record<string,string> = { present:"已到场", absent:"未到场", pending:"待确认" };

export default function AttendanceTab({ detail, onChanged }: { detail: Detail; onChanged: ()=>void }) {
  async function mark(memberId:string, value:"present"|"absent") {
    await post(`/api/admin/activities/${detail.id}/participants/${memberId}/attendance`, { value });
    onChanged();
  }
  return (
    <table className="w-full bg-white rounded-card border text-sm">
      <thead><tr className="text-left text-gray-500 border-b">{["姓名","活动前反馈","实际到场","状态","号码","擅长位置","备选位置","水平","风格","队长备注","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
      <tbody>{detail.participants.map((p)=>(
        <tr key={p.memberId} className="border-b">
          <td className="p-2">{p.member.name}</td><td className="p-2">{resp[p.attendanceResponse]}</td>
          <td className="p-2">{p.actualAttendance ? act[p.actualAttendance] : "—"}</td>
          <td className="p-2">{p.member.status==="active"?"正常":"离队"}</td><td className="p-2">{p.member.jerseyNumber ?? "-"}</td>
          <td className="p-2">{p.member.primaryPosition}</td><td className="p-2">{p.member.backupPosition ?? "-"}</td>
          <td className="p-2">{p.member.level ?? "-"}</td><td className="p-2">{p.member.style ?? "-"}</td><td className="p-2">{p.member.captainNote || "-"}</td>
          <td className="p-2 whitespace-nowrap">
            <button className="text-blue-600 mr-2" onClick={()=>void mark(p.memberId,"present")}>标记已到场</button>
            <button className="text-gray-600" onClick={()=>void mark(p.memberId,"absent")}>标记未到场</button>
          </td>
        </tr>))}
      </tbody>
    </table>
  );
}
```

`packages/web-admin/src/pages/ActivityDetail.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post } from "../api.js";
import SummaryTab from "./tabs/SummaryTab.js";
import AttendanceTab from "./tabs/AttendanceTab.js";

export default function ActivityDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const [detail,setDetail]=useState<any>(null);
  const [tab,setTab]=useState<"summary"|"attendance"|"review">("summary");
  async function load(){ setDetail(await get(`/api/admin/activities/${id}`)); }
  useEffect(()=>{ void load(); },[id]);
  if(!detail) return <div>加载中…</div>;
  const s = detail.status;
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{detail.name}</h1>
        <div className="flex gap-2">
          {s==="draft" && <><button className="border rounded px-3 py-1" onClick={()=>nav(`/activities/${id}/edit`)}>编辑</button>
            <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={async()=>{await post(`/api/admin/activities/${id}/publish`); void load();}}>发布</button></>}
          {s==="published" && <button className="border rounded px-3 py-1" onClick={async()=>{const r=prompt("取消原因")??""; await post(`/api/admin/activities/${id}/cancel`,{reason:r}); void load();}}>取消活动</button>}
        </div>
      </div>
      <div className="flex gap-4 border-b mb-4 text-sm">
        {[["summary","活动概要"],["attendance","出勤情况"],["review","活动复盘"]].map(([k,label])=>(
          <button key={k} className={`pb-2 ${tab===k?"border-b-2 border-blue-600 text-blue-600":"text-gray-500"}`} onClick={()=>setTab(k as any)}>{label}</button>
        ))}
      </div>
      {tab==="summary" && <SummaryTab detail={detail} />}
      {tab==="attendance" && <AttendanceTab detail={detail} onChanged={()=>void load()} />}
      {tab==="review" && <p className="text-gray-400 text-sm">复盘功能将在阶段3 启用。</p>}
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/web-admin test attendance`
Expected: PASS（1 passed）。
```bash
git add packages/web-admin/src/pages/ActivityDetail.tsx packages/web-admin/src/pages/tabs packages/web-admin/test/attendance.test.tsx
git commit -m "feat(web-admin): activity detail (summary + attendance tabs + actions)"
```

---

## Task 8: web-h5 脚手架 + 飞书 code 获取封装

**Files:** Create `packages/web-h5/{package.json,tsconfig.json,vite.config.ts,index.html,tailwind.config.js,postcss.config.js}`, `packages/web-h5/src/{index.css,main.tsx,api.ts,feishu.ts}`

- [ ] **Step 1: 写配置（端口 5174）**

`packages/web-h5/package.json`:
```json
{
  "name": "@teampilot/web-h5",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite --port 5174", "build": "tsc -b && vite build", "test": "vitest run" },
  "dependencies": { "@teampilot/shared": "workspace:*", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0", "@testing-library/react": "^16.1.0", "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0", "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0", "jsdom": "^25.0.0", "postcss": "^8.4.0", "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0", "vite": "^7.0.0", "vitest": "^2.1.0"
  }
}
```

`packages/web-h5/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], globals: true },
} as any);
```

`packages/web-h5/tsconfig.json`：同 web-admin 的 tsconfig（复制其内容）。
`packages/web-h5/tailwind.config.js`、`postcss.config.js`、`src/index.css`：同 web-admin（复制）。
`packages/web-h5/index.html`：title 改「加入球队」，其余同 web-admin。
`packages/web-h5/test/setup.ts`：`import "@testing-library/jest-dom";`

- [ ] **Step 2: 写 api 与 feishu code 封装**

`packages/web-h5/src/api.ts`：复制 web-admin 的 `api.ts`（含 get/post）。

`packages/web-h5/src/feishu.ts`:
```ts
// 在飞书内通过 JSSDK 获取免登授权 code。可被测试注入替换。
export interface FeishuBridge { getCode(): Promise<string | null>; }

export const realFeishuBridge: FeishuBridge = {
  async getCode() {
    // 生产：经飞书网页应用免登流程拿 code（重定向授权或 JSSDK）。
    // 此处约定从 URL 参数 ?code= 读取（由免登重定向带回），无则视为非飞书环境。
    return new URLSearchParams(location.search).get("code");
  },
};

export function getJoinToken(): string {
  return new URLSearchParams(location.search).get("t") ?? "";
}
```

`packages/web-h5/src/main.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import JoinPage from "./JoinPage.js";
import { realFeishuBridge } from "./feishu.js";
import "./index.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><JoinPage bridge={realFeishuBridge} /></React.StrictMode>);
```

- [ ] **Step 3: 安装验证 + 提交**

Run: `pnpm install && pnpm --filter @teampilot/web-h5 build`（JoinPage 下个任务建，先放占位再构建，或本步仅 install）
```bash
git add packages/web-h5
git commit -m "chore(web-h5): scaffold + feishu code bridge"
```

---

## Task 9: 入队 H5 页面（表单 + 五种结果态 + Bot 引导）

**Files:** Create `packages/web-h5/src/JoinPage.tsx`, `packages/web-h5/test/join.test.tsx`

- [ ] **Step 1: 写失败测试**

`packages/web-h5/test/join.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JoinPage from "../src/JoinPage.js";
import type { FeishuBridge } from "../src/feishu.js";

const okBridge: FeishuBridge = { async getCode(){ return "ou_a"; } };
const failBridge: FeishuBridge = { async getCode(){ return null; } };
beforeEach(() => { vi.restoreAllMocks(); history.replaceState({}, "", "/?t=fixed-join-token-001&code=ou_a"); });

function mockJoin(status: string) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, status:200, json: async()=>({ status }) } as Response);
}

describe("JoinPage", () => {
  it("identity failure shows '请在飞书内打开'", async () => {
    render(<JoinPage bridge={failBridge} />);
    expect(await screen.findByText("请在飞书内打开")).toBeInTheDocument();
  });
  it("submits form and shows joined + Bot guidance on success (F2)", async () => {
    mockJoin("created");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
    expect(screen.getByText(/请在飞书.*打开.*Bot/)).toBeInTheDocument();
  });
  it("already joined shows joined", async () => {
    mockJoin("already_joined");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @teampilot/web-h5 test`
Expected: FAIL（JoinPage 未实现）。

- [ ] **Step 3: 写实现**

`packages/web-h5/src/JoinPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { post } from "./api.js";
import { getJoinToken, type FeishuBridge } from "./feishu.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES } from "@teampilot/shared";

type View = "loading" | "identity_failed" | "invalid_link" | "form" | "joined" | "contact_captain";

export default function JoinPage({ bridge }: { bridge: FeishuBridge }) {
  const [view, setView] = useState<View>("loading");
  const [code, setCode] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", primaryPosition: "", backupPosition: "", level: "", style: "" });
  const set = (k: string, v: string) => setF((p)=>({ ...p, [k]: v }));
  const token = getJoinToken();

  useEffect(() => {
    if (!token) { setView("invalid_link"); return; }
    void bridge.getCode().then((c) => { if (!c) setView("identity_failed"); else { setCode(c); setView("form"); } });
  }, []);

  async function submit() {
    const res = await post<{ status: string }>("/api/h5/join", { token, code, form: { name: f.name, primaryPosition: f.primaryPosition, backupPosition: f.backupPosition||undefined, level: f.level||undefined, style: f.style||undefined } });
    if (res.status === "created" || res.status === "already_joined") setView("joined");
    else if (res.status === "contact_captain") setView("contact_captain");
    else if (res.status === "identity_failed") setView("identity_failed");
    else setView("invalid_link");
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
        <button className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50" disabled={!f.name || !f.primaryPosition} onClick={()=>void submit()}>申请加入球队</button>
      </div>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-center p-6">{children}</div>;
}
```

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `pnpm --filter @teampilot/web-h5 test`
Expected: PASS（3 passed）。
```bash
git add packages/web-h5/src/JoinPage.tsx packages/web-h5/test/join.test.tsx
git commit -m "feat(web-h5): join form + five result states + bot guidance (F2)"
```

---

## Task 10: 前端全量回归 + 联调冒烟

**Files:** 无（验证）

- [ ] **Step 1: 跑前端测试 + 构建**

Run: `pnpm --filter @teampilot/web-admin test && pnpm --filter @teampilot/web-h5 test && pnpm -r build`
Expected: 全部 PASS，构建无类型错误。

- [ ] **Step 2: 三端联调冒烟**

启动后端（`pnpm --filter @teampilot/server dev`，已 seed）、`web-admin`(5173)、`web-h5`(5174)。
- admin：登录 → 队员管理（邀请弹框复制链接）→ 创建训练活动 → 发布 → 详情出勤 Tab 标记到场。
- h5：浏览器开 `http://localhost:5174/?t=fixed-join-token-001&code=ou_test` → 填表提交 → 见「已加入球队 + Bot 引导」→ 回 admin 队员管理见到新队员。
Expected: 入队闭环 + 活动数据闭环（不含飞书真机通知，那是 Plan C）跑通。

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "chore(web): phase-1 frontend regression green" || echo "nothing to commit"
```

---

## 实现注意事项

- **入队链接端口**：开发期 admin(5173) 与 h5(5174) 分端口；`Members.tsx` 的 `JOIN_LINK` 用了端口替换 hack，生产改为 `H5_BASE_URL`（由后端下发或构建注入），实现时按部署调整。
- **`/api/admin/settings` 未就绪**：ActivityForm 读默认地点做了容错；该接口与配置页在 Plan D 实现。
- **飞书免登 code**：`feishu.ts` 约定从 `?code=` 读取（免登重定向带回）；接真机时按所选免登方式（JSSDK / 重定向授权）替换 `realFeishuBridge.getCode`，不影响 JoinPage 与测试。
- 遵循根 CLAUDE.md：先写失败测试再实现；纯布局组件用手动视觉校验步骤；不顺手重构。

---

## 自检（spec coverage / 占位符 / 类型一致性）

**覆盖**（产品规格 §5 阶段1 部分）：登录页✓(T2) 顶栏+左导航✓(T3，⚙/AI助理属Plan D) 队员管理(列表/筛选/邀请复制/编辑+备注计数/风格下拉)✓(T4) 活动管理(筛选+派生列)✓(T5) 创建/编辑草稿(信息+参与人默认全选+发布确认+过期额外提示)✓(T6) 活动详情(概要+出勤Tab+按状态操作按钮)✓(T7) H5(表单+五态+Bot引导F2)✓(T8/T9)。验收 1/2/3/4/5/6/7/9(展示反馈只读)/10(无改反馈入口)/12/19(已结束/取消无操作按钮)✓。

**未覆盖（明确归属）**：配置页、AI 建议/复盘 Tab、AI 队长助理 → Plan D；飞书真机卡片/通知 → Plan C。已在文中标注，非占位符遗漏。

**占位符**：无 TBD/TODO；每个改代码步骤含完整代码与命令；纯展示组件给手动校验步骤。

**类型一致性**：`api.ts` 的 get/post/put 跨页面一致；`FeishuBridge.getCode` 在 T8 定义、T9 测试/页面复用；后端契约对齐 Plan A（`/api/admin/members`、`/api/admin/activities`、`?status=&type=`、`/publish`、`/cancel`、`/participants/:memberId/attendance`、`/api/h5/join` 的 `{token,code,form}` 与 `{status}` 返回）。
