import { Check } from "./icons.js";

type RadioProps = { checked: boolean; onChange: () => void; name: string; ariaLabel: string; children?: React.ReactNode };
export function Radio({ checked, onChange, name, ariaLabel, children }: RadioProps) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 text-base text-ink">
      <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
        <input type="radio" name={name} aria-label={ariaLabel} checked={checked} onChange={onChange} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full border-[1.5px] border-ink-weak bg-white transition-colors duration-150 group-hover:border-brand peer-checked:border-2 peer-checked:border-brand" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-0 transition-opacity duration-150 peer-checked:opacity-100" />
      </span>
      {children}
    </label>
  );
}

type CheckboxProps = { checked: boolean; onChange: () => void; ariaLabel: string; className?: string };
export function Checkbox({ checked, onChange, ariaLabel, className = "" }: CheckboxProps) {
  return (
    <label className={`group relative inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center ${className}`}>
      <input type="checkbox" aria-label={ariaLabel} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="absolute inset-0 rounded border-[1.5px] border-ink-weak bg-white transition-colors duration-150 group-hover:border-brand peer-checked:border-brand peer-checked:bg-brand" />
      <Check size={12} className="relative text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100" />
    </label>
  );
}
