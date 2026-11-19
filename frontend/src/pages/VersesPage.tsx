import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type Verse, type VerseSettings } from "../api";

function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return <span className={`verse-count${left <= 10 ? " near" : ""}`} aria-live="polite">{value.length} / {max}</span>;
}

// Gestió dels versos que surten a la capçalera: alta, canvi i baixa.
export function VersesPage() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(() => api.verses().then(setVerses).catch((e) => setError(e.message)), []);
  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const [draft, setDraft] = useState("");
  const [cfg, setCfg] = useState<VerseSettings | null>(null);
  const max = cfg?.max_length ?? 70;
  useEffect(() => void api.verseSettings().then(setCfg).catch((e) => setError(e.message)), []);

  function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      setCfg(await api.setVerseSettings({
        max_length: Number(f.get("max_length")),
        font_large: Number(f.get("font_large")),
        font_small: Number(f.get("font_small")),
      }));
      window.dispatchEvent(new Event("verse-settings")); // la capçalera i el peu els tornen a llegir
    });
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (!text) return setError("Cal un vers.");
    void run(async () => {
      await api.createVerse(text);
      form.reset();
      setDraft("");
    });
  }

  function save(e: FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") ?? "").trim();
    if (!text) return setError("Cal un vers.");
    void run(async () => {
      await api.updateVerse(id, text);
      setEditing(null);
    });
  }

  return (
    <section>
      <h2 className="opt-title">Versos</h2>
      <p className="lead">Surten a la capçalera i al peu, a l'atzar, i canvien cada deu minuts o en tornar a obrir la sessió. Pots canviar a sota el màxim de caràcters i la mida de la lletra.</p>
      <ErrorMessage message={error} />
      {cfg && (
        <form className="verse-cfg" key={`${cfg.max_length}-${cfg.font_large}-${cfg.font_small}`} onSubmit={saveSettings}>
          <label>Màxim de caràcters<input name="max_length" type="number" min={10} max={300} step={1} defaultValue={cfg.max_length} required /></label>
          <label>Lletra, pantalla gran (rem)<input name="font_large" type="number" min={0.6} max={2} step={0.05} defaultValue={cfg.font_large} required /></label>
          <label>Lletra, pantalla petita (rem)<input name="font_small" type="number" min={0.6} max={2} step={0.05} defaultValue={cfg.font_small} required /></label>
          <button type="submit">Desa els ajustos</button>
          <p className="muted small">Per defecte: 70 caràcters, 1,05 i 0,8 rem (1 rem són uns 16 px). Cabran dues línies a la capçalera; si la pantalla és estreta, la lletra petita compta.</p>
        </form>
      )}
      <form className="verse-add" onSubmit={add}>
        <div className="verse-field">
          <textarea name="text" rows={2} maxLength={max} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Un vers nou…" aria-label="Vers nou" required />
          <Counter value={draft} max={max} />
        </div>
        <button type="submit">Afegeix</button>
      </form>
      <ul className="rows verse-rows">
        {verses.map((v) =>
          editing === v.id ? (
            <li key={v.id}>
              <form className="verse-add" onSubmit={(e) => save(e, v.id)}>
                <div className="verse-field">
                  <textarea name="text" rows={2} maxLength={max} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Vers" autoFocus required />
                  <Counter value={draft} max={max} />
                </div>
                <span className="verse-actions">
                  <button type="submit">Desa</button>
                  <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel·la</button>
                </span>
              </form>
            </li>
          ) : (
            <li key={v.id}>
              <span>{v.text}</span>
              <span className="verse-actions">
                <button type="button" className="link" onClick={() => { setDraft(v.text); setEditing(v.id); }}>Canvia</button>
                <button
                  type="button"
                  className="link danger"
                  onClick={() => confirm("Eliminar aquest vers?") && void run(() => api.deleteVerse(v.id))}
                >
                  Elimina
                </button>
              </span>
            </li>
          ),
        )}
        {verses.length === 0 && <li className="muted">Encara no hi ha cap vers: a la capçalera hi surt el nom del lloc.</li>}
      </ul>
    </section>
  );
}
