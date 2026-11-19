import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type CustomNeed } from "../api";
import { ConceptDialog } from "../components/ConceptDialog";
import { TutorChat } from "../components/TutorChat";
import { ARCHITECTURES, CATEGORIES, SERVICES, architectureBySlug, serviceBySlug } from "../aws/content";
import { NEEDS, needsForService } from "../aws/needs";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Portada d'AWS: el logo, un camp per preguntar el que sigui i tres fitxes (Serveis, Arquitectura, Quiz).
export function AwsHome() {
  return (
    <section className="aws aws-home">
      <nav className="aws-tiles" aria-label="Seccions d'AWS">
        <Link to="/aws/serveis" className="tile tile-serveis">
          <strong>Serveis</strong>
          <span>{SERVICES.length} serveis explicats, per categoria</span>
        </Link>
        <Link to="/aws/arquitectures" className="tile tile-arquitectura">
          <strong>Arquitectura</strong>
          <span>{ARCHITECTURES.length} patrons de disseny de referència</span>
        </Link>
        <Link to="/aws/necessitats" className="tile tile-necessitats">
          <strong>Necessitats</strong>
          <span>{NEEDS.length} necessitats (latència, RTO, pics…) i els serveis que hi ajuden</span>
        </Link>
        <Link to="/aws/calaix" className="tile tile-calaix">
          <strong>Calaix de sastre</strong>
          <span>Les respostes del tutor que has desat, amb la pregunta com a títol</span>
        </Link>
        <Link to="/aws/quiz" className="tile tile-quiz">
          <strong>Quiz</strong>
          <span>Explicacions per nivell i preguntes amb la resposta amagada</span>
        </Link>
      </nav>
    </section>
  );
}

// Tots els serveis: un desplegable per saltar-hi directament i la llista per categories (també desplegables).
export function AwsServices() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const query = norm(q.trim());
  const services = useMemo(
    () => SERVICES.filter((s) => !query || norm(`${s.name} ${s.tagline} ${s.category}`).includes(query)),
    [query],
  );
  return (
    <section className="aws">
      <p className="aws-back"><Link to="/aws">← AWS</Link></p>
      <h1>Serveis</h1>
      <select
        className="aws-jump"
        aria-label="Tria un servei"
        value=""
        onChange={(e) => e.target.value && navigate(`/aws/serveis/${e.target.value}`)}
      >
        <option value="">Tria un servei ({SERVICES.length})…</option>
        {CATEGORIES.map((cat) => (
          <optgroup key={cat} label={cat}>
            {SERVICES.filter((s) => s.category === cat).map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </optgroup>
        ))}
      </select>
      <input
        type="search"
        className="aws-search"
        placeholder="O cerca per nom o descripció…"
        aria-label="Cerca"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {services.length === 0 && <p className="muted">Res no coincideix.</p>}
      {CATEGORIES.map((cat) => {
        const items = services.filter((s) => s.category === cat);
        if (!items.length) return null;
        return (
          <details key={cat} className="aws-group" open={!!query}>
            <summary>{cat} <span className="muted">({items.length})</span></summary>
            <ul className="aws-list">
              {items.map((s) => (
                <li key={s.slug}>
                  <Link to={`/aws/serveis/${s.slug}`}>
                    <strong>{s.name}</strong>
                    <span>{s.tagline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

export function AwsArchitectures() {
  return (
    <section className="aws">
      <p className="aws-back"><Link to="/aws">← AWS</Link></p>
      <h1>Arquitectura</h1>
      <ul className="aws-list">
        {ARCHITECTURES.map((a) => (
          <li key={a.slug}>
            <Link to={`/aws/arquitectures/${a.slug}`}>
              <strong>{a.name}</strong>
              <span>{a.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Serveis del catàleg breu (sense apunts escrits): el tutor els explica quan es demana.
function ExplainNow({ name }: { name: string }) {
  const [on, setOn] = useState(false);
  return on ? (
    <TutorChat service={name} concept="visió general: què és, quan usar-lo, conceptes clau i límits" autoStart placeholder="Pregunta'n més…" />
  ) : (
    <p>
      <span className="muted">Encara no hi ha apunts escrits d'aquest servei. </span>
      <button type="button" onClick={() => setOn(true)}>Explica'm aquest servei</button>
    </p>
  );
}

// Nivell de coneixement de cada fitxa (es desa al servidor): 1 vermell (no en tinc idea) … 4 verd (ho domino).
const LEVEL_NAMES = ["", "No en tinc idea", "Poc", "Prou bé", "El domino"];

function useMarks() {
  const [marks, setMarks] = useState<Record<string, number>>({});
  useEffect(() => void api.awsMarks().then(setMarks).catch(() => undefined), []);
  function setMark(key: string, level: number) {
    const before = marks;
    setMarks((m) => {
      const n = { ...m };
      if (level) n[key] = level;
      else delete n[key];
      return n;
    });
    api.setAwsMark(key, level).catch(() => setMarks(before));
  }
  return { marks, setMark };
}

// Quatre punts de color (de vermell a verd); tocar el que ja està triat treu la marca.
function Knowledge({ value, onChange }: { value: number; onChange: (level: number) => void }) {
  return (
    <span className="know" role="group" aria-label="Nivell de coneixement">
      {[1, 2, 3, 4].map((l) => (
        <button
          key={l}
          type="button"
          className={`know-dot lv-${l}${value === l ? " on" : ""}`}
          title={LEVEL_NAMES[l]}
          aria-label={LEVEL_NAMES[l]}
          aria-pressed={value === l}
          onClick={() => onChange(value === l ? 0 : l)}
        />
      ))}
    </span>
  );
}

// Una necessitat, de les del catàleg o de les creades pel tutor, amb la mateixa forma.
interface NeedView {
  slug: string; name: string; tagline: string; what: string; custom: boolean; id?: number;
  services: { slug?: string; name: string; why: string }[];
}

function resolveService(name: string): string | undefined {
  const n = norm(name.trim());
  return (SERVICES.find((s) => norm(s.name) === n) ?? SERVICES.find((s) => n.length > 2 && (norm(s.name).startsWith(n) || n.startsWith(norm(s.name)))))?.slug;
}

function allNeeds(custom: CustomNeed[]): NeedView[] {
  const fixed: NeedView[] = NEEDS.map((n) => ({
    ...n,
    custom: false,
    services: n.services.map((s) => ({ slug: s.slug, name: serviceBySlug(s.slug)?.name ?? s.slug, why: s.why })),
  }));
  const own: NeedView[] = custom.map((n) => ({
    slug: n.slug, name: n.name, tagline: n.tagline, what: n.what, custom: true, id: n.id,
    services: n.services.map((s) => ({ slug: resolveService(s.name), name: s.name, why: s.why })),
  }));
  return [...fixed, ...own];
}

function useCustomNeeds() {
  const [custom, setCustom] = useState<CustomNeed[]>([]);
  useEffect(() => void api.awsNeeds().then(setCustom).catch(() => undefined), []);
  return { custom, setCustom };
}

// Diccionari de necessitats: cada una porta als serveis que hi tenen a veure i explica per què.
// Es pot cercar i també crear-ne de noves (el tutor n'omple la fitxa).
export function AwsNeeds() {
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { custom, setCustom } = useCustomNeeds();
  const { marks, setMark } = useMarks();
  const query = norm(q.trim());
  const all = allNeeds(custom);
  const needs = all.filter((n) => !query || norm(`${n.name} ${n.tagline} ${n.what}`).includes(query));

  async function create(name: string) {
    name = name.trim();
    if (name.length < 3) return setError("Escriu el nom de la necessitat.");
    if (all.some((n) => norm(n.name) === norm(name))) return setError("Aquesta necessitat ja existeix.");
    setBusy(true);
    setError("");
    try {
      const n = await api.createAwsNeed(name);
      setCustom((c) => [...c, n]);
      setFresh("");
      setQ("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="aws">
      <p className="aws-back"><Link to="/aws">← AWS</Link></p>
      <h1>Necessitats</h1>
      <p className="lead">Què demana el negoci → quins serveis hi ajuden i per què.</p>
      <input type="search" className="aws-search need-search" placeholder="Cerca una necessitat" aria-label="Cerca una necessitat" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorMessage message={error} />
      {needs.length === 0 && (
        <p className="muted">
          Cap necessitat coincideix.{" "}
          {q.trim() && <button type="button" className="link" disabled={busy} onClick={() => void create(q)}>{busy ? "Preparant…" : `Crea «${q.trim()}» amb el tutor`}</button>}
        </p>
      )}
      <ul className="mini-cards">
        {needs.map((n) => (
          <li key={n.slug} className={`mini-card lv-${marks[`need:${n.slug}`] ?? 0}`}>
            <Link to={`/aws/necessitats/${n.slug}`}>{n.name}</Link>
            <span>{n.tagline}</span>
            <Knowledge value={marks[`need:${n.slug}`] ?? 0} onChange={(l) => setMark(`need:${n.slug}`, l)} />
          </li>
        ))}
      </ul>
      <form className="need-new" onSubmit={(e) => { e.preventDefault(); void create(fresh); }}>
        <input value={fresh} onChange={(e) => setFresh(e.target.value)} maxLength={80} placeholder="Crea una necessitat nova (p. ex. «baixa latència d'escriptura»)" aria-label="Nova necessitat" />
        <button type="submit" disabled={busy || fresh.trim().length < 3}>{busy ? "Preparant la fitxa…" : "Crea-la"}</button>
      </form>
      <p className="muted small">El tutor omple la fitxa (explicació i serveis amb el motiu). Pot equivocar-se: revisa-la. Els punts de color de cada fitxa marquen com la domines: vermell, no en tens idea; verd, la domines.</p>
    </section>
  );
}

export function AwsNeed() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const { custom, setCustom } = useCustomNeeds();
  const { marks, setMark } = useMarks();
  const n = allNeeds(custom).find((x) => x.slug === slug);
  if (!n) return <NotFound />;
  const key = `need:${n.slug}`;
  return (
    <section className="aws aws-page">
      <p className="aws-back"><Link to="/aws/necessitats">← Necessitats</Link></p>
      <p className="aws-cat">{n.custom ? "Necessitat pròpia" : "Necessitat"}</p>
      <h1>{n.name}</h1>
      <p className="lead">{n.tagline}</p>
      <p><Knowledge value={marks[key] ?? 0} onChange={(l) => setMark(key, l)} /></p>
      <p>{n.what}</p>
      <h2>Serveis que hi ajuden</h2>
      <ul className="need-services">
        {n.services.map((s) => (
          <li key={s.name}>
            {s.slug ? <Link to={`/aws/serveis/${s.slug}`}><strong>{s.name}</strong></Link> : <strong>{s.name}</strong>}
            <span>{s.why}</span>
          </li>
        ))}
      </ul>
      <p className="need-actions">
        <button type="button" onClick={() => setAsking(true)}>Explica-ho amb més profunditat</button>
        {n.custom && (
          <button
            type="button"
            className="link danger"
            onClick={() => confirm(`Eliminar «${n.name}»?`) && void api.deleteAwsNeed(n.id!).then(() => { setCustom((c) => c.filter((x) => x.id !== n.id)); setMark(key, 0); navigate("/aws/necessitats"); })}
          >
            Elimina la fitxa
          </button>
        )}
      </p>
      {asking && <ConceptDialog service="AWS" concept={`la necessitat «${n.name}» i quins serveis hi ajuden i per què`} onClose={() => setAsking(false)} />}
    </section>
  );
}

function Related({ slugs = [] }: { slugs?: string[] }) {
  const items = slugs.map(serviceBySlug).filter((s) => !!s);
  if (!items.length) return null;
  return (
    <>
      <h2>Serveis relacionats</h2>
      <p className="aws-chips">
        {items.map((s) => (
          <Link key={s!.slug} to={`/aws/serveis/${s!.slug}`} className="aws-chip">{s!.name}</Link>
        ))}
      </p>
    </>
  );
}

// Llista de punts; cada un acaba amb un «?» que n'obre l'explicació més profunda (i preguntes) del tutor.
function Bullets({ title, items, topic, onAsk }: { title: string; items?: string[]; topic: string; onAsk: (a: { service: string; concept: string }) => void }) {
  if (!items?.length) return null;
  return (
    <>
      <h2>{title}</h2>
      <ul className="aws-points">
        {items.map((t) => (
          <li key={t}>
            {t}{" "}
            <button type="button" className="why" aria-label={`Més detalls: ${t}`} onClick={() => onAsk({ service: topic, concept: t })}>?</button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AwsService() {
  const { slug = "" } = useParams();
  const s = serviceBySlug(slug);
  const [asking, setAsking] = useState<{ service: string; concept: string } | null>(null);
  if (!s) return <NotFound />;
  return (
    <section className="aws aws-page">
      <p className="aws-back"><Link to="/aws/serveis">← Serveis</Link></p>
      <p className="aws-cat">{s.category}</p>
      <h1>{s.name}</h1>
      <p className="lead">{s.tagline}</p>
      {s.what ? <p>{s.what}</p> : <ExplainNow name={s.name} />}
      <Bullets title="Conceptes clau" items={s.concepts} topic={s.name} onAsk={setAsking} />
      <Bullets title="Quan usar-lo" items={s.useWhen} topic={s.name} onAsk={setAsking} />
      <Bullets title="Compte amb…" items={s.watch} topic={s.name} onAsk={setAsking} />
      <p><Link to={`/aws/quiz?tema=${encodeURIComponent(s.name)}`} className="study-link">Quiz i explicació de {s.name} →</Link></p>
      {needsForService(s.slug).length > 0 && (
        <>
          <h2>Necessitats que cobreix</h2>
          <p className="aws-chips">
            {needsForService(s.slug).map((n) => (
              <Link key={n.slug} to={`/aws/necessitats/${n.slug}`} className="aws-chip">{n.name}</Link>
            ))}
          </p>
        </>
      )}
      <Related slugs={s.related} />
      {asking && <ConceptDialog {...asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

export function AwsArchitecture() {
  const { slug = "" } = useParams();
  const a = architectureBySlug(slug);
  const [asking, setAsking] = useState<{ service: string; concept: string } | null>(null);
  if (!a) return <NotFound />;
  return (
    <section className="aws aws-page">
      <p className="aws-back"><Link to="/aws/arquitectures">← Arquitectura</Link></p>
      <p className="aws-cat">Arquitectura</p>
      <h1>{a.name}</h1>
      <p className="lead">{a.tagline}</p>
      <h2>Recorregut</h2>
      <ol className="aws-flow">{a.flow.map((t) => <li key={t}>{t}</li>)}</ol>
      <h2>Per què així</h2>
      <p>{a.why}</p>
      <Bullets title="Contrapartides" items={a.tradeoffs} topic={a.name} onAsk={setAsking} />
      <Related slugs={a.services} />
      {asking && <ConceptDialog {...asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

function NotFound() {
  return (
    <section className="aws">
      <p className="aws-back"><Link to="/aws">← AWS</Link></p>
      <p className="muted">No hi ha aquesta pàgina.</p>
    </section>
  );
}
