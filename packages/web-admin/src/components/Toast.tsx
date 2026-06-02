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
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-toast -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-dialog animate-toast-in"
        >
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
