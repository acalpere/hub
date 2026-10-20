export type Role = "admin" | "germa" | "usuari";
export interface User { id: number; username: string; role: Role }
export type LoginStep = "mfa_required" | "mfa_setup";
export interface Passkey { id: number; label: string; created_at: string | null }
export interface MenuItem { id: number; name: string; url: string }
export interface Access {
  site_ids: number[]; agent_ids: number[]; work_agent_ids: number[]; content_ids: number[];
}
export interface Content { id: number; name: string; url: string; roles: string[] }
export interface Site { id: number; name: string; url: string; status: string; notes: string }
export interface Agent {
  id: number; name: string; kind: string; enabled: boolean; site_id: number | null;
  config: Record<string, unknown>; can_work?: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    // La capçalera personalitzada fa de protecció CSRF: el backend la exigeix a les escriptures.
    headers: { "X-Requested-With": "acalpere", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error ?? data.detail;
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Error inesperat");
  }
  return data as T;
}

export const api = {
  login: (usuari: string, clau: string) =>
    request<{ status: LoginStep }>("POST", "/auth/login", { usuari, clau }),
  mfa: (code: string) => request<User>("POST", "/auth/mfa", { code }),
  mfaSetup: () => request<{ secret: string; uri: string }>("POST", "/auth/mfa/setup"),
  mfaEnable: (code: string) => request<User>("POST", "/auth/mfa/enable", { code }),
  passkeyLoginOptions: () => request<unknown>("POST", "/auth/passkey/options"),
  passkeyLogin: (credential: unknown) => request<User>("POST", "/auth/passkey/login", { credential }),
  passkeys: () => request<Passkey[]>("GET", "/auth/passkeys"),
  passkeyRegisterOptions: () => request<unknown>("POST", "/auth/passkeys/options"),
  passkeyRegister: (credential: unknown, label: string) =>
    request<Passkey>("POST", "/auth/passkeys", { credential, label }),
  passkeyDelete: (id: number) => request<void>("DELETE", `/auth/passkeys/${id}`),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<User>("GET", "/auth/me"),
  menu: () => request<MenuItem[]>("GET", "/menu"),
  users: () => request<User[]>("GET", "/users"),
  createUser: (u: { username: string; password: string; role: Role }) => request<User>("POST", "/users", u),
  userAccess: (id: number) => request<Access>("GET", `/users/${id}/access`),
  setUserAccess: (id: number, a: Access) => request<Access>("PUT", `/users/${id}/access`, a),
  contents: () => request<Content[]>("GET", "/contents"),
  setAgentEnabled: (id: number, enabled: boolean) => request<Agent>("PUT", `/hub/agents/${id}/enabled`, { enabled }),
  sites: () => request<Site[]>("GET", "/hub/sites"),
  createSite: (s: Omit<Site, "id">) => request<Site>("POST", "/hub/sites", s),
  updateSite: (id: number, s: Partial<Omit<Site, "id">>) => request<Site>("PATCH", `/hub/sites/${id}`, s),
  deleteSite: (id: number) => request<void>("DELETE", `/hub/sites/${id}`),
  agents: () => request<Agent[]>("GET", "/hub/agents"),
  createAgent: (a: Omit<Agent, "id">) => request<Agent>("POST", "/hub/agents", a),
  updateAgent: (id: number, a: Partial<Omit<Agent, "id">>) => request<Agent>("PATCH", `/hub/agents/${id}`, a),
  deleteAgent: (id: number) => request<void>("DELETE", `/hub/agents/${id}`),
};
