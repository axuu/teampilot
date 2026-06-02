import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "./icons.js";

// Custom dropdown (DESIGN: avoid native <select>). Trigger looks like an input;
// menu is absolute, min-width:100%, options are a flex column with gap so hover
// backgrounds never touch. Keyboard: ↑/↓ move, Enter select, Esc close; click-outside closes.
export type Option = { value: string; label: string };

export default function Select({
  value,
  onChange,
  options,
  placeholder = "请选择",
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setActive(options.findIndex((o) => o.value === value));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const n = options.length;
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (active >= 0) commit(active);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex h-8 w-full items-center justify-between gap-2 rounded border bg-white px-3 text-base transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/25
          ${open ? "border-brand ring-2 ring-brand/25" : "border-line hover:border-brand/60"}
          ${selected ? "text-ink" : "text-ink-weak"}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-dropdown mt-1 flex max-h-64 min-w-full flex-col gap-0.5 overflow-auto rounded-md border border-line bg-white p-1 shadow-menu animate-menu-in"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <li key={o.value || "__placeholder"} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-base transition-colors
                    ${isSel ? "bg-brand-soft font-medium text-brand-ink" : isActive ? "bg-surface-soft text-ink" : "text-ink"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={15} className="shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
