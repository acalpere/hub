import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { api, type CyranoKind, type CyranoLine, type CyranoOutline, type CyranoRevision } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../auth";
import { highlight, roman, searchTerms, toSeconds, toStamp } from "../cyrano";

const actLabel = (act: number) => (act === 0 ? "Notes" : `Acte ${roman(act)}`);
const sceneLabel = (act: number, scene: number) =>
  act === 0 ? (scene === 0 ? "Nota editorial" : "Criteri editorial") : `Escena ${roman(scene)}`;

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}

interface LineProps {
  line: CyranoLine;
  terms: string[];
  focus: boolean;
  canEdit: boolean;
  speakers: string[];
  onSaved: (l: CyranoLine) => void;
  onInserted?: (l: CyranoLine, afterId: number) => void;
  onDeleted?: (id: number) => void;
  showPlace?: boolean;
  onOpen?: () => void;
  onSeek?: (seconds: number) => void;
  playing?: boolean;
  videoTime?: () => number | null; // hora actual del vídeo (null: el reproductor és tancat)
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ca", { dateStyle: "medium", timeStyle: "short" }) : "";
}

const NEW = "__nou__";

function History({ versions, busy, onRestore }: { versions: CyranoRevision[]; busy: boolean; onRestore: (r: CyranoRevision) => void }) {
  if (versions.length === 0) return <p className="muted small">Aquesta línia no s'ha editat mai.</p>;
  return (
    <ol className="cy-history">
      {versions.map((v, i) => (
        <li key={v.id}>
          <div className="cy-history-meta">
            <span>{v.edited_by ? `${v.edited_by} · ${when(v.edited_at)}` : "Text original"}</span>
            {i === 0 ? <em>vigent</em> : <button type="button" className="link" disabled={busy} onClick={() => onRestore(v)}>Restaura</button>}
          </div>
          <p>{v.speaker && <strong>{v.speaker}. </strong>}{v.text}{v.stamp && <span className="muted"> · {v.stamp}</span>}</p>
        </li>
      ))}
    </ol>
  );
}

// Finestra per saltar a un acte i una escena (surt del botó rodó que apareix en perdre de vista les barres).
interface JumpProps {
  outline: CyranoOutline;
  from: { act: number; scene: number };
  continuous: boolean;
  onView: (paged: boolean) => void;
  canSwitchMode: boolean;
  editing: boolean;
  onEditing: (on: boolean) => void;
  onGo: (to: { act: number; scene: number }) => void;
  onClose: () => void;
}

function Jump({ outline, from, continuous, onView, canSwitchMode, editing, onEditing, onGo, onClose }: JumpProps) {
  const [pick, setPick] = useState(from);
  const acts = outline.acts.filter((a) => a.act > 0);
  const scenes = outline.acts.find((a) => a.act === pick.act)?.scenes ?? [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg jump" role="dialog" aria-modal="true" aria-label="Anar a un acte i una escena">
        <div className="jump-opts">
          <div className="cy-modes" role="group" aria-label="Vista">
            <button type="button" className={continuous ? "" : "on"} aria-pressed={!continuous} onClick={() => onView(true)}>Paginada</button>
            <button type="button" className={continuous ? "on" : ""} aria-pressed={continuous} onClick={() => onView(false)}>Contínua</button>
          </div>
          {canSwitchMode && (
            <div className="cy-modes" role="group" aria-label="Mode">
              <button type="button" className={editing ? "" : "on"} aria-pressed={!editing} onClick={() => onEditing(false)}>Lectura</button>
              <button type="button" className={editing ? "on" : ""} aria-pressed={editing} onClick={() => onEditing(true)}>Edició</button>
            </div>
          )}
        </div>
        <p className="jump-label">Acte</p>
        <div className="jump-chips">
          {acts.map((a) => (
            <button key={a.act} type="button" className={`jump-chip${a.act === pick.act ? " on" : ""}`} onClick={() => setPick({ act: a.act, scene: a.scenes[0] ?? 0 })}>
              {roman(a.act)}
            </button>
          ))}
        </div>
        <p className="jump-label">Escena</p>
        <div className="jump-chips">
          {scenes.map((sc) => (
            <button key={sc} type="button" className={`jump-chip${sc === pick.scene ? " on" : ""}`} onClick={() => setPick({ ...pick, scene: sc })}>
              {roman(sc)}
            </button>
          ))}
        </div>
        <div className="dlg-actions">
          <button type="button" className="no" onClick={onClose}>Tanca</button>
          <button type="button" onClick={() => onGo(pick)}>Anar-hi</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Line({ line, terms, focus, canEdit, speakers, onSaved, onInserted, onDeleted, showPlace, onOpen, onSeek, playing, videoTime }: LineProps) {
  // «edit»: canvia aquesta línia; «add»: n'afegeix una de nova just a sota.
  const [mode, setMode] = useState<"edit" | "add" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<CyranoRevision[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = useRef(false);
  const [ask, setAsk] = useState<"delete" | "discard" | null>(null);
  const asking = useRef(false);
  asking.current = ask !== null;
  // El tipus que es tria mostra o amaga el personatge. En afegir, es comença com la línia de sobre:
  // si és una rèplica, la nova és del mateix personatge.
  const [kind, setKind] = useState<CyranoKind>("text");
  const [speaker, setSpeaker] = useState("");
  const [newSpeaker, setNewSpeaker] = useState(false);
  useEffect(() => {
    setSpeaker(line.kind === "speech" ? line.speaker ?? "" : "");
    setNewSpeaker(false);
  }, [mode, line.kind, line.speaker]);
  useEffect(() => {
    if (mode === "edit") setKind(line.kind === "speech" || line.kind === "stage" ? line.kind : "text");
    else if (mode === "add") setKind(line.kind === "speech" || line.kind === "stage" ? line.kind : "text");
  }, [mode, line.kind]);

  // Es tanca amb Esc o clicant fora; si hi ha canvis sense desar, abans ho pregunta.
  // El reproductor de vídeo compta com a dins: s'hi ha de poder parar el vídeo mentre s'edita.
  useEffect(() => {
    dirty.current = false;
  }, [mode]);
  useEffect(() => {
    if (!mode) return;
    const close = () => {
      if (busy) return;
      if (asking.current) return;
      if (dirty.current) return setAsk("discard");
      setMode(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPress = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".cy-player, .dlg-backdrop") || formRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPress);
    };
  }, [mode, busy]);

  async function loadHistory() {
    setError("");
    try {
      setHistory(await api.cyranoHistory(line.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function restore(r: CyranoRevision) {
    setBusy(true);
    setError("");
    try {
      onSaved(await api.cyranoRestore(line.id, r.id));
      setHistory(await api.cyranoHistory(line.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  async function remove() {
    setAsk(null);
    setBusy(true);
    setError("");
    try {
      await api.cyranoDelete(line.id);
      setMode(null);
      onDeleted?.(line.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const kind = String(f.get("kind")) as CyranoKind;
    setBusy(true);
    setError("");
    try {
      const payload = { speaker: kind === "speech" ? speaker.trim() : null, kind, text: String(f.get("text")), stamp: String(f.get("stamp")).trim() || null };
      if (mode === "add") onInserted?.(await api.cyranoInsert(line.id, payload), line.id);
      else onSaved(await api.cyranoEdit(line.id, payload));
      setMode(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const editor = mode && (
    <form className="cy-edit" ref={formRef} onSubmit={save} onInput={() => { dirty.current = true; }} key={mode}>
        <div className="cy-edit-row">
          <label>
            Tipus
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as CyranoKind)}>
              <option value="speech">Rèplica (parla un personatge)</option>
              <option value="stage">Acotació (indicació escènica, en cursiva)</option>
              <option value="text">Text (sense personatge)</option>
            </select>
          </label>
          {kind === "speech" && (
            <label>
              Personatge
              <select name="speaker_pick" value={newSpeaker ? NEW : speaker} onChange={(e) => (e.target.value === NEW ? setNewSpeaker(true) : (setNewSpeaker(false), setSpeaker(e.target.value)))} required={!newSpeaker}>
                <option value="" disabled>Tria un personatge…</option>
                {[...new Set([speaker, ...speakers].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={NEW}>+ Un altre personatge…</option>
              </select>
              {newSpeaker && <input name="speaker_new" value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Nom del personatge" required autoFocus />}
            </label>
          )}
        </div>
        <div className="cy-stamp-row">
          <label>
            Hora del vídeo
            <input ref={stampInput} name="stamp" defaultValue={mode === "add" ? "" : line.stamp ?? ""} placeholder="00:03:01" inputMode="numeric" pattern="\d{1,2}:\d{2}:\d{2}" maxLength={8} />
          </label>
          {videoTime && (
            <button
              type="button"
              className="ghost"
              disabled={videoTime() === null}
              title={videoTime() === null ? "Obre el vídeo i para'l a la rèplica" : "Posa l'hora que marca ara el vídeo"}
              onClick={() => {
                const t = videoTime();
                if (t !== null && stampInput.current) stampInput.current.value = toStamp(t);
              }}
            >
              Agafa l'hora del vídeo
            </button>
          )}
        </div>
        <textarea name="text" defaultValue={mode === "add" ? "" : line.text} rows={mode === "add" ? 3 : Math.min(10, Math.max(3, Math.ceil(line.text.length / 70)))} required autoFocus />
        <ErrorMessage message={error} />
        <div className="cy-edit-actions">
          <button type="submit" disabled={busy}>{mode === "add" ? "Afegeix" : "Desa"}</button>
          <button type="button" className="ghost" onClick={() => setMode(null)}>Cancel·la</button>
          {mode === "edit" && onDeleted && (
            <button type="button" className="link danger" disabled={busy} onClick={() => setAsk("delete")}>
              Esborra
            </button>
          )}
          {mode === "edit" && (
            <button type="button" className="link hist" onClick={() => (history ? setHistory(null) : void loadHistory())}>
              {history ? "Amaga l'historial" : "Historial"}
            </button>
          )}
        </div>
        {mode === "edit" && history && <History versions={history} busy={busy} onRestore={(r) => void restore(r)} />}
      </form>
  );

  const dialog = ask && (
    ask === "delete" ? (
      <ConfirmDialog title="Estàs segur?" text="S'esborrarà aquesta línia i el seu historial. No es pot desfer." yes="Sí" no="No" onYes={() => void remove()} onNo={() => setAsk(null)} />
    ) : (
      <ConfirmDialog title="Descartar els canvis?" text="Has fet canvis en aquesta línia que no s'han desat." yes="Sí" no="No" onYes={() => { setAsk(null); setMode(null); }} onNo={() => setAsk(null)} />
    )
  );

  if (mode === "edit") return <>{editor}{dialog}</>;

  const body = <Marked text={line.text} terms={terms} />;
  return (
    <>
    <div ref={ref} data-line={line.id} className={`cy-line cy-${line.kind}${focus ? " is-focus" : ""}${playing ? " is-playing" : ""}`}>
      {line.kind === "speech" ? (
        <>
          <div className="cy-who">
            {line.speaker}
            {line.stamp && (onSeek ? (
              <button type="button" className="cy-stamp" title="Reprodueix el vídeo des d'aquí" onClick={() => onSeek(toSeconds(line.stamp as string))}>
                ▶ {line.stamp}
              </button>
            ) : <small>{line.stamp}</small>)}
          </div>
          <p>{body}</p>
        </>
      ) : (
        <p className="cy-plain">{body}</p>
      )}
      <div className="cy-tools">
        {showPlace && onOpen && (
          <button type="button" className="link" onClick={onOpen}>
            {actLabel(line.act)} · {sceneLabel(line.act, line.scene)}
          </button>
        )}
        {canEdit && (
          <button type="button" className="link" onClick={() => setMode("edit")} aria-label="Edita aquesta línia">
            Edita
          </button>
        )}
        {canEdit && onInserted && (
          <button type="button" className="link" onClick={() => setMode("add")} aria-label="Afegeix una línia a sota">
            Afegeix a sota
          </button>
        )}
      </div>
    </div>
    {mode === "add" && editor}
    {dialog}
    </>
  );
}

export function CyranoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [params, setParams] = useSearchParams();
  const canEdit = isAdmin && params.get("mode") === "edicio";
  const [outline, setOutline] = useState<CyranoOutline | null>(null);
  const [lines, setLines] = useState<CyranoLine[]>([]);
  const [results, setResults] = useState<{ list: CyranoLine[]; truncated: boolean } | null>(null);
  const [all, setAll] = useState<CyranoLine[] | null>(null);
  const [seen, setSeen] = useState<{ act: number; scene: number } | null>(null);
  const [error, setError] = useState("");
  // Botó rodó que apareix quan les barres d'actes i escenes han sortit per dalt de la pantalla
  const [navsEl, setNavsEl] = useState<HTMLDivElement | null>(null);
  const [navsGone, setNavsGone] = useState(false);
  const [jumping, setJumping] = useState(false);

  // Vídeo de l'obra (si s'ha pujat): reproductor flotant, i les marques de temps salten al vídeo.
  const [video, setVideo] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [time, setTime] = useState(0);
  const player = useRef<HTMLVideoElement>(null);
  const pending = useRef<number | null>(null);
  const continuous = params.get("vista") === "continua";
  const q = params.get("q") ?? "";
  const who = params.get("personatge") ?? "";
  const searching = params.get("cerca") === "1";
  const focusId = Number(params.get("linia")) || 0;
  const terms = useMemo(() => searchTerms(q), [q]);
  const speakers = useMemo(() => outline?.speakers.map((s) => s.name) ?? [], [outline]);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  useEffect(() => {
    api.cyranoVideo().then((v) => setVideo(v.available ? v.url : null)).catch(() => setVideo(null));
  }, []);

  // Hora actual del reproductor, per posar-la a una rèplica des de l'editor.
  const currentTime = () => (playerOpen && player.current ? player.current.currentTime : null);

  function seek(seconds: number) {
    const el = player.current;
    if (!playerOpen || !el) {
      pending.current = seconds;
      setPlayerOpen(true);
    } else {
      el.currentTime = seconds;
      void el.play();
    }
  }

  // L'enllaç signat caduca: si la reproducció falla, se'n demana un de nou i es continua pel mateix punt.
  async function renew() {
    pending.current = player.current?.currentTime ?? 0;
    try {
      const v = await api.cyranoVideo();
      setVideo(v.available ? v.url : null);
    } catch {
      setVideo(null);
    }
  }

  function playerReady() {
    const el = player.current;
    if (el && pending.current !== null) {
      el.currentTime = pending.current;
      pending.current = null;
      void el.play().catch(() => undefined);
    }
  }

  useEffect(() => {
    api.cyranoOutline().then(setOutline).catch((e) => setError((e as Error).message));
  }, []);

  const first = outline?.acts.find((a) => a.act > 0) ?? outline?.acts[0];
  const act = Number(params.get("acte") ?? first?.act ?? 1);
  const actInfo = outline?.acts.find((a) => a.act === act);
  const scene = Number(params.get("escena") ?? actInfo?.scenes[0] ?? 1);
  // Mentre es llegeixen les notes, la fila d'escenes continua mostrant les de l'últim acte triat.
  const [lastAct, setLastAct] = useState(0);
  // En la vista contínua, l'acte i l'escena que es veuen els dóna el desplaçament, no l'adreça.
  const viewAct = continuous && seen ? seen.act : act;
  const viewScene = continuous && seen ? seen.scene : scene;
  useEffect(() => {
    if (viewAct > 0) setLastAct(viewAct);
  }, [viewAct]);
  const sceneAct = viewAct > 0 ? viewAct : lastAct || first?.act || 1;
  const sceneInfo = outline?.acts.find((a) => a.act === sceneAct);
  const noteInfo = outline?.acts.find((a) => a.act === 0);

  useEffect(() => {
    if (!outline || searching || !continuous || all) return;
    api.cyranoText().then((l) => { setAll(l); setError(""); }).catch((e) => setError((e as Error).message));
  }, [outline, searching, continuous, all]);

  // Llista de seccions (acte, escena) de la vista contínua, i seguiment de la que es veu.
  const sections = useMemo(() => {
    const out: { act: number; scene: number; lines: CyranoLine[] }[] = [];
    for (const l of all ?? []) {
      const last = out[out.length - 1];
      if (last && last.act === l.act && last.scene === l.scene) last.lines.push(l);
      else out.push({ act: l.act, scene: l.scene, lines: [l] });
    }
    return out;
  }, [all]);

  useEffect(() => {
    if (!continuous || searching || !sections.length) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSeen({ act: Number((e.target as HTMLElement).dataset.act), scene: Number((e.target as HTMLElement).dataset.scene) });
        }
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    document.querySelectorAll("[data-act]").forEach((el) => watcher.observe(el));
    return () => watcher.disconnect();
  }, [continuous, searching, sections]);

  // En passar a la vista contínua, es va a l'escena que es llegia.
  useEffect(() => {
    if (!continuous || searching || !sections.length || focusId) return;
    const target = act > 0 && scene === actInfo?.scenes[0] ? 0 : scene;
    requestAnimationFrame(() => document.getElementById(`s-${act}-${target}`)?.scrollIntoView({ block: "start" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuous, searching, sections.length]);

  useEffect(() => {
    if (!outline || searching || continuous) return;
    api.cyranoScene(act, scene).then((l) => { setLines(l); setError(""); }).catch((e) => setError((e as Error).message));
  }, [outline, act, scene, searching, continuous]);

  useEffect(() => {
    if (!searching) return;
    setResults(null);
    api.cyranoSearch(q, who)
      .then((r) => { setResults({ list: r.results, truncated: r.truncated }); setError(""); })
      .catch((e) => setError((e as Error).message));
  }, [searching, q, who]);

  const playingId = useMemo(() => {
    if (!playerOpen) return 0;
    let found = 0;
    let best = -1;
    for (const l of (continuous ? all : lines) ?? []) {
      if (!l.stamp) continue;
      const at = toSeconds(l.stamp);
      if (at <= time && at > best) {
        best = at;
        found = l.id;
      }
    }
    return found;
  }, [playerOpen, continuous, all, lines, time]);

  function submitSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get("q")).trim();
    const person = String(f.get("personatge"));
    if (!text && !person) return update({ q: null, personatge: null, cerca: null, linia: null });
    update({ q: text || null, personatge: person || null, cerca: "1", linia: null });
  }

  function openLine(l: CyranoLine) {
    update({ acte: String(l.act), escena: String(l.scene), linia: String(l.id), cerca: null });
  }

  function inserted(created: CyranoLine, afterId: number) {
    const put = (list: CyranoLine[]) => {
      const at = list.findIndex((l) => l.id === afterId);
      return at < 0 ? list : [...list.slice(0, at + 1), created, ...list.slice(at + 1)];
    };
    setLines(put);
    setAll((a) => a && put(a));
  }

  function toTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleted(id: number) {
    const gone = (l: CyranoLine) => l.id !== id;
    setLines((ls) => ls.filter(gone));
    setAll((a) => a && a.filter(gone));
    setResults((r) => r && { ...r, list: r.list.filter(gone) });
  }

  function saved(updated: CyranoLine) {
    const swap = (l: CyranoLine) => (l.id === updated.id ? updated : l);
    setLines((ls) => ls.map(swap));
    setAll((a) => a && a.map(swap));
    setResults((r) => r && { ...r, list: r.list.map(swap) });
  }

  useEffect(() => {
    if (!navsEl) return setNavsGone(false);
    const io = new IntersectionObserver(([e]) => e && setNavsGone(!e.isIntersecting && e.boundingClientRect.bottom < 0));
    io.observe(navsEl);
    return () => io.disconnect();
  }, [navsEl]);

  // Venint de la vista paginada, la contínua s'obre a l'escena que es llegia (sense animació).
  const place = useRef<{ act: number; scene: number } | null>(null);
  useEffect(() => {
    const to = place.current;
    if (!to || !continuous || !all || !outline) return;
    place.current = null;
    const first = outline.acts.find((a) => a.act === to.act)?.scenes[0];
    const target = to.act > 0 && to.scene === first ? 0 : to.scene;
    document.getElementById(`s-${to.act}-${target}`)?.scrollIntoView({ block: "start" });
    setSeen(to);
  }, [all, continuous, outline]);

  const ordered = outline?.acts.flatMap((a) => a.scenes.map((s) => ({ act: a.act, scene: s }))) ?? [];
  const at = ordered.findIndex((x) => x.act === act && x.scene === scene);
  const go = (to: { act: number; scene: number } | undefined) => {
    if (!to) return;
    if (!continuous) return update({ acte: String(to.act), escena: String(to.scene), linia: null, cerca: null });
    // Vista contínua: es desplaça fins a la secció (el títol de l'acte, si és la primera escena).
    const target = to.act > 0 && to.scene === outline?.acts.find((a) => a.act === to.act)?.scenes[0] ? 0 : to.scene;
    document.getElementById(`s-${to.act}-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSeen(to);
  };

  // La rèplica que és a dalt de la pantalla i a quina alçada: en canviar de vista, hi tornem.
  const anchor = useRef<{ id: number; top: number } | null>(null);
  function remember() {
    const el = Array.from(document.querySelectorAll<HTMLElement>(".cy-line[data-line]")).find((e) => e.getBoundingClientRect().bottom > 80);
    if (!el) return null;
    anchor.current = { id: Number(el.dataset.line), top: el.getBoundingClientRect().top };
    window.setTimeout(() => (anchor.current = null), 4000);
    const sec = el.closest<HTMLElement>("section[data-act]");
    return sec ? { act: Number(sec.dataset.act), scene: Number(sec.dataset.scene) } : null;
  }
  useEffect(() => {
    const a = anchor.current;
    if (!a) return;
    const el = document.querySelector<HTMLElement>(`.cy-line[data-line="${a.id}"]`);
    if (!el) return;
    anchor.current = null;
    place.current = null;
    window.scrollBy({ top: el.getBoundingClientRect().top - a.top });
  }, [lines, all, continuous]);

  function setView(paged: boolean) {
    if (paged && continuous) {
      const at = remember();
      const a = at?.act ?? viewAct;
      const sc = at?.scene ?? viewScene;
      const first = outline?.acts.find((x) => x.act === a)?.scenes[0] ?? 0;
      update({ vista: null, acte: String(a), escena: String(sc || first), linia: null });
    } else if (!paged && !continuous) {
      remember();
      place.current = { act, scene }; // si no hi ha cap rèplica a la vista, almenys l'escena
      update({ vista: "continua", linia: null });
    }
  }

  if (!outline) return error ? <ErrorMessage message={error} /> : <LoadingSpinner />;

  return (
    <section className={`cy${canEdit ? " cy-editing" : ""}`}>
      <div className="cy-title">
        <h1>Cyrano de Bergerac</h1>
        <div className="cy-switches">
          <div className="cy-modes" role="group" aria-label="Vista">
            <button type="button" className={continuous ? "" : "on"} aria-pressed={!continuous} onClick={() => setView(true)}>Paginada</button>
            <button type="button" className={continuous ? "on" : ""} aria-pressed={continuous} onClick={() => setView(false)}>Contínua</button>
          </div>
          {video && (
            <button type="button" className="cy-pdf" aria-pressed={playerOpen} onClick={() => setPlayerOpen((o) => !o)} title="Mostra o amaga el vídeo de l'obra">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M10 9.5v5l4.5-2.5z" />
              </svg>
              Vídeo
            </button>
          )}
          <a className="cy-pdf" href="/api/v1/cyrano/pdf" download="Cyrano-de-Bergerac.pdf" title="Baixa l'obra en PDF">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v10M8 10.5l4 4 4-4M5 19h14" />
            </svg>
            PDF
          </a>
          {isAdmin && (
            <div className="cy-modes" role="group" aria-label="Mode">
              <button type="button" className={canEdit ? "" : "on"} aria-pressed={!canEdit} onClick={() => update({ mode: null })}>Lectura</button>
              <button type="button" className={canEdit ? "on" : ""} aria-pressed={canEdit} onClick={() => update({ mode: "edicio" })}>Edició</button>
            </div>
          )}
        </div>
      </div>

      <form className="cy-search" role="search" onSubmit={submitSearch}>
        <input name="q" defaultValue={q} key={`q-${q}`} placeholder="Cerca una paraula, o una frase entre cometes…" aria-label="Cerca al text" />
        <select name="personatge" defaultValue={who} key={`p-${who}`} aria-label="Personatge">
          <option value="">Tots els personatges</option>
          {outline.speakers.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.lines})</option>)}
        </select>
        <button type="submit" className="cy-go">Cerca <span aria-hidden="true">→</span></button>
      </form>

      {!searching && q && (
        <p className="cy-chip">
          Ressaltant «{q}»
          <button type="button" className="link" onClick={() => update({ cerca: "1", linia: null })}>Torna als resultats</button>
          <button type="button" className="link" onClick={() => update({ q: null, personatge: null })}>Esborra</button>
        </p>
      )}

      <ErrorMessage message={error} />

      {searching ? (
        <div className="cy-results">
          {results === null ? (
            <LoadingSpinner />
          ) : (
            <>
              <p className="muted">
                {results.list.length === 0
                  ? "Cap coincidència."
                  : `${results.list.length}${results.truncated ? "+" : ""} ${results.list.length === 1 ? "línia" : "línies"}`}
                {results.truncated && " (afina la cerca per veure'n més)"}
              </p>
              {results.list.map((l) => (
                <Line key={l.id} line={l} terms={terms} focus={false} canEdit={canEdit} speakers={speakers} onSaved={saved} onDeleted={deleted} showPlace onOpen={() => openLine(l)} onSeek={video ? seek : undefined} videoTime={video ? currentTime : undefined} />
              ))}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="cy-navs" ref={setNavsEl}>
          <nav className="cy-nav" aria-label="Actes">
            <span className="cy-label">Actes:</span>
            {outline.acts.filter((a) => a.act > 0).map((a) => (
              <button key={a.act} type="button" className={`cy-tab${a.act === viewAct ? " on" : ""}`} aria-current={a.act === viewAct} onClick={() => go({ act: a.act, scene: a.scenes[0] ?? 0 })}>
                {roman(a.act)}
              </button>
            ))}
            <span className="cy-group cy-notes-sub">
              {noteInfo?.scenes.map((s) => (
                <button key={s} type="button" className={`cy-tab${viewAct === 0 && s === viewScene ? " on" : ""}`} aria-current={viewAct === 0 && s === viewScene} onClick={() => go({ act: 0, scene: s })}>
                  {sceneLabel(0, s)}
                </button>
              ))}
            </span>
          </nav>
          <div className="cy-nav cy-scenes">
            <nav className="cy-group" aria-label="Escenes">
              <span className="cy-label">Escenes:</span>
              {sceneInfo?.scenes.map((s) => (
                <button key={s} type="button" className={`cy-tab${viewAct === sceneAct && s === viewScene ? " on" : ""}`} aria-current={viewAct === sceneAct && s === viewScene} onClick={() => go({ act: sceneAct, scene: s })}>
                  {roman(s)}
                </button>
              ))}
            </nav>
          </div>
          </div>

          {continuous ? (
            all === null ? (
              <LoadingSpinner />
            ) : (
              <div className="cy-whole">
                {sections.map((sec) => (
                  <section key={`${sec.act}-${sec.scene}`} id={`s-${sec.act}-${sec.scene}`} data-act={sec.act} data-scene={sec.scene} className="cy-sec">
                    <header className="cy-head">
                      {sec.act > 0 && sec.scene === 0 ? (
                        <>
                          <p className="eyebrow">{actLabel(sec.act)}</p>
                          <h2>{sec.lines[0]?.text}</h2>
                        </>
                      ) : (
                        <p className="eyebrow">{sec.act === 0 ? sceneLabel(0, sec.scene) : `${actLabel(sec.act)} · Escena ${roman(sec.scene)}`}</p>
                      )}
                    </header>
                    {sec.lines.filter((l) => !(sec.act > 0 && sec.scene === 0 && l.kind === "title")).map((l) => (
                      <Line key={l.id} line={l} terms={terms} focus={l.id === focusId} canEdit={canEdit} speakers={speakers} onSaved={saved} onInserted={inserted} onDeleted={deleted} onSeek={video ? seek : undefined} playing={l.id === playingId} videoTime={video ? currentTime : undefined} />
                    ))}
                  </section>
                ))}
                <p className="cy-top"><button type="button" className="link" onClick={toTop}>↑ Torna al principi</button></p>
              </div>
            )
          ) : (
            <>
            <header className="cy-head">
              <p className="eyebrow">{actLabel(act)}{act > 0 && ` · Escena ${roman(scene)}`}</p>
              {act > 0 && actInfo?.title && <h2>{actInfo.title}</h2>}
            </header>

            <div className="cy-scene">
              {lines.map((l) => (
                <Line key={l.id} line={l} terms={terms} focus={l.id === focusId} canEdit={canEdit} speakers={speakers} onSaved={saved} onInserted={inserted} onDeleted={deleted} onSeek={video ? seek : undefined} playing={l.id === playingId} videoTime={video ? currentTime : undefined} />
              ))}
            </div>

            <div className="cy-pager">
              <button type="button" className="ghost" disabled={at <= 0} onClick={() => go(ordered[at - 1])}>← Anterior</button>
              <button type="button" className="ghost" disabled={at < 0 || at >= ordered.length - 1} onClick={() => go(ordered[at + 1])}>Següent →</button>
            </div>
            <p className="cy-top"><button type="button" className="link" onClick={toTop}>↑ Torna al principi</button></p>
            </>
          )}
        </>
      )}
      {outline && !searching && navsGone && (
        <button type="button" className="cy-jump-btn" aria-label="Anar a un altre acte o escena" onClick={() => setJumping(true)}>
          {viewAct === 0 ? "N" : `${roman(viewAct)}·${roman(viewScene)}`}
        </button>
      )}
      {outline && jumping && (
        <Jump
          outline={outline}
          from={{ act: sceneAct, scene: viewAct > 0 ? viewScene : sceneInfo?.scenes[0] ?? 1 }}
          continuous={continuous}
          onView={setView}
          canSwitchMode={isAdmin}
          editing={canEdit}
          onEditing={(on) => update({ mode: on ? "edicio" : null })}
          onClose={() => setJumping(false)}
          onGo={(to) => {
            setJumping(false);
            go(to);
            if (!continuous) window.scrollTo({ top: 0 });
          }}
        />
      )}
      {video && playerOpen && (
        <div className="cy-player">
          <button type="button" className="cy-player-close" aria-label="Tanca el vídeo" onClick={() => setPlayerOpen(false)}>×</button>
          <video
            ref={player}
            src={video}
            controls
            preload="metadata"
            onLoadedMetadata={playerReady}
            onTimeUpdate={(e) => setTime(Math.floor(e.currentTarget.currentTime))}
            onError={() => void renew()}
          />
        </div>
      )}
    </section>
  );
}
