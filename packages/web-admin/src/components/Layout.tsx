import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { Users, Calendar, Sparkle, Gear, Logout } from "./icons.js";

const NAV = [
  { to: "/members", label: "队员管理", Icon: Users },
  { to: "/activities", label: "活动管理", Icon: Calendar },
  { to: "/assistant", label: "AI 队长助理", Icon: Sparkle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const initial = (me?.displayName ?? "·").trim().charAt(0) || "·";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar sits directly on the gradient canvas — transparent, never a solid white rail */}
      <aside className="flex w-[224px] shrink-0 flex-col px-4 py-5">
        <Link to="/activities" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white shadow-card">
            <Sparkle size={18} />
          </span>
          <span className="truncate text-lg font-bold text-ink">Levin 的球队</span>
        </Link>

        <nav className="flex flex-col gap-1.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-full px-3.5 py-2 text-base transition-colors duration-150 ` +
                (isActive
                  ? "bg-white/75 font-bold text-ink shadow-[0_2px_8px_rgba(46,51,51,0.06)]"
                  : "text-ink-soft hover:bg-white/50 hover:text-ink")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? "text-brand" : ""} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">
              {initial}
            </span>
            <span className="truncate text-base font-medium text-ink">{me?.displayName}</span>
          </div>
          <div className="mt-1 flex gap-1">
            <Link
              to="/settings"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-white/50 hover:text-ink"
            >
              <Gear size={15} /> 设置
            </Link>
            <button
              onClick={() => void logout()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-white/50 hover:text-ink"
            >
              <Logout size={15} /> 退出登录
            </button>
          </div>
        </div>
      </aside>

      {/* Floating content card */}
      <main className="min-w-0 flex-1 py-4 pr-4">
        <div className="pine-card flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
