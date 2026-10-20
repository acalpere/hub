import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Agent, type Site } from "../api";

const STATUSES = ["active", "paused", "archived"];

export function HubPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.sites(), api.agents()]);
      setSites(s);
      setAgents(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function addSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void run(async () => {
      await api.createSite({ name: String(f.get("name")), url: String(f.get("url")), status: "active", notes: "" });
      form.reset();
    });
  }

  function addAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const siteId = String(f.get("site_id"));
    void run(async () => {
      await api.createAgent({
        name: String(f.get("name")),
        kind: String(f.get("kind")),
        enabled: true,
        site_id: siteId ? Number(siteId) : null,
        config: {},
      });
      form.reset();
    });
  }

  return (
    <section>
      <h1>Webs i agents</h1>
      {error && <p role="alert" className="error">{error}</p>}

      <h2>Webs</h2>
      <ul className="rows">
        {sites.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
            <select value={s.status} onChange={(e) => void run(() => api.updateSite(s.id, { status: e.target.value }))}>
              {STATUSES.map((st) => <option key={st}>{st}</option>)}
            </select>
            <button className="link danger" onClick={() => confirm(`Eliminar ${s.name}?`) && void run(() => api.deleteSite(s.id))}>
              Eliminar
            </button>
          </li>
        ))}
        {sites.length === 0 && <li className="muted">Cap web encara.</li>}
      </ul>
      <form className="inline" onSubmit={addSite}>
        <input name="name" placeholder="Nom" required />
        <input name="url" placeholder="https://…" type="url" required />
        <button type="submit">Afegir web</button>
      </form>

      <h2>Agents</h2>
      <ul className="rows">
        {agents.map((a) => (
          <li key={a.id}>
            <span>
              {a.name} <span className="muted">({a.kind}{a.site_id ? ` · ${sites.find((s) => s.id === a.site_id)?.name ?? "?"}` : ""})</span>
            </span>
            <label className="check">
              <input type="checkbox" checked={a.enabled} onChange={(e) => void run(() => api.updateAgent(a.id, { enabled: e.target.checked }))} />
              actiu
            </label>
            <button className="link danger" onClick={() => confirm(`Eliminar ${a.name}?`) && void run(() => api.deleteAgent(a.id))}>
              Eliminar
            </button>
          </li>
        ))}
        {agents.length === 0 && <li className="muted">Cap agent encara.</li>}
      </ul>
      <form className="inline" onSubmit={addAgent}>
        <input name="name" placeholder="Nom" required />
        <input name="kind" placeholder="Tipus (marketing…)" required />
        <select name="site_id" defaultValue="">
          <option value="">Sense web</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit">Afegir agent</button>
      </form>
    </section>
  );
}
