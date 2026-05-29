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
