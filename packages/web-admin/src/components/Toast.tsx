import { createContext, useContext, useState, useRef, useCallback } from "react";
const Ctx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), 2000);
  }, []);
  return <Ctx.Provider value={show}>{children}{msg && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded text-sm">{msg}</div>}</Ctx.Provider>;
}
export const useToast = () => useContext(Ctx);
