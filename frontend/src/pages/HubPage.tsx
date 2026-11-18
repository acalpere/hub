import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ErrorMessage } from "../components/ErrorMessage";
import { api, type Agent, type Site } from "../api";
import { useAuth } from "../auth";
import { validate } from "../forms";

// L'estat és només una etiqueta d'organització (el servidor desa «active», «paused», «archived»).
const STATUS_LABELS: Record<string, string> = { active: "Activa", paused: "Aturada", archived: "Arxivada" };
const STATUSES = Object.keys(STATUS_LABELS);

export function HubPage() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
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
    const problem = validate(form);
    if (problem) return setError(problem);
    const f = new FormData(form);
    void run(async () => {
      await api.createSite({ name: String(f.get("name")), url: String(f.get("url")), status: "active", notes: "" });
      form.reset();
    });
  }

  function addAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const problem = validate(form);
    if (problem) return setError(problem);
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
      <h1>Hub</h1>
      <ErrorMessage message={error} />

      <div className="hub-block">
      <h2>Webs</h2>
      <aside className="hub-note">
        <p>
          <strong>Estat.</strong> <em>Activa</em>: la web és en ús. <em>Aturada</em>: en pausa de moment. <em>Arxivada</em>: ja no es fa servir.
          És només una etiqueta per organitzar-les; no canvia res a la web.
        </p>
        <p>
          <strong>Eliminar del hub</strong> treu la web d'aquesta llista i de les autoritzacions dels usuaris. La web real no es toca.
        </p>
      </aside>
      <ul className="rows table">
        {sites.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
            {admin ? (
              <>
                <select value={s.status} onChange={(e) => void run(() => api.updateSite(s.id, { status: e.target.value }))}>
                  {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                </select>
                <button className="link danger" onClick={() => confirm(`Eliminar ${s.name} del hub? La web real no es toca.`) && void run(() => api.deleteSite(s.id))}>
                  Eliminar del hub
                </button>
              </>
            ) : (
              <span className="muted">{STATUS_LABELS[s.status] ?? s.status}</span>
            )}
          </li>
        ))}
        {sites.length === 0 && <li className="muted">{admin ? "Cap web encara." : "No tens cap web assignada."}</li>}
      </ul>
      {admin && <form className="inline" noValidate onSubmit={addSite}>
        <input name="name" placeholder="Nom" required />
        <input name="url" placeholder="https://…" type="url" required />
        <button type="submit">Afegir web</button>
      </form>}
      </div>

      <div className="hub-block">
      <h2>Agents</h2>
      <ul className="rows table">
        {agents.map((a) => (
          <li key={a.id}>
            <span>
              {a.name} <span className="muted">({a.kind}{a.site_id ? ` · ${sites.find((s) => s.id === a.site_id)?.name ?? "—"}` : ""})</span>
            </span>
            {admin ? (
              <>
                <label className="check">
                  <input type="checkbox" checked={a.enabled} onChange={(e) => void run(() => api.updateAgent(a.id, { enabled: e.target.checked }))} />
                  actiu
                </label>
                <button className="link danger" onClick={() => confirm(`Eliminar ${a.name} del hub?`) && void run(() => api.deleteAgent(a.id))}>
                  Eliminar del hub
                </button>
              </>
            ) : (
              <span className="muted">{a.enabled ? "actiu" : "aturat"}</span>
            )}
          </li>
        ))}
        {agents.length === 0 && <li className="muted">{admin ? "Cap agent encara." : "No tens cap agent assignat."}</li>}
      </ul>
      {admin && <form className="inline" noValidate onSubmit={addAgent}>
        <input name="name" placeholder="Nom" required />
        <input name="kind" placeholder="Tipus (marketing…)" required />
        <select name="site_id" defaultValue="">
          <option value="">Sense web</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit">Afegir agent</button>
      </form>}
      </div>
    </section>
  );
}
