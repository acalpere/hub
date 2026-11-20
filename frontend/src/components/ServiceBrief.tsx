import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { RichText } from "./RichText";

const LEVEL = "pro";

function cacheKey(name: string) {
  return `aws-brief3:${LEVEL}:${name}`;
}

// Explicació del servei que s'obre d'entrada: definició curta i seccions (què és, com funciona, quan usar-lo, decisions
// d'arquitecte, governança i cost) dins d'un quadre. Es guarda al navegador perquè no es torni a demanar cada vegada.
export function ServiceBrief({ name, children }: { name: string; children?: ReactNode }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    setError("");
    try {
      const hit = localStorage.getItem(cacheKey(name));
      if (hit) {
        setText(hit);
        return;
      }
    } catch {
      /* sense emmagatzematge: es demana cada vegada */
    }
    setText("");
    api.awsExplain(name, LEVEL).then(
      ({ answer }) => {
        if (!alive) return;
        setText(answer);
        try {
          localStorage.setItem(cacheKey(name), answer);
        } catch {
          /* res */
        }
      },
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [name, tries]);

  return (
    <div className="brief" aria-live="polite">
      {!text && !error && <p className="muted">Preparant l'explicació…</p>}
      {error && (
        <p className="error">
          {error} <button type="button" className="link" onClick={() => setTries((n) => n + 1)}>Torna-ho a provar</button>
        </p>
      )}
      {text && <RichText text={text} lead />}
      {children}
    </div>
  );
}

// Apartat extra del quadre (necessitats, serveis relacionats…) amb el mateix títol que els altres.
export function BriefSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="brief-title">{title}</h3>
      {children}
    </>
  );
}
