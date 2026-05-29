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
