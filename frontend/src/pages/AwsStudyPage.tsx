import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
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

// Estudi: es tria un servei i una profunditat; el tutor l'explica o fa preguntes d'arquitectura
// (les respostes queden amagades fins que es demanen).
export function AwsStudy() {
  const [params, setParams] = useSearchParams();
  const known = [...SERVICES.map((s) => s.name), ...ARCHITECTURES.map((a) => a.name)];
  const initial = known.includes(params.get("tema") ?? "") ? params.get("tema")! : SERVICES[0]?.name ?? "";
  const [topic, setTopic] = useState(initial);
  const [level, setLevel] = useState(params.get("nivell") ?? "pro");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState<"explain" | "quiz" | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());

  function pick(next: { tema?: string; nivell?: string }) {
    if (next.tema) setTopic(next.tema);
    if (next.nivell) setLevel(next.nivell);
    setParams({ tema: next.tema ?? topic, nivell: next.nivell ?? level }, { replace: true });
  }

  async function run(kind: "explain" | "quiz", e?: FormEvent) {
    e?.preventDefault();
    setBusy(kind);
    setError("");
    try {
      if (kind === "explain") {
        setText((await api.awsExplain(topic, level)).answer);
        setCards([]);
      } else {
        setCards((await api.awsQuiz(topic, level, count)).cards);
        setOpen(new Set());
        setText("");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
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
      <p className="aws-back"><Link to="/aws">← AWS</Link></p>
      <h1>Quiz</h1>
      <form className="study-form" onSubmit={(e) => void run("explain", e)}>
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
          <button type="submit" disabled={!!busy}>{busy === "explain" ? "Preparant…" : "Explica-m'ho"}</button>
          <span className="study-quiz">
            <button type="button" className="ghost" disabled={!!busy} onClick={() => void run("quiz")}>
              {busy === "quiz" ? "Preparant…" : "Pregunta'm"}
            </button>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Nombre de preguntes">
              {COUNTS.map((n) => <option key={n} value={n}>{n} preguntes</option>)}
            </select>
          </span>
        </div>
      </form>
      <ErrorMessage message={error} />
      {text && <div className="study-text">{text}</div>}
      {cards.length > 0 && (
        <>
          <ol className="cards">
            {cards.map((c, i) => (
              <li key={i} className="card-qa">
                <p className="q"><span className="n">{i + 1}</span>{c.question}</p>
                {open.has(i) ? (
                  <p className="a">{c.answer}</p>
                ) : null}
                <button type="button" className="link" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
                  {open.has(i) ? "Amaga la resposta" : "Mostra la resposta"}
                </button>
              </li>
            ))}
          </ol>
          <p><button type="button" className="ghost" disabled={!!busy} onClick={() => void run("quiz")}>Altres preguntes</button></p>
        </>
      )}
    </section>
  );
}
