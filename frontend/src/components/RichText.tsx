import type { ReactNode } from "react";

type Block = { kind: "title" | "p" | "li"; text: string };

// El text del tutor porta els títols entre dos asteriscs i els punts amb guionet: es converteix en blocs.
function parse(raw: string): Block[] {
  const out: Block[] = [];
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const title = /^(?:#+\s*)?\*\*(.+?)\*\*:?$/.exec(l) ?? /^#+\s*(.+?)\*{0,2}$/.exec(l);
    if (title) out.push({ kind: "title", text: title[1]!.replace(/\*+/g, "").trim() });
    else if (/^[-•*]\s+/.test(l)) out.push({ kind: "li", text: l.replace(/^[-•*]\s+/, "") });
    else out.push({ kind: "p", text: l });
  }
  return out;
}

// Negreta en línia (**text**) sense deixar asteriscs a la vista.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

// Text del tutor amb format: títols (en vi), punts i negretes. Amb `lead`, el primer paràgraf és la definició destacada.
export function RichText({ text, lead = false }: { text: string; lead?: boolean }) {
  return (
    <>
      {parse(text).map((b, i) =>
        b.kind === "title" ? (
          <h3 key={i} className="brief-title">{b.text}</h3>
        ) : b.kind === "li" ? (
          <p key={i} className="brief-li">{inline(b.text)}</p>
        ) : (
          <p key={i} className={lead && i === 0 ? "brief-def" : undefined}>{inline(b.text)}</p>
        ),
      )}
    </>
  );
}
