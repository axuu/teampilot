// Renders AI summaries / reviews with the DESIGN doc-body system:
// chapter heading (brand bar hangs in the left margin) + 1.75-line paragraphs, capped at 680px.
export type DocSection = { heading?: string; body: string };

export default function DocBody({ sections }: { sections: DocSection[] }) {
  return (
    <div className="doc-body">
      {sections.map((s, i) => (
        <section key={i}>
          {s.heading && <h4 className="doc-h">{s.heading}</h4>}
          {s.body
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((p, j) => (
              <p key={j} className="doc-p">{p}</p>
            ))}
        </section>
      ))}
    </div>
  );
}
