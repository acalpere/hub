import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type SavedAnswer } from "../api";

function SavedDialog({ item, onClose, onDelete }: { item: SavedAnswer; onClose: () => void; onDelete: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);
  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg concept" role="dialog" aria-modal="true" aria-label={item.question}>
        <div className="concept-head">
          <img src="/aws-logo.svg" alt="AWS" className="concept-logo" height={30} />
          <button type="button" className="concept-x" aria-label="Tanca" onClick={onClose}>×</button>
        </div>
        <p className="concept-service">Calaix de sastre{item.created_at ? ` · ${item.created_at.slice(0, 10)}` : ""}</p>
        <p className="concept-topic">{item.question}</p>
        <div className="concept-chat"><p className="bot">{item.answer}</p></div>
        <p className="need-actions"><button type="button" className="link danger" onClick={onDelete}>Elimina la fitxa</button></p>
      </div>
    </div>,
    document.body,
  );
}

// Calaix de sastre: les respostes del tutor que has desat, cada una en una fitxa amb el títol de la pregunta.
export function AwsDrawer() {
  const [items, setItems] = useState<SavedAnswer[] | null>(null);
  const [open, setOpen] = useState<SavedAnswer | null>(null);
  const [error, setError] = useState("");
  useEffect(() => void api.awsSaved().then(setItems).catch((e) => setError(e.message)), []);

  async function remove(item: SavedAnswer) {
    if (!confirm("Eliminar aquesta fitxa del calaix?")) return;
    try {
      await api.deleteAwsSaved(item.id);
      setItems((l) => l?.filter((x) => x.id !== item.id) ?? null);
      setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="aws">
      <h1>Calaix de sastre</h1>
      <p className="lead">Les respostes que has desat, amb la pregunta com a títol.</p>
      <ErrorMessage message={error} />
      {items?.length === 0 && <p className="muted">El calaix és buit. A cada resposta del model hi ha «Desa al calaix de sastre».</p>}
      <ul className="mini-cards">
        {items?.map((it) => (
          <li key={it.id} className="mini-card drawer-card">
            <button type="button" className="mini-open" onClick={() => setOpen(it)}>{it.question}</button>
            <span>{it.answer}</span>
          </li>
        ))}
      </ul>
      {open && <SavedDialog item={open} onClose={() => setOpen(null)} onDelete={() => void remove(open)} />}
    </section>
  );
}
