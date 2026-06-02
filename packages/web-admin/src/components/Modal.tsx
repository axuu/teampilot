import { useEffect, useRef } from "react";

// Pine dialog. Soft ink scrim, 10px (md) / 20px (lg) radius, pop-in entrance, Esc to close.
// Title <h2> is a direct child of the panel div so `getByText(title).closest("div")` is the panel.
export default function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shape = size === "lg" ? "max-w-[760px] rounded-lg" : "max-w-[520px] rounded-md";
  return (
    <div className="fixed inset-0 z-backdrop flex items-center justify-center bg-ink/30 p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${shape} bg-white p-6 shadow-dialog outline-none animate-pop-in`}
      >
        <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
