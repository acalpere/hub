import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { api, type Access, type Agent, type Content, type Role, type Site, type User } from "../api";

function toggle(list: number[], id: number, on: boolean): number[] {
  return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </svg>
  );
}

interface Catalog { contents: Content[]; sites: Site[]; agents: Agent[] }

function AccessEditor({ user, catalog }: { user: User; catalog: Catalog }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [state, setState] = useState("");

  useEffect(() => {
    api.userAccess(user.id).then(setAccess).catch((e) => setState(e.message));
  }, [user.id]);

  if (!access) return <p className="status">{state || "Carregant…"}</p>;
  const a = access;
  const set = (patch: Partial<Access>) => setAccess({ ...a, ...patch });

  async function save() {
    setState("Desant…");
    try {
      setAccess(await api.setUserAccess(user.id, a));
      setState("Desat");
    } catch (e) {
      setState((e as Error).message);
    }
  }

  const none = <span className="muted">Res a assignar.</span>;
  return (
    <>
      <div className="access">
        <fieldset>
          <legend>Aplicacions</legend>
          {catalog.contents.map((c) => {
            const byRole = c.roles.includes(user.role);
            return (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  disabled={byRole}
                  checked={byRole || a.content_ids.includes(c.id)}
                  onChange={(e) => set({ content_ids: toggle(a.content_ids, c.id, e.target.checked) })}
                />
                {c.name}{byRole && <span className="muted"> (pel rol)</span>}
              </label>
            );
          })}
          {catalog.contents.length === 0 && none}
        </fieldset>
        <fieldset>
          <legend>Webs</legend>
          {catalog.sites.map((s) => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={a.site_ids.includes(s.id)}
                onChange={(e) => set({ site_ids: toggle(a.site_ids, s.id, e.target.checked) })}
              />
              {s.name}
            </label>
          ))}
          {catalog.sites.length === 0 && none}
        </fieldset>
        <fieldset>
          <legend>Agents</legend>
          {catalog.agents.map((g) => (
            <div key={g.id} className="agent-row">
              <span>{g.name}</span>
              <label className="check">
                <input
                  type="checkbox"
                  checked={a.agent_ids.includes(g.id)}
                  onChange={(e) =>
                    set({
                      agent_ids: toggle(a.agent_ids, g.id, e.target.checked),
                      work_agent_ids: e.target.checked ? a.work_agent_ids : toggle(a.work_agent_ids, g.id, false),
                    })
                  }
                />
                veure
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={a.work_agent_ids.includes(g.id)}
                  onChange={(e) =>
                    set({
                      work_agent_ids: toggle(a.work_agent_ids, g.id, e.target.checked),
                      agent_ids: e.target.checked ? toggle(a.agent_ids, g.id, true) : a.agent_ids,
                    })
                  }
                />
                treballar
              </label>
            </div>
          ))}
          {catalog.agents.length === 0 && none}
        </fieldset>
      </div>
      <button onClick={() => void save()}>Desar</button> <span className="muted">{state}</span>
    </>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ contents: [], sites: [], agents: [] });
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Cada petició per separat: si una falla, la llista d'usuaris no es queda en blanc.
  const load = useCallback(async () => {
    const [u, contents, sites, agents] = await Promise.allSettled([api.users(), api.contents(), api.sites(), api.agents()]);
    const failed = [u, contents, sites, agents].find((r) => r.status === "rejected");
    setError(failed?.status === "rejected" ? (failed.reason as Error).message : "");
    if (u.status === "fulfilled") setUsers(u.value);
    setCatalog((c) => ({
      contents: contents.status === "fulfilled" ? contents.value : c.contents,
      sites: sites.status === "fulfilled" ? sites.value : c.sites,
      agents: agents.status === "fulfilled" ? agents.value : c.agents,
    }));
  }, []);
  useEffect(() => void load(), [load]);

  const others = users.filter((u) => u.id !== me?.id); // un mateix no es mostra

  async function addUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError("");
    try {
      await api.createUser({ username: String(f.get("username")), password: String(f.get("password")), role: String(f.get("role")) as Role });
      form.reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Usuaris</h1>
      <p className="lead">Decideix què veu cada usuari. Els administradors ho veuen tot.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <ul className="rows">
        {others.map((u) => (
          <li key={u.id}>
            <span>{u.username} <span className="muted">({u.role})</span></span>
            {u.role === "admin" ? (
              <span className="muted">Ho veu tot</span>
            ) : (
              <button
                className={`icon-btn${open === u.id ? " on" : ""}`}
                aria-label={`Autoritzacions de ${u.username}`}
                title="Autoritzacions"
                onClick={() => setOpen(open === u.id ? null : u.id)}
              >
                <KeyIcon />
              </button>
            )}
            {open === u.id && (
              <div style={{ flexBasis: "100%" }}>
                <AccessEditor user={u} catalog={catalog} />
              </div>
            )}
          </li>
        ))}
        {others.length === 0 && <li className="muted">Encara no hi ha cap altre usuari.</li>}
      </ul>
      <h2>Nou usuari</h2>
      <form className="inline" onSubmit={addUser}>
        <input name="username" placeholder="Usuari" required />
        <input name="password" type="password" placeholder="Clau (mín. 8)" minLength={8} required />
        <select name="role" defaultValue="usuari">
          <option value="usuari">usuari</option>
          <option value="germa">germà</option>
          <option value="admin">admin</option>
        </select>
        <button type="submit">Crear</button>
      </form>
    </section>
  );
}
