// Status badge — 5px radius, centered, shared min-width so a column of badges aligns.
// No dot prefix (per DESIGN). Tones use same-hue text on a soft tint for AA contrast.
type Tone = "brand" | "neutral" | "danger";

const tones: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  neutral: "bg-surface-soft text-ink-soft",
  danger: "bg-danger-soft text-danger",
};

export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex min-w-[56px] items-center justify-center rounded px-2 py-0.5 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
