import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { CenterSpinner } from "../components/LoadingSpinner";
import { api } from "../api";
import { ARCHITECTURES, CATEGORIES, SERVICES } from "../aws/content";

const LEVELS = [
  { value: "basic", name: "Bàsic" },
  { value: "intermedi", name: "Intermedi" },
  { value: "avancat", name: "Avançat" },
  { value: "pro", name: "Pro (arquitecte sènior)" },
];
const COUNTS = [3, 5, 8, 10];

interface Card { question: string; answer: string }

// Quiz: es tria un servei o arquitectura i una profunditat; el tutor fa preguntes d'arquitectura
// (les respostes queden amagades fins que es demanen).
export function AwsStudy() {
  const [params, setParams] = useSearchParams();
  const known = [...SERVICES.map((s) => s.name), ...ARCHITECTURES.map((a) => a.name)];
  const initial = known.includes(params.get("tema") ?? "") ? params.get("tema")! : SERVICES[0]?.name ?? "";
  const [topic, setTopic] = useState(initial);
  const [level, setLevel] = useState(params.get("nivell") ?? "pro");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());

  function pick(next: { tema?: string; nivell?: string }) {
    if (next.tema) setTopic(next.tema);
    if (next.nivell) setLevel(next.nivell);
    setParams({ tema: next.tema ?? topic, nivell: next.nivell ?? level }, { replace: true });
  }

  async function run(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      setCards((await api.awsQuiz(topic, level, count)).cards);
      setOpen(new Set());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (i: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <section className="aws study">
      <h1>Quiz</h1>
      <p className="study-note">
        Les preguntes i les respostes no són una llista fixa: les genera el model cada vegada que fas el quiz, així que
        poden ser diferents (i amb «Altres preguntes» en surten de noves). Les respostes queden amagades fins que les mostres.
      </p>
      <form className="study-form" onSubmit={(e) => void run(e)}>
        <label>Servei o arquitectura
          <select value={topic} onChange={(e) => pick({ tema: e.target.value })}>
            {CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {SERVICES.filter((s) => s.category === cat).map((s) => <option key={s.slug}>{s.name}</option>)}
              </optgroup>
            ))}
            <optgroup label="Arquitectures">
              {ARCHITECTURES.map((a) => <option key={a.slug}>{a.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label>Profunditat
          <select value={level} onChange={(e) => pick({ nivell: e.target.value })}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.name}</option>)}
          </select>
        </label>
        <div className="study-actions">
          <button type="submit" disabled={busy}>{busy ? "Preparant…" : "Fes el quiz"}</button>
          {busy && <CenterSpinner label="Preparant les preguntes…" />}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Nombre de preguntes">
            {COUNTS.map((n) => <option key={n} value={n}>{n} preguntes</option>)}
          </select>
        </div>
      </form>
      <ErrorMessage message={error} />
      {cards.length > 0 && (
        <>
          <ol className="cards">
            {cards.map((c, i) => (
              <li key={i} className="card-qa">
                <p className="q"><span className="n">{i + 1}</span><span>{c.question}</span></p>
                {open.has(i) ? (
                  <p className="a">{c.answer}</p>
                ) : null}
                <button type="button" className="link" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
                  {open.has(i) ? "Amaga la resposta" : "Mostra la resposta"}
                </button>
              </li>
            ))}
          </ol>
          <p><button type="button" className="ghost" disabled={busy} onClick={() => void run()}>Altres preguntes</button></p>
        </>
      )}
    </section>
  );
}
