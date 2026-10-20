import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type Agent, type MenuItem, type Site } from "../api";
import { useAuth } from "../auth";

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
      setApps(m.filter((i) => i.url !== "/hub"));
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

  return (
    <section>
      <h1>Hola, {user?.username}</h1>
      <p className="lead">Tot el que tens a acalpere, en un sol lloc.</p>
      <ErrorMessage message={error} />
      {apps === null && !error && <p className="status">Carregant…</p>}
      {empty && <p className="status">Encara no tens res assignat. Demana-ho a l'administrador.</p>}

      {!!apps?.length && (
        <>
          <h2>Aplicacions</h2>
          <ul className="grid">
            {apps.map((item) => (
              <li key={item.id}>
                {/* Les apps antigues són pàgines estàtiques: enllaç normal; la resta, ruta de l'SPA */}
                {item.url.startsWith("/apps/") ? <a href={item.url}>{item.name}</a> : <Link to={item.url}>{item.name}</Link>}
              </li>
            ))}
          </ul>
        </>
      )}

      {sites.length > 0 && (
        <>
          <h2>Webs</h2>
          <ul className="projects">
            {sites.map((s) => (
              <li key={s.id} className="project">
                <h3>{s.name}</h3>
                <p>{host(s.url)}</p>
                <div className="actions">
                  <a className="btn" href={s.url} target="_blank" rel="noreferrer">Obrir</a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {agents.length > 0 && (
        <>
          <h2>Agents</h2>
          <ul className="projects">
            {agents.map((a) => (
              <li key={a.id} className="project">
                <h3>{a.name}</h3>
                <p>{a.kind} · {a.enabled ? "actiu" : "aturat"}</p>
                {(user?.role === "admin" || a.can_work) && (
                  <div className="actions">
                    <button className="ghost" onClick={() => void toggle(a)}>{a.enabled ? "Aturar" : "Engegar"}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
