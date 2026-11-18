import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { api, type Agent, type MenuItem, type Site } from "../api";
import { useAuth } from "../auth";

// Apps amb contingut delicat: el nom del botó es mostra desfigurat, perquè ningú el llegeixi de lluny.
const SENSITIVE = ["/apps/herencia/"];

function scramble(name: string): string {
  const chars = [...name].reverse();
  for (let i = 0; i + 1 < chars.length; i += 2) [chars[i], chars[i + 1]] = [chars[i + 1] as string, chars[i] as string];
  return chars.join("");
}

interface Project { name: string; envs: { id: number; env: string; url: string }[] }

/** Agrupa «projecte · AWS» i «projecte · local» en un sol projecte; el principal (no local) primer. */
function projects(sites: Site[]): Project[] {
  const byName = new Map<string, Project>();
  for (const s of sites) {
    const m = /^(.*?)\s+·\s+(.+)$/.exec(s.name);
    const name = m?.[1] ?? s.name;
    const project = byName.get(name) ?? { name, envs: [] };
    project.envs.push({ id: s.id, env: m?.[2] ?? "web", url: s.url });
    byName.set(name, project);
  }
  const rank = (env: string) => (env.toLowerCase() === "local" ? 1 : 0);
  return [...byName.values()].map((p) => ({ ...p, envs: [...p.envs].sort((a, b) => rank(a.env) - rank(b.env)) }));
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function HomePage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<MenuItem[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, s, a] = await Promise.all([api.menu(), api.sites(), api.agents()]);
      setApps(m.filter((i) => i.url !== "/hub" && i.url !== "/cyrano"));
      setSites(s);
      setAgents(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function toggle(a: Agent) {
    setError("");
    try {
      await api.setAgentEnabled(a.id, !a.enabled);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const empty = apps?.length === 0 && sites.length === 0 && agents.length === 0;

  if (apps === null && !error) return <LoadingSpinner />;

  return (
    <section>
      <h1>Hub</h1>
      <ErrorMessage message={error} />
      {empty && <p className="status">Encara no tens res assignat. Demana-ho a l'administrador.</p>}

      {!!apps?.length && (
        <>
          <h2 className="hub-title">Aplicacions</h2>
          <ul className="hub-tiles">
            {apps.map((item) => (
              <li key={item.id}>
                {(() => {
                  const hidden = SENSITIVE.includes(item.url);
                  const label = hidden ? <span className="blurred" aria-hidden="true">{scramble(item.name)}</span> : item.name;
                  const aria = hidden ? { "aria-label": item.name } : {};
                  // Les apps antigues (pàgines estàtiques) s'obren en un marc sota el menú, per poder tornar al Hub
                  const slug = /^\/apps\/([a-z0-9-]+)\/?$/.exec(item.url)?.[1];
                  return <Link to={slug ? `/app/${slug}` : item.url} {...aria}>{label}</Link>;
                })()}
              </li>
            ))}
          </ul>
        </>
      )}

      {sites.length > 0 && (
        <>
          <h2 className="hub-title">Webs</h2>
          <ul className="hub-sites">
            {projects(sites).map((p) => (
              <li key={p.name} className="hub-card">
                <h3>{p.name}</h3>
                <ul>
                  {p.envs.map((e) => (
                    <li key={e.id}>
                      <a className={`hub-env${e.env.toLowerCase() === "local" ? " local" : ""}`} href={e.url} target="_blank" rel="noreferrer" aria-label={`Obrir ${p.name} (${e.env})`}>
                        <span className="dot" aria-hidden="true" />
                        <span className="env">{e.env}</span>
                        <span className="host">{host(e.url)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {agents.length > 0 && (
        <>
          <h2 className="hub-title">Agents</h2>
          <ul className="hub-sites">
            {agents.map((a) => (
              <li key={a.id} className="hub-card">
                <h3>{a.name}</h3>
                <p className="hub-meta"><span className={`dot${a.enabled ? "" : " off"}`} aria-hidden="true" />{a.kind} · {a.enabled ? "actiu" : "aturat"}</p>
                {(user?.role === "admin" || a.can_work) && (
                  <button type="button" className="link hub-toggle" onClick={() => void toggle(a)}>{a.enabled ? "Aturar" : "Engegar"}</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
