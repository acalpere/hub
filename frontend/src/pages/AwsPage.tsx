import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type CustomNeed } from "../api";
import { ConceptDialog } from "../components/ConceptDialog";
import { TutorChat } from "../components/TutorChat";
import { CenterSpinner } from "../components/LoadingSpinner";
import { BriefSection, ServiceBrief } from "../components/ServiceBrief";
import { ARCHITECTURES, CATEGORIES, SERVICES, architectureBySlug, serviceBySlug } from "../aws/content";
import { NEEDS, needsForService } from "../aws/needs";
import { serviceIcon } from "../aws/icons";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ICONS: Record<string, string> = {
  serveis: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  arquitectura: "M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5",
  necessitats: "M12 4a8 8 0 100 16 8 8 0 000-16zM12 9a3 3 0 100 6 3 3 0 000-6z",
  calaix: "M4 5h16v14H4zM4 13h5l1 2h4l1-2h5",
  quiz: "M12 3a9 9 0 100 18 9 9 0 000-18zM9.6 9.6a2.4 2.4 0 114.2 1.6c-.8.8-1.8 1.2-1.8 2.4M12 17v.01",
};

function HomeTile({ to, kind, title, text, count }: { to: string; kind: keyof typeof ICONS; title: string; text: string; count?: number }) {
  return (
    <Link to={to} className={`tile tile-${kind}`}>
      <span className="tile-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={ICONS[kind]} /></svg>
      </span>
      <span className="tile-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      {count !== undefined && <span className="tile-count">{count}</span>}
    </Link>
  );
}

// Portada d'AWS: títol amb el logo i, a sota, les seccions com a fitxes amb icona.
export function AwsHome() {
  return (
    <section className="aws aws-home">
      <nav className="aws-tiles" aria-label="Seccions d'AWS">
        <HomeTile to="/aws/serveis" kind="serveis" title="Serveis" text="Què fa cada servei, per categoria" count={SERVICES.length} />
        <HomeTile to="/aws/arquitectures" kind="arquitectura" title="Arquitectura" text="Patrons de disseny de referència" count={ARCHITECTURES.length} />
        <HomeTile to="/aws/necessitats" kind="necessitats" title="Necessitats" text="Latència, RTO, pics… i els serveis que hi ajuden" count={NEEDS.length} />
        <HomeTile to="/aws/quiz" kind="quiz" title="Quiz" text="Explicacions per nivell i preguntes" />
        <HomeTile to="/aws/calaix" kind="calaix" title="Calaix de sastre" text="Les respostes del model que has desat" />
      </nav>
    </section>
  );
}

// Tots els serveis: un desplegable per saltar-hi directament i la llista per categories (també desplegables).
export function AwsServices() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const query = norm(q.trim());
  const [params] = useSearchParams();
  const openCat = CATEGORIES.find((c) => c === params.get("cat")) ?? null;
  // Sense cerca ni categoria triada: fitxes de categories. Si no, les fitxes dels serveis (de la categoria o de la cerca).

  const services = useMemo(
    () => SERVICES.filter((s) => !query || norm(`${s.name} ${s.tagline} ${s.category}`).includes(query)),
    [query],
  );
  const showCats = !query && !openCat;
  const shown = services.filter((s) => query || s.category === openCat);
  return (
    <section className="aws">
      <h1>{openCat && !query ? openCat : "Serveis"}</h1>
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
      {showCats ? (
        <ul className="mini-cards cat-cards">
          {CATEGORIES.map((cat) => (
            <li key={cat} className="mini-card">
              <Link to={`/aws/serveis?cat=${encodeURIComponent(cat)}`}>{cat}</Link>
              <span>{SERVICES.filter((s) => s.category === cat).length} serveis</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mini-cards service-cards">
          {shown.map((s) => (
            <li key={s.slug} className="mini-card">
              <Link to={`/aws/serveis/${s.slug}`}>
                {serviceIcon(s.slug) && <img className="svc-icon" src={serviceIcon(s.slug)!} alt="" width={28} height={28} />}
                {s.name}
              </Link>
              <span>{s.tagline}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AwsArchitectures() {
  return (
    <section className="aws">
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
      <h1>Necessitats</h1>
      <p className="lead">Què demana el negoci: quins serveis hi ajuden i per què.</p>
      <input type="search" className="aws-search need-search" placeholder="Cerca una necessitat" aria-label="Cerca una necessitat" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorMessage message={error} />
      {needs.length === 0 && (
        <p className="muted">
          Cap necessitat coincideix.{" "}
          {q.trim() && <button type="button" className="link" disabled={busy} onClick={() => void create(q)}>{busy ? "Preparant…" : `Crea «${q.trim()}» amb el model`}</button>}
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
        {busy && <CenterSpinner label="Preparant la fitxa…" />}
      </form>
      <p className="muted small">El model omple la fitxa (explicació i serveis amb el motiu). Pot equivocar-se: revisa-la. Els punts de color de cada fitxa marquen com la domines: vermell, no en tens idea; verd, la domines.</p>
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
      {n.custom && <p className="aws-cat">Necessitat pròpia</p>}
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

function RelatedChips({ slugs = [] }: { slugs?: string[] }) {
  const items = slugs.map(serviceBySlug).filter((s) => !!s);
  if (!items.length) return null;
  return (
    <BriefSection title="Serveis relacionats">
      <p className="aws-chips">
        {items.map((s) => (
          <Link key={s!.slug} to={`/aws/serveis/${s!.slug}`} className="aws-chip">{s!.name}</Link>
        ))}
      </p>
    </BriefSection>
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
  const [more, setMore] = useState(false);
  if (!s) return <NotFound />;
  return (
    <section className="aws aws-page">
      <h1 className="svc-title">
        {serviceIcon(s.slug) && <img className="svc-icon" src={serviceIcon(s.slug)!} alt="" width={40} height={40} />}
        {s.name}
      </h1>
      <p className="lead">{s.tagline}</p>
      <ServiceBrief name={s.name}>
        {needsForService(s.slug).length > 0 && (
          <BriefSection title="Necessitats que cobreix">
            <p className="aws-chips">
              {needsForService(s.slug).map((n) => (
                <Link key={n.slug} to={`/aws/necessitats/${n.slug}`} className="aws-chip">{n.name}</Link>
              ))}
            </p>
          </BriefSection>
        )}
        <RelatedChips slugs={s.related?.length ? s.related : SERVICES.filter((x) => x.category === s.category && x.slug !== s.slug).slice(0, 6).map((x) => x.slug)} />
      </ServiceBrief>
      <p>
        <button type="button" className="ghost more-btn" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? "Amaga els detalls" : "Més detalls"}
        </button>
      </p>
      {more && (
        <div className="more-details">
          {s.what && (
            <>
              <Bullets title="Conceptes clau" items={s.concepts} topic={s.name} onAsk={setAsking} />
              <Bullets title="Compte amb…" items={s.watch} topic={s.name} onAsk={setAsking} />
            </>
          )}
          <TutorChat
            service={s.name}
            concept="ampliació en profunditat: límits i quotes, rendiment, seguretat, fallades habituals, integracions amb altres serveis i trucs d'operació; sense repetir la definició, quan usar-lo, els avantatges ni els inconvenients"
            autoStart
            placeholder="Pregunta'n més…"
          />
        </div>
      )}
      <p className="quiz-cta-wrap">
        <Link to={`/aws/quiz?tema=${encodeURIComponent(s.name)}`} className="quiz-cta">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zM9.6 9.6a2.4 2.4 0 114.2 1.6c-.8.8-1.8 1.2-1.8 2.4M12 17v.01" /></svg>
          Quiz de {s.name}
        </Link>
      </p>
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
      <p className="muted">No hi ha aquesta pàgina.</p>
    </section>
  );
}
