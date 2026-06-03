import { NavLink } from "react-router-dom";
import { Users, Calendar, Sparkle, Gear } from "./icons.js";

const ITEMS = [
  { to: "/members", label: "队员", Icon: Users },
  { to: "/activities", label: "活动", Icon: Calendar },
  { to: "/assistant", label: "助手", Icon: Sparkle },
  { to: "/settings", label: "设置", Icon: Gear },
];

export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-line bg-surface-card px-2.5 backdrop-blur-xl md:hidden">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${isActive ? "text-brand" : "text-ink-soft"}`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
