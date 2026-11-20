import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { architectureBySlug, serviceBySlug } from "../aws/content";
import { NEEDS } from "../aws/needs";
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

interface Crumb { label: string; to?: string }

const pretty = (slug: string) => decodeURIComponent(slug).replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

// Ruta de la pàgina on ets, al costat del logo: AWS / Serveis / Còmput / EC2. Cada tros és un enllaç per tornar enrere.
function crumbsFor(pathname: string, cat: string | null): Crumb[] {
  const [, , section, slug] = pathname.split("/");
  const out: Crumb[] = [];
  switch (section) {
    case "serveis": {
      out.push({ label: "Serveis", to: "/aws/serveis" });
      const s = slug ? serviceBySlug(slug) : undefined;
      const category = s?.category ?? cat;
      if (category) out.push({ label: category, to: s ? `/aws/serveis?cat=${encodeURIComponent(category)}` : undefined });
      if (s) out.push({ label: s.name });
      break;
    }
    case "arquitectures":
      out.push({ label: "Arquitectura", to: "/aws/arquitectures" });
      if (slug) out.push({ label: architectureBySlug(slug)?.name ?? pretty(slug) });
      break;
    case "necessitats":
      out.push({ label: "Necessitats", to: "/aws/necessitats" });
      if (slug) out.push({ label: NEEDS.find((n) => n.slug === slug)?.name ?? pretty(slug) });
      break;
    case "quiz":
      out.push({ label: "Quiz" });
      break;
    case "calaix":
      out.push({ label: "Calaix de sastre" });
      break;
  }
  // L'últim tros és on ets: no és enllaç.
  if (out.length) out[out.length - 1] = { label: out[out.length - 1]!.label };
  return out;
}

function AwsCrumbs() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const crumbs = crumbsFor(pathname, params.get("cat"));
  // Enrere de veritat (el que has visitat abans, p. ex. el servei d'on véns al quiz), només si hi ha on tornar.
  const canBack = key !== "default" && crumbs.length > 0;
  return (
    <nav className="aws aws-crumbs" aria-label="On ets">
      {canBack && (
        <button type="button" className="aws-back-btn" aria-label="Enrere" title="Enrere" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}
      <Link to="/aws" className="aws-crumb-home" aria-label="AWS: portada" aria-current={crumbs.length ? undefined : "page"}>
        <img src="/aws-logo.svg" alt="" height={34} />
        {!crumbs.length && <span>AWS</span>}
      </Link>
      {crumbs.map((c, i) => (
        <span key={`${i}-${c.label}`} className="aws-crumb">
          {i > 0 && <span className="aws-crumb-sep" aria-hidden="true">/</span>}
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// Assistent d'AWS: un botó rodó a baix a la dreta (només dins la secció d'AWS) que obre un pop-up gran al centre amb
// el camp per preguntar, la conversa, l'historial de la sessió i l'accés al calaix de sastre.
export function AwsLayout() {
  const chat = useTutor({ storageKey: "aws-session" });
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const field = useRef<HTMLTextAreaElement>(null);
  const voice = useDictation((said) => setText((t) => `${t} ${said}`.trim()), chat.setError);
  const history = useMemo(() => pairs(chat.turns), [chat.turns]);

  // El camp creix amb el text (fins a uns 6 línies, i després fa scroll).
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [text, open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [open]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || chat.busy) return;
    chat.ask(text);
    setText("");
    setTab("chat");
  }

  // Enter envia; Maj+Enter fa un salt de línia a mà.
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  }

  return (
    <div className="aws-shell">
      <AwsCrumbs />
      <Outlet />
      <div className="aws-fab-dock">
        <button type="button" className="aws-fab" aria-label="Assistent d'AWS: què necessites?" onClick={() => setOpen(true)}>?</button>
      </div>
      {open &&
        createPortal(
          <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="dlg aws-assist" role="dialog" aria-modal="true" aria-label="Assistent d'AWS">
              <div className="concept-head">
                <img src="/aws-logo.svg" alt="AWS" className="concept-logo" height={30} />
                <button type="button" className="concept-x" aria-label="Tanca" onClick={() => setOpen(false)}>×</button>
              </div>
              <div className="aws-tabs">
                <button type="button" className="link" aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>Conversa</button>
                <button type="button" className="link" aria-pressed={tab === "history"} onClick={() => setTab("history")}>Historial de la sessió ({history.length})</button>
                <Link to="/aws/calaix" className="link" onClick={() => setOpen(false)}>Calaix de sastre</Link>
                {chat.turns.length > 0 && <button type="button" className="link aws-new" onClick={() => { chat.clear(); setTab("chat"); }}>Nova conversa</button>}
              </div>
              {tab === "chat" ? (
                <div className="aws-assist-body">
                  {chat.turns.length === 0 && !chat.busy && !chat.error && <p className="muted aws-hint">Què volem saber avui?</p>}
                  <Conversation turns={chat.turns} busy={chat.busy} error={chat.error} onSave={async (q, a) => void (await api.saveAwsAnswer(q, a))} />
                </div>
              ) : (
                <div className="aws-assist-body aws-history">
                  {history.length === 0 && <p className="muted">Encara no has fet cap pregunta en aquesta sessió.</p>}
                  {[...history].reverse().map((h, i) => (
                    <details key={`${i}-${h.q}`} className="aws-hist-item">
                      <summary>{h.q}</summary>
                      <p>{h.a}</p>
                      <SaveButton q={h.q} a={h.a} />
                    </details>
                  ))}
                </div>
              )}
              <form className="aws-ask" onSubmit={send}>
                <textarea ref={field} autoFocus rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="Què necessites?" aria-label="Pregunta" maxLength={600} enterKeyHint="send" />
                {voice.supported && <MicButton listening={voice.listening} onClick={voice.toggle} />}
                <button type="submit" disabled={chat.busy || !text.trim()}>Envia</button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
