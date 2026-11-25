import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type CyranoLine } from "../api";
import { findIssues, ignoreWord, type Issue } from "../spell";
import { roman } from "../cyrano";

interface Found {
  line: CyranoLine;
  issues: Issue[];
}

const where = (l: CyranoLine) => (l.act === 0 ? "Notes" : `Acte ${roman(l.act)} · Escena ${roman(l.scene)}`);

// Revisió ortogràfica de tot el text, només quan es demana (botó de dalt). Diu si està revisat o no, i deixa corregir o ignorar cada falta.
export function SpellReport({ speakers, onClose, onSaved, onOpen }: { speakers: string[]; onClose: () => void; onSaved: (l: CyranoLine) => void; onOpen: (l: CyranoLine) => void }) {
  const [found, setFound] = useState<Found[]>([]);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"running" | "done" | "error">("running");
  const [error, setError] = useState("");
  const total = useRef(0);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const lines = (await api.cyranoText()).filter((l) => l.kind !== "title");
        total.current = lines.length;
        const out: Found[] = [];
        for (let i = 0; i < lines.length && !stop; i++) {
          const line = lines[i]!;
          const issues = await findIssues(line.text, speakers);
          if (issues.length) out.push({ line, issues });
          if (i % 40 === 0) {
            setProgress(i);
            setFound([...out]);
            await new Promise((r) => setTimeout(r));
          }
        }
        if (stop) return;
        setFound(out);
        setProgress(lines.length);
        setState("done");
      } catch (e) {
        if (!stop) {
          setError((e as Error).message);
          setState("error");
        }
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function fix(f: Found, i: Issue, to: string) {
    if (f.line.text.slice(i.index, i.index + i.word.length) !== i.word) return;
    const text = f.line.text.slice(0, i.index) + to + f.line.text.slice(i.index + i.word.length);
    try {
      const updated = await api.cyranoEdit(f.line.id, { speaker: f.line.speaker, kind: f.line.kind, text, stamp: f.line.stamp });
      onSaved(updated);
      const issues = await findIssues(updated.text, speakers);
      setFound((all) => all.flatMap((x) => (x.line.id !== f.line.id ? [x] : issues.length ? [{ line: updated, issues }] : [])));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function ignore(word: string) {
    ignoreWord(word);
    const w = word.toLowerCase();
    setFound((all) => all.flatMap((x) => {
      const issues = x.issues.filter((i) => i.word.toLowerCase() !== w);
      return issues.length ? [{ ...x, issues }] : [];
    }));
  }

  const count = found.reduce((n, f) => n + f.issues.length, 0);
  const verdict =
    state === "running" ? `Revisant… ${total.current ? Math.round((progress / total.current) * 100) : 0} %`
    : state === "error" ? "No s'ha pogut revisar"
    : count === 0 ? "✓ Revisat: cap falta d'ortografia"
    : `✗ No revisat: ${count} ${count === 1 ? "possible falta" : "possibles faltes"} en ${found.length} ${found.length === 1 ? "línia" : "línies"}`;

  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg spell-report" role="dialog" aria-modal="true" aria-label="Revisió ortogràfica">
        <h2>Revisió ortogràfica</h2>
        <p className={`spell-verdict ${state === "done" && count === 0 ? "ok" : state === "done" ? "bad" : ""}`} role="status">{verdict}</p>
        {error && <p className="spell-verdict bad" role="alert">{error}</p>}
        <ul className="spell-rep-list">
          {found.map((f) => (
            <li key={f.line.id}>
              <button type="button" className="link spell-where" onClick={() => onOpen(f.line)} title="Obre la rèplica">{where(f.line)}{f.line.speaker ? ` · ${f.line.speaker}` : ""} ↗</button>
              <ul className="spell">
                {f.issues.map((i) => (
                  <li key={`${i.index}-${i.word}`}>
                    <span className="spell-word">{i.word}</span>
                    {i.suggestions.length > 0 ? <span className="spell-arrow" aria-hidden="true">→</span> : <span className="spell-none">sense suggeriments</span>}
                    {i.suggestions.map((s) => (
                      <button key={s} type="button" className="spell-fix" onClick={() => void fix(f, i, s)}>{s}</button>
                    ))}
                    <button type="button" className="link spell-ignore" onClick={() => ignore(i.word)} title="No la tornis a marcar (nom propi, paraula antiga…)">Ignora</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="dlg-actions"><button type="button" onClick={onClose}>Tanca</button></div>
      </div>
    </div>,
    document.body,
  );
}
