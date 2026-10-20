import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Access, type Agent, type Content, type Profile, type Role, type Site, type User } from "../api";
import { useAuth } from "../auth";
import { ErrorMessage } from "../components/ErrorMessage";
import { validate } from "../forms";

const NO_ACCESS: Access = { site_ids: [], agent_ids: [], work_agent_ids: [], content_ids: [] };

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

// Caselles d'autoritzacions: es fan servir tant en crear com en editar un usuari.
function AccessFields({ value: a, onChange, catalog }: { value: Access; onChange: (a: Access) => void; catalog: Catalog }) {
  const set = (patch: Partial<Access>) => onChange({ ...a, ...patch });
  const none = <span className="muted">Res a assignar.</span>;
  return (
    <div className="access">
      <fieldset>
        <legend>Aplicacions</legend>
        {catalog.contents.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={a.content_ids.includes(c.id)} onChange={(e) => set({ content_ids: toggle(a.content_ids, c.id, e.target.checked) })} />
            {c.name}
          </label>
        ))}
        {catalog.contents.length === 0 && none}
      </fieldset>
      <fieldset>
        <legend>Webs</legend>
        {catalog.sites.map((s) => (
          <label key={s.id} className="check">
            <input type="checkbox" checked={a.site_ids.includes(s.id)} onChange={(e) => set({ site_ids: toggle(a.site_ids, s.id, e.target.checked) })} />
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
  );
}

interface Form extends Profile { username: string; role: Role; password: string }

function ProfileFields({ form, onChange, creating }: { form: Form; onChange: (f: Form) => void; creating: boolean }) {
  const field = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>
      {label}
      <input value={form[key]} onChange={(e) => onChange({ ...form, [key]: e.target.value })} name={`${creating ? "new" : "edit"}_${key}`} autoComplete="off" {...props} />
    </label>
  );
  return (
    <div className="newuser">
      {field("first_name", "Nom")}
      {field("last_name", "Cognoms")}
      {field("email", "Correu electrònic", { type: "email" })}
      {field("phone", "Telèfon", { type: "tel" })}
      {field("username", "Usuari (per entrar)", { required: true, autoCapitalize: "off" })}
      {creating && field("password", "Clau inicial (mín. 8 caràcters)", { type: "password", required: true, minLength: 8, autoComplete: "new-password" })}
      <label>
        Tipus
        <select value={form.role} onChange={(e) => onChange({ ...form, role: e.target.value as Role })}>
          <option value="usuari">usuari</option>
          <option value="germa">germà</option>
          <option value="admin">admin</option>
        </select>
      </label>
    </div>
  );
}

const EMPTY: Form = { username: "", password: "", role: "usuari", first_name: "", last_name: "", email: "", phone: "" };

function EditUser({ user, catalog, onSaved }: { user: User; catalog: Catalog; onSaved: () => void }) {
  const [form, setForm] = useState<Form>({ ...EMPTY, ...user, password: "" });
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    api.userAccess(user.id).then(setAccess).catch((e) => setError(e.message));
  }, [user.id]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate(e.currentTarget);
    if (problem) return setError(problem);
    setError("");
    setState("Desant…");
    try {
      await api.updateUser(user.id, form);
      if (access && form.role !== "admin") setAccess(await api.setUserAccess(user.id, access));
      setState("Desat");
      onSaved();
    } catch (err) {
      setState("");
      setError((err as Error).message);
    }
  }

  return (
    <form className="edit" noValidate onSubmit={save}>
      <ProfileFields form={form} onChange={setForm} creating={false} />
      {form.role === "admin" ? (
        <p className="muted">Els administradors ho veuen tot.</p>
      ) : (
        access && <AccessFields value={access} onChange={setAccess} catalog={catalog} />
      )}
      <ErrorMessage message={error} />
      <button type="submit">Desar</button> <span className="muted">{state}</span>
    </form>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ contents: [], sites: [], agents: [] });
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [access, setAccess] = useState<Access>(NO_ACCESS);

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
    const problem = validate(e.currentTarget);
    if (problem) return setError(problem);
    setError("");
    let created: User;
    try {
      created = await api.createUser(form);
    } catch (err) {
      return setError((err as Error).message);
    }
    try {
      if (form.role !== "admin") await api.setUserAccess(created.id, access);
      setForm(EMPTY);
      setAccess(NO_ACCESS);
      await load();
    } catch (err) {
      await load();
      setOpen(created.id);
      setError(`Usuari creat, però no s'han pogut desar les autoritzacions: ${(err as Error).message}`);
    }
  }

  return (
    <section>
      <h1>Usuaris</h1>
      <p className="lead">Dades i autoritzacions de cada usuari. Els administradors ho veuen tot.</p>
      <ErrorMessage message={error} />
      <ul className="rows">
        {others.map((u) => {
          const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
          return (
            <li key={u.id}>
              <span>
                {name || u.username} <span className="muted">({u.username} · {u.role}{u.email ? ` · ${u.email}` : ""})</span>
              </span>
              <button
                className={`icon-btn${open === u.id ? " on" : ""}`}
                aria-label={`Editar ${u.username}`}
                title="Dades i autoritzacions"
                onClick={() => setOpen(open === u.id ? null : u.id)}
              >
                <KeyIcon />
              </button>
              {open === u.id && (
                <div style={{ flexBasis: "100%" }}>
                  <EditUser user={u} catalog={catalog} onSaved={() => void load()} />
                </div>
              )}
            </li>
          );
        })}
        {others.length === 0 && <li className="muted">Encara no hi ha cap altre usuari.</li>}
      </ul>

      <h2>Nou usuari</h2>
      <form className="edit" noValidate autoComplete="off" onSubmit={addUser}>
        <ProfileFields form={form} onChange={setForm} creating />
        {form.role !== "admin" && <AccessFields value={access} onChange={setAccess} catalog={catalog} />}
        <button type="submit">Crear usuari</button>
      </form>
    </section>
  );
}
