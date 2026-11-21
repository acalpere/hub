import type { Issue } from "../spell";

// Llista de faltes d'ortografia trobades al text: cada una amb suggeriments (un clic la corregeix) i «Ignora».
export function SpellIssues({ issues, checking, onFix, onIgnore }: { issues: Issue[]; checking: boolean; onFix: (i: Issue, to: string) => void; onIgnore: (i: Issue) => void }) {
  if (issues.length === 0) return checking ? <p className="spell-note" role="status">Revisant l'ortografia…</p> : null;
  return (
    <div className="spell" role="alert">
      <strong>{issues.length === 1 ? "Hi ha una possible falta d'ortografia" : `Hi ha ${issues.length} possibles faltes d'ortografia`}</strong>
      <ul>
        {issues.map((i) => (
          <li key={`${i.index}-${i.word}`}>
            <span className="spell-word">{i.word}</span>
            {i.suggestions.length > 0 ? <span className="spell-arrow" aria-hidden="true">→</span> : <span className="spell-none">sense suggeriments</span>}
            {i.suggestions.map((s) => (
              <button key={s} type="button" className="spell-fix" onClick={() => onFix(i, s)}>{s}</button>
            ))}
            <button type="button" className="link spell-ignore" onClick={() => onIgnore(i)} title="No la tornis a marcar (nom propi, paraula antiga…)">Ignora</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
