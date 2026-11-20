import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import { RichText } from "./RichText";
import { LogoSpinner } from "./LoadingSpinner";

export interface Turn { role: "user" | "assistant"; text: string }

// Reconeixement de veu del navegador (Chrome, Edge, Safari); si no n'hi ha, el micròfon no es mostra.
/* eslint-disable @typescript-eslint/no-explicit-any */
const Recognition: any = typeof window === "undefined" ? null : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

interface TutorOptions {
  service?: string; // sense «concept», la conversa és lliure (qualsevol pregunta sobre AWS)
  concept?: string;
  level?: string;
  autoStart?: boolean; // demana d'entrada l'explicació en profunditat del concepte
  storageKey?: string; // si hi és, la conversa es conserva mentre duri la sessió del navegador
}

function load(key?: string): Turn[] {
  try {
    const raw = key ? sessionStorage.getItem(key) : null;
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Estat d'una conversa amb el tutor: les respostes es van afegint a `turns`.
export function useTutor({ service = "", concept = "", level = "", autoStart = false, storageKey }: TutorOptions = {}) {
  const [turns, setTurns] = useState<Turn[]>(() => load(storageKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function request(question: string, before: Turn[]) {
    setBusy(true);
    setError("");
    try {
      const { answer } = await api.awsTutor({ service, concept, question, history: before, level });
      setTurns((t) => [...t, { role: "assistant", text: answer }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    setTurns((t) => [...t, { role: "user", text: question }]);
    void request(question, turns);
  }

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(turns));
    } catch {
      /* sense emmagatzematge: la conversa només dura mentre la pàgina és oberta */
    }
  }, [turns, storageKey]);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void request("", []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { turns, busy, error, setError, ask, clear: () => { setTurns([]); setError(""); } };
}

// Dictat en català: el que es diu s'afegeix al text. No s'atura en fer una pausa: continua escoltant fins que es
// toca el micròfon un altre cop (el navegador l'atura sol cada cert temps i aquí es torna a engegar).
// `supported` és fals als navegadors que no ho admeten.
export function useDictation(onText: (said: string) => void, onError: (msg: string) => void) {
  const [listening, setListening] = useState(false);
  const recognizer = useRef<any>(null);
  const wanted = useRef(false);
  const callbacks = useRef({ onText, onError });
  callbacks.current = { onText, onError };

  function stop() {
    wanted.current = false;
    setListening(false);
    recognizer.current?.stop();
  }
  useEffect(() => () => { wanted.current = false; recognizer.current?.abort(); }, []);

  function begin() {
    const r = new Recognition();
    recognizer.current = r;
    r.lang = "ca-ES";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (ev: any) => {
      // Només el que ja és definitiu, i només el nou: així no es repeteix res (sobretot als mòbils).
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) callbacks.current.onText(ev.results[i][0].transcript.trim());
      }
    };
    r.onerror = (ev: any) => {
      if (ev?.error === "no-speech" || ev?.error === "aborted") return; // silenci: es torna a engegar a onend
      wanted.current = false;
      setListening(false);
      callbacks.current.onError(
        ev?.error === "not-allowed" || ev?.error === "service-not-allowed"
          ? "El navegador no té permís per al micròfon."
          : "No s'ha pogut agafar la veu.",
      );
    };
    r.onend = () => {
      if (!wanted.current) return setListening(false);
      window.setTimeout(() => {
        if (!wanted.current) return;
        try { begin(); } catch { stop(); }
      }, 150);
    };
    r.start();
  }

  function toggle() {
    if (wanted.current) return stop();
    wanted.current = true;
    setListening(true);
    try { begin(); } catch { stop(); }
  }
  return { supported: !!Recognition, listening, toggle, stop };
}

export function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mic${listening ? " on" : ""}`} onClick={onClick} aria-label={listening ? "Atura el micròfon" : "Pregunta amb la veu"} aria-pressed={listening}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4" /></svg>
    </button>
  );
}

export function Conversation({ turns, busy, error, onSave }: { turns: Turn[]; busy: boolean; error: string; onSave?: (question: string, answer: string) => Promise<void> }) {
  const box = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  async function save(i: number) {
    const question = turns[i - 1]?.role === "user" ? turns[i - 1]!.text : "";
    if (!onSave || !question) return;
    await onSave(question, turns[i]!.text);
    setSaved((s) => new Set(s).add(i));
  }
  // Una resposta nova es mostra des del començament (no pel final); mentre es pensa, es veu el «Pensant…».
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const last = turns[turns.length - 1];
    if (busy || error || last?.role !== "assistant") {
      el.scrollTo({ top: el.scrollHeight });
      return;
    }
    const answer = el.querySelector<HTMLElement>("[data-last-answer]");
    el.scrollTo({ top: answer ? Math.max(0, answer.offsetTop - 4) : 0 });
  }, [turns, busy, error]);
  return (
    <div className="concept-chat" aria-live="polite" ref={box}>
      {turns.map((t, i) => (
        <div key={i} className={t.role === "user" ? "me" : "bot-wrap"} data-last-answer={t.role === "assistant" && i === turns.length - 1 ? "" : undefined}>
          {t.role === "user" ? <p>{t.text}</p> : <div className="bot"><RichText text={t.text} /></div>}
          {t.role === "assistant" && onSave && turns[i - 1]?.role === "user" && (
            <button type="button" className="link save-answer" disabled={saved.has(i)} onClick={() => void save(i)}>
              {saved.has(i) ? "Desada al calaix ✓" : "Desa al calaix de sastre"}
            </button>
          )}
        </div>
      ))}
      {busy && <div className="bot thinking"><LogoSpinner small label="Pensant…" /></div>}
      {error && <p className="bot error">{error}</p>}
    </div>
  );
}

// Conversa amb el tutor dins d'una finestra o d'una pàgina: es pregunta escrivint o amb la veu.
export function TutorChat({ placeholder = "Pregunta el que vulguis…", ...options }: TutorOptions & { placeholder?: string }) {
  const chat = useTutor(options);
  const [text, setText] = useState("");
  const voice = useDictation((said) => setText((t) => `${t} ${said}`.trim()), chat.setError);

  function send(e: FormEvent) {
    e.preventDefault();
    chat.ask(text);
    setText("");
  }

  return (
    <div className="chat">
      <Conversation turns={chat.turns} busy={chat.busy} error={chat.error} />
      <form className="concept-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="La teva pregunta" maxLength={600} enterKeyHint="send" />
        {voice.supported && <MicButton listening={voice.listening} onClick={voice.toggle} />}
        <button type="submit" disabled={chat.busy || !text.trim()}>Envia</button>
      </form>
      {!voice.supported && <p className="muted small">Aquest navegador no pot dictar; escriu la pregunta.</p>}
    </div>
  );
}
