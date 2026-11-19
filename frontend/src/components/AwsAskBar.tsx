import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, Outlet } from "react-router";
import { api } from "../api";
import { Conversation, MicButton, useDictation, useTutor, type Turn } from "./TutorChat";

// Parelles pregunta → resposta d'una conversa (les que ja tenen resposta).
function pairs(turns: Turn[]): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  turns.forEach((t, i) => {
    const q = turns[i - 1];
    if (t.role === "assistant" && q?.role === "user") out.push({ q: q.text, a: t.text });
  });
  return out;
}

function SaveButton({ q, a }: { q: string; a: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="link save-answer" disabled={done} onClick={() => void api.saveAwsAnswer(q, a).then(() => setDone(true))}>
      {done ? "Desada al calaix ✓" : "Desa al calaix de sastre"}
    </button>
  );
}

// Barra fixa de dalt de tot a tota la secció d'AWS: el logo d'AWS a l'esquerra i el camp per preguntar el que sigui
// (que creix cap avall en lloc de tallar-se). La resposta s'obre en un pop-up sota la barra; també hi ha
// l'historial de la sessió i l'accés al calaix de sastre, on es desen les respostes.
export function AwsLayout() {
  const chat = useTutor({ storageKey: "aws-session" });
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<"answer" | "history" | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const voice = useDictation((said) => setText((t) => `${t} ${said}`.trim()), chat.setError);
  const history = useMemo(() => pairs(chat.turns), [chat.turns]);

  // La barra queda enganxada just sota la capçalera del lloc, sigui quina sigui l'alçada.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header.top");
    if (!header || !bar.current) return;
    const apply = () => bar.current?.style.setProperty("--aws-top", `${header.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // El camp creix amb el text: en passar-se de la línia, salta a una de nova (fins a uns 6 línies, i després fa scroll).
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [text]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || chat.busy) return;
    chat.ask(text);
    setText("");
    setPanel("answer");
  }

  // Enter envia; Maj+Enter fa un salt de línia a mà.
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  }

  return (
    <div className="aws-shell">
      <div className="aws-bar" ref={bar}>
        <Link to="/aws" className="aws-bar-logo" aria-label="Portada d'AWS">
          <img src="/aws-logo.svg" alt="" width={57} height={34} />
        </Link>
        <form className="aws-ask" onSubmit={send}>
          <textarea ref={field} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="Pregunta el que vulguis sobre AWS…" aria-label="Pregunta" maxLength={600} enterKeyHint="send" />
          {voice.supported && <MicButton listening={voice.listening} onClick={voice.toggle} />}
          <button type="submit" disabled={chat.busy || !text.trim()}>Envia</button>
        </form>
        <div className="aws-sub">
          <button type="button" className="link" aria-expanded={panel === "history"} onClick={() => setPanel(panel === "history" ? null : "history")}>
            Historial de la sessió ({history.length})
          </button>
          {panel !== "answer" && chat.turns.length > 0 && <button type="button" className="link" onClick={() => setPanel("answer")}>Veure la conversa</button>}
          <Link to="/aws/calaix" className="link">Calaix de sastre</Link>
        </div>
        {panel === "answer" && (
          <div className="aws-answer" role="dialog" aria-label="Resposta del tutor">
            <div className="aws-answer-head">
              <span className="aws-answer-title">Tutor d'AWS</span>
              <button type="button" className="link" onClick={() => { chat.clear(); setPanel(null); }}>Nova conversa</button>
              <button type="button" className="concept-x" aria-label="Tanca" onClick={() => setPanel(null)}>×</button>
            </div>
            <Conversation turns={chat.turns} busy={chat.busy} error={chat.error} onSave={async (q, a) => void (await api.saveAwsAnswer(q, a))} />
          </div>
        )}
        {panel === "history" && (
          <div className="aws-answer" role="dialog" aria-label="Historial de la sessió">
            <div className="aws-answer-head">
              <span className="aws-answer-title">Historial de la sessió</span>
              <button type="button" className="concept-x" aria-label="Tanca" onClick={() => setPanel(null)}>×</button>
            </div>
            <div className="aws-history">
              {history.length === 0 && <p className="muted">Encara no has fet cap pregunta en aquesta sessió.</p>}
              {[...history].reverse().map((h, i) => (
                <details key={`${i}-${h.q}`} className="aws-hist-item">
                  <summary>{h.q}</summary>
                  <p>{h.a}</p>
                  <SaveButton q={h.q} a={h.a} />
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
      <Outlet />
    </div>
  );
}
